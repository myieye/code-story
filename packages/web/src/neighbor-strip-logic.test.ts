import { assembleChunkGraph, type Chunk, type ChunkEdge, type ChunkEdgeKind, type ChunkReviewState } from '@code-story/core';
import { describe, expect, it } from 'vitest';
import { chipAriaLabel, chipText, computeNeighborChips, type NeighborChip } from './neighbor-strip-logic.js';

function chunk(id: string, file: string, title: string): Chunk {
  return { id, file, symbolPath: [title], displayPath: [title], kind: 'other', changeTypes: [], hunks: [] };
}

function edge(from: string, to: string, kind: ChunkEdgeKind, line?: number): ChunkEdge {
  return { from, to, kind, source: 'references', fromLines: line !== undefined ? [{ start: line, end: line }] : [] };
}

const chunks = [
  chunk('a', 'src/a.ts', 'aFn'),
  chunk('b', 'src/b.ts', 'bFn'),
  chunk('c', 'src/c.ts', 'cFn'),
  chunk('d', 'src/d.ts', 'dFn'),
  chunk('z', 'src/z.ts', 'zFn'),
  chunk('t', 'test/a.test.ts', 'aSpec'),
  chunk('f', 'src/util/helper.ts', 'helperFn'),
];
const chunksById = new Map(chunks.map((c) => [c.id, c]));
const inBook = (id: string) => chunksById.has(id);

const graph = assembleChunkGraph('H', [
  edge('a', 'b', 'calls', 10),
  edge('a', 'c', 'calls', 20),
  edge('b', 'd', 'calls', 5), // one step behind b
  edge('z', 'a', 'calls', 88), // incoming
  edge('t', 'a', 'exercises'), // incoming test
  edge('a', 'f', 'file-imports'), // file-level
  edge('a', 'ghost', 'calls', 30), // endpoint not in the book — must be filtered out
]);

// b is reviewed; everything else is unseen (i.e. not reviewed).
const stateOf = (id: string): ChunkReviewState => (id === 'b' ? 'reviewed' : 'unseen');

function chip(chips: NeighborChip[], chunkId: string): NeighborChip {
  const found = chips.find((c) => c.chunkId === chunkId);
  if (!found) throw new Error(`no chip for ${chunkId}`);
  return found;
}

describe('computeNeighborChips', () => {
  const chips = computeNeighborChips(graph, 'a', chunksById, stateOf, inBook);

  it('drops neighbors that resolve to no book chunk', () => {
    expect(chips.some((c) => c.chunkId === 'ghost')).toBe(false);
  });

  it('marks a reviewed neighbor as a re-encounter (state reviewed)', () => {
    expect(chip(chips, 'b').state).toBe('reviewed');
    expect(chip(chips, 'c').state).toBe('unreviewed');
  });

  it('carries the call-site line for outgoing calls only', () => {
    expect(chip(chips, 'b')).toMatchObject({ relation: 'calls', direction: 'out', line: 10 });
    expect(chip(chips, 'z')).toMatchObject({ relation: 'called by', direction: 'in' });
    expect(chip(chips, 'z').line).toBeUndefined();
  });

  it('counts further unreviewed chunks reachable behind a neighbor (the +N hint)', () => {
    // Behind b along calls-out is d (unreviewed) → 1; c calls nothing → 0.
    expect(chip(chips, 'b').behind).toBe(1);
    expect(chip(chips, 'c').behind).toBe(0);
  });

  it('excludes the focused chunk from a neighbor\'s behind count (no cycle double-count)', () => {
    // z calls a, but a is the focus — z's incoming reach must not count a back in.
    expect(chip(chips, 'z').behind).toBe(0);
  });

  it('labels a file-imports edge file-level with the file basename', () => {
    const f = chip(chips, 'f');
    expect(f).toMatchObject({ fileLevel: true, relation: 'imports from', name: 'helper.ts' });
  });

  it('renders exercises incoming as "exercised by"', () => {
    expect(chip(chips, 't')).toMatchObject({ relation: 'exercised by', direction: 'in' });
  });

  it('is empty for a chunk with no neighbors', () => {
    expect(computeNeighborChips(graph, 'd', chunksById, stateOf, inBook).map((c) => c.chunkId)).toEqual(['b']);
    expect(computeNeighborChips({ edges: [] }, 'a', chunksById, stateOf, inBook)).toEqual([]);
  });
});

describe('chip text + aria', () => {
  const chips = computeNeighborChips(graph, 'a', chunksById, stateOf, inBook);
  it('renders visible text with arrow, relation, name, and line', () => {
    expect(chipText(chip(chips, 'b'))).toBe('→ calls bFn (L10)');
    expect(chipText(chip(chips, 'z'))).toBe('← called by zFn');
  });
  it('spells out the accessible name including state and behind', () => {
    expect(chipAriaLabel(chip(chips, 'b'))).toBe('calls bFn, at line 10, reviewed, 1 more unreviewed behind');
    expect(chipAriaLabel(chip(chips, 'f'))).toBe('imports from helper.ts, (file-level), unreviewed');
  });
});
