import { describe, expect, it } from 'vitest';
import { compileBook } from './book.js';
import { chunkFile } from './chunker.js';
import { type FileDiff } from './diff.js';
import { type ImportGraph } from './import-graph.js';

function file(path: string, hunks: FileDiff['hunks'], status: FileDiff['status'] = 'modified'): FileDiff {
  return { path, status, binary: false, hunks };
}

function graph(...edges: [string, string][]): ImportGraph {
  return { edges: edges.map(([from, to]) => ({ from, to })), unresolved: 0 };
}

const noGraph = graph();

const lines = Array.from({ length: 60 }, (_, i) => `line ${i + 1}`);

describe('compileBook', () => {
  it('makes one section per file in git order with one primary occurrence per chunk', () => {
    const files = [
      file('b.ts', [{ baseStart: 1, baseCount: 1, headStart: 1, headCount: 2 }]),
      file('a.ts', [{ baseStart: 5, baseCount: 0, headStart: 5, headCount: 3 }]),
    ];
    const chunks = files.flatMap((diff) => chunkFile({ diff, lines, baseLines: lines }));
    const { book, chunks: all } = compileBook({ files, chunks, graph: noGraph, headSha: 'abc123' });

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
    const { book, chunks: all } = compileBook({ files: [f], chunks, graph: noGraph, headSha: 'abc' });

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
    const { book } = compileBook({ files: [covered, empty], chunks, graph: noGraph, headSha: 'abc' });

    expect(book.sections.map((s) => s.id)).toEqual(['a.ts']);
  });

  it('claims unowned lines on the base side for deleted files', () => {
    const f = file('gone.ts', [{ baseStart: 3, baseCount: 4, headStart: 0, headCount: 0 }], 'deleted');
    const { book, chunks: all } = compileBook({ files: [f], chunks: [], graph: noGraph, headSha: 'abc' });

    expect(book.sections.map((s) => s.id)).toEqual(['(leftovers)']);
    expect(all[0]!.baseRange).toEqual({ start: 3, end: 6 });
    expect(all[0]!.headRange).toBeUndefined();
  });
});

describe('compileBook section ordering', () => {
  function setup(paths: string[], lowSignal: string[] = []) {
    const files = paths.map((p) => file(p, [{ baseStart: 1, baseCount: 1, headStart: 1, headCount: 1 }]));
    const chunks = files
      .flatMap((diff) => chunkFile({ diff, lines, baseLines: lines }))
      .map((c) => (lowSignal.includes(c.file) ? { ...c, changeTypes: ['generated' as const] } : c));
    return { files, chunks };
  }

  function sectionIds(paths: string[], g: ImportGraph, lowSignal: string[] = []): string[] {
    const { files, chunks } = setup(paths, lowSignal);
    return compileBook({ files, chunks, graph: g, headSha: 'x' }).book.sections.map((s) => s.id);
  }

  it('orders impl sections dependencies first', () => {
    expect(sectionIds(['consumer.ts', 'dep.ts'], graph(['consumer.ts', 'dep.ts']))).toEqual([
      'dep.ts',
      'consumer.ts',
    ]);
  });

  it('falls back to git order within a cycle', () => {
    const g = graph(['a.ts', 'b.ts'], ['b.ts', 'a.ts']);
    expect(sectionIds(['a.ts', 'b.ts'], g)).toEqual(['a.ts', 'b.ts']);
    expect(sectionIds(['b.ts', 'a.ts'], g)).toEqual(['b.ts', 'a.ts']);
  });

  it('keeps git order for ties and is stable across re-runs', () => {
    const paths = ['b.ts', 'a.ts', 'x.ts'];
    const g = graph(['b.ts', 'x.ts'], ['a.ts', 'x.ts']);
    const first = sectionIds(paths, g);
    expect(first).toEqual(['x.ts', 'b.ts', 'a.ts']);
    expect(sectionIds(paths, g)).toEqual(first);
  });

  it('places a test section right after the last impl section it imports', () => {
    const g = graph(['a.ts', 'b.ts'], ['a.test.ts', 'a.ts'], ['a.test.ts', 'b.ts']);
    expect(sectionIds(['b.ts', 'a.ts', 'a.test.ts'], g)).toEqual(['b.ts', 'a.ts', 'a.test.ts']);
  });

  it('places an import-less test section after its best stem match', () => {
    const paths = ['HistoryService.cs', 'Other.cs', 'HistoryServiceActivityTests.cs'];
    const g = graph(['Other.cs', 'HistoryService.cs']);
    expect(sectionIds(paths, g)).toEqual(['HistoryService.cs', 'HistoryServiceActivityTests.cs', 'Other.cs']);
  });

  it('places an unmatched test section after all impl sections', () => {
    const g = graph(['a.ts', 'b.ts']);
    expect(sectionIds(['a.ts', 'b.ts', 'zz.test.ts', 'style.css'], g)).toEqual([
      'b.ts',
      'a.ts',
      'zz.test.ts',
      'style.css',
    ]);
  });

  it('puts periphery before low-signal at the tail', () => {
    const g = graph(['a.ts', 'b.ts']);
    expect(sectionIds(['gen.lock', 'p.ts', 'a.ts', 'b.ts'], g, ['gen.lock'])).toEqual([
      'b.ts',
      'a.ts',
      'p.ts',
      'gen.lock',
    ]);
  });

  it('keeps the leftovers section last, after low-signal', () => {
    const { files, chunks } = setup(['gen.lock', 'a.ts'], ['gen.lock']);
    files.push(file('gap.ts', [{ baseStart: 1, baseCount: 0, headStart: 10, headCount: 2 }]));
    const { book } = compileBook({ files, chunks, graph: noGraph, headSha: 'x' });
    expect(book.sections.map((s) => s.id)).toEqual(['a.ts', 'gen.lock', '(leftovers)']);
  });

  it('never adds, drops, or duplicates occurrences when reordering', () => {
    const paths = ['b.ts', 'a.ts', 'a.test.ts', 'p.ts', 'gen.lock'];
    const g = graph(['a.ts', 'b.ts'], ['a.test.ts', 'a.ts']);
    const { files, chunks } = setup(paths, ['gen.lock']);
    const { book } = compileBook({ files, chunks, graph: g, headSha: 'x' });
    const occurrences = book.sections.flatMap((s) => s.occurrences);
    expect(occurrences.map((o) => o.chunkId).sort()).toEqual(chunks.map((c) => c.id).sort());
  });
});
