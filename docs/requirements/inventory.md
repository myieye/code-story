# Requirements inventory

Every requirement extracted from the [original prompt](../vision/original-prompt.md) and its
addenda ([2026-07-16](../vision/addendum-2026-07-16.md),
[PR versions](../vision/addendum-2026-07-16-pr-versions.md),
[editor features](../vision/addendum-2026-07-16-editor-features.md),
[ordering preferences](../vision/addendum-2026-07-17-ordering-preferences.md),
[review-UX feedback](../vision/addendum-2026-07-20-review-ux-feedback.md),
[AI pipeline](../vision/addendum-2026-07-20-ai-pipeline.md)), numbered for traceability. Future passes over the
prompts should check each tidbit against this list and against the implementation. Each entry: the requirement, its source in the prompt (paraphrased quote), and
open questions to resolve during spec work.

Status legend: `captured` (in this doc only), `specced`, `built`, `validated`.
Entries advance individually via a `Status:` line; entries without one are `captured`.

## A. Coverage & structure

### R-001 — Total diff coverage
No part of the diff/branch/PR may be excluded from the review. The whole diff is treated like a
queue: items are popped/processed until everything has been handled, and the entire diff remains
represented and accessible at all times.
> "Don't exclude any part of the diff/branch/PR." / "There needs to be insurance that all the code is handled to some extent. e.g. treat the whole diff as a queue and pop things until everything's been processed."

Open question resolved ([spec 00a](../spec/00a-book-ui.md)): a visible stub is *not* "handled" —
explicit acknowledgment is required, batchable per enumerated group (with undo), so
misclassified low-signal chunks can't slip through while lockfiles don't demand 40 keystrokes.

Status: `specced` — [spec 00](../spec/00-chunker-and-naive-book.md), [spec 00a](../spec/00a-book-ui.md)

### R-002 — Initial collapsing of low-signal parts
Some parts (lockfiles, generated code, mechanical renames…) can start collapsed — but never
removed (see R-001).
> "certainly some things can potentially be initially collapsed"

Status: `specced` — [spec 00](../spec/00-chunker-and-naive-book.md)

### R-003 — Sub-file chunk granularity
The unit of review is smaller than a file: most methods individually, and smaller pieces of larger
methods/chunks.
> "Likely smaller chunks then the file-level" / "Fairly granular: most methods, but also smaller pieces of larger methods/chunks of code."

Open: how chunk identity survives rebases/edits (algorithm resolved: hunk ∩ tree-sitter symbol
boundaries, spec 00).

Status: `specced` (identity across head moves still open) — [spec 00](../spec/00-chunker-and-naive-book.md)

### R-004 — Chunks may recur; occurrences are linked
A chunk may appear in multiple places in the narrative (e.g. when explaining flows through other
areas). Each occurrence is marked ("nth time you're seeing this") with navigation between
occurrences.
> "there should not be a restriction only letting each diff section appear only once… marked noting that it's the nth time I'm seeing it and letting me jump between the different occurences."

### R-005 — "Reads like a book" narrative ordering
The diff is presented as a linear narrative with every piece of code explicitly referenced at
reasonable granularity. The book format should itself be machine-assessable: an AI can score the
"readability" of the generated book. This is a paradigm, not the entire product feel.
> "making the diff/PR/branch sort of read like a book… That format could potentially be fed to an AI model to assess the 'readability' of the 'book'."

Open: ordering heuristics (dependency order? data-flow? entry-points-first?), and whether the
reviewer can reorder.

Status: `specced` (partial: linear book + machine-assessable export; AI ordering is M1) —
[spec 00](../spec/00-chunker-and-naive-book.md)

## B. Context & navigation

### R-006 — Inline context, visually distinct from the diff
Alongside a diff chunk, show relevant non-diff code (e.g. bodies of methods the diff calls). It
must be unmistakable what is diff and what is context.
> "Potentially shows the diff itself as well as maybe some of the methods that the diff calls. Needs to be clear what the diff is and what is not the diff"

### R-007 — Fast navigation into old AND new code
Seamless, fast navigation to any code referenced by the diff — in both the base and head versions.
> "it should be possible to seamlessly navigate to/view code referenced by the diff (both old and new). Should be fast."

