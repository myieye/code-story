#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  applyChapterOverlay,
  applyOrderOverlay,
  type Book,
  buildOrderManifest,
  checkCoverage,
  checkOrder,
  type Chunk,
  chunkLineCount,
  compileBook,
  compileChapterBook,
  type ContextPayload,
  type ContextStoreFile,
  DEFAULT_STORY_CONFIG,
  type FileContents,
  type FileDiff,
  type ImportGraph,
  type LineRange,
  exportBookMarkdown,
  filterFreshContext,
  filterFreshNarration,
  isFileModeConfig,
  isLowSignal,
  type NarrationOverlay,
  lowSignalReason,
  renderOrderManifest,
  resolveStoryConfig,
  type StoryConfig,
} from '@code-story/core';
import open from 'open';
import { buildChunkGraph } from './chunk-graph-build.js';
import { computeChunks } from './chunks.js';
import { extractReferences } from './references.js';
import { createContextResolver } from './context-resolve.js';
import { eligibleContextChunks, runContextJob } from './context-job.js';
import {
  type ContextJobRecord,
  contextFilePath,
  contextJobFilePath,
  DEFAULT_CONTEXT_STORE_CAP_BYTES,
  loadContextStore,
  persistContextPayload,
} from './context-store.js';
import { CHUNK_NARRATION_KIND, createChunkNarrationTask } from './chunk-narration-task.js';
import { diffRange, fileAt, listTree, originUrl, resolveRange, type ResolvedRange, rootCommit } from './git.js';
import { createGlueInvoker } from './glue/invoker.js';
import { GlueLedger, glueLedgerFilePath } from './glue/ledger.js';
import { createModelPolicy } from './glue/model-policy.js';
import { GlueScheduler } from './glue/scheduler.js';
import { buildLinks } from './links.js';
import { runNarrationJob } from './narration-job.js';
import { NARRATION_PROMPT_VERSION } from './narration-prompt.js';
import {
  loadChunkNarrationOverlay,
  loadNarrationOverlay,
  type NarrationJobRecord,
  narrationChunksFilePath,
  narrationFilePath,
  narrationJobFilePath,
} from './narration-store.js';
import { createOrderTask, ORDER_KIND } from './order-task.js';
import { loadOverlay, orderFilePath, orderJobFilePath, saveJson } from './order-store.js';
import { defaultDataHome, repoIdFrom } from './review-store.js';
import { startServer } from './server.js';

/** Human-readable dump of the fresh stored payloads (spec 04 `--dump-context` for dogfooding). */
async function dumpStoredContext(
  store: ContextStoreFile,
  book: Book,
  headSha: string,
  chunks: Chunk[],
  // --verbose (#93): re-extract each chunk's references and list the names that resolved to nothing,
  // so resolver-reach dogfoods don't need throwaway scripts.
  verbose?: { contents: Map<string, FileContents>; files: FileDiff[] },
): Promise<void> {
  const fresh = filterFreshContext(headSha, book, store);
  const ids = Object.keys(fresh);
  const label = (id: string) => {
    const c = chunks.find((k) => k.id === id);
    return c ? `${c.file}${c.symbolPath.length ? ' :: ' + c.symbolPath.join('.') : ''}` : id;
  };
  const statusByFile = verbose && new Map(verbose.files.map((f) => [f.path, f.status]));
  for (const id of ids) {
    const payload = fresh[id]!;
    console.log(`\n▸ ${label(id)}  [${id}]`);
    if (payload.facts.definitions.length === 0) console.log('  (no resolved definitions)');
    for (const d of payload.facts.definitions) {
      console.log(`  def ${d.symbol} — ${d.file}@${d.sha.slice(0, 8)} (L${d.lineStart}, ${d.changed ? 'changed' : 'unchanged'})`);
      for (const line of d.body.split('\n').slice(0, 3)) console.log(`      ${line}`);
    }
    if (verbose && statusByFile) {
      const chunk = chunks.find((k) => k.id === id);
      const unresolved = chunk ? await unresolvedNames(chunk, payload, verbose.contents, statusByFile) : [];
      if (unresolved.length > 0) console.log(`  unresolved: ${unresolved.join(', ')}`);
    }
    const { imports, importedBy } = payload.facts.edges;
    if (imports.length || importedBy.length) {
      console.log(`  edges: imports [${imports.join(', ')}] importedBy [${importedBy.join(', ')}]`);
    }
  }
  console.log(`\n${ids.length} chunks with fresh payloads (of ${Object.keys(store.payloads).length} stored)`);
}

