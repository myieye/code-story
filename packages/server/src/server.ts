import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import {
  applyOrderOverlay,
  applyReviewPatch,
  type Book,
  bookFingerprint,
  type BookResponse,
  type Chunk,
  CORE_VERSION,
  compileBook,
  exportBookMarkdown,
  type FileContents,
  type FileDiff,
  type ImportGraph,
  type OrderPatch,
  type OrderResponse,
  type ReviewFile,
  type ReviewPatch,
  unifiedChunkLines,
} from '@code-story/core';
import { Hono } from 'hono';
import { computeChunks } from './chunks.js';
import { diffRange, originUrl, type ResolvedRange, rootCommit } from './git.js';
import { runOrderJob } from './order-job.js';
import { ORDER_PROMPT_VERSION } from './order-prompt.js';
import { loadJobRecord, loadOverlay, orderFilePath, orderJobFilePath, type OrderJobRecord, saveJson } from './order-store.js';
import { defaultDataHome, loadReview, repoIdFrom, reviewFilePath, saveReview } from './review-store.js';

const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));

function jobSummary(record: OrderJobRecord): NonNullable<OrderResponse['job']> {
  const { status, model, startedAt, finishedAt, error } = record;
  return { status, model, startedAt, ...(finishedAt ? { finishedAt } : {}), ...(error ? { error } : {}) };
}

export interface ServerOptions {
  repo: string;
  range: ResolvedRange;
  /** Override of `~/.code-story` for tests. */
  dataHome?: string;
}

export interface RunningServer {
  port: number;
  url: string;
  close: () => void;
}

