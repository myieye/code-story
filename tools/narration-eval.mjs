#!/usr/bin/env node
// Rubric grader for a narration overlay (spec 03 "The narration eval"). Two stages: a free
// deterministic script gate reusing core's checkNarrationText/fleschScore, then an LLM judge that
// scores each narrated section — and the opener — 1–5 on orientation, register, and faithfulness
// against the PLAIN book export's diffs. Generator-independent: it grades an already-written
// overlay, it does not run the narration job. Requires `pnpm build` (imports the server's
// claude-cli from dist so judge and job share one subprocess contract; imports the register gate
// from core's dist so eval and job apply the same checks).
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function infraError(message) {
  console.error(message);
  process.exit(1);
}

const { extractJsonBlock, invokeClaudeJson } = await import(
  join(here, '../packages/server/dist/claude-cli.js')
).catch(() => infraError('narration-eval: cannot load packages/server/dist/claude-cli.js — run pnpm build first'));

const { checkNarrationText, fleschScore } = await import(
  join(here, '../packages/core/dist/index.js')
).catch(() => infraError('narration-eval: cannot load packages/core/dist/index.js — run pnpm build first'));

const PROMPT_VERSION = 'narration-eval-1';
const JUDGE_TIMEOUT_MS = 10 * 60 * 1000;
const SELF_PREFERENCE_NOTE =
  'single-family judge (Claude): self-preference caveat applies; generator/judge ids must differ where possible';
const GATE_NOTE =
  'provisional and directional (one subject): the human read-through is the other gate half and is NOT reflected here — Tim reading narrated-vs-bare is required before default-on';

const RUBRIC_AXES = `Score on three axes, each an integer from 1 to 5:
- orientation: do the notes tell the reviewer what to look for? (5 = clearly orients, 1 = says nothing useful)
- register: light, plain, high-school English — would a tired reviewer read this happily? (5 = effortless, 1 = dense or stilted)
- faithfulness: does every claim match the code shown? (5 = fully accurate, 1 = contradicts the code)

If faithfulness is below 4 you MUST quote the offending claim verbatim in "faithfulnessQuote"; otherwise use "".

Respond with ONLY a single-line JSON object, nothing else, no markdown fences:
{"orientation": n, "register": n, "faithfulness": n, "faithfulnessQuote": "..."}`;

function usageError(message) {
  console.error(message);
  console.error(
    'usage: node tools/narration-eval.mjs <overlay.json> <book-export.md> [--judge-model sonnet] [--out report.json]',
  );
  process.exit(1);
}

function parseArgs(argv) {
  const opts = { judgeModel: 'sonnet', out: null, positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--judge-model') opts.judgeModel = argv[++i];
    else if (arg === '--out') opts.out = argv[++i];
    else opts.positional.push(arg);
  }
  return opts;
}

function readInput(path, what) {
  if (!existsSync(path)) usageError(`${what} not found: ${path}`);
  const raw = readFileSync(path, 'utf8');
  if (raw.trim() === '') usageError(`${what} is empty: ${path}`);
  return raw;
}

function loadOverlay(path) {
  const raw = readInput(path, 'overlay');
  let overlay;
  try {
    overlay = JSON.parse(raw);
  } catch (e) {
    usageError(`overlay is not valid JSON: ${path} (${e.message})`);
  }
  if (typeof overlay !== 'object' || overlay === null || typeof overlay.sections !== 'object' || overlay.sections === null) {
    usageError(`overlay does not look like a narration overlay (no "sections"): ${path}`);
  }
  return overlay;
}

// Level-2 headings only: "### foo" fails startsWith('## ') because its third char is '#', not ' '.
function sectionHeadings(exportText) {
  return exportText
    .split('\n')
    .filter((line) => line.startsWith('## '))
    .map((line) => line.slice(3).trim());
}

/** The export slice for one section: its `## <key>` heading line through the line before the next `## `. */
function sectionSlice(exportText, sectionKey) {
  const lines = exportText.split('\n');
  const start = lines.findIndex((line) => line.startsWith('## ') && line.slice(3).trim() === sectionKey);
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n').trim();
}

/**
 * Bounded opener context: the export's top matter (title + counts, everything before the first
 * section) then every section heading with the first non-blank line under it. Not the whole diff —
 * "what single thread to follow" needs the shape of the change, not every line of it.
 */
function openerContext(exportText) {
  const lines = exportText.split('\n');
  const firstSection = lines.findIndex((line) => line.startsWith('## '));
  const preamble = (firstSection < 0 ? lines : lines.slice(0, firstSection)).join('\n').trim();
  const out = preamble ? [preamble, ''] : [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('## ')) continue;
    out.push(lines[i].trim());
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].startsWith('## ')) break;
      if (lines[j].trim() !== '') {
        out.push(`  ${lines[j].trim()}`);
        break;
      }
    }
  }
  return out.join('\n');
}

