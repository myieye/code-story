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

Problem-space research complete; architecture ratified; nothing built yet.
Headline findings: **no existing tool occupies this quadrant** (narrative ordering is becoming
table stakes at CodeRabbit/Devin/cubic, but nobody does coverage-guaranteed queues + local
BYO-agent verifiable-patch threads); the accepted shape is a **local daemon + browser "book" UI**
with a hybrid ACP-client / MCP-server / headless-CLI agent layer. See
[docs/research/00-synthesis.md](docs/research/00-synthesis.md) and
[ADR 0001](docs/decisions/0001-architecture.md) (accepted 2026-07-16). Next:
grill→spec→issues per [docs/process/build-process.md](docs/process/build-process.md).

## Repository layout

- `CLAUDE.md` — orientation + standing learnings for AI sessions working on this repo.
- `docs/vision/` — the vision: [original prompt](docs/vision/original-prompt.md) and
  [addendum](docs/vision/addendum-2026-07-16.md) persisted verbatim for traceability passes,
  plus the [distillation](docs/vision/vision.md).
- `docs/requirements/` — numbered requirements inventory (R-001…R-037) extracted from the vision.
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

Anything other than the defaults (`dependency-first`, `after`) switches on the **chapter
linearizer**: call-path chapters whose occurrences may span files (cross-file chunks are labelled
`from <file>` in the export). A diff with no resolvable call edges degrades to file-grouped git
order. `.code-story.json` example:

```json
{ "ordering": { "direction": "consumer-first", "testPlacement": "before" } }
```

The defaults stay today's file-mode behaviour on purpose: `consumer-first` + tests-`before` are
the *intended* defaults (Tim's preferences) but the flip waits on the AI-ordering slice so the
shipped order prompt keeps passing its `--check-order` pre-gate. `--direction` / `--test-placement`
are currently honoured by `--export` and `--check-order`; the daemon/web still serve file mode.
