import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BookResponse } from './api.js';
import { DiffView } from './DiffView.js';
import { chunkSize, chunkTitle, flattenBook, type Row } from './rows.js';

export function BookPage({ data }: { data: BookResponse }) {
  const flat = useMemo(() => flattenBook(data.book, data.chunks), [data]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState(0); // index into flat.chunkRowIndexes

  const virtualizer = useVirtualizer({
    count: flat.rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => estimateRowHeight(flat.rows[i]!, data),
    overscan: 8,
  });

  // Double-invoke: with dynamic measurement a long jump lands on estimated offsets and the
  // first frame's measurements shift the layout out from under the viewport.
  const scrollToRow = (index: number) => {
    virtualizer.scrollToIndex(index, { align: 'start' });
    requestAnimationFrame(() => virtualizer.scrollToIndex(index, { align: 'start' }));
  };

  const moveCursor = (next: number) => {
    const clamped = Math.max(0, Math.min(flat.chunkRowIndexes.length - 1, next));
    setCursor(clamped);
    scrollToRow(flat.chunkRowIndexes[clamped]!);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest('.cm-editor, input, textarea, select, button')) return;
      if (e.key === 'j') moveCursor(cursor + 1);
      else if (e.key === 'k') moveCursor(cursor - 1);
      else if (e.key === 'Home' && e.ctrlKey) moveCursor(0);
      else if (e.key === 'End' && e.ctrlKey) moveCursor(flat.chunkRowIndexes.length - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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

  return (
    <div className="app">
      <header className="top-bar">
        <h1>code-story</h1>
        <span className="range" title={`${data.base}..${data.head}`}>
          {data.base.slice(0, 8)}..{data.head.slice(0, 8)}
        </span>
        <span className="counts">
          {flat.totalChunks} chunks · {data.book.sections.length} files
        </span>
        <span className="spacer" />
        <span className="hint">j / k to move</span>
        <a className="export" href="/api/export.md" target="_blank" rel="noreferrer">
          Export
        </a>
      </header>
      <div className="body">
        <nav className="outline">
          {data.book.sections.map((section) => (
            <button
              key={section.id}
              className={section.title === currentSection ? 'outline-row current' : 'outline-row'}
              title={section.title}
              onClick={() => scrollToRow(flat.sectionRowIndex.get(section.id)!)}
            >
              <span className="outline-path">{shortPath(section.title)}</span>
              <span className="outline-count">{section.occurrences.length}</span>
            </button>
          ))}
        </nav>
        <div className="feed-wrap">
          {currentSection && <div className="current-file">{currentSection}</div>}
          <div className="feed" ref={scrollRef} role="feed" aria-label={`Review book ${data.base.slice(0, 8)}..${data.head.slice(0, 8)}`}>
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
                      total={flat.totalChunks}
                      isCursor={item.index === cursorRowIndex}
                      onSelect={() => {
                        const i = flat.chunkRowIndexes.indexOf(item.index);
                        if (i >= 0) setCursor(i);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RowView({
  row,
  data,
  total,
  isCursor,
  onSelect,
}: {
  row: Row;
  data: BookResponse;
  total: number;
  isCursor: boolean;
  onSelect: () => void;
}) {
  if (row.kind === 'section') {
    return (
      <div className="section-header">
        <span className="section-path">{row.title}</span>
        <span className="section-count">{row.chunkCount === 1 ? '1 chunk' : `${row.chunkCount} chunks`}</span>
      </div>
    );
  }
  if (row.kind === 'end') {
    return (
      <div className="end-of-book">
        End of book — {total} chunks, every changed line included. Review marking arrives in the next slice.
      </div>
    );
  }

  const { chunk } = row;
  const size = chunkSize(chunk);
  return (
    <article
      className={isCursor ? 'chunk cursor' : 'chunk'}
      aria-posinset={row.posinset}
      aria-setsize={total}
      tabIndex={-1}
      onClick={onSelect}
    >
      <div className="chunk-header">
        <span className="chunk-title">{chunkTitle(chunk)}</span>
        <span className={`badge kind-${chunk.kind}`}>{chunk.kind}</span>
        <span className="chunk-size">
          <span className="added">+{size.added}</span> <span className="removed">−{size.removed}</span>
        </span>
      </div>
      <DiffView file={chunk.file} lines={data.diffs[chunk.id] ?? []} />
    </article>
  );
}

function estimateRowHeight(row: Row, data: BookResponse): number {
  if (row.kind === 'section') return 46;
  if (row.kind === 'end') return 120;
  const lines = data.diffs[row.chunk.id]?.length ?? 1;
  return 58 + Math.max(lines, 1) * 19;
}

function shortPath(path: string): string {
  const parts = path.split('/');
  return parts.length <= 2 ? path : `…/${parts.slice(-2).join('/')}`;
}
