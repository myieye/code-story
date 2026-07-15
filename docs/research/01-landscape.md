# Code-review tool landscape (researched 2026-07-15)

Research question: does a tool already exist that matches the vision in
[`docs/vision/original-prompt.md`](../vision/original-prompt.md) — an AI-augmented diff/PR review
tool **for the human reviewer**, with sub-file chunking and narrative ("reads like a book")
ordering, guaranteed 100% diff coverage via queue semantics, clearly-distinguished non-diff
context, fast old/new codebase navigation, local AI comment threads with verifiable per-thread
patches, painless manual editing, per-chunk context payloads, sub-file progress tracking, deferred
clarification items, change-type detection, reviewer/author calibration, feedback into agent
instruction files, own-vs-others rigor modes, and agent-harness agnosticism.

Shorthand: the vision properties are referenced as **V1 chunk/order, V2 coverage queue, V3
context-vs-diff, V4 code nav (old+new), V5 local agent threads, V6 verifiable patches, V7 manual
edit, V8 context payloads, V9 sub-file progress, V10 deferred items, V11 change-type detection,
V12 calibration, V13 instruction feedback, V14 own-vs-others rigor (+harness-agnostic, local)**.

Method: parallel web research sweeps (vendor sites/docs/changelogs, HN, Product Hunt, arXiv),
July 2026. Claims sourced only from aggregator blogs are flagged; anything unconfirmed says
**unverified**. Prices are as-published July 2026 and shift often.

