import { fnv1a } from './chunker.js';
import { type ImportGraph } from './import-graph.js';
import {
  type Book,
  type Chunk,
  type ChunkKind,
  CORE_VERSION,
  chunkTitle,
  isLowSignal,
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
  /** Low-signal section ids + '(leftovers)' if present, tier-0 order — never reorderable. */
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

/**
 * The AI ordering job's input (spec 02): per story-block section, its role, chunk summaries, and
 * import edges to other story sections; the low-signal tail and leftovers backstop are reported
 * but excluded from the permutable set.
 */
export function buildOrderManifest(book: Book, graph: ImportGraph, chunks: Chunk[]): OrderManifest {
  const storyFileIds = book.sections.filter((s) => s.id !== '(leftovers)').map((s) => s.id);
  const roles = fileRoles(storyFileIds, chunks, graph);
  const chunksById = new Map(chunks.map((c) => [c.id, c]));

  const storyKeys = new Set<string>();
  const sections: OrderManifestSection[] = [];
  const pinnedTail: string[] = [];

  for (const section of book.sections) {
    const role = section.id === '(leftovers)' ? undefined : roles.get(section.id);
    if (role === undefined || role === 'low-signal') {
      pinnedTail.push(section.id);
      continue;
    }
    storyKeys.add(section.id);
    sections.push({
      key: section.id,
      role,
      chunks: section.occurrences.map((o) => sectionChunkSummary(chunksById.get(o.chunkId)!)),
      imports: [],
    });
  }

  for (const importSection of sections) {
    const targets = new Set<string>();
    for (const edge of graph.edges) {
      if (edge.from === importSection.key && storyKeys.has(edge.to) && edge.to !== edge.from) targets.add(edge.to);
    }
    importSection.imports = [...targets];
  }

  const draft = { bookFingerprint: bookFingerprint(book), sections, pinnedTail };
  const estimatedTokens = Math.ceil(renderOrderManifest({ ...draft, estimatedTokens: 0 }).length / 4);
  return { ...draft, estimatedTokens };
}

function sectionChunkSummary(chunk: Chunk): OrderManifestSection['chunks'][number] {
  const lines = chunk.hunks.reduce((n, h) => n + Math.max(h.headCount, h.baseCount), 0);
  return {
    title: chunkTitle(chunk),
    kind: chunk.kind,
    lines,
    ...(isLowSignal(chunk) ? { stub: lowSignalReason(chunk) } : {}),
  };
}

/**
 * Compact plain-text rendering for the ordering model to read: one block per story section
 * (key, role, imports, chunk lines), then a single pinned-tail summary line. Deliberately plain
 * text, not JSON/markdown — the model reads it as prose, not as a structure to parse back.
 */
export function renderOrderManifest(manifest: OrderManifest): string {
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
 * the manifest's story-section keys, once each. Errors name offending keys, capped at a few.
 */
export function validatePermutation(manifest: OrderManifest, proposed: string[]): { ok: boolean; errors: string[] } {
  const expected = new Set(manifest.sections.map((s) => s.key));
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
 * Applies a persisted AI order overlay to a freshly compiled book (pure; door-stays-open —
 * the compile itself never sees the overlay). Returns `book` unchanged, by reference, when the
 * overlay is stale (fingerprint mismatch after a recompile) or its permutation fails validation
 * — an untrusted or outdated overlay fails open to tier 0, never a partial reorder. On success,
 * only the story block (impl + test + periphery) moves; the pinned tail keeps its tier-0
 * position after the story block, and occurrences are untouched.
 */
export function applyOrderOverlay(book: Book, graph: ImportGraph, chunks: Chunk[], overlay: OrderOverlay): Book {
  if (overlay.bookFingerprint !== bookFingerprint(book)) return book;

  const manifest = buildOrderManifest(book, graph, chunks);
  if (!validatePermutation(manifest, overlay.permutation).ok) return book;

  const sectionsById = new Map(book.sections.map((s) => [s.id, s]));
  const tailIds = new Set(manifest.pinnedTail);
  const reorderedStory = overlay.permutation.map((key) => sectionsById.get(key)!);
  const tail = book.sections.filter((s) => tailIds.has(s.id));
  return { ...book, sections: [...reorderedStory, ...tail] };
}
