import type { ChunkReview, OrderOverlay } from '@code-story/core';
import { describe, expect, it } from 'vitest';
import { orderDecision } from './order-logic.js';

function overlay(fields: Partial<OrderOverlay> = {}): OrderOverlay {
  return {
    version: 1,
    bookFingerprint: 'fp',
    permutation: ['a', 'b'],
    rationales: {},
    model: 'opus',
    promptVersion: 'v1',
    createdAt: '2026-07-16T00:00:00Z',
    ...fields,
  };
}

const reviewed = (id: string): Record<string, ChunkReview> => ({ [id]: { state: 'reviewed' } });
const unreviewed = (id: string): Record<string, ChunkReview> => ({ [id]: { state: 'seen' } });

describe('orderDecision', () => {
  it('is none when there is no overlay', () => {
    expect(orderDecision(null, {})).toBe('none');
  });

  it('is apply once appliedAt is set, regardless of review progress (sticky, never un-applies)', () => {
    expect(orderDecision(overlay({ appliedAt: '2026-07-16T01:00:00Z' }), {})).toBe('apply');
    expect(orderDecision(overlay({ appliedAt: '2026-07-16T01:00:00Z' }), reviewed('a'))).toBe('apply');
  });

  it('is none when dismissedAt is set and appliedAt is not (never re-asks)', () => {
    expect(orderDecision(overlay({ dismissedAt: '2026-07-16T01:00:00Z' }), {})).toBe('none');
    expect(orderDecision(overlay({ dismissedAt: '2026-07-16T01:00:00Z' }), reviewed('a'))).toBe('none');
  });

  it('prefers appliedAt over dismissedAt if somehow both are set', () => {
    expect(orderDecision(overlay({ appliedAt: '2026-07-16T01:00:00Z', dismissedAt: '2026-07-16T02:00:00Z' }), {})).toBe(
      'apply',
    );
  });

  it('is apply when neither flag is set and no chunk has been reviewed yet', () => {
    expect(orderDecision(overlay(), {})).toBe('apply');
    expect(orderDecision(overlay(), unreviewed('a'))).toBe('apply');
  });

  it('does not count seen or cursor state as "started" — only an explicit reviewed mark does', () => {
    expect(orderDecision(overlay(), { a: { state: 'unseen' }, b: { state: 'seen' } })).toBe('apply');
  });

  it('is offer once any chunk is reviewed and the overlay has not been applied or dismissed', () => {
    expect(orderDecision(overlay(), reviewed('a'))).toBe('offer');
  });
});
