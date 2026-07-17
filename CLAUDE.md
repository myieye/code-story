# CLAUDE.md — orientation for AI sessions in this repo

**code-story** is a product exploration (nothing built yet): an AI-augmented code-review tool for
the *human reviewer* that restructures a diff/PR into a narrated "book" — sub-file chunks in a
sensible order, each with the context it needs, with guaranteed 100% diff coverage and local
BYO-agent threads whose code changes are verifiable patches.

## Read in this order

1. `docs/vision/original-prompt.md` + the `docs/vision/addendum-*.md` files — Tim's words,
   **verbatim**; the ultimate source of truth for traceability passes.
2. `docs/requirements/inventory.md` — R-001…R-041, each traced to a source quote. The tracing
   instrument for everything.
3. `docs/research/00-synthesis.md` — answers to the founding questions (does it exist: no;
   fork: no, harvest; platform; protocols; the science). Deep dives: `01*` landscape,
   `02` agent protocols, `03` platform, `04` review science, `05` pair-review due diligence.
4. `docs/decisions/0001-architecture.md` — the architecture (local daemon + browser book UI;
   ACP-client + MCP-server + headless-CLI hybrid; patch-only via worktrees; state/ledger outside
   the reviewed repo). **Status: accepted — ratified by Tim 2026-07-16.**
5. `docs/design/core-primitives-sketch.md` — chunk/occurrence/book/ledger data model sketch.
6. `docs/process/build-process.md` — spec pipeline (Pocock skills), model economy, dogfooding.

## Working agreements (learned, standing)

- **Verbatim first**: any substantial new vision input from Tim gets persisted verbatim under
  `docs/vision/`, then traced into the inventory as new R-numbers. Never paraphrase-and-discard.
- **Traceability**: specs/PRs cite the R-numbers they satisfy or amend.
- **Decisions become ADRs** in `docs/decisions/` while still cheap to reverse; mark `proposed`
  until Tim ratifies.
