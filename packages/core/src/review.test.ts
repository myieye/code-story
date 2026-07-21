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

  it('adds autoRead like markedUnseen and keeps it across an unmark', () => {
    const review = emptyReview('a', 'b');
    applyReviewPatch(review, { set: [{ chunkId: 'c1', state: 'seen', autoRead: true }] });
    expect(review.chunks['c1']).toEqual({ state: 'seen', autoRead: true });
    // Confirm → reviewed carries the flag forward (the protocol only adds flags).
    applyReviewPatch(review, { set: [{ chunkId: 'c1', state: 'reviewed', reviewedVia: 'auto' }] });
    expect(review.chunks['c1']).toEqual({ state: 'reviewed', autoRead: true, reviewedVia: 'auto' });
    // Unmark → seen keeps autoRead so the glyph returns to ◑, not •.
    applyReviewPatch(review, { set: [{ chunkId: 'c1', state: 'seen' }] });
    expect(review.chunks['c1']).toEqual({ state: 'seen', autoRead: true, reviewedVia: 'auto' });
  });

  it('lets a later reviewedVia win and drops an invalid one', () => {
    const review = emptyReview('a', 'b');
    applyReviewPatch(review, { set: [{ chunkId: 'c1', state: 'reviewed', reviewedVia: 'auto' }] });
    applyReviewPatch(review, { set: [{ chunkId: 'c1', state: 'reviewed', reviewedVia: 'explicit' }] });
    expect(review.chunks['c1']!.reviewedVia).toBe('explicit');
    applyReviewPatch(review, { set: [{ chunkId: 'c1', reviewedVia: 'bogus' as never }] });
    expect(review.chunks['c1']!.reviewedVia).toBe('explicit');
  });
});
