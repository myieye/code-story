import { type Book, type Chunk, chunkTitle, isLowSignal, isNarratableSection, lowSignalReason } from './model.js';
import type { NarrationOverlay } from './narration.js';

export interface FileContents {
  /** Head-side lines (1-based indexing via line - 1); absent for deleted files. */
  head?: string[];
  /** Base-side lines; absent for added files. */
  base?: string[];
}

export interface ExportBookInput {
  book: Book;
  chunks: Chunk[];
  /**
   * Keyed by the chunk's file path (head side; base side for deletions). Files with no
   * fetchable content — binary, submodules — are absent.
   */
  contents: Map<string, FileContents>;
  /** Shown in the top heading, e.g. `origin/develop..HEAD`. */
  title: string;
  /**
   * AI narration to embed as `> AI:` blockquotes (spec 03): opener under the title, section intro
   * under its heading, chunk lines above their fences. Pass the overlay already filtered fresh for
   * this book. A partial overlay adds an "AI narration: N of M sections" header so bare sections
   * read as not-yet-narrated, never as nothing-to-see.
   */
  narration?: NarrationOverlay;
}

/** Renders the book as markdown — R-005's machine-assessable artifact and the R-034 eval input. */
export function exportBookMarkdown(input: ExportBookInput): string {
  const byId = new Map(input.chunks.map((c) => [c.id, c]));
  const chunkCount = input.book.sections.reduce((n, s) => n + s.occurrences.length, 0);
  const narration = input.narration;

  const out: string[] = [
    `# Code story — ${input.title}`,
    '',
    `${chunkCount} chunks · ${input.book.sections.length} sections · head ${input.book.headSha.slice(0, 8)}`,
    '',
  ];

  if (narration) {
    const narratable = narratableSectionIds(input.book, byId);
    const narrated = narratable.filter((id) => narration.sections[id]).length;
    if (narrated < narratable.length) out.push(`> AI narration: ${narrated} of ${narratable.length} sections`, '');
    if (narration.opener.text) out.push(`> AI: ${narration.opener.text}`, '');
  }

  for (const section of input.book.sections) {
    out.push(`## ${section.title}`, '');
    const entry = narration?.sections[section.id];
    if (entry?.intro) out.push(`> AI: ${entry.intro}`, '');
    for (const occurrence of section.occurrences) {
      const chunk = byId.get(occurrence.chunkId);
      if (!chunk) continue;
      const lowSignal = isLowSignal(chunk) ? ` · low-signal (${lowSignalReason(chunk)})` : '';
      out.push(`### ${chunkTitle(chunk)}`, '', `${chunk.kind} · ${sizeLabel(chunk)}${lowSignal}`, '');
      const line = entry?.chunks[chunk.id];
      if (line) out.push(`> AI: ${line}`, '');
      out.push(...diffBlock(chunk, input.contents.get(chunk.file)), '');
    }
  }

  return out.join('\n');
}

function narratableSectionIds(book: Book, byId: Map<string, Chunk>): string[] {
  return book.sections.filter((s) => isNarratableSection(s, byId)).map((s) => s.id);
}

function sizeLabel(chunk: Chunk): string {
  const added = chunk.hunks.reduce((n, h) => n + h.headCount, 0);
  const removed = chunk.hunks.reduce((n, h) => n + h.baseCount, 0);
  return `+${added} -${removed}`;
}

function diffBlock(chunk: Chunk, contents: FileContents | undefined): string[] {
  if (chunk.hunks.length === 0 || !contents) {
    return ['_content not available (binary or submodule)_'];
  }
  const body: string[] = [];
  for (const h of chunk.hunks) {
    body.push(`@@ -${h.baseStart},${h.baseCount} +${h.headStart},${h.headCount} @@`);
    for (let i = 0; i < h.baseCount; i++) body.push(`-${contents.base?.[h.baseStart - 1 + i] ?? ''}`);
    for (let i = 0; i < h.headCount; i++) body.push(`+${contents.head?.[h.headStart - 1 + i] ?? ''}`);
  }
  const fence = '`'.repeat(Math.max(3, longestBacktickRun(body) + 1));
  return [`${fence}diff`, ...body, fence];
}

function longestBacktickRun(lines: string[]): number {
  let longest = 0;
  for (const line of lines) {
    for (const run of line.match(/`+/g) ?? []) {
      if (run.length > longest) longest = run.length;
    }
  }
  return longest;
}
