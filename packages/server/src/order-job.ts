import { mkdir } from 'node:fs/promises';
import {
  applyOrderOverlay,
  type Book,
  buildChunkOrderManifest,
  buildOrderManifest,
  checkOrder,
  type Chunk,
  type ChunkOrderManifest,
  type ChunkGraph,
  type CompileChapterBookInput,
  compileChapterBook,
  type ImportGraph,
  type OrderOverlay,
  type OrderOverlayV2,
  renderChunkOrderManifest,
  renderOrderManifest,
  type StoryConfig,
  validateChapterComposition,
  validatePermutation,
} from '@code-story/core';
import { extractJsonBlock, invokeClaudeJson } from './claude-cli.js';
import { CHAPTER_ORDER_PROMPT_VERSION, chapterOrderPrompt, ORDER_PROMPT_VERSION, orderPrompt } from './order-prompt.js';

const MANIFEST_TOKEN_LIMIT = 8000;
const JOB_TIMEOUT_MS = 10 * 60 * 1000;
const TRANSIENT_BACKOFF_MS = [2000, 4000];

export type OrderJobFailure =
  /** Size guard or other precondition — retrying cannot help. */
  | 'refused'
  /** The model returned something the validators rejected — retried once. */
  | 'invalid-output'
  /** Infra trouble (spawn/exit/timeout) — retried with backoff. */
  | 'transient';

export class OrderJobError extends Error {
  constructor(
    readonly failure: OrderJobFailure,
    message: string,
  ) {
    super(message);
  }
}

export interface OrderJobInput {
  book: Book;
  graph: ImportGraph;
  chunks: Chunk[];
  model: string;
  /** Where the subprocess runs: the data home. Never the reviewed repo — the job has no
   * business reading it, and must not become an unreviewed side channel into it. */
  cwd: string;
  /** Test seam: replaces the claude subprocess. */
  invoke?: (prompt: string, model: string, cwd: string) => Promise<string>;
}

/**
 * The extra input the chapter-mode ordering job needs (spec 05, #77). `book`/`chunks` on
 * `ChapterOrderJobInput` are the *tier-0 chapter* book and its compiled chunks (the manifest source);
 * `input` is what recomposition and the checkOrder pre-gate feed back into `compileChapterBook`.
 */
export interface ChapterOrderJobInput extends OrderJobInput {
  input: CompileChapterBookInput;
  config: StoryConfig;
  chunkGraph: ChunkGraph;
  storyComposition: string[][];
}

/**
 * Runs the tier-1 ordering job: manifest → claude -p → validated overlay. Throws OrderJobError;
 * never returns a partial result. The caller persists the overlay.
 */
export async function runOrderJob(input: OrderJobInput): Promise<OrderOverlay> {
  const manifest = buildOrderManifest(input.book, input.graph, input.chunks);
  if (manifest.estimatedTokens > MANIFEST_TOKEN_LIMIT) {
    throw new OrderJobError(
      'refused',
      `manifest is ~${manifest.estimatedTokens} tokens (limit ${MANIFEST_TOKEN_LIMIT}) — a range this large reads fine in tier-0 order`,
    );
  }
  if (manifest.sections.length < 3) {
    throw new OrderJobError('refused', `only ${manifest.sections.length} story sections — nothing to reorder`);
  }

  const prompt = orderPrompt(renderOrderManifest(manifest));
  return invokeUntilValid(input, prompt, (raw) => tryBuildOverlay(input, manifest, raw));
}

/**
 * Runs the chapter-mode ordering job (spec 05, #77): chunk manifest → aliased prompt → validated v2
 * overlay. Same size guards and retry discipline as `runOrderJob`; the model regroups story chunks
 * into chapters rather than permuting sections.
 */
