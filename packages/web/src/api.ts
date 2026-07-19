import type {
  BookResponse,
  ContextResponse,
  NarrationResponse,
  OrderPatch,
  OrderResponse,
  ReviewFile,
  ReviewPatch,
  StoryConfig,
} from '@code-story/core';
import { bookQuery } from './order-options-logic.js';

export type { BookResponse, ContextResponse, NarrationResponse, OrderResponse };

/** With a config, requests the book under that reading order (#114); without, the launch config. */
export async function fetchBook(config?: StoryConfig): Promise<BookResponse> {
  const response = await fetch(`/api/book${config ? bookQuery(config) : ''}`);
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

export async function fetchNarration(): Promise<NarrationResponse> {
  const response = await fetch('/api/narration');
  if (!response.ok) throw new Error(`GET /api/narration failed: ${response.status}`);
  return response.json() as Promise<NarrationResponse>;
}

/** On-demand context for one chunk — facts only, no model calls (spec 04). Cached by the caller. */
export async function fetchContext(chunkId: string): Promise<ContextResponse> {
  const response = await fetch(`/api/context?chunk=${encodeURIComponent(chunkId)}`);
  if (!response.ok) throw new Error(`GET /api/context failed: ${response.status}`);
  return response.json() as Promise<ContextResponse>;
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
