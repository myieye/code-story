import { type Chunk, type ChunkReviewState, isLowSignal, type ReviewFile } from '@code-story/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BookResponse, OrderResponse } from './api.js';
import { OutlineSidebar } from './OutlineSidebar.js';
import { batchableSections, findUnreviewed, pendingStubCount } from './review-logic.js';
import { estimateRowHeight, RowView, type SectionAck } from './RowView.js';
import { flattenBook, occurrenceKey, type Row } from './rows.js';
import { ShortcutOverlay } from './ShortcutOverlay.js';
import { useBookKeymap } from './useBookKeymap.js';
import { useOrderOverlay } from './useOrderOverlay.js';
import { useReview } from './useReview.js';
import { useSeenTracking } from './useSeenTracking.js';

export function BookPage({
  data,
  initialReview,
  initialOrder,
}: {
  data: BookResponse;
  initialReview: ReviewFile;
  initialOrder: OrderResponse;
}) {
  const review = useReview(initialReview);
  const order = useOrderOverlay(data, initialOrder, review.states);
  const { bookData, orderApplied, rationales: sectionRationales } = order;
  const hasRationale = useCallback((id: string) => Boolean(sectionRationales?.[id]), [sectionRationales]);

  const flat = useMemo(() => flattenBook(bookData.book, bookData.chunks), [bookData]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowEls = useRef(new Map<number, HTMLElement>());

  const [cursor, setCursor] = useState(() => {
    const resumed = initialReview.cursor ? flat.firstIndexByChunkId.get(initialReview.cursor) : undefined;
    return resumed ?? 0;
  });
  const [hideReviewed, setHideReviewed] = useState(false);
  // Persisted stub expansions (review.expanded) seed the overrides so reloads keep them open.
  const [collapsedOverride, setCollapsedOverride] = useState<ReadonlyMap<string, boolean>>(() => {
    const seeded = new Map<string, boolean>();
    for (const [id, entry] of Object.entries(initialReview.chunks)) {
      if (entry.expanded) seeded.set(id, false);
    }
    return seeded;
  });
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [announce, setAnnounce] = useState({ msg: '', seq: 0 });
  const [toastVisible, setToastVisible] = useState(false);
  const [lastBatch, setLastBatch] = useState<{ sectionId: string; prior: { chunkId: string; state: ChunkReviewState }[] } | null>(null);

  // Two sizes: occurrences are walk stops (cursor space); distinct chunks carry review state.
  const { totalOccurrences, distinctChunks } = flat;
  const chunkRowAt = (i: number): Extract<Row, { kind: 'chunk' }> | undefined => {
    const rowIndex = flat.chunkRowIndexes[i];
    const row = rowIndex === undefined ? undefined : flat.rows[rowIndex];
    return row?.kind === 'chunk' ? row : undefined;
  };

  const reviewedCount = useMemo(
    () => [...flat.firstIndexByChunkId.keys()].reduce((n, id) => n + (review.stateOf(id) === 'reviewed' ? 1 : 0), 0),
    [flat, review.states],
  );

  const sectionStats = useMemo(() => {
    const stats = new Map<string, { done: number; total: number; counted: Set<string> }>();
    for (const row of flat.rows) {
      if (row.kind !== 'chunk') continue;
      const s = stats.get(row.sectionId) ?? { done: 0, total: 0, counted: new Set<string>() };
      if (!s.counted.has(row.chunk.id)) {
        s.counted.add(row.chunk.id);
        s.total++;
        if (review.stateOf(row.chunk.id) === 'reviewed') s.done++;
      }
      stats.set(row.sectionId, s);
    }
    return stats;
  }, [flat, review.states]);

  const batches = useMemo(() => batchableSections(flat, review.stateOf), [flat, review.states]);
  const pendingStubs = useMemo(() => pendingStubCount(flat, review.stateOf), [flat, review.states]);

  const isCollapsed = (chunk: Chunk) =>
    collapsedOverride.get(chunk.id) ?? (isLowSignal(chunk) || (hideReviewed && review.stateOf(chunk.id) === 'reviewed'));

  const setCollapsed = (chunk: Chunk, collapsed: boolean) => {
    setCollapsedOverride((prev) => new Map(prev).set(chunk.id, collapsed));
    if (isLowSignal(chunk)) review.setExpanded(chunk.id, !collapsed);
  };

  const virtualizer = useVirtualizer({
    count: flat.rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => estimateRowHeight(flat.rows[i]!, bookData, isCollapsed, hasRationale),
    overscan: 8,
  });

  // Double-invoke: with dynamic measurement a long jump lands on estimated offsets and the
  // first frame's measurements shift the layout out from under the viewport.
  const scrollToRow = (index: number) => {
    virtualizer.scrollToIndex(index, { align: 'start' });
    requestAnimationFrame(() => virtualizer.scrollToIndex(index, { align: 'start' }));
  };

  const say = (msg: string) => setAnnounce((a) => ({ msg, seq: a.seq + 1 }));

  useEffect(() => {
    if (!announce.msg) return;
    setToastVisible(true);
    const t = window.setTimeout(() => setToastVisible(false), 2600);
    return () => window.clearTimeout(t);
  }, [announce]);

  const moveCursor = (next: number) => {
    const clamped = Math.max(0, Math.min(totalOccurrences - 1, next));
    setCursor(clamped);
    const rowIndex = flat.chunkRowIndexes[clamped]!;
    scrollToRow(rowIndex);
    // Roving focus onto the block container once the virtualizer has it mounted.
    requestAnimationFrame(() => requestAnimationFrame(() => rowEls.current.get(rowIndex)?.focus({ preventScroll: true })));
  };

  useEffect(() => {
    const id = chunkRowAt(cursor)?.chunk.id;
    if (id) review.setCursor(id);
  }, [cursor]);

  useEffect(() => {
    if (!initialReview.cursor || cursor === 0) return;
    scrollToRow(flat.chunkRowIndexes[cursor]!);
    say(`Resumed — ${distinctChunks - reviewedCount} remaining.`);
  }, []);

  const markCurrent = () => {
    const row = chunkRowAt(cursor);
    if (!row) return;
    const prior = review.stateOf(row.chunk.id);
    if (prior !== 'reviewed') review.setState(row.chunk.id, 'reviewed', prior === 'unseen' || undefined);
    const remaining = distinctChunks - reviewedCount - (prior !== 'reviewed' ? 1 : 0);
    const next = findUnreviewed(flat, review.stateOf, cursor + 1, 1, row.chunk.id);
    if (next) {
      say(next.wrapped ? `Reviewed. ${remaining} remaining. Wrapped to start of book.` : `Reviewed. ${remaining} remaining.`);
      moveCursor(next.index);
    } else {
      say('All chunks reviewed.');
      scrollToRow(flat.rows.length - 1);
    }
  };

  const unmarkCurrent = () => {
    const row = chunkRowAt(cursor);
    if (!row || review.stateOf(row.chunk.id) !== 'reviewed') return;
    review.setState(row.chunk.id, 'seen');
    say('Unmarked.');
  };

  const jumpUnreviewed = (dir: 1 | -1) => {
    const found = findUnreviewed(flat, review.stateOf, cursor + dir, dir);
    if (!found) {
      say('All chunks reviewed.');
      return;
    }
    if (found.wrapped) say(dir === 1 ? 'Wrapped to start of book.' : 'Wrapped to end of book.');
    moveCursor(found.index);
  };

  const toggleCollapseCurrent = () => {
    const row = chunkRowAt(cursor);
    if (!row) return;
    setCollapsed(row.chunk, !isCollapsed(row.chunk));
  };

  const markSection = (sectionId: string) => {
    const batch = batches.get(sectionId);
    if (!batch) return;
    setLastBatch({ sectionId, prior: batch.ids.map((id) => ({ chunkId: id, state: review.stateOf(id) })) });
    review.setMany(
      batch.ids.map((id) => ({
        chunkId: id,
        state: 'reviewed' as const,
        ...(review.stateOf(id) === 'unseen' ? { markedUnseen: true } : {}),
      })),
    );
    const remaining = distinctChunks - reviewedCount - batch.ids.length;
    say(remaining === 0 ? `${batch.ids.length} chunks marked reviewed. All chunks reviewed.` : `${batch.ids.length} chunks marked reviewed. ${remaining} remaining.`);
  };

  const undoBatch = () => {
    if (!lastBatch) return;
    review.setMany(lastBatch.prior);
    say(`Batch undone. ${distinctChunks - reviewedCount + lastBatch.prior.length} remaining.`);
    setLastBatch(null);
  };

  useBookKeymap({
    overlayOpen,
    setOverlayOpen,
    cursor,
    totalOccurrences,
    flat,
    rowEls,
    moveCursor,
    jumpUnreviewed,
    markCurrent,
    unmarkCurrent,
    toggleCollapseCurrent,
  });

  useSeenTracking({ scrollRef, virtualizer, flat, stateOf: review.stateOf, setSeen: review.setSeen });

  const items = virtualizer.getVirtualItems();
  const currentSection = useMemo(() => {
    // Skip overscan rows above the viewport — the bar must name the section actually on screen.
    const top = virtualizer.scrollOffset ?? 0;
    const first = (items.find((it) => it.end > top) ?? items[0])?.index ?? 0;
    for (let i = first; i >= 0; i--) {
      const row = flat.rows[i];
      if (row?.kind === 'section') return row.title;
      if (row?.kind === 'chunk') return row.sectionTitle;
    }
    return undefined;
  }, [items, flat]);

  const sectionAckFor = (sectionId: string): SectionAck | undefined => {
    if (lastBatch?.sectionId === sectionId) return { kind: 'undo', count: lastBatch.prior.length };
    const batch = batches.get(sectionId);
    return batch ? { kind: 'mark', count: batch.ids.length, reason: batch.reason } : undefined;
  };

  const cursorRowIndex = flat.chunkRowIndexes[cursor];
  const cursorRow = chunkRowAt(cursor);
  const done = distinctChunks > 0 && reviewedCount === distinctChunks;

  return (
    <div className="app">
      <header className="top-bar">
        <h1>code-story</h1>
        <span className="range" title={`${data.base}..${data.head}`}>
          {data.base.slice(0, 8)}..{data.head.slice(0, 8)}
        </span>
        <span className="progress-cluster">
          <span className={done ? 'progress-text done' : 'progress-text'}>
            {done ? (
              `All ${distinctChunks} reviewed ✓`
            ) : (
              <>
                {reviewedCount} / {distinctChunks} reviewed
                {pendingStubs > 0 && ` · ${pendingStubs} pending stub${pendingStubs === 1 ? '' : 's'}`}
              </>
            )}
          </span>
          <span className="progress-bar">
            <span className="progress-fill" style={{ width: `${distinctChunks ? (reviewedCount / distinctChunks) * 100 : 0}%` }} />
          </span>
          {orderApplied && (
            <span className="ai-order-indicator" title="The section order was proposed by AI">
              AI reading order
            </span>
          )}
        </span>
        <span className="spacer" />
        {lastBatch && (
          <button className="bar-button" onClick={undoBatch}>
            Undo batch ({lastBatch.prior.length})
          </button>
        )}
        {done ? (
          <button className="bar-button" title="End of book" onClick={() => scrollToRow(flat.rows.length - 1)}>
            View summary
          </button>
        ) : (
          <button className="bar-button" title="n" onClick={() => jumpUnreviewed(1)}>
            Next unreviewed
          </button>
        )}
        <label className="bar-toggle">
          <input
            type="checkbox"
            checked={hideReviewed}
            onChange={(e) => {
              setHideReviewed(e.currentTarget.checked);
              // Reset overrides, but keep stub expansions — they are persisted review state.
              setCollapsedOverride((prev) => {
                const kept = new Map<string, boolean>();
                for (const [id, collapsed] of prev) {
                  const index = flat.firstIndexByChunkId.get(id);
                  const chunk = index === undefined ? undefined : chunkRowAt(index)?.chunk;
                  if (chunk && isLowSignal(chunk) && !collapsed) kept.set(id, collapsed);
                }
                return kept;
              });
              e.currentTarget.blur();
            }}
          />
          Hide reviewed
        </label>
        <a className="export" href="/api/export.md" target="_blank" rel="noreferrer">
          Export
        </a>
        <button className="bar-button help" title="Keyboard shortcuts (?)" onClick={() => setOverlayOpen(true)}>
          ?
        </button>
      </header>
      {order.offer && (
        <div className="order-banner" role="region" aria-label="AI reading order">
          <span>AI reading order ready — apply?</span>
          <button className="bar-button" onClick={order.applyOrder}>
            Apply
          </button>
          <button className="bar-button" onClick={order.dismissOrder}>
            Dismiss
          </button>
        </div>
      )}
      <div className="body">
        <OutlineSidebar
          data={bookData}
          flat={flat}
          stateOf={review.stateOf}
          sectionStats={sectionStats}
          currentSection={currentSection}
          cursorOccurrence={cursorRow ? occurrenceKey(cursorRow.occurrence) : undefined}
          onJump={moveCursor}
        />
        <div className="feed-wrap">
          {currentSection && <div className="current-file">{currentSection}</div>}
          <div
            className="feed"
            ref={scrollRef}
            role="feed"
            aria-label={`Review book ${data.base.slice(0, 8)}..${data.head.slice(0, 8)}`}
          >
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {items.map((item) => {
                const row = flat.rows[item.index]!;
                return (
                  <div
                    key={item.key}
                    data-index={item.index}
                    ref={virtualizer.measureElement}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${item.start}px)` }}
                  >
                    <RowView
                      row={row}
                      data={bookData}
                      totalOccurrences={totalOccurrences}
                      distinctChunks={distinctChunks}
                      reviewedCount={reviewedCount}
                      sectionStats={sectionStats}
                      sectionAck={row.kind === 'section' ? sectionAckFor(row.id) : undefined}
                      sectionRationale={row.kind === 'section' ? sectionRationales?.[row.id] : undefined}
                      onMarkSection={markSection}
                      onUndoBatch={undoBatch}
                      state={row.kind === 'chunk' ? review.stateOf(row.chunk.id) : 'unseen'}
                      collapsed={row.kind === 'chunk' && isCollapsed(row.chunk)}
                      isCursor={item.index === cursorRowIndex}
                      registerEl={(el) => {
                        if (el) rowEls.current.set(item.index, el);
                        else rowEls.current.delete(item.index);
                      }}
                      onSelect={() => {
                        const i = flat.chunkRowIndexes.indexOf(item.index);
                        if (i >= 0) setCursor(i);
                      }}
                      onJumpNext={() => jumpUnreviewed(1)}
                      onExpand={(chunk) => setCollapsed(chunk, false)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="sr-only" aria-live="polite">
        {announce.msg}
      </div>
      {toastVisible && announce.msg && <div className="toast">{announce.msg}</div>}
      {overlayOpen && <ShortcutOverlay onClose={() => setOverlayOpen(false)} />}
    </div>
  );
}
