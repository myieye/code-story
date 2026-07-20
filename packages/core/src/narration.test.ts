import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { type Book } from './model.js';
import {
  BANNED_PHRASES,
  checkBadgeText,
  checkNarrationText,
  chunkNarrationFingerprint,
  filterFreshNarration,
  filterFreshNarrationV2,
  fleschScore,
  narrationOpenerKey,
  type NarrationOverlay,
  type NarrationOverlayV2,
  type NarrationSectionEntry,
  sectionFingerprint,
} from './narration.js';

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

const sample = [
  { id: 'a.ts', chunkIds: ['a.ts::x::1', 'a.ts::y::2'] },
  { id: 'b.ts', chunkIds: ['b.ts::z::3'] },
  { id: 'c.ts', chunkIds: ['c.ts::w::4'] },
];

function entry(fingerprint: string, over: Partial<NarrationSectionEntry> = {}): NarrationSectionEntry {
  return { fingerprint, intro: 'intro', chunks: {}, generatedAt: '2026-07-16T00:00:00Z', ...over };
}

describe('sectionFingerprint', () => {
  it('is insensitive to section position in the book', () => {
    fc.assert(
      fc.property(fc.shuffledSubarray(sample, { minLength: sample.length, maxLength: sample.length }), (order) => {
        const b = book('h1', sample);
        const reordered = book('h1', order);
        for (const section of b.sections) {
          const other = reordered.sections.find((s) => s.id === section.id)!;
          expect(sectionFingerprint('h1', other)).toBe(sectionFingerprint('h1', section));
        }
        expect(narrationOpenerKey(reordered, 'h1')).toBe(narrationOpenerKey(b, 'h1'));
      }),
    );
  });

  it('changes with head, section id, or chunk membership', () => {
    const base = book('h1', sample).sections[0]!;
    expect(sectionFingerprint('h2', base)).not.toBe(sectionFingerprint('h1', base));
    const renamed = { ...base, id: 'renamed.ts' };
    expect(sectionFingerprint('h1', renamed)).not.toBe(sectionFingerprint('h1', base));
    const changed = book('h1', [{ id: 'a.ts', chunkIds: ['a.ts::x::1', 'a.ts::y::CHANGED'] }]).sections[0]!;
    expect(sectionFingerprint('h1', changed)).not.toBe(sectionFingerprint('h1', base));
  });
});

describe('filterFreshNarration', () => {
  function overlayFor(b: Book, opts: { staleSection?: string; badOpener?: boolean } = {}): NarrationOverlay {
    const sections: Record<string, NarrationSectionEntry> = {};
    for (const s of b.sections) {
      const fp = opts.staleSection === s.id ? 'stale' : sectionFingerprint(b.headSha, s);
      sections[s.id] = entry(fp, { intro: `intro for ${s.id}` });
    }
    return {
      version: 1,
      model: 'test',
      promptVersion: 'narration-1',
      opener: { text: 'the opener', key: opts.badOpener ? 'stale' : narrationOpenerKey(b, b.headSha) },
      sections,
    };
  }

  it('keeps fresh entries and drops a stale one', () => {
    const b = book('h1', sample);
    const filtered = filterFreshNarration(b, 'h1', overlayFor(b, { staleSection: 'b.ts' }));
    expect(Object.keys(filtered.sections).sort()).toEqual(['a.ts', 'c.ts']);
    expect(filtered.sections['a.ts']!.intro).toBe('intro for a.ts');
  });

  it('drops an entry whose section is gone from the book', () => {
    const b = book('h1', sample);
    const overlay = overlayFor(b);
    const shrunk = book('h1', sample.slice(0, 2));
    const filtered = filterFreshNarration(shrunk, 'h1', overlay);
    expect(Object.keys(filtered.sections).sort()).toEqual(['a.ts', 'b.ts']);
  });

  it('keeps the opener when its key matches', () => {
    const b = book('h1', sample);
    const filtered = filterFreshNarration(b, 'h1', overlayFor(b));
    expect(filtered.opener.text).toBe('the opener');
  });

  it('clears the opener text but refreshes its key when the key no longer matches', () => {
    const b = book('h1', sample);
    const filtered = filterFreshNarration(b, 'h1', overlayFor(b, { badOpener: true }));
    expect(filtered.opener.text).toBe('');
    expect(filtered.opener.key).toBe(narrationOpenerKey(b, 'h1'));
  });
});

describe('checkNarrationText length caps', () => {
  it('passes text within the per-kind char caps and fails just over', () => {
    expect(checkNarrationText('chunkLine', 'a'.repeat(110))).toEqual([]);
    expect(checkNarrationText('chunkLine', 'a'.repeat(111))).not.toEqual([]);
    expect(checkNarrationText('intro', 'a'.repeat(200))).toEqual([]);
    expect(checkNarrationText('intro', 'a'.repeat(201))).not.toEqual([]);
    expect(checkNarrationText('opener', 'a'.repeat(320))).toEqual([]);
    expect(checkNarrationText('opener', 'a'.repeat(321))).not.toEqual([]);
  });

  it('enforces the per-kind sentence cap at the boundary', () => {
    expect(checkNarrationText('chunkLine', 'One thing here.')).toEqual([]);
    expect(checkNarrationText('chunkLine', 'One thing. Two things.')).not.toEqual([]);
    expect(checkNarrationText('intro', 'First point here. Second point here.')).toEqual([]);
    expect(checkNarrationText('intro', 'First. Second. Third.')).not.toEqual([]);
    expect(checkNarrationText('opener', 'One. Two. Three.')).toEqual([]);
    expect(checkNarrationText('opener', 'One. Two. Three. Four.')).not.toEqual([]);
  });
});

