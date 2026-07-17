import { type CompiledBook, leftoverChunks, primary, testImplAnchors } from './book.js';
import { CALLS_DFS_KINDS, type ChunkGraph, edgesOfKinds } from './chunk-graph.js';
import { type FileDiff } from './diff.js';
import { type ImportGraph } from './import-graph.js';
import { CHAPTER_SECTION_PREFIX, type Chunk, LEFTOVERS_SECTION_ID, type Occurrence, type Section } from './model.js';
import { type FileRole, fileRoles, isE2ePath, isRouteFile } from './roles.js';
import { sourceSccToBreak } from './scc.js';
import { type StoryConfig } from './story-config.js';

export interface CompileChapterBookInput {
  /** Changed files in git diff order — the anchor/tie-break source. */
  files: FileDiff[];
  /** Chunker output (no leftovers); this compile synthesizes leftovers itself, like `compileBook`. */
  chunks: Chunk[];
  /** File-level import graph (roles + file-level test anchoring + trailing-test ordering). */
  graph: ImportGraph;
  /** Chunk relatedness graph (spec 05): `calls` drives the spine, `exercises` places tests. */
  chunkGraph: ChunkGraph;
  headSha: string;
}

/**
 * The chapter linearizer (spec 05, Traversal 1). A chapter is a Section whose occurrences may span
 * files, produced by a call-path DFS over the chunk graph's `calls` edges: from each anchor (a
 * story chunk with no incoming intra-diff `calls` edge, ordered routes-first then git) the
 * traversal follows call sites, emitting one primary occurrence per chunk. Cross-file occurrences
 * carry a `from <file>` label. A diff with no `calls` edges degenerates to file-grouped git order
 * (today's backbone). Tests are woven in by kind per `config.testPlacement`; low-signal files and
 * the leftovers backstop stay in the tail (R-001). Deterministic for a fixed input.
 *
 * This is a distinct linearizer from `compileBook`, not a parameterization of it (grill F1): it
 * reuses roles, the leftovers backstop, and the tail discipline, and supersedes file-section
 * assembly, the file-level topo spine, and the old test anchoring.
 */
export function compileChapterBook(input: CompileChapterBookInput, config: StoryConfig): CompiledBook {
  const inputByFile = new Map<string, Chunk[]>();
  for (const chunk of input.chunks) {
    const list = inputByFile.get(chunk.file) ?? [];
    list.push(chunk);
    inputByFile.set(chunk.file, list);
  }

  const leftoverByFile = new Map<string, Chunk[]>();
  const leftoverIds = new Set<string>();
  for (const file of input.files) {
    const lo = leftoverChunks(file, inputByFile.get(file.path) ?? []);
    if (lo.length > 0) {
      leftoverByFile.set(file.path, lo);
      for (const c of lo) leftoverIds.add(c.id);
    }
  }

  // Global git order over every chunk (incl. leftovers): file diff order, then chunker order within
  // a file, leftovers after their file's chunks. The deterministic tie-break for anchors and cycles.
  const gitOrder: Chunk[] = [];
  for (const file of input.files) {
    gitOrder.push(...(inputByFile.get(file.path) ?? []), ...(leftoverByFile.get(file.path) ?? []));
  }
  const chunkById = new Map(gitOrder.map((c) => [c.id, c]));
  const gitRank = new Map(gitOrder.map((c, i) => [c.id, i]));

  const roles = fileRoles(
    input.files.map((f) => f.path),
    gitOrder,
    input.graph,
  );
  const bucketOf = (chunk: Chunk): 'story' | 'test' | 'low-signal' | 'leftover' => {
    if (leftoverIds.has(chunk.id)) return 'leftover';
    const role = roles.get(chunk.file);
    if (role === 'low-signal') return 'low-signal';
    if (role === 'test') return 'test';
    return 'story';
  };

  const storyIds = new Set(gitOrder.filter((c) => bucketOf(c) === 'story').map((c) => c.id));
  const testIds = new Set(gitOrder.filter((c) => bucketOf(c) === 'test').map((c) => c.id));
  const chapters = buildSpine(gitOrder, storyIds, chunkById, gitRank, roles, input.chunkGraph, config);

  const flat = weaveTests(chapters, gitOrder, storyIds, testIds, chunkById, gitRank, input, config);

  const sections = assembleSections(flat, gitOrder, bucketOf);
  const allChunks = [...input.chunks, ...[...leftoverByFile.values()].flat()];
  return { book: { sections, headSha: input.headSha }, chunks: allChunks };
}

