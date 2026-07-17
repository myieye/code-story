# Spec 03 — Milestone 3: narration (the story layer)

**Status: grilled same-day (14 findings, verdict "needs surgery" — surgery folded in below;
the fingerprint redesign, the top-tier generator default, and the sparse-chunk-line rule all
came out of the grill). Slices #35–#39 all built same-day. Dogfood-4 gate result (issue #39,
baseline doc): register median 5 and orientation 4 on both subjects, but the faithfulness
floor FAILED (duplication claims from -U0 fragment misreads — #48 is the evidence-gated
narration-3 iteration). Narration is opt-in and stays opt-in; Tim's narrated-vs-bare read
(`docs/evals/narration-read-2026-07-17/`) is the open human half.**

## Why this milestone

M0–M2 built the skeleton: guaranteed-coverage chunks (R-001), a deterministic order (M1), and
an AI-improved order behind an eval gate (M2). The book now has the right pages in a sensible
sequence — but the pages don't *say* anything yet. The only AI-written text in the product is
the one-line ordering rationale per section.

Tim's vision is explicit that the point is a story, not a sorted diff:

> "I want to think as little as possible and just be able to read a thorough story of the
> code" (addendum 2026-07-16, R-034)

> "it's incredibly important that the story/narration reads really well… maybe think
> high-school english… Not too dense, light, easily accessible" (addendum 2026-07-16, R-036)

M3 adds that story layer: AI-written narration that *orients* the reviewer before and during
each section, in a register a tired human actually wants to read.

