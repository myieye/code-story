# Due diligence: forking `in-the-loop-labs/pair-review`

Code-level assessment (public repo, v5.0.1, schema v54), 2026-07-15. Question: fork as the base
for code-story vs harvest parts vs prior art only. Verdict: **harvest, don't fork** (§7).

## 1. Architecture map
Node.js/Express (`src/server.js`), SQLite via `better-sqlite3`, vanilla-JS frontend confirmed (no framework dep in package.json). Monorepo via pnpm workspaces, three Claude-plugin packages (`plugin`, `plugin-code-critic`, `plugin-pair-loop`). Version 5.0.1 — actively developed, commits daily (last: 2026-07-14), authored almost solely by "tjwp" with "claude" as frequent co-author (i.e., largely AI-pair-coded solo project).

`src/` breaks into `ai/` (18 files: per-CLI provider adapters), `chat/` (ACP/bridge layer), `git/` (worktree pool), `github/`, `routes/` (20 route files), `councils/`, `ws/`. Frontend: `public/js/components/` (29 UI component files) + `public/js/modules/` (19 files) — all plain JS, JSDoc-typed, no TypeScript anywhere in the tree or deps. `tests/unit` has 150+ files (unit/integration/e2e via vitest + Playwright) — real coverage, not decorative. `src/ai/analyzer.js` alone is ~1800 lines and is a genuine god-class (prompt building + diff capture + provider orchestration + persistence + progress/cancellation all in one `analyzeAllLevels()` ~450-line method) — a churn/complexity hotspot.

## 2. Data model (SQLite, schema v54, `PRAGMA user_version`)
Comments are GitHub-style, position-anchored, not chunk-identity-based:
```sql
CREATE TABLE comments (
  id INTEGER PRIMARY KEY, review_id INTEGER, source TEXT, ai_run_id TEXT, ai_level INTEGER,
  file TEXT, line_start INTEGER, line_end INTEGER, diff_position INTEGER,
  side TEXT CHECK(side IN ('LEFT','RIGHT')), commit_sha TEXT,
  status TEXT CHECK(status IN ('active','dismissed','adopted','submitted','draft','inactive')),
  adopted_as_id INTEGER, parent_id INTEGER, is_file_level INTEGER, ...
)
```
`analysis_runs` records provider/model/tier plus `levels_config`/`level_outcomes` JSON blobs for the three-level pipeline. No chunk-identity concept exists anywhere — identity is `(file, line, diff_position, commit_sha)`, i.e. GitHub PR-comment semantics, not a stable sub-file-chunk model. `hunk-hashing.js` computes `SHA256(filePath + "\n" + hunkContent)` purely to dedupe/flag "trivial" hunks (import reordering, version bumps) for AI analysis — not a durable chunk-identity or ledger primitive. There is no patch-application/versioning ledger; `reviews.review_data`/`summary` are opaque blobs, and worktrees are ephemeral pooled checkouts, not an append-only patch history. `worktree_pool` tracks pooled dirs with status enum (`available/in_use/switching/creating`) + LRU (`last_switched_at`) for reuse across reviews.

## 3. Agent adapter layer
`src/ai/provider.js` defines a clean `AIProvider` base: static `getModels()`/`getProviderId()`, instance `execute(prompt, options)` with `onStreamEvent`, `testAvailability()`, config-override/aliasing for model tiers (fast/balanced/thorough/premium). 8 concrete providers (claude, codex, copilot, cursor-agent, antigravity, opencode, pi, "executable"). `claude-cli.js` shells `claude -p --model <m> --settings '{"disableAllHooks":true}'` via `child_process.spawn`, writes prompt to stdin, buffers stdout, regex/JSON-extracts the result; **stateless** — no session-ID reuse for the analysis path (5-min timeout, `PAIR_REVIEW_CLAUDE_CMD` override, `ENOENT` handling). This is one-shot batch analysis, not a true interactive agent loop.

The interactive/interactive-thread story lives separately in `src/chat/acp-bridge.js`, which *is* a real ACP client: uses `@agentclientprotocol/sdk`'s `ClientSideConnection` + `ndJsonStream`, does `initialize()`/`newSession()`/`loadSession()`/`prompt()`/`cancel()`, handles `sessionUpdate` streaming (`agent_message_chunk` → accumulated deltas) and `requestPermission` callbacks, emits a normalized EventEmitter API (`delta/complete/tool_use/status/ready/close/session`). This is the single most directly reusable piece for an ACP-client target architecture — reasonably self-contained, provider-agnostic-ish (also has `claude-code-bridge.js`, `codex-bridge.js`, `pi-bridge.js` siblings).

