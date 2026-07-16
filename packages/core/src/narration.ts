import { fnv1a } from './chunker.js';
import { type Book, CORE_VERSION, type Section } from './model.js';

export type NarrationKind = 'opener' | 'intro' | 'chunkLine';

export interface NarrationSectionEntry {
  fingerprint: string;
  intro: string;
  /** chunk id → its one-line orientation; a chunk recurring in the section shares one line. */
  chunks: Record<string, string>;
  generatedAt: string;
  /** Register-gate failures that dropped this entry's narration; presence still counts as "generated". */
  gateFailures?: string[];
}

export interface NarrationOverlay {
  version: 1;
  model: string;
  promptVersion: string;
  opener: { text: string; key: string };
  /** Keyed by Book section id (the changed-file path). */
  sections: Record<string, NarrationSectionEntry>;
}

/**
 * Per-section identity that survives the order overlay: fnv1a over head + CORE_VERSION + section
 * id + the section's chunk ids in stable within-section order. Independent of where the section
 * sits in the book, so reordering never invalidates narration; a CORE_VERSION bump or new head
 * still does (spec 03 runtime shape).
 */
export function sectionFingerprint(headSha: string, section: Section): string {
  const parts = [headSha, CORE_VERSION, section.id, ...section.occurrences.map((o) => o.chunkId)];
  return fnv1a(parts.join('\0'));
}

/** Opener identity: fnv1a over the sorted set of the book's section fingerprints. */
export function narrationOpenerKey(book: Book, headSha: string): string {
  const fingerprints = [...new Set(book.sections.map((s) => sectionFingerprint(headSha, s)))].sort();
  return fnv1a(fingerprints.join('\0'));
}

/**
 * Drops overlay entries whose section is gone or whose fingerprint no longer matches, and clears
 * the opener text unless its key still matches the current book. Fail-open like applyOrderOverlay:
 * any unexpected shape returns the overlay untouched rather than throwing.
 */
export function filterFreshNarration(book: Book, headSha: string, overlay: NarrationOverlay): NarrationOverlay {
  try {
    const sectionById = new Map(book.sections.map((s) => [s.id, s]));
    const sections: Record<string, NarrationSectionEntry> = {};
    for (const [key, entry] of Object.entries(overlay.sections)) {
      const section = sectionById.get(key);
      if (section && sectionFingerprint(headSha, section) === entry.fingerprint) sections[key] = entry;
    }
    const openerKey = narrationOpenerKey(book, headSha);
    const opener = overlay.opener.key === openerKey ? overlay.opener : { text: '', key: openerKey };
    return { ...overlay, opener, sections };
  } catch {
    return overlay;
  }
}

export const NARRATION_CAPS = {
  opener: { maxSentences: 3, maxChars: 320 },
  intro: { maxSentences: 2, maxChars: 200 },
  chunkLine: { maxSentences: 1, maxChars: 110 },
} as const;

/** Hard sentence-length cap for opener/intro only (a chunk line's char cap binds tighter). */
export const MAX_SENTENCE_WORDS = 22;

/**
 * Evaluative/reassuring language the register gate rejects (R-026 anchoring gate). Word-boundary,
 * case-insensitive. Exported so dogfood findings can grow it.
 */
export const BANNED_PHRASES = [
  'looks good',
  'correctly',
  'as expected',
  'simply',
  'elegant',
  'safe to',
  'just a',
  'clean refactor',
  'perfect',
  'trivial',
  'no issues',
];

function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

function bannedRegex(phrase: string): RegExp {
  return new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
}

/** Register gate: human-readable failure strings, empty = pass. Run before a section persists. */
export function checkNarrationText(kind: NarrationKind, text: string): string[] {
  const caps = NARRATION_CAPS[kind];
  const failures: string[] = [];

  if (text.length > caps.maxChars) failures.push(`${kind} is ${text.length} chars (max ${caps.maxChars})`);

  const sentences = splitSentences(text);
  if (sentences.length > caps.maxSentences) {
    failures.push(`${kind} has ${sentences.length} sentences (max ${caps.maxSentences})`);
  }

  if (kind !== 'chunkLine') {
    for (const sentence of sentences) {
      const words = countWords(sentence);
      if (words > MAX_SENTENCE_WORDS) failures.push(`${kind} sentence has ${words} words (max ${MAX_SENTENCE_WORDS})`);
    }
  }

  for (const phrase of BANNED_PHRASES) {
    if (bannedRegex(phrase).test(text)) failures.push(`judgmental phrase "${phrase}"`);
  }

  return failures;
}

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length === 0) return 0;
  const groups = w.match(/[aeiouy]+/g)?.length ?? 0;
  return Math.max(1, w.endsWith('e') && groups > 1 ? groups - 1 : groups);
}

/**
 * Flesch reading ease with each `backtick-quoted span` collapsed to a one-syllable token first, so
 * an identifier doesn't tank a genuinely light sentence. Soft signal recorded by the eval — never
 * a checkNarrationText failure (spec 03 killed Flesch-as-hard-gate).
 */
export function fleschScore(text: string): number {
  const collapsed = text.replace(/`[^`]*`/g, ' code ');
  const words = collapsed.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = Math.max(1, words.length);
  const sentenceCount = Math.max(1, splitSentences(collapsed).length);
  const syllables = words.reduce((n, w) => n + countSyllables(w), 0);
  return 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllables / wordCount);
}
