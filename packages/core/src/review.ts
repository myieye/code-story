/** Review state (primitives sketch §6, restricted to M0: unseen | seen | reviewed). */
import type { ChunkReviewState } from './model.js';

export interface ChunkReview {
  state: ChunkReviewState;
  /** R-026 eval signal: the chunk was marked reviewed while still unseen. */
  markedUnseen?: boolean;
}

/** One review of one range, persisted under the per-repo data home (R-037, R-014 partial). */
export interface ReviewFile {
  version: 1;
  base: string;
  head: string;
  /** Resume position: chunk id of the reading cursor. */
  cursor?: string;
  /** Chunk id → state. Absent means unseen. */
  chunks: Record<string, ChunkReview>;
}

export function emptyReview(base: string, head: string): ReviewFile {
  return { version: 1, base, head, chunks: {} };
}

/** A client's incremental update to a review. */
export interface ReviewPatch {
  set?: { chunkId: string; state: ChunkReviewState; markedUnseen?: boolean }[];
  cursor?: string;
}

const STATES: ChunkReviewState[] = ['unseen', 'seen', 'reviewed'];

/** Applies a patch in place; ignores malformed entries rather than corrupting the file. */
export function applyReviewPatch(review: ReviewFile, patch: ReviewPatch): void {
  for (const entry of Array.isArray(patch.set) ? patch.set : []) {
    if (typeof entry.chunkId !== 'string' || !STATES.includes(entry.state)) continue;
    const next: ChunkReview = { state: entry.state };
    if (entry.markedUnseen ?? review.chunks[entry.chunkId]?.markedUnseen) next.markedUnseen = true;
    review.chunks[entry.chunkId] = next;
  }
  if (typeof patch.cursor === 'string') review.cursor = patch.cursor;
}
