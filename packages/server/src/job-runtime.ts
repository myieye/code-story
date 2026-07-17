import { saveJson } from './json-file.js';

export interface JobRecordBase {
  status: 'running' | 'done' | 'failed';
  finishedAt?: string;
  error?: string;
}

const ORPHAN_ERROR = 'job orphaned by a daemon restart — re-run it';

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
