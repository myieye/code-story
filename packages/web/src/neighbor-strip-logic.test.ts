import { assembleChunkGraph, type Chunk, type ChunkEdge, type ChunkEdgeKind } from '@code-story/core';
import { describe, expect, it } from 'vitest';
import { chipAriaLabel, chipText, computeNeighborChips, type NeighborChip } from './neighbor-strip-logic.js';
import type { GlyphState } from './review-glyph-logic.js';

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
const reviewOf = (id: string): GlyphState => ({ state: id === 'b' ? 'reviewed' : 'unseen' });

function chip(chips: NeighborChip[], chunkId: string): NeighborChip {
  const found = chips.find((c) => c.chunkId === chunkId);
  if (!found) throw new Error(`no chip for ${chunkId}`);
  return found;
}

describe('computeNeighborChips', () => {
  const chips = computeNeighborChips(graph, 'a', chunksById, reviewOf, inBook);

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

  it('uses the file basename, not a bare line range, for a symbol-less fragment chunk (#108)', () => {
    const frag: Chunk = { id: 'frag', file: 'test/QueryHelpers.cs', symbolPath: [], displayPath: [], kind: 'other', changeTypes: [], hunks: [], headRange: { start: 1, end: 6 } };
    const byId = new Map([...chunksById, ['frag', frag]]);
    const g = assembleChunkGraph('H', [edge('a', 'frag', 'calls', 12)]);
    const c = chip(computeNeighborChips(g, 'a', byId, reviewOf, (id) => byId.has(id)), 'frag');
    expect(c.name).toBe('QueryHelpers.cs');
    expect(c.name).not.toMatch(/lines/);
  });

  it('is empty for a chunk with no neighbors', () => {
    expect(computeNeighborChips(graph, 'd', chunksById, reviewOf, inBook).map((c) => c.chunkId)).toEqual(['b']);
    expect(computeNeighborChips({ edges: [] }, 'a', chunksById, reviewOf, inBook)).toEqual([]);
  });
});

describe('chip text + aria', () => {
  const chips = computeNeighborChips(graph, 'a', chunksById, reviewOf, inBook);
  it('renders visible text with arrow, relation, and name (no raw line number)', () => {
    expect(chipText(chip(chips, 'b'))).toBe('→ calls bFn');
    expect(chipText(chip(chips, 'z'))).toBe('← called by zFn');
  });
  it('spells out the accessible name including state, boundary, and behind', () => {
    // Focus 'a' is unreviewed, 'b' reviewed → the calls edge is a review boundary.
    expect(chipAriaLabel(chip(chips, 'b'))).toBe('calls bFn, reviewed, review boundary, 1 more unreviewed reachable past here');
    expect(chipAriaLabel(chip(chips, 'f'))).toBe('imports from helper.ts, (file-level), unseen');
  });
});

describe('review-state glyph (shared outline vocabulary)', () => {
  // b reviewed, c seen, z auto-read (seen + evidence flag), everything else unseen.
  const withStates = (id: string): GlyphState => {
    if (id === 'b') return { state: 'reviewed' };
    if (id === 'c') return { state: 'seen' };
    if (id === 'z') return { state: 'seen', autoRead: true };
    return { state: 'unseen' };
  };
  const chips = computeNeighborChips(graph, 'a', chunksById, withStates, inBook);

  it('carries the target chunk glyph + class for each state, incl. auto-read → ◑', () => {
    expect(chip(chips, 'b')).toMatchObject({ glyph: '✓', glyphClass: 'reviewed' });
    expect(chip(chips, 'c')).toMatchObject({ glyph: '•', glyphClass: 'seen' });
    expect(chip(chips, 'z')).toMatchObject({ glyph: '◑', glyphClass: 'auto' });
    expect(chip(chips, 't')).toMatchObject({ glyph: '○', glyphClass: 'unseen' });
  });

  it('voices the precise state, including auto-read', () => {
    expect(chipAriaLabel(chip(chips, 'c'))).toBe('calls cFn, seen');
    expect(chipAriaLabel(chip(chips, 'z'))).toBe('called by zFn, auto-read, not yet confirmed');
  });

  it('a reveal chip has no glyph (no meaningful target review-state)', () => {
    const g = assembleChunkGraph('H', [{ from: 't', to: 'a', kind: 'exercises', source: 'test-anchor', fromLines: [] }]);
    const c = chip(computeNeighborChips(g, 't', chunksById, reviewOf, inBook), 'a');
    expect(c.glyph).toBe('');
    expect(c.glyphClass).toBe('');
  });
});

