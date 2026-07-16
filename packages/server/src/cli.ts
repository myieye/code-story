#!/usr/bin/env node
import open from 'open';
import { diffRange, resolveRange } from './git.js';
import { startServer } from './server.js';

const args = process.argv.slice(2);
const noOpen = args.includes('--no-open');
const dumpDiff = args.includes('--dump-diff');
const range = args.find((a) => !a.startsWith('--'));
const repo = process.cwd();

if (!range) {
  console.error('Usage: code-story <base>..<head> [--dump-diff] [--no-open]');
  process.exit(1);
}

const resolved = await resolveRange(repo, range);

if (dumpDiff) {
  const files = await diffRange(repo, resolved);
  console.log(JSON.stringify({ ...resolved, files }, null, 2));
  process.exit(0);
}

const { url } = await startServer({ repo, range: resolved });

console.log(`code-story serving ${range} (${resolved.base.slice(0, 8)}..${resolved.head.slice(0, 8)}) at ${url}`);
console.log('Ctrl+C to stop.');

if (!noOpen) {
  await open(url);
}
