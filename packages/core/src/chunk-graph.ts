import { fnv1a } from './chunker.js';
import { type ImportGraph } from './import-graph.js';
import { type Book, type LineRange, CORE_VERSION, isFileModeBook, LEFTOVERS_SECTION_ID } from './model.js';

/**
 * The relatedness graph over chunks (spec 05 / R-050). Layered and plural: the graph is a flat set
 * of edges each tagged by `kind`, and consumers filter by an explicit kind-set. New kinds
 * (data-flow, co-change, semantic) are additive — no consumer may exhaustively switch on the launch
 * kinds, so a `default`-less `switch (edge.kind)` is banned; use `edgesOfKinds` instead.
 */
export type ChunkEdgeKind = 'calls' | 'file-imports' | 'exercises';

/** How an edge was derived. `references` carries real call-site `fromLines`; the file-level sources don't. */
export type ChunkEdgeSource = 'references' | 'import-graph' | 'test-anchor';

export interface ChunkEdge {
  /** Caller / test / importer chunk id. */
  from: string;
  /** Callee / impl / imported chunk id. */
  to: string;
  kind: ChunkEdgeKind;
  /**
   * Caller-side lines responsible for the relationship (R-048). Populated only for `references`
   * edges (the call sites); file-level sources (`import-graph`, `test-anchor`) carry no precise
   * lines and leave this empty — the UI labels those file-level.
   */
  fromLines: LineRange[];
  source: ChunkEdgeSource;
}

export interface ChunkGraph {
  edges: ChunkEdge[];
}

/** Per-range persisted graph, mirroring the order/context overlay shape (versioned, fingerprinted). */
export interface ChunkGraphFile {
  version: 1;
  /** Freshness key (see `chunkGraphFingerprint`); a mismatch drops the whole graph, fail-open. */
  fingerprint: string;
  edges: ChunkEdge[];
}

/**
 * Range-level freshness key: fnv1a over head + CORE_VERSION. The graph is one artifact for the
 * range — a new head changes the chunks, a CORE_VERSION bump can change chunk identity — so both
 * must invalidate it. Mirrors `contextFingerprint`, minus the per-chunk component (the whole graph
 * is rebuilt as a unit, not filtered chunk-by-chunk).
 */
export function chunkGraphFingerprint(headSha: string): string {
  return fnv1a([headSha, CORE_VERSION].join('\0'));
}

/**
 * The stored graph if it still matches the current head, else null. Fail-open to no-graph: a stale
 * fingerprint, wrong version, or malformed file all yield null (the loader/consumer then behaves as
 * if no graph exists) — never a wrong graph.
 */
export function filterFreshGraph(headSha: string, store: ChunkGraphFile | null | undefined): ChunkGraph | null {
  try {
    if (!store || store.version !== 1 || !Array.isArray(store.edges)) return null;
    if (store.fingerprint !== chunkGraphFingerprint(headSha)) return null;
    return { edges: store.edges };
  } catch {
    return null;
  }
}

/**
 * Kinds a consumer-first calls-DFS may traverse. `exercises` is deliberately absent: a test→impl
 * link must never pull the impl into the caller's call-path story (spec 05). Encoded as a constant
 * kind-set rather than scattered `!== 'exercises'` conditionals so the exclusion has one home.
 */
export const CALLS_DFS_KINDS: ReadonlySet<ChunkEdgeKind> = new Set<ChunkEdgeKind>(['calls']);

/**
 * Edges whose kind is in `kinds`. The only sanctioned way to select edges by kind — a pure string
 * set-membership test, so an unknown future kind passes through iff the caller asks for it, with no
 * schema change and no exhaustive switch to break (R-050). `kinds` is typed to the known union for
 * call-site help but the runtime check is structural.
 */
export function edgesOfKinds(edges: readonly ChunkEdge[], kinds: ReadonlySet<ChunkEdgeKind>): ChunkEdge[] {
  return edges.filter((e) => kinds.has(e.kind));
}

/** A chunk's direct graph neighbor (spec 05 slice 5 — the neighbor strip). */
export interface ChunkNeighbor {
  /** The neighbor chunk to navigate to. */
  chunkId: string;
  kind: ChunkEdgeKind;
  /** `out`: this chunk is the edge's `from` (it calls / imports / exercises the neighbor). `in`: the reverse. */
  direction: 'in' | 'out';
  /**
   * Call-site lines in THIS chunk responsible for the edge (R-048) — populated only for outgoing
   * edges, where `fromLines` describe this chunk. Incoming edges leave it empty: their responsible
   * lines live in the neighbor, so surfacing them here would misattribute them.
   */
  fromLines: LineRange[];
}

