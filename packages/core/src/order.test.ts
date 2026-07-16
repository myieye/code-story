import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { compileBook } from './book.js';
import { chunkFile } from './chunker.js';
import { type FileDiff } from './diff.js';
import { type ImportGraph } from './import-graph.js';
import { type Book } from './model.js';
import {
  applyOrderOverlay,
  bookFingerprint,
  buildOrderManifest,
  type OrderOverlay,
  renderOrderManifest,
  validatePermutation,
} from './order.js';

function file(path: string, hunks: FileDiff['hunks'], status: FileDiff['status'] = 'modified'): FileDiff {
  return { path, status, binary: false, hunks };
}

function graph(...edges: [string, string][]): ImportGraph {
  return { edges: edges.map(([from, to]) => ({ from, to })), unresolved: 0 };
}

const noGraph = graph();
const lines = Array.from({ length: 60 }, (_, i) => `line ${i + 1}`);

function setup(paths: string[], lowSignal: string[] = []) {
  const files = paths.map((p) => file(p, [{ baseStart: 1, baseCount: 1, headStart: 1, headCount: 1 }]));
  const chunks = files
    .flatMap((diff) => chunkFile({ diff, lines, baseLines: lines }))
    .map((c) => (lowSignal.includes(c.file) ? { ...c, changeTypes: ['generated' as const] } : c));
  return { files, chunks };
}

function book(headSha: string, sections: { id: string; chunkIds: string[] }[]): Book {
  return {
    headSha,
    sections: sections.map((s) => ({
      id: s.id,
      title: s.id,
      occurrences: s.chunkIds.map((chunkId, i) => ({ chunkId, ordinal: i, role: 'primary' as const })),
    })),
  };
}

function overlay(bookFp: string, permutation: string[]): OrderOverlay {
  return {
    version: 1,
    bookFingerprint: bookFp,
    permutation,
    rationales: {},
    model: 'test-model',
    promptVersion: 'v1',
    createdAt: '2026-07-16T00:00:00Z',
  };
}

/** Deterministic Fisher-Yates using a small LCG — enough spread for property tests, no true randomness needed. */
function shuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = (seed >>> 0) || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

describe('bookFingerprint', () => {
  it('is stable across identical books', () => {
    const a = book('abc', [{ id: 'a.ts', chunkIds: ['a.ts::x::1'] }]);
    const b = book('abc', [{ id: 'a.ts', chunkIds: ['a.ts::x::1'] }]);
    expect(bookFingerprint(a)).toBe(bookFingerprint(b));
  });

  it('changes when a section occurrence list changes', () => {
    const a = book('abc', [{ id: 'a.ts', chunkIds: ['a.ts::x::1'] }]);
    const b = book('abc', [{ id: 'a.ts', chunkIds: ['a.ts::x::2'] }]);
    expect(bookFingerprint(a)).not.toBe(bookFingerprint(b));
  });

  it('changes when a section id changes', () => {
    const a = book('abc', [{ id: 'a.ts', chunkIds: ['x'] }]);
    const b = book('abc', [{ id: 'b.ts', chunkIds: ['x'] }]);
    expect(bookFingerprint(a)).not.toBe(bookFingerprint(b));
  });

  it('changes when headSha changes', () => {
    const sections = [{ id: 'a.ts', chunkIds: ['x'] }];
    expect(bookFingerprint(book('abc', sections))).not.toBe(bookFingerprint(book('def', sections)));
  });
});

// Arbitrary changed-file sets: a handful of unique paths, an arbitrary subset marked low-signal.
const arbFiles: fc.Arbitrary<{ paths: string[]; lowSignal: string[] }> = fc
  .uniqueArray(fc.constantFrom('a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts', 'f.ts'), { minLength: 2, maxLength: 6 })
  .chain((paths) => fc.subarray(paths).map((lowSignal) => ({ paths, lowSignal })));