Amended ([editor-features addendum](../vision/addendum-2026-07-16-editor-features.md)): the
exact affordance is open (ctrl+click, or a "rummage" dialog for free navigation) and it is not
the main workflow — deferring the feature is fine, but **the architecture must never make it
impossible**. Door-stays-open check for every design: can a definition lookup (SCIP/ctags/LSP)
be bolted onto this later without rework?
> "real-code context should be readily available somehow… Maybe we just open a dialog when a user can rummage and navigation as much as they want? … it's not necessarily the main work flow. So perhaps defer?" / "I'm concerned it would be totally impossible if we didn't plan for it."

Open: navigation on the *old* version requires either a live checkout/worktree of base or a
precomputed index (SCIP/ctags) — decide per platform.

### R-008 — Context payloads: proactive + on-demand + bulk
AI generates "context payloads" for code/lines/methods/elements/classes/files it predicts need
them; the same context is loadable on demand for any part of the diff (maybe any code at all).
Because loading takes time, bulk generation is preferred where possible.
> "Generates 'context payload' for code… that thinks it needs it, but allows loading the same context easily on-demand" / "when possible doing it in bulk would be preferable"

Open: define the payload schema (summary, callers/callees, related tests, history, risk notes?).

### R-009 — Adaptive depth, never fully predictable
Some chunks need thorough contextual descriptions, some can be easily collapsed; the system will
never perfectly know which — so depth must be cheaply adjustable by the reviewer.
> "Some stuff needs thorough contextual descriptions, some can be easily collapsed" / "Will probably never know exactly what things need thorough context"

## C. AI iteration & threads

### R-010 — Local, code-anchored AI threads
The reviewer can annotate/comment on code as a thread that is local-only, for iterating with AI:
the reviewer starts a thread, and the local agent replies *in the context of that thread* rather
than dumping a wall of text about what it changed.
> "a thread that is either local only for iterating with AI (i.e. I start a thread and Claude on my machine replies in the context of the same thread…)"

### R-011 — Patch-only AI changes, verifiably displayed
When AI changes code referenced by a thread, every version/iteration is easily viewable, and the
system guarantees the displayed diffs exactly match what was applied. Candidate mechanism: the AI
never writes files directly — it emits patches which the tool applies and links to the thread.
Slower, but structurally guarantees the shown diff is complete and exact.
> "Perhaps AI never actually writes code directly, but only writes… patches and then applies those and links them to comments?" / "ensure AI can view different iteration versions and be confident that the change… is truly displayed in its entirety"

Open: enforcement per harness (deny Edit/Write, expose an `apply_patch`-style tool via MCP?);
handling of patches that no longer apply after manual edits.

### R-012 — Painless manual editing
Editing the code by hand must be totally frictionless, coexisting with AI patch flow (R-011) and
review state (R-014) without corruption.
> "It should obviously be totally painless for me to edit the code manually."

### R-013 — AI on tap for explain/iterate/refactor
AI is readily available at any point for explaining, iterating, and refactoring.
> "AI is readily available for iterating, explaining and refactoring."

## D. Review workflow

### R-014 — Sub-file review-progress tracking
Track what has been reviewed at chunk granularity, not GitHub's file-level "viewed" checkbox.
> "User should be able to track what parts they've already reviewed. (Not just files scope like GH)"

Open: how state survives new pushes/rebases (re-open only affected chunks).

Status: `specced` (partial: fixed-head state only; re-open-on-change deferred) —
[spec 00](../spec/00-chunker-and-naive-book.md)

### R-015 — Defer-with-question ("reviewed except this one thing")
Mark a chunk as essentially reviewed but with one open question. That closes the area while
kicking off an AI enquiry whose answer is presented later — so one unclear line never forces
re-reviewing a whole file.
> "that perhaps 'closes' that code area in general, but kicks of an AI enquiry that will be presented again later on essentially deferring the little tricky things."

### R-016 — First-sweep mode with bulk context requests
Support a workflow where the reviewer does a quick first pass, flagging chunks they'll want context
for; flagged context is then generated in bulk in the background.
> "Perhaps the reviewer typically does a first sweep, noting things they want context for? Loading context can take time, so when possible doing it in bulk would be preferable"

## E. Adaptivity

### R-017 — Reviewer/author model
Consider code complexity and the reviewer's skill and knowledge (tools, languages, packages, parts
of the codebase) — including relative to the author — when deciding depth of explanation.
> "Considers code complexity, the skill of the reviewer vs the author, the knowledge of the reviewer regarding tools, languages, packages, parts of the code base etc"

