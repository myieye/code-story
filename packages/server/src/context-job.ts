import { type Book, type Chunk, type ContextPayload, isLowSignal, LEFTOVERS_SECTION_ID } from '@code-story/core';

/**
 * The chunks the bulk fill targets: every occurrence's chunk outside the leftovers section, minus
 * low-signal stubs, deduped by id (a payload is shared across a chunk's occurrences). Mirrors
 * `isNarratableSection`'s exclusions — spec 04 explicitly excludes stubs and leftovers.
 */
export function eligibleContextChunks(book: Book, chunks: Chunk[]): Chunk[] {
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const eligible: Chunk[] = [];
  for (const section of book.sections) {
    if (section.id === LEFTOVERS_SECTION_ID) continue;
    for (const occ of section.occurrences) {
      if (seen.has(occ.chunkId)) continue;
      const chunk = byId.get(occ.chunkId);
      if (!chunk || isLowSignal(chunk)) continue;
      seen.add(occ.chunkId);
      eligible.push(chunk);
    }
  }
  return eligible;
}

export interface ContextJobDeps {
  /** Already filtered + deduped by `eligibleContextChunks`. */
  eligibleChunks: Chunk[];
  /** Chunk ids that already hold a fresh payload — a resume skips these without recomputing. */
  freshIds: Set<string>;
  resolve: (chunk: Chunk) => Promise<ContextPayload>;
  /**
   * Persists one computed payload atomically. Returns `persisted: false` when writing it would push
   * the serialized store past its cap — the signal for the job to stop filling (never a throw).
   */
  persist: (payload: ContextPayload) => Promise<{ persisted: boolean }>;
  onProgress?: (done: number, total: number) => void;
}

export interface ContextJobResult {
  chunksTotal: number;
  chunksDone: number;
  computed: number;
  skipped: number;
  capped: boolean;
  cappedCount: number;
}

/**
 * The narration job lifecycle minus the model calls: walk the eligible chunks, resolve each with the
 * (script-only) resolver, persist as it goes so a kill loses at most the in-flight chunk. Resume is
 * the `freshIds` skip. When the store caps, stop filling and report how many chunks went unfilled —
 * on-demand GET still serves those by computing without persisting.
 */
export async function runContextJob(deps: ContextJobDeps): Promise<ContextJobResult> {
  const total = deps.eligibleChunks.length;
  let done = 0;
  let computed = 0;
  let skipped = 0;
  deps.onProgress?.(0, total);
  for (const chunk of deps.eligibleChunks) {
    if (deps.freshIds.has(chunk.id)) {
      skipped++;
      done++;
      deps.onProgress?.(done, total);
      continue;
    }
    const payload = await deps.resolve(chunk);
    const { persisted } = await deps.persist(payload);
    if (!persisted) {
      return { chunksTotal: total, chunksDone: done, computed, skipped, capped: true, cappedCount: total - done };
    }
    computed++;
    done++;
    deps.onProgress?.(done, total);
  }
  return { chunksTotal: total, chunksDone: done, computed, skipped, capped: false, cappedCount: 0 };
}
