import { type FileDiff, type Hunk } from './diff.js';
import { type ImportGraph } from './import-graph.js';
import { type Book, CHAPTER_SECTION_PREFIX, type Chunk, chunkId, LEFTOVERS_SECTION_ID, type Occurrence, type Section } from './model.js';
import { type FileRole, fileRoles } from './roles.js';
import { sourceSccToBreak } from './scc.js';

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
  const gitPos = new Map(gitOrder.map((f, i) => [f, i]));

  const { byAnchor, unanchored } = orderTestBlock(byRole('test'), impl, implOrder, graph, gitPos);

  return [
    ...impl.flatMap((f) => [f, ...(byAnchor.get(f) ?? [])]),
    ...unanchored,
    ...byRole('periphery'),
    ...byRole('low-signal'),
  ];
}

/**
 * Place test-role files (#52): each anchored after the last impl it imports (else its stem match),
 * but a test-role helper (page object, fixture) imported by another test-role file must read before
 * its importer. Two rules cooperate: (1) a helper inherits its earliest importer's anchor when that
 * anchor is earlier than its own, so grouping can't strand it in a later section or the unanchored
 * tail; (2) within the resulting order, files are emitted helper-before-importer (greedy Kahn over
 * the test↔test subgraph, ties by inherited-anchor position then git order). Correctness wins over
 * locality: a helper with an earlier own anchor stays there rather than following its importer.
 */
function orderTestBlock(
  tests: string[],
  impl: string[],
  implOrder: Map<string, number>,
  graph: ImportGraph,
  gitPos: Map<string, number>,
): { byAnchor: Map<string, string[]>; unanchored: string[] } {
  const testSet = new Set(tests);
  const helpers = new Map<string, string[]>(tests.map((t) => [t, []]));
  const importers = new Map<string, string[]>(tests.map((t) => [t, []]));
  for (const edge of graph.edges) {
    if (!testSet.has(edge.from) || !testSet.has(edge.to) || edge.from === edge.to) continue;
    helpers.get(edge.from)!.push(edge.to);
    importers.get(edge.to)!.push(edge.from);
  }

  const ownPos = (t: string) => {
    const a = anchorImpl(t, impl, implOrder, graph);
    return a === undefined ? Number.POSITIVE_INFINITY : implOrder.get(a)!;
  };
  const effMemo = new Map<string, number>();
  const active = new Set<string>();
  const effPos = (t: string): number => {
    const cached = effMemo.get(t);
    if (cached !== undefined) return cached;
    if (active.has(t)) return ownPos(t); // import cycle among tests: fall back to own anchor
    active.add(t);
    let pos = ownPos(t);
    for (const imp of importers.get(t)!) pos = Math.min(pos, effPos(imp));
    active.delete(t);
    effMemo.set(t, pos);
    return pos;
  };

  const emitted = new Set<string>();
  const order: string[] = [];
  while (order.length < tests.length) {
    const pending = tests.filter((t) => !emitted.has(t));
    const ready = pending.filter((t) => helpers.get(t)!.every((h) => emitted.has(h)));
    const pool = ready.length > 0 ? ready : pending; // stall = test↔test cycle; break by tie-break key
    pool.sort((a, b) => effPos(a) - effPos(b) || gitPos.get(a)! - gitPos.get(b)!);
    emitted.add(pool[0]!);
    order.push(pool[0]!);
  }

  const byAnchor = new Map<string, string[]>();
  const unanchored: string[] = [];
  for (const t of order) {
    const pos = effPos(t);
    if (!Number.isFinite(pos)) unanchored.push(t);
    else byAnchor.set(impl[pos]!, [...(byAnchor.get(impl[pos]!) ?? []), t]);
  }
  return { byAnchor, unanchored };
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
 * A Kahn stall means the still-unemitted files hold at least one import cycle. `sourceSccToBreak`
 * picks the git-earliest member of a condensation-source SCC to force-emit; here the precedence is
 * dependencies-first, so its emission-forward `successors` map is the reverse of `deps`. Returns the
 * index in `remaining` of that node.
 */
function cycleBreakIndex(remaining: string[], deps: Map<string, string[]>): number {
  const present = new Set(remaining);
  const successors = new Map<string, string[]>(remaining.map((f) => [f, []]));
  for (const f of remaining) {
    for (const d of deps.get(f)!) if (present.has(d)) successors.get(d)!.push(f);
  }
  const rank = new Map(remaining.map((f, i) => [f, i]));
  const seed = sourceSccToBreak(remaining, (f) => successors.get(f)!, (f) => rank.get(f)!);
  return rank.get(seed)!;
}

/**
 * File-level test→impl anchor pairs the book compile derives for test placement (spec 05): each
 * test-role file mapped to the impl it anchors after (last impl it imports, else its stem match).
 * Reuses the exact role/topo/anchor logic `orderFiles` runs, so a `test-anchor` graph edge lands on
 * the same relation the story uses. `files` is the book's section files (git order).
 */
export function testImplAnchors(files: string[], chunks: Chunk[], graph: ImportGraph): { test: string; impl: string }[] {
  if (files.some((f) => f.startsWith(CHAPTER_SECTION_PREFIX))) {
    throw new Error('testImplAnchors requires file paths, not chapter-mode section ids (see isFileModeBook)');
  }
  const roles = fileRoles(files, chunks, graph);
  const byRole = (role: FileRole) => files.filter((f) => roles.get(f) === role);
  const impl = topoSort(byRole('impl'), graph);
  const implOrder = new Map(impl.map((f, i) => [f, i]));
  const out: { test: string; impl: string }[] = [];
  for (const test of byRole('test')) {
    const anchor = anchorImpl(test, impl, implOrder, graph);
    if (anchor !== undefined) out.push({ test, impl: anchor });
  }
  return out;
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

/** The single primary occurrence a chunk gets in a file-mode book (chapter mode adds `label`). */
export function primary(chunk: Chunk): Occurrence {
  return { chunkId: chunk.id, ordinal: 0, role: 'primary' };
}

/** One chunk per contiguous run of primary-side changed lines that no chunk owns. */
export function leftoverChunks(file: FileDiff, chunks: Chunk[]): Chunk[] {
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
