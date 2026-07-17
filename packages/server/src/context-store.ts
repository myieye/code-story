import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ContextPayload, ContextStoreFile } from '@code-story/core';
import type { ResolvedRange } from './git.js';
import { saveJson } from './json-file.js';

export { saveJson };

/**
 * Bulk fill stops persisting once the serialized store would pass this (spec 04 step 5). Facts are
 * cheap, but a runaway range must not write an unbounded file; on-demand GET keeps working past it.
 */
export const DEFAULT_CONTEXT_STORE_CAP_BYTES = 2 * 1024 * 1024;

/** The context payload store lives beside the other overlays: `<repo-id>/reviews/<base12>..<head12>.context.json`. */
export function contextFilePath(dataHome: string, repoId: string, range: ResolvedRange): string {
  return path.join(dataHome, repoId, 'reviews', `${range.base.slice(0, 12)}..${range.head.slice(0, 12)}.context.json`);
}

/** The bulk context job record beside the store — post-restart visibility for failed/orphaned jobs. */
export function contextJobFilePath(dataHome: string, repoId: string, range: ResolvedRange): string {
  return path.join(
    dataHome,
    repoId,
    'reviews',
    `${range.base.slice(0, 12)}..${range.head.slice(0, 12)}.context-job.json`,
  );
}

/** No model or prompt version — the bulk fill is scripts only (R-024). */
export interface ContextJobRecord {
  version: 1;
  status: 'running' | 'done' | 'failed';
  startedAt: string;
  finishedAt?: string;
  error?: string;
  /** Eligible chunks (non-leftover, non-low-signal, deduped): the fill target. */
  chunksTotal: number;
  /** Chunks with a fresh persisted payload at the end (computed this run + skipped-fresh). */
  chunksDone: number;
  /** Newly computed and persisted this run — vs `skipped`, the resume evidence. */
  computed: number;
  /** Already-fresh chunks a resume skipped without recomputing. */
  skipped: number;
  /** True once the store hit its byte cap; `cappedCount` chunks then went unpersisted. */
  capped: boolean;
  cappedCount: number;
}

export async function loadContextJobRecord(file: string): Promise<ContextJobRecord | null> {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as ContextJobRecord;
    if (parsed.version === 1) return parsed;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`code-story: could not read context job record at ${file}:`, e);
    }
  }
  return null;
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

/**
 * Adds one payload to `store` and writes the result atomically — unless the serialized store would
 * pass the cap, in which case it writes nothing and returns `persisted: false` (the fill's stop
 * signal, never a throw). Callers own their own concurrency: the server serializes on a save chain
 * and re-loads before each call; the CLI holds one store in memory and mirrors the write on success.
 */
export async function persistContextPayload(
  file: string,
  store: ContextStoreFile,
  payload: ContextPayload,
  capBytes = DEFAULT_CONTEXT_STORE_CAP_BYTES,
): Promise<{ persisted: boolean }> {
  const candidate: ContextStoreFile = { ...store, payloads: { ...store.payloads, [payload.chunkId]: payload } };
  if (Buffer.byteLength(JSON.stringify(candidate)) > capBytes) return { persisted: false };
  await saveJson(file, candidate);
  return { persisted: true };
}
