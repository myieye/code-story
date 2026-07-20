import type { Deferral, UnifiedLine } from '@code-story/core';
import { describe, expect, it } from 'vitest';
import {
  answersStillArriving,
  deferCluster,
  deferredChunkIds,
  newlyAnswered,
  selectionLineRange,
  shouldPoll,
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
