import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { type StorySnapshot, type StorySummary, toStorySummary } from '@code-story/core';
import { saveJson } from './json-file.js';

/**
 * Story snapshots live INSIDE the reviewed repo at `<repo>/.code-story/stories/` (R-064) — unlike
 * the per-reviewer live state in `~/.code-story/`, these are git-tracked so they sync across
 * environments. One file per story, named by its timestamped id ⇒ conflict-free across machines.
 */
export function storiesDir(repo: string): string {
  return path.join(repo, '.code-story', 'stories');
}

export function storyFilePath(repo: string, id: string): string {
  return path.join(storiesDir(repo), `${id}.json`);
}

export async function saveStory(repo: string, snapshot: StorySnapshot): Promise<void> {
  return saveJson(storyFilePath(repo, snapshot.id), snapshot);
}

/** One snapshot by id, or null when absent/unreadable — never throws into a request. */
export async function loadStory(repo: string, id: string): Promise<StorySnapshot | null> {
  try {
    return JSON.parse(await readFile(storyFilePath(repo, id), 'utf8')) as StorySnapshot;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`code-story: could not read story ${id}:`, e);
    }
    return null;
  }
}

/**
 * Every story summary for this repo, newest first. Reads each file and strips the bundled overlays;
 * fine at dogfooding scale. Deferred (spec 08): a lightweight index if the list ever gets large.
 */
export async function listStories(repo: string): Promise<StorySummary[]> {
  let names: string[];
  try {
    names = await readdir(storiesDir(repo));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('code-story: could not list stories:', e);
    }
    return [];
  }
  const ids = names.filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -'.json'.length));
  const snapshots = await Promise.all(ids.map((id) => loadStory(repo, id)));
  return snapshots
    .filter((s): s is StorySnapshot => s !== null)
    .map(toStorySummary)
    .sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}
