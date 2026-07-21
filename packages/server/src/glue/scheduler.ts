import type { GlueInvoker } from './invoker.js';
import type { GlueLedger } from './ledger.js';
import type { ModelPolicy } from './model-policy.js';
import {
  type GlueLane,
  type GluePriority,
  type GlueStatus,
  type GlueTask,
  type GlueTaskStatus,
  type GlueUnit,
  laneForPriority,
} from './types.js';

const TRANSIENT_BACKOFF_MS = [2000, 4000];
const PRIORITY_RANK: Record<GluePriority, number> = { interactive: 0, startup: 1, bulk: 2 };

export interface KickResult {
  kind: string;
  enqueued: string[];
  skipped: string[];
  running: boolean;
}

export interface GlueSchedulerDeps {
  invoker: GlueInvoker;
  ledger: GlueLedger;
  policy: ModelPolicy;
  /** `glue:false` (aliases `autoOrder:false`) — non-forced kicks enqueue nothing. */
  enabled: boolean;
  /** Injectable for deterministic retry tests (no fake timers interleaving with fs writes). */
  delay?: (ms: number) => Promise<void>;
  now?: () => number;
}

interface QueuedUnit {
  kind: string;
  unit: GlueUnit;
  priority: GluePriority;
  seq: number;
}

interface TaskCounters {
  done: number;
  failed: number;
}

/**
 * Two single-flight lanes (interactive, background), FIFO within a lane ordered startup-before-bulk.
 * Dedupes by (kind, fingerprint) across queued + running + a per-lifetime failed set; `kick(kind,
 * {force})` bypasses the failed set for on-demand POSTs. The retry taxonomy lives here, not in each
 * task; `running` spans the whole run() including backoff sleeps.
 */
export class GlueScheduler {
  private readonly tasks = new Map<string, GlueTask<unknown>>();
  private readonly queues: Record<GlueLane, QueuedUnit[]> = { interactive: [], background: [] };
  private readonly laneBusy: Record<GlueLane, boolean> = { interactive: false, background: false };
  private readonly queuedKeys = new Set<string>();
  private readonly runningKeys = new Set<string>();
  private readonly failed = new Set<string>();
  private readonly counters = new Map<string, TaskCounters>();
  private readonly runningByKind = new Map<string, number>();
  private readonly inFlight = new Set<Promise<void>>();
  private readonly abort = new AbortController();
  private seq = 0;
  private shuttingDown = false;

  constructor(private readonly deps: GlueSchedulerDeps) {}

  register(task: GlueTask<unknown>): void {
    this.tasks.set(task.kind, task);
    this.counter(task.kind);
  }

  async kick(kind: string, opts?: { force?: boolean }): Promise<KickResult> {
    const force = opts?.force ?? false;
    const result: KickResult = { kind, enqueued: [], skipped: [], running: this.isRunning(kind) };
    const task = this.tasks.get(kind);
    if (!task || this.shuttingDown) return result;
    if (!this.deps.enabled && !force) return result;

    for (const unit of await task.plan()) {
      const key = keyOf(kind, unit.fingerprint);
      if (this.queuedKeys.has(key) || this.runningKeys.has(key)) {
        result.skipped.push(unit.key);
        continue;
      }
      if (this.failed.has(key) && !force) {
        result.skipped.push(unit.key);
        continue;
      }
      if (await task.isFresh(unit)) {
        result.skipped.push(unit.key);
        continue;
      }
      // Re-check across the isFresh() await: another kick may have enqueued or started this unit.
      if (this.queuedKeys.has(key) || this.runningKeys.has(key)) {
        result.skipped.push(unit.key);
        continue;
      }
      if (force) this.failed.delete(key);
      this.queuedKeys.add(key);
      this.queues[laneForPriority(task.priority)].push({ kind, unit, priority: task.priority, seq: this.seq++ });
      result.enqueued.push(unit.key);
    }

    result.running = this.isRunning(kind);
    this.pump('interactive');
    this.pump('background');
    return result;
  }

  async status(): Promise<GlueStatus> {
    const spend = await this.deps.ledger.spend();
    const tasks: GlueTaskStatus[] = [];
    for (const task of this.tasks.values()) {
      const lane = laneForPriority(task.priority);
      const c = this.counter(task.kind);
      tasks.push({
        kind: task.kind,
        lane,
        queued: this.queues[lane].filter((q) => q.kind === task.kind).length,
        running: this.runningByKind.get(task.kind) ?? 0,
        done: c.done,
        failed: c.failed,
        model: task.tier === 'none' ? 'none' : this.deps.policy.resolve(task.tier),
      });
    }
    return { tasks, spend };
  }

