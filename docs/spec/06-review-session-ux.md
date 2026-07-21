# Spec 06 — Milestone 6: the review-session UX round

**Status: accepted — Tim's 2026-07-20 feedback IS the scoping decision (vibe mode); design
ratified via ux-expert passes.**

Slices 5 and 6 are **spec 07's first native tasks** (G2 chunk-narration, G3 deferral answers):
their server halves ride the AI glue pipeline and sequence **after spec 07's G1** (the `glue/`
module). Web-only slices 1–4 are independent of the pipeline and can land first.

This round turns the product Tim has been driving into one that *feels* good to review in,
folding in five ratified ux-expert design passes (2026-07-20) — auto-review, deferral, file-piece
nav + feed↔sidebar linking, progress/rationale satisfaction — whose memos carry the full
rationale + rejected alternatives. This spec is the build contract and cites them per slice; it
does **not** re-open their decisions.

## Why this round

Tim's second round of concrete feedback from driving the tryable product (verbatim in
`docs/vision/addendum-2026-07-20-review-ux-feedback.md`, traced R-051–R-059). Nine wants, one
theme: the linear safety net works, but orientation, satisfaction, and the deferral/narration
affordances the vision always promised are missing from the surface. Everything here is UI/UX +
two new AI glue tasks; nothing changes chunking or ordering derivations, so **no CORE_VERSION
bump** this round.

## Traceability

