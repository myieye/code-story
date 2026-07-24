import {
  buildChunkNarrationBatch,
  checkBadgeText,
  checkNarrationText,
  checkReviewNote,
  type Chunk,
  chunkNarrationFingerprint,
  type FileContents,
  filterFreshNarrationV2,
  isLowSignal,
  type NarrationEntryV2,
  type NarrationOverlayV2,
  parseChunkNarrationReply,
  renderChunkNarrationBatch,
} from '@code-story/core';
import { extractJsonBlock } from './claude-cli.js';
import { CHUNK_NARRATION_PROMPT_VERSION, chunkNarrationPrompt } from './narration-prompt.js';
import { loadChunkNarrationOverlay, saveJson } from './narration-store.js';
import type { GlueInvoke, GlueOutcome, GlueTask, ModelTier } from './glue/types.js';

export const CHUNK_NARRATION_KIND = 'chunk-narration';

export interface ChunkNarrationTaskDeps {
  headSha: string;
  /** Resolved once from the ModelPolicy (`policy.resolve('top')`) — the overlay's model + resume gate. */
  model: string;
  tier: ModelTier;
  overlayFile: string;
  /** The compiled book's chunks + per-file contents; re-read each run so a recompile is picked up. */
  getInputs: () => Promise<{ chunks: Chunk[]; contents: Map<string, FileContents> }>;
}

/**
 * The chunk-narration + badges glue task (spec 06 slice 5 / spec 07 G2). One unit per changed file
 * with narratable (non-low-signal) chunks; the model returns a per-chunk line and badge in one
 * file-batch call. Order-independent: units group by file and freshness keys on
 * `chunkNarrationFingerprint`, so the order overlay can never invalidate a run. run() does
 * load-merge-save into the v2 overlay, preserving other files' entries (the spec-03 no-loss
 * contract); the v1 section overlay is untouched.
 */
