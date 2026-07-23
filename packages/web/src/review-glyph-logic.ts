import type { ChunkReviewState } from '@code-story/core';

/** State glyph for the outline — shape differs per state so it doesn't rely on colour (WCAG 1.4.1). */
export const STATE_GLYPH: Record<ChunkReviewState, string> = { reviewed: '✓', seen: '•', unseen: '○' };
/** Auto-read (spec 06 slice 3): a half-filled circle — part-way to done, shape-distinct from ○ • ✓. */
export const AUTO_READ_GLYPH = '◑';

/** The state + auto-read evidence flag a glyph needs — satisfied by ChunkReview and PieceMenuItem alike. */
export type GlyphState = { state: ChunkReviewState; autoRead?: boolean } | undefined;

/** Whether a review counts as auto-read for glyph/rail purposes (a `seen` chunk holding the evidence flag). */
export function isAutoReadReview(review: GlyphState): boolean {
  return review?.autoRead === true && review.state !== 'reviewed';
}

/** The outline glyph for a chunk's review — ◑ for auto-read, else the plain state glyph. */
export function reviewGlyph(review: GlyphState): string {
  return isAutoReadReview(review) ? AUTO_READ_GLYPH : STATE_GLYPH[review?.state ?? 'unseen'];
}

/** The state-dot / rail class token for a chunk's review — `auto` for auto-read, else the state name. */
export function reviewGlyphClass(review: GlyphState): string {
  return isAutoReadReview(review) ? 'auto' : (review?.state ?? 'unseen');
}
