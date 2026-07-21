import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { type DeferralStoreFile, emptyDeferralStore } from '@code-story/core';
import type { ResolvedRange } from './git.js';

export { saveJson } from './json-file.js';

/** The deferral store lives beside the review state: `<repo-id>/reviews/<base12>..<head12>.deferrals.json`. */
export function deferralsFilePath(dataHome: string, repoId: string, range: ResolvedRange): string {
  return path.join(dataHome, repoId, 'reviews', `${range.base.slice(0, 12)}..${range.head.slice(0, 12)}.deferrals.json`);
}

/**
 * Missing or unreadable store → an empty one. Like the context store this never returns null: the
 * deferral list is reviewer-authored and only ever grows or shrinks by explicit action, so "start
 * empty" is the right fail-open. Range mismatch is ignored (a stale file can't leak another range's
 * deferrals) — a fresh store is returned for the requested range.
 */
export async function loadDeferralStore(file: string, range: ResolvedRange): Promise<DeferralStoreFile> {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as DeferralStoreFile;
    if (parsed.version === 1 && parsed.base === range.base && parsed.head === range.head && Array.isArray(parsed.deferrals)) {
      return parsed;
    }
    console.warn(`code-story: ignoring deferral store at ${file} (version or range mismatch)`);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`code-story: could not read deferral store at ${file}, starting fresh:`, e);
    }
  }
  return emptyDeferralStore(range.base, range.head);
}
