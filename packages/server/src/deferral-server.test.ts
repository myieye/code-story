import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Deferral, DeferralRequest, DeferralsResponse } from '@code-story/core';
import { afterAll, describe, expect, test } from 'vitest';
import { deferralsFilePath } from './deferral-store.js';
import { originUrl, type ResolvedRange, rootCommit } from './git.js';
import { saveJson } from './json-file.js';
import { repoIdFrom } from './review-store.js';
import { startServer } from './server.js';

const dataHome = await mkdtemp(path.join(tmpdir(), 'cs-defer-home-'));
const repo = await mkdtemp(path.join(tmpdir(), 'cs-defer-repo-'));
afterAll(() => Promise.all([rm(dataHome, { recursive: true, force: true }), rm(repo, { recursive: true, force: true })]));

const git = (...a: string[]) => execFileSync('git', a, { cwd: repo }).toString().trim();
await writeFile(path.join(repo, 'a.ts'), 'export const a = 1;\n');
git('init', '-q');
git('config', 'user.email', 'test@example.com');
git('config', 'user.name', 'test');
git('add', '.');
git('commit', '-q', '-m', 'base');
await writeFile(path.join(repo, 'a.ts'), 'export const a = 1;\nexport function foo() {\n  return a + 1;\n}\n');
git('commit', '-qam', 'head');
const range: ResolvedRange = { base: git('rev-parse', 'HEAD~1'), head: git('rev-parse', 'HEAD') };

const spawnReply = (obj: unknown): { text: string } => ({ text: JSON.stringify({ result: JSON.stringify(obj) }) });

const getDeferrals = async (url: string): Promise<Deferral[]> =>
  ((await (await fetch(`${url}/api/deferrals`)).json()) as DeferralsResponse).deferrals;

async function firstChunkId(url: string): Promise<string> {
  const book = (await (await fetch(`${url}/api/book`)).json()) as { chunks: { id: string }[] };
  return book.chunks[0]!.id;
}

async function post(url: string, req: DeferralRequest): Promise<Response> {
  return fetch(`${url}/api/deferrals`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req) });
}

async function waitForAnswer(url: string, id: string): Promise<Deferral> {
  for (let i = 0; i < 300; i++) {
    const d = (await getDeferrals(url)).find((x) => x.id === id);
    if (d && (d.answerStatus === 'done' || d.answerStatus === 'failed')) return d;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('deferral answer did not land');
}

describe('deferrals — notes', () => {
  test('POST a note is 200, GET returns it, DELETE removes it (no claude spawn)', async () => {
    let spawns = 0;
    const server = await startServer({ repo, range, dataHome, autoOrder: false, glueInvoke: async () => (spawns++, spawnReply({ answer: 'x' })) }, 0);
    try {
      const chunkId = await firstChunkId(server.url);
      const res = await post(server.url, { id: 'note1', chunkId, kind: 'note', text: 'come back to this' });
      expect(res.status).toBe(200);
      expect((await getDeferrals(server.url)).map((d) => d.id)).toEqual(['note1']);
      expect(spawns).toBe(0);

      const del = await fetch(`${server.url}/api/deferrals/note1`, { method: 'DELETE' });
      expect(del.status).toBe(200);
      expect(await getDeferrals(server.url)).toEqual([]);
      expect((await fetch(`${server.url}/api/deferrals/note1`, { method: 'DELETE' })).status).toBe(404);
    } finally {
      server.close();
    }
  });

  test('an invalid body is 400', async () => {
    const server = await startServer({ repo, range, dataHome, autoOrder: false }, 0);
    try {
      expect((await post(server.url, { kind: 'note', text: 'x' } as unknown as DeferralRequest)).status).toBe(400);
    } finally {
      server.close();
    }
  });
});

describe('deferrals — ai answers on the interactive lane', () => {
  test('POST ai is 202 and the task fills the answer (glue master switch off, force-kicked)', async () => {
    const solo = await mkdtemp(path.join(tmpdir(), 'cs-defer-ai-'));
    const server = await startServer(
      { repo, range, dataHome: solo, autoOrder: false, glueInvoke: async () => spawnReply({ answer: 'Check the null guard in foo().' }) },
      0,
    );
    try {
      const chunkId = await firstChunkId(server.url);
      const res = await post(server.url, { id: 'q1', chunkId, kind: 'ai', text: 'does foo handle null?' });
      expect(res.status).toBe(202);
      const answered = await waitForAnswer(server.url, 'q1');
      expect(answered.answerStatus).toBe('done');
      expect(answered.answer).toBe('Check the null guard in foo().');
    } finally {
      server.close();
      await rm(solo, { recursive: true, force: true });
    }
  });

  test('a concurrent DELETE and answer-arrival loses neither: the delete wins, siblings survive', async () => {
    const solo = await mkdtemp(path.join(tmpdir(), 'cs-defer-race-'));
    let releaseFirst!: () => void;
    const gate = new Promise<void>((r) => (releaseFirst = r));
    let call = 0;
    const server = await startServer(
      {
        repo,
        range,
        dataHome: solo,
        autoOrder: false,
        glueInvoke: async () => {
          if (call++ === 0) await gate; // hold the first ai answer mid-flight
          return spawnReply({ answer: 'an answer' });
        },
      },
      0,
    );
    try {
      const chunkId = await firstChunkId(server.url);
      await post(server.url, { id: 'keep', chunkId, kind: 'note', text: 'a sibling note' });
      await post(server.url, { id: 'racing', chunkId, kind: 'ai', text: 'q' });
      // `racing` is now running (its invoke is blocked on the gate). Delete it, then release the answer.
      await new Promise((r) => setTimeout(r, 50));
      expect((await fetch(`${server.url}/api/deferrals/racing`, { method: 'DELETE' })).status).toBe(200);
      releaseFirst();
      await new Promise((r) => setTimeout(r, 100));

      const deferrals = await getDeferrals(server.url);
      // The answer arrival found `racing` gone and no-op'd; the note survived intact — neither lost.
      expect(deferrals.map((d) => d.id)).toEqual(['keep']);
      expect(deferrals[0]!.text).toBe('a sibling note');
    } finally {
      server.close();
      await rm(solo, { recursive: true, force: true });
    }
  });
});

describe('deferrals — orphan rule', () => {
  test('a `running` answer with no live scheduler unit (post-restart) rewrites to failed on GET', async () => {
    const solo = await mkdtemp(path.join(tmpdir(), 'cs-defer-orphan-'));
    const repoId = repoIdFrom(repo, await rootCommit(repo), await originUrl(repo));
    const file = deferralsFilePath(solo, repoId, range);
    // Simulate a hard kill mid-answer: a `running` deferral persisted with no scheduler behind it.
    await saveJson(file, {
      version: 1,
      base: range.base,
      head: range.head,
      deferrals: [{ id: 'orphan', chunkId: 'a.ts::foo::x', kind: 'ai', text: 'q', createdAt: '2026-07-20T00:00:00Z', answerStatus: 'running' }],
    });
    const server = await startServer({ repo, range, dataHome: solo, autoOrder: false }, 0);
    try {
      const d = (await getDeferrals(server.url)).find((x) => x.id === 'orphan')!;
      expect(d.answerStatus).toBe('failed');
      expect(d.answerError).toBeDefined();
      expect(d.text).toBe('q'); // prompt preserved for Retry
    } finally {
      server.close();
      await rm(solo, { recursive: true, force: true });
    }
  });
});
