import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import {
  applyOrderOverlay,
  applyReviewPatch,
  type Book,
  type BookResponse,
  type Chunk,
  CORE_VERSION,
  compileBook,
  type ContextPayload,
  type ContextResponse,
  exportBookMarkdown,
  type FileContents,
  type FileDiff,
  filterFreshContext,
  type ImportGraph,
  filterFreshNarration,
  isOverlayFresh,
  type NarrationResponse,
  type OrderPatch,
  type OrderResponse,
  type ReviewFile,
  type ReviewPatch,
  unifiedChunkLines,
} from '@code-story/core';
import { Hono } from 'hono';
import { computeChunks } from './chunks.js';
import { createContextResolver } from './context-resolve.js';
import { contextFilePath, loadContextStore } from './context-store.js';
import { diffRange, fileAt, listTree, originUrl, type ResolvedRange, rootCommit } from './git.js';
import { runNarrationJob } from './narration-job.js';
import { NARRATION_PROMPT_VERSION } from './narration-prompt.js';
import {
  loadNarrationJobRecord,
  loadNarrationOverlay,
  type NarrationJobRecord,
  narrationFilePath,
  narrationJobFilePath,
} from './narration-store.js';
import { runOrderJob } from './order-job.js';
import { ORDER_PROMPT_VERSION } from './order-prompt.js';
import { loadJobRecord, loadOverlay, orderFilePath, orderJobFilePath, type OrderJobRecord, saveJson } from './order-store.js';
import { defaultDataHome, loadReview, repoIdFrom, reviewFilePath, saveReview } from './review-store.js';

const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));

function jobSummary(record: OrderJobRecord): NonNullable<OrderResponse['job']> {
  const { status, model, promptVersion, startedAt, finishedAt, error } = record;
  return {
    status,
    model,
    promptVersion,
    startedAt,
    ...(finishedAt ? { finishedAt } : {}),
    ...(error ? { error } : {}),
  };
}

function narrationJobSummary(record: NarrationJobRecord): NonNullable<NarrationResponse['job']> {
  const { status, model, promptVersion, startedAt, finishedAt, error, sectionsTotal, sectionsDone } = record;
  return {
    status,
    model,
    promptVersion,
    startedAt,
    sectionsTotal,
    sectionsDone,
    ...(finishedAt ? { finishedAt } : {}),
    ...(error ? { error } : {}),
  };
}

export interface ServerOptions {
  repo: string;
  range: ResolvedRange;
  /** Override of `~/.code-story` for tests. */
  dataHome?: string;
  /** Test seam: replaces the claude subprocess the narration job spawns. */
  narrationInvoke?: (prompt: string, model: string, cwd: string) => Promise<string>;
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