/** Reference names in the chunk's changed lines that resolved to no definition, in source order. */
async function unresolvedNames(
  chunk: Chunk,
  payload: ContextPayload,
  contents: Map<string, FileContents>,
  statusByFile: Map<string, FileDiff['status']>,
): Promise<string[]> {
  const side = statusByFile.get(chunk.file) === 'deleted' ? 'base' : 'head';
  const lines = side === 'base' ? contents.get(chunk.file)?.base : contents.get(chunk.file)?.head;
  if (lines === undefined) return [];
  const ranges: LineRange[] = [];
  for (const h of chunk.hunks) {
    const start = side === 'head' ? h.headStart : h.baseStart;
    const count = side === 'head' ? h.headCount : h.baseCount;
    if (count > 0) ranges.push({ start, end: start + count - 1 });
  }
  const refs = await extractReferences(chunk.file, lines.join('\n'), ranges);
  const resolved = new Set(payload.facts.definitions.map((d) => d.symbol));
  return [...new Set(refs.map((r) => r.name))].filter((n) => !resolved.has(n));
}

const args = process.argv.slice(2);
const noOpen = args.includes('--no-open');
const dumpDiff = args.includes('--dump-diff');
const dumpChunks = args.includes('--dump-chunks');
const dumpGraph = args.includes('--dump-graph');
const dumpChunkGraph = args.includes('--dump-chunk-graph');
const checkOrderFlag = args.includes('--check-order');
const dumpManifest = args.includes('--dump-manifest');
const dumpGlue = args.includes('--dump-glue');
const aiOrder = args.includes('--ai-order');
const noAiOrder = args.includes('--no-ai-order') || Boolean(process.env.CODE_STORY_NO_AI_ORDER);
const narrate = args.includes('--narrate');
const narrateChunks = args.includes('--narrate-chunks');
const noAiNarration = args.includes('--no-ai-narration') || Boolean(process.env.CODE_STORY_NO_AI_NARRATION);
const narration = args.includes('--narration');
const contextFlag = args.includes('--context');
const dumpContext = args.includes('--dump-context');
const verboseFlag = args.includes('--verbose');
const exportIndex = args.indexOf('--export');
const exportPath = exportIndex >= 0 ? args[exportIndex + 1] : undefined;
const portIndex = args.indexOf('--port');
const port = portIndex >= 0 ? Number(args[portIndex + 1]) : 0;
const modelIndex = args.indexOf('--model');
const model = modelIndex >= 0 ? args[modelIndex + 1] : 'opus';
const orderIndex = args.indexOf('--order');
const orderChoice = orderIndex >= 0 ? args[orderIndex + 1] : 'tier0';
const directionIndex = args.indexOf('--direction');
const directionArg = directionIndex >= 0 ? args[directionIndex + 1] : undefined;
const testPlacementIndex = args.indexOf('--test-placement');
const testPlacementArg = testPlacementIndex >= 0 ? args[testPlacementIndex + 1] : undefined;
const prUrlIndex = args.indexOf('--pr-url');
const prUrl = prUrlIndex >= 0 ? args[prUrlIndex + 1] : undefined;
const appUrlIndex = args.indexOf('--app-url');
const appUrl = appUrlIndex >= 0 ? args[appUrlIndex + 1] : undefined;
const appLabelIndex = args.indexOf('--app-label');
const appLabel = appLabelIndex >= 0 ? args[appLabelIndex + 1] : undefined;
const valueIndexes = new Set(
  [
    exportIndex + 1,
    portIndex + 1,
    modelIndex + 1,
    orderIndex + 1,
    directionIndex + 1,
    testPlacementIndex + 1,
    prUrlIndex + 1,
    appUrlIndex + 1,
    appLabelIndex + 1,
  ].filter((i) => i > 0),
);
const range = args.find((a, i) => !a.startsWith('--') && !valueIndexes.has(i));
const repo = process.cwd();

