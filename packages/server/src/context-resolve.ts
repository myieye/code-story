import path from 'node:path';
import {
  capBody,
  type Chunk,
  type ContextDefinition,
  type ContextEdges,
  type ContextPayload,
  contextFingerprint,
  type FileStatus,
  type Hunk,
  type ImportGraph,
  type LineRange,
  resolveTsSpecifier,
  type SymbolSpan,
} from '@code-story/core';
import { extractImports } from './imports.js';
import { extractReferences } from './references.js';
import { extractSymbols } from './treesitter.js';

/** A changed file and its diff status — the resolver reads deleted files at base, everything else at head. */
export interface ChangedFile {
  path: string;
  status: FileStatus;
}

export interface ContextResolveDeps {
  /** File content at a sha, or undefined when the path doesn't exist there (git errors fold to undefined). */
  fileAt(sha: string, filePath: string): Promise<string | undefined>;
  /** Every path present at head (`git ls-tree`), for unchanged-file resolution. */
  headPaths: Set<string>;
  headSha: string;
  baseSha: string;
}

/** Extensions whose imports name a file path — the only languages that get unchanged-file lookup (spec 04). */
const PATH_SPECIFIER_EXTS = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'mts', 'cts', 'svelte']);

/**
 * Per-job definition resolver (spec 04 slice 3). Holds the (sha, path) content + symbol-table caches
 * so a 125-chunk book re-fetching one popular util reads it once, not 40 times. Fail-open everywhere:
 * a missing file, an unparseable one, or any ambiguity yields no definition, never a wrong one.
 */
export function createContextResolver(deps: ContextResolveDeps) {
  const contentCache = new Map<string, Promise<string | undefined>>();
  const symbolCache = new Map<string, Promise<SymbolSpan[] | undefined>>();

  const readContent = (sha: string, filePath: string): Promise<string | undefined> => {
    const key = `${sha}\0${filePath}`;
    let hit = contentCache.get(key);
    if (!hit) {
      hit = deps.fileAt(sha, filePath);
      contentCache.set(key, hit);
    }
    return hit;
  };

  const symbolsAt = (sha: string, filePath: string): Promise<SymbolSpan[] | undefined> => {
    const key = `${sha}\0${filePath}`;
    let hit = symbolCache.get(key);
    if (!hit) {
      hit = readContent(sha, filePath).then((content) =>
        content === undefined ? undefined : extractSymbols(filePath, content),
      );
      symbolCache.set(key, hit);
    }
    return hit;
  };

  async function resolve(chunk: Chunk, changedFiles: ChangedFile[], graph: ImportGraph): Promise<ContextPayload> {
    const payload: ContextPayload = {
      chunkId: chunk.id,
      fingerprint: contextFingerprint(deps.headSha, chunk.id),
      generatedAt: new Date().toISOString(),
      facts: { definitions: [], edges: edgesFor(chunk.file, graph) },
    };

    const statusOf = new Map(changedFiles.map((f) => [f.path, f.status]));
    const deleted = statusOf.get(chunk.file) === 'deleted';
    const chunkSha = deleted ? deps.baseSha : deps.headSha;
    const ranges = hunkRanges(chunk.hunks, deleted ? 'base' : 'head');
    if (ranges.length === 0) return payload;

    const content = await readContent(chunkSha, chunk.file);
    if (content === undefined) return payload;

    const refs = await extractReferences(chunk.file, content, ranges);
    if (refs.length === 0) return payload;

    const imported = new Set(graph.edges.filter((e) => e.from === chunk.file).map((e) => e.to));
    const specifierTargets = pathSpecifierLang(chunk.file)
      ? unchangedImportTargets(chunk.file, content, deps.headPaths, statusOf)
      : [];

    const byKey = new Map<string, ContextDefinition>();
    for (const ref of refs) {
      const def =
        (await resolveChanged(ref.name, chunk, ranges, changedFiles, imported, chunkSha)) ??
        (await resolveUnchanged(ref.name, specifierTargets));
      if (def) byKey.set(`${def.file}\0${def.symbol}`, def);
    }
    payload.facts.definitions = [...byKey.values()];
    return payload;
  }

  /**
   * Changed-file lookup (all languages): the symbol tables `computeChunks` builds, rebuilt here from
   * the same content (memoized). One defining file wins outright; several are disambiguated to the
   * single one the chunk's file imports, else it stays ambiguous (no definition).
   */
  async function resolveChanged(
    name: string,
    chunk: Chunk,
    ranges: LineRange[],
    changedFiles: ChangedFile[],
    imported: Set<string>,
    chunkSha: string,
  ): Promise<ContextDefinition | undefined> {
    const matches: { file: string; span: SymbolSpan; sha: string }[] = [];
    for (const cf of changedFiles) {
      const sha = cf.status === 'deleted' ? deps.baseSha : deps.headSha;
      const span = findSymbol(await symbolsAt(sha, cf.path), name);
      if (!span) continue;
      // A symbol the chunk itself declares is not "called code the reviewer can't see" — skip it.
      if (cf.path === chunk.file && overlaps(span, ranges)) continue;
      matches.push({ file: cf.path, span, sha });
    }
    const chosen = matches.length === 1 ? matches[0] : disambiguate(matches, imported);
    if (!chosen) return undefined;
    // A changed match at the chunk's own sha keeps that sha; other changed files read at head.
    return buildDefinition(name, chosen.file, chosen.span, chosen.file === chunk.file ? chunkSha : chosen.sha, true);
  }

  /** Unchanged-file lookup (path-specifier languages): exactly one imported unchanged file must define it. */
  async function resolveUnchanged(name: string, targets: string[]): Promise<ContextDefinition | undefined> {
    const matches: { file: string; span: SymbolSpan }[] = [];
    for (const file of targets) {
      const span = findSymbol(await symbolsAt(deps.headSha, file), name);
      if (span) matches.push({ file, span });
    }
    if (matches.length !== 1) return undefined;
    return buildDefinition(name, matches[0]!.file, matches[0]!.span, deps.headSha, false);
  }

  async function buildDefinition(
    symbol: string,
    file: string,
    span: SymbolSpan,
    sha: string,
    changed: boolean,
  ): Promise<ContextDefinition | undefined> {
    const content = await readContent(sha, file);
    if (content === undefined) return undefined;
    const body = capBody(content.split('\n').slice(span.startLine - 1, span.endLine).join('\n'));
    return { symbol, file, changed, body, lineStart: span.startLine, sha };
  }

  return { resolve };
}

