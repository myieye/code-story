import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { NarrationResponse } from '@code-story/core';
import { afterAll, describe, expect, test } from 'vitest';
import { originUrl, type ResolvedRange, rootCommit } from './git.js';
import { NARRATION_PROMPT_VERSION } from './narration-prompt.js';
import { type NarrationJobRecord, narrationJobFilePath, saveJson } from './narration-store.js';
import { repoIdFrom } from './review-store.js';
import { startServer } from './server.js';

const dataHome = await mkdtemp(path.join(tmpdir(), 'cs-narr-home-'));
const repo = await mkdtemp(path.join(tmpdir(), 'cs-narr-repo-'));
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

const envSection = (intro: string) => JSON.stringify({ result: JSON.stringify({ intro, chunks: {} }) });
const envOpener = (opener: string) => JSON.stringify({ result: JSON.stringify({ opener }) });
const stubInvoke = async (p: string) => (p.includes('opening note') ? envOpener('An opener.') : envSection('An intro.'));

async function getNarration(url: string): Promise<NarrationResponse> {
  return (await (await fetch(`${url}/api/narration`)).json()) as NarrationResponse;
}

const post = (url: string) =>
  fetch(`${url}/api/narration-job`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'test-model' }),
  });

describe('narration server', () => {
  test('a persisted running record with no live job reads as failed', async () => {
    const repoId = repoIdFrom(repo, await rootCommit(repo), await originUrl(repo));
    const orphan: NarrationJobRecord = {
      version: 1,
      status: 'running',
      model: 'opus',
      promptVersion: NARRATION_PROMPT_VERSION,
      startedAt: new Date().toISOString(),
      sectionsTotal: 1,
      sectionsDone: 0,
    };
    await saveJson(narrationJobFilePath(dataHome, repoId, range), orphan);

    const server = await startServer({ repo, range, dataHome, autoOrder: false }, 0);
    try {
      const body = await getNarration(server.url);
      expect(body.job?.status).toBe('failed');
      expect(body.job?.error).toContain('orphaned');
    } finally {
      server.close();
    }
  });

  test('a second job POST while one is in flight gets 409', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const server = await startServer(
      { repo, range, dataHome, autoOrder: false, narrationInvoke: async (p) => (await gate, stubInvoke(p)) },
      0,
    );
    try {
      expect((await post(server.url)).status).toBe(202);
      expect((await post(server.url)).status).toBe(409);
      release();
      await waitForDone(server.url);
    } finally {
      release();
      server.close();
    }
  });

  test('GET returns the fresh overlay once the job completes', async () => {
    const server = await startServer({ repo, range, dataHome, autoOrder: false, narrationInvoke: stubInvoke }, 0);
    try {
      await post(server.url);
      const body = await waitForDone(server.url);
      expect(body.job?.status).toBe('done');
      expect(body.overlay?.opener.text).toBe('An opener.');
      expect(Object.keys(body.overlay?.sections ?? {}).length).toBeGreaterThan(0);
    } finally {
      server.close();
    }
  });
});

async function waitForDone(url: string): Promise<NarrationResponse> {
  for (let i = 0; i < 200; i++) {
    const body = await getNarration(url);
    if (body.job?.status === 'done' || body.job?.status === 'failed') return body;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('narration job did not finish');
}
