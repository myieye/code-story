import {
  assembleChunkGraph,
  type Book,
  type Chunk,
  type ChunkEdge,
  type ChunkGraphFile,
  type FileContents,
  type FileDiff,
  fileImportEdges,
  type Hunk,
  type ImportGraph,
  isTestPath,
  type LineRange,
  LEFTOVERS_SECTION_ID,
  sectionAnchors,
  type SymbolSpan,
  testImplAnchors,
} from '@code-story/core';
import { extractReferences } from './references.js';
import { extractSymbols } from './treesitter.js';

export interface ChunkGraphBuildInput {
  /** Compiled chunks (book chunks incl. leftovers) — edge endpoints are these ids. */
  chunks: Chunk[];
  /** Fetched file contents keyed by path (from `computeChunks`). */
  contents: Map<string, FileContents>;
  /** File-level import graph (disambiguation + `file-imports` fallback edges). */
  graph: ImportGraph;
  /** Compiled book — section anchors + the role/anchor data test-anchor edges ride on. */
  book: Book;
  /** Changed files, for per-file diff status (deleted files resolve on the base side). */
  files: FileDiff[];
  headSha: string;
}

interface FileInfo {
  side: 'head' | 'base';
  content: string;
  chunks: Chunk[];
  symbols: SymbolSpan[];
}

/**
 * Builds the chunk relatedness graph (spec 05 slice 1). Three edge layers, all chunk-grained:
 * - `calls`/`exercises` (source `references`): each chunk's changed-line references, resolved to a
 *   defining CHANGED chunk via the changed-file symbol tables — a call originating in a test file is
 *   `exercises` (never also `calls`), so a calls-DFS can't cross from a test into impl.
 * - `file-imports` (source `import-graph`): the file-level import edges at section-anchor chunks.
 * - `exercises` (source `test-anchor`): the file-level test→impl anchor relation at anchor chunks.
 *
 * Precision over recall: an ambiguous reference (a name defined in several changed files with no
 * unique importing edge, or whose definition sits in no single changed chunk) yields no edge. Reads
 * only already-fetched content (no git); reuses `extractReferences`/`extractSymbols` seams.
 */
export async function buildChunkGraph(input: ChunkGraphBuildInput): Promise<ChunkGraphFile> {
  const statusByFile = new Map(input.files.map((f) => [f.path, f.status]));
  const chunksByFile = new Map<string, Chunk[]>();
  for (const chunk of input.chunks) {
    const list = chunksByFile.get(chunk.file) ?? [];
    list.push(chunk);
    chunksByFile.set(chunk.file, list);
  }

  const infoByFile = new Map<string, FileInfo>();
  for (const [file, chunks] of chunksByFile) {
    const side = statusByFile.get(file) === 'deleted' ? 'base' : 'head';
    const lines = side === 'base' ? input.contents.get(file)?.base : input.contents.get(file)?.head;
    if (lines === undefined) continue;
    const content = lines.join('\n');
    const symbols = (await extractSymbols(file, content)) ?? [];
    infoByFile.set(file, { side, content, chunks, symbols });
  }

  // name -> defining declarations across changed files (all nesting levels; first span per file).
  const defsByName = new Map<string, { file: string; span: SymbolSpan }[]>();
  for (const [file, info] of infoByFile) {
    const seen = new Set<string>();
    for (const span of flattenSpans(info.symbols)) {
      if (seen.has(span.name)) continue;
      seen.add(span.name);
      const list = defsByName.get(span.name) ?? [];
      list.push({ file, span });
      defsByName.set(span.name, list);
    }
  }

  const raw: ChunkEdge[] = [];
  for (const [file, info] of infoByFile) {
    const imported = new Set(input.graph.edges.filter((e) => e.from === file).map((e) => e.to));
    const kind = isTestPath(file) ? 'exercises' : 'calls';
    for (const caller of info.chunks) {
      const ranges = ownedLines(caller.hunks, info.side);
      if (ranges.length === 0) continue;
      const refs = await extractReferences(file, info.content, ranges);
      for (const ref of refs) {
        const target = resolveTarget(ref.name, caller, defsByName, imported, infoByFile);
        if (!target) continue;
        raw.push({ from: caller.id, to: target.id, kind, fromLines: [{ start: ref.line, end: ref.line }], source: 'references' });
      }
    }
  }

  const anchorByFile = sectionAnchors(input.book);
  raw.push(...fileImportEdges(input.graph, anchorByFile));

  const sectionFiles = input.book.sections.filter((s) => s.id !== LEFTOVERS_SECTION_ID).map((s) => s.id);
  for (const { test, impl } of testImplAnchors(sectionFiles, input.chunks, input.graph)) {
    const from = anchorByFile.get(test);
    const to = anchorByFile.get(impl);
    if (from !== undefined && to !== undefined) raw.push({ from, to, kind: 'exercises', fromLines: [], source: 'test-anchor' });
  }

  return assembleChunkGraph(input.headSha, raw);
}

/**
 * Resolves a referenced name to the single changed chunk that defines it, or undefined. One defining
 * changed file wins outright; several are disambiguated to the unique one the caller's file imports.
 * The chosen file's span must sit in exactly one changed chunk (the defining chunk). A reference back
 * into the caller's own chunk is dropped (self-call, not navigation).
 */
function resolveTarget(
  name: string,
  caller: Chunk,
  defsByName: Map<string, { file: string; span: SymbolSpan }[]>,
  imported: Set<string>,
  infoByFile: Map<string, FileInfo>,
): Chunk | undefined {
  const cands = defsByName.get(name);
  if (!cands || cands.length === 0) return undefined;

  const files = [...new Set(cands.map((c) => c.file))];
  let chosenFile: string | undefined;
  if (files.length === 1) chosenFile = files[0];
  else {
    const preferred = files.filter((f) => imported.has(f));
    chosenFile = preferred.length === 1 ? preferred[0] : undefined;
  }
  if (chosenFile === undefined) return undefined;

  const span = cands.find((c) => c.file === chosenFile)!.span;
  const info = infoByFile.get(chosenFile)!;
  const owning = info.chunks.filter((c) => ownedLines(c.hunks, info.side).some((r) => span.startLine >= r.start && span.startLine <= r.end));
  if (owning.length !== 1) return undefined;
  const target = owning[0]!;
  return target.id === caller.id ? undefined : target;
}

function flattenSpans(spans: SymbolSpan[]): SymbolSpan[] {
  const out: SymbolSpan[] = [];
  for (const s of spans) {
    out.push(s);
    out.push(...flattenSpans(s.children));
  }
  return out;
}

/** A chunk's owned line ranges on the given side (the exact hunk coverage). */
function ownedLines(hunks: Hunk[], side: 'head' | 'base'): LineRange[] {
  const ranges: LineRange[] = [];
  for (const h of hunks) {
    const start = side === 'head' ? h.headStart : h.baseStart;
    const count = side === 'head' ? h.headCount : h.baseCount;
    if (count > 0) ranges.push({ start, end: start + count - 1 });
  }
  return ranges;
}
