import { describe, expect, it } from 'vitest';
import { chunkFile } from './chunker.js';
import { type ContextDefinition, type ContextPayload } from './context.js';
import { type FileContents } from './export.js';
import { type FileDiff } from './diff.js';
import { type ImportGraph } from './import-graph.js';
import { type Chunk, type Section } from './model.js';
import { type SymbolSpan } from './symbols.js';
import {
  buildChunkNarrationBatch,
  buildSectionNarrationInput,
  NARRATION_DEFINITIONS_TOKEN_CAP,
  NARRATION_INPUT_TOKEN_CAP,
  parseChunkNarrationReply,
  parseNarrationReply,
  renderChunkNarrationBatch,
  renderSectionNarrationInput,
} from './narration.js';

function def(symbol: string, file: string, body: string): ContextDefinition {
  return { symbol, file, changed: false, body, lineStart: 1, sha: 'deadbeefcafe' };
}

function payload(chunkId: string, definitions: ContextDefinition[]): ContextPayload {
  return {
    chunkId,
    fingerprint: 'fp',
    generatedAt: '2026-01-01T00:00:00.000Z',
    facts: { definitions, edges: { imports: [], importedBy: [] } },
  };
}

function graph(...edges: [string, string][]): ImportGraph {
  return { edges: edges.map(([from, to]) => ({ from, to })), unresolved: 0 };
}

