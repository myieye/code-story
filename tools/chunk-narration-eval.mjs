#!/usr/bin/env node
// Rubric grader for a per-chunk narration overlay (spec 06 slice 5 / spec 07 G2 — the "chunk
// badges + AI lines" that ship DEFAULT-ON with prompt narration-chunk-1). This is the named
// G2 fast-follow eval: the register/badge HARD gates already run at generation; this judges what
// the hard gates cannot — faithfulness (does the badge/line claim match the real diff?) and the
// usefulness of the register (grounding value, not just rule compliance).
//
// Generator-independent: it grades an already-written overlay, it does not run the narration job.
// For EVERY narrated chunk (one with a shipped badge and/or line) an LLM judge (claude -p, model
// sonnet — judge tier < opus generator, so note the self-preference caveat) sees the chunk's real
// unified diff (reconstructed here via the SAME core render the generator used) plus the badge and
// line, and scores register 1–5, faithfulness PASS/FLAG (a confident-wrong claim = floor failure),
// and grounding 1–5. Per-chunk results persist to a JSON sidecar as they complete, so a crash or a
// usage-limit kill resumes cheaply.
//
// Requires `pnpm build` (imports the server's claude-cli + chunk pipeline from dist, and core's
// register gates from dist, so the eval and the job share one subprocess + gate contract).
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function infraError(message) {
  console.error(message);
  process.exit(1);
}

// Dynamic import needs a file:// URL for absolute paths on Windows — a bare drive path (D:\…) throws.
const load = (rel) =>
  import(pathToFileURL(join(here, rel)).href).catch(() =>
    infraError(`chunk-narration-eval: cannot load ${rel} — run pnpm build first`),
  );

const { extractJsonBlock, invokeClaudeJson } = await load('../packages/server/dist/claude-cli.js');
const { resolveRange, diffRange } = await load('../packages/server/dist/git.js');
const { computeChunks } = await load('../packages/server/dist/chunks.js');
const { unifiedChunkLines, checkNarrationText, checkBadgeText, chunkNarrationFingerprint } = await load(
  '../packages/core/dist/index.js',
);

const PROMPT_VERSION = 'chunk-narration-eval-1';
const JUDGE_TIMEOUT_MS = 8 * 60 * 1000;
const DIFF_CHAR_CAP = 24000; // guard the judge's context on the rare huge (budget-omitted) chunk
const SELF_PREFERENCE_NOTE =
  'single-family judge (Claude sonnet) vs Claude-opus generator: self-preference caveat applies (judge tier deliberately below the generator to blunt it, not remove it).';

const RUBRIC = `You are auditing one short AI-written label attached to a single chunk of a code-review "book". A tired reviewer reads the book once, top to bottom. BEFORE reading a chunk's diff they see a badge (a 2-4 word tag) and sometimes a one-line orientation note. The label never replaces the diff — it points the reviewer at what to look for.

You are given the chunk's title, its unified diff, and the AI label. In the diff: a line starting with "+" was ADDED, "-" was REMOVED, " " is unchanged context, and "…" marks an omitted gap. A "-"/"+" pair is ONE line edited, not two copies.

Score three things:

- register (integer 1-5): is the label light, plain, high-school English, at most one short sentence? 5 = effortless to read; 1 = dense, stilted, jargon-heavy, or long.

- faithfulness ("PASS" or "FLAG"): does every claim in the label match what the diff actually shows?
  - A label that POINTS ("check the null handling", "confirm this path is reached", "compare the two sorts") asserts nothing about the outcome — that is PASS even if the diff alone can't tell you the answer.
  - FLAG only when the label ASSERTS something the diff does not show, contradicts the diff, names code that is not in the diff, or claims a semantic outcome that holds on only one branch/path. A confident-but-wrong claim is a FLAG.
  - When you FLAG: put the offending words verbatim in "faithfulnessQuote" and one sentence of diff evidence in "faithfulnessWhy". When PASS: leave both "".

- grounding (integer 1-5): would this label genuinely orient a reviewer before they read the diff — say something useful a first glance at the diff would not? 5 = real orientation; 3 = mild help; 1 = filler, or it only restates the title/obvious.

Respond with ONLY a single-line JSON object, no markdown fences:
{"register": n, "faithfulness": "PASS", "faithfulnessQuote": "", "faithfulnessWhy": "", "grounding": n}`;

function usageError(message) {
  console.error(message);
  console.error(
    'usage: node tools/chunk-narration-eval.mjs --repo <path> --range <base..head> --overlay <overlay.json> --subject <label> --out <sidecar.json> [--judge-model sonnet] [--concurrency 4] [--limit N]',
  );
  process.exit(1);
}