export async function runChapterOrderJob(input: ChapterOrderJobInput): Promise<OrderOverlayV2> {
  const manifest = buildChunkOrderManifest(input.book, input.chunks, input.chunkGraph, input.storyComposition);
  if (manifest.chunks.length < 3) {
    throw new OrderJobError('refused', `only ${manifest.chunks.length} story chunks — nothing to reorder`);
  }

  // The model never sees raw chunk ids — long ids get truncated in replies (#44). Aliases are
  // assigned in manifest order (= tier-0 story order).
  const aliasOf = new Map<string, string>();
  const idOf = new Map<string, string>();
  manifest.chunks.forEach((c, i) => {
    const alias = `c${i + 1}`;
    aliasOf.set(c.id, alias);
    idOf.set(alias, c.id);
  });

  // Guard against the aliased text the model actually receives, not the raw-id rendering — aliases
  // are ~3-4x shorter, so estimating on raw ids would refuse ranges that fit comfortably.
  const rendered = renderChunkOrderManifest(manifest, (id) => aliasOf.get(id) ?? id);
  const estimatedTokens = Math.ceil(rendered.length / 4);
  if (estimatedTokens > MANIFEST_TOKEN_LIMIT) {
    throw new OrderJobError(
      'refused',
      `manifest is ~${estimatedTokens} tokens (limit ${MANIFEST_TOKEN_LIMIT}) — a range this large reads fine in tier-0 order`,
    );
  }

  const prompt = chapterOrderPrompt(rendered, input.config.direction);
  return invokeUntilValid(input, prompt, (raw) => tryBuildChapterOverlay(input, manifest, idOf, raw));
}

/** Shared invoke → validate loop: transient errors back off, one bad-output retry, then throws. */
async function invokeUntilValid<T>(
  input: OrderJobInput,
  prompt: string,
  build: (raw: string) => { overlay: T } | { error: string },
): Promise<T> {
  const invoke = input.invoke ?? ((p, m, cwd) => invokeClaudeJson(p, m, cwd, JOB_TIMEOUT_MS));
  // A fresh install has no data home yet; spawn with a missing cwd dies instantly (ENOENT).
  await mkdir(input.cwd, { recursive: true });

  let transientLeft = TRANSIENT_BACKOFF_MS.length;
  let invalidLeft = 1;
  for (;;) {
    let raw: string;
    try {
      raw = await invoke(prompt, input.model, input.cwd);
    } catch (e) {
      if (transientLeft === 0) throw new OrderJobError('transient', `claude invocation failed: ${(e as Error).message}`);
      await sleep(TRANSIENT_BACKOFF_MS[TRANSIENT_BACKOFF_MS.length - transientLeft--]!);
      continue;
    }

    const parsed = build(raw);
    if ('overlay' in parsed) return parsed.overlay;
    if (invalidLeft === 0) throw new OrderJobError('invalid-output', parsed.error);
    invalidLeft--;
  }
}

/** Parse + validate one model response: strict permutation, then the checkOrder pre-gate. */
function tryBuildOverlay(
  input: OrderJobInput,
  manifest: ReturnType<typeof buildOrderManifest>,
  raw: string,
): { overlay: OrderOverlay } | { error: string } {
  let proposal: { order?: unknown; rationales?: unknown };
  try {
    proposal = extractJsonBlock(raw) as { order?: unknown; rationales?: unknown };
  } catch (e) {
    return { error: `unparseable model output: ${(e as Error).message}` };
  }
  if (!Array.isArray(proposal.order) || !proposal.order.every((k) => typeof k === 'string')) {
    return { error: 'model output has no "order" string array' };
  }
  const order = proposal.order as string[];
  const check = validatePermutation(
    manifest.sections.map((s) => s.key),
    order,
  );
  if (!check.ok) return { error: `not a permutation: ${check.errors.join('; ')}` };

  const keys = new Set(order);
  const rationales: Record<string, string> = {};
  for (const [key, line] of Object.entries((proposal.rationales as Record<string, unknown> | undefined) ?? {})) {
    if (keys.has(key) && typeof line === 'string' && line.trim() !== '') rationales[key] = line.trim();
  }
  const overlay: OrderOverlay = {
    version: 1,
    bookFingerprint: manifest.bookFingerprint,
    permutation: order,
    rationales,
    model: input.model,
    promptVersion: ORDER_PROMPT_VERSION,
    createdAt: new Date().toISOString(),
  };

  const candidate = applyOrderOverlay(input.book, input.graph, input.chunks, overlay);
  const report = checkOrder(candidate, input.graph, input.chunks);
  if (!report.ok) {
    const worst = report.importInversions[0] ?? report.testBeforeImpl[0];
    return {
      error: `proposed order re-breaks dependencies (${report.importInversions.length} import inversions, ${report.testBeforeImpl.length} test-before-impl; e.g. ${JSON.stringify(worst)})`,
    };
  }
  return { overlay };
}

