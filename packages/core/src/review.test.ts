import { describe, expect, it } from 'vitest';
import { applyReviewPatch, emptyReview } from './review.js';

describe('applyReviewPatch field merging', () => {
  it('keeps state when a patch only toggles expanded', () => {
    const review = emptyReview('a', 'b');
    applyReviewPatch(review, { set: [{ chunkId: 'c1', state: 'reviewed', markedUnseen: true }] });
    applyReviewPatch(review, { set: [{ chunkId: 'c1', expanded: true }] });
    expect(review.chunks['c1']).toEqual({ state: 'reviewed', markedUnseen: true, expanded: true });
  });

  it('keeps expanded when a later patch changes state', () => {
    const review = emptyReview('a', 'b');
    applyReviewPatch(review, { set: [{ chunkId: 'c1', expanded: true }] });
    applyReviewPatch(review, { set: [{ chunkId: 'c1', state: 'reviewed' }] });
    expect(review.chunks['c1']).toEqual({ state: 'reviewed', expanded: true });
  });

  it('clears expanded on explicit false and drops invalid states', () => {
    const review = emptyReview('a', 'b');
    applyReviewPatch(review, { set: [{ chunkId: 'c1', state: 'seen', expanded: true }] });
    applyReviewPatch(review, { set: [{ chunkId: 'c1', expanded: false }] });
    expect(review.chunks['c1']).toEqual({ state: 'seen' });
    applyReviewPatch(review, { set: [{ chunkId: 'c1', state: 'approved' as never }] });
    expect(review.chunks['c1']!.state).toBe('seen');
  });
});
