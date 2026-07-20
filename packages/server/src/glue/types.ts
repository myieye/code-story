/**
 * Shapes for the AI glue pipeline (spec 07). One task registry, one scheduler, one invoker, one
 * ledger — the concrete implementations live beside this file. Types only here.
 */

/** `none` = a script task that never invokes a model (context payloads, R-024). */
export type ModelTier = 'top' | 'mid' | 'cheap' | 'none';

export type GluePriority = 'interactive' | 'startup' | 'bulk';

export type GlueLane = 'interactive' | 'background';

export interface GlueUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd?: number;
}

export interface GlueUnit {
  /** Stable id within the task, e.g. a file path, deferral id, or 'book'. */
  key: string;
  /** Freshness/dedupe/failed-set key, computed at plan() time without running the unit. */
  fingerprint: string;
}

export type GlueOutcome<Out> =
  | { status: 'done'; out: Out }
  /** Recorded on the task's persisted state; the scheduler does not retry it. */
  | { status: 'gate-failed'; failures: string[] }
  | { status: 'refused' | 'invalid-output' | 'transient'; error: string };

export type GlueInvoke = (req: {
  prompt: string;
  tier: Exclude<ModelTier, 'none'>;
  timeoutMs?: number;
  kind: string;
  unitKey: string;
}) => Promise<{ text: string; usage?: GlueUsage }>;

export interface GlueTask<Out> {
  kind: string;
  /** May be overridden per config; 'none' means the task never invokes a model. */
  tier: ModelTier;
  priority: GluePriority;
  /** Enumerate work; already-fresh units are dropped by the scheduler via isFresh(). */
  plan(): Promise<GlueUnit[]>;
  isFresh(unit: GlueUnit): Promise<boolean>;
  run(unit: GlueUnit, invoke: GlueInvoke): Promise<GlueOutcome<Out>>;
}

/** One line per actual `claude` spawn, written by the invoker (task-internal re-asks included). */
export interface GlueLedgerEntry {
  ts: string;
  kind: string;
  unitKey: string;
  lane: GlueLane;
  tier: ModelTier;
  model: string;
  promptVersion?: string;
  durationMs: number;
  /** Spawn-level; unit-level outcomes (done/gate-failed/…) live on task-persisted state. */
  outcome: 'ok' | 'error';
  usage?: GlueUsage;
}

export interface GlueSpend {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd?: number;
}

export interface GlueTaskStatus {
  kind: string;
  lane: GlueLane;
  queued: number;
  running: number;
  done: number;
  failed: number;
  model: string;
}

export interface GlueStatus {
  tasks: GlueTaskStatus[];
  spend: GlueSpend;
}

export function laneForPriority(priority: GluePriority): GlueLane {
  return priority === 'interactive' ? 'interactive' : 'background';
}