function buildSectionPrompt(slice, intro, chunkLines) {
  const notes = [`intro: ${intro || '(none)'}`];
  const ids = Object.keys(chunkLines);
  if (ids.length === 0) notes.push('chunk lines: (none)');
  else {
    notes.push('chunk lines:');
    for (const id of ids) notes.push(`- ${chunkLines[id]}`);
  }
  return `You are grading short AI-written orientation notes that sit alongside one file's section of a code-review "book". A tired reviewer reads the book once, top to bottom; the notes are meant to orient them before and during this section. The notes never replace reading the diff.

${RUBRIC_AXES}

The section, as it appears in the book (heading, chunk titles, and diffs):
${slice}
(end of section)

The AI notes written for this section:
${notes.join('\n')}
(end of notes)`;
}

function buildOpenerPrompt(context, opener) {
  return `You are grading the AI-written opener of a code-review "book" — one short paragraph a tired reviewer reads first, before any file. It should say what the whole change is about and what single thread to follow through the book.

${RUBRIC_AXES}

The book's sections (one per changed file), each with the first line under its heading:
${context}
(end of sections)

The opener written for this book:
${opener}
(end of opener)`;
}

function parseScores(stdout) {
  const v = extractJsonBlock(stdout);
  for (const axis of ['orientation', 'register', 'faithfulness']) {
    if (!Number.isInteger(v[axis]) || v[axis] < 1 || v[axis] > 5) throw new Error(`${axis} is not an integer 1–5`);
  }
  const quote = typeof v.faithfulnessQuote === 'string' ? v.faithfulnessQuote.trim() : '';
  if (v.faithfulness < 4 && quote === '') throw new Error('faithfulness < 4 but no faithfulnessQuote');
  return { orientation: v.orientation, register: v.register, faithfulness: v.faithfulness, faithfulnessQuote: quote };
}