function parseArgs(argv) {
  const opts = { judgeModel: 'sonnet', concurrency: 4, limit: Infinity };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--repo') opts.repo = argv[++i];
    else if (a === '--range') opts.range = argv[++i];
    else if (a === '--overlay') opts.overlay = argv[++i];
    else if (a === '--subject') opts.subject = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--judge-model') opts.judgeModel = argv[++i];
    else if (a === '--concurrency') opts.concurrency = Number(argv[++i]);
    else if (a === '--limit') opts.limit = Number(argv[++i]);
    else usageError(`unknown argument: ${a}`);
  }
  if (!opts.repo || !opts.range || !opts.overlay || !opts.subject || !opts.out) {
    usageError('--repo, --range, --overlay, --subject and --out are all required');
  }
  return opts;
}

// Same rendering the generator saw (narration.ts chunkDiffText): unifiedChunkLines with no
// changedLines colouring, prefixed with +/-/space, gaps as "…".
function chunkDiffText(chunk, contents) {
  const marks = { add: '+', del: '-', context: ' ' };
  return unifiedChunkLines(chunk, contents)
    .map((line) => (line.type === 'gap' ? '…' : `${marks[line.type]}${line.text}`))
    .join('\n');
}

function chunkTitleOf(chunk) {
  return `${chunk.file}${chunk.symbolPath.length ? ' :: ' + chunk.symbolPath.join('.') : ''}`;
}

function buildPrompt(chunk, diffText, badge, line) {
  const capped = diffText.length > DIFF_CHAR_CAP ? diffText.slice(0, DIFF_CHAR_CAP) + '\n…(diff truncated for the judge)' : diffText;
  const label = [badge ? `badge: ${badge}` : null, line ? `line: ${line}` : null].filter(Boolean).join('\n');
  return `${RUBRIC}

Chunk title: ${chunkTitleOf(chunk)} (${chunk.kind})

Diff:
${capped || '(no diff content)'}
(end of diff)

The AI label:
${label}
(end of label)`;
}

function parseScores(stdout) {
  const v = extractJsonBlock(stdout);
  if (!Number.isInteger(v.register) || v.register < 1 || v.register > 5) throw new Error('register not an integer 1-5');
  if (!Number.isInteger(v.grounding) || v.grounding < 1 || v.grounding > 5) throw new Error('grounding not an integer 1-5');
  if (v.faithfulness !== 'PASS' && v.faithfulness !== 'FLAG') throw new Error('faithfulness not PASS/FLAG');
  const quote = typeof v.faithfulnessQuote === 'string' ? v.faithfulnessQuote.trim() : '';
  const why = typeof v.faithfulnessWhy === 'string' ? v.faithfulnessWhy.trim() : '';
  if (v.faithfulness === 'FLAG' && quote === '') throw new Error('FLAG but no faithfulnessQuote');
  return { register: v.register, grounding: v.grounding, faithfulness: v.faithfulness, faithfulnessQuote: quote, faithfulnessWhy: why };
}

async function invoke(prompt, model, cwd) {
  if (process.env.CODE_STORY_EVAL_INVOKE === 'stub') {
    return JSON.stringify({ result: '{"register": 5, "faithfulness": "PASS", "faithfulnessQuote": "", "faithfulnessWhy": "", "grounding": 4}' });
  }
  return invokeClaudeJson(prompt, model, cwd, JUDGE_TIMEOUT_MS);
}

async function judge(prompt, model, cwd) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return parseScores(await invoke(prompt, model, cwd));
    } catch {
      /* re-ask once, then give up */
    }
  }
  return null;
}

