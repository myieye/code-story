# Spec 01 — Milestone 1: story ordering

Status: scoped — Tim answered all four open questions 2026-07-16 (see the resolutions inline
at the end); M1 slices filed.
Date: 2026-07-16
Satisfies: R-034 (ordering eval loop on real diffs), R-005 (partial: reading-order intelligence,
deterministic tier), R-024 (scripts before AI — tier 0 is zero-AI), R-042 (the tier ladder is
the both-halves answer: tier 0 script, tier 1 AI gated by eval), R-031–R-033 (partial: the
order steers attention toward what decides mergeability first).
Evidence: dogfood 0 baseline (`docs/evals/dogfood-0-baseline.md`) and issue #13 — the two
measured inversions on lexbox PR 2357.

## Goal

The book reads like a story instead of an alphabetical directory listing: dependencies before
their consumers, implementation before its tests, low-signal housekeeping at the end. Measured,
not vibes: the mechanical inversion count on the dogfood-0 subject (currently 2 major
inversions) goes to 0, and the read-through stops requiring the reviewer to hold unknown
semantics in their head.

What dogfood 0 showed concretely:

- `ActivityFilter.svelte` (consumer) came ~500 export lines before `activity/utils.ts`, the 8
  helpers it imports.
- `HistoryServiceActivityTests.cs` (24 chunks) came before `HistoryService.cs`, the code under
  test.
- Generated types and UI-library tweaks interleaved mid-story between the feature files.

## Approach — the scripts-before-AI ladder (R-024)

### Tier 0: deterministic ordering (the M1 core)

Section-level only: `compileBook` keeps one section per file and reorders **sections**; within a
file, chunks stay in line order (that order was never the problem). Two inputs, both script-only:

1. **File roles** from path + classifier signals, each section gets exactly one:
   - `impl` — the default;
   - `test` — path conventions (`*.test.*`, `*.spec.*`, `*Tests.cs`, `/tests?/`, `__tests__`);
   - `low-signal` — every chunk in the section is a stub (`changeTypes` non-empty);
   - `periphery` — changed files not imported by and not importing any other changed file
     (the `select-item.svelte` UI-lib tweaks), detected from the import graph, not a path list.
2. **Import graph over changed files only.** We already tree-sitter-parse every changed file;
   additionally extract import/using specifiers (TS/Svelte `import`, C# `using` + namespace of
   declared types) and resolve them **only against the other changed files** — no full-project
   index, no SCIP (that's R-007, later). Misses are fine: an unresolved edge just means no
   ordering constraint.

Order:

1. Topological sort of `impl` sections, dependencies first; cycles fall back to git file order
   within the cycle; ties (no edge either way) keep git file order — stability matters for
   re-runs and for R-038's append-only future.
2. Each `test` section immediately follows the last `impl` section it imports (or, unresolved,
   the section with the best path-stem match, e.g. `HistoryServiceActivityTests.cs` →
   `HistoryService.cs`); a test with no match lands after all impl.
3. `periphery` sections after the impl+test story.
4. `low-signal` sections at the tail, before the R-001 leftovers backstop, which stays last and
   unchanged.

### Tier 1: AI-assisted ordering (separate slice, gated)

A model proposes a permutation of the tier-0 output plus one-line chapter rationales — never
new content, never dropped sections (coverage untouchable). Runs as a daemon job with an
explicit model tier (top-tier: this is the judgment work per the model economy). The book
renders tier 0 immediately and re-orders if/when the job lands. Tier 1 ships only after the
tier-0 eval shows where deterministic ordering is insufficient — if it is.

## What M1 must also carry (from the architecture review)

- **Occurrence identity in the web layer**: the M0 web UI keys rows by chunk id and assumes one
  occurrence per chunk. Reordering is the moment this gets fixed — rows key on occurrence
  (chunk id + ordinal), because tier 1 and R-040 both need a chunk appearing twice.
- `/api/book` stays monolithic for M1 (125–5k chunks proved fine); revisit only if tier-1
  re-ordering makes incremental updates necessary.

## Eval (R-034)

- **Mechanical inversion counter** in core: for an ordered book + import graph, count pairs
  where a section is imported by an earlier section, and test-before-impl pairs. Runs in
  `--dump-chunks` style as `--check-order`; asserted 0 on the PR 2357 fixture in CI.
- **Baseline comparison**: re-run the dogfood-0 read-through on PR 2357 after tier 0; the
  baseline doc gets a "v1" column (inversions, noise position, read-through notes).
- **Second subject**: one more real PR (different shape — e.g. a backend-only lexbox PR) before
  calling tier 0 done, so the ordering rules aren't tuned to a single diff.

## Non-goals (M1)

- No narration, context payloads, or chapter prose (that's the narration milestone; R-036
  applies when it comes).
- No old/new navigation, no SCIP (R-007).
- No cross-file flow-step occurrences beyond what occurrence-keying enables; no PR versions
  (R-038–R-041) — but ordering stays a pure function of (chunks, graph) so `crunch` can re-run
  it later, preserving the door-stays-open invariants.
- No configurability (custom role patterns, ordering toggles) until dogfooding demands it.

## Open questions — resolved by Tim, 2026-07-16

1. **Is section-level granularity enough for M1?** Chunk-level interleaving (e.g. a helper
   function right before its call site from another file) is where this eventually wants to go
   — but it multiplies eval surface.
   **Resolved: section-level now**; chunk-level only with tier 1.
2. **Tests-after-impl vs tests-as-proof-first?** Some reviewers read tests first as a spec of
   behavior.
   **Resolved: impl-then-its-tests** (the dogfood-0 pain was unexplained test targets); revisit
   after the next dogfood.
3. **Does tier 1 (AI ordering) belong in M1 at all**, or does M1 end at deterministic + eval,
   with AI ordering as M2's opening slice once the eval can judge it?
   **Resolved: M1 ends deterministic**; AI ordering opens M2. Tim's verbatim rider (traced as
   R-042): never waste tokens on what scripts can do, but — very important — never fail to use
   AI's power "to truly create something intuitive and readable". Tier 1 is deferred, not
   diminished: the eval exists precisely so the AI tier can prove the intuition it adds.
4. **Chapter grouping**: should the ordered book get named chapters ("Core service", "UI",
   "Housekeeping") in M1, or stay a flat ordered section list?
   **Resolved: flat list in M1**; chapters are narration-adjacent.