interface Chapter {
  id: string;
  anchorFile: string;
  chunkIds: string[];
}

/** Anchors read routes/pages first, then impl, then periphery; git order within a tier. */
function anchorPriority(chunk: Chunk, roles: Map<string, FileRole>): number {
  if (isRouteFile(chunk.file)) return 0;
  return roles.get(chunk.file) === 'periphery' ? 2 : 1;
}

/**
 * The call-path spine: a topological linearization of story chunks over `calls` edges, grouped
 * into chapters. Consumer-first orders a caller before every chunk it calls; dependency-first
 * reverses that. A plain pre-order DFS is *not* enough — a callee shared by two callers would land
 * after the first caller but before the second, an IOU the reviewer must hold — so this is a
 * Kahn topological sort (every node emitted only once all its precedence-predecessors are) whose
 * tie-break still follows call sites, keeping each call path locally contiguous. A new chapter
 * opens whenever the sort starts a fresh entry point (an anchor, routes-first then git) rather than
 * continuing a call path. Cycles are broken deterministically at a source SCC's git-earliest member
 * (the one same-cycle inversion checkOrder then reports informationally). Deterministic.
 */
function buildSpine(
  gitOrder: Chunk[],
  storyIds: Set<string>,
  chunkById: Map<string, Chunk>,
  gitRank: Map<string, number>,
  roles: Map<string, FileRole>,
  chunkGraph: ChunkGraph,
  config: StoryConfig,
): Chapter[] {
  const consumerFirst = config.direction === 'consumer-first';
  const pred = new Map<string, Set<string>>();
  const next = new Map<string, { id: string; line: number }[]>();
  for (const id of storyIds) {
    pred.set(id, new Set());
    next.set(id, []);
  }
  for (const edge of edgesOfKinds(chunkGraph.edges, CALLS_DFS_KINDS)) {
    if (!storyIds.has(edge.from) || !storyIds.has(edge.to) || edge.from === edge.to) continue;
    const line = edge.fromLines[0]?.start ?? Number.POSITIVE_INFINITY;
    // Precedence: consumer-first puts the caller before the callee; dependency-first the reverse.
    const [before, after] = consumerFirst ? [edge.from, edge.to] : [edge.to, edge.from];
    pred.get(after)!.add(before);
    next.get(before)!.push({ id: after, line });
  }
  for (const [key, list] of next) {
    const minLine = new Map<string, number>();
    for (const { id, line } of list) minLine.set(id, Math.min(minLine.get(id) ?? Number.POSITIVE_INFINITY, line));
    next.set(
      key,
      [...minLine].map(([id, line]) => ({ id, line })).sort((a, b) =>
        consumerFirst ? a.line - b.line || gitRank.get(a.id)! - gitRank.get(b.id)! : gitRank.get(a.id)! - gitRank.get(b.id)!,
      ),
    );
  }

  const indeg = new Map([...storyIds].map((id) => [id, pred.get(id)!.size]));
  const emitted = new Set<string>();
  const order: { id: string; startsChapter: boolean }[] = [];
  const emit = (id: string, startsChapter: boolean) => {
    emitted.add(id);
    order.push({ id, startsChapter });
    for (const n of next.get(id)!) indeg.set(n.id, indeg.get(n.id)! - 1);
  };

  let last: string | undefined;
  while (emitted.size < storyIds.size) {
    const continuation = last === undefined ? undefined : next.get(last)!.find((n) => !emitted.has(n.id) && indeg.get(n.id) === 0)?.id;
    if (continuation !== undefined) {
      emit(continuation, false);
      last = continuation;
      continue;
    }
    const anchors = [...storyIds]
      .filter((id) => !emitted.has(id) && indeg.get(id) === 0)
      .sort((a, b) => anchorPriority(chunkById.get(a)!, roles) - anchorPriority(chunkById.get(b)!, roles) || gitRank.get(a)! - gitRank.get(b)!);
    const seed = anchors[0] ?? cycleBreakSeed([...storyIds].filter((id) => !emitted.has(id)), next, gitRank);
    emit(seed, true);
    last = seed;
  }

  const chapters: Chapter[] = [];
  for (const { id, startsChapter } of order) {
    if (startsChapter) chapters.push({ id: `${CHAPTER_SECTION_PREFIX}${id}`, anchorFile: chunkById.get(id)!.file, chunkIds: [] });
    chapters.at(-1)!.chunkIds.push(id);
  }
  return chapters;
}

