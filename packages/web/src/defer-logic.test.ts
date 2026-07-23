import type { Deferral, UnifiedLine } from '@code-story/core';
import { describe, expect, it } from 'vitest';
import {
  answersStillArriving,
  chunkHeadSpan,
  deferCluster,
  deferConsequenceCopy,
  deferredChunkIds,
  deferredSliceSummary,
  deferScope,
  elapsedLabel,
  newlyAnswered,
  newlyFailed,
  pollIntervalMs,
  selectionLineRange,
  shouldPoll,
  sliceLinesToRange,
  splitButtonModel,
  stubModel,
} from './defer-logic.js';

function d(over: Partial<Deferral>): Deferral {
  return { id: 'x', chunkId: 'c', kind: 'note', text: '', createdAt: '2026-07-20T00:00:00Z', ...over };
}

describe('shouldPoll', () => {
  it('is true while any ai answer is pending, false once all terminal / only notes', () => {
    expect(shouldPoll([d({ kind: 'note' })])).toBe(false);
    expect(shouldPoll([d({ kind: 'ai', answerStatus: 'running' })])).toBe(true);
    expect(shouldPoll([d({ kind: 'ai' })])).toBe(true); // pre-dequeue window
    expect(shouldPoll([d({ kind: 'ai', answerStatus: 'done' }), d({ kind: 'ai', answerStatus: 'failed' })])).toBe(false);
    expect(shouldPoll([d({ kind: 'ai', inline: true, answerStatus: 'running' })])).toBe(true);
  });
});

describe('newlyAnswered', () => {
  it('counts only running→done transitions', () => {
    const prev = [d({ id: 'a', kind: 'ai', answerStatus: 'running' }), d({ id: 'b', kind: 'ai', answerStatus: 'done' })];
    const next = [d({ id: 'a', kind: 'ai', answerStatus: 'done' }), d({ id: 'b', kind: 'ai', answerStatus: 'done' })];
    expect(newlyAnswered(prev, next)).toBe(1);
    expect(newlyAnswered(next, next)).toBe(0);
  });
});

describe('newlyFailed', () => {
  it('counts only new →failed transitions', () => {
    const prev = [d({ id: 'a', kind: 'ai', answerStatus: 'running' }), d({ id: 'b', kind: 'ai', answerStatus: 'failed' })];
    const next = [d({ id: 'a', kind: 'ai', answerStatus: 'failed' }), d({ id: 'b', kind: 'ai', answerStatus: 'failed' })];
    expect(newlyFailed(prev, next)).toBe(1);
    expect(newlyFailed(next, next)).toBe(0);
  });
});

describe('pollIntervalMs', () => {
  it('stops when nothing is pending, else tightens while the youngest question is fresh', () => {
    const now = Date.parse('2026-07-20T00:01:00Z');
    expect(pollIntervalMs([d({ kind: 'note' })], now)).toBeNull();
    expect(pollIntervalMs([d({ kind: 'ai', answerStatus: 'done' })], now)).toBeNull();
    // Youngest pending asked 10s ago → fresh → 3s.
    expect(pollIntervalMs([d({ kind: 'ai', createdAt: '2026-07-20T00:00:50Z' })], now)).toBe(3000);
    // Youngest pending asked 45s ago → 8s.
    expect(pollIntervalMs([d({ kind: 'ai', createdAt: '2026-07-20T00:00:15Z' })], now)).toBe(8000);
    // Takes the youngest of several — the 5s-old one keeps it at 3s.
    expect(
      pollIntervalMs(
        [d({ id: 'a', kind: 'ai', createdAt: '2026-07-20T00:00:00Z' }), d({ id: 'b', kind: 'ai', createdAt: '2026-07-20T00:00:55Z' })],
        now,
      ),
    ).toBe(3000);
  });
});

describe('elapsedLabel', () => {
  it('formats seconds, then minutes with zero-padded seconds', () => {
    const start = Date.parse('2026-07-20T00:00:00Z');
    expect(elapsedLabel('2026-07-20T00:00:00Z', start + 12_000)).toBe('12s');
    expect(elapsedLabel('2026-07-20T00:00:00Z', start + 65_000)).toBe('1m 05s');
    expect(elapsedLabel('2026-07-20T00:00:00Z', start - 5_000)).toBe('0s'); // never negative
    expect(elapsedLabel('not-a-date', start)).toBe('0s');
  });
});

