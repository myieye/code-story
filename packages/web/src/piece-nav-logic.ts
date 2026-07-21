import type { Chunk, ChunkReview, ChunkReviewState } from '@code-story/core';
import { chunkSize, chunkTitle } from './rows.js';

/**
 * A chunk's position among the distinct pieces of its file (spec 06 slice 2). Ordering is the file's
 * distinct chunks sorted by `headRange.start ?? baseRange.start` — the file dimension the chapter
 * scatter hides. Position is a property of the file, so it counts distinct chunks, never occurrences.
 */
export interface FilePiece {
  n: number;
  total: number;
  fileChunkIdsInOrder: string[];
}

function startLine(chunk: Chunk): number {
  return chunk.headRange?.start ?? chunk.baseRange?.start ?? 0;
}

/** Map every distinct chunk id to its piece position within its file. */
export function fileOrderIndex(chunks: readonly Chunk[]): Map<string, FilePiece> {
  const byFile = new Map<string, Chunk[]>();
  for (const chunk of chunks) {
    const arr = byFile.get(chunk.file);
    if (arr) arr.push(chunk);
    else byFile.set(chunk.file, [chunk]);
  }
  const index = new Map<string, FilePiece>();
  for (const arr of byFile.values()) {
    const sorted = [...arr].sort((a, b) => startLine(a) - startLine(b) || a.id.localeCompare(b.id));
    const ids = sorted.map((c) => c.id);
    sorted.forEach((chunk, i) => index.set(chunk.id, { n: i + 1, total: ids.length, fileChunkIdsInOrder: ids }));
  }
  return index;
}

export interface PieceMenuItem {
  chunkId: string;
  n: number;
  title: string;
  state: ChunkReviewState;
  /** Seen at reading pace but not yet confirmed (spec 06 slice 3) — renders the ◑ glyph. */
  autoRead: boolean;
  added: number;
  removed: number;
  current: boolean;
}

export interface PieceMenuModel {
  file: string;
  total: number;
  reviewed: number;
  items: PieceMenuItem[];
}

/** The file-pieces menu contents for one file, in file order, with per-piece state and diff sizes. */
export function pieceMenuModel(
  file: string,
  piece: FilePiece,
  chunksById: Map<string, Chunk>,
  reviewOf: (id: string) => ChunkReview,
  currentChunkId: string,
): PieceMenuModel {
  let reviewed = 0;
  const items: PieceMenuItem[] = [];
  piece.fileChunkIdsInOrder.forEach((chunkId, i) => {
    const chunk = chunksById.get(chunkId);
    if (!chunk) return;
    const review = reviewOf(chunkId);
    if (review.state === 'reviewed') reviewed++;
    const size = chunkSize(chunk);
    items.push({
      chunkId,
      n: i + 1,
      title: chunkTitle(chunk),
      state: review.state,
      autoRead: review.autoRead === true && review.state !== 'reviewed',
      added: size.added,
      removed: size.removed,
      current: chunkId === currentChunkId,
    });
  });
  return { file, total: piece.fileChunkIdsInOrder.length, reviewed, items };
}

/** The chunk id one step in `dir` from `currentChunkId` within its file, or undefined at the ends. */
export function stepPieceTarget(
  piece: FilePiece | undefined,
  currentChunkId: string,
  dir: 1 | -1,
): string | undefined {
  if (!piece) return undefined;
  const i = piece.fileChunkIdsInOrder.indexOf(currentChunkId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= piece.fileChunkIdsInOrder.length) return undefined;
  return piece.fileChunkIdsInOrder[j];
}
