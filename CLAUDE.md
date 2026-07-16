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
evidence-gated like #21). Next: #28 decides ship/default; then M3 scoping (narration/context
payloads — R-036 becomes the gate) or the ambitious paths spec 02 defers (chunk-level
interleave, code excerpts in manifest, auto-run).
Dogfood target: languageforge/lexbox (C# + Svelte/TS); repo-agnostic (R-025).