async function invoke(prompt, model, cwd) {
  if (process.env.CODE_STORY_EVAL_INVOKE === 'stub') {
    // Self-check seam: a fixed valid envelope, so the real parse/validate path still runs.
    return JSON.stringify({ result: '{"orientation": 4, "register": 5, "faithfulness": 5, "faithfulnessQuote": ""}' });
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

function gateText(kind, text, section, chunkId) {
  return { kind, section, chunkId, text, failures: checkNarrationText(kind, text), flesch: Math.round(fleschScore(text) * 10) / 10 };
}

function median(nums) {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const [overlayPath, exportPath] = opts.positional;
  if (!overlayPath || !exportPath) usageError('an overlay path and a book-export path are required');

  const overlay = loadOverlay(overlayPath);
  const exportText = readInput(exportPath, 'book export');
  const headings = new Set(sectionHeadings(exportText));

  const sectionKeys = Object.keys(overlay.sections);
  const missing = sectionKeys.filter((key) => !headings.has(key));
  if (missing.length > 0) {
    console.error(`overlay and book export do not match — these overlay section keys are absent from the export headings:`);
    for (const key of missing) console.error(`  ${key}`);
    process.exit(2);
  }

  // Stage 1 — script gate (free, deterministic).
  const opener = typeof overlay.opener?.text === 'string' ? overlay.opener.text : '';
  const scriptTexts = [];
  if (opener) scriptTexts.push(gateText('opener', opener, null, null));
  for (const key of sectionKeys) {
    const entry = overlay.sections[key];
    if (typeof entry.intro === 'string' && entry.intro) scriptTexts.push(gateText('intro', entry.intro, key, null));
    for (const [chunkId, line] of Object.entries(entry.chunks ?? {})) {
      if (typeof line === 'string' && line) scriptTexts.push(gateText('chunkLine', line, key, chunkId));
    }
  }
  const hardFailuresPresent = scriptTexts.some((t) => t.failures.length > 0);
  // A persisted section the job dropped for register reasons — informational, not a bug.
  const droppedSections = sectionKeys
    .filter((key) => Array.isArray(overlay.sections[key].gateFailures) && overlay.sections[key].gateFailures.length > 0)
    .map((key) => ({ section: key, gateFailures: overlay.sections[key].gateFailures }));

  // Stage 2 — LLM rubric.
  const cwd = mkdtempSync(join(tmpdir(), 'narration-eval-'));
  let invalidTrials = 0;
  const sectionResults = [];
  let openerResult = null;
  try {
    if (opener) {
      const scores = await judge(buildOpenerPrompt(openerContext(exportText), opener), opts.judgeModel, cwd);
      if (!scores) invalidTrials++;
      openerResult = { text: opener, scores, invalid: !scores };
    }
    for (const key of sectionKeys) {
      const entry = overlay.sections[key];
      const intro = typeof entry.intro === 'string' ? entry.intro : '';
      const chunkLines = {};
      for (const [id, line] of Object.entries(entry.chunks ?? {})) {
        if (typeof line === 'string' && line) chunkLines[id] = line;
      }
      // Nothing to grade: the entry only records a drop.
      if (!intro && Object.keys(chunkLines).length === 0) {
        sectionResults.push({ section: key, intro, chunkLineCount: 0, scores: null, skipped: 'no narration text (dropped or empty)' });
        continue;
      }
      const slice = sectionSlice(exportText, key);
      const scores = await judge(buildSectionPrompt(slice, intro, chunkLines), opts.judgeModel, cwd);
      if (!scores) invalidTrials++;
      sectionResults.push({ section: key, intro, chunkLineCount: Object.keys(chunkLines).length, scores, invalid: !scores });
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }

  // Gate math (spec 03): faithfulness FLOOR over all narrated units (sections + opener — the safety
  // axis tail matters everywhere), register/orientation medians over the graded sections.
  const graded = sectionResults.filter((r) => r.scores);
  const registerMedian = median(graded.map((r) => r.scores.register));
  const orientationMedian = median(graded.map((r) => r.scores.orientation));

  const faithfulnessFloor = [];
  for (const r of graded) {
    if (r.scores.faithfulness < 4) {
      faithfulnessFloor.push({ section: r.section, faithfulness: r.scores.faithfulness, quote: r.scores.faithfulnessQuote });
    }
  }
  if (openerResult?.scores && openerResult.scores.faithfulness < 4) {
    faithfulnessFloor.push({ section: '(opener)', faithfulness: openerResult.scores.faithfulness, quote: openerResult.scores.faithfulnessQuote });
  }

  const faithfulnessFloorMet = faithfulnessFloor.length === 0 && graded.length > 0;
  const pass =
    faithfulnessFloorMet && registerMedian !== null && orientationMedian !== null && registerMedian >= 4 && orientationMedian >= 4;

  const report = {
    promptVersion: PROMPT_VERSION,
    judgeModel: opts.judgeModel,
    inputs: { overlay: overlayPath, bookExport: exportPath },
    generatorModel: typeof overlay.model === 'string' ? overlay.model : null,
    generatorPromptVersion: typeof overlay.promptVersion === 'string' ? overlay.promptVersion : null,
    timestamp: new Date().toISOString(),
    scriptGate: { hardFailuresPresent, texts: scriptTexts, droppedSections },
    opener: openerResult,
    sections: sectionResults,
    invalidTrials,
    faithfulnessFloor,
    gate: { faithfulnessFloorMet, registerMedian, orientationMedian, pass, note: GATE_NOTE },
    metadata: { note: SELF_PREFERENCE_NOTE },
  };

  console.log(`narration-eval report (${PROMPT_VERSION}) — judge model: ${opts.judgeModel}`);
  if (report.generatorModel) console.log(`generator: ${report.generatorModel} (${report.generatorPromptVersion ?? 'prompt ?'})`);
  console.log('');
  console.log('script gate:');
  if (hardFailuresPresent) {
    console.log('  !! HARD-GATE FAILURES on persisted narration — the job gates before persist, so this is a BUG SIGNAL:');
    for (const t of scriptTexts.filter((x) => x.failures.length > 0)) {
      console.log(`    [${t.kind}${t.section ? ` ${t.section}` : ''}] ${t.failures.join('; ')}`);
    }
  } else {
    console.log(`  ${scriptTexts.length} text(s) checked, no hard failures`);
  }
  if (droppedSections.length > 0) {
    console.log(`  ${droppedSections.length} section(s) recorded as dropped (gateFailures) — no narration to judge`);
  }
  console.log('');
  console.log('rubric (orientation / register / faithfulness):');
  if (openerResult) {
    const s = openerResult.scores;
    console.log(`  opener: ${s ? `${s.orientation} / ${s.register} / ${s.faithfulness}` : 'INVALID (unparseable after re-ask)'}`);
    if (s?.faithfulnessQuote) console.log(`    faithfulness quote: ${s.faithfulnessQuote}`);
  }
  for (const r of sectionResults) {
    if (r.skipped) {
      console.log(`  ${r.section}: skipped — ${r.skipped}`);
      continue;
    }
    const s = r.scores;
    console.log(`  ${r.section}: ${s ? `${s.orientation} / ${s.register} / ${s.faithfulness}` : 'INVALID (unparseable after re-ask)'} (${r.chunkLineCount} chunk line(s))`);
    if (s?.faithfulnessQuote) console.log(`    faithfulness quote: ${s.faithfulnessQuote}`);
  }
  console.log('');
  console.log('gate:');
  console.log(`  faithfulness floor met (no unit < 4): ${faithfulnessFloorMet}`);
  if (faithfulnessFloor.length > 0) {
    for (const f of faithfulnessFloor) console.log(`    below floor: ${f.section} = ${f.faithfulness} — "${f.quote}"`);
  }
  console.log(`  register median: ${registerMedian ?? 'n/a'} (need >= 4)`);
  console.log(`  orientation median: ${orientationMedian ?? 'n/a'} (need >= 4)`);
  console.log(`  invalid trials: ${invalidTrials}`);
  console.log(`  PASS (provisional, human read excluded): ${pass}`);
  console.log('');
  console.log(GATE_NOTE);
  console.log(SELF_PREFERENCE_NOTE);

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
