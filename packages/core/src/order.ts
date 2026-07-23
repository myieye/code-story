import { type CompiledBook } from './book.js';
import { type ChapterComposition, type CompileChapterBookInput, compileChapterBook, validateChapterComposition } from './chapters.js';
import { fnv1a } from './chunker.js';
import { CALLS_DFS_KINDS, type ChunkGraph, edgesOfKinds } from './chunk-graph.js';
import { type ImportGraph } from './import-graph.js';
import {
  type Book,
  type Chunk,
  type ChunkKind,
  CORE_VERSION,
  chunkLineCount,
  chunkTitle,
  isLowSignal,
  LEFTOVERS_SECTION_ID,
  lowSignalReason,
} from './model.js';
import { fileRoles } from './roles.js';
import { type StoryConfig } from './story-config.js';

export interface OrderManifestSection {
  /** Section id (= file path). */
  key: string;
  role: 'impl' | 'test' | 'periphery';
  chunks: { title: string; kind: ChunkKind; lines: number; stub?: string }[];
  /** Section keys this file imports — manifest-internal edges only. */
  imports: string[];
}

export interface OrderManifest {
  bookFingerprint: string;
  /** Story block (impl + test + periphery) in tier-0 order — the block the AI may permute. */
  sections: OrderManifestSection[];
  /** Low-signal section ids + the leftovers backstop, tier-0 order — never reorderable. */
  pinnedTail: string[];
  estimatedTokens: number;
}

export interface OrderOverlay {
  version: 1;
  bookFingerprint: string;
  /** Story-block section keys in the AI's proposed order. */
  permutation: string[];
  rationales: Record<string, string>;
  model: string;
  promptVersion: string;
  createdAt: string;
  appliedAt?: string;
  dismissedAt?: string;
}

/**
 * Chapter-mode order overlay (spec 05, #77): the AI proposes a chapter partition of the story
 * chunks, not a section permutation. `rationales` are keyed by chapter section id
 * (`chapter:<anchorChunkId>`) so the web's section-header lookup works on the recomposed book.
 */
export interface OrderOverlayV2 {
  version: 2;
  bookFingerprint: string;
  /** The proposed chapter partition of the story chunk ids; each chapter's first id is its anchor. */
  chapters: string[][];
  rationales: Record<string, string>;
  model: string;
  promptVersion: string;
  createdAt: string;
  appliedAt?: string;
  dismissedAt?: string;
}

export type AnyOrderOverlay = OrderOverlay | OrderOverlayV2;

/**
 * Digest over the book's derived identity: head + CORE_VERSION + each section's occurrence
 * chunk ids in order. Chunk ids already embed content fingerprints, so this changes whenever
 * section membership, chunk content, or section order changes — not just the head. This is the
 * v1 (file-mode) overlay freshness key.
 */
export function bookFingerprint(book: Book): string {
  const parts = [book.headSha, CORE_VERSION];
  for (const section of book.sections) {
    parts.push(section.id, ...section.occurrences.map((o) => o.chunkId));
  }
  return fnv1a(parts.join('\0'));
}

/**
 * The v2 (chapter-mode) overlay freshness key: head + CORE_VERSION + the tier-0 story composition
 * (ordered chapters of story chunk ids). This is exactly what the ordering model is shown and
 * regroups — it deliberately excludes the woven-in tests, so flipping `testPlacement`
 * (before/after/end) leaves the key unchanged and reuses the overlay (#130; the prompt never sees
 * testPlacement anyway). It still changes on a direction flip (the spine reorders the composition),
 * a chunk-set or content change (ids embed content fingerprints), and any ordering-logic change
 * (CORE_VERSION).
 */
export function chapterOrderFingerprint(headSha: string, storyComposition: string[][]): string {
  const parts = [headSha, CORE_VERSION, 'chapter'];
  for (const chapter of storyComposition) parts.push('|', ...chapter);
  return fnv1a(parts.join('\0'));
}

/**
 * Whether a persisted overlay still matches the current derived inputs. v1 keys off the file-mode
 * book shape; v2 keys off the tier-0 story composition (`storyComposition`, required for a v2
 * verdict). A version/mode mismatch reads stale by construction: a v2 overlay with no composition,
 * or a v1 overlay checked against a chapter book, never matches — so switching chapter⇄file mode
 * invalidates as it must. An overlay whose stored key predates this scheme reads stale (regenerated);
 * it can never wrongly read fresh.
 */
export function isOverlayFresh(book: Book, overlay: AnyOrderOverlay, storyComposition?: string[][]): boolean {
  if (overlay.version === 2) {
    return storyComposition !== undefined && overlay.bookFingerprint === chapterOrderFingerprint(book.headSha, storyComposition);
  }
  return overlay.bookFingerprint === bookFingerprint(book);
}

