import { type Chunk, compileBook, type FileContents, type FileDiff, type ImportGraph } from '@code-story/core';
import { describe, expect, it } from 'vitest';
import { buildChunkGraph } from './chunk-graph-build.js';

/** A chunk owning one hunk over head lines [start,end] (base lines when `deleted`). */
function chunk(id: string, file: string, start: number, end: number, symbolPath: string[] = [], deleted = false): Chunk {
  const hunk = deleted
    ? { baseStart: start, baseCount: end - start + 1, headStart: 0, headCount: 0 }
    : { baseStart: start, baseCount: 0, headStart: start, headCount: end - start + 1 };
  return {
    id,
    file,
    symbolPath,
    displayPath: symbolPath,
    ...(deleted ? { baseRange: { start, end } } : { headRange: { start, end } }),
    kind: 'method',
    changeTypes: [],
    hunks: [hunk],
  };
}

function fileDiff(path: string, chunks: Chunk[], status: FileDiff['status'] = 'modified'): FileDiff {
  return { path, status, binary: false, hunks: chunks.flatMap((c) => c.hunks) };
}

interface Fixture {
  files: FileDiff[];
  chunks: Chunk[];
  contents: Map<string, FileContents>;
  graph: ImportGraph;
}

async function build(f: Fixture) {
  const compiled = compileBook({ files: f.files, chunks: f.chunks, graph: f.graph, headSha: 'H' });
  const cg = await buildChunkGraph({
    chunks: compiled.chunks,
    contents: f.contents,
    graph: f.graph,
    book: compiled.book,
    files: f.files,
    headSha: 'H',
  });
  return cg;
}