  let storeCache:
    | Promise<{
        dataHome: string;
        reviewFile: string;
        orderFile: string;
        jobFile: string;
        narrationFile: string;
        narrationJobFile: string;
        contextFile: string;
      }>
    | undefined;
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
          narrationFile: narrationFilePath(dataHome, repoId, options.range),
          narrationJobFile: narrationJobFilePath(dataHome, repoId, options.range),
          contextFile: contextFilePath(dataHome, repoId, options.range),
        };
      })(),
      () => (storeCache = undefined),
    ));

  // The head path index (`git ls-tree`) is constant for the range — one call, cached.
  let headPathsCache: Promise<Set<string>> | undefined;
  const getHeadPaths = () =>
    (headPathsCache ??= uncacheOnError(
      listTree(options.repo, options.range.head).then((paths) => new Set(paths)),
      () => (headPathsCache = undefined),
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
  // from a dead daemon and reads as failed. liveRecord mirrors what the running job will
  // persist, so GET never misreads the window before the record file lands.
  let liveJob: Promise<void> | undefined;
  let liveRecord: OrderJobRecord | undefined;

  app.get('/api/order', async (c) => {
    const { orderFile, jobFile } = await getStore();
    const [overlay, stored, { book }] = await Promise.all([loadOverlay(orderFile), loadJobRecord(jobFile), getBook()]);
    const fresh = overlay !== null && isOverlayFresh(book, overlay) ? overlay : null;
    const record = liveRecord ?? stored;
    const job =
      record?.status === 'running' && liveJob === undefined
        ? { ...record, status: 'failed' as const, error: 'job orphaned by a daemon restart — re-run it' }
        : record;
    const response: OrderResponse = { overlay: fresh, job: job && jobSummary(job) };
    return c.json(response);
  });

  app.post('/api/order-job', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { model?: string };
    const { dataHome, orderFile, jobFile } = await getStore();
    // No awaits between this guard and the liveJob assignment — a second concurrent POST must
    // see the first one's handle, or two paid model calls race on the same overlay file.
    if (liveJob !== undefined) {
      return c.json({ job: liveRecord && jobSummary(liveRecord) }, 200);
    }
    const record: OrderJobRecord = {
      version: 1,
      status: 'running',
      model: body.model ?? 'opus',
      promptVersion: ORDER_PROMPT_VERSION,
      startedAt: new Date().toISOString(),
    };
    liveRecord = record;
    liveJob = (async () => {
      try {
        await saveJson(jobFile, record);
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
        liveRecord = undefined;
      }
    })();
    return c.json({ job: jobSummary(record) }, 202);
  });

  // Serialized like review saves: concurrent PATCHes (auto-apply vs dismiss, two tabs) must not
  // interleave their read-modify-write and drop each other's sticky flag.
  let orderPatchChain = Promise.resolve();
  app.patch('/api/order', async (c) => {
    const patch = (await c.req.json()) as OrderPatch;
    const { orderFile } = await getStore();
    const op = orderPatchChain.then(async () => {
      const overlay = await loadOverlay(orderFile);
      if (overlay === null) return false;
      if (patch.applied) overlay.appliedAt = new Date().toISOString();
      if (patch.dismissed) overlay.dismissedAt = new Date().toISOString();
      await saveJson(orderFile, overlay);
      return true;
    });
    orderPatchChain = op.then(
      () => undefined,
      () => undefined,
    );
    const found = await op;
    return found ? c.json({ ok: true }) : c.json({ error: 'no order overlay' }, 404);
  });

  // Mirrors the order job's live/orphan handling. Narration is order-independent (keyed by
  // section fingerprint), so it survives the order overlay being applied or dismissed.
  let liveNarrationJob: Promise<void> | undefined;
  let liveNarrationRecord: NarrationJobRecord | undefined;

  app.get('/api/narration', async (c) => {
    const { narrationFile, narrationJobFile } = await getStore();
    const [overlay, stored, { book }] = await Promise.all([
      loadNarrationOverlay(narrationFile),
      loadNarrationJobRecord(narrationJobFile),
      getBook(),
    ]);
    const filtered = overlay !== null ? filterFreshNarration(book, options.range.head, overlay) : null;
    const record = liveNarrationRecord ?? stored;
    const job =
      record?.status === 'running' && liveNarrationJob === undefined
        ? { ...record, status: 'failed' as const, error: 'job orphaned by a daemon restart — re-run it' }
        : record;
    const response: NarrationResponse = { overlay: filtered, job: job && narrationJobSummary(job) };
    return c.json(response);
  });

  app.post('/api/narration-job', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { model?: string };
    const { dataHome, narrationFile, narrationJobFile } = await getStore();
    const built = await getBook();
    // No awaits between this guard and the liveNarrationJob assignment — a second concurrent POST
    // must see the first one's handle, or two paid model runs race on the same overlay file.
    if (liveNarrationJob !== undefined) {
      return c.json({ error: 'a narration job is already running for this range' }, 409);
    }
    const record: NarrationJobRecord = {
      version: 1,
      status: 'running',
      model: body.model ?? 'opus',
      promptVersion: NARRATION_PROMPT_VERSION,
      startedAt: new Date().toISOString(),
      sectionsTotal: 0,
      sectionsDone: 0,
    };
    liveNarrationRecord = record;
    liveNarrationJob = (async () => {
      try {
        await saveJson(narrationJobFile, record);
        const result = await runNarrationJob({
          book: built.book,
          graph: built.graph,
          chunks: built.chunks,
          contents: built.contents,
          headSha: options.range.head,
          model: record.model,
          cwd: dataHome,
          overlayFile: narrationFile,
          onProgress: (done, total) => {
            record.sectionsDone = done;
            record.sectionsTotal = total;
          },
          invoke: options.narrationInvoke,
        });
        await saveJson(narrationJobFile, {
          ...record,
          status: 'done',
          finishedAt: new Date().toISOString(),
          sectionsTotal: result.sectionsTotal,
          sectionsDone: result.sectionsDone,
        });
      } catch (e) {
        await saveJson(narrationJobFile, {
          ...record,
          status: 'failed',
          finishedAt: new Date().toISOString(),
          error: (e as Error).message,
        });
      } finally {
        liveNarrationJob = undefined;
        liveNarrationRecord = undefined;
      }
    })();
    return c.json({ job: narrationJobSummary(record) }, 202);
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

  // Serializes the read-modify-write of the shared context store so two concurrent compute-on-miss
  // GETs for different chunks don't clobber each other's payload.
  let contextSaveChain = Promise.resolve();
  const persistPayload = (file: string, payload: ContextPayload) => {
    const op = contextSaveChain.then(async () => {
      const current = await loadContextStore(file);
      current.payloads[payload.chunkId] = payload;
      await saveJson(file, current);
    });
    contextSaveChain = op.catch(() => undefined);
    return op;
  };

  app.get('/api/context', async (c) => {
    const chunkId = c.req.query('chunk');
    if (!chunkId) return c.json({ error: 'missing chunk query parameter' }, 400);

    const [{ chunks, graph, book }, files, { contextFile }] = await Promise.all([getBook(), getDiff(), getStore()]);
    const chunk = chunks.find((ch) => ch.id === chunkId);
    if (!chunk) return c.json({ payload: null } satisfies ContextResponse);

    const store = await loadContextStore(contextFile);
    const fresh = filterFreshContext(options.range.head, book, store)[chunkId];
    if (fresh) return c.json({ payload: fresh } satisfies ContextResponse);

    const resolver = createContextResolver({
      fileAt: async (sha, filePath) => fileAt(options.repo, sha, filePath).catch(() => undefined),
      headPaths: await getHeadPaths(),
      headSha: options.range.head,
      baseSha: options.range.base,
    });
    const changedFiles = files.map((f) => ({ path: f.path, status: f.status }));
    const payload = await resolver.resolve(chunk, changedFiles, graph);
    await persistPayload(contextFile, payload);
    return c.json({ payload } satisfies ContextResponse);
  });

  // `?order=ai` must never silently fall back to tier 0 — an eval comparing "both orders"
  // would then confidently judge two identical books.
  app.get('/api/export.md', async (c) => {
    const { book, chunks, contents, graph } = await getBook();
    let exported = book;
    if (c.req.query('order') === 'ai') {
      const overlay = await loadOverlay((await getStore()).orderFile);
      if (overlay === null || !isOverlayFresh(book, overlay)) {
        return c.text('no fresh AI order overlay for this range (run the order job first)', 409);
      }
      exported = applyOrderOverlay(book, graph, chunks, overlay);
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