/**
 * Effective story config (spec 05, R-045): defaults, overlaid with a per-repo `.code-story.json`
 * (top-level or under `ordering`), then CLI flags. Unknown/malformed values are ignored, not fatal.
 * The active default is chapter mode (consumer-first, tests before, R-043/R-044); file mode is
 * selectable via `--direction dependency-first --test-placement after` or config.
 */
async function effectiveStoryConfig(): Promise<StoryConfig> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path.join(repo, '.code-story.json'), 'utf8'));
  } catch {
    raw = undefined;
  }
  const fileOrdering = (raw as { ordering?: unknown })?.ordering ?? raw;
  const fromFile = resolveStoryConfig(DEFAULT_STORY_CONFIG, fileOrdering as Record<string, unknown> | undefined);
  return resolveStoryConfig(fromFile, { direction: directionArg, testPlacement: testPlacementArg });
}

/**
 * One diff + chunk + compile pass, shared by every flag branch that needs the compiled book — a
 * second tree-sitter pass costs ~30s on very large ranges. `book`/`compiled` are the file-mode
 * compile; `chunks` are the raw (pre-compile) chunks.
 */
async function withCompiled(range: ResolvedRange): Promise<{
  files: FileDiff[];
  chunks: Chunk[];
  contents: Map<string, FileContents>;
  graph: ImportGraph;
  book: Book;
  compiled: Chunk[];
}> {
  const files = await diffRange(repo, range);
  const { chunks, contents, graph } = await computeChunks(repo, range, files);
  const { book, chunks: compiled } = compileBook({ files, chunks, graph, headSha: range.head });
  return { files, chunks, contents, graph, book, compiled };
}

if (
  !range ||
  (exportIndex >= 0 && !exportPath) ||
  Number.isNaN(port) ||
  !model ||
  (orderChoice !== 'tier0' && orderChoice !== 'ai') ||
  (directionArg !== undefined && directionArg !== 'consumer-first' && directionArg !== 'dependency-first') ||
  (testPlacementArg !== undefined && !['before', 'after', 'end'].includes(testPlacementArg))
) {
  console.error(
    'Usage: code-story <base>..<head> [--export book.md] [--narration] [--order tier0|ai] [--ai-order] [--no-ai-order] [--narrate] [--narrate-chunks] [--no-ai-narration] [--context] [--dump-context [--verbose]] [--model <id>] [--port <n>] [--direction consumer-first|dependency-first] [--test-placement before|after|end] [--pr-url <url>] [--app-url <url>] [--app-label <text>] [--dump-diff] [--dump-chunks] [--dump-graph] [--dump-chunk-graph] [--check-order] [--dump-manifest] [--dump-glue] [--no-open]\n' +
      '\n' +
      'AI reading order is the default: the daemon runs the ordering job in the background on\n' +
      'compile and applies it on the next book load. --no-ai-order (or CODE_STORY_NO_AI_ORDER)\n' +
      'disables the auto job; the book then stays in tier-0 (deterministic) order. --order tier0\n' +
      'forces tier-0 order on --export.\n' +
      '\n' +
      '--direction / --test-placement (or a per-repo .code-story.json) tune the chapter\n' +
      'linearizer: call-path chapters that may span files. The defaults are consumer-first, tests\n' +
      'before their impl (R-043/R-044). Select the file-section linearizer with --direction\n' +
      'dependency-first --test-placement after. Honoured by the daemon, --export, and --check-order.\n' +
      '\n' +
      '--pr-url / --app-url / --app-label add book-level links to the UI: the pull request page, its\n' +
      "GitHub Files-changed tab (derived from --pr-url), and a locally running build of the PR's app.",
  );
  process.exit(1);
}

const resolved = await resolveRange(repo, range);

if (dumpDiff) {
  const files = await diffRange(repo, resolved);
  console.log(JSON.stringify({ ...resolved, files }, null, 2));
  process.exit(0);
}

