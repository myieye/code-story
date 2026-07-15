# ADR 0001 — Platform & agent-integration architecture

Status: **proposed** (research-backed recommendation; awaiting Tim's ratification)
Date: 2026-07-15
Basis: [research synthesis](../research/00-synthesis.md), reports [02](../research/02-agent-protocols.md), [03](../research/03-platform.md)

## Decision (proposed)

Build **code-story** as a greenfield, local-first tool:

1. **Shell**: a CLI that starts a **local daemon** and serves a **browser UI**
   (`npx code-story <range|pr>` → localhost). No cloud, no signup. TypeScript/Node.
2. **Book renderer**: CodeMirror 6 (block widgets + `@codemirror/merge` unified view) rendering
   an interleaved narrative of diff chunks, context bodies, and prose; Shiki for static
   snippets. Git line-diffs remain ground truth; **web-tree-sitter** segments and labels them
   (chunking, change-type detection) without sacrificing patch-applicability.
3. **Navigation**: precomputed **SCIP indexes of BASE and HEAD** for instant old+new
   go-to-def/refs (scip-typescript, scip-dotnet cover lexbox); optional live LSP on the working
   tree for the checked-out side.
4. **Manual editing**: the user's own editor via `vscode://file/...:line` deep links (works with
   zero extension); a file watcher folds external edits into the state model as first-class
   ledger entries. A thin VS Code extension may come later as *another client* of the daemon.
5. **Agent integration — hybrid, harness-agnostic**:
   - Bulk context generation: headless subprocesses (`claude -p --output-format stream-json`,
     `codex exec --json`, `gemini -p`) behind a persistent, rate-limit-aware job queue.
   - Interactive threads: the daemon acts as an **ACP client** (claude-agent-acp / codex-acp /
     gemini --experimental-acp / opencode), giving streaming, permission gating, and session
     persistence uniformly.
   - Inbound surface: the daemon exposes an **MCP server** (`get_thread`, `post_comment`,
     `submit_patch`, `wait_for_feedback`) so any harness — including a plain interactive
     session — can participate.
   - Subscription compliance: always through the vendor's own CLI/SDK (Claude adapter is
     Agent-SDK-based → bills Pro/Max legitimately; raw OAuth reuse is banned).
6. **Patch-only AI changes (R-011)**: agent sessions run in ephemeral git worktrees; the only
   code-change channel is `submit_patch` (validated, hashed, linked to its thread). Per-harness
   write-denial (disallowedTools/hooks, ACP permission denial, read-only sandboxes) as extra
   belts. Manual edits stay unrestricted and are recorded as tool-computed deltas.
7. **State**: content-addressed snapshots + a JSON/SQLite store under `.code-story/`
   (gitignored by default; shareable later).

## Alternatives considered

- **VS Code extension as the primary surface** — rejected as primary: the diff editor is not
  extensible (no hunk reordering, no interleaved context; microsoft/vscode#298924), ambitious
  extensions all become webviews anyway, and old-version navigation doesn't work there either.
  Runner-up value preserved via deep links now, thin extension later.
- **Fork difit / pair-review / ReviewStack / hunk** — organs, not a body: each would be mostly
  rewritten (see synthesis §2). We borrow patterns (difit's CLI→web flow, Plannotator's
  multi-harness bridge, CodeTour's step format, Reviewable's reviewed-at-revision semantics).
- **TUI** — wrong surface for UI-heavy diffs (R-019) and the book layout.
- **Zed extension** — no UI surface for extensions; stack-graphs archived.
- **MCP-only or ACP-only integration** — MCP can't drive an agent (sampling deprecated); ACP
  doesn't cover plain interactive sessions or batch economics. Hybrid uses each for what it
  uniquely does.

## Consequences

- We own the hardest UI (the book) with full control; nothing fights us on layout.
- Two SCIP indexes + tree-sitter grammars per language: language support is explicit work
  (C#, TS/Svelte first — lexbox).
- The daemon boundary keeps us editor-agnostic and future-proofs a VS Code/JetBrains client.
- Session-limit resilience must be designed in from day one (persistent queue, resumable jobs).
