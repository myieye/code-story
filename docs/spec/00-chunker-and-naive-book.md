# Spec 00 — Milestone 0: chunker + naive book

Status: draft — awaiting Tim's review
Date: 2026-07-16
Satisfies: R-001, R-002, R-003 (identity across head moves deferred), R-005 (partial: linear
book + machine-assessable export; AI ordering deferred), R-014 (partial: state for a fixed head;
re-open-on-change deferred), R-027, R-037 (review state lives in the per-repo data home).
Upholds throughout: R-024 (this milestone is the scripts-only floor — zero AI calls), R-025
(architecture repo-agnostic; grammars C#/TS/Svelte first, per lexbox).

## Goal

One command on a local clone turns a diff into a coverage-complete, AI-free book in the browser:

```
code-story <base>..<head>   # in the repo to review
```

→ daemon on a free port → browser opens → the book: tree-sitter chunks grouped by file in git's
file order, each rendered as a CodeMirror 6 unified merge block. The reviewer walks the queue,
marks chunks reviewed, and finishes when it's empty — nothing skippable by construction. An
export writes the book as markdown for the chunking-quality eval.

Why this slice first: chunking quality is the critical path (R-034) — this produces real chunk
output on real lexbox PRs as fast as possible, while standing up the render stack everything
later lives in.

## Non-goals (M0)

- No AI calls of any kind. No reading-order intelligence (file order only), no prose, no context
  payloads, no narration.
- No old/new code navigation (R-007) — no SCIP indexes yet.
- No threads, patches, or editing (R-010–R-013, R-015, R-035).
- No chunk identity across head movement: if the head changes, M0 starts a fresh review.
- No GitHub PR ingestion — a local range covers dogfooding (check out the PR branch).

## Architecture (from ADR 0001 / ADR 0002)

pnpm workspace, strict TypeScript throughout, Node LTS, vitest:

- **packages/core** — pure logic, no IO: chunk model, hunk∩tree intersection, book compile,
  coverage invariant, markdown export. (The eval loop and any future client depend on core
  staying pure.)
- **packages/server** — the daemon: git IO (diff, base/head file contents), tree-sitter runtime,
  HTTP + WebSocket API, serves the built web app, owns the data home
  (`~/.code-story/<repo-id>/`). Its bin entry is the CLI.
- **packages/web** — React SPA (ADR 0002): the book UI.

## Chunking

Input: `git diff <base>..<head>` hunks, plus file contents on both sides.

1. Parse each changed file with web-tree-sitter — grammars: C#, TypeScript, Svelte (markup
   grammar + embedded TS). Head side normally; base side for pure deletions. Unparseable or
   non-code files fall back to whole-hunk chunks (`kind: config | other`).
2. Intersect hunks with the syntax tree (primitives sketch §1): a hunk inside one
   method/function/property → one chunk; a hunk spanning declarations → split at declaration
   boundaries; a method with more than N changed lines (start N=40, tunable) → labeled
   fragments.
3. `changeTypes` in M0 are script-detectable only (R-024): `generated` via path/content patterns
   (lockfiles, `*.g.cs`, migration snapshots, minified assets), `markup-region` for Svelte
   template chunks.
4. Chunk id: file + symbol path + fingerprint of normalized changed lines — stable across
   re-runs on the same head (all M0 needs).

**Coverage invariant (R-001), enforced twice**: by construction — the book compiler ends with a
leftovers section claiming any line no chunk claimed; and by test — a property test asserting
`union(chunks) == diff` with no overlapping primary occurrences, run on fixtures and on a real
lexbox diff.

## Book compile (naive)

Sections = changed files in git order; every chunk gets exactly one `role: primary` occurrence;
leftovers section last (usually empty). Output is the Book JSON of primitives sketch §3 — this
schema is the contract M1's AI ordering plugs into: M1 replaces the ordering step of the
compiler and nothing else.

## Review state

Primitives sketch §6, restricted to M0 needs: `unseen | seen | reviewed` (`seen` is automatic
viewport-based tracking that never counts toward coverage — spec 00a), plus a collapsed flag for
low-signal chunks (R-002) and the resume position. Persisted as JSON at
`~/.code-story/<repo-id>/reviews/<review-id>.json` (R-037's home — the content-addressed store
arrives with the patch ledger), keyed by chunk id + head SHA. Survives daemon restart.

## Export (the eval hook)

`code-story <range> --export book.md` and an export control in the UI: the full book as
markdown — section headings, chunk metadata (file, symbol path, kind, size), fenced diffs. This
is R-005's machine-assessable artifact and the input to the R-034 chunking-quality eval; the
first dogfood session records a baseline score.

## Web UI

Specified in [spec 00a](00a-book-ui.md) (ux-expert pass, R-029). Headlines: continuous
virtualized scroll with a keyboard reading cursor (not a pager); explicit-keystroke marking only
(`Enter` = mark & advance; never on scroll); reviewed chunks stay expanded and dim, they don't
disappear; left outline sidebar is the queue; low-signal stubs require explicit acknowledgment —
batchable per enumerated group — resolving R-001's "what counts as handled" question; the done
state states coverage facts, never approval (R-026).

## Acceptance (milestone demo)

On a real lexbox PR branch:

1. `code-story origin/develop..HEAD` opens the book in <10s for a mid-size PR, cold parse
   included.
2. Every changed line is visible in exactly one chunk; the invariant test proves it.
3. A keyboard-only pass works end to end: walk, mark, reach the queue-empty done state; state
   survives a daemon restart.
4. Lockfile/generated chunks start collapsed, count toward progress, and are expandable.
5. The export is a readable markdown book; a readability/chunk-quality baseline is recorded.
6. Navigation and marking feel instant; a 300+ chunk book scrolls smoothly.

## Implementation slices (→ GitHub issues, blocking edges in parentheses)

1. **Scaffold** — pnpm monorepo (core/server/web), strict TS, vitest, React+Vite, CI
   (build+test). Demo: `code-story` serves a hello page. (blocks all)
2. **Diff ingestion** — range → files + hunks + base/head content access. Demo: JSON dump for a
   real lexbox diff. (needs 1)
3. **Tree-sitter chunker** — hunks∩tree for C#/TS/Svelte, kinds, fragments, coverage invariant +
   property tests. Demo: chunk listing with symbol paths on a real diff. (needs 2)
4. **Naive book + export** — Book JSON, leftovers section, markdown export. Demo: exported book
   from a real PR. (needs 3)
5. **Book UI** — React shell + virtualized CM6 merge blocks rendering the book read-only. Demo:
   scroll a real lexbox PR's book. (needs 1, 4)
6. **Review loop** — reviewed-state interaction per UX spec, queue/progress, persistence, done
   state. Demo: the full acceptance flow. (needs 5)
7. **Low-signal collapse** — generated/lockfile detection, collapsed-stub presentation and
   acknowledgment per UX spec. (needs 3, 6)
8. **Dogfood 0 + eval baseline** — review a real lexbox PR with the tool; file `dogfood` issues;
   score the export baseline. (needs 6, 7)