export function startServer(options: ServerOptions, requestedPort = 0): Promise<RunningServer> {
  const app = new Hono();
  let diffCache: Promise<FileDiff[]> | undefined;
  let bookCache:
    | Promise<{ book: Book; chunks: Chunk[]; contents: Map<string, FileContents>; graph: ImportGraph }>
    | undefined;

  // A rejected promise must not stay cached, or one transient git failure bricks the daemon.
  const uncacheOnError = <T>(promise: Promise<T>, clear: () => void): Promise<T> =>
    promise.catch((e: unknown) => {
      clear();
      throw e;
    });

  const getDiff = () =>
    (diffCache ??= uncacheOnError(diffRange(options.repo, options.range), () => (diffCache = undefined)));
  const getBook = () =>
    (bookCache ??= uncacheOnError(
      (async () => {
        const files = await getDiff();
        const { chunks, contents, graph } = await computeChunks(options.repo, options.range, files);
        const compiled = compileBook({ files, chunks, graph, headSha: options.range.head });
        return { ...compiled, contents, graph };
      })(),
      () => (bookCache = undefined),
    ));

  let storeCache: Promise<{ dataHome: string; reviewFile: string; orderFile: string; jobFile: string }> | undefined;
  const getStore = () =>
    (storeCache ??= uncacheOnError(
      (async () => {
        const dataHome = options.dataHome ?? defaultDataHome();
        const repoId = repoIdFrom(options.repo, await rootCommit(options.repo), await originUrl(options.repo));
        return {
          dataHome,
          reviewFile: reviewFilePath(dataHome, repoId, options.range),
          orderFile: orderFilePath(dataHome, repoId, options.range),
          jobFile: orderJobFilePath(dataHome, repoId, options.range),
        };
      })(),
      () => (storeCache = undefined),
    ));

  let reviewCache: Promise<{ file: string; review: ReviewFile }> | undefined;
  const getReview = () =>
    (reviewCache ??= uncacheOnError(
      (async () => {
        const file = (await getStore()).reviewFile;
        return { file, review: await loadReview(file, options.range) };
      })(),
      () => (reviewCache = undefined),
    ));
  // Serializes saves so concurrent PATCHes never interleave the write-temp/rename pair.
  let saveChain = Promise.resolve();

  app.get('/api/health', (c) => c.json({ ok: true, name: 'code-story', core: CORE_VERSION }));

  app.get('/api/diff', async (c) => {
    return c.json({ ...options.range, files: await getDiff() });
  });

  app.get('/api/book', async (c) => {
    const { book, chunks, contents, graph } = await getBook();
    const diffs = Object.fromEntries(
      chunks.map((chunk) => [chunk.id, unifiedChunkLines(chunk, contents.get(chunk.file))]),
    );
    const response: BookResponse = { ...options.range, book, chunks, diffs, graph };
    return c.json(response);
  });

  // The in-flight ordering job. A persisted `running` record without this handle is an orphan
  // from a dead daemon and reads as failed (spec 02).
  let liveJob: Promise<void> | undefined;

  app.get('/api/order', async (c) => {
    const { orderFile, jobFile } = await getStore();
    const [overlay, record, { book }] = await Promise.all([loadOverlay(orderFile), loadJobRecord(jobFile), getBook()]);
    const fresh = overlay !== null && overlay.bookFingerprint === bookFingerprint(book) ? overlay : null;
    const job =
      record?.status === 'running' && liveJob === undefined
        ? { ...record, status: 'failed' as const, error: 'job orphaned by a daemon restart — re-run it' }
        : record;
    const response: OrderResponse = { overlay: fresh, job: job && jobSummary(job) };
    return c.json(response);
  });

  app.post('/api/order-job', async (c) => {
    const { dataHome, orderFile, jobFile } = await getStore();
    if (liveJob !== undefined) {
      const record = await loadJobRecord(jobFile);
      return c.json({ job: record && jobSummary(record) }, 200);
    }
    const body = (await c.req.json().catch(() => ({}))) as { model?: string };
    const record: OrderJobRecord = {
      version: 1,
      status: 'running',
      model: body.model ?? 'opus',
      promptVersion: ORDER_PROMPT_VERSION,
      startedAt: new Date().toISOString(),
    };
    await saveJson(jobFile, record);
    liveJob = (async () => {
      try {
        const { book, chunks, graph } = await getBook();
        const overlay = await runOrderJob({ book, graph, chunks, model: record.model, cwd: dataHome });
        await saveJson(orderFile, overlay);
        await saveJson(jobFile, { ...record, status: 'done', finishedAt: new Date().toISOString() });
      } catch (e) {
        await saveJson(jobFile, {
          ...record,
          status: 'failed',
          finishedAt: new Date().toISOString(),
          error: (e as Error).message,
        });
      } finally {
        liveJob = undefined;
      }
    })();
    return c.json({ job: jobSummary(record) }, 202);
  });

  app.patch('/api/order', async (c) => {
    const { orderFile } = await getStore();
    const overlay = await loadOverlay(orderFile);
    if (overlay === null) return c.json({ error: 'no order overlay' }, 404);
    const patch = (await c.req.json()) as OrderPatch;
    if (patch.applied) overlay.appliedAt = new Date().toISOString();
    if (patch.dismissed) overlay.dismissedAt = new Date().toISOString();
    await saveJson(orderFile, overlay);
    return c.json({ ok: true });
  });

  app.get('/api/review', async (c) => {
    const { review } = await getReview();
    return c.json(review);
  });

  app.patch('/api/review', async (c) => {
    const patch = (await c.req.json()) as ReviewPatch;
    const { file, review } = await getReview();
    applyReviewPatch(review, patch);
    const save = saveChain.then(() => saveReview(file, review));
    // This request surfaces a failed save; the chain itself absorbs it so later saves still run.
    saveChain = save.catch(() => undefined);
    await save;
    return c.json({ ok: true });
  });

  // `?order=ai` exports the overlay-applied order when a fresh overlay exists (the eval harness
  // compares this against the default tier-0 export); silently tier 0 otherwise.
  app.get('/api/export.md', async (c) => {
    const { book, chunks, contents, graph } = await getBook();
    let exported = book;
    if (c.req.query('order') === 'ai') {
      const overlay = await loadOverlay((await getStore()).orderFile);
      if (overlay !== null) exported = applyOrderOverlay(book, graph, chunks, overlay);
    }
    const title = `${options.range.base.slice(0, 8)}..${options.range.head.slice(0, 8)}`;
    return c.text(exportBookMarkdown({ book: exported, chunks, contents, title }));
  });

  if (existsSync(webDist)) {
    // serveStatic resolves root relative to cwd, which is the reviewed repo — not our install
    app.use('*', serveStatic({ root: path.relative(process.cwd(), webDist) }));
  } else {
    app.get('/', (c) => c.text('code-story: web app not built (run pnpm build)', 503));
  }

  return new Promise((resolve) => {
    const server = serve({ fetch: app.fetch, port: requestedPort, hostname: '127.0.0.1' }, (info) => {
      const url = `http://127.0.0.1:${info.port}`;
      resolve({ port: info.port, url, close: () => server.close() });
    });
  });
}
