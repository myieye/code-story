import { fnv1a } from './chunker.js';
import { type ContextDefinition, type ContextPayload } from './context.js';
import { type FileContents } from './export.js';
import { type ImportGraph } from './import-graph.js';
import {
  type Book,
  type Chunk,
  type ChunkKind,
  chunkLineCount,
  chunkTitle,
  CORE_VERSION,
  isLowSignal,
  type Section,
} from './model.js';
import { unifiedChunkLines } from './render.js';
import { type FileRole, fileRoles } from './roles.js';

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
  /** Empty text = no opener; `failures` says why generation fell open (#44 — never fail silently). */
  opener: { text: string; key: string; failures?: string[] };
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
 * the opener text unless its key still matches the current book. Fail-open means "no narration",
 * never "unvalidated narration": an unexpected shape drops everything ("faithful or silent",
 * spec 03) — the inverse of applyOrderOverlay, whose safe direction is the unchanged book.
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
    return { ...overlay, opener: { text: '', key: '' }, sections: {} };
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

/** Per-call diff budget (spec 03 runtime shape); reuses the order manifest's ~4-chars-per-token heuristic. */
export const NARRATION_INPUT_TOKEN_CAP = 6000;

/**
 * Separate, additive budget for the context-definitions block (spec 04 narration bridge). It sits
 * on top of the 6k diff cap — diff text keeps absolute priority, a definition never evicts or
 * shrinks a chunk's own diff — so the whole input can reach ~8k. Definitions past this cap are
 * dropped whole, with an in-block omission marker.
 */
export const NARRATION_DEFINITIONS_TOKEN_CAP = 2000;

export interface NarrationChunkInput {
  id: string;
  title: string;
  kind: ChunkKind;
  lines: number;
  /** Rendered unified diff; absent when the chunk was dropped for budget (see `omitted`) or has no fetchable content. */
  diff?: string;
}

export interface SectionNarrationInput {
  /** Section id = the changed-file path. */
  key: string;
  role: FileRole;
  /** Other changed files this section imports. */
  imports: string[];
  /** Other changed files that import this section. */
  importedBy: string[];
  chunks: NarrationChunkInput[];
  /** Chunk ids whose diff didn't fit the budget — the job records these as gateFailures (never narrate code the model didn't see). */
  omitted: string[];
  /** Deduped callee definitions the section references, capped at their own additive budget; absent when no payloads were supplied. */
  definitions?: ContextDefinition[];
  /** How many further definitions were dropped for the definitions budget (rendered as an in-block marker). */
  definitionsOmitted?: number;
  estimatedTokens: number;
}

/** Unified-diff text for a chunk, built from its hunks (never re-diffed); empty string when no content is fetchable. */
function chunkDiffText(chunk: Chunk, contents: FileContents | undefined): string {
  const marks = { add: '+', del: '-', context: ' ' } as const;
  return unifiedChunkLines(chunk, contents)
    .map((line) => (line.type === 'gap' ? '…' : `${marks[line.type]}${line.text}`))
    .join('\n');
}

/**
 * The per-section narration prompt input: section role, its cross-file import edges, and each
 * non-low-signal chunk's id, metadata, and diff — capped at ~6k tokens. Chunks past the cap keep
 * their id and metadata but lose their diff and land in `omitted`, so the job can record them as
 * gateFailures rather than narrate code the model never saw. Low-signal stubs are excluded here.
 *
 * `payloads` (chunk id → context payload, spec 04) is optional and purely additive: when supplied,
 * the section's referenced callee definitions are deduped and appended as a marked context block
 * under their own budget. The diff-budget loop runs first and never sees them, so definitions can
 * never evict a chunk's diff.
 */