- **Scripts before AI** (R-024); **cheap models for mechanical work**, top-tier only where
  judgment matters (Tim's explicit directive) — carry a model tier on every AI job.
- **Human-in-forefront is a design gate** (R-026): anchoring/automation-bias research
  (`docs/research/04…` Part D #6-7) applies to product decisions AND to how we present our own
  work to Tim — never sell code as fine; make critique easy.
- **Session limits are real**: a research subagent died mid-run on a usage limit; all long agent
  work needs persist-and-resume design (and batch work should expect interruption).
- **Vibe mode (Tim, 2026-07-16)**: this is a pure vibe-code project — Claude owns it as
  engineer, tester, *and* reviewer. Commit, push, and iterate at will (feature branches or
  straight to main; no per-push permission needed — this overrides Tim's global commit rule for
  this repo only). The bar is not "it builds": actually *use* the tool on real diffs and verify
  it genuinely eases the wall-of-diffs burden before calling anything done.
- **Quota discipline (Tim, 2026-07-16; relaxed later same day)**: originally "don't burn it —
  pace across sessions, prefer direct work over fan-outs." Tim then granted: "you have a large
  quota available to you. go nuts. progress at will. use subagents to protect your context
  window." Current stance: work liberally, delegate bulky self-contained work to subagents
  (one tier down) to keep the root context lean, still check quota (`quota-status` skill)
  before heavy phases and don't sprint into a hard limit.
- **Gradual option auto-pick (Tim, 2026-07-16)**: when a scoping choice is gradual-vs-ambitious,
  Tim always picks gradual — choose it automatically, record the deferred ambitious path in the
  spec, don't ask. (He confirmed this after picking the gradual option on all four spec 01
  questions.)
- **Commits**: `git config user.email noreply@anthropic.com`, `user.name Claude` (a stop-hook
  enforces this).
- **GitHub provenance in this repo**: everything here is Claude-authored by default (vibe
  mode). Issue/PR bodies open with the *[Claude, autonomous]* line; `[claude]`/`[vibe]` title
  prefixes are dropped as pure noise in an all-Claude repo. (Specializes Tim's global tagging
  rule — Tim can veto.)
- **Per-issue PR flow (Tim, 2026-07-16)**: work lands incrementally — one short-lived branch
  per issue (`claude/<issue>-<slug>`), PR against main, self-merged (merge commit, not squash
  — commit history carries the traceability) once tests are green and the slice is verified.
  Claude creates and merges its own PRs; no waiting for review (vibe mode). Doc-only
  housekeeping may go straight to main. Proven end-to-end on PR #29 (M1+M2, 56 commits).
- **Scheduler ops (Tim, 2026-07-16)**: `delete_trigger` blocks on Tim's approval — it breaks
  autonomy, don't rely on it. Instead make triggers that never need deleting: schedule one-shot
  continuations late in the window, keep the message THIN ("continue per CLAUDE.md's Next
  pointer, per-issue PR flow, don't sprint into a hard limit") so the durable instructions live
  here, not in the trigger. A stale-but-thin trigger is harmless; a fat one forces a delete.

## Hard-won product insights (don't re-derive)

- **Chunking quality is the critical path** (R-034): Tim's early attempts at AI-generated review
  stories were weak. Manageable chunk size + story flow needs its own eval loop before anything
  else matters.
- **Narration register** (R-036): light, ~high-school English, never dense. This is an acceptance
  criterion for every AI-written string, including what we write to Tim.
- **Merge pragmatism** (R-031–R-033): the story steers toward "responsibly mergeable", weighing
  PR age/size and change criticality — not exhaustive polish.
- **PR versions are designed but deferred** (R-038–R-041, `docs/design/pr-versions-sketch.md`):
  new versions append as stale-marked-aware chapters; `crunch` recompiles a fresh edition with
  proof-carried review state. Don't build it yet — but don't break its three door-stays-open
  invariants (derived+fingerprinted chunks, occurrence-based books, append-only review state).
- **The moat** (landscape verdict): narrative ordering alone is table stakes (Devin, CodeRabbit,
  cubic ship it). The unoccupied combination = coverage-guaranteed queue + local harness-agnostic
  verifiable-patch threads + reviewer-side intelligence feeding instruction files.
- **pair-review** (Apache-2.0) is the parts bin, not the base: lift its ACP bridge, worktree
  pool, GitHub adapter; its data model and renderer can't carry our chunk/ledger semantics
  (see `docs/research/05-pair-review-due-diligence.md`).
- **Subscription rule**: ride the user's Claude plan only *through* Anthropic's own CLI/SDK
  (Agent SDK / `claude -p` / claude-agent-acp). Raw OAuth token reuse is banned (Feb 2026).

## Current state (2026-07-16, build session 1)

Milestone 0 scoped with Tim: **chunker + naive book** — `code-story <base>..<head>` →
tree-sitter chunks in file order rendered in the browser, coverage queue, reviewed-state,
markdown export; zero AI. Spec: `docs/spec/00-chunker-and-naive-book.md` (includes the
ux-expert pass on the book UI). **ADR 0002**: book UI is React (Tim's call). Issue policy
(Tim-ratified): just-in-time — 5–8 vertical-slice GitHub issues per milestone, filed when that
milestone's spec lands; never a full backlog. Milestone-0 slices are issues #1–#8 (blocking
edges in bodies). **#1 scaffold, #2 diff ingestion, #3 chunker, #4 naive book + export, #5 book
UI, #6 review loop, #7 low-signal collapse done.** Stack: pnpm monorepo (core/server/web),
TS strict (TS 7), vitest, React 19 + Vite, hono daemon, CI. Core: `parseGitDiff` (-U0, ranges
only), pure `chunkFile` (hunk∩symbol intersection, fragments >40 lines, fnv1a fingerprints,
R-001 coverage invariant property-tested with fast-check). Server: tree-sitter via
**@vscode/tree-sitter-wasm** (bundled runtime = ABI-safe; community `tree-sitter-wasms` was
incompatible — don't switch back), C#/TS/TSX/JS grammars; **Svelte has no prebuilt grammar** —
M0 splits script (TS-parsed) / template / style by regex. Submodules (gitlink 160000) are
content-less chunks. Verified on lexbox: 172k-line range → 5256 chunks, coverage OK, 31s;
mid-size PR <3s. Book compile (`compileBook`): section per file in git order, one primary
occurrence per chunk, leftovers section as R-001 backstop; `exportBookMarkdown` (backtick-safe
fences); CLI `--export book.md`; server `/api/book` + `/api/export.md`. Book UI: core
`unifiedChunkLines` (precise diff rows from hunks — never re-diff sliced text) → `/api/book
.diffs`; web = TanStack-virtualized feed of per-chunk read-only CM6 views, outline sidebar,
current-file bar, j/k cursor (long `scrollToIndex` jumps need the double-invoke correction).
Verified: 1,297-chunk lexbox book, 16ms scroll churn, 14ms j/k. Browser-pane screenshots hang
when the pane is hidden (`visibilityState: hidden` = no frames) — use real Chrome or lexbox's
Playwright for UI verification. Review loop (#6): core `ReviewFile`/`applyReviewPatch`; server
store at `~/.code-story/<slug>-<rootSha12>/reviews/<base12>..<head12>.json` (atomic tmp+rename,
head-keyed = fresh review per head), `GET/PATCH /api/review`; web `useReview` (explicit marks
flush immediately, seen/cursor debounced 800ms, `pagehide` keepalive flush), keymap per spec 00a
(Enter mark&advance with `e.repeat` guard, u, n/N wrap, x collapse, ? overlay, Esc out of CM),
seen = both block edges entered viewport, marked-unseen logged, hide-reviewed toggle, resume
toast, aria-live, done banner (neutral facts + per-section table). Verified keyboard-only on
lexbox: full walk→mark→done flow, state survives daemon restart, 1297-chunk book Enter median
33ms (<50ms gate). Synthetic `KeyboardEvent` on `window` has no `.closest` target — dispatch
test events on `document.body`. Architecture review pass done
(`docs/reviews/2026-07-16-architecture-review.md` — read it before M1 work: it lists the
deliberate M0 constraints and where they must be revisited, notably occurrence-vs-chunk identity
in the web layer and the monolithic `/api/book` payload). All packages are `@code-story/*` now
(server renamed; bin still `code-story`); API contract types live in `core/src/api.ts`;
`pnpm test` type-checks test files via `tsconfig.check.json`; dev loop = daemon `--port 7357` +
`CODE_STORY_PORT` Vite proxy. Low-signal (#7): core `classifyGenerated` (path patterns +
first-5-lines auto-generated sniff) → `changeTypes: ['generated']` + `generatedReason`; stubs
start collapsed (CM unmounted), Enter marks without expanding, expansion persists
(`ChunkReview.expanded`, per-field patch merge); section "Mark all N reviewed (reason)" only
when all remaining chunks in the section are stubs, single announce, undo restores exact prior
states (section button morphs so focus survives); "N pending stubs" in progress cluster. Pure
review logic lives in web `review-logic.ts` (vitest, no jsdom) — extend tests there, not in
BookPage. Verified on lexbox dep-bump commit 78806fe4: 44 chunks / 25 lockfile stubs,
batch+undo+persistence all keyboard-checked (16/16). Dogfood 0 (#8) done on lexbox PR #2357
(30 files, 125 chunks): baseline recorded in `docs/evals/dogfood-0-baseline.md` — coverage OK,
j/k 27.5ms median, C# symbol chunking is the standout; headline gaps = **26% noise chunks**
(classifier missed `generated-types/` — marker says "code *was* generated by"; `.po` catalogs;
whitespace-only chunks) and **ordering inversions** (utils after consumers, tests before impl).
Dogfood issues #9–#14 filed (label `dogfood`); #13 is the R-034 evidence for M1 ordering.
**Milestone 0 complete.** Dogfood fixes #9–#12, #14 done (bb7919d, e6d1f02): classifier
matches loose "generated by" + delimited `generated` path tokens; `.po` → `translations` stubs
(en source catalog exempt); all-blank chunks → `whitespace` stubs (submodule bumps exempt;
strictly-blank only); fragment cuts snap to blank/statement-end lines within 8 above the cap;
`--dump-chunks` prints stub reasons; done state = derived top-bar morph ("All N reviewed ✓" +
"View summary", reverts on unmark — ux-expert pass on #14). Re-verified on PR 2357: 28/125
stubs (12 generated / 14 translations / 2 whitespace), coverage OK, batch-ack works on real
sections, fragments open on statement boundaries. Remaining noise is deliberate: en.po (2) +
almost-blank chunks. Only #13 (M1 ordering) left from dogfood 0; **spec 01 scoped by Tim**
(`docs/spec/01-story-ordering.md`: section-level deterministic ordering, impl-then-its-tests,
flat list, M1 zero-AI — AI ordering opens M2, gated by the `--check-order` eval; Tim's rider =
**R-042**: don't waste tokens on script work, but never fail to use AI where it truly earns
intuition/readability — verbatim in `docs/vision/addendum-2026-07-16.md`). **M1 tier 0 complete (#15–#19 done, #13 closed)**: core `buildImportGraph` (changed-files-only
resolution: TS/Svelte relative + unique ≥2-segment $-alias suffix; C# using↔namespace +
ancestor-namespace rule), `fileRoles` (precedence low-signal > test > periphery > impl),
`compileBook` orders sections impl-topo→tests-after-their-impl→periphery→low-signal-tail
(greedy Kahn, ties/cycles = git order, deterministic; leftovers stay last), `checkOrder` +
CLI `--check-order` (exit 0/1) with a PR-2357-shaped synthetic CI fixture; `--dump-graph`.
Dogfood 1 (baseline doc "Dogfood 1" section): both dogfood-0 inversions **0** on PR 2357 AND
on second subject sillsdev PR 2379 (`8dd70ba~1..8dd70ba`, C#-only); j/k median 4ms via new
`tools/dogfood-walk.mjs` (root devDep playwright-core, channel:'chrome'; restore nets zero
only on fresh review state). Recurring artifact = genuine 2-cycles (one per subject) → **#20 done** (same-SCC inversions
land in informational `cycleInversions`; `ok` gates on acyclic+test only — both subjects exit
0); **#21 open, evidence-gated** (C# ancestor-namespace back-edge — watch future dogfoods).
Server vitest pinned to src (stale dist/*.test.js were double-counted; true counts now
core 114 / server 13 / web 11 = 138). BookPage slimmed:
keymap + seen-scan live in web `useBookKeymap.ts`/`useSeenTracking.ts` (no-dep-array
re-register is intentional). Subagent ops note: resuming a 529-killed worktree agent loses
isolation — it lands in the MAIN worktree; keep the tree clean while resumed agents run.
**Maintainability pass done** (`docs/reviews/2026-07-16-maintainability-pass.md` — the
pick-up-here doc): low-signal helpers + `checkCoverage` consolidated in core,
`detectChangeTypes` seam in chunker, and web rows now occurrence-keyed (`chunkId#ordinal` —
the R-004/M1 blocker cleared; walk stops = occurrences, progress = distinct chunks). Its two
listed leftovers are done (tools/dogfood-walk.mjs; the BookPage hooks). **M2 (tier-1 AI
ordering) built and dogfooded** — spec `docs/spec/02-ai-ordering.md` (grilled pre-code, 13
findings folded; all scoping auto-picked gradual), slices #22–#25 done same-day on branch
`claude/extended-build-subagents-jc6uv1`: core `bookFingerprint` (headSha + CORE_VERSION —
**bump CORE_VERSION on any chunking/ordering change**, it invalidates persisted overlays —
+ per-section chunk ids), `buildOrderManifest`/`renderOrderManifest` (story block only,
low-signal tail + leftovers pinned, ~8k-token guard), `validatePermutation`,
fail-open `applyOrderOverlay`; server `runOrderJob` (tool-less `claude -p --tools ''` in the
data home — cwd must exist or spawn ENOENTs; invalid-output retried once, transient backoff,
checkOrder pre-gate before persist), overlay at `reviews/<b12>..<h12>.order.json` +
`.order-job.json` sibling (orphaned `running` = failed), `GET/PATCH /api/order`,
`POST /api/order-job` (one in-flight per range), `export.md?order=ai`, `graph` now in
BookResponse; CLI `--ai-order --model <id> --order tier0|ai --dump-manifest`; web
`order-logic.ts` (`orderDecision`: appliedAt sticky, dismissedAt never re-asks, only explicit
`reviewed` marks count as started — auto-apply PATCHes appliedAt immediately so a late mark
can't reorder underfoot), AI-labeled rationale lines + persistent indicator (R-026).
Eval `tools/order-eval.mjs`: blind pairwise, A/B randomized per trial, rationales stripped,
judge id ≠ generator id (self-preference caveat in every report). **Dogfood 2** (baseline doc):
judge sonnet vs generator opus — AI order wins 2/3 (PR 2357) and 3/3 (PR 2379, where it fixed
the 2-cycle git-order fallback that `--check-order` structurally can't see — the measured
R-042 instance). Verdict in spec status: **HOLD at opt-in; Tim's blind A/B read-through is the
open gate half** (a session that generated the orders can't self-blind) — **prepared as #28**
(`docs/evals/blind-read-2026-07-16/`: sealed-mapping A/B pairs + README). **M2 review pass
done same-day** (`docs/reviews/2026-07-16-m2-review.md` — read its "deliberately not fixed"
list before touching M2 code): races fixed (order-job POST guard, PATCH serialization),
export?order=ai now 409s instead of silently serving tier 0, `claude-cli.ts` owns the
tool-less spawn + brace-balanced JSON extraction (order-eval imports it from dist — needs
`pnpm build`), web overlay state lives in `useOrderOverlay.ts`, indicator only claims AI order
when the applier actually reordered. Test counts now core 124 / server 25 / web 18 = 167.
#26 closed with the verdict; #27 filed (order-2 prompt: locality-vs-purity rank,
evidence-gated like #21).
**Overnight window (2026-07-17)**: Dogfood 3 done (#30 → PR #31): lexbox PR 2309, Svelte/TS-only
— **AI 3/3**, cleanest consensus yet; running tally AI 8 / tier-0 1 across three subjects/
language mixes; third sealed pair added to the blind-read folder (#28 is now 3 pairs). Harvested
**#32** (Kahn cycle-stall fallback emits dependents of a stalled SCC early — first subject where
tier 0 itself fails `--check-order`) and **#33** (`.svelte.ts` runes modules invisible to the
import graph; fix = recursive `stripCodeExt`, **needs CORE_VERSION bump**). **Spec 03 landed**
(`docs/spec/03-narration.md`, PR #34) — drafted + grilled (14 findings; the blocker: narration
keyed by order-independent per-section fingerprints so the order overlay can never invalidate a
narration run; generator default opus — cheap-tier only after the eval clears it; faithfulness
gated on a floor, not a median; sparse-by-design chunk lines; partial overlays must say "N of M
sections"). M3 slices = **#35–#39**. #35 done (PR #40): core `narration.ts` — fingerprints,
overlay types + freshness filter (fail-open = drop narration, never passthrough), register gate
(caps/22-word/judgment-lint hard, backtick-aware Flesch soft). #36 done (PR #41):
`buildSectionNarrationInput` (6k-token cap, `omitted` ids, in-prompt omission markers),
renderer, `parseNarrationReply` (foreign chunk ids reject), server `narration-prompt.ts`
(`narration-1`, snapshot-pinned). Test counts core 151 / server 28 / web 18 = 197.
Subagent-worktree ops (hard-won): `.claude/worktrees/` is gitignored; every agent bash command
must `cd` into its worktree (cwd resets leak into the main tree — one leak corrupted main-tree
branch state, repaired) and push via `git push origin HEAD:refs/heads/<branch>`, never a local
branch. **M3 complete same window** (#37 PR #42, #38 PR #46, #39 PR #49; suite core 156 /
server 38 / web 33 = 227): resumable per-section narration job (survived a real container
restart with zero loss — persist/resume proven), web render (one AI voice per section header,
partial-state honesty), rubric eval. **Dogfood 4 verdict: register median 5 both subjects
(R-036 bet paid off, sparsity held), orientation 4, faithfulness floor FAILED → narration
stays opt-in.** Failure mode is nameable: duplication claims from -U0 fragment misreads
("second copy of [JsonConverter]" — diff adds it once, verified) → **#48** (narration-3
prompt iteration + re-eval, actionable now). Mid-dogfood harvest: #44 fixed (truncated reply
keys, 42% section loss; PRs #45+#47 — suffix + "chunk "-label resolution, opener failures
recorded on overlay). Tim's two reads are open: #28 (blind order A/B, 3 pairs) and the
narrated-vs-bare read (`docs/evals/narration-read-2026-07-17/`, spec-03 gate half).
**Tier-0 redemption complete (late window)**: #33 (PR #50, recursive `stripCodeExt`,
CORE_VERSION 0.0.2), #32 (PR #51, cycle-stall breaks one node from the smallest-external-
in-degree SCC via Tarjan, 0.0.3), and #52 (PR #53, test-block anchor inheritance +
helper-before-importer Kahn, 0.0.4 — split from #32 when the real book showed the remaining
inversions were placement-rule, not cycle). Verified on all three dogfood subjects: tier-0
`--check-order` is **0 import inversions / 0 test-before-impl** on 2309, 2357, 2379 (only
unavoidable in-cycle pairs). Suite core 160 / server 38 / web 33 = 231. Note: three
CORE_VERSION bumps in one night invalidated all persisted overlays — regenerate before any
overlay-dependent demo.
**Second window (2026-07-17, 04:20Z–)**: #48 done (PR #55, gate honestly applied): narration-3
eliminated duplication claims (0 flags, was 5/6), 2309 passes the FULL gate, 2357 improved
2→3-severity but floor still fails on a new mode — confident semantic assertions ("nulls
pushed last": true for one sort branch, false for the other, verified) → **#58** (narration-4
candidate: point-don't-assert, evidence-gated). #56 done (PR #59: gate fails per TEXT — salvage
keeps passing intro/lines). #57 done (PR #60: opener targets two sentences + second re-ask,
prompt now `narration-4`). narration-4 read material regenerated: **2309 fully narrated**
(15/15 + opener), 2357 15/16 (opener overflowed 3 asks — recorded; "faithful or silent").
**Spec 04 landed** (`docs/spec/04-context-payloads.md`, PR #61) — facts-only context payloads;
grilled (14 findings, 5 feasibility blockers folded: reference extraction = NEW server parse
pass, core stays dep-free; Svelte templates excluded (no grammar); unchanged-file resolution
needs the head path index (`git ls-tree`) and covers path-specifier languages only; C#
unchanged callees = SCIP door; definitions get an additive budget that never evicts diff
text; narration prompt bumps stay owned by spec 03's eval track). M4 slices = **#62–#68**;
#62 (core payload model) in flight.
#62 done (PR #69: core `context.ts` — ContextPayload v1 types + store shape,
`contextFingerprint` folds CORE_VERSION, `filterFreshContext` fail-open-to-absent, `capBody`
statement-boundary truncation; core 171). #63 done (PR #70: server `references.ts` —
`extractReferences` new parse pass, call/new/JSX-component (TS/TSX/JS) +
invocation/object-creation (C#), Svelte script-blocks-only per spec non-goal, tail-identifier
semantics, stoplist floor, no scope analysis; treesitter.ts exports `wasmForExtension` +
`svelteScriptBlocks` for routing reuse; server 47). Suite core 171 / server 47 / web 33 = 251.
**Session stopped here on Tim's instruction (2026-07-17 ~05:05Z, quota discipline); repo is
clean: no open PRs, all remote claude/* branches merged, working tree clean.**
**Tim's decisions (2026-07-17 ~06:20Z, via chat)**: (1) **AI ordering: SHIP** — blind read
waived, judge evidence accepted; #28 closed, spec 02 status flipped, default-on implementation
filed as **#71**. (2) #54 (narrated-vs-bare read) timing: Tim asked for more context before
deciding — treat #54 as open, decision pending. (3) **Nightly recurring trigger armed**
(22:00 UTC ≈ midnight CEST, trig_019Riu3NUsaPMLgtQmofJvWy): its message deliberately assumes
NOTHING about the next task — every night, re-read this block + open issues fresh and
reconcile with actual repo state before working (the repo may progress between sessions).
**Ordering axioms amended (Tim, 2026-07-17 ~07:00Z)**: new verbatim addendum
(`docs/vision/addendum-2026-07-17-ordering-preferences.md`) traced as **R-043–R-046** — tests
BEFORE their impl (his spec-01 answer was a misunderstanding about what was being asked),
consumer-first direction (conditional on chunk-level call-path interleaving being good — at
section grain it's the weak version), thoroughly configurable with Tim's picks as defaults,
AI-augmented ordering by default. Work = **#72** (spec pass first — checkOrder inversion
semantics, Kahn direction, test anchor, order prompt hard rule, and the eval rubric all encode
dependency-first today). **#72 interacts with #71**: don't implement #71's default-on around
axioms #72 is about to flip — coordinate or sequence them. **Tim answered both #72 questions
(~07:40Z, verbatim in the addendum's follow-up section): (1) consumer-first is an MVP goal —
build the GOOD version (chunk-level call-path flow) by whichever path is fastest, section-level
flip only as a stepping stone if it truly speeds that; (2) test placement by kind is delegated
to Claude's judgment, with a hard rider: one-keystroke more-context when a lone test without
its setup isn't enough (R-008/R-009 — M4's context payloads serve exactly this).**
**Chunk graph arc (2026-07-17, ~08:15Z–12:35Z)**: Tim's graph-under-story idea recorded as
**R-048/R-049** + the comment-doctrine-applies-to-narration insight as **R-047** (all verbatim
in the addendum). Research 06 (`docs/research/06-chunk-graph-traversal.md`): combination
unoccupied, ingredients validated (Stacksplorer/Prodet/GBSCI), three named risks with design
answers; verdict = build, gated. **Spec 05 landed** (`docs/spec/05-chunk-graph-and-traversals
.md`, PR #73, grilled — 14 findings folded; #72 closed into it): chapters = traversal-derived
cross-file sections (new linearizer, chunk-position checkOrder, orderTestBlock rewrite),
graph decoupled from M4 (only #63 + a changed-file resolver), frontier surfacing honestly
display-only, slice-0 blind edge-precision audit (≥0.90, Tim audits) gates the UI slices.
M5 slices = **#74–#80**.
Next (as of this writing — verify freshness on wake): **#71 first** (AI order default-on,
ships on CURRENT dependency-first axioms per spec 05's sequencing decision — Tim can veto),
then **#75** (core ChunkGraph) → #74 (slice-0 experiment; needs Tim's 45-edge blind audit) →
#76 (chapter linearizer). M4 **#64** proceeds in parallel (independent per spec 05). #77–#80
per blocking edges. #21/#27/#58 evidence-gated watches; Tim's open read = #54.
Dogfood target: languageforge/lexbox (C# + Svelte/TS); repo-agnostic (R-025).
