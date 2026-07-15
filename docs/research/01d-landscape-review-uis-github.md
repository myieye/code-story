# Landscape appendix: dedicated review UIs & GitHub's own UX

Deep dive supporting [01-landscape.md](01-landscape.md): Reviewable, CodeApprove, Crocodile,
PullRequest/HackerOne, and GitHub's 2024–2026 PR review UX overhaul.
Research date: 2026-07-15. All claims dated/sourced; items that could not be pinned down are
explicitly marked **unverified**.

---

## 1. Reviewable.io

**Links:** [reviewable.io](https://www.reviewable.io/) · [Docs](https://docs.reviewable.io/) · [Reviews doc (tracking model)](https://docs.reviewable.io/reviews) · [Changelog](https://changelog.reviewable.io/) (redirects to [GitHub CHANGELOG.md](https://github.com/Reviewable/Reviewable/blob/master/CHANGELOG.md)) · [Blog](https://www.reviewable.io/blog/) · [Pricing](https://www.reviewable.io/pricing/) · [Live demo review](https://reviewable.io/reviews/Reviewable/demo/1)

**What it is:** A dedicated code-review web UI layered on GitHub PRs, founded ~2014-2015 by **Piotr Kaminski** (ex-Google; verified via [Cockroach Labs livestream](https://www.youtube.com/watch?v=w3cgXBD7ErQ), [Crunchbase](https://www.crunchbase.com/organization/reviewable), and Reviewable's own ["From Critique to Reviewable"](https://www.reviewable.io/blog/from-critique-to-reviewable/) post, Jan 25, 2025). Explicitly Critique-inspired. Syncs bidirectionally with GitHub PRs; adds side-by-side/incremental diffs, comment/file tracking, custom mergeability logic. Used by Waymo, IBM, Cockroach Labs, Applied Intuition.

**Maintenance status: ACTIVELY MAINTAINED — strongest liveness signal in this cluster.**
- Changelog entries run continuously through **July 2026**: Enterprise releases 4935.7876 (2026-07-09), 4917.7858 (2026-05-29), 4906.7847 (2026-05-06), 4894.7821 (2026-03-30), 4882.7806 (2026-02-28) — roughly monthly cadence ([changelog](https://github.com/Reviewable/Reviewable/blob/master/CHANGELOG.md)).
- Blog revived after ~6-7 quiet years; recent posts: "Introducing the long-awaited sidebar" (Apr 2, 2026), "Publish on Next Push" (May 22, 2025), "From Critique to Reviewable" (Jan 25, 2025) ([blog](https://www.reviewable.io/blog/)).
- **AI/agent move (June 2026):** changelog announces agents can interact with Reviewable **via a CLI or an MCP server**, with separate agent identities that don't require a new GitHub account. This is the closest thing in this cluster to the vision's "agent-harness agnostic" property — though it's aimed at letting agents *participate in* reviews, not at reviewer-side local-agent threads.

**The per-file, per-revision tracking model (its signature feature):**
- Each push is captured as an immutable **revision** (r1, r2, …); provisional revisions freeze once a reviewer engages ([docs](https://docs.reviewable.io/reviews)).
- Reviewers mark **each file reviewed at a specific revision** — the checkmark records "reviewed at rN," per reviewer. When new revisions land, only files changed since your last reviewed revision come back into your queue; you diff exactly rN→rM ("see what Bob did between reviews, instead of re-reviewing the entire PR") ([Tracking Changes blog post](https://www.reviewable.io/blog/tracking-changes-in-a-code-review/)).
- It distinguishes **base-only changes** (rebase artifacts from upstream) from author-initiated changes, so reviewers can skip rebase noise — a form of change-type detection.
- Sidebar shows current diff bounds; counters for files left to review at current bounds, discussions awaiting your reply, and **deferred** files (grey counters with red stripes = postponed until someone else acts) — a real deferred-items mechanism.
- Discussions have **disposition states** (per-participant resolution semantics) that Reviewable itself says can't be mapped onto GitHub's model; comments on old revisions are preserved and shown against the version they targeted, with intelligent line-mapping across rebases.

**Pricing / licensing:** Proprietary SaaS, **not open source** (the Reviewable/Reviewable GitHub repo is only an issue tracker + changelog — not forkable). Free for public repos and personal private repos; Team $8/contributor/mo; Business $16/contributor/mo (SAML, multiple orgs); Enterprise custom, **self-hosted on-prem or dedicated cloud** with GitHub Enterprise Server support ([pricing](https://www.reviewable.io/pricing/)). GitHub-only (no GitLab/Bitbucket).

**Gaps vs the vision:**
- Tracking granularity is **per-file, not sub-file/chunk**; no chunk queue, though "auto-eliding uninteresting deltas" partially covers "collapse the boring parts."
- **No narrative/dependency ordering** — files are file-tree ordered.
- No non-diff context display (callee bodies, referenced code) and no fast navigation into full old/new trees.
- No AI review assistance for the *human reviewer*, no local-agent comment threads, no AI-patch verification. The 2026 CLI/MCP feature makes Reviewable agent-*accessible*, but the reviewer-iterates-with-their-own-agent loop doesn't exist.
- Its coverage guarantee is file-level ("all files reviewed at latest revision" gates approval) — closest existing analogue to the 100%-coverage queue idea, but coarser.

---

## 2. CodeApprove (codeapprove.com)

**Links:** [codeapprove.com](https://codeapprove.com/) · [Pricing page](https://codeapprove.com/pricing) (client-rendered; content not fetchable) · [Feedback repo](https://github.com/codeapprove/feedback) · [Show HN, Jul 10, 2021](https://news.ycombinator.com/item?id=27794883) · [gh CLI extension by a user](https://github.com/rockwotj/gh-ca)

**What it is:** A Critique-style review UI on top of GitHub PRs, built and run **solo by Sam Stern** (GitHub [hatboysam](https://github.com/hatboysam), HN "habosa"/"codeapprove"; ex-Firebase/Google, "Habosa Apps"). Tagline: "The GitHub code review tool for power users," and per the creator: *"a code review UI on GitHub for ex-Googlers who miss Critique"* (HN comment, Dec 18, 2025). Features per the Show HN and creator comments: unresolved comments block approval; unified Conversation/Commits/Files view with keyboard nav; **diff filtered to changes since your last review round**; automatic turn-tracking ("whose turn is it") via assignee flipping based on comment-resolution state — i.e., a Critique-style attention-set mechanism; can add reviewers who aren't repo collaborators; comment on any line of any file. Built in Vue directly on GitHub's APIs; creator says he rewrote the diff viewer 5-6 times for performance ([HN, Aug 5, 2025](https://news.ycombinator.com/item?id=44802669)).

**Status 2025-2026: ALIVE, but a low-activity solo side project. The "open-sourced or shut down" reports do NOT verify.**
- Creator was still actively plugging it on HN on **July 2, 2026** ([comment 48759667](https://news.ycombinator.com/item?id=48759667)) and Dec 18, 2025; on Nov 9, 2024 he wrote "Been running this solo for 4+ years and I have a very modest base of paying customers."
- Site is up (Wayback snapshot Apr 18, 2026); feedback repo's newest issue is Dec 1, 2025.
- I found **no evidence anywhere** (HN search of all comments/stories, web search, GitHub org) of a shutdown or open-sourcing announcement. **Unverified/likely false:** the open-source claim. The only public repos are `codeapprove/feedback` (issue tracker) and an unrelated third-party mirror-ish repo `alicethecoder/codeapprove` (stale since 2021, provenance unclear). No source release under his `hatboysam` account.
- Caveats: 41 open feedback issues, sparse maintainer responses, no marketing presence — the January 2025 HN comment where he himself points people at competitors ("there are so many other good alternatives — Graphite, CodePeer, Reviewable, Codelantis") suggests maintenance-mode energy, not growth.

**Pricing / licensing:** Proprietary, closed source, **not forkable**. Free during 2021 alpha; current pricing exists at codeapprove.com/pricing but the SPA renders no static content — **exact current prices unverified** (has paying customers, so a paid tier exists). GitHub-only.

**Gaps vs the vision:** Per-review-round diffing and attention-set/turn semantics match parts of the vision's progress-tracking spirit, but: no sub-file chunking or ordering, no coverage guarantee/queue, no non-diff context surfacing, no AI anything (creator has explicitly positioned it as human-review tooling in contrast to Graphite's AI pivot), no local-agent threads, single-maintainer bus factor is a serious dependency risk.

---

## 3. Crocodile (crocodile.dev)

**Links:** [crocodile.dev](https://www.crocodile.dev/) · [Show HN, Jun 2022](https://news.ycombinator.com/item?id=31841215) · [Docs](https://www.crocodile.dev/docs)

**What it was:** A GitHub code-review app by **James Lao** (Crocodile Technologies LLC), an ex-Microsoft engineer explicitly recreating Microsoft's internal **CodeFlow** experience. Distinctives: comments **float above the code** in draggable modals connected by a line to the anchor (long threads don't destroy diff readability); comment on **any text selection down to a single character** (not just whole lines); comments survive rebases/line edits instead of going "outdated." Stack: Go backend, Alpine.js/HTMX/Tailwind, Postgres/S3/Redis on DigitalOcean k8s. Pricing was free for OSS, $8/seat/mo for private repos.

**Status: DEAD — verified.** The site itself carries a notice that the platform was **"shutting down in May 2024"** (still visible on crocodile.dev as of this fetch, contact james@crocodile.dev). No activity since. HN reception in 2022 was lukewarm (pricing-vs-GitHub, SOC2, missing suggestion-commits). Closed source; **not forkable**; no evidence of a code release after shutdown.

**Relevance to the vision:** Mostly a cautionary tale (solo third-party review layers struggle commercially), but its selection-level (sub-line!) comment anchoring and rebase-proof comment persistence are prior art for sub-file-granularity review interaction.

---

## 4. PullRequest.com → HackerOne Code

**Links:** [pullrequest.com](https://www.pullrequest.com/) (now titled "HackerOne Code | Ship Secure Code") · [Pricing](https://www.pullrequest.com/pricing/) · [H1 Code product page](https://www.hackerone.com/product/pull-request) · [Acquisition press release, Apr 2022](https://www.hackerone.com/press-release/hackerone-acquires-pullrequest-power-developer-first-security-testing-solutions) · [Customer docs](https://docs.pullrequest.com/customer-documentation) · [Reviewer portal](https://reviewer.pullrequest.com/) · [HackerOne help: Request Code Review](https://docs.hackerone.com/en/articles/8520091-request-code-review)

**What it is / status now:** The reviewer-marketplace **is still operating** in 2025-2026, fully rebranded: customer docs state **"HackerOne PullRequest is now H1 Code"** (transition ongoing — "some parts of our product may still be shown as 'PullRequest'"). It remains on-demand expert human code review by a vetted reviewer network, integrated into GitHub/GitLab/Bitbucket/Azure DevOps PRs, with the reviewer signup pipeline still live ([app.pullrequest.com/signups/reviewer](https://app.pullrequest.com/signups/reviewer)).

**AI pivot: yes, decisively toward security.** H1 Code is now positioned as "code security for the AI era": SAST/SCA plus reasoning models auto-detect vulnerabilities in commits/PRs; HackerOne's AI ("Hai") does **smart review selection** — it triages and routes only high-risk changes (~30-40% of PRs) to human experts; adaptive learning from developer actions; AI-generated context-aware fixes. The generalist "outsource your code review" positioning has effectively become "AI + human hybrid *security* review."

**Pricing / licensing:** Proprietary service. **Team: $129/developer/month** (billed annually, 90-minute median turnaround, two-week trial); Enterprise custom (on-prem proxy, SAML, API access, SLAs) ([pricing](https://www.pullrequest.com/pricing/)). Not open source, not forkable.

**Gaps vs the vision:** Orthogonal to it. It supplies *external* reviewers-as-a-service with an AI security triage layer; it is not tooling that makes *your own* reviewer faster, has no reviewer-side diff UX innovation (reviews happen as ordinary PR comments), no chunking/ordering/progress model, no local-agent loop. Its "smart review selection" is the *opposite* of the vision's 100%-coverage guarantee — it deliberately reviews only the risky subset.

---

## 5. GitHub's own PR review UX, 2024-2026

GitHub has been unusually active here — a genuine (long-overdue, per HN sentiment) overhaul:

**New "Files changed" page (the big one):**
- [Public preview announced Jun 26, 2025](https://github.blog/changelog/2025-06-26-improved-pull-request-files-changed-experience-now-in-public-preview/): faster diff rendering with much lower memory use, keyboard nav + screen-reader landmarks, resizable file tree, comment indicators in the tree, side panel listing all comments, persistent local comment drafts, comments minimized by default (`i` to toggle), initially capped at 300 files. (Widely described as a React rewrite; the changelog itself doesn't name the framework — that detail is **unverified from primary sources**.)
- Iterated near-biweekly: [Jul 17](https://github.blog/changelog/2025-07-17-pull-request-files-changed-public-preview-experience-july-17-updates/), [Jul 31 (rich diffs, tree ordering)](https://github.blog/changelog/2025-07-31-pull-request-files-changed-public-preview-experience-july-31-updates/), [Aug 21 (submodules, review-submission panel)](https://github.blog/changelog/2025-08-21-pull-request-files-changed-public-preview-experience-august-21-updates/), [Sep 11 (perf, higher file limit)](https://github.blog/changelog/2025-09-11-pull-request-files-changed-public-preview-experience-september-11-updates/), [Nov 6 (batch-apply suggestions, new collapse options)](https://github.blog/changelog/2025-11-06-pull-request-files-changed-public-preview-and-merge-experience-november-6-updates/), [Nov 20 (PR description without leaving the page)](https://github.blog/changelog/2025-11-20-pull-request-files-changed-public-preview-november-20-updates/), [**Dec 11, 2025: review commit-by-commit or a commit subset directly from Files changed, improved filtering**](https://github.blog/changelog/2025-12-11-review-commit-by-commit-improved-filtering-and-more-in-the-pull-request-files-changed-public-preview/).
- [**On by default for everyone, Jan 22, 2026**](https://github.blog/changelog/2026-01-22-improved-pull-request-files-changed-page-on-by-default/). 2026 follow-ups: [CODEOWNERS validation + perf (Feb 5)](https://github.blog/changelog/2026-02-05-improved-pull-request-files-changed-february-5-updates/), [all PR-level comments in a panel on the diff page (Feb 19)](https://github.blog/changelog/2026-02-19-access-all-pull-request-comments-without-leaving-the-new-files-changed-page/), [docked side-by-side panels: overview/comments/merge status/alerts (Mar 19)](https://github.blog/changelog/2026-03-19-view-code-and-comments-side-by-side-in-pull-request-files-changed-page/), [quick merge-status access (Mar 5)](https://github.blog/changelog/2026-03-05-quick-access-to-merge-status-in-pull-requests-in-public-preview/). Community feedback thread: [discussion #163932](https://github.com/orgs/community/discussions/163932).

**Merge experience:** [enabled-by-default public preview Feb 12, 2025](https://github.blog/changelog/2025-02-12-improved-pull-request-merge-experience-enabled-by-default-in-public-preview/) → [**GA Mar 4, 2025**](https://github.blog/changelog/2025-03-04-improved-pull-request-merge-experience-is-now-generally-available/) (checks grouped by status, failing first; all merge modes incl. merge queue; ruleset-aware).

**Navigation/tracking primitives (older but load-bearing):** [PR file tree, beta Mar 16, 2022](https://github.blog/changelog/2022-03-16-pull-request-file-tree-beta/) with filtering by extension/viewed/ownership; per-file **"Viewed" checkboxes** (2019-era) persist per reviewer and auto-uncheck when the file changes — GitHub's only review-progress mechanism, strictly file-level. Generated files: `linguist-generated=true` in `.gitattributes` suppresses/collapses files in diffs by default ([docs](https://docs.github.com/en/repositories/working-with-files/managing-files/customizing-how-changed-files-appear-on-github)); large diffs auto-collapse behind "Load diff."

**Copilot code review (bot review, NOT reviewer-assist):**
- [**GA Apr 4, 2025**](https://github.blog/changelog/2025-04-04-copilot-code-review-now-generally-available/) — a Copilot agent you request like a human reviewer; leaves review comments/suggested fixes; 1M+ developers in the first month of preview. Extended: [copilot-instructions.md support GA Aug 6, 2025](https://github.blog/changelog/2025-08-06-copilot-code-review-copilot-instruction-md-support-is-now-generally-available/), [Mobile GA Jul 8, 2025](https://github.blog/changelog/2025-07-08-copilot-code-review-now-generally-available-on-github-mobile/), [auto-review repository rule Sep 10, 2025](https://github.blog/changelog/2025-09-10-copilot-code-review-independent-repository-rule-for-automatic-reviews/), [available to unlicensed org members Dec 17, 2025](https://github.blog/changelog/2025-12-17-copilot-code-review-now-available-for-organization-members-without-a-license/).
- [**Oct 28, 2025: "AI reviews that see the full picture"** (public preview)](https://github.blog/changelog/2025-10-28-new-public-preview-features-in-copilot-code-review-ai-reviews-that-see-the-full-picture/) — agentic tool-calling to gather full project context (code, directory structure, references), CodeQL/ESLint integration, and `@copilot` handoff that applies suggested fixes as a **stacked PR** (note: agent-authored fixes as separate verifiable commits — a cousin of the vision's "AI iterations as exact patches," but bot-side, not reviewer-side).
- [**Jun 2, 2026: "Shape Copilot code review around your team"**](https://github.blog/changelog/2026-06-02-shape-copilot-code-review-around-your-team/) — agent skills + **MCP server connections** pulling org context (issue trackers, docs, service catalogs) into reviews; a "medium analysis tier" routing complex PRs to a higher-reasoning model.

**Copilot Workspace:** technical preview (Apr 2024, [announcement](https://github.blog/news-insights/product-news/github-copilot-workspace/)) received updates through [Jan 2025](https://github.blog/changelog/2025-01-06-copilot-workspace-changelog-january-6-2025/), then was **sunset ~May 30, 2025**, with its concepts folded into the Copilot **coding agent** (GA ~Sep 2025). The sunset date comes from secondary reporting ([Java Code Geeks retrospective, Feb 2026](https://www.javacodegeeks.com/2026/02/github-copilot-workspace-the-agentic-era.html)); the primary changelog entry was not found — **exact date unverified**. Either way it was a task→PR authoring environment, not reviewer tooling.

**What GitHub STILL lacks vs the vision (as of July 2026):**
- **Sub-file progress tracking:** "Viewed" is per-file, binary, and not revision-qualified (it just resets on any change — no Reviewable-style "reviewed at rN" semantics, let alone per-hunk).
- **No diff ordering:** files remain path-ordered; commit-by-commit (Dec 2025) is the only alternative reading order — no dependency/narrative ordering, no "reads like a book."
- **No coverage guarantee/queue semantics:** nothing enforces that every hunk was seen; auto-collapsed large/generated files are precisely "silent exclusion."
- **No non-diff context display:** you can now comment on unchanged lines and see limited surrounding context, but there's no callee/reference surfacing distinguished from the diff, and jumping into the full old-version tree is still clumsy.
- **No local-agent reviewer threads:** Copilot code review is a server-side bot with fixed model plumbing — not harness-agnostic, and the reviewer can't iterate with their own local agent inside a review thread; `@copilot` fixes go to a stacked PR, not an in-thread verifiable patch loop under reviewer control.
- **No change-type detection** beyond generated-file attributes and whitespace toggles; no per-chunk context payloads; no deferred-clarification construct (unresolved threads are the only tool).

---

## Cross-cutting takeaways

1. **Reviewable is the strongest incumbent for the vision's tracking pillar** — per-file/per-revision review state, deferred items, base-only change detection — actively developed and now agent-accessible (CLI/MCP, June 2026), but it stops at file granularity and has no reviewer-side AI loop. Closed source; would have to be integrated with, not forked.
2. **The Critique-clone niche is commercially fragile:** Crocodile dead (May 2024), CodeApprove a barely-maintained solo project, Reviewable the lone durable survivor — while GitHub keeps absorbing their table-stakes features (file tree, viewed state, commit-range review, docked panels).
3. **All AI investment in this space is bot-review (Copilot, H1 Code's Hai triage), not reviewer-assist.** Nobody ships the vision's core: a human reviewer iterating with their *own local* agent, per-chunk, with verifiable patches and coverage guarantees. That quadrant is empty across this entire cluster.

**Unverified items:** CodeApprove current pricing (SPA, unfetchable); the "React rewrite" framing of GitHub's new Files Changed page (secondary sources only); exact Copilot Workspace sunset date (secondary source); provenance of `alicethecoder/codeapprove` repo. The claim that CodeApprove was open-sourced or shut down is **contradicted by evidence** (creator active on HN Jul 2, 2026).