export function buildSectionNarrationInput(
  section: Section,
  chunks: Chunk[],
  graph: ImportGraph,
  contents: Map<string, FileContents>,
  payloads?: Map<string, ContextPayload>,
): SectionNarrationInput {
  const chunksById = new Map(chunks.map((c) => [c.id, c]));
  const role = fileRoles([section.id], chunks, graph).get(section.id) ?? 'impl';

  const imports = new Set<string>();
  const importedBy = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.from === edge.to) continue;
    if (edge.from === section.id) imports.add(edge.to);
    if (edge.to === section.id) importedBy.add(edge.from);
  }

  const seen = new Set<string>();
  const narratable: Chunk[] = [];
  for (const occurrence of section.occurrences) {
    const chunk = chunksById.get(occurrence.chunkId);
    if (!chunk || isLowSignal(chunk) || seen.has(chunk.id)) continue;
    seen.add(chunk.id);
    narratable.push(chunk);
  }

  const base = {
    key: section.id,
    role,
    imports: [...imports],
    importedBy: [...importedBy],
  };
  const diffs = narratable.map((c) => chunkDiffText(c, contents.get(c.file)));
  const entries: NarrationChunkInput[] = narratable.map((c) => ({
    id: c.id,
    title: chunkTitle(c),
    kind: c.kind,
    lines: chunkLineCount(c),
  }));

  const omitted: string[] = [];
  let overBudget = false;
  for (let i = 0; i < entries.length; i++) {
    if (overBudget) {
      omitted.push(entries[i]!.id);
      continue;
    }
    entries[i]!.diff = diffs[i];
    const rendered = renderSectionNarrationInput({ ...base, chunks: entries, omitted });
    if (Math.ceil(rendered.length / 4) > NARRATION_INPUT_TOKEN_CAP) {
      entries[i]!.diff = undefined;
      overBudget = true;
      omitted.push(entries[i]!.id);
    }
  }

  // Definitions are collected and budgeted only after the diff loop settles, so they sit on top of
  // the 6k diff cap rather than competing with it. No payloads => the fields stay absent entirely.
  const defs = payloads ? capDefinitions(collectDefinitions(narratable, payloads)) : undefined;

  const draft = {
    ...base,
    chunks: entries,
    omitted,
    ...(defs ? { definitions: defs.definitions, definitionsOmitted: defs.definitionsOmitted } : {}),
  };
  return { ...draft, estimatedTokens: Math.ceil(renderSectionNarrationInput(draft).length / 4) };
}

/** Callee definitions for the section's narratable chunks, deduped by (file, symbol), first occurrence kept. */
function collectDefinitions(narratable: Chunk[], payloads: Map<string, ContextPayload>): ContextDefinition[] {
  const seen = new Set<string>();
  const definitions: ContextDefinition[] = [];
  for (const chunk of narratable) {
    for (const def of payloads.get(chunk.id)?.facts.definitions ?? []) {
      const key = `${def.file}\0${def.symbol}`;
      if (seen.has(key)) continue;
      seen.add(key);
      definitions.push(def);
    }
  }
  return definitions;
}

/** Keeps whole definitions in order while the rendered block stays under its own ~2k budget; the rest are dropped. */
function capDefinitions(all: ContextDefinition[]): { definitions: ContextDefinition[]; definitionsOmitted: number } {
  const kept: ContextDefinition[] = [];
  for (const def of all) {
    const trial = [...kept, def];
    const rendered = renderDefinitionsBlock(trial, all.length - trial.length);
    if (Math.ceil(rendered.length / 4) > NARRATION_DEFINITIONS_TOKEN_CAP) break;
    kept.push(def);
  }
  return { definitions: kept, definitionsOmitted: all.length - kept.length };
}

/**
 * Deterministic plain-text rendering of one section's narration input for the prompt: a header
 * (key, role, import edges), then one block per chunk with its exact id, metadata, and diff.
 * Plain text, following renderOrderManifest — the model reads it, it does not parse it back.
 */
