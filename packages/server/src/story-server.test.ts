import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { BookResponse, ChangelogResponse, CreateStoryResponse, StoriesResponse } from '@code-story/core';
import { afterAll, describe, expect, test } from 'vitest';
import type { ResolvedRange } from './git.js';
import { startServer } from './server.js';

const dataHome = await mkdtemp(path.join(tmpdir(), 'cs-lib-home-'));
const repo = await mkdtemp(path.join(tmpdir(), 'cs-lib-repo-'));
afterAll(() => Promise.all([rm(dataHome, { recursive: true, force: true }), rm(repo, { recursive: true, force: true })]));

const git = (...a: string[]) => execFileSync('git', a, { cwd: repo }).toString().trim();
git('init', '-q');
git('config', 'user.email', 'test@example.com');
git('config', 'user.name', 'test');
await writeFile(path.join(repo, 'a.ts'), 'export const a = 1;\n');
git('add', '.');
git('commit', '-q', '-m', 'c0');
await writeFile(path.join(repo, 'a.ts'), 'export const a = 2;\n');
git('commit', '-qam', 'c1');
await writeFile(path.join(repo, 'b.ts'), 'export const b = 1;\n');
git('add', '.');
git('commit', '-qam', 'c2');

const c0 = git('rev-parse', 'HEAD~2');
const c1 = git('rev-parse', 'HEAD~1');
const c2 = git('rev-parse', 'HEAD');
const rangeA: ResolvedRange = { base: c0, head: c1 };

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

describe('story library endpoints', () => {
  test('changelog, create, list, open switch the active range in place', async () => {
    const server = await startServer({ repo, range: rangeA, rangeLabel: `${c0}..${c1}`, dataHome, autoOrder: false }, 0);
    try {
      const changelog = await json<ChangelogResponse>(await fetch(`${server.url}/api/changelog`));
      expect(changelog.version).toBe('1.0.0');
      expect(changelog.entries[0]!.version).toBe('1.0.0');

      // Empty range → 400, no story created.
      const empty = await fetch(`${server.url}/api/stories`, {
        method: 'POST',
        body: JSON.stringify({ range: `${c1}..${c1}` }),
      });
      expect(empty.status).toBe(400);

      // Create a story for range B (c1..c2).
      const created = await fetch(`${server.url}/api/stories`, {
        method: 'POST',
        body: JSON.stringify({ range: `${c1}..${c2}` }),
      });
      expect(created.status).toBe(201);
      const { id: idB } = await json<CreateStoryResponse>(created);
      expect(idB).toMatch(/^\d{8}T\d{9}-/);

      // Creating switched the active range to B — the book now shows b.ts.
      const bookB = await json<BookResponse>(await fetch(`${server.url}/api/book`));
      expect(bookB.head).toBe(c2);
      expect(bookB.chunks.some((ch) => ch.file === 'b.ts')).toBe(true);

      // The library lists the created story and marks B active.
      let stories = await json<StoriesResponse>(await fetch(`${server.url}/api/stories`));
      expect(stories.stories.map((s) => s.id)).toContain(idB);
      expect(stories.activeRange).toBe(`${c1}..${c2}`);
      const storyB = stories.stories.find((s) => s.id === idB)!;
      expect(storyB.toolVersion).toBe('1.0.0');
      expect(storyB.config.direction).toBe('consumer-first');

      // Re-creating the same range+config reuses the id (update in place, not a duplicate).
      const again = await fetch(`${server.url}/api/stories`, {
        method: 'POST',
        body: JSON.stringify({ range: `${c1}..${c2}` }),
      });
      expect((await json<CreateStoryResponse>(again)).id).toBe(idB);
      stories = await json<StoriesResponse>(await fetch(`${server.url}/api/stories`));
      expect(stories.stories.filter((s) => s.id === idB)).toHaveLength(1);

      // Open the story back — but first we need a story record for range A. Create it, then open B, then A.
      const createdA = await fetch(`${server.url}/api/stories`, {
        method: 'POST',
        body: JSON.stringify({ range: `${c0}..${c1}` }),
      });
      const { id: idA } = await json<CreateStoryResponse>(createdA);

      const opened = await fetch(`${server.url}/api/stories/open`, { method: 'POST', body: JSON.stringify({ id: idB }) });
      expect(opened.status).toBe(200);
      const activeAfterOpen = await json<StoriesResponse>(await fetch(`${server.url}/api/stories`));
      expect(activeAfterOpen.activeRange).toBe(`${c1}..${c2}`);
      expect(idA).not.toBe(idB);

      // Opening an unknown story → 404.
      const missing = await fetch(`${server.url}/api/stories/open`, { method: 'POST', body: JSON.stringify({ id: 'nope' }) });
      expect(missing.status).toBe(404);
    } finally {
      await server.shutdownGlue();
      server.close();
    }
  });
});