  /**
   * Queued + running unit counts for one kind. The per-job GET routes derive "is this job active?"
   * (running or waiting behind a sibling in its lane) from this — one source of truth for orphan
   * resolution, instead of a separate per-job `running` flag.
   */
  activity(kind: string): { queued: number; running: number } {
    const task = this.tasks.get(kind);
    const lane = task ? laneForPriority(task.priority) : 'background';
    return {
      queued: this.queues[lane].filter((q) => q.kind === kind).length,
      running: this.runningByKind.get(kind) ?? 0,
    };
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    this.abort.abort();
    await Promise.allSettled([...this.inFlight]);
    await this.deps.ledger.flush();
  }

  private isRunning(kind: string): boolean {
    return (this.runningByKind.get(kind) ?? 0) > 0;
  }

  private pump(lane: GlueLane): void {
    if (this.laneBusy[lane] || this.shuttingDown) return;
    const next = this.dequeue(lane);
    if (!next) return;
    this.laneBusy[lane] = true;
    const p = this.runUnit(lane, next).finally(() => {
      this.laneBusy[lane] = false;
      this.inFlight.delete(p);
      this.pump(lane);
    });
    this.inFlight.add(p);
  }

  /** Highest priority (startup before bulk) then FIFO by insertion order. */
  private dequeue(lane: GlueLane): QueuedUnit | undefined {
    const q = this.queues[lane];
    if (q.length === 0) return undefined;
    let bestIdx = 0;
    for (let i = 1; i < q.length; i++) {
      const a = q[i]!;
      const best = q[bestIdx]!;
      if (
        PRIORITY_RANK[a.priority] < PRIORITY_RANK[best.priority] ||
        (PRIORITY_RANK[a.priority] === PRIORITY_RANK[best.priority] && a.seq < best.seq)
      ) {
        bestIdx = i;
      }
    }
    const [picked] = q.splice(bestIdx, 1);
    this.queuedKeys.delete(keyOf(picked!.kind, picked!.unit.fingerprint));
    return picked;
  }

  private async runUnit(lane: GlueLane, queued: QueuedUnit): Promise<void> {
    const task = this.tasks.get(queued.kind);
    if (!task) return;
    const key = keyOf(queued.kind, queued.unit.fingerprint);
    this.runningKeys.add(key);
    this.runningByKind.set(queued.kind, (this.runningByKind.get(queued.kind) ?? 0) + 1);
    const invoke = this.deps.invoker.forRun({ lane, signal: this.abort.signal });
    const delay = this.deps.delay ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
    try {
      let transientLeft = TRANSIENT_BACKOFF_MS.length;
      let invalidLeft = 1;
      for (;;) {
        if (this.abort.signal.aborted) return;
        const outcome = await task.run(queued.unit, invoke);
        switch (outcome.status) {
          case 'done':
            this.counter(queued.kind).done += 1;
            return;
          // gate-failed is a per-unit outcome the task persists; not a scheduler failure, no retry.
          case 'gate-failed':
            return;
          case 'refused':
            this.markFailed(key, queued.kind);
            return;
          case 'invalid-output':
            if (invalidLeft > 0) {
              invalidLeft -= 1;
              continue;
            }
            this.markFailed(key, queued.kind);
            return;
          case 'transient':
            if (transientLeft === 0) {
              this.markFailed(key, queued.kind);
              return;
            }
            await delay(TRANSIENT_BACKOFF_MS[TRANSIENT_BACKOFF_MS.length - transientLeft]!);
            transientLeft -= 1;
            continue;
        }
      }
    } finally {
      this.runningKeys.delete(key);
      this.runningByKind.set(queued.kind, (this.runningByKind.get(queued.kind) ?? 1) - 1);
    }
  }

  // Terminal failures (refused, exhausted invalid-output, exhausted transient) park in the failed
  // set — generalizing #71's failedFingerprints so a broken CLI can't retry-storm on auto-kick.
  private markFailed(key: string, kind: string): void {
    this.failed.add(key);
    this.counter(kind).failed += 1;
  }

  private counter(kind: string): TaskCounters {
    let c = this.counters.get(kind);
    if (!c) {
      c = { done: 0, failed: 0 };
      this.counters.set(kind, c);
    }
    return c;
  }
}

function keyOf(kind: string, fingerprint: string): string {
  return `${kind}::${fingerprint}`;
}
