import type { Chunk, ChunkReviewState } from '@code-story/core';
import type { BookResponse } from './api.js';
import { DiffView } from './DiffView.js';
import { isLowSignal, stubReason } from './review-logic.js';
import { chunkSize, chunkTitle, type Row } from './rows.js';

/** Section-header action: batch-mark the remaining stubs, or undo the batch just made. */
export type SectionAck = { kind: 'mark'; count: number; reason: string } | { kind: 'undo'; count: number };

export function RowView({
  row,
  data,
  total,
  reviewedCount,
  sectionStats,
  sectionAck,
  onMarkSection,
  onUndoBatch,
  state,
  collapsed,
  isCursor,
  registerEl,
  onSelect,
  onJumpNext,
  onExpand,
}: {
  row: Row;
  data: BookResponse;
  total: number;
  reviewedCount: number;
  sectionStats: Map<string, { done: number; total: number }>;
  sectionAck: SectionAck | undefined;
  onMarkSection: (sectionId: string) => void;
  onUndoBatch: () => void;
  state: ChunkReviewState;
  collapsed: boolean;
  isCursor: boolean;
  registerEl: (el: HTMLElement | null) => void;
  onSelect: () => void;
  onJumpNext: () => void;
  onExpand: (chunk: Chunk) => void;
}) {
  if (row.kind === 'section') {
    const stats = sectionStats.get(row.id);
    return (
      <div className="section-header">
        <span className="section-path">{row.title}</span>
        <span className="section-count">{stats ? `${stats.done}/${stats.total} reviewed` : `${row.chunkCount} chunks`}</span>
        {/* One element for both labels so focus survives the mark → undo morph (spec 00a). */}
        {sectionAck && (
          <button
            className="bar-button section-ack"
            onClick={() => (sectionAck.kind === 'mark' ? onMarkSection(row.id) : onUndoBatch())}
          >
            {sectionAck.kind === 'mark'
              ? `Mark all ${sectionAck.count} reviewed (${sectionAck.reason})`
              : `Undo mark all (${sectionAck.count})`}
          </button>
        )}
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
  const lowSignal = isLowSignal(chunk);
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
            {lowSignal && <span className="badge generated">{stubReason(chunk)}</span>}
            <span className="chunk-size">
              <span className="added">+{size.added}</span> <span className="removed">−{size.removed}</span>
            </span>
          </div>
          {collapsed ? (
            <div className="chunk-collapsed-note">
              {lowSignal ? (
                <>
                  collapsed ({stubReason(chunk)}) —{' '}
                  <button className="link-button" onClick={() => onExpand(chunk)}>
                    Show diff
                  </button>{' '}
                  or press x
                </>
              ) : (
                'collapsed — press x to expand'
              )}
            </div>
          ) : (
            <DiffView file={chunk.file} lines={data.diffs[chunk.id] ?? []} />
          )}
        </div>
      </div>
    </article>
  );
}

export function estimateRowHeight(row: Row, data: BookResponse, isCollapsed: (chunk: Chunk) => boolean): number {
  if (row.kind === 'section') return 46;
  if (row.kind === 'end') return 160;
  if (isCollapsed(row.chunk)) return 76;
  const lines = data.diffs[row.chunk.id]?.length ?? 1;
  return 58 + Math.max(lines, 1) * 19;
}
