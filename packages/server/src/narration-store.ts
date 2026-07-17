import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { NarrationOverlay } from '@code-story/core';
import type { ResolvedRange } from './git.js';

export { saveJson } from './json-file.js';

/** The narration overlay lives beside the order overlay: `<repo-id>/reviews/<base12>..<head12>.narration.json`. */
export function narrationFilePath(dataHome: string, repoId: string, range: ResolvedRange): string {
  return path.join(dataHome, repoId, 'reviews', `${range.base.slice(0, 12)}..${range.head.slice(0, 12)}.narration.json`);
}

/** The narration job record beside the overlay — post-restart visibility for failed/orphaned jobs. */
export function narrationJobFilePath(dataHome: string, repoId: string, range: ResolvedRange): string {
  return path.join(
    dataHome,
    repoId,
    'reviews',
    `${range.base.slice(0, 12)}..${range.head.slice(0, 12)}.narration-job.json`,
  );
}

export interface NarrationJobRecord {
  version: 1;
  status: 'running' | 'done' | 'failed';
  model: string;
  promptVersion: string;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  /** Narratable sections (excludes leftovers + all-low-signal sections) — feeds the partial-state indicator. */
  sectionsTotal: number;
  sectionsDone: number;
}

/** Missing or unreadable overlay → null (the book just stays un-narrated). */
export async function loadNarrationOverlay(file: string): Promise<NarrationOverlay | null> {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as NarrationOverlay;
    if (parsed.version === 1) return parsed;
    console.warn(`code-story: ignoring narration overlay at ${file} (version mismatch)`);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`code-story: could not read narration overlay at ${file}:`, e);
    }
  }
  return null;
}

export async function loadNarrationJobRecord(file: string): Promise<NarrationJobRecord | null> {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as NarrationJobRecord;
    if (parsed.version === 1) return parsed;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`code-story: could not read narration job record at ${file}:`, e);
    }
  }
  return null;
}
