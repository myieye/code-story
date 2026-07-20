import type { Book, Chunk, Occurrence } from '@code-story/core';
export { chunkTitle } from '@code-story/core';

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
  /** Occurrence rows — walk stops, aria-setsize. */
  totalOccurrences: number;
  /** Distinct chunks — the review-progress denominator (review state lives on the chunk). */
  distinctChunks: number;
}

export function flattenBook(book: Book, chunks: Chunk[]): FlatBook {
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
  rows.push({ kind: 'end' });

  return {
    rows,
    chunkRowIndexes,
    firstIndexByChunkId,
    indexByOccurrence,
    sectionRowIndex,
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