/** The chunk's section-level import edges, lifted straight from the ordering graph (free facts). */
function edgesFor(file: string, graph: ImportGraph): ContextEdges {
  const imports = new Set<string>();
  const importedBy = new Set<string>();
  for (const e of graph.edges) {
    if (e.from === e.to) continue;
    if (e.from === file) imports.add(e.to);
    if (e.to === file) importedBy.add(e.from);
  }
  return { imports: [...imports], importedBy: [...importedBy] };
}

/** Import specifiers of `filePath` that resolve, against the head listing, to a file NOT in the diff. */
function unchangedImportTargets(
  filePath: string,
  content: string,
  headPaths: Set<string>,
  changed: Map<string, FileStatus>,
): string[] {
  const targets = new Set<string>();
  for (const spec of extractImports(filePath, content)?.specifiers ?? []) {
    const target = resolveTsSpecifier(filePath, spec, headPaths);
    if (target && !changed.has(target)) targets.add(target);
  }
  return [...targets];
}

/** Of several changed files defining a name, the one the chunk's file imports — unique or nothing. */
function disambiguate<T extends { file: string }>(matches: T[], imported: Set<string>): T | undefined {
  const preferred = matches.filter((m) => imported.has(m.file));
  return preferred.length === 1 ? preferred[0] : undefined;
}

/** First span (pre-order, source order) whose name matches, searching nested declarations. */
function findSymbol(symbols: SymbolSpan[] | undefined, name: string): SymbolSpan | undefined {
  for (const s of symbols ?? []) {
    if (s.name === name) return s;
    const nested = findSymbol(s.children, name);
    if (nested) return nested;
  }
  return undefined;
}

function overlaps(span: SymbolSpan, ranges: LineRange[]): boolean {
  return ranges.some((r) => span.startLine <= r.end && span.endLine >= r.start);
}

function hunkRanges(hunks: Hunk[], side: 'head' | 'base'): LineRange[] {
  const ranges: LineRange[] = [];
  for (const h of hunks) {
    const start = side === 'head' ? h.headStart : h.baseStart;
    const count = side === 'head' ? h.headCount : h.baseCount;
    if (count > 0) ranges.push({ start, end: start + count - 1 });
  }
  return ranges;
}

function pathSpecifierLang(filePath: string): boolean {
  return PATH_SPECIFIER_EXTS.has(path.extname(filePath).slice(1).toLowerCase());
}
