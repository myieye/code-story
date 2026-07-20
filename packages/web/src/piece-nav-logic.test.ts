import type { Chunk, ChunkReviewState } from '@code-story/core';
import { describe, expect, it } from 'vitest';
import { fileOrderIndex, pieceMenuModel, stepPieceTarget } from './piece-nav-logic.js';

function chunk(id: string, file: string, start: number, added = 1, removed = 0): Chunk {
  return {
    id,
    file,
    symbolPath: [id],
    displayPath: [id],
    kind: 'method',
    changeTypes: [],
    headRange: { start, end: start + 1 },
    hunks: [{ baseStart: start, baseCount: removed, headStart: start, headCount: added }],
  };
}

const chunks = [
  chunk('a2', 'Foo.cs', 30),
  chunk('a1', 'Foo.cs', 10),
  chunk('a3', 'Foo.cs', 50),
  chunk('b1', 'Bar.cs', 5),
];

describe('fileOrderIndex', () => {
  it('orders a file’s distinct chunks by start line and assigns n / total', () => {
    const index = fileOrderIndex(chunks);
    expect(index.get('a1')).toMatchObject({ n: 1, total: 3 });
    expect(index.get('a2')).toMatchObject({ n: 2, total: 3 });
    expect(index.get('a3')).toMatchObject({ n: 3, total: 3 });
    expect(index.get('a1')?.fileChunkIdsInOrder).toEqual(['a1', 'a2', 'a3']);
  });

  it('treats a lone file chunk as a single piece', () => {
    expect(fileOrderIndex(chunks).get('b1')).toMatchObject({ n: 1, total: 1 });
  });

  it('falls back to baseRange.start when headRange is absent', () => {
    const deleted: Chunk = { ...chunk('d1', 'Baz.cs', 0), headRange: undefined, baseRange: { start: 3, end: 4 } };
    const later: Chunk = chunk('d2', 'Baz.cs', 20);
    const index = fileOrderIndex([later, deleted]);
    expect(index.get('d1')?.n).toBe(1);
    expect(index.get('d2')?.n).toBe(2);
  });
});

describe('pieceMenuModel', () => {
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const reviewOf = (id: string) =>
    id === 'a1'
      ? { state: 'reviewed' as ChunkReviewState }
      : id === 'a2'
        ? { state: 'seen' as ChunkReviewState, autoRead: true as const }
        : { state: 'unseen' as ChunkReviewState };

  it('lists pieces in file order with per-piece state, auto-read, size, and the reviewed count', () => {
    const piece = fileOrderIndex(chunks).get('a2')!;
    const model = pieceMenuModel('Foo.cs', piece, byId, reviewOf, 'a2');
    expect(model.file).toBe('Foo.cs');
    expect(model.total).toBe(3);
    expect(model.reviewed).toBe(1);
    expect(model.items.map((i) => i.chunkId)).toEqual(['a1', 'a2', 'a3']);
    expect(model.items.map((i) => i.state)).toEqual(['reviewed', 'seen', 'unseen']);
    expect(model.items.map((i) => i.autoRead)).toEqual([false, true, false]);
    expect(model.items.find((i) => i.current)?.chunkId).toBe('a2');
    expect(model.items[0]).toMatchObject({ added: 1, removed: 0 });
  });
});

describe('stepPieceTarget', () => {
  const piece = fileOrderIndex(chunks).get('a2')!;

  it('steps forward and backward within the file', () => {
    expect(stepPieceTarget(piece, 'a1', 1)).toBe('a2');
    expect(stepPieceTarget(piece, 'a2', -1)).toBe('a1');
  });

  it('returns undefined at the ends and for an unknown chunk', () => {
    expect(stepPieceTarget(piece, 'a3', 1)).toBeUndefined();
    expect(stepPieceTarget(piece, 'a1', -1)).toBeUndefined();
    expect(stepPieceTarget(piece, 'zzz', 1)).toBeUndefined();
    expect(stepPieceTarget(undefined, 'a1', 1)).toBeUndefined();
  });
});
