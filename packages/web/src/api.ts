import type { BookResponse, OrderPatch, OrderResponse, ReviewFile, ReviewPatch } from '@code-story/core';

export type { BookResponse, OrderResponse };

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

export async function fetchOrder(): Promise<OrderResponse> {
  const response = await fetch('/api/order');
  if (!response.ok) throw new Error(`GET /api/order failed: ${response.status}`);
  return response.json() as Promise<OrderResponse>;
}

/** Fire-and-forget from the caller's perspective — the banner/indicator decision is local-first. */
export function sendOrderPatch(patch: OrderPatch): Promise<Response> {
  return fetch('/api/order', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
    keepalive: true,
  });
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
