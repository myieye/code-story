import type { ChunkGraph } from './chunk-graph.js';
import type { ContextPayload } from './context.js';
import type { Deferral } from './deferral.js';
import type { ImportGraph } from './import-graph.js';
import type { Book, Chunk } from './model.js';
import type { NarrationOverlay } from './narration.js';
import type { AnyOrderOverlay } from './order.js';
import type { UnifiedLine } from './render.js';
import type { StoryConfig } from './story-config.js';

/**
 * The daemon↔web contract for `GET /api/book`. Both sides compile against this one type so the
 * payload can't drift silently. (`GET/PATCH /api/review` use ReviewFile/ReviewPatch the same way.)
 */
export interface BookResponse {
  base: string;
  head: string;
  book: Book;
  chunks: Chunk[];
  /**
   * The story config this `book` was compiled under (#114). `GET /api/book` reads optional
   * `direction`/`testPlacement` query params and echoes the resolved config here so the web knows
   * the active order (and the launch config on first load) without a second endpoint. Only `book`
   * (and `aiBook`) depend on it — `chunks`/`diffs`/`graph`/`chunkGraph` are config-independent.
   */
  config: StoryConfig;
  /** Chunk id → its render-ready unified diff rows. */
  diffs: Record<string, UnifiedLine[]>;
  /** Changed-files import graph — applyOrderOverlay needs it web-side (spec 02). */
  graph: ImportGraph;
  /**
   * The chunk relatedness graph (spec 05) — edges drive the neighbor strip. Empty `edges` in file
   * mode or whenever the graph failed to build: the strip simply doesn't render (fail-open).
   */
  chunkGraph: ChunkGraph;
  /**
   * The chapter book recomposed with a fresh v2 order overlay applied (spec 05, #77). Set only in
   * chapter mode when the stored overlay is v2 and applies cleanly — the web can't recompose a
   * chapter book itself (it has no chunk graph), so the server does it per request. Absent in file
   * mode and whenever no fresh v2 overlay exists.
   */
  aiBook?: Book;
  /**
   * Book-level links supplied at daemon launch — the PR page, GitHub's Files-changed tab, and a
   * locally running build of the PR's app. Config-independent (same across every direction/
   * testPlacement recompile); absent when the launcher passed no link flags.
   */
  links?: {
    pr?: string;
    filesChanged?: string;
    app?: { url: string; label?: string };
  };
}

/** `GET /api/order`: the persisted AI order overlay (null when absent or stale) + job state. */
export interface OrderResponse {
  overlay: AnyOrderOverlay | null;
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

/**
 * `GET /api/deferrals`: every deferral for this range (spec 06 slice 6). `POST` echoes the one
 * stored record; `DELETE /api/deferrals/:id` removes one. Resolution reuses `PATCH /api/review`.
 */
export interface DeferralsResponse {
  deferrals: Deferral[];
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
  /**
   * Chunk narration v2 (spec 06 slice 5): per-chunk line + badge, fresh-filtered from the separate
   * v2 overlay. Absent when no v2 overlay exists — the v1 `overlay` fields are unchanged.
   */
  chunkEntries?: Record<string, { line?: string; badge?: string }>;
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
