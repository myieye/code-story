import { type ImportGraph } from './import-graph.js';
import { type Book, type Chunk, isLowSignal, LEFTOVERS_SECTION_ID } from './model.js';
import { isTestPath } from './roles.js';

export interface OrderReport {
  ok: boolean;
  /** Section pairs where a consumer reads before its dependency. */
  importInversions: { earlier: string; later: string }[];
  /**
   * Inversions whose two files sit in the same import cycle (strongly-connected component).
   * No ordering can satisfy both directions, so these are reported but never gate `ok`.
   */
  cycleInversions: { earlier: string; later: string }[];
  /** Test sections reading before an impl section they import. */
  testBeforeImpl: { test: string; impl: string }[];
}

/**
 * R-034 inversion counter (spec 01 eval): for an ordered book + import graph, flag every
 * section pair where a dependency reads after its consumer. Test→impl inversions are reported
 * in their own list, not both. Edges touching all-stub sections are exempt — the compiler
 * parks low-signal sections at the tail by design, even when impl imports them.
 */
export function checkOrder(book: Book, graph: ImportGraph, chunks: Chunk[]): OrderReport {
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
  const inSameCycle = (a: string, b: string) => reach(a).has(b) && reach(b).has(a);

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
