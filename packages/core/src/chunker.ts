import { type FileDiff, type Hunk } from './diff.js';
import { type Chunk, type ChunkKind, chunkId } from './model.js';
import { type SymbolSpan, symbolPathAt } from './symbols.js';

export interface FileToChunk {
  diff: FileDiff;
  /** Content lines of the primary side: head normally, base for deleted files. */
  lines: string[];
  /** Base-side lines (for fingerprinting removed content). Ignored for deleted files. */
  baseLines: string[];
  /** Declaration outline of the primary side. Empty/undefined → whole-hunk chunks. */
  symbols?: SymbolSpan[];
  /** Marks lockfiles/config formats so their chunks get kind `config`. */
  configLike?: boolean;
  /** Low-signal reason from `classifyGenerated`; marks every chunk of the file `generated`. */
  generatedReason?: string;
}

export interface ChunkOptions {
  /** Changed-line count above which a chunk splits into fragments. */
  maxLines?: number;
}

const DEFAULT_MAX_LINES = 40;

/**
 * Intersects a file's hunks with its declaration outline (spec 00 §Chunking). Every changed
 * line lands in exactly one chunk — the R-001 invariant, property-tested.
 */
export function chunkFile(input: FileToChunk, options?: ChunkOptions): Chunk[] {
  const { diff } = input;
  const maxLines = options?.maxLines ?? DEFAULT_MAX_LINES;

  if (diff.binary) {
    return [makeChunk(input, [], [], 'other', ['(binary)'])];
  }
  if (diff.hunks.length === 0) return [];

  // Primary side: the side whose content and outline we intersect against.
  const deleted = diff.status === 'deleted';
  const groups = new Map<string, { path: SymbolSpan[]; hunks: Hunk[] }>();

  for (const hunk of diff.hunks) {
    for (const part of splitHunkAtSymbolBoundaries(hunk, input.symbols ?? [], deleted)) {
      const key = part.path.map((s) => `${s.kind}:${s.name}:${s.startLine}`).join('/') || '(top)';
      const group = groups.get(key) ?? { path: part.path, hunks: [] };
      group.hunks.push(part.hunk);
      groups.set(key, group);
    }
  }

  const chunks: Chunk[] = [];
  for (const { path, hunks } of groups.values()) {
    const innermost = path[0];
    const kind: ChunkKind =
      innermost === undefined
        ? input.configLike
          ? 'config'
          : 'other'
        : innermost.kind === 'function'
          ? 'method'
          : innermost.kind === 'markup'
            ? 'markup-region'
            : 'other';
    const symbolPath = [...path].reverse().map((s) => s.name);

    const fragments = fragment(hunks, maxLines, deleted);
    fragments.forEach((fragHunks, i) => {
      chunks.push(
        makeChunk(
          input,
          fragHunks,
          symbolPath,
          fragments.length > 1 && kind === 'method' ? 'method-fragment' : kind,
          fragments.length > 1 ? [...symbolPath, `fragment ${i + 1}`] : symbolPath,
        ),
      );
    });
  }

  return chunks.sort(
    (a, b) => (a.headRange?.start ?? a.baseRange?.start ?? 0) - (b.headRange?.start ?? b.baseRange?.start ?? 0),
  );
}

interface HunkPart {
  path: SymbolSpan[];
  hunk: Hunk;
}

/**
 * Allocates a hunk's changed lines (primary side) to innermost symbols, splitting it when it
 * crosses declaration boundaries. Zero-count hunks (pure deletion/insertion anchors) attach
 * whole to the symbol at their anchor line.
 */
function splitHunkAtSymbolBoundaries(hunk: Hunk, symbols: SymbolSpan[], deleted: boolean): HunkPart[] {
  const start = deleted ? hunk.baseStart : hunk.headStart;
  const count = deleted ? hunk.baseCount : hunk.headCount;

  if (count === 0) {
    return [{ path: symbolPathAt(symbols, Math.max(1, start)), hunk }];
  }

  const parts: HunkPart[] = [];
  let runStart = start;
  let runPath = symbolPathAt(symbols, start);
  for (let line = start + 1; line < start + count; line++) {
    const path = symbolPathAt(symbols, line);
    if (path[0] !== runPath[0]) {
      parts.push({ path: runPath, hunk: subHunk(hunk, runStart, line - runStart, deleted, parts.length === 0) });
      runStart = line;
      runPath = path;
    }
  }
  parts.push({ path: runPath, hunk: subHunk(hunk, runStart, start + count - runStart, deleted, parts.length === 0) });
  return parts;
}

