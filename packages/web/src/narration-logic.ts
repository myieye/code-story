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
