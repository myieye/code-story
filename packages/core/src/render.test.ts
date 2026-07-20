import { describe, expect, it } from 'vitest';
import { chunkFile } from './chunker.js';
import { type FileDiff } from './diff.js';
import { type Chunk } from './model.js';
import { unifiedChunkLines } from './render.js';

const head = Array.from({ length: 30 }, (_, i) => `head ${i + 1}`);
const base = Array.from({ length: 30 }, (_, i) => `base ${i + 1}`);

function chunkOf(hunks: FileDiff['hunks'], status: FileDiff['status'] = 'modified') {
  const diff: FileDiff = { path: 'a.ts', status, binary: false, hunks };
  const primary = status === 'deleted' ? base : head;
  return chunkFile({ diff, lines: primary, baseLines: base })[0]!;
}

describe('unifiedChunkLines', () => {
  it('renders del, add, and merged context with a gap between distant hunks', () => {
    const chunk = chunkOf([
      { baseStart: 5, baseCount: 1, headStart: 5, headCount: 2 },
      { baseStart: 20, baseCount: 0, headStart: 20, headCount: 1 },
    ]);
    const lines = unifiedChunkLines(chunk, { head, base });

    expect(lines.map((l) => `${l.type}:${l.head ?? l.base ?? ''}`)).toEqual([
      'context:2', 'context:3', 'context:4',
      'del:5',
      'add:5', 'add:6',
      'context:7', 'context:8', 'context:9',
      'gap:',
      'context:17', 'context:18', 'context:19',
      'add:20',
      'context:21', 'context:22', 'context:23',
    ]);
    expect(lines.find((l) => l.type === 'del')!.text).toBe('base 5');
    expect(lines.find((l) => l.type === 'add')!.text).toBe('head 5');
  });

  it('renders deleted files from the base side and clamps context at file edges', () => {
    const chunk = chunkOf([{ baseStart: 1, baseCount: 2, headStart: 0, headCount: 0 }], 'deleted');
    const lines = unifiedChunkLines(chunk, { base });

    expect(lines.map((l) => `${l.type}:${l.base}`)).toEqual([
      'del:1', 'del:2',
      'context:3', 'context:4', 'context:5',
    ]);
  });

  it('does not duplicate lines across a hole between adjacent hunks', () => {
    // A nested symbol carved into its own chunk leaves this chunk with a one-line hole at line 7.
    // The first hunk's trailing context must stop before line 8, which the second hunk adds.
    const chunk = {
      hunks: [
        { baseStart: 0, baseCount: 0, headStart: 1, headCount: 6 },
        { baseStart: 8, baseCount: 0, headStart: 8, headCount: 3 },
      ],
    } as Chunk;
    const lines = unifiedChunkLines(chunk, { head, base });

    expect(lines.map((l) => `${l.type}:${l.head ?? l.base ?? ''}`)).toEqual([
      'add:1', 'add:2', 'add:3', 'add:4', 'add:5', 'add:6',
      'context:7',
      'add:8', 'add:9', 'add:10',
      'context:11', 'context:12', 'context:13',
    ]);
  });

  it('returns nothing without content', () => {
    const chunk = chunkOf([{ baseStart: 1, baseCount: 1, headStart: 1, headCount: 1 }]);
    expect(unifiedChunkLines(chunk, undefined)).toEqual([]);
  });
});
