import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { compileBook } from './book.js';
import { compileChapterBook } from './chapters.js';
import { checkOrder } from './check-order.js';
import { type ChunkEdge, type ChunkEdgeKind, type ChunkGraph } from './chunk-graph.js';
import { checkCoverage } from './coverage.js';
import { type FileDiff } from './diff.js';
import { type ImportGraph } from './import-graph.js';
import { type Book, type Chunk } from './model.js';
import { bookFingerprint, isOverlayFresh, type OrderOverlay } from './order.js';
import { type StoryConfig, TIM_STORY_CONFIG } from './story-config.js';

function fileDiff(path: string, start: number, count: number, status: FileDiff['status'] = 'modified'): FileDiff {
  return { path, status, binary: false, hunks: [{ baseStart: 1, baseCount: 0, headStart: start, headCount: count }] };
}

function chunk(file: string, id: string, symbol: string[], start: number, count: number): Chunk {
  return {
    id,
    file,
    symbolPath: symbol,
    displayPath: symbol,
    kind: 'method',
    changeTypes: [],
    hunks: [{ baseStart: 1, baseCount: 0, headStart: start, headCount: count }],
    headRange: { start, end: start + count - 1 },
  };
}

function cedge(from: string, to: string, kind: ChunkEdgeKind = 'calls', line = 1): ChunkEdge {
  const precise = kind !== 'file-imports';
  return { from, to, kind, fromLines: precise ? [{ start: line, end: line }] : [], source: precise ? 'references' : 'import-graph' };
}

function importGraph(...edges: [string, string][]): ImportGraph {
  return { edges: edges.map(([from, to]) => ({ from, to })), unresolved: 0 };
}

function chunkGraph(...edges: ChunkEdge[]): ChunkGraph {
  return { edges };
}

const flat = (book: Book) => book.sections.flatMap((s) => s.occurrences.map((o) => o.chunkId));