describe('deferredChunkIds', () => {
  it('is distinct non-inline chunk ids in first-appearance order', () => {
    const list = [d({ chunkId: 'c2' }), d({ chunkId: 'c1' }), d({ chunkId: 'c2' }), d({ chunkId: 'c3', inline: true })];
    expect(deferredChunkIds(list)).toEqual(['c2', 'c1']);
  });
});

describe('deferCluster', () => {
  it('hides at zero and composes the ready/answering tail', () => {
    expect(deferCluster([]).text).toBe('');
    expect(deferCluster([d({ chunkId: 'c1' }), d({ chunkId: 'c2' })]).text).toBe('2 deferred');
    expect(deferCluster([d({ chunkId: 'c1', kind: 'ai', answerStatus: 'running' })]).text).toBe('1 deferred · 1 answering');
    expect(deferCluster([d({ chunkId: 'c1', kind: 'ai', answerStatus: 'done' })]).text).toBe('1 deferred · 1 answer ready');
    // Inline deferrals never count toward the Deferred section.
    expect(deferCluster([d({ chunkId: 'c1', inline: true, kind: 'ai', answerStatus: 'running' })]).deferredCount).toBe(0);
  });

  it('surfaces failed alongside ready, and shows answering only when both are 0 (spec 138 Q4)', () => {
    // ready + failed both present; answering suppressed.
    const c = deferCluster([
      d({ id: 'a', chunkId: 'c1', kind: 'ai', answerStatus: 'done' }),
      d({ id: 'b', chunkId: 'c2', kind: 'ai', answerStatus: 'failed' }),
      d({ id: 'c', chunkId: 'c3', kind: 'ai', answerStatus: 'running' }),
    ]);
    expect(c.text).toBe('3 deferred · 1 answer ready · 1 failed');
    expect(c.mainText).toBe('3 deferred · 1 answer ready');
    expect(c.failedText).toBe(' · 1 failed');
    expect(c.showAnswering).toBe(false);
    // failed present, no ready → answering still suppressed, only failed shown.
    const c2 = deferCluster([d({ id: 'a', chunkId: 'c1', kind: 'ai', answerStatus: 'failed' }), d({ id: 'b', chunkId: 'c2', kind: 'ai', answerStatus: 'running' })]);
    expect(c2.text).toBe('2 deferred · 1 failed');
    expect(c2.showAnswering).toBe(false);
    // only answering → shown, flagged for the animated dots.
    const c3 = deferCluster([d({ chunkId: 'c1', kind: 'ai', answerStatus: 'running' })]);
    expect(c3.showAnswering).toBe(true);
    expect(c3.failedText).toBe('');
  });
});

describe('answersStillArriving', () => {
  it('counts all pending ai answers (inline included)', () => {
    expect(
      answersStillArriving([d({ kind: 'ai', answerStatus: 'running' }), d({ kind: 'ai', inline: true }), d({ kind: 'ai', answerStatus: 'done' })]),
    ).toBe(2);
  });
});

describe('stubModel', () => {
  it('reflects the strongest state: ready > answering > failed > note', () => {
    expect(stubModel([d({ kind: 'ai', answerStatus: 'done' }), d({ kind: 'ai', answerStatus: 'running' })])).toEqual({
      kind: 'ready',
      text: 'Deferred — AI answer ready ↓',
    });
    expect(stubModel([d({ kind: 'ai', answerStatus: 'running', createdAt: '2026-07-20T00:00:00Z' })])).toEqual({
      kind: 'answering',
      text: 'Deferred — AI answering',
      createdAtIso: '2026-07-20T00:00:00Z',
    });
    // Q4: a lone failed answer must surface, not fall through to the plain note branch.
    expect(stubModel([d({ kind: 'ai', answerStatus: 'failed' })])).toEqual({
      kind: 'failed',
      text: "Deferred — AI couldn't answer · retry at end ↓",
    });
    expect(stubModel([d({ kind: 'note', text: 'look at the retry path here' })])).toEqual({
      kind: 'other',
      text: 'Deferred — look at the retry path here · resolve at end ↓',
    });
    expect(stubModel([d({ kind: 'note', text: '' })])).toEqual({ kind: 'other', text: 'Deferred — resolve at end · resolve at end ↓' });
  });
});

describe('splitButtonModel', () => {
  it('gates the primary on text and morphs the note label', () => {
    expect(splitButtonModel('')).toMatchObject({ primaryDisabled: true, noteLabel: 'Defer to end' });
    expect(splitButtonModel('is this right?')).toMatchObject({ primaryDisabled: false, noteLabel: 'Defer with a note' });
  });
});

