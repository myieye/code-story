import { describe, expect, it } from 'vitest';
import {
  capBody,
  type ContextPayload,
  contextFingerprint,
  type ContextStoreFile,
  filterFreshContext,
} from './context.js';
import { fnv1a } from './chunker.js';
import { CORE_VERSION } from './model.js';

function payload(headSha: string, chunkId: string): ContextPayload {
  return {
    chunkId,
    fingerprint: contextFingerprint(headSha, chunkId),
    generatedAt: '2026-07-17T00:00:00Z',
    facts: { definitions: [], edges: { imports: [], importedBy: [] } },
  };
}

describe('contextFingerprint', () => {
  it('changes with headSha and with chunkId', () => {
    const base = contextFingerprint('h1', 'a.ts::x::1');
    expect(contextFingerprint('h2', 'a.ts::x::1')).not.toBe(base);
    expect(contextFingerprint('h1', 'a.ts::y::2')).not.toBe(base);
  });

  it('folds CORE_VERSION in (recomputed, not a literal)', () => {
    // Recompute both ways: the version-inclusive recomputation must match the export, and dropping
    // the version must change the hash — a version bump has to invalidate persisted payloads.
    const withVersion = fnv1a(['h1', CORE_VERSION, 'a.ts::x::1'].join('\0'));
    const withoutVersion = fnv1a(['h1', 'a.ts::x::1'].join('\0'));
    expect(contextFingerprint('h1', 'a.ts::x::1')).toBe(withVersion);
    expect(withVersion).not.toBe(withoutVersion);
  });
});

describe('filterFreshContext', () => {
  const headSha = 'head1';
  const live = new Set(['a.ts::x::1', 'b.ts::y::2']);

  it('keeps payloads whose chunk is live and fingerprint matches', () => {
    const store: ContextStoreFile = {
      version: 1,
      payloads: { 'a.ts::x::1': payload(headSha, 'a.ts::x::1') },
    };
    expect(Object.keys(filterFreshContext(headSha, live, store))).toEqual(['a.ts::x::1']);
  });

  it('drops payloads whose chunk is gone', () => {
    const store: ContextStoreFile = {
      version: 1,
      payloads: { 'gone.ts::z::9': payload(headSha, 'gone.ts::z::9') },
    };
    expect(filterFreshContext(headSha, live, store)).toEqual({});
  });

  it('drops payloads whose fingerprint no longer matches (stale head)', () => {
    const store: ContextStoreFile = {
      version: 1,
      payloads: { 'a.ts::x::1': payload('oldhead', 'a.ts::x::1') },
    };
    expect(filterFreshContext(headSha, live, store)).toEqual({});
  });

  it('fails open to empty on a malformed store', () => {
    const bad = { version: 1 } as unknown as ContextStoreFile;
    expect(filterFreshContext(headSha, live, bad)).toEqual({});
  });

  it('accepts a Book as the live-chunk source', () => {
    const book = {
      headSha,
      sections: [
        { id: 'a.ts', title: 'a.ts', occurrences: [{ chunkId: 'a.ts::x::1', ordinal: 0, role: 'primary' as const }] },
      ],
    };
    const store: ContextStoreFile = {
      version: 1,
      payloads: {
        'a.ts::x::1': payload(headSha, 'a.ts::x::1'),
        'b.ts::y::2': payload(headSha, 'b.ts::y::2'),
      },
    };
    expect(Object.keys(filterFreshContext(headSha, book, store))).toEqual(['a.ts::x::1']);
  });
});

describe('capBody', () => {
  const lines = (n: number, last = 'x;') => Array.from({ length: n }, (_, i) => (i === n - 1 ? last : `line${i};`));

  it('passes 79- and 80-line bodies through untouched', () => {
    const body79 = lines(79).join('\n');
    const body80 = lines(80).join('\n');
    expect(capBody(body79)).toBe(body79);
    expect(capBody(body80)).toBe(body80);
  });

  it('truncates an 81-line body with a marker', () => {
    const out = capBody(lines(81).join('\n'));
    expect(out.split('\n')).toHaveLength(81);
    expect(out.endsWith('… (1 more line)')).toBe(true);
  });

  it('extends the cut a few lines down to reach a blank-line boundary', () => {
    // Line 80 (index 79) is mid-expression; a blank line sits at line 82.
    const src = Array.from({ length: 100 }, (_, i) => (i === 81 ? '' : `stmt${i}`));
    const out = capBody(src.join('\n'));
    const kept = out.split('\n').slice(0, -1);
    expect(kept).toHaveLength(82);
    expect(out.endsWith('… (18 more lines)')).toBe(true);
  });

  it('falls back to exactly the cap when no boundary is in the window', () => {
    // No line near the cap ends in a blank/;/}/{ boundary.
    const src = Array.from({ length: 100 }, (_, i) => `word${i}`);
    const out = capBody(src.join('\n'));
    const kept = out.split('\n').slice(0, -1);
    expect(kept).toHaveLength(80);
    expect(out.endsWith('… (20 more lines)')).toBe(true);
  });
});