describe('compileChapterBook', () => {
  it('orders a caller before the chunks it calls (consumer-first) and labels cross-file occurrences', () => {
    const files = [fileDiff('consumer.ts', 1, 2), fileDiff('dep.ts', 1, 2)];
    const chunks = [chunk('consumer.ts', 'c1', ['use'], 1, 2), chunk('dep.ts', 'c2', ['dep'], 1, 2)];
    const { book } = compileChapterBook(
      { files, chunks, graph: importGraph(['consumer.ts', 'dep.ts']), chunkGraph: chunkGraph(cedge('c1', 'c2')), headSha: 'h' },
      { direction: 'consumer-first', testPlacement: 'after' },
    );

    expect(flat(book)).toEqual(['c1', 'c2']);
    expect(book.sections).toHaveLength(1);
    expect(book.sections[0]!.title).toBe('consumer.ts');
    expect(book.sections[0]!.occurrences.map((o) => o.label)).toEqual([undefined, 'dep.ts']);
  });

  it('orders callees before their caller under dependency-first', () => {
    const files = [fileDiff('consumer.ts', 1, 2), fileDiff('dep.ts', 1, 2)];
    const chunks = [chunk('consumer.ts', 'c1', ['use'], 1, 2), chunk('dep.ts', 'c2', ['dep'], 1, 2)];
    const { book } = compileChapterBook(
      { files, chunks, graph: importGraph(), chunkGraph: chunkGraph(cedge('c1', 'c2')), headSha: 'h' },
      { direction: 'dependency-first', testPlacement: 'after' },
    );
    expect(flat(book)).toEqual(['c2', 'c1']);
  });

  it('places a shared callee after every caller (topological, not naive DFS)', () => {
    const files = [fileDiff('a.ts', 1, 2), fileDiff('b.ts', 1, 2), fileDiff('shared.ts', 1, 2)];
    const chunks = [
      chunk('a.ts', 'a', ['a'], 1, 2),
      chunk('b.ts', 'b', ['b'], 1, 2),
      chunk('shared.ts', 's', ['s'], 1, 2),
    ];
    const cg = chunkGraph(cedge('a', 's'), cedge('b', 's'));
    const compiled = compileChapterBook(
      { files, chunks, graph: importGraph(), chunkGraph: cg, headSha: 'h' },
      { direction: 'consumer-first', testPlacement: 'after' },
    );
    const order = flat(compiled.book);
    expect(order.indexOf('s')).toBeGreaterThan(order.indexOf('a'));
    expect(order.indexOf('s')).toBeGreaterThan(order.indexOf('b'));
    expect(checkOrder(compiled.book, importGraph(), compiled.chunks, { config: { direction: 'consumer-first', testPlacement: 'after' }, chunkGraph: cg })).toMatchObject({
      ok: true,
      importInversions: [],
    });
  });

  it('degenerates to file-grouped git order when there are no calls edges', () => {
    const files = [fileDiff('a.ts', 1, 2), fileDiff('b.ts', 1, 2), fileDiff('c.ts', 1, 2)];
    const chunks = [chunk('a.ts', 'a', ['a'], 1, 2), chunk('b.ts', 'b', ['b'], 1, 2), chunk('c.ts', 'c', ['c'], 1, 2)];
    // No calls edges — the spine is driven only by calls, so it falls back to file-grouped git order.
    const { book } = compileChapterBook(
      { files, chunks, graph: importGraph(), chunkGraph: chunkGraph(), headSha: 'h' },
      { direction: 'consumer-first', testPlacement: 'before' },
    );
    expect(flat(book)).toEqual(['a', 'b', 'c']);
  });

  it('routes/pages anchor before other impl', () => {
    const files = [fileDiff('lib/util.ts', 1, 2), fileDiff('routes/+page.svelte', 1, 2)];
    const chunks = [chunk('lib/util.ts', 'u', ['u'], 1, 2), chunk('routes/+page.svelte', 'p', ['p'], 1, 2)];
    const { book } = compileChapterBook(
      { files, chunks, graph: importGraph(), chunkGraph: chunkGraph(), headSha: 'h' },
      { direction: 'consumer-first', testPlacement: 'before' },
    );
    expect(flat(book)).toEqual(['p', 'u']);
  });

  describe('tests by kind', () => {
    const files = [fileDiff('svc.ts', 1, 2), fileDiff('svc.test.ts', 1, 2)];
    const chunks = [chunk('svc.ts', 'impl', ['Svc'], 1, 2), chunk('svc.test.ts', 'test', ['SvcTest'], 1, 2)];
    const cg = chunkGraph(cedge('test', 'impl', 'exercises'));
    const graph = importGraph(['svc.test.ts', 'svc.ts']);

    const orderFor = (testPlacement: StoryConfig['testPlacement']) =>
      flat(compileChapterBook({ files, chunks, graph, chunkGraph: cg, headSha: 'h' }, { direction: 'consumer-first', testPlacement }).book);

    it('places a unit test before the impl it exercises (before)', () => {
      expect(orderFor('before')).toEqual(['test', 'impl']);
    });
    it('places a unit test after the impl it exercises (after)', () => {
      expect(orderFor('after')).toEqual(['impl', 'test']);
    });
    it('parks tests at the end (end)', () => {
      const order = orderFor('end');
      expect(order.indexOf('test')).toBeGreaterThan(order.indexOf('impl'));
    });
  });

  it('keeps low-signal files and leftovers in the tail', () => {
    const files = [fileDiff('a.ts', 1, 2), fileDiff('gen.lock', 1, 2), fileDiff('gap.ts', 10, 4)];
    const chunks = [
      chunk('a.ts', 'a', ['a'], 1, 2),
      { ...chunk('gen.lock', 'g', [], 1, 2), changeTypes: ['generated' as const] },
      chunk('gap.ts', 'partial', ['p'], 10, 2), // owns 10-11, leaves 12-13 as a leftover
    ];
    const { book, chunks: all } = compileChapterBook(
      { files, chunks, graph: importGraph(), chunkGraph: chunkGraph(), headSha: 'h' },
      TIM_STORY_CONFIG,
    );
    const ids = book.sections.map((s) => s.id);
    expect(ids.at(-1)).toBe('(leftovers)');
    expect(ids).toContain('gen.lock');
    expect(checkCoverage(files, all).ok).toBe(true);
  });

  it('R-050: file-mode and chapter-mode books cover the same chunk set for one range', () => {
    const files = [fileDiff('consumer.ts', 1, 2), fileDiff('dep.ts', 1, 2), fileDiff('dep.test.ts', 1, 2)];
    const chunks = [
      chunk('consumer.ts', 'c1', ['use'], 1, 2),
      chunk('dep.ts', 'c2', ['dep'], 1, 2),
      chunk('dep.test.ts', 't', ['depTest'], 1, 2),
    ];
    const graph = importGraph(['consumer.ts', 'dep.ts'], ['dep.test.ts', 'dep.ts']);
    const fileBook = compileBook({ files, chunks, graph, headSha: 'h' });
    const chapterBook = compileChapterBook(
      { files, chunks, graph, chunkGraph: chunkGraph(cedge('c1', 'c2'), cedge('t', 'c2', 'exercises')), headSha: 'h' },
      TIM_STORY_CONFIG,
    );
    expect(new Set(flat(chapterBook.book))).toEqual(new Set(flat(fileBook.book)));
    expect(bookFingerprint(chapterBook.book)).not.toBe(bookFingerprint(fileBook.book));
  });

  it('a file-mode order overlay never misattaches to a chapter book (fails fresh check)', () => {
    const files = [fileDiff('a.ts', 1, 2), fileDiff('b.ts', 1, 2)];
    const chunks = [chunk('a.ts', 'a', ['a'], 1, 2), chunk('b.ts', 'b', ['b'], 1, 2)];
    const graph = importGraph(['a.ts', 'b.ts']);
    const fileBook = compileBook({ files, chunks, graph, headSha: 'h' });
    const chapterBook = compileChapterBook(
      { files, chunks, graph, chunkGraph: chunkGraph(cedge('a', 'b')), headSha: 'h' },
      TIM_STORY_CONFIG,
    ).book;
    const overlay: OrderOverlay = {
      version: 1,
      bookFingerprint: bookFingerprint(fileBook.book),
      permutation: ['b.ts', 'a.ts'],
      rationales: {},
      model: 'm',
      promptVersion: 'v',
      createdAt: 'now',
    };
    expect(isOverlayFresh(chapterBook, overlay)).toBe(false);
  });

  it('R-001 coverage invariant holds in chapter mode for arbitrary inputs', () => {
    const arbFile = fc.record({
      kind: fc.constantFrom('impl', 'test', 'lowsig'),
      lines: fc.integer({ min: 1, max: 8 }),
      owned: fc.integer({ min: 1, max: 8 }),
    });
    const arbEdge = fc.record({ from: fc.nat(), to: fc.nat(), ex: fc.boolean() });
    const arbConfig: fc.Arbitrary<StoryConfig> = fc.record({
      direction: fc.constantFrom('consumer-first', 'dependency-first'),
      testPlacement: fc.constantFrom('before', 'after', 'end'),
    });

    fc.assert(
      fc.property(fc.array(arbFile, { minLength: 1, maxLength: 6 }), fc.array(arbEdge, { maxLength: 10 }), arbConfig, (specs, edges, config) => {
        const files: FileDiff[] = [];
        const chunks: Chunk[] = [];
        specs.forEach((spec, i) => {
          const path = spec.kind === 'test' ? `f${i}.test.ts` : `f${i}.ts`;
          const start = i * 100 + 1;
          files.push(fileDiff(path, start, spec.lines));
          const owned = Math.min(spec.owned, spec.lines);
          const c = chunk(path, `c${i}`, [`s${i}`], start, owned);
          chunks.push(spec.kind === 'lowsig' ? { ...c, changeTypes: ['generated'] } : c);
        });
        const n = specs.length;
        const cg = chunkGraph(
          ...edges
            .filter((e) => e.from % n !== e.to % n)
            .map((e) => cedge(`c${e.from % n}`, `c${e.to % n}`, e.ex ? 'exercises' : 'calls')),
        );
        const { book, chunks: all } = compileChapterBook({ files, chunks, graph: importGraph(), chunkGraph: cg, headSha: 'h' }, config);

        const occ = flat(book);
        expect(occ.length).toBe(new Set(occ).size); // no duplicate primary occurrences
        expect(new Set(occ)).toEqual(new Set(all.map((c) => c.id))); // every chunk placed exactly once
        expect(checkCoverage(files, all).ok).toBe(true); // every changed line owned exactly once
      }),
      { numRuns: 80 },
    );
  });
});
