#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { compileBook, exportBookMarkdown } from '@code-story/core';
import open from 'open';
import { computeChunks } from './chunks.js';
import { diffRange, resolveRange } from './git.js';
import { startServer } from './server.js';

const args = process.argv.slice(2);
const noOpen = args.includes('--no-open');
const dumpDiff = args.includes('--dump-diff');
const dumpChunks = args.includes('--dump-chunks');
const exportIndex = args.indexOf('--export');
const exportPath = exportIndex >= 0 ? args[exportIndex + 1] : undefined;
const range = args.find((a, i) => !a.startsWith('--') && (exportIndex < 0 || i !== exportIndex + 1));
const repo = process.cwd();

if (!range || (exportIndex >= 0 && !exportPath)) {
  console.error('Usage: code-story <base>..<head> [--export book.md] [--dump-diff] [--dump-chunks] [--no-open]');
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

  // R-001 self-check on the real diff: chunk-owned lines must equal the diff's changed lines
  const owned = new Map<string, number>();
  const expected = new Set<string>();
  for (const f of files) {
    const del = f.status === 'deleted';
    for (const h of f.hunks) {
      const [start, count] = del ? [h.baseStart, h.baseCount] : [h.headStart, h.headCount];
      for (let i = 0; i < count; i++) expected.add(`${f.path}:${start + i}`);
    }
  }
  const fileStatus = new Map(files.map((f) => [f.path, f.status]));
  for (const c of chunks) {
    const del = fileStatus.get(c.file) === 'deleted';
    for (const h of c.hunks) {
      const [start, count] = del ? [h.baseStart, h.baseCount] : [h.headStart, h.headCount];
      for (let i = 0; i < count; i++) {
        const key = `${c.file}:${start + i}`;
        owned.set(key, (owned.get(key) ?? 0) + 1);
      }
    }
  }
  const missing = [...expected].filter((k) => !owned.has(k));
  const duplicated = [...owned].filter(([, n]) => n > 1);

  for (const c of chunks) {
    const lines = c.hunks.reduce((n, h) => n + Math.max(h.headCount, h.baseCount), 0);
    console.log(
      `${c.kind.padEnd(15)} ${c.file}${c.symbolPath.length ? ' :: ' + c.symbolPath.join('.') : ''} (~${lines} lines)`,
    );
  }
  console.log(`\n${chunks.length} chunks over ${files.length} files`);
  console.log(
    missing.length === 0 && duplicated.length === 0
      ? `coverage: OK (${expected.size} changed lines, all owned exactly once)`
      : `coverage: FAILED — missing ${missing.length} (${missing.slice(0, 5).join(', ')}), duplicated ${duplicated.length}`,
  );
  process.exit(missing.length === 0 && duplicated.length === 0 ? 0 : 1);
}

if (exportPath) {
  const files = await diffRange(repo, resolved);
  const { chunks, contents } = await computeChunks(repo, resolved, files);
  const compiled = compileBook({ files, chunks, headSha: resolved.head });
  await writeFile(exportPath, exportBookMarkdown({ ...compiled, contents, title: range }));

  const leftovers = compiled.chunks.length - chunks.length;
  console.log(
    `wrote ${exportPath}: ${compiled.chunks.length} chunks, ${compiled.book.sections.length} sections` +
      (leftovers > 0 ? ` — WARNING: ${leftovers} leftover chunks (chunker gaps)` : ''),
  );
  process.exit(0);
}

const { url } = await startServer({ repo, range: resolved });

console.log(`code-story serving ${range} (${resolved.base.slice(0, 8)}..${resolved.head.slice(0, 8)}) at ${url}`);
console.log('Ctrl+C to stop.');

if (!noOpen) {
  await open(url);
}
