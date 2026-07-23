import type { Chunk, ContextDefinition, ContextPayload, LineRange } from '@code-story/core';

/** `undefined` = not yet fetched; `null` = fetched, no payload; otherwise the resolved facts. */
export type PayloadState = ContextPayload | null | undefined;

function rangeContains(range: LineRange | undefined, line: number): boolean {
  return !!range && range.start <= line && line <= range.end;
}

/**
 * True when `def` is itself a chunk in the book — i.e. its own lines are part of this diff. The
 * resolver's `changed` flag is file-level (it's true for an *unchanged* symbol that merely lives in
 * a changed file), so we match on the symbol's identity instead: same file, same simple name, and
 * the def's start line inside the chunk's range. Requiring all three avoids a broad class-level
 * chunk swallowing an unchanged nested symbol.
 */
function defIsChunk(def: ContextDefinition, chunks: readonly Chunk[]): boolean {
  return chunks.some(
    (c) =>
      c.file === def.file &&
      c.symbolPath.length > 0 &&
      c.symbolPath[c.symbolPath.length - 1] === def.symbol &&
      (rangeContains(c.headRange, def.lineStart) || rangeContains(c.baseRange, def.lineStart)),
  );
}

/**
 * The definitions worth showing as context: only called code that is NOT itself part of the diff.
 * A callee that has its own chunk is redundant here — the reviewer meets it as a story chunk and can
 * reach it from the neighbor strip — and putting it under a panel captioned "not part of the diff"
 * is a contradiction (the bug this fixes). Empty when there's no payload.
 */
export function visibleDefinitions(payload: PayloadState, chunks: readonly Chunk[]): ContextDefinition[] {
  if (payload == null) return [];
  return payload.facts.definitions.filter((def) => !defIsChunk(def, chunks));
}

/** The symbols the affordance lists, in payload order, de-duplicated (a symbol can resolve once). */
export function definitionSymbols(defs: readonly ContextDefinition[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const def of defs) {
    if (seen.has(def.symbol)) continue;
    seen.add(def.symbol);
    out.push(def.symbol);
  }
  return out;
}

/** Quiet one-line affordance label; long symbol lists trail off rather than wrap the header. */
export function affordanceLabel(defs: readonly ContextDefinition[], max = 4): string {
  const symbols = definitionSymbols(defs);
  if (symbols.length === 0) return '';
  const shown = symbols.slice(0, max).join(', ');
  const extra = symbols.length - max;
  return extra > 0 ? `definitions: ${shown} +${extra} more` : `definitions: ${symbols.join(', ')}`;
}

/** Toggle result drives focus + announcement in the page (see toggleDefinitions in the hook). */
export type ToggleOutcome = 'expanded' | 'collapsed' | 'none';

/**
 * On a deferred fetch arrival (the payload wasn't cached when `d` was pressed), whether to expand +
 * focus/announce the panel: only if the user's intent still stands and there's something to show.
 * The page mirrors its synchronous focus/announce off this so keyboard/SR users get the same signal.
 */
export function shouldExpandOnArrival(wanted: boolean, defs: readonly ContextDefinition[]): boolean {
  return wanted && defs.length > 0;
}

/** Pure set toggle — mirrors how the review overrides map is copied on write. */
export function toggleInSet(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
