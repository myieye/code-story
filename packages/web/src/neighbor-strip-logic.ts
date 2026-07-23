import {
  type Chunk,
  type ChunkEdge,
  type ChunkEdgeKind,
  type ChunkGraph,
  type ChunkReviewState,
  chunkTitle,
  neighborsOf,
} from '@code-story/core';
import { INTERACTION_KINDS } from './frontier-logic.js';

/** A chip is reviewed (a free re-encounter glance) or unreviewed (still owes a mark). Never by colour alone. */
export type ChipState = 'reviewed' | 'unreviewed';

/** One clickable neighbor in the strip — a direct, in-book edge the reviewer can follow (spec 05 slice 5). */
export interface NeighborChip {
  /** Neighbor chunk to navigate to; every chip maps to a real occurrence. */
  chunkId: string;
  kind: ChunkEdgeKind;
  direction: 'in' | 'out';
  /**
   * What following the chip does. `jump` moves the cursor to the neighbor chunk. `reveal` opens the
   * focused chunk's definition panel instead — used for the file-level `exercises` (test-anchor) chip,
   * whose real target (the exercised impl method) is often off-diff or ambiguous, so it has no chunk
   * to jump to but its body can still be shown inline.
   */
  action: 'jump' | 'reveal';
  /** Leading glyph — → outgoing, ← incoming — so direction reads without colour (WCAG 1.4.1). */
  arrow: string;
  /** Relationship verb: "calls", "called by", "exercised by", "imports from", … */
  relation: string;
  /** Neighbor's display name (symbol title, or file basename for a file-level edge). */
  name: string;
  /** Full neighbor file path (chip title / disambiguation). */
  file: string;
  /** True for `file-imports`: the chip is labeled file-level and never claims chunk precision. */
  fileLevel: boolean;
  /**
   * Call-site line in THIS chunk (outgoing edges only, where provenance describes the focused chunk).
   * Not shown today — it read as the target's location. Kept for the planned clickable-call-token path.
   */
  line?: number;
  /** The neighbor chunk is brand-new code (an added file/symbol), worth flagging over the common "changed". */
  created: boolean;
  state: ChipState;
  /** Count of further UNREVIEWED chunks reachable beyond this neighbor along the same relation — a wayfinding hint, never a completeness claim (R-048). */
  behind: number;
  /**
   * This chip sits on the review frontier: an interaction edge (spec 05 gate 1) whose two endpoints
   * differ in reviewed-state. Display-only — a boundary affordance, never a claim the edge was verified.
   */
  frontier: boolean;
}

interface Relation {
  arrow: string;
  relation: string;
}

// Keyed by `${kind}:${direction}` so an unknown future kind (R-050) degrades to a neutral label
// instead of breaking an exhaustive switch.
const RELATIONS: Record<string, Relation> = {
  'calls:out': { arrow: '→', relation: 'calls' },
  'calls:in': { arrow: '←', relation: 'called by' },
  'exercises:out': { arrow: '→', relation: 'exercises' },
  'exercises:in': { arrow: '←', relation: 'exercised by' },
  'file-imports:out': { arrow: '→', relation: 'imports from' },
  'file-imports:in': { arrow: '←', relation: 'imported by' },
};

function relationOf(kind: ChunkEdgeKind, direction: 'in' | 'out'): Relation {
  return RELATIONS[`${kind}:${direction}`] ?? { arrow: direction === 'out' ? '→' : '←', relation: 'related to' };
}

// Consumer-first reading order: what this chunk calls first, then who calls it, then tests, then
// file-level relatedness. Ties break by name for determinism.
const KIND_RANK: Record<string, number> = {
  'calls:out': 0,
  'calls:in': 1,
  'exercises:in': 2,
  'exercises:out': 3,
  'file-imports:out': 4,
  'file-imports:in': 5,
};

function basename(file: string): string {
  return file.split('/').pop() ?? file;
}

/**
 * Distinct UNREVIEWED chunks reachable beyond `start`, following the same kind+direction (the
 * "+N behind" hint). The focused chunk and `start` itself are excluded; cycles terminate on the
 * visited set. A hint only — it never gates coverage (R-001) and never claims the subgraph is complete.
 */
function reachableUnreviewed(
  edges: readonly ChunkEdge[],
  start: string,
  kind: ChunkEdgeKind,
  direction: 'in' | 'out',
  focusedChunkId: string,
  stateOf: (id: string) => ChunkReviewState,
): number {
  const step = (id: string): string[] =>
    edges
      .filter((e) => e.kind === kind && (direction === 'out' ? e.from === id : e.to === id))
      .map((e) => (direction === 'out' ? e.to : e.from));
  const seen = new Set<string>([focusedChunkId, start]);
  const counted = new Set<string>();
  const stack = [start];
  while (stack.length > 0) {
    for (const next of step(stack.pop()!)) {
      if (seen.has(next)) continue;
      seen.add(next);
      stack.push(next);
      if (stateOf(next) !== 'reviewed') counted.add(next);
    }
  }
  return counted.size;
}

