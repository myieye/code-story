import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import {
  applyOrderOverlay,
  type Book,
  bookFingerprint,
  buildOrderManifest,
  checkOrder,
  type Chunk,
  type ImportGraph,
  type OrderOverlay,
  renderOrderManifest,
  validatePermutation,
} from '@code-story/core';
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
  /** Where the subprocess runs — the data home, never the reviewed repo (spec 02 sandbox rule). */
  cwd: string;
  /** Test seam: replaces the claude subprocess. */
  invoke?: (prompt: string, model: string, cwd: string) => Promise<string>;
}

/**
 * Runs the tier-1 ordering job (spec 02): manifest → claude -p (no tools) → validated overlay.
 * Throws OrderJobError; never returns a partial result. The caller persists the overlay.
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
  const invoke = input.invoke ?? invokeClaude;
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
    proposal = extractJson(raw);
  } catch (e) {
    return { error: `unparseable model output: ${(e as Error).message}` };
  }
  if (!Array.isArray(proposal.order) || !proposal.order.every((k) => typeof k === 'string')) {
    return { error: 'model output has no "order" string array' };
  }
  const order = proposal.order as string[];
  const check = validatePermutation(manifest, order);
  if (!check.ok) return { error: `not a permutation: ${check.errors.join('; ')}` };

  const keys = new Set(order);
  const rationales: Record<string, string> = {};
  for (const [key, line] of Object.entries((proposal.rationales as Record<string, unknown> | undefined) ?? {})) {
    if (keys.has(key) && typeof line === 'string' && line.trim() !== '') rationales[key] = line.trim();
  }
  const overlay: OrderOverlay = {
    version: 1,
    bookFingerprint: bookFingerprint(input.book),
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

/** First {...} block in the CLI envelope's result string — the model may wrap it in prose. */
function extractJson(raw: string): { order?: unknown; rationales?: unknown } {
  const envelope = JSON.parse(raw) as { result?: unknown };
  if (typeof envelope.result !== 'string') throw new Error('claude envelope has no result string');
  const match = envelope.result.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('no JSON object in model result');
  return JSON.parse(match[0]) as { order?: unknown; rationales?: unknown };
}

function invokeClaude(prompt: string, model: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', '--model', model, '--output-format', 'json', '--tools', ''], {
      cwd,
      timeout: JOB_TIMEOUT_MS,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    child.on('error', (e) => reject(new Error(`failed to spawn claude: ${e.message}`)));
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`claude exited ${code}: ${stderr.slice(0, 500)}`));
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
