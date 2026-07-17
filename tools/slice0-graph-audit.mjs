// M5 slice 0 (#74): the gated chunk-graph experiment — token-free, deterministic.
//
// Builds the SHIPPED chunk graph (server chunk-graph-build.ts) for each dogfood subject,
// samples `calls` edges with a seeded RNG, writes blind audit cards + Tim's subsample files,
// and reports the free-glance proxy + chunk-size distribution. No AI / no claude jobs.
//
// Run from anywhere (paths are resolved against this file). The three subject repos all live
// in the shared read-only lexbox clone; override with LEXBOX=/path if needed.
//
//   node tools/slice0-graph-audit.mjs
//
// Deterministic: same repo state + same SEED => byte-identical cards, samples, stats.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const serverDist = path.join(repoRoot, 'packages/server/dist');

const { resolveRange, diffRange } = await import(path.join(serverDist, 'git.js'));
const { computeChunks } = await import(path.join(serverDist, 'chunks.js'));
const { buildChunkGraph } = await import(path.join(serverDist, 'chunk-graph-build.js'));
const { compileBook, chunkLineCount } = await import(path.join(repoRoot, 'packages/core/dist/index.js'));

const LEXBOX = process.env.LEXBOX ?? '/home/user/lexbox';
const OUT = path.join(repoRoot, 'docs/evals/chunk-graph-audit-2026-07-17');

// Base seed folded per-subject; recorded in the README and the report. Changing it re-draws.
const SEED = 20260717;
const SAMPLE_CAP = 30; // per subject; "or all, if fewer" (spec 05 slice 0)
const TIM_CAP = 15; // Tim's blind subsample per subject (subset of the sample, same stream)

const SUBJECTS = [
  { id: '2309', range: 'c0448522..pr-2309', blurb: 'Fix user-filter input loss under rapid typing — Svelte/TS' },
  { id: '2357', range: '277e418d8~1..277e418d8', blurb: 'Add activity filters to the activity view — mixed C#/Svelte/TS' },
  { id: '2379', range: '8dd70ba~1..8dd70ba', blurb: 'Ensure headwords are set on complex form components — C#-only' },
];

// mulberry32: tiny deterministic PRNG so the sample is reproducible without a dependency.
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFor(id) {
  // fold the subject id into the base seed so each subject draws its own stream
  let h = SEED >>> 0;
  for (const ch of id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return h;
}

function shuffledSample(items, n, seed) {
  const idx = items.map((_, i) => i);
  const rnd = mulberry32(seed);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, Math.min(n, idx.length)).map((i) => items[i]);
}

function ownedHeadLines(chunk) {
  const ranges = [];
  for (const h of chunk.hunks) if (h.headCount > 0) ranges.push({ start: h.headStart, end: h.headStart + h.headCount - 1 });
  return ranges.sort((a, b) => a.start - b.start);
}

function excerpt(headLines, ranges, maxLines) {
  const out = [];
  for (const r of ranges) {
    for (let ln = r.start; ln <= r.end && out.length < maxLines; ln++) {
      const text = headLines[ln - 1] ?? '';
      out.push(`${String(ln).padStart(5)}  ${text}`);
    }
    if (out.length >= maxLines) break;
  }
  return out;
}

