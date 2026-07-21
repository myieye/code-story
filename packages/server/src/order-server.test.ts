import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FILE_MODE_STORY_CONFIG, type OrderResponse } from '@code-story/core';
import { afterAll, describe, expect, test } from 'vitest';
import { originUrl, type ResolvedRange, rootCommit } from './git.js';
import { type OrderJobRecord, orderJobFilePath, saveJson } from './order-store.js';
import { repoIdFrom } from './review-store.js';
import { startServer } from './server.js';

const dataHome = await mkdtemp(path.join(tmpdir(), 'cs-order-home-'));
const repo = await mkdtemp(path.join(tmpdir(), 'cs-order-repo-'));
afterAll(() =>
  Promise.all([rm(dataHome, { recursive: true, force: true }), rm(repo, { recursive: true, force: true })]),
);

const git = (...a: string[]) => execFileSync('git', a, { cwd: repo }).toString().trim();
const files = ['a.ts', 'b.ts', 'c.ts'];
for (const f of files) await writeFile(path.join(repo, f), 'export const x = 0;\n');
git('init', '-q');
git('config', 'user.email', 'test@example.com');
git('config', 'user.name', 'test');
git('add', '.');
git('commit', '-q', '-m', 'base');
for (const f of files) await writeFile(path.join(repo, f), `export const x = 0;\nexport function ${f[0]}fn() {\n  return x + 1;\n}\n`);
git('commit', '-qam', 'head');
const range: ResolvedRange = { base: git('rev-parse', 'HEAD~1'), head: git('rev-parse', 'HEAD') };

// The rendered manifest lists one `<key> [<role>]` line per story section; echoing those keys in
// order is always a valid permutation (tier-0 order), so the stub never re-breaks dependencies.
const echoOrderInvoke = async (prompt: string) => {
  const keys = [...prompt.matchAll(/^(\S+) \[(?:impl|test|periphery)\]/gm)].map((m) => m[1]);
  return JSON.stringify({ result: JSON.stringify({ order: keys, rationales: {} }) });
};

const getOrder = async (url: string): Promise<OrderResponse> =>
  (await (await fetch(`${url}/api/order`)).json()) as OrderResponse;

async function waitForTerminal(url: string): Promise<OrderResponse> {
  for (let i = 0; i < 300; i++) {
    const body = await getOrder(url);
    if (body.job?.status === 'done' || body.job?.status === 'failed') return body;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('order job did not finish');
}

// These #71 auto-kick tests drive the v1 (file-mode) order path — the echo invoke speaks the v1
// section manifest — so they pin file mode explicitly; the default is now chapter mode (#77).
describe('order server auto-kick (#71)', () => {
  test('default-on: the daemon runs the ordering job on startup and lands a fresh overlay', async () => {
    const server = await startServer({ repo, range, dataHome, storyConfig: FILE_MODE_STORY_CONFIG, orderInvoke: echoOrderInvoke }, 0);
    try {
      const body = await waitForTerminal(server.url);
      expect(body.job?.status).toBe('done');
      const overlay = body.overlay;
      expect(overlay?.version).toBe(1);
      expect([...(overlay?.version === 1 ? overlay.permutation : [])].sort()).toEqual([...files].sort());

      // File mode serves the old shape: no chapter recomposition on /api/book.
      const book = (await (await fetch(`${server.url}/api/book`)).json()) as { aiBook?: unknown };
      expect(book.aiBook).toBeUndefined();
    } finally {
      server.close();
    }
  });

  // G4 route-compat: POST codes derive from the scheduler (started vs already-running), byte-stable.
  test('POST /api/order-job is 202 to start, 200 while that job is still running', async () => {
    const home = await mkdtemp(path.join(tmpdir(), 'cs-order-post-'));
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const gated = async (prompt: string) => {
      await gate;
      return echoOrderInvoke(prompt);
    };
    const server = await startServer(
      { repo, range, dataHome: home, autoOrder: false, storyConfig: FILE_MODE_STORY_CONFIG, orderInvoke: gated },
      0,
    );
    try {
      const first = await fetch(`${server.url}/api/order-job`, { method: 'POST' });
      expect(first.status).toBe(202);
      const second = await fetch(`${server.url}/api/order-job`, { method: 'POST' });
      expect(second.status).toBe(200);
      release();
      const body = await waitForTerminal(server.url);
      expect(body.job?.status).toBe('done');
    } finally {
      server.close();
      await rm(home, { recursive: true, force: true });
    }
  });

  // G4 route-compat: a persisted running record with no scheduler activity reads as an orphan.
  test('a persisted running record with no live job reads as failed (orphan)', async () => {
    const home = await mkdtemp(path.join(tmpdir(), 'cs-order-orphan-'));
    const repoId = repoIdFrom(repo, await rootCommit(repo), await originUrl(repo));
    const orphan: OrderJobRecord = {
      version: 1,
      status: 'running',
      model: 'test-model',
      promptVersion: 'order-1',
      startedAt: new Date().toISOString(),
    };
    await saveJson(orderJobFilePath(home, repoId, range), orphan);
    const server = await startServer({ repo, range, dataHome: home, autoOrder: false }, 0);
    try {
      const body = await getOrder(server.url);
      expect(body.job?.status).toBe('failed');
      expect(body.job?.error).toContain('orphaned');
    } finally {
      server.close();
      await rm(home, { recursive: true, force: true });
    }
  });

  test('--no-ai-order (autoOrder: false) never kicks a job', async () => {
    const solo = await mkdtemp(path.join(tmpdir(), 'cs-order-home2-'));
    let invoked = false;
    const server = await startServer(
      { repo, range, dataHome: solo, autoOrder: false, storyConfig: FILE_MODE_STORY_CONFIG, orderInvoke: async (p) => ((invoked = true), echoOrderInvoke(p)) },
      0,
    );
    try {
      // Give any (erroneous) background kick time to fire before asserting it did not.
      await new Promise((r) => setTimeout(r, 150));
      const body = await getOrder(server.url);
      expect(body.job).toBeFalsy();
      expect(body.overlay).toBeNull();
      expect(invoked).toBe(false);
    } finally {
      server.close();
      await rm(solo, { recursive: true, force: true });
    }
  });
});
