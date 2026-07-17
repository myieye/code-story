import { describe, expect, it } from 'vitest';
import { chunkFile } from './chunker.js';
import { type FileContents } from './export.js';
import { type FileDiff } from './diff.js';
import { type ImportGraph } from './import-graph.js';
import { type Chunk, type Section } from './model.js';
import {
  buildSectionNarrationInput,
  NARRATION_INPUT_TOKEN_CAP,
  parseNarrationReply,
  renderSectionNarrationInput,
} from './narration.js';

function graph(...edges: [string, string][]): ImportGraph {
  return { edges: edges.map(([from, to]) => ({ from, to })), unresolved: 0 };
}

/** One chunk per hunk against a file of `lineText`-filled lines, so unifiedChunkLines yields real diff text. */
function fileChunks(path: string, hunks: FileDiff['hunks'], lineCount = 400): { chunks: Chunk[]; contents: FileContents } {
  const lines = Array.from({ length: lineCount }, (_, i) => `${path} line ${i + 1} some content here`);
  const diff: FileDiff = { path, status: 'modified', binary: false, hunks };
  const chunks = chunkFile({ diff, lines, baseLines: lines });
  return { chunks, contents: { head: lines, base: lines } };
}

function section(id: string, chunks: Chunk[]): Section {
  return {
    id,
    title: id,
    occurrences: chunks.map((c, i) => ({ chunkId: c.id, ordinal: i, role: 'primary' as const })),
  };
}

describe('buildSectionNarrationInput', () => {
  it('includes every chunk with its diff and an empty omitted list for a small section', () => {
    const { chunks, contents } = fileChunks('a.ts', [{ baseStart: 3, baseCount: 2, headStart: 3, headCount: 2 }]);
    const sec = section('a.ts', chunks);
    const input = buildSectionNarrationInput(sec, chunks, graph(), new Map([['a.ts', contents]]));

    expect(input.key).toBe('a.ts');
    expect(input.omitted).toEqual([]);
    expect(input.chunks.length).toBe(chunks.length);
    expect(input.chunks.every((c) => c.diff !== undefined && c.diff.length > 0)).toBe(true);
    expect(input.estimatedTokens).toBeLessThanOrEqual(NARRATION_INPUT_TOKEN_CAP);
  });

  it('drops diffs past the token budget into omitted and stays under the cap', () => {
    // Many wide hunks across the file so the combined diff blows the ~6k-token budget.
    const hunks = Array.from({ length: 80 }, (_, i) => ({
      baseStart: 5 + i * 15,
      baseCount: 10,
      headStart: 5 + i * 15,
      headCount: 10,
    }));
    const { chunks, contents } = fileChunks('big.ts', hunks, 1400);
    const sec = section('big.ts', chunks);
    const input = buildSectionNarrationInput(sec, chunks, graph(), new Map([['big.ts', contents]]));

    expect(input.omitted.length).toBeGreaterThan(0);
    expect(input.estimatedTokens).toBeLessThanOrEqual(NARRATION_INPUT_TOKEN_CAP);
    // Omitted chunks keep their metadata but carry no diff; every chunk id still appears once.
    const byId = new Map(input.chunks.map((c) => [c.id, c]));
    for (const id of input.omitted) expect(byId.get(id)!.diff).toBeUndefined();
    expect(input.chunks.length).toBe(chunks.length);
  });

  it('excludes low-signal chunks by construction', () => {
    const { chunks, contents } = fileChunks('a.ts', [{ baseStart: 3, baseCount: 2, headStart: 3, headCount: 2 }]);
    const stubbed = chunks.map((c) => ({ ...c, changeTypes: ['generated' as const] }));
    const sec = section('a.ts', stubbed);
    const input = buildSectionNarrationInput(sec, stubbed, graph(), new Map([['a.ts', contents]]));
    expect(input.chunks).toEqual([]);
    expect(input.omitted).toEqual([]);
  });

  it('records import and imported-by edges from the graph', () => {
    const { chunks, contents } = fileChunks('a.ts', [{ baseStart: 3, baseCount: 2, headStart: 3, headCount: 2 }]);
    const sec = section('a.ts', chunks);
    const g = graph(['a.ts', 'b.ts'], ['c.ts', 'a.ts'], ['a.ts', 'a.ts']);
    const input = buildSectionNarrationInput(sec, chunks, g, new Map([['a.ts', contents]]));
    expect(input.imports).toEqual(['b.ts']);
    expect(input.importedBy).toEqual(['c.ts']);
  });

  it('is deterministic', () => {
    const { chunks, contents } = fileChunks('a.ts', [
      { baseStart: 3, baseCount: 2, headStart: 3, headCount: 2 },
      { baseStart: 40, baseCount: 3, headStart: 40, headCount: 3 },
    ]);
    const sec = section('a.ts', chunks);
    const map = new Map([['a.ts', contents]]);
    const first = renderSectionNarrationInput(buildSectionNarrationInput(sec, chunks, graph(), map));
    const second = renderSectionNarrationInput(buildSectionNarrationInput(sec, chunks, graph(), map));
    expect(first).toBe(second);
  });

  it('renders a section input snapshot', () => {
    const { chunks, contents } = fileChunks('a.ts', [{ baseStart: 3, baseCount: 1, headStart: 3, headCount: 2 }]);
    const sec = section('a.ts', chunks);
    const input = buildSectionNarrationInput(sec, chunks, graph(['a.ts', 'b.ts']), new Map([['a.ts', contents]]));
    expect(renderSectionNarrationInput(input)).toMatchSnapshot();
  });
});

describe('parseNarrationReply', () => {
  const { chunks } = fileChunks('a.ts', [
    { baseStart: 3, baseCount: 2, headStart: 3, headCount: 2 },
    { baseStart: 40, baseCount: 2, headStart: 40, headCount: 2 },
  ]);
  const sec = section('a.ts', chunks);
  const firstId = chunks[0]!.id;

  it('accepts a sparse reply with a subset of chunk ids', () => {
    const result = parseNarrationReply(sec, { intro: 'What this file does.', chunks: { [firstId]: 'Watch the guard.' } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.reply.intro).toBe('What this file does.');
      expect(result.reply.chunks).toEqual({ [firstId]: 'Watch the guard.' });
    }
  });

  it('accepts an intro with no chunk lines', () => {
    const result = parseNarrationReply(sec, { intro: 'Just an intro.' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.reply.chunks).toEqual({});
  });

  it('rejects an unknown chunk key', () => {
    const result = parseNarrationReply(sec, { intro: 'x', chunks: { 'not-a-chunk': 'line' } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('unknown chunk id');
  });

  it('rejects a missing or non-string intro', () => {
    expect(parseNarrationReply(sec, { chunks: {} }).ok).toBe(false);
    expect(parseNarrationReply(sec, { intro: 5 }).ok).toBe(false);
    expect(parseNarrationReply(sec, null).ok).toBe(false);
  });

  it('rejects a non-string chunk line', () => {
    const result = parseNarrationReply(sec, { intro: 'x', chunks: { [firstId]: 7 } });
    expect(result.ok).toBe(false);
  });
});
