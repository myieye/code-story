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

Problem-space research and spec groundwork. Nothing built yet.

## Repository layout

- `docs/vision/` — the vision, including the [original prompt persisted verbatim](docs/vision/original-prompt.md) for traceability passes.
- `docs/requirements/` — numbered requirements inventory extracted from the vision.
- `docs/research/` — landscape, protocol, platform, and review-science research reports.
- `docs/decisions/` — architecture/product decisions as they get made.