function median(nums) {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function loadSidecar(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!Number.isInteger(opts.concurrency) || opts.concurrency < 1) usageError('--concurrency must be a positive integer');

  const overlayRaw = readFileSync(opts.overlay, 'utf8');
  const overlay = JSON.parse(overlayRaw);
  if (overlay.version !== 2 || typeof overlay.chunks !== 'object') infraError(`not a v2 chunk-narration overlay: ${opts.overlay}`);

  const resolved = await resolveRange(opts.repo, opts.range);
  const files = await diffRange(opts.repo, resolved);
  const { chunks, contents } = await computeChunks(opts.repo, resolved, files);
  const byId = new Map(chunks.map((c) => [c.id, c]));

  // Narrated chunks = overlay entries with a shipped badge and/or line. Bare entries (fingerprint
  // only) shipped nothing to the reviewer, so there is nothing to judge.
  const narrated = [];
  const missing = [];
  const stale = [];
  for (const [id, entry] of Object.entries(overlay.chunks)) {
    const badge = typeof entry.badge === 'string' && entry.badge ? entry.badge : undefined;
    const line = typeof entry.line === 'string' && entry.line ? entry.line : undefined;
    if (!badge && !line) continue;
    const chunk = byId.get(id);
    if (!chunk) {
      missing.push(id);
      continue;
    }
    // Freshness sanity: the overlay entry's fingerprint should match the recomputed one (same head,
    // same CORE_VERSION, same content). A mismatch means we'd be judging text against a diff it was
    // not written for — record it and skip.
    const expected = chunkNarrationFingerprint(resolved.head, id);
    if (entry.fingerprint !== expected) {
      stale.push(id);
      continue;
    }
    narrated.push({ id, chunk, badge, line, gateFailures: Array.isArray(entry.gateFailures) ? entry.gateFailures : [] });
  }

  // Free deterministic gate stage: shipped text should already pass the hard gates (the job gates
  // before persist). A failure here is a BUG SIGNAL, not a rubric result.
  const hardGateFailures = [];
  for (const n of narrated) {
    if (n.line) {
      const f = checkNarrationText('chunkLine', n.line);
      if (f.length) hardGateFailures.push({ id: n.id, kind: 'line', text: n.line, failures: f });
    }
    if (n.badge) {
      const f = checkBadgeText(n.badge);
      if (f.length) hardGateFailures.push({ id: n.id, kind: 'badge', text: n.badge, failures: f });
    }
  }

  const sidecar = loadSidecar(opts.out) ?? {
    promptVersion: PROMPT_VERSION,
    subject: opts.subject,
    range: opts.range,
    overlay: opts.overlay,
    judgeModel: opts.judgeModel,
    generatorModel: overlay.model ?? null,
    generatorPromptVersion: overlay.promptVersion ?? null,
    results: {},
  };
  sidecar.results ??= {};

  const todo = narrated.filter((n) => !sidecar.results[n.id]).slice(0, opts.limit);
  console.log(
    `chunk-narration-eval [${opts.subject}] — ${narrated.length} narrated chunks (${missing.length} missing id, ${stale.length} stale fp); ` +
      `${Object.keys(sidecar.results).length} already judged, ${todo.length} to judge (judge=${opts.judgeModel}, concurrency=${opts.concurrency})`,
  );

  const cwd = mkdtempSync(join(tmpdir(), 'chunk-narr-eval-'));
  let calls = 0;
  try {
    let cursor = 0;
    const persist = () => writeFileSync(opts.out, JSON.stringify(sidecar, null, 2));
    async function worker() {
      for (;;) {
        const i = cursor++;
        if (i >= todo.length) return;
        const n = todo[i];
        const diffText = chunkDiffText(n.chunk, contents.get(n.chunk.file));
        const scores = await judge(buildPrompt(n.chunk, diffText, n.badge, n.line), opts.judgeModel, cwd);
        calls++;
        sidecar.results[n.id] = {
          title: chunkTitleOf(n.chunk),
          kind: n.chunk.kind,
          badge: n.badge ?? null,
          line: n.line ?? null,
          gateFailures: n.gateFailures,
          scores,
          invalid: !scores,
        };
        persist();
        process.stdout.write(scores ? '.' : 'x');
      }
    }
    await Promise.all(Array.from({ length: Math.min(opts.concurrency, todo.length || 1) }, worker));
    process.stdout.write('\n');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }

  // Aggregate over EVERY judged narrated chunk (resumed + this run).
  const judged = narrated.map((n) => ({ id: n.id, ...sidecar.results[n.id] })).filter((r) => r.scores);
  const invalid = narrated.filter((n) => sidecar.results[n.id] && !sidecar.results[n.id].scores).length;
  const registerMedian = median(judged.map((r) => r.scores.register));
  const groundingMedian = median(judged.map((r) => r.scores.grounding));
  const flags = judged.filter((r) => r.scores.faithfulness === 'FLAG');
  const floorMet = flags.length === 0 && judged.length > 0;

  sidecar.summary = {
    narratedCount: narrated.length,
    judgedCount: judged.length,
    invalidCount: invalid,
    missingIds: missing,
    staleIds: stale,
    hardGateFailures,
    registerMedian,
    groundingMedian,
    flagCount: flags.length,
    faithfulnessFloorMet: floorMet,
    judgeCallsThisRun: calls,
    selfPreferenceNote: SELF_PREFERENCE_NOTE,
  };
  writeFileSync(opts.out, JSON.stringify(sidecar, null, 2));

  console.log(`\n[${opts.subject}] register median: ${registerMedian ?? 'n/a'} | grounding median: ${groundingMedian ?? 'n/a'}`);
  console.log(`faithfulness floor met (no FLAG): ${floorMet} — ${flags.length} flag(s)`);
  for (const f of flags) {
    console.log(`  FLAG ${f.title}`);
    console.log(`    badge: ${f.badge ?? '(none)'} | line: ${f.line ?? '(none)'}`);
    console.log(`    quote: "${f.scores.faithfulnessQuote}" — ${f.scores.faithfulnessWhy}`);
  }
  if (hardGateFailures.length) console.log(`!! ${hardGateFailures.length} hard-gate failure(s) on SHIPPED text — bug signal`);
  if (invalid) console.log(`invalid (unparseable after re-ask): ${invalid}`);
  console.log(`judge calls this run: ${calls}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err.stack ?? err);
  process.exit(1);
});
