import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  type Book,
  type Chunk,
  type ContextJobResponse,
  type ContextPayload,
  type ContextStoreFile,
  LEFTOVERS_SECTION_ID,
} from '@code-story/core';
import { afterAll, describe, expect, test } from 'vitest';
import { eligibleContextChunks, runContextJob } from './context-job.js';
import { type ContextJobRecord, contextFilePath, contextJobFilePath, saveJson } from './context-store.js';
import { originUrl, type ResolvedRange, rootCommit } from './git.js';
import { repoIdFrom } from './review-store.js';
import { startServer } from './server.js';

function chunk(id: string, changeTypes: Chunk['changeTypes'] = []): Chunk {
  return { id, file: `${id}.ts`, symbolPath: [], displayPath: [], kind: 'other', changeTypes, hunks: [] };
}
function payloadOf(chunkId: string): ContextPayload {
  return { chunkId, fingerprint: 'fp', generatedAt: '2026-07-17T00:00:00Z', facts: { definitions: [], edges: { imports: [], importedBy: [] } } };
}

describe('eligibleContextChunks', () => {
  test('excludes the leftovers section and low-signal stubs, deduping by id', () => {
    const chunks = [chunk('a'), chunk('b'), chunk('stub', ['generated']), chunk('left')];
    const book: Book = {
      headSha: 'h',
      sections: [
        { id: 'sec', title: 'sec', occurrences: [{ chunkId: 'a', ordinal: 0, role: 'primary' }, { chunkId: 'b', ordinal: 0, role: 'primary' }, { chunkId: 'a', ordinal: 1, role: 'context' }, { chunkId: 'stub', ordinal: 0, role: 'primary' }] },
        { id: LEFTOVERS_SECTION_ID, title: 'leftovers', occurrences: [{ chunkId: 'left', ordinal: 0, role: 'primary' }] },
      ],
    };
    expect(eligibleContextChunks(book, chunks).map((c) => c.id)).toEqual(['a', 'b']);
  });
});

describe('runContextJob (pure)', () => {
  test('resume skips already-fresh chunks and computes the rest', async () => {
    const computed: string[] = [];
    const result = await runContextJob({
      eligibleChunks: [chunk('a'), chunk('b'), chunk('c')],
      freshIds: new Set(['a', 'c']),
      resolve: async (c) => { computed.push(c.id); return payloadOf(c.id); },
      persist: async () => ({ persisted: true }),
    });
    expect(computed).toEqual(['b']);
    expect(result).toMatchObject({ chunksTotal: 3, chunksDone: 3, computed: 1, skipped: 2, capped: false, cappedCount: 0 });
  });

  test('a persist that reports the cap stops the fill and counts the remainder', async () => {
    let persisted = 0;
    const result = await runContextJob({
      eligibleChunks: [chunk('a'), chunk('b'), chunk('c'), chunk('d')],
      freshIds: new Set(),
      resolve: async (c) => payloadOf(c.id),
      // First two fit; the third caps.
      persist: async () => ({ persisted: persisted++ < 2 }),
    });
    expect(result).toMatchObject({ chunksTotal: 4, chunksDone: 2, computed: 2, skipped: 0, capped: true, cappedCount: 2 });
  });
});

// --- Server integration (git fixture: consumer.ts calls an unchanged util) ---

const dataHome = await mkdtemp(path.join(tmpdir(), 'cs-ctxjob-home-'));
const repo = await mkdtemp(path.join(tmpdir(), 'cs-ctxjob-repo-'));
afterAll(() => Promise.all([rm(dataHome, { recursive: true, force: true }), rm(repo, { recursive: true, force: true })]));

const git = (...a: string[]) => execFileSync('git', a, { cwd: repo }).toString().trim();
await writeFile(path.join(repo, 'util.ts'), 'export function formatName(first: string, last: string): string {\n  return `${last}, ${first}`;\n}\n');
await writeFile(path.join(repo, 'consumer.ts'), 'export function greet() {\n  return "hi";\n}\n');
await writeFile(path.join(repo, 'other.ts'), 'export const n = 1;\n');
git('init', '-q');
git('config', 'user.email', 'test@example.com');
git('config', 'user.name', 'test');
git('add', '.');
git('commit', '-q', '-m', 'base');
await writeFile(path.join(repo, 'consumer.ts'), "import { formatName } from './util';\n\nexport function greet(first: string, last: string): string {\n  return 'Hi ' + formatName(first, last);\n}\n");
await writeFile(path.join(repo, 'other.ts'), 'export const n = 2;\n');
git('commit', '-qam', 'head');
const range: ResolvedRange = { base: git('rev-parse', 'HEAD~1'), head: git('rev-parse', 'HEAD') };

const getJob = async (url: string): Promise<ContextJobResponse> =>
  (await (await fetch(`${url}/api/context-job`)).json()) as ContextJobResponse;
const postJob = (url: string) => fetch(`${url}/api/context-job`, { method: 'POST' });

