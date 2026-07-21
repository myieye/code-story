import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { parseUsage } from '../claude-cli.js';
import { createGlueInvoker, type GlueSpawn } from './invoker.js';
import { GlueLedger } from './ledger.js';
import { createModelPolicy } from './model-policy.js';
import type { GlueLedgerEntry } from './types.js';

const dirs: string[] = [];
async function ledgerFile(): Promise<{ ledger: GlueLedger; read: () => Promise<GlueLedgerEntry[]> }> {
  const dir = await mkdtemp(path.join(tmpdir(), 'cs-glue-ledger-'));
  dirs.push(dir);
  const file = path.join(dir, 'reviews', 'a..b.glue-ledger.jsonl');
  const ledger = new GlueLedger(file);
  return {
    ledger,
    read: async () => {
      await ledger.flush();
      const raw = await readFile(file, 'utf8').catch(() => '');
      return raw
        .split('\n')
        .filter((l) => l.trim() !== '')
        .map((l) => JSON.parse(l) as GlueLedgerEntry);
    },
  };
}
afterAll(() => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))));

const usageEnvelope = JSON.stringify({
  result: '{"order": ["a.ts"]}',
  usage: { input_tokens: 1200, output_tokens: 340 },
  total_cost_usd: 0.0125,
});

describe('parseUsage (best-effort harvest)', () => {
  test('reads usage + total_cost_usd from a usage-bearing envelope', () => {
    expect(parseUsage(usageEnvelope)).toEqual({ inputTokens: 1200, outputTokens: 340, costUsd: 0.0125 });
  });

  test('omits usage when the envelope has none (defensive path)', () => {
    expect(parseUsage(JSON.stringify({ result: '{}' }))).toBeUndefined();
  });

  test('omits usage on partial/malformed shapes rather than throwing', () => {
    expect(parseUsage(JSON.stringify({ result: '{}', usage: { input_tokens: 5 } }))).toBeUndefined();
    expect(parseUsage('not json')).toBeUndefined();
  });

  test('drops cost alone when only total_cost_usd is absent', () => {
    const env = JSON.stringify({ result: '{}', usage: { input_tokens: 10, output_tokens: 2 } });
    expect(parseUsage(env)).toEqual({ inputTokens: 10, outputTokens: 2 });
  });
});

describe('glue invoker', () => {
  const clock = (start: number, step: number) => {
    let t = start;
    return () => {
      const now = t;
      t += step;
      return now;
    };
  };

  test('writes one ok ledger entry per spawn with model, tier, attribution and usage', async () => {
    const { ledger, read } = await ledgerFile();
    const spawn: GlueSpawn = async () => ({ text: usageEnvelope, usage: parseUsage(usageEnvelope) });
    const invoker = createGlueInvoker({ policy: createModelPolicy(), ledger, cwd: '/tmp/nope', spawn, now: clock(1000, 500) });
    const invoke = invoker.forRun({ lane: 'background' });

    const out = await invoke({ prompt: 'p', tier: 'top', kind: 'order', unitKey: 'book' });
    expect(out.text).toBe(usageEnvelope);

    const [entry, ...rest] = await read();
    expect(rest).toHaveLength(0);
    expect(entry).toMatchObject({
      kind: 'order',
      unitKey: 'book',
      lane: 'background',
      tier: 'top',
      model: 'opus',
      outcome: 'ok',
      durationMs: 500,
      usage: { inputTokens: 1200, outputTokens: 340, costUsd: 0.0125 },
    });
  });

  test('a spawn throw is ledgered as an error entry (no usage) and rethrown', async () => {
    const { ledger, read } = await ledgerFile();
    const spawn: GlueSpawn = async () => {
      throw new Error('claude exited 1');
    };
    const invoker = createGlueInvoker({ policy: createModelPolicy(), ledger, cwd: '/tmp/nope', spawn });
    const invoke = invoker.forRun({ lane: 'interactive' });

    await expect(invoke({ prompt: 'p', tier: 'mid', kind: 'deferral', unitKey: 'd1' })).rejects.toThrow('claude exited 1');
    const [entry] = await read();
    expect(entry).toMatchObject({ kind: 'deferral', lane: 'interactive', model: 'sonnet', outcome: 'error' });
    expect(entry?.usage).toBeUndefined();
  });

  test('an aborted signal rejects the invoke and ledgers the abort', async () => {
    const { ledger, read } = await ledgerFile();
    const controller = new AbortController();
    controller.abort();
    const invoker = createGlueInvoker({
      policy: createModelPolicy(),
      ledger,
      cwd: '/tmp/nope',
      spawn: async () => ({ text: '{}' }),
    });
    const invoke = invoker.forRun({ lane: 'background', signal: controller.signal });
    await expect(invoke({ prompt: 'p', tier: 'top', kind: 'order', unitKey: 'book' })).rejects.toThrow('aborted');
    expect((await read())[0]?.outcome).toBe('error');
  });

  test('ledger spend aggregates calls/tokens/cost and refreshes after a later append', async () => {
    const { ledger } = await ledgerFile();
    const spawn: GlueSpawn = async () => ({ text: usageEnvelope, usage: parseUsage(usageEnvelope) });
    const invoker = createGlueInvoker({ policy: createModelPolicy(), ledger, cwd: '/tmp/nope', spawn });
    const invoke = invoker.forRun({ lane: 'background' });

    await invoke({ prompt: 'p', tier: 'top', kind: 'order', unitKey: 'book' });
    expect(await ledger.spend()).toEqual({ calls: 1, inputTokens: 1200, outputTokens: 340, costUsd: 0.0125 });

    await invoke({ prompt: 'p', tier: 'top', kind: 'order', unitKey: 'book' });
    expect(await ledger.spend()).toEqual({ calls: 2, inputTokens: 2400, outputTokens: 680, costUsd: 0.025 });
  });
});
