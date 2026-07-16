import { describe, expect, it } from 'vitest';
import { checkCoverage } from './coverage.js';
import { type FileDiff } from './diff.js';
import { type Chunk } from './model.js';

function file(path: string, hunks: FileDiff['hunks'], status: FileDiff['status'] = 'modified'): FileDiff {
  return { path, status, binary: false, hunks };
}

function chunk(filePath: string, hunks: Chunk['hunks']): Chunk {
  return {
    id: `${filePath}::x::0`,
    file: filePath,
    symbolPath: [],
    displayPath: [],
    kind: 'other',
    changeTypes: [],
    hunks,
  };
}

describe('checkCoverage', () => {
  const diff = [file('a.ts', [{ baseStart: 1, baseCount: 0, headStart: 10, headCount: 3 }])];

  it('passes when every changed line is owned exactly once', () => {
    const report = checkCoverage(diff, [chunk('a.ts', [{ baseStart: 1, baseCount: 0, headStart: 10, headCount: 3 }])]);
    expect(report).toMatchObject({ ok: true, expected: 3, missing: [], duplicated: [] });
  });

  it('reports unowned lines as missing', () => {
    const report = checkCoverage(diff, [chunk('a.ts', [{ baseStart: 1, baseCount: 0, headStart: 10, headCount: 2 }])]);
    expect(report.ok).toBe(false);
    expect(report.missing).toEqual(['a.ts:12']);
  });

  it('reports doubly-owned lines as duplicated', () => {
    const h = { baseStart: 1, baseCount: 0, headStart: 10, headCount: 3 };
    const report = checkCoverage(diff, [chunk('a.ts', [h]), chunk('a.ts', [{ ...h, headStart: 12, headCount: 1 }])]);
    expect(report.ok).toBe(false);
    expect(report.duplicated).toEqual(['a.ts:12']);
  });

  it('checks the base side for deleted files', () => {
    const deleted = [file('gone.ts', [{ baseStart: 5, baseCount: 2, headStart: 0, headCount: 0 }], 'deleted')];
    const report = checkCoverage(deleted, [chunk('gone.ts', [{ baseStart: 5, baseCount: 2, headStart: 0, headCount: 0 }])]);
    expect(report).toMatchObject({ ok: true, expected: 2 });
  });
});
