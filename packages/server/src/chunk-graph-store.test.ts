import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assembleChunkGraph } from '@code-story/core';
import { afterAll, describe, expect, it } from 'vitest';
import { chunkGraphFilePath, loadChunkGraph, saveJson } from './chunk-graph-store.js';

const range = { base: 'a'.repeat(40), head: 'b'.repeat(40) };
const dir = await mkdtemp(path.join(tmpdir(), 'code-story-graph-'));
afterAll(() => rm(dir, { recursive: true, force: true }));

describe('chunk graph store', () => {
  it('round-trips a graph and names the file beside the other overlays', async () => {
    const file = chunkGraphFilePath(dir, 'repo-x', range);
    expect(file).toContain(path.join('repo-x', 'reviews'));
    expect(file).toContain(`${'a'.repeat(12)}..${'b'.repeat(12)}.graph.json`);

    const built = assembleChunkGraph('HEAD', [{ from: 'a', to: 'b', kind: 'calls', fromLines: [{ start: 1, end: 1 }], source: 'references' }]);
    await saveJson(file, built);
    expect(await loadChunkGraph(file)).toEqual(built);
  });

  it('fails open to null on missing, corrupt, or wrong-version files', async () => {
    expect(await loadChunkGraph(path.join(dir, 'nope.json'))).toBeNull();

    const corrupt = path.join(dir, 'corrupt.json');
    await writeFile(corrupt, '{ not json');
    expect(await loadChunkGraph(corrupt)).toBeNull();

    const wrongVersion = path.join(dir, 'v2.json');
    await writeFile(wrongVersion, JSON.stringify({ version: 2, edges: [] }));
    expect(await loadChunkGraph(wrongVersion)).toBeNull();
  });
});
