import type { NarrationOverlay, NarrationSectionEntry } from '@code-story/core';
import { describe, expect, it } from 'vitest';
import {
  chunkAiLine,
  chunkBadge,
  chunkLineV2,
  chunkNarrationIndicator,
  chunkReviewNote,
  narrationIndicator,
  sectionAiLine,
} from './narration-logic.js';

function entry(fields: Partial<NarrationSectionEntry> = {}): NarrationSectionEntry {
  return { fingerprint: 'fp', intro: '', chunks: {}, generatedAt: '2026-07-17T00:00:00Z', ...fields };
}

function overlay(sections: Record<string, NarrationSectionEntry> = {}, openerText = ''): NarrationOverlay {
  return {
    version: 1,
    model: 'opus',
    promptVersion: 'narration-1',
    opener: { text: openerText, key: 'k' },
    sections,
  };
}

describe('sectionAiLine — one AI voice per header, intro > rationale > none', () => {
  it('prefers the narration intro when present', () => {
    const o = overlay({ 'a.ts': entry({ intro: 'Sets up the parser.' }) });
    expect(sectionAiLine('a.ts', o, { 'a.ts': 'Utilities come first.' })).toEqual({
      text: 'Sets up the parser.',
      source: 'intro',
    });
  });

  it('falls back to the applied order rationale when there is no intro', () => {
    const o = overlay({ 'a.ts': entry({ intro: '' }) });
    expect(sectionAiLine('a.ts', o, { 'a.ts': 'Utilities come first.' })).toEqual({
      text: 'Utilities come first.',
      source: 'rationale',
    });
  });

  it('treats a whitespace-only intro as absent and falls through to the rationale', () => {
    const o = overlay({ 'a.ts': entry({ intro: '   ' }) });
    expect(sectionAiLine('a.ts', o, { 'a.ts': 'Utilities come first.' })?.source).toBe('rationale');
  });

  it('uses the rationale when there is no narration overlay at all', () => {
    expect(sectionAiLine('a.ts', null, { 'a.ts': 'Utilities come first.' })).toEqual({
      text: 'Utilities come first.',
      source: 'rationale',
    });
  });

  it('is undefined when neither an intro nor a rationale applies', () => {
    expect(sectionAiLine('a.ts', overlay(), undefined)).toBeUndefined();
    expect(sectionAiLine('a.ts', overlay({ 'a.ts': entry() }), {})).toBeUndefined();
  });
});

describe('chunkAiLine', () => {
  it('returns the line for a chunk in the section', () => {
    const o = overlay({ 'a.ts': entry({ chunks: { 'a.ts::f::1': 'Renames the field.' } }) });
    expect(chunkAiLine('a.ts', 'a.ts::f::1', o)).toBe('Renames the field.');
  });

  it('is undefined for a missing line, empty line, or absent overlay', () => {
    expect(chunkAiLine('a.ts', 'a.ts::f::1', overlay({ 'a.ts': entry() }))).toBeUndefined();
    expect(chunkAiLine('a.ts', 'x', overlay({ 'a.ts': entry({ chunks: { x: '  ' } }) }))).toBeUndefined();
    expect(chunkAiLine('a.ts', 'a.ts::f::1', null)).toBeUndefined();
  });
});

describe('chunkLineV2 — v2 entry preferred, v1 line as fallback', () => {
  it('prefers a fresh v2 line over the v1 section-keyed line', () => {
    expect(chunkLineV2('a.ts::f::1', { 'a.ts::f::1': { line: 'v2 line' } }, 'v1 line')).toBe('v2 line');
  });

  it('falls back to the v1 line when the v2 entry has no line', () => {
    expect(chunkLineV2('a.ts::f::1', { 'a.ts::f::1': { badge: 'Renames field' } }, 'v1 line')).toBe('v1 line');
    expect(chunkLineV2('a.ts::f::1', undefined, 'v1 line')).toBe('v1 line');
    expect(chunkLineV2('a.ts::f::1', { 'a.ts::f::1': { line: '  ' } }, 'v1 line')).toBe('v1 line');
  });

  it('is undefined when neither v2 nor v1 has a line', () => {
    expect(chunkLineV2('a.ts::f::1', {}, undefined)).toBeUndefined();
  });
});