/**
 * Picks the chunk to force-emit when the call-path topo sort stalls on a cycle. `fwd` is already the
 * emission-forward precedence-successor map `sourceSccToBreak` expects (caller before callee).
 */
function cycleBreakSeed(remaining: string[], fwd: Map<string, { id: string; line: number }[]>, gitRank: Map<string, number>): string {
  return sourceSccToBreak(
    remaining,
    (v) => (fwd.get(v) ?? []).map((e) => e.id),
    (v) => gitRank.get(v)!,
  );
}

interface Slot {
  chunkId: string;
  chapterId: string;
  anchorFile: string;
  /** When true this chunk lives outside `anchorFile` — rendered `from <file>`. */
  crossFile: boolean;
}

/**
 * Weaves test chunks into the spine by kind (spec 05, R-043). A unit test with an `exercises` edge
 * to a spine chunk reads just before (`before`) or after (`after`) the impl it exercises, joining
 * that impl's chapter. Tests with no resolved impl target — and every test under `end` — trail the
 * story as their own file-keyed chapters, page-objects/helpers before the specs that import them,
 * e2e specs closing the book. The impl-relative axiom wins over the e2e-last heuristic, so a spec
 * carrying a real `exercises` edge is still pulled to its impl.
 */
function weaveTests(
  chapters: Chapter[],
  gitOrder: Chunk[],
  storyIds: Set<string>,
  testIds: Set<string>,
  chunkById: Map<string, Chunk>,
  gitRank: Map<string, number>,
  input: CompileChapterBookInput,
  config: StoryConfig,
): Slot[] {
  const flat: Slot[] = [];
  const anchorFileById = new Map(chapters.map((ch) => [ch.id, ch.anchorFile]));
  for (const ch of chapters) {
    for (const id of ch.chunkIds) {
      flat.push({ chunkId: id, chapterId: ch.id, anchorFile: ch.anchorFile, crossFile: chunkById.get(id)!.file !== ch.anchorFile });
    }
  }

  const testTargets = exerciseTargets(input.chunkGraph, storyIds, testIds, gitOrder, input);

  const placed = new Set<string>();
  if (config.testPlacement !== 'end') {
    for (const t of gitOrder.filter((c) => testIds.has(c.id))) {
      const targets = (testTargets.get(t.id) ?? []).filter((id) => flat.some((s) => s.chunkId === id));
      if (targets.length === 0) continue;
      const targetPositions = targets.map((id) => flat.findIndex((s) => s.chunkId === id));
      const at = config.testPlacement === 'before' ? Math.min(...targetPositions) : Math.max(...targetPositions) + 1;
      const chapterId = flat[config.testPlacement === 'before' ? at : at - 1]!.chapterId;
      flat.splice(at, 0, {
        chunkId: t.id,
        chapterId,
        anchorFile: anchorFileById.get(chapterId)!,
        crossFile: t.file !== anchorFileById.get(chapterId)!,
      });
      placed.add(t.id);
    }
  }

  const trailing = gitOrder.filter((c) => testIds.has(c.id) && !placed.has(c.id));
  for (const file of orderTrailingTestFiles([...new Set(trailing.map((c) => c.file))], input.graph, gitRank, gitOrder)) {
    const id = `${CHAPTER_SECTION_PREFIX}test:${file}`;
    for (const c of trailing.filter((t) => t.file === file)) {
      flat.push({ chunkId: c.id, chapterId: id, anchorFile: file, crossFile: false });
    }
  }
  return flat;
}

