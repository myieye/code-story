import { type ChunkEdge, type ChunkEdgeKind, type ChunkGraph, type ChunkReviewState } from '@code-story/core';

/**
 * Edge kinds that count as a cross-chunk "interaction" (spec 05 gate 1: the progress cluster and
 * done banner surface reviewed↔unreviewed edges). `calls` and `exercises` are genuine behavioral
 * links between two chunks. `file-imports` is deliberately excluded: it is a coarse file-level
 * fallback that assembleChunkGraph lifts to anchor chunks with no call site, so counting it would
 * inflate "interactions" with relatedness no reviewer ever traced through the code.
 */
export const INTERACTION_KINDS: ReadonlySet<ChunkEdgeKind> = new Set<ChunkEdgeKind>(['calls', 'exercises']);

/** Interaction edges whose both endpoints resolve to a book chunk — the only ones we can honestly count. */
function inBookInteractionEdges(graph: ChunkGraph, inBook: (id: string) => boolean): ChunkEdge[] {
  return graph.edges.filter((e) => INTERACTION_KINDS.has(e.kind) && inBook(e.from) && inBook(e.to));
}

/**
 * Open frontier edges: interaction edges with exactly ONE reviewed endpoint — the boundary of review
 * progress in graph terms. Display-only (spec 05 gate 1): it surfaces composition, gates nothing.
 * Shrinks to zero at 100% chunk coverage (every endpoint reviewed ⇒ no split edge), and 100%
 * coverage stays the sole done condition — the frontier never implies composition was verified.
 */
export function frontierCount(
  graph: ChunkGraph,
  stateOf: (id: string) => ChunkReviewState,
  inBook: (id: string) => boolean,
): number {
  let n = 0;
  for (const e of inBookInteractionEdges(graph, inBook)) {
    if ((stateOf(e.from) === 'reviewed') !== (stateOf(e.to) === 'reviewed')) n++;
  }
  return n;
}

/**
 * Total interaction edges surfaced across the book, regardless of review state — the "N cross-chunk
 * interactions were surfaced" figure the done banner reports. None of these are individually
 * verified; the count is orientation, not a completeness or correctness claim.
 */
export function interactionCount(graph: ChunkGraph, inBook: (id: string) => boolean): number {
  return inBookInteractionEdges(graph, inBook).length;
}
