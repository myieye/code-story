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
  filterFreshNarrationV2,
  isFileModeConfig,
  isOverlayFresh,
  type NarrationResponse,
  type OrderOverlayV2,
  type OrderPatch,
  type OrderResponse,
  type ReviewFile,
  type ReviewPatch,
  resolveStoryConfig,
  type StoryConfig,
  storyConfigKey,
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
import { createGlueInvoker, type GlueSpawn } from './glue/invoker.js';
import { GlueLedger, glueLedgerFilePath } from './glue/ledger.js';
import { createModelPolicy } from './glue/model-policy.js';
import { GlueScheduler } from './glue/scheduler.js';
import { JobRuntime, resolveJobRecord } from './job-runtime.js';
import { diffRange, fileAt, listTree, originUrl, type ResolvedRange, rootCommit } from './git.js';
import { CHUNK_NARRATION_KIND, createChunkNarrationTask } from './chunk-narration-task.js';
import { runNarrationJob } from './narration-job.js';
import { NARRATION_PROMPT_VERSION } from './narration-prompt.js';
import {
  loadChunkNarrationOverlay,
  loadNarrationJobRecord,
  loadNarrationOverlay,
  type NarrationJobRecord,
  narrationChunksFilePath,
  narrationFilePath,
  narrationJobFilePath,
} from './narration-store.js';
import { createOrderTask, ORDER_KIND } from './order-task.js';
import { loadJobRecord, loadOverlay, orderFilePath, orderJobFilePath, type OrderJobRecord, saveJson } from './order-store.js';
import { defaultDataHome, loadReview, repoIdFrom, reviewFilePath, saveReview } from './review-store.js';

const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));

// The three job GETs share this envelope (status/timestamps/error); each summary adds its own extra
// fields. One home for the conditional-spread so a shape tweak can't drift across the three copies.
function jobSummaryBase<S extends string>(record: { status: S; startedAt: string; finishedAt?: string; error?: string }) {
  const { status, startedAt, finishedAt, error } = record;
  return { status, startedAt, ...(finishedAt ? { finishedAt } : {}), ...(error ? { error } : {}) };
}

function jobSummary(record: OrderJobRecord): NonNullable<OrderResponse['job']> {
  return { ...jobSummaryBase(record), model: record.model, promptVersion: record.promptVersion };
}

function narrationJobSummary(record: NarrationJobRecord): NonNullable<NarrationResponse['job']> {
  const { model, promptVersion, sectionsTotal, sectionsDone } = record;
  return { ...jobSummaryBase(record), model, promptVersion, sectionsTotal, sectionsDone };
}