Requirements satisfied or advanced: R-005 (reads like a book), R-026 (human-in-forefront),
R-034 (story-quality eval), R-036 (register), R-042 (AI where it earns readability), R-024
(scripts first), R-027 (slow work in background bulk). R-008 is advanced only in its narrow
*narrative-payload* sense — the substance of R-008 (bodies of called methods, callers,
on-demand code context) is deferred, see non-goals. R-031–R-033 (steering toward "responsibly
mergeable") are deliberately deferred with it: M3 narration is comprehension-only and never
weighs merge trade-offs.

## Goal

When a reviewer opens a book, the book greets them with a short opener, each section with a
short plain-English introduction, and chunks that need it carry a one-line orientation — all
generated in bulk by a background job, clearly labeled AI, and gated by a register check that
keeps the text light.

Two deliverables, eval first (same shape as M2):

1. **The register gate + narration eval** — mechanical script checks (R-024) that hard-fail
   overlong or judgmental text, plus an LLM rubric grader for what scripts can't measure
   (orientation value, faithfulness to the diff).
2. **The narration job** — a resumable per-section background job that writes a narration
   overlay, rendered in the book UI and markdown export.

## What the narration says (and may never say)

Three text kinds, all in the overlay:

- **Book opener** (≤3 sentences, ≤320 chars): what this change is about as a whole and what
  thread to follow. Rendered above the first section.
- **Section intro** (≤2 sentences, ≤200 chars): what this file's part of the story is and
  what to look for. **No cross-section references** ("builds on the parser change" is banned)
  — every intro must be checkable against its own section's diff alone; the opener owns the
  cross-cutting thread. When an order overlay is applied, the intro **replaces** the rendered
  M2 rationale line (one AI voice per section header, not two). That deletes the why-this-
  order text from the reader — accepted; the rationale stays in the order overlay for the
  eval's use, and the narration prompt does not read it.
- **Chunk line** (≤1 sentence, ≤110 chars): orientation for one chunk. **Sparse by design**:
  the model is told to omit the line for any chunk whose diff speaks for itself — a mandatory
  sentence over every one of a 125-chunk book's diffs would itself be the wall of text R-036
  bans. Whether the lines that do appear help or clutter is an explicit dogfood question.

Hard rules:

- **Orient, don't judge.** Never "looks good", "correct", "safe", "simple", "clean refactor".
  Narration widens attention; it must never reassure (R-026; the Tufano-anchoring design gate
  — the load-bearing product-safety rule of this milestone).
- **Never imply completeness.** No "the rest is trivial". Coverage claims belong to the
  mechanical queue, not prose. This rule binds the *product surface* too: a partially
  narrated book must say so (see runtime shape) so bare sections read as "not narrated",
  never as "nothing to see here".
- **Register per R-036**: short sentences, everyday words, high-school English. Dense =
  defect, even when accurate.
- **Faithful or silent.** A narration line that misstates the code is worse than none. The
  rubric grader scores faithfulness against the actual diff; sections that fail regenerate
  once, then fall back to no narration (fail-open, like the order overlay).

## The register gate (scripts before AI, R-024)

Pure functions in core, run on every generated string *before* a section is persisted — and
reused verbatim by the eval tool:

- **Length caps** (hard): the per-kind sentence and character caps above. Overflow = fail.
- **Sentence-length cap** (hard, opener/intro only): no sentence over 22 words. (A chunk
  line's 110-char cap already binds tighter than any word rule.)
- **Judgment lint** (hard): a curated banned-phrase list for evaluative/reassuring language
  ("looks good", "correctly", "as expected", "simply", "elegant", "safe to", …).
  Case-insensitive, word-boundary matched, unit-tested; the list lives in core next to the
  gate and grows via dogfood findings.
- **Readability score** (soft): Flesch reading ease, computed with backtick-quoted spans
  collapsed to a single one-syllable token — identifiers like `validatePermutation` would
  otherwise tank the score of a genuinely light sentence. Recorded per text and surfaced to
  the eval; **not** a hard drop. (The grill killed Flesch-as-hard-gate: on code-referencing
  prose it over-rejects and the failures are indistinguishable from real density.)

A section whose narration fails a hard check is re-asked once with the failures named; a
second failure drops that section's narration and records the failure in the overlay entry
(`gateFailures`). The gate never blocks the book itself.

## The narration eval (R-034/R-036 gate, before default-on)

Mirrors the M2 eval discipline: mechanical pre-gate, LLM judgment where only judgment works,
human read as the final gate half. Unlike the order eval (which strips `> AI:` lines so the
judge reads cold), the narration eval *must* see the narration — it is the thing under test.

1. **Script gate** — the register gate above, applied to every string. Free, deterministic.
2. **Rubric grader** (`tools/narration-eval.mjs`): a judge model (id ≠ generator id,
   self-preference caveat recorded in every report) scores each narrated section 1–5 on three
   axes: **orientation** (does it tell you what to look for?), **register** (R-036 — would a
   tired reviewer read this happily?), **faithfulness** (does every claim match the code?).
   Section intros and chunk lines are graded against that section's diff (the no-cross-
   reference rule makes this sufficient); the opener is graded against the whole-book
   manifest. Any faithfulness score <4 must quote the offending claim. Reports archived
   under `docs/evals/reports/`.
3. **Dogfood read** — narrated vs bare book on a real PR. The question is not just "does it
   add noise" but **"does it reduce the felt wall-of-diffs burden vs bare"** — orientation
   prose without R-008 code context may dogfood as pleasant-but-not-load-bearing, and that
   null result is a named acceptable outcome: it shelves default-on narration and pivots M4
   toward code-context payloads instead.

Ship gate for default-on narration, defined over the population of all narrated sections
across two dogfood subjects: **faithfulness floor** (no section below 4 — the tail matters on
the safety axis, a median hides it), register and orientation median ≥4, script gate green,
and Tim's read says it helps. Per spec 02's own gate language: with two subjects this is
provisional and directional, not statistically confident. Until the gate passes, narration is
opt-in (`--narrate`, or the job endpoint), exactly like the M2 order overlay is opt-in.

## Runtime shape

- **Order-independent identity (the grill's blocker fix).** Narration must survive the order
  overlay being applied or dismissed, and must survive partial regeneration. It therefore
  does NOT reuse the order overlay's `bookFingerprint` (which digests sections in their
  current order — reordering changes it). Instead core gains
  `sectionFingerprint(headSha, section)` = fnv1a over headSha + CORE_VERSION + section id +
  the section's chunk ids in stable chunk order — insensitive to where the section sits in
  the book. The opener is keyed by the sorted set of section fingerprints. Applying the
  order overlay can never invalidate narration; a CORE_VERSION bump (or new head) still
  invalidates everything, by design.
- **Overlay artifact**: `reviews/<b12>..<h12>.narration.json` next to the order overlay —
  `{ version, model, promptVersion, opener: { text, key }, sections: { [sectionKey]:
  { fingerprint, intro, chunks: { [chunkId]: line }, generatedAt, gateFailures? } } }`.
  `sectionKey` = the Book section id (the changed-file path; the leftovers section and
  low-signal stubs get no narration by construction — narrating a lockfile is exactly the
  waste R-024 bans). Loading filters per section: an entry whose `fingerprint` doesn't match
  the current book is dropped, the rest survive. A chunk recurring within one section shares
  its line across those occurrences (same code, same orientation — acceptable; web rows
  look up `sections[row.sectionId].chunks[row.chunk.id]`).
- **Per-section job, resumable**: the job walks sections one `claude -p` call at a time,
  persisting the overlay after *each* section (the standing session-limits agreement: bulk
  jobs persist and resume). On start and on resume it recomputes section fingerprints and
  generates only sections with no fresh entry; "present" includes gateFailures-only entries,
  so a twice-failed section is not hammered on every resume. Job record sibling
  `.narration-job.json`, same lifecycle as the order job (orphaned `running` = failed; one
  in-flight per range; transient retries with backoff).
- **Prompt input per call**: the section's manifest entry (role, imports, chunk list) plus
  its chunks' diff text, capped at ~6k tokens per call — chunks beyond the cap get no line
  rather than a blind one (never narrate code the model didn't see; the gap is recorded in
  `gateFailures`).
- **Model tier**: generator defaults to **top-tier (opus)** — narration register is the
  strongest R-042 "AI must earn readability" case in the plan, the exact thing Tim called
  critical (R-036) after weak early attempts (R-034), and an eval baseline generated cheap
  would confound "narration doesn't work" with "cheap narration doesn't work". A sonnet
  generator is a *candidate downgrade* the eval must explicitly clear afterward (build-
  process routes only mechanical bulk work to cheap tiers; judgment text is top-tier work).
  `--model` overrides; tier recorded in overlay + job record.
- **Server**: `GET /api/narration`, `POST /api/narration-job` (409 when one is in flight).
  CLI: `--narrate [--model <id>]`; `--export book.md --narration` includes narration as
  `> AI:` blockquotes (opener under the title, intro under its section heading, chunk lines
  above their fences).
- **Partial-state honesty (grill finding 2)**: while the overlay is partial or a job is
  running, the web UI shows "AI narration: N of M sections" (mirroring the order indicator)
  and the export header carries the same line — bare sections must read as *not narrated*,
  never as *nothing worth saying*.
- **Web render**: narration is visually distinct from code and from static UI copy — labeled
  AI (R-026), quieter type, never inside the diff surface (R-006 boundary discipline: what
  is diff must stay unmistakable). Chunk lines ride the row model built in `rows.ts`; the
  intro renders on the section-header row; the opener is book-level above the feed. The M2
  `sectionRationale` RowView prop is **deleted** (the intro replaces the rendered rationale
  — the M2-review leftover is retired by removal, not relocation).

## Scoping calls (gradual auto-picked; ambitious path recorded)

1. **Narration text only — no code-context payloads.** Ambitious: R-006/R-008's full context
   payloads (bodies of called methods, callers, base/head navigation). That needs a
   code-access layer (arbitrary blobs at both shas) the daemon doesn't have; M4 candidate.
   Door stays open: the overlay's per-chunk value can grow payload kinds without a schema
   break, and narration never assumes it's the only payload.
2. **Per-section generation calls, not one book-sized call.** Ambitious: one call for global
   voice consistency. Deferred: blows the token guard on real books and is all-or-nothing on
   interruption; the opener carries the global thread. Revisit if dogfood shows disjointed
   voice.
3. **Static depth, no adaptive depth.** Ambitious: R-009/R-016/R-017 — reviewer-model-aware
   depth, first-sweep bulk requests, expandable deep dives. Deferred to the on-demand/thread
   milestone; the per-chunk object shape leaves room.
4. **Intro replaces the rendered ordering rationale.** Ambitious: merge both voices by
   feeding the rationale into the narration prompt. Rejected for M3 — two coupled AI jobs
   and a prompt dependency for one line of text; revisit only if dogfood misses the
   why-this-order information.
5. **No streaming/mid-flight interaction; `claude -p` per section.** Same call as spec 02's
   scoping call 5. Per-section granularity already gives incremental progress; SDK streaming
   waits for threads.

## Non-goals (M3)

- Code-context payloads, callers/callees, base/head navigation (R-006–R-008 full form).
- On-demand narration for a single chunk from the UI; first-sweep flagging (R-016);
  reviewer/author model (R-017); merge-pragmatism steering (R-031–R-033).
- Findings of any kind: narration is comprehension-mode only; findings-mode is a separate
  future surface per the anchoring design gate.
- Chunk-level reordering, new occurrences, threads (unchanged from M2).
- Narrating low-signal stubs or the leftovers section.

## Slices (filed just-in-time as GitHub issues when this spec lands)

1. **Core narration model + register gate** — section fingerprints, overlay types +
   per-section freshness filter, length/sentence/lint checks and the backtick-aware Flesch
   score as pure tested functions.
2. **Narration manifest + prompt** — per-section prompt input builder with the 6k cap +
   `narration-1` prompt (sparse chunk lines, no cross-section references, orient-don't-judge);
   snapshot-tested rendering.
3. **Server job + store + API** — resumable per-section job, overlay/job records,
   GET/POST endpoints, CLI `--narrate` / export `--narration` with the partial-state header.
4. **Web render** — useNarration hook, opener/intro/chunk-line rendering, AI labeling,
   partial-state indicator, `sectionRationale` prop retirement (ux-expert pass, R-029).
5. **Eval tool + dogfood 4** — `tools/narration-eval.mjs` rubric grader, run on two
   subjects (generator opus; judge a different id), baseline-doc section, narrated-vs-bare
   read for Tim, sonnet-downgrade trial if the gate passes.

Each slice demoable on a real diff.
