import {
  type Book,
  bookFingerprint,
  chapterOrderFingerprint,
  type Chunk,
  type ChunkGraph,
  type CompileChapterBookInput,
  type ImportGraph,
  isOverlayFresh,
  type StoryConfig,
} from '@code-story/core';
import { CHAPTER_ORDER_PROMPT_VERSION, ORDER_PROMPT_VERSION } from './order-prompt.js';
import { loadOverlay, type OrderJobRecord, saveJson } from './order-store.js';
import { OrderJobError, runChapterOrderJob, runOrderJob } from './order-job.js';
import type { GlueInvoke, GlueOutcome, GlueTask, ModelTier } from './glue/types.js';

export const ORDER_KIND = 'order';

/** The compile artifacts one ordering run needs — re-read each run so a recompile is picked up. */
export interface OrderTaskInputs {
  book: Book;
  chunks: Chunk[];
  graph: ImportGraph;
  /** Chapter mode only: the recompose inputs `runChapterOrderJob` feeds back into the pre-gate. */
  chunkGraph?: ChunkGraph;
  storyComposition?: string[][];
  chapterInput?: CompileChapterBookInput;
  config?: StoryConfig;
}

export interface OrderTaskDeps {
  tier: ModelTier;
  chapterMode: boolean;
  /** Overlay + job-record store paths (byte-compatible with the pre-glue contract). */
  orderFile: string;
  jobFile: string;
  /** A getter so the daemon's per-POST `body.model` override is read at run time. */
  model: () => string;
  getInputs: () => Promise<OrderTaskInputs>;
  /** Test seam (server `orderInvoke`): a raw one-shot invoke that bypasses the glue invoker/ledger. */
  rawInvoke?: (prompt: string) => Promise<string>;
}

/**
 * The AI ordering glue task (spec 07 G4): the whole book is one startup-lane unit. run() wraps a
 * single `runOrderJob`/`runChapterOrderJob` attempt, then owns the three relocations the survey
 * named — it writes the overlay `saveJson` (the daemon/CLI did this), returns the retry taxonomy as
 * a `GlueOutcome` (the scheduler's failed set replaces `failedFingerprints`), and keeps the
 * `.order-job.json` lifecycle (running → done/failed) so `GET /api/order`'s `job` field and its
 * orphan resolution stay byte-compatible. The internal retry loop is gone: the scheduler re-runs
 * run() on a retryable outcome.
 */
export function createOrderTask(deps: OrderTaskDeps): GlueTask<void> {
  const promptVersion = deps.chapterMode ? CHAPTER_ORDER_PROMPT_VERSION : ORDER_PROMPT_VERSION;

  return {
    kind: ORDER_KIND,
    tier: deps.tier,
    priority: 'startup',

    plan: async () => {
      const { book, storyComposition } = await deps.getInputs();
      // Key the glue unit off the same freshness key the overlay carries, so a pure testPlacement
      // flip (which leaves the key stable, #130) is neither re-deduped as new nor parked in the
      // failed set under a different fingerprint.
      const fingerprint =
        deps.chapterMode && storyComposition ? chapterOrderFingerprint(book.headSha, storyComposition) : bookFingerprint(book);
      return [{ key: 'book', fingerprint }];
    },

    // The same predicate `shouldAutoKickOrder` used to gate the auto-kick: a fresh overlay ⇒ done.
    isFresh: async () => {
      const [overlay, { book, storyComposition }] = await Promise.all([loadOverlay(deps.orderFile), deps.getInputs()]);
      return overlay !== null && isOverlayFresh(book, overlay, storyComposition);
    },

    run: async (unit, invoke): Promise<GlueOutcome<void>> => {
      const model = deps.model();
      const record: OrderJobRecord = {
        version: 1,
        status: 'running',
        model,
        promptVersion,
        startedAt: new Date().toISOString(),
      };
      await saveJson(deps.jobFile, record);

      const oneShot =
        deps.rawInvoke ??
        (async (prompt: string) =>
          (await invoke({ prompt, tier: deps.tier as Exclude<ModelTier, 'none'>, model, kind: ORDER_KIND, unitKey: unit.key })).text);

      try {
        const inputs = await deps.getInputs();
        const overlay =
          deps.chapterMode && inputs.chapterInput
            ? await runChapterOrderJob({
                book: inputs.book,
                chunks: inputs.chunks,
                graph: inputs.graph,
                model,
                invoke: oneShot,
                input: inputs.chapterInput,
                config: inputs.config!,
                chunkGraph: inputs.chunkGraph ?? { edges: [] },
                storyComposition: inputs.storyComposition ?? [],
              })
            : await runOrderJob({
                book: inputs.book,
                graph: inputs.graph,
                chunks: inputs.chunks,
                model,
                invoke: oneShot,
              });
        await saveJson(deps.orderFile, overlay);
        await saveJson(deps.jobFile, { ...record, status: 'done', finishedAt: new Date().toISOString() });
        return { status: 'done', out: undefined };
      } catch (e) {
        const failure = e instanceof OrderJobError ? e.failure : 'transient';
        await saveJson(deps.jobFile, {
          ...record,
          status: 'failed',
          finishedAt: new Date().toISOString(),
          error: (e as Error).message,
        });
        return { status: failure, error: (e as Error).message };
      }
    },
  };
}
