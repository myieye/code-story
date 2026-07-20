import { type Chunk, type ChunkReview, type ChunkReviewState, isLowSignal, lowSignalReason } from '@code-story/core';
import type { FlatBook, Row } from './rows.js';

export type StateOf = (chunkId: string) => ChunkReviewState;
export type ReviewOf = (chunkId: string) => ChunkReview;

export function chunkAt(flat: FlatBook, cursorIndex: number): Chunk {
  const row = flat.rows[flat.chunkRowIndexes[cursorIndex]!] as Extract<Row, { kind: 'chunk' }>;
  return row.chunk;
}

/** Next/previous occurrence of a not-reviewed chunk starting at `from` (cursor space), wrapping. */
export function findUnreviewed(
  flat: FlatBook,
  stateOf: StateOf,
  from: number,
  dir: 1 | -1,
  alsoReviewed?: string,
): { index: number; wrapped: boolean } | undefined {
  const total = flat.totalOccurrences;
  for (let step = 0; step < total; step++) {
    const raw = from + dir * step;
    const i = ((raw % total) + total) % total;
    const id = chunkAt(flat, i).id;
    if (id !== alsoReviewed && stateOf(id) !== 'reviewed') {
      return { index: i, wrapped: raw < 0 || raw >= total };
    }
  }
  return undefined;
}

/**
 * Where the cursor lands after marking the current chunk reviewed. Mark-and-advance (Enter) moves to
 * the next unreviewed occurrence in book order; mark-in-place (m) stays put so the reviewer can follow
 * the chunk's neighbor strip. Returns `undefined` when advancing past the last unreviewed chunk (same
 * signal as `findUnreviewed`).
 */
export function cursorAfterMark(
  flat: FlatBook,
  stateOf: StateOf,
  cursor: number,
  markedChunkId: string,
  advance: boolean,
): { index: number; wrapped: boolean } | undefined {
  if (!advance) return { index: cursor, wrapped: false };
  return findUnreviewed(flat, stateOf, cursor + 1, 1, markedChunkId);
}

export interface SectionBatch {
  ids: string[];
  /** Unique stub reasons, e.g. "lockfile" — enumerated on the button (spec 00a). Empty when no stubs. */
  reason: string;
  /** Auto-read chunks in the batch (spec 06 slice 3) — read at reading pace, awaiting confirm. */
  readCount: number;
  /** Low-signal stub chunks in the batch. */
  stubCount: number;
}

/**
 * Sections whose every remaining (unreviewed) chunk is bulk-acknowledgeable: a low-signal stub
 * (spec 00a: stub ≠ handled, but no per-stub click-through) or an auto-read chunk (spec 06 slice 3:
 * seen at reading pace, awaiting a single bulk confirm). Mixed remainders count both.
 */
export function batchableSections(flat: FlatBook, reviewOf: ReviewOf): Map<string, SectionBatch> {
  const bySection = new Map<string, { unreviewed: Chunk[]; seen: Set<string>; batchable: boolean }>();
  for (const row of flat.rows) {
    if (row.kind !== 'chunk') continue;
    const entry = bySection.get(row.sectionId) ?? { unreviewed: [], seen: new Set<string>(), batchable: true };
    // A chunk occurring twice in a section is still one mark (state lives on the chunk).
    if (reviewOf(row.chunk.id).state !== 'reviewed' && !entry.seen.has(row.chunk.id)) {
      entry.seen.add(row.chunk.id);
      entry.unreviewed.push(row.chunk);
      if (!isLowSignal(row.chunk) && !reviewOf(row.chunk.id).autoRead) entry.batchable = false;
    }
    bySection.set(row.sectionId, entry);
  }
  const result = new Map<string, SectionBatch>();
  for (const [sectionId, entry] of bySection) {
    if (!entry.batchable || entry.unreviewed.length === 0) continue;
    const stubs = entry.unreviewed.filter(isLowSignal);
    result.set(sectionId, {
      ids: entry.unreviewed.map((c) => c.id),
      reason: [...new Set(stubs.map(lowSignalReason))].join(', '),
      readCount: entry.unreviewed.length - stubs.length,
      stubCount: stubs.length,
    });
  }
  return result;
}

export function pendingStubCount(flat: FlatBook, stateOf: StateOf): number {
  const pending = new Set<string>();
  for (const row of flat.rows) {
    if (row.kind === 'chunk' && isLowSignal(row.chunk) && stateOf(row.chunk.id) !== 'reviewed') pending.add(row.chunk.id);
  }
  return pending.size;
}
