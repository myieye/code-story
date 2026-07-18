import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import {
  applyChapterOverlay,
  applyOrderOverlay,
  applyReviewPatch,
  type Book,
  type BookResponse,
  bookFingerprint,
  type Chunk,
  type ChunkGraph,
  type CompileChapterBookInput,
  compileChapterBook,
  CORE_VERSION,
  compileBook,
  type ContextJobResponse,
  type ContextPayload,
  type ContextResponse,
  DEFAULT_STORY_CONFIG,
  exportBookMarkdown,
  type FileContents,
  type FileDiff,
  filterFreshContext,
  filterFreshGraph,
  type ImportGraph,
  filterFreshNarration,
  isFileModeConfig,
  isOverlayFresh,
  type NarrationResponse,
  type OrderOverlayV2,
  type OrderPatch,
  type OrderResponse,
  type ReviewFile,
  type ReviewPatch,
  type StoryConfig,
  unifiedChunkLines,
} from '@code-story/core';
import { Hono } from 'hono';
import { buildChunkGraph } from './chunk-graph-build.js';
import { chunkGraphFilePath, loadChunkGraph } from './chunk-graph-store.js';
import { computeChunks } from './chunks.js';
import { createContextResolver } from './context-resolve.js';
import { eligibleContextChunks, runContextJob } from './context-job.js';
import {
  type ContextJobRecord,
  contextFilePath,
  contextJobFilePath,
  DEFAULT_CONTEXT_STORE_CAP_BYTES,
  loadContextJobRecord,
  loadContextStore,
  persistContextPayload,
} from './context-store.js';
import { JobRuntime } from './job-runtime.js';
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
import { runChapterOrderJob, runOrderJob, shouldAutoKickOrder } from './order-job.js';
import { CHAPTER_ORDER_PROMPT_VERSION, ORDER_PROMPT_VERSION } from './order-prompt.js';
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

function contextJobSummary(record: ContextJobRecord): NonNullable<ContextJobResponse['job']> {
  const { status, startedAt, finishedAt, error, chunksTotal, chunksDone, computed, skipped, capped, cappedCount } =
    record;
  return {
    status,
    startedAt,
    chunksTotal,
    chunksDone,
    computed,
    skipped,
    capped,
    cappedCount,
    ...(finishedAt ? { finishedAt } : {}),
    ...(error ? { error } : {}),
  };
}

export interface ServerOptions {
  repo: string;
  range: ResolvedRange;
  /** Override of `~/.code-story` for tests. */
  dataHome?: string;
  /**
   * Ordering axes for this daemon (spec 05, #77). Defaults to the ratified chapter mode
   * (consumer-first, tests before); `FILE_MODE_STORY_CONFIG` selects the file-section linearizer.
   */
  storyConfig?: StoryConfig;
  /** Auto-run the ordering job on compile when no fresh overlay exists (default true; #71). */
  autoOrder?: boolean;
  /** Model for the auto-kicked ordering job and the default for POST /api/order-job. */
  orderModel?: string;
  /** Test seam: replaces the claude subprocess the order job spawns. */
  orderInvoke?: (prompt: string, model: string, cwd: string) => Promise<string>;
  /** Test seam: replaces the claude subprocess the narration job spawns. */
  narrationInvoke?: (prompt: string, model: string, cwd: string) => Promise<string>;
  /** Byte cap for the context payload store (default ~2 MB); a tiny value exercises cap behavior. */
  contextStoreCapBytes?: number;
}

export interface RunningServer {
  port: number;
  url: string;
  close: () => void;
}