if (dumpChunks) {
  const { files, chunks } = await withCompiled(resolved);

  for (const c of chunks) {
    const lines = chunkLineCount(c);
    const stub = isLowSignal(c) ? ` [stub: ${lowSignalReason(c)}]` : '';
    console.log(
      `${c.kind.padEnd(15)} ${c.file}${c.symbolPath.length ? ' :: ' + c.symbolPath.join('.') : ''} (~${lines} lines)${stub}`,
    );
  }
  console.log(`\n${chunks.length} chunks over ${files.length} files`);
  const coverage = checkCoverage(files, chunks);
  console.log(
    coverage.ok
      ? `coverage: OK (${coverage.expected} changed lines, all owned exactly once)`
      : `coverage: FAILED — missing ${coverage.missing.length} (${coverage.missing.slice(0, 5).join(', ')}), duplicated ${coverage.duplicated.length}`,
  );
  process.exit(coverage.ok ? 0 : 1);
}

if (dumpGraph) {
  const { graph } = await withCompiled(resolved);
  for (const edge of graph.edges) console.log(`${edge.from} -> ${edge.to}`);
  console.log(`\n${graph.edges.length} edges, ${graph.unresolved} unresolved specifiers`);
  process.exit(0);
}

if (dumpChunkGraph) {
  const { files, contents, graph, book, compiled } = await withCompiled(resolved);
  const cg = await buildChunkGraph({ chunks: compiled, contents, graph, book, files, headSha: resolved.head });

  const label = (id: string) => {
    const c = compiled.find((k) => k.id === id);
    return c ? `${c.file}${c.symbolPath.length ? ' :: ' + c.symbolPath.join('.') : ''}` : id;
  };
  const byKind: Record<string, number> = {};
  for (const e of cg.edges) {
    byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
    const lines = e.fromLines.map((r) => (r.start === r.end ? `${r.start}` : `${r.start}-${r.end}`)).join(',');
    console.log(`${label(e.from)}  →  ${label(e.to)}  [${e.kind}, ${e.source}${lines ? `, L${lines}` : ''}]`);
  }
  const summary = Object.entries(byKind)
    .map(([k, n]) => `${n} ${k}`)
    .join(', ');
  console.log(`\n${cg.edges.length} edges${summary ? ` (${summary})` : ''} over ${compiled.length} chunks`);
  process.exit(0);
}

if (checkOrderFlag) {
  const { files, chunks, contents, graph, book: fileBook, compiled: fileChunks } = await withCompiled(resolved);
  const config = await effectiveStoryConfig();

  let book;
  let report;
  if (isFileModeConfig(config)) {
    book = fileBook;
    report = checkOrder(book, graph, chunks);
  } else {
    const cg = await buildChunkGraph({
      chunks: fileChunks,
      contents,
      graph,
      book: fileBook,
      files,
      headSha: resolved.head,
    });
    const chunkGraph = { edges: cg.edges };
    const compiled = compileChapterBook({ files, chunks, graph, chunkGraph, headSha: resolved.head }, config);
    book = compiled.book;
    report = checkOrder(book, graph, compiled.chunks, { config, chunkGraph });
    console.log(`config: direction=${config.direction}, test-placement=${config.testPlacement} (chapter mode)`);
  }

  for (const inv of report.importInversions) console.log(`order inversion: ${inv.earlier} reads before ${inv.later}`);
  for (const inv of report.cycleInversions) console.log(`cycle inversion (unavoidable): ${inv.earlier} <-> ${inv.later}`);
  for (const inv of report.testBeforeImpl) console.log(`test-placement violation: ${inv.test} vs ${inv.impl}`);
  const counts = `${report.importInversions.length} import inversions, ${report.testBeforeImpl.length} test-placement, ${report.cycleInversions.length} within cycles`;
  console.log(report.ok ? `order: OK (${book.sections.length} sections, ${counts})` : `order: FAILED — ${counts}`);
  process.exit(report.ok ? 0 : 1);
}

if (dumpManifest) {
  const { chunks, graph, book } = await withCompiled(resolved);
  const manifest = buildOrderManifest(book, graph, chunks);

  console.log(renderOrderManifest(manifest));
  console.log(
    `\nmanifest: ${manifest.sections.length} story sections, ${manifest.pinnedTail.length} pinned, ~${manifest.estimatedTokens} tokens`,
  );
  process.exit(0);
}

