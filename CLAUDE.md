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
- **One question per round (Tim, 2026-07-20)**: when questions for Tim exist, always ask —
  clearly, with enough context, and pick THE one with the biggest bang for the buck in unblock
  value. Everything else: research it yourself ("you can do thorough research that's better
  than most answers I can give you"). Ask in the closing report, never blocking mid-work.
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
**Third window (2026-07-17, ~12:45Z–, "be fully autonomous until quota")**: **#71 done**
(PR #81): daemon auto-kicks the order job on compile when no fresh overlay (`shouldAutoKickOrder`
pure decision + shared `kickOrderJob`; failed-fingerprint Set stops retry storms per daemon
lifetime), `--no-ai-order` / `CODE_STORY_NO_AI_ORDER` opt-out, book never blocks (tier 0
immediately, overlay applies on next load — gradual call recorded in spec 02), `orderInvoke`
test seam. Dogfooded live on lexbox 8dd70ba~1..8dd70ba: auto-job done in ~36s, overlay + rationales
served fresh (comment on #71). **#64 done** (PR #82): server `context-resolve.ts`
(createContextResolver: changed-file lookup all languages w/ import-edge disambiguation
unique-or-nothing; unchanged-file lookup path-specifier languages only via head path index
`git ls-tree` + core `resolveTsSpecifier` extracted from buildImportGraph; deleted files at
base; (sha,path) memoized; fail-open), store `reviews/<b12>..<h12>.context.json`,
`GET /api/context?chunk=` compute-on-miss; demo test = util NOT in diff resolves. Tests 270
(core 171 / server 66 / web 33).
**Window continued (~13:00Z–15:00Z): M4 COMPLETE, M5 slices 0–2 done — ten PRs (#81–#90,
#94), all self-merged green.** #66 (PR #83): web definition panel — `d` expands a focusable
sibling region (never inside CM6), fetch-on-cursor-focus cached per chunk, Esc back, TanStack
measureElement handles row growth; verified in real headless Chromium on 2309. #75 (PR #84):
core `chunk-graph.ts` (ChunkEdge kinds calls/file-imports/exercises — NON-exhaustive per
R-050, `edgesOfKinds` structural filter is the only selector, `CALLS_DFS_KINDS` excludes
exercises in one home) + server `chunk-graph-build.ts` (changed-file resolver, test-path →
exercises never calls, ambiguity = no edge) + store + `--dump-chunk-graph`. #74 (PR #85,
issue OPEN for Tim): slice-0 audit materials in `docs/evals/chunk-graph-audit-2026-07-17/` —
**Tim labels tim-audit-{2309,2357,2379}.md (27 cards), THEN opens claude-labels-SEALED.md;
gate ≥0.90**. Claude-side 41/42=0.976; calls layer THIN on 2/3 subjects (2309 = 1 edge —
Svelte templates invisible, no grammar); free-glance proxy ~30–42% of marks have ≥1 reviewed
neighbor; 61–82% chunks ≤10 lines. #65 (PR #87): resumable POST /api/context-job (per-chunk
persist, kill-proven), `--context`/`--dump-context`, 2MB cap (bulk stops persisting, GET keeps
computing). #67 (PR #88): narration input gains additive-budget definitions block (~2k, diff
text never shrinks — byte-identity tested); server callers don't populate payloads yet (2-line
wiring deferred); prompt UNCHANGED (rides #58). #76 (PR #89): core `chapters.ts`
`compileChapterBook` — call-path chapters via Kahn over `calls` edges (naive DFS REJECTED:
shared-callee IOU violations; consumer-first demands topo) + Tarjan, anchors routes-first,
tests woven by kind via exercises (unit before impl, e2e closes, page-objects just-in-time);
`checkOrder(direction, testPlacement)` chunk-position semantics in chapter mode;
`story-config.ts` + `--direction`/`--test-placement` + per-repo `.code-story.json`; R-001
fast-check-tested in chapter mode. **DEFAULTS UNCHANGED — file mode/dependency-first/tests-
after; byte-identical default export verified vs main (NO CORE_VERSION bump). The flip to
Tim's axioms (consumer-first, tests-before, chapter mode) is #77's job, WITH the new order
prompt — flipping without it makes every AI overlay fail the checkOrder pre-gate.** Daemon/web
serve file mode only this slice. #68 (PR #90): dogfood 5 — context payloads hit 7/35 chunks
(2309, incl. 2 unchanged-file wins: pick, goto) and 11/33 (2379, in-diff only = spec's SCIP
door); cold fill ~1s, warm GET ~2ms; verdict "d earns its keystroke, unevenly"; harvest =
**#91 fixed same-window** (PR #94: cross-file changed matches now REQUIRE an import edge —
CreateEntry×6 confident-wrong killed, 2379 recall 30→16 all-justified), #92 (Svelte template
reach, evidence tag), #93 (--dump-context --verbose). PR #94 also fixed the three-job-GET
orphan TOCTOU (fast job finishes between record read and handle check → re-read once before
declaring orphan; server suite was ~1-in-3 flaky, now 6/6) — found via a CI flake whose
error-surfacing assert was added deliberately. Composition hazard learned: #71's default-on
auto-order made every pre-#71 server test spawn REAL claude (fixed 6c62a44: `autoOrder:
false` everywhere; new server tests MUST pass it unless testing auto-order). **Review pass
DONE** (docs/reviews/2026-07-17-m4-m5-review.md — READ IT before touching M4/M5 code: 6
fix-soon structural items incl. resolver unification, job-lifecycle triplication,
server.ts/cli.ts doubling, two Tarjans, and the section-id coupling trap that bites when
slice 5 wires chapter books into the anchor path). Its 2 fix-now items landed same-window
(PR #95): `justifiedUniqueFile` in references.ts is THE shared #91 rule (both resolvers;
graph edges 2357 38→36, the unjustified pair); context fill + GET now actually fail open
per chunk. #93 done (PR #96: `--dump-context --verbose` lists unresolved names). Suite
**337** (core 210 / server 84 / web 43). Remote branch deletes 403 — stale merged claude/*
branches on origin are cosmetic, ignore.
**Fourth window (2026-07-18, nightly): #77 DONE (PR #101, merged a8db0d8).** Default story order
flipped to Tim's axioms (R-043–R-046): DEFAULT_STORY_CONFIG = consumer-first/tests-before/chapter
mode; FILE_MODE_STORY_CONFIG keeps dependency-first/tests-after, still selectable via
`--direction`/`--test-placement` or `.code-story.json` (the flip changes the default, removes
nothing — R-025/"keep ordering options open"). Order overlay **v2** = a chapter COMPOSITION
(partition of story chunk ids), not a section permutation; `AnyOrderOverlay = v1|v2`; chapter
section ids `chapter:<anchorChunkId>`, cross-file occurrences carry `label` = the chunk's file.
Chapter order prompt `order-chapter-1` shows ALIASED chunks (c1..cN, never raw ids — the #44
truncation lesson); validator + checkOrder chunk-position pre-gate reject direction/test
violations; fail-open to the deterministic chapter book. Daemon + CLI
(`--ai-order`/`--order ai`/`--export`) + web all speak chapter mode. **CORE_VERSION → 0.0.5 —
invalidates ALL persisted overlays; regenerate before any overlay-dependent demo.** order-eval
same-book guard now keys on the chunk multiset (chapter mode regroups sections, so section-title
equality was wrong). **Eval verdict: AI 9 / tier-0 0** (opus generator, sonnet judge, K=3 × 3
subjects, zero invalid; reports `docs/evals/reports/eval-chapter-{2309,2357,2379}.json`) → spec
02/05 flipped to SHIP, baseline doc "Chapter-mode ordering eval". Win is partly consumer-first
ordering, partly consolidation — the tier-0 chapter linearizer over-fragments on sparse call
graphs (2357: 76 sections vs AI 32) → harvest **#100**. Does NOT settle chapter-vs-file mode (the
#74-gated question). Signing note: this container has
no SSH signing private key (`commit_signing_key` absent), so all commits show Unverified on
GitHub — established all-session condition, not fixable here.
**#77 post-merge review done** (`docs/reviews/2026-07-18-m5-77-review.md`, PR #102): verdict SOUND
to build the M5 UI on. Fixed one correctness bug — the chapter-order size guard measured the
raw-id manifest, not the aliased prompt the model actually receives (~3-4x shorter), so AI ordering
silently refused on moderate+ diffs and fell back to tier-0; now guards the aliased text, the two
manifest renderers are unified behind one label fn (server output byte-identical → prompt version
unchanged, eval still valid), `estimatedTokens` dropped, regression-tested. Also a quadratic
`assembleSections` label lookup. Deferred (in the review doc, not urgent): `/api/book` +
`export?order=ai` double-compile via `applyChapterOverlay` — measure before changing the contract.
Suite 365 (core 221 / server 96 / web 48).
**Fifth window (2026-07-18, "build all night"): #74 gate CLEARED by Tim → M5 UI COMPLETE (#74–#80).**
Tim trusts the chunk graph ("I trust your graph"; self-audit 0.976 + a spot-confirmed edge) and
steered navigation to **mouse-click-first** (keyboard secondary; amends R-004's "keystroke"). **#78**
(PR #103): chunk graph exposed on BookResponse + core `neighborsOf`; the neighbor strip is an
ARIA-toolbar of clickable chips in the focused chunk's header (click primary, `g`/arrows/Enter/`b`
secondary), three states + `+N behind`, back-stack, re-encounter≠re-audit, hide-when-empty, never a
canvas. **#79** (PR #104): honest display-only frontier surfacing (progress-cluster count +
done-banner "N interactions surfaced — none individually verified"; `file-imports` excluded; gates
nothing, 100% coverage ⇒ 0 frontier). **#80 dogfood 6** (PR #105, `tools/dogfood-mow.mjs`): full UI
works E2E on lexbox, but real changed-file graphs are **island-dominated** (2379 53% / 2309 89% of
chunks touch no interaction edge), so the mow aids only a change's **connected core** (it
reconstructed the `EntryQueryHelpers` hub-and-spoke from the strip alone) — a local aid on the linear
safety net, not a whole-PR navigator; chunk-size premise (R-049) holds. **#108** (PR #110): symbol-less
chip labels use the file basename. No CORE_VERSION bump this window (read-only derivations / display /
web only). Suite **381** (core 225 / server 97 / web 59). **M5 UI adversarially reviewed** —
verdict **safe for Tim to drive, no bug-severity defects** (occurrence-vs-chunk nav = first
occurrence is correct since review state is per-chunk; the j/k-into-strip leak is guarded by
`closest('button')` — both confirmed clean). Fixed a roving-tabindex focus desync on strip re-entry
(PR #111); harvested **#112** (back-stack/cursor indices go stale if the AI order applies
mid-review — narrow, shared with pre-existing cursor behavior; proper fix = remap on `chunkId#ordinal`).
**Sixth window (2026-07-19, nightly → "have a real product for me to try tomorrow that I can ask
for concrete changes on"): #106 done + the product made tryable.** Tim's steer: he'd rather DRIVE a
running product and give concrete feedback than answer the abstract felt-reads here. **#106 shipped**
(PR #113): `m` = mark-in-place (mark reviewed, cursor stays) makes the lawn-mower drivable by hand —
land → read → `m` → `g`/click a chip to follow the strip → repeat; Enter unchanged (mark+advance), so
options stay open. **README + `tools/demo.sh`** now make it a one-command launch (`tools/demo.sh [repo]
[range]` → book UI at a printed URL; the daemon serves the built web via serveStatic, no Vite;
`--ai-order --order ai --export book.md` for the no-browser read) — the stale "nothing built yet"
status is fixed and the ordering-defaults section corrected (consumer-first/before/chapter is the
default; file mode via flags). No CORE_VERSION bump (web + docs only). Suite **394** (core 225 /
server 97 / web 72).
**Seventh window (2026-07-19, same session — Tim steered live):** two asks landed. (1) **Prepared
review files** for real sillsdev PRs (`docs/evals/prepared-reviews-2026-07-19/`): 6 AI-ordered (+
narrated file-mode) code-story books for 4 lexbox branches (duplicate-entry-detection-sync,
possible-duplicates, writing-system-collation, variants-backend) so Tim reads/iterates with tokens
pre-spent. **Access limits — record for next time: the proxy GATES the sillsdev GitHub API (no PR
metadata) and blocks cross-owner `add_repo`, so `harmony` was unreachable and PRs were picked by a
git size/recency heuristic, NOT review-state.** Findings filed: **#115** (narration embeds in file
mode only → invisible in the default chapter mode; a naive `--narrate` silently wastes tokens),
**#116** (AI ordering refused on the 87-file variants PR at ~20k>8k-token manifest → tier-0; the
guard may be too conservative), #100 re-confirmed (variants tier-0 = 577 sections/726 chunks). (2)
**#114 live ordering-options UI DONE** (PR #117): a top-bar popover flips reading order
(consumer/dependency-first, tests before/after/end) live — `/api/book?direction=&testPlacement=`
recompiles per-config (config-independent `Base` cache + per-config `Map`; launch path
byte-identical; AI overlay only for the launch config, others honest tier-0); review marks survive
the reorder; also tidied the server config-coupling the M4/M5 review flagged. **#106** mark-in-place
(PR #113) shipped earlier this session. Suite **400** (core 225 / server 99 / web 76). No
CORE_VERSION bump.
**Eighth window (2026-07-20 evening → 07-21, Tim live twice): the feedback round + the glue
pipeline — R-051–R-060, specs 06+07, issues #120–#128, ALL BUILT on branch
`claude/code-review-interface-uk7s3c` (24+ commits).** Tim's two inputs persisted verbatim
(`docs/vision/addendum-2026-07-20-{review-ux-feedback,ai-pipeline}.md`). Process: 4 parallel
ux-expert passes + a UI map (archived `docs/design/2026-07-20-review-ux-round/`), spec 06
grilled (17 findings folded), spec 07 (pipeline) written at root + grilled (21 findings; the
two blockers: ledger at the INVOKER — task-internal re-asks are real spawns, observed 7 calls
for 5 units — and `autoOrder:false` aliases to all-glue-off or the corpus spawns real claude).
Landed: **06-1** scrollspy (spy on sectionId, rows carry sectionId/occurrenceKey, auto-expand
current, aria-current); **06-2** file-pieces (`piece n/N` header button → portal menu,
jumps via the back-stack, mark-all-pieces batch; `lastBatch.prior` = FULL ChunkReview);
**06-3** auto-read (never auto-promotes: `autoRead`/`reviewedVia` FLAGS not enum, gate =
60% visible + 300ms/line dwell clamp 1.5–8s + 2000px/s velocity reset + tall/stub/collapsed
ineligible, rAF sampler NOT the settle-scan; ◑ glyph, dashed rail, confirm moments in section
morph/cluster/end-row); **06-4** segmented chapter bar + chapter-done beat (one summarizing
toast per batch) + resume/done copy + "Why this order?" (config-derived, AI-badged only when
AI order applied) + top-bar ⋯ overflow; **G1** `packages/server/src/glue/` (two single-flight
lanes interactive/background, dedupe (kind,fingerprint), failed set, force kicks for POSTs,
running spans backoff, injectable delay/now, ModelPolicy top/mid/cheap + per-task override
(`orderModel` stays order-only), invoker wraps claude-cli + harvests usage → JSONL ledger
`<range>.glue-ledger.jsonl`, `GET /api/glue` + `--dump-glue`); **G2** chunk narration v2 +
badges DEFAULT-ON (per-chunk overlay in OWN file `.narration-chunks.json`, v1 untouched;
prompt `narration-chunk-1` bakes in point-don't-assert from day one; by-file aliased batches;
badge gate incl. placeholder stoplist; `--no-ai-narration`/env opt-out; web chips + AI lines +
"AI notes: N of M"); **G3** deferral (header Defer split-button: Ask-AI-&-defer default /
note / inline; ONE save-chain for deferrals.json across POST/DELETE/GET-orphan/task-fill;
`deferral` task on the interactive lane, fail-open per deferral, Retry = re-POST upsert;
web-only `deferred:web` end section ⏲, excluded from the bar; scoped self-terminating 10s
poll; done can fire with "M AI answers still arriving"); **G4+G5** order+context migrated
onto the pipeline contract-stable (server.ts −58, retry loop deleted, three job-record
loaders → one; forced POST on fresh overlay now 200-skips, deliberate). **Suite 537**
(core 244 / server 155 / web 138). **Live pipeline proof**: 15-chunk book → 5 narration
units, 7 opus calls, $0.65 ledgered, 15/15 chunks got badge+/line, gates held. **Integration
review** (`docs/reviews/2026-07-20-feedback-round-review.md`): 4 defects found+fixed (the
React functional-updater `e.currentTarget`-is-null trap broke BOTH compact popovers; popover
scroll-close vs feed re-measure; top-bar page overflow; daemon exit never drained the glue
scheduler — SIGINT now calls `shutdownGlue()`); MED recorded: v1 narration POST spawns
outside the invoker (unledgered, can make a 3rd child) — fix when v1 retires. Ops notes:
**lexbox clone does NOT survive containers** (proxy only serves myieye/code-story; cross-repo
clone auth-blocked) — dogfood on code-story's own history (`a53e79f~1..a53e79f` used
throughout); `pkill -f <pattern>` matching your own bash command kills the shell (exit 144) —
kill by pgrep+pid; the review agent died on a session usage limit mid-smoke (quota is real —
its server-seam sub-report survived and fed the review doc).
**Ninth window (2026-07-23, Tim's Windows machine, live request): book-level links + two
prepared reviews.** Tim asked for code-story books for lexbox PRs 2468 + 2470, with code-story
gaining links (PR / Files changed / running app instance) first. **PR #131 merged**: `--pr-url
--app-url --app-label` flags → `BookResponse.links` (config-independent passthrough; pure
`filesChangedUrl` derives `/files` from GitHub PR URLs) → web: range span becomes the PR link
(↗), green `▶` app pill right after it (THE only tinted element in the identity cluster —
ux-expert pass; that's the whole "visual respect" budget), `Files changed ↗` before Export in
both exit groups, `Open the pull request ↗` in the done banner. Deliberately rejected for v1
(in the ux-expert report): liveness dot/health-check plumbing (static link + honest tooltip;
add only if Tim actually hits dead-app tabs), per-section GitHub deep links (wrong grain in
chapter mode + GitHub virtualizes big Files-changed pages + no MD5 in Web Crypto). App-instance
policy (Tim's framing): provide one only when the PR's feature is actually triable locally AND
we already know how to run it — 2470 (comments-panel redesign, Svelte) YES via lexbox worktree
+ fwl-up; 2468 (Windows MSIX updater proxy) NO (needs a packaged installed MSIX mid-update).
**Windows ops notes (first run on Tim's machine)**: glue's `claude` spawn works on Windows
as-is (28/28 calls ok); lexbox lives at D:\code\languageforge-lexbox (worktrees under
D:\code\lexbox-claude-worktrees\...; fetch `pull/<n>/head` refs there); fwl-up skill runs
FW Lite per-worktree on random ports; browser-pane screenshots still hang hidden — verify via
read_page/JS instead; books served from the code-story worktree dist, state under
`~/.code-story/languageforge-lexbox-32093c12aded/`. Costs ledgered: 2468 book $1.69/11 calls,
2470 $2.43/17 calls (opus).
**Tenth window (2026-07-23 evening, Tim live): diff-display bug round + the beauty/flow
mandate — specs done, builds killed by quota, handoff prepared.** Tim dogfooded the 2468 book
and reported 5 display bugs; all fixed and merged (PR #133): def-panel contradiction killed
(`visibleDefinitions` filters defs that are book chunks), **colour-consistency invariant**
(Tim verbatim: "Everything new or edited must be correctly colour marked in all places it is
shown") enforced via core `changedLinesByFile` + `unifiedChunkLines` 4th param (boundary
context rows landing on ANY of the file's changed lines get add/del colouring), chips lost
the misleading call-site line number (`→ calls Deploy` + `new` pill when the callee chunk is
pure insertion; moved-code callees honestly read "changed"), file labels dedupe to
transitions (sticky bar covers mid-run), outline chapters show `+N files` + cross-file child
basenames. Then Tim's second input (verbatim addendum
`docs/vision/addendum-2026-07-23-beauty-and-review-flow.md`, **R-061–R-066**): chip
review-state markers, make-it-beautiful (theme/texture/logo/fonts), partial-chunk deferral,
ask-AI progress feedback, no bare "+2", gist forefront — plus "work long and hard, impress
me" (hit the NEXT 5h quota window, not the current one). Issues **#134–#140** filed. Four
parallel ux consults + logo round produced APPROVED build contracts, all persisted in
**`docs/design/2026-07-23-ux-round/`** (READ ITS README FIRST — it is the handoff hub with
per-issue build state, salvaged agent learnings, sequencing plan, live-daemon bounce facts).
The 6-agent build wave died on the session limit mid-flight; salvage pushed as
`claude/134-chip-states` (glyph module + WIP strip changes, tests not green) and
`claude/chunk-narration-eval` (tool skeleton). #112's audit completed before death: only
`cursor` + `backStack` are stale flat indices; server cursor is already a chunk id. Logo
verdict: bookmark-diff concept wins; 2-row mini-diff payload; separately drawn 16px favicon.
Key sequencing: theme (#135) builds LAST of the CSS-heavy set; #138 after #137 (same files);
7468 bounce after all merges. Ops: session limits kill subagents mid-flight — push WIP
branches EARLY; two of six isolated agents left no worktree at all (isolation is
best-effort); Windows dynamic import of dist needs `pathToFileURL`.
**Eleventh window (2026-07-24, remote container, "hit the quota, impress me"): the ENTIRE
2026-07-23 ux-round executed + the evidence-gated backlog cleared — 11 PRs (#141–#147,
#149–#152), all root-reviewed, CI-green, self-merged.** UX round: #141 = #112 remap (new web
`cursor-remap.ts`, occurrence keys across reorders; manual config flips keep their deliberate
jump-to-first-unreviewed, only involuntary reorders remap); #142 = #134/#139/#140 (shared
`review-glyph-logic.ts` — outline + chips speak ○ • ◑ ✓; "+N unreviewed" pill; AI gist leads
the chunk header in serif); #144 = #137 partial-chunk deferral (select lines → floating
"Defer lines N–M" pill, slice defers mark the parent reviewed, per-slice card previews +
✓ Resolve; header Defer is whole-chunk only); #149 = #138 ask-AI live progress (1s count-up
in a self-contained component, adaptive 3s/8s/stop poll, failures now visible in stub +
cluster + announce — was silent); #150 = #135 beauty pass (`:root` token layer over all ~79
hexes, self-hosted IBM Plex Sans/Mono + Fraunces variable via @fontsource — 13 woff2, no CDN
— feTurbulence paper grain on body only, CM6 reads the same tokens, scripted AA check);
#151 = #136 logo (`BrandMark.tsx` bookmark-diff lockup, hand-tuned 16px `favicon.svg` with
embedded light/dark flip). **#152 (found by ROOT live-driving the merged build): with
`EditorView.editable(false)` a mouse drag is a NATIVE selection — CM6 `selectionSet` never
fires, so #137's pill could never appear; DiffView now watches document `selectionchange` →
`posAtDOM`. Lesson re-proven: unit-green interaction code still needs one real browser drive;
the pre-installed Playwright chromium works via executablePath /opt/pw-browsers/chromium-1194
(never channel:'chrome' here).** Backlog: #143 = chunk-narration rubric eval
(`tools/chunk-narration-eval.mjs`, resumable sidecar, sonnet judge vs opus generator; verdict
register 5 / grounding 4 / faithfulness floor holds → **default-on stands**, single-subject
caveat; grounding-1 tail on bare generic badges → #148 watch); #145 = #107 frontier copy;
#146 = #100 same-file coalescing in the tier-0 chapter linearizer (boundary-flag only, emission
order byte-identical; smoke subject 14→5 sections; **CORE_VERSION → 0.0.7**); #147 = #130
order-overlay freshness keyed off the tier-0 story composition (testPlacement flips now reuse
the paid overlay; the issue's `config-explain.ts` reference was unlanded spec-08 material —
author its costNote as free when spec 08 builds). Suite 551 → **578** (core 253 / server 162 /
web 163). Ops learned: a ~7h container suspension killed two agents mid-flight — push-early
paid off again (both branches were already on origin; SendMessage resume finished them);
quota-status is unreadable in this container (no .credentials.json — token is fd-only).
#153 = #116 manifest guard 8k → 32k aliased tokens, validated with a REAL run on a synthesized
127-file code-story range (~25–31k aliased): opus returned a valid 95-chapter composition
first try, checkOrder pre-gate passed, $0.84 / ~3 min; 43k+ ranges still refuse; compaction
(candidate b) stays evidence-gated for the 32–60k band. Harvest → **#154**: the chunk-graph
build intermittently stalls on large ranges (>25 min, no output, no CPU — grab a stack before
killing next time).
**Twelfth window (2026-07-24, Tim live: a richly-narrated exemplar + "go a bit more in this
direction as needed for complex code, but it's too verbose").** Tim shared a Claude-generated
"code story" (a narrated reading of lexbox's `ActivityChangeInfoResolver.cs`) far deeper than
anything we ship. Learnings persisted (`docs/design/2026-07-24-narrated-exemplar-learnings.md`;
verbatim steer in `addendum-2026-07-24-narration-depth.md`; **R-067** adaptive depth, **R-068**
reviewer-verification "Check" notes). Key insight: the exemplar's most on-thesis device is the
**"Check" callout** (what to verify, not "looks fine") — R-026/moat made concrete; its "Safe"
reassurance register is exactly what our `BANNED_PHRASES` gate rightly forbids, so we imported
the Check register only. **Shipped (this branch, all tests green): complexity-gated review notes
on chunk narration v2.** `NarrationEntryV2.reviewNote?` (optional), gated by new core
`checkReviewNote` (richer caps — 340 chars / 3 sentences — but same BANNED_PHRASES point-don't-
assert); prompt `narration-chunk-1`→**`narration-chunk-2`** instructs a RARE note only for
genuinely complex/subtle/risky chunks ("a note on a simple chunk is a defect"); parsed/gated/
persisted in the task (dropped independently of line/badge, folded into the re-ask), projected
through `/api/narration`, rendered as an indigo "AI · Worth checking" callout under the terse
gist line (own affordance, `.chunk-review-note`). Separation is the design: **line = orientation
(every chunk, terse); reviewNote = what-to-verify (complex chunks only, richer)** — depth where
earned, terse everywhere (Tim's "too verbose" guard). No CORE_VERSION bump (optional field; old
overlays stay valid, just note-less) — only promptVersion moved. **Dogfooded live** on the
Kahn/Tarjan chapter linearizer commit (`7071ea2~1..7071ea2`, opus): **3 of 73 chunks (4%)** got a
note — landing exactly on the topo-sort loop, the property-test invariants, and the chunk-order
comparison; every note POINTS ("Confirm…/Check…/Trace…"), zero reassurance leaked. Screenshot
verified in real chromium (badge → AI line → callout → diff). Suite core 258 / server 166 /
web 165 = 589. Deferred follow-up filed: the epilogue **punch list** (roll every chunk's
reviewNote into the done-banner as the reviewer's takeaway). `estimateRowHeight` doesn't yet
account for note height — measureElement self-corrects (as with def-panel/deferred-card); fine
while notes are sparse.
Next (verify freshness on wake): (1) Tim drives
the new UI on a real book — rebuild + bounce his 7468 daemon (Windows: build in a worktree,
kill PID via netstat -ano | findstr 7468, relaunch same args from new dist; review state
survives) — the theme/logo/defer-slice/ask-AI feedback all want his eyes; (2) Tim's open
answers: glue spend policy (no ceiling + ledger vs cap) and move/split-aware diffing (asked
2026-07-23). Evidence-gated watches: #21, #27, #58, #92, #109 (Tim read), #132, #148, #154.
Standing guidance holds: keep options open (R-025); Tim scopes milestones; PR-versions
(R-038–R-041) deferred.
Dogfood target: languageforge/lexbox (C# + Svelte/TS); repo-agnostic (R-025). lexbox is NOT
cloneable from remote containers (proxy serves only myieye/code-story) — standing no-lexbox
smoke subject is code-story's own `a53e79f~1..a53e79f`; on Tim's Windows machine lexbox lives
at D:\code\languageforge-lexbox.
