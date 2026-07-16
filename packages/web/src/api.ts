import type { Book, Chunk, ReviewFile, ReviewPatch, UnifiedLine } from '@code-story/core';

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

export async function fetchReview(): Promise<ReviewFile> {
  const response = await fetch('/api/review');
  if (!response.ok) throw new Error(`GET /api/review failed: ${response.status}`);
  return response.json() as Promise<ReviewFile>;
}

/** keepalive so the final flush survives tab close/navigation. */
export function sendReviewPatch(patch: ReviewPatch): Promise<Response> {
  return fetch('/api/review', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
    keepalive: true,
  });
}
