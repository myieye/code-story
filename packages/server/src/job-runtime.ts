import { readFile } from 'node:fs/promises';
import { saveJson } from './json-file.js';

export interface JobRecordBase {
  status: 'running' | 'done' | 'failed';
  finishedAt?: string;
  error?: string;
}

/**
 * Load a `version: 1` job record, ENOENT-tolerant (missing ⇒ null; other read/parse errors warn).
 * The order/narration/context stores each re-export a typed loader that delegates here — one body
 * for the three that were byte-identical modulo the warning label.
 */
export async function loadJobRecordFile<Rec extends { version: 1 }>(file: string, what: string): Promise<Rec | null> {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as Rec;
    if (parsed.version === 1) return parsed;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`code-story: could not read ${what} at ${file}:`, e);
    }
  }
  return null;
}

export const ORPHAN_ERROR = 'job orphaned by a daemon restart — re-run it';

/**
 * Resolve a persisted job record for a GET, given whether the scheduler says the kind is active
 * (running or queued). Mirrors `JobRuntime.resolve` for tasks whose lifecycle the glue scheduler
 * now owns:
 *  - active ⇒ the job is running now; report `running`. A re-kick after an earlier run leaves that
 *    run's terminal record on disk until this run overwrites it (async), so surface `running` over
 *    the stale done/failed (the old in-memory `liveRecord` did the same).
 *  - idle + a stored `running` ⇒ ambiguous: re-read once (a fast job may have just landed its
 *    terminal write) before reporting a synthetic orphan `failed`.
 */
export async function resolveJobRecord<Rec extends JobRecordBase>(
  stored: Rec | null,
  active: boolean,
  reload: () => Promise<Rec | null>,
): Promise<Rec | null> {
  if (active) {
    if (!stored || stored.status === 'running') return stored;
    return { ...stored, status: 'running' as const, finishedAt: undefined, error: undefined };
  }
  if (stored?.status !== 'running') return stored;
  const reread = await reload();
  if (reread?.status !== 'running') return reread;
  return { ...reread, status: 'failed' as const, error: ORPHAN_ERROR };
}

/**
 * Lifecycle for a single-flight background job whose record file must survive a daemon restart. Owns
 * the in-flight handle plus the record the running job mirrors, so a GET never misreads the window
 * before the record file lands. Order, narration and context each get one instance.
 */
export class JobRuntime<Rec extends JobRecordBase> {
  private live: Promise<void> | undefined;
  private record: Rec | undefined;

  get running(): boolean {
    return this.live !== undefined;
  }

  get liveRecord(): Rec | undefined {
    return this.record;
  }

  /**
   * The record a GET should report. A stored `running` with no live handle is ambiguous: a fast job
   * may have finished during the caller's read. The terminal write always lands before the handle
   * clears, so one re-read decides — still `running` with no handle means a genuine orphan.
   */
  async resolve(stored: Rec | null, reload: () => Promise<Rec | null>): Promise<Rec | null> {
    let record: Rec | null = this.record ?? stored;
    if (record?.status === 'running' && this.live === undefined) {
      record = this.record ?? (await reload());
    }
    return record?.status === 'running' && this.live === undefined
      ? { ...record, status: 'failed' as const, error: ORPHAN_ERROR }
      : record;
  }

  /**
   * Runs `work` in the background under this handle: initial `running` write, then `work` (which may
   * mutate `record` in place for progress and returns fields merged into the terminal `done` record),
   * then the terminal done/failed write. Not guarded — callers check `running` first and pick their
   * own conflict response. `onError` runs before the failed write for job-specific bookkeeping.
   */
  run(record: Rec, jobFile: string, work: () => Promise<Partial<Rec>>, onError?: (e: unknown) => void): void {
    this.record = record;
    this.live = (async () => {
      try {
        await saveJson(jobFile, record);
        const done = await work();
        await saveJson(jobFile, { ...record, status: 'done', finishedAt: new Date().toISOString(), ...done });
      } catch (e) {
        onError?.(e);
        await saveJson(jobFile, {
          ...record,
          status: 'failed',
          finishedAt: new Date().toISOString(),
          error: (e as Error).message,
        }).catch(() => undefined);
      } finally {
        this.live = undefined;
        this.record = undefined;
      }
    })();
  }
}
