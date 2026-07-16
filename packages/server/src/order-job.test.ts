import type { Book, Chunk, ImportGraph } from '@code-story/core';
import { describe, expect, test } from 'vitest';
import { OrderJobError, runOrderJob } from './order-job.js';

function chunk(file: string, stub = false): Chunk {
  return {
    id: `${file}::x::${file.length}`,
    file,
    symbolPath: ['x'],
    displayPath: ['x'],
    kind: 'other',
    changeTypes: stub ? ['generated'] : [],
    hunks: [{ baseStart: 0, baseCount: 0, headStart: 1, headCount: 3 }],
    headRange: { start: 1, end: 3 },
  };
}

// a.ts ← b.ts ← b.test.ts, p.ts free-floating (periphery), gen.ts all-stub (pinned tail).
const files = ['a.ts', 'b.ts', 'b.test.ts', 'p.ts', 'gen.ts'];
const chunks: Chunk[] = [chunk('a.ts'), chunk('b.ts'), chunk('b.test.ts'), chunk('p.ts'), chunk('gen.ts', true)];
const graph: ImportGraph = {
  edges: [
    { from: 'b.ts', to: 'a.ts' },
    { from: 'b.test.ts', to: 'b.ts' },
  ],
  unresolved: 0,
};
const book: Book = {
  headSha: 'deadbeef',
  sections: files.map((f) => ({ id: f, title: f, occurrences: [{ chunkId: `${f}::x::${f.length}`, ordinal: 0, role: 'primary' }] })),
};

const envelope = (order: string[], rationales: Record<string, string> = {}) =>
  JSON.stringify({ result: JSON.stringify({ order, rationales }) });

const base = { book, graph, chunks, model: 'test-model', cwd: '/tmp' };

describe('runOrderJob', () => {
  test('valid proposal becomes a persisted-ready overlay', async () => {
    const overlay = await runOrderJob({
      ...base,
      invoke: async () => envelope(['p.ts', 'a.ts', 'b.ts', 'b.test.ts'], { 'p.ts': 'warm-up', 'nope.ts': 'dropped' }),
    });
    expect(overlay.permutation).toEqual(['p.ts', 'a.ts', 'b.ts', 'b.test.ts']);
    expect(overlay.rationales).toEqual({ 'p.ts': 'warm-up' });
    expect(overlay.model).toBe('test-model');
    expect(overlay.bookFingerprint).not.toBe('');
  });

  test('invalid output retries once, then succeeds', async () => {
    let calls = 0;
    const overlay = await runOrderJob({
      ...base,
      invoke: async () => (++calls === 1 ? envelope(['a.ts', 'b.ts']) : envelope(['a.ts', 'b.ts', 'b.test.ts', 'p.ts'])),
    });
    expect(calls).toBe(2);
    expect(overlay.permutation).toHaveLength(4);
  });

  test('invalid output twice fails invalid-output', async () => {
    await expect(runOrderJob({ ...base, invoke: async () => envelope(['a.ts']) })).rejects.toMatchObject({
      failure: 'invalid-output',
    });
  });

  test('an order that re-breaks dependencies is invalid output', async () => {
    await expect(
      runOrderJob({ ...base, invoke: async () => envelope(['b.ts', 'a.ts', 'b.test.ts', 'p.ts']) }),
    ).rejects.toMatchObject({ failure: 'invalid-output' });
  });

  test('pinned-tail keys in the permutation are rejected', async () => {
    await expect(
      runOrderJob({ ...base, invoke: async () => envelope(['gen.ts', 'a.ts', 'b.ts', 'b.test.ts', 'p.ts']) }),
    ).rejects.toMatchObject({ failure: 'invalid-output' });
  });

  test('too few story sections refuses without invoking the model', async () => {
    const tiny: Book = { headSha: 'deadbeef', sections: book.sections.slice(0, 2) };
    let invoked = false;
    await expect(
      runOrderJob({
        ...base,
        book: tiny,
        chunks: chunks.slice(0, 2),
        invoke: async () => ((invoked = true), envelope(['a.ts', 'b.ts'])),
      }),
    ).rejects.toMatchObject({ failure: 'refused' });
    expect(invoked).toBe(false);
  });
});
