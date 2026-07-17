import { mkdir } from 'node:fs/promises';
import {
  type Book,
  buildOrderManifest,
  buildSectionNarrationInput,
  type Chunk,
  checkNarrationText,
  type ContextPayload,
  type FileContents,
  filterFreshNarration,
  type ImportGraph,
  isNarratableSection,
  type NarrationKind,
  type NarrationOverlay,
  type NarrationSectionEntry,
  narrationOpenerKey,
  parseNarrationReply,
  renderOrderManifest,
  renderSectionNarrationInput,
  type Section,
  sectionFingerprint,
} from '@code-story/core';
import { extractJsonBlock, invokeClaudeJson } from './claude-cli.js';
import { NARRATION_PROMPT_VERSION, openerNarrationPrompt, sectionNarrationPrompt } from './narration-prompt.js';
import { loadNarrationOverlay, saveJson } from './narration-store.js';

const JOB_TIMEOUT_MS = 10 * 60 * 1000;
const TRANSIENT_BACKOFF_MS = [2000, 4000];

export interface NarrationJobInput {
  book: Book;
  graph: ImportGraph;
  chunks: Chunk[];
  contents: Map<string, FileContents>;
  /**
   * Optional context payloads (chunk id → payload) for the additive definitions block. Purely
   * additive; unset today — the caller (server route / CLI) loads the context store and populates
   * this in a later change, without altering this job's contract.
   */
  payloads?: Map<string, ContextPayload>;
  headSha: string;
  model: string;
  /** Where the subprocess runs: the data home. Never the reviewed repo (see order-job). */
  cwd: string;
  /** Overlay file — persisted after every section, the resumability contract (spec 03 runtime shape). */
  overlayFile: string;
  /** Called after each section persists, so the job record's live counts track progress. */
  onProgress?: (done: number, total: number) => void;
  /** Test seam: replaces the claude subprocess. */
  invoke?: (prompt: string, model: string, cwd: string) => Promise<string>;
}

export interface NarrationJobResult {
  overlay: NarrationOverlay;
  sectionsTotal: number;
  sectionsDone: number;
}

/**
 * The resumable per-section narration job. Walks narratable sections one `claude -p` call at a
 * time, persisting the overlay after each so a session-limit death resumes from the survivors.
 * Never returns partial narration for a section: a section that exhausts its retries records
 * gateFailures and the walk continues (one bad section must not kill the run). The caller owns
 * the job record; this owns the overlay file.
 */
export async function runNarrationJob(input: NarrationJobInput): Promise<NarrationJobResult> {
  const invoke = input.invoke ?? ((p, m, cwd) => invokeClaudeJson(p, m, cwd, JOB_TIMEOUT_MS));
  // A fresh install has no data home yet; spawning with a missing cwd dies instantly (ENOENT).
  await mkdir(input.cwd, { recursive: true });

  const chunksById = new Map(input.chunks.map((c) => [c.id, c]));
  const narratable = input.book.sections.filter((s) => isNarratableSection(s, chunksById));

  const existing = await loadNarrationOverlay(input.overlayFile);
  // A stored overlay whose voice differs (model/prompt) can't be mixed with fresh sections — start
  // clean rather than blend two registers.
  const resumable =
    existing !== null && existing.model === input.model && existing.promptVersion === NARRATION_PROMPT_VERSION
      ? filterFreshNarration(input.book, input.headSha, existing)
      : null;

  const openerKey = narrationOpenerKey(input.book, input.headSha);
  // Seed with the surviving prior entries so the first persist never drops finished work — a death
  // right after the opener would otherwise wipe them from the file and force paid regeneration.
  const overlay: NarrationOverlay = {
    version: 1,
    model: input.model,
    promptVersion: NARRATION_PROMPT_VERSION,
    opener: { text: '', key: openerKey },
    sections: { ...resumable?.sections },
  };
  const persist = () => saveJson(input.overlayFile, overlay);

  // Opener: a matching key (even an empty prior attempt) counts as already handled, so a twice-
  // failed opener isn't hammered on resume — the same rule gateFailures gives sections.
  if (resumable && resumable.opener.key === openerKey) {
    overlay.opener = resumable.opener;
  } else {
    const manifest = renderOrderManifest(buildOrderManifest(input.book, input.graph, input.chunks));
    // The opener fails its caps more than sections do (#57) and is one cheap call: two re-asks.
    const result = await generate(openerNarrationPrompt(manifest), parseOpener, gateText('opener'), { invoke, model: input.model, cwd: input.cwd, gateRetries: 2 });
    overlay.opener =
      'value' in result ? { text: result.value, key: openerKey } : { text: '', key: openerKey, failures: result.failures };
  }
  await persist();

  let done = 0;
  input.onProgress?.(done, narratable.length);
  for (const section of narratable) {
    const fingerprint = sectionFingerprint(input.headSha, section);
    const prior = resumable?.sections[section.id];
    // "Present" includes a gateFailures-only entry — a twice-failed section is not re-asked.
    overlay.sections[section.id] =
      prior && prior.fingerprint === fingerprint
        ? prior
        : await narrateSection(section, fingerprint, input, invoke);
    await persist();
    done++;
    input.onProgress?.(done, narratable.length);
  }

  return { overlay, sectionsTotal: narratable.length, sectionsDone: done };
}