export function renderSectionNarrationInput(input: Omit<SectionNarrationInput, 'estimatedTokens'>): string {
  const header = [`${input.key} [${input.role}]`];
  if (input.imports.length > 0) header.push(`imports: ${input.imports.join(', ')}`);
  if (input.importedBy.length > 0) header.push(`imported by: ${input.importedBy.join(', ')}`);

  const blocks = input.chunks.map((chunk) => {
    const meta = `chunk ${chunk.id}\n  ${chunk.title} (${chunk.kind}, ~${chunk.lines} lines)`;
    if (chunk.diff === undefined) return `${meta}\n  (diff omitted — over token budget)`;
    if (chunk.diff === '') return `${meta}\n  (no diff content available)`;
    return `${meta}\n${chunk.diff}`;
  });

  const parts = [header.join('\n'), ...blocks];
  const definitions = renderDefinitionsBlock(input.definitions ?? [], input.definitionsOmitted ?? 0);
  if (definitions !== '') parts.push(definitions);
  return parts.join('\n\n');
}

/**
 * The additive context block, marked plainly as not-diff. One entry per deduped definition
 * (`symbol — file` caption, then its head body), with a trailing marker when the budget dropped
 * some. Empty when there are no definitions and none were dropped — no bare header (spec 04).
 * Kept inert for current prompts: a renderer that doesn't know the block just includes it verbatim.
 */
function renderDefinitionsBlock(definitions: ContextDefinition[], omitted: number): string {
  if (definitions.length === 0 && omitted === 0) return '';
  const entries = definitions.map((def) => `${def.symbol} — ${def.file}\n${def.body}`);
  if (omitted > 0) {
    entries.push(`… (${omitted} more definition${omitted === 1 ? '' : 's'} omitted — over context budget)`);
  }
  return ['context — not part of the diff', ...entries].join('\n\n');
}

/** Per-chunk narration entry (spec 06 slice 5). Order-independent — the order overlay never touches it. */
export interface NarrationEntryV2 {
  /** fnv1a(headSha + CORE_VERSION + chunkId) — independent of where the chunk sits in the book. */
  fingerprint: string;
  line?: string;
  /** Usually 2 words, never more than 4; sentence-case. Absent when the badge gate dropped it. */
  badge?: string;
  generatedAt: string;
  /** Register/badge-gate failures or a budget omission; presence still counts the chunk "handled" on resume. */
  gateFailures?: string[];
}

/**
 * Chunk-keyed narration (spec 06 slice 5) — its own file, the v1 section overlay untouched. Chapter
 * mode reads only this; file mode keeps the v1 section intros.
 */
export interface NarrationOverlayV2 {
  version: 2;
  model: string;
  promptVersion: string;
  /** Keyed by chunk id. */
  chunks: Record<string, NarrationEntryV2>;
}

/** Per-chunk narration identity that survives reordering: fnv1a over head + CORE_VERSION + chunk id. */
export function chunkNarrationFingerprint(headSha: string, chunkId: string): string {
  return fnv1a([headSha, CORE_VERSION, chunkId].join('\0'));
}

/**
 * Drops v2 entries whose fingerprint no longer matches the current head (stale head or CORE_VERSION
 * bump). Fail-open means "no narration", never "unvalidated narration": an unexpected shape drops
 * everything ("faithful or silent", spec 03).
 */
export function filterFreshNarrationV2(headSha: string, overlay: NarrationOverlayV2): NarrationOverlayV2 {
  try {
    const chunks: Record<string, NarrationEntryV2> = {};
    for (const [chunkId, entry] of Object.entries(overlay.chunks)) {
      if (chunkNarrationFingerprint(headSha, chunkId) === entry.fingerprint) chunks[chunkId] = entry;
    }
    return { ...overlay, chunks };
  } catch {
    return { ...overlay, chunks: {} };
  }
}

export const BADGE_MAX_WORDS = 4;
export const BADGE_MAX_CHARS = 30;

/**
 * All-caps word the badge gate rejects as shouting. Code-ish tokens (any non-letter char — digits,
 * dots, underscores, backticks) and short acronyms (≤5 letters, e.g. API/JSON/HTTPS) are exempt.
 */
function isShout(word: string): boolean {
  if (/[^A-Za-z]/.test(word)) return false;
  if (word.length <= 5) return false;
  return word === word.toUpperCase() && word !== word.toLowerCase();
}

