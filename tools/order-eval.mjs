#!/usr/bin/env node
// Blind pairwise readability judge for two orderings of the same book. Generator-independent:
// takes two already-exported markdown books and judges them; it does not run the tier-1
// ordering job or the mechanical --check-order pre-gate. Requires `pnpm build` (imports the
// server's claude-cli module from dist so judge and job share one subprocess contract).
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { extractJsonBlock, invokeClaudeJson } = await import(
  join(here, '../packages/server/dist/claude-cli.js')
).catch(() => {
  console.error('order-eval: cannot load packages/server/dist/claude-cli.js — run pnpm build first');
  process.exit(1);
});

const PROMPT_VERSION = 'order-eval-2';

// Criterion 1 is deliberately direction-neutral: the configured reading direction (consumer-first
// vs dependency-first, R-044) is an axiom both books share, not something the judge may score.
const RUBRIC = `You are a code reviewer deciding which presentation order of the SAME set of changes reads better as a story. Two orderings of the same review book follow, labeled Book A and Book B — identical chunks, different section order.

Judge by these criteria, in priority order:
1. Each chunk is understandable when you reach it: the context it needs has already appeared, or the order makes clear where it is going next.
2. One concern at a time: related sections sit adjacent; unrelated housekeeping is not interleaved with the main change.
3. The order builds toward the point of the change rather than burying it.

Pick exactly one of A or B — no ties. Respond with ONLY a single-line JSON object, nothing else, no markdown fences:
{"choice": "A", "reason": "one sentence"}`;

const JUDGE_TIMEOUT_MS = 10 * 60 * 1000;

function usageError(message) {
  console.error(message);
  console.error(
    'usage: node tools/order-eval.mjs <bookA.md> <bookB.md> [--trials 3] [--judge-model sonnet] [--out report.json]',
  );
  process.exit(1);
}

function parseArgs(argv) {
  const opts = { trials: 3, judgeModel: 'sonnet', out: null, positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--trials') opts.trials = Number(argv[++i]);
    else if (arg === '--judge-model') opts.judgeModel = argv[++i];
    else if (arg === '--out') opts.out = argv[++i];
    else opts.positional.push(arg);
  }
  return opts;
}

function readBook(path) {
  if (!existsSync(path)) usageError(`book not found: ${path}`);
  const raw = readFileSync(path, 'utf8');
  if (raw.trim() === '') usageError(`book is empty: ${path}`);
  return raw;
}

// Rationales would hand the judge the AI's own pitch for its order; the judge reads cold.
function stripRationales(text) {
  return text
    .split('\n')
    .filter((line) => !line.startsWith('> AI:'))
    .join('\n');
}

// The "same book" guard, arrangement-agnostic. Both orderings must present the same chunks —
// true in file mode and chapter mode alike. Section (chapter) titles and per-occurrence
// "— from <file>" labels legitimately differ once the AI regroups chunks into new chapters, so
// compare the multiset of per-chunk (`### `) headings with those labels stripped.
function chunkKeys(text) {
  return text
    .split('\n')
    .filter((line) => line.startsWith('### '))
    .map((line) => line.replace(/ — from .*$/, '').trim())
    .sort();
}

function chunkKeyDiff(a, b) {
  const remaining = [...b];
  const onlyInA = [];
  for (const key of a) {
    const at = remaining.indexOf(key);
    if (at === -1) onlyInA.push(key);
    else remaining.splice(at, 1);
  }
  return { onlyInA, onlyInB: remaining };
}

function buildPrompt(textA, textB) {
  return `${RUBRIC}

Book A:
${textA}
(end of Book A)

Book B:
${textB}
(end of Book B)`;
}

function parseVerdict(stdout) {
  const verdict = extractJsonBlock(stdout);
  if (verdict.choice !== 'A' && verdict.choice !== 'B') throw new Error('choice is not A or B');
  if (typeof verdict.reason !== 'string' || verdict.reason.trim() === '') {
    throw new Error('reason is missing or empty');
  }
  return { choice: verdict.choice, reason: verdict.reason.trim() };
}

