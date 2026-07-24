import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  type Chunk,
  chunkFile,
  chunkNarrationFingerprint,
  type FileContents,
  type FileDiff,
  type NarrationOverlayV2,
} from '@code-story/core';
import { afterAll, describe, expect, test } from 'vitest';
import { CHUNK_NARRATION_KIND, createChunkNarrationTask } from './chunk-narration-task.js';
import { CHUNK_NARRATION_PROMPT_VERSION } from './narration-prompt.js';
import type { GlueInvoke } from './glue/types.js';

const dirs: string[] = [];
afterAll(() => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))));
async function overlayFile(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'cs-chunknarr-'));
  dirs.push(dir);
  return path.join(dir, 'x.narration-chunks.json');
}

/** One chunk per file, real diff text, so buildChunkNarrationBatch renders a non-empty diff. */
function fileChunk(file: string, low = false): { chunk: Chunk; contents: FileContents } {
  const lines = Array.from({ length: 60 }, (_, i) => `${file} line ${i + 1} content`);
  const diff: FileDiff = { path: file, status: 'modified', binary: false, hunks: [{ baseStart: 3, baseCount: 2, headStart: 3, headCount: 2 }] };
  const chunks = chunkFile({ diff, lines, baseLines: lines });
  const chunk = low ? { ...chunks[0]!, changeTypes: ['generated' as const] } : chunks[0]!;
  return { chunk, contents: { head: lines, base: lines } };
}

const HEAD = 'headsha';
const env = (obj: unknown) => ({ text: JSON.stringify({ result: JSON.stringify(obj) }) });

async function makeTask(chunks: Chunk[], contents: Map<string, FileContents>, file?: string) {
  return createChunkNarrationTask({
    headSha: HEAD,
    tier: 'top',
    model: 'opus',
    overlayFile: file ?? (await overlayFile()),
    getInputs: async () => ({ chunks, contents }),
  });
}

async function readOverlay(file: string): Promise<NarrationOverlayV2> {
  return JSON.parse(await readFile(file, 'utf8')) as NarrationOverlayV2;
}

describe('chunk-narration task — plan & fingerprint', () => {
  test('one unit per file with narratable chunks, sorted; low-signal-only files excluded', async () => {
    const a = fileChunk('a.ts');
    const b = fileChunk('b.ts');
    const stub = fileChunk('gen.ts', true);
    const contents = new Map([['a.ts', a.contents], ['b.ts', b.contents], ['gen.ts', stub.contents]]);
    const task = await makeTask([b.chunk, a.chunk, stub.chunk], contents);
    const units = await task.plan();
    expect(units.map((u) => u.key)).toEqual(['a.ts', 'b.ts']);
    expect(units[0]!.fingerprint).not.toBe(units[1]!.fingerprint);
  });

  test('unit fingerprint is stable and content-sensitive', async () => {
    const a = fileChunk('a.ts');
    const contents = new Map([['a.ts', a.contents]]);
    const stable = (await (await makeTask([a.chunk], contents)).plan())[0]!.fingerprint;
    expect((await (await makeTask([a.chunk], contents)).plan())[0]!.fingerprint).toBe(stable);
    const changed = { ...a.chunk, id: `${a.chunk.id}X` };
    expect((await (await makeTask([changed], contents)).plan())[0]!.fingerprint).not.toBe(stable);
  });
});

describe('chunk-narration task — isFresh', () => {
  test('false with no overlay, true once every member chunk is present, false on model mismatch', async () => {
    const a = fileChunk('a.ts');
    const file = await overlayFile();
    const task = await makeTask([a.chunk], new Map([['a.ts', a.contents]]), file);
    const [unit] = await task.plan();
    expect(await task.isFresh(unit!)).toBe(false);

    const invoke: GlueInvoke = async () => env({ c1: { line: 'Check the guard here.' } });
    await task.run(unit!, invoke);
    expect(await task.isFresh(unit!)).toBe(true);

    // A different model can't reuse the stored entries.
    const otherModel = createChunkNarrationTask({
      headSha: HEAD,
      tier: 'top',
      model: 'sonnet',
      overlayFile: file,
      getInputs: async () => ({ chunks: [a.chunk], contents: new Map([['a.ts', a.contents]]) }),
    });
    expect(await otherModel.isFresh(unit!)).toBe(false);
  });
});

