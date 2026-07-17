import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ChunkGraphFile } from '@code-story/core';
import type { ResolvedRange } from './git.js';

export { saveJson } from './json-file.js';

/** The chunk graph lives beside the other overlays: `<repo-id>/reviews/<base12>..<head12>.graph.json`. */
export function chunkGraphFilePath(dataHome: string, repoId: string, range: ResolvedRange): string {
  return path.join(dataHome, repoId, 'reviews', `${range.base.slice(0, 12)}..${range.head.slice(0, 12)}.graph.json`);
}

/**
 * Missing, unreadable, or version-mismatched graph → null (fail-open to no-graph, spec 05). The
 * freshness (fingerprint) check is a separate step — `filterFreshGraph` — so a stale-but-readable
 * file loads here and is dropped there, matching the order overlay's split.
 */
export async function loadChunkGraph(file: string): Promise<ChunkGraphFile | null> {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as ChunkGraphFile;
    if (parsed.version === 1 && Array.isArray(parsed.edges)) return parsed;
    console.warn(`code-story: ignoring chunk graph at ${file} (version mismatch)`);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`code-story: could not read chunk graph at ${file}:`, e);
    }
  }
  return null;
}
