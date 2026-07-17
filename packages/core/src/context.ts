import { fnv1a } from './chunker.js';
import { type Book, CORE_VERSION } from './model.js';

/** One resolved definition referenced by a chunk's changed lines (spec 04 facts-v1). */
export interface ContextDefinition {
  symbol: string;
  file: string;
  /** True when the defining file is part of this diff (the reviewer meets it as a section). */
  changed: boolean;
  body: string;
  lineStart: number;
  /** The sha the body was read at (head, or base for deleted files). */
  sha: string;
}

/** The chunk's section-level import edges, lifted from the ordering graph (free). */
export interface ContextEdges {
  imports: string[];
  importedBy: string[];
}

export interface ContextFacts {
  definitions: ContextDefinition[];
  edges: ContextEdges;
}

/**
 * Facts-only payload for one chunk (spec 04 v1). `narrative`/`depth` are deliberately absent —
 * the schema grows them later the way the narration overlay's per-chunk values were designed to.
 */
export interface ContextPayload {
  chunkId: string;
  fingerprint: string;
  generatedAt: string;
  facts: ContextFacts;
}

/** Per-range store, mirroring the order/narration overlay shape (versioned, atomically written). */
export interface ContextStoreFile {
  version: 1;
  /** Keyed by chunk id; a payload is shared across the chunk's occurrences (same code, same facts). */
  payloads: Record<string, ContextPayload>;
}

/**
 * Freshness key: fnv1a over head + CORE_VERSION + chunk id. Chunk ids don't carry CORE_VERSION, and
 * a version bump can change resolver/cap behavior without changing the diff, so the fingerprint must
 * fold it in — mirrors `sectionFingerprint`.
 */
export function contextFingerprint(headSha: string, chunkId: string): string {
  return fnv1a([headSha, CORE_VERSION, chunkId].join('\0'));
}

function liveChunkIds(chunks: Set<string> | Book): Set<string> {
  if (chunks instanceof Set) return chunks;
  return new Set(chunks.sections.flatMap((s) => s.occurrences.map((o) => o.chunkId)));
}

/**
 * Drops payloads whose chunk is gone or whose fingerprint no longer matches the current head.
 * Fail-open is "absent, never wrong": a malformed store yields an empty map (the inverse of
 * `applyOrderOverlay`; matches `filterFreshNarration`'s catch direction).
 */
export function filterFreshContext(
  headSha: string,
  chunks: Set<string> | Book,
  store: ContextStoreFile,
): Record<string, ContextPayload> {
  try {
    const live = liveChunkIds(chunks);
    const fresh: Record<string, ContextPayload> = {};
    for (const [id, payload] of Object.entries(store.payloads)) {
      if (live.has(id) && payload.fingerprint === contextFingerprint(headSha, id)) fresh[id] = payload;
    }
    return fresh;
  } catch {
    return {};
  }
}

/**
 * Window (in lines) below the cap in which `capBody` will extend the cut to reach a clean statement
 * boundary rather than slice mid-expression — the body-side analogue of the chunker's `snapCut`.
 */
const CAP_SNAP_WINDOW = 5;

/**
 * Truncates an over-cap definition body so a payload never becomes a second wall of diffs
 * (spec 04 step 4). Bodies within `maxLines` pass through untouched; longer ones cut at a statement
 * boundary — a blank line, else a `;`/`}`/`{` line — searched a few lines below the cap (adapting
 * the chunker's `snapCut` preference order, but downward so nothing is dropped needlessly), with an
 * explicit `… (N more lines)` marker. No boundary in the window falls back to exactly the cap.
 */
export function capBody(body: string, maxLines = 80): string {
  const lines = body.split('\n');
  if (lines.length <= maxLines) return body;

  const cut = snapBodyCut(lines, maxLines);
  const omitted = lines.length - cut;
  const marker = `… (${omitted} more line${omitted === 1 ? '' : 's'})`;
  return [...lines.slice(0, cut), marker].join('\n');
}

/** Number of lines to keep: the first statement boundary at or below `cap`, else `cap`. */
function snapBodyCut(lines: string[], cap: number): number {
  const limit = Math.min(cap + CAP_SNAP_WINDOW, lines.length - 1);
  let statementEnd: number | undefined;
  for (let cut = cap; cut <= limit; cut++) {
    const lastLine = (lines[cut - 1] ?? '').trim();
    if (lastLine === '') return cut;
    if (statementEnd === undefined && /[;}{]$/.test(lastLine)) statementEnd = cut;
  }
  return statementEnd ?? cap;
}
