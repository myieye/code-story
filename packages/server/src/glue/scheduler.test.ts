import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import type { GlueInvoker } from './invoker.js';
import { GlueLedger } from './ledger.js';
import { createModelPolicy } from './model-policy.js';
import { GlueScheduler, type GlueSchedulerDeps } from './scheduler.js';
import type { GlueOutcome, GluePriority, GlueTask, GlueUnit } from './types.js';

const dirs: string[] = [];
afterAll(() => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))));

// Fake tasks never touch the invoker (they return scripted outcomes), so a stub suffices.
const stubInvoker: GlueInvoker = { forRun: () => async () => ({ text: '' }) };

async function makeScheduler(over?: Partial<GlueSchedulerDeps>): Promise<GlueScheduler> {
  const dir = await mkdtemp(path.join(tmpdir(), 'cs-glue-sched-'));
  dirs.push(dir);
  return new GlueScheduler({
    invoker: stubInvoker,
    ledger: new GlueLedger(path.join(dir, 'l.jsonl')),
    policy: createModelPolicy(),
    enabled: true,
    delay: () => Promise.resolve(),
    ...over,
  });
}

const tick = () => new Promise((r) => setTimeout(r, 0));
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

interface ScriptedCfg {
  kind: string;
  priority: GluePriority;
  units?: GlueUnit[];
  outcomes?: GlueOutcome<unknown>[];
  isFresh?: (u: GlueUnit) => boolean | Promise<boolean>;
  onRun?: (u: GlueUnit) => Promise<void> | void;
  log?: string[];
}
type Scripted = GlueTask<unknown> & { runs: number };

function scriptedTask(cfg: ScriptedCfg): Scripted {
  const outcomes = cfg.outcomes ?? [{ status: 'done', out: null }];
  let i = 0;
  const task: Scripted = {
    kind: cfg.kind,
    tier: 'top',
    priority: cfg.priority,
    runs: 0,
    plan: async () => cfg.units ?? [{ key: cfg.kind, fingerprint: cfg.kind }],
    isFresh: async (u) => (cfg.isFresh ? cfg.isFresh(u) : false),
    run: async (u) => {
      task.runs += 1;
      cfg.log?.push(cfg.kind);
      await cfg.onRun?.(u);
      const outcome = outcomes[Math.min(i, outcomes.length - 1)]!;
      i += 1;
      return outcome;
    },
  };
  return task;
}

describe('glue scheduler — lanes', () => {
  test('the interactive lane runs while the background lane is busy', async () => {
    const log: string[] = [];
    const gate = deferred();
    const sched = await makeScheduler();
    sched.register(scriptedTask({ kind: 'bg', priority: 'bulk', onRun: () => gate.promise, log }));
    sched.register(scriptedTask({ kind: 'int', priority: 'interactive', log }));

    await sched.kick('bg');
    await tick();
    await sched.kick('int');
    await tick();

    // The interactive unit completed even though background is still parked on its gate.
    expect(log).toContain('int');
    gate.resolve();
    await tick();
    expect(log).toEqual(['bg', 'int']);
  });

  test('background lane runs startup before bulk, FIFO within a priority', async () => {
    const log: string[] = [];
    const gate = deferred();
    const sched = await makeScheduler();
    sched.register(scriptedTask({ kind: 'occ', priority: 'startup', onRun: () => gate.promise, log }));
    sched.register(scriptedTask({ kind: 's1', priority: 'startup', log }));
    sched.register(scriptedTask({ kind: 's2', priority: 'startup', log }));
    sched.register(scriptedTask({ kind: 'b', priority: 'bulk', log }));

    await sched.kick('occ');
    await tick();
    // b is kicked before s1/s2 to prove priority beats insertion order.
    await sched.kick('b');
    await sched.kick('s1');
    await sched.kick('s2');
    gate.resolve();
    await tick();

    expect(log).toEqual(['occ', 's1', 's2', 'b']);
  });
});