describe('chunk-narration task — run', () => {
  test('aliases round-trip and a passing line + badge persist', async () => {
    const a = fileChunk('a.ts');
    const file = await overlayFile();
    const task = await makeTask([a.chunk], new Map([['a.ts', a.contents]]), file);
    const [unit] = await task.plan();
    const invoke: GlueInvoke = async () => env({ c1: { line: 'Check the guard on the new path.', badge: 'New guard' } });

    const outcome = await task.run(unit!, invoke);
    expect(outcome.status).toBe('done');
    const overlay = await readOverlay(file);
    expect(overlay.version).toBe(2);
    expect(overlay.model).toBe('opus');
    expect(overlay.promptVersion).toBe(CHUNK_NARRATION_PROMPT_VERSION);
    const entry = overlay.chunks[a.chunk.id]!;
    expect(entry.line).toBe('Check the guard on the new path.');
    expect(entry.badge).toBe('New guard');
    expect(entry.fingerprint).toBe(chunkNarrationFingerprint(HEAD, a.chunk.id));
  });

  test('a judgmental line is dropped and recorded, but a clean badge survives ("faithful or silent")', async () => {
    const a = fileChunk('a.ts');
    const file = await overlayFile();
    const task = await makeTask([a.chunk], new Map([['a.ts', a.contents]]), file);
    const [unit] = await task.plan();
    // "looks good" is a banned phrase; the re-ask returns the same, so the line is dropped.
    const invoke: GlueInvoke = async () => env({ c1: { line: 'This looks good to me.', badge: 'Minor refactor' } });

    await task.run(unit!, invoke);
    const entry = (await readOverlay(file)).chunks[a.chunk.id]!;
    expect(entry.line).toBeUndefined();
    expect(entry.badge).toBe('Minor refactor');
    expect(entry.gateFailures?.some((f) => f.startsWith('line:'))).toBe(true);
  });

  test('a shouting badge is dropped but the line survives', async () => {
    const a = fileChunk('a.ts');
    const file = await overlayFile();
    const task = await makeTask([a.chunk], new Map([['a.ts', a.contents]]), file);
    const [unit] = await task.plan();
    const invoke: GlueInvoke = async () => env({ c1: { line: 'Check the retry path.', badge: 'Big REFACTORING' } });

    await task.run(unit!, invoke);
    const entry = (await readOverlay(file)).chunks[a.chunk.id]!;
    expect(entry.line).toBe('Check the retry path.');
    expect(entry.badge).toBeUndefined();
    expect(entry.gateFailures?.some((f) => f.startsWith('badge:'))).toBe(true);
  });

  test('a clean review note persists (R-068)', async () => {
    const a = fileChunk('a.ts');
    const file = await overlayFile();
    const task = await makeTask([a.chunk], new Map([['a.ts', a.contents]]), file);
    const [unit] = await task.plan();
    const note = 'The two switches must agree; cross-check the added case against the resolver below.';
    const invoke: GlueInvoke = async () => env({ c1: { badge: 'New guard', note } });

    await task.run(unit!, invoke);
    const entry = (await readOverlay(file)).chunks[a.chunk.id]!;
    expect(entry.reviewNote).toBe(note);
    expect(entry.badge).toBe('New guard');
  });

  test('a reassuring review note is dropped and recorded, but the badge survives', async () => {
    const a = fileChunk('a.ts');
    const file = await overlayFile();
    const task = await makeTask([a.chunk], new Map([['a.ts', a.contents]]), file);
    const [unit] = await task.plan();
    // "correctly" is a banned phrase; the re-ask returns the same, so the note is dropped.
    const invoke: GlueInvoke = async () => env({ c1: { badge: 'Minor refactor', note: 'This handles nulls correctly.' } });

    await task.run(unit!, invoke);
    const entry = (await readOverlay(file)).chunks[a.chunk.id]!;
    expect(entry.reviewNote).toBeUndefined();
    expect(entry.badge).toBe('Minor refactor');
    expect(entry.gateFailures?.some((f) => f.startsWith('note:'))).toBe(true);
  });

  test('a foreign alias rejects the whole reply as invalid-output', async () => {
    const a = fileChunk('a.ts');
    const task = await makeTask([a.chunk], new Map([['a.ts', a.contents]]));
    const [unit] = await task.plan();
    const invoke: GlueInvoke = async () => env({ c9: { line: 'nope' } });
    expect((await task.run(unit!, invoke)).status).toBe('invalid-output');
  });

  test('an invoke throw is a transient outcome (the scheduler backs off)', async () => {
    const a = fileChunk('a.ts');
    const task = await makeTask([a.chunk], new Map([['a.ts', a.contents]]));
    const [unit] = await task.plan();
    const invoke: GlueInvoke = async () => {
      throw new Error('spawn failed');
    };
    expect((await task.run(unit!, invoke)).status).toBe('transient');
  });

  test('load-merge-save preserves another file batch already in the overlay', async () => {
    const a = fileChunk('a.ts');
    const b = fileChunk('b.ts');
    const contents = new Map([['a.ts', a.contents], ['b.ts', b.contents]]);
    const file = await overlayFile();
    const task = await makeTask([a.chunk, b.chunk], contents, file);
    const units = await task.plan();
    const invoke: GlueInvoke = async () => env({ c1: { badge: 'New endpoint' } });

    await task.run(units.find((u) => u.key === 'a.ts')!, invoke);
    await task.run(units.find((u) => u.key === 'b.ts')!, invoke);
    const overlay = await readOverlay(file);
    expect(Object.keys(overlay.chunks).sort()).toEqual([a.chunk.id, b.chunk.id].sort());
    expect(overlay.chunks[a.chunk.id]!.badge).toBe('New endpoint');
    expect(overlay.chunks[b.chunk.id]!.badge).toBe('New endpoint');
  });

  test('a sparse reply still produces an entry per member so the unit reads fresh', async () => {
    const a = fileChunk('a.ts');
    const file = await overlayFile();
    const task = await makeTask([a.chunk], new Map([['a.ts', a.contents]]), file);
    const [unit] = await task.plan();
    const invoke: GlueInvoke = async () => env({});
    await task.run(unit!, invoke);
    expect((await readOverlay(file)).chunks[a.chunk.id]).toBeDefined();
    expect(await task.isFresh(unit!)).toBe(true);
  });
});
