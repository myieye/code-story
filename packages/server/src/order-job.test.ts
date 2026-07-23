import {
  type Book,
  buildChunkOrderManifest,
  type Chunk,
  type ChunkGraph,
  type CompileChapterBookInput,
  compileChapterBook,
  DEFAULT_STORY_CONFIG,
  type FileDiff,
  type ImportGraph,
  renderChunkOrderManifest,
} from '@code-story/core';
import { describe, expect, test } from 'vitest';
import { MANIFEST_TOKEN_LIMIT, OrderJobError, runChapterOrderJob, runOrderJob, shouldAutoKickOrder } from './order-job.js';

function chunk(file: string, stub = false): Chunk {
  return {
    id: `${file}::x::${file.length}`,
    file,
    symbolPath: ['x'],
    displayPath: ['x'],
    kind: 'other',
    changeTypes: stub ? ['generated'] : [],
    hunks: [{ baseStart: 0, baseCount: 0, headStart: 1, headCount: 3 }],
    headRange: { start: 1, end: 3 },
  };
}

// a.ts ← b.ts ← b.test.ts, p.ts free-floating (periphery), gen.ts all-stub (pinned tail).
const files = ['a.ts', 'b.ts', 'b.test.ts', 'p.ts', 'gen.ts'];
const chunks: Chunk[] = [chunk('a.ts'), chunk('b.ts'), chunk('b.test.ts'), chunk('p.ts'), chunk('gen.ts', true)];
const graph: ImportGraph = {
  edges: [
    { from: 'b.ts', to: 'a.ts' },
    { from: 'b.test.ts', to: 'b.ts' },
  ],
  unresolved: 0,
};
const book: Book = {
  headSha: 'deadbeef',
  sections: files.map((f) => ({ id: f, title: f, occurrences: [{ chunkId: `${f}::x::${f.length}`, ordinal: 0, role: 'primary' }] })),
};

const envelope = (order: string[], rationales: Record<string, string> = {}) =>
  JSON.stringify({ result: JSON.stringify({ order, rationales }) });

const base = { book, graph, chunks, model: 'test-model', cwd: '/tmp' };

describe('runOrderJob', () => {
  test('valid proposal becomes a persisted-ready overlay', async () => {
    const overlay = await runOrderJob({
      ...base,
      invoke: async () => envelope(['p.ts', 'a.ts', 'b.ts', 'b.test.ts'], { 'p.ts': 'warm-up', 'nope.ts': 'dropped' }),
    });
    expect(overlay.permutation).toEqual(['p.ts', 'a.ts', 'b.ts', 'b.test.ts']);
    expect(overlay.rationales).toEqual({ 'p.ts': 'warm-up' });
    expect(overlay.model).toBe('test-model');
    expect(overlay.bookFingerprint).not.toBe('');
  });

  // Retry now lives in the glue scheduler (it re-runs the whole job); runOrderJob is one attempt.
  test('invalid output fails invalid-output', async () => {
    await expect(runOrderJob({ ...base, invoke: async () => envelope(['a.ts']) })).rejects.toMatchObject({
      failure: 'invalid-output',
    });
  });

  test('an order that re-breaks dependencies is invalid output', async () => {
    await expect(
      runOrderJob({ ...base, invoke: async () => envelope(['b.ts', 'a.ts', 'b.test.ts', 'p.ts']) }),
    ).rejects.toMatchObject({ failure: 'invalid-output' });
  });

  test('pinned-tail keys in the permutation are rejected', async () => {
    await expect(
      runOrderJob({ ...base, invoke: async () => envelope(['gen.ts', 'a.ts', 'b.ts', 'b.test.ts', 'p.ts']) }),
    ).rejects.toMatchObject({ failure: 'invalid-output' });
  });

});

