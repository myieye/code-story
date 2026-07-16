# Spec 02 — Milestone 2: tier-1 AI ordering

Status: proposed — scoped by the standing gradual-auto-pick rule (Tim 2026-07-16); each scoping
call below records the deferred ambitious path. Tim can veto any pick.
Date: 2026-07-16
Satisfies: R-042 (the AI half of the ladder — this is the milestone where AI must *earn* its
tokens), R-005 (narrative ordering + "an AI can score the readability of the generated book"),
R-034 (eval-first: the readability eval is the deliverable that decides shipping), R-024 (every
mechanical piece stays script), R-036 (rationales are the product's first AI-written strings),
R-026 (AI output labeled, never persuasive), R-031–R-033 (partial: rationales may flag
merge-relevant sections early).
Evidence: dogfood 1 (`docs/evals/dogfood-0-baseline.md`) — tier 0 already scores 0 acyclic
inversions on both subjects, so the mechanical eval is saturated and cannot judge this tier.

## Goal

An AI pass proposes a better *reading order* than tier 0's topological sort — and we can tell
whether it actually is better. Tier 0 knows dependencies; it does not know that a config change
is the punchline of the PR, that two sections form one feature while a third is unrelated
housekeeping, or that a reviewer wants the risky migration before the mechanical renames. That
judgment is exactly what R-042 says AI is *for* — and exactly what dogfood must prove it adds,
because tier 0 set a strong, honest baseline.

Two deliverables, in dependency order:

1. **The readability eval** (R-034, R-005): a repeatable, blind, pairwise comparison between two
   orderings of the same book, judged by a model, reported with reasons. Without this, tier 1
   is vibes.
2. **The tier-1 ordering job**: an async daemon job that proposes a permutation of the tier-0
   section order plus a one-line rationale per section, running through the user's Claude plan
   via Anthropic's CLI (`claude -p`), never any other path (subscription rule).

Tier 1 ships **off by default** and stays off until the eval says it wins (gate below). "We
built it and it didn't beat the script" is an acceptable — and per R-024 a *good* — outcome.

## What the model does (and may not do)

- Input: a compact **order manifest** — per section: path, role (impl/test/periphery/low-signal),
  chunk titles + kinds + line counts, resolved import edges between changed files, stub reasons.
  No diff bodies in M2 (scoping call 2).
- Output: a **permutation** of the story block's section keys, plus a one-line rationale per
  section (≤ ~15 words, R-036 register), as schema-validated JSON.
- Hard constraints, enforced by script (R-024), not by prompt trust:
  - True permutation: same keys, no additions, no drops, no duplicates — else rejected.
  - Only the **story block** (impl + test + periphery) is permutable. The low-signal tail and
    the R-001 leftovers backstop stay pinned at the end (scoping call 3).
  - Coverage is untouched by construction: ordering is an overlay, chunks never change.
- One retry on invalid output; then **fail open to tier 0**. The book is never blocked or
  degraded by a failed AI job.

### The overlay model (door-stays-open, R-038–R-041)

The AI order is a persisted `OrderOverlay { bookFingerprint, permutation, rationales, model,
createdAt }` stored beside the review state — never inside the book compile, which stays a pure
function. If the book recompiles to a different fingerprint (new head, chunker change), the
overlay is stale and silently discarded. This preserves all three door-stays-open invariants
(derived+fingerprinted, occurrence-based, append-only review state — the overlay is additive).

## The readability eval (the core of this milestone)

`--check-order` is saturated: tier 0 scores 0 and any valid permutation that keeps topological
order also scores 0. So the eval for this tier is *judged*, per R-005's own words: an AI scores
readability. Design:

- **Pairwise and blind**: the judge sees two markdown exports of the same book, identical
  chunks, different section order, labeled A/B with randomized assignment per trial (position
  bias is real). Rationales are stripped — the judge scores the *order*, not the sales pitch
  (R-026 applied to ourselves).
- **K independent trials** (default 3) per subject, top-tier model, fixed rubric: which order
  lets a reviewer meet definitions before uses, read one concern at a time, and build toward
  the point of the PR — with a forced choice plus a one-line reason.
- **Mechanical pre-gate**: before any judging, the tier-1 order must itself pass
  `--check-order` with zero acyclic inversions and zero test-before-impl regressions.
  A "creative" order that re-breaks dependencies loses before a judge ever sees it.
- **Report**: per-subject win/loss/tie counts and the judges' reasons verbatim. Reasons are the
  dogfood harvest — they name what tier 0 misses (or confirm it misses nothing).

**Shipping gate**: tier 1 becomes worth recommending only if it wins a clear majority of trials
on **both** existing dogfood subjects (PR 2357 mixed-stack, PR 2379 C#-only) *and* a human
read-through of the winning order agrees. Anything less: tier 1 stays opt-in, documented as
"built, gated, script wins for now" (R-042's both halves, honestly reported).

The eval harness is itself AI-spending; it runs on demand (a tool script), never in CI. CI keeps
the free mechanical gate only.

## Runtime shape

- **Trigger**: explicit only — `code-story <range> --ai-order` or `POST /api/order-job`. No
  automatic spend on every compile (scoping call 4).
- **Job**: the daemon spawns `claude -p` (Agent SDK path deferred) with the manifest and a
  strict JSON output contract; job record persisted under the review state dir with status
  `pending/running/done/failed`, model tier, and timings — survives daemon restarts
  (session-limits agreement); a crashed job is re-runnable, never half-applied.
- **Model tier**: top-tier by default (this is judgment work per the model economy); the job
  record carries the tier so cheaper experiments are possible.
- **Size guard**: if the story block exceeds 100 sections, the job refuses with a reason
  (nobody story-reads a 5k-chunk range; the manifest would be wasteful tokens against R-024).
- **UI**: the book renders tier 0 immediately, always. When an overlay lands: if the review has
  no marks yet, apply it on next load; if the review has started, never reorder underfoot —
  show a dismissible "AI reading order ready — apply?" affordance. Rationales render as a
  one-liner under the section header, visibly labeled AI (R-026), register per R-036.

## Scoping calls (gradual auto-picked; ambitious path recorded)

1. **Section-level permutation only.** Chunk-level interleaving (helper next to its cross-file
   call site) is the ambitious path spec 01 dangled for tier 1 — deferred until the eval exists
   and section-level has proven or disproven the model's ordering judgment. Chunk-level
   multiplies the eval surface and risks re-opening R-001 mechanics.
2. **Manifest-only input, no diff bodies.** Ambitious: include capped per-section code excerpts
   so the model judges content, not just names. Deferred until judge reasons show the model
   guessing wrong *because* it couldn't see code — that evidence flips this switch.
3. **Story block only; low-signal tail pinned.** Ambitious: let the model rescue a mis-stubbed
   section into the story. Wrong layer — that's a classifier fix, not an ordering decision.
4. **Opt-in trigger.** Ambitious: auto-run on every book open behind a config flag. Deferred
   until the eval proves the order is worth tokens on arbitrary diffs (R-042/R-024 balance).
5. **`claude -p` subprocess, not the Agent SDK.** Ambitious: SDK integration with streaming
   progress. The subprocess is the smallest Anthropic-sanctioned path (subscription rule);
   revisit when jobs need mid-flight interaction (M3 threads will).
6. **Flat list stays; rationales are not chapters.** Chapter grouping remains
   narration-adjacent (M3), per Tim's spec-01 answer.

## Non-goals (M2)

- No narration/context payloads beyond the one-line rationales (M3; R-036 will govern it).
- No chunk-level reordering, no new occurrences (R-040 mechanics stay dormant).
- No PR-version awareness (R-038–R-041) — but the overlay is fingerprint-keyed precisely so
  `crunch` can regenerate it later.
- No judge-score trend tracking over time (build-process mentions it; needs more than 2
  subjects to be a trend — revisit at dogfood 3).
- No configurable rubrics/prompts; the rubric lives in one place in the repo, versioned.

## Slices (filed just-in-time as GitHub issues when this spec lands)

1. **Core: order manifest + overlay primitives** — `buildOrderManifest(book, graph)`,
   `validatePermutation`, `applyOrderOverlay` (pure; property tests: permutation validity,
   pinned tail, coverage untouched, stale-fingerprint discard).
2. **Server: AI order job** — `claude -p` runner with JSON contract + retry + fail-open,
   persisted job record, `POST/GET /api/order-job`, CLI `--ai-order` (waits, then serves).
3. **Web: overlay application + rationales** — apply-on-load vs "apply?" affordance rules,
   AI-labeled rationale line, keyboard flow unchanged (walk order = displayed order).
4. **Eval harness: blind pairwise judge** — `tools/order-eval.mjs` producing the win/loss/reason
   report from two exports; mechanical pre-gate wired in; rubric checked into the repo.
5. **Dogfood 2 + verdict** — run job + eval on PR 2357 and PR 2379, human read-through of the
   winning order, record in the baseline doc, ship/hold decision as an explicit line in this
   spec's status field, file dogfood issues for whatever the judge reasons surface.

Blocking edges: 1 → 2 → 3; 1 → 4; (2,4) → 5.
