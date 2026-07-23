import { type Chunk, type ChunkReviewState, type Deferral, type LineRange, isLowSignal, lowSignalReason } from '@code-story/core';
import type { EditorView } from '@codemirror/view';
import { useCallback, useRef, useState } from 'react';
import type { BookResponse } from './api.js';
import { affordanceLabel, type PayloadState, visibleDefinitions } from './context-panel-logic.js';
import { selectionLineRange, splitButtonModel } from './defer-logic.js';
import { DefinitionPanel } from './DefinitionPanel.js';
import { DiffView } from './DiffView.js';
import { NeighborStrip } from './NeighborStrip.js';
import type { NeighborChip } from './neighbor-strip-logic.js';
import type { FilePiece } from './piece-nav-logic.js';
import { chunkSize, chunkTitle, fileBasename, type Row } from './rows.js';

/** The action a Defer popover submits (spec 06 slice 6). */
export interface DeferSubmit {
  kind: 'note' | 'ai';
  inline: boolean;
}

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
  showFile,
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
  deferralsArriving,
  deferOpen,
  deferText,
  deferLineRange,
  onDeferOpen,
  onDeferClose,
  onDeferTextChange,
  onDeferSubmit,
  deferStub,
  inlineDeferrals,
  onRetryDeferral,
  onRemoveDeferral,
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
  /** Show this chunk's file label — true only where the file changes from the previous chunk row. */
  showFile: boolean;
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
  /** ai answers still arriving in Deferred (spec 06 slice 6) — the extra done-banner line when > 0. */
  deferralsArriving?: number;
  /** Defer popover (spec 06 slice 6): is it open for this chunk, and its captured selection to show. */
  deferOpen?: boolean;
  deferText?: string;
  deferLineRange?: LineRange;
  /** Open the inline Defer popover; RowView passes up the CM6 selection it captured, if any. */
  onDeferOpen?: (chunkId: string, lineRange: LineRange | undefined) => void;
  onDeferClose?: () => void;
  onDeferTextChange?: (text: string) => void;
  onDeferSubmit?: (chunk: Chunk, action: DeferSubmit) => void;
  /** When set, the collapsed stub shows this deferral copy instead of the generic collapsed note. */
  deferStub?: string;
  /** Inline ai deferrals (`inline:true`) for this chunk — rendered below the diff, never inside CM6. */
  inlineDeferrals?: Deferral[];
  onRetryDeferral?: (deferral: Deferral) => void;
  onRemoveDeferral?: (id: string) => void;
}) {
  const diffViewRef = useRef<EditorView | null>(null);
  const captureViewReady = useCallback((view: EditorView | null) => {
    diffViewRef.current = view;
  }, []);
  const [caretOpen, setCaretOpen] = useState(false);

  if (row.kind === 'deferred-card') return null; // rendered by DeferredCard in BookPage
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
          {deferralsArriving !== undefined && deferralsArriving > 0 && (
            <p className="done-provenance">
              {deferralsArriving} AI answer{deferralsArriving === 1 ? '' : 's'} still arriving in Deferred.
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
          {data.links?.pr && (
            <a className="export" href={data.links.pr} target="_blank" rel="noreferrer">
              Open the pull request ↗
            </a>
          )}
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
  // Only called code that isn't itself part of the diff belongs in the panel — in-diff callees are
  // reached as their own chunks (story order + neighbor strip), not shown as "context".
  const visibleDefs = visibleDefinitions(contextPayload, data.chunks);
  const split = splitButtonModel(deferText ?? '');

  // Opening Defer captures any non-empty CM6 selection as a descriptive line range (spec 06 slice 6).
  const toggleDefer = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deferOpen) {
      onDeferClose?.();
      return;
    }
    const view = diffViewRef.current;
    let range: LineRange | undefined;
    if (view) {
      const sel = view.state.selection.main;
      if (!sel.empty) {
        const fromLine = view.state.doc.lineAt(sel.from).number;
        const toLine = view.state.doc.lineAt(sel.to).number;
        range = selectionLineRange(fromLine, toLine, data.diffs[chunk.id] ?? []);
      }
    }
    setCaretOpen(false);
    onDeferOpen?.(chunk.id, range);
  };
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
            {/* AI gist leads the header (spec #140): serif book-voice lead-in, first-fixation before the
                mono title. Inline, never its own line — a late-arriving gist must not change row height in
                the virtualized feed. Never on a low-signal stub (its reason badge already speaks). */}
            {chunkBadge && !lowSignal && (
              <span className="chunk-gist" title="AI summary of this chunk">
                <span className="sr-only">AI summary: </span>
                <span className="badge ai-badge" aria-hidden="true">
                  AI
                </span>
                <span className="chunk-gist-text">{chunkBadge}</span>
              </span>
            )}
            <span className="chunk-title">{chunkTitle(chunk)}</span>
            {/* File label as a transition marker: shown only where the file changes from the previous
                chunk (BookPage dedupe). The sticky current-file bar carries it the rest of the time, so
                repeating the basename down a same-file run is just noise. Subsumes the old "from …" cue. */}
            {showFile && (
              <span className="chunk-file" title={chunk.file}>
                <span className="sr-only">in </span>
                {fileBasename(chunk.file)}
              </span>
            )}
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
            {/* Defer to the end — a note or a background-AI question (spec 06 slice 6). */}
            <button
              type="button"
              className="review-toggle defer-button"
              disabled={state === 'reviewed'}
              aria-expanded={deferOpen ?? false}
              title={state === 'reviewed' ? 'Already reviewed — unmark first' : 'Set this chunk aside for the end — with a note or an AI question'}
              onClick={toggleDefer}
            >
              Defer
            </button>
          </div>
          {deferOpen && (
            <div
              className="defer-popover"
              role="group"
              aria-label="Defer this chunk"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  onDeferClose?.();
                }
              }}
            >
              <div className="defer-popover-head">
                <span>Defer this chunk to the end</span>
                <button className="defer-close" aria-label="Close" onClick={() => onDeferClose?.()}>
                  ×
                </button>
              </div>
              {deferLineRange && (
                <div className="defer-line-range">
                  Deferring lines {deferLineRange.start}–{deferLineRange.end}
                </div>
              )}
              <textarea
                className="defer-textarea"
                autoFocus
                value={deferText ?? ''}
                placeholder="Note to yourself, or a question for AI…"
                onChange={(e) => onDeferTextChange?.(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !split.primaryDisabled) {
                    e.preventDefault();
                    onDeferSubmit?.(chunk, { kind: 'ai', inline: false });
                  }
                }}
              />
              <div className="defer-actions">
                <span className="defer-split">
                  <button
                    type="button"
                    className="bar-button defer-primary"
                    disabled={split.primaryDisabled}
                    onClick={() => onDeferSubmit?.(chunk, { kind: 'ai', inline: false })}
                  >
                    {split.primaryLabel}
                  </button>
                  <button
                    type="button"
                    className="bar-button defer-caret"
                    aria-haspopup="true"
                    aria-expanded={caretOpen}
                    aria-label="More AI options"
                    onClick={() => setCaretOpen((v) => !v)}
                  >
                    ▾
                  </button>
                </span>
                <button type="button" className="bar-button defer-note" onClick={() => onDeferSubmit?.(chunk, { kind: 'note', inline: false })}>
                  {split.noteLabel}
                </button>
              </div>
              {caretOpen && (
                <button
                  type="button"
                  className="bar-button defer-inline"
                  disabled={split.primaryDisabled}
                  onClick={() => onDeferSubmit?.(chunk, { kind: 'ai', inline: true })}
                >
                  {split.inlineLabel}
                </button>
              )}
            </div>
          )}
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
              {deferStub ? (
                <>
                  {deferStub}{' '}
                  <button className="link-button" onClick={() => onExpand(chunk)}>
                    Show diff
                  </button>
                </>
              ) : lowSignal ? (
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
            <DiffView file={chunk.file} lines={data.diffs[chunk.id] ?? []} onViewReady={captureViewReady} />
          )}
          {inlineDeferrals && inlineDeferrals.length > 0 && (
            <section className="inline-deferrals" tabIndex={-1} aria-label="AI answers in place">
              {inlineDeferrals.map((d) => (
                <div key={d.id} className="inline-deferral">
                  <div className="inline-deferral-prompt">
                    <span className="badge ai-badge">AI</span> asked: {d.text || '(no question)'}
                    <button className="link-button inline-deferral-remove" onClick={() => onRemoveDeferral?.(d.id)} title="Discard this answer">
                      ✕
                    </button>
                  </div>
                  {d.answerStatus === 'done' && d.answer ? (
                    <div className="deferral-answer">{d.answer}</div>
                  ) : d.answerStatus === 'failed' ? (
                    <div className="deferral-answer failed">
                      AI couldn't answer this — the prompt is saved.{' '}
                      <button className="link-button" onClick={() => onRetryDeferral?.(d)}>
                        Retry
                      </button>
                    </div>
                  ) : (
                    <div className="deferral-answer answering">AI answering…</div>
                  )}
                </div>
              ))}
            </section>
          )}
          {visibleDefs.length > 0 && (
            <div className="definitions-affordance">
              <button
                className="link-button"
                aria-expanded={panelExpanded}
                onClick={() => onToggleDefinitions(chunk)}
              >
                {affordanceLabel(visibleDefs)}
              </button>
            </div>
          )}
          {panelExpanded && visibleDefs.length > 0 && (
            <DefinitionPanel definitions={visibleDefs} registerEl={(el) => registerPanelEl(chunk.id, el)} />
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
  // A deferred card starts diff-collapsed; measureElement corrects once its answers/notes render.
  if (row.kind === 'deferred-card') return 120;
  const chunkLine = aiLines?.hasChunkLine(row.sectionId, row.chunk.id) ? AI_LINE_HEIGHT : 0;
  if (isCollapsed(row.chunk)) return 76 + chunkLine;
  const lines = data.diffs[row.chunk.id]?.length ?? 1;
  return 58 + Math.max(lines, 1) * 19 + chunkLine;
}