/**
 * The neighbor chips for the focused chunk: its direct, in-book graph neighbors turned into
 * navigable descriptors, each carrying its review state and a "+N behind" hint. Only neighbors that
 * resolve to a real book chunk survive (`inBook`) — unchanged callees are the definition panel's job.
 */
export function computeNeighborChips(
  graph: ChunkGraph,
  focusedChunkId: string,
  chunksById: Map<string, Chunk>,
  stateOf: (id: string) => ChunkReviewState,
  inBook: (id: string) => boolean,
): NeighborChip[] {
  const chips: NeighborChip[] = [];
  const focusedReviewed = stateOf(focusedChunkId) === 'reviewed';
  for (const nb of neighborsOf(graph, focusedChunkId)) {
    if (!inBook(nb.chunkId)) continue;
    const chunk = chunksById.get(nb.chunkId);
    if (!chunk) continue;
    const { arrow, relation } = relationOf(nb.kind, nb.direction);
    // A file-level exercises edge (test→impl anchor) carries no method/line: its `to` is just the
    // impl file's section anchor (often a top-of-file fragment), so jumping there is misleading.
    // Treat it as a reveal — click shows the exercised impl bodies in the definition panel instead.
    const reveal = nb.kind === 'exercises' && nb.source === 'test-anchor';
    const fileLevel = nb.kind === 'file-imports' || reveal;
    const line = nb.direction === 'out' ? nb.fromLines[0]?.start : undefined;
    const neighborReviewed = stateOf(nb.chunkId) === 'reviewed';
    // Brand-new code: every owned hunk is pure insertion (no base side). Only meaningful for a
    // navigable in-review neighbor — a reveal/file-level chip isn't a single chunk to characterize.
    const created = !reveal && !fileLevel && chunk.hunks.length > 0 && chunk.hunks.every((h) => h.baseCount === 0);
    chips.push({
      chunkId: nb.chunkId,
      kind: nb.kind,
      direction: nb.direction,
      action: reveal ? 'reveal' : 'jump',
      arrow,
      relation,
      // Symbol-less chunks (fragments) have no displayPath, so chunkTitle falls back to a bare
      // "lines N–M" — an opaque chip label (#108). Use the file basename instead; the reviewer
      // reads the actual chunk on click.
      name: fileLevel || chunk.displayPath.length === 0 ? basename(chunk.file) : chunkTitle(chunk),
      file: chunk.file,
      fileLevel,
      ...(line !== undefined ? { line } : {}),
      created,
      state: neighborReviewed ? 'reviewed' : 'unreviewed',
      // `behind`/`frontier` describe navigable chunks reachable along the edge; a reveal chip goes to
      // a panel, not a chunk, so neither applies.
      behind: reveal ? 0 : reachableUnreviewed(graph.edges, nb.chunkId, nb.kind, nb.direction, focusedChunkId, stateOf),
      frontier: !reveal && INTERACTION_KINDS.has(nb.kind) && neighborReviewed !== focusedReviewed,
    });
  }
  chips.sort(
    (a, b) =>
      (KIND_RANK[`${a.kind}:${a.direction}`] ?? 9) - (KIND_RANK[`${b.kind}:${b.direction}`] ?? 9) ||
      a.name.localeCompare(b.name) ||
      a.chunkId.localeCompare(b.chunkId),
  );
  return chips;
}

/** The chip's visible text (glyph, state, `new`, and behind carry separately in the DOM). */
export function chipText(chip: NeighborChip): string {
  return `${chip.arrow} ${chip.relation} ${chip.name}`;
}

/** Full-sentence accessible name — direction, relation, state, and the behind hint spelled out. */
export function chipAriaLabel(chip: NeighborChip): string {
  const parts = [`${chip.relation} ${chip.name}`];
  if (chip.fileLevel) parts.push('(file-level)');
  // A reveal chip opens a panel rather than navigating, so the target chunk's review state is not
  // meaningful; say what it does instead.
  if (chip.action === 'reveal') {
    parts.push('shows the exercised code');
    return parts.join(', ');
  }
  if (chip.created) parts.push('newly added in this diff');
  parts.push(chip.state);
  if (chip.frontier) parts.push('review boundary');
  if (chip.behind > 0) parts.push(`${chip.behind} more unreviewed behind`);
  return parts.join(', ');
}
