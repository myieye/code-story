import type {
  BookResponse,
  ChangelogResponse,
  ContextResponse,
  CreateStoryRequest,
  CreateStoryResponse,
  Deferral,
  DeferralRequest,
  DeferralsResponse,
  NarrationResponse,
  OrderPatch,
  OrderResponse,
  ReviewFile,
  ReviewPatch,
  StoriesResponse,
  StoryConfig,
} from '@code-story/core';
import { bookQuery } from './order-options-logic.js';

export type { BookResponse, ContextResponse, Deferral, DeferralRequest, DeferralsResponse, NarrationResponse, OrderResponse };
export type { ChangelogResponse, CreateStoryRequest, StoriesResponse };

/** With a config, requests the book under that reading order (#114); without, the launch config. */
export async function fetchBook(config?: StoryConfig): Promise<BookResponse> {
  const response = await fetch(`/api/book${config ? bookQuery(config) : ''}`);
  if (!response.ok) throw new Error(`GET /api/book failed: ${response.status}`);
  return response.json() as Promise<BookResponse>;
}

/** The story library (R-061): every persisted snapshot + which range is currently open. */
export async function fetchStories(): Promise<StoriesResponse> {
  const response = await fetch('/api/stories');
  if (!response.ok) throw new Error(`GET /api/stories failed: ${response.status}`);
  return response.json() as Promise<StoriesResponse>;
}

/** Trigger a new review; the daemon compiles + persists + switches to it. Returns the new story id. */
export async function createStory(req: CreateStoryRequest): Promise<CreateStoryResponse> {
  const response = await fetch('/api/stories', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `POST /api/stories failed: ${response.status}`);
  }
  return response.json() as Promise<CreateStoryResponse>;
}

/** Open a persisted story: the daemon switches its active range to it. Reload to read it. */
export async function openStory(id: string): Promise<void> {
  const response = await fetch('/api/stories/open', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  if (!response.ok) throw new Error(`POST /api/stories/open failed: ${response.status}`);
}

export async function fetchChangelog(): Promise<ChangelogResponse> {
  const response = await fetch('/api/changelog');
  if (!response.ok) throw new Error(`GET /api/changelog failed: ${response.status}`);
  return response.json() as Promise<ChangelogResponse>;
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

export async function fetchDeferrals(): Promise<DeferralsResponse> {
  const response = await fetch('/api/deferrals');
  if (!response.ok) throw new Error(`GET /api/deferrals failed: ${response.status}`);
  return response.json() as Promise<DeferralsResponse>;
}

/** Persist a deferral (append, or upsert on the same id = Retry); returns the stored record. */
export async function postDeferral(req: DeferralRequest): Promise<Deferral> {
  const response = await fetch('/api/deferrals', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!response.ok) throw new Error(`POST /api/deferrals failed: ${response.status}`);
  return response.json() as Promise<Deferral>;
}

export async function deleteDeferral(id: string): Promise<void> {
  const response = await fetch(`/api/deferrals/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!response.ok && response.status !== 404) throw new Error(`DELETE /api/deferrals failed: ${response.status}`);
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
