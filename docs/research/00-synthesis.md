# Research synthesis — answers to the founding questions

Distilled from [01](01-landscape.md) (+[a](01a-landscape-forge-review-tools.md)/[b](01b-landscape-stacked-pr-tools.md)/[c](01c-landscape-local-oss-tools.md)/[d](01d-landscape-review-uis-github.md)), [02](02-agent-protocols.md), [03](03-platform.md), [04](04-review-science-and-leads.md). Researched 2026-07-15.

## 1. Does it already exist? **No — and the timing is validated.**

- The **bot** category ("AI reviews for you") is crowded and well-funded (CodeRabbit, Greptile,
  Copilot code review, Cursor Bugbot, Qodo…). It is the *opposite pole* from this vision:
  confidence-filtered findings are by design silent exclusion.
- **Narrative ordering (our R-005) is being validated in real time**: Devin Review, CodeRabbit
  Atlas ("cohorts"→dependency-ordered "layers"), cubic (ex-mrge), Stage/Haystack all shipped
  sub-file grouping/ordering in 2025–26. We'd be late to that *alone* — it is table stakes, not
  the moat.
- **Nobody anywhere** combines it with: a coverage-guaranteed queue (R-001), local BYO-agent
  threads with verifiable patch iterations (R-010/R-011), sub-file progress + deferred questions
  (R-014/R-015), reviewer-controlled context payloads (R-008), change-type-driven presentation
  (R-018/R-019), calibration (R-017/R-020), or instruction-file write-back (R-021). Best single
  competitor scores ≈ 4 of 14 vision properties; all closed, all cloud, all with a locked-in
  agent (CodeRabbit→theirs, Devin→Devin, Bugbot/Graphite→Cursor).
- The empty, defensible quadrant: **human-empowering + local-first + harness-agnostic +
  coverage-guaranteed**. Every funded player is structurally unable to follow (their agent *is*
  the product; ours is pluggable).
- Independent market validation: the Forgejo community studied a Gerrit-style review UI and
  concluded a **standalone forge-agnostic review tool** is the right vehicle (Forgejo discussion
  #325); LinearB 2026: agentic-AI PRs have 5.3× longer pickup time.

## 2. Fork or greenfield? **Greenfield shell, borrowed organs.**

No project has the soul (chunk queue, patch ledger); several have organs worth lifting:
- **difit** (MIT, local web review server + agent prompt bridge) — closest architecture; we'd
  rewrite most of it, which is the argument for greenfield at little extra cost.
- **Plannotator** (Apache-2.0) — the only shipped harness-agnostic local feedback loop (5
  harnesses); study/lift its agent-integration layer.
- **hunk** (MIT) — reference for a live agent↔session channel + skill packaging.
- **CodeTour's `.tour` JSON** — prior art for an ordered-step narrative data model.
- **Reviewable's semantics** (reviewed-at-revision-N, base-only-change detection, deferred
  counters) — the state-model reference, one level coarser than ours.
- **@pierre/diffs**, **CodeMirror 6 (`@codemirror/merge`)**, **web-tree-sitter**, **SCIP
  indexers** — component candidates (see [03](03-platform.md)).

## 3. VS Code extension or web app? **Local daemon + browser UI; editor handoff.**

VS Code cannot draw the product: diff editors compose whole file-pairs only — no hunk reordering,
no interleaved non-diff context, no sub-file narrative. Every ambitious extension (GitHub PRs,
GitLens, Sapling ISL) retreats to webviews — a web app inside VS Code with its constraints but
without its editors. And VS Code's trump card, code navigation, only works on the checked-out
version anyway — old-version go-to-def doesn't exist there either. So:

- **Core**: a local daemon (indexer + agent orchestrator + state store) serving a browser UI —
  the proven `sl web`/opencode/difit pattern.