/**
 * Parse + validate one chapter-mode reply: aliases back to ids, exact-partition check, then the
 * checkOrder pre-gate on the recomposed chapter book. Rationales are re-keyed to the applier's
 * chapter section ids (`chapter:<anchorChunkId>`) so the web's header lookup resolves them.
 */
function tryBuildChapterOverlay(
  input: ChapterOrderJobInput,
  manifest: ChunkOrderManifest,
  idOf: Map<string, string>,
  raw: string,
): { overlay: OrderOverlayV2 } | { error: string } {
  let proposal: { chapters?: unknown; rationales?: unknown };
  try {
    proposal = extractJsonBlock(raw) as { chapters?: unknown; rationales?: unknown };
  } catch (e) {
    return { error: `unparseable model output: ${(e as Error).message}` };
  }
  if (!Array.isArray(proposal.chapters) || !proposal.chapters.every((ch) => Array.isArray(ch))) {
    return { error: 'model output has no "chapters" array-of-arrays' };
  }
  const aliasChapters = proposal.chapters as unknown[][];

  const unknown = new Set<string>();
  const idChapters: string[][] = aliasChapters.map((ch) =>
    ch.map((alias) => {
      if (typeof alias !== 'string' || !idOf.has(alias)) {
        unknown.add(String(alias));
        return String(alias);
      }
      return idOf.get(alias)!;
    }),
  );
  if (unknown.size > 0) return { error: `unknown chunk aliases: ${[...unknown].slice(0, 5).join(', ')}` };

  const check = validateChapterComposition(manifest.tier0Chapters.flat(), idChapters);
  if (!check.ok) return { error: `not a chapter partition: ${check.errors.join('; ')}` };

  const rawRationales = (proposal.rationales as Record<string, unknown> | undefined) ?? {};
  const rationales: Record<string, string> = {};
  for (const aliasChapter of aliasChapters) {
    const anchorAlias = aliasChapter[0];
    if (typeof anchorAlias !== 'string') continue;
    const line = rawRationales[anchorAlias];
    if (typeof line === 'string' && line.trim() !== '') rationales[`chapter:${idOf.get(anchorAlias)!}`] = line.trim();
  }

  const overlay: OrderOverlayV2 = {
    version: 2,
    bookFingerprint: manifest.bookFingerprint,
    chapters: idChapters,
    rationales,
    model: input.model,
    promptVersion: CHAPTER_ORDER_PROMPT_VERSION,
    createdAt: new Date().toISOString(),
  };

  const composed = compileChapterBook(input.input, input.config, { chapters: idChapters });
  const report = checkOrder(composed.book, input.graph, composed.chunks, {
    config: input.config,
    chunkGraph: input.chunkGraph,
  });
  if (!report.ok) {
    const worst = report.importInversions[0] ?? report.testBeforeImpl[0];
    return {
      error: `proposed chapters re-break the reading order (${report.importInversions.length} inversions, ${report.testBeforeImpl.length} test-placement; e.g. ${JSON.stringify(worst)})`,
    };
  }
  return { overlay };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface AutoOrderDecision {
  /** The `--no-ai-order` / CODE_STORY_NO_AI_ORDER opt-out, negated. */
  enabled: boolean;
  hasFreshOverlay: boolean;
  jobInFlight: boolean;
  fingerprint: string;
  /** Fingerprints whose job already failed this daemon lifetime — no retry storm on a broken CLI. */
  failedFingerprints: ReadonlySet<string>;
}

/** Whether the daemon should auto-run the ordering job on book compile (default-on, #71). */
export function shouldAutoKickOrder(d: AutoOrderDecision): boolean {
  return d.enabled && !d.hasFreshOverlay && !d.jobInFlight && !d.failedFingerprints.has(d.fingerprint);
}
