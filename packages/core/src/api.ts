import type { ContextPayload } from './context.js';
import type { ImportGraph } from './import-graph.js';
import type { Book, Chunk } from './model.js';
import type { NarrationOverlay } from './narration.js';
import type { OrderOverlay } from './order.js';
import type { UnifiedLine } from './render.js';

/**
 * The daemon↔web contract for `GET /api/book`. Both sides compile against this one type so the
 * payload can't drift silently. (`GET/PATCH /api/review` use ReviewFile/ReviewPatch the same way.)
 */
export interface BookResponse {
  base: string;
  head: string;
  book: Book;
  chunks: Chunk[];
  /** Chunk id → its render-ready unified diff rows. */
  diffs: Record<string, UnifiedLine[]>;
  /** Changed-files import graph — applyOrderOverlay needs it web-side (spec 02). */
  graph: ImportGraph;
}

/** `GET /api/order`: the persisted AI order overlay (null when absent or stale) + job state. */
export interface OrderResponse {
  overlay: OrderOverlay | null;
  job: {
    status: 'running' | 'done' | 'failed';
    model: string;
    promptVersion: string;
    startedAt: string;
    finishedAt?: string;
    error?: string;
  } | null;
}

/**
 * `GET /api/context?chunk=<id>`: the chunk's facts payload, computed on miss then cached (spec 04).
 * `null` when the chunk id is unknown to this book — resolution never throws into the book flow.
 */
export interface ContextResponse {
  payload: ContextPayload | null;
}

/**
 * `GET/POST /api/context-job`: the bulk-fill job state (facts are free, so there is no overlay to
 * return — the payloads land in the store the on-demand GET reads). `job` is null before any run.
 */
export interface ContextJobResponse {
  job: {
    status: 'running' | 'done' | 'failed';
    startedAt: string;
    finishedAt?: string;
    error?: string;
    chunksTotal: number;
    chunksDone: number;
    computed: number;
    skipped: number;
    capped: boolean;
    cappedCount: number;
  } | null;
}

/** `PATCH /api/order`: the reviewer's banner decision (spec 02 — never re-ask on reload). */
export interface OrderPatch {
  applied?: boolean;
  dismissed?: boolean;
}

/**
 * `GET /api/narration`: the narration overlay filtered to sections fresh for this book (never null
 * once a job has run), plus job state. `sectionsTotal`/`sectionsDone` drive the partial-state
 * indicator (spec 03) — a partial book must read as *not narrated*, never *nothing to see*.
 */
export interface NarrationResponse {
  overlay: NarrationOverlay | null;
  job: {
    status: 'running' | 'done' | 'failed';
    model: string;
    promptVersion: string;
    startedAt: string;
    finishedAt?: string;
    error?: string;
    sectionsTotal: number;
    sectionsDone: number;
  } | null;
}
