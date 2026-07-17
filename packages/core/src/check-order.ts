import { CALLS_DFS_KINDS, type ChunkGraph, edgesOfKinds } from './chunk-graph.js';
import { type ImportGraph } from './import-graph.js';
import { type Book, type Chunk, isLowSignal, LEFTOVERS_SECTION_ID } from './model.js';
import { isTestPath } from './roles.js';
import { FILE_MODE_STORY_CONFIG, type StoryConfig } from './story-config.js';

export interface OrderReport {
  ok: boolean;
  /** Consumers reading on the wrong side of a dependency, per the configured direction. */
  importInversions: { earlier: string; later: string }[];
  /**
   * Inversions whose two endpoints sit in the same import/call cycle. No ordering can satisfy both
   * directions, so these are reported but never gate `ok`.
   */
  cycleInversions: { earlier: string; later: string }[];
  /** Tests reading on the wrong side of the impl they exercise, per the configured placement. */
  testBeforeImpl: { test: string; impl: string }[];
}

export interface CheckOrderOptions {
  /** Ordering axioms to validate against; defaults to today's dependency-first / tests-after. */
  config?: StoryConfig;
  /**
   * Chunk relatedness graph. When present, `checkOrder` validates chunk positions in the flattened
   * occurrence order (chapter mode, spec 05) against the graph's `calls`/`exercises` edges. When
   * absent it validates file-section positions against the import graph (file mode — unchanged).
   */
  chunkGraph?: ChunkGraph;
}

/**
 * R-034 inversion counter (spec 01/05 eval). Two modes, chosen by `options.chunkGraph`:
 *
 * - **File mode** (no chunkGraph): the original section-position check over the import graph —
 *   every file pair where a dependency reads after its consumer, tests reported separately,
 *   same-cycle pairs informational, all-stub sections exempt. Unchanged.
 * - **Chapter mode** (chunkGraph given): chunk-position semantics — validates each chunk's place in
 *   the flattened occurrence order against the graph's `calls` edges (direction per config) and
 *   `exercises` edges (test placement per config). The direction and test gates invert with config.
 */
export function checkOrder(book: Book, graph: ImportGraph, chunks: Chunk[], options?: CheckOrderOptions): OrderReport {
  const config = options?.config ?? FILE_MODE_STORY_CONFIG;
  return options?.chunkGraph
    ? checkChunkOrder(book, options.chunkGraph, chunks, config)
    : checkFileOrder(book, graph, chunks);
}