/** One chunk per hunk against a file of `lineText`-filled lines, so unifiedChunkLines yields real diff text. */
function fileChunks(
  path: string,
  hunks: FileDiff['hunks'],
  lineCount = 400,
  symbols?: SymbolSpan[],
): { chunks: Chunk[]; contents: FileContents } {
  const lines = Array.from({ length: lineCount }, (_, i) => `${path} line ${i + 1} some content here`);
  const diff: FileDiff = { path, status: 'modified', binary: false, hunks };
  const chunks = chunkFile({ diff, lines, baseLines: lines, symbols });
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

  it('appends no definitions block when no payloads are supplied', () => {
    const { chunks, contents } = fileChunks('a.ts', [{ baseStart: 3, baseCount: 1, headStart: 3, headCount: 2 }]);
    const sec = section('a.ts', chunks);
    const input = buildSectionNarrationInput(sec, chunks, graph(), new Map([['a.ts', contents]]));
    expect(input.definitions).toBeUndefined();
    expect(renderSectionNarrationInput(input)).not.toContain('context — not part of the diff');
  });

  it('appends no block for an empty payload — not a bare header (spec 04)', () => {
    const { chunks, contents } = fileChunks('a.ts', [{ baseStart: 3, baseCount: 1, headStart: 3, headCount: 2 }]);
    const sec = section('a.ts', chunks);
    const payloads = new Map([[chunks[0]!.id, payload(chunks[0]!.id, [])]]);
    const input = buildSectionNarrationInput(sec, chunks, graph(), new Map([['a.ts', contents]]), payloads);
    expect(input.definitions).toEqual([]);
    expect(renderSectionNarrationInput(input)).not.toContain('context — not part of the diff');
  });

  it('renders a section input snapshot with a definitions block', () => {
    const { chunks, contents } = fileChunks('a.ts', [{ baseStart: 3, baseCount: 1, headStart: 3, headCount: 2 }]);
    const sec = section('a.ts', chunks);
    const payloads = new Map([
      [chunks[0]!.id, payload(chunks[0]!.id, [def('debouncedFilter', 'util/filter.ts', 'export function debouncedFilter(q: string) {\n  return q.trim();\n}')])],
    ]);
    const input = buildSectionNarrationInput(sec, chunks, graph(['a.ts', 'b.ts']), new Map([['a.ts', contents]]), payloads);
    expect(renderSectionNarrationInput(input)).toMatchSnapshot();
  });

  it('deduplicates a definition shared across the section chunks', () => {
    const symbols: SymbolSpan[] = [
      { name: 'first', kind: 'function', startLine: 1, endLine: 20, children: [] },
      { name: 'second', kind: 'function', startLine: 280, endLine: 320, children: [] },
    ];
    const { chunks, contents } = fileChunks(
      'a.ts',
      [
        { baseStart: 3, baseCount: 2, headStart: 3, headCount: 2 },
        { baseStart: 300, baseCount: 2, headStart: 300, headCount: 2 },
      ],
      400,
      symbols,
    );
    expect(chunks.length).toBe(2);
    const sec = section('a.ts', chunks);
    const shared = def('helper', 'util/shared.ts', 'export function helper() {}');
    const payloads = new Map([
      [chunks[0]!.id, payload(chunks[0]!.id, [shared])],
      [chunks[1]!.id, payload(chunks[1]!.id, [shared, def('other', 'util/other.ts', 'export const other = 1;')])],
    ]);
    const input = buildSectionNarrationInput(sec, chunks, graph(), new Map([['a.ts', contents]]), payloads);
    expect(input.definitions?.map((d) => `${d.file}:${d.symbol}`)).toEqual(['util/shared.ts:helper', 'util/other.ts:other']);
  });

  it('never lets definitions evict or shrink diff text, and caps the block at its own budget', () => {
    const hunks = Array.from({ length: 80 }, (_, i) => ({
      baseStart: 5 + i * 15,
      baseCount: 10,
      headStart: 5 + i * 15,
      headCount: 10,
    }));
    const { chunks, contents } = fileChunks('big.ts', hunks, 1400);
    const sec = section('big.ts', chunks);
    const map = new Map([['big.ts', contents]]);

    const withoutDefs = buildSectionNarrationInput(sec, chunks, graph(), map);
    expect(withoutDefs.omitted.length).toBeGreaterThan(0);

    // A dozen sizeable definitions — more than the 2k block budget can hold.
    const defs = Array.from({ length: 12 }, (_, i) =>
      def(`sym${i}`, `dep${i}.ts`, `export function sym${i}() {\n${'  const line = value;\n'.repeat(50)}}`),
    );
    const payloads = new Map([[chunks[0]!.id, payload(chunks[0]!.id, defs)]]);
    const withDefs = buildSectionNarrationInput(sec, chunks, graph(), map, payloads);

    // Diff selection is byte-for-byte identical: no chunk's diff shrank or dropped for the block.
    expect(withDefs.chunks).toEqual(withoutDefs.chunks);
    expect(withDefs.omitted).toEqual(withoutDefs.omitted);

    const renderedWithout = renderSectionNarrationInput(withoutDefs);
    const renderedWith = renderSectionNarrationInput(withDefs);
    expect(renderedWith.startsWith(`${renderedWithout}\n\n`)).toBe(true);

    // The block truncated (dropped whole definitions) and fits its own additive budget.
    expect(withDefs.definitionsOmitted!).toBeGreaterThan(0);
    const block = renderedWith.slice(renderedWithout.length + 2);
    expect(block.startsWith('context — not part of the diff')).toBe(true);
    expect(block).toContain('omitted — over context budget');
    expect(Math.ceil(block.length / 4)).toBeLessThanOrEqual(NARRATION_DEFINITIONS_TOKEN_CAP);
  });
});

const twoChunkFile = () => {
  const symbols: SymbolSpan[] = [
    { name: 'first', kind: 'function', startLine: 1, endLine: 20, children: [] },
    { name: 'second', kind: 'function', startLine: 280, endLine: 320, children: [] },
  ];
  return fileChunks(
    'a.ts',
    [
      { baseStart: 300, baseCount: 2, headStart: 300, headCount: 2 },
      { baseStart: 3, baseCount: 2, headStart: 3, headCount: 2 },
    ],
    400,
    symbols,
  );
};

