import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { BookResponse, ContextResponse, ContextStoreFile } from '@code-story/core';
import { afterAll, describe, expect, test } from 'vitest';
import { contextFilePath } from './context-store.js';
import { originUrl, type ResolvedRange, rootCommit } from './git.js';
import { repoIdFrom } from './review-store.js';
import { startServer } from './server.js';

const dataHome = await mkdtemp(path.join(tmpdir(), 'cs-ctx-home-'));
const repo = await mkdtemp(path.join(tmpdir(), 'cs-ctx-repo-'));
afterAll(() => Promise.all([rm(dataHome, { recursive: true, force: true }), rm(repo, { recursive: true, force: true })]));

const git = (...a: string[]) => execFileSync('git', a, { cwd: repo }).toString().trim();

// util.ts is committed at base and never touched again — the reviewer can only meet formatName
// through the context panel. consumer.ts is the one file in the diff.
await writeFile(
  path.join(repo, 'util.ts'),
  'export function formatName(first: string, last: string): string {\n  return `${last}, ${first}`;\n}\n',
);
await writeFile(path.join(repo, 'consumer.ts'), 'export function greet() {\n  return "hi";\n}\n');
git('init', '-q');
git('config', 'user.email', 'test@example.com');
git('config', 'user.name', 'test');
git('add', '.');
git('commit', '-q', '-m', 'base');
await writeFile(
  path.join(repo, 'consumer.ts'),
  "import { formatName } from './util';\n\nexport function greet(first: string, last: string): string {\n  return 'Hi ' + formatName(first, last);\n}\n",
);
git('commit', '-qam', 'head');
const range: ResolvedRange = { base: git('rev-parse', 'HEAD~1'), head: git('rev-parse', 'HEAD') };

async function getBook(url: string): Promise<BookResponse> {
  return (await (await fetch(`${url}/api/book`)).json()) as BookResponse;
}
async function getContext(url: string, chunkId: string): Promise<ContextResponse> {
  return (await (await fetch(`${url}/api/context?chunk=${encodeURIComponent(chunkId)}`)).json()) as ContextResponse;
}

/** The consumer chunk that actually calls formatName (its own line is in a separate import-fragment chunk). */
async function consumerCallChunkId(url: string): Promise<string> {
  const book = await getBook(url);
  for (const chunk of book.chunks.filter((c) => c.file === 'consumer.ts')) {
    const body = await getContext(url, chunk.id);
    if (body.payload?.facts.definitions.some((d) => d.symbol === 'formatName')) return chunk.id;
  }
  throw new Error('no consumer.ts chunk resolved formatName');
}

describe('context server', () => {
  test('GET /api/context resolves an unchanged-file util and persists the payload', async () => {
    const server = await startServer({ repo, range, dataHome, autoOrder: false }, 0);
    try {
      const chunkId = await consumerCallChunkId(server.url);
      const body = await getContext(server.url, chunkId);
      const def = body.payload?.facts.definitions.find((d) => d.symbol === 'formatName');
      expect(def).toBeDefined();
      expect(def!.file).toBe('util.ts');
      expect(def!.changed).toBe(false);
      expect(def!.body).toContain('function formatName');

      const repoId = repoIdFrom(repo, await rootCommit(repo), await originUrl(repo));
      const stored = JSON.parse(await readFile(contextFilePath(dataHome, repoId, range), 'utf8')) as ContextStoreFile;
      expect(stored.payloads[chunkId]?.facts.definitions.some((d) => d.symbol === 'formatName')).toBe(true);
    } finally {
      server.close();
    }
  });

  test('a warm cache serves the persisted payload on the next GET', async () => {
    const server = await startServer({ repo, range, dataHome, autoOrder: false }, 0);
    try {
      const chunkId = await consumerCallChunkId(server.url);
      const first = await getContext(server.url, chunkId);
      const second = await getContext(server.url, chunkId);
      expect(second.payload?.generatedAt).toBe(first.payload?.generatedAt);
    } finally {
      server.close();
    }
  });

  test('an unknown chunk id yields a null payload, never an error', async () => {
    const server = await startServer({ repo, range, dataHome, autoOrder: false }, 0);
    try {
      const body = await getContext(server.url, 'nope::x::1');
      expect(body.payload).toBeNull();
    } finally {
      server.close();
    }
  });

  test('a missing chunk query parameter is a 400', async () => {
    const server = await startServer({ repo, range, dataHome, autoOrder: false }, 0);
    try {
      const res = await fetch(`${server.url}/api/context`);
      expect(res.status).toBe(400);
    } finally {
      server.close();
    }
  });
});