/**
 * The lighter badge gate (spec 06 slice 5): length + word-count caps and sentence-case only — no
 * judgment-lint (deferred). Empty = pass. A failing badge is dropped; the chunk's line may survive.
 */
export function checkBadgeText(text: string): string[] {
  const trimmed = text.trim();
  const failures: string[] = [];
  if (trimmed.length === 0) return ['badge is empty'];
  if (trimmed.length > BADGE_MAX_CHARS) failures.push(`badge is ${trimmed.length} chars (max ${BADGE_MAX_CHARS})`);

  const words = trimmed.split(/\s+/);
  if (words.length > BADGE_MAX_WORDS) failures.push(`badge has ${words.length} words (max ${BADGE_MAX_WORDS})`);
  if (!/^[A-Z]/.test(trimmed)) failures.push('badge is not sentence-case (first letter must be uppercase)');
  for (const word of words) {
    if (isShout(word)) failures.push(`badge word "${word}" is all-caps`);
  }
  return failures;
}

export interface ParsedNarrationReply {
  intro: string;
  /** Sparse by design: a subset of the section's chunk ids, each mapped to its one-line orientation. */
  chunks: Record<string, string>;
}

/**
 * Validates one model reply against a section: `intro` must be a string, and every `chunks` key must
 * be one of the section's chunk ids (unknown keys reject the whole reply — never attach a line to a
 * chunk the section doesn't own). Missing keys are fine; sparse is the design. Register/judgment is
 * not checked here — that's checkNarrationText's job.
 */
export function parseNarrationReply(
  section: Section,
  json: unknown,
): { ok: true; reply: ParsedNarrationReply } | { ok: false; error: string } {
  if (typeof json !== 'object' || json === null) return { ok: false, error: 'reply is not an object' };
  const obj = json as { intro?: unknown; chunks?: unknown };
  if (typeof obj.intro !== 'string') return { ok: false, error: 'reply has no "intro" string' };

  const validIds = [...new Set(section.occurrences.map((o) => o.chunkId))];
  const chunks: Record<string, string> = {};
  if (obj.chunks !== undefined) {
    if (typeof obj.chunks !== 'object' || obj.chunks === null) return { ok: false, error: '"chunks" is not an object' };
    for (const [id, line] of Object.entries(obj.chunks as Record<string, unknown>)) {
      const resolved = resolveChunkId(id, validIds);
      if (resolved === undefined) return { ok: false, error: `unknown chunk id in reply: ${id}` };
      if (typeof line !== 'string') return { ok: false, error: `chunk line for ${id} is not a string` };
      chunks[resolved] = line;
    }
  }
  return { ok: true, reply: { intro: obj.intro, chunks } };
}

/**
 * Models echo chunk ids (`file::symbolPath::fingerprint`) as suffix fragments — dogfood 4 lost
 * 13/31 sections to `mqxhkf`-style keys (#44). A key that matches exactly one id fully or on a
 * `::` boundary is accepted; anything ambiguous or unmatched still rejects the reply.
 */
function resolveChunkId(key: string, validIds: string[]): string | undefined {
  // Models also copy the rendered "chunk <id>" line label into the key (dogfood 4, second run).
  const bare = key.replace(/^chunk\s+/, '');
  if (validIds.includes(bare)) return bare;
  const matches = validIds.filter((id) => id.endsWith(`::${bare}`));
  return matches.length === 1 ? matches[0] : undefined;
}

export interface ChunkNarrationBatchChunk {
  /** `c1..cN` — the model never sees a raw chunk id (#44). */
  alias: string;
  id: string;
  title: string;
  kind: ChunkKind;
  lines: number;
  /** Absent when the diff was dropped for budget (see `omitted`) or the chunk has no content. */
  diff?: string;
}

export interface ChunkNarrationBatch {
  file: string;
  chunks: ChunkNarrationBatchChunk[];
  /** Chunk ids whose diff didn't fit the budget — the task records these as gateFailures (never narrate unseen code). */
  omitted: string[];
}

function chunkRangeStart(chunk: Chunk): number {
  return chunk.headRange?.start ?? chunk.baseRange?.start ?? 0;
}

