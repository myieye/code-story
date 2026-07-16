import { type Chunk, type ChunkReviewState, isLowSignal, lowSignalReason } from '@code-story/core';
import type { FlatBook, Row } from './rows.js';

export type StateOf = (chunkId: string) => ChunkReviewState;

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

export interface SectionBatch {
  ids: string[];
  /** Unique stub reasons, e.g. "lockfile" — enumerated on the button (spec 00a). */
  reason: string;
}

/**
 * Sections whose every remaining (unreviewed) chunk is a low-signal stub — the only case where
 * batch acknowledgment is offered (spec 00a: stub ≠ handled, but no per-stub click-through).
 */
export function batchableSections(flat: FlatBook, stateOf: StateOf): Map<string, SectionBatch> {
  const bySection = new Map<string, { unreviewed: Chunk[]; seen: Set<string>; allStubs: boolean }>();
  for (const row of flat.rows) {
    if (row.kind !== 'chunk') continue;
    const entry = bySection.get(row.sectionId) ?? { unreviewed: [], seen: new Set<string>(), allStubs: true };
    // A chunk occurring twice in a section is still one mark (state lives on the chunk).
    if (stateOf(row.chunk.id) !== 'reviewed' && !entry.seen.has(row.chunk.id)) {
      entry.seen.add(row.chunk.id);
      entry.unreviewed.push(row.chunk);
      if (!isLowSignal(row.chunk)) entry.allStubs = false;
    }
    bySection.set(row.sectionId, entry);
  }
  const result = new Map<string, SectionBatch>();
  for (const [sectionId, entry] of bySection) {
    if (!entry.allStubs || entry.unreviewed.length === 0) continue;
    result.set(sectionId, {
      ids: entry.unreviewed.map((c) => c.id),
      reason: [...new Set(entry.unreviewed.map(lowSignalReason))].join(', '),
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
