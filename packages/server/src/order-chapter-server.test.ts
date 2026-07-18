import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { BookResponse, OrderOverlayV2, OrderResponse } from '@code-story/core';
import { afterAll, describe, expect, test } from 'vitest';
import { originUrl, type ResolvedRange, rootCommit } from './git.js';
import { orderFilePath, saveJson } from './order-store.js';
import { repoIdFrom } from './review-store.js';
import { startServer } from './server.js';

// a.ts calls b.ts calls c.ts — a consumer-first chain with real cross-file call edges, so the
// chapter linearizer has a spine to work with (the daemon's default mode).
const dataHome = await mkdtemp(path.join(tmpdir(), 'cs-chap-home-'));
const repo = await mkdtemp(path.join(tmpdir(), 'cs-chap-repo-'));
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

// Speaks the chapter protocol: pulls the aliases out of the rendered manifest and returns each as
// its own chapter, in manifest (tier-0) order — always a valid consumer-first partition.
const chapterInvoke = async (prompt: string) => {
  const aliases = [...prompt.matchAll(/^(c\d+) — /gm)].map((m) => m[1]);
  return JSON.stringify({ result: JSON.stringify({ chapters: aliases.map((a) => [a]), rationales: {} }) });
};

const getOrder = async (url: string): Promise<OrderResponse> =>
  (await (await fetch(`${url}/api/order`)).json()) as OrderResponse;
const getBook = async (url: string): Promise<BookResponse> =>
  (await (await fetch(`${url}/api/book`)).json()) as BookResponse;

async function waitForTerminal(url: string): Promise<OrderResponse> {
  for (let i = 0; i < 300; i++) {
    const body = await getOrder(url);
    if (body.job?.status === 'done' || body.job?.status === 'failed') return body;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('order job did not finish');
}

async function seedStaleOverlay(): Promise<string> {
  const repoId = repoIdFrom(repo, await rootCommit(repo), await originUrl(repo));
  const file = orderFilePath(dataHome, repoId, range);
  const overlay: OrderOverlayV2 = {
    version: 2,
    bookFingerprint: 'stale-fingerprint',
    chapters: [['nope::x::1']],
    rationales: {},
    model: 'test-model',
    promptVersion: 'order-chapter-1',
    createdAt: new Date().toISOString(),
  };
  await saveJson(file, overlay);
  return file;
}

describe('chapter-mode order server (#77)', () => {
  test('auto-kick lands a v2 overlay and /api/book carries the recomposed aiBook', async () => {
    const home = await mkdtemp(path.join(tmpdir(), 'cs-chap-fresh-'));
    const server = await startServer({ repo, range, dataHome: home, orderInvoke: chapterInvoke }, 0);
    try {
      const order = await waitForTerminal(server.url);
      expect(order.job?.status).toBe('done');
      expect(order.overlay?.version).toBe(2);

      const book = await getBook(server.url);
      expect(book.aiBook).toBeDefined();
      expect(book.aiBook?.sections.some((s) => s.id.startsWith('chapter:'))).toBe(true);
    } finally {
      server.close();
      await rm(home, { recursive: true, force: true });
    }
  });

  test('/api/book omits aiBook when the stored v2 overlay is stale', async () => {
    await seedStaleOverlay();
    const server = await startServer({ repo, range, dataHome, autoOrder: false }, 0);
    try {
      const book = await getBook(server.url);
      expect(book.aiBook).toBeUndefined();
    } finally {
      server.close();
    }
  });

  test('export.md?order=ai is a 409 when the overlay is stale', async () => {
    await seedStaleOverlay();
    const server = await startServer({ repo, range, dataHome, autoOrder: false }, 0);
    try {
      const res = await fetch(`${server.url}/api/export.md?order=ai`);
      expect(res.status).toBe(409);
    } finally {
      server.close();
    }
  });
});
