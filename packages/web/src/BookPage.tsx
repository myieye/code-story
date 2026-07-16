import type { Chunk, ChunkReviewState, ReviewFile } from '@code-story/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BookResponse } from './api.js';
import { DiffView } from './DiffView.js';
import { chunkSize, chunkTitle, flattenBook, type Row } from './rows.js';
import { useReview } from './useReview.js';

export function BookPage({ data, initialReview }: { data: BookResponse; initialReview: ReviewFile }) {
  const flat = useMemo(() => flattenBook(data.book, data.chunks), [data]);
  const review = useReview(initialReview);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowEls = useRef(new Map<number, HTMLElement>());
  const seenEdges = useRef(new Map<string, { top?: boolean; bottom?: boolean }>());
  const seenTimer = useRef<number | undefined>(undefined);

  const [cursor, setCursor] = useState(() => {
    const resumed = initialReview.cursor ? flat.chunkIndexById.get(initialReview.cursor) : undefined;
    return resumed ?? 0;
  });
  const [hideReviewed, setHideReviewed] = useState(false);
  const [collapsedOverride, setCollapsedOverride] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [announce, setAnnounce] = useState({ msg: '', seq: 0 });
  const [toastVisible, setToastVisible] = useState(false);

  const totalChunks = flat.chunkRowIndexes.length;
  const chunkRowAt = (i: number): Extract<Row, { kind: 'chunk' }> | undefined => {
    const rowIndex = flat.chunkRowIndexes[i];
    const row = rowIndex === undefined ? undefined : flat.rows[rowIndex];
    return row?.kind === 'chunk' ? row : undefined;
  };

  const reviewedCount = useMemo(
    () => flat.chunkRowIndexes.reduce((n, _, i) => n + (review.stateOf(chunkRowAt(i)!.chunk.id) === 'reviewed' ? 1 : 0), 0),
    [flat, review.states],
  );

  const sectionStats = useMemo(() => {
    const stats = new Map<string, { done: number; total: number }>();
    for (const row of flat.rows) {
      if (row.kind !== 'chunk') continue;
      const s = stats.get(row.sectionId) ?? { done: 0, total: 0 };
      s.total++;
      if (review.stateOf(row.chunk.id) === 'reviewed') s.done++;
      stats.set(row.sectionId, s);
    }
    return stats;
  }, [flat, review.states]);

  const isCollapsed = (chunk: Chunk) =>
    collapsedOverride.get(chunk.id) ?? (hideReviewed && review.stateOf(chunk.id) === 'reviewed');

  const virtualizer = useVirtualizer({
    count: flat.rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => estimateRowHeight(flat.rows[i]!, data, isCollapsed),
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
    const clamped = Math.max(0, Math.min(totalChunks - 1, next));
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
    say(`Resumed — ${totalChunks - reviewedCount} remaining.`);
  }, []);

  /** Next/previous not-reviewed chunk starting at `from` (cursor space), wrapping. */
  const findUnreviewed = (from: number, dir: 1 | -1, alsoReviewed?: string) => {
    for (let step = 0; step < totalChunks; step++) {
      const raw = from + dir * step;
      const i = ((raw % totalChunks) + totalChunks) % totalChunks;
      const id = chunkRowAt(i)!.chunk.id;
      if (id !== alsoReviewed && review.stateOf(id) !== 'reviewed') {
        return { index: i, wrapped: raw < 0 || raw >= totalChunks };
      }
    }
    return undefined;
  };

  const markCurrent = () => {
    const row = chunkRowAt(cursor);
    if (!row) return;
    const prior = review.stateOf(row.chunk.id);
    if (prior !== 'reviewed') review.setState(row.chunk.id, 'reviewed', prior === 'unseen' || undefined);
    const remaining = totalChunks - reviewedCount - (prior !== 'reviewed' ? 1 : 0);
    const next = findUnreviewed(cursor + 1, 1, row.chunk.id);
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
    const found = findUnreviewed(cursor + dir, dir);
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
    setCollapsedOverride((prev) => new Map(prev).set(row.chunk.id, !isCollapsed(row.chunk)));
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (overlayOpen) {
        if (e.key === 'Escape' || e.key === '?') {
          setOverlayOpen(false);
          e.preventDefault();
        }
        return;
      }
      const target = e.target as HTMLElement | null;
      if (e.key === 'Escape') {
        if (target?.closest('.cm-editor')) {
          const rowIndex = flat.chunkRowIndexes[cursor];
          if (rowIndex !== undefined) rowEls.current.get(rowIndex)?.focus({ preventScroll: true });
          e.preventDefault();
        }
        return;
      }
      if (target?.closest('.cm-editor, input, textarea, select, button')) return;
      const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
      if (plain && (e.key === 'j' || e.key === 'PageDown')) moveCursor(cursor + 1);
      else if (plain && (e.key === 'k' || e.key === 'PageUp')) moveCursor(cursor - 1);
      else if (plain && e.key === 'n') jumpUnreviewed(1);
      else if (plain && e.key === 'N') jumpUnreviewed(-1);
      else if (plain && e.key === 'Enter') {
        // Key-repeat never marks: each mark requires a fresh keydown (R-026).
        if (!e.repeat) markCurrent();
      } else if (plain && e.key === 'u') unmarkCurrent();
      else if (plain && e.key === 'x') toggleCollapseCurrent();
      else if (plain && e.key === '?') setOverlayOpen(true);
      else if (e.ctrlKey && e.key === 'Home') moveCursor(0);
      else if (e.ctrlKey && e.key === 'End') moveCursor(totalChunks - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // seen = both edges of the block have been inside the viewport (covers blocks taller than it)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scan = () => {
      const top = el.scrollTop;
      const bottom = top + el.clientHeight;
      const newlySeen: string[] = [];
      for (const item of virtualizer.getVirtualItems()) {
        const row = flat.rows[item.index];
        if (row?.kind !== 'chunk') continue;
        if (review.stateOf(row.chunk.id) !== 'unseen') continue;
        const edges = seenEdges.current.get(row.chunk.id) ?? {};
        if (item.start >= top && item.start <= bottom) edges.top = true;
        if (item.end >= top && item.end <= bottom) edges.bottom = true;
        seenEdges.current.set(row.chunk.id, edges);
        if (edges.top && edges.bottom) newlySeen.push(row.chunk.id);
      }
      review.setSeen(newlySeen);
    };
    const onScroll = () => {
      window.clearTimeout(seenTimer.current);
      seenTimer.current = window.setTimeout(scan, 160);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    const initial = window.setTimeout(scan, 400);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.clearTimeout(initial);
    };
  });

  const items = virtualizer.getVirtualItems();
  const currentSection = useMemo(() => {
    const first = items[0]?.index ?? 0;
    for (let i = first; i >= 0; i--) {
      const row = flat.rows[i];
      if (row?.kind === 'section') return row.title;
      if (row?.kind === 'chunk') return row.sectionTitle;
    }
    return undefined;
  }, [items, flat]);

  const cursorRowIndex = flat.chunkRowIndexes[cursor];
  const done = reviewedCount === totalChunks;

  return (
    <div className="app">
      <header className="top-bar">
        <h1>code-story</h1>
        <span className="range" title={`${data.base}..${data.head}`}>
          {data.base.slice(0, 8)}..{data.head.slice(0, 8)}
        </span>
        <span className="progress-cluster">
          <span className="progress-text">
            {reviewedCount} / {totalChunks} reviewed
          </span>
          <span className="progress-bar">
            <span className="progress-fill" style={{ width: `${totalChunks ? (reviewedCount / totalChunks) * 100 : 0}%` }} />
          </span>
        </span>
        <span className="spacer" />
        <button className="bar-button" title="n" onClick={() => jumpUnreviewed(1)} disabled={done}>
          Next unreviewed
        </button>
        <label className="bar-toggle">
          <input
            type="checkbox"
            checked={hideReviewed}
            onChange={(e) => {
              setHideReviewed(e.currentTarget.checked);
              setCollapsedOverride(new Map());
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
      <div className="body">
        <OutlineSidebar
          data={data}
          flat={flat}
          stateOf={review.stateOf}
          sectionStats={sectionStats}
          currentSection={currentSection}
          cursorChunkId={chunkRowAt(cursor)?.chunk.id}
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
                      data={data}
                      total={totalChunks}
                      reviewedCount={reviewedCount}
                      sectionStats={sectionStats}
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

function OutlineSidebar({
  data,
  flat,
  stateOf,
  sectionStats,
  currentSection,
  cursorChunkId,
  onJump,
}: {
  data: BookResponse;
  flat: ReturnType<typeof flattenBook>;
  stateOf: (chunkId: string) => ChunkReviewState;
  sectionStats: Map<string, { done: number; total: number }>;
  currentSection: string | undefined;
  cursorChunkId: string | undefined;
  onJump: (cursorIndex: number) => void;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const byId = useMemo(() => new Map(data.chunks.map((c) => [c.id, c])), [data]);

  return (
    <nav className="outline">
      {data.book.sections.map((section) => {
        const stats = sectionStats.get(section.id);
        const isOpen = expanded.has(section.id);
        return (
          <div key={section.id}>
            <div className={section.title === currentSection ? 'outline-item current' : 'outline-item'}>
              <button
                className="outline-disclosure"
                aria-label={isOpen ? 'Collapse section' : 'Expand section'}
                onClick={() =>
                  setExpanded((prev) => {
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
                  const first = section.occurrences[0] && flat.chunkIndexById.get(section.occurrences[0].chunkId);
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
                const chunk = byId.get(occurrence.chunkId);
                const index = flat.chunkIndexById.get(occurrence.chunkId);
                if (!chunk || index === undefined) return null;
                return (
                  <button
                    key={occurrence.chunkId}
                    className={occurrence.chunkId === cursorChunkId ? 'outline-chunk current' : 'outline-chunk'}
                    title={chunkTitle(chunk)}
                    onClick={() => onJump(index)}
                  >
                    <span className={`state-dot ${stateOf(chunk.id)}`} />
                    <span className="outline-path">{chunkTitle(chunk)}</span>
                  </button>
                );
              })}
          </div>
        );
      })}
    </nav>
  );
}

function RowView({
  row,
  data,
  total,
  reviewedCount,
  sectionStats,
  state,
  collapsed,
  isCursor,
  registerEl,
  onSelect,
  onJumpNext,
}: {
  row: Row;
  data: BookResponse;
  total: number;
  reviewedCount: number;
  sectionStats: Map<string, { done: number; total: number }>;
  state: ChunkReviewState;
  collapsed: boolean;
  isCursor: boolean;
  registerEl: (el: HTMLElement | null) => void;
  onSelect: () => void;
  onJumpNext: () => void;
}) {
  if (row.kind === 'section') {
    const stats = sectionStats.get(row.id);
    return (
      <div className="section-header">
        <span className="section-path">{row.title}</span>
        <span className="section-count">{stats ? `${stats.done}/${stats.total} reviewed` : `${row.chunkCount} chunks`}</span>
      </div>
    );
  }
  if (row.kind === 'end') {
    if (reviewedCount === total) {
      return (
        <div className="end-of-book done">
          <p className="done-headline">All {total} chunks reviewed.</p>
          <p>Nothing was skipped — every chunk required your mark.</p>
          <table className="done-table">
            <tbody>
              {data.book.sections.map((section) => {
                const stats = sectionStats.get(section.id);
                return (
                  <tr key={section.id}>
                    <td>{section.title}</td>
                    <td>{stats ? `${stats.done}/${stats.total}` : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <a className="export" href="/api/export.md" target="_blank" rel="noreferrer">
            Export
          </a>
        </div>
      );
    }
    return (
      <div className="end-of-book">
        End of book — {total - reviewedCount} of {total} chunks remaining.{' '}
        <button className="bar-button" onClick={onJumpNext}>
          Jump to next unreviewed
        </button>
      </div>
    );
  }

  const { chunk } = row;
  const size = chunkSize(chunk);
  const classes = ['chunk', `state-${state}`];
  if (isCursor) classes.push('cursor');
  if (collapsed) classes.push('collapsed');
  return (
    <article
      className={classes.join(' ')}
      aria-posinset={row.posinset}
      aria-setsize={total}
      tabIndex={-1}
      ref={registerEl}
      onClick={onSelect}
    >
      <div className="chunk-box">
        <div className="state-rail" title={state} />
        <div className="chunk-main">
          <div className="chunk-header">
            {state === 'reviewed' && <span className="check" aria-hidden="true">✓</span>}
            <span className="chunk-title">{chunkTitle(chunk)}</span>
            <span className={`badge kind-${chunk.kind}`}>{chunk.kind}</span>
            <span className="chunk-size">
              <span className="added">+{size.added}</span> <span className="removed">−{size.removed}</span>
            </span>
          </div>
          {collapsed ? (
            <div className="chunk-collapsed-note">collapsed — press x to expand</div>
          ) : (
            <DiffView file={chunk.file} lines={data.diffs[chunk.id] ?? []} />
          )}
        </div>
      </div>
    </article>
  );
}

function ShortcutOverlay({ onClose }: { onClose: () => void }) {
  const keys: [string, string][] = [
    ['j / k', 'next / previous chunk'],
    ['n / Shift+N', 'next / previous unreviewed chunk'],
    ['Enter', 'mark reviewed, go to next unreviewed'],
    ['u', 'unmark'],
    ['x', 'collapse / expand chunk'],
    ['Ctrl+Home / Ctrl+End', 'top / end of book'],
    ['Esc', 'leave the code editor, back to the chunk'],
    ['?', 'this overlay'],
  ];
  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
        <h2>Keyboard shortcuts</h2>
        <table>
          <tbody>
            {keys.map(([key, what]) => (
              <tr key={key}>
                <td className="key">{key}</td>
                <td>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="bar-button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function estimateRowHeight(row: Row, data: BookResponse, isCollapsed: (chunk: Chunk) => boolean): number {
  if (row.kind === 'section') return 46;
  if (row.kind === 'end') return 160;
  if (isCollapsed(row.chunk)) return 76;
  const lines = data.diffs[row.chunk.id]?.length ?? 1;
  return 58 + Math.max(lines, 1) * 19;
}

function shortPath(path: string): string {
  const parts = path.split('/');
  return parts.length <= 2 ? path : `…/${parts.slice(-2).join('/')}`;
}
