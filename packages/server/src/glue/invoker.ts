import { mkdir } from 'node:fs/promises';
import { invokeClaudeJsonWithUsage } from '../claude-cli.js';
import type { GlueLedger } from './ledger.js';
import type { ModelPolicy } from './model-policy.js';
import type { GlueInvoke, GlueLane, GlueUsage } from './types.js';

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

/** The raw spawn the invoker drives. The one v1 impl wraps `claude -p`; tests script it. */
export type GlueSpawn = (req: {
  prompt: string;
  model: string;
  timeoutMs: number;
}) => Promise<{ text: string; usage?: GlueUsage }>;

export interface GlueInvokerDeps {
  policy: ModelPolicy;
  ledger: GlueLedger;
  /** The subprocess cwd: the data home, never the reviewed repo (no unreviewed side channel). */
  cwd: string;
  spawn?: GlueSpawn;
  now?: () => number;
}

export interface GlueInvoker {
  forRun(ctx: { lane: GlueLane; signal?: AbortSignal }): GlueInvoke;
}

/**
 * The single choke point every spawn passes through: tier→model resolution, the spawn, and one
 * ledger entry per attempt (ok or error). On shutdown the run's AbortSignal fires and the invoke
 * rejects with the abort ledgered; the child is left to its own timeout rather than force-killed
 * (v1-simple, spec 07 "let the child time out").
 */
export function createGlueInvoker(deps: GlueInvokerDeps): GlueInvoker {
  const now = deps.now ?? Date.now;
  const spawn = deps.spawn ?? defaultSpawn(deps.cwd);
  return {
    forRun({ lane, signal }) {
      return async (req) => {
        const model = deps.policy.resolve(req.tier);
        const startedAt = now();
        const record = (outcome: 'ok' | 'error', usage?: GlueUsage) =>
          deps.ledger.append({
            ts: new Date().toISOString(),
            kind: req.kind,
            unitKey: req.unitKey,
            lane,
            tier: req.tier,
            model,
            durationMs: now() - startedAt,
            outcome,
            ...(usage ? { usage } : {}),
          });
        try {
          const result = await withAbort(
            spawn({ prompt: req.prompt, model, timeoutMs: req.timeoutMs ?? DEFAULT_TIMEOUT_MS }),
            signal,
          );
          record('ok', result.usage);
          return { text: result.text, ...(result.usage ? { usage: result.usage } : {}) };
        } catch (e) {
          record('error');
          throw e;
        }
      };
    },
  };
}

function withAbort<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work;
  if (signal.aborted) return Promise.reject(new Error('glue invoke aborted'));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error('glue invoke aborted'));
    signal.addEventListener('abort', onAbort, { once: true });
    work.then(
      (v) => {
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener('abort', onAbort);
        reject(e);
      },
    );
  });
}

function defaultSpawn(cwd: string): GlueSpawn {
  // A fresh install has no data home yet; spawning with a missing cwd dies instantly (ENOENT).
  let ensured: Promise<void> | undefined;
  return async ({ prompt, model, timeoutMs }) => {
    ensured ??= mkdir(cwd, { recursive: true }).then(() => undefined);
    await ensured;
    return invokeClaudeJsonWithUsage(prompt, model, cwd, timeoutMs);
  };
}
