import type { Book, Chunk, Occurrence } from '@code-story/core';
import { DEFERRED_WEB_SECTION_ID } from './progress-logic.js';
export { chunkTitle } from '@code-story/core';

/** The web-only synthetic Deferred section (spec 06 slice 6): injected after compile, never in core. */
export const DEFERRED_SECTION_ID = DEFERRED_WEB_SECTION_ID;

/** Last path segment — the file label shown on every chunk header (full path lives in its `title`). */
export function fileBasename(file: string): string {
  return file.split('/').pop() ?? file;
}

export type Row =
  | { kind: 'section'; id: string; title: string; chunkCount: number }
  | {
      kind: 'chunk';
      chunk: Chunk;
      occurrence: Occurrence;
      sectionId: string;
      sectionTitle: string;
      occurrenceKey: string;
      posinset: number;
    }
  /** A card in the Deferred section — not a cursor walk-stop; resolved by its own Mark reviewed. */
  | { kind: 'deferred-card'; chunk: Chunk; sectionId: string; occurrenceKey: string }
  | { kind: 'end' };

/** Identity of one occurrence row — a chunk may appear in the book more than once (R-004). */
export function occurrenceKey(occurrence: Occurrence): string {
  return `${occurrence.chunkId}#${occurrence.ordinal}`;
}

export interface FlatBook {
  rows: Row[];
  /** Indexes into rows of every occurrence row, in book order — the cursor space. */
  chunkRowIndexes: number[];
  /** Chunk id → cursor index of its first occurrence (resume, outline section jumps). */
  firstIndexByChunkId: Map<string, number>;
  /** Occurrence key → cursor index (outline per-occurrence jumps, cursor highlight). */
  indexByOccurrence: Map<string, number>;
  /** Section id → its row index. */
  sectionRowIndex: Map<string, number>;
  /** flat.rows index of the synthetic Deferred section header, when present. */
  deferredSectionRowIndex?: number;
  /** Deferred chunk id → flat.rows index of its card (for "Go to Deferred" / outline jumps). */
  deferredCardRowIndex: Map<string, number>;
  /** Occurrence rows — walk stops, aria-setsize. */
  totalOccurrences: number;
  /** Distinct chunks — the review-progress denominator (review state lives on the chunk). */
  distinctChunks: number;
}

/**
 * `deferredChunkIds` (spec 06 slice 6) injects the web-only Deferred section AFTER compile — a
 * `section` header (so scrollspy/outline treat it like any other) plus one `deferred-card` row per
 * chunk, pinned before the end row and absent when empty. These cards are not occurrence walk-stops,
 * so the cursor space, coverage denominator, and segmented bar are all untouched (the section id is
 * excluded from `book.sections`, so `segmentModel` never sees it).
 */
export function flattenBook(book: Book, chunks: Chunk[], deferredChunkIds: readonly string[] = []): FlatBook {
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const rows: Row[] = [];
  const chunkRowIndexes: number[] = [];
  const firstIndexByChunkId = new Map<string, number>();
  const indexByOccurrence = new Map<string, number>();
  const sectionRowIndex = new Map<string, number>();
  let posinset = 0;

  for (const section of book.sections) {
    sectionRowIndex.set(section.id, rows.length);
    rows.push({ kind: 'section', id: section.id, title: section.title, chunkCount: section.occurrences.length });
    for (const occurrence of section.occurrences) {
      const chunk = byId.get(occurrence.chunkId);
      if (!chunk) continue;
      posinset++;
      const cursorIndex = chunkRowIndexes.length;
      const key = occurrenceKey(occurrence);
      if (!firstIndexByChunkId.has(chunk.id)) firstIndexByChunkId.set(chunk.id, cursorIndex);
      indexByOccurrence.set(key, cursorIndex);
      chunkRowIndexes.push(rows.length);
      rows.push({
        kind: 'chunk',
        chunk,
        occurrence,
        sectionId: section.id,
        sectionTitle: section.title,
        occurrenceKey: key,
        posinset,
      });
    }
  }

  const deferredCardRowIndex = new Map<string, number>();
  let deferredSectionRowIndex: number | undefined;
  const present = deferredChunkIds.filter((id) => byId.has(id));
  if (present.length > 0) {
    deferredSectionRowIndex = rows.length;
    rows.push({ kind: 'section', id: DEFERRED_SECTION_ID, title: 'Deferred', chunkCount: present.length });
    for (const id of present) {
      const chunk = byId.get(id)!;
      deferredCardRowIndex.set(id, rows.length);
      rows.push({ kind: 'deferred-card', chunk, sectionId: DEFERRED_SECTION_ID, occurrenceKey: `${DEFERRED_SECTION_ID}#${id}` });
    }
  }

  rows.push({ kind: 'end' });

  return {
    rows,
    chunkRowIndexes,
    firstIndexByChunkId,
    indexByOccurrence,
    sectionRowIndex,
    ...(deferredSectionRowIndex !== undefined ? { deferredSectionRowIndex } : {}),
    deferredCardRowIndex,
    totalOccurrences: posinset,
    distinctChunks: firstIndexByChunkId.size,
  };
}

export function chunkSize(chunk: Chunk): { added: number; removed: number } {
  return {
    added: chunk.hunks.reduce((n, h) => n + h.headCount, 0),
    removed: chunk.hunks.reduce((n, h) => n + h.baseCount, 0),
  };
}