describe('buildChunkGraph', () => {
  it('resolves a call into another changed file as a calls edge with caller-side fromLines', async () => {
    const consumer = 'import { slugify } from \'./helper\';\nexport function route(name) {\n  return slugify(name);\n}\n';
    const helper = 'export function slugify(s) {\n  return s.toLowerCase();\n}\n';
    const consumerChunk = chunk('consumer', 'consumer.ts', 2, 4, ['route']);
    const helperChunk = chunk('helper', 'helper.ts', 1, 3, ['slugify']);
    const cg = await build({
      files: [fileDiff('consumer.ts', [consumerChunk]), fileDiff('helper.ts', [helperChunk])],
      chunks: [consumerChunk, helperChunk],
      contents: new Map([
        ['consumer.ts', { head: consumer.split('\n') }],
        ['helper.ts', { head: helper.split('\n') }],
      ]),
      graph: { edges: [{ from: 'consumer.ts', to: 'helper.ts' }], unresolved: 0 },
    });

    const call = cg.edges.find((e) => e.kind === 'calls');
    expect(call).toMatchObject({ from: 'consumer', to: 'helper', source: 'references' });
    expect(call!.fromLines).toEqual([{ start: 3, end: 3 }]);
    // The file-level import edge is kept as its own layer at the anchor chunks.
    expect(cg.edges.some((e) => e.kind === 'file-imports' && e.from === 'consumer' && e.to === 'helper')).toBe(true);
  });

  it('emits no edge for a lone cross-file match with no import edge to justify it (#91)', async () => {
    const consumer = 'export function route(name) {\n  return slugify(name);\n}\n';
    const helper = 'export function slugify(s) {\n  return s.toLowerCase();\n}\n';
    const consumerChunk = chunk('consumer', 'consumer.ts', 1, 3, ['route']);
    const helperChunk = chunk('helper', 'helper.ts', 1, 3, ['slugify']);
    const cg = await build({
      files: [fileDiff('consumer.ts', [consumerChunk]), fileDiff('helper.ts', [helperChunk])],
      chunks: [consumerChunk, helperChunk],
      contents: new Map([
        ['consumer.ts', { head: consumer.split('\n') }],
        ['helper.ts', { head: helper.split('\n') }],
      ]),
      graph: { edges: [], unresolved: 0 },
    });
    expect(cg.edges.filter((e) => e.source === 'references')).toEqual([]);
  });

  it('emits no edge when a called name is defined in two changed files with no disambiguating import', async () => {
    const consumer = 'export function run() {\n  return build();\n}\n';
    const consumerChunk = chunk('c', 'consumer.ts', 1, 3, ['run']);
    const aChunk = chunk('a', 'a.ts', 1, 1, ['build']);
    const bChunk = chunk('b', 'b.ts', 1, 1, ['build']);
    const cg = await build({
      files: [fileDiff('consumer.ts', [consumerChunk]), fileDiff('a.ts', [aChunk]), fileDiff('b.ts', [bChunk])],
      chunks: [consumerChunk, aChunk, bChunk],
      contents: new Map([
        ['consumer.ts', { head: consumer.split('\n') }],
        ['a.ts', { head: 'export function build() { return 1; }\n'.split('\n') }],
        ['b.ts', { head: 'export function build() { return 2; }\n'.split('\n') }],
      ]),
      graph: { edges: [], unresolved: 0 },
    });
    expect(cg.edges.filter((e) => e.kind === 'calls')).toHaveLength(0);
  });

  it('classifies a test file\'s call into its impl as exercises (never calls)', async () => {
    const spec = 'import { doWork } from \'./svc\';\ndoWork();\n';
    const svc = 'export function doWork() {\n  return 1;\n}\n';
    const specChunk = chunk('spec', 'svc.spec.ts', 2, 2);
    const svcChunk = chunk('svc', 'svc.ts', 1, 3, ['doWork']);
    const cg = await build({
      files: [fileDiff('svc.ts', [svcChunk]), fileDiff('svc.spec.ts', [specChunk])],
      chunks: [svcChunk, specChunk],
      contents: new Map([
        ['svc.spec.ts', { head: spec.split('\n') }],
        ['svc.ts', { head: svc.split('\n') }],
      ]),
      graph: { edges: [{ from: 'svc.spec.ts', to: 'svc.ts' }], unresolved: 0 },
    });
    expect(cg.edges.some((e) => e.kind === 'calls')).toBe(false);
    // The references edge and the file-level test-anchor edge coincide; references wins precedence.
    const ex = cg.edges.filter((e) => e.kind === 'exercises');
    expect(ex).toHaveLength(1);
    expect(ex[0]).toMatchObject({ from: 'spec', to: 'svc', source: 'references' });
    expect(ex[0]!.fromLines).toEqual([{ start: 2, end: 2 }]);
  });

  it('reads a deleted file on the base side for both the call site and its ranges', async () => {
    const deleted = 'import { gone } from \'./helper\';\nexport function old() { return gone(); }\n';
    const helper = 'export function gone() {\n  return 1;\n}\n';
    const delChunk = chunk('del', 'deleted.ts', 2, 2, ['old'], true);
    const helperChunk = chunk('h', 'helper.ts', 1, 3, ['gone']);
    const cg = await build({
      files: [fileDiff('deleted.ts', [delChunk], 'deleted'), fileDiff('helper.ts', [helperChunk])],
      chunks: [delChunk, helperChunk],
      contents: new Map([
        ['deleted.ts', { base: deleted.split('\n') }],
        ['helper.ts', { head: helper.split('\n') }],
      ]),
      graph: { edges: [{ from: 'deleted.ts', to: 'helper.ts' }], unresolved: 0 },
    });
    const call = cg.edges.find((e) => e.kind === 'calls');
    expect(call).toMatchObject({ from: 'del', to: 'h' });
    expect(call!.fromLines).toEqual([{ start: 2, end: 2 }]);
  });

  it('emits a file-level test-anchor exercises edge even with no resolvable call', async () => {
    const test = 'import { foo } from \'./foo\';\nconst setup = 1;\n';
    const foo = 'export function foo() {}\n';
    const testChunk = chunk('t', 'foo.test.ts', 2, 2);
    const fooChunk = chunk('f', 'foo.ts', 1, 1, ['foo']);
    const cg = await build({
      files: [fileDiff('foo.ts', [fooChunk]), fileDiff('foo.test.ts', [testChunk])],
      chunks: [fooChunk, testChunk],
      contents: new Map([
        ['foo.test.ts', { head: test.split('\n') }],
        ['foo.ts', { head: foo.split('\n') }],
      ]),
      graph: { edges: [{ from: 'foo.test.ts', to: 'foo.ts' }], unresolved: 0 },
    });
    expect(cg.edges.some((e) => e.kind === 'calls')).toBe(false);
    const ex = cg.edges.filter((e) => e.kind === 'exercises');
    expect(ex).toEqual([{ from: 't', to: 'f', kind: 'exercises', fromLines: [], source: 'test-anchor' }]);
  });
});
