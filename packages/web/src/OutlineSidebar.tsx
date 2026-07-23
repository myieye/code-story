import type { ChunkReview } from '@code-story/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BookResponse } from './api.js';
import { reviewGlyph, reviewGlyphClass } from './review-glyph-logic.js';
import { chunkTitle, fileBasename, type FlatBook, occurrenceKey } from './rows.js';
import { isOutsideBox, resolveAutoExpand } from './scrollspy-logic.js';

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
        // A chapter is anchored on one file but can weave in chunks from others (occurrence.label =
        // "lives outside the anchor file"). Count the distinct other files so the title stops reading
        // as a pure single-file container. Zero for file-mode sections and single-file chapters.
        const crossFiles = new Set<string>();
        for (const o of section.occurrences) if (o.label) crossFiles.add(o.label);
        const crossFileCount = crossFiles.size;
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
                {crossFileCount > 0 && (
                  <span
                    className="outline-anchor-note"
                    title={`Chapter anchored on ${section.title}; also weaves in chunks from ${crossFileCount} other file${crossFileCount === 1 ? '' : 's'}`}
                  >
                    +{crossFileCount} file{crossFileCount === 1 ? '' : 's'}
                  </span>
                )}
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
                    title={occurrence.label ? `${chunkTitle(chunk)} — ${chunk.file}` : chunkTitle(chunk)}
                    // A chunk woven in from another file is named so it doesn't read as the anchor file's.
                    aria-label={occurrence.label ? `${chunkTitle(chunk)} in ${fileBasename(chunk.file)}` : undefined}
                    onClick={() => onJump(index)}
                  >
                    <span className={`state-dot ${reviewGlyphClass(reviewOf(chunk.id))}`} aria-hidden="true">
                      {reviewGlyph(reviewOf(chunk.id))}
                    </span>
                    <span className="outline-path">{chunkTitle(chunk)}</span>
                    {occurrence.label && (
                      <span className="outline-chunk-file" title={chunk.file}>
                        {fileBasename(chunk.file)}
                      </span>
                    )}
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
