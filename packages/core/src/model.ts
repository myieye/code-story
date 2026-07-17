import { type Hunk } from './diff.js';

// The book/chunk model from docs/design/core-primitives-sketch.md, restricted to the
// milestone-0 subset (spec 00).

/** Bump whenever chunking or ordering logic changes — bookFingerprint bakes it in, so a bump invalidates persisted order overlays. */
export const CORE_VERSION = '0.0.2';

export type ChunkKind = 'method' | 'method-fragment' | 'markup-region' | 'config' | 'other';

export type ChangeType = 'generated' | 'whitespace';

export interface LineRange {
  /** 1-based, inclusive */
  start: number;
  end: number;
}

export interface Chunk {
  id: string;
  file: string;
  /** e.g. ["UserService", "Merge"]; empty for non-code chunks */
  symbolPath: string[];
  /** What to call the chunk in UIs/exports: symbolPath plus fragment/leftover labels. */
  displayPath: string[];
  baseRange?: LineRange;
  headRange?: LineRange;
  kind: ChunkKind;
  /** Non-empty marks the chunk low-signal: collapsed stub, batch-ackable (R-002). */
  changeTypes: ChangeType[];
  /** Stub badge label when `generated` ∈ changeTypes, e.g. "lockfile" (R-002). */
  generatedReason?: string;
  /** The diff hunks (or sub-hunks after boundary splits) this chunk owns — its exact coverage. */
  hunks: Hunk[];
}

export type OccurrenceRole = 'primary' | 'context' | 'flow-step';

export interface Occurrence {
  chunkId: string;
  ordinal: number;
  role: OccurrenceRole;
}

export interface Section {
  id: string;
  title: string;
  occurrences: Occurrence[];
}

export interface Book {
  sections: Section[];
  /** head commit SHA the book was compiled from */
  headSha: string;
}

export type ChunkReviewState = 'unseen' | 'seen' | 'reviewed';

/**
 * Stable chunk identity for a fixed head (spec 00): file + symbol path + a fingerprint of the
 * normalized changed lines.
 */
export function chunkId(file: string, symbolPath: string[], fingerprint: string): string {
  return [file, symbolPath.join('.'), fingerprint].join('::');
}

/** Id of the synthesized section holding changed lines no chunk claimed (the R-001 backstop). */
export const LEFTOVERS_SECTION_ID = '(leftovers)';

/** Low-signal chunks render as collapsed stubs and are batch-acknowledgeable (R-002). */
export function isLowSignal(chunk: Chunk): boolean {
  return chunk.changeTypes.length > 0;
}

/** Sections that can carry narration: not leftovers, not all-low-signal (spec 03 non-goals). */
export function isNarratableSection(section: Section, chunksById: Map<string, Chunk>): boolean {
  if (section.id === LEFTOVERS_SECTION_ID) return false;
  const chunks = section.occurrences.map((o) => chunksById.get(o.chunkId)).filter((c): c is Chunk => c !== undefined);
  return chunks.length > 0 && !chunks.every((c) => isLowSignal(c));
}

/** Changed-line count a chunk owns — the "~N lines" shown in dumps and manifests. */
export function chunkLineCount(chunk: Chunk): number {
  return chunk.hunks.reduce((n, h) => n + Math.max(h.headCount, h.baseCount), 0);
}

/** Stub badge / export label, e.g. "lockfile", "translations", "whitespace". */
export function lowSignalReason(chunk: Chunk): string {
  return chunk.generatedReason ?? chunk.changeTypes[0] ?? 'generated';
}

/** The chunk's display title, with a line-range fallback for label-less chunks. */
export function chunkTitle(chunk: Chunk): string {
  if (chunk.displayPath.length > 0) return chunk.displayPath.join('.');
  const range = chunk.headRange ?? chunk.baseRange;
  return range ? `lines ${range.start}–${range.end}` : chunk.file;
}