Open: how this profile is captured (explicit config? inferred from history?) and kept non-creepy.

### R-018 — Change-type detection
Detect and specially handle change types: generated code, especially complex changes, tricky
parallelism/concurrency, and UI code.
> "Detects change types: generated, especially complex changes, tricky parallelism, UI code"

### R-019 — UI-code mode; the diluted↔dense spectrum
UI code needs linked back-and-forth navigation between markup (HTML/Svelte/XAML…) and the handlers
/variables it references, plus flow checks (loading states in the right places at the right
times). UI code tends to be *diluted* (big visual diff, low density) while backend code is *dense* —
two ends of a spectrum demanding different presentation and tooling.
> "you often need to jump back and forth between the UI code e.g. html and the code it references/uses" / "UI code is often very diluted, while backend code tends to be more dense"

### R-020 — Author-aware review posture
If the author is me/my agent: work out every wrinkle, don't shy from nitpicks. If someone else:
focus on real bugs and clear, objective improvements.
> "If it's my/my agent then it should be helping work out every wrinkle… Of it's someone else's then we're more looking for real bugs and clear objective improvements."

## F. Learning loop

### R-021 — Feed findings into agent instructions
UI and/or automatic suggestions for things that should become agent instructions (repo-level or
user/local/global) — e.g. "regression JSON deserialization files need instructions on how to
validate whether added JSON is worth keeping."
> "provide UI and/or automatic suggestions for things that should feed into agent instructions (repo or user/local/global)"

## G. Platform & architecture

### R-022 — Agent-harness agnostic via a clean protocol
Works with any local agent through a clean protocol — MCP server, ACP, or a file-based protocol of
our own. Not tied to one AI product.
> "Our tool needs to be agent harness/tool agnostic. E.g. MCP server or just our own write-to-file protocol or similar."

### R-023 — Works on a Claude subscription
The author must be able to power it with their Claude subscription (Claude Code); others use their
own agents.
> "I need to be able to use my Claude subscription."

### R-024 — Scripts before AI
Never use AI for anything a script can easily do — scripts are faster and free. Heavy
syntax-parsing dependencies are acceptable only where they clearly add value.
> "AI should not be used for anything that a script can easily handle."

