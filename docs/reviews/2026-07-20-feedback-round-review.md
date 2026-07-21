# Integration review — the 2026-07-20 feedback round

Scope: branch `claude/code-review-interface-uk7s3c` vs main — Tim's review-UX feedback
(R-051–R-059, spec 06) + the AI glue pipeline (R-060, spec 07); 85 files, ~8.4k insertions,
slices built by six separate agents. This review covered the seams no slice owned: the
review-state flag algebra, BookPage composition, server.ts after three rewrites, ledger math,
and a composed browser smoke. The server-seam half ran as a focused subagent; the browser half
was cut short by a usage limit and finished by hand — its three signals are all diagnosed and
fixed below.

## Verdict

**Safe for Tim to drive.** Four defects found; all four fixed on the branch (commit
"Integration-review fixes"). The two worst were compact-mode-only UI breaks, not state
corruption. The flag algebra, coverage gate, save-chains, kick-force discipline, 2-child cap,
and ledger math all verified correct.

## Fixed during review

1. **Popovers never opened in compact mode** (`BookPage.tsx`): both the ⋯ and AI ▾ triggers
   captured `e.currentTarget` inside a functional setState updater — which React runs at
   render time, after event dispatch, when `currentTarget` is null. The anchor was always
   null → popover never mounted. This also made "Why this order?" unreachable at narrow
   widths. Fixed by capturing the target before setState.
2. **AnchoredPopover closed on any capture-phase scroll** — the virtualized feed emits scroll
   events during async row re-measure (CM6 mounts, narration arrival), so the popover could
   vanish as it opened, timing-dependent. Now it repositions to follow its anchor and closes
   only when the anchor leaves the viewport. Trigger-click-to-close also fixed
   (`contains()` instead of identity).
3. **Top bar overflowed the page below ~1012px** even in compact mode (view toggle + buttons
   pushed `scrollWidth` past the viewport). Fixed with `flex-wrap`; a second collapse
   threshold folding the view toggle into ⋯ is the nicer future refinement.
4. **Daemon exit never drained the glue scheduler** (`cli.ts`/`server.ts`): Ctrl+C dropped
   in-flight spawn abort records and any unflushed ledger appends — under-counting exactly
   the runs the ledger exists to count. `RunningServer` now exposes `shutdownGlue()`;
   SIGINT/SIGTERM call it before exit.

Also: an inline SVG favicon (the console 404 on every load was noise in every smoke run).

## Findings not fixed (recorded)

- **MED — v1 narration job spawns outside the invoker** (`POST /api/narration-job`): those
  spawns produce no ledger entries (spend under-count) and run outside the 2-child cap (a
  third concurrent `claude` is reachable: v1 narration + background lane + interactive lane).
  Not fixed because the v1 path is legacy-retained for file-mode intros and untouched by this
  round's contract-stability rule; the right fix is migrating it as a glue task when spec 03's
  v1 path retires. Tracked as a follow-up on #128's closeout list.
- **LOW — `order.json` has two write domains** (order task's save vs `PATCH /api/order`'s
  chain). The window is near-unreachable (PATCH 404s while the overlay is absent, which is
  the only time the task re-runs). Unify onto one chain if PATCH semantics ever widen.
- **LOW — `orderJobModel` is last-writer-wins** across concurrent POSTs with different
  models; the deduped single run uses the second model. Single-reviewer tool; harmless.
- **LOW — cross-process `saveJson` tmp collision** (CLI vs daemon on the same range) —
  pre-existing (`json-file.ts` fixed `.tmp` name), not introduced this round.
- **LOW — `getGlue` rebuild-on-error edge**: a rebuilt scheduler forgets the old one's
  in-flight deferral, so GET can prematurely mark it failed; the late answer self-heals it
  to done. Rare, self-correcting.

## Verified correct (checked, not assumed)

- **Flag algebra**: `autoRead`/`reviewedVia` never touch the three-value state enum; done
  fires only on `reviewedCount === distinctChunks`; batch undo restores full `ChunkReview`
  snapshots; unmark returns to auto-read when the flag is set; deferred stubs are collapsed
  rows, which the read-tracker excludes, so a deferred chunk cannot bank auto-read; the
  deferred card rows live in the `deferred:web` synthetic section, which the segmented bar
  excludes and coverage never counts twice.
- **Deferrals save-chain**: POST, DELETE, GET-orphan-rewrite, and the task's answer fill all
  funnel through one chain with a fresh load per turn; concurrent DELETE + answer-arrival
  loses neither (tested).
- **Kick discipline**: order POST / context POST / deferral POST force; order + narration
  auto-kicks non-forced (respect the failed set); `glueEnabled` alias gates both auto-kicks
  → the pre-round test corpus spawns zero `claude` children.
- **Two lanes, ≤2 children**: lane single-flight is `laneBusy`-guarded; task-internal
  re-asks are sequential within one run. (Cap violation exists only via the legacy v1 route,
  the MED above.)
- **Ledger**: one entry per spawn including task-internal re-asks (observed live: 7 entries
  for 5 units) and error/abort entries; spend aggregates across kinds; cache invalidation on
  append is correct. Live run: 15-chunk book → 5 units, 7 calls, $0.65, all badges/lines
  gated and rendered.
- **No missing-store 500s**: every loader is ENOENT-tolerant; all GETs handle empty.

## Composed smoke (900px compact viewport, post-fix)

Overflow popover opens, survives feed scroll, closes on trigger re-click; AI ▾ popover opens
with "Why this order?"; zero horizontal page overflow; zero console errors. Full-width
composed walk (scrollspy + auto-read + pieces menu + defer + confirm + segmented bar + beat +
done) was exercised piecewise by the slice agents in real Chromium; the compact-mode pass
plus the fixes above closes the gap the cut-short smoke left.

## Deliberately not fixed

The spec-recorded deferrals (stitched full-file diff, hover-peek, SSE, per-deferral
resolution, sittings-in-summary, judgment-lint on badges) and the v1 narration migration —
all have recorded homes in specs 06/07 or the survey closeout.
