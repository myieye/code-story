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
  newlyAnswered,
  selectionLineRange,
  shouldPoll,
  sliceLinesToRange,
  splitButtonModel,
  stubCopy,
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
});

describe('answersStillArriving', () => {
  it('counts all pending ai answers (inline included)', () => {
    expect(
      answersStillArriving([d({ kind: 'ai', answerStatus: 'running' }), d({ kind: 'ai', inline: true }), d({ kind: 'ai', answerStatus: 'done' })]),
    ).toBe(2);
  });
});

describe('stubCopy', () => {
  it('reflects the strongest state: ready > answering > note', () => {
    expect(stubCopy([d({ kind: 'ai', answerStatus: 'done' }), d({ kind: 'ai', answerStatus: 'running' })])).toBe('Deferred — AI answer ready ↓');
    expect(stubCopy([d({ kind: 'ai', answerStatus: 'running' })])).toBe('Deferred — AI answering… ↓');
    expect(stubCopy([d({ kind: 'note', text: 'look at the retry path here' })])).toBe('Deferred — look at the retry path here · resolve at end ↓');
    expect(stubCopy([d({ kind: 'note', text: '' })])).toBe('Deferred — resolve at end · resolve at end ↓');
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