function quantile(sorted, q) {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function stats(nums) {
  const s = [...nums].sort((a, b) => a - b);
  return {
    n: s.length,
    min: s[0] ?? 0,
    median: quantile(s, 0.5),
    p90: quantile(s, 0.9),
    max: s.at(-1) ?? 0,
    mean: s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0,
  };
}

const cardsDir = path.join(OUT);
mkdirSync(cardsDir, { recursive: true });

const report = { seed: SEED, subjects: [] };
const claudeTargets = []; // machine list of every sampled edge for Claude's sealed labeling

for (const subj of SUBJECTS) {
  const resolved = await resolveRange(LEXBOX, subj.range);
  const files = await diffRange(LEXBOX, resolved);
  const { chunks, contents, graph } = await computeChunks(LEXBOX, resolved, files);
  const { book, chunks: compiled } = compileBook({ files, chunks, graph, headSha: resolved.head });
  const cg = await buildChunkGraph({ chunks: compiled, contents, graph, book, files, headSha: resolved.head });

  const byId = new Map(compiled.map((c) => [c.id, c]));
  const headOf = (file) => contents.get(file)?.head ?? [];

  // --- edge counts by kind ---
  const byKind = {};
  for (const e of cg.edges) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;

  // --- sample `calls` edges ---
  const callsEdges = cg.edges
    .filter((e) => e.kind === 'calls')
    .sort((a, b) => {
      const ka = `${a.from}\0${a.to}\0${a.fromLines[0]?.start ?? 0}`;
      const kb = `${b.from}\0${b.to}\0${b.fromLines[0]?.start ?? 0}`;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  const sample = shuffledSample(callsEdges, SAMPLE_CAP, seedFor(subj.id));
  const timSubset = sample.slice(0, Math.min(TIM_CAP, sample.length));

  const label = (c) => (c ? `${c.file}${c.symbolPath.length ? ' :: ' + c.symbolPath.join('.') : ''}` : '(unknown)');

  // --- build card text ---
  const cards = [];
  sample.forEach((e, i) => {
    const cardId = `${subj.id}-e${String(i + 1).padStart(2, '0')}`;
    const caller = byId.get(e.from);
    const callee = byId.get(e.to);
    const callSite = excerpt(headOf(caller?.file ?? ''), e.fromLines, 6);
    const calleeDef = excerpt(headOf(callee?.file ?? ''), ownedHeadLines(callee ?? { hunks: [] }), 10);
    cards.push({
      cardId,
      inTimSubset: i < timSubset.length,
      from: e.from,
      to: e.to,
      callerLabel: label(caller),
      calleeLabel: label(callee),
      fromLines: e.fromLines.map((r) => (r.start === r.end ? `${r.start}` : `${r.start}-${r.end}`)).join(','),
      callSite,
      calleeDef,
    });
    claudeTargets.push({ cardId, subject: subj.id, from: e.from, to: e.to, callerLabel: label(caller), calleeLabel: label(callee) });
  });

  // --- write full cards file (all sampled, NO labels) ---
  const cardLines = [];
  cardLines.push(`# Audit cards — PR ${subj.id} (${subj.blurb})`);
  cardLines.push('');
  cardLines.push(`Range \`${subj.range}\` · head \`${resolved.head.slice(0, 12)}\` · seed \`${seedFor(subj.id)}\`.`);
  cardLines.push(`\`calls\` edges in graph: **${byKind.calls ?? 0}** · sampled: **${sample.length}** (cap ${SAMPLE_CAP}).`);
  if ((byKind.calls ?? 0) < SAMPLE_CAP) cardLines.push(`> Fewer than ${SAMPLE_CAP} \`calls\` edges — **all** of them are sampled.`);
  cardLines.push('');
  cardLines.push('Each card: caller chunk + the call-site line(s), then the callee chunk + its first defining lines. No labels here.');
  cardLines.push('');
  for (const c of cards) {
    cardLines.push(`## ${c.cardId}${c.inTimSubset ? ' _(in Tim subsample)_' : ''}`);
    cardLines.push('');
    cardLines.push(`**Caller:** \`${c.callerLabel}\``);
    cardLines.push(`chunk id: \`${c.from}\``);
    cardLines.push(`call site (L${c.fromLines}):`);
    cardLines.push('```');
    cardLines.push(...c.callSite);
    cardLines.push('```');
    cardLines.push(`**Callee:** \`${c.calleeLabel}\``);
    cardLines.push(`chunk id: \`${c.to}\``);
    cardLines.push('defining lines (first 10):');
    cardLines.push('```');
    cardLines.push(...c.calleeDef);
    cardLines.push('```');
    cardLines.push('');
  }
  writeFileSync(path.join(OUT, `cards-${subj.id}.md`), cardLines.join('\n'));

  // --- write Tim's blind file (subset, checkboxes, no opinions) ---
  const tim = [];
  tim.push(`# Tim's blind edge audit — PR ${subj.id}`);
  tim.push('');
  tim.push('**What this is.** Each card below is one `calls` edge the tool drew between two code chunks:');
  tim.push('a caller (with the exact line where the call sits) and the callee it thinks that call lands in.');
  tim.push('');
  tim.push('**Your job.** For each card, decide whether that link would genuinely help a reviewer —');
  tim.push('would you want a one-key jump between these two chunks? Tick one box per card:');
  tim.push('');
  tim.push('- **RELEVANT** — the link is real and useful; the caller really uses the callee.');
  tim.push('- **IRRELEVANT** — noise or wrong: the callee is not what that call actually resolves to,');
  tim.push('  or the link is too trivial to be worth an affordance.');
  tim.push('');
  tim.push('Go with your gut on a quick glance — that is the reviewer experience we are testing.');
  tim.push("Please don't open the sealed Claude-labels file until your ticks here are committed.");
  tim.push('');
  timSubset.forEach((e, i) => {
    const c = cards[i];
    tim.push(`## ${c.cardId}`);
    tim.push('');
    tim.push(`**Caller:** \`${c.callerLabel}\``);
    tim.push(`call site (L${c.fromLines}):`);
    tim.push('```');
    tim.push(...c.callSite);
    tim.push('```');
    tim.push(`**Callee:** \`${c.calleeLabel}\``);
    tim.push('defining lines (first 10):');
    tim.push('```');
    tim.push(...c.calleeDef);
    tim.push('```');
    tim.push('- [ ] RELEVANT');
    tim.push('- [ ] IRRELEVANT');
    tim.push('');
  });
  writeFileSync(path.join(OUT, `tim-audit-${subj.id}.md`), tim.join('\n'));

  // --- free-glance proxy: linear walk in book order, count already-reviewed neighbors per mark ---
  const adj = new Map();
  const link = (a, b) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a).add(b);
  };
  for (const e of cg.edges) {
    link(e.from, e.to);
    link(e.to, e.from);
  }
  const reviewed = new Set();
  const perMark = [];
  for (const section of book.sections) {
    for (const occ of section.occurrences) {
      if (reviewed.has(occ.chunkId)) continue; // mark a chunk once (first occurrence in book order)
      let already = 0;
      for (const nb of adj.get(occ.chunkId) ?? []) if (reviewed.has(nb)) already++;
      perMark.push(already);
      reviewed.add(occ.chunkId);
    }
  }
  const fg = stats(perMark);
  const withNeighbor = perMark.filter((n) => n >= 1).length;

  // --- chunk-size distribution ---
  const sizes = compiled.map((c) => chunkLineCount(c));
  const sz = stats(sizes);
  const leSmall = sizes.filter((n) => n <= 10).length;

  report.subjects.push({
    id: subj.id,
    range: subj.range,
    head: resolved.head.slice(0, 12),
    seed: seedFor(subj.id),
    chunks: compiled.length,
    edges: cg.edges.length,
    byKind,
    callsSampled: sample.length,
    timSubset: timSubset.length,
    freeGlance: { ...fg, marks: perMark.length, withNeighborPct: perMark.length ? (100 * withNeighbor) / perMark.length : 0 },
    size: { ...sz, leTenPct: sizes.length ? (100 * leSmall) / sizes.length : 0 },
  });
}

writeFileSync(path.join(OUT, 'audit-summary.json'), JSON.stringify(report, null, 2));
writeFileSync(path.join(OUT, 'claude-label-targets.json'), JSON.stringify(claudeTargets, null, 2));

// --- console report ---
for (const s of report.subjects) {
  console.log(`\n=== PR ${s.id} (${s.range}) head ${s.head} ===`);
  console.log(`chunks ${s.chunks}, edges ${s.edges}: ${Object.entries(s.byKind).map(([k, n]) => `${n} ${k}`).join(', ')}`);
  console.log(`calls sampled ${s.callsSampled}, Tim subsample ${s.timSubset}`);
  const fg = s.freeGlance;
  console.log(
    `free-glance/mark: mean ${fg.mean.toFixed(2)}, median ${fg.median}, p90 ${fg.p90}, max ${fg.max} over ${fg.marks} marks; ${fg.withNeighborPct.toFixed(1)}% have >=1 already-reviewed neighbor`,
  );
  const z = s.size;
  console.log(`chunk size (changed lines): min ${z.min}, median ${z.median}, p90 ${z.p90}, max ${z.max}; ${z.leTenPct.toFixed(1)}% <= 10 lines`);
}
console.log(`\nwrote cards-*.md, tim-audit-*.md, audit-summary.json, claude-label-targets.json to ${OUT}`);
