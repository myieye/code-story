import { type ImportGraph } from './import-graph.js';
import { type Book, type Chunk, isLowSignal } from './model.js';
import { isTestPath } from './roles.js';

export interface OrderReport {
  ok: boolean;
  /** Section pairs where a consumer reads before its dependency. */
  importInversions: { earlier: string; later: string }[];
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
    if (s.id !== '(leftovers)') position.set(s.id, i);
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

  const importInversions: OrderReport['importInversions'] = [];
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
    if (isTestPath(edge.from) && !isTestPath(edge.to)) testBeforeImpl.push({ test: edge.from, impl: edge.to });
    else importInversions.push({ earlier: edge.from, later: edge.to });
  }
  return { ok: importInversions.length === 0 && testBeforeImpl.length === 0, importInversions, testBeforeImpl };
}
