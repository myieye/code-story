import type { Book, Chunk } from '@code-story/core';
import { describe, expect, it } from 'vitest';
import { occurrenceKeyAt, remapBackStack, remapCursor } from './cursor-remap.js';
import { flattenBook } from './rows.js';

function chunk(name: string): Chunk {
  return {
    id: `${name}::x::${name.length}`,
    file: `${name}.ts`,
    symbolPath: ['x'],
    displayPath: ['x'],
    kind: 'other',
    changeTypes: [],
    hunks: [{ baseStart: 0, baseCount: 0, headStart: 1, headCount: 2 }],
    headRange: { start: 1, end: 2 },
  };
}

const chunks = ['a', 'b', 'c'].map(chunk);
const byName = (n: string) => chunks.find((c) => c.file === `${n}.ts`)!;

/** A flat one-section book listing the given chunks in the given order. */
function bookOf(order: string[]): Book {
  return {
    headSha: 'deadbeef',
    sections: [
      {
        id: 's',
        title: 'S',
        occurrences: order.map((n) => ({ chunkId: byName(n).id, ordinal: 0, role: 'primary' as const })),
      },
    ],
  };
}

describe('cursor-remap', () => {
  it('keeps the cursor on the same chunk after a reorder', () => {
    const prev = flattenBook(bookOf(['a', 'b', 'c']), chunks);
    const next = flattenBook(bookOf(['c', 'a', 'b']), chunks);
    // cursor 1 = chunk b in prev; b sits at cursor 2 in next.
    expect(occurrenceKeyAt(prev, 1)).toBe(`${byName('b').id}#0`);
    expect(remapCursor(prev, next, 1)).toBe(2);
    // cursor 0 = a → moves to 1; cursor 2 = c → moves to 0.
    expect(remapCursor(prev, next, 0)).toBe(1);
    expect(remapCursor(prev, next, 2)).toBe(0);
  });

  it('is a no-op when the order is unchanged', () => {
    const prev = flattenBook(bookOf(['a', 'b', 'c']), chunks);
    const next = flattenBook(bookOf(['a', 'b', 'c']), chunks);
    expect(remapCursor(prev, next, 2)).toBe(2);
    expect(remapBackStack(prev, next, [0, 1, 2])).toEqual([0, 1, 2]);
  });

  it('remaps the back-stack occurrence-by-occurrence', () => {
    const prev = flattenBook(bookOf(['a', 'b', 'c']), chunks);
    const next = flattenBook(bookOf(['c', 'b', 'a']), chunks);
    // stack of origins a(0), c(2) → a is now 2, c is now 0.
    expect(remapBackStack(prev, next, [0, 2])).toEqual([2, 0]);
  });

  it('drops a back-stack entry whose occurrence no longer resolves', () => {
    const prev = flattenBook(bookOf(['a', 'b', 'c']), chunks);
    // c is gone from the new book — its stack entry is dropped, the rest still resolve.
    const next = flattenBook(bookOf(['a', 'b']), chunks);
    expect(remapBackStack(prev, next, [0, 2, 1])).toEqual([0, 1]);
  });

  it('falls back to 0 rather than crashing on an unresolvable cursor', () => {
    const prev = flattenBook(bookOf(['a', 'b', 'c']), chunks);
    const next = flattenBook(bookOf(['a', 'b']), chunks);
    // cursor was on c, which the new book lacks: guard to index 0.
    expect(remapCursor(prev, next, 2)).toBe(0);
    // an out-of-range cursor also lands on 0.
    expect(occurrenceKeyAt(prev, 99)).toBeUndefined();
    expect(remapCursor(prev, next, 99)).toBe(0);
  });
});
