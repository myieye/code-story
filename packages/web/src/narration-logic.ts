import type { NarrationOverlay } from '@code-story/core';

/** The single AI line a section header shows: the narration intro, else the applied order rationale. */
export interface SectionAiLine {
  text: string;
  source: 'intro' | 'rationale';
}

/**
 * One AI voice per section header (spec 03 decision): the narration intro when the section has one,
 * else the AI order overlay's rationale for that section — but only the rationales the caller passes,
 * which are present only while the order is applied. Empty/whitespace text counts as absent.
 */
export function sectionAiLine(
  sectionId: string,
  overlay: NarrationOverlay | null,
  rationales: Record<string, string> | undefined,
): SectionAiLine | undefined {
  const intro = overlay?.sections[sectionId]?.intro;
  if (intro && intro.trim().length > 0) return { text: intro, source: 'intro' };
  const rationale = rationales?.[sectionId];
  if (rationale && rationale.trim().length > 0) return { text: rationale, source: 'rationale' };
  return undefined;
}

/** A chunk's one-line orientation, shared across its occurrences in the section (spec 03). */
export function chunkAiLine(sectionId: string, chunkId: string, overlay: NarrationOverlay | null): string | undefined {
  const line = overlay?.sections[sectionId]?.chunks[chunkId];
  return line && line.trim().length > 0 ? line : undefined;
}

/** One chunk's v2 line + badge (spec 06 slice 5), keyed order-independently by chunk id. */
export type ChunkEntries = Record<string, { line?: string; badge?: string }>;

/**
 * The chunk's AI line preferring the order-independent v2 entry (chapter mode), falling back to the
 * v1 section-keyed line (file mode) the caller resolved. Empty/whitespace text counts as absent.
 */
export function chunkLineV2(chunkId: string, chunkEntries: ChunkEntries | undefined, v1Line: string | undefined): string | undefined {
  const v2 = chunkEntries?.[chunkId]?.line;
  if (v2 && v2.trim().length > 0) return v2;
  return v1Line;
}

/** The chunk's 2–4-word badge from the v2 overlay; absent when none or blank. */
export function chunkBadge(chunkId: string, chunkEntries: ChunkEntries | undefined): string | undefined {
  const badge = chunkEntries?.[chunkId]?.badge;
  return badge && badge.trim().length > 0 ? badge.trim() : undefined;
}

/**
 * Partial-state honesty (spec 03): a partially narrated book must read as *not narrated*, never as
 * *nothing worth saying*. `partial` carries the N-of-M count shown while a job runs or entries are
 * missing; `complete` is the quiet done indicator. `null` = narration was never engaged, so nothing
 * shows. An entry counts as narrated even if it holds only gateFailures — its section was visited.
 */
export type NarrationIndicator =
  | { kind: 'partial'; narrated: number; narratable: number }
  | { kind: 'complete' }
  | null;

export function narrationIndicator(
  narratableIds: string[],
  overlay: NarrationOverlay | null,
  jobStatus: 'running' | 'done' | 'failed' | undefined,
): NarrationIndicator {
  const narratable = narratableIds.length;
  const narrated = overlay ? narratableIds.filter((id) => overlay.sections[id]).length : 0;
  const running = jobStatus === 'running';
  const engaged = jobStatus !== undefined || narrated > 0 || Boolean(overlay?.opener.text);
  if (!engaged || narratable === 0) return null;
  if (running || narrated < narratable) return { kind: 'partial', narrated, narratable };
  return { kind: 'complete' };
}

/**
 * Chunk-narration v2 coverage for the progress cluster (spec 06 slice 5): "AI notes: N of M chunks"
 * while partial, quiet "AI notes" when every narratable chunk carries one. `null` (nothing shows)
 * when the v2 overlay is absent or nothing is narratable — passive, never a nag.
 */
export function chunkNarrationIndicator(
  narratableChunkIds: string[],
  chunkEntries: ChunkEntries | undefined,
  jobStatus: 'running' | 'done' | 'failed' | undefined,
): NarrationIndicator {
  if (!chunkEntries) return null;
  const narratable = narratableChunkIds.length;
  if (narratable === 0) return null;
  const narrated = narratableChunkIds.filter((id) => {
    const e = chunkEntries[id];
    return e !== undefined && (e.line !== undefined || e.badge !== undefined);
  }).length;
  if (jobStatus === 'running' || narrated < narratable) return { kind: 'partial', narrated, narratable };
  return { kind: 'complete' };
}