describe('checkNarrationText sentence-word cap', () => {
  const twentyTwo = Array.from({ length: 22 }, (_, i) => `word${i}`).join(' ');
  const twentyThree = Array.from({ length: 23 }, (_, i) => `word${i}`).join(' ');

  it('allows a 22-word sentence and rejects a 23-word one for opener/intro', () => {
    expect(checkNarrationText('intro', `${twentyTwo}.`)).toEqual([]);
    expect(checkNarrationText('intro', `${twentyThree}.`).some((f) => f.includes('words'))).toBe(true);
  });

  it('does not apply the word cap to a chunk line (char cap binds tighter)', () => {
    const line = 'a b c d e f g h i j k l m n o p q r s t u v w x.';
    expect(checkNarrationText('chunkLine', line).some((f) => f.includes('words'))).toBe(false);
  });
});

describe('checkNarrationText judgment lint', () => {
  it('flags every banned phrase, case-insensitively', () => {
    for (const phrase of BANNED_PHRASES) {
      expect(checkNarrationText('intro', `This ${phrase.toUpperCase()} in the diff.`).some((f) => f.includes(phrase))).toBe(true);
    }
  });

  it('matches on word boundaries: "simply" flagged, "simplify" not', () => {
    expect(checkNarrationText('chunkLine', 'This simply works.').some((f) => f.includes('simply'))).toBe(true);
    expect(checkNarrationText('chunkLine', 'This will simplify the parser.').some((f) => f.includes('simply'))).toBe(false);
  });

  it('passes clean orienting prose', () => {
    expect(checkNarrationText('intro', 'This file wires the parser to the new token stream.')).toEqual([]);
  });
});

describe('fleschScore backtick collapse', () => {
  it('scores an identifier-laden sentence higher when identifiers are backticked', () => {
    const backticked = 'Call `validatePermutation` before `applyOrderOverlay` runs the reorder.';
    const plain = 'Call validatePermutation before applyOrderOverlay runs the reorder.';
    expect(fleschScore(backticked)).toBeGreaterThan(fleschScore(plain));
  });

  it('is deterministic', () => {
    const text = 'A tired reviewer wants short words and short lines.';
    expect(fleschScore(text)).toBe(fleschScore(text));
  });
});

describe('chunkNarrationFingerprint', () => {
  it('is order-independent and changes only with head, CORE_VERSION, or chunk id', () => {
    expect(chunkNarrationFingerprint('h1', 'a.ts::x::1')).toBe(chunkNarrationFingerprint('h1', 'a.ts::x::1'));
    expect(chunkNarrationFingerprint('h2', 'a.ts::x::1')).not.toBe(chunkNarrationFingerprint('h1', 'a.ts::x::1'));
    expect(chunkNarrationFingerprint('h1', 'a.ts::x::2')).not.toBe(chunkNarrationFingerprint('h1', 'a.ts::x::1'));
  });
});

describe('filterFreshNarrationV2', () => {
  const overlay = (chunks: NarrationOverlayV2['chunks']): NarrationOverlayV2 => ({
    version: 2,
    model: 'test',
    promptVersion: 'narration-chunk-1',
    chunks,
  });

  it('keeps entries whose fingerprint matches the head and drops the rest', () => {
    const filtered = filterFreshNarrationV2('h1', overlay({
      'a.ts::x::1': { fingerprint: chunkNarrationFingerprint('h1', 'a.ts::x::1'), line: 'keep', generatedAt: 't' },
      'b.ts::y::2': { fingerprint: 'stale', badge: 'Drop me', generatedAt: 't' },
    }));
    expect(Object.keys(filtered.chunks)).toEqual(['a.ts::x::1']);
    expect(filtered.chunks['a.ts::x::1']!.line).toBe('keep');
  });

  it('fail-open drops everything on a malformed overlay', () => {
    const filtered = filterFreshNarrationV2('h1', { version: 2, model: 'm', promptVersion: 'p' } as never);
    expect(filtered.chunks).toEqual({});
  });
});

describe('checkBadgeText', () => {
  it('passes a calm two-word sentence-case badge', () => {
    expect(checkBadgeText('New endpoint')).toEqual([]);
    expect(checkBadgeText('Minor refactor')).toEqual([]);
  });

  it('tolerates up to four words and rejects a fifth', () => {
    expect(checkBadgeText('New public API route')).toEqual([]);
    expect(checkBadgeText('One two three four five').some((f) => f.includes('words'))).toBe(true);
  });

  it('rejects a non-sentence-case start and shouting, exempting acronyms and code tokens', () => {
    expect(checkBadgeText('new endpoint').some((f) => f.includes('sentence-case'))).toBe(true);
    expect(checkBadgeText('Big REFACTORING').some((f) => f.includes('all-caps'))).toBe(true);
    expect(checkBadgeText('New JSON parser')).toEqual([]);
    expect(checkBadgeText('New `useState` hook')).toEqual([]);
  });

  it('enforces the char cap and rejects empty', () => {
    expect(checkBadgeText('A'.repeat(31)).some((f) => f.includes('chars'))).toBe(true);
    expect(checkBadgeText('   ')).toEqual(['badge is empty']);
  });
});

describe('filterFreshNarration fail-open direction', () => {
  it('drops all narration on a malformed overlay instead of passing it through', () => {
    const malformed = { version: 1, model: 'm', promptVersion: 'p', opener: { text: 'stale', key: 'k' } } as never;
    const filtered = filterFreshNarration(book('h1', sample), 'h1', malformed);
    expect(filtered.sections).toEqual({});
    expect(filtered.opener.text).toBe('');
  });
});
