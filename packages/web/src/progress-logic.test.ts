import { describe, expect, it } from 'vitest';
import {
  chaptersRemaining,
  completionToastCopy,
  DEFERRED_WEB_SECTION_ID,
  newlyCompleted,
  resumeCopy,
  sectionLabel,
  segmentModel,
} from './progress-logic.js';

const stats = (entries: Record<string, [number, number]>) =>
  new Map(Object.entries(entries).map(([id, [done, total]]) => [id, { done, total }]));

describe('sectionLabel', () => {
  it('takes the basename without extension', () => {
    expect(sectionLabel('src/api/FilterBar.cs')).toBe('FilterBar');
    expect(sectionLabel('FilterBar.tsx')).toBe('FilterBar');
    expect(sectionLabel('no-extension')).toBe('no-extension');
  });
});

describe('segmentModel', () => {
  const sections = [
    { id: 'a', title: 'A.cs' },
    { id: 'b', title: 'B.cs' },
    { id: 'c', title: 'C.cs' },
  ];

  it('emits one tri-state segment per non-empty section', () => {
    const segs = segmentModel(sections, stats({ a: [0, 3], b: [2, 4], c: [5, 5] }));
    expect(segs.map((s) => [s.sectionId, s.state])).toEqual([
      ['a', 'untouched'],
      ['b', 'partial'],
      ['c', 'complete'],
    ]);
    expect(segs[1]).toMatchObject({ done: 2, total: 4 });
  });

  it('excludes the deferred:web section and zero-total sections', () => {
    const withDeferred = [...sections, { id: DEFERRED_WEB_SECTION_ID, title: 'Deferred' }, { id: 'z', title: 'Z.cs' }];
    const segs = segmentModel(withDeferred, stats({ a: [0, 1], b: [0, 1], c: [0, 1], [DEFERRED_WEB_SECTION_ID]: [0, 2], z: [0, 0] }));
    expect(segs.map((s) => s.sectionId)).toEqual(['a', 'b', 'c']);
  });
});

describe('newlyCompleted — incomplete→complete edge only', () => {
  it('reports a section that just finished', () => {
    expect(newlyCompleted(stats({ a: [2, 3] }), stats({ a: [3, 3] }))).toEqual(['a']);
  });

  it('does not re-fire an already-complete section', () => {
    expect(newlyCompleted(stats({ a: [3, 3] }), stats({ a: [3, 3] }))).toEqual([]);
  });

  it('reports every section that crossed in one batch', () => {
    expect(newlyCompleted(stats({ a: [0, 2], b: [1, 2], c: [2, 2] }), stats({ a: [2, 2], b: [2, 2], c: [2, 2] }))).toEqual(['a', 'b']);
  });

  it('ignores deferred:web and empty sections', () => {
    const prev = stats({ [DEFERRED_WEB_SECTION_ID]: [0, 2], z: [0, 0] });
    const next = stats({ [DEFERRED_WEB_SECTION_ID]: [2, 2], z: [0, 0] });
    expect(newlyCompleted(prev, next)).toEqual([]);
  });
});

describe('chaptersRemaining', () => {
  it('counts incomplete sections, ignoring deferred/empty', () => {
    expect(chaptersRemaining(stats({ a: [0, 2], b: [2, 2], c: [1, 3], [DEFERRED_WEB_SECTION_ID]: [0, 1], z: [0, 0] }))).toBe(2);
  });
});

describe('completionToastCopy — one toast, never zero, never N', () => {
  it('is undefined when nothing completed', () => {
    expect(completionToastCopy([], 3)).toBeUndefined();
  });

  it('names a single completion with chapters left', () => {
    expect(completionToastCopy(['FilterBar'], 3)).toBe('Chapter done — FilterBar. 3 chapters left.');
    expect(completionToastCopy(['FilterBar'], 1)).toBe('Chapter done — FilterBar. 1 chapter left.');
  });

  it('summarizes a batch in exactly one line', () => {
    expect(completionToastCopy(['A', 'B', 'C'], 2)).toBe('3 chapters done — 2 left.');
  });

  it('drops the count when nothing is left', () => {
    expect(completionToastCopy(['FilterBar'], 0)).toBe('Chapter done — FilterBar.');
    expect(completionToastCopy(['A', 'B'], 0)).toBe('2 chapters done.');
  });
});

describe('resumeCopy', () => {
  it('frames resume as proximity with next chapter', () => {
    expect(resumeCopy(62, 3, 'FilterBar')).toBe('Resumed — 62% through. 3 chapters left, next up: FilterBar.');
  });

  it('omits the chapters clause when none remain', () => {
    expect(resumeCopy(100, 0, undefined)).toBe('Resumed — 100% through.');
  });

  it('handles a missing next-up label', () => {
    expect(resumeCopy(40, 2, undefined)).toBe('Resumed — 40% through. 2 chapters left.');
  });
});