/**
 * One file's chunks as an aliased, budgeted prompt input (spec 06 slice 5): sorted by file position,
 * aliased `c1..cN`, each with its diff under the shared ~6k-token cap. Chunks past the cap keep alias
 * and metadata but lose their diff and land in `omitted`, so the task records them rather than
 * narrate code the model never saw. Order-independent by design — it groups by file, not section, so
 * the order overlay can never invalidate a run.
 */
export function buildChunkNarrationBatch(
  file: string,
  chunks: Chunk[],
  contents: FileContents | undefined,
): ChunkNarrationBatch {
  const ordered = [...chunks].sort((a, b) => chunkRangeStart(a) - chunkRangeStart(b));
  const entries: ChunkNarrationBatchChunk[] = ordered.map((c, i) => ({
    alias: `c${i + 1}`,
    id: c.id,
    title: chunkTitle(c),
    kind: c.kind,
    lines: chunkLineCount(c),
  }));
  const diffs = ordered.map((c) => chunkDiffText(c, contents));

  const omitted: string[] = [];
  let overBudget = false;
  for (let i = 0; i < entries.length; i++) {
    if (overBudget) {
      omitted.push(entries[i]!.id);
      continue;
    }
    entries[i]!.diff = diffs[i];
    const rendered = renderChunkNarrationBatch({ file, chunks: entries, omitted });
    if (Math.ceil(rendered.length / 4) > NARRATION_INPUT_TOKEN_CAP) {
      entries[i]!.diff = undefined;
      overBudget = true;
      omitted.push(entries[i]!.id);
    }
  }
  return { file, chunks: entries, omitted };
}

/**
 * Deterministic plain-text rendering of one file batch: a `File:` header then one block per chunk
 * with its alias, metadata, and diff. Plain text — the model reads it, it does not parse it back.
 */
export function renderChunkNarrationBatch(batch: ChunkNarrationBatch): string {
  const blocks = batch.chunks.map((chunk) => {
    const meta = `${chunk.alias} — ${chunk.title} (${chunk.kind}, ~${chunk.lines} lines)`;
    if (chunk.diff === undefined) return `${meta}\n  (diff omitted — over token budget)`;
    if (chunk.diff === '') return `${meta}\n  (no diff content available)`;
    return `${meta}\n${chunk.diff}`;
  });
  return [`File: ${batch.file}`, ...blocks].join('\n\n');
}

/**
 * Validates one chunk-narration reply against a batch: every key must be one of the batch's aliases
 * (a foreign alias rejects the whole reply — never attach text to a chunk the batch doesn't own), and
 * each entry's `line`/`badge` must be strings when present. Sparse is fine; register/badge gates are
 * the task's job. Returns chunk-id-keyed entries.
 */
export function parseChunkNarrationReply(
  batch: ChunkNarrationBatch,
  json: unknown,
): { ok: true; entries: Record<string, { line?: string; badge?: string }> } | { ok: false; error: string } {
  if (typeof json !== 'object' || json === null) return { ok: false, error: 'reply is not an object' };
  const idOf = new Map(batch.chunks.map((c) => [c.alias, c.id]));
  const entries: Record<string, { line?: string; badge?: string }> = {};
  for (const [alias, value] of Object.entries(json as Record<string, unknown>)) {
    const id = idOf.get(alias);
    if (id === undefined) return { ok: false, error: `unknown chunk alias in reply: ${alias}` };
    if (typeof value !== 'object' || value === null) return { ok: false, error: `entry for ${alias} is not an object` };
    const { line, badge } = value as { line?: unknown; badge?: unknown };
    if (line !== undefined && typeof line !== 'string') return { ok: false, error: `line for ${alias} is not a string` };
    if (badge !== undefined && typeof badge !== 'string') return { ok: false, error: `badge for ${alias} is not a string` };
    entries[id] = { ...(line !== undefined ? { line } : {}), ...(badge !== undefined ? { badge } : {}) };
  }
  return { ok: true, entries };
}
