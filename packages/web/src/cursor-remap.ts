import type { FlatBook } from './rows.js';

// The cursor and the neighbor back-stack are flat indices into `chunkRowIndexes`, which is rebuilt
// in a new order whenever the book reorders under the reviewer (the AI order overlay landing
// mid-review, a reading-order flip). An index that pointed at one occurrence now points at another.
// These helpers pin those indices to their `chunkId#ordinal` occurrence keys and resolve them back
// against the new flat book, so the reviewer stays on the chunk they were reading (#112).

/** The occurrence key at a cursor position, or undefined if the position is out of range. */
export function occurrenceKeyAt(flat: FlatBook, cursor: number): string | undefined {
  const rowIndex = flat.chunkRowIndexes[cursor];
  if (rowIndex === undefined) return undefined;
  const row = flat.rows[rowIndex];
  return row?.kind === 'chunk' ? row.occurrenceKey : undefined;
}

/**
 * Remap a cursor index from `prev` to `next` via its occurrence key. Falls back to 0 when the
 * occurrence no longer resolves — with the same chunk multiset a reorder can't drop one, so this is
 * a guard against crashing, not an expected path.
 */
export function remapCursor(prev: FlatBook, next: FlatBook, cursor: number): number {
  const key = occurrenceKeyAt(prev, cursor);
  if (key === undefined) return 0;
  return next.indexByOccurrence.get(key) ?? 0;
}

/** Remap a back-stack of cursor indices, dropping any whose occurrence no longer resolves. */
export function remapBackStack(prev: FlatBook, next: FlatBook, stack: readonly number[]): number[] {
  const out: number[] = [];
  for (const idx of stack) {
    const key = occurrenceKeyAt(prev, idx);
    if (key === undefined) continue;
    const mapped = next.indexByOccurrence.get(key);
    if (mapped !== undefined) out.push(mapped);
  }
  return out;
}
