# Landscape appendix: stacked-PR tooling & Meta's ReviewStack

Deep dive supporting [01-landscape.md](01-landscape.md): Graphite, ReviewStack, Sapling/ISL,
ghstack, Aviator/av, spr. Researched July 2026.

Compared against the vision: an AI-augmented diff/PR review tool for the **human reviewer** —
sub-file chunking with narrative ordering, 100% coverage queue semantics, non-diff context
display, fast old/new navigation, **local** AI comment threads (reviewer iterates with their own
agent, e.g. Claude Code, shown as verifiable patches), per-chunk context payloads, sub-file
progress tracking, agent-harness agnostic.

---

## 1. Graphite (graphite.dev → graphite.com)

**What it is.** The market-leading stacked-PR platform for GitHub: a CLI (`gt`) for creating/restacking stacks, a web app with a PR **review inbox**, its own diff viewer, a stack-aware **merge queue**, and (since 2025) AI code review. Site: https://graphite.com, review docs: https://graphite.com/docs/review-pull-requests, features: https://graphite.com/features.

**Review UI specifics.**
- **Inbox/queue semantics at PR granularity**: a unified inbox of PRs needing your review, with customizable sections and filters (author, CI status, labels, review state). Queue semantics exist *between* PRs, not *within* a diff.
- **Diff viewer**: file diffs, **version history** (comparing PR iterations across force-pushes), comments, CI status in one interface; comments allowed on unchanged lines; right-side timeline tray; Focus Mode.
- **Keyboard-driven**: heavily keyboard-shortcut oriented (`S` = stack view to hop between PRs in a stack, `F` = file tree of changed files); reviewers review bottom-of-stack upward and advance to the next PR.
- Per-file "viewed" tracking and sub-file progress: **not documented** in their review docs — per-file viewed likely mirrors GitHub, sub-file progress does not exist (unverified for the former, confident for the latter).