/**
 * When a hunk splits, -U0 gives no line-by-line base↔head alignment inside it, so the whole
 * secondary-side range stays with the first part (single-owner coverage over precision).
 */
function subHunk(hunk: Hunk, start: number, count: number, deleted: boolean, isFirst: boolean): Hunk {
  if (deleted) {
    return {
      baseStart: start,
      baseCount: count,
      headStart: isFirst ? hunk.headStart : start,
      headCount: isFirst ? hunk.headCount : 0,
    };
  }
  return {
    headStart: start,
    headCount: count,
    baseStart: isFirst ? hunk.baseStart : start,
    baseCount: isFirst ? hunk.baseCount : 0,
  };
}

/** Splits a group's hunks into buckets of ≤ maxLines changed lines (oversize hunks split too). */
function fragment(hunks: Hunk[], maxLines: number, deleted: boolean): Hunk[][] {
  const flat: Hunk[] = hunks.flatMap((h) => {
    const count = deleted ? h.baseCount : h.headCount;
    if (count <= maxLines) return [h];
    const pieces: Hunk[] = [];
    const start = deleted ? h.baseStart : h.headStart;
    for (let s = start; s < start + count; s += maxLines) {
      pieces.push(subHunk(h, s, Math.min(maxLines, start + count - s), deleted, s === start));
    }
    return pieces;
  });

  const buckets: Hunk[][] = [];
  let bucket: Hunk[] = [];
  let bucketLines = 0;
  for (const h of flat) {
    const count = Math.max(deleted ? h.baseCount : h.headCount, 1);
    if (bucket.length > 0 && bucketLines + count > maxLines) {
      buckets.push(bucket);
      bucket = [];
      bucketLines = 0;
    }
    bucket.push(h);
    bucketLines += count;
  }
  if (bucket.length > 0) buckets.push(bucket);
  return buckets;
}

function makeChunk(
  input: FileToChunk,
  hunks: Hunk[],
  symbolPath: string[],
  kind: ChunkKind,
  idPath: string[],
): Chunk {
  const deleted = input.diff.status === 'deleted';
  const headHunks = hunks.filter((h) => h.headCount > 0);
  const baseHunks = hunks.filter((h) => h.baseCount > 0);

  const changed: string[] = [];
  for (const h of hunks) {
    const [side, start, count] = deleted
      ? [input.lines, h.baseStart, h.baseCount]
      : [input.lines, h.headStart, h.headCount];
    for (let i = 0; i < count; i++) changed.push((side[start - 1 + i] ?? '').trim());
    if (!deleted) {
      for (let i = 0; i < h.baseCount; i++) changed.push((input.baseLines[h.baseStart - 1 + i] ?? '').trim());
    }
  }

  return {
    id: chunkId(input.diff.path, idPath, fnv1a(changed.join('\n'))),
    file: input.diff.path,
    symbolPath,
    displayPath: idPath,
    kind,
    changeTypes: input.generatedReason !== undefined ? ['generated'] : [],
    ...(input.generatedReason !== undefined ? { generatedReason: input.generatedReason } : {}),
    hunks,
    headRange: deleted
      ? undefined
      : spanOf(headHunks.map((h) => [h.headStart, h.headStart + h.headCount - 1])),
    baseRange: spanOf(baseHunks.map((h) => [h.baseStart, h.baseStart + h.baseCount - 1])),
  };
}

function spanOf(ranges: [number, number][]): { start: number; end: number } | undefined {
  if (ranges.length === 0) return undefined;
  return {
    start: Math.min(...ranges.map(([s]) => s)),
    end: Math.max(...ranges.map(([, e]) => e)),
  };
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
