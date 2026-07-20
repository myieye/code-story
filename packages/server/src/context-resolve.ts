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
  isTestPath,
  type LineRange,
  resolveTsSpecifier,
  type SymbolSpan,
} from '@code-story/core';
import { extractImports } from './imports.js';
import { extractReferences, resolveDefiningSpan } from './references.js';
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

  const shaOf = (status: FileStatus): string => (status === 'deleted' ? deps.baseSha : deps.headSha);

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

    // A test chunk's one changed line often calls into impl on adjacent *unchanged* setup lines
    // (R-008/R-009: "a lone test without its setup isn't enough"). Widen the reference scan to the
    // enclosing test-method body so those exercised calls resolve; non-test chunks keep spec 04's
    // changed-lines-only scoping (facts about *these* changes).
    let scanRanges = ranges;
    if (isTestPath(chunk.file)) {
      const symbols = await symbolsAt(chunkSha, chunk.file);
      scanRanges = ranges.map((r) => innermostEnclosing(symbols, r) ?? r);
    }

    const refs = await extractReferences(chunk.file, content, scanRanges);
    if (refs.length === 0) return payload;

    const imported = new Set(graph.edges.filter((e) => e.from === chunk.file).map((e) => e.to));
    const specifierTargets = pathSpecifierLang(chunk.file)
      ? unchangedImportTargets(chunk.file, content, deps.headPaths, statusOf)
      : [];

    const shaByFile = new Map(changedFiles.map((cf) => [cf.path, shaOf(cf.status)]));
    const changedSymbols: [string, SymbolSpan[] | undefined][] = [];
    for (const cf of changedFiles) changedSymbols.push([cf.path, await symbolsAt(shaOf(cf.status), cf.path)]);

    const byKey = new Map<string, ContextDefinition>();
    for (const ref of refs) {
      const def =
        (await resolveChanged(ref.name, chunk, ranges, changedSymbols, shaByFile, imported)) ??
        (await resolveUnchanged(ref.name, chunk.file, specifierTargets));
      if (def) byKey.set(`${def.file}\0${def.symbol}`, def);
    }
    payload.facts.definitions = [...byKey.values()];
    return payload;
  }

  /** Changed-file lookup (all languages): the referenced name's unique justified defining span, if any. */
  async function resolveChanged(
    name: string,
    chunk: Chunk,
    ranges: LineRange[],
    changedSymbols: readonly (readonly [string, SymbolSpan[] | undefined])[],
    shaByFile: Map<string, string>,
    imported: Set<string>,
  ): Promise<ContextDefinition | undefined> {
    // A symbol the chunk itself declares is not "called code the reviewer can't see" — skip it.
    const skip = (file: string, span: SymbolSpan) => file === chunk.file && overlaps(span, ranges);
    const chosen = resolveDefiningSpan(name, chunk.file, imported, changedSymbols, skip);
    if (!chosen) return undefined;
    return buildDefinition(name, chosen.file, chosen.span, shaByFile.get(chosen.file)!, true);
  }

  /** Unchanged-file lookup (path-specifier languages): the name's unique defining span among imported unchanged files. */
  async function resolveUnchanged(
    name: string,
    consumerFile: string,
    targets: string[],
  ): Promise<ContextDefinition | undefined> {
    const symbolsByFile: [string, SymbolSpan[] | undefined][] = [];
    for (const file of targets) symbolsByFile.push([file, await symbolsAt(deps.headSha, file)]);
    const chosen = resolveDefiningSpan(name, consumerFile, new Set(targets), symbolsByFile);
    if (!chosen) return undefined;
    return buildDefinition(name, chosen.file, chosen.span, deps.headSha, false);
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


function overlaps(span: SymbolSpan, ranges: LineRange[]): boolean {
  return ranges.some((r) => span.startLine <= r.end && span.endLine >= r.start);
}

/** The smallest symbol span (at any nesting) that fully contains `range`, or undefined if none does. */
function innermostEnclosing(symbols: SymbolSpan[] | undefined, range: LineRange): LineRange | undefined {
  let best: SymbolSpan | undefined;
  for (const s of walkSpans(symbols)) {
    if (s.startLine <= range.start && s.endLine >= range.end) {
      if (!best || s.endLine - s.startLine < best.endLine - best.startLine) best = s;
    }
  }
  return best ? { start: best.startLine, end: best.endLine } : undefined;
}

function* walkSpans(symbols: SymbolSpan[] | undefined): Generator<SymbolSpan> {
  for (const s of symbols ?? []) {
    yield s;
    yield* walkSpans(s.children);
  }
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
