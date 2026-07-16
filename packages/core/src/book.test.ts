import { describe, expect, it } from 'vitest';
import { compileBook } from './book.js';
import { chunkFile } from './chunker.js';
import { type FileDiff } from './diff.js';

function file(path: string, hunks: FileDiff['hunks'], status: FileDiff['status'] = 'modified'): FileDiff {
  return { path, status, binary: false, hunks };
}

const lines = Array.from({ length: 60 }, (_, i) => `line ${i + 1}`);

describe('compileBook', () => {
  it('makes one section per file in git order with one primary occurrence per chunk', () => {
    const files = [
      file('b.ts', [{ baseStart: 1, baseCount: 1, headStart: 1, headCount: 2 }]),
      file('a.ts', [{ baseStart: 5, baseCount: 0, headStart: 5, headCount: 3 }]),
    ];
    const chunks = files.flatMap((diff) => chunkFile({ diff, lines, baseLines: lines }));
    const { book, chunks: all } = compileBook({ files, chunks, headSha: 'abc123' });

    expect(book.sections.map((s) => s.id)).toEqual(['b.ts', 'a.ts']);
    expect(book.headSha).toBe('abc123');
    expect(all).toEqual(chunks);
    const occurrences = book.sections.flatMap((s) => s.occurrences);
    expect(occurrences).toHaveLength(chunks.length);
    expect(occurrences.every((o) => o.role === 'primary')).toBe(true);
    expect(new Set(occurrences.map((o) => o.chunkId)).size).toBe(chunks.length);
  });

  it('synthesizes leftover chunks for changed lines no chunk claims', () => {
    const f = file('gap.ts', [{ baseStart: 1, baseCount: 0, headStart: 10, headCount: 6 }]);
    const chunks = chunkFile({ diff: f, lines, baseLines: lines }).map((c) => ({
      ...c,
      // drop lines 12–13 and 15 from the chunk's coverage
      hunks: [
        { baseStart: 1, baseCount: 0, headStart: 10, headCount: 2 },
        { baseStart: 1, baseCount: 0, headStart: 14, headCount: 1 },
      ],
    }));
    const { book, chunks: all } = compileBook({ files: [f], chunks, headSha: 'abc' });

    const leftovers = book.sections.at(-1)!;
    expect(leftovers.id).toBe('(leftovers)');
    expect(leftovers.occurrences).toHaveLength(2); // runs 12–13 and 15
    const synthesized = all.filter((c) => c.id.includes('(leftover)'));
    expect(synthesized.map((c) => c.headRange)).toEqual([
      { start: 12, end: 13 },
      { start: 15, end: 15 },
    ]);
  });

  it('skips files with no chunks and adds no leftovers section under full coverage', () => {
    const covered = file('a.ts', [{ baseStart: 1, baseCount: 1, headStart: 1, headCount: 1 }]);
    const empty = file('mode-only.sh', []);
    const chunks = chunkFile({ diff: covered, lines, baseLines: lines });
    const { book } = compileBook({ files: [covered, empty], chunks, headSha: 'abc' });

    expect(book.sections.map((s) => s.id)).toEqual(['a.ts']);
  });

  it('claims unowned lines on the base side for deleted files', () => {
    const f = file('gone.ts', [{ baseStart: 3, baseCount: 4, headStart: 0, headCount: 0 }], 'deleted');
    const { book, chunks: all } = compileBook({ files: [f], chunks: [], headSha: 'abc' });

    expect(book.sections.map((s) => s.id)).toEqual(['(leftovers)']);
    expect(all[0]!.baseRange).toEqual({ start: 3, end: 6 });
    expect(all[0]!.headRange).toBeUndefined();
  });
});
