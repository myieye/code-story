import type { Book, Chunk } from '@code-story/core';

export type Row =
  | { kind: 'section'; id: string; title: string; chunkCount: number }
  | { kind: 'chunk'; chunk: Chunk; sectionTitle: string; posinset: number }
  | { kind: 'end' };

export interface FlatBook {
  rows: Row[];
  /** Indexes into rows of every chunk row, in book order. */
  chunkRowIndexes: number[];
  /** Section id → its row index. */
  sectionRowIndex: Map<string, number>;
  totalChunks: number;
}

export function flattenBook(book: Book, chunks: Chunk[]): FlatBook {
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const rows: Row[] = [];
  const chunkRowIndexes: number[] = [];
  const sectionRowIndex = new Map<string, number>();
  let posinset = 0;

  for (const section of book.sections) {
    sectionRowIndex.set(section.id, rows.length);
    rows.push({ kind: 'section', id: section.id, title: section.title, chunkCount: section.occurrences.length });
    for (const occurrence of section.occurrences) {
      const chunk = byId.get(occurrence.chunkId);
      if (!chunk) continue;
      posinset++;
      chunkRowIndexes.push(rows.length);
      rows.push({ kind: 'chunk', chunk, sectionTitle: section.title, posinset });
    }
  }
  rows.push({ kind: 'end' });

  return { rows, chunkRowIndexes, sectionRowIndex, totalChunks: posinset };
}

/** The id's display path (symbol path + fragment suffix), or a line-range fallback. */
export function chunkTitle(chunk: Chunk): string {
  const displayPath = chunk.id.split('::')[1];
  if (displayPath) return displayPath;
  const range = chunk.headRange ?? chunk.baseRange;
  return range ? `lines ${range.start}–${range.end}` : chunk.file;
}

export function chunkSize(chunk: Chunk): { added: number; removed: number } {
  return {
    added: chunk.hunks.reduce((n, h) => n + h.headCount, 0),
    removed: chunk.hunks.reduce((n, h) => n + h.baseCount, 0),
  };
}
