import type { Chunk, Deferral, UnifiedLine } from '@code-story/core';
import { useRef } from 'react';
import { AnsweringIndicator } from './AnsweringIndicator.js';
import { sliceLinesToRange } from './defer-logic.js';
import { chunkTitle } from './rows.js';
import { DiffView } from './DiffView.js';

/**
 * One card in the web-only Deferred section (spec 06 slice 6): a parked chunk with its notes and/or
 * AI answers. Each deferral that carries a line range shows its own eager slice preview under a
 * `lines N–M` badge; the full chunk diff stays lazy behind "Show full chunk diff". A deferral is open
 * until "✓ Resolve" (DELETE) — the parent is never auto-un-reviewed. "Go to chunk ↑" jumps back to
 * the mainline occurrence; Retry re-POSTs a failed AI prompt (the prompt is never lost).
 */
export function DeferredCard({
  chunk,
  deferrals,
  diffLines,
  reviewed,
  showDiff,
  onToggleDiff,
  onMarkReviewed,
  onResolve,
  onRetry,
  onGoToChunk,
}: {
  chunk: Chunk;
  deferrals: Deferral[];
  diffLines: UnifiedLine[];
  reviewed: boolean;
  showDiff: boolean;
  onToggleDiff: () => void;
  onMarkReviewed: () => void;
  onResolve: (id: string) => void;
  onRetry: (deferral: Deferral) => void;
  onGoToChunk: () => void;
}) {
  const gotoRef = useRef<HTMLButtonElement>(null);
  const resolveRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // After a resolve the list shrinks: the button now at index i is the one that followed the removed
  // one, so focus it; when the resolved one was last, fall back to "Go to chunk". Never the body.
  const handleResolve = (i: number, id: string) => {
    onResolve(id);
    requestAnimationFrame(() => (resolveRefs.current[i] ?? gotoRef.current)?.focus());
  };

  return (
    <section className={reviewed ? 'deferred-card resolved' : 'deferred-card'} aria-label={`Deferred: ${chunkTitle(chunk)}`}>
      <div className="deferred-card-head">
        <button ref={gotoRef} className="link-button deferred-goto" onClick={onGoToChunk} title="Jump to this chunk in the book">
          {chunkTitle(chunk)} ↑
        </button>
        <span className="chunk-from">from {chunk.file}</span>
        <span className="spacer" />
        <button
          type="button"
          className="review-toggle"
          aria-pressed={reviewed}
          title={reviewed ? 'Reviewed — click to unmark' : 'Mark this chunk reviewed'}
          onClick={onMarkReviewed}
        >
          {reviewed ? '✓ Reviewed' : 'Mark reviewed'}
        </button>
      </div>
      <ul className="deferral-list">
        {deferrals.map((d, i) => (
          <li key={d.id} className="deferral-item">
            <div className="deferral-item-head">
              {d.lineRange && (
                <span className="badge line-range-badge">
                  lines {d.lineRange.start}–{d.lineRange.end}
                </span>
              )}
              <span className="deferral-prompt">{d.kind === 'ai' ? d.text || '(no question)' : d.text || '(bookmark)'}</span>
              <button
                ref={(el) => {
                  resolveRefs.current[i] = el;
                }}
                className="link-button deferral-resolve"
                onClick={() => handleResolve(i, d.id)}
                title="Resolve — discard this deferral (the chunk stays reviewed)"
              >
                ✓ Resolve
              </button>
            </div>
            {d.lineRange && (
              <div className="deferral-slice">
                <DiffView file={chunk.file} lines={sliceLinesToRange(diffLines, d.lineRange)} />
              </div>
            )}
            {d.kind === 'ai' && renderAnswer(d, () => onRetry(d))}
          </li>
        ))}
      </ul>
      <div className="deferred-card-diff">
        <button className="link-button" aria-expanded={showDiff} onClick={onToggleDiff}>
          {showDiff ? 'Hide full chunk diff' : 'Show full chunk diff'}
        </button>
        {showDiff && <DiffView file={chunk.file} lines={diffLines} />}
      </div>
    </section>
  );
}

function renderAnswer(d: Deferral, onRetry: () => void) {
  if (d.answerStatus === 'done' && d.answer) {
    return (
      <div className="deferral-answer">
        <span className="badge ai-badge">AI</span> {d.answer}
      </div>
    );
  }
  if (d.answerStatus === 'failed') {
    return (
      <div className="deferral-answer failed">
        AI couldn't answer this — the prompt is saved.{' '}
        <button className="link-button" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }
  return (
    <div className="deferral-answer answering">
      AI answering
      <AnsweringIndicator createdAtIso={d.createdAt} />
    </div>
  );
}
