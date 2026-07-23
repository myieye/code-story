import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { compileBook } from './book.js';
import { compileChapterBook, validateChapterComposition } from './chapters.js';
import { checkOrder } from './check-order.js';
import { type ChunkEdge, type ChunkEdgeKind, type ChunkGraph } from './chunk-graph.js';
import { checkCoverage } from './coverage.js';
import { type FileDiff } from './diff.js';
import { type ImportGraph } from './import-graph.js';
import { type Book, type Chunk } from './model.js';
import { bookFingerprint, isOverlayFresh, type OrderOverlay } from './order.js';
import { DEFAULT_STORY_CONFIG, type StoryConfig } from './story-config.js';

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

  it('#100 coalesces a file\'s call-silent chunks into one chapter', () => {
    const files = [fileDiff('big.ts', 1, 6)];
    const chunks = [
      chunk('big.ts', 'x1', ['a'], 1, 2),
      chunk('big.ts', 'x2', ['b'], 3, 2),
      chunk('big.ts', 'x3', ['c'], 5, 2),
    ];
    // No calls edges between them — the graph is silent, so they'd fragment into three singletons.
    const { book } = compileChapterBook(
      { files, chunks, graph: importGraph(), chunkGraph: chunkGraph(), headSha: 'h' },
      DEFAULT_STORY_CONFIG,
    );
    const storySections = book.sections.filter((s) => s.id.startsWith('chapter:'));
    expect(storySections).toHaveLength(1);
    expect(flat(book)).toEqual(['x1', 'x2', 'x3']);
  });

  it('#100 preserves cross-file call chapters while coalescing silent same-file siblings', () => {
    const files = [fileDiff('consumer.ts', 1, 2), fileDiff('dep.ts', 1, 2), fileDiff('lib.ts', 1, 4)];
    const chunks = [
      chunk('consumer.ts', 'c1', ['use'], 1, 2),
      chunk('dep.ts', 'd1', ['dep'], 1, 2),
      chunk('lib.ts', 'l1', ['l1'], 1, 2),
      chunk('lib.ts', 'l2', ['l2'], 3, 2),
    ];
    // c1 calls d1 (cross-file); lib.ts has no call edges at all.
    const cg = chunkGraph(cedge('c1', 'd1'));
    const compiled = compileChapterBook(
      { files, chunks, graph: importGraph(), chunkGraph: cg, headSha: 'h' },
      DEFAULT_STORY_CONFIG,
    );
    const storySections = compiled.book.sections.filter((s) => s.id.startsWith('chapter:'));
    // The genuine cross-file chapter (c1→d1) survives, lib.ts's two silent chunks group.
    expect(storySections.map((s) => s.occurrences.map((o) => o.chunkId))).toEqual([['c1', 'd1'], ['l1', 'l2']]);
    expect(checkOrder(compiled.book, importGraph(), compiled.chunks, { config: DEFAULT_STORY_CONFIG, chunkGraph: cg })).toMatchObject({
      ok: true,
      importInversions: [],
      testBeforeImpl: [],
    });
  });

  it('#100 coalescing keeps direction and test-placement gates green both ways', () => {
    const files = [fileDiff('a.ts', 1, 4), fileDiff('b.ts', 1, 2), fileDiff('a.test.ts', 1, 2)];
    const chunks = [
      chunk('a.ts', 'a1', ['a1'], 1, 2), // calls b1 (cross-file)
      chunk('a.ts', 'a2', ['a2'], 3, 2), // silent same-file sibling
      chunk('b.ts', 'b1', ['b1'], 1, 2),
      chunk('a.test.ts', 't', ['aTest'], 1, 2), // exercises a1
    ];
    const cg = chunkGraph(cedge('a1', 'b1'), cedge('t', 'a1', 'exercises'));
    for (const config of [
      { direction: 'consumer-first', testPlacement: 'before' },
      { direction: 'dependency-first', testPlacement: 'after' },
    ] as StoryConfig[]) {
      const compiled = compileChapterBook({ files, chunks, graph: importGraph(), chunkGraph: cg, headSha: 'h' }, config);
      expect(checkOrder(compiled.book, importGraph(), compiled.chunks, { config, chunkGraph: cg })).toMatchObject({
        ok: true,
        importInversions: [],
        testBeforeImpl: [],
      });
    }
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
      DEFAULT_STORY_CONFIG,
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
      DEFAULT_STORY_CONFIG,
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
      DEFAULT_STORY_CONFIG,
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

describe('chapter composition', () => {
  // Cross-file calls (c1→c2, c1→c3), a woven test (t exercises c2), a low-signal file, and a leftover.
  const files = [
    fileDiff('consumer.ts', 1, 2),
    fileDiff('dep.ts', 1, 2),
    fileDiff('helper.ts', 1, 2),
    fileDiff('dep.test.ts', 1, 2),
    fileDiff('gen.lock', 1, 2),
    fileDiff('gap.ts', 10, 4),
  ];
  const chunks: Chunk[] = [
    chunk('consumer.ts', 'c1', ['use'], 1, 2),
    chunk('dep.ts', 'c2', ['dep'], 1, 2),
    chunk('helper.ts', 'c3', ['help'], 1, 2),
    chunk('dep.test.ts', 't', ['depTest'], 1, 2),
    { ...chunk('gen.lock', 'g', [], 1, 2), changeTypes: ['generated' as const] },
    chunk('gap.ts', 'partial', ['p'], 10, 2), // owns 10-11, leaves 12-13 as a leftover
  ];
  const graph = importGraph(['consumer.ts', 'dep.ts'], ['dep.test.ts', 'dep.ts']);
  const cg = chunkGraph(cedge('c1', 'c2'), cedge('c1', 'c3'), cedge('t', 'c2', 'exercises'));
  const input = { files, chunks, graph, chunkGraph: cg, headSha: 'h' };

  it('round-trips: feeding storyComposition back yields a byte-identical book', () => {
    const tier0 = compileChapterBook(input, DEFAULT_STORY_CONFIG);
    const echoed = compileChapterBook(input, DEFAULT_STORY_CONFIG, { chapters: tier0.storyComposition });
    expect(JSON.stringify(echoed.book)).toBe(JSON.stringify(tier0.book));
    expect(echoed.storyComposition).toEqual(tier0.storyComposition);
  });

  it('storyComposition lists only story chunks (tests, low-signal, leftovers excluded)', () => {
    const tier0 = compileChapterBook(input, DEFAULT_STORY_CONFIG);
    expect(new Set(tier0.storyComposition.flat())).toEqual(new Set(['c1', 'c2', 'c3', 'partial']));
  });

  it('an explicit composition drives chapter grouping and re-weaves tests/tail deterministically', () => {
    const composition = { chapters: [['c1', 'c2', 'c3'], ['partial']] };
    const { book } = compileChapterBook(input, DEFAULT_STORY_CONFIG, composition);
    const storySections = book.sections.filter((s) => s.id.startsWith('chapter:'));
    expect(storySections.map((s) => s.id)).toEqual(['chapter:c1', 'chapter:partial']);
    expect(book.sections.map((s) => s.id).at(-1)).toBe('(leftovers)');
  });

  it('throws on an invalid composition (missing / foreign / duplicated / empty)', () => {
    expect(() => compileChapterBook(input, DEFAULT_STORY_CONFIG, { chapters: [['c1', 'c2']] })).toThrow(/missing/);
    expect(() => compileChapterBook(input, DEFAULT_STORY_CONFIG, { chapters: [['c1', 'c2', 'c3', 'partial', 'ghost']] })).toThrow(/not a story chunk/);
  });
});

describe('validateChapterComposition', () => {
  const story = ['a', 'b', 'c'];

  it('accepts an exact partition', () => {
    expect(validateChapterComposition(story, [['a', 'b'], ['c']]).ok).toBe(true);
  });

  it('rejects missing, foreign, duplicated, and empty chapters, naming offenders', () => {
    expect(validateChapterComposition(story, [['a', 'b']])).toMatchObject({ ok: false, errors: [expect.stringContaining('missing')] });
    expect(validateChapterComposition(story, [['a', 'b', 'c', 'z']])).toMatchObject({ ok: false });
    expect(validateChapterComposition(story, [['a', 'a', 'b', 'c']])).toMatchObject({ ok: false });
    expect(validateChapterComposition(story, [['a', 'b', 'c'], []])).toMatchObject({ ok: false, errors: [expect.stringContaining('empty')] });
  });
});