/**
 * Direct neighbors of `chunkId`: one entry per touching edge, direction-tagged. A read-only
 * derivation over existing edges (no chunking/ordering change — CORE_VERSION untouched). Sorted for
 * determinism; self-edges are impossible (assembleChunkGraph drops them) but guarded anyway.
 */
export function neighborsOf(graph: ChunkGraph, chunkId: string): ChunkNeighbor[] {
  const out: ChunkNeighbor[] = [];
  for (const e of graph.edges) {
    if (e.from === chunkId && e.to !== chunkId) out.push({ chunkId: e.to, kind: e.kind, direction: 'out', fromLines: [...e.fromLines] });
    else if (e.to === chunkId && e.from !== chunkId) out.push({ chunkId: e.from, kind: e.kind, direction: 'in', fromLines: [] });
  }
  out.sort((a, b) => a.chunkId.localeCompare(b.chunkId) || a.kind.localeCompare(b.kind) || a.direction.localeCompare(b.direction));
  return out;
}

/**
 * Section-anchor chunk per file: each Book section's first occurrence chunk (spec 05 — file-imports
 * and test-anchor edges connect these). The leftovers section has no anchor. Keyed by section id
 * (the file path).
 */
export function sectionAnchors(book: Book): Map<string, string> {
  if (!isFileModeBook(book)) throw new Error('sectionAnchors requires a file-mode book (see isFileModeBook)');
  const anchors = new Map<string, string>();
  for (const section of book.sections) {
    if (section.id === LEFTOVERS_SECTION_ID) continue;
    const first = section.occurrences[0];
    if (first) anchors.set(section.id, first.chunkId);
  }
  return anchors;
}

/**
 * File-level import edges lifted to anchor chunks (source `import-graph`, kind `file-imports`).
 * Only edges whose both endpoints have an anchor survive; self-edges are dropped. These are
 * fallback relatedness and never claim chunk precision — hence no `fromLines`.
 */
export function fileImportEdges(graph: ImportGraph, anchorByFile: Map<string, string>): ChunkEdge[] {
  const edges: ChunkEdge[] = [];
  for (const e of graph.edges) {
    const from = anchorByFile.get(e.from);
    const to = anchorByFile.get(e.to);
    if (from === undefined || to === undefined || from === to) continue;
    edges.push({ from, to, kind: 'file-imports', fromLines: [], source: 'import-graph' });
  }
  return edges;
}

const SOURCE_PRECEDENCE: Record<ChunkEdgeSource, number> = { references: 0, 'test-anchor': 1, 'import-graph': 2 };

/**
 * Folds raw edges into a persisted graph: dedupes by (from, to, kind), keeping the
 * highest-precedence source (`references` > `test-anchor` > `import-graph`) and unioning the
 * `fromLines` of every merged edge. Self-edges are dropped. Deterministic for a fixed input.
 */
export function assembleChunkGraph(headSha: string, rawEdges: readonly ChunkEdge[]): ChunkGraphFile {
  const byKey = new Map<string, ChunkEdge>();
  for (const edge of rawEdges) {
    if (edge.from === edge.to) continue;
    const key = `${edge.from}\0${edge.to}\0${edge.kind}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...edge, fromLines: [...edge.fromLines] });
      continue;
    }
    existing.fromLines = coalesce([...existing.fromLines, ...edge.fromLines]);
    if (SOURCE_PRECEDENCE[edge.source] < SOURCE_PRECEDENCE[existing.source]) existing.source = edge.source;
  }
  const edges = [...byKey.values()].map((e) => ({ ...e, fromLines: coalesce(e.fromLines) }));
  return { version: 1, fingerprint: chunkGraphFingerprint(headSha), edges };
}

/** Sorts and merges overlapping/adjacent 1-based inclusive line ranges. */
export function coalesce(ranges: readonly LineRange[]): LineRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const out: LineRange[] = [];
  for (const r of sorted) {
    const last = out.at(-1);
    if (last && r.start <= last.end + 1) last.end = Math.max(last.end, r.end);
    else out.push({ ...r });
  }
  return out;
}
