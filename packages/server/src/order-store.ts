import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { OrderOverlay } from '@code-story/core';
import type { ResolvedRange } from './git.js';

export { saveJson } from './json-file.js';

/** The AI order overlay lives beside the review state: `<repo-id>/reviews/<base12>..<head12>.order.json`. */
export function orderFilePath(dataHome: string, repoId: string, range: ResolvedRange): string {
  return path.join(dataHome, repoId, 'reviews', `${range.base.slice(0, 12)}..${range.head.slice(0, 12)}.order.json`);
}

/** The job record beside the overlay — post-restart visibility for failed/orphaned jobs. */
export function orderJobFilePath(dataHome: string, repoId: string, range: ResolvedRange): string {
  return path.join(dataHome, repoId, 'reviews', `${range.base.slice(0, 12)}..${range.head.slice(0, 12)}.order-job.json`);
}

export interface OrderJobRecord {
  version: 1;
  status: 'running' | 'done' | 'failed';
  model: string;
  promptVersion: string;
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

/** Missing or unreadable overlay → null (the book just stays tier 0). */
export async function loadOverlay(file: string): Promise<OrderOverlay | null> {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as OrderOverlay;
    if (parsed.version === 1) return parsed;
    console.warn(`code-story: ignoring order overlay at ${file} (version mismatch)`);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`code-story: could not read order overlay at ${file}:`, e);
    }
  }
  return null;
}

export async function loadJobRecord(file: string): Promise<OrderJobRecord | null> {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as OrderJobRecord;
    if (parsed.version === 1) return parsed;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`code-story: could not read order job record at ${file}:`, e);
    }
  }
  return null;
}

