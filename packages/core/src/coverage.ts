import { type FileDiff } from './diff.js';
import { type Chunk } from './model.js';

export interface CoverageReport {
  ok: boolean;
  /** Total primary-side changed lines in the diff. */
  expected: number;
  /** `path:line` keys the diff changed but no chunk owns. */
  missing: string[];
  /** `path:line` keys owned by more than one chunk. */
  duplicated: string[];
}

/**
 * R-001 self-check on a real diff: chunk-owned primary-side lines must equal the diff's
 * changed lines, each owned exactly once. Run it on raw chunker output — before the book
 * compiler's leftover backstop — so chunker gaps surface instead of being silently absorbed.
 */
export function checkCoverage(files: FileDiff[], chunks: Chunk[]): CoverageReport {
  const expected = new Set<string>();
  for (const f of files) {
    const del = f.status === 'deleted';
    for (const h of f.hunks) {
      const [start, count] = del ? [h.baseStart, h.baseCount] : [h.headStart, h.headCount];
      for (let i = 0; i < count; i++) expected.add(`${f.path}:${start + i}`);
    }
  }

  const fileStatus = new Map(files.map((f) => [f.path, f.status]));
  const owned = new Map<string, number>();
  for (const c of chunks) {
    const del = fileStatus.get(c.file) === 'deleted';
    for (const h of c.hunks) {
      const [start, count] = del ? [h.baseStart, h.baseCount] : [h.headStart, h.headCount];
      for (let i = 0; i < count; i++) {
        const key = `${c.file}:${start + i}`;
        owned.set(key, (owned.get(key) ?? 0) + 1);
      }
    }
  }

  const missing = [...expected].filter((k) => !owned.has(k));
  const duplicated = [...owned.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  return { ok: missing.length === 0 && duplicated.length === 0, expected: expected.size, missing, duplicated };
}
