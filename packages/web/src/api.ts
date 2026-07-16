import type { Book, Chunk, UnifiedLine } from '@code-story/core';

export interface BookResponse {
  base: string;
  head: string;
  book: Book;
  chunks: Chunk[];
  diffs: Record<string, UnifiedLine[]>;
}

export async function fetchBook(): Promise<BookResponse> {
  const response = await fetch('/api/book');
  if (!response.ok) throw new Error(`GET /api/book failed: ${response.status}`);
  return response.json() as Promise<BookResponse>;
}
