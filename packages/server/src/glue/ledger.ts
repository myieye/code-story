import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ResolvedRange } from '../git.js';
import type { GlueLedgerEntry, GlueSpend } from './types.js';

/** The glue ledger sits beside the review state: `<repo-id>/reviews/<base12>..<head12>.glue-ledger.jsonl`. */
export function glueLedgerFilePath(dataHome: string, repoId: string, range: ResolvedRange): string {
  return path.join(
    dataHome,
    repoId,
    'reviews',
    `${range.base.slice(0, 12)}..${range.head.slice(0, 12)}.glue-ledger.jsonl`,
  );
}

function emptySpend(): GlueSpend {
  return { calls: 0, inputTokens: 0, outputTokens: 0 };
}

/**
 * Append-only JSONL, one line per spawn. Appends serialize on a dedicated promise chain (the
 * serialization guarantee is the chain, not filesystem append atomicity). Spend is summed from the
 * file lazily and cached; a new append drops the cache so the next read reflects it.
 */
export class GlueLedger {
  private chain: Promise<void> = Promise.resolve();
  private cached: GlueSpend | undefined;

  constructor(private readonly file: string) {}

  append(entry: GlueLedgerEntry): void {
    this.cached = undefined;
    const line = `${JSON.stringify(entry)}\n`;
    this.chain = this.chain
      .then(async () => {
        await mkdir(path.dirname(this.file), { recursive: true });
        await appendFile(this.file, line);
      })
      .catch(() => undefined);
  }

  async spend(): Promise<GlueSpend> {
    if (this.cached) return this.cached;
    await this.chain;
    this.cached = await this.sumFile();
    return this.cached;
  }

  flush(): Promise<void> {
    return this.chain;
  }

  private async sumFile(): Promise<GlueSpend> {
    let raw: string;
    try {
      raw = await readFile(this.file, 'utf8');
    } catch {
      return emptySpend();
    }
    const spend = emptySpend();
    let cost = 0;
    let sawCost = false;
    for (const line of raw.split('\n')) {
      if (line.trim() === '') continue;
      let entry: GlueLedgerEntry;
      try {
        entry = JSON.parse(line) as GlueLedgerEntry;
      } catch {
        continue;
      }
      spend.calls += 1;
      if (entry.usage) {
        spend.inputTokens += entry.usage.inputTokens;
        spend.outputTokens += entry.usage.outputTokens;
        if (entry.usage.costUsd !== undefined) {
          cost += entry.usage.costUsd;
          sawCost = true;
        }
      }
    }
    if (sawCost) spend.costUsd = cost;
    return spend;
  }
}
