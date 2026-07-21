# code-story

An AI-augmented code review tool for **human reviewers** — not another bot that reviews for you.

The core idea: classic review tools show a wall of diffs, one file after another. That is almost
never the most efficient order or structure for understanding a change. code-story restructures a
diff/branch/PR so it **reads like a book**: sub-file-level chunks, presented in an order that makes
sense, each with exactly the context it needs — while guaranteeing that 100% of the diff is
covered and that the human stays in charge of judgment.

Key properties (see [docs/requirements/inventory.md](docs/requirements/inventory.md) for the full,
traceable list):

- **Total coverage, adaptive depth** — nothing in the diff is excluded; boring parts start
  collapsed, hard parts get thorough context.
- **Chunks, not files** — methods and smaller pieces, reorderable, allowed to appear in multiple
  narrative locations (marked as "nth occurrence").
- **Diff vs context, unmistakably distinct** — callee bodies and referenced code shown inline,
  with fast navigation into both old and new versions of the codebase.
- **Local AI threads** — the reviewer iterates with *their own* agent (Claude Code or any other
  harness) in threads anchored to code; every AI change is an exact, verifiable patch tied to the
  thread that produced it.
- **Reviewer-first** — progress tracking below file granularity, deferred-clarification items,
  posture that adapts to whether the author is you/your agent or someone else, and explicit
  defenses against "the AI says it's fine" automation bias.
- **Harness-agnostic** — a clean protocol (MCP/ACP/file-based; under evaluation) so any local
  agent can plug in; scripts do everything scripts can do, AI only where it adds value.

## Status

**Runnable — milestones M0–M5 plus the story library are built.** A local daemon + browser "book"
UI: a **story library** to browse/trigger/pick reviews with the exact config and tool version each
was generated with (disk-persisted and repo-synced); tree-sitter sub-file chunking with a
100%-diff-coverage guarantee, deterministic **and** AI chapter ordering (consumer-first,
tests-before by default), a keyboard/mouse review loop with sub-file progress tracking, opt-in AI
narration, called-code context payloads, and a chunk-graph "neighbor strip" for following how
changed chunks call and exercise each other. See **[Try it](#try-it)** below;
`CLAUDE.md` carries the full build history, and
[docs/research/00-synthesis.md](docs/research/00-synthesis.md) +
[ADR 0001](docs/decisions/0001-architecture.md) explain why this shape.

Deliberately **not built yet**: the local BYO-agent verifiable-patch threads and PR versions
(R-038–R-041) are designed, not implemented.

## Try it

Build once, then point code-story at any local git repo + range; it serves a browser "book" of the
change at a printed `http://127.0.0.1:PORT`.

```bash
pnpm install && pnpm build

tools/demo.sh                              # defaults to lexbox PR 2379 (a change with a real call graph)
tools/demo.sh /path/to/your/repo "main~5..main"   # …or any repo + range
```

Open the printed URL and walk the change. What to look for:

- **The library (`☰ Library`).** Every story you generate is listed with the exact options it used
  and the tool version that made it. Start a new review from the form (a range + reading order),
  or open any past story — no need to relaunch the daemon. Stories are saved to disk and (with
  `.code-story.json` `"sync": true`) auto-committed and pushed, so they follow you across
  environments.
- **Self-explanatory config.** Click the range in the top bar for "How this story was generated" —
  every option in plain language, badged 💸 *regenerates* (changing it needs a paid AI re-run) or
  *free*. The same chips appear on each library card. `v1.0.0 → Changelog` shows what each version
  added.
- **Chapters, not files.** The change is grouped into call-path chapters and AI-ordered a few
  seconds after load (the deterministic order shows first; an "AI reading order" badge + one-line
  rationales appear when it applies). 100% of the diff is covered — nothing is skippable.
- **The review loop.** `j`/`k` move, `Enter` marks a chunk reviewed and advances, `?` shows the
  full keymap.
- **The neighbor strip (M5).** On a focused chunk, a strip of its direct graph neighbors (what it
  calls / is called by / tests that exercise it) sits in the header. **Click a chip to jump** there
  (or `g` then arrows/Enter); `b` jumps back. To follow the graph without losing your place, `m`
  marks a chunk reviewed **and stays there** so you can follow its links — the "lawn-mower."
- **Honest frontier.** A live "N cross-chunk interactions still open" count and a done banner that
  says interactions were *surfaced, not verified* — the tool never claims it checked how the pieces
  compose.

Prefer to read, no browser? Export the AI-ordered book as markdown:

```bash
cd /path/to/your/repo
node /path/to/code-story/packages/server/dist/cli.js "main~5..main" --ai-order --order ai --export book.md
# add --narrate for AI narration (opt-in; faithfulness still under evaluation)
```

## Repository layout

- `CLAUDE.md` — orientation + standing learnings for AI sessions working on this repo.
- `docs/vision/` — the vision: [original prompt](docs/vision/original-prompt.md) and
  [addendum](docs/vision/addendum-2026-07-16.md) persisted verbatim for traceability passes,
  plus the [distillation](docs/vision/vision.md).
- `docs/requirements/` — numbered requirements inventory (R-001…R-049) extracted from the vision.
- `docs/research/` — [synthesis](docs/research/00-synthesis.md), landscape (+4 appendices), agent protocols, platform, review science.
- `docs/design/` — design sketches (core primitives: chunks, occurrences, book, patch ledger).
- `docs/decisions/` — ADRs.
- `docs/process/` — [build process](docs/process/build-process.md): spec pipeline, model economy, dogfooding.

## Development

Build once (`pnpm install && pnpm -r build`), then start a daemon on any diff/range:
`node packages/server/dist/cli.js <base>..<head> --port 7357`. To drive the book UI
programmatically (walk latency, mark/unmark round-trips) against a running daemon, use
`node tools/dogfood-walk.mjs --port 7357` (flags: `--walk`, `--marks`, `--headless`).

AI reading order is the default: the daemon runs the ordering job in the background on compile
(spending ~1 min of your Claude plan per range) and applies it on the next book load. The book
always opens immediately in the deterministic tier-0 order and never blocks on the job; if the
job fails (no `claude` CLI, no network) the book simply stays in tier-0 order. Pass
`--no-ai-order` (or set `CODE_STORY_NO_AI_ORDER`) to disable the auto job. `--order tier0`
forces tier-0 order on `--export`.

### Story ordering (chapters)

Two ordering axes (spec 05) are configurable, via CLI flags or a per-repo `.code-story.json`
(top-level or under an `ordering` key; flags win over the file):

- `--direction consumer-first|dependency-first` — `consumer-first` reads a caller before the
  chunks it calls (flow down each call path); `dependency-first` reads callees first.
- `--test-placement before|after|end` — where a test reads relative to the impl it exercises.

The **defaults are `consumer-first` + tests-`before`** (R-043–R-046), which run the **chapter
linearizer**: call-path chapters whose occurrences may span files (cross-file chunks are labelled
`from <file>` in the export and the UI). A diff with no resolvable call edges degrades to
file-grouped git order. Honoured everywhere — the daemon/web, `--export`, and `--check-order`.

Selecting `--direction dependency-first --test-placement after` (or the equivalent
`.code-story.json`) switches to the older **file-section** order (one section per file, dependencies
first). The flip changes the default; it removes nothing (R-025).

```json
{ "ordering": { "direction": "consumer-first", "testPlacement": "before" } }
```