describe('applyOrderOverlay', () => {
  it('preserves section membership, occurrence sets, and pinned-tail position under a valid random permutation', () => {
    fc.assert(
      fc.property(arbFiles, fc.integer(), (input, seed) => {
        const { files, chunks } = setup(input.paths, input.lowSignal);
        const { book: compiled } = compileBook({ files, chunks, graph: noGraph, headSha: 'h1' });
        const manifest = buildOrderManifest(compiled, noGraph, chunks);
        if (manifest.sections.length < 2) return;

        const storyKeys = manifest.sections.map((s) => s.key);
        const permuted = shuffle(storyKeys, seed);
        const result = applyOrderOverlay(compiled, noGraph, chunks, overlay(bookFingerprint(compiled), permuted));

        expect(new Set(result.sections.map((s) => s.id))).toEqual(new Set(compiled.sections.map((s) => s.id)));
        for (const section of compiled.sections) {
          const before = section.occurrences.map((o) => o.chunkId).sort();
          const after = result.sections
            .find((s) => s.id === section.id)!
            .occurrences.map((o) => o.chunkId)
            .sort();
          expect(after).toEqual(before);
        }

        const resultIds = result.sections.map((s) => s.id);
        expect(resultIds.slice(0, storyKeys.length)).toEqual(permuted);
        expect(resultIds.slice(storyKeys.length)).toEqual(manifest.pinnedTail);
      }),
      { numRuns: 100 },
    );
  });

  it('returns the same book reference when the overlay fingerprint is stale', () => {
    fc.assert(
      fc.property(arbFiles, (input) => {
        const { files, chunks } = setup(input.paths, input.lowSignal);
        const { book: compiled } = compileBook({ files, chunks, graph: noGraph, headSha: 'h1' });
        const keys = compiled.sections.map((s) => s.id);
        const result = applyOrderOverlay(compiled, noGraph, chunks, overlay('stale-fingerprint', keys));
        expect(result).toBe(compiled);
      }),
      { numRuns: 30 },
    );
  });

  it('returns the same book reference when the permutation is invalid', () => {
    const { files, chunks } = setup(['a.ts', 'b.ts']);
    const { book: compiled } = compileBook({ files, chunks, graph: noGraph, headSha: 'h1' });
    const result = applyOrderOverlay(compiled, noGraph, chunks, overlay(bookFingerprint(compiled), ['a.ts']));
    expect(result).toBe(compiled);
  });
});

describe('validatePermutation', () => {
  it('rejects a dropped, duplicated, or added section key, and accepts the identity permutation', () => {
    fc.assert(
      fc.property(arbFiles, (input) => {
        const { files, chunks } = setup(input.paths, input.lowSignal);
        const { book: compiled } = compileBook({ files, chunks, graph: noGraph, headSha: 'h1' });
        const manifest = buildOrderManifest(compiled, noGraph, chunks);
        const keys = manifest.sections.map((s) => s.key);
        if (keys.length === 0) return;

        expect(validatePermutation(manifest, keys).ok).toBe(true);
        expect(validatePermutation(manifest, keys.slice(1)).ok).toBe(false);
        expect(validatePermutation(manifest, [...keys, keys[0]!]).ok).toBe(false);
        expect(validatePermutation(manifest, [...keys, 'nonexistent.ts']).ok).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

describe('renderOrderManifest', () => {
  it('is deterministic, names every story section exactly once, and reports the pinned count', () => {
    const { files, chunks } = setup(['gen.lock', 'p.ts', 'a.ts', 'b.ts'], ['gen.lock']);
    const g = graph(['a.ts', 'b.ts']);
    const { book: compiled } = compileBook({ files, chunks, graph: g, headSha: 'x' });
    const manifest = buildOrderManifest(compiled, g, chunks);

    const rendered = renderOrderManifest(manifest);
    expect(renderOrderManifest(manifest)).toBe(rendered);
    // Each section's own header line names it once; import references to other sections may add more.
    for (const section of manifest.sections) {
      expect(rendered).toContain(`${section.key} [${section.role}]`);
    }
    expect(rendered).toContain(`${manifest.pinnedTail.length} pinned tail section`);
  });
});

describe('estimatedTokens', () => {
  it('matches ceil(rendered length / 4)', () => {
    const { files, chunks } = setup(['a.ts', 'b.ts']);
    const { book: compiled } = compileBook({ files, chunks, graph: noGraph, headSha: 'x' });
    const manifest = buildOrderManifest(compiled, noGraph, chunks);
    expect(manifest.estimatedTokens).toBe(Math.ceil(renderOrderManifest(manifest).length / 4));
  });
});