describe('selectionLineRange', () => {
  const lines: UnifiedLine[] = [
    { type: 'context', text: 'a', head: 10 },
    { type: 'gap', text: '' },
    { type: 'add', text: 'b', head: 34 },
    { type: 'add', text: 'c', head: 35 },
  ];
  it('maps doc lines to head numbers, skipping gaps', () => {
    expect(selectionLineRange(3, 4, lines)).toEqual({ start: 34, end: 35 });
    expect(selectionLineRange(1, 4, lines)).toEqual({ start: 10, end: 35 });
    expect(selectionLineRange(2, 2, lines)).toBeUndefined(); // gap only
  });
});

describe('chunkHeadSpan', () => {
  it('spans only changed (add/del) lines, ignoring context and gaps', () => {
    const lines: UnifiedLine[] = [
      { type: 'context', text: 'a', head: 10 },
      { type: 'del', text: 'b', base: 33 },
      { type: 'add', text: 'c', head: 34 },
      { type: 'add', text: 'd', head: 35 },
      { type: 'context', text: 'e', head: 40 },
    ];
    expect(chunkHeadSpan(lines)).toEqual({ start: 33, end: 35 });
    expect(chunkHeadSpan([{ type: 'context', text: 'x', head: 1 }])).toBeUndefined();
  });
});

describe('deferScope', () => {
  const span = { start: 33, end: 35 };
  it('no selection parks the whole chunk', () => {
    expect(deferScope(undefined, span)).toBe('whole');
  });
  it('a selection covering the full changed span is whole', () => {
    expect(deferScope({ start: 30, end: 40 }, span)).toBe('whole');
    expect(deferScope({ start: 33, end: 35 }, span)).toBe('whole');
  });
  it('a strict subset is a slice', () => {
    expect(deferScope({ start: 34, end: 35 }, span)).toBe('slice');
    expect(deferScope({ start: 33, end: 34 }, span)).toBe('slice');
  });
});

describe('deferConsequenceCopy', () => {
  it('slice copy names the range and the auto-mark; whole copy is the plain defer', () => {
    expect(deferConsequenceCopy('slice', { start: 34, end: 35 })).toBe(
      'Defer lines 34–35 — the rest of this chunk is marked reviewed',
    );
    expect(deferConsequenceCopy('whole', undefined)).toBe('Defer this whole chunk to the end — resolve it later');
    // A slice scope with no range can't happen, but falls back to whole copy rather than throwing.
    expect(deferConsequenceCopy('slice', undefined)).toBe('Defer this whole chunk to the end — resolve it later');
  });
});

describe('deferredSliceSummary', () => {
  it('counts the deferrals and surfaces the first that carries a range', () => {
    expect(deferredSliceSummary([])).toEqual({ count: 0 });
    expect(deferredSliceSummary([d({}), d({ lineRange: { start: 34, end: 35 } })])).toEqual({
      count: 2,
      firstRange: { start: 34, end: 35 },
    });
  });
});

describe('sliceLinesToRange', () => {
  const lines: UnifiedLine[] = [
    { type: 'context', text: 'a', head: 30 },
    { type: 'context', text: 'b', head: 31 },
    { type: 'context', text: 'c', head: 32 },
    { type: 'context', text: 'd', head: 33 },
    { type: 'add', text: 'e', head: 34 },
    { type: 'add', text: 'f', head: 35 },
    { type: 'context', text: 'g', head: 36 },
    { type: 'context', text: 'h', head: 37 },
    { type: 'context', text: 'i', head: 38 },
    { type: 'context', text: 'j', head: 39 },
  ];
  it('keeps 3 context lines each side of the range', () => {
    const out = sliceLinesToRange(lines, { start: 34, end: 35 });
    expect(out.map((l) => l.head)).toEqual([31, 32, 33, 34, 35, 36, 37, 38]);
  });
  it('drops leading/trailing gaps and keeps a gap between kept runs', () => {
    const withGaps: UnifiedLine[] = [
      { type: 'gap', text: '' },
      { type: 'add', text: 'a', head: 34 },
      { type: 'gap', text: '' },
      { type: 'add', text: 'b', head: 100 },
      { type: 'gap', text: '' },
    ];
    // context=3: 34 and 100 both kept (they are the range edges), the gap between them survives.
    const out = sliceLinesToRange(withGaps, { start: 34, end: 100 });
    expect(out.map((l) => l.type)).toEqual(['add', 'gap', 'add']);
  });
});
