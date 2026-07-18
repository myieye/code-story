import { describe, expect, it } from 'vitest';
import {
  assembleChunkGraph,
  CALLS_DFS_KINDS,
  type ChunkEdge,
  type ChunkEdgeKind,
  chunkGraphFingerprint,
  coalesce,
  edgesOfKinds,
  fileImportEdges,
  filterFreshGraph,
  neighborsOf,
  sectionAnchors,
} from './chunk-graph.js';
import { testImplAnchors } from './book.js';
import { type Book, CHAPTER_SECTION_PREFIX, isFileModeBook, LEFTOVERS_SECTION_ID } from './model.js';

function edge(from: string, to: string, kind: ChunkEdgeKind, source: ChunkEdge['source'] = 'references', fromLines: ChunkEdge['fromLines'] = []): ChunkEdge {
  return { from, to, kind, source, fromLines };
}

describe('edgesOfKinds', () => {
  it('filters to the requested kinds', () => {
    const edges = [edge('a', 'b', 'calls'), edge('c', 'd', 'file-imports'), edge('e', 'f', 'exercises')];
    expect(edgesOfKinds(edges, new Set(['file-imports'])).map((e) => e.to)).toEqual(['d']);
  });

  it('passes an unknown future kind through unchanged (no exhaustive switch, R-050)', () => {
    // A kind added later ('data-flow') is not in today's union; a cast stands in for the future edge.
    const future = { ...edge('a', 'b', 'calls'), kind: 'data-flow' as unknown as ChunkEdgeKind };
    const edges = [future, edge('c', 'd', 'calls')];
    const selected = edgesOfKinds(edges, new Set(['data-flow'] as unknown as ChunkEdgeKind[]));
    expect(selected).toEqual([future]);
  });

  it('CALLS_DFS_KINDS admits calls but never exercises', () => {
    const edges = [edge('a', 'b', 'calls'), edge('t', 'b', 'exercises'), edge('a', 'c', 'file-imports')];
    expect(edgesOfKinds(edges, CALLS_DFS_KINDS).map((e) => e.kind)).toEqual(['calls']);
  });
});

describe('chunkGraphFingerprint / filterFreshGraph', () => {
  it('keeps a graph whose fingerprint matches the head', () => {
    const built = assembleChunkGraph('HEAD1', [edge('a', 'b', 'calls')]);
    expect(filterFreshGraph('HEAD1', built)?.edges).toHaveLength(1);
  });

  it('drops a graph fingerprinted for a different head (fail-open to no-graph)', () => {
    const built = assembleChunkGraph('HEAD1', [edge('a', 'b', 'calls')]);
    expect(filterFreshGraph('HEAD2', built)).toBeNull();
  });

  it('drops a malformed / wrong-version / absent store', () => {
    expect(filterFreshGraph('HEAD1', null)).toBeNull();
    expect(filterFreshGraph('HEAD1', undefined)).toBeNull();
    expect(filterFreshGraph('HEAD1', { version: 2 } as never)).toBeNull();
    expect(filterFreshGraph('HEAD1', { version: 1, fingerprint: chunkGraphFingerprint('HEAD1'), edges: 'x' } as never)).toBeNull();
  });
});

describe('assembleChunkGraph', () => {
  it('dedupes by (from, to, kind), unions fromLines, and keeps the highest-precedence source', () => {
    const built = assembleChunkGraph('H', [
      edge('t', 'i', 'exercises', 'test-anchor', []),
      edge('t', 'i', 'exercises', 'references', [{ start: 5, end: 5 }]),
      edge('t', 'i', 'exercises', 'references', [{ start: 6, end: 6 }]),
    ]);
    expect(built.edges).toHaveLength(1);
    expect(built.edges[0]!.source).toBe('references');
    expect(built.edges[0]!.fromLines).toEqual([{ start: 5, end: 6 }]);
  });

  it('keeps different kinds between the same chunks as separate layered edges', () => {
    const built = assembleChunkGraph('H', [edge('a', 'b', 'calls'), edge('a', 'b', 'file-imports')]);
    expect(built.edges.map((e) => e.kind).sort()).toEqual(['calls', 'file-imports']);
  });

  it('drops self-edges', () => {
    expect(assembleChunkGraph('H', [edge('a', 'a', 'calls')]).edges).toHaveLength(0);
  });
});

