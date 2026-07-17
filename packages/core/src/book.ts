import { type FileDiff, type Hunk } from './diff.js';
import { type ImportGraph } from './import-graph.js';
import { type Book, type Chunk, chunkId, LEFTOVERS_SECTION_ID, type Occurrence, type Section } from './model.js';
import { type FileRole, fileRoles } from './roles.js';

export interface CompileBookInput {
  /** Changed files in git diff order — the ordering tie-break source. */
  files: FileDiff[];
  chunks: Chunk[];
  graph: ImportGraph;
  headSha: string;
}

export interface CompiledBook {
  book: Book;
  /** Input chunks plus any synthesized leftover chunks. */
  chunks: Chunk[];
}

/**
 * Book compile (spec 00 + spec 01 tier 0): one section per changed file, every chunk exactly
 * one primary occurrence; sections ordered by role (impl topo-sorted deps-first, tests after
 * their impl, periphery, low-signal). Any changed line the chunker failed to claim lands in a
 * synthesized leftover chunk in a final section — the R-001 backstop, so no code path drops
 * a line. Deterministic for a fixed input (R-038 depends on stable re-runs).
 */
export function compileBook(input: CompileBookInput): CompiledBook {
  const byFile = new Map<string, Chunk[]>();
  for (const chunk of input.chunks) {
    const list = byFile.get(chunk.file) ?? [];
    list.push(chunk);
    byFile.set(chunk.file, list);
  }

  const sectionsByFile = new Map<string, Section>();
  const leftovers: Chunk[] = [];
  for (const file of input.files) {
    const fileChunks = byFile.get(file.path) ?? [];
    leftovers.push(...leftoverChunks(file, fileChunks));
    if (fileChunks.length > 0) {
      sectionsByFile.set(file.path, { id: file.path, title: file.path, occurrences: fileChunks.map(primary) });
    }
  }

  const gitOrder = [...sectionsByFile.keys()];
  const roles = fileRoles(gitOrder, input.chunks, input.graph);
  const sections = orderFiles(gitOrder, roles, input.graph).map((f) => sectionsByFile.get(f)!);
  if (leftovers.length > 0) {
    sections.push({ id: LEFTOVERS_SECTION_ID, title: 'Leftovers', occurrences: leftovers.map(primary) });
  }

  return { book: { sections, headSha: input.headSha }, chunks: [...input.chunks, ...leftovers] };
}

/** Spec 01 tier-0 section order: impl (topo) each followed by its tests, then periphery, then low-signal. */
function orderFiles(gitOrder: string[], roles: Map<string, FileRole>, graph: ImportGraph): string[] {
  const byRole = (role: FileRole) => gitOrder.filter((f) => roles.get(f) === role);
  const impl = topoSort(byRole('impl'), graph);
  const implOrder = new Map(impl.map((f, i) => [f, i]));

  const testsByAnchor = new Map<string, string[]>();
  const unanchored: string[] = [];
  for (const test of byRole('test')) {
    const anchor = anchorImpl(test, impl, implOrder, graph);
    if (anchor === undefined) unanchored.push(test);
    else testsByAnchor.set(anchor, [...(testsByAnchor.get(anchor) ?? []), test]);
  }

  return [
    ...impl.flatMap((f) => [f, ...(testsByAnchor.get(f) ?? [])]),
    ...unanchored,
    ...byRole('periphery'),
    ...byRole('low-signal'),
  ];
}

/**
 * Dependencies-first topological sort. Greedy Kahn picking the git-earliest ready file keeps
 * ties in git order. When a cycle leaves nothing ready, only one node from a single cyclic SCC
 * is force-emitted (see `cycleBreakIndex`) before Kahn resumes — so a file that merely depends
 * *into* a cycle still waits for its dependency instead of being dragged forward with it.
 */
function topoSort(files: string[], graph: ImportGraph): string[] {
  const deps = new Map<string, string[]>(files.map((f) => [f, []]));
  for (const edge of graph.edges) {
    if (deps.has(edge.from) && deps.has(edge.to)) deps.get(edge.from)!.push(edge.to);
  }

  const remaining = [...files];
  const emitted = new Set<string>();
  const result: string[] = [];
  const emit = (index: number) => {
    const [file] = remaining.splice(index, 1);
    emitted.add(file!);
    result.push(file!);
  };
  while (remaining.length > 0) {
    const ready = remaining.findIndex((f) => deps.get(f)!.every((d) => emitted.has(d)));
    emit(ready >= 0 ? ready : cycleBreakIndex(remaining, deps));
  }
  return result;
}

/**
 * A Kahn stall means the still-unemitted files hold at least one import cycle. Break the cycle
 * whose members have the fewest dependencies pending outside it (a condensation source, so
 * emitting into it forces no avoidable inversion; ties resolve by git order of the SCC's
 * earliest member), and within that cycle emit the git-earliest member. Resuming Kahn then
 * unwinds the rest, leaving only the one unavoidable same-cycle inversion (informational per
 * checkOrder's cycleInversions). Returns the index in `remaining` of the node to emit.
 */
