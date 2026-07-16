/** Review state (primitives sketch §6, restricted to M0: unseen | seen | reviewed). */
import type { ChunkReviewState } from './model.js';

export interface ChunkReview {
  state: ChunkReviewState;
  /** R-026 eval signal: the chunk was marked reviewed while still unseen. */
  markedUnseen?: boolean;
  /** Low-signal stubs only (R-002): the reviewer expanded the stub past its collapsed default. */
  expanded?: boolean;
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

/** A client's incremental update to a review. Entries merge per field; omitted fields keep. */
export interface ReviewPatch {
  set?: { chunkId: string; state?: ChunkReviewState; markedUnseen?: boolean; expanded?: boolean }[];
  cursor?: string;
}

const STATES: ChunkReviewState[] = ['unseen', 'seen', 'reviewed'];

/** Applies a patch in place; ignores malformed entries rather than corrupting the file. */
export function applyReviewPatch(review: ReviewFile, patch: ReviewPatch): void {
  for (const entry of Array.isArray(patch.set) ? patch.set : []) {
    if (typeof entry.chunkId !== 'string') continue;
    if (entry.state !== undefined && !STATES.includes(entry.state)) continue;
    const prev = review.chunks[entry.chunkId];
    const next: ChunkReview = { state: entry.state ?? prev?.state ?? 'unseen' };
    if (entry.markedUnseen ?? prev?.markedUnseen) next.markedUnseen = true;
    const expanded = typeof entry.expanded === 'boolean' ? entry.expanded : prev?.expanded;
    if (expanded) next.expanded = true;
    review.chunks[entry.chunkId] = next;
  }
  if (typeof patch.cursor === 'string') review.cursor = patch.cursor;
}