### R-025 — Repo-agnostic
languageforge/lexbox is a primary target, but the tool must not be limited to it (multi-language:
C#, Svelte/TS, …).
> "languageforge-lexbox is a project/repo I would use the reviewing tool for, but it should not be limited to that repo."

### R-026 — Humans in the forefront (anti-persuasion)
The tool empowers humans to easily and effectively *critique* code. It must not convince the
reviewer the code is perfect; design against automation bias.
> "ensuring humans are really in the forefront being empowered to easily review, not being convinced by AI that the code is perfect"

### R-027 — Speed as a feature
Navigation must be fast; slow AI work happens in bulk/background so the interactive loop stays
snappy.
> "Should be fast." / "Loading context can take time, so when possible doing it in bulk would be preferable"

## H. Meta / process

### R-028 — Verbatim prompt persistence & traceability passes
The original prompt is persisted verbatim; future passes verify every tidbit is adequately
considered and reflected. (Done: `docs/vision/original-prompt.md`; this inventory is the tracing
instrument.)

### R-029 — UX expertise throughout
This is a full product with many UX aspects; use the ux-expert agent/skill extensively while
building.
> "We will use the ux-expert for lots of things as we build it."

### R-030 — Dogfooding & iteration infrastructure
Choose tooling so the product can be built iteratively: creating issues, recording bugs, trying it
on real PRs, evaluating results, improving, noting limitations.
> "creating issues, recording bugs, trying it out on real PRs, evaluating the results, improving it, noting limitations"

## I. Addendum, 2026-07-16 ([verbatim source](../vision/addendum-2026-07-16.md))

### R-031 — Merge-pragmatism: PR age & size awareness
The tool considers how old and how large the PR is — and more generally has a keen sense of when
to suggest/apply changes vs stop iterating, because getting the PR merged is itself very valuable.
> "consider how old and large the PR is… how to most wisely suggest/apply changes vs not iterating forever, because it's very valuable to get the PR merge[d]"

Relates to: R-020 (posture). Open: which signals (age, size, review rounds, staleness risk) and
how they surface (a "merge pressure" indicator? suppressing low-value suggestions?).

### R-032 — Criticality calibration
Posture also calibrates to how critical the change is: a dev-only feature, a quick vibe-coded
prototype that should ship, or something really critical each deserve different rigor.
> "how critical the change is (e.g. a dev-feature, a quick vibe-code of a prototype we want to get out, something really critical etc.)"

Relates to: R-020, R-031. Open: is criticality declared by the reviewer, inferred, or both?

### R-033 — The story steers toward "responsibly mergeable"
The narration actively helps the reviewer weigh R-031/R-032 trade-offs and find the best path to a
*responsibly mergeable* state — rather than perfecting every detail. Applies to nitpicks and
equally to refactors and optimizations: sometimes valuable, sometimes a real pain.
> "help my find the best way to get a PR to a responsibly mergeable state rather than perfecting every detail. Nitpicks are sometimes good, sometimes just a real pain. (not just nitpicks: refactors, optimizations etc.)"

### R-034 — Chunking quality bar: truly manageable pieces
Breaking hunks into genuinely manageable pieces is *critical path*, not a nice-to-have: the
reviewer should have to think as little as possible and just read a thorough story of the code.
Evidence this is hard: initial attempts to get AI to generate such a story were rather weak — so
chunking/story quality needs its own evaluation loop (see R-005's machine-scored readability and
the dogfood evals in [build-process](../process/build-process.md)).
> "Initial attempts to get AI to generate a story for me were rather weak. It's really critical that the AI breaks hunks up into truly manageable pieces. I want to think as little as possible…"

Sharpens: R-003, R-005.

### R-035 — Manual edits at the point of display
Manual changes happen directly where the code is shown — either editing the code in place, or (if
easier) a script-generated git patch that is applied and then lives in the review/thread history
like any other ledger entry.
> "I can make manual changes directly where the code is shown (either directly to the code or if easier, a git patch could be generated - hopefully via script - and applied (also then living in the history of the review/thread))"

Reinforced ([editor-features addendum](../vision/addendum-2026-07-16-editor-features.md)):
> "Inline code editing is important"

Implementation note for the door: the M0 `DiffView` doc is a *render artifact* (interleaved
del/add/context rows from `unifiedChunkLines`) — inline editing must edit a head-side buffer of
the real file region and emit a patch through the ledger (primitives §5), never edit the
unified render text.

Sharpens: R-011, R-012 — in-place editing is required, not just editor handoff; manual patches
join the same ledger as AI patches.

### R-036 — Narration register: light, accessible, never dense
AI explanations are habitually too dense. The story must read really well — think an exciting
novel's ease, roughly high-school English, written for devs but light and easily accessible.
Avoid overly complex terminology; not dense.
> "I'm constantly overwhelmed with how dense AI generated explanations are… it's incredibly important that the story/narration reads really well… maybe think high-school english… Not too dense, light, easily accessible etc."

Sharpens: R-005, R-008 (`narrative` payloads), R-009. This is a hard acceptance criterion for
every AI-written string in the product — and belongs in the readability eval (R-034).

### R-037 — Patch history persisted outside the reviewed repo
Every generated git patch (AI or manual, per R-011/R-035) is persisted somewhere that is
explicitly *not* part of the repo being reviewed, so versions/changes through the history of a
thread can be compared at any time.
> "The generated git patches should be persisted somewhere (obviously not part of the repo being reviewed) so versions/changes through the history of a thread can be compared."

Sharpens: R-011 (the ledger's storage home). Resolved into ADR 0001: per-repo store under the
user's data directory (e.g. `~/.code-story/`), append-only and content-addressed.

## J. Addendum, 2026-07-16: PR versions ([verbatim source](../vision/addendum-2026-07-16-pr-versions.md))

Scope note (Tim): this whole area is explicitly deferrable — "It might be really hard and
complicated while leaving it out still gets us 80% of what we want." But the paradigm must
ultimately handle it ("find the ultimate solution for also handling this in our paradigm").
Design direction sketched in [pr-versions-sketch](../design/pr-versions-sketch.md).

### R-038 — Version-safe review progress (goal)
New PR versions (pushes during a review) must neither force re-reviewing what hasn't changed
nor let the reviewer spend attention on stale content.
> "prevented reviewers from re-reviewing things as well as from reviewing stale things"

### R-039 — Appended-chapter model; stale stays in place, marked
New version diffs append at the end as additional chapters/sections; superseded content is
never removed or reordered — it stays where it was, visibly marked stale. The entire review
remains one linear top-to-bottom read.
> "Append new diffs at the end in additional chapters" / "Stale things stay where they are and are marked as such" / "the entire review remains a linear top-to-bottom with PR versions… acting as new sections/chapters"

Open: what "marked as such" links to (its superseding occurrence?), and what happens on
force-push/rebase where "incremental" loses meaning.

### R-040 — Incremental and absolute diff views
For a versioned review, both the per-version (incremental) diff and the cumulative diff against
the original base must be viewable.
> "possible to see both the incremental diff as well as the absolute diff against the base"

### R-041 — "Crunch" recompilation to a fresh single story
An operation that recompiles all versions / the current total diff into a single fresh story —
reusing prior AI analysis but adapting it to treat the current diff as the only diff.
> "crunch all version/current total diff into a single story again… Reusing AI analysis, but adapting it so it's treats the current diff as the only diff"

Open: how reviewed-state carries through a crunch (chunk-identity matching must prove a chunk's
final content was already reviewed — coverage can't be taken on faith, R-001/R-026).

## K. Spec 01 scoping, 2026-07-16 ([verbatim source](../vision/addendum-2026-07-16.md))

### R-042 — Use AI's full power where it earns intuition and readability
The counterweight to R-024: never waste tokens on what scripts can do, but never fail to apply
AI where it genuinely makes the result intuitive and readable — Tim marked this "very
important". Every plan/spec must show both halves: what stays script, and where AI is actually
allowed to shine.
> "we need to make sure we're not wasting tokens on things scripts can do, but also not (very important) failing to utilize AI's power to truly create something intuitive and readable."

Status: `specced` — [spec 01](../spec/01-story-ordering.md) (tier ladder: tier 0 script, tier 1 AI gated by eval)

## L. Ordering preferences, 2026-07-17 ([verbatim source](../vision/addendum-2026-07-17-ordering-preferences.md))

### R-043 — Tests before the implementation they exercise
Tim reads a test as the contract: it comes before its implementation in the book. (Corrects
the spec-01 scoping answer, which Tim gave believing the question was about building
code-story itself, not the product's ordering.)
> "I want the tests first, actually."

Amends: spec 01/02's tests-after-their-impl placement.

### R-044 — Consumer-first flow along calling paths
The preferred reading direction is consumers before dependencies — *conditional on
chunk-level ordering being good enough* that the reader flows down each calling path (the
callee arrives right after its call site) instead of carrying IOUs. This inverts the M1
dependencies-first axiom and pulls spec 02's deferred chunk-level interleave toward the
critical path: at whole-file granularity, consumer-first weakens; along call paths, it wins.
> "consumers before dependencies is probably the right order if we truly get the chunk/change
> ordering done well. Then I can smoothly flow through each calling path instead of keeping
> IOU's in my head."

### R-045 — Ordering is thoroughly configurable; defaults are Tim's preferences
Direction (consumer-first vs dependency-first), test placement (before/after/end), and future
ordering choices are user preferences with real configuration — and the shipped defaults are
Tim's picks (R-043, R-044).
> "these are probably user preferences. it would be excellent if they were thoroughly
> configurable but that the defaults are what I prefer."

### R-046 — Whatever is configured, AI calculates/augments it by default
The configured ordering policy is the constraint set; by default an AI pass computes/refines
the actual order within it (the M2 pattern — script skeleton, AI judgment on top — becomes the
default posture for ordering, not an opt-in).
> "whatever is configured, it sounds like it should be calculated/augmented, by default, by AI."

Note: R-046 aligns with the #28 ship verdict (AI order default-on, #71); token cost remains a
live concern Tim voiced in the same breath — bulk AI passes stay visible and controllable.

### R-047 — Narration is held to the code-comment bar
Tim's code-commenting doctrine (session instructions) applies to product narration: a line must
say what the diff cannot say itself ("earns its place — when unsure, it doesn't"); each
rationale is stated once, not repeated across sibling sections; a wrong line is worse than
none; never assert an unverified cause — point at the verifiable symptom instead. Sharpens
R-036 and the sparse-by-design rule; gives #58 (point-don't-assert) its principled form.
> "It's very likely that the commenting instructions in your session are relevant for the narration."

### R-048 — The chunk relationship graph (line-provenance edges, status-visible)
Beneath the linear story (which stays "a really good backbone", R-005), a thorough graph of
chunk-to-chunk relationships: each chunk knows its related chunks, *which lines* are
responsible for each relationship, and each link visibly carries the linked chunk's review
state (reviewed / next-step-only / unexplored-behind-it). A chunk CAN be marked reviewed
before its linked chunks are.
> "each chunk is aware of what chunks it's related to, which lines are responsible for that
> relationship and then it's clearly visible whether that related/linked chunk is already
> approved/reviewed or maybe only the next step, but not everything behind it etc. and the
> current chunk CAN be marked reviewed before all linked chunks are reviewed."

### R-049 — Lawn-mower traversal: free criss-cross with guaranteed coverage, minimal re-review
The reviewer traverses the change graph in whatever order seems most appropriate,
criss-crossing freely, and the system guarantees everything is eventually covered (R-001) —
with small, independently-markable chunks radically minimizing ever re-reviewing the same
chunk twice.
> "traverse the change graph a bit like a mindless lawn mower robot that eventually covers
> everything, criss-crossing through the graph as they seem most appropriate. small chunks can
> be marked as reviewed, to try to radically minimize every rereviewing the same chunk twice."

Research mandate (same message): compare to existing tools "while definitely not letting
existing tools tell us it's bad just because no one has done it."

### R-050 — The model supports various graphs and paths
Plurality is a model property, not a feature: multiple relatedness graphs (edge kinds/layers
can grow — calls, imports, exercises today; data-flow, co-change, semantic later) and multiple
paths (a path/story is a first-class value derived from graph + policy — consumer-first,
dependency-first, test-first, AI-refined — switchable, not a single hardcoded order).
Generalizes R-044/R-045/R-048; spec 05's ChunkEdge.kind and config axes are the seed.
> "yeah, we should have a model that supports various graphs and paths."

## M. Review-UX feedback, 2026-07-20 ([verbatim source](../vision/addendum-2026-07-20-review-ux-feedback.md))

### R-051 — In-file piece orientation and navigation
Every chunk must make obvious which piece of its file it is (e.g. 1 / X), so the reviewer knows
whether there is more of that file and how much; the reviewer can jump between that file's
pieces — probably in place (step through, with a jump back to the primary chunk the piece
represents) — or instead say "show all the chunks like GitHub does, right here".
> "It should be more obvious what piece (e.g. 1 / X) Each segment is in its respective file …
> so I know if there's more and how much and so I can jump to different pieces in that file
> (probably in place e.g. step through? with a jump back to the primary chunk that this piece
> represents. or I can just say 'Show all the chunks like GitHub does right here'."

### R-052 — Visual linking between the feed and the sidebar
What the reviewer sees in the reading pane and the items in the outline sidebar must be
visibly linked (which outline items are on screen / current).
> "there should also be some sort of visual linking between what I see and the items in the sidebar"

### R-053 — Automatic review marking as the reviewer goes through content
A designed pattern (not an accident) for chunks becoming reviewed automatically as the
reviewer moves through the content. Interacts with R-001's ledger honesty and R-026.
> "Design and build a good pattern for things being automatically reviewed as a reviewer goes
> through content."

### R-054 — Mouse navigation is a first-class citizen
Keyboard shortcuts are handy but secondary; never assume the reviewer uses them. Every
capability needs a mouse path. (Strengthens the 2026-07-18 steer that amended R-004.)
> "keyboard shortcuts are handy, but I want mouse navigation to be a first-class citizen.
> don't assume a user will use keyboard shortcuts."

### R-055 — Narration on chunks is wanted (decision)
Tim definitely wants narration on chunks. This closes the "is narration wanted?" half of the
narration gate (#54) and demands the #115 unblock: narration must be visible in the default
(chapter) mode. Quality gates (faithfulness floor, R-047/#58) still apply.
> "I definitely want narration on chunks. what's blacking that?"

### R-056 — Two-word chunk badge
Each chunk gets a short blurb/tag — a badge summarizing the chunk in usually two words
(e.g. "Minor refactor", "Simple Optimization").
> "also a short blurb or tag like 'Minor refactor', 'Simple Optimization'. e.g. a badge that
> summarizes the chunk into usually 2 words."

### R-057 — Reviewing should feel satisfying
Clear progress indicators; nothing too distracting, but something that wows the reviewer is
worth considering — reviewing is a drag and the product should counter that.
> "Also reviewing can be a drag, so think of great ways to make it more satisfying. e.g. clear
> progress indicators. nothing too distracting, but something that wows the reviewer is
> definitely worth considering."

### R-058 — The WHY of the order must be visible
It should be clear why the chunks landed in the order they're in — via narration or a quick
blurb connecting each two sections.
> "It would also be really helpful if it was somehow clear WHY the chunks landed in the order
> they're in. maybe narration handles that, maybe we need a quick blurb that connects each 2
> sections."

### R-059 — Defer lines/chunks to the end of the story (note-to-self or background AI)
The reviewer can defer specific lines to the end of the story, sometimes with a comment for
themselves, sometimes with a prompt for AI that runs in the background and is ready when they
reach the end. For AI prompts, deferring is probably the default but not required — it can
also happen inline.
> "We still need tools for deferring specific lines to the end of the story sometimes with a
> comment for myself and sometimes with a promt for AI that runs in the background and is then
> ready for me when I get to the end. (deferring in that case should probably be the default,
> but not required i.e. it can also just happen inline)"

## N. AI pipeline, 2026-07-20 ([verbatim source](../vision/addendum-2026-07-20-ai-pipeline.md))

### R-060 — The AI glue pipeline (critical architecture)
All AI "glue" (annotations, narration, ordering, badges, deferral answers, …) flows through
one pipeline that optimizes which agent gets called when, with what context, for what task.
Built with the best initial pieces for the final goals, but modular, so pieces can be tweaked
and moved as the tool improves. Critical architecture — build carefully.
> "a good pipeline that optimizes what agents gets called when with what context for what
> task is probably something that would be really valuable. that's something you should
> build. it should be built with the best initial pieces you can think of for our final
> goals, but be modular so that we can tweak and move pieces around later as we learn and
> improve the tool. that's a critical piece of architecture. build it carefully."

## O. Beauty & review flow, 2026-07-23 ([verbatim source](../vision/addendum-2026-07-23-beauty-and-review-flow.md))

### R-061 — Review-state markers on neighbor callees (subconscious cues)
It should be intuitive — without reading docs — that the neighbor strip only shows callees
that are part of the review, via subtle markers of their review state (not yet reviewed,
already reviewed, partially reviewed).
> "It should be intuitive that only in-review callees are shown by somehow adding subconscious
> markers that the code is not yet reviewed or already reviewed (or partially reviewed?) etc."

### R-062 — Make the app beautiful (theme, texture, logo, fonts)
A deliberate visual identity: theme, background, maybe texture, a really cool logo and
favicon, and fonts chosen for flair and professionalism — not standard defaults.
> "just make the whole app prettier! Make it beautiful in an appropriate ways: theme,
> background, maybe some texture? Make a really cool logo and favicon. Don't settle with
> standard fonts, find just the right fonts that give the app flair and make it professional"

### R-063 — Partial-chunk deferral (sharpens R-059)
Defer only a selected part of a chunk, so the reviewed majority stays behind forever and only
the uncertain slice returns at the end. R-059's verbatim already said "specific lines"; the
G3 slice shipped chunk-grained — this closes that gap.
> "I really want to be able to defer only sections of a chunk so I can leave e.g. 80% behind
> me forever and only have to comeback to the 20% I was unsure about."

### R-064 — Ask-AI progress feedback
Asking AI must show visible progress (thinking/running states), not silence until the answer
lands.
> "Asking AI needs more feedback UI e.g. thinking etc."

### R-065 — Self-explanatory labels (no bare "+2")
Compact counts like "(+2)" in definition/link labels must say what they count.
> "the '+2' in the links e.g. 'Import from .... (+2)' are not self-explanatory. That should
> be fixed somehow."

### R-066 — Chunk gist gets forefront placement
The brief ~2-word summary of a chunk is grounding — it belongs up front, before the reviewer
faces a noisy diff.
> "The brief 2-word summary of a chunk should get more forefront placement. It help a
> reviewer ground themself before even looking at what could be an immensly noisy diff. It's
> very helpful knowing the main theme in 2 words."
