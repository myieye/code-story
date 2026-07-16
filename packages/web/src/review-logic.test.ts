import type { Book, Chunk, ChunkReviewState } from '@code-story/core';
import { describe, expect, it } from 'vitest';
import { batchableSections, findUnreviewed, pendingStubCount } from './review-logic.js';
import { flattenBook } from './rows.js';

function chunk(id: string, generatedReason?: string): Chunk {
  return {
    id,
    file: 'f',
    symbolPath: [],
    displayPath: [id],
    kind: 'other',
    changeTypes: generatedReason !== undefined ? ['generated'] : [],
    ...(generatedReason !== undefined ? { generatedReason } : {}),
    hunks: [],
  };
}

function whitespaceChunk(id: string): Chunk {
  return { ...chunk(id), changeTypes: ['whitespace'] };
}

function book(sections: Record<string, Chunk[]>): { flat: ReturnType<typeof flattenBook>; chunks: Chunk[] } {
  const chunks = Object.values(sections).flat();
  const ordinals = new Map<string, number>();
  const b: Book = {
    headSha: 'head',
    sections: Object.entries(sections).map(([id, cs]) => ({
      id,
      title: id,
      occurrences: cs.map((c) => {
        const ordinal = ordinals.get(c.id) ?? 0;
        ordinals.set(c.id, ordinal + 1);
        return { chunkId: c.id, ordinal, role: 'primary' as const };
      }),
    })),
  };
  return { flat: flattenBook(b, [...new Map(chunks.map((c) => [c.id, c])).values()]), chunks };
}

const states = (map: Record<string, ChunkReviewState>) => (id: string) => map[id] ?? 'unseen';

describe('findUnreviewed', () => {
  const { flat } = book({ s1: [chunk('a'), chunk('b'), chunk('c')] });

  it('skips reviewed chunks and reports wrapping', () => {
    const stateOf = states({ b: 'reviewed', c: 'reviewed' });
    expect(findUnreviewed(flat, stateOf, 1, 1)).toEqual({ index: 0, wrapped: true });
    expect(findUnreviewed(flat, stateOf, 0, 1)).toEqual({ index: 0, wrapped: false });
  });

  it('treats alsoReviewed as reviewed and returns undefined when nothing remains', () => {
    const stateOf = states({ a: 'reviewed', b: 'reviewed' });
    expect(findUnreviewed(flat, stateOf, 0, 1, 'c')).toBeUndefined();
    expect(findUnreviewed(flat, stateOf, 0, 1)).toEqual({ index: 2, wrapped: false });
  });

  it('searches backwards with wrap', () => {
    expect(findUnreviewed(flat, states({ a: 'reviewed' }), 0, -1)).toEqual({ index: 2, wrapped: true });
  });
});

describe('batchableSections', () => {
  it('offers a batch only for sections whose remaining chunks are all low-signal', () => {
    const { flat } = book({
      lockfile: [chunk('l1', 'lockfile'), chunk('l2', 'lockfile')],
      mixed: [chunk('m1', 'lockfile'), chunk('m2')],
      code: [chunk('c1')],
    });
    const batches = batchableSections(flat, states({}));
    expect([...batches.keys()]).toEqual(['lockfile']);
    expect(batches.get('lockfile')).toEqual({ ids: ['l1', 'l2'], reason: 'lockfile' });
  });

  it('becomes batchable once the non-stub chunks are reviewed, and lists unique reasons', () => {
    const { flat } = book({ mixed: [chunk('m1', 'lockfile'), chunk('m2'), chunk('m3', 'minified')] });
    expect(batchableSections(flat, states({})).size).toBe(0);
    const batches = batchableSections(flat, states({ m2: 'reviewed' }));
    expect(batches.get('mixed')).toEqual({ ids: ['m1', 'm3'], reason: 'lockfile, minified' });
  });

  it('offers nothing for fully reviewed sections', () => {
    const { flat } = book({ lockfile: [chunk('l1', 'lockfile')] });
    expect(batchableSections(flat, states({ l1: 'reviewed' })).size).toBe(0);
  });

  it('treats whitespace-only chunks as stubs with reason "whitespace"', () => {
    const { flat } = book({ s: [whitespaceChunk('w1'), whitespaceChunk('w2')] });
    expect(batchableSections(flat, states({})).get('s')).toEqual({ ids: ['w1', 'w2'], reason: 'whitespace' });
    expect(pendingStubCount(flat, states({}))).toBe(2);
  });
});

describe('pendingStubCount', () => {
  it('counts unreviewed low-signal chunks only', () => {
    const { flat } = book({ s: [chunk('a', 'lockfile'), chunk('b', 'lockfile'), chunk('c')] });
    expect(pendingStubCount(flat, states({}))).toBe(2);
    expect(pendingStubCount(flat, states({ a: 'reviewed' }))).toBe(1);
    expect(pendingStubCount(flat, states({ a: 'reviewed', b: 'seen' }))).toBe(1);
  });
});

// A chunk may occur in the book more than once (R-004); review state stays on the chunk.
describe('multi-occurrence books', () => {
  const { flat } = book({ s1: [chunk('a'), chunk('b')], s2: [chunk('a'), chunk('c')] });

  it('separates walk stops (occurrences) from review progress (distinct chunks)', () => {
    expect(flat.totalOccurrences).toBe(4);
    expect(flat.distinctChunks).toBe(3);
    expect(flat.firstIndexByChunkId.get('a')).toBe(0);
    expect(flat.indexByOccurrence.get('a#0')).toBe(0);
    expect(flat.indexByOccurrence.get('a#1')).toBe(2);
  });

  it('skips every occurrence of a reviewed chunk', () => {
    const stateOf = states({ a: 'reviewed', b: 'reviewed' });
    expect(findUnreviewed(flat, stateOf, 0, 1)).toEqual({ index: 3, wrapped: false });
  });

  it('counts a twice-occurring stub chunk once', () => {
    const { flat: stubs } = book({ s1: [whitespaceChunk('w')], s2: [whitespaceChunk('w')] });
    expect(pendingStubCount(stubs, states({}))).toBe(1);
    expect(batchableSections(stubs, states({})).get('s1')).toEqual({ ids: ['w'], reason: 'whitespace' });
  });
});
