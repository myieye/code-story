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
- **Quota discipline (Tim, 2026-07-16)**: Tim's Claude quota is shared with his other work —
  don't burn it. Pace the build across sessions; prefer direct work over agent fan-outs; don't
  re-run or re-read without a question to answer; check quota (`quota-status` skill) before any
  heavy phase and stop comfortably short of limits rather than sprinting.
- **Commits**: `git config user.email noreply@anthropic.com`, `user.name Claude` (a stop-hook
  enforces this).
- **GitHub provenance in this repo**: everything here is Claude-authored by default (vibe
  mode). Issue/PR bodies open with the *[Claude, autonomous]* line; `[claude]`/`[vibe]` title
  prefixes are dropped as pure noise in an all-Claude repo. (Specializes Tim's global tagging
  rule — Tim can veto.)

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
UI, #6 review loop done.** Stack: pnpm monorepo (core/server/web),
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
test events on `document.body`. Next: #7 low-signal collapse + batch acknowledgment.
Dogfood target: languageforge/lexbox (C# + Svelte/TS); repo-agnostic (R-025).
