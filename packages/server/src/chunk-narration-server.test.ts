import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { NarrationResponse } from '@code-story/core';
import { afterAll, describe, expect, test } from 'vitest';
import type { GlueSpawn } from './glue/invoker.js';
import { type ResolvedRange } from './git.js';
import { startServer } from './server.js';

const dataHome = await mkdtemp(path.join(tmpdir(), 'cs-cn-home-'));
const repo = await mkdtemp(path.join(tmpdir(), 'cs-cn-repo-'));
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

const spawnReply = (obj: unknown) => ({ text: JSON.stringify({ result: JSON.stringify(obj) }) });

/** Counts every raw spawn the glue invoker drives; the reply labels the one chunk in the test book. */
function spySpawn(): { spawn: GlueSpawn; calls: () => number } {
  let calls = 0;
  return {
    spawn: async () => {
      calls++;
      return spawnReply({ c1: { line: 'Check the return value.', badge: 'New function' } });
    },
    calls: () => calls,
  };
}

const getNarration = async (url: string): Promise<NarrationResponse> =>
  (await (await fetch(`${url}/api/narration`)).json()) as NarrationResponse;

async function waitForChunkEntries(url: string): Promise<NarrationResponse> {
  for (let i = 0; i < 300; i++) {
    const body = await getNarration(url);
    if (body.chunkEntries && Object.keys(body.chunkEntries).length > 0) return body;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('chunk narration did not land');
}

describe('chunk-narration auto-kick gating (#125)', () => {
  test('autoOrder:false spawns zero claude children (the #71 retrofit corpus AC)', async () => {
    const spy = spySpawn();
    const server = await startServer({ repo, range, dataHome, autoOrder: false, glueInvoke: spy.spawn }, 0);
    try {
      // Give any (erroneous) background kick time to fire before asserting it did not.
      await new Promise((r) => setTimeout(r, 200));
      await getNarration(server.url);
      expect(spy.calls()).toBe(0);
      const body = await getNarration(server.url);
      expect(body.chunkEntries).toBeUndefined();
    } finally {
      server.close();
    }
  });

  test('autoNarration:false spawns zero even with the glue master switch on', async () => {
    const solo = await mkdtemp(path.join(tmpdir(), 'cs-cn-home2-'));
    const spy = spySpawn();
    // glue:true keeps the master on; autoOrder:false keeps the order job (a separate spawn path) off.
    const server = await startServer(
      { repo, range, dataHome: solo, glue: true, autoOrder: false, autoNarration: false, glueInvoke: spy.spawn },
      0,
    );
    try {
      await new Promise((r) => setTimeout(r, 200));
      await getNarration(server.url);
      expect(spy.calls()).toBe(0);
    } finally {
      server.close();
      await rm(solo, { recursive: true, force: true });
    }
  });

  test('default-on: the task auto-kicks on compile and GET /api/narration merges v2 chunkEntries', async () => {
    const solo = await mkdtemp(path.join(tmpdir(), 'cs-cn-home3-'));
    const spy = spySpawn();
    // autoOrder:false isolates the narration spawn from the order job; the glue master stays on by default.
    const server = await startServer({ repo, range, dataHome: solo, autoOrder: false, glue: true, glueInvoke: spy.spawn }, 0);
    try {
      const body = await waitForChunkEntries(server.url);
      expect(spy.calls()).toBeGreaterThan(0);
      const entry = Object.values(body.chunkEntries!)[0]!;
      expect(entry.line).toBe('Check the return value.');
      expect(entry.badge).toBe('New function');
      // The v1 overlay is untouched: no section narration was generated.
      expect(body.overlay).toBeNull();
    } finally {
      server.close();
      await rm(solo, { recursive: true, force: true });
    }
  });
});
