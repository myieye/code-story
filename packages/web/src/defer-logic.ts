/**
 * Pure model for deferrals (spec 06 slice 6 / spec 138): poll cadence, cluster copy, in-place stub
 * model, progress/elapsed labels, the split-button action model, and the CM6-selection → head-line
 * mapping. No React, no DOM — every string and threshold is unit-tested headlessly.
 */
import type { Deferral, LineRange, UnifiedLine } from '@code-story/core';

const isTerminal = (d: Deferral): boolean => d.answerStatus === 'done' || d.answerStatus === 'failed';

/** Poll while any ai answer is still pending — covers `running` and the brief pre-dequeue window. */
export function shouldPoll(deferrals: readonly Deferral[]): boolean {
  return deferrals.some((d) => d.kind === 'ai' && !isTerminal(d));
}

/**
 * Adaptive poll cadence (spec 138 Q2): `null` = nothing pending, stop; else 3s while the youngest
 * pending answer is still fresh (< 30s), 8s after that. Drives a self-rescheduling setTimeout, not a
 * fixed interval — the deferrals list stays the single source of truth (no server ordering surface).
 */
export function pollIntervalMs(deferrals: readonly Deferral[], now: number): number | null {
  const pending = deferrals.filter((d) => d.kind === 'ai' && !isTerminal(d));
  if (pending.length === 0) return null;
  const youngest = Math.max(...pending.map((d) => Date.parse(d.createdAt) || 0));
  return now - youngest < 30_000 ? 3000 : 8000;
}

/** How many ai answers newly arrived (a running→done transition) between two snapshots — for the polite announce. */
export function newlyAnswered(prev: readonly Deferral[], next: readonly Deferral[]): number {
  const wasDone = new Set(prev.filter((d) => d.answerStatus === 'done').map((d) => d.id));
  return next.filter((d) => d.answerStatus === 'done' && !wasDone.has(d.id)).length;
}

/** How many ai answers newly failed between two snapshots — the failure mirror of newlyAnswered (spec 138 Q4). */
export function newlyFailed(prev: readonly Deferral[], next: readonly Deferral[]): number {
  const wasFailed = new Set(prev.filter((d) => d.answerStatus === 'failed').map((d) => d.id));
  return next.filter((d) => d.answerStatus === 'failed' && !wasFailed.has(d.id)).length;
}

/**
 * Honest elapsed since a deferral was asked (spec 138 Q1): "12s", "1m 05s". `Date.now() − createdAt`
 * is always true even while queued behind another question — it reads as "time since you asked".
 */
export function elapsedLabel(createdAtIso: string, now: number): string {
  const start = Date.parse(createdAtIso);
  const secs = Number.isNaN(start) ? 0 : Math.max(0, Math.floor((now - start) / 1000));
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${String(secs % 60).padStart(2, '0')}s`;
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
  failed: number;
  /** True while the answering segment is the one shown (drives the animated dots). */
  showAnswering: boolean;
  /** The `N deferred · M answers ready` part, without the failed tail (rendered plain). */
  mainText: string;
  /** ` · F failed` or '' — rendered red (`.cluster-failed`); split out so the tone can differ. */
  failedText: string;
  /** The full composed line (mainText + failedText) — for the aria-label and unit tests. */
  text: string;
}

/**
 * The passive progress-cluster item (position 4): `N deferred` + a ready/answering tail + a failed
 * tail (spec 138 Q3/Q4). Ready and failed each show whenever > 0; answering shows only when both are
 * 0 (a finished/failed answer is the more actionable news). E.g. `3 deferred · 1 answer ready · 1 failed`.
 */
export function deferCluster(deferrals: readonly Deferral[]): DeferCluster {
  const deferred = deferrals.filter((d) => !d.inline);
  const deferredCount = new Set(deferred.map((d) => d.chunkId)).size;
  const answersReady = deferred.filter((d) => d.kind === 'ai' && d.answerStatus === 'done').length;
  const answering = deferred.filter((d) => d.kind === 'ai' && !isTerminal(d)).length;
  const failed = deferred.filter((d) => d.kind === 'ai' && d.answerStatus === 'failed').length;
  if (deferredCount === 0) return { deferredCount, answersReady, answering, failed, showAnswering: false, mainText: '', failedText: '', text: '' };
  const showAnswering = answersReady === 0 && failed === 0 && answering > 0;
  let mainText = `${deferredCount} deferred`;
  if (answersReady > 0) mainText += ` · ${answersReady} answer${answersReady === 1 ? '' : 's'} ready`;
  else if (showAnswering) mainText += ` · ${answering} answering`;
  const failedText = failed > 0 ? ` · ${failed} failed` : '';
  return { deferredCount, answersReady, answering, failed, showAnswering, mainText, failedText, text: mainText + failedText };
}

/** ai answers still arriving across the whole set — the done-banner line (`M AI answers still arriving…`). */
export function answersStillArriving(deferrals: readonly Deferral[]): number {
  return deferrals.filter((d) => d.kind === 'ai' && !isTerminal(d)).length;
}

function preview(text: string, max = 42): string {
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length <= max ? one : `${one.slice(0, max - 1)}…`;
}

/**
 * The collapsed-stub model for a deferred chunk (spec 138 Q1/Q4). A discriminated union so the row
 * can render a live indicator for `answering` (the count-up is the liveness signal) and the failure
 * tone for `failed`; `ready`/`other` are plain copy. `answering` carries the createdAt to count from.
 * Priority: ready > answering > failed > note — an actively answering deferral is the live truth; a
 * failure that is still hidden behind it resurfaces the moment that answer resolves.
 */
export type StubModel =
  | { kind: 'answering'; text: string; createdAtIso: string }
  | { kind: 'ready'; text: string }
  | { kind: 'failed'; text: string }
  | { kind: 'other'; text: string };

export function stubModel(chunkDeferrals: readonly Deferral[]): StubModel {
  const ai = chunkDeferrals.filter((d) => d.kind === 'ai');
  if (ai.some((d) => d.answerStatus === 'done')) return { kind: 'ready', text: 'Deferred — AI answer ready ↓' };
  const answering = ai.find((d) => !isTerminal(d));
  if (answering) return { kind: 'answering', text: 'Deferred — AI answering', createdAtIso: answering.createdAt };
  if (ai.some((d) => d.answerStatus === 'failed')) return { kind: 'failed', text: "Deferred — AI couldn't answer · retry at end ↓" };
  const first = chunkDeferrals[0];
  const body = first && first.text.trim() ? preview(first.text) : 'resolve at end';
  return { kind: 'other', text: `Deferred — ${body} · resolve at end ↓` };
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