function contextJobSummary(record: ContextJobRecord): NonNullable<ContextJobResponse['job']> {
  const { chunksTotal, chunksDone, computed, skipped, capped, cappedCount } = record;
  return { ...jobSummaryBase(record), chunksTotal, chunksDone, computed, skipped, capped, cappedCount };
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
  /**
   * Master switch for the AI glue pipeline (spec 07). `autoOrder` aliases to it
   * (`glue ?? autoOrder ?? true`), so a test passing `autoOrder:false` disables all glue auto-kicks
   * with zero edits. No glue task auto-kicks yet (G2/G3), so this is wiring only in G1.
   */
  glue?: boolean;
  /**
   * Auto-kick the chunk-narration glue task on compile (default true; spec 06 slice 5). Narration-
   * only opt-out (`--no-ai-narration` / `CODE_STORY_NO_AI_NARRATION`); the master `glue`/`autoOrder`
   * switch gates it too, so an existing test passing `autoOrder:false` never spawns for narration.
   */
  autoNarration?: boolean;
  /** Model for the auto-kicked ordering job and the default for POST /api/order-job. */
  orderModel?: string;
  /** Test seam: replaces the claude subprocess the order job spawns. */
  orderInvoke?: (prompt: string, model: string, cwd: string) => Promise<string>;
  /** Test seam: replaces the claude subprocess the narration job spawns. */
  narrationInvoke?: (prompt: string, model: string, cwd: string) => Promise<string>;
  /** Byte cap for the context payload store (default ~2 MB); a tiny value exercises cap behavior. */
  contextStoreCapBytes?: number;
  /** Test seam: replaces the raw `claude -p` spawn the glue invoker drives. */
  glueInvoke?: GlueSpawn;
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

  interface Built {
    book: Book;
    chunks: Chunk[];
    contents: Map<string, FileContents>;
    graph: ImportGraph;
    /** Chapter mode only: the recompose inputs the order job and `applyChapterOverlay` need. */
    chunkGraph?: ChunkGraph;
    storyComposition?: string[][];
    chapterInput?: CompileChapterBookInput;
  }

  // Config-independent inputs: the diff, chunks, contents, import graph, and the file-mode compile.
  // Every config's book derives from this — only section order/grouping differs (#114), so it is
  // computed once and shared across configs.
  interface Base {
    files: FileDiff[];
    chunks: Chunk[];
    contents: Map<string, FileContents>;
    graph: ImportGraph;
    fileCompiled: { book: Book; chunks: Chunk[] };
  }
  let baseCache: Promise<Base> | undefined;
  let chunkGraphCache: Promise<ChunkGraph> | undefined;
  // One entry per StoryConfig requested via /api/book. The launch config is just its own key here,
  // so the pre-#114 single-config fast path is preserved (getBook = getBookForConfig(launch)).
  const bookCacheByConfig = new Map<string, Promise<Built>>();

  // A rejected promise must not stay cached, or one transient git failure bricks the daemon.
  const uncacheOnError = <T>(promise: Promise<T>, clear: () => void): Promise<T> =>
    promise.catch((e: unknown) => {
      clear();
      throw e;
    });

  const getDiff = () =>
    (diffCache ??= uncacheOnError(diffRange(options.repo, options.range), () => (diffCache = undefined)));

  const getBase = () =>
    (baseCache ??= uncacheOnError(
      (async () => {
        const files = await getDiff();
        const { chunks, contents, graph } = await computeChunks(options.repo, options.range, files);
        const fileCompiled = compileBook({ files, chunks, graph, headSha: options.range.head });
        return { files, chunks, contents, graph, fileCompiled };
      })(),
      () => (baseCache = undefined),
    ));

  const getChunkGraph = () =>
    (chunkGraphCache ??= uncacheOnError(
      getBase().then((base) => resolveChunkGraph(base)),
      () => (chunkGraphCache = undefined),
    ));

  const getBookForConfig = (config: StoryConfig): Promise<Built> => {
    const key = storyConfigKey(config);
    let cached = bookCacheByConfig.get(key);
    if (!cached) {
      cached = uncacheOnError(
        (async () => {
          const base = await getBase();
          if (isFileModeConfig(config)) {
            return { book: base.fileCompiled.book, chunks: base.fileCompiled.chunks, contents: base.contents, graph: base.graph };
          }
          const chunkGraph = await getChunkGraph();
          const chapterInput: CompileChapterBookInput = {
            files: base.files,
            chunks: base.chunks,
            graph: base.graph,
            chunkGraph,
            headSha: options.range.head,
          };
          const chapter = compileChapterBook(chapterInput, config);
          return {
            book: chapter.book,
            chunks: chapter.chunks,
            contents: base.contents,
            graph: base.graph,
            chunkGraph,
            storyComposition: chapter.storyComposition,
            chapterInput,
          };
        })(),
        () => bookCacheByConfig.delete(key),
      );
      bookCacheByConfig.set(key, cached);
    }
    return cached;
  };

  // The launch config's book — what the order/context/narration/export endpoints all read.
  const getBook = () => getBookForConfig(storyConfig);

  // Chapter-graph reuse: load the persisted graph if fingerprint-fresh, else build (from already
  // fetched content — no git) and persist. Fail-open to an empty graph so a tree-sitter hiccup
  // degenerates the chapter book to git order rather than bricking the daemon.
  async function resolveChunkGraph(base: Base): Promise<ChunkGraph> {
    const { graphFile } = await getStore();
    const fresh = filterFreshGraph(options.range.head, await loadChunkGraph(graphFile));
    if (fresh) return fresh;
    try {
      const built = await buildChunkGraph({
        chunks: base.fileCompiled.chunks,
        contents: base.contents,
        graph: base.graph,
        book: base.fileCompiled.book,
        files: base.files,
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
        narrationChunksFile: string;
        contextFile: string;
        contextJobFile: string;
        glueLedgerFile: string;
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
          narrationChunksFile: narrationChunksFilePath(dataHome, repoId, options.range),
          contextFile: contextFilePath(dataHome, repoId, options.range),
          contextJobFile: contextJobFilePath(dataHome, repoId, options.range),
          glueLedgerFile: glueLedgerFilePath(dataHome, repoId, options.range),
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

  // The AI glue pipeline (spec 07). `autoOrder:false` aliases to `glue:false` so the existing test
  // corpus disables all glue auto-kicks unchanged. The chunk-narration task (G2) registers here; its
  // auto-kick is gated on `glueEnabled`, so an `autoOrder:false` server spawns zero `claude` children.
  const glueEnabled = options.glue ?? options.autoOrder ?? true;
  const autoNarration = options.autoNarration ?? true;
  const autoOrder = options.autoOrder ?? true;
  // Order-job model: the daemon default; POST /api/order-job overwrites it with `body.model` before
  // kicking (single-flight, so the running task reads the intended model). ModelPolicy's per-task
  // override keeps this order-only — narration is unaffected (survey §4).
  let orderJobModel = options.orderModel ?? 'opus';
  const contextStoreCapBytes = options.contextStoreCapBytes ?? DEFAULT_CONTEXT_STORE_CAP_BYTES;
  let glueCache: Promise<{ scheduler: GlueScheduler; ledger: GlueLedger }> | undefined;
  const getGlue = () =>
    (glueCache ??= uncacheOnError(
      (async () => {
        const store = await getStore();
        const policy = createModelPolicy();
        const ledger = new GlueLedger(store.glueLedgerFile);
        const invoker = createGlueInvoker({ policy, ledger, cwd: store.dataHome, spawn: options.glueInvoke });
        const scheduler = new GlueScheduler({ invoker, ledger, policy, enabled: glueEnabled });
        scheduler.register(
          createChunkNarrationTask({
            headSha: options.range.head,
            tier: 'top',
            model: policy.resolve('top'),
            overlayFile: store.narrationChunksFile,
            getInputs: async () => {
              const built = await getBook();
              return { chunks: built.chunks, contents: built.contents };
            },
          }),
        );
        scheduler.register(
          createOrderTask({
            tier: 'top',
            chapterMode,
            orderFile: store.orderFile,
            jobFile: store.jobFile,
            model: () => orderJobModel,
            getInputs: async () => {
              const built = await getBook();
              return {
                book: built.book,
                chunks: built.chunks,
                graph: built.graph,
                chunkGraph: built.chunkGraph,
                storyComposition: built.storyComposition,
                chapterInput: built.chapterInput,
                config: storyConfig,
              };
            },
            rawInvoke: options.orderInvoke
              ? (prompt) => options.orderInvoke!(prompt, orderJobModel, store.dataHome)
              : undefined,
          }),
        );
        return { scheduler, ledger };
      })(),
      () => (glueCache = undefined),
    ));

  // Auto-kick the chunk-narration task on compile, in the scheduler's background lane (serial after
  // order). Double-gated: `glueEnabled` (the master switch the test corpus disables) AND the
  // narration-only `autoNarration` opt-out. Fail-open — a store/scheduler hiccup just means no auto
  // narration this compile.
  async function maybeAutoKickChunkNarration(): Promise<void> {
    if (!glueEnabled || !autoNarration) return;
    try {
      const { scheduler } = await getGlue();
      await scheduler.kick(CHUNK_NARRATION_KIND);
    } catch {
      // no auto narration this compile
    }
  }

  app.get('/api/health', (c) => c.json({ ok: true, name: 'code-story', core: CORE_VERSION }));

  app.get('/api/glue', async (c) => {
    const { scheduler } = await getGlue();
    return c.json(await scheduler.status());
  });

  app.get('/api/diff', async (c) => {
    return c.json({ ...options.range, files: await getDiff() });
  });

  app.get('/api/book', async (c) => {
    // Optional `direction`/`testPlacement` override the launch config for this request (#114); an
    // unknown value is ignored (resolveStoryConfig), absent params ⇒ the launch config unchanged.
    const requestConfig = resolveStoryConfig(storyConfig, {
      direction: c.req.query('direction'),
      testPlacement: c.req.query('testPlacement'),
    });
    const built = await getBookForConfig(requestConfig);
    const { book, chunks, contents, graph } = built;
    const diffs = Object.fromEntries(
      chunks.map((chunk) => [chunk.id, unifiedChunkLines(chunk, contents.get(chunk.file))]),
    );
    const response: BookResponse = {
      ...options.range,
      book,
      chunks,
      diffs,
      graph,
      chunkGraph: built.chunkGraph ?? { edges: [] },
      config: requestConfig,
    };
    // The AI order overlay was generated under the launch config, so its fingerprint matches only
    // the launch chapter book — apply it only for that config (recomposed per request in ms; the
    // web can't build a chapter book itself). Other configs serve the deterministic tier-0 book and
    // the web reads the absent `aiBook` as "deterministic order".
    // Ambitious path (deferred, #114): per-config AI order jobs so every config's order is AI-augmented.
    const isLaunchConfig = storyConfigKey(requestConfig) === storyConfigKey(storyConfig);
    if (isLaunchConfig && chapterMode && built.chapterInput) {
      const overlay = await loadOverlay((await getStore()).orderFile);
      if (overlay?.version === 2) {
        const aiBook = applyChapterOverlay(built.chapterInput, storyConfig, overlay);
        if (aiBook) response.aiBook = aiBook.book;
      }
    }
    return c.json(response);
  });

  // Running, or queued behind a background sibling — the one signal GET /api/order's `job` field and
  // its orphan resolution read, since the scheduler (not a per-job handle) owns the lifecycle.
  const orderActive = async (): Promise<boolean> => {
    const a = (await getGlue()).scheduler.activity(ORDER_KIND);
    return a.running > 0 || a.queued > 0;
  };

  app.get('/api/order', async (c) => {
    const { orderFile, jobFile } = await getStore();
    const [overlay, stored, { book }, active] = await Promise.all([
      loadOverlay(orderFile),
      loadJobRecord(jobFile),
      getBook(),
      orderActive(),
    ]);
    const fresh = overlay !== null && isOverlayFresh(book, overlay) ? overlay : null;
    const job = await resolveJobRecord(stored, active, () => loadJobRecord(jobFile));
    const response: OrderResponse = { overlay: fresh, job: job && jobSummary(job) };
    return c.json(response);
  });

  app.post('/api/order-job', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { model?: string };
    const { jobFile } = await getStore();
    // Task-scoped model override (order-only): the running task reads this getter (single-flight).
    orderJobModel = body.model ?? (options.orderModel ?? 'opus');
    // Forced kick: an explicit POST retries a fingerprint the failed set parked under auto-kick (#71),
    // and 202/200 derives from whether it enqueued (started) or found the job already running.
    const result = await (await getGlue()).scheduler.kick(ORDER_KIND, { force: true });
    const record = await loadJobRecord(jobFile);
    return c.json({ job: record && jobSummary(record) }, result.enqueued.length > 0 ? 202 : 200);
  });

  // Default-on (#71): kick the ordering job on compile. A bare kick suffices — the scheduler's
  // isFresh check, dedupe and per-lifetime failed set gate it (no fresh overlay, not in flight, not
  // already failed this lifetime). Fail-open: a hiccup just means no auto order; the book serves tier 0.
  async function maybeAutoKickOrder(): Promise<void> {
    if (!autoOrder) return;
    try {
      await (await getGlue()).scheduler.kick(ORDER_KIND);
    } catch {
      // no auto order this compile
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
    const { narrationFile, narrationJobFile, narrationChunksFile } = await getStore();
    const [overlay, stored, { book }, chunkOverlay] = await Promise.all([
      loadNarrationOverlay(narrationFile),
      loadNarrationJobRecord(narrationJobFile),
      getBook(),
      loadChunkNarrationOverlay(narrationChunksFile),
    ]);
    const filtered = overlay !== null ? filterFreshNarration(book, options.range.head, overlay) : null;
    const job = await narrationRuntime.resolve(stored, () => loadNarrationJobRecord(narrationJobFile));
    // Chunk narration v2 (spec 06 slice 5): fresh-filter the separate overlay and project it to
    // line/badge; the v1 fields above are unchanged.
    const chunkEntries = chunkOverlay
      ? Object.fromEntries(
          Object.entries(filterFreshNarrationV2(options.range.head, chunkOverlay).chunks).map(([id, e]) => [
            id,
            { ...(e.line !== undefined ? { line: e.line } : {}), ...(e.badge !== undefined ? { badge: e.badge } : {}) },
          ]),
        )
      : undefined;
    const response: NarrationResponse = {
      overlay: filtered,
      ...(chunkEntries ? { chunkEntries } : {}),
      job: job && narrationJobSummary(job),
    };
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
      void maybeAutoKickChunkNarration();
      resolve({ port: info.port, url, close: () => server.close() });
    });
  });
}
