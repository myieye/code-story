import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { chunkFile, type FileToChunk } from './chunker.js';
import { type FileDiff, type Hunk } from './diff.js';
import { type SymbolSpan } from './symbols.js';

function span(name: string, kind: SymbolSpan['kind'], startLine: number, endLine: number, children: SymbolSpan[] = []): SymbolSpan {
  return { name, kind, startLine, endLine, children };
}

function file(hunks: Hunk[], overrides?: Partial<FileDiff>): FileDiff {
  return { path: 'src/a.ts', status: 'modified', binary: false, hunks, ...overrides };
}

const lines100 = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);

function input(diff: FileDiff, symbols?: SymbolSpan[], extra?: Partial<FileToChunk>): FileToChunk {
  return { diff, lines: lines100, baseLines: lines100, symbols, ...extra };
}

const classWithMethods = [
  span('Foo', 'type', 1, 90, [span('bar', 'function', 10, 30), span('baz', 'function', 40, 60)]),
];

describe('chunkFile', () => {
  it('maps a hunk inside one method to one chunk with the symbol path', () => {
    const chunks = chunkFile(input(file([{ baseStart: 12, baseCount: 2, headStart: 12, headCount: 3 }]), classWithMethods));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ symbolPath: ['Foo', 'bar'], kind: 'method' });
  });

  it('splits a hunk spanning two methods at the boundary', () => {
    const chunks = chunkFile(input(file([{ baseStart: 25, baseCount: 20, headStart: 25, headCount: 20 }]), classWithMethods));
    const paths = chunks.map((c) => c.symbolPath.join('.'));
    expect(paths).toContain('Foo.bar'); // 25-30
    expect(paths).toContain('Foo'); // 31-39, between methods
    expect(paths).toContain('Foo.baz'); // 40-44
  });

  it('merges multiple hunks in the same method into one chunk', () => {
    const chunks = chunkFile(
      input(
        file([
          { baseStart: 12, baseCount: 1, headStart: 12, headCount: 1 },
          { baseStart: 20, baseCount: 1, headStart: 20, headCount: 1 },
        ]),
        classWithMethods,
      ),
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.hunks).toHaveLength(2);
  });

  it('marks every chunk of a generated file with the changeType and reason', () => {
    const chunks = chunkFile(
      input(file([{ baseStart: 25, baseCount: 20, headStart: 25, headCount: 20 }]), classWithMethods, {
        generatedReason: 'lockfile',
      }),
    );
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.changeTypes).toEqual(['generated']);
      expect(c.generatedReason).toBe('lockfile');
    }
  });

  it('anchors a pure deletion to the symbol at its anchor line', () => {
    const chunks = chunkFile(input(file([{ baseStart: 50, baseCount: 3, headStart: 45, headCount: 0 }]), classWithMethods));
    expect(chunks[0]!.symbolPath).toEqual(['Foo', 'baz']);
    expect(chunks[0]!.headRange).toBeUndefined();
  });

  it('fragments a method with more changed lines than maxLines', () => {
    const chunks = chunkFile(
      input(file([{ baseStart: 10, baseCount: 21, headStart: 10, headCount: 21 }]), classWithMethods),
      { maxLines: 10 },
    );
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.kind === 'method-fragment')).toBe(true);
    expect(new Set(chunks.map((c) => c.id)).size).toBe(chunks.length);
  });

  it('treats symbol-less files as single whole-file chunks', () => {
    const chunks = chunkFile(
      input(file([{ baseStart: 1, baseCount: 2, headStart: 1, headCount: 2 }], { path: 'pnpm-lock.yaml' }), undefined, {
        configLike: true,
      }),
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ kind: 'config', symbolPath: [] });
  });

  it('produces one chunk for a binary file', () => {
    const chunks = chunkFile(input(file([], { binary: true })));
    expect(chunks).toHaveLength(1);
  });

  it('chunks deleted files against the base side', () => {
    const chunks = chunkFile(
      input(file([{ baseStart: 12, baseCount: 5, headStart: 0, headCount: 0 }], { status: 'deleted' }), classWithMethods),
    );
    expect(chunks[0]).toMatchObject({ symbolPath: ['Foo', 'bar'], kind: 'method' });
    expect(chunks[0]!.headRange).toBeUndefined();
  });
});

// R-001: every changed line lands in exactly one chunk, for any outline and any hunks.
describe('coverage invariant', () => {
  const arbSymbols: fc.Arbitrary<SymbolSpan[]> = fc
    .array(fc.tuple(fc.integer({ min: 1, max: 200 }), fc.integer({ min: 1, max: 60 }), fc.boolean()), { maxLength: 6 })
    .map((tuples) => {
      const spans = tuples
        .map(([start, len, isFn], i) => span(`s${i}`, isFn ? 'function' : 'type', start, start + len))
        .sort((a, b) => a.startLine - b.startLine);
      // keep siblings disjoint so the outline is a valid tree
      const result: SymbolSpan[] = [];
      let lastEnd = 0;
      for (const s of spans) {
        if (s.startLine > lastEnd) {
          result.push(s);
          lastEnd = s.endLine;
        }
      }
      return result;
    });

  const arbHunks: fc.Arbitrary<Hunk[]> = fc
    .array(fc.tuple(fc.integer({ min: 1, max: 250 }), fc.integer({ min: 0, max: 80 }), fc.integer({ min: 0, max: 80 })), {
      minLength: 1,
      maxLength: 8,
    })
    .map((tuples) => {
      const hunks: Hunk[] = [];
      let headCursor = 1;
      let baseCursor = 1;
      for (const [gap, baseCount, headCount] of tuples) {
        if (baseCount === 0 && headCount === 0) continue;
        hunks.push({ baseStart: baseCursor + gap, baseCount, headStart: headCursor + gap, headCount });
        baseCursor += gap + baseCount + 1;
        headCursor += gap + headCount + 1;
      }
      return hunks;
    })
    .filter((hunks) => hunks.length > 0);

  it('every primary-side changed line belongs to exactly one chunk', () => {
    fc.assert(
      fc.property(arbSymbols, arbHunks, fc.integer({ min: 5, max: 50 }), (symbols, hunks, maxLines) => {
        const chunks = chunkFile(input(file(hunks), symbols), { maxLines });
        const seen = new Map<number, number>();
        for (const c of chunks) {
          for (const h of c.hunks) {
            for (let i = 0; i < h.headCount; i++) {
              seen.set(h.headStart + i, (seen.get(h.headStart + i) ?? 0) + 1);
            }
          }
        }
        const expected = new Set<number>();
        for (const h of hunks) {
          for (let i = 0; i < h.headCount; i++) expected.add(h.headStart + i);
        }
        expect(new Set(seen.keys())).toEqual(expected);
        expect([...seen.values()].every((n) => n === 1)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });
});
