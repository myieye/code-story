# Spec 02 — Milestone 2: tier-1 AI ordering

Status: built and dogfooded — slices #22–#25 done 2026-07-16 (same day); grilled before
implementation (13 findings folded in: bookFingerprint defined, marks-started semantics pinned,
overlay persistence named, judge-bias + blind-read-through + provisional-gate caveats, tool-less
sandboxed subprocess, orphan-job semantics, concurrency rule, token-based size guard). Scoped by
the standing gradual-auto-pick rule; Tim can veto any pick.
**Dogfood-2 verdict (#26): HOLD at opt-in, evidence points to ship.** The blind model judge
prefers the AI order on both subjects (2/3 mixed-stack, 3/3 C#-only — where it fixed the
2-cycle git-order fallback `--check-order` can't see; `docs/evals/dogfood-0-baseline.md`
Dogfood 2). The gate's other half — a *blind* human A/B read-through — can't be satisfied by
the session that generated the orders; it stays open for Tim. Until then `--ai-order` stays
explicit opt-in, exactly as scoped.
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
- Failure handling distinguishes two classes: schema-invalid output gets exactly one retry
  (deterministic failures don't improve with hammering); transient infra errors (429, timeout)
  get bounded exponential backoff (2 retries). After that, **fail open to tier 0**. The book is
  never blocked or degraded by a failed AI job.
- The subprocess is sandboxed by design, not trust: `claude -p` runs with **all tools
  disabled**, cwd set to the code-story data home (never the reviewed repo), manifest on stdin.
  It is a pure text→JSON call; the ADR's patch-only guarantee (R-011) covers agent threads, and
  this job must not become an unreviewed side channel into the repo.

### The overlay model (door-stays-open, R-038–R-041)

The AI order is a persisted `OrderOverlay { bookFingerprint, permutation, rationales, model,
promptVersion, createdAt, appliedAt?, dismissedAt? }` stored at
`<repo-id>/reviews/<base12>..<head12>.order.json` (versioned like `ReviewFile`, same atomic
tmp+rename write) — never inside the book compile, which stays a pure function. If the book
recompiles to a different fingerprint, the overlay is stale and silently discarded. This
preserves all three door-stays-open invariants (derived+fingerprinted, occurrence-based,
append-only review state — the overlay is additive).

**`bookFingerprint` is a new core primitive this milestone defines** (nothing book-level exists
today — `Book` only carries `headSha`, which stays constant across chunker changes on the same
head): a digest over `headSha + CORE_VERSION + each section id with its chunk ids in order`.
Chunk ids already embed content fingerprints, so this captures membership and content, not just
the head. Discipline rider: **`CORE_VERSION` must bump whenever chunking or ordering logic
changes** — it is what invalidates persisted overlays on a same-head recompile.

`appliedAt`/`dismissedAt` record the reviewer's banner decision so it never re-asks on reload.
`promptVersion` records which version of the checked-in ordering prompt produced the overlay —
without it a prompt edit is indistinguishable from a model change when judging stale trust.

## The readability eval (the core of this milestone)

`--check-order` is saturated: tier 0 scores 0 and any valid permutation that keeps topological
order also scores 0. So the eval for this tier is *judged*, per R-005's own words: an AI scores
readability. Design:

- **Pairwise and blind**: the judge sees two markdown exports of the same book, identical
  chunks, different section order, labeled A/B with randomized assignment per trial (position
  bias is real). Rationales are stripped — the judge scores the *order*, not the sales pitch
  (R-026 applied to ourselves).
- **K independent trials** (default 3) per subject, fixed rubric: which order lets a reviewer
  meet definitions before uses, read one concern at a time, and build toward the point of the
  PR — with a forced choice plus a one-line reason.
- **Judge ≠ generator where possible**: self-preference bias is a documented LLM-judge failure
  mode. The subscription rule limits both roles to Claude models, so full independence is
  unavailable; mitigation is (a) a different Claude model id for the judge than the generator,
  (b) both ids recorded verbatim in the eval report with an explicit self-preference caveat,
  and (c) the blind human read-through below as the non-model check.
- **Mechanical pre-gate**: before any judging, the tier-1 order must itself pass
  `--check-order` with zero acyclic inversions and zero test-before-impl regressions.
  A "creative" order that re-breaks dependencies loses before a judge ever sees it.
- **Report**: per-subject win/loss/tie counts and the judges' reasons verbatim. Reasons are the
  dogfood harvest — they name what tier 0 misses (or confirm it misses nothing).

**Shipping gate**: tier 1 becomes worth recommending only if it wins a clear majority of trials
on **both** existing dogfood subjects (PR 2357 mixed-stack, PR 2379 C#-only) *and* a human
read-through agrees — and the read-through is **blind the same way the judge is**: both orders
labeled A/B, AI authorship revealed only after the reader picks (R-026 applied to ourselves;
confirming a pre-announced "winner" is exactly the anchoring pattern this project treats as a
design gate). Anything less: tier 1 stays opt-in, documented as "built, gated, script wins for
now" (R-042's both halves, honestly reported).

The gate is **provisional and directional, not statistically confident** — K=3 on two subjects
decides "is this worth keeping switched on for dogfooding", not "does this generalize"
(R-025). Dogfood 3+ subjects accumulate before any stronger claim.

The eval harness is itself AI-spending; it runs on demand (a tool script), never in CI. CI keeps
the free mechanical gate only.

## Runtime shape

- **Trigger**: explicit only — `code-story <range> --ai-order` or `POST /api/order-job`. No
  automatic spend on every compile (scoping call 4).
- **Job**: the daemon spawns `claude -p` (Agent SDK path deferred) with the manifest and a
  strict JSON output contract; job record persisted next to the overlay with status
  `running/done/failed`, model id, and timings. A `running` status is only trusted while the
  owning daemon process holds the child handle: a record loaded without a live handle (daemon
  restarted, job orphaned) reads as `failed` and is re-runnable — never half-applied, since
  the overlay is written once, atomically, only on validated success.
- **Concurrency**: one in-flight job per range. A second `POST /api/order-job` while one runs
  returns the existing job's status instead of spawning a sibling (the ADR's queue stays
  future work; one range = one book = nothing to queue yet).
- **Model tier**: top-tier by default (this is judgment work per the model economy); the job
  record carries the model id so cheaper experiments are possible.
- **Size guard**: gate on estimated manifest size, not section count (a 100-file PR with 3
  chunks/file and one with 500 chunks/file are different jobs): refuse with a reason when the
  rendered manifest exceeds ~8k estimated tokens (nobody story-reads a 5k-chunk range; the
  manifest would be wasteful tokens against R-024).
- **UI**: the book renders tier 0 immediately, always. When an overlay lands: if the review has
  no explicit marks yet — defined precisely as **no chunk with `state === 'reviewed'`**;
  `seen` and `cursor` don't count, because seen-tracking writes within a second of merely
  opening the book — apply it on next load; if the review has started, never reorder underfoot
  — show a dismissible "AI reading order ready — apply?" affordance whose outcome persists
  (`appliedAt`/`dismissedAt`; never re-ask on reload). Either path shows a persistent "AI
  reading order" indicator while an overlay is active — silent auto-apply without a cue would
  violate R-026's labeling spirit. Rationales render as a one-liner under the section header,
  visibly labeled AI (R-026), register per R-036.

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

1. **Core: order manifest + overlay primitives** — `bookFingerprint(book, chunks)`,
   `buildOrderManifest(book, graph, chunks)`, `validatePermutation`, `applyOrderOverlay`
   (pure; property tests: permutation validity, pinned tail, coverage untouched,
   stale-fingerprint discard).
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