function cycleBreakIndex(remaining: string[], deps: Map<string, string[]>): number {
  const present = new Set(remaining);
  const rank = new Map(remaining.map((f, i) => [f, i]));

  let best: { members: Set<string>; externalInDegree: number; firstRank: number } | undefined;
  for (const scc of stronglyConnected(remaining, deps)) {
    const isCycle = scc.length > 1 || deps.get(scc[0]!)!.includes(scc[0]!);
    if (!isCycle) continue;
    const members = new Set(scc);
    let externalInDegree = 0;
    for (const f of scc) {
      for (const d of deps.get(f)!) if (present.has(d) && !members.has(d)) externalInDegree++;
    }
    const firstRank = Math.min(...scc.map((f) => rank.get(f)!));
    if (
      best === undefined ||
      externalInDegree < best.externalInDegree ||
      (externalInDegree === best.externalInDegree && firstRank < best.firstRank)
    ) {
      best = { members, externalInDegree, firstRank };
    }
  }

  // A stalled remainder always contains a cycle, so `best` is always set; the git-order fallback
  // only exists to bound the loop rather than trust that invariant.
  if (best === undefined) return 0;
  return best.firstRank;
}

/** Tarjan SCCs of the subgraph induced on `nodes`; deterministic given node and edge order. */
function stronglyConnected(nodes: string[], deps: Map<string, string[]>): string[][] {
  const present = new Set(nodes);
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: string[][] = [];
  let counter = 0;

  const connect = (v: string) => {
    index.set(v, counter);
    low.set(v, counter);
    counter++;
    stack.push(v);
    onStack.add(v);
    for (const w of deps.get(v)!) {
      if (!present.has(w)) continue;
      if (!index.has(w)) {
        connect(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, index.get(w)!));
      }
    }
    if (low.get(v) === index.get(v)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      sccs.push(scc);
    }
  };

  for (const v of nodes) if (!index.has(v)) connect(v);
  return sccs;
}

/** The impl section a test goes after: the LAST impl it imports, else the best stem match. */
function anchorImpl(
  test: string,
  impl: string[],
  implOrder: Map<string, number>,
  graph: ImportGraph,
): string | undefined {
  let last: string | undefined;
  for (const edge of graph.edges) {
    if (edge.from !== test) continue;
    const at = implOrder.get(edge.to);
    if (at !== undefined && (last === undefined || at > implOrder.get(last)!)) last = edge.to;
  }
  return last ?? stemMatch(test, impl, implOrder);
}

/**
 * Path-stem fallback (HistoryServiceActivityTests.cs → HistoryService.cs): strip test
 * conventions from the test's stem, then find the longest impl stem that equals it or
 * prefixes it. Non-exact prefixes must be ≥4 chars — precision over recall.
 */
function stemMatch(test: string, impl: string[], implOrder: Map<string, number>): string | undefined {
  const testStem = fileStem(test)
    .replace(/\.(test|spec)$/, '')
    .replace(/tests?$/, '');
  let best: string | undefined;
  for (const file of impl) {
    const stem = fileStem(file);
    if (stem !== testStem && !(stem.length >= 4 && testStem.startsWith(stem))) continue;
    if (
      best === undefined ||
      stem.length > fileStem(best).length ||
      (stem.length === fileStem(best).length && implOrder.get(file)! > implOrder.get(best)!)
    ) {
      best = file;
    }
  }
  return best;
}

function fileStem(path: string): string {
  const name = path.split('/').at(-1)!.toLowerCase();
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

function primary(chunk: Chunk): Occurrence {
  return { chunkId: chunk.id, ordinal: 0, role: 'primary' };
}

/** One chunk per contiguous run of primary-side changed lines that no chunk owns. */
function leftoverChunks(file: FileDiff, chunks: Chunk[]): Chunk[] {
  const deleted = file.status === 'deleted';
  const owned = new Set<number>();
  for (const chunk of chunks) {
    for (const h of chunk.hunks) {
      const [start, count] = deleted ? [h.baseStart, h.baseCount] : [h.headStart, h.headCount];
      for (let i = 0; i < count; i++) owned.add(start + i);
    }
  }

  const unclaimed: number[] = [];
  for (const h of file.hunks) {
    const [start, count] = deleted ? [h.baseStart, h.baseCount] : [h.headStart, h.headCount];
    for (let i = 0; i < count; i++) if (!owned.has(start + i)) unclaimed.push(start + i);
  }
  unclaimed.sort((a, b) => a - b);

  const result: Chunk[] = [];
  let runStart = -1;
  let prev = -2;
  const flush = (end: number) => {
    if (runStart < 0) return;
    const range = { start: runStart, end };
    const hunk: Hunk = deleted
      ? { baseStart: runStart, baseCount: end - runStart + 1, headStart: 0, headCount: 0 }
      : { headStart: runStart, headCount: end - runStart + 1, baseStart: 0, baseCount: 0 };
    result.push({
      id: chunkId(file.path, ['(leftover)'], `${runStart}-${end}`),
      file: file.path,
      symbolPath: [],
      displayPath: ['(leftover)', `lines ${runStart}–${end}`],
      kind: 'other',
      changeTypes: [],
      hunks: [hunk],
      headRange: deleted ? undefined : range,
      baseRange: deleted ? range : undefined,
    });
  };
  for (const line of unclaimed) {
    if (line !== prev + 1) {
      flush(prev);
      runStart = line;
    }
    prev = line;
  }
  flush(prev);
  return result;
}
