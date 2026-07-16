export const CORE_VERSION = '0.0.1';

export * from './diff.js';

// The book/chunk model from docs/design/core-primitives-sketch.md, restricted to the
// milestone-0 subset (spec 00).

export type ChunkKind = 'method' | 'method-fragment' | 'markup-region' | 'config' | 'other';

export type ChangeType = 'generated';

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
  baseRange?: LineRange;
  headRange?: LineRange;
  kind: ChunkKind;
  changeTypes: ChangeType[];
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