describe('chunkBadge', () => {
  it('returns a trimmed badge from the v2 overlay', () => {
    expect(chunkBadge('c1', { c1: { badge: '  Adds guard  ' } })).toBe('Adds guard');
  });

  it('is undefined for a missing, blank, or v2-absent badge', () => {
    expect(chunkBadge('c1', { c1: { line: 'x' } })).toBeUndefined();
    expect(chunkBadge('c1', { c1: { badge: '   ' } })).toBeUndefined();
    expect(chunkBadge('c1', undefined)).toBeUndefined();
  });
});

describe('chunkReviewNote (R-068)', () => {
  it('returns a trimmed review note from the v2 overlay', () => {
    expect(chunkReviewNote('c1', { c1: { reviewNote: '  Check the two synced sorts.  ' } })).toBe(
      'Check the two synced sorts.',
    );
  });

  it('is undefined for an ordinary chunk with no note', () => {
    expect(chunkReviewNote('c1', { c1: { line: 'x', badge: 'Refactor' } })).toBeUndefined();
    expect(chunkReviewNote('c1', { c1: { reviewNote: '   ' } })).toBeUndefined();
    expect(chunkReviewNote('c1', undefined)).toBeUndefined();
  });
});

describe('chunkNarrationIndicator — v2 coverage (N of M chunks)', () => {
  const ids = ['c1', 'c2', 'c3'];

  it('is null when the v2 overlay is absent or nothing is narratable', () => {
    expect(chunkNarrationIndicator(ids, undefined, undefined)).toBeNull();
    expect(chunkNarrationIndicator([], {}, 'running')).toBeNull();
  });

  it('is partial while a job runs or entries are missing', () => {
    expect(chunkNarrationIndicator(ids, { c1: { line: 'x' } }, 'running')).toEqual({ kind: 'partial', narrated: 1, narratable: 3 });
    expect(chunkNarrationIndicator(ids, { c1: { line: 'x' }, c2: { badge: 'y' } }, 'done')).toEqual({
      kind: 'partial',
      narrated: 2,
      narratable: 3,
    });
  });

  it('is complete when every narratable chunk carries a line or badge and no job runs', () => {
    expect(chunkNarrationIndicator(ids, { c1: { line: 'x' }, c2: { badge: 'y' }, c3: { line: 'z' } }, 'done')).toEqual({
      kind: 'complete',
    });
  });
});

describe('narrationIndicator — partial-state honesty (N of M)', () => {
  const ids = ['a.ts', 'b.ts', 'c.ts'];

  it('is null when narration was never engaged', () => {
    expect(narrationIndicator(ids, null, undefined)).toBeNull();
    expect(narrationIndicator(ids, overlay(), undefined)).toBeNull();
  });

  it('is partial while a job runs, even before any section is done', () => {
    expect(narrationIndicator(ids, null, 'running')).toEqual({ kind: 'partial', narrated: 0, narratable: 3 });
  });

  it('is partial while a job runs even if every section already has an entry', () => {
    const o = overlay({ 'a.ts': entry(), 'b.ts': entry(), 'c.ts': entry() });
    expect(narrationIndicator(ids, o, 'running')).toEqual({ kind: 'partial', narrated: 3, narratable: 3 });
  });

  it('is partial when a finished job left some sections un-narrated', () => {
    const o = overlay({ 'a.ts': entry(), 'b.ts': entry() });
    expect(narrationIndicator(ids, o, 'done')).toEqual({ kind: 'partial', narrated: 2, narratable: 3 });
  });

  it('counts a gateFailures-only entry as narrated — the section was visited', () => {
    const o = overlay({ 'a.ts': entry(), 'b.ts': entry(), 'c.ts': entry({ gateFailures: ['intro too long'] }) });
    expect(narrationIndicator(ids, o, 'done')).toEqual({ kind: 'complete' });
  });

  it('is complete when every narratable section has an entry and no job runs', () => {
    const o = overlay({ 'a.ts': entry(), 'b.ts': entry(), 'c.ts': entry() });
    expect(narrationIndicator(ids, o, 'done')).toEqual({ kind: 'complete' });
    expect(narrationIndicator(ids, o, undefined)).toEqual({ kind: 'complete' });
  });

  it('is null when nothing is narratable, even with a job present', () => {
    expect(narrationIndicator([], overlay(), 'running')).toBeNull();
  });

  it('is engaged by an opener alone', () => {
    expect(narrationIndicator(ids, overlay({}, 'This change reworks parsing.'), undefined)).toEqual({
      kind: 'partial',
      narrated: 0,
      narratable: 3,
    });
  });
});
