# Landscape appendix: self-hosted forge & classic review tools

Deep dive supporting [01-landscape.md](01-landscape.md): Gerrit, Review Board, Phorge, Gitea/Forgejo.
Researched via official sites, repos, release notes, and blogs, July 2026.

---

## 1. Gerrit Code Review

**Official site:** https://www.gerritcodereview.com/ · **Repo:** https://gerrit.googlesource.com/gerrit (mirror: https://github.com/GerritCodeReview/gerrit)

### What it is
Google-originated, self-hosted change-based (not branch-based) code review on top of Git. Every change is a commit with iterated "patchsets"; reviewers vote on labels (Code-Review −2..+2). The reference tool for rigorous, iteration-based review.

### Current state (2025–2026) — actively maintained, now explicitly "AI-era"
Release history (per https://endoflife.date/gerrit and https://www.gerritcodereview.com/releases-readme.html — roughly 6-month cadence, last 3 majors supported):
- **3.11** — Dec 2, 2024 (now EOL)
- **3.12** — May 19, 2025 (JGit performance, H2 v2, dropped Java 17)
- **3.13** — Nov 10, 2025 (GerritForge announcement Dec 10, 2025: https://gitenterprise.me/2025/12/10/gerrit-3-13-is-here-top-6-features-driving-smarter-faster-code-review/)
- **3.14** — May 15, 2026, "the AI release"; 3.14.2 patch July 13, 2026 (https://www.gerritcodereview.com/3.14.html)
- 3.15 in development (Java 25).

Contributor base spans Google, GerritForge, SAP, Qualcomm etc.; core commits grew from ~600 (3.12) to 900+ (3.13).

### AI integrations (2025–2026) — the most advanced of this cluster
- **Gerrit 3.13:** AI features enabled by default, headlined by an **AI-assisted "Generate Prompt"** action that builds a rich, context-loaded prompt for an external LLM (Gemini, ChatGPT, Claude) to help with review, commit messages, security analysis (GerritForge 3.13 post above). Notably close to our "per-chunk context payloads for the reviewer's own agent" idea — but at change granularity, not chunk granularity, and it's copy-paste, not an integrated local-agent loop.
- **Gerrit 3.14:** **"Review Agent"** — an AI chat sidebar on the change screen: splash page, conversation history, predefined + model-exposed custom actions, "capability details" modal, copy button for suggestions. Crucially it is **backend-pluggable**: the UI calls an `AiCodeReviewProvider` **plugin interface**; admins gate access with a new `aiReview` ref permission; disabled for private changes (https://www.gerritcodereview.com/3.14.html). Architecturally "agent-harness agnostic" on the server side — but it's a hosted/server-side model integration, not the reviewer's own local Claude Code, and outputs are chat text, not verifiable patches.
- **`ai-code-review` plugin** (formerly "ChatGPT Code Review"): posts AI review comments/votes on patchset upload or `/review` command; backends: ChatGPT (default), OLLAMA, Azure OpenAI, generic endpoints; stateless or stateful (OpenAI Assistants) modes; Apache-2.0; actively maintained (3.13.0 bump ~4 months ago) — https://gerrit.googlesource.com/plugins/ai-code-review/. This is a **bot** reviewer, i.e., the opposite of our human-centric vision.
- Community alternative: https://github.com/amarula/reviewai-gerrit-plugin.
- Google's internal Critique/Gemini AI review: widely presumed but **unverified from public sources in this research** — searches surfaced only Gemini Code Assist for GitHub (https://cloud.google.com/blog/products/ai-machine-learning/gemini-code-assist-and-github-ai-code-reviews), nothing public about AI inside Critique or google.com Gerrit hosts.

### Review workflow granularity
Per https://gerrit-review.googlesource.com/Documentation/user-review-ui.html:
- **Per-file "reviewed" checkbox** in the file list, with an optional "mark reviewed automatically when viewed" diff preference — real sub-change progress tracking, but only at **file** granularity, nothing per-hunk/per-chunk.
- Diff features: configurable context, expand-by-10/expand-all links, **base/patchset selection on both sides** (excellent old↔new navigation across iterations), **rebase-edit highlighting** (distinguishes rebase noise from real changes — a primitive form of change-type detection), resolved/unresolved comment threads, magic files (commit message reviewable).
- No narrative ordering (files alphabetical), no coverage guarantee beyond the file checkboxes, no callee/context display beyond blame and "expand context."

### License / stack / self-host
- **Apache-2.0**; **Java 72.9% + TypeScript 24.4%** (GitHub repo page). Web UI ("PolyGerrit") is standards-based web components — the legacy Polymer `paper-`/`iron-` components were fully removed in 3.14 in a Material Design 3 modernization (the UI is Lit-based TypeScript; Lit specifically **unverified** from the pages fetched, but "all legacy Polymer dependencies removed" is verified). Self-hosted; GerritForge sells Gerrit-as-a-Service on GCP Marketplace.

### Forkability / extensibility
- **Frontend plugin API** (https://gerrit-review.googlesource.com/Documentation/pg-plugin-dev.html): plugins register custom elements at named **endpoints**, decorate/replace DOM, add change actions, custom screens, checks integrations, restricted CSS via variables. Deliberately **constrained** — you can add panels and actions (the whole Review Agent sidebar is delivered this way), but you cannot restructure the diff view itself (no plugin control over hunk ordering, chunking, or per-hunk state) without forking the UI.
- Fork assessment: the TypeScript UI is separable and modern, and the REST/plugin surface is rich, but Gerrit is a heavyweight Java monolith (Bazel build, NoteDb). **Best-in-cluster as a data-model/back-end to build against (its REST API + patchset model), moderate as a UI fork base, poor as a quick-hack target.**

### Gap vs. vision
Has: per-file progress tracking, old/new patchset navigation, rebase-noise detection, pluggable AI provider seam, prompt-generation with context. Lacks: sub-file chunk queue/ordering, 100%-coverage semantics below file level, non-diff context display (callees), local-agent iteration loops, AI-as-verifiable-patch, deferred-clarification items.

---

## 2. Review Board (+ Review Bot)

**Official site:** https://www.reviewboard.org/ · **Repo:** https://github.com/reviewboard/reviewboard · **Review Bot:** https://github.com/reviewboard/ReviewBot · **Vendor blog:** https://blog.beanbaginc.com/

### What it is
One of the oldest web code-review tools (2006-era), from Beanbag, Inc. Pre-commit or post-commit review of diffs, images, and (now) documents, independent of any single forge; supports Git/GitHub/GitLab/Bitbucket/SVN/Perforce/etc. via `rbt post`.

### Current state (2025–2026) — alive, Beanbag active, just went freemium
From https://www.reviewboard.org/news/ and GitHub releases:
- **Review Board 7.0.x** line: 7.0.3 (Dec 18, 2024), 7.0.4 (Aug 5, 2025), 7.0.5 (Mar 19, 2026), 7.0.6 (Mar 31, 2026). RB 7 brought dark mode, **multi-commit review** (RBTools uploads your branch's commit history instead of a squashed diff), Unicode-confusable "code safety" flagging in diffs, docked file-list navigation banner, binary-file review.
- **Review Board 8** — announced May 28, 2026; GitHub release "Review Board 8: The New Frontier" June 9, 2026. Introduces **subscription tiers**: Community (free), Plus ($12–15/user/mo), Enterprise ($15–18/user/mo) for self-hosted (https://www.reviewboard.org/get/). Features: Office/Google-Docs/PDF **document review with diffing**, user roles, pinnable quick-access actions, enhanced interdiff filtering, browser-native spell-check/"writing assistance," Forgejo & GitLab CI integrations.
- **RBCommons** (hosted SaaS, https://rbcommons.com): moved to RB7 April 26, 2025; Basic $6/user/mo, Business $12/user/mo.
- **Review Bot 4.1** (Apr 7, 2026): updated tool support (cargo, cppcheck, go, rubocop), notification scoping.

### AI status
- **Review Bot is a static-analysis orchestrator, not an LLM bot** — it runs industry-standard checkers (clang analyzer, checkstyle, flake8, rubocop, …) and posts results as a review (https://github.com/reviewboard/ReviewBot). **No LLM integration found as of mid-2026**; an independent Dec 2025 survey concurs: "ReviewBoard doesn't seem to have any LLM integration as best as I could tell" (https://www.happyassassin.net/posts/2025/12/16/a-half-assed-assessment-of-open-source-ai-code-review-tools/).
- RB 8's positioning is deliberately **human-focused "in an era of AI development"** — reviewing changes "from teammates and AI agents alike," AI *writing* assistance only (browser-native), and an explicit privacy pledge not to mine data for AI training (https://www.reviewboard.org/). Philosophically aligned with our human-reviewer-first stance; technically it offers no AI review loop at all.

### Diff-viewer capabilities relevant to the vision
Per https://www.reviewboard.org/docs/manual/latest/users/reviews/reviewing-diffs/:
- **Interdiffs** (diff-revision vs diff-revision comparison — strong old/new iteration navigation, now with RB8 interdiff filtering).
- **Rich context expansion**: expand 20 lines, expand-all, or **expand to enclosing function/class** (headers show the function/class name — the closest thing in this cluster to structured non-diff context).
- **Moved-line detection** with click-to-jump between move endpoints; indentation-only change detection (**the latter unverified** in this pass, though historically documented).
- Open-issue tracking on comments (open/fixed/dropped) — a workflow-level analog of our deferred-clarification items, but tied to comments, not to un-reviewed regions.
- **No per-file viewed/reviewed checkboxes and no sub-file review-progress tracking found** (nothing in docs/news; **absence unverified exhaustively but consistent across sources**). Diff ordering is per-file; no narrative ordering; no coverage guarantee.

### License / stack / forkability
- Core: **MIT** (verified on GitHub); **Python 73.8% / TypeScript 13%**, Django + their Djblets framework. Power Pack / Plus / Enterprise features are proprietary add-ons; core remains open.
- Has a real **extension framework** (Djblets extensions: hooks for UI, API, integrations) — Review Bot itself is an extension. RB 8 advertises "enhanced extension capabilities."
- Fork assessment: **good** — MIT, Python/Django is easy to modify, the diff viewer already does interdiffs/moved lines/function-aware expansion, and it's forge-agnostic (fits "review tool for the human reviewer" rather than a whole forge). Risks: aging jQuery/Backbone-era frontend heritage (being TypeScript-ified), single-vendor project with a new commercial tier, modest community (1.7k stars).

### Gap vs. vision
Has: interdiffs, function-aware context expansion, moved-line detection, issue tracking, multi-commit diffs, forge-agnosticism. Lacks: any reviewed-state tracking below "review published," chunk ordering/queueing, non-diff callee display, all AI-assist for the reviewer, codebase navigation (it shows diffs, not the repo).

---

## 3. Phabricator / Phorge

**Phorge site:** https://we.phorge.it/ (upstream, self-hosted; blocks generic fetchers) · **Mirror:** https://github.com/phorgeit/phorge · **Phabricator (archived):** https://secure.phabricator.com/

### What it is / history
Phabricator (Facebook → Phacility) was a PHP suite of dev tools; **Differential** was its pre-commit code-review app. Phacility ceased maintenance **June 1, 2021** (https://en.wikipedia.org/wiki/Phabricator). **Phorge** is the community fork, publicly stable since Sept 7, 2022.

### Phorge activity 2025–2026 — alive but small
- GitHub mirror shows **commits current to July 15, 2026**, roughly **30–40 commits/month**, dominated by a handful of maintainers (aklapper, avivey, plus occasional contributors); work is largely PHP 8.4/8.5 compatibility, Conduit API, code health.
- Community metrics are tiny (191 stars on the read-only mirror — undercounts since development is on we.phorge.it, but the maintainer pool is verifiably ~2–4 regulars).
- Versioning: rolling `stable`/`master` branches, not semantic releases; **no dated release/changelog page retrievable** (we.phorge.it returns 403 to fetchers) — release cadence **unverified** beyond commit flow. Wikimedia has been migrating its Phabricator to Phorge upstream (https://phabricator.wikimedia.org/T333885).

### Differential review UI features
From https://secure.phabricator.com/book/phabricator/article/differential_inlines/ and https://projects.clusterlabs.org/book/phorge/article/differential/:
- Inline comments in the diff body; **per-inline-comment "Done" checkboxes** so authors mark feedback addressed — Phabricator *deliberately* kept these low-key: the lack of "check-all-the-boxes" cues in the UI is an intentional design decision to avoid a mechanical "look at each line, tick it off" review style (see https://secure.phabricator.com/T1460). That philosophy is the **direct opposite of our 100%-coverage queue semantics** — a documented counter-position worth engaging with.
- Revisions iterate as "diff updates" with comparison between diff versions (interdiff-like); no per-file reviewed checkboxes, **nothing per-hunk** beyond comment anchoring.

### AI integrations
**None found** for Phorge/Differential (searched "Phorge AI/LLM"; nothing documented as of July 2026). Given the ~3-person maintainer team focused on PHP-version survival, none expected.

### License / stack / forkability
- **Apache-2.0**, **PHP 93.8%** + custom JS (Javelin framework) — verified on the GitHub mirror.
- Fork assessment: **poor as a base for our vision.** Legacy PHP monolith with a bespoke pre-React JS framework, community fully occupied keeping the lights on, upstream infra hostile to automation, and the product philosophy explicitly rejects coverage-checkbox review. Its ideas (Done-states on inline comments, revision-vs-revision comparison) are worth borrowing; its code is not.

---

## 4. Gitea and Forgejo

**Gitea:** https://gitea.com / https://blog.gitea.com / https://github.com/go-gitea/gitea · **Forgejo:** https://forgejo.org / https://codeberg.org/forgejo/forgejo

### What they are
Self-hosted GitHub-style forges in Go. Forgejo hard-forked Gitea in 2022 (after Gitea Ltd commercialization) and powers Codeberg.

### Maintenance status — both very active
- **Gitea:** 1.24.0 (2025, added a repository file-tree sidebar, contributed by kerwin612), 1.25.0 (Oct 29, 2025), **1.27.0 (July 13, 2026)**; 56.8k stars; MIT; **Go 82.6%, Handlebars templates 7.4%, TS 5%, Vue 1%** (GitHub). Commercial arms: Gitea Cloud (SaaS) and Gitea Enterprise.
- **Forgejo:** v12.0 (July 2025), through **v15.0 (Apr 2026)**; v15.0.4 and v11.0.16 LTS current as of July 9, 2026 (https://forgejo.org/releases/). License: **MIT through v8; GPL-3.0-or-later from v9.0 (Oct 2024)** (https://forgejo.org/2024-08-gpl/, https://lwn.net/Articles/986998/).

### Review UX today
- **Viewed-files checkboxes**: Gitea (and Forgejo) track per-user per-file viewed state in a `ReviewState` model, with "changes since last review" awareness (https://deepwiki.com/go-gitea/gitea/5.3-code-review-and-diff-system); a 1.25.1 fix ("viewed files number is not right if not all files loaded", https://github.com/go-gitea/gitea/releases) confirms a viewed-files counter in the UI. Feature originally landed ~Gitea 1.17/1.18 era (2022) — **exact version unverified**.
- **Diff file tree** in the PR files view (silverwind's "diff file tree tweaks" PR #21446, 2022, defaulting collapsed — https://github.com/go-gitea/gitea/pull/21446).
- Conversation tab + Files tab, GitHub-style; approve/request-changes/comment reviews.
- **Forgejo v12.0 (July 2025): improved per-commit review UX** — Prev/Next commit navigation, "Finish Review" usable from per-commit pages, commit message shown inline (https://forgejo.org/2025-07-release-v12-0/). But reviewers still **cannot mark commits as reviewed** — tracking remains file-level only.
- **Forgejo discussion #325 "Patch-based code review UI"** (https://codeberg.org/forgejo/discussions/issues/325) is highly relevant context: a Jujutsu contributor proposed Gerrit-style change-ID/interdiff review; a full design by Mathieu Fenniak was **shelved after user research** in favor of incremental improvements (reviewed-commit tracking, better force-push diffs); the proposer is building a **standalone, forge-agnostic review tool** instead — i.e., the Forgejo community itself concluded that a from-scratch reviewer-side tool may be the right vehicle, which validates our product thesis.

### AI hooks / integrations (2025–2026)
- **Nothing native in either forge.** AI review arrives via Actions bots and third parties: `opencode-review-gitea` (OpenCode-based, runs in Gitea Actions, posts structured line-level reviews, Claude/GPT/DeepSeek — https://github.com/ccsert/opencode-review-gitea); **AuditLM** self-hosted AI reviewer for Forgejo with sandboxed local-LLM analysis (https://github.com/ellenhp/auditlm); "AI Gitea Bot" (https://forum.gitea.com/t/ai-gitea-bot-open-source-ai-powered-code-reviews-for-your-self-hosted-gitea/12030); a proposed community "gitea-agent" issue→PR orchestrator (https://github.com/go-gitea/gitea/issues/34527). All are **bot reviewers**, not human-reviewer augmentation.
- **Forgejo's community is AI-cautious**: discussion #366 (https://codeberg.org/forgejo/discussions/issues/366) shows strong concerns about AI-generated contributions; no formal policy, but native AI features are culturally unlikely. Gitea has no announced Cloud AI features (**none found; unverified negative**).

### Extensibility / forkability
- Neither forge has a review-UI plugin system; customization means forking Go templates + TS/Vue frontend. Both are giant forges — bending one toward our vision means carrying an entire GitHub clone to change one screen.
- Fork assessment: **Gitea** — MIT (favorable), huge codebase, review UI is server-rendered templates + sprinkled TS/Vue; feasible but heavy. **Forgejo** — GPL-3.0+ (copyleft constrains proprietary productization), community aligned with better-review goals (per-commit UX work, #325 interest) but explicitly chose incrementalism. For both, the realistic play is our tool as a **companion app talking to their APIs**, not a fork — exactly the direction the #325 proposer took.

### Gap vs. vision (both forges)
Have: per-file viewed tracking with stale-on-change invalidation (the best "progress" primitive in this cluster besides Gerrit's), diff file tree, per-commit review stepping (Forgejo). Lack: everything sub-file (no hunk states, ordering, or coverage guarantee), interdiffs across force-pushes (the acknowledged #325 pain), non-diff context display, any native AI, review-UI extensibility.

---

## Cross-cutting takeaways

1. **No tool in this cluster does sub-file review-progress tracking.** The granularity ceiling is: Gerrit = per-file reviewed checkbox (+ auto-mark-on-view); Gitea/Forgejo = per-file viewed state invalidated on new changes; Review Board = per-comment open issues only; Phorge = per-inline-comment Done. A per-chunk queue with 100% coverage is genuinely unoccupied territory — and Phabricator's docs argue *against* it on philosophical grounds (T1460), a useful foil.
2. **Nobody orders or chunks diffs narratively.** Ordering is alphabetical/tree everywhere. The closest primitives: Gerrit's rebase-edit highlighting and Review Board's moved-line/function-context awareness.
3. **AI in this cluster is either bot-reviewer (Gerrit ai-code-review plugin, Gitea/Forgejo Actions bots) or reviewer-side but shallow (Gerrit 3.13 Generate Prompt, 3.14 Review Agent chat).** Gerrit 3.14's pluggable `AiCodeReviewProvider` + context-rich prompt generation is the nearest neighbor to our local-agent, harness-agnostic design — but it's server-side chat, with no verifiable-patch iteration and no per-chunk payloads. Review Board 8 explicitly markets *human-first* review in the AI era with zero AI review features.
4. **Forkability ranking for our vision:** Review Board (MIT, Django, forge-agnostic, interdiffs already) > Gerrit (Apache-2.0, best data model and old/new navigation, but heavyweight and UI-plugin-constrained) > Gitea (MIT but a whole forge) > Forgejo (GPL, incrementalist) > Phorge (legacy PHP, skeleton crew). The Forgejo #325 thread independently converged on "build a standalone forge-agnostic review tool" — direct market validation.

**Unverified items flagged above:** Gerrit UI framework being Lit specifically; Google-internal Critique AI features; Review Board indentation-change detection and the absence of per-file viewed tracking (consistent but not proven negative); Phorge release cadence (site blocks fetchers); exact Gitea version introducing viewed-files; absence of Gitea Cloud AI features.
