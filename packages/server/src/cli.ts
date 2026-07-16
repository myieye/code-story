#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { checkCoverage, checkOrder, compileBook, exportBookMarkdown, isLowSignal, lowSignalReason } from '@code-story/core';
import open from 'open';
import { computeChunks } from './chunks.js';
import { diffRange, resolveRange } from './git.js';
import { startServer } from './server.js';

const args = process.argv.slice(2);
const noOpen = args.includes('--no-open');
const dumpDiff = args.includes('--dump-diff');
const dumpChunks = args.includes('--dump-chunks');
const dumpGraph = args.includes('--dump-graph');
const checkOrderFlag = args.includes('--check-order');
const exportIndex = args.indexOf('--export');
const exportPath = exportIndex >= 0 ? args[exportIndex + 1] : undefined;
const portIndex = args.indexOf('--port');
const port = portIndex >= 0 ? Number(args[portIndex + 1]) : 0;
const valueIndexes = new Set([exportIndex + 1, portIndex + 1].filter((i) => i > 0));
const range = args.find((a, i) => !a.startsWith('--') && !valueIndexes.has(i));
const repo = process.cwd();

if (!range || (exportIndex >= 0 && !exportPath) || Number.isNaN(port)) {
  console.error(
    'Usage: code-story <base>..<head> [--export book.md] [--port <n>] [--dump-diff] [--dump-chunks] [--dump-graph] [--check-order] [--no-open]',
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
    const lines = c.hunks.reduce((n, h) => n + Math.max(h.headCount, h.baseCount), 0);
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

if (exportPath) {
  const files = await diffRange(repo, resolved);
  const { chunks, contents, graph } = await computeChunks(repo, resolved, files);
  const compiled = compileBook({ files, chunks, graph, headSha: resolved.head });
  await writeFile(exportPath, exportBookMarkdown({ ...compiled, contents, title: range }));

  const leftovers = compiled.chunks.length - chunks.length;
  console.log(
    `wrote ${exportPath}: ${compiled.chunks.length} chunks, ${compiled.book.sections.length} sections` +
      (leftovers > 0 ? ` — WARNING: ${leftovers} leftover chunks (chunker gaps)` : ''),
  );
  process.exit(0);
}

const { url } = await startServer({ repo, range: resolved }, port);

console.log(`code-story serving ${range} (${resolved.base.slice(0, 8)}..${resolved.head.slice(0, 8)}) at ${url}`);
console.log('Ctrl+C to stop.');

if (!noOpen) {
  await open(url);
}