**Diamond / Graphite Agent — bot or reviewer-assist?** Diamond (launched Mar 17, 2025) is fundamentally a **bot-reviewer**: it automatically posts "instant, high-signal feedback on every pull request" with one-click suggested fixes — i.e., an author-side/automated first-pass reviewer, with some reviewer-assist framing (comment filtering, codebase-aware context) ([launch post](https://graphite.com/blog/series-b-diamond-launch), [product page](https://diamond.graphite.dev/)). On **Oct 7, 2025** Diamond was folded into **"Graphite Agent"** — AI review + conversational chat that can fix issues, update PRs, and merge ([announcement](https://graphite.com/blog/introducing-graphite-agent-and-pricing)). The AI is **Graphite's hosted agent**, not the reviewer's own local agent — the opposite of the vision's "bring your own harness" model. No exact-verifiable-patch semantics; fixes are applied server-side to the PR.

**Pricing (post-Oct 2025).** Hobby free (individuals); Starter $20/user/mo (stacking + limited Agent); Team $40/user/mo (unlimited AI reviews/chat, stacking, merge queue). Previously Diamond was $15/contributor/mo as an add-on ($20 standalone), free ≤100 PRs/mo. Existing customers migrate to Team at first renewal after Jan 8, 2026.

**Open-source status.** Closed. The CLI was open source until **July 14, 2023**, when development moved into Graphite's private monorepo; [withgraphite/graphite-cli](https://github.com/withgraphite/graphite-cli) is archived (npm distribution continues). Community forks exist: [charcoal](https://github.com/danerwilliams/charcoal), [freephite](https://github.com/agrinman/freephite). The web review app was never open source. **Forkability toward the vision: none.**

**News 2025–2026 (verified).**
- **$52M Series B** led by Accel, Mar 2025, with **Anthropic's Anthology Fund** (Menlo), Shopify Ventures, Figma Ventures, a16z; ~$72M total raised; ~$290M valuation ([blog](https://graphite.com/blog/series-b-diamond-launch), [Contrary Research](https://research.contrary.com/company/graphite)).
- **Acquired by Cursor (Anysphere) — Dec 19, 2025**, reportedly well above the $290M valuation, cash + equity; Cursor plans to keep Graphite as a standalone product ([TechCrunch](https://techcrunch.com/2025/12/19/cursor-continues-acquisition-spree-with-graphite-deal/), [Fortune](https://fortune.com/2025/12/19/cursor-ai-coding-startup-graphite-competition-heats-up/), [SiliconANGLE](https://siliconangle.com/2025/12/19/cursor-acquires-ai-code-review-startup-graphite/)). So the "Anthropic partnership" is investment-level only; the strategic owner is now **Cursor** — an acquisition, not a rumor.

**Vs the vision.** Graphite is the closest commercial analog in *spirit* (review-queue ergonomics, keyboard-driven, versioned diffs, stack ordering = coarse narrative ordering at PR level) but: no sub-file chunking or narrative ordering within a diff; no 100%-coverage guarantee/chunk queue; no non-diff context panes; AI is a hosted bot, not local-agent threads; no per-chunk context payloads; closed-source, and its roadmap now serves Cursor's ecosystem.

---

## 2. Meta ReviewStack (reviewstack.dev)

**What it is.** "A novel user interface for GitHub pull requests with custom support for **stacked changes**" — a purely client-side React SPA: swap `github.com` → `reviewstack.dev` in any PR URL. Recognizes stacks made by `sl pr submit`, `sl ghstack`, or standalone ghstack; provides a stack-navigation dropdown, and — its signature feature — **Sapling/Phabricator-style versioned diffs**: a dropdown to view each submitted version of a PR and diff *between versions*, showing only the code meant for review in each PR of the stack. Docs: https://sapling-scm.com/docs/addons/reviewstack/, app: https://reviewstack.dev/.

**Location & license (verified directly).** It **moved** on Feb 12, 2024 from `addons/reviewstack` to **`eden/contrib/reviewstack/`** in [facebook/sapling](https://github.com/facebook/sapling) (commit 8bc196d: "move reviewstack to a different npm workspace" — it had diverged from ISL's toolchain). Old path 404s; check https://github.com/facebook/sapling/tree/main/eden/contrib/reviewstack. **License: MIT** — dedicated MIT LICENSE files ("Copyright (c) Meta Platforms, Inc.") were added to reviewstack and reviewstack.dev on **Apr 14, 2026**; the sapling repo's top-level license is GPL-2.0, and the `addons/` tree (ISL) also carries its own MIT LICENSE. So ReviewStack is **cleanly MIT, not GPL** — verified from the LICENSE files themselves.

**Maintained? Yes — surprisingly active in 2026.** Commits touching `eden/contrib/reviewstack`: **Apr 19, 2026** (Primer TS fix), Apr 14, 2026 (LICENSE), Feb 12, 2026 (eslint upgrades), Feb 10, 2026 (review-UX improvements: sticky file headers, don't copy line numbers from diffs) — https://github.com/facebook/sapling/commits/main/eden/contrib/reviewstack. The [reviewstack.dev deploy workflow](https://github.com/facebook/sapling/actions/workflows/reviewstack.dev-deploy.yml) runs on a schedule (683+ runs, recent successes), and reviewstack.dev is live (serves the SPA). Caveat: activity is maintenance/UX-polish grade, not feature development; it remains a "demonstration" UI.

**Tech stack (verified from package.json).** React 18, **Jotai** (migrated off Recoil), GitHub's **Primer React** design system, **Monaco editor** for diff rendering, `graphql-codegen` against **GitHub's GraphQL API**, Create-React-App-era build scripts, TypeScript 4.x. Entirely client-side: GitHub token via Netlify OAuth, data cached in `localStorage`/`indexedDB`, **no server component**.

**Forkability toward the vision: the best raw material in this cluster.** MIT-licensed, no backend, already implements versioned diffs, old/new version navigation, stack ordering, and a Monaco-based diff viewer against GitHub's GraphQL API. Gaps to build: sub-file chunk model + queue/coverage semantics (its diff is file-oriented), narrative/dependency ordering, non-diff context panes (Monaco makes go-to-definition plausible), any notion of review progress, and the entire local-agent-thread layer (client-side-only architecture is actually convenient here — a local agent bridge could run beside it). Risks: aging toolchain (CRA-style build, TS 4.5), duplicated-from-ISL shared code, and Meta could stop maintaining it at any time.

---

## 3. Sapling SCM — broader review tooling (ISL)

**What it is.** Meta's Git-compatible SCM ([facebook/sapling](https://github.com/facebook/sapling)). **Interactive Smartlog (ISL)** is its web UI (`sl web`) and VS Code extension: a graphical commit tree with drag-and-drop rebase, uncommit/amend, and PR status per commit — an *authoring/stack-management* UI, not a review UI ([docs](https://sapling-scm.com/docs/addons/isl/), [VS Code extension](https://marketplace.visualstudio.com/items?itemName=meta.sapling-scm)). **PR submit workflow**: `sl pr submit` creates one GitHub PR per commit in the stack (with an alternative `sl ghstack` mode); ReviewStack is the companion for *reviewing* those stacks.

**Maintenance.** Very active: ~29 commits to main in the 3 days before 2026-07-15 (Meta code-sync). But **GitHub releases are rare** — 0.2.20250521 (May 2025), 0.2.20260317 (Mar 2026), 0.2.20260522 (May 2026) — the open-source packaging is a second-class citizen relative to internal development ([releases](https://github.com/facebook/sapling/releases)).

**License.** Top-level repo: **GPL-2.0** (Mercurial heritage — verified from the LICENSE file). The `addons/` tree (ISL, ISL server, VS Code extension) has its **own MIT LICENSE**. So: SCM core GPL-2, web UIs MIT.

**Tech stack (ISL).** React **19**, **Jotai**, **Vite**, TypeScript 5.5, vscode-textmate/oniguruma for highlighting, Jest — a modern, healthy codebase (verified from `addons/isl/package.json`).

**Vs the vision.** ISL isn't a review tool; its relevance is (a) the commit-per-review data model, (b) MIT React components adjacent to ReviewStack, (c) proof that a local web server + browser UI over repo state (exactly the architecture the vision needs for "local agent" integration) works well.

---

## 4. ghstack (ezyang/ghstack)

**What it is.** CLI that submits each commit of a local stack as a separate GitHub PR (using orig/base/head branch triplets); the tool PyTorch's workflow made famous. https://github.com/ezyang/ghstack

**Status.** Maintained: latest release **v0.14.0, Dec 30, 2025**; issues/CI activity through 2025. ~1.0k stars. Python (≥3.9). **License: MIT.** Notable 2025 addition: `ghstack config automsg claude|codex` — AI-generated PR descriptions via Claude or Codex (author-side convenience, not review-side).

**Review UI: confirmed none.** It relies entirely on GitHub's native PR UI (or ReviewStack, which explicitly supports ghstack-created stacks). Nothing here overlaps the vision except as a stack-producing input format the tool should recognize.

---

## 5. Aviator / av CLI (aviator-co/av)

**What it is.** [av](https://github.com/aviator-co/av) is a free CLI for stacked PRs on GitHub (create/visualize/`av sync` restack, split/reorder); Aviator the company sells a **MergeQueue**, **FlexReview**, Releases, and "Verify" on top. https://www.aviator.co/stacked-prs, docs: https://docs.aviator.co/aviator-cli.

**av status/license.** **MIT**, Go; very active — **v0.1.45 released Jul 10, 2026**; ~500 stars.

**Review UI?** Aviator has a **PR inbox** (web app + Chrome extension) with smart routing — PR-level triage, but **no own diff viewer**; review happens on GitHub. So: queue semantics between PRs, nothing within diffs.

**FlexReview.** Not an AI code reviewer — it's **expertise-based reviewer assignment + risk-based approval policy**: scores each developer's domain expertise vs. change complexity, suggests/load-balances reviewers, relaxes CODEOWNERS for low-risk changes, review SLOs ([page](https://www.aviator.co/flexreview)). Aviator's actual AI product is **"Verify"** ("replace code reviews with verified intent" — deterministic verification against intent), a different philosophy from reviewer-assist.

**Pricing.** Free ($0: inbox, av CLI, Verify 10 PRs/mo); Team **$20/dev/mo** (inbox smart routing, MergeQueue, ≤10 repos); Scale **$40/dev/mo** (full Verify, monorepo-aware affected-targets, dynamic CODEOWNERS); Enterprise custom (self-hosted, **bring-your-own AI keys — Claude/OpenAI/Bedrock**) ([pricing](https://www.aviator.co/pricing)).

**Vs the vision.** Orthogonal: workflow orchestration around review, not the reading experience. The BYO-AI-keys enterprise stance is the only echo of "harness-agnostic." Forkability: av CLI only; no UI to fork.

---

## 6. spr — two distinct projects, both "commit = PR"

**a) spacedentist/spr (formerly getcord/spr).** Rust CLI implementing Meta's Phabricator-style `spr diff` / `spr land` workflow on GitHub — one amendable/rebaseable commit per PR. The repo was transferred from getcord to **spacedentist** (github.com/getcord/spr now shows spacedentist/spr). **MIT**, Rust; latest release **v1.3.7, Aug 25, 2025** — alive but slow-moving. https://github.com/spacedentist/spr

**b) ejoffe/spr.** Go CLI: "turns each commit into its own pull request — kept in sync, correctly ordered." **MIT**, Go; **v0.17.6 released Apr 22, 2026**; 1.3k stars — actively maintained. https://github.com/ejoffe/spr

**Review UI: confirmed none for both** — both work "purely with GitHub's native pull requests" (ejoffe/spr adds status glyphs in the terminal). Relevance to the vision: input formats only.

---

## 7. Other stacked-diff tooling with its own review UI

The striking landscape fact: **almost nobody builds a review UI**. Of the whole stacked-diff ecosystem — ghstack, spr ×2, av, [stack-pr (Modular)](https://github.com/modular/stack-pr), stacking.dev, git-branchless, `git rebase --update-refs` — **only Graphite (closed) and ReviewStack (MIT) have their own review surfaces** ([Pragmatic Engineer overview](https://newsletter.pragmaticengineer.com/p/stacked-diffs), [stacked-prs topic](https://github.com/topics/stacked-prs)). Adjacent systems with real dependency-aware review UIs are the pre-GitHub generation: **Gerrit** (change-per-commit, relation chains, per-patchset diffs, its own progress/vote model) and **Phabricator/Phorge** (Differential — the tool ReviewStack's UX descends from). Both are self-hosted server products with dated UX; neither does sub-file chunk queues or local-agent threads. No open-source project found in searches implements sub-file narrative ordering or reviewer-side local-AI threads — that part of the vision appears genuinely unoccupied.

---

## Bottom line

| Tool | Own review UI | License | Alive (evidence) | Closest vision overlap | Forkable? |
|---|---|---|---|---|---|
| Graphite | Yes (best-in-class PR queue, versioned diffs, keyboard) | Closed; CLI archived 2023 | Yes — acquired by Cursor Dec 19, 2025 | Inbox semantics, PR-version diffs; AI = hosted bot | No |
| ReviewStack | Yes (stack nav + versioned diffs) | **MIT** (verified Apr 2026) | Yes — commits Apr 2026, scheduled deploys | Old/new version navigation, stack ordering, client-side arch | **Yes — best candidate** |
| Sapling/ISL | No (authoring UI) | GPL-2 core, MIT addons | Very active (daily commits) | Local web-server-over-repo architecture | Components only |
| ghstack | No | MIT | v0.14.0 Dec 2025 | — (input format) | n/a |
| Aviator/av | PR inbox only, no diff viewer | av: MIT | v0.1.45 Jul 2026 | Queue-between-PRs; BYO AI keys (enterprise) | CLI only |
| spr (both) | No | MIT | Aug 2025 / Apr 2026 releases | — (input format) | n/a |

Key gaps nobody covers: **sub-file chunking with narrative ordering, 100%-coverage chunk queue, per-chunk context payloads, sub-file progress tracking, and local-agent comment threads with verifiable patches.** ReviewStack covers the most substrate (MIT, versioned diffs, no backend, Monaco, GitHub GraphQL) but would need its chunk model, queue semantics, and the entire agent layer built from scratch on an aging CRA/TS4 toolchain.

Unverified/soft claims flagged: Graphite per-file "viewed" tracking (undocumented); Graphite acquisition price ("well above $290M" — reported, not disclosed); one search summary called ReviewStack "AWS-backed" — that is wrong/hallucinated (it deploys via GitHub Actions to reviewstack.dev, a Meta property).