async function waitForDone(url: string): Promise<ContextJobResponse> {
  for (let i = 0; i < 200; i++) {
    const body = await getJob(url);
    if (body.job?.status === 'done' || body.job?.status === 'failed') return body;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('context job did not finish');
}

describe('context-job server', () => {
  test('POST fills every eligible chunk and persists the store', async () => {
    const home = await mkdtemp(path.join(tmpdir(), 'cs-ctxjob-fill-'));
    const server = await startServer({ repo, range, dataHome: home, autoOrder: false }, 0);
    try {
      expect((await postJob(server.url)).status).toBe(202);
      const body = await waitForDone(server.url);
      expect(body.job?.status).toBe('done');
      expect(body.job?.chunksTotal).toBeGreaterThan(0);
      expect(body.job?.chunksDone).toBe(body.job?.chunksTotal);
      expect(body.job?.computed).toBe(body.job?.chunksTotal);
      expect(body.job?.skipped).toBe(0);
      expect(body.job?.capped).toBe(false);

      const repoId = repoIdFrom(repo, await rootCommit(repo), await originUrl(repo));
      const stored = JSON.parse(await readFile(contextFilePath(home, repoId, range), 'utf8')) as ContextStoreFile;
      expect(Object.keys(stored.payloads).length).toBe(body.job?.chunksTotal);
      // The unchanged util resolves through the bulk fill, not just on demand.
      const defs = Object.values(stored.payloads).flatMap((p) => p.facts.definitions.map((d) => d.symbol));
      expect(defs).toContain('formatName');
    } finally {
      server.close();
    }
  });

  test('a second run skips every chunk the first filled (resume)', async () => {
    const home = await mkdtemp(path.join(tmpdir(), 'cs-ctxjob-resume-'));
    const first = await startServer({ repo, range, dataHome: home, autoOrder: false }, 0);
    let total: number | undefined;
    try {
      await postJob(first.url);
      total = (await waitForDone(first.url)).job?.chunksTotal;
    } finally {
      first.close();
    }
    const second = await startServer({ repo, range, dataHome: home, autoOrder: false }, 0);
    try {
      await postJob(second.url);
      const body = await waitForDone(second.url);
      expect(body.job?.status).toBe('done');
      expect(body.job?.computed).toBe(0);
      expect(body.job?.skipped).toBe(total);
      expect(body.job?.chunksDone).toBe(total);
    } finally {
      second.close();
    }
  });

  test('a persisted running record with no live job reads as failed (orphan)', async () => {
    const home = await mkdtemp(path.join(tmpdir(), 'cs-ctxjob-orphan-'));
    const repoId = repoIdFrom(repo, await rootCommit(repo), await originUrl(repo));
    const orphan: ContextJobRecord = {
      version: 1,
      status: 'running',
      startedAt: new Date().toISOString(),
      chunksTotal: 3,
      chunksDone: 1,
      computed: 1,
      skipped: 0,
      capped: false,
      cappedCount: 0,
    };
    await saveJson(contextJobFilePath(home, repoId, range), orphan);
    const server = await startServer({ repo, range, dataHome: home, autoOrder: false }, 0);
    try {
      const body = await getJob(server.url);
      expect(body.job?.status).toBe('failed');
      expect(body.job?.error).toContain('orphaned');
    } finally {
      server.close();
    }
  });

  test('a tiny store cap stops the fill but on-demand GET still resolves', async () => {
    const home = await mkdtemp(path.join(tmpdir(), 'cs-ctxjob-cap-'));
    const server = await startServer({ repo, range, dataHome: home, autoOrder: false, contextStoreCapBytes: 50 }, 0);
    try {
      await postJob(server.url);
      const body = await waitForDone(server.url);
      expect(body.job?.status).toBe('done');
      expect(body.job?.capped).toBe(true);
      expect(body.job?.cappedCount).toBeGreaterThan(0);
      expect(body.job?.chunksDone).toBeLessThan(body.job!.chunksTotal);

      // On-demand context is unaffected by the cap: it computes and serves without persisting.
      const bookRes = (await (await fetch(`${server.url}/api/book`)).json()) as { chunks: Chunk[] };
      const consumer = bookRes.chunks.find((c) => c.file === 'consumer.ts');
      const ctx = (await (await fetch(`${server.url}/api/context?chunk=${encodeURIComponent(consumer!.id)}`)).json()) as {
        payload: ContextPayload | null;
      };
      expect(ctx.payload).not.toBeNull();
    } finally {
      server.close();
    }
  });

  test('a concurrent POST while one is in flight does not start a second job', async () => {
    const home = await mkdtemp(path.join(tmpdir(), 'cs-ctxjob-guard-'));
    const server = await startServer({ repo, range, dataHome: home, autoOrder: false }, 0);
    try {
      const [a, b] = await Promise.all([postJob(server.url), postJob(server.url)]);
      const codes = [a.status, b.status].sort();
      expect(codes).toEqual([200, 202]);
      await waitForDone(server.url);
    } finally {
      server.close();
    }
  });
});
