import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { BookResponse } from '@code-story/core';
import { afterAll, describe, expect, test } from 'vitest';
import type { ResolvedRange } from './git.js';
import { startServer } from './server.js';

// a.ts calls b.ts calls c.ts — a consumer-first chain so the default chapter linearizer produces
// chapter sections, while file mode falls back to one section per file path.
const dataHome = await mkdtemp(path.join(tmpdir(), 'cs-cfg-home-'));
const repo = await mkdtemp(path.join(tmpdir(), 'cs-cfg-repo-'));
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

const getBook = async (url: string, query = ''): Promise<BookResponse> =>
  (await (await fetch(`${url}/api/book${query}`)).json()) as BookResponse;

describe('config-aware /api/book (#114)', () => {
  test('no params serves the default chapter book; file-mode params serve file-path sections', async () => {
    const server = await startServer({ repo, range, dataHome, autoOrder: false }, 0);
    try {
      const chapter = await getBook(server.url);
      expect(chapter.config).toEqual({ direction: 'consumer-first', testPlacement: 'before' });
      expect(chapter.book.sections.some((s) => s.id.startsWith('chapter:'))).toBe(true);

      const fileMode = await getBook(server.url, '?direction=dependency-first&testPlacement=after');
      expect(fileMode.config).toEqual({ direction: 'dependency-first', testPlacement: 'after' });
      expect(fileMode.book.sections.some((s) => s.id.startsWith('chapter:'))).toBe(false);
      expect(fileMode.book.sections.map((s) => s.id)).toEqual(expect.arrayContaining(['a.ts', 'b.ts', 'c.ts']));

      // Config-independent payloads are identical across configs (only the book differs).
      expect(fileMode.chunks.map((ch) => ch.id).sort()).toEqual(chapter.chunks.map((ch) => ch.id).sort());
    } finally {
      server.close();
    }
  });

  test('an unknown axis value is ignored, not fatal (falls back to the launch config)', async () => {
    const server = await startServer({ repo, range, dataHome, autoOrder: false }, 0);
    try {
      const book = await getBook(server.url, '?direction=sideways&testPlacement=whenever');
      expect(book.config).toEqual({ direction: 'consumer-first', testPlacement: 'before' });
    } finally {
      server.close();
    }
  });
});