describe('buildChunkNarrationBatch', () => {
  it('aliases chunks c1..cN in file position order with their diffs', () => {
    const { chunks, contents } = twoChunkFile();
    expect(chunks.length).toBe(2);
    const batch = buildChunkNarrationBatch('a.ts', chunks, contents);
    expect(batch.file).toBe('a.ts');
    expect(batch.chunks.map((c) => c.alias)).toEqual(['c1', 'c2']);
    // c1 is the earlier-in-file chunk regardless of input array order.
    expect(batch.chunks[0]!.id).toBe(chunks.find((c) => (c.headRange?.start ?? 0) < 100)!.id);
    expect(batch.chunks.every((c) => c.diff !== undefined && c.diff.length > 0)).toBe(true);
    expect(batch.omitted).toEqual([]);
    expect(renderChunkNarrationBatch(batch)).toContain('File: a.ts');
  });

  it('drops diffs past the token budget into omitted and stays under the cap', () => {
    const hunks = Array.from({ length: 80 }, (_, i) => ({
      baseStart: 5 + i * 15,
      baseCount: 10,
      headStart: 5 + i * 15,
      headCount: 10,
    }));
    const { chunks, contents } = fileChunks('big.ts', hunks, 1400);
    const batch = buildChunkNarrationBatch('big.ts', chunks, contents);
    expect(batch.omitted.length).toBeGreaterThan(0);
    expect(Math.ceil(renderChunkNarrationBatch(batch).length / 4)).toBeLessThanOrEqual(NARRATION_INPUT_TOKEN_CAP);
    const byId = new Map(batch.chunks.map((c) => [c.id, c]));
    for (const id of batch.omitted) expect(byId.get(id)!.diff).toBeUndefined();
    expect(batch.chunks.length).toBe(chunks.length);
  });
});

describe('parseChunkNarrationReply', () => {
  const { chunks, contents } = twoChunkFile();
  const batch = buildChunkNarrationBatch('a.ts', chunks, contents);
  const firstId = batch.chunks[0]!.id;

  it('resolves aliases to chunk ids and keeps line + badge', () => {
    const r = parseChunkNarrationReply(batch, { c1: { line: 'Check the guard.', badge: 'New guard' } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.entries).toEqual({ [firstId]: { line: 'Check the guard.', badge: 'New guard' } });
  });

  it('accepts a sparse reply and a line-only or badge-only entry', () => {
    const r = parseChunkNarrationReply(batch, { c2: { badge: 'Test update' } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.values(r.entries)[0]).toEqual({ badge: 'Test update' });
  });

  it('keeps an optional review note alongside line + badge (R-068)', () => {
    const note = 'The two switches must agree; cross-check the added case against the resolver.';
    const r = parseChunkNarrationReply(batch, { c1: { line: 'Check the guard.', badge: 'New guard', note } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.entries[firstId]).toEqual({ line: 'Check the guard.', badge: 'New guard', note });
  });

  it('rejects a foreign alias', () => {
    const r = parseChunkNarrationReply(batch, { c9: { line: 'nope' } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('unknown chunk alias');
  });

  it('rejects a non-string line, badge, or note', () => {
    expect(parseChunkNarrationReply(batch, { c1: { line: 5 } }).ok).toBe(false);
    expect(parseChunkNarrationReply(batch, { c1: { badge: {} } }).ok).toBe(false);
    expect(parseChunkNarrationReply(batch, { c1: { note: 7 } }).ok).toBe(false);
    expect(parseChunkNarrationReply(batch, { c1: 'not-an-object' }).ok).toBe(false);
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

  it('strips a copied "chunk " render label from the key (#44 second variant)', () => {
    const result = parseNarrationReply(sec, { intro: 'x', chunks: { [`chunk ${firstId}`]: 'line' } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.reply.chunks).toEqual({ [firstId]: 'line' });
  });

  it('resolves a ::-boundary suffix to the full chunk id (#44 truncation)', () => {
    const tail = firstId.split('::').pop()!;
    const result = parseNarrationReply(sec, { intro: 'x', chunks: { [tail]: 'line' } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.reply.chunks).toEqual({ [firstId]: 'line' });
  });

  it('rejects a suffix that matches more than one chunk id', () => {
    const twin = {
      ...sec,
      occurrences: [
        { chunkId: 'a.ts::one::x', ordinal: 0, role: 'primary' as const },
        { chunkId: 'a.ts::two::x', ordinal: 1, role: 'primary' as const },
      ],
    };
    const result = parseNarrationReply(twin, { intro: 'x', chunks: { x: 'line' } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('unknown chunk id');
  });

  it('does not match a fragment that crosses a :: boundary', () => {
    const tail = firstId.split('::').pop()!;
    const result = parseNarrationReply(sec, { intro: 'x', chunks: { [tail.slice(1)]: 'line' } });
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
