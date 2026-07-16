import { fnv1a } from './chunker.js';
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
 * Digest over the book's derived identity: head + CORE_VERSION + each section's occurrence
 * chunk ids in order. Chunk ids already embed content fingerprints, so this changes whenever
 * section membership, chunk content, or section order changes — not just the head.
 */
export function bookFingerprint(book: Book): string {
  const parts = [book.headSha, CORE_VERSION];
  for (const section of book.sections) {
    parts.push(section.id, ...section.occurrences.map((o) => o.chunkId));
  }
  return fnv1a(parts.join('\0'));
}

/** A persisted overlay is only usable against the exact book it was computed for. */
export function isOverlayFresh(book: Book, overlay: OrderOverlay): boolean {
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
