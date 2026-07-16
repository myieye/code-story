import { type FileDiff, type Hunk } from './diff.js';
import { type Book, type Chunk, chunkId, type Occurrence, type Section } from './model.js';

export interface CompileBookInput {
  /** Changed files in git diff order — section order follows it. */
  files: FileDiff[];
  chunks: Chunk[];
  headSha: string;
}

export interface CompiledBook {
  book: Book;
  /** Input chunks plus any synthesized leftover chunks. */
  chunks: Chunk[];
}

/**
 * Naive book compile (spec 00): one section per changed file in git order, every chunk exactly
 * one primary occurrence. Any changed line the chunker failed to claim lands in a synthesized
 * leftover chunk in a final section — the R-001 backstop, so no code path drops a line.
 */
export function compileBook(input: CompileBookInput): CompiledBook {
  const byFile = new Map<string, Chunk[]>();
  for (const chunk of input.chunks) {
    const list = byFile.get(chunk.file) ?? [];
    list.push(chunk);
    byFile.set(chunk.file, list);
  }

  const sections: Section[] = [];
  const leftovers: Chunk[] = [];
  for (const file of input.files) {
    const fileChunks = byFile.get(file.path) ?? [];
    leftovers.push(...leftoverChunks(file, fileChunks));
    if (fileChunks.length > 0) {
      sections.push({ id: file.path, title: file.path, occurrences: fileChunks.map(primary) });
    }
  }
  if (leftovers.length > 0) {
    sections.push({ id: '(leftovers)', title: 'Leftovers', occurrences: leftovers.map(primary) });
  }

  return { book: { sections, headSha: input.headSha }, chunks: [...input.chunks, ...leftovers] };
}

function primary(chunk: Chunk): Occurrence {
  return { chunkId: chunk.id, ordinal: 0, role: 'primary' };
}

/** One chunk per contiguous run of primary-side changed lines that no chunk owns. */
function leftoverChunks(file: FileDiff, chunks: Chunk[]): Chunk[] {
  const deleted = file.status === 'deleted';
  const owned = new Set<number>();
  for (const chunk of chunks) {
    for (const h of chunk.hunks) {
      const [start, count] = deleted ? [h.baseStart, h.baseCount] : [h.headStart, h.headCount];
      for (let i = 0; i < count; i++) owned.add(start + i);
    }
  }

  const unclaimed: number[] = [];
  for (const h of file.hunks) {
    const [start, count] = deleted ? [h.baseStart, h.baseCount] : [h.headStart, h.headCount];
    for (let i = 0; i < count; i++) if (!owned.has(start + i)) unclaimed.push(start + i);
  }
  unclaimed.sort((a, b) => a - b);

  const result: Chunk[] = [];
  let runStart = -1;
  let prev = -2;
  const flush = (end: number) => {
    if (runStart < 0) return;
    const range = { start: runStart, end };
    const hunk: Hunk = deleted
      ? { baseStart: runStart, baseCount: end - runStart + 1, headStart: 0, headCount: 0 }
      : { headStart: runStart, headCount: end - runStart + 1, baseStart: 0, baseCount: 0 };
    result.push({
      id: chunkId(file.path, ['(leftover)'], `${runStart}-${end}`),
      file: file.path,
      symbolPath: [],
      displayPath: ['(leftover)', `lines ${runStart}–${end}`],
      kind: 'other',
      changeTypes: [],
      hunks: [hunk],
      headRange: deleted ? undefined : range,
      baseRange: deleted ? range : undefined,
    });
  };
  for (const line of unclaimed) {
    if (line !== prev + 1) {
      flush(prev);
      runStart = line;
    }
    prev = line;
  }
  flush(prev);
  return result;
}
