#!/usr/bin/env node
import open from 'open';
import { startServer } from './server.js';

const args = process.argv.slice(2);
const noOpen = args.includes('--no-open');
const range = args.find((a) => !a.startsWith('--'));

const { url } = await startServer();

console.log(`code-story serving at ${url}${range ? ` (range: ${range} — ingestion not built yet)` : ''}`);
console.log('Ctrl+C to stop.');

if (!noOpen) {
  await open(url);
}