export function createChunkNarrationTask(deps: ChunkNarrationTaskDeps): GlueTask<number> {
  const load = () => loadChunkNarrationOverlay(deps.overlayFile);

  async function batchesByFile(): Promise<Map<string, Chunk[]>> {
    const { chunks } = await deps.getInputs();
    const byFile = new Map<string, Chunk[]>();
    const seen = new Set<string>();
    for (const chunk of chunks) {
      if (isLowSignal(chunk) || seen.has(chunk.id)) continue;
      seen.add(chunk.id);
      const list = byFile.get(chunk.file);
      if (list) list.push(chunk);
      else byFile.set(chunk.file, [chunk]);
    }
    return byFile;
  }

  // Folds the member chunks' own fingerprints (which already bake in head + CORE_VERSION + content),
  // so a file's unit fingerprint changes if any member's content or membership changes.
  const unitFingerprint = (members: Chunk[]): string => {
    const fps = members.map((c) => chunkNarrationFingerprint(deps.headSha, c.id)).sort();
    return chunkNarrationFingerprint(deps.headSha, `chunk-narration:${fps.join('|')}`);
  };

  // A voice mismatch (different model/prompt) can't be blended with fresh entries — treat the whole
  // stored overlay as stale, mirroring the v1 job.
  const freshBaseChunks = (overlay: NarrationOverlayV2 | null): NarrationOverlayV2['chunks'] =>
    overlay && overlay.model === deps.model && overlay.promptVersion === CHUNK_NARRATION_PROMPT_VERSION
      ? filterFreshNarrationV2(deps.headSha, overlay).chunks
      : {};

  return {
    kind: CHUNK_NARRATION_KIND,
    tier: deps.tier,
    priority: 'startup',

    plan: async () =>
      [...(await batchesByFile()).entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([file, members]) => ({ key: file, fingerprint: unitFingerprint(members) })),

    isFresh: async (unit) => {
      const members = (await batchesByFile()).get(unit.key);
      if (!members || members.length === 0) return true;
      const base = freshBaseChunks(await load());
      return members.every((c) => base[c.id] !== undefined);
    },

    run: async (unit, invoke): Promise<GlueOutcome<number>> => {
      const { contents } = await deps.getInputs();
      const members = (await batchesByFile()).get(unit.key) ?? [];
      if (members.length === 0) return { status: 'done', out: 0 };

      const batch = buildChunkNarrationBatch(unit.key, members, contents.get(unit.key));
      const basePrompt = chunkNarrationPrompt(renderChunkNarrationBatch(batch));

      const first = await ask(invoke, deps.tier, basePrompt, batch, unit.key);
      if ('failure' in first) return first.failure;

      // One task-internal gate re-ask (#58): if any line the model wrote fails the register gate,
      // ask once more with the failures named. A re-ask throw/invalid just keeps the first reply —
      // the per-text gate below drops the offending lines either way ("faithful or silent").
      let entries = first.entries;
      const lineFailures = collectLineFailures(entries);
      if (lineFailures.length > 0) {
        const amended = `${basePrompt}\n\nYour previous reply had lines rejected by the register check; fix every one and reply again:\n${lineFailures
          .map((f) => `- ${f}`)
          .join('\n')}`;
        const retry = await ask(invoke, deps.tier, amended, batch, unit.key);
        if ('entries' in retry) entries = retry.entries;
      }

      const generatedAt = new Date().toISOString();
      const omitted = new Set(batch.omitted);
      const produced: Record<string, NarrationEntryV2> = {};
      for (const member of members) {
        const raw = entries[member.id];
        const gateFailures: string[] = [];
        if (omitted.has(member.id)) gateFailures.push(`diff omitted: ${member.id}`);

        let line: string | undefined;
        if (raw?.line !== undefined) {
          const fails = checkNarrationText('chunkLine', raw.line);
          if (fails.length === 0) line = raw.line;
          else gateFailures.push(...fails.map((f) => `line: ${f}`));
        }
        let badge: string | undefined;
        if (raw?.badge !== undefined) {
          const fails = checkBadgeText(raw.badge);
          if (fails.length === 0) badge = raw.badge;
          else gateFailures.push(...fails.map((f) => `badge: ${f}`));
        }
        let reviewNote: string | undefined;
        if (raw?.note !== undefined) {
          const fails = checkReviewNote(raw.note);
          if (fails.length === 0) reviewNote = raw.note.trim();
          else gateFailures.push(...fails.map((f) => `note: ${f}`));
        }
        produced[member.id] = {
          fingerprint: chunkNarrationFingerprint(deps.headSha, member.id),
          generatedAt,
          ...(line !== undefined ? { line } : {}),
          ...(badge !== undefined ? { badge } : {}),
          ...(reviewNote !== undefined ? { reviewNote } : {}),
          ...(gateFailures.length > 0 ? { gateFailures } : {}),
        };
      }

      // Load-merge-save: two units of one task never run concurrently (single-flight background
      // lane), so saveJson's fixed .tmp is safe and other files' entries survive.
      const overlay: NarrationOverlayV2 = {
        version: 2,
        model: deps.model,
        promptVersion: CHUNK_NARRATION_PROMPT_VERSION,
        chunks: { ...freshBaseChunks(await load()), ...produced },
      };
      await saveJson(deps.overlayFile, overlay);
      return { status: 'done', out: Object.keys(produced).length };
    },
  };
}

type AskResult =
  | { entries: Record<string, { line?: string; badge?: string; note?: string }> }
  | { failure: { status: 'transient' | 'invalid-output'; error: string } };

/** One invoke → extract → parse. A spawn throw is transient (scheduler backs off); a bad reply is invalid-output. */
async function ask(
  invoke: GlueInvoke,
  tier: ModelTier,
  prompt: string,
  batch: ReturnType<typeof buildChunkNarrationBatch>,
  unitKey: string,
): Promise<AskResult> {
  let text: string;
  try {
    ({ text } = await invoke({ prompt, tier: tier as Exclude<ModelTier, 'none'>, kind: CHUNK_NARRATION_KIND, unitKey }));
  } catch (e) {
    return { failure: { status: 'transient' as const, error: (e as Error).message } };
  }
  let json: unknown;
  try {
    json = extractJsonBlock(text);
  } catch (e) {
    return { failure: { status: 'invalid-output' as const, error: (e as Error).message } };
  }
  const parsed = parseChunkNarrationReply(batch, json);
  if (!parsed.ok) return { failure: { status: 'invalid-output' as const, error: parsed.error } };
  return { entries: parsed.entries };
}

function collectLineFailures(entries: Record<string, { line?: string; badge?: string; note?: string }>): string[] {
  const failures: string[] = [];
  for (const [id, { line, note }] of Object.entries(entries)) {
    if (line !== undefined) failures.push(...checkNarrationText('chunkLine', line).map((f) => `${id}: ${f}`));
    if (note !== undefined) failures.push(...checkReviewNote(note).map((f) => `${id} (note): ${f}`));
  }
  return failures;
}
