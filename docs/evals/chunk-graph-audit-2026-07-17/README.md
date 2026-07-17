# Chunk-graph slice-0 audit (#74)

This folder is the gated experiment for M5 (spec 05, "The gated experiment (slice 0)"). It
answers one question before any graph UI gets built: **are the `calls` edges good enough to
trust?** Token-free — no AI ran to produce any of it.

## What's here

- `dumps/` — raw `--dump-chunk-graph` output per subject (2309, 2357, 2379).
- `cards-<subject>.md` — every sampled `calls` edge as an audit card: caller chunk + the
  call-site line, callee chunk + its first defining lines. No labels.
- `tim-audit-<subject>.md` — **Tim's blind subsample** (15 per subject, or all if fewer). One
  RELEVANT/IRRELEVANT checkbox pair per card, no Claude opinions.
- `claude-labels-SEALED.md` — Claude's labels for all 42 sampled edges. **Sealed**: don't open
  until Tim's ticks are committed.
- `audit-summary.json` — machine summary (edge counts, sample sizes, free-glance + size stats).
- `claude-label-targets.json` — the flat list of sampled edges (card id → chunk ids).

## The three subjects and their ranges

| subject | range | head | note |
|---------|-------|------|------|
| PR 2309 | `c0448522..pr-2309` | `fd182f31` | Svelte/TS |
| PR 2357 | `277e418d8~1..277e418d8` | `277e418d` | mixed C#/Svelte/TS (baseline-doc range) |
| PR 2379 | `8dd70ba~1..8dd70ba` | `8dd70ba1` | C#-only |

(2357 uses the baseline doc's single-commit range; its diff is identical to
`merge-base(develop,pr-2357)..pr-2357` — 30 files, +1622/−156.)

## How to reproduce

From the code-story worktree, with the read-only lexbox clone at `/home/user/lexbox`:

```
pnpm -r build
# raw dumps
cd /home/user/lexbox
node <worktree>/packages/server/dist/cli.js "c0448522..pr-2309"      --dump-chunk-graph
node <worktree>/packages/server/dist/cli.js "277e418d8~1..277e418d8" --dump-chunk-graph
node <worktree>/packages/server/dist/cli.js "8dd70ba~1..8dd70ba"     --dump-chunk-graph
# cards, Tim files, free-glance proxy, size distribution (writes into this folder)
node <worktree>/tools/slice0-graph-audit.mjs
```

`tools/slice0-graph-audit.mjs` is deterministic: base **seed `20260717`** folded per subject
(recorded in each card header). Same repo state + same seed => identical samples. Override the
clone path with `LEXBOX=/path`.

**Sampling:** `calls` edges are sorted deterministically, then a seeded Fisher-Yates draws up to
30 per subject ("or all, if fewer"). Tim's subsample is the first 15 of that ordered draw
(or all, if fewer). 2309 has only 1 `calls` edge and 2379 has 11, so the totals are 42
sampled / 27 in Tim's subsample, not the nominal 90 / 45.

## The go threshold and the workflow

**Go: ≥ 0.90 precision on Tim's blind subsample**, and no systematic optimistic divergence in
Claude's labels. If Claude's self-audit diverges optimistically, **Claude's number is
discarded** (generator self-grading is the trap R-026 exists for) and Tim's stands. Below
threshold, M5 stops at the resolver until precision is fixed — the UI slices (5, 6) never start.

Workflow:

1. Tim opens each `tim-audit-<subject>.md`, ticks RELEVANT or IRRELEVANT per card on a quick
   glance (that quick glance *is* the reviewer experience being tested), commits the ticks.
2. Unseal `claude-labels-SEALED.md`.
3. Compare. Tim's subsample precision is the gate; check for any edge Claude called relevant
   that Tim called noise (optimistic divergence).

The free-glance proxy and chunk-size numbers in the go/no-go note are context, not gates.
