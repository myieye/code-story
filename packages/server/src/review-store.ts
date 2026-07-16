import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { emptyReview, type ReviewFile } from '@code-story/core';
import type { ResolvedRange } from './git.js';

/**
 * Where one review's state lives: `~/.code-story/<repo-id>/reviews/<base12>..<head12>.json`
 * (R-037's data home). Head-SHA-keyed: a new head starts a fresh review (M0).
 */
export function reviewFilePath(dataHome: string, repoId: string, range: ResolvedRange): string {
  return path.join(dataHome, repoId, 'reviews', `${range.base.slice(0, 12)}..${range.head.slice(0, 12)}.json`);
}

export function defaultDataHome(): string {
  return path.join(homedir(), '.code-story');
}

/** `<basename>-<rootSha12>`: readable, and stable across clones/moves of the same repo. */
export function repoIdFrom(repoPath: string, rootCommitSha: string): string {
  const slug = path.basename(path.resolve(repoPath)).replace(/[^\w.-]+/g, '-') || 'repo';
  return `${slug}-${rootCommitSha.slice(0, 12)}`;
}

/** Missing or unreadable file → a fresh review (never blocks the daemon). */
export async function loadReview(file: string, range: ResolvedRange): Promise<ReviewFile> {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as ReviewFile;
    if (parsed.version === 1 && parsed.base === range.base && parsed.head === range.head) return parsed;
    console.warn(`code-story: ignoring review state at ${file} (version or range mismatch)`);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`code-story: could not read review state at ${file}, starting fresh:`, e);
    }
  }
  return emptyReview(range.base, range.head);
}

/** Atomic: write a sibling temp file, then rename over the target. */
export async function saveReview(file: string, review: ReviewFile): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(review, null, 2));
  await rename(tmp, file);
}
