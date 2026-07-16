#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import {
  applyOrderOverlay,
  buildOrderManifest,
  checkCoverage,
  checkOrder,
  chunkLineCount,
  compileBook,
  exportBookMarkdown,
  isLowSignal,
  lowSignalReason,
  renderOrderManifest,
} from '@code-story/core';
import open from 'open';
import { computeChunks } from './chunks.js';
import { diffRange, originUrl, resolveRange, rootCommit } from './git.js';
import { runOrderJob } from './order-job.js';
import { ORDER_PROMPT_VERSION } from './order-prompt.js';
import { loadOverlay, orderFilePath, orderJobFilePath, type OrderJobRecord, saveJson } from './order-store.js';
import { defaultDataHome, repoIdFrom } from './review-store.js';
import { startServer } from './server.js';

const args = process.argv.slice(2);
const noOpen = args.includes('--no-open');
const dumpDiff = args.includes('--dump-diff');
const dumpChunks = args.includes('--dump-chunks');
const dumpGraph = args.includes('--dump-graph');
const checkOrderFlag = args.includes('--check-order');
const dumpManifest = args.includes('--dump-manifest');
const aiOrder = args.includes('--ai-order');
const exportIndex = args.indexOf('--export');
const exportPath = exportIndex >= 0 ? args[exportIndex + 1] : undefined;
const portIndex = args.indexOf('--port');
const port = portIndex >= 0 ? Number(args[portIndex + 1]) : 0;
const modelIndex = args.indexOf('--model');
const model = modelIndex >= 0 ? args[modelIndex + 1] : 'opus';
const orderIndex = args.indexOf('--order');
const orderChoice = orderIndex >= 0 ? args[orderIndex + 1] : 'tier0';
const valueIndexes = new Set([exportIndex + 1, portIndex + 1, modelIndex + 1, orderIndex + 1].filter((i) => i > 0));
const range = args.find((a, i) => !a.startsWith('--') && !valueIndexes.has(i));
const repo = process.cwd();

if (
  !range ||
  (exportIndex >= 0 && !exportPath) ||
  Number.isNaN(port) ||
  !model ||
  (orderChoice !== 'tier0' && orderChoice !== 'ai')
) {
  console.error(
    'Usage: code-story <base>..<head> [--export book.md] [--order tier0|ai] [--ai-order] [--model <id>] [--port <n>] [--dump-diff] [--dump-chunks] [--dump-graph] [--check-order] [--dump-manifest] [--no-open]',
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
  const files = await diffRange(repo, resolved);
  const { chunks } = await computeChunks(repo, resolved, files);

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
  const files = await diffRange(repo, resolved);
  const { graph } = await computeChunks(repo, resolved, files);
  for (const edge of graph.edges) console.log(`${edge.from} -> ${edge.to}`);
  console.log(`\n${graph.edges.length} edges, ${graph.unresolved} unresolved specifiers`);
  process.exit(0);
}

if (checkOrderFlag) {
  const files = await diffRange(repo, resolved);
  const { chunks, graph } = await computeChunks(repo, resolved, files);
  const { book } = compileBook({ files, chunks, graph, headSha: resolved.head });
  const report = checkOrder(book, graph, chunks);

  for (const inv of report.importInversions) console.log(`import inversion: ${inv.earlier} reads before ${inv.later}`);
  for (const inv of report.cycleInversions) console.log(`cycle inversion (unavoidable): ${inv.earlier} <-> ${inv.later}`);
  for (const inv of report.testBeforeImpl) console.log(`test before impl: ${inv.test} reads before ${inv.impl}`);
  const counts = `${report.importInversions.length} import inversions, ${report.testBeforeImpl.length} test-before-impl, ${report.cycleInversions.length} within cycles`;
  console.log(report.ok ? `order: OK (${book.sections.length} sections, ${counts})` : `order: FAILED — ${counts}`);
  process.exit(report.ok ? 0 : 1);
}

if (dumpManifest) {
  const files = await diffRange(repo, resolved);
  const { chunks, graph } = await computeChunks(repo, resolved, files);
  const { book } = compileBook({ files, chunks, graph, headSha: resolved.head });
  const manifest = buildOrderManifest(book, graph, chunks);

  console.log(renderOrderManifest(manifest));
  console.log(
    `\nmanifest: ${manifest.sections.length} story sections, ${manifest.pinnedTail.length} pinned, ~${manifest.estimatedTokens} tokens`,
  );
  process.exit(0);
}

// One compile pass serves both --ai-order and --export (the natural one-shot invocation
// combines them; a second tree-sitter pass costs ~30s on very large ranges).
if (aiOrder || exportPath) {
  const files = await diffRange(repo, resolved);
  const { chunks, contents, graph } = await computeChunks(repo, resolved, files);
  const compiled = compileBook({ files, chunks, graph, headSha: resolved.head });
  const dataHome = defaultDataHome();
  const repoId = repoIdFrom(repo, await rootCommit(repo), await originUrl(repo));
  const orderFile = orderFilePath(dataHome, repoId, resolved);

  if (aiOrder) {
    const jobFile = orderJobFilePath(dataHome, repoId, resolved);
    const record: OrderJobRecord = {
      version: 1,
      status: 'running',
      model,
      promptVersion: ORDER_PROMPT_VERSION,
      startedAt: new Date().toISOString(),
    };
    await saveJson(jobFile, record);
    console.log(`code-story: running the AI ordering job (${model})…`);
    try {
      const overlay = await runOrderJob({ book: compiled.book, graph, chunks: compiled.chunks, model, cwd: dataHome });
      await saveJson(orderFile, overlay);
      await saveJson(jobFile, { ...record, status: 'done', finishedAt: new Date().toISOString() });
      console.log(`code-story: AI order saved (${overlay.permutation.length} story sections)`);
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
    let book = compiled.book;
    if (orderChoice === 'ai') {
      const overlay = await loadOverlay(orderFile);
      const applied = overlay === null ? book : applyOrderOverlay(book, graph, compiled.chunks, overlay);
      if (applied === book) {
        console.error('code-story: no fresh AI order overlay for this range (run --ai-order first)');
        process.exit(1);
      }
      book = applied;
    }
    await writeFile(exportPath, exportBookMarkdown({ book, chunks: compiled.chunks, contents, title: range }));

    const leftovers = compiled.chunks.length - chunks.length;
    console.log(
      `wrote ${exportPath}: ${compiled.chunks.length} chunks, ${compiled.book.sections.length} sections` +
        (leftovers > 0 ? ` — WARNING: ${leftovers} leftover chunks (chunker gaps)` : ''),
    );
    process.exit(0);
  }
}

const { url } = await startServer({ repo, range: resolved }, port);

console.log(`code-story serving ${range} (${resolved.base.slice(0, 8)}..${resolved.head.slice(0, 8)}) at ${url}`);
console.log('Ctrl+C to stop.');

if (!noOpen) {
  await open(url);
}