describe('shouldAutoKickOrder', () => {
  const base = { enabled: true, hasFreshOverlay: false, jobInFlight: false, fingerprint: 'fp', failedFingerprints: new Set<string>() };

  test('kicks when enabled, no fresh overlay, nothing in flight, not previously failed', () => {
    expect(shouldAutoKickOrder(base)).toBe(true);
  });

  test('disabled opt-out never kicks', () => {
    expect(shouldAutoKickOrder({ ...base, enabled: false })).toBe(false);
  });

  test('a fresh overlay means the work is already done', () => {
    expect(shouldAutoKickOrder({ ...base, hasFreshOverlay: true })).toBe(false);
  });

  test('an in-flight job is not duplicated', () => {
    expect(shouldAutoKickOrder({ ...base, jobInFlight: true })).toBe(false);
  });

  test('a fingerprint that already failed this lifetime is not retried', () => {
    expect(shouldAutoKickOrder({ ...base, failedFingerprints: new Set(['fp']) })).toBe(false);
    expect(shouldAutoKickOrder({ ...base, failedFingerprints: new Set(['other']) })).toBe(true);
  });
});

describe('runOrderJob edge', () => {
  test('too few story sections refuses without invoking the model', async () => {
    const tiny: Book = { headSha: 'deadbeef', sections: book.sections.slice(0, 2) };
    let invoked = false;
    await expect(
      runOrderJob({
        ...base,
        book: tiny,
        chunks: chunks.slice(0, 2),
        invoke: async () => ((invoked = true), envelope(['a.ts', 'b.ts'])),
      }),
    ).rejects.toMatchObject({ failure: 'refused' });
    expect(invoked).toBe(false);
  });
});

// Consumer-first chain: a.ts calls b.ts calls c.ts, all impl, no tests. The tier-0 spine is one
// chapter [a, b, c]; the model may regroup, but consumer-first (caller before callee) still holds.
const cid = (f: string) => `${f}::x::${f.length}`;
const chainChunks: Chunk[] = ['a.ts', 'b.ts', 'c.ts'].map((f) => chunk(f));
const chainFiles: FileDiff[] = ['a.ts', 'b.ts', 'c.ts'].map((path) => ({
  path,
  status: 'modified',
  binary: false,
  hunks: [{ baseStart: 0, baseCount: 0, headStart: 1, headCount: 3 }],
}));
const chainImportGraph: ImportGraph = {
  edges: [
    { from: 'a.ts', to: 'b.ts' },
    { from: 'b.ts', to: 'c.ts' },
  ],
  unresolved: 0,
};
const chainChunkGraph: ChunkGraph = {
  edges: [
    { from: cid('a.ts'), to: cid('b.ts'), kind: 'calls', fromLines: [{ start: 1, end: 1 }], source: 'references' },
    { from: cid('b.ts'), to: cid('c.ts'), kind: 'calls', fromLines: [{ start: 1, end: 1 }], source: 'references' },
  ],
};
const chapterInput: CompileChapterBookInput = {
  files: chainFiles,
  chunks: chainChunks,
  graph: chainImportGraph,
  chunkGraph: chainChunkGraph,
  headSha: 'deadbeef',
};
const chapterTier0 = compileChapterBook(chapterInput, DEFAULT_STORY_CONFIG);
const chapterBase = {
  book: chapterTier0.book,
  chunks: chapterTier0.chunks,
  graph: chainImportGraph,
  model: 'test-model',
  cwd: '/tmp',
  input: chapterInput,
  config: DEFAULT_STORY_CONFIG,
  chunkGraph: chainChunkGraph,
  storyComposition: chapterTier0.storyComposition,
};
const chapterEnvelope = (chapters: string[][], rationales: Record<string, string> = {}) =>
  JSON.stringify({ result: JSON.stringify({ chapters, rationales }) });

