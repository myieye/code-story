import { type Chunk, chunkFile, type Deferral, type FileContents, type FileDiff } from '@code-story/core';
import { describe, expect, test } from 'vitest';
import { createDeferralTask, type DeferralChunkInput } from './deferral-task.js';
import type { GlueInvoke } from './glue/types.js';

/** One real chunk with fetchable content so the prompt carries a non-empty diff. */
function fileChunk(file: string): DeferralChunkInput {
  const lines = Array.from({ length: 40 }, (_, i) => `${file} line ${i + 1}`);
  const diff: FileDiff = { path: file, status: 'modified', binary: false, hunks: [{ baseStart: 3, baseCount: 2, headStart: 3, headCount: 2 }] };
  const chunk = chunkFile({ diff, lines, baseLines: lines })[0]!;
  return { chunk, contents: { head: lines, base: lines } };
}

const env = (obj: unknown): { text: string } => ({ text: JSON.stringify({ result: JSON.stringify(obj) }) });

/** A store harness: an in-memory deferral list plus a task whose saveAnswer mutates it (the server's chain). */
function harness(deferrals: Deferral[], chunk?: DeferralChunkInput) {
  const c = chunk ?? fileChunk('a.ts');
  const task = createDeferralTask({
    tier: 'top',
    loadDeferrals: async () => deferrals,
    getChunk: async (id) => (id === c.chunk.id ? c : undefined),
    saveAnswer: async (id, patch) => {
      const d = deferrals.find((x) => x.id === id);
      if (d) Object.assign(d, patch);
    },
  });
  return { task, chunk: c, deferrals };
}

function aiDeferral(chunk: Chunk, over: Partial<Deferral> = {}): Deferral {
  return { id: 'd1', chunkId: chunk.id, kind: 'ai', text: 'Does this handle null?', createdAt: '2026-07-20T00:00:00Z', ...over };
}

describe('deferral task — plan & isFresh', () => {
  test('one unit per unanswered ai deferral (notes and terminal ones excluded)', async () => {
    const { chunk } = fileChunkHarness();
    const deferrals: Deferral[] = [
      aiDeferral(chunk, { id: 'pending' }),
      aiDeferral(chunk, { id: 'note', kind: 'note' }),
      aiDeferral(chunk, { id: 'done', answerStatus: 'done', answer: 'x' }),
      aiDeferral(chunk, { id: 'failed', answerStatus: 'failed' }),
      aiDeferral(chunk, { id: 'running', answerStatus: 'running' }),
    ];
    const { task } = harness(deferrals, { chunk, contents: undefined });
    const units = await task.plan();
    expect(units.map((u) => u.key).sort()).toEqual(['pending', 'running']);
    expect(units[0]!.fingerprint).toBe(units[0]!.key);
  });

  test('isFresh true for terminal or deleted, false while pending', async () => {
    const c = fileChunk('a.ts');
    const deferrals = [aiDeferral(c.chunk, { id: 'p' }), aiDeferral(c.chunk, { id: 'done', answerStatus: 'done' })];
    const { task } = harness(deferrals, c);
    expect(await task.isFresh({ key: 'p', fingerprint: 'p' })).toBe(false);
    expect(await task.isFresh({ key: 'done', fingerprint: 'done' })).toBe(true);
    expect(await task.isFresh({ key: 'ghost', fingerprint: 'ghost' })).toBe(true);
  });
});

describe('deferral task — run', () => {
  test('a valid answer is stored done with a timestamp', async () => {
    const c = fileChunk('a.ts');
    const deferrals = [aiDeferral(c.chunk)];
    const { task } = harness(deferrals, c);
    const invoke: GlueInvoke = async () => env({ answer: 'The new path checks null before the sort.' });
    const outcome = await task.run({ key: 'd1', fingerprint: 'd1' }, invoke);
    expect(outcome.status).toBe('done');
    expect(deferrals[0]!.answerStatus).toBe('done');
    expect(deferrals[0]!.answer).toBe('The new path checks null before the sort.');
    expect(deferrals[0]!.answeredAt).toBeDefined();
  });

  test('an empty reply is re-asked once, then fails open (recorded, queue not parked)', async () => {
    const c = fileChunk('a.ts');
    const deferrals = [aiDeferral(c.chunk)];
    const { task } = harness(deferrals, c);
    let calls = 0;
    const invoke: GlueInvoke = async () => {
      calls++;
      return calls === 1 ? env({ answer: '' }) : env({ answer: 'Look at the guard on line 12.' });
    };
    await task.run({ key: 'd1', fingerprint: 'd1' }, invoke);
    expect(calls).toBe(2);
    expect(deferrals[0]!.answer).toBe('Look at the guard on line 12.');
  });

  test('two empty replies fail open to failed — always a scheduler `done` (fail-open per deferral)', async () => {
    const c = fileChunk('a.ts');
    const deferrals = [aiDeferral(c.chunk)];
    const { task } = harness(deferrals, c);
    const invoke: GlueInvoke = async () => env({ answer: '   ' });
    const outcome = await task.run({ key: 'd1', fingerprint: 'd1' }, invoke);
    expect(outcome.status).toBe('done');
    expect(deferrals[0]!.answerStatus).toBe('failed');
    expect(deferrals[0]!.answerError).toBeDefined();
  });

  test('a spawn throw is re-asked once then failed', async () => {
    const c = fileChunk('a.ts');
    const deferrals = [aiDeferral(c.chunk)];
    const { task } = harness(deferrals, c);
    let calls = 0;
    const invoke: GlueInvoke = async () => {
      calls++;
      throw new Error('spawn failed');
    };
    await task.run({ key: 'd1', fingerprint: 'd1' }, invoke);
    expect(calls).toBe(2);
    expect(deferrals[0]!.answerStatus).toBe('failed');
  });

  test('a missing chunk fails the deferral without invoking', async () => {
    const c = fileChunk('a.ts');
    const deferrals = [aiDeferral(c.chunk, { chunkId: 'gone::x::1' })];
    const { task } = harness(deferrals, c);
    let called = false;
    const invoke: GlueInvoke = async () => {
      called = true;
      return env({ answer: 'x' });
    };
    await task.run({ key: 'd1', fingerprint: 'd1' }, invoke);
    expect(called).toBe(false);
    expect(deferrals[0]!.answerStatus).toBe('failed');
  });

  test('a deleted deferral is a no-op done', async () => {
    const c = fileChunk('a.ts');
    const { task } = harness([], c);
    const invoke: GlueInvoke = async () => env({ answer: 'x' });
    expect((await task.run({ key: 'gone', fingerprint: 'gone' }, invoke)).status).toBe('done');
  });
});

/** Shared chunk for the plan test above (avoids re-deriving it inline). */
function fileChunkHarness() {
  return fileChunk('a.ts');
}
