import { type Chunk, type ChunkReviewState, isLowSignal, lowSignalReason } from '@code-story/core';
import type { BookResponse } from './api.js';
import { affordanceLabel, hasDefinitions, type PayloadState } from './context-panel-logic.js';
import { DefinitionPanel } from './DefinitionPanel.js';
import { DiffView } from './DiffView.js';
import { NeighborStrip } from './NeighborStrip.js';
import type { NeighborChip } from './neighbor-strip-logic.js';
import { chunkSize, chunkTitle, type Row } from './rows.js';

/** Section-header action: batch-mark the remaining stubs, or undo the batch just made. */
export type SectionAck = { kind: 'mark'; count: number; reason: string } | { kind: 'undo'; count: number };

export function RowView({
  row,
  data,
  totalOccurrences,
  distinctChunks,
  reviewedCount,
  sectionStats,
  sectionAck,
  sectionAiLine,
  chunkAiLine,
  onMarkSection,
  onUndoBatch,
  state,
  collapsed,
  isCursor,
  registerEl,
  onSelect,
  onJumpNext,
  onExpand,
  contextPayload,
  panelExpanded,
  onToggleDefinitions,
  registerPanelEl,
  neighborChips,
  onJumpToChunk,
  onExitStrip,
  registerStripEl,
  reencounter,
}: {
  row: Row;
  data: BookResponse;
  /** aria-setsize — walk stops, one per occurrence. */
  totalOccurrences: number;
  /** Review-progress denominator — state lives on the chunk. */
  distinctChunks: number;
  reviewedCount: number;
  sectionStats: Map<string, { done: number; total: number }>;
  sectionAck: SectionAck | undefined;
  /** The section header's single AI line: narration intro, else the applied order rationale (spec 03). */
  sectionAiLine: string | undefined;
  /** This chunk's one-line AI orientation, rendered above the diff (spec 03). */
  chunkAiLine: string | undefined;
  onMarkSection: (sectionId: string) => void;
  onUndoBatch: () => void;
  state: ChunkReviewState;
  collapsed: boolean;
  isCursor: boolean;
  registerEl: (el: HTMLElement | null) => void;
  onSelect: () => void;
  onJumpNext: () => void;
  onExpand: (chunk: Chunk) => void;
  /** This chunk's context payload: `undefined` unfetched, `null` empty, else the facts (spec 04). */
  contextPayload: PayloadState;
  panelExpanded: boolean;
  onToggleDefinitions: (chunk: Chunk) => void;
  registerPanelEl: (chunkId: string, el: HTMLElement | null) => void;
  /** The focused chunk's graph neighbors (spec 05 slice 5); passed only for the cursor row. */
  neighborChips?: NeighborChip[];
  onJumpToChunk: (chunkId: string) => void;
  onExitStrip: () => void;
  registerStripEl: (chunkId: string, el: HTMLElement | null) => void;
  /** A brief post-jump highlight distinct from the focus ring — reviewed = "still reviewed". */
  reencounter?: 'reviewed' | 'unreviewed';
}) {
  if (row.kind === 'section') {
    const stats = sectionStats.get(row.id);
    return (
      <div className="section-block">
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
        {sectionAiLine && (
          <div className="section-rationale">
            <span className="badge ai-badge">AI</span> {sectionAiLine}
          </div>
        )}
      </div>
    );
  }
  if (row.kind === 'end') {
    if (reviewedCount === distinctChunks) {
      return (
        <div className="end-of-book done">
          <p className="done-headline">All {distinctChunks} chunks reviewed.</p>
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
        End of book — {distinctChunks - reviewedCount} of {distinctChunks} chunks remaining.{' '}
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
  if (reencounter) classes.push('reencounter', `reencounter-${reencounter}`);
  return (
    <article
      className={classes.join(' ')}
      aria-posinset={row.posinset}
      aria-setsize={totalOccurrences}
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
            {/* Cross-file provenance for a chapter occurrence whose chunk lives outside the anchor file. */}
            {row.occurrence.label && <span className="chunk-from">from {row.occurrence.label}</span>}
            <span className={`badge kind-${chunk.kind}`}>{chunk.kind}</span>
            {lowSignal && <span className="badge generated">{lowSignalReason(chunk)}</span>}
            <span className="chunk-size">
              <span className="added">+{size.added}</span> <span className="removed">−{size.removed}</span>
            </span>
          </div>
          {isCursor && neighborChips && neighborChips.length > 0 && (
            <NeighborStrip
              chips={neighborChips}
              onJump={onJumpToChunk}
              onExit={onExitStrip}
              registerEl={(el) => registerStripEl(chunk.id, el)}
            />
          )}
          {chunkAiLine && (
            <div className="chunk-ai-line">
              <span className="badge ai-badge">AI</span> {chunkAiLine}
            </div>
          )}
          {collapsed ? (
            <div className="chunk-collapsed-note">
              {lowSignal ? (
                <>
                  collapsed ({lowSignalReason(chunk)}) —{' '}
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
          {hasDefinitions(contextPayload) && (
            <div className="definitions-affordance">
              <button
                className="link-button"
                aria-expanded={panelExpanded}
                onClick={() => onToggleDefinitions(chunk)}
              >
                {affordanceLabel(contextPayload)}
              </button>
            </div>
          )}
          {panelExpanded && hasDefinitions(contextPayload) && (
            <DefinitionPanel
              payload={contextPayload}
              registerEl={(el) => registerPanelEl(chunk.id, el)}
            />
          )}
        </div>
      </div>
    </article>
  );
}

export interface AiLinePredicates {
  hasSectionLine: (sectionId: string) => boolean;
  hasChunkLine: (sectionId: string, chunkId: string) => boolean;
}

/** An AI line (section header or chunk) adds roughly one text row; measureElement then self-corrects. */
const AI_LINE_HEIGHT = 22;

export function estimateRowHeight(
  row: Row,
  data: BookResponse,
  isCollapsed: (chunk: Chunk) => boolean,
  aiLines?: AiLinePredicates,
): number {
  if (row.kind === 'section') return 46 + (aiLines?.hasSectionLine(row.id) ? AI_LINE_HEIGHT : 0);
  if (row.kind === 'end') return 160;
  const chunkLine = aiLines?.hasChunkLine(row.sectionId, row.chunk.id) ? AI_LINE_HEIGHT : 0;
  if (isCollapsed(row.chunk)) return 76 + chunkLine;
  const lines = data.diffs[row.chunk.id]?.length ?? 1;
  return 58 + Math.max(lines, 1) * 19 + chunkLine;
}
