import { assembleChunkGraph, type ChunkEdge, type ChunkEdgeKind, type ChunkReviewState } from '@code-story/core';
import { describe, expect, it } from 'vitest';
import { frontierCount, interactionCount } from './frontier-logic.js';

function edge(from: string, to: string, kind: ChunkEdgeKind): ChunkEdge {
  return { from, to, kind, source: 'references', fromLines: [] };
}

const graph = assembleChunkGraph('H', [
  edge('a', 'b', 'calls'),
  edge('b', 'c', 'calls'),
  edge('t', 'a', 'exercises'),
  edge('a', 'f', 'file-imports'), // file-level — never counted
  edge('a', 'ghost', 'calls'), // endpoint not in the book — never counted
]);

const inBook = (id: string) => id !== 'ghost';
const reviewed = (...ids: string[]): ((id: string) => ChunkReviewState) => {
  const set = new Set(ids);
  return (id) => (set.has(id) ? 'reviewed' : 'unseen');
};

describe('frontierCount', () => {
  it('is zero on an empty graph', () => {
    expect(frontierCount({ edges: [] }, reviewed(), inBook)).toBe(0);
  });

  it('is zero when nothing is reviewed (no split edge)', () => {
    expect(frontierCount(graph, reviewed(), inBook)).toBe(0);
  });

  it('counts an interaction edge with exactly one reviewed endpoint', () => {
    // a reviewed: splits a→b (calls) and t→a (exercises). b→c both unreviewed; file/ghost excluded.
    expect(frontierCount(graph, reviewed('a'), inBook)).toBe(2);
  });

  it('excludes file-imports and out-of-book endpoints', () => {
    // Only 'f' and 'ghost' reviewed: the a→f edge is file-imports, a→ghost is out-of-book — both excluded.
    expect(frontierCount(graph, reviewed('f', 'ghost'), inBook)).toBe(0);
  });

  it('is zero once every chunk is reviewed (100% coverage ⇒ empty frontier)', () => {
    expect(frontierCount(graph, reviewed('a', 'b', 'c', 't', 'f'), inBook)).toBe(0);
  });
});

describe('interactionCount', () => {
  it('counts calls + exercises with both endpoints in book, excluding file-imports and out-of-book', () => {
    // a→b, b→c, t→a = 3; a→f (file-imports) and a→ghost (out-of-book) excluded.
    expect(interactionCount(graph, inBook)).toBe(3);
  });

  it('is zero on an empty graph', () => {
    expect(interactionCount({ edges: [] }, inBook)).toBe(0);
  });
});
