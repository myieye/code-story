# Architecture review — 2026-07-16 (post slice #6)

Scope: every source file in core/server/web plus the build/config layer, looking specifically
for things that make long-term development and maintenance harder. Requested by Tim
("watch for absolutely anything that can make long-term development/maintenance challenging").

## Fixed in this pass

| Finding | Risk it carried | Fix |
|---|---|---|
| Server package named `code-story` while siblings are `@code-story/*` | Already caused one real incident (pnpm `--filter` silently matching nothing) | Renamed to `@code-story/server`; bin stays `code-story` |
| `chunkTitle` duplicated in core export + web rows, both **parsing `chunk.id`** | UI/export coupled to the id encoding; changing id format breaks display silently | `Chunk.displayPath` is now model data; single `chunkTitle` in core |
| `BookResponse` declared ad hoc in web, response object shapeless in server | API drift between daemon and SPA compiles fine until runtime | Contract type in `core/src/api.ts`; both sides compile against it |
| Rejected promises stayed in `diffCache`/`bookCache`/`reviewCache` | One transient git failure bricks the daemon until restart | Caches self-clear on rejection |
| `saveChain` poisoned by one failed save | First disk error → every later review PATCH 500s | Chain absorbs errors; each request still surfaces its own failure |
| `useReview.flush` cleared pending before sending | Marks silently lost if the daemon is briefly down | Failed patches re-queue (newer entries win) and retry |
| `applyReviewPatch` iterated `patch.set` unguarded | Malformed body → 500 instead of ignored | `Array.isArray` guard |
| Repo slug from directory basename | Worktrees/renamed clones of the same repo get separate review state | Slug prefers origin repo name; root-commit SHA stays the identity anchor |
| Test files excluded from `tsc` and vitest doesn't type-check | Type errors in tests invisible (a required-field addition proved it) | `tsconfig.check.json` in core/server; `pnpm test` type-checks first |
| Server `dist/` shipped compiled test files | Bloat + accidental import surface | Build excludes `*.test.ts` |
| No TS project references | Editing core leaves dependents typing against stale `dist` in the IDE | core `composite` + `declarationMap`; server/web reference it; server builds with `tsc -b` |
| `pnpm dev` had no `/api` proxy and CLI had no `--port` | UI iteration required a full rebuild each time | Vite proxy (`CODE_STORY_PORT`, default 7357) + `--port` flag |
| React render error → blank page | Lost-session feeling during dogfood; marks look gone (they aren't) | Error boundary saying state is safe on the daemon |
| `BookPage.tsx` at ~570 lines and growing | M1 mounts prose slots/threads/context drawers onto this file | Split out `OutlineSidebar`, `RowView`, `ShortcutOverlay` (pure moves) |

## Known constraints — deliberate for M0, revisit when stated

- **`/api/book` is a monolith** (all chunks + all diff rows in one JSON; 6.5 MB at 1,297
  chunks, ~30 MB extrapolated at 5k). Fine locally for M0. When M1 adds prose/context payloads,
  switch to per-section or per-chunk fetch **before** the payload grows another multiple; the
  UI already consumes diffs per chunk id, so the seam exists.
- **Occurrence identity is conflated with chunk identity in the web layer** (`chunkIndexById`,
  outline keys, cursor persistence all key on `chunk.id`). Correct while the naive compiler
  emits exactly one primary occurrence per chunk; **breaks the day a chunk gets a second
  occurrence** (R-004, M1). The fix shape is keying rows by `(chunkId, ordinal)` and keeping
  review state on the chunk. Tracked here so M1's ordering work budgets for it — this is the
  first thing to touch when replacing the compiler's ordering step.
- **`computeChunks` fetches file contents serially** (two `git show` per file). The 172k-line
  monster range costs ~31s cold. Bounded-concurrency fetch is the obvious win when cold-start
  starts to matter; not worth complexity for mid-size PRs (<3s).
- **Review file is rewritten whole per explicit mark** (~1 MB at 5k chunks). Local disk, fine.
  If it ever shows up in latency, batch marks server-side; the append-only ledger design
  (R-038+) will replace this file anyway.
- **`estimateRowHeight` hardcodes CM line height (19px)** — only an estimate; the virtualizer
  measures real heights. Revisit only if scroll-jump artifacts appear after CSS changes.
- **`serveStatic` root is computed relative to `process.cwd()`** — breaks if the reviewed repo
  and the code-story install live on different Windows drives. Dogfood setups so far share D:.
  Fix (serve from absolute path or embed assets) when it first bites.
- **Keydown/seen-tracking listeners re-register every render** (no dep arrays). Correct but
  subtle; if BookPage ever gets memoized children relying on stable handlers, convert to
  `useEffectEvent`-style refs.
- **No web unit tests.** The pure-ish review-loop logic (`findUnreviewed`, wrap semantics, seen
  edges) lives inside `BookPage`. When it next changes, extract it to a plain module and test it
  there — cheaper than component testing, catches the regressions that matter (wrap-around,
  mark-advance ordering).
- **UI verification scripts are session-ephemeral** (Playwright driven from scratchpad against
  lexbox's install). Acceptable while demos are hand-driven; if a third session rewrites the
  same walk-mark-resume script, move a small Playwright harness into the repo instead.

## Non-findings (checked, fine as is)

- Core purity holds: no IO anywhere in `packages/core`; server/web depend one-way on core.
- R-001 enforcement is structural (chunker construction + compiler leftovers + property tests),
  not incidental — survives refactors.
- Review-state persistence versioned (`version: 1`, range-checked on load, atomic writes).
- Tree-sitter runtime pinned to `@vscode/tree-sitter-wasm`'s own loader (ABI-safe by
  construction); grammar table is data, easy to extend.
- Diff parser is scoped to `-U0 --no-color --find-renames` output and says so; ranges-only
  design means no content-drift class of bugs.
- CI runs build + tests on Node 22 with frozen lockfile.