/** Test chunk id → the spine (story) chunk ids it exercises, precise `references` edges first, else the file-level test-anchor. */
function exerciseTargets(
  chunkGraph: ChunkGraph,
  storyIds: Set<string>,
  testIds: Set<string>,
  gitOrder: Chunk[],
  input: CompileChapterBookInput,
): Map<string, string[]> {
  const targets = new Map<string, string[]>();
  const add = (from: string, to: string) => (targets.get(from) ?? targets.set(from, []).get(from)!).push(to);
  for (const edge of chunkGraph.edges) {
    if (edge.kind === 'exercises' && edge.source === 'references' && testIds.has(edge.from) && storyIds.has(edge.to)) {
      add(edge.from, edge.to);
    }
  }

  // File-level fallback: a test file with no precise edge anchors to the impl file's first spine chunk.
  const firstStoryChunkOfFile = new Map<string, string>();
  for (const c of gitOrder) if (storyIds.has(c.id) && !firstStoryChunkOfFile.has(c.file)) firstStoryChunkOfFile.set(c.file, c.id);
  const firstTestChunkOfFile = new Map<string, string>();
  for (const c of gitOrder) if (testIds.has(c.id) && !firstTestChunkOfFile.has(c.file)) firstTestChunkOfFile.set(c.file, c.id);
  const sectionFiles = [...new Set(gitOrder.map((c) => c.file))];
  for (const { test, impl } of testImplAnchors(sectionFiles, gitOrder, input.graph)) {
    const from = firstTestChunkOfFile.get(test);
    const to = firstStoryChunkOfFile.get(impl);
    if (from !== undefined && to !== undefined && !targets.has(from)) add(from, to);
  }
  return targets;
}

/** Trailing test files: helpers before the specs that import them (Kahn over test↔test imports), e2e specs last, git order within a tier. */
function orderTrailingTestFiles(files: string[], graph: ImportGraph, gitRank: Map<string, number>, gitOrder: Chunk[]): string[] {
  const set = new Set(files);
  const helpers = new Map<string, string[]>(files.map((f) => [f, []]));
  for (const edge of graph.edges) {
    if (set.has(edge.from) && set.has(edge.to) && edge.from !== edge.to) helpers.get(edge.from)!.push(edge.to);
  }
  const fileGit = (f: string) => Math.min(...gitOrder.filter((c) => c.file === f).map((c) => gitRank.get(c.id)!));
  const rank = (f: string) => (isE2ePath(f) ? 1 : 0) * 1e9 + fileGit(f);

  const emitted = new Set<string>();
  const order: string[] = [];
  while (order.length < files.length) {
    const pending = files.filter((f) => !emitted.has(f));
    const ready = pending.filter((f) => helpers.get(f)!.every((h) => emitted.has(h) || !set.has(h)));
    const pool = ready.length > 0 ? ready : pending; // test↔test import cycle: break by rank
    pool.sort((a, b) => rank(a) - rank(b));
    emitted.add(pool[0]!);
    order.push(pool[0]!);
  }
  return order;
}

/**
 * Groups the woven flat order into Sections. Consecutive same-chapter slots form one chapter
 * (test insertions preserve contiguity — an inserted test carries the chapter id of its neighbour);
 * then low-signal files as their own tail sections in git order, then the leftovers backstop last.
 */
function assembleSections(
  flat: Slot[],
  gitOrder: Chunk[],
  bucketOf: (chunk: Chunk) => 'story' | 'test' | 'low-signal' | 'leftover',
): Section[] {
  const sections: Section[] = [];
  let i = 0;
  while (i < flat.length) {
    const { chapterId, anchorFile } = flat[i]!;
    const occurrences: Occurrence[] = [];
    let j = i;
    for (; j < flat.length && flat[j]!.chapterId === chapterId; j++) {
      const slot = flat[j]!;
      occurrences.push({ chunkId: slot.chunkId, ordinal: 0, role: 'primary', ...(slot.crossFile ? { label: gitOrder.find((c) => c.id === slot.chunkId)!.file } : {}) });
    }
    sections.push({ id: chapterId, title: anchorFile, occurrences });
    i = j;
  }

  const lowSignalFiles = [...new Set(gitOrder.filter((c) => bucketOf(c) === 'low-signal').map((c) => c.file))];
  for (const file of lowSignalFiles) {
    const occ = gitOrder.filter((c) => c.file === file && bucketOf(c) === 'low-signal').map(primary);
    sections.push({ id: file, title: file, occurrences: occ });
  }

  const leftovers = gitOrder.filter((c) => bucketOf(c) === 'leftover');
  if (leftovers.length > 0) {
    sections.push({ id: LEFTOVERS_SECTION_ID, title: 'Leftovers', occurrences: leftovers.map(primary) });
  }
  return sections;
}
