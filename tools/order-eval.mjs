#!/usr/bin/env node
// Blind pairwise readability judge for two orderings of the same book (spec 02, "The readability
// eval"). Generator-independent: takes two already-exported markdown books and judges them; it
// does not run the tier-1 ordering job or the mechanical --check-order pre-gate.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PROMPT_VERSION = 'order-eval-1';

const RUBRIC = `You are a code reviewer deciding which presentation order of the SAME set of changes reads better as a story. Two orderings of the same review book follow, labeled Book A and Book B — identical chunks, different section order.

Judge by these criteria, in priority order:
1. Definitions and dependencies appear before their uses.
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

// Blindness prep (R-026 applied to ourselves): rationales would tell the judge the AI's own
// sales pitch for a section instead of letting it read the order cold.
function stripRationales(text) {
  return text
    .split('\n')
    .filter((line) => !line.startsWith('> AI:'))
    .join('\n');
}

function headings(text) {
  return text
    .split('\n')
    .filter((line) => line.startsWith('## '))
    .map((line) => line.trim());
}

function headingDiff(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  const onlyInA = a.filter((h) => !setB.has(h));
  const onlyInB = b.filter((h) => !setA.has(h));
  return { onlyInA, onlyInB };
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

function invokeJudge(prompt, judgeModel, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'claude',
      ['-p', '--model', judgeModel, '--output-format', 'json', '--tools', ''],
      { cwd, timeout: JUDGE_TIMEOUT_MS },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (err) => reject(new Error(`failed to spawn claude CLI: ${err.message}`)));
    child.on('close', () => resolve({ stdout, stderr }));
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

// Extracts the judge's verdict from the CLI's `--output-format json` envelope. The envelope
// itself should parse cleanly; the model's answer lives in its `result` string, which may carry
// stray prose around the JSON object despite instructions, hence the defensive block extraction.
function parseVerdict(stdout) {
  const envelope = JSON.parse(stdout);
  if (typeof envelope.result !== 'string') throw new Error('envelope has no result string');
  const match = envelope.result.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('no JSON object found in result');
  const verdict = JSON.parse(match[0]);
  if (verdict.choice !== 'A' && verdict.choice !== 'B') throw new Error('choice is not A or B');
  if (typeof verdict.reason !== 'string' || verdict.reason.trim() === '') {
    throw new Error('reason is missing or empty');
  }
  return { choice: verdict.choice, reason: verdict.reason.trim() };
}

async function judgeOnce(prompt, judgeModel, cwd) {
  try {
    const { stdout } = await invokeJudge(prompt, judgeModel, cwd);
    return parseVerdict(stdout);
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

  const { onlyInA, onlyInB } = headingDiff(headings(textA), headings(textB));
  if (onlyInA.length > 0 || onlyInB.length > 0) {
    console.error(`${pathA} and ${pathB} do not have the same section headings — not the same book.`);
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
