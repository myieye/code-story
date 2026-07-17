import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ContextStoreFile } from '@code-story/core';
import type { ResolvedRange } from './git.js';

export { saveJson } from './json-file.js';

/** The context payload store lives beside the other overlays: `<repo-id>/reviews/<base12>..<head12>.context.json`. */
export function contextFilePath(dataHome: string, repoId: string, range: ResolvedRange): string {
  return path.join(dataHome, repoId, 'reviews', `${range.base.slice(0, 12)}..${range.head.slice(0, 12)}.context.json`);
}

/**
 * Missing or unreadable store → an empty one (compute-on-miss then appends). Unlike the order/
 * narration loaders this never returns null: a payload cache is only ever additive, so "start
 * empty" is the right fail-open.
 */
export async function loadContextStore(file: string): Promise<ContextStoreFile> {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as ContextStoreFile;
    if (parsed.version === 1 && parsed.payloads) return parsed;
    console.warn(`code-story: ignoring context store at ${file} (version mismatch)`);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`code-story: could not read context store at ${file}, starting fresh:`, e);
    }
  }
  return { version: 1, payloads: {} };
}
