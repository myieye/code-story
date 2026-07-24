import { isLowSignal, isNarratableSection } from '@code-story/core';
import { useMemo } from 'react';
import type { BookResponse, NarrationResponse } from './api.js';
import {
  chunkAiLine,
  chunkBadge,
  type ChunkEntries,
  chunkLineV2,
  chunkNarrationIndicator,
  chunkReviewNote,
  narrationIndicator,
  type NarrationIndicator,
  type SectionAiLine,
  sectionAiLine,
} from './narration-logic.js';

export interface NarrationState {
  /** Book-level opener, rendered above the feed; '' when none. */
  opener: string;
  /** Partial/complete/absent indicator for the progress cluster (spec 03 partial-state honesty). */
  indicator: NarrationIndicator;
  /** Chunk-narration v2 coverage indicator (spec 06 slice 5); null when no v2 overlay. */
  chunkIndicator: NarrationIndicator;
  /** The one AI line a section header shows (intro, else applied order rationale). */
  sectionLine: (sectionId: string) => SectionAiLine | undefined;
  /** A chunk's one-line orientation — v2 entry first, else the v1 section-keyed line (file mode). */
  chunkLine: (sectionId: string, chunkId: string) => string | undefined;
  /** The chunk's 2–4-word AI badge (v2 only); undefined when none. */
  chunkBadge: (chunkId: string) => string | undefined;
  /** The chunk's deeper "what to verify" note (R-068); undefined for ordinary chunks. */
  chunkReviewNote: (chunkId: string) => string | undefined;
}

/**
 * Narration overlay view-state, mirroring useOrderOverlay. There is no PATCH surface — narration has
 * no apply/dismiss; it renders when present. The server returns overlays already filtered fresh
 * (filterFreshNarration / filterFreshNarrationV2), so this never re-filters. `rationales` (the
 * applied order overlay's lines) feed the section-line fallback: intro wins, rationale fills in.
 * `chunkEntries` is the v2 per-chunk overlay (chapter mode); it wins over the v1 chunk line.
 */
export function useNarration(
  bookData: BookResponse,
  initial: NarrationResponse,
  rationales: Record<string, string> | undefined,
): NarrationState {
  const { overlay, job } = initial;
  const chunkEntries = initial.chunkEntries as ChunkEntries | undefined;

  const narratableIds = useMemo(() => {
    const byId = new Map(bookData.chunks.map((c) => [c.id, c]));
    return bookData.book.sections.filter((s) => isNarratableSection(s, byId)).map((s) => s.id);
  }, [bookData]);

  const narratableChunkIds = useMemo(() => bookData.chunks.filter((c) => !isLowSignal(c)).map((c) => c.id), [bookData]);

  return useMemo(
    (): NarrationState => ({
      opener: overlay?.opener.text ?? '',
      indicator: narrationIndicator(narratableIds, overlay, job?.status),
      chunkIndicator: chunkNarrationIndicator(narratableChunkIds, chunkEntries, job?.status),
      sectionLine: (sectionId) => sectionAiLine(sectionId, overlay, rationales),
      chunkLine: (sectionId, chunkId) => chunkLineV2(chunkId, chunkEntries, chunkAiLine(sectionId, chunkId, overlay)),
      chunkBadge: (chunkId) => chunkBadge(chunkId, chunkEntries),
      chunkReviewNote: (chunkId) => chunkReviewNote(chunkId, chunkEntries),
    }),
    [overlay, chunkEntries, job, rationales, narratableIds, narratableChunkIds],
  );
}