if (dumpGlue) {
  const dataHome = defaultDataHome();
  const repoId = repoIdFrom(repo, await rootCommit(repo), await originUrl(repo));
  const policy = createModelPolicy();
  const ledger = new GlueLedger(glueLedgerFilePath(dataHome, repoId, resolved));
  const invoker = createGlueInvoker({ policy, ledger, cwd: dataHome });
  const scheduler = new GlueScheduler({ invoker, ledger, policy, enabled: !noAiOrder });
  console.log(JSON.stringify(await scheduler.status(), null, 2));
  process.exit(0);
}

// Run the chunk-narration glue task once (manual/CI). Kicks the scheduler, polls status until the
// task drains, then reports the overlay size. Narration v2 is order-independent, so file-mode chunks
// are the right input regardless of the reading order the daemon serves.
if (narrateChunks) {
  const { contents, compiled } = await withCompiled(resolved);
  const dataHome = defaultDataHome();
  const repoId = repoIdFrom(repo, await rootCommit(repo), await originUrl(repo));
  const policy = createModelPolicy({ top: model });
  const ledger = new GlueLedger(glueLedgerFilePath(dataHome, repoId, resolved));
  const invoker = createGlueInvoker({ policy, ledger, cwd: dataHome });
  const scheduler = new GlueScheduler({ invoker, ledger, policy, enabled: true });
  const overlayFile = narrationChunksFilePath(dataHome, repoId, resolved);
  scheduler.register(
    createChunkNarrationTask({
      headSha: resolved.head,
      tier: 'top',
      model: policy.resolve('top'),
      overlayFile,
      getInputs: async () => ({ chunks: compiled, contents }),
    }),
  );

  console.log(`code-story: narrating chunks (${model})…`);
  await scheduler.kick(CHUNK_NARRATION_KIND, { force: true });
  for (;;) {
    const task = (await scheduler.status()).tasks.find((t) => t.kind === CHUNK_NARRATION_KIND);
    if (!task || (task.queued === 0 && task.running === 0)) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  await scheduler.shutdown();

  const overlay = await loadChunkNarrationOverlay(overlayFile);
  console.log(`code-story: chunk narration saved (${overlay ? Object.keys(overlay.chunks).length : 0} chunks)`);
  process.exit(0);
}

if (contextFlag) {
  const { files, contents, graph, book, compiled } = await withCompiled(resolved);
  const dataHome = defaultDataHome();
  const repoId = repoIdFrom(repo, await rootCommit(repo), await originUrl(repo));
  const contextFile = contextFilePath(dataHome, repoId, resolved);
  const jobFile = contextJobFilePath(dataHome, repoId, resolved);

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
  await saveJson(jobFile, record);

  const store = await loadContextStore(contextFile);
  const headPaths = new Set(await listTree(repo, resolved.head));
  const resolver = createContextResolver({
    fileAt: async (sha, filePath) => fileAt(repo, sha, filePath).catch(() => undefined),
    headPaths,
    headSha: resolved.head,
    baseSha: resolved.base,
  });
  const changedFiles = files.map((f) => ({ path: f.path, status: f.status }));
  const eligible = eligibleContextChunks(book, compiled);
  const freshIds = new Set(Object.keys(filterFreshContext(resolved.head, book, store)));

  console.log(`code-story: filling context payloads — ${eligible.length} eligible chunks, ${freshIds.size} already fresh…`);
  try {
    const result = await runContextJob({
      eligibleChunks: eligible,
      freshIds,
      resolve: (chunk) => resolver.resolve(chunk, changedFiles, graph),
      persist: async (payload) => {
        const result = await persistContextPayload(contextFile, store, payload, DEFAULT_CONTEXT_STORE_CAP_BYTES);
        if (result.persisted) store.payloads[payload.chunkId] = payload;
        return result;
      },
    });
    await saveJson(jobFile, { ...record, status: 'done', finishedAt: new Date().toISOString(), ...result });
    console.log(
      `code-story: context filled — ${result.computed} computed, ${result.skipped} skipped (already fresh), ` +
        `${result.chunksDone}/${result.chunksTotal} chunks stored` +
        (result.capped
          ? ` — STORE CAP hit, ${result.cappedCount} chunks left unfilled (on-demand GET still resolves them)`
          : ''),
    );
  } catch (e) {
    await saveJson(jobFile, {
      ...record,
      status: 'failed',
      finishedAt: new Date().toISOString(),
      error: (e as Error).message,
    });
    throw e;
  }

  if (dumpContext) {
    await dumpStoredContext(
      await loadContextStore(contextFile),
      book,
      resolved.head,
      compiled,
      verboseFlag ? { contents, files } : undefined,
    );
  }
  process.exit(0);
}

if (dumpContext) {
  const { files, contents, book, compiled } = await withCompiled(resolved);
  const dataHome = defaultDataHome();
  const repoId = repoIdFrom(repo, await rootCommit(repo), await originUrl(repo));
  const store = await loadContextStore(contextFilePath(dataHome, repoId, resolved));
  await dumpStoredContext(store, book, resolved.head, compiled, verboseFlag ? { contents, files } : undefined);
  process.exit(0);
}

// --ai-order, --narrate and --export share one invocation (and one compile pass) so a combined
// one-shot run doesn't parse twice.
if (aiOrder || narrate || exportPath) {
  const { files, chunks, contents, graph, book: compiledBook, compiled: compiledChunks } = await withCompiled(resolved);
  const dataHome = defaultDataHome();
  const repoId = repoIdFrom(repo, await rootCommit(repo), await originUrl(repo));
  const orderFile = orderFilePath(dataHome, repoId, resolved);
  const narrationFile = narrationFilePath(dataHome, repoId, resolved);
  const config = await effectiveStoryConfig();
  const chapterMode = !isFileModeConfig(config);

  // Chapter-mode artifacts (chunk graph + tier-0 chapter book), built once and shared by the
  // order job and the export.
  const buildChapterBits = async () => {
    const cg = await buildChunkGraph({ chunks: compiledChunks, contents, graph, book: compiledBook, files, headSha: resolved.head });
    const chunkGraph = { edges: cg.edges };
    const chapterInput = { files, chunks, graph, chunkGraph, headSha: resolved.head };
    return { chunkGraph, chapterInput, chapter: compileChapterBook(chapterInput, config) };
  };
  let chapterBitsCache: Awaited<ReturnType<typeof buildChapterBits>> | undefined;
  const getChapterBits = async () => (chapterBitsCache ??= await buildChapterBits());

  if (aiOrder) {
    // Drive the ordering glue task through a throwaway scheduler (same shape as --narrate-chunks):
    // the task owns the overlay save, the `.order-job.json` lifecycle, and the retry loop, so this
    // branch is just build-deps → kick → drain. The ledger records the spawn.
    const policy = createModelPolicy({ top: model });
    const ledger = new GlueLedger(glueLedgerFilePath(dataHome, repoId, resolved));
    const invoker = createGlueInvoker({ policy, ledger, cwd: dataHome });
    const scheduler = new GlueScheduler({ invoker, ledger, policy, enabled: true });
    const bits = chapterMode ? await getChapterBits() : undefined;
    scheduler.register(
      createOrderTask({
        tier: 'top',
        chapterMode,
        orderFile,
        jobFile: orderJobFilePath(dataHome, repoId, resolved),
        model: () => model,
        getInputs: async () =>
          bits
            ? {
                book: bits.chapter.book,
                chunks: bits.chapter.chunks,
                graph,
                chunkGraph: bits.chunkGraph,
                storyComposition: bits.chapter.storyComposition,
                chapterInput: bits.chapterInput,
                config,
              }
            : { book: compiledBook, chunks: compiledChunks, graph },
      }),
    );

    console.log(`code-story: running the AI ordering job (${model})…`);
    await scheduler.kick(ORDER_KIND, { force: true });
    for (;;) {
      const task = (await scheduler.status()).tasks.find((t) => t.kind === ORDER_KIND);
      if (!task || (task.queued === 0 && task.running === 0)) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    await scheduler.shutdown();

    const overlay = await loadOverlay(orderFile);
    if (overlay?.version === 2) console.log(`code-story: AI order saved (${overlay.chapters.length} chapters)`);
    else if (overlay?.version === 1) console.log(`code-story: AI order saved (${overlay.permutation.length} story sections)`);
    else console.error('code-story: AI ordering produced no overlay (see the .order-job.json record)');
  }

  if (narrate) {
    const jobFile = narrationJobFilePath(dataHome, repoId, resolved);
    const record: NarrationJobRecord = {
      version: 1,
      status: 'running',
      model,
      promptVersion: NARRATION_PROMPT_VERSION,
      startedAt: new Date().toISOString(),
      sectionsTotal: 0,
      sectionsDone: 0,
    };
    await saveJson(jobFile, record);
    console.log(`code-story: running the narration job (${model})…`);
    try {
      const result = await runNarrationJob({
        book: compiledBook,
        graph,
        chunks: compiledChunks,
        contents,
        headSha: resolved.head,
        model,
        cwd: dataHome,
        overlayFile: narrationFile,
        onProgress: (done, total) => {
          record.sectionsDone = done;
          record.sectionsTotal = total;
        },
      });
      await saveJson(jobFile, {
        ...record,
        status: 'done',
        finishedAt: new Date().toISOString(),
        sectionsTotal: result.sectionsTotal,
        sectionsDone: result.sectionsDone,
      });
      console.log(`code-story: narration saved (${result.sectionsDone}/${result.sectionsTotal} sections)`);
    } catch (e) {
      await saveJson(jobFile, {
        ...record,
        status: 'failed',
        finishedAt: new Date().toISOString(),
        error: (e as Error).message,
      });
      throw e;
    }
  }

  if (exportPath) {
    let book = compiledBook;
    let exportChunks = compiledChunks;
    let narrationOverlay: NarrationOverlay | undefined;

    if (chapterMode) {
      const { chapterInput, chapter } = await getChapterBits();
      book = chapter.book;
      exportChunks = chapter.chunks;
      if (orderChoice === 'ai') {
        const overlay = await loadOverlay(orderFile);
        const applied = overlay?.version === 2 ? applyChapterOverlay(chapterInput, config, overlay) : undefined;
        if (!applied) {
          console.error('code-story: no fresh AI order overlay for this range (run --ai-order first)');
          process.exit(1);
        }
        book = applied.book;
        exportChunks = applied.chunks;
      }
      // Narration overlays are keyed to the file-mode book, so they don't apply in chapter mode.
      if (narration) console.log('code-story: narration is file-mode only and is skipped in chapter mode');
      console.log(`code-story: chapter mode (direction=${config.direction}, test-placement=${config.testPlacement})`);
    } else {
      if (orderChoice === 'ai') {
        const overlay = await loadOverlay(orderFile);
        const v1 = overlay?.version === 1 ? overlay : null;
        const applied = v1 === null ? book : applyOrderOverlay(book, graph, compiledChunks, v1);
        if (applied === book) {
          console.error('code-story: no fresh AI order overlay for this range (run --ai-order first)');
          process.exit(1);
        }
        book = applied;
      }
      if (narration) {
        const raw = await loadNarrationOverlay(narrationFile);
        if (raw === null) {
          console.error('code-story: no narration overlay for this range (run --narrate first)');
          process.exit(1);
        }
        narrationOverlay = filterFreshNarration(book, resolved.head, raw);
      }
    }

    await writeFile(
      exportPath,
      exportBookMarkdown({ book, chunks: exportChunks, contents, title: range, narration: narrationOverlay }),
    );

    const leftovers = exportChunks.length - chunks.length;
    console.log(
      `wrote ${exportPath}: ${exportChunks.length} chunks, ${book.sections.length} sections` +
        (leftovers > 0 ? ` — WARNING: ${leftovers} leftover chunks (chunker gaps)` : ''),
    );
    process.exit(0);
  }
}

const { url, shutdownGlue } = await startServer(
  {
    repo,
    range: resolved,
    autoOrder: !noAiOrder,
    autoNarration: !noAiNarration,
    orderModel: model,
    storyConfig: await effectiveStoryConfig(),
    links: buildLinks({ prUrl, appUrl, appLabel }),
  },
  port,
);

console.log(`code-story serving ${range} (${resolved.base.slice(0, 8)}..${resolved.head.slice(0, 8)}) at ${url}`);
console.log('Ctrl+C to stop.');

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void shutdownGlue().finally(() => process.exit(0));
  });
}

if (!noOpen) {
  await open(url);
}