describe('runChapterOrderJob (#77)', () => {
  test('an aliased reply becomes a v2 overlay with real ids and chapter: rationale keys', async () => {
    const overlay = await runChapterOrderJob({
      ...chapterBase,
      invoke: async () => chapterEnvelope([['c1'], ['c2', 'c3']], { c1: 'entry point', c2: 'the middle' }),
    });
    expect(overlay.version).toBe(2);
    expect(overlay.chapters).toEqual([[cid('a.ts')], [cid('b.ts'), cid('c.ts')]]);
    expect(overlay.rationales).toEqual({
      [`chapter:${cid('a.ts')}`]: 'entry point',
      [`chapter:${cid('b.ts')}`]: 'the middle',
    });
    expect(overlay.model).toBe('test-model');
    expect(overlay.bookFingerprint).not.toBe('');
  });

  test('a composition missing a chunk fails invalid-output', async () => {
    await expect(
      runChapterOrderJob({ ...chapterBase, invoke: async () => chapterEnvelope([['c1', 'c2']]) }),
    ).rejects.toMatchObject({ failure: 'invalid-output' });
  });

  test('an unknown chunk alias is invalid output', async () => {
    await expect(
      runChapterOrderJob({ ...chapterBase, invoke: async () => chapterEnvelope([['c1', 'c2', 'c9']]) }),
    ).rejects.toMatchObject({ failure: 'invalid-output' });
  });

  test('chapters that re-break the reading direction are invalid output', async () => {
    await expect(
      runChapterOrderJob({ ...chapterBase, invoke: async () => chapterEnvelope([['c3', 'c2', 'c1']]) }),
    ).rejects.toMatchObject({ failure: 'invalid-output' });
  });

  test('too few story chunks refuses without invoking the model', async () => {
    const twoInput: CompileChapterBookInput = {
      ...chapterInput,
      files: chainFiles.slice(0, 2),
      chunks: chainChunks.slice(0, 2),
    };
    const two = compileChapterBook(twoInput, DEFAULT_STORY_CONFIG);
    let invoked = false;
    await expect(
      runChapterOrderJob({
        ...chapterBase,
        book: two.book,
        chunks: two.chunks,
        input: twoInput,
        storyComposition: two.storyComposition,
        invoke: async () => ((invoked = true), chapterEnvelope([['c1', 'c2']])),
      }),
    ).rejects.toMatchObject({ failure: 'refused' });
    expect(invoked).toBe(false);
  });

  function deepPathBook(count: number, segments: number) {
    const files = Array.from({ length: count }, (_, i) => `src/${'segment/'.repeat(segments)}module-${i}.ts`);
    const chunks = files.map((f) => chunk(f));
    const diffs: FileDiff[] = files.map((path) => ({
      path,
      status: 'modified',
      binary: false,
      hunks: [{ baseStart: 0, baseCount: 0, headStart: 1, headCount: 3 }],
    }));
    const noEdges: ChunkGraph = { edges: [] };
    const input: CompileChapterBookInput = {
      files: diffs,
      chunks,
      graph: { edges: [], unresolved: 0 },
      chunkGraph: noEdges,
      headSha: 'deadbeef',
    };
    const tier0 = compileChapterBook(input, DEFAULT_STORY_CONFIG);
    const manifest = buildChunkOrderManifest(tier0.book, tier0.chunks, noEdges, tier0.storyComposition);
    return { tier0, manifest, input, noEdges };
  }

  // Regression for the review's finding #1: the size guard must measure the aliased text the model
  // receives, not the raw-id rendering. Long ids blow past the limit raw but fit once aliased.
  test('the size guard measures the aliased prompt, not the raw ids', async () => {
    const { tier0, manifest, input, noEdges } = deepPathBook(200, 40);
    // Precondition: the raw-id render trips the guard; the aliased render does not.
    expect(Math.ceil(renderChunkOrderManifest(manifest).length / 4)).toBeGreaterThan(MANIFEST_TOKEN_LIMIT);

    const composition = tier0.storyComposition.flat().map((_, i) => [`c${i + 1}`]);
    let invoked = false;
    const overlay = await runChapterOrderJob({
      ...chapterBase,
      book: tier0.book,
      chunks: tier0.chunks,
      graph: input.graph,
      input,
      chunkGraph: noEdges,
      storyComposition: tier0.storyComposition,
      invoke: async () => ((invoked = true), chapterEnvelope(composition)),
    });
    expect(invoked).toBe(true);
    expect(overlay.version).toBe(2);
  });

  // A truly huge range still refuses (#116): the raised limit widens what runs, it doesn't remove
  // the guard — an over-limit aliased prompt costs real money for a book that reads fine in tier-0.
  test('an aliased prompt over the limit refuses without invoking the model', async () => {
    const { tier0, input, noEdges } = deepPathBook(300, 50);
    let invoked = false;
    await expect(
      runChapterOrderJob({
        ...chapterBase,
        book: tier0.book,
        chunks: tier0.chunks,
        graph: input.graph,
        input,
        chunkGraph: noEdges,
        storyComposition: tier0.storyComposition,
        invoke: async () => ((invoked = true), chapterEnvelope([['c1']])),
      }),
    ).rejects.toMatchObject({ failure: 'refused' });
    expect(invoked).toBe(false);
  });
});