function checkFileOrder(book: Book, graph: ImportGraph, chunks: Chunk[]): OrderReport {
  const position = new Map<string, number>();
  book.sections.forEach((s, i) => {
    if (s.id !== LEFTOVERS_SECTION_ID) position.set(s.id, i);
  });

  const chunksByFile = new Map<string, Chunk[]>();
  for (const chunk of chunks) {
    const list = chunksByFile.get(chunk.file) ?? [];
    list.push(chunk);
    chunksByFile.set(chunk.file, list);
  }
  const lowSignal = (file: string) => {
    const list = chunksByFile.get(file) ?? [];
    return list.length > 0 && list.every(isLowSignal);
  };

  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!position.has(edge.from) || !position.has(edge.to)) continue;
    const targets = adjacency.get(edge.from) ?? [];
    targets.push(edge.to);
    adjacency.set(edge.from, targets);
  }
  const inSameCycle = sameCycleTest(adjacency);

  const importInversions: OrderReport['importInversions'] = [];
  const cycleInversions: OrderReport['cycleInversions'] = [];
  const testBeforeImpl: OrderReport['testBeforeImpl'] = [];
  const seen = new Set<string>();
  for (const edge of graph.edges) {
    const consumer = position.get(edge.from);
    const dependency = position.get(edge.to);
    if (consumer === undefined || dependency === undefined || consumer >= dependency) continue;
    if (lowSignal(edge.from) || lowSignal(edge.to)) continue;
    const key = `${edge.from}\0${edge.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (inSameCycle(edge.from, edge.to)) cycleInversions.push({ earlier: edge.from, later: edge.to });
    else if (isTestPath(edge.from) && !isTestPath(edge.to)) testBeforeImpl.push({ test: edge.from, impl: edge.to });
    else importInversions.push({ earlier: edge.from, later: edge.to });
  }
  return {
    ok: importInversions.length === 0 && testBeforeImpl.length === 0,
    importInversions,
    cycleInversions,
    testBeforeImpl,
  };
}

function checkChunkOrder(book: Book, chunkGraph: ChunkGraph, chunks: Chunk[], config: StoryConfig): OrderReport {
  const position = new Map<string, number>();
  let i = 0;
  for (const section of book.sections) {
    for (const occ of section.occurrences) if (!position.has(occ.chunkId)) position.set(occ.chunkId, i++);
  }
  const lowSignalById = new Map(chunks.map((c) => [c.id, isLowSignal(c)]));
  const lowSignal = (id: string) => lowSignalById.get(id) === true;
  const fileById = new Map(chunks.map((c) => [c.id, c.file]));
  const isTest = (id: string) => isTestPath(fileById.get(id) ?? '');

  const callAdjacency = new Map<string, string[]>();
  for (const edge of edgesOfKinds(chunkGraph.edges, CALLS_DFS_KINDS)) {
    if (!position.has(edge.from) || !position.has(edge.to)) continue;
    (callAdjacency.get(edge.from) ?? callAdjacency.set(edge.from, []).get(edge.from)!).push(edge.to);
  }
  const inSameCycle = sameCycleTest(callAdjacency);

  const importInversions: OrderReport['importInversions'] = [];
  const cycleInversions: OrderReport['cycleInversions'] = [];
  const testBeforeImpl: OrderReport['testBeforeImpl'] = [];

  const consumerFirst = config.direction === 'consumer-first';
  const seenCall = new Set<string>();
  for (const edge of edgesOfKinds(chunkGraph.edges, CALLS_DFS_KINDS)) {
    const from = position.get(edge.from);
    const to = position.get(edge.to);
    if (from === undefined || to === undefined || edge.from === edge.to) continue;
    if (lowSignal(edge.from) || lowSignal(edge.to)) continue;
    // consumer-first wants the caller (from) earlier; dependency-first wants it later.
    const violated = consumerFirst ? from > to : from < to;
    if (!violated) continue;
    const key = `${edge.from}\0${edge.to}`;
    if (seenCall.has(key)) continue;
    seenCall.add(key);
    const pair = from < to ? { earlier: edge.from, later: edge.to } : { earlier: edge.to, later: edge.from };
    if (inSameCycle(edge.from, edge.to)) cycleInversions.push(pair);
    else importInversions.push(pair);
  }

  if (config.testPlacement !== 'end') {
    const wantBefore = config.testPlacement === 'before';
    const seenEx = new Set<string>();
    for (const edge of chunkGraph.edges) {
      if (edge.kind !== 'exercises') continue;
      // Only a test→impl relation is gated; a test calling a page-object/helper (also test-role) is not.
      if (!isTest(edge.from) || isTest(edge.to)) continue;
      const test = position.get(edge.from);
      const impl = position.get(edge.to);
      if (test === undefined || impl === undefined || edge.from === edge.to) continue;
      if (lowSignal(edge.from) || lowSignal(edge.to)) continue;
      const violated = wantBefore ? test > impl : test < impl;
      if (!violated) continue;
      const key = `${edge.from}\0${edge.to}`;
      if (seenEx.has(key)) continue;
      seenEx.add(key);
      if (inSameCycle(edge.from, edge.to)) cycleInversions.push({ earlier: edge.from, later: edge.to });
      else testBeforeImpl.push({ test: edge.from, impl: edge.to });
    }
  }

  return {
    ok: importInversions.length === 0 && testBeforeImpl.length === 0,
    importInversions,
    cycleInversions,
    testBeforeImpl,
  };
}

/** A reachability-based "both endpoints in the same cycle" test over a directed adjacency map. */
function sameCycleTest(adjacency: Map<string, string[]>): (a: string, b: string) => boolean {
  const reachable = new Map<string, Set<string>>();
  const reach = (start: string): Set<string> => {
    const cached = reachable.get(start);
    if (cached) return cached;
    const found = new Set<string>();
    const stack = [start];
    while (stack.length > 0) {
      for (const next of adjacency.get(stack.pop()!) ?? []) {
        if (!found.has(next)) {
          found.add(next);
          stack.push(next);
        }
      }
    }
    reachable.set(start, found);
    return found;
  };
  return (a, b) => reach(a).has(b) && reach(b).has(a);
}
