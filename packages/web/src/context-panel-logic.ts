import type { ContextPayload } from '@code-story/core';

/** `undefined` = not yet fetched; `null` = fetched, no payload; otherwise the resolved facts. */
export type PayloadState = ContextPayload | null | undefined;

export function hasDefinitions(payload: PayloadState): payload is ContextPayload {
  return payload != null && payload.facts.definitions.length > 0;
}

/** The symbols the affordance lists, in payload order, de-duplicated (a symbol can resolve once). */
export function definitionSymbols(payload: PayloadState): string[] {
  if (!hasDefinitions(payload)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const def of payload.facts.definitions) {
    if (seen.has(def.symbol)) continue;
    seen.add(def.symbol);
    out.push(def.symbol);
  }
  return out;
}

/** Quiet one-line affordance label; long symbol lists trail off rather than wrap the header. */
export function affordanceLabel(payload: PayloadState, max = 4): string {
  const symbols = definitionSymbols(payload);
  if (symbols.length === 0) return '';
  const shown = symbols.slice(0, max).join(', ');
  const extra = symbols.length - max;
  return extra > 0 ? `definitions: ${shown} +${extra} more` : `definitions: ${symbols.join(', ')}`;
}

/** Toggle result drives focus + announcement in the page (see toggleDefinitions in the hook). */
export type ToggleOutcome = 'expanded' | 'collapsed' | 'none';

/**
 * On a deferred fetch arrival (the payload wasn't cached when `d` was pressed), whether to expand +
 * focus/announce the panel: only if the user's intent still stands and the payload has definitions.
 * The page mirrors its synchronous focus/announce off this so keyboard/SR users get the same signal.
 */
export function shouldExpandOnArrival(wanted: boolean, payload: PayloadState): boolean {
  return wanted && hasDefinitions(payload);
}

/** Pure set toggle — mirrors how the review overrides map is copied on write. */
export function toggleInSet(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
