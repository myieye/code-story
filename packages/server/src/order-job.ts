import { mkdir } from 'node:fs/promises';
import {
  applyOrderOverlay,
  type Book,
  buildOrderManifest,
  checkOrder,
  type Chunk,
  type ImportGraph,
  type OrderOverlay,
  renderOrderManifest,
  validatePermutation,
} from '@code-story/core';
import { extractJsonBlock, invokeClaudeJson } from './claude-cli.js';
import { ORDER_PROMPT_VERSION, orderPrompt } from './order-prompt.js';

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
  const invoke = input.invoke ?? ((p, m, cwd) => invokeClaudeJson(p, m, cwd, JOB_TIMEOUT_MS));
  // A fresh install has no data home yet; spawn with a missing cwd dies instantly (ENOENT).
  await mkdir(input.cwd, { recursive: true });

  let transientLeft = TRANSIENT_BACKOFF_MS.length;
  let invalidLeft = 1;
  let lastError = '';
  for (;;) {
    let raw: string;
    try {
      raw = await invoke(prompt, input.model, input.cwd);
    } catch (e) {
      if (transientLeft === 0) throw new OrderJobError('transient', `claude invocation failed: ${(e as Error).message}`);
      await sleep(TRANSIENT_BACKOFF_MS[TRANSIENT_BACKOFF_MS.length - transientLeft--]!);
      continue;
    }

    const parsed = tryBuildOverlay(input, manifest, raw);
    if ('overlay' in parsed) return parsed.overlay;
    lastError = parsed.error;
    if (invalidLeft === 0) throw new OrderJobError('invalid-output', lastError);
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