## 4. Diff pipeline
Diff parsing/rendering is NOT homegrown — it's built on the third-party `@pierre/diffs` npm package (`FileDiff`, `File`, `parsePatchFiles`, highlighter/theme APIs), bundled via esbuild into `public/js/vendor/pierre-diffs.js` (IIFE + worker). The renderer (`diff-renderer.js`, `hunk-parser.js`, `pierre-bridge.js`, `gap-coordinates.js`, `line-tracker.js`) is explicitly file-wrapper-scoped — code comments state DOM lookups are "scoped to `.d2h-file-wrapper`" specifically so nested elements can't leak across file boundaries. Hunks are parsed into simple `{header, oldStart, newStart, lines[]}` blocks per file; there's no sub-file chunk reordering or interleaved-non-diff-content abstraction — the whole stack (both the vendor lib and pair-review's wrapper modules) assumes sequential file→hunk→line nesting. Retrofitting reorderable, interleaved chunks would mean fighting `@pierre/diffs`'s model at every layer (DOM structure, comment anchoring, gap-coordinate math) — effectively a rewrite of the render layer, not an extension.

## 5. GitHub sync + worktrees
`src/external/github-adapter.js` (~280 lines): thin, DI-friendly wrapper over Octokit (`listReviewComments`, paginated), handles dual-host (github.com vs enterprise) credential binding, and a real GitHub-comment-thread-quality anchoring split (position-based on github.com, `line`-based on alt hosts, file-level vs inline). No rate-limit/backoff logic visible (delegated to an unshown `GitHubClient`). `src/git/worktree.js` + `worktree-pool-lifecycle.js`: solid, safety-conscious — legacy worktree adoption, remote resolution for forks, `git worktree add --no-checkout` + optional checkout-script hook, PR-ref-then-SHA fallback fetch, uncommitted-changes guard before refresh, stale-worktree eviction (7-day TTL) + `git worktree prune`. This is genuinely liftable as a standalone worktree-pool module.

## 6. Code quality signals
Consistent Apache-2.0 SPDX header per file (`Copyright 2026 Tim Perkins (tjwp) | SPDX-License-Identifier: Apache-2.0`). JSDoc typing throughout, no TS compiler/checker in the loop. Module boundaries are mostly reasonable (route/provider/git/chat separation) except `analyzer.js`, a clear god-file. `CONVENTIONS.md` files exist per major directory (frontend, chat, tests) — above-average documentation discipline for a solo project. Background job queue (`background-queue.js`) is a trivial in-memory FIFO (concurrency=2, keyed `reviewId:jobType`) with zero persistence or coverage-tracking semantics — not a "coverage queue" in any meaningful sense.

## 7. VERDICT: harvest specific subsystems; do not fork.
The target architecture (TS daemon, CodeMirror-6 book UI, stable sub-file chunk identity, coverage queue, append-only patch ledger via `submit_patch` MCP + ephemeral worktrees, ACP-client threads) diverges from this codebase at its two most load-bearing layers: the data model (position/line-anchored comments, no chunk identity, no ledger) and the diff renderer (hard-coupled to file-level `@pierre/diffs`, no reorder/interleave support). Both would need rewriting, not extending — forking inherits a god-class analyzer and a comment schema you'd immediately fight.

Worth lifting near-verbatim:
- `src/chat/acp-bridge.js` (+ sibling bridges) — working ACP `ClientSideConnection` client, directly reusable for interactive-thread integration.
- `src/git/worktree.js`, `worktree-pool-lifecycle.js`, `worktree-pool-usage.js`, `worktree-lock.js` — mature pooled-ephemeral-worktree management with DB-backed lifecycle tracking (`worktree_pool` table as a starting schema).
- `src/external/github-adapter.js` + `src/github/` — clean, testable GitHub PR/comment sync with dual-host and thread-reconstruction logic already solved.
- `src/ai/provider.js` + individual CLI providers (`claude-cli.js`, `codex-provider.js`, etc.) as reference implementations for a multi-CLI adapter pattern (flags, timeout, stdin/stdout parsing) — not code to vendor wholesale (stateless, no MCP `submit_patch`), but a good spec to imitate.

Everything else (comment/diff/analysis data model, `@pierre/diffs`-based renderer, background queue, MCP tool set — which is read-only/analysis-triggering only, no patch-submission tool exists today) should be treated as prior art to read, not code to inherit.
