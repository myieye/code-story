import { type FileContents } from './export.js';
import { type Chunk } from './model.js';

export type UnifiedLineType = 'context' | 'add' | 'del' | 'gap';

export interface UnifiedLine {
  type: UnifiedLineType;
  text: string;
  /** Base-side line number (del lines; context lines of deleted files). */
  base?: number;
  /** Head-side line number (add and context lines). */
  head?: number;
}

/**
 * File-level changed lines, so a chunk can colour its context padding truthfully. A chunk's trailing
 * or leading context can fall on lines that another chunk *added* (e.g. the next method's signature
 * just below this method's close). Those must read as adds everywhere they appear — a changed line
 * shown uncoloured in one chunk and coloured in its owner is the confusing inconsistency this fixes.
 */
export interface ChangedLines {
  /** Head line numbers the diff added (or modified). */
  head?: ReadonlySet<number>;
  /** Base line numbers the diff deleted — only meaningful for deleted-file (base-side) chunks. */
  base?: ReadonlySet<number>;
}

/**
 * The changed head/base lines of every file, keyed by path — the union of its chunks' owned hunks
 * (R-001: that union is exactly the file's changed lines). Pass a file's entry as `changedLines` so
 * each chunk colours boundary context truthfully.
 */
export function changedLinesByFile(chunks: readonly Chunk[]): Map<string, ChangedLines> {
  const map = new Map<string, { head: Set<number>; base: Set<number> }>();
  for (const chunk of chunks) {
    let entry = map.get(chunk.file);
    if (!entry) {
      entry = { head: new Set(), base: new Set() };
      map.set(chunk.file, entry);
    }
    for (const h of chunk.hunks) {
      for (let i = 0; i < h.headCount; i++) entry.head.add(h.headStart + i);
      for (let i = 0; i < h.baseCount; i++) entry.base.add(h.baseStart + i);
    }
  }
  return map;
}

/**
 * Renders a chunk as unified-diff rows built directly from its hunks — del lines from base
 * content, add lines from head content, context from the primary side. Precise by construction:
 * no re-diffing of sliced texts, so no spurious adds/dels at slice edges. Empty for chunks with
 * no fetchable content (binary, submodules).
 *
 * `changedLines` (the whole file's changed lines) is optional: when given, a context row that lands
 * on a changed line is coloured add/del rather than left neutral, so a changed line reads the same
 * in every chunk that shows it (a boundary line owned by a neighbouring chunk still reads as changed).
 */
export function unifiedChunkLines(
  chunk: Chunk,
  contents: FileContents | undefined,
  context = 3,
  changedLines?: ChangedLines,
): UnifiedLine[] {
  const primary = contents?.head ?? contents?.base;
  if (!contents || !primary || chunk.hunks.length === 0) return [];
  const deleted = !contents.head;

  const out: UnifiedLine[] = [];
  // Highest primary-side line already emitted, so overlapping context between close hunks merges
  let emitted = 0;

  const pushContext = (from: number, to: number) => {
    for (let n = Math.max(from, emitted + 1, 1); n <= Math.min(to, primary.length); n++) {
      const text = primary[n - 1] ?? '';
      // A context line the diff actually changed (owned by an adjacent chunk) is coloured, not neutral.
      const changed = deleted ? changedLines?.base?.has(n) : changedLines?.head?.has(n);
      const type: UnifiedLineType = changed ? (deleted ? 'del' : 'add') : 'context';
      out.push(deleted ? { type, text, base: n } : { type, text, head: n });
      emitted = n;
    }
  };

  const hunks = [...chunk.hunks].sort((a, b) =>
    deleted ? a.baseStart - b.baseStart : a.headStart - b.headStart,
  );
  for (let hi = 0; hi < hunks.length; hi++) {
    const h = hunks[hi]!;
    const [start, count] = deleted ? [h.baseStart, h.baseCount] : [h.headStart, h.headCount];
    // For zero-count hunks, start is the line *before* the change point (unified diff semantics)
    const beforeEnd = count > 0 ? start - 1 : start;
    if (out.length > 0 && beforeEnd - context > emitted) out.push({ type: 'gap', text: '' });
    pushContext(beforeEnd - context + 1, beforeEnd);

    if (!deleted) {
      for (let i = 0; i < h.baseCount; i++) {
        out.push({ type: 'del', text: contents.base?.[h.baseStart - 1 + i] ?? '', base: h.baseStart + i });
      }
    }
    for (let i = 0; i < count; i++) {
      const text = primary[start - 1 + i] ?? '';
      out.push(deleted ? { type: 'del', text, base: start + i } : { type: 'add', text, head: start + i });
      emitted = start + i;
    }

    // Trailing context must not reach into the next hunk's changed lines. A chunk can have a hole
    // (a nested symbol carved into its own chunk leaves a gap in this chunk's hunks); without this
    // clamp the hole's far side gets emitted as context here AND as add/del in the next hunk.
    const next = hunks[hi + 1];
    const nextStart = next ? (deleted ? next.baseStart : next.headStart) : Infinity;
    pushContext(beforeEnd + count + 1, Math.min(beforeEnd + count + context, nextStart - 1));
  }
  return out;
}
