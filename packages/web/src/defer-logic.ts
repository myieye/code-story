/**
 * Pure model for deferrals (spec 06 slice 6): poll decision, cluster copy, in-place stub copy, the
 * split-button action model, and the CM6-selection → head-line mapping. No React, no DOM — every
 * string and threshold is unit-tested headlessly.
 */
import type { Deferral, LineRange, UnifiedLine } from '@code-story/core';

const isTerminal = (d: Deferral): boolean => d.answerStatus === 'done' || d.answerStatus === 'failed';

/** Poll while any ai answer is still pending — covers `running` and the brief pre-dequeue window. */
export function shouldPoll(deferrals: readonly Deferral[]): boolean {
  return deferrals.some((d) => d.kind === 'ai' && !isTerminal(d));
}

/** How many ai answers newly arrived (a running→done transition) between two snapshots — for the polite announce. */
export function newlyAnswered(prev: readonly Deferral[], next: readonly Deferral[]): number {
  const wasDone = new Set(prev.filter((d) => d.answerStatus === 'done').map((d) => d.id));
  return next.filter((d) => d.answerStatus === 'done' && !wasDone.has(d.id)).length;
}

/** Distinct chunk ids parked in the Deferred section (non-inline), in first-appearance order. */
export function deferredChunkIds(deferrals: readonly Deferral[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const d of deferrals) {
    if (d.inline || seen.has(d.chunkId)) continue;
    seen.add(d.chunkId);
    ids.push(d.chunkId);
  }
  return ids;
}

/** The deferrals for one chunk (optionally only inline / only deferred). */
export function deferralsForChunk(
  deferrals: readonly Deferral[],
  chunkId: string,
  which: 'inline' | 'deferred' | 'all' = 'all',
): Deferral[] {
  return deferrals.filter(
    (d) => d.chunkId === chunkId && (which === 'all' || (which === 'inline' ? d.inline === true : !d.inline)),
  );
}

export interface DeferCluster {
  /** Deferred chunks (non-inline) — the Deferred-section count. 0 ⇒ the cluster item is hidden. */
  deferredCount: number;
  answersReady: number;
  answering: number;
  /** The passive cluster text, e.g. `3 deferred · 1 answer ready`. '' when nothing is deferred. */
  text: string;
}

/** The passive progress-cluster item (position 4): `N deferred` + `· M answers ready` / `· M answering`. */
export function deferCluster(deferrals: readonly Deferral[]): DeferCluster {
  const deferred = deferrals.filter((d) => !d.inline);
  const deferredCount = new Set(deferred.map((d) => d.chunkId)).size;
  const answersReady = deferred.filter((d) => d.kind === 'ai' && d.answerStatus === 'done').length;
  const answering = deferred.filter((d) => d.kind === 'ai' && !isTerminal(d)).length;
  if (deferredCount === 0) return { deferredCount, answersReady, answering, text: '' };
  let text = `${deferredCount} deferred`;
  if (answersReady > 0) text += ` · ${answersReady} answer${answersReady === 1 ? '' : 's'} ready`;
  else if (answering > 0) text += ` · ${answering} answering`;
  return { deferredCount, answersReady, answering, text };
}

/** ai answers still arriving across the whole set — the done-banner line (`M AI answers still arriving…`). */
export function answersStillArriving(deferrals: readonly Deferral[]): number {
  return deferrals.filter((d) => d.kind === 'ai' && !isTerminal(d)).length;
}

function preview(text: string, max = 42): string {
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length <= max ? one : `${one.slice(0, max - 1)}…`;
}

/** The one-line in-place stub copy for a deferred chunk, given its (non-inline) deferrals. */
export function stubCopy(chunkDeferrals: readonly Deferral[]): string {
  const ai = chunkDeferrals.filter((d) => d.kind === 'ai');
  if (ai.some((d) => d.answerStatus === 'done')) return 'Deferred — AI answer ready ↓';
  if (ai.some((d) => !isTerminal(d))) return 'Deferred — AI answering… ↓';
  const first = chunkDeferrals[0];
  const body = first && first.text.trim() ? preview(first.text) : 'resolve at end';
  return `Deferred — ${body} · resolve at end ↓`;
}

