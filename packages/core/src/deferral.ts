/**
 * Deferral state (spec 06 slice 6 / spec 07 G3): a chunk set aside for the end of the story with a
 * note-to-self or a background-AI prompt. Pure reviewer state — it carries no fingerprint and is
 * immune to CORE_VERSION (a chunking/ordering change never invalidates a note the reviewer wrote).
 * The server owns the store; the AI answer is filled by the `deferral` glue task.
 */
import type { LineRange } from './model.js';

export type DeferralKind = 'note' | 'ai';

export type DeferralAnswerStatus = 'running' | 'done' | 'failed';

export interface Deferral {
  /** Client-generated (crypto.randomUUID). */
  id: string;
  chunkId: string;
  kind: DeferralKind;
  /** Note body, or the AI prompt. '' is allowed for a bare bookmark. */
  text: string;
  /** Optional captured CM6 selection (1-based head lines) — descriptive, never a review unit. */
  lineRange?: LineRange;
  /** ai only: true = answer in place, chunk stays mainline; falsy = deferred to the end. */
  inline?: boolean;
  createdAt: string;
  /** The ai answer, filled by the worker. */
  answer?: string;
  answerStatus?: DeferralAnswerStatus;
  answerError?: string;
  answeredAt?: string;
}

/** The reviewer-authored fields of a POST — the answer fields are server-filled. */
export type DeferralRequest = Pick<Deferral, 'id' | 'chunkId' | 'kind' | 'text' | 'lineRange' | 'inline'>;

export interface DeferralStoreFile {
  version: 1;
  base: string;
  head: string;
  deferrals: Deferral[];
}

export function emptyDeferralStore(base: string, head: string): DeferralStoreFile {
  return { version: 1, base, head, deferrals: [] };
}