| Req | Want | Slice |
|---|---|---|
| R-052 | Visual linking between feed and sidebar | 1 — scrollspy + linking |
| R-051 | In-file piece orientation + navigation | 2 — file-piece indicator + pieces menu |
| R-053 | Automatic review marking as you read | 3 — auto-read + bulk confirm |
| R-057 | Reviewing should feel satisfying | 4 — segmented progress + chapter beat + done moment |
| R-058 | The WHY of the order must be visible | 4 — "Why this order?" popover |
| R-055 | Narration on chunks is wanted (closes #115) | 5 — chunk narration v2, default-on (= spec 07 G2) |
| R-056 | Two-word chunk badge | 5 — badge (= spec 07 G2) |
| R-059 | Defer chunks to the end (note or background AI) | 6 — deferral (= spec 07 G3) |
| R-054 | Mouse navigation is first-class | cross-cutting AC on every slice |

## Cross-cutting: mouse-first (R-054)

Not a slice — a hard acceptance criterion on all six. Every capability added this round has a
**clickable mouse path**; keyboard is additive only. No new capability may be keyboard-only.
Existing single-key accelerators stay; new ones (`[`/`]`, a confirm key) are optional and never
the sole path. Verified per slice in real headless Chromium on the lexbox books.

## Cross-cutting: the progress cluster (defined once)

Three slices add items to the top-bar progress cluster (`BookPage.tsx:487`); to stop them
fighting over it, the fixed left-to-right layout is:

1. **reviewed count + segmented bar** (slice 4) — `12 / 40 reviewed`, always present.
2. **pending stubs** — `· N pending stubs` (existing).
3. **auto-read confirm** (slice 3) — `· N auto-read ▸ Confirm` (only when any exist).
4. **deferred** (slice 6) — `· N deferred` / `· N deferred · M answers ready` (only when any).
5. **frontier** — `· N interactions open` (existing).
6. **AI indicators** — `AI reading order`, `AI narration: N of M` (existing + slice 5).

Rule: items 3–6 hide at zero; on a narrow window items 5–6 collapse behind a single `AI ▾` count
that expands on click. Nothing blinks or nags — counts are passive; only slice 4's segmented bar
animates (once, ≤220ms).

## Scope / Non-goals

**In scope:** the six slices below. **Non-goals this round** (recorded, not built): the manifest
size ceiling (#116); tier-0 chapter over-fragmentation (#100); seam-transition narration
(rejected in the progress/rationale pass on hallucination grounds); SSE/websockets (the scoped
poll in slice 6 is the only new client mechanism); line-level review state; multi-turn BYO-agent
threads; the v1 narration prompt iteration (#58 stays on spec 03's eval track); deferrals in the
markdown export. Ambitious paths are recorded per slice.

---

## Slice 1 — scrollspy + feed↔sidebar linking (R-052)

**Scope.** Make the outline a live "you-are-here": highlight the current section + occurrence,
auto-expand the current section, auto-scroll the sidebar to follow, all `aria-current`-backed.

**Design** (piece-nav pass, "Ask 2"). Switch the spy value from title-string to **`sectionId`**
(the title match is ambiguous in chapter mode — cross-file occurrences, `file` fallback).
`currentSection` becomes `{ sectionId, occurrenceKey }` derived from the top-most visible row
(reuse `items.find(it => it.end > top)`, `BookPage.tsx:446`). In `OutlineSidebar`: mark the
matching section + occurrence `.current` + `aria-current="true"`; **auto-expand the current
section and collapse the prior auto-expansion**, tracking `autoExpandedId` separately from the
user's manual `expanded` set so manually-opened sections stay open; auto-scroll via
`el.scrollIntoView({ block:'nearest' })` **only when the active item is offscreen**,
`behavior:'auto'` (respect `prefers-reduced-motion`). Never move focus — the spy is passive
visual/ARIA state. **Viewport-range rail (optional-if-cheap):** a faint 2px left accent on
section rows with any chunk in the virtual window (`virtualizer.getVirtualItems()`), distinct
from `.current`; cut if it complicates the diff.

**API/data-model.** None server-side. Web: **`FlatBook` rows gain `sectionId` and
`occurrenceKey` fields (extend `rows.ts`)** — the current title/file derivation is not a drop-in
for the spy, so the row carries the ids directly, and a **walk-back rule keeps the last known
`sectionId` at boundaries** (the highlight never flips to "nowhere"). `currentSection` widens to
`{ sectionId, occurrenceKey } | undefined`; `OutlineSidebar` props gain `currentSectionId`,
`currentOccurrenceKey`. New pure module `scrollspy-logic.ts` (`resolveAutoExpand(currentId,
prevAutoId, manualSet) → { expandedSet, autoExpandedId }`). The spy treats the web-only
`deferred:web` section (slice 6) like any other `sectionId`.

**Acceptance.** Scrolling moves the outline highlight to the matching section within one
scroll-settle; the current section auto-expands and the prior auto-expansion collapses (manual
expansions survive); the sidebar scrolls to keep the active item visible only when offscreen;
the highlight never flickers to "nowhere" at boundaries (keep last id); `aria-current` on both
active rows; clicking any outline row still jumps (unchanged). Mouse-first: automatic + click.

**Deferred/ambitious.** Bidirectional hover-peek — cut as churn on a single-reviewer tool.
Sidebar virtualization — deferred until section counts demand it.

---

## Slice 2 — file-piece indicator + pieces menu (R-051)

**Scope.** Every chunk shows which piece of its file it is (`piece 2 / 5`) and lets the
reviewer step through that file's pieces or jump to the Files view.

**Design** (piece-nav pass, "Ask 1"). Add a **file-position indicator** to the chunk header,
after `chunk-from`/kind, before `chunk-size`: `piece {n} / {total}`, ordered by the file's
distinct chunks sorted on `headRange.start ?? baseRange.start`. It is a **button**
(`aria-haspopup="menu"`, `aria-expanded`) opening a **file-pieces menu** rendered in a
**document-level portal with fixed positioning** (roving-tabindex modeled on `NeighborStrip`) so
the virtualized container can never clip it: one `menuitem` per file chunk in file order,
`[glyph] piece n · {chunkTitle} · {+a −r}` reusing `STATE_GLYPH` (○/•/✓), current piece
`aria-current="true"`; header `Foo.cs — 5 pieces, 3 reviewed`; footer actions
**`Open in Files view`** (`setView('files')` + jump to the file's section) and
**`Mark all 5 pieces reviewed`**. Stepping to a piece is `jumpToNeighbor(pieceChunkId)` —
**reusing the existing back-stack + re-encounter + announce** (Tim's "jump back to the primary
chunk" *is* `goBack`/`b`/`← back`; no second return mechanism). Single-piece files render `Foo.cs
· only piece` as plain text — no dead `1 / 1` control. "Mark all pieces" calls a `setMany` over
the file's chunk ids (mirror `markSection`) recording a `lastBatch` so the existing **Undo batch**
covers it — never a file-level flag. **`lastBatch.prior` snapshots the full `ChunkReview`** per
chunk (incl. `autoRead`, `reviewedVia`), so undo restores exact prior values, not just the enum.

**API/data-model.** None server-side (all data in `BookResponse.chunks`). Web: new pure module
`piece-nav-logic.ts` — `fileOrderIndex(chunks) → Map<chunkId, { n, total, fileChunkIdsInOrder }>`;
menu-item builder with glyph + `+a −r`. Indicator entry passed only to the cursor row (like
`neighborChips`). Optional `[` / `]` step prev/next piece without opening the menu (each a
`jumpToNeighbor`) — ship if trivial, else cut.

**Acceptance.** Every chunk of a multi-piece file shows `piece n / total` in file order; the menu
lists all pieces with correct glyphs, clicking one jumps and `b` returns; the jumped-past chunk
becomes `seen` (never auto-`reviewed`); `Mark all N pieces` marks them and `Undo batch`
**restores exact prior `ChunkReview` values**; the menu is never clipped by the feed; single-piece
files show plain text, no menu; `Open in Files view` lands on that file. Announce names the
file-position ("piece 3 of Foo.cs — unreviewed"). Mouse-first: indicator click → menu → piece.

**Deferred/ambitious.** True stitched full-file diff with unchanged context — not derivable from
the `-U0` ranges-only pipeline; v1 = "Open in Files view", the v2 ambition. A file-level "Viewed"
checkbox — rejected (second source of truth vs per-chunk coverage).

---

## Slice 3 — auto-read + bulk confirm (R-053)

**Scope.** As the reviewer reads, chunks that pass a genuine reading gate enter a distinct
**auto-read** tier that is *not* counted as reviewed; the reviewer promotes them in bulk with one
click. Never silent auto-promotion — R-026 forbids passivity producing a green ledger.

**Design** (auto-review pass). Two provenance **flags** on `ChunkReview`, not a 4th enum state
(coverage denominator, done gate, `findUnreviewed`, `hideReviewed` all key off `=== 'reviewed'`).
A chunk upgrades `seen → autoRead` when **all** hold (thresholds verbatim from the pass): eligible
(not low-signal, not collapsed, **fits within the viewport** — taller chunks need an explicit
mark), ≥60% visible, dwelled continuously for `clamp(300ms × diffLineCount, 1500ms, 8000ms)`, and
**not flung** (velocity >2000 px/s at any moment on screen resets that chunk's dwell to zero). The
**gate is evaluated per occurrence-row**, but **auto-read accrues per-chunk when any one
occurrence clears it** (mirrors `seen`). Explicit marks win and overwrite the flag; unmarking
`reviewed` returns to `autoRead` if the flag is still set, else `seen`. Three **non-modal** confirm moments, all
clickable: (1) **per section** — generalize `batchableSections` to fire when every remaining
chunk is auto-read or stub, header button `Confirm N read in this section` → `Undo confirm (N)`
(single-element morph, focus survives; mixed remainder reads `Confirm 6 (4 read, 2 stubs)`);
(2) **progress cluster** — `N auto-read ▸ Confirm` confirms all; (3) **done/end row** — when the
only gap is unconfirmed auto-read, `Confirm K auto-read as reviewed`. Visuals: sidebar glyph `◑`
between `•` and `✓`; chunk rail dashed + neutral tint vs solid green for explicit; per-chunk
header button `Auto-read — click to confirm`. **The `seen → autoRead` transition is silent**
(ambient, like `seen`); confirms announce via `say()`.

**API/data-model.** Core `ChunkReview` (`review.ts`) gains `autoRead?: true` and
`reviewedVia?: 'explicit' | 'auto'` (absent ⇒ explicit; trivial extension like `markedUnseen`;
`ReviewPatch` matches). **Done gate unchanged** — the bar fill and `done` stay `reviewedCount
=== distinctChunks`; auto-read never turns it green. New web hook `useReadTracking.ts` (sibling
to `useSeenTracking.ts`) + pure `read-tracking-logic.ts` (`gateDecision(item, viewport, dwellMs,
velocity) → boolean`). **The tracking mechanism** is a **scroll-event velocity sampler** (dt
between scroll events) plus **rAF-tick dwell accumulation** per visible occurrence row while
scroll/rendering is active, idle interval when stationary — explicitly **not** the 160 ms
post-settle seen-scan (which cannot observe velocity or continuous dwell). **Dwell accumulates
per `chunkId` across ticks and is never reset by a row-height change.** The done banner gains an
honest provenance line when any reviewed chunk was auto-confirmed: `K of N confirmed from
auto-read (seen at reading pace, then confirmed in bulk)`.

**Acceptance.** A natural-pace walk banks auto-read on dwelt chunks and **zero** on
scrolled-through / flung chunks; stubs and taller-than-viewport chunks never auto-read; auto-read
chunks show `◑` + dashed rail and do **not** fill the progress bar; the three confirm buttons
promote correctly and `Undo confirm` **restores exact prior `ChunkReview` values**; the done
banner stays green-only for true `reviewed` and shows the provenance line; explicit mark stamps
`reviewedVia:'explicit'`. **Cross-slice (3×5):** async narration/badge arrival grows a row
mid-scroll, but dwell is anchored to per-chunk visible-fraction sampled per tick and accumulated
per `chunkId`, so a height change or re-measure **never resets accumulated dwell** — verify
auto-read banking is unaffected when narration lands mid-read. Mouse-first: auto-read accrues from
scrolling; every confirm is a button. `read-tracking-logic.ts` unit-tests each threshold edge.

**Deferred/ambitious.** Auto-confirmed count in the markdown export (ledger honesty, not required
for the interaction). A `c` accelerator to confirm the current section (optional). Threshold
tuning is a dogfood signal — treat `reviewedVia:'auto'` as an eval flag like `markedUnseen`.

---

## Slice 4 — segmented progress, chapter beat, done moment, "Why this order?" (R-057, R-058)

**Scope.** Make progress feel like proximity to a goal, acknowledge chapter completion quietly,
land a substantive done moment, answer "why this order?" — no gamification.

**Design** (progress/rationale pass). Replace the flat `.progress-fill` with a
**chapter-segmented bar**: one segment per section, flex-widthed by chunk count, three
colour-independent states (untouched grey / partial fill / complete = filled + inset tick), 1px
gaps, per-segment `aria-label` `"FilterBar — 3 of 5 reviewed"` (data already in `sectionStats`).
**The bar excludes the web-only `deferred:web` section** (slice 6): those chunks already count in
their home chapters, so a segment would double-count. **Chapter-completion beat**: a new effect
watches `sectionStats`; on the incomplete→complete edge (guarded against unmark→remark churn)
fire the existing toast + `aria-live`. A batch completing **≥1** chapter fires **exactly one
summarizing toast** (`3 chapters done — 2 left`) — never zero, never N; a single completion reads
`Chapter done — FilterBar. 3 chapters left.` **Resume** reframed to proximity: `Resumed — 62%
through. 3 chapters left, next up: FilterBar.` **Done moment**: keep the neutral facts +
per-section table + frontier note; add a hero line `Review complete — all N chunks, M chapters.`
+ `+added −removed lines read. Nothing was skipped — every chunk required your mark.` + (if any)
`k were marked in bulk as low-signal.`; the one motion allowance is the bar animating once to
full (≤220ms, `prefers-reduced-motion` → already full). No streaks, XP, confetti, or sound.
**"Why this order?"**: a quiet text button beside the AI-order indicator opens a non-modal
popover (`ShortcutOverlay` styling) in a **document-level portal with fixed positioning** (never
clipped by the feed) with 2–3 sentences from the active `StoryConfig` — **AI-badged when an AI
order is applied, un-badged factual text when tier-0** (state the deterministic rule, never fake
a narrative). Copy tracks the live `direction`/`testPlacement` so it stays true after a runtime
flip (#114). When the top bar collapses (see hazards), the button moves inside the `AI ▾` popover.

**API/data-model.** None server-side. Web: new pure `progress-logic.ts` —
`segmentModel(sectionStats) → Segment[]`, `chapterCompletionEdges(prev, next) → sectionId[]`
(batch/churn-guarded edge detector), `whyThisOrderCopy(config, aiApplied) → { text, aiBadged }`.
No new persisted state (all data already available — the cheap high-value slice).

**Acceptance.** The bar shows one segment per chapter sized by chunk count (no `deferred:web`
segment), each with correct tri-state fill readable without colour; a batch completing ≥1 chapter
fires exactly one summarizing toast (never zero, never N; not on unmark→remark); resume shows
percent + chapters left; the done banner shows the hero + coverage-guarantee + bulk-provenance
lines and animates to full once; "Why this order?" opens in every state (AI, tier-0, file view)
un-clipped, config-correct, AI-badged only when an AI order is applied, dismiss on Esc/click-out
with focus return. Mouse-first: bar + toast are passive; the popover opens on click.

**Deferred/ambitious.** Elapsed-time / sittings in the summary (needs new timestamp persistence
— the only backend-state piece). Hoverable segments previewing a chapter's rationale + jump.
Between-section connective transitions — **rejected** (density, redundancy with the header blurb,
and the highest hallucination surface, which broke the faithfulness floor in dogfood 4).

---

## Slice 5 — chunk narration v2 + 2-word badges, default-on (R-055, R-056; closes #115)

**Scope.** Narration visible in the **default chapter mode** (spec 03's file-section keying is
invisible there — #115), plus a 2–4-word badge per chunk. Default-on with an opt-out.

**Design.** Re-key narration **per-chunk, order-independent** so the order overlay can never
invalidate it. A new `NarrationOverlayV2` supersedes the section-keyed v1 for chunk lines and
badges; v1 overlays stay *readable* (back-compat) but chapter mode uses only v2. Section-level
intros are unchanged: **file mode keeps v1 section intros; chapter mode headers keep the existing
order-overlay rationales** (`sectionAiLine`). No new section narration. Generation groups chunks
**by file** for prompting (order-independent batches with file context), resumable per batch,
reusing the 6k-token cap + omission-marker machinery. Prompt chunk ids use the **aliased form**
(c1..cN — the #44 truncation lesson); the reply JSON is `{ <alias>: { line, badge } }`, foreign
aliases rejected. The **register gate applies per text**: the line keeps the full spec-03 gate
(length/sentence/judgment-lint/backtick-aware Flesch); the **badge gets a lighter gate — length
+ caps only** (usually 2 words, never more than 4; sentence-case). This runs as a
**`chunk-narration` GlueTask (spec 07)**: unit = file-batch, background lane, auto-kick via the
scheduler's compile trigger, gated by `--no-ai-narration` / `CODE_STORY_NO_AI_NARRATION` (dedupe
+ anti-retry-storm are the scheduler's, not the task's — no bespoke failed-fingerprint Set). This
flips narration from spec-03's opt-in to default-on, on R-055's authority; **lines stay
AI-badged**.

**Faithfulness from day one.** The **new** `narration-chunk-1` prompt bakes in the
point-don't-assert rule (#58's lesson): chunk lines **point at what to check** rather than assert
semantic outcomes. Being a *new* prompt track, spec 03's `narration-4` is untouched.
**Fast-follow (slice-5 task):** run the rubric eval (register + faithfulness floor) **per-chunk**
on two dogfood subjects and **revisit default-on if the floor fails** — the same gate spec 03 uses.

**Web render.** Badge = a small **neutral chip** in the chunk header, AI-labeled tooltip; the
line renders where the existing chunk AI line does (`RowView.tsx:206-210`). **Sentence-case is
deliberate** — lower-case chips read calmer than Title Case; R-056's Title Case examples are
normalized. Low-signal stub rows show **no badge** (they carry their own reason text).
Partial-state honesty retained: `AI narration: N of M` in the cluster.

**API/data-model.** Core `narration.ts`:

```ts
interface NarrationEntryV2 {
  fingerprint: string;   // fnv1a(headSha + CORE_VERSION + chunkId) — order-independent
  line?: string;
  badge?: string;        // usually 2 words, never more than 4; sentence-case
  generatedAt: string;
  gateFailures?: string[];
}
interface NarrationOverlayV2 {
  version: 2;
  model: string;
  promptVersion: string;
  chunks: Record<string, NarrationEntryV2>;   // keyed by chunkId
}
```

`filterFreshNarrationV2` drops entries whose fingerprint mismatches (**fail-open = drop the
entry, never passthrough**). The v2 overlay lives in its **own** file
`reviews/<b12>..<h12>.narration-chunks.json` — the **v1 file is untouched**, so file mode keeps
working after a chapter-mode run and after live #114 flips (the overlays never collide).
`GET /api/narration` gains an optional `chunkEntries` field (fresh-filtered v2) alongside the v1
fields, so one response serves both renders. Generation runs as the `chunk-narration` GlueTask
(spec 07 G2): plan = one unit per file-batch, per-batch persist + resume, auto-kick on compile,
gated by the opt-out flag. **No CORE_VERSION bump** (per-reviewer overlay state).

**Acceptance.** In chapter mode, chunks show an AI line + a ≤4-word badge; the overlay survives
applying/dismissing the order overlay (order-independent fingerprint) and partial regeneration;
the job resumes after a restart with no loss (per-file-batch persistence); aliased ids round-trip
(foreign aliases rejected); the badge passes the lighter gate and the line the full gate; stubs
show no badge; auto-kick runs on compile unless opted out, and a failed fingerprint is not
retried in a storm (the scheduler's failed set). The shared server-test helper disables glue
auto-kick by default (the #71 retrofit) so existing tests never spawn real `claude`; the
auto-kick test opts in explicitly. Mouse-first: badge tooltip on hover/focus, no keyboard.

**Deferred/ambitious.** New section-level chapter narration (chapter mode uses order rationales
for now). Judgment-lint on badges (deferred tightening — the lighter gate is the ratified call).
The book opener in chapter mode. Narration prompt iteration for faithfulness (#58 — stays on spec
03's eval track).

---

## Slice 6 — deferral (R-059)

**Scope.** Defer a chunk to the end of the story with a note-to-self or a background-AI prompt;
for AI, deferring is the default but inline is available.

**Design** (deferral pass — build exactly to it). A **Defer** button in the chunk header
(mirrors `Mark reviewed`) opens an **inline `<details>` popover** — the app's disclosure idiom;
it grows the row, `measureElement` handles the height (the `DefinitionPanel` precedent), never a
floating layer — with one textarea and a **split-button**: primary **`Ask AI & defer`**, sibling
**`Defer with a note`** (morphs to `Defer to end` when empty), caret alternate **`Ask AI inline`**
(answer in place, chunk stays mainline). The Defer button is **disabled on already-reviewed
chunks** (tooltip: `Already reviewed — unmark first`). Deferring **collapses the chunk in place**
to a stub and appends it to a **pinned "Deferred" section**; the chunk **auto-sets `seen`** if
`unseen`. Deferred chunks are simply *not reviewed*, so the done gate (`reviewedCount ===
distinctChunks`) holds the book open — resolution is marking it reviewed.

**The Deferred section is web-only and synthetic.** It is injected into the `FlatBook` **after
compile**, in the web layer — **never into the core `Book`** — so it has **no fingerprint,
ordering, or narration impact** and preserves the no-CORE_VERSION-bump promise. Reserved web
section id **`deferred:web`**. The **outline sidebar** renders it as a trailing section with its
own glyph (⏲) and count; **scrollspy** (slice 1) treats it like any section id; the **segmented
bar** (slice 4) **excludes** it (deferred chunks already count in home chapters — else double).

AI answers come from a **`deferral` GlueTask on spec 07's interactive lane** — so a waiting
answer never queues behind a bulk narration fill. `POST /api/deferrals` persists the record and
calls `scheduler.kick('deferral')`; the scheduler drains FIFO, persists per unit, resumes after
restart, re-asks once then fail-opens to `failed` per deferral. A **scoped ~10s poll** runs only
while any answer is `running` and **self-terminates** when none are; a **passive** cluster count
(`N deferred` → `· M answers ready`) + polite `aria-live` on a `running`→`done` transition —
**never a toast or modal**. Optional captured CM6 selection → `lineRange` metadata (descriptive,
not a review unit); prompt context = the reviewer's text + the chunk's diff + optional `lineRange`.

**Marking reviewed before the answer lands.** Marking a deferred chunk reviewed while its answer
is still `running` **closes** the deferral, but the answer still arrives to its (greyed) card. So
`done` **may** fire with answers still running; when it does, the banner adds one line: `M AI
answers still arriving in Deferred.`

**API/data-model.** Server-owned store `reviews/<b12>..<h12>.deferrals.json`:

```ts
interface Deferral {
  id: string;                 // client-generated
  chunkId: string;
  kind: 'note' | 'ai';
  text: string;               // note body, or AI prompt ('' allowed for a bare bookmark)
  lineRange?: LineRange;      // optional captured CM6 selection
  inline?: boolean;           // ai only: true = answer-in-place, not deferred
  createdAt: string;
  answer?: string;            // filled by the worker
  answerStatus?: 'running' | 'done' | 'failed';
  answerError?: string;
  answeredAt?: string;
}
interface DeferralStoreFile { version: 1; base: string; head: string; deferrals: Deferral[]; }
```

Endpoints: `POST /api/deferrals` (persist; if `kind:'ai'` `scheduler.kick('deferral')`, 202),
`GET /api/deferrals` (`{ deferrals }`), `DELETE /api/deferrals/:id`; resolution reuses
`PATCH /api/review`.

**Single-writer discipline.** *All* writes to `deferrals.json` — `POST`, `DELETE`, and the
GlueTask's answer fills — funnel through the server's **one save-chain** for that file. The task
owns no file handle: it submits a **read-modify-write patch of only its answer fields** through
that chain, so a concurrent `DELETE` and an answer arrival can never clobber each other.

**Per-deferral orphan rule** (replaces `JobRuntime.resolve` reuse — the store now holds many
deferrals with independent statuses). On `GET /api/deferrals`, any `answerStatus:'running'` with
**no live scheduler unit** is rewritten to `failed` (one re-read first, mirroring the established
orphan pattern). New pure web module `defer-logic.ts` (split-button action model,
`shouldPoll(deferrals) → boolean`, in-place stub copy); the server test disables glue auto-kick
by default like every other, opting in only to test the answer task.

**Acceptance.** Defer opens the inline popover (grows the row, never clipped); the Defer button
is disabled on already-reviewed chunks with the unmark-first tooltip; `Ask AI & defer` (disabled
on empty text) collapses the chunk and appends a Deferred-section card, the chunk becomes `seen`;
the task fills answers FIFO on the interactive lane, persists per item, and survives a restart
(orphaned `running` → `failed`, prompt preserved + Retry); a **concurrent `DELETE` and
answer-arrival loses neither** (single save-chain); the scoped poll runs only while answers are
pending and stops itself; inline answers render in a focusable sibling region below the diff
(never inside CM6) with a brief highlight + polite announce; a bare `Defer to end` (empty) works;
the Deferred section is web-only (`deferred:web`), absent when empty, and excluded from the
segmented bar; marking a deferred chunk reviewed while its answer is `running` closes the deferral
yet the answer still lands on the greyed card, and if `done` fires with answers still running the
banner adds `M AI answers still arriving in Deferred.` Mouse-first: buttons + textarea, no new
global key in v1.

**Deferred/ambitious.** True line-level review state; live push/SSE; a dedicated open-defer
keystroke; per-deferral resolution independent of chunk-review (v1 = Remove to discard);
multi-turn AI threads (BYO-agent vision); deferrals in the markdown export; per-deferral model.

---

## Interaction hazards

The slices share surfaces; these are the collisions and their resolutions, each a testable AC.

- **Top-bar crowding (whole bar).** Beyond the progress cluster the bar carries undo-batch,
  next-unreviewed / view-summary, hide-reviewed, the Story/Files toggle, the export link, the
  order-options control (#114), and "Why this order?" (slice 4). Rule: below a width threshold the
  **right-side controls (export, hide-reviewed, order-options) collapse into one `⋯` overflow
  menu** and **"Why this order?" moves inside the `AI ▾` popover**. **Progress-cluster rules
  unchanged** (zero-count items hidden; AI indicators collapse behind `AI ▾`; only the segmented
  bar animates, once, ≤220ms, reduced-motion-safe; nothing blinks).
- **Auto-read vs deferral.** A deferred chunk collapses in place, and **collapsed + stub-shaped
  chunks are ineligible for auto-read** by the gate (diff not rendered) — verify a parked deferral
  never accrues auto-read (it also can't be flung past, being collapsed).
- **Auto-read vs hide-reviewed.** Auto-read chunks are `seen`, not `reviewed`, so hide-reviewed
  keeps them visible (still need confirming). Confirming while hide-reviewed is on makes them
  vanish (the `say()` announce covers it); feed-removed chunks can't accrue auto-read (not rendered).
- **Narration badge vs low-signal stubs.** Stub rows show **no badge** (a "Minor refactor" chip
  on a lockfile is noise) — the renderer skips `isLowSignal` chunks.
- **Scrollspy vs pieces-menu / neighbor jumps.** A jump moves the cursor and scrolls; the spy
  then **follows** the new top-visible section on the next frame — it tracks the viewport, not the
  jump origin, so it never fights the jump (`block:'nearest'` lands the item at the sidebar edge).
- **Done-banner priority when deferrals remain.** An *open* deferral is **unreviewed**, so `done`
  can't fire while one is open; marking it reviewed closes it, so `done` **can** fire with answers
  still arriving (banner line per slice 6). Deferred cards show `M of N still being answered…`.
- **Poll lifecycle vs daemon restart.** The scoped poll self-terminates when no answer is
  `running`; across a restart the per-deferral orphan rule (a `running` with no live scheduler
  unit → `failed`, one re-read first) prevents a spinner the poll would chase forever.

## Testing stance

Every slice extends the headless `*-logic.ts` pattern (no jsdom): new pure modules
`scrollspy-logic`, `piece-nav-logic`, `read-tracking-logic`, `progress-logic`, `defer-logic`.
Server slices (5, 6) get vitest with the `invoke?` seam. **The shared server-test helper disables
glue auto-kick (`autoNarration`/`autoOrder`) by DEFAULT** — a retrofit of the #71 lesson: existing
tests must not spawn real `claude` when narration auto-kick lands; tests exercising auto-kick opt
in. Per-slice browser verification is on the lexbox books in real headless Chromium (hidden-pane
screenshot caveat stands — drive real Chrome). No CORE_VERSION bump; regenerate no overlays.

## Slices (sequenced, filed just-in-time when this spec lands)

1. Scrollspy + linking (R-052) — smallest diff, biggest orientation win; ship first.
2. File-piece indicator + pieces menu (R-051).
3. Auto-read + bulk confirm (R-053).
4. Segmented progress + chapter beat + done moment + "Why this order?" (R-057, R-058).
5. Chunk narration v2 + 2-word badges, default-on (R-055, R-056; closes #115).
6. Deferral (R-059).

Each slice demoable on a real lexbox diff; mouse-first (R-054) verified on every one.
