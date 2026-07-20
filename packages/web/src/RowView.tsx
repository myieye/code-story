import { type Chunk, type ChunkReviewState, isLowSignal, lowSignalReason } from '@code-story/core';
import type { BookResponse } from './api.js';
import { affordanceLabel, hasDefinitions, type PayloadState } from './context-panel-logic.js';
import { DefinitionPanel } from './DefinitionPanel.js';
import { DiffView } from './DiffView.js';
import { NeighborStrip } from './NeighborStrip.js';
import type { NeighborChip } from './neighbor-strip-logic.js';
import type { FilePiece } from './piece-nav-logic.js';
import { chunkSize, chunkTitle, type Row } from './rows.js';

/** Section-header action: batch-confirm the remaining stubs/auto-read chunks, or undo the batch just made. */
export type SectionAck =
  | { kind: 'mark'; count: number; reason: string; readCount: number; stubCount: number }
  | { kind: 'undo'; count: number; hadRead: boolean };

/** The section-ack button's label — a stub mark, an auto-read confirm, or their mix (spec 06 slice 3). */
function sectionAckLabel(ack: SectionAck): string {
  if (ack.kind === 'undo') return ack.hadRead ? `Undo confirm (${ack.count})` : `Undo mark all (${ack.count})`;
  if (ack.readCount > 0 && ack.stubCount > 0) {
    return `Confirm ${ack.count} (${ack.readCount} read, ${ack.stubCount} stub${ack.stubCount === 1 ? '' : 's'})`;
  }
  if (ack.readCount > 0) return `Confirm ${ack.count} read in this section`;
  return `Mark all ${ack.count} reviewed (${ack.reason})`;
}

