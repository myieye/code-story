# Landscape appendix: open-source / local-first review tools

Deep dive supporting [01-landscape.md](01-landscape.md): VS Code PR extension, difftastic, delta,
difit, hunk, pair-review, octorus, prr, gh-dash, Pierre diffs, plus proprietary reviewer-facing
platforms (cubic/mrge, CodeRabbit Review, Reviewable, CodeApprove, Graphite, Baz, SemanticDiff)
and a brief bot survey. All claims dated where evidence was found; anything unconfirmable is
marked **unverified**. Research date: 2026-07-15.

---

## 1. VS Code "GitHub Pull Requests" extension (microsoft/vscode-pull-request-github)

**Repo:** https://github.com/microsoft/vscode-pull-request-github

- **What it does:** Official Microsoft extension for reviewing/managing GitHub PRs inside VS Code: PR list views with custom GitHub-search queries, checkout of PR branches, in-editor review comment threads (synced to GitHub), PR description webview, issue management.
- **Maintenance:** Very active. Latest release **v0.156.0, July 7, 2026**; 173 releases total; ~2.6k stars. Ships monthly in lockstep with VS Code.
- **License:** **MIT**. Tech stack: **TypeScript (~96%)**, VS Code extension APIs, webviews for PR description/overview panels, webpack-bundled; diff review itself uses VS Code's *native* diff editor + the commenting API (not a webview).
- **Review features:** comment threads (create/reply/resolve, synced), **"mark file as viewed"** synced with GitHub's viewed state (long-standing feature, with known rough edges and open issues like folder-level viewed tracking — [#3274](https://github.com/microsoft/vscode-pull-request-github/issues/3274), [#3799](https://github.com/microsoft/vscode-pull-request-github/issues/3799), [#6013](https://github.com/microsoft/vscode-pull-request-github/issues/6013)), checkout PR, suggested changes. Heavy **Copilot integration through 2025–2026**: Copilot-generated PR descriptions (sparkle icon in the description webview), active PR/issue used as implicit chat context, `#openPullRequest` chat tool, managing Copilot coding-agent sessions/notifications from the PR view ([GitHub changelog, June 2026](https://github.blog/changelog/2026-07-08-github-copilot-in-visual-studio-code-june-2026-releases/), [CHANGELOG.md](https://github.com/microsoft/vscode-pull-request-github/blob/main/CHANGELOG.md)).
- **Custom diff/chunk ordering:** **No** — confirmed nothing in changelog/docs. Files appear in a tree/list; diffs open per-file in VS Code's built-in diff editor. There is no notion of sub-file chunk queue, narrative ordering, or cross-file hunk sequencing.
- **Forkability toward the vision — significant platform ceiling.** The core problem is that VS Code's diff editor is *not extensible*: extensions cannot render their own unified diff UI, reorder hunks, or interleave non-diff context into the diff editor. This is a known platform gap — see [microsoft/vscode#298924 "Add support for custom diff editors (proposed API)"](https://github.com/microsoft/vscode/issues/298924) and the Custom Editor API docs: when a diff opens for a custom-editor file type, VS Code shows **two independent webviews** wrapped in a standard DiffEditorInput, so an extension can't build a single unified custom diff surface ([Custom Editor API](https://code.visualstudio.com/api/extension-guides/custom-editors), [Webview API](https://code.visualstudio.com/api/extension-guides/webview)). To get chunk-queue/narrative ordering you'd have to build the entire diff surface as a webview from scratch (losing native editor affordances: go-to-def, minimap, inline suggestions), or fork VS Code itself. The extension *is* a good reference implementation for GitHub review-thread sync, viewed-state APIs, and comment UX, and MIT license makes harvesting that code easy.

---

## 2. Difftastic (Wilfred/difftastic)

**Repo:** https://github.com/Wilfred/difftastic · **Site/manual:** https://difftastic.wilfred.me.uk/

- **What it does:** Structural diff: parses both file versions with **tree-sitter**, diffs the syntax trees (Dijkstra-based graph search over an "unchanged/novel node" state space), so it ignores pure formatting changes and aligns code by syntax rather than lines. 30+ (50+ detected) languages.
- **Maintenance:** Active. Latest release **0.69.0, April 30, 2026**; 51 releases; ~25.6k stars.
- **License:** **MIT** (some vendored tree-sitter grammars Apache-2.0). Rust (~80%).
- **CLI or library?** **CLI-first.** It is published on crates.io, but there is no supported library API; output is explicitly "intended for human consumption." However, there is an **experimental machine-readable JSON output**: `--display json`, gated behind `DFT_UNSTABLE=yes`, emitting a JSON array per file ([CHANGELOG](https://github.com/Wilfred/difftastic/blob/master/CHANGELOG.md), [man page](https://www.mankier.com/1/difft)). No GUI, no plans for one.
- **Vision fit:** Not a competitor — a **component candidate** for the chunking layer: syntax-aware chunk boundaries, detection of "formatting-only" vs semantic changes, and word/node-level alignment. Practical embedding paths: (a) shell out and parse the unstable JSON; (b) fork the Rust crate and expose the internal tree-diff as a library (MIT makes this fine, but the maintainer has kept internals private, so expect to maintain the fork); (c) skip difftastic and use tree-sitter directly for chunk/dependency analysis, treating difftastic as prior art. Related alternative: [diffsitter](https://github.com/afnanenayet/diffsitter) (AST diff, also tree-sitter). Known weaknesses: memory/time blowups on huge files (e.g. [#316](https://github.com/Wilfred/difftastic/issues/316)).

---

## 3. Delta (dandavison/delta)

**Repo:** https://github.com/dandavison/delta

- **What it does:** Syntax-highlighting **terminal pager** for git/diff/grep/blame output: side-by-side view with wrapping, word-level highlights, line numbers, `n`/`N` navigation between files/sections, hyperlinked commit hashes/file paths (terminal hyperlinks into your host or editor).
- **Maintenance:** Active but slower cadence. Latest release **0.19.2, March 28, 2026**; 62 releases; ~31.4k stars ([releases](https://github.com/dandavison/delta/releases)).
- **License:** **MIT**. Rust (~96%).
- **CLI or library?** Standalone CLI/pager configured via `.gitconfig`; **not designed as a library**.
- **Vision fit:** Least relevant of the three named projects. It's a *presentation* layer for line-oriented diffs in a terminal — no chunk model, no review state, no comments, no reordering (it renders what git emits, in order). Useful only as (a) rendering prior art (side-by-side wrapping, word-level emphasis, hyperlink navigation into files) or (b) a downstream renderer if the vision tool ever emits unified-diff text. If building a TUI, **hunk** (below) is a far closer starting point.

---

## 4. Broad landscape: open / local-first reviewer-facing tools (2025–2026)

### 4a. The closest open-source starting points

#### difit (yoshiko-pg/difit) — local GitHub-style diff viewer with AI comment hand-off
https://github.com/yoshiko-pg/difit

- **What:** `npx difit` spins up a **local web server** rendering git diffs (commits, ranges, working tree, stdin patches, and GitHub PRs via `--pr`, including unresolved review threads) in a GitHub-like "Files changed" view. Side-by-side/inline, syntax highlighting (Prism), auto-collapse of lockfiles/generated files. Formerly named **ReviewIt** — renamed to difit in 2025 ([rename note](https://zenn.dev/yoshiko/articles/difit-from-reviewit?locale=en)).
- **AI integration (its signature feature):** line/range comments each get a **"Copy Prompt"** button producing an agent-ready prompt with exact file/line references; "Copy All Prompt" batches all comments for pasting into Claude Code etc. Ships **agent Skills** (`difit`, `difit-review`) so a coding agent can drive/consume reviews ([SKILL.md](https://github.com/yoshiko-pg/difit/blob/main/skills/difit-review/SKILL.md)).
- **Status/stack:** Very active — **v5.0.8, July 11, 2026**, 91 releases, ~3k stars. **MIT.** TypeScript, React 18 + Vite frontend, Express backend, Commander CLI, Vitest. Node ≥21.
- **Vision fit:** Arguably the **best fork base** in this cluster: local-first, web UI, MIT, small modern codebase, already models line-anchored comments and an AI hand-off. Missing everything "queue"-shaped: no sub-file chunking beyond git hunks, file-order display only (no narrative/dependency ordering), no coverage guarantee/progress ledger, comment→agent flow is one-way copy-paste (no local agent execution, no patch-verified AI iterations), no non-diff context display. All of those are additive rather than fights with the architecture.

#### hunk (modem-dev/hunk) — "review-first" terminal diff viewer for agent-authored changesets
https://www.hunk.dev/ · https://github.com/modem-dev/hunk

- **What:** TUI diff viewer explicitly positioned for reviewing **agent-authored changes**: multi-file review stream with sidebar, **inline agent annotations** (AI reasoning rendered beside the relevant code), split/stacked/auto layouts, **watch mode** (auto-refresh as the agent edits the working tree), pager/difftool integration, `--agent-context` workflow mode plus a loadable agent Skill for live agent↔reviewer sessions.
- **Status/stack:** New and hot — **~6.9k stars**, v0.17.0 on **July 7, 2026**, 509 commits. **MIT.** TypeScript on Node 18+, built on **OpenTUI** and **Pierre diffs**. Backed by Modem (modem.dev, an agentic-coding platform) — so watch for roadmap capture by the sponsor.
- **Vision fit:** Closest *conceptual* neighbor in the terminal: it already treats "human reviewing an agent's changeset, with agent commentary inline" as the core loop. No evidence of chunk re-ordering, per-hunk review-state/coverage tracking, or verified-patch AI iterations (unverified — docs don't mention them). If the vision tool were a TUI, this is the fork base; if web-based, it's design prior art plus a proof there's demand (Mitchell Hashimoto endorsement on the homepage).

#### pair-review (in-the-loop-labs/pair-review) — human-in-the-loop AI review web UI, multi-agent
https://github.com/in-the-loop-labs/pair-review

- **What:** **Local web app** ("GitHub-like interface") for keeping a human in the loop over AI coding agents: unified/split diff viewer; **three-level AI analysis** (isolation / file context / codebase context — i.e., per-chunk context payloads in embryo); **"review councils"** running multiple models in parallel; **GitHub PR integration with inline comment sync**; local mode for uncommitted changes; markdown export back to agents; chat panel; **Claude Code plugins** (pair-loop, code-critic, pair-review) and **MCP integration**; headless CI mode.
- **AI backends:** CLI-adapter based and **harness-agnostic in spirit**: Claude (Claude Code), Codex, Copilot, OpenCode, Cursor Agent, Antigravity, Pi, custom models.
- **Status/stack:** Tiny community (**39 stars**) but rapid solo-dev cadence: 90 releases, latest **v5.0.1, July 2026**, 1,273 commits. **Apache-2.0.** Node 22+, Express, SQLite, vanilla-JS frontend, uses **git worktrees**.
- **Vision fit:** The **feature checklist overlaps the vision more than anything else found** — local agent threads, agent-harness-agnostic adapters, per-chunk context levels, GitHub sync. Gaps: no narrative/dependency chunk ordering, no coverage/queue semantics, AI output isn't presented as verifiable patches (unverified), vanilla-JS frontend may be a liability for the ambitious diff UI. Low bus-factor is the main risk; Apache-2.0 makes it harvestable.

#### octorus (ushironoko/octorus) — Rust TUI with AI review↔fix "Rally" cycles
https://github.com/ushironoko/octorus

- **What:** Terminal UI covering GitHub PRs, issues, CI status, local diffs and git ops; tree-sitter syntax highlighting; persistent **local comments**; claims 1M+ diff lines / 6k+ files. **"AI Rally"**: two agents (reviewer + reviewee) iterate automatically until approval, with **Claude Code recommended as the reviewee** ("fine-grained tool control") and Codex CLI supported; a "Review Only Mode" makes the AI propose fixes without touching code.
- **Status/stack:** **MIT**, Rust (+ vendored C), **v0.6.7 released July 15, 2026**, 46 releases, ~220 stars.
- **Vision fit:** Demonstrates the *agent-iterates-while-human-watches* loop with Claude Code specifically, but its Rally is agent-vs-agent rather than reviewer-driven; no chunk ordering/coverage semantics. Good prior art for local comment persistence and Claude Code process control from a review tool.

#### prr (danobi/prr) — mailing-list-style offline PR review
https://github.com/danobi/prr · https://dxuuu.xyz/prr.html

- **What:** Downloads a PR into a plain-text "review file"; you annotate it in your editor (quote-reply style), then `prr submit` posts the inline comments/review to GitHub. Docs: https://doc.dxuuu.xyz/prr/
- **Status:** Alive but low-velocity: commits through **April 2026** (zsh tab completion, Apr 10, 2026), 407 stars. **GPL-2.0** (copyleft — matters if you want to embed rather than fork). Rust.
- **Vision fit:** Marginal as a base, but its **file-as-review-artifact** model is interesting prior art for "painless manual editing" and for making review state diffable/scriptable.

#### gh-dash (dlvhdr/gh-dash) — GitHub TUI dashboard
https://github.com/dlvhdr/gh-dash

- **What:** gh CLI extension: configurable PR/issue dashboards; from the TUI you can **diff, comment, checkout, approve** etc. Recent work includes theming, mouse support, even GitLab support via glab.
- **Status:** **12.1k stars**, **v4.25.2, July 10, 2026** — very active. **MIT**, Go (bubbletea/lipgloss/glamour).
- **Vision fit:** It's PR *triage*, not deep diff review — no sub-file anything. Relevant only as the "queue of PRs" outer shell; the vision's queue is *within* a diff, which gh-dash doesn't model.

#### Smaller/adjacent OSS
- **gh-pr-review** (https://github.com/agynio/gh-pr-review): gh CLI extension for full inline review-thread support in terminal; self-described "LLM-ready," aimed at automated review agents.
- **reviewd** (https://github.com/simion/reviewd): terminal AI PR reviewer that drives **Claude Code / Gemini / Codex CLIs** against GitHub/Bitbucket PRs with approval gates — bot-shaped (AI reviews, human configures), not a reviewer UI.
- **Pierre "Diffs"** (https://diffs.com/, https://github.com/pierrecomputer/pierre): the **open-source React diff-rendering component** from Pierre (YC git-platform startup, public beta March 2025, "realtime code review," AI branch summaries — https://docs.pierre.co/reviews). `@pierre/diffs` renders git diffs/patches or any two files; it's what **hunk** builds on. A strong candidate **rendering component** for a web-based build. (License of the component: repo says open source; exact SPDX license unverified.)
- **local-ai-pr-reviewer** (https://github.com/jaygaha/local-ai-pr-reviewer): Ollama/Docker local-LLM diff reviewer — privacy-first bot, no reviewer UI.

### 4b. Proprietary human-reviewer platforms (validating the vision)

#### cubic (formerly mrge, YC X25) — the closest commercial embodiment of "narrative ordering"
https://www.cubic.dev/ · docs: https://mrge.mintlify.app/code-review-platform/reviewing-prs · HN launch (as mrge): https://news.ycombinator.com/item?id=43692476

- "Cursor for code review": web review platform + AI reviewer. **mrge rebranded to cubic** (mrge.io now serves cubic pages; YC profile: https://www.ycombinator.com/companies/cubic).
- **Human-reviewer UI features directly on-vision:** **intelligent diff ordering** — "AI groups related changes together and orders them logically" instead of alphabetically, in the Changes-tab sidebar; architecture-change diagrams; **per-push version snapshots** so you review only what changed since your last pass (a form of incremental coverage); outdated-comment detection; 2-way GitHub comment sync; keyboard-first navigation; `suggestion` blocks rendered as clickable patches; Cmd+Enter AI-generated suggestions.
- Pricing: free 20 PRs/mo; Team $30/dev/mo; Pro $79; free for OSS. Proprietary/SaaS — **not forkable**, but the single best proof that "logical diff ordering for the human reviewer" is a real, funded product direction.

#### CodeRabbit "Review" — cohorts & layers reading order
https://www.coderabbit.ai/blog/coderabbit-review-reads-a-pr-how-author-would-explain-it · https://docs.coderabbit.ai/pr-reviews/coderabbit-review

- Beyond its well-known bot, CodeRabbit shipped a **human-reviewer-facing review surface** layered on GitHub/GitLab: PRs are reorganized into **"cohorts"** (semantic groupings of related hunks) broken into **dependency-ordered "layers"** — schema → business logic → call sites → UI → tests — i.e., precisely the "reads like a book" ordering, with per-cohort summaries/diagrams, **Code Peek** (click a symbol to see its definition inline — the vision's "non-diff context display"), concept search across block summaries, chat agent, severity labels, and comments that round-trip to exact diff lines. Proprietary. Their **VS Code/Cursor/Windsurf extension** (free tier, launched May 2025) reviews commits pre-PR with one-click fixes ([blog](https://www.coderabbit.ai/blog/ai-code-reviews-vscode-cursor-windsurf), [ADTmag, May 2025](https://adtmag.com/articles/2025/05/16/coderabbit-adds-free-ai-code-reviews-inside-vs-code.aspx)).
- **Takeaway:** the two heaviest-funded review companies (CodeRabbit, cubic) both converged on sub-file semantic grouping + dependency-ordered walkthroughs in 2025–2026 — the vision's core bet, but **neither offers coverage-guarantee queue semantics nor local-agent comment threads**, and both are closed SaaS.

#### Reviewable.io — the reference for sub-file progress tracking
https://reviewable.io/ · https://docs.reviewable.io/files

- Long-lived GitHub-attached review UI whose core is **tracking reviewed state per file, per revision, per reviewer** (red/green markers, "review this diff" prompts), revision-to-revision diffs, revision compaction (release 2025-01-31), merge-queue/rulesets support. Still actively updated through 2025 ([changelog](https://github.com/Reviewable/Reviewable/blob/master/CHANGELOG.md)). Proprietary (source-available config repo only). Granularity is per-file, not per-chunk — the vision goes one level deeper — but its state model (reviewed *at revision X*) is the best-documented prior art for review-progress semantics.

#### CodeApprove — Critique-for-GitHub
https://codeapprove.com/ — built by Sam Stern as a nights/weekends product inspired by Google's internal review tooling (Critique): attention sets, better diffs, resolved-thread discipline. Mentioned as alive in the July 2025 HN thread ["Ask HN: What's your 2025 code review workflow?"](https://news.ycombinator.com/item?id=44583146). Current maintenance level **unverified** (marketing site is a JS app; founder now at Retool per LinkedIn).

#### Graphite — stacked PRs + AI
https://graphite.com/ — see [01b appendix](01b-landscape-stacked-pr-tools.md) for the full profile.

#### Baz — pivoted upstream
https://baz.ai/ — started as AI code review for humans ($8M seed 2024); ranked #1 precision on Code Review Bench (Feb 2026); in **June 2026** extended seed to **$17M** and launched **Baz Planner**, shifting focus from reviewing finished code to reviewing *plans* pre-code with a four-agent architecture ([SiliconANGLE, 2026-06-29](https://siliconangle.com/2026/06/29/exclusive-agentic-coding-startup-baz-brings-code-reviews-planning-stage-extends-seed-funding-17m/)). Reviewer-facing diff UI not its center of gravity anymore.

#### SemanticDiff & DiffLens — semantic-diff components with UIs
- **SemanticDiff** (https://semanticdiff.com/, Sysmagine GmbH): language-aware diff as **free VS Code extension + GitHub app**; hides no-op/formatting changes, detects moved code, separates refactorings; 14+ languages. Proprietary. Relevant as change-type-detection prior art (what the vision's chunker should classify).
- **DiffLens** (https://www.difflens.com/, [VS Marketplace](https://marketplace.visualstudio.com/items?itemName=DiffLens.difflens)): AST-based semantic diffs for TS/JS/CSS as GitHub app/VS Code extension. Niche; activity level 2025+ **unverified**.
- Also seen in the HN thread: **Codelantis** (https://www.codelantis.com/), **CodePeer** (https://codepeer.com/) — smaller commercial GitHub-review UIs, not investigated deeply.

### 4c. Bots (brief)

The AI-reviewer-bot field — **CodeRabbit (bot), Greptile** ($25M Series A led by Benchmark, Sept 2025; v3 agent rewrite; reviews PRs from humans or agents — [blog](https://www.greptile.com/blog/series-a)), **Cursor Bugbot** (paid Pro/Teams feature; June 2026 update cut reviews to ~90s; fixes open in Cursor — [cursor.com/bugbot](https://cursor.com/bugbot)), **Qodo Merge / PR-Agent** (open-source core), **Ellipsis, Korbit, Kody/Kodus, what-the-diff** (AI PR descriptions), **Unblocked** (codebase Q&A/context, not a reviewer), Vercel Labs' **OpenReview**, Cloudflare's internal [orchestrated AI review](https://blog.cloudflare.com/ai-code-review/), and **Anthropic's own Claude Code "Code Review"** (research preview: fleet of specialized agents posts inline PR findings; `/code-review` runs the same locally — [docs](https://code.claude.com/docs/en/code-review)) — is crowded and mostly orthogonal to the vision: they *produce* review comments rather than help a human consume a diff. Human-reviewer-facing features worth singling out: **Qodo Merge's `/describe`** generates a file-by-file **code walkthrough** plus an optional **Mermaid diagram** of how changes connect, posted for the human reviewer ([docs](https://qodo-merge-docs.qodo.ai/)); **CodeRabbit's** cohort/layer walkthrough, sequence diagrams and Code Peek (§4b); **cubic's** diagrams + diff ordering (§4b). Note PR-Agent's open-source lineage is now messy (forks like [The-PR-Agent/pr-agent](https://github.com/The-PR-Agent/pr-agent) distancing from Qodo's free tier).

---

## Synthesis vs. the vision

| Vision property | Best existing coverage | Open-source? |
|---|---|---|
| Sub-file chunking, narrative/dependency ordering | CodeRabbit cohorts+layers; cubic intelligent ordering | No (both SaaS). **No OSS tool found does this** — greenfield differentiator. Academic support: [arXiv 2506.10654](https://arxiv.org/pdf/2506.10654) (mining meaningful review orders) |
| 100% coverage / queue semantics | Nothing found does per-chunk coverage. Nearest: Reviewable per-file-per-revision state; cubic per-push snapshots; GHPR/GitHub "viewed" flags | Partially (viewed-state code in MIT vscode extension) |
| Non-diff context shown distinct from diff | CodeRabbit Code Peek; IDE-based review gets it "free" | pair-review's 3-level context is a crude OSS analog |
| Local AI comment threads with reviewer's own agent | **pair-review** (Claude Code plugins, MCP, councils); octorus AI Rally; difit copy-prompt; hunk inline agent annotations | Yes — all four |
| AI iterations as exact verifiable patches | GitHub `suggestion` blocks / cubic clickable patches are the weak existing form; nobody shows agent iterations as verified patches | No one — greenfield |
| Agent-harness agnostic | pair-review (CLI adapters), reviewd, difit (prompt-based) | Yes |
| Fast old/new version navigation | IDE tools (VS Code ext) strongest; delta hyperlinks in terminal | Yes |

**Fork-base shortlist:** **difit** (MIT, React/Express, local web, AI hand-off already, 3k stars) as the pragmatic web base; **pair-review** (Apache-2.0) as the closest feature match to raid or join; **hunk** (MIT, OpenTUI + `@pierre/diffs`) if terminal-first; **difftastic/tree-sitter** as the chunking/change-classification engine (via unstable JSON or a maintained fork). The VS Code extension route is capped by the non-extensible diff editor (vscode#298924) unless the whole diff surface is rebuilt as a webview.