- **Rendering**: CodeMirror 6 block widgets + unified merge view for interleaving diff, context
  bodies, and prose in one scrollable book; Shiki for static snippets; web-tree-sitter for
  chunking (git line-diffs stay ground truth — full structural diffing sacrifices
  patch-applicability, which R-011 can't give up).
- **Navigation**: SCIP indexes of BASE and HEAD (scip-typescript, scip-dotnet) for instant
  symmetric old+new def/refs; warm live LSPs on the working tree.
- **Manual editing** (R-012): `vscode://file/...:line` deep links (zero extension needed) +
  file-watching so external edits flow into the state model; a thin VS Code extension later is
  just another client of the daemon. Zed is not viable as a host (no UI surface for extensions).

## 4. How do we stay harness-agnostic on a Claude subscription? **Hybrid protocol stack.**

(Details in [02](02-agent-protocols.md) §7.)
- **Bulk context generation** → headless subprocesses (`claude -p --output-format stream-json`,
  `codex exec --json`, `gemini -p`) behind a rate-limit-aware disk queue. Subscription billing is
  sanctioned only *through* the vendor's own CLI/SDK (raw OAuth token reuse is banned and blocked
  since Feb 2026).
- **Interactive threads** → our tool as an **ACP client** (Agent Client Protocol): streamed
  replies/tool-calls, client-side permission gating, session persistence — uniform across Claude
  (`claude-agent-acp`, Agent-SDK-based → subscription billing), Codex, Gemini, opencode.
- **Universal inbound surface** → our own **MCP server**: `get_thread`, `post_comment`,
  `submit_patch(diff)` — works even from a plain interactive session of any harness.
- **Patch-only enforcement (R-011)** → ephemeral git worktree per session as the universal
  backstop (only `git diff` leaves), plus per-harness belts (ACP write-denial, Claude
  `disallowedTools`+hooks, Codex read-only sandbox).
- **"lavish-axi" identified**: kunchenguid/lavish-axi, an "Agent eXperience Interface" — agent
  writes an HTML artifact, a localhost server injects annotation UI, the human queues feedback,
  the agent picks it up via a blocking `poll` CLI run inside its own session. Its lesson: the
  agent's own shell tool is a universally available transport (our MCP `wait_for_feedback`
  long-poll covers the same trick more cleanly).

## 5. What the science says (build these in, with sources — [04](04-review-science-and-leads.md))

Order for comprehension (only 10.2% of 1,355 devs endorse alphabetical; +23% review comments from
reordering); decompose tangled changes (>40% auto-partitionable); pace sessions (~200–400 LOC,
≤60–90 min); track coverage at hunk level (unreviewed code ships more defects); answer "why/is
this right/what's connected" *in place*; **design against anchoring** — LLM pre-review flags
narrow expert attention and save no time, so separate comprehension mode from findings mode and
reveal flags after the chunk is read; calibrate trust in both directions (state what the AI did
NOT check); per-hunk repo-relative risk beats file-type priors; verify before compressing
("diluted" UI code framing has only proxy support — collapse by verified per-hunk risk, not file
type); multiple review lenses with the human as accountable gatekeeper.

## 6. The "Matt" lead → **Matt Pocock, `mattpocock/skills`** (~48k★)

Contains exactly the remembered pipeline: `grill-with-docs` → `to-spec` → `prd-to-issues` /
`to-tickets` (vertical-slice GitHub issues with blocking edges) → `implement` / `triage`.
Runners-up if misremembered: Jesse Vincent's Superpowers; Geoffrey Huntley's Ralph loop (Pocock
runs the AI Hero Ralph workshop — plausibly the memory's source). Recommendation: adopt the
spec→vertical-slice-issues pipeline with human-in-the-loop implementation per issue (not a fully
autonomous loop — this product's UX needs taste), and dogfood every agent PR through the tool
itself.

## 7. Strategic risks to respect

1. **"GitHub has gravity"** — a second review surface must be near-zero-friction (`npx …` against
   any branch/PR, no server, no signup).
2. **Anchoring/automation bias** is documented — the anti-persuasion stance (R-026) is a design
   requirement, not a slogan.
3. **Solo review-layer products die** (Crocodile) or stall (CodeApprove); local-first OSS +
   subscription-powered agents avoids their SaaS cost structure.
4. **Session/usage limits are real** (we hit one during this very research) — the bulk queue must
   persist and resume across limit windows.