describe('created (new-code) flag', () => {
  it('flags a neighbor whose every hunk is a pure insertion, and voices it', () => {
    const fresh: Chunk = {
      id: 'n', file: 'src/n.ts', symbolPath: ['newFn'], displayPath: ['newFn'], kind: 'other',
      changeTypes: [], hunks: [{ baseStart: 0, baseCount: 0, headStart: 1, headCount: 4 }],
    };
    const byId = new Map([...chunksById, ['n', fresh]]);
    const g = assembleChunkGraph('H', [edge('a', 'n', 'calls', 3)]);
    const c = chip(computeNeighborChips(g, 'a', byId, reviewOf, (id) => byId.has(id)), 'n');
    expect(c.created).toBe(true);
    expect(chipAriaLabel(c)).toBe('calls newFn, newly added in this diff, unseen');
  });

  it('does not flag a neighbor that also deletes lines (changed, not created)', () => {
    // Every existing fixture chunk has no hunks → created stays false.
    expect(chip(computeNeighborChips(graph, 'a', chunksById, reviewOf, inBook), 'b').created).toBe(false);
  });
});

describe('file-level exercises (test-anchor) chip', () => {
  // A test→impl anchor edge: no method/line, its `to` is just the impl file's anchor chunk. Following
  // it should reveal the exercised code inline, not jump to that anchor.
  const g = assembleChunkGraph('H', [{ from: 't', to: 'a', kind: 'exercises', source: 'test-anchor', fromLines: [] }]);
  const c = chip(computeNeighborChips(g, 't', chunksById, reviewOf, inBook), 'a');

  it('is a reveal chip, file-level, with no behind/frontier hints', () => {
    expect(c.action).toBe('reveal');
    expect(c.fileLevel).toBe(true);
    expect(c.behind).toBe(0);
    expect(c.frontier).toBe(false);
  });

  it('accessible name says what it does, not a (meaningless) target review state', () => {
    expect(chipAriaLabel(c)).toBe('exercises a.ts, (file-level), shows the exercised code');
  });

  it('leaves a references-sourced exercises edge a jump chip', () => {
    expect(chip(computeNeighborChips(graph, 'a', chunksById, reviewOf, inBook), 't').action).toBe('jump');
  });
});

describe('frontier chips', () => {
  const chips = computeNeighborChips(graph, 'a', chunksById, reviewOf, inBook);

  it('flags an interaction edge whose endpoints differ in reviewed-state', () => {
    // Focus 'a' unreviewed, 'b' reviewed, calls edge → boundary.
    expect(chip(chips, 'b').frontier).toBe(true);
  });

  it('does not flag an interaction edge whose endpoints share reviewed-state', () => {
    // Both 'a' and 'c' unreviewed.
    expect(chip(chips, 'c').frontier).toBe(false);
    expect(chip(chips, 't').frontier).toBe(false);
  });

  it('never flags a file-imports edge, even across a state split', () => {
    expect(chip(chips, 'f').frontier).toBe(false);
  });

  it('flags the reverse split too — focused reviewed, neighbor unreviewed', () => {
    // Focus on 'b' (reviewed); its calls-out neighbor 'd' is unreviewed → boundary.
    const fromB = computeNeighborChips(graph, 'b', chunksById, reviewOf, inBook);
    expect(chip(fromB, 'd').frontier).toBe(true);
    expect(chip(fromB, 'a').frontier).toBe(true); // a→b incoming, a unreviewed vs b reviewed
  });
});