**Headline:** the market split into (a) a crowded, well-funded **bot** category ("AI reviews for
you") and (b) a thin, fast-growing **reviewer-experience** category ("AI helps you read"). In
2025-26 four players independently converged on narrative diff ordering — Devin Review, CodeRabbit
Atlas/Change Stack, cubic (ex-mrge), and the startups Stage/Haystack — validating V1. **Nobody**
combines it with V2 coverage-queue semantics, V5/V6 local-agent verifiable-patch threads, V9/V10
sub-file progress + deferred items, or V11–V14. Cursor buying Graphite (Dec 2025) confirms review
is where the industry thinks the bottleneck is.

---

## 1. AI PR review bots (bot-centric)

Common shape: a GitHub/GitLab app posts a summary + inline comments. They optimize "read less,"
not "read everything, faster" — the opposite pole from the vision. Confidence-filtered findings
are *by design* the anti-thesis of V2 (silent exclusion is the product). None have V4–V14.

### CodeRabbit — https://www.coderabbit.ai — **now also a reviewer UI (Atlas)**
- **Bot side:** market leader (~2M repos, 13M+ PRs). Reviews on GitHub/GitLab/Azure/Bitbucket:
  summaries/walkthroughs, inline comments, 40+ linters/SAST, "Learnings" (team-preference memory
  with admin approval + export API), Issue Planner (Feb 2026), Autofix agent (Apr 2026),
  multi-repo downstream-breakage analysis, AI-slop detection, CLI for local reviews (calls their
  cloud), VS Code extension, Claude Code plugin.
- **Atlas / "Change Stack" (May 7, 2026; GH Enterprise + GitLab June 2026): the closest shipped
  thing to V1.** Reorganizes a PR "from a flat file list into a guided, layer-by-layer
  walkthrough": **cohorts** (logical groups of related files/hunks) broken into **ordered layers**
  so data shapes/contracts come before consumers/call sites/tests; every layer anchors to
  **specific line ranges** with range-scoped summaries and inline diagrams; keyboard navigation;
  submit a real GitHub review from inside it. Follow-ups: semantic-diff mode, "All files"
  navigator, **"Code Peek"** (definition/usage lookup via GitHub code search without leaving the
  review — partial V3/V4). Marketing: reviews should "feel … like following the story of the
  software as it evolves."
  ([Atlas](https://www.coderabbit.ai/atlas),
  [Change Stack docs](https://docs.coderabbit.ai/pr-reviews/change-stack),
  [announcement](https://www.coderabbit.ai/blog/introducing-atlas-the-first-ai-native-code-review-interface),
  [changelog](https://docs.coderabbit.ai/changelog))
- **Still missing vs vision:** no coverage/queue contract (whether every hunk provably appears in
  the cohort decomposition is **unverified**), no sub-file reviewed-state or deferred items
  (V9/V10), AI iteration is CodeRabbit's cloud agent — not your local harness (V5/V6/V14 fail),
  no in-review editing (V7), no calibration (V12), Learnings feed *their* memory, not your
  CLAUDE.md/AGENTS.md (V13).
- **OSS/local/pricing:** closed SaaS. Free tier + Pro ~$24–30/user/mo (Lite tier reportedly
  retired Jun 2026 — aggregator-sourced, figures vary); free for public repos. Not forkable.
  **The bar to beat for V1.**

### Greptile — https://www.greptile.com
Whole-repo semantic graph index; swarm-agent reviews track downstream impact; plain-English rules;
TREX test-writing agent; one-click handoff of context into Claude Code/Cursor. Bot-centric — no
review UI; the graph is internal (prior art for V8, not exposed to the reviewer). Closed;
usage-based since Mar 2026 (~$30/seat + ~$1/review past 50; free tier Jun 2026); enterprise
self-host in your AWS. GitHub/GitLab only. Not forkable.
([pricing](https://www.greptile.com/pricing))

### Qodo / PR-Agent — https://github.com/The-PR-Agent/pr-agent
- Qodo platform ("Qodo 2.0"): proprietary review bot + IDE review + context engine + governance
  portal; credit-priced; free for OSS.
- **PR-Agent: the flagship open bot.** Apr 23, 2026: Qodo transferred it to a community org
  (The-PR-Agent) with an external maintainer; press said "Apache-2.0 restored" but the **actual
  LICENSE file is MIT** (verified by the research sweep). ~12k stars, active; CLI/Docker/Actions;
  GitHub/GitLab/Bitbucket/Azure DevOps/Gitea; any major LLM incl. Claude; battle-tested
  "PR compression" for huge diffs.
  ([handover post](https://www.qodo.ai/blog/qodo-is-handing-pr-agent-over-to-the-community/),
  [analysis](https://futurumgroup.com/insights/qodo-hands-pr-agent-to-the-community-will-open-governance-accelerate-ai-code-review/))
- Bot-only — zero UI. **Forkability: high for backend plumbing** (diff processing, prompting,
  provider abstraction), irrelevant as a reviewer-UI base.

### Cursor Bugbot — https://cursor.com/bugbot
Narrow by philosophy: "hardest logic bugs, low false-positive rate" — deliberate silent exclusion
(anti-V2). "Fix in Cursor" hands findings to Cursor's editor/cloud agents (harness-locked, fails
V14); Bugbot Rules + learned rules; security review mode; pre-push `/review` in-editor;
review-only-what's-new option. Usage-based ~$1–1.50/PR since Jun 2026 on Cursor plans
([update](https://cursor.com/blog/bugbot-updates-june-2026)). Closed, GitHub-only. Not forkable.

### GitHub Copilot code review — https://docs.github.com/en/copilot/concepts/agents/code-review
GA on an agentic tool-calling architecture (Mar 5, 2026) — gathers repo context on demand; reads
`copilot-instructions.md`, path-scoped instructions, and **AGENTS.md (Jun 18, 2026)**; hands fixes
to the Copilot coding agent; org-level controls; consumes premium requests **and Actions minutes
since Jun 1, 2026**. Reviewer still reads GitHub's stock diff. Docs explicitly say it skips some
file types and "is not guaranteed to spot all problems" — the written-down opposite of V2. Reads
instruction files but never writes back (V13 inverted).
([agentic GA](https://github.blog/changelog/2026-03-05-copilot-code-review-now-runs-on-an-agentic-architecture/),
[AGENTS.md](https://github.blog/changelog/2026-06-18-copilot-code-review-agents-md-support-and-ui-improvements/))
Distribution threat: the "good enough" default.

### Graphite — https://graphite.com — **acquired by Cursor, Dec 19, 2025**
Stacked-PR workflow (CLI + web) with the best mainstream *reviewer workflow*: redesigned PR page,
team PR inbox, merge queue, keyboard-first. Diamond AI reviewer (Mar 2025, $52M Series B) was
folded into "**Graphite Agent**" (Oct 8, 2025); **Cursor/Anysphere acquired Graphite Dec 19, 2025**
(reported "way over" the $290M valuation) — AI review now backed by Cursor Cloud Agents; Cursor's
CEO framed review as *the* bottleneck.
([Diamond launch](https://graphite.com/blog/series-b-diamond-launch),
[Graphite Agent](https://graphite.com/blog/introducing-graphite-agent-and-pricing),
[acquisition](https://graphite.com/blog/graphite-joins-cursor),
[TechCrunch](https://techcrunch.com/2025/12/19/cursor-continues-acquisition-spree-with-graphite-deal/))
- Vs vision: narrative comes from *author-side stacking discipline* (inter-PR ordering), not
  reader-side restructuring; within a PR it's a conventional file diff — no V1/V2/V9; AI is
  Cursor-locked (V14 fail). Hobby free; Starter $20; Team $40/user/mo. Closed; not forkable.
  Strategically the loudest signal that our thesis has buyer demand.

### The rest of the bot cohort
| Tool | 2026 state | Notes vs vision |
|---|---|---|
| [Sourcery](https://www.sourcery.ai/) | Active; LLM+static hybrid, IDE sidebar, BYO-LLM option, zero-retention mode; Pro ~$12/seat; free for OSS | Bot; sidebar = findings list, not a reading UI |
| [Codacy AI Reviewer](https://www.codacy.com/ai-reviewer) | Restructured "AI-first" 2025: AI Guardrails / AI Reviewer / AI Risk Hub; cross-checks PR description vs code; tunable via repo `review.md` | Bot + dashboard; `review.md` is one-way (V13-adjacent, no write-back) |
| [Bito](https://bito.ai/product/ai-code-review-agent/) | Active; persona-style analysis, fbinfer/OWASP + Claude; **self-hosted Docker of the agent offered**; $12–15/seat | Bot; self-hostable but closed |
| [Korbit](https://www.korbit.ai/) | Active; reviews + manager analytics; in-thread chat with *their* bot (Pro); free tier | Bot; chat ≠ your agent |
| [Callstack.ai Reviewer](https://callstack.ai/code-reviewer) | GitHub Action / GitLab CI; RAG engine ("DeepCode"); can run inside your CI. Relation to callstack.com (RN consultancy) **unverified**; pricing page unreachable | CI comment bot |
| [Sema](https://www.semasoftware.com/) | **Pivoted out of review**: due-diligence code health checks + **AI Code Monitor** (detects GenAI-written code) | Only overlap: AI-authorship detection ≈ V11 input |
| [CodeAnt](https://www.codeant.ai/) | Active; review + SAST/IaC/secrets, one-click remediation; from $10/user | Security-flavored bot |
| [Panto](https://www.getpanto.ai/) | Active; review + AppSec; pulls Jira/Confluence business context; $15–40/dev; enterprise on-prem | Context feeds the *bot*, not the human (V8 inverted) |
| [Entelligence](https://entelligence.ai/code-review) | Active; Deep Review, auto-docs, leader dashboards; free IDE ext; self-hostable | Bot + analytics |
| [Devlo](https://devlo.ai/) | Active; "AI teammate" suite; credit-priced ($19–199/mo) | Bot |
| [Kodus / Kody](https://kodus.io) | **Open source AGPLv3** ([repo](https://github.com/kodustech/kodus-ai)); model-agnostic (any OpenAI-compatible endpoint, BYOK, zero markup); NestJS/Next.js; Community free, Teams $10/dev cloud | Best self-hostable bot platform; still zero reviewer UI |
| [Macroscope](https://macroscope.com/) | Active; AST-graph engine (v3, Feb 2026, "98% precision"); "Fix It For Me" self-healing fix PRs; **auto-approves low-risk PRs** | Maximal "AI replaces the reviewer" — our inverse |
| [Matter AI](https://github.com/MatterAIOrg/matter-ai) | OSS reviewer (self-host Helm + cloud); license **unverified** | Younger Kodus alternative |
| Small OSS bots | [alibaba/open-code-review](https://github.com/alibaba/open-code-review) (deterministic+LLM hybrid), [Nikita-Filonov/ai-review](https://github.com/Nikita-Filonov/ai-review) (Ollama = fully local inference), [spencermarx/open-code-review](https://github.com/spencermarx/open-code-review) | Plumbing donors only |
| Pivoted/exited | **Ellipsis** → agent-fleet cloud platform (review now one workload; $20/dev legacy) ([site](https://www.ellipsis.dev/)); **Sweep** → proprietary JetBrains AI plugin, PR bot dead ([repo](https://github.com/sweepai/sweep)) | Category churn is real |

**Category takeaway:** ~20 products compete on false-positive rates; none on the reader's
experience — except CodeRabbit, which just crossed over with Atlas. Open-source harvest: PR-Agent
(MIT) and Kodus (AGPLv3) for server plumbing; zero UI to fork anywhere in this category.

---

## 2. Reviewer-centric AI platforms — the real (partial) competitors

### Devin Review (Cognition) — https://cognition.com/blog/devin-review
The most complete shipped expression of V1, from the "stop the slop" angle. The original vision
prompt guessed Devin was closest and wondered if it lets you dig into code — answer below.
- **Does:** its own review UI (app.devin.ai/review; `github.com → devinreview.com` URL swap;
  `npx devin-review <pr-url>` — creates a local isolated worktree, extracts the diff locally,
  **analyzes in their cloud**). "Groups together changes that are logically connected, orders the
  hunks, and explains each hunk, so you can review from top to bottom" — a guided walkthrough
  (V1 + per-hunk explanations ≈ partial V8). Move/copy detection (no delete+rewrite noise).
  Tiered findings: Bugs (severe/non-severe), Flags (*Investigate* / *Informational*), Security
  (CWE-classified); red/yellow/gray; findings can be marked resolved (finding-level progress, not
  V9). Inline codebase-aware chat; you can request edits from chat. Reads `REVIEW.md`,
  `AGENTS.md`, `CONTRIBUTING.md` (V13 read-only). Merge/close/draft actions in-UI. Auto-review
  triggers; per-PR spend caps. GitHub full, GitLab partial; no Bitbucket/ADO.
  ([docs](https://docs.devin.ai/work-with-devin/devin-review))
- **DeepWiki** ([deepwiki.com](https://deepwiki.com), free public Devin Wiki): auto architecture
  wikis + Fast/Deep-Research Q&A over 50k+ repos; official **MCP server**
  ([blog](https://cognition.com/blog/deepwiki-mcp-server)) exposes `ask_question` /
  `read_wiki_contents` to *your* agent — genuinely reusable V8 infrastructure. But there is **no
  documented jump-to-definition/old-new code browsing inside the Review UI** — navigation is "ask
  the chat," which confirms the vision-prompt's suspicion.
- **Does NOT:** coverage/queue contract (V2), sub-file read-progress (V9), deferred items (V10),
  local/BYO agent (V5 — chat is Devin cloud; fails "use my Claude subscription"), verifiable
  patch-per-thread (V6), in-review editing (V7), calibration (V12), instruction write-back (V13),
  rigor modes (V14). Closed, cloud-only.
- **Pricing:** free in early release; by ~Apr 2026 folded into paid Devin plans (Core from $20/mo
  pay-as-you-go @ ~$2.25/ACU; Team $500/mo), still free for OSS — sources differ on the exact
  current gate (**verify before citing**). No dedicated Review API (the API path is the bot
  pattern: [Devin 101](https://cognition.com/blog/devin-101-automatic-pr-reviews-with-the-devin-api)).
- Context: Cognition acquired Windsurf (Jul 2025) → "Devin Desktop" (Jun 2026) with the **Agent
  Client Protocol (ACP)** — Codex/Claude/Devin swappable in one window. Cognition itself is going
  harness-agnostic on the desktop, while Review stays Devin-locked. No documented merge of Review
  into the desktop IDE (**unverified**). ([Windsurf](https://cognition.com/blog/windsurf),
  [Desktop](https://devin.ai/desktop/))

### cubic (formerly mrge, YC X25) — https://www.cubic.dev
"Cursor for code review" ([Launch HN Apr 2025](https://news.ycombinator.com/item?id=43692476);
rebranded from mrge.io; **not acquired**; cubic 2.0 shipped Jan 12, 2026).
- **Does:** own review platform (web + Linear-inspired keyboard-first desktop app) with two-way
  GitHub sync. **"Intelligent diff ordering": groups related changes and orders them logically
  (e.g. backend → API → UI) instead of alphabetically** (V1 at file-group granularity —
  sub-file granularity **unverified**). High-level visualization before code detail. AI reviewer
  runs in an ephemeral cloud sandbox **with LSP: go-to-definition, find-references** ("reviews
  like a human" — V4 for their bot, not for you). Chat/deep-research on PR + codebase. Learns
  rules from senior devs' past comments and `.cursorrules` (V13-adjacent, feeds *their* reviewer).
  One-click fixes; nightly codebase scans; Linear/Jira/Notion/Confluence context. Customers:
  Cal.com, n8n, Better Auth; claims #1 on Martian's Code Review Bench.
- **Does NOT:** coverage queue/progress (V2/V9/V10), local repo/agent (V5/V6/V14 — top HN critique
  was cloud-only + write/merge permissions), in-review editing, calibration. GitLab pending.
- **Pricing:** Free (20 PR reviews/mo); Team $30–40; Pro $79–99/dev/mo; free for public repos.
  Closed; not forkable.

### Stage — https://stagereview.app — **closest single startup to the vision**
([Show HN ~Apr 2026: "Putting humans back in control of code review"](https://news.ycombinator.com/item?id=47796818))
- **Does:** reorganizes PR diffs into **logical, ordered "chapters"** with per-chapter review
  guidance (V1), **mark-chapter-as-reviewed progress tracking** (closest shipped V9), GitHub sync
  of comments/approvals, context-aware summaries. Built explicitly for the agent-PR bottleneck.
- **Does NOT:** coverage *guarantee* (V2 unclaimed), local agent threads/patches (V5/V6), codebase
  navigation (V4), context payloads on demand (V8), calibration/rigor/instruction feedback
  (V11–V14). HN critics: missing "why" context. Closed source ("actively talking about" OSS), no
  published pricing. Early-stage.

### Haystack — https://haystackeditor.com
([Show HN Sep 2025: "Review pull requests like you wrote them yourself"](https://news.ycombinator.com/item?id=45201703))
- **Does:** chunks PRs and lays them out in **logical/narrative order with plain-language
  explanations**; routine code/refactors placed in **skimmable sections** (V1 + collapse-the-boring
  half of V2); **cross-file context tracing** of functions/variables (V3); built on language
  servers + tree-sitter + LLM agents; descended from their canvas-IDE VS Code fork (V4 heritage).
- **Does NOT:** coverage queue, sub-file progress, local-agent threads, verifiable patches,
  calibration. $20/user/mo; diffs go to OpenAI/Anthropic; closed; self-hosting "planned."

### Baz — https://baz.ai (moved from baz.co)
- **Does:** verified from docs — a real **review workspace**: **change graph** (visual graph of
  relationships between added/modified/removed code elements), **Topics** (changes auto-grouped
  into logical groupings, V1-coarse), **line-by-line AND AST diff viewer** (V11-adjacent),
  AI Walkthroughs that "explain implementation intent before showing raw diffs," Commits tab
  tracking **reviewed vs unreviewed** (commit-granular progress), PR inbox, continuous
  merge-readiness tracking. Custom Reviewers trained on your past PR conversations; Bazzy chat;
  **Baz CLI** interactive terminal review loop; MCP support; GitHub/GitLab/Azure DevOps; built on
  Claude via AWS Bedrock AgentCore. $8M–17M raised (reports differ).
  ([PR docs](https://baz.ai/docs/capabilities/pull-requests),
  [CLI](https://baz.ai/resources/blog/baz-checkout-live-local-and-intelligent-code-validation),
  [custom reviewers](https://baz.co/resources/turn-past-prs-into-code-review-agents-introducing-custom-reviewers-by-baz))
- **Does NOT:** hunk-level ordering-as-narrative (undocumented), coverage guarantee, sub-file
  progress, local BYO-agent (their cloud agents), deferred items, calibration, instruction
  write-back. 2025-26 drift upstream toward "Baz Planner" (pre-code plan review) may dilute
  reviewer focus. Closed; pricing tiers conflicting/**unverified**.

### CodePeer — https://codepeer.com (formerly GitContext)
"AI-assisted code review platform designed for humans": embedded PR-context AI assistant,
**progress tracking ("pick up where you left off — eliminating review déjà vu")**, comments that
reposition as code evolves, guided comment-resolution flow, IDE deep links, keyboard-first.
Philosophical cousin; no chunk ordering, no coverage guarantee, closed SaaS.

---

## 3. Reviewer-centric review UIs (pre-AI / lightly-AI)

### Reviewable — https://reviewable.io
Alive (docs/features updated through May 2026). **The strongest shipped coverage/progress
semantics** ([review model](https://docs.reviewable.io/reviews)): per-**file × revision × reviewer**
matrix ("I reviewed this file at this revision"); new revisions re-flag only what changed;
**programmable completion conditions** (default: every file reviewed + all discussions resolved —
nothing merges silently unreviewed); discussion "dispositions" (blocking/satisfied/**pondering**)
≈ weak V10. Gaps: file granularity, zero AI, no ordering/context/local mode; proprietary SaaS,
GitHub-only. Not forkable — but the best design reference for our V2/V9 semantics, one level up.

### Gerrit — https://www.gerritcodereview.com/
Active: v3.13 (2025) shipped a Google-open-sourced **MCP server**; v3.14 (2026) adds "AI Chat with
any LLM"; plugin ecosystem has AI comment bots ([ai-code-review plugin](https://gerrit.googlesource.com/plugins/ai-code-review/),
[GerritForge roadmap](https://gitenterprise.me/2026/01/)). Change/patchset-centric review,
per-file reviewed flags. Gaps: file-granular, alphabetical, heavyweight self-hosted Java;
AI additions are bot-plugins. Apache-2.0 but a poor base for a nimble local-first tool.

### Others
- **ReviewBoard** (MIT, Python/Django): alive-but-legacy; Review Bot = static tools. File-level.
- **Phabricator → Phorge** (https://www.phorge.it/): Phabricator unmaintained since 2021; Phorge is
  the active community fork (PHP). Strong inline comments; file-granular; no AI. Poor fork base.
- **CodeApprove** (https://codeapprove.com): ex-Googler's Critique-for-GitHub; enforced
  conversation resolution (V2-spirit), dense keyboard UI. One-person project; no visible activity
  since ~2023 (**status unverified**); closed.
- **PullRequest.com** → HackerOne Code: human expert-review marketplace + AI assist; different
  category. ([site](https://www.pullrequest.com/))
- **GitHub's own UX:** new "Files changed" page default since Jan 22, 2026 — resizable tree,
  **comment on unchanged lines** (partial V3!), commit-by-commit review, virtualized rendering,
  1,000-file cap ([changelog](https://github.blog/changelog/2026-01-22-improved-pull-request-files-changed-page-on-by-default/)).
  Still alphabetical, file-granular "viewed" checkboxes, no coverage enforcement — the baseline
  the whole vision improves on. (Census of what reviewers flee to:
  [Ask HN: What's your 2025 code review workflow? GitHub UI feels ancient](https://news.ycombinator.com/item?id=44583146)
  → CodeApprove, Graphite, Reviewable, CodePeer, Codelantis, Kody.)
- **JetBrains:** Space and successor SpaceCode discontinued (Jun 2025); **Junie** agent (out of
  beta Jun 2026, rebuilt on ACP) does automated PR reviews with IDE-grade context — bot-model
  ([blog](https://blog.jetbrains.com/junie/2026/06/junie-coding-agent-out-of-beta/)). Notable
  thesis: [~20-25% of AI hallucinations are IDE-statically detectable pre-PR](https://blog.jetbrains.com/ai/2026/05/stop-sending-ide-catchable-ai-code-errors-to-review/)
  — supports our "scripts before AI" principle.
- **Stacked-PR tools** (Graphite CLI, ghstack, spr, Aviator, Sapling): author-side chunking at PR
  granularity. Complementary — consume, don't compete. **Pulldog** (macOS PR inbox, on-device
  Apple Intelligence summaries) = queue semantics at PR level only.

---

## 4. Diff comprehension, navigation, narrative — tools & research

- **Sourcegraph** (https://sourcegraph.com): Code Search (enterprise standard, 7.0 Mar 2026) +
  Cody Enterprise ($59/user/mo, legacy tiers killed Jul 2025); **Amp spun out as a separate
  company (Dec 2025)**. Browser extension still adds hover code-intel (defs/refs) to PR diffs —
  nearest thing to "Sourcegraph for review"; the extensions platform + Code Discussions died in
  2022. Prior art for V4-at-scale.
  ([spin-out](https://sourcegraph.com/blog/why-sourcegraph-and-amp-are-becoming-independent-companies))
- **CodeSee**: dead standalone — shut down Feb 2024, acquired by GitKraken May 2024; its **Review
  Maps** (auto diagram of how PR changes relate) were the most vision-adjacent pre-AI feature ever
  shipped, now gone. Lesson: visualization alone, without workflow integration, didn't survive.
- **AppMap / Navie** (https://appmap.io): alive (plugin releases Apr 2026); runtime-trace-aware
  `@review` of branch changes in-IDE. Unique "runtime context payload" precedent for V8.
- **GitClear** (https://www.gitclear.com): commercial diff engine classifying operations
  (Added/Deleted/Updated/**Moved/Find-Replaced/Copy-Pasted**), de-emphasizes moved code; claims
  ~30% less review volume, backed by a [12,638-PR study](https://www.gitclear.com/research_studies/pull_request_diff_methods_comparison_faster_review).
  Strongest shipped V10/V11-adjacent tech + boring-collapse; no ordering/AI threads.
- **SemanticDiff** (https://semanticdiff.com/): free VS Code extension + GitHub app; AST pipeline
  hides no-op changes, detects moved code/refactorings; 14+ languages. V11 ingredient.
- **difftastic** (MIT, Rust, https://difftastic.wilfred.me.uk/): structural CLI diff, 30+
  languages (memory-hungry on big changes); **diffsitter**, **GumTree** (the academic reference
  AST-diff algorithm) likewise ingredients, not review tools. **delta**: pretty pager only.
- **Walkthrough tooling:** **CodeTour** (Microsoft, VS Code, MIT) — recorded line-anchored ordered
  tours, explicitly pitched for PR context; **[Tour de Code AI](https://github.com/Tour-de-Code-AI/Tour-de-Code-AI)**
  — CodeTour fork that auto-generates tours via Repomix + LLMs (small, proves AI-generated tours
  work). The `.tour` ordered-step JSON is the best existing data model for "reads like a book."
- **[MCKRUZ/claude-code-reviewer](https://github.com/MCKRUZ/claude-code-reviewer)**: a Claude Code
  skill rendering a session's changes as a **narrative HTML report — diffs woven into chapters**.
  Tiny, but conceptually the closest OSS artifact to the book paradigm.
- **PR-summary bots:** What The Diff (alive, commodity), Watermelon (repos archived, dormant),
  Swimm (pivoted to legacy/COBOL modernization).

### Research prior art (validates the core premises)
- **Baum et al., "On the Optimal Order of Reading Source Code Changes for Review"**
  ([PDF](https://tobiasbaum.github.io/rp/optimalordering.pdf)) — foundational ordering theory
  (relatedness-grouped ordering beats alphabetical); follow-on prototype **CoRT**.
- **[arXiv:2306.06956](https://arxiv.org/abs/2306.06956)** (EASE 2023) — position bias is real:
  files lower in alphabetical order get less review effort (⇒ V2 matters); diff-ordered beats
  alphabetical.
- **[arXiv:2506.10654](https://arxiv.org/abs/2506.10654)** (2025) — 44.6% of PRs are reviewed in
  non-alphabetical order; **no single ordering wins** (⇒ adaptive/AI ordering, V1).
- **"Breaking the Alphabet"** ([ResearchGate, 2025/26](https://www.researchgate.net/publication/399876189_Breaking_the_Alphabet_Rethinking_File_Ordering_in_Code_Review))
  — survey of 1,355 professional devs: **only 10.2% consider alphabetical ordering optimal**.
- **Change untangling** (chunk-decomposition algorithms for V1, script-first): ClusterChanges
  (ICSE'15), SmartCommit (hunk graph partitioning), [Flexeme](https://dl.acm.org/doi/10.1145/3368089.3409693)
  (FSE'20, PDG clustering), [UTANGO](https://dl.acm.org/doi/pdf/10.1145/3540250.3549171)/HD-GNN
  (GNNs, +19-25%), [CoRA](https://www.researchgate.net/publication/338513419_CoRA_Decomposing_and_Describing_Tangled_Code_Changes_for_Reviewer)
  (decompose **and describe** — narrative chunk descriptions),
  [ChangeBeadsThreader](https://arxiv.org/pdf/2003.14086) (interactive untangling UI); LLM-era:
  [tangled-change detection](https://arxiv.org/html/2505.08263v1),
  [dependency-reasoning untangling](https://arxiv.org/html/2507.16395), Atomizer, AtomicCommitBench.

---

## 5. The 2025-26 local-first wave: reviewing your own agent's output

Driving stat: LinearB's 2026 benchmark — **agentic-AI PRs have 5.3× longer pickup time**
([analysis](https://www.aviator.co/blog/the-ai-code-verification-bottleneck-why-faster-code-generation-means-slower-reviews/)).
A new category of local, harness-connected review surfaces appeared. This is **our category**;
every entry is young and narrow.

| Tool | License / stack | What it has | What it lacks |
|---|---|---|---|
| **[hunk](https://github.com/modem-dev/hunk)** (hunk.dev) | MIT, TypeScript/OpenTUI, ~6.9k★, very active (v0.17.0 Jul 2026) | Review-first TUI: multi-file changeset stream, watch mode, **inline agent annotations + [Claude Code skill](https://github.com/modem-dev/hunk/blob/main/skills/hunk-review/SKILL.md) driving a live session via local daemon** — shipped two-way human↔agent channel (V5-adjacent, harness-friendly) | No ordering/coverage/progress persistence, no patch ledger, no code nav; terminal-only (wrong surface for UI-code review) |
| **[Plannotator](https://github.com/backnotprop/plannotator)** ([Show HN Jul 2026](https://news.ycombinator.com/item?id=48797645)) | **Apache-2.0, fully local, no network calls** | Visual annotation of agent *plans* and *diffs*; select/comment/suggest-replacement; **one-click structured feedback back into the agent loop; supports Claude Code, OpenCode, Codex, Pi, Droid (true V14)**; hooks Claude Code's ExitPlanMode | Annotation layer, not a narrative reader: no V1/V2/V9, no verifiable patch threads |
| **[difit](https://github.com/yoshiko-pg/difit)** | OSS (MIT per repo — verify), TS | CLI → local GitHub-style web review UI for any commit range; inline comments with **"Copy Prompt" / "Copy All Prompts"** (file+line-precise, agent-agnostic); background-server mode + Claude Code skill | Flat file order; one-way comment→prompt; no threads/patches/nav/progress |
| **[revdiff](https://github.com/umputun/revdiff)** ([Show HN](https://news.ycombinator.com/item?id=47742437)) | MIT, Go | TUI; annotate lines/hunks/files; **on quit, annotations feed straight back into the agent session** (Claude Code, OpenCode) | The loop, without threads/versions/ordering |
| **[Codiff](https://github.com/nkzw-tech/codiff)** ([Show HN](https://news.ycombinator.com/item?id=48166275)) | OSS, Electron | Local GUI for LLM-generated diffs; **"LLM walkthrough mode"**; comments paste back to the LLM | Staged-changes only; young |
| **[diffity](https://github.com/nilbuild/diffity)** | OSS | Agent-agnostic local browser diff viewer (Claude Code/Cursor/Codex) | Viewer only |
| **[vibe-kanban](https://github.com/BloopAI/vibe-kanban)** | **Apache-2.0**, ~26k★ (Bloop wound down Apr 2026, community-owned) | Agent orchestration board; inline diff review; comments sent back to agents as feedback | Orchestrator-first; no narrative/coverage |
| **[Conductor](https://www.conductor.build/)** / Sculptor / Crystal | closed / mixed | macOS agent-orchestration; Conductor's diff viewer "optimized for large changesets"; **Claude comments inline on specific lines** | Same |
| Also-rans | prereview, diffnav, diffx, lumen ([HN threads](https://news.ycombinator.com/item?id=48166275)) | | |

### Platform-scale open-source fork bases
- **VS Code + [vscode-pull-request-github](https://github.com/microsoft/vscode-pull-request-github)**
  (MIT): full PR review in-editor — checkout gives **real old/new navigation (V4) and native
  editing (V7) for free**, per-file viewed state, "changes since last review." No chunking/
  ordering/AI/sub-file progress. Strongest argument for building *on* VS Code (the vision's own
  hunch: "VS Code would get us a lot for free"), with CodeTour as the narrative data model.
- **ReviewStack** ([reviewstack.dev](https://reviewstack.dev),
  [docs](https://sapling-scm.com/docs/addons/reviewstack/), in
  [facebook/sapling](https://github.com/facebook/sapling) — repo GPL-2.0; verify subdir): Meta's
  open React+GraphQL GitHub-PR review UI, stack-aware, commit-at-a-time. Self-described
  *demonstration* UI; maintained but low-priority. Credible web-UI base if GPL-2.0 is acceptable.
- **Gitea (MIT) / Forgejo (GPL-3.0+)**: whole forges; Forgejo v12 (Jul 2025) improved per-commit
  review navigation ([release](https://forgejo.org/2025-07-release-v12-0/)); an open
  [patch-based review UI discussion](https://codeberg.org/forgejo/discussions/issues/325) exists.
  Too heavy as a base for a review-only tool.
- **Gerrit / Phorge / ReviewBoard**: see §3 — all Apache/MIT-ish but legacy-heavy.

---

## 6. Verdict

### (a) Does anything already do *most* of the vision? **No.**
What exists (2026): **V1 narrative ordering is becoming table stakes** — Devin Review (hunk-level
ordering + explanations), CodeRabbit Atlas/Change Stack (cohorts → ordered layers → line ranges),
cubic (logical file grouping), Stage (chapters), Haystack (narrative chunks + skimmable boring
sections), Baz (Topics + change graph). Partial V9 exists once (Stage's chapter check-offs;
Reviewable at file granularity). Partial V3 exists (Haystack context tracing, CodeRabbit Code
Peek, GitHub unchanged-line comments).

What exists **nowhere**: V2 coverage-queue guarantee (nothing silently excluded, pop-until-empty);
V5+V6 **local BYO-agent threads with every AI iteration shown as an exact verifiable patch**;
V7 in-review manual editing (outside full IDEs); V8 reviewer-controlled per-chunk context
payloads; V10 deferred clarification items; V11 change-type-driven presentation; V12 calibration;
V13 instruction-file write-back; V14 harness-agnosticism in any funded product (every cloud
player locks the agent: CodeRabbit→theirs, Devin→Devin, Bugbot/Graphite→Cursor). Best single
scores: Devin Review ≈ 4/14, CodeRabbit Atlas ≈ 3.5/14, cubic/Stage/Haystack/Baz ≈ 3/14 — all
closed, all cloud. The vision's defining combination — human-empowering + local-first +
harness-agnostic + coverage-guaranteed — is unoccupied.

### (b) Is there enough to fork? **Yes — skeletons, not the soul.**
Top 3 fork/foundation candidates:
1. **VS Code platform + `vscode-pull-request-github` (MIT) + CodeTour's ordered-step format** —
   instant V4/V7 (real checkout, LSP nav, native editing), webviews for the chunk-queue UI,
   `.tour`-style JSON as the narrative data model. Cost: extension-UX constraints; we'd fight the
   file-tree paradigm — likely "platform + borrowed pieces" rather than literal fork.
2. **difit (MIT-ish local web review server)** — smallest clean embodiment of our architecture
   (local server + browser diff UI + agent prompt bridge + Claude Code skill). Fork and add
   chunking/ordering, queue state, thread/patch ledger. Risk: we'd rewrite most of it — which is
   also the argument that greenfield costs little more.
3. **Plannotator (Apache-2.0, fully local, 5-harness support)** — the only existing
   **harness-agnostic local feedback loop** (V5/V14 core); graft narrative reading + queue
   semantics onto it, or lift its agent-integration layer into our own shell.
   *(Runners-up: **hunk** (MIT) as the reference live agent↔session protocol + its skill
   packaging; **ReviewStack** (GPL-2.0) if we want a hosted-GitHub web app; **PR-Agent** (MIT) /
   **Kodus** (AGPLv3) for server-side context/analysis plumbing; **vibe-kanban** (Apache-2.0) for
   worktree/agent orchestration patterns.)*

### (c) Top 3 competitive differentiators for building new
1. **The coverage-guaranteed narrative queue** (V1+V2+V9+V10 as one mechanism): sub-file chunks in
   dependency/story order, pop-until-empty semantics where boring chunks collapse but *nothing*
   silently disappears, sub-file reviewed-state with re-review-only-what-changed (Reviewable's
   matrix one level deeper), and deferred clarification items that close a chunk while parking one
   question. Research backs it (position bias: arXiv:2306.06956; no-universal-order:
   arXiv:2506.10654; 89.8% dislike alphabetical: "Breaking the Alphabet"). Competitors ship
   ordering *without* the guarantee — the guarantee is the moat because confidence-filtering is
   their business model.
2. **Verifiable local-agent patch threads** (V5+V6+V7+V14): threads owned by the reviewer's *own*
   agent via a clean protocol (MCP/skill/file-based — ACP's rise shows the industry is ready);
   every AI iteration lands as an exact, applied-and-rendered patch pinned to its thread;
   manual edits are first-class. hunk/revdiff/difit/Plannotator proved the loop locally; nobody
   does versioned, provably-displayed patch threads. Every funded competitor is structurally
   unable to copy this (their agent is the product; ours is pluggable).
3. **Reviewer-empowerment intelligence, script-first and local** (V3+V8+V11+V12+V13+V14): clearly
   typed non-diff context (callee bodies, old/new nav), bulk-or-on-demand context payloads,
   change-type-aware presentation (generated/parallelism/UI-code — GitClear/SemanticDiff prove
   the detection tech), reviewer-vs-author calibration, own-code-nitpick vs others'-code-bugs
   modes, and review outcomes that **write back into agent instruction files** (CLAUDE.md/
   AGENTS.md) — today every tool *reads* instruction files and hoards learnings in proprietary
   memory; closing that loop turns review into training data the user keeps.

**Bottom line:** narrative ordering has been validated by four independent launches in 12 months
(Devin Review, CodeRabbit Atlas, cubic, Stage/Haystack) — we'd be late to *that* alone. The open,
defensible ground is the combination no one holds: **guaranteed-coverage reading + your own local
agent with verifiable patches + reviewer-side intelligence that feeds your instruction files** —
local-first and harness-agnostic, borrowing Plannotator/hunk/difit's agent-bridge patterns,
CodeTour's ordered-step data model, Reviewable's review-state semantics, and (probably) VS Code or
a local web server as the shell. Beware the one strategic risk both HN and the Devin writeups
flag: **"GitHub has gravity"** — a second review surface must be near-zero-friction to adopt.
