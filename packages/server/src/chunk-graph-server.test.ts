import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { BookResponse } from '@code-story/core';
import { afterAll, describe, expect, test } from 'vitest';
import type { ResolvedRange } from './git.js';
import { startServer } from './server.js';

// a.ts calls b.ts calls c.ts — real cross-file call edges so the chunk graph has a spine to expose.
const dataHome = await mkdtemp(path.join(tmpdir(), 'cs-cg-home-'));
const repo = await mkdtemp(path.join(tmpdir(), 'cs-cg-repo-'));
afterAll(() =>
  Promise.all([rm(dataHome, { recursive: true, force: true }), rm(repo, { recursive: true, force: true })]),
);

const git = (...a: string[]) => execFileSync('git', a, { cwd: repo }).toString().trim();
for (const f of ['a.ts', 'b.ts', 'c.ts']) await writeFile(path.join(repo, f), 'export const x = 0;\n');
git('init', '-q');
git('config', 'user.email', 'test@example.com');
git('config', 'user.name', 'test');
git('add', '.');
git('commit', '-q', '-m', 'base');
await writeFile(path.join(repo, 'c.ts'), 'export function cfn() {\n  return 1;\n}\n');
await writeFile(path.join(repo, 'b.ts'), "import { cfn } from './c';\nexport function bfn() {\n  return cfn();\n}\n");
await writeFile(path.join(repo, 'a.ts'), "import { bfn } from './b';\nexport function afn() {\n  return bfn();\n}\n");
git('commit', '-qam', 'head');
const range: ResolvedRange = { base: git('rev-parse', 'HEAD~1'), head: git('rev-parse', 'HEAD') };

describe('/api/book chunk graph (#78)', () => {
  test('exposes chunkGraph edges the neighbor strip renders from', async () => {
    // autoOrder:false so the book compile never spawns a real claude subprocess.
    const server = await startServer({ repo, range, dataHome, autoOrder: false }, 0);
    try {
      const book = (await (await fetch(`${server.url}/api/book`)).json()) as BookResponse;
      expect(book.chunkGraph).toBeDefined();
      expect(Array.isArray(book.chunkGraph.edges)).toBe(true);
      expect(book.chunkGraph.edges.some((e) => e.kind === 'calls')).toBe(true);
      // Every edge endpoint is a real book chunk — the strip can navigate to each.
      const ids = new Set(book.chunks.map((c) => c.id));
      for (const e of book.chunkGraph.edges) {
        expect(ids.has(e.from)).toBe(true);
        expect(ids.has(e.to)).toBe(true);
      }
    } finally {
      server.close();
    }
  });
});
