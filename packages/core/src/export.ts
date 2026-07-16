import { type Book, type Chunk, chunkTitle, isLowSignal, lowSignalReason } from './model.js';

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
}

/** Renders the book as markdown — R-005's machine-assessable artifact and the R-034 eval input. */
export function exportBookMarkdown(input: ExportBookInput): string {
  const byId = new Map(input.chunks.map((c) => [c.id, c]));
  const chunkCount = input.book.sections.reduce((n, s) => n + s.occurrences.length, 0);

  const out: string[] = [
    `# Code story — ${input.title}`,
    '',
    `${chunkCount} chunks · ${input.book.sections.length} sections · head ${input.book.headSha.slice(0, 8)}`,
    '',
  ];

  for (const section of input.book.sections) {
    out.push(`## ${section.title}`, '');
    for (const occurrence of section.occurrences) {
      const chunk = byId.get(occurrence.chunkId);
      if (!chunk) continue;
      const lowSignal = isLowSignal(chunk) ? ` · low-signal (${lowSignalReason(chunk)})` : '';
      out.push(`### ${chunkTitle(chunk)}`, '', `${chunk.kind} · ${sizeLabel(chunk)}${lowSignal}`, '');
      out.push(...diffBlock(chunk, input.contents.get(chunk.file)), '');
    }
  }

  return out.join('\n');
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