describe('glue scheduler — dedupe & failed set', () => {
  test('a running unit is not enqueued again', async () => {
    const gate = deferred();
    const sched = await makeScheduler();
    const task = scriptedTask({ kind: 'order', priority: 'startup', onRun: () => gate.promise });
    sched.register(task);

    await sched.kick('order');
    await tick();
    const second = await sched.kick('order');
    expect(second.enqueued).toEqual([]);
    expect(second.skipped).toEqual(['order']);
    expect(second.running).toBe(true);

    gate.resolve();
    await tick();
    expect(task.runs).toBe(1);
  });

  test('a fresh unit is skipped by plan()+isFresh()', async () => {
    const sched = await makeScheduler();
    const task = scriptedTask({ kind: 'order', priority: 'startup', isFresh: () => true });
    sched.register(task);
    const r = await sched.kick('order');
    await tick();
    expect(r.enqueued).toEqual([]);
    expect(task.runs).toBe(0);
  });

  test('a failed unit is not re-kicked without force; force bypasses the failed set', async () => {
    const sched = await makeScheduler();
    const task = scriptedTask({ kind: 'order', priority: 'startup', outcomes: [{ status: 'refused', error: 'too big' }] });
    sched.register(task);

    await sched.kick('order');
    await tick();
    expect(task.runs).toBe(1);

    const auto = await sched.kick('order');
    await tick();
    expect(auto.skipped).toEqual(['order']);
    expect(task.runs).toBe(1);

    const forced = await sched.kick('order', { force: true });
    await tick();
    expect(forced.enqueued).toEqual(['order']);
    expect(task.runs).toBe(2);
  });

  test('disabled: non-forced kicks enqueue nothing, force still runs', async () => {
    const sched = await makeScheduler({ enabled: false });
    const task = scriptedTask({ kind: 'order', priority: 'startup' });
    sched.register(task);

    const off = await sched.kick('order');
    await tick();
    expect(off.enqueued).toEqual([]);
    expect(task.runs).toBe(0);

    await sched.kick('order', { force: true });
    await tick();
    expect(task.runs).toBe(1);
  });
});

describe('glue scheduler — retry taxonomy', () => {
  const failedCount = async (sched: GlueScheduler, kind: string) =>
    (await sched.status()).tasks.find((t) => t.kind === kind)?.failed ?? -1;
  const doneCount = async (sched: GlueScheduler, kind: string) =>
    (await sched.status()).tasks.find((t) => t.kind === kind)?.done ?? -1;

  test('transient: initial + 2 backed-off retries, then failed set', async () => {
    const sched = await makeScheduler();
    const task = scriptedTask({ kind: 'order', priority: 'startup', outcomes: [{ status: 'transient', error: 'spawn' }] });
    sched.register(task);
    await sched.kick('order');
    await tick();
    expect(task.runs).toBe(3);
    expect(await failedCount(sched, 'order')).toBe(1);
    // Parked in the failed set: a non-forced re-kick is skipped.
    expect((await sched.kick('order')).skipped).toEqual(['order']);
  });

  test('invalid-output: one retry, then failed', async () => {
    const sched = await makeScheduler();
    const task = scriptedTask({ kind: 'order', priority: 'startup', outcomes: [{ status: 'invalid-output', error: 'bad' }] });
    sched.register(task);
    await sched.kick('order');
    await tick();
    expect(task.runs).toBe(2);
    expect(await failedCount(sched, 'order')).toBe(1);
  });

  test('invalid-output that succeeds on retry counts as done', async () => {
    const sched = await makeScheduler();
    const task = scriptedTask({
      kind: 'order',
      priority: 'startup',
      outcomes: [{ status: 'invalid-output', error: 'bad' }, { status: 'done', out: null }],
    });
    sched.register(task);
    await sched.kick('order');
    await tick();
    expect(task.runs).toBe(2);
    expect(await doneCount(sched, 'order')).toBe(1);
  });

  test('refused: no retry', async () => {
    const sched = await makeScheduler();
    const task = scriptedTask({ kind: 'order', priority: 'startup', outcomes: [{ status: 'refused', error: 'guard' }] });
    sched.register(task);
    await sched.kick('order');
    await tick();
    expect(task.runs).toBe(1);
    expect(await failedCount(sched, 'order')).toBe(1);
  });

  test('gate-failed: no retry, not parked in the failed set', async () => {
    const sched = await makeScheduler();
    const task = scriptedTask({
      kind: 'narration',
      priority: 'bulk',
      outcomes: [{ status: 'gate-failed', failures: ['register'] }],
    });
    sched.register(task);
    await sched.kick('narration');
    await tick();
    expect(task.runs).toBe(1);
    expect(await failedCount(sched, 'narration')).toBe(0);
    // Not in the failed set: an auto re-kick runs it again (task state, not scheduler, gates re-runs).
    await sched.kick('narration');
    await tick();
    expect(task.runs).toBe(2);
  });

  test('a kick during a transient backoff sees running and does not double-enqueue', async () => {
    const backoff = deferred();
    const sched = await makeScheduler({ delay: () => backoff.promise });
    const task = scriptedTask({
      kind: 'order',
      priority: 'startup',
      outcomes: [{ status: 'transient', error: 'spawn' }, { status: 'done', out: null }],
    });
    sched.register(task);

    await sched.kick('order');
    await tick(); // run #1 returned transient; now parked in the injected backoff delay.

    const during = await sched.kick('order');
    expect(during.enqueued).toEqual([]);
    expect(during.running).toBe(true);

    backoff.resolve();
    await tick();
    expect(task.runs).toBe(2);
  });
});

describe('glue scheduler — shutdown', () => {
  test('shutdown stops new kicks and flushes', async () => {
    const sched = await makeScheduler();
    const task = scriptedTask({ kind: 'order', priority: 'startup' });
    sched.register(task);
    await sched.shutdown();
    const r = await sched.kick('order');
    expect(r.enqueued).toEqual([]);
    expect(task.runs).toBe(0);
  });
});