/** The permutable story block and the pinned tail, both in book order. */
function storySplit(
  book: Book,
  graph: ImportGraph,
  chunks: Chunk[],
): { storyKeys: string[]; pinnedTail: string[]; roles: Map<string, string> } {
  const fileIds = book.sections.filter((s) => s.id !== LEFTOVERS_SECTION_ID).map((s) => s.id);
  const roles = fileRoles(fileIds, chunks, graph);
  const storyKeys: string[] = [];
  const pinnedTail: string[] = [];
  for (const section of book.sections) {
    const role = section.id === LEFTOVERS_SECTION_ID ? undefined : roles.get(section.id);
    if (role === undefined || role === 'low-signal') pinnedTail.push(section.id);
    else storyKeys.push(section.id);
  }
  return { storyKeys, pinnedTail, roles };
}

/** The AI ordering job's input: per story-block section, its role, chunk summaries, and imports. */
export function buildOrderManifest(book: Book, graph: ImportGraph, chunks: Chunk[]): OrderManifest {
  const { storyKeys, pinnedTail, roles } = storySplit(book, graph, chunks);
  const storyKeySet = new Set(storyKeys);
  const chunksById = new Map(chunks.map((c) => [c.id, c]));
  const sectionsById = new Map(book.sections.map((s) => [s.id, s]));

  const importsByFile = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    if (edge.from === edge.to || !storyKeySet.has(edge.from) || !storyKeySet.has(edge.to)) continue;
    (importsByFile.get(edge.from) ?? importsByFile.set(edge.from, new Set()).get(edge.from)!).add(edge.to);
  }

  const sections: OrderManifestSection[] = storyKeys.map((key) => ({
    key,
    role: roles.get(key) as 'impl' | 'test' | 'periphery',
    chunks: sectionsById.get(key)!.occurrences.map((o) => sectionChunkSummary(chunksById.get(o.chunkId)!)),
    imports: [...(importsByFile.get(key) ?? [])],
  }));

  const draft = { bookFingerprint: bookFingerprint(book), sections, pinnedTail };
  const estimatedTokens = Math.ceil(renderOrderManifest(draft).length / 4);
  return { ...draft, estimatedTokens };
}

function sectionChunkSummary(chunk: Chunk): OrderManifestSection['chunks'][number] {
  return {
    title: chunkTitle(chunk),
    kind: chunk.kind,
    lines: chunkLineCount(chunk),
    ...(isLowSignal(chunk) ? { stub: lowSignalReason(chunk) } : {}),
  };
}

/**
 * Compact plain-text rendering for the ordering model to read: one block per story section
 * (key, role, imports, chunk lines), then a single pinned-tail summary line. Deliberately plain
 * text, not JSON/markdown — the model reads it as prose, not as a structure to parse back.
 */
export function renderOrderManifest(manifest: Omit<OrderManifest, 'estimatedTokens'>): string {
  const blocks = manifest.sections.map((section) => {
    const importsLine = section.imports.length > 0 ? ` imports: ${section.imports.join(', ')}` : '';
    const chunkLines = section.chunks.map(
      (c) => `  - ${c.title} (${c.kind}, ~${c.lines} lines)${c.stub ? ` [stub: ${c.stub}]` : ''}`,
    );
    return [`${section.key} [${section.role}]${importsLine}`, ...chunkLines].join('\n');
  });
  const tailLine = `${manifest.pinnedTail.length} pinned tail section${manifest.pinnedTail.length === 1 ? '' : 's'} (not reorderable)`;
  return [...blocks, tailLine].join('\n\n');
}

/**
 * Script-enforced permutation check (R-024, not prompt trust): `proposed` must contain exactly
 * the story-block keys, once each. Errors name offending keys, capped at a few.
 */
export function validatePermutation(storyKeys: string[], proposed: string[]): { ok: boolean; errors: string[] } {
  const expected = new Set(storyKeys);
  const proposedSeen = new Set<string>();
  const unknown: string[] = [];
  const duplicated: string[] = [];

  for (const key of proposed) {
    if (proposedSeen.has(key)) duplicated.push(key);
    else proposedSeen.add(key);
    if (!expected.has(key)) unknown.push(key);
  }
  const missing = [...expected].filter((key) => !proposedSeen.has(key));

  const cap = (keys: string[]) => keys.slice(0, 5).join(', ');
  const errors: string[] = [];
  if (missing.length > 0) errors.push(`missing from permutation: ${cap(missing)}`);
  if (unknown.length > 0) errors.push(`not a story section: ${cap(unknown)}`);
  if (duplicated.length > 0) errors.push(`duplicated: ${cap(duplicated)}`);

  return { ok: errors.length === 0, errors };
}

/**
 * Applies a persisted AI order overlay to a freshly compiled book (pure — the compile itself
 * never sees the overlay). Returns `book` unchanged, by reference, when the overlay is stale or
 * its permutation fails validation: an untrusted or outdated overlay fails open to tier 0,
 * never a partial reorder. On success only the story block moves; the pinned tail keeps its
 * position after it, and occurrences are untouched.
 */
