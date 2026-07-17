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
