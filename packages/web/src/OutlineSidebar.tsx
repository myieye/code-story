import type { ChunkReview, ChunkReviewState } from '@code-story/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BookResponse } from './api.js';
import { chunkTitle, type FlatBook, occurrenceKey } from './rows.js';
import { isOutsideBox, resolveAutoExpand } from './scrollspy-logic.js';

/** State glyph for the outline — shape differs per state so it doesn't rely on colour (WCAG 1.4.1). */
export const STATE_GLYPH: Record<ChunkReviewState, string> = { reviewed: '✓', seen: '•', unseen: '○' };
/** Auto-read (spec 06 slice 3): a half-filled circle — part-way to done, shape-distinct from ○ • ✓. */
export const AUTO_READ_GLYPH = '◑';

/** The state + auto-read evidence flag a glyph needs — satisfied by ChunkReview and PieceMenuItem alike. */
type GlyphState = { state: ChunkReviewState; autoRead?: boolean } | undefined;

/** Whether a review counts as auto-read for glyph/rail purposes (a `seen` chunk holding the evidence flag). */
export function isAutoReadReview(review: GlyphState): boolean {
  return review?.autoRead === true && review.state !== 'reviewed';
}

/** The outline glyph for a chunk's review — ◑ for auto-read, else the plain state glyph. */
export function reviewGlyph(review: GlyphState): string {
  return isAutoReadReview(review) ? AUTO_READ_GLYPH : STATE_GLYPH[review?.state ?? 'unseen'];
}

/** The state-dot / rail class token for a chunk's review — `auto` for auto-read, else the state name. */
export function reviewGlyphClass(review: GlyphState): string {
  return isAutoReadReview(review) ? 'auto' : (review?.state ?? 'unseen');
}

export function OutlineSidebar({
  data,
  flat,
  width,
  reviewOf,
  sectionStats,
  currentSectionId,
  currentOccurrenceKey,
  onScreenSectionIds,
  onJump,
  deferred,
}: {
  data: BookResponse;
  flat: FlatBook;
  width: number;
  reviewOf: (chunkId: string) => ChunkReview;
  sectionStats: Map<string, { done: number; total: number }>;
  currentSectionId: string | undefined;
  currentOccurrenceKey: string | undefined;
  /** Sections with any chunk in the feed's virtual window — the faint viewport-range rail. */
  onScreenSectionIds: ReadonlySet<string>;
  onJump: (cursorIndex: number) => void;
  /** The trailing web-only Deferred section (spec 06 slice 6) — absent when nothing is deferred. */
  deferred?: { count: number; current: boolean; onJump: () => void };
}) {
  const [manual, setManual] = useState<ReadonlySet<string>>(new Set());
  const autoRef = useRef<string | undefined>(undefined);
  const byId = useMemo(() => new Map(data.chunks.map((c) => [c.id, c])), [data]);
  const navRef = useRef<HTMLElement>(null);

  const { expanded, autoExpandedId } = resolveAutoExpand(currentSectionId, autoRef.current, manual);
  autoRef.current = autoExpandedId;

  // Keep the active item visible, but only when it's outside the outline's own scroll box, and never
  // move focus — the spy is passive. `block: 'nearest'` lands it at the edge, no recenter.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const active =
      nav.querySelector<HTMLElement>('.outline-chunk.current') ?? nav.querySelector<HTMLElement>('.outline-item.current');
    if (!active) return;
    const a = active.getBoundingClientRect();
    const box = nav.getBoundingClientRect();
    if (isOutsideBox({ top: a.top, bottom: a.bottom }, { top: box.top, bottom: box.bottom })) {
      active.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }, [currentSectionId, currentOccurrenceKey, expanded]);

  return (
    <nav className="outline" style={{ width }} ref={navRef}>
      {data.book.sections.map((section) => {
        const stats = sectionStats.get(section.id);
        const isOpen = expanded.has(section.id);
        const isCurrent = section.id === currentSectionId;
        const classes = ['outline-item'];
        if (isCurrent) classes.push('current');
        if (onScreenSectionIds.has(section.id)) classes.push('in-view');
        return (
          <div key={section.id}>
            <div className={classes.join(' ')} {...(isCurrent ? { 'aria-current': 'true' as const } : {})}>
              <button
                className="outline-disclosure"
                aria-label={isOpen ? 'Collapse section' : 'Expand section'}
                onClick={() =>
                  setManual((prev) => {
                    const next = new Set(prev);
                    if (!next.delete(section.id)) next.add(section.id);
                    return next;
                  })
                }
              >
                {isOpen ? '▾' : '▸'}
              </button>
              <button
                className="outline-row"
                title={section.title}
                onClick={() => {
                  const first = section.occurrences[0] && flat.indexByOccurrence.get(occurrenceKey(section.occurrences[0]));
                  if (first !== undefined) onJump(first);
                }}
              >
                <span className="outline-path">{shortPath(section.title)}</span>
                <span className="outline-count">
                  {stats ? `${stats.done}/${stats.total}` : section.occurrences.length}
                </span>
              </button>
            </div>
            {isOpen &&
              section.occurrences.map((occurrence) => {
                const key = occurrenceKey(occurrence);
                const chunk = byId.get(occurrence.chunkId);
                const index = flat.indexByOccurrence.get(key);
                if (!chunk || index === undefined) return null;
                const current = key === currentOccurrenceKey;
                return (
                  <button
                    key={key}
                    className={current ? 'outline-chunk current' : 'outline-chunk'}
                    {...(current ? { 'aria-current': 'true' as const } : {})}
                    title={chunkTitle(chunk)}
                    onClick={() => onJump(index)}
                  >
                    <span className={`state-dot ${reviewGlyphClass(reviewOf(chunk.id))}`} aria-hidden="true">
                      {reviewGlyph(reviewOf(chunk.id))}
                    </span>
                    <span className="outline-path">{chunkTitle(chunk)}</span>
                  </button>
                );
              })}
          </div>
        );
      })}
      {deferred && (
        <div className={deferred.current ? 'outline-item deferred current' : 'outline-item deferred'} {...(deferred.current ? { 'aria-current': 'true' as const } : {})}>
          <button className="outline-row" title="Deferred chunks" onClick={deferred.onJump}>
            <span className="outline-path">⏲ Deferred</span>
            <span className="outline-count">{deferred.count}</span>
          </button>
        </div>
      )}
    </nav>
  );
}

function shortPath(path: string): string {
  const parts = path.split('/');
  return parts.length <= 2 ? path : `…/${parts.slice(-2).join('/')}`;
}