async function judgeOnce(prompt, judgeModel, cwd) {
  try {
    return parseVerdict(await invokeClaudeJson(prompt, judgeModel, cwd, JUDGE_TIMEOUT_MS));
  } catch {
    return null;
  }
}

async function runTrial(trialNum, textA, textB, judgeModel, cwd) {
  const firstIsA = Math.random() < 0.5;
  const labeledA = firstIsA ? textA : textB;
  const labeledB = firstIsA ? textB : textA;
  const assignment = { A: firstIsA ? 'first-arg' : 'second-arg', B: firstIsA ? 'second-arg' : 'first-arg' };
  const prompt = buildPrompt(labeledA, labeledB);

  let verdict = await judgeOnce(prompt, judgeModel, cwd);
  if (!verdict) verdict = await judgeOnce(prompt, judgeModel, cwd);

  if (!verdict) {
    return { trial: trialNum, assignment, choice: null, resolvedWinner: null, reason: 'invalid: judge output unparseable after re-ask' };
  }
  return {
    trial: trialNum,
    assignment,
    choice: verdict.choice,
    resolvedWinner: assignment[verdict.choice],
    reason: verdict.reason,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const [pathA, pathB] = opts.positional;
  if (!pathA || !pathB) usageError('two book paths are required');
  if (!Number.isInteger(opts.trials) || opts.trials < 1) usageError(`--trials must be a positive integer, got: ${opts.trials}`);

  const rawA = readBook(pathA);
  const rawB = readBook(pathB);
  const textA = stripRationales(rawA);
  const textB = stripRationales(rawB);

  const { onlyInA, onlyInB } = chunkKeyDiff(chunkKeys(textA), chunkKeys(textB));
  if (onlyInA.length > 0 || onlyInB.length > 0) {
    console.error(`${pathA} and ${pathB} do not present the same chunks — not the same book.`);
    console.error(`only in ${pathA}:\n${onlyInA.map((h) => `  ${h}`).join('\n') || '  (none)'}`);
    console.error(`only in ${pathB}:\n${onlyInB.map((h) => `  ${h}`).join('\n') || '  (none)'}`);
    process.exit(2);
  }

  const cwd = mkdtempSync(join(tmpdir(), 'order-eval-'));
  const trials = [];
  try {
    for (let i = 1; i <= opts.trials; i++) {
      trials.push(await runTrial(i, textA, textB, opts.judgeModel, cwd));
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }

  const totals = { [pathA]: 0, [pathB]: 0 };
  let invalidCount = 0;
  for (const t of trials) {
    if (t.resolvedWinner === 'first-arg') totals[pathA]++;
    else if (t.resolvedWinner === 'second-arg') totals[pathB]++;
    else invalidCount++;
  }

  const report = {
    promptVersion: PROMPT_VERSION,
    judgeModel: opts.judgeModel,
    inputs: { firstArg: pathA, secondArg: pathB },
    timestamp: new Date().toISOString(),
    trials,
    totals,
    invalidTrials: invalidCount,
    metadata: {
      note: 'single-family judge (Claude): self-preference caveat applies; generator/judge ids must differ where possible',
    },
  };

  console.log(`order-eval report (${PROMPT_VERSION}) — judge model: ${opts.judgeModel}`);
  console.log(`${pathA} = first-arg, ${pathB} = second-arg`);
  for (const t of trials) {
    const outcome = t.resolvedWinner ? `winner: ${t.resolvedWinner}` : 'invalid trial';
    console.log(`  trial ${t.trial}: A=${t.assignment.A} B=${t.assignment.B} -> choice ${t.choice ?? 'n/a'} (${outcome}) — ${t.reason}`);
  }
  console.log('totals:');
  console.log(`  ${pathA}: ${totals[pathA]} win(s)`);
  console.log(`  ${pathB}: ${totals[pathB]} win(s)`);
  console.log(`  invalid: ${invalidCount}`);
  console.log(report.metadata.note);

  if (opts.out) {
    writeFileSync(opts.out, JSON.stringify(report, null, 2));
    console.log(`report written to ${opts.out}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err.stack ?? err);
  process.exit(1);
});