export function RowView({
  row,
  data,
  totalOccurrences,
  distinctChunks,
  reviewedCount,
  autoReadCount,
  autoConfirmedCount,
  onConfirmAutoRead,
  interactions,
  sectionStats,
  sectionAck,
  sectionAiLine,
  chunkAiLine,
  chunkBadge,
  onMarkSection,
  onUndoBatch,
  state,
  autoRead,
  justReviewed,
  collapsed,
  chapterCount,
  linesRead,
  bulkLowSignalCount,
  isCursor,
  registerEl,
  onSelect,
  onJumpNext,
  onExpand,
  onToggleReviewed,
  contextPayload,
  panelExpanded,
  onToggleDefinitions,
  registerPanelEl,
  neighborChips,
  onJumpToChunk,
  onRevealDefinitions,
  onExitStrip,
  registerStripEl,
  reencounter,
  piece,
  pieceMenuOpen,
  onOpenPieceMenu,
}: {
  row: Row;
  data: BookResponse;
  /** aria-setsize — walk stops, one per occurrence. */
  totalOccurrences: number;
  /** Review-progress denominator — state lives on the chunk. */
  distinctChunks: number;
  reviewedCount: number;
  /** Book-wide chunks seen at reading pace, not yet confirmed (spec 06 slice 3) — the end-row confirm. */
  autoReadCount: number;
  /** Reviewed chunks promoted from auto-read (reviewedVia:'auto') — the done-banner provenance line. */
  autoConfirmedCount: number;
  /** Confirm all book-wide auto-read chunks as reviewed (the end-row bulk button). */
  onConfirmAutoRead: () => void;
  /** Cross-chunk interactions (calls + exercises) surfaced across the book — honest done-banner figure (spec 05 gate 1). */
  interactions: number;
  sectionStats: Map<string, { done: number; total: number }>;
  sectionAck: SectionAck | undefined;
  /** The section header's single AI line: narration intro, else the applied order rationale (spec 03). */
  sectionAiLine: string | undefined;
  /** This chunk's one-line AI orientation, rendered above the diff (spec 03/06 slice 5). */
  chunkAiLine: string | undefined;
  /** This chunk's 2–4-word AI badge (spec 06 slice 5); undefined for none and for low-signal stubs. */
  chunkBadge: string | undefined;
  onMarkSection: (sectionId: string) => void;
  onUndoBatch: () => void;
  state: ChunkReviewState;
  /** This chunk is seen at reading pace but not yet confirmed (spec 06 slice 3) — dashed rail, ◑ affordance. */
  autoRead: boolean;
  /** Just flipped to reviewed — the one-shot rail wipe (spec 06 slice 4); reduced-motion → instant. */
  justReviewed: boolean;
  collapsed: boolean;
  /** Done-banner figures (spec 06 slice 4b), only meaningful on the end row. */
  chapterCount: number;
  linesRead: { added: number; removed: number };
  bulkLowSignalCount: number;
  isCursor: boolean;
  registerEl: (el: HTMLElement | null) => void;
  onSelect: () => void;
  onJumpNext: () => void;
  onExpand: (chunk: Chunk) => void;
  /** Toggle this chunk's reviewed state from the mouse (marks in place; unmarks if already reviewed). */
  onToggleReviewed: (chunk: Chunk) => void;
  /** This chunk's context payload: `undefined` unfetched, `null` empty, else the facts (spec 04). */
  contextPayload: PayloadState;
  panelExpanded: boolean;
  onToggleDefinitions: (chunk: Chunk) => void;
  registerPanelEl: (chunkId: string, el: HTMLElement | null) => void;
  /** The focused chunk's graph neighbors (spec 05 slice 5); passed only for the cursor row. */
  neighborChips?: NeighborChip[];
  onJumpToChunk: (chunkId: string) => void;
  /** Follow a `reveal` chip: reveal this (focused) chunk's exercised-code definition panel. */
  onRevealDefinitions: (chunk: Chunk) => void;
  onExitStrip: () => void;
  registerStripEl: (chunkId: string, el: HTMLElement | null) => void;
  /** A brief post-jump highlight distinct from the focus ring — reviewed = "still reviewed". */
  reencounter?: 'reviewed' | 'unreviewed';
  /** This chunk's position among its file's pieces (spec 06 slice 2); undefined for non-chunk rows. */
  piece?: FilePiece;
  pieceMenuOpen?: boolean;
  onOpenPieceMenu?: (chunkId: string, anchorEl: HTMLElement) => void;
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
              {sectionAckLabel(sectionAck)}
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
          <p className="done-headline">
            Review complete — all {distinctChunks} chunks, {chapterCount} chapter{chapterCount === 1 ? '' : 's'}.
          </p>
          <p>
            +{linesRead.added} −{linesRead.removed} lines read. Nothing was skipped — every chunk required your mark.
          </p>
          {bulkLowSignalCount > 0 && (
            <p className="done-provenance">
              {bulkLowSignalCount} {bulkLowSignalCount === 1 ? 'was' : 'were'} marked in bulk as low-signal.
            </p>
          )}
          {autoConfirmedCount > 0 && (
            <p className="done-provenance">
              {autoConfirmedCount} of {distinctChunks} confirmed from auto-read (seen at reading pace, then confirmed in bulk).
            </p>
          )}
          {interactions > 0 && (
            <p className="done-frontier">
              {interactions} cross-chunk interaction{interactions === 1 ? '' : 's'} {interactions === 1 ? 'was' : 'were'} surfaced
              during review — none {interactions === 1 ? 'was' : 'were'} individually verified.
            </p>
          )}
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
        {autoReadCount > 0 && (
          <span className="end-autoread">
            {reviewedCount} of {distinctChunks} reviewed — {autoReadCount} auto-read awaiting your confirm.{' '}
            <button className="bar-button" onClick={onConfirmAutoRead}>
              Confirm {autoReadCount} auto-read as reviewed
            </button>{' '}
          </span>
        )}
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
  if (autoRead) classes.push('autoread');
  if (justReviewed) classes.push('just-reviewed');
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
            <span className="chunk-title">{chunkTitle(chunk)}</span>
            {/* Two-word AI summary chip (spec 06 slice 5). Never on a low-signal stub — it carries its
                own reason badge, and an "AI note" on a lockfile is noise. */}
            {chunkBadge && !lowSignal && (
              <span className="badge badge-chip" title="AI: summarizes this chunk">
                {chunkBadge}
              </span>
            )}
            {/* Cross-file provenance for a chapter occurrence whose chunk lives outside the anchor file. */}
            {row.occurrence.label && <span className="chunk-from">from {row.occurrence.label}</span>}
            {piece &&
              (piece.total > 1 ? (
                <button
                  type="button"
                  className="piece-indicator"
                  aria-haspopup="menu"
                  aria-expanded={pieceMenuOpen ?? false}
                  title={`Piece ${piece.n} of ${piece.total} in this file — open the pieces menu`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenPieceMenu?.(chunk.id, e.currentTarget);
                  }}
                >
                  piece {piece.n} / {piece.total}
                </button>
              ) : (
                <span className="piece-indicator only-piece">only piece</span>
              ))}
            <span className={`badge kind-${chunk.kind}`}>{chunk.kind}</span>
            {lowSignal && <span className="badge generated">{lowSignalReason(chunk)}</span>}
            <span className="chunk-size">
              <span className="added">+{size.added}</span> <span className="removed">−{size.removed}</span>
            </span>
            {/* Mouse mark (GitHub's per-file "Viewed" placement/semantics): marks in place, doubles as
                the loudest reviewed-state cue. stopPropagation so it doesn't also fire article-select. */}
            <button
              type="button"
              className={autoRead ? 'review-toggle autoread' : 'review-toggle'}
              aria-pressed={state === 'reviewed'}
              title={
                state === 'reviewed'
                  ? 'Reviewed — click to unmark'
                  : autoRead
                    ? 'Auto-read — click to confirm reviewed'
                    : 'Mark this chunk reviewed'
              }
              onClick={(e) => {
                e.stopPropagation();
                onToggleReviewed(chunk);
              }}
            >
              {state === 'reviewed' ? '✓ Reviewed' : autoRead ? 'Auto-read — click to confirm' : 'Mark reviewed'}
            </button>
          </div>
          {isCursor && neighborChips && neighborChips.length > 0 && (
            <NeighborStrip
              chips={neighborChips}
              onJump={onJumpToChunk}
              onReveal={() => onRevealDefinitions(chunk)}
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
