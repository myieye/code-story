import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import type { GlueStatus } from './glue/types.js';
import { type ResolvedRange } from './git.js';
import { startServer } from './server.js';

const dataHome = await mkdtemp(path.join(tmpdir(), 'cs-glue-home-'));
const repo = await mkdtemp(path.join(tmpdir(), 'cs-glue-repo-'));
afterAll(() =>
  Promise.all([rm(dataHome, { recursive: true, force: true }), rm(repo, { recursive: true, force: true })]),
);

const git = (...a: string[]) => execFileSync('git', a, { cwd: repo }).toString().trim();
await writeFile(path.join(repo, 'a.ts'), 'export const x = 0;\n');
git('init', '-q');
git('config', 'user.email', 'test@example.com');
git('config', 'user.name', 'test');
git('add', '.');
git('commit', '-q', '-m', 'base');
await writeFile(path.join(repo, 'a.ts'), 'export const x = 1;\n');
git('commit', '-qam', 'head');
const range: ResolvedRange = { base: git('rev-parse', 'HEAD~1'), head: git('rev-parse', 'HEAD') };

describe('GET /api/glue (#124)', () => {
  test('returns an empty task list and zero spend before any task runs', async () => {
    // autoOrder:false aliases to glue:false — no glue task auto-kicks, so no claude spawns.
    const server = await startServer({ repo, range, dataHome, autoOrder: false }, 0);
    try {
      const status = (await (await fetch(`${server.url}/api/glue`)).json()) as GlueStatus;
      expect(status.tasks).toEqual([]);
      expect(status.spend).toEqual({ calls: 0, inputTokens: 0, outputTokens: 0 });
    } finally {
      server.close();
    }
  });
});