describe('neighborsOf', () => {
  const graph = assembleChunkGraph('H', [
    edge('a', 'b', 'calls', 'references', [{ start: 10, end: 10 }]),
    edge('a', 'c', 'file-imports', 'import-graph', []),
    edge('t', 'a', 'exercises', 'references', [{ start: 4, end: 4 }]),
    edge('z', 'a', 'calls', 'references', [{ start: 88, end: 88 }]),
  ]);

  it('returns direct neighbors with direction and outgoing provenance', () => {
    const n = neighborsOf(graph, 'a');
    expect(n).toEqual([
      { chunkId: 'b', kind: 'calls', direction: 'out', fromLines: [{ start: 10, end: 10 }] },
      { chunkId: 'c', kind: 'file-imports', direction: 'out', fromLines: [] },
      { chunkId: 't', kind: 'exercises', direction: 'in', fromLines: [] },
      { chunkId: 'z', kind: 'calls', direction: 'in', fromLines: [] },
    ]);
  });

  it('drops the incoming edge\'s fromLines (they belong to the neighbor, not this chunk)', () => {
    // z calls a at L88, but from a's side that line lives in z — not surfaced on a's incoming chip.
    expect(neighborsOf(graph, 'a').find((x) => x.chunkId === 'z')?.fromLines).toEqual([]);
  });

  it('is empty for a chunk with no edges', () => {
    expect(neighborsOf(graph, 'nobody')).toEqual([]);
  });

  it('reports outgoing provenance from the caller side only', () => {
    // From b's view, the a→b calls edge is incoming: no lines.
    expect(neighborsOf(graph, 'b')).toEqual([{ chunkId: 'a', kind: 'calls', direction: 'in', fromLines: [] }]);
  });
});

describe('coalesce', () => {
  it('merges overlapping and adjacent ranges', () => {
    expect(coalesce([{ start: 3, end: 4 }, { start: 1, end: 2 }, { start: 4, end: 6 }])).toEqual([{ start: 1, end: 6 }]);
  });
  it('leaves a gap between non-adjacent ranges', () => {
    expect(coalesce([{ start: 1, end: 1 }, { start: 5, end: 5 }])).toEqual([{ start: 1, end: 1 }, { start: 5, end: 5 }]);
  });
});

describe('sectionAnchors / fileImportEdges', () => {
  const book: Book = {
    headSha: 'H',
    sections: [
      { id: 'a.ts', title: 'a.ts', occurrences: [{ chunkId: 'a#1', ordinal: 0, role: 'primary' }, { chunkId: 'a#2', ordinal: 0, role: 'primary' }] },
      { id: 'b.ts', title: 'b.ts', occurrences: [{ chunkId: 'b#1', ordinal: 0, role: 'primary' }] },
      { id: LEFTOVERS_SECTION_ID, title: 'Leftovers', occurrences: [{ chunkId: 'x#1', ordinal: 0, role: 'primary' }] },
    ],
  };

  it('maps each non-leftover file to its first occurrence chunk', () => {
    const anchors = sectionAnchors(book);
    expect(anchors.get('a.ts')).toBe('a#1');
    expect(anchors.get('b.ts')).toBe('b#1');
    expect(anchors.has(LEFTOVERS_SECTION_ID)).toBe(false);
  });

  it('emits file-imports edges at anchor chunks, dropping endpoints without an anchor', () => {
    const graph = { edges: [{ from: 'a.ts', to: 'b.ts' }, { from: 'a.ts', to: 'gone.ts' }], unresolved: 0 };
    const edges = fileImportEdges(graph, sectionAnchors(book));
    expect(edges).toEqual([{ from: 'a#1', to: 'b#1', kind: 'file-imports', fromLines: [], source: 'import-graph' }]);
  });

  it('rejects a chapter-mode book rather than silently returning empty anchors', () => {
    const chapterBook: Book = {
      headSha: 'H',
      sections: [{ id: `${CHAPTER_SECTION_PREFIX}a#1`, title: 'a.ts', occurrences: [{ chunkId: 'a#1', ordinal: 0, role: 'primary' }] }],
    };
    expect(isFileModeBook(book)).toBe(true);
    expect(isFileModeBook(chapterBook)).toBe(false);
    expect(() => sectionAnchors(chapterBook)).toThrow(/file-mode/);
    expect(() => testImplAnchors([`${CHAPTER_SECTION_PREFIX}a#1`], [], { edges: [], unresolved: 0 })).toThrow(/file paths/);
  });
});
