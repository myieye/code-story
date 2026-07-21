import type { Chunk, Deferral, UnifiedLine } from '@code-story/core';
import { chunkTitle } from './rows.js';
import { DiffView } from './DiffView.js';

/**
 * One card in the web-only Deferred section (spec 06 slice 6): a parked chunk with its notes and/or
 * AI answers. The diff is mounted lazily behind "Show diff" (a fresh CM6 view is heavy), and the card
 * greys once the chunk is marked reviewed (resolution reuses the header toggle's semantics). "Go to
 * chunk ↑" jumps back to the chunk's mainline occurrence; per-deferral Remove discards one; Retry
 * re-POSTs a failed AI prompt (the prompt is never lost).
 */
export function DeferredCard({
  chunk,
  deferrals,
  diffLines,
  reviewed,
  showDiff,
  onToggleDiff,
  onMarkReviewed,
  onRemove,
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
  onRemove: (id: string) => void;
  onRetry: (deferral: Deferral) => void;
  onGoToChunk: () => void;
}) {
  return (
    <section className={reviewed ? 'deferred-card resolved' : 'deferred-card'} aria-label={`Deferred: ${chunkTitle(chunk)}`}>
      <div className="deferred-card-head">
        <button className="link-button deferred-goto" onClick={onGoToChunk} title="Jump to this chunk in the book">
          {chunkTitle(chunk)} ↑
        </button>
        <span className="chunk-from">from {chunk.file}</span>
        <span className="spacer" />
        <button
          type="button"
          className="review-toggle"
          aria-pressed={reviewed}
          title={reviewed ? 'Reviewed — click to unmark' : 'Mark this chunk reviewed (resolves the deferral)'}
          onClick={onMarkReviewed}
        >
          {reviewed ? '✓ Reviewed' : 'Mark reviewed'}
        </button>
      </div>
      <ul className="deferral-list">
        {deferrals.map((d) => (
          <li key={d.id} className="deferral-item">
            <div className="deferral-item-head">
              {d.lineRange && (
                <span className="badge line-range-badge">
                  lines {d.lineRange.start}–{d.lineRange.end}
                </span>
              )}
              <span className="deferral-prompt">{d.kind === 'ai' ? d.text || '(no question)' : d.text || '(bookmark)'}</span>
              <button className="link-button deferral-remove" onClick={() => onRemove(d.id)} title="Discard this deferral">
                ✕ Remove
              </button>
            </div>
            {d.kind === 'ai' && renderAnswer(d, () => onRetry(d))}
          </li>
        ))}
      </ul>
      <div className="deferred-card-diff">
        <button className="link-button" aria-expanded={showDiff} onClick={onToggleDiff}>
          {showDiff ? 'Hide diff' : 'Show diff'}
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
  return <div className="deferral-answer answering">AI answering…</div>;
}
