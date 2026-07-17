import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { OrderResponse } from '@code-story/core';
import { afterAll, describe, expect, test } from 'vitest';
import { type ResolvedRange } from './git.js';
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

describe('order server auto-kick (#71)', () => {
  test('default-on: the daemon runs the ordering job on startup and lands a fresh overlay', async () => {
    const server = await startServer({ repo, range, dataHome, orderInvoke: echoOrderInvoke }, 0);
    try {
      const body = await waitForTerminal(server.url);
      expect(body.job?.status).toBe('done');
      expect([...(body.overlay?.permutation ?? [])].sort()).toEqual([...files].sort());
    } finally {
      server.close();
    }
  });

  test('--no-ai-order (autoOrder: false) never kicks a job', async () => {
    const solo = await mkdtemp(path.join(tmpdir(), 'cs-order-home2-'));
    let invoked = false;
    const server = await startServer(
      { repo, range, dataHome: solo, autoOrder: false, orderInvoke: async (p) => ((invoked = true), echoOrderInvoke(p)) },
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