export function applyOrderOverlay(book: Book, graph: ImportGraph, chunks: Chunk[], overlay: OrderOverlay): Book {
  if (!isOverlayFresh(book, overlay)) return book;

  const { storyKeys, pinnedTail } = storySplit(book, graph, chunks);
  if (!validatePermutation(storyKeys, overlay.permutation).ok) return book;

  const sectionsById = new Map(book.sections.map((s) => [s.id, s]));
  const reorderedStory = overlay.permutation.map((key) => sectionsById.get(key)!);
  const tail = pinnedTail.map((key) => sectionsById.get(key)!);
  return { ...book, sections: [...reorderedStory, ...tail] };
}

export interface ChunkOrderManifest {
  /** The tier-0 story-composition freshness key (`chapterOrderFingerprint`) the resulting overlay carries. */
  bookFingerprint: string;
  /** Story chunks in tier-0 order — the chunks the model may regroup. Tests/low-signal/leftovers omitted. */
  chunks: { id: string; title: string; kind: ChunkKind; lines: number; file: string }[];
  /** `calls` edges among story chunks, each with its first call-site line. */
  calls: { fromId: string; toId: string; fromLine: number }[];
  /** The deterministic tier-0 grouping — the model's starting point (= storyComposition). */
  tier0Chapters: string[][];
}

/**
 * The chapter-mode ordering job's input (spec 05, #77): the story chunks, their `calls` edges, and
 * the tier-0 grouping to start from. Tests, low-signal, and leftovers are placed deterministically
 * by the applier, so they never enter the manifest — the model only regroups story chunks.
 */
export function buildChunkOrderManifest(
  book: Book,
  chunks: Chunk[],
  chunkGraph: ChunkGraph,
  storyComposition: string[][],
): ChunkOrderManifest {
  const storyIds = storyComposition.flat();
  const storyIdSet = new Set(storyIds);
  const chunkById = new Map(chunks.map((c) => [c.id, c]));

  const manifestChunks = storyIds.map((id) => {
    const chunk = chunkById.get(id)!;
    return { id, title: chunkTitle(chunk), kind: chunk.kind, lines: chunkLineCount(chunk), file: chunk.file };
  });

  const calls = edgesOfKinds(chunkGraph.edges, CALLS_DFS_KINDS)
    .filter((e) => storyIdSet.has(e.from) && storyIdSet.has(e.to) && e.from !== e.to)
    .map((e) => ({ fromId: e.from, toId: e.to, fromLine: e.fromLines[0]?.start ?? 0 }));

  return {
    bookFingerprint: chapterOrderFingerprint(book.headSha, storyComposition),
    chunks: manifestChunks,
    calls,
    tier0Chapters: storyComposition,
  };
}

/**
 * Compact plain-text rendering of the chunk-order manifest for the model to read: one line per story
 * chunk, a `calls:` block, and the tier-0 grouping as numbered chapters. `labelOf` maps each chunk id
 * to the text the model sees (the server passes short aliases; the identity default renders raw ids).
 * Plain text, not JSON — the model reads it as prose (mirrors `renderOrderManifest`).
 */
export function renderChunkOrderManifest(manifest: ChunkOrderManifest, labelOf: (id: string) => string = (id) => id): string {
  const chunkLines = manifest.chunks.map((c) => `${labelOf(c.id)} — ${c.title} (${c.kind}, ~${c.lines} lines) [${c.file}]`);
  const callLines = manifest.calls.map((e) => `${labelOf(e.fromId)} -> ${labelOf(e.toId)} (line ${e.fromLine})`);
  const callsBlock = ['calls:', ...(callLines.length > 0 ? callLines : ['(none)'])].join('\n');
  const chapterLines = manifest.tier0Chapters.map((ids, i) => `${i + 1}. ${ids.map((id) => labelOf(id)).join(', ')}`);
  const note = 'The grouping above is a starting point; regroup and reorder the chunks into chapters.';
  return [chunkLines.join('\n'), callsBlock, chapterLines.join('\n'), note].join('\n\n');
}

/**
 * Applies a chapter-mode order overlay (spec 05, #77). Fail-open: compiles the tier-0 chapter book,
 * then returns `undefined` unless the overlay is fresh against it AND its composition is an exact
 * partition of the tier-0 story chunks; on success it returns the recomposed book. Unlike
 * `applyOrderOverlay` (which returns the tier-0 book by reference on failure), this returns
 * `undefined` on failure so the caller can tell "applied" from "fell open to tier 0".
 */
export function applyChapterOverlay(
  input: CompileChapterBookInput,
  config: StoryConfig,
  overlay: OrderOverlayV2,
): CompiledBook | undefined {
  const tier0 = compileChapterBook(input, config);
  if (!isOverlayFresh(tier0.book, overlay, tier0.storyComposition)) return undefined;
  if (!validateChapterComposition(tier0.storyComposition.flat(), overlay.chapters).ok) return undefined;
  return compileChapterBook(input, config, { chapters: overlay.chapters } satisfies ChapterComposition);
}