export function startServer(options: ServerOptions, requestedPort = 0): Promise<RunningServer> {
  const app = new Hono();
  const storyConfig = options.storyConfig ?? DEFAULT_STORY_CONFIG;
  const chapterMode = !isFileModeConfig(storyConfig);

  let diffCache: Promise<FileDiff[]> | undefined;
  let bookCache:
    | Promise<{
        book: Book;
        chunks: Chunk[];
        contents: Map<string, FileContents>;
        graph: ImportGraph;
        /** Chapter mode only: the recompose inputs the order job and `applyChapterOverlay` need. */
        chunkGraph?: ChunkGraph;
        storyComposition?: string[][];
        chapterInput?: CompileChapterBookInput;
      }>
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
        const fileCompiled = compileBook({ files, chunks, graph, headSha: options.range.head });
        if (!chapterMode) return { ...fileCompiled, contents, graph };

        const chunkGraph = await resolveChunkGraph(files, contents, graph, fileCompiled);
        const chapterInput: CompileChapterBookInput = { files, chunks, graph, chunkGraph, headSha: options.range.head };
        const chapter = compileChapterBook(chapterInput, storyConfig);
        return {
          book: chapter.book,
          chunks: chapter.chunks,
          contents,
          graph,
          chunkGraph,
          storyComposition: chapter.storyComposition,
          chapterInput,
        };
      })(),
      () => (bookCache = undefined),
    ));

  // Chapter-graph reuse: load the persisted graph if fingerprint-fresh, else build (from already
  // fetched content — no git) and persist. Fail-open to an empty graph so a tree-sitter hiccup
  // degenerates the chapter book to git order rather than bricking the daemon.
  async function resolveChunkGraph(
    files: FileDiff[],
    contents: Map<string, FileContents>,
    graph: ImportGraph,
    fileCompiled: { book: Book; chunks: Chunk[] },
  ): Promise<ChunkGraph> {
    const { graphFile } = await getStore();
    const fresh = filterFreshGraph(options.range.head, await loadChunkGraph(graphFile));
    if (fresh) return fresh;
    try {
      const built = await buildChunkGraph({
        chunks: fileCompiled.chunks,
        contents,
        graph,
        book: fileCompiled.book,
        files,
        headSha: options.range.head,
      });
      await saveJson(graphFile, built);
      return { edges: built.edges };
    } catch {
      return { edges: [] };
    }
  }

  let storeCache:
    | Promise<{
        dataHome: string;
        reviewFile: string;
        orderFile: string;
        jobFile: string;
        graphFile: string;
        narrationFile: string;
        narrationJobFile: string;
        contextFile: string;
        contextJobFile: string;
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
          graphFile: chunkGraphFilePath(dataHome, repoId, options.range),
          narrationFile: narrationFilePath(dataHome, repoId, options.range),
          narrationJobFile: narrationJobFilePath(dataHome, repoId, options.range),
          contextFile: contextFilePath(dataHome, repoId, options.range),
          contextJobFile: contextJobFilePath(dataHome, repoId, options.range),
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
    const built = await getBook();
    const { book, chunks, contents, graph } = built;
    const diffs = Object.fromEntries(
      chunks.map((chunk) => [chunk.id, unifiedChunkLines(chunk, contents.get(chunk.file))]),
    );
    const response: BookResponse = { ...options.range, book, chunks, diffs, graph, chunkGraph: built.chunkGraph ?? { edges: [] } };
    // Chapter mode: recompose per request (milliseconds) so the web gets the applied book — it
    // can't build a chapter book itself. Never cached across overlay writes.
    if (chapterMode && built.chapterInput) {
      const overlay = await loadOverlay((await getStore()).orderFile);
      if (overlay?.version === 2) {
        const aiBook = applyChapterOverlay(built.chapterInput, storyConfig, overlay);
        if (aiBook) response.aiBook = aiBook.book;
      }
    }
    return c.json(response);
  });

  const autoOrder = options.autoOrder ?? true;
  const orderModel = options.orderModel ?? 'opus';

  const orderRuntime = new JobRuntime<OrderJobRecord>();
  // Fingerprints whose job already failed this daemon lifetime: a broken claude CLI must not
  // retry-storm on every compile. A plain restart clears it and re-tries.
  const failedFingerprints = new Set<string>();

  type OrderStore = Awaited<ReturnType<typeof getStore>>;
  // Starts the ordering job unless one is already in flight. Synchronous up to `run`'s handle
  // assignment (no await between the guard and it) so two concurrent callers can't both spawn.
  function kickOrderJob(store: OrderStore, model: string): { record: OrderJobRecord | undefined; started: boolean } {
    if (orderRuntime.running) return { record: orderRuntime.liveRecord, started: false };
    const record: OrderJobRecord = {
      version: 1,
      status: 'running',
      model,
      promptVersion: chapterMode ? CHAPTER_ORDER_PROMPT_VERSION : ORDER_PROMPT_VERSION,
      startedAt: new Date().toISOString(),
    };
    let fingerprint: string | undefined;
    orderRuntime.run(
      record,
      store.jobFile,
      async () => {
        const built = await getBook();
        fingerprint = bookFingerprint(built.book);
        const overlay =
          chapterMode && built.chapterInput
            ? await runChapterOrderJob({
                book: built.book,
                chunks: built.chunks,
                graph: built.graph,
                model,
                cwd: store.dataHome,
                invoke: options.orderInvoke,
                input: built.chapterInput,
                config: storyConfig,
                chunkGraph: built.chunkGraph ?? { edges: [] },
                storyComposition: built.storyComposition ?? [],
              })
            : await runOrderJob({
                book: built.book,
                graph: built.graph,
                chunks: built.chunks,
                model,
                cwd: store.dataHome,
                invoke: options.orderInvoke,
              });
        await saveJson(store.orderFile, overlay);
        return {};
      },
      () => {
        if (fingerprint !== undefined) failedFingerprints.add(fingerprint);
      },
    );
    return { record, started: true };
  }

  app.get('/api/order', async (c) => {
    const { orderFile, jobFile } = await getStore();
    const [overlay, stored, { book }] = await Promise.all([loadOverlay(orderFile), loadJobRecord(jobFile), getBook()]);
    const fresh = overlay !== null && isOverlayFresh(book, overlay) ? overlay : null;
    const job = await orderRuntime.resolve(stored, () => loadJobRecord(jobFile));
    const response: OrderResponse = { overlay: fresh, job: job && jobSummary(job) };
    return c.json(response);
  });

  app.post('/api/order-job', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { model?: string };
    const store = await getStore();
    const { record, started } = kickOrderJob(store, body.model ?? orderModel);
    return c.json({ job: record && jobSummary(record) }, started ? 202 : 200);
  });

  // Default-on (#71): on compile, run the ordering job in the background when no fresh overlay
  // exists. Never blocks the book — the daemon serves tier 0 immediately, the overlay applies on
  // the next book load per order-logic's rules. Fail-open: a broken store/compile just means no
  // auto order, never a startup failure.
  async function maybeAutoKickOrder(): Promise<void> {
    if (!autoOrder) return;
    try {
      const store = await getStore();
      const [overlay, { book }] = await Promise.all([loadOverlay(store.orderFile), getBook()]);
      const decision = {
        enabled: autoOrder,
        hasFreshOverlay: overlay !== null && isOverlayFresh(book, overlay),
        jobInFlight: orderRuntime.running,
        fingerprint: bookFingerprint(book),
        failedFingerprints,
      };
      if (shouldAutoKickOrder(decision)) kickOrderJob(store, orderModel);
    } catch {
      // Fail-open: no auto order this compile; the book still serves tier 0.
    }
  }

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

  // Narration is order-independent (keyed by section fingerprint), so it survives the order overlay
  // being applied or dismissed.
  const narrationRuntime = new JobRuntime<NarrationJobRecord>();

  app.get('/api/narration', async (c) => {
    const { narrationFile, narrationJobFile } = await getStore();
    const [overlay, stored, { book }] = await Promise.all([
      loadNarrationOverlay(narrationFile),
      loadNarrationJobRecord(narrationJobFile),
      getBook(),
    ]);
    const filtered = overlay !== null ? filterFreshNarration(book, options.range.head, overlay) : null;
    const job = await narrationRuntime.resolve(stored, () => loadNarrationJobRecord(narrationJobFile));
    const response: NarrationResponse = { overlay: filtered, job: job && narrationJobSummary(job) };
    return c.json(response);
  });

  app.post('/api/narration-job', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { model?: string };
    const { dataHome, narrationFile, narrationJobFile } = await getStore();
    const built = await getBook();
    // No awaits between this guard and `run`'s handle assignment — a second concurrent POST must see
    // the first one's handle, or two paid model runs race on the same overlay file.
    if (narrationRuntime.running) {
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
    narrationRuntime.run(record, narrationJobFile, async () => {
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
      return { sectionsTotal: result.sectionsTotal, sectionsDone: result.sectionsDone };
    });
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

  const contextStoreCapBytes = options.contextStoreCapBytes ?? DEFAULT_CONTEXT_STORE_CAP_BYTES;

  // Serializes the read-modify-write of the shared context store so a compute-on-miss GET and the
  // bulk job never clobber each other's payload. Persists only while under the byte cap: past it a
  // computed payload is still served (GET) but not written (spec 04 step 5) — never throws.
  let contextSaveChain = Promise.resolve();
  const persistPayload = (file: string, payload: ContextPayload): Promise<{ persisted: boolean }> => {
    const op = contextSaveChain.then(async () =>
      persistContextPayload(file, await loadContextStore(file), payload, contextStoreCapBytes),
    );
    contextSaveChain = op.then(
      () => undefined,
      () => undefined,
    );
    return op;
  };

  // Resolver + changed-file list, shared by the on-demand GET and the bulk job (one head-path index,
  // one memoized (sha,path) cache per call).
  async function contextResolveInputs() {
    const [files, headPaths] = await Promise.all([getDiff(), getHeadPaths()]);
    const resolver = createContextResolver({
      fileAt: async (sha, filePath) => fileAt(options.repo, sha, filePath).catch(() => undefined),
      headPaths,
      headSha: options.range.head,
      baseSha: options.range.base,
    });
    return { resolver, changedFiles: files.map((f) => ({ path: f.path, status: f.status })) };
  }

  app.get('/api/context', async (c) => {
    const chunkId = c.req.query('chunk');
    if (!chunkId) return c.json({ error: 'missing chunk query parameter' }, 400);

    const [{ chunks, graph, book }, { contextFile }] = await Promise.all([getBook(), getStore()]);
    const chunk = chunks.find((ch) => ch.id === chunkId);
    if (!chunk) return c.json({ payload: null } satisfies ContextResponse);

    const store = await loadContextStore(contextFile);
    const fresh = filterFreshContext(options.range.head, book, store)[chunkId];
    if (fresh) return c.json({ payload: fresh } satisfies ContextResponse);

    try {
      const { resolver, changedFiles } = await contextResolveInputs();
      const payload = await resolver.resolve(chunk, changedFiles, graph);
      // At the cap the payload is served without persisting — on-demand context never stops working.
      await persistPayload(contextFile, payload);
      return c.json({ payload } satisfies ContextResponse);
    } catch {
      // Fail-open to absent: a resolution error must read as "no context", never a 500.
      return c.json({ payload: null } satisfies ContextResponse);
    }
  });

  // The bulk context fill, modeled on the order/narration jobs minus the model calls. One in flight
  // per range.
  const contextRuntime = new JobRuntime<ContextJobRecord>();

  app.get('/api/context-job', async (c) => {
    const { contextJobFile } = await getStore();
    const stored = await loadContextJobRecord(contextJobFile);
    const job = await contextRuntime.resolve(stored, () => loadContextJobRecord(contextJobFile));
    return c.json({ job: job && contextJobSummary(job) } satisfies ContextJobResponse);
  });

  app.post('/api/context-job', async (c) => {
    const { contextFile, contextJobFile } = await getStore();
    const { chunks, graph, book } = await getBook();
    // No awaits between this guard and `run`'s handle assignment — a second concurrent POST must see
    // the first one's handle.
    if (contextRuntime.running) {
      return c.json(
        {
          job: contextRuntime.liveRecord ? contextJobSummary(contextRuntime.liveRecord) : null,
        } satisfies ContextJobResponse,
        200,
      );
    }
    const record: ContextJobRecord = {
      version: 1,
      status: 'running',
      startedAt: new Date().toISOString(),
      chunksTotal: 0,
      chunksDone: 0,
      computed: 0,
      skipped: 0,
      capped: false,
      cappedCount: 0,
    };
    contextRuntime.run(record, contextJobFile, async () => {
      const eligible = eligibleContextChunks(book, chunks);
      const freshIds = new Set(
        Object.keys(filterFreshContext(options.range.head, book, await loadContextStore(contextFile))),
      );
      const { resolver, changedFiles } = await contextResolveInputs();
      return runContextJob({
        eligibleChunks: eligible,
        freshIds,
        resolve: (chunk) => resolver.resolve(chunk, changedFiles, graph),
        persist: (payload) => persistPayload(contextFile, payload),
        onProgress: (done, total) => {
          record.chunksDone = done;
          record.chunksTotal = total;
        },
      });
    });
    return c.json({ job: contextJobSummary(record) } satisfies ContextJobResponse, 202);
  });

  // `?order=ai` must never silently fall back to tier 0 — an eval comparing "both orders"
  // would then confidently judge two identical books.
  app.get('/api/export.md', async (c) => {
    const built = await getBook();
    const { book, chunks, contents, graph } = built;
    let exported = book;
    if (c.req.query('order') === 'ai') {
      const overlay = await loadOverlay((await getStore()).orderFile);
      const stale = () => c.text('no fresh AI order overlay for this range (run the order job first)', 409);
      if (overlay === null || !isOverlayFresh(book, overlay)) return stale();
      if (chapterMode) {
        if (overlay.version !== 2 || !built.chapterInput) return stale();
        const applied = applyChapterOverlay(built.chapterInput, storyConfig, overlay);
        if (!applied) return stale();
        exported = applied.book;
      } else {
        if (overlay.version !== 1) return stale();
        exported = applyOrderOverlay(book, graph, chunks, overlay);
      }
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
      void maybeAutoKickOrder();
      resolve({ port: info.port, url, close: () => server.close() });
    });
  });
}