export interface SplitButtonModel {
  primaryLabel: string;
  primaryDisabled: boolean;
  inlineLabel: string;
  noteLabel: string;
}

/** The Defer popover's split-button labels. Primary needs text; the note sibling morphs when empty. */
export function splitButtonModel(text: string): SplitButtonModel {
  const empty = text.trim() === '';
  return {
    primaryLabel: 'Ask AI & defer',
    primaryDisabled: empty,
    inlineLabel: "Ask AI inline (answer here, don't defer)",
    noteLabel: empty ? 'Defer to end' : 'Defer with a note',
  };
}

export type DeferScope = 'whole' | 'slice';

/**
 * The span of a chunk's changed (add/del) lines in the same `head ?? base` coordinate
 * `selectionLineRange` reports, so the two are comparable. `undefined` when nothing changed.
 */
export function chunkHeadSpan(lines: readonly UnifiedLine[]): LineRange | undefined {
  let start: number | undefined;
  let end: number | undefined;
  for (const l of lines) {
    if (l.type !== 'add' && l.type !== 'del') continue;
    const n = l.head ?? l.base;
    if (n === undefined) continue;
    if (start === undefined || n < start) start = n;
    if (end === undefined || n > end) end = n;
  }
  return start !== undefined && end !== undefined ? { start, end } : undefined;
}

/** No selection, or a selection covering the whole changed span → 'whole'; a strict subset → 'slice'. */
export function deferScope(range: LineRange | undefined, span: LineRange | undefined): DeferScope {
  if (!range || !span) return 'whole';
  return range.start <= span.start && range.end >= span.end ? 'whole' : 'slice';
}

/** The consequence line shown in the popover before submit (the auto-mark is the load-bearing part). */
export function deferConsequenceCopy(scope: DeferScope, range: LineRange | undefined): string {
  if (scope === 'slice' && range) return `Defer lines ${range.start}–${range.end} — the rest of this chunk is marked reviewed`;
  return 'Defer this whole chunk to the end — resolve it later';
}

export interface DeferredSliceSummary {
  count: number;
  firstRange?: LineRange;
}

/** The parent header pill's figures for a chunk's deferred (non-inline) deferrals. */
export function deferredSliceSummary(chunkDeferrals: readonly Deferral[]): DeferredSliceSummary {
  const firstRange = chunkDeferrals.find((d) => d.lineRange)?.lineRange;
  return { count: chunkDeferrals.length, ...(firstRange ? { firstRange } : {}) };
}

/**
 * The rows of `lines` within `context` lines either side of `range`, in the `head ?? base`
 * coordinate. A gap marker that sits between two kept runs survives (collapsed to one); leading and
 * trailing gaps are dropped. This is the slice preview shown eagerly on a DeferredCard.
 */
export function sliceLinesToRange(lines: readonly UnifiedLine[], range: LineRange, context = 3): UnifiedLine[] {
  const lo = range.start - context;
  const hi = range.end + context;
  const out: UnifiedLine[] = [];
  let pendingGap = false;
  let kept = false;
  for (const l of lines) {
    if (l.type === 'gap') {
      if (kept) pendingGap = true;
      continue;
    }
    const n = l.head ?? l.base;
    if (n === undefined || n < lo || n > hi) continue;
    if (pendingGap) {
      out.push({ type: 'gap', text: '' });
      pendingGap = false;
    }
    out.push(l);
    kept = true;
  }
  return out;
}

/**
 * Map a CM6 selection (1-based doc-line numbers) to the head/base line range it covers, using the
 * chunk's rendered rows. Gap rows carry no line number and are skipped; `undefined` when the
 * selection lands only on gaps or is out of range.
 */
export function selectionLineRange(fromDocLine: number, toDocLine: number, lines: readonly UnifiedLine[]): LineRange | undefined {
  let start: number | undefined;
  let end: number | undefined;
  for (let doc = fromDocLine; doc <= toDocLine; doc++) {
    const line = lines[doc - 1];
    const n = line?.head ?? line?.base;
    if (n === undefined) continue;
    if (start === undefined || n < start) start = n;
    if (end === undefined || n > end) end = n;
  }
  return start !== undefined && end !== undefined ? { start, end } : undefined;
}
