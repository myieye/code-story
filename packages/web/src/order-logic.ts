import type { ChunkReview, OrderOverlay } from '@code-story/core';

export type OrderDecision = 'apply' | 'offer' | 'none';

/**
 * Whether the AI order overlay should be applied, offered, or left alone (spec 02 "Runtime
 * shape"). The server already discards stale (fingerprint-mismatched) overlays, so a non-null
 * overlay here is always fresh. `appliedAt`/`dismissedAt` are sticky once set — a mark made
 * after auto-apply must never flip a displayed order back to tier 0.
 */
export function orderDecision(overlay: OrderOverlay | null, reviewStates: Record<string, ChunkReview>): OrderDecision {
  if (!overlay) return 'none';
  if (overlay.appliedAt) return 'apply';
  if (overlay.dismissedAt) return 'none';
  const started = Object.values(reviewStates).some((r) => r.state === 'reviewed');
  return started ? 'offer' : 'apply';
}
