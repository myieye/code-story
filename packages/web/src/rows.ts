import type { Book, Chunk } from '@code-story/core';
export { chunkTitle } from '@code-story/core';

export type Row =
  | { kind: 'section'; id: string; title: string; chunkCount: number }
  | { kind: 'chunk'; chunk: Chunk; sectionId: string; sectionTitle: string; posinset: number }
  | { kind: 'end' };

export interface FlatBook {
  rows: Row[];
  /** Indexes into rows of every chunk row, in book order. */
  chunkRowIndexes: number[];
  /** Chunk id → its index into chunkRowIndexes (the cursor space). */
  chunkIndexById: Map<string, number>;
  /** Section id → its row index. */
  sectionRowIndex: Map<string, number>;
  totalChunks: number;
}

export function flattenBook(book: Book, chunks: Chunk[]): FlatBook {
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const rows: Row[] = [];
  const chunkRowIndexes: number[] = [];
  const chunkIndexById = new Map<string, number>();
  const sectionRowIndex = new Map<string, number>();
  let posinset = 0;

  for (const section of book.sections) {
    sectionRowIndex.set(section.id, rows.length);
    rows.push({ kind: 'section', id: section.id, title: section.title, chunkCount: section.occurrences.length });
    for (const occurrence of section.occurrences) {
      const chunk = byId.get(occurrence.chunkId);
      if (!chunk) continue;
      posinset++;
      chunkIndexById.set(chunk.id, chunkRowIndexes.length);
      chunkRowIndexes.push(rows.length);
      rows.push({ kind: 'chunk', chunk, sectionId: section.id, sectionTitle: section.title, posinset });
    }
  }
  rows.push({ kind: 'end' });

  return { rows, chunkRowIndexes, chunkIndexById, sectionRowIndex, totalChunks: posinset };
}

export function chunkSize(chunk: Chunk): { added: number; removed: number } {
  return {
    added: chunk.hunks.reduce((n, h) => n + h.headCount, 0),
    removed: chunk.hunks.reduce((n, h) => n + h.baseCount, 0),
  };
}
