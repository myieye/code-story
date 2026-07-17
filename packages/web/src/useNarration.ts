import { isNarratableSection } from '@code-story/core';
import { useMemo } from 'react';
import type { BookResponse, NarrationResponse } from './api.js';
import { chunkAiLine, narrationIndicator, type NarrationIndicator, type SectionAiLine, sectionAiLine } from './narration-logic.js';

export interface NarrationState {
  /** Book-level opener, rendered above the feed; '' when none. */
  opener: string;
  /** Partial/complete/absent indicator for the progress cluster (spec 03 partial-state honesty). */
  indicator: NarrationIndicator;
  /** The one AI line a section header shows (intro, else applied order rationale). */
  sectionLine: (sectionId: string) => SectionAiLine | undefined;
  /** A chunk's one-line orientation, rendered above its diff. */
  chunkLine: (sectionId: string, chunkId: string) => string | undefined;
}

/**
 * Narration overlay view-state, mirroring useOrderOverlay. There is no PATCH surface — narration has
 * no apply/dismiss; it renders when present. The server returns the overlay already filtered fresh
 * (filterFreshNarration), so this never re-filters. `rationales` (the applied order overlay's lines)
 * feed the section-line fallback: intro wins, rationale fills in, one AI voice per header.
 */
export function useNarration(
  bookData: BookResponse,
  initial: NarrationResponse,
  rationales: Record<string, string> | undefined,
): NarrationState {
  const { overlay, job } = initial;

  const narratableIds = useMemo(() => {
    const byId = new Map(bookData.chunks.map((c) => [c.id, c]));
    return bookData.book.sections.filter((s) => isNarratableSection(s, byId)).map((s) => s.id);
  }, [bookData]);

  return useMemo(
    (): NarrationState => ({
      opener: overlay?.opener.text ?? '',
      indicator: narrationIndicator(narratableIds, overlay, job?.status),
      sectionLine: (sectionId) => sectionAiLine(sectionId, overlay, rationales),
      chunkLine: (sectionId, chunkId) => chunkAiLine(sectionId, chunkId, overlay),
    }),
    [overlay, job, rationales, narratableIds],
  );
}
