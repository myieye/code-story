import type { Chunk, ContextPayload } from '@code-story/core';
import { runContextJob } from './context-job.js';
import { type ContextJobRecord, saveJson } from './context-store.js';
import type { GlueOutcome, GlueTask } from './glue/types.js';

export const CONTEXT_KIND = 'context';

/** Everything one bulk fill needs, assembled by the daemon (shares the GET-on-miss save chain). */
export interface ContextFillInputs {
  eligibleChunks: Chunk[];
  /** Chunks with a fresh persisted payload — a resume skips these (per-chunk, inside runContextJob). */
  freshIds: Set<string>;
  resolve: (chunk: Chunk) => Promise<ContextPayload>;
  persist: (payload: ContextPayload) => Promise<{ persisted: boolean }>;
}

export interface ContextTaskDeps {
  headSha: string;
  /** Job-record store path (byte-compatible with the pre-glue contract). */
  jobFile: string;
  prepare: () => Promise<ContextFillInputs>;
}

/**
 * The context-payload bulk-fill glue task (spec 07 G5): tier `none` (scripts, R-024 — never invokes
 * a model), one bulk-lane unit that runs the whole fill. Per-chunk persistence + resume live inside
 * `runContextJob` (unchanged), so isFresh is always false — the fill always runs and reports
 * computed/skipped honestly; a forced POST re-runs it. run() keeps the `.context-job.json` lifecycle
 * (running → done/failed with the aggregate counts) so `GET /api/context-job` stays byte-compatible.
 * The compute-on-miss `GET /api/context` stays an inline synchronous resolve — only the bulk fill is
 * a unit.
 */
export function createContextTask(deps: ContextTaskDeps): GlueTask<number> {
  return {
    kind: CONTEXT_KIND,
    tier: 'none',
    priority: 'bulk',

    plan: async () => [{ key: 'context', fingerprint: `context:${deps.headSha}` }],
    isFresh: async () => false,

    run: async (): Promise<GlueOutcome<number>> => {
      const record: ContextJobRecord = {
        version: 1,
        status: 'running',
        startedAt: new Date().toISOString(),
        chunksTotal: 0,
        chunksDone: 0,
        computed: 0,
        skipped: 0,
        capped: false,
        cappedCount: 0,
      };
      await saveJson(deps.jobFile, record);

      try {
        const { eligibleChunks, freshIds, resolve, persist } = await deps.prepare();
        const result = await runContextJob({
          eligibleChunks,
          freshIds,
          resolve,
          persist,
          onProgress: (done, total) => {
            record.chunksDone = done;
            record.chunksTotal = total;
          },
        });
        await saveJson(deps.jobFile, { ...record, status: 'done', finishedAt: new Date().toISOString(), ...result });
        return { status: 'done', out: result.computed };
      } catch (e) {
        await saveJson(deps.jobFile, {
          ...record,
          status: 'failed',
          finishedAt: new Date().toISOString(),
          error: (e as Error).message,
        });
        return { status: 'transient', error: (e as Error).message };
      }
    },
  };
}
