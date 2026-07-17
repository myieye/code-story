import type { Book, Chunk } from '@code-story/core';
import { describe, expect, it } from 'vitest';
import { flattenBook, type Row } from './rows.js';

function chunk(file: string): Chunk {
  return {
    id: `${file}::x::${file.length}`,
    file,
    symbolPath: ['x'],
    displayPath: ['x'],
    kind: 'other',
    changeTypes: [],
    hunks: [{ baseStart: 0, baseCount: 0, headStart: 1, headCount: 2 }],
    headRange: { start: 1, end: 2 },
  };
}

const chunks = [chunk('a.ts'), chunk('b.ts')];

// One chapter anchored on a.ts, with a cross-file occurrence of b.ts carrying its provenance label.
const chapterBook: Book = {
  headSha: 'deadbeef',
  sections: [
    {
      id: 'chapter:a.ts::x::4',
      title: 'a.ts',
      occurrences: [
        { chunkId: 'a.ts::x::4', ordinal: 0, role: 'primary' },
        { chunkId: 'b.ts::x::4', ordinal: 0, role: 'primary', label: 'b.ts' },
      ],
    },
  ],
};

const isChunk = (r: Row): r is Extract<Row, { kind: 'chunk' }> => r.kind === 'chunk';

describe('flattenBook cross-file labels', () => {
  it('carries the occurrence label onto chapter chunk rows', () => {
    const flat = flattenBook(chapterBook, chunks);
    const chunkRows = flat.rows.filter(isChunk);
    expect(chunkRows.map((r) => r.occurrence.label)).toEqual([undefined, 'b.ts']);
    // The cross-file row's real file differs from the chapter anchor's title — the current-file bar
    // reads `row.chunk.file`, not `row.sectionTitle`.
    const crossFile = chunkRows.find((r) => r.occurrence.label);
    expect(crossFile?.chunk.file).toBe('b.ts');
    expect(crossFile?.sectionTitle).toBe('a.ts');
  });
});