async function narrateSection(
  section: Section,
  fingerprint: string,
  input: NarrationJobInput,
  invoke: NonNullable<NarrationJobInput['invoke']>,
): Promise<NarrationSectionEntry> {
  const sectionInput = buildSectionNarrationInput(section, input.chunks, input.graph, input.contents, input.payloads);
  // Chunks the model never saw must not be narrated blind; their ids are recorded, not guessed.
  const omitted = sectionInput.omitted.map((id) => `diff omitted: ${id}`);
  const prompt = sectionNarrationPrompt(renderSectionNarrationInput(sectionInput));
  const gate = (reply: { intro: string; chunks: Record<string, string> }): string[] => {
    const failures = checkNarrationText('intro', reply.intro).map((f) => `intro: ${f}`);
    for (const [id, line] of Object.entries(reply.chunks)) {
      failures.push(...checkNarrationText('chunkLine', line).map((f) => `chunk ${id}: ${f}`));
    }
    return failures;
  };

  const parse = (json: unknown): Parsed<{ intro: string; chunks: Record<string, string> }> => {
    const r = parseNarrationReply(section, json);
    return r.ok ? { ok: true, value: r.reply } : r;
  };
  const result = await generate(prompt, parse, gate, { invoke, model: input.model, cwd: input.cwd });
  const generatedAt = new Date().toISOString();
  if ('value' in result) {
    return {
      fingerprint,
      intro: result.value.intro,
      chunks: result.value.chunks,
      generatedAt,
      ...(omitted.length > 0 ? { gateFailures: omitted } : {}),
    };
  }
  // The gate fails per text, not per section (#56): keep the intro and every chunk line that
  // passed; only the offending texts are dropped and recorded.
  const salvage = result.last;
  const intro = salvage && checkNarrationText('intro', salvage.intro).length === 0 ? salvage.intro : '';
  const chunks: Record<string, string> = {};
  for (const [id, line] of Object.entries(salvage?.chunks ?? {})) {
    if (checkNarrationText('chunkLine', line).length === 0) chunks[id] = line;
  }
  return { fingerprint, intro, chunks, generatedAt, gateFailures: [...omitted, ...result.failures] };
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };
interface GenCtx {
  invoke: NonNullable<NarrationJobInput['invoke']>;
  model: string;
  cwd: string;
  gateRetries?: number;
}

/**
 * One gated generation with the order job's failure taxonomy: transient (spawn/timeout) retries
 * with backoff, invalid output re-asked once, and a hard-gate failure re-asked once with the
 * failures named. Never throws — an exhausted attempt returns its failure strings so the caller
 * can fall open (record gateFailures, keep walking).
 */
async function generate<T>(
  basePrompt: string,
  parse: (json: unknown) => Parsed<T>,
  gate: (value: T) => string[],
  ctx: GenCtx,
): Promise<{ value: T } | { failures: string[]; last?: T }> {
  let transientLeft = TRANSIENT_BACKOFF_MS.length;
  let invalidLeft = 1;
  let gateLeft = ctx.gateRetries ?? 1;
  let prompt = basePrompt;
  for (;;) {
    let raw: string;
    try {
      raw = await ctx.invoke(prompt, ctx.model, ctx.cwd);
    } catch (e) {
      if (transientLeft === 0) return { failures: [`transient: ${(e as Error).message}`] };
      await sleep(TRANSIENT_BACKOFF_MS[TRANSIENT_BACKOFF_MS.length - transientLeft--]!);
      continue;
    }

    let value: T;
    try {
      const parsed = parse(extractJsonBlock(raw));
      if (!parsed.ok) throw new Error(parsed.error);
      value = parsed.value;
    } catch (e) {
      if (invalidLeft === 0) return { failures: [`invalid output: ${(e as Error).message}`] };
      invalidLeft--;
      continue;
    }

    const failures = gate(value);
    if (failures.length === 0) return { value };
    if (gateLeft === 0) return { failures, last: value };
    gateLeft--;
    prompt = `${basePrompt}\n\nYour previous reply was rejected by the register check for these reasons; fix every one and reply again:\n${failures.map((f) => `- ${f}`).join('\n')}`;
  }
}

function parseOpener(json: unknown): Parsed<string> {
  if (typeof json !== 'object' || json === null) return { ok: false, error: 'reply is not an object' };
  const opener = (json as { opener?: unknown }).opener;
  if (typeof opener !== 'string') return { ok: false, error: 'reply has no "opener" string' };
  return { ok: true, value: opener };
}

function gateText(kind: NarrationKind): (text: string) => string[] {
  return (text) => checkNarrationText(kind, text);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
