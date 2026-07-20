# Spec 06 — Milestone 6: the review-session UX round

**Status: accepted — Tim's 2026-07-20 feedback IS the scoping decision (vibe mode); design
ratified via ux-expert passes.**

This round turns the product Tim has been driving into one that *feels* good to review in. It
folds in five ratified ux-expert design passes (2026-07-20) — auto-review, deferral, file-piece
nav + feed↔sidebar linking, and progress/rationale satisfaction. Those memos carry the full
rationale and rejected-alternatives lists; this spec is the build contract and cites them by
name per slice. It does **not** re-open their decisions.

## Why this round

Tim's second round of concrete feedback from driving the tryable product (verbatim in
`docs/vision/addendum-2026-07-20-review-ux-feedback.md`, traced R-051–R-059). Nine wants, one
theme: the linear safety net works, but orientation, satisfaction, and the deferral/narration
affordances the vision always promised are missing from the surface. Everything here is
UI/UX + one new background job; nothing changes chunking or ordering derivations, so **no
CORE_VERSION bump** this round.

## Traceability

| Req | Want | Slice |
|---|---|---|
| R-052 | Visual linking between feed and sidebar | 1 — scrollspy + linking |
| R-051 | In-file piece orientation + navigation | 2 — file-piece indicator + pieces menu |
| R-053 | Automatic review marking as you read | 3 — auto-read + bulk confirm |
| R-057 | Reviewing should feel satisfying | 4 — segmented progress + chapter beat + done moment |
| R-058 | The WHY of the order must be visible | 4 — "Why this order?" popover |
| R-055 | Narration on chunks is wanted (closes #115) | 5 — chunk narration v2, default-on |
| R-056 | Two-word chunk badge | 5 — badge |
| R-059 | Defer chunks to the end (note or background AI) | 6 — deferral |
| R-054 | Mouse navigation is first-class | cross-cutting AC on every slice |

## Cross-cutting: mouse-first (R-054)

Not a slice — a hard acceptance criterion on all six. Every capability added this round has a
**clickable mouse path**; keyboard is additive only. No new capability may be keyboard-only.
Existing single-key accelerators stay; new ones (`[`/`]`, a confirm key) are optional and
never the sole path. This is verified per slice in real headless Chromium on the lexbox books.

## Cross-cutting: the progress cluster (defined once)

Three slices add items to the top-bar progress cluster (`BookPage.tsx:487`). To stop the
slices fighting over it, the final left-to-right layout is fixed here:

1. **reviewed count + segmented bar** (slice 4) — `12 / 40 reviewed`, always present.
2. **pending stubs** — `· N pending stubs` (existing).
3. **auto-read confirm** (slice 3) — `· N auto-read ▸ Confirm` (only when any auto-read exist).
4. **deferred** (slice 6) — `· N deferred` / `· N deferred · M answers ready` (only when any).
5. **frontier** — `· N interactions open` (existing).
6. **AI indicators** — `AI reading order`, `AI narration: N of M` (existing + slice 5).

Rule: items 3–6 are hidden when their count is zero; when the cluster still crowds on a narrow
window, items 5–6 collapse behind a single `AI ▾` count that expands on click. Nothing here
blinks or nags — counts are passive; only slice 4's segmented bar animates (once, ≤220ms).

## Scope / Non-goals

**In scope:** the six slices below. **Non-goals this round** (recorded, not built): the
manifest size ceiling (#116); tier-0 chapter over-fragmentation (#100); seam-transition
narration ("now that you've seen X…" — rejected in the progress/rationale pass on hallucination
grounds); SSE/websockets (the one scoped poll in slice 6 is the only new client mechanism);
line-level review state; multi-turn BYO-agent threads; narration prompt iteration (#58 stays on
spec 03's eval track); deferrals in the markdown export. Ambitious paths are recorded per slice.

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
`el.scrollIntoView({ block:'nearest' })` **only when the active item is outside the outline's
scroll box**, `behavior:'auto'` (respect `prefers-reduced-motion`, matches the codebase's
instant-scroll stance). Never move focus — the spy is passive visual/ARIA state.

**Viewport-range rail (optional-if-cheap):** a faint 2px left accent on section rows with any
chunk in the virtual window (`virtualizer.getVirtualItems()`), distinct from the filled
`.current`. Cut if it complicates the diff; the single current-highlight is the must-have.

**API/data-model.** None server-side. Web: `currentSection` type widens to
`{ sectionId: string; occurrenceKey: string } | undefined`; `OutlineSidebar` props gain
`currentSectionId`, `currentOccurrenceKey`. New pure module `scrollspy-logic.ts`
(`resolveAutoExpand(currentId, prevAutoId, manualSet) → { expandedSet, autoExpandedId }`).

**Acceptance.** Scrolling the feed moves the outline highlight to the matching section within
one scroll-settle; the current section auto-expands and the previous auto-expansion collapses
(manual expansions survive); the sidebar scrolls to keep the active item visible only when it
was offscreen; the highlight never flickers to "nowhere" at section boundaries (keep last id);
`aria-current` present on both active rows; clicking any outline row still jumps (unchanged).
Mouse-first: entirely automatic + click; no keyboard involved.

**Deferred/ambitious.** Bidirectional hover-peek (hover outline→flash feed and vice versa) —
cut as churn on a single-reviewer tool. Sidebar virtualization — deferred until section (not
occurrence) counts demand it.

---

## Slice 2 — file-piece indicator + pieces menu (R-051)

**Scope.** Every chunk shows which piece of its file it is (`piece 2 / 5`) and lets the
reviewer step through that file's pieces or jump to the Files view.

**Design** (piece-nav pass, "Ask 1"). Add a **file-position indicator** to the chunk header,
after `chunk-from`/kind, before `chunk-size`: `piece {n} / {total}`, ordered by the file's
distinct chunks sorted on `headRange.start ?? baseRange.start`. It is a **button**
(`aria-haspopup="menu"`, `aria-expanded`) opening a **file-pieces menu** (model on
`NeighborStrip` roving-tabindex): one `menuitem` per file chunk in file order —
`[glyph] piece n · {chunkTitle} · {+a −r}`, reusing `STATE_GLYPH` (○/•/✓); current piece
`aria-current="true"`; header `Foo.cs — 5 pieces, 3 reviewed`; footer actions
**`Open in Files view`** (`setView('files')` + jump to the file's section) and
**`Mark all 5 pieces reviewed`**. Stepping to a piece is `jumpToNeighbor(pieceChunkId)` —
**reusing the existing back-stack + re-encounter + announce** (Tim's "jump back to the primary
chunk" *is* `goBack`/`b`/`← back`; do not build a second return mechanism). Single-piece files
render `Foo.cs · only piece` as plain text — no dead `1 / 1` control. "Mark all pieces" calls
a `setMany` over the file's chunk ids (mirror `markSection`) recording a `lastBatch` entry so
the existing **Undo batch** covers it — never a file-level flag (coverage stays per-chunk).

**API/data-model.** None server-side (all data in `BookResponse.chunks`). Web: new pure module
`piece-nav-logic.ts` — `fileOrderIndex(chunks) → Map<chunkId, { n, total, fileChunkIdsInOrder }>`;
menu-item builder with glyph + `+a −r` from the diff. Indicator entry passed only to the cursor
row (like `neighborChips`). Optional `[` / `]` accelerators step prev/next piece without opening
the menu (each a `jumpToNeighbor`) — ship if trivial, else cut.

**Acceptance.** A multi-piece file's every chunk shows `piece n / total` matching file order;
opening the menu lists all pieces with correct glyphs, clicking one jumps and `b` returns; the
jumped-past chunk becomes `seen` (never auto-`reviewed`); `Mark all N pieces` marks them and
`Undo batch` restores exact prior states; single-piece files show plain text, no menu;
`Open in Files view` lands on that file. Announce names the file-position ("piece 3 of Foo.cs —
unreviewed"). Mouse-first: indicator click → menu → click a piece; no key required.

**Deferred/ambitious.** True stitched full-file diff with unchanged context (real GitHub "view
file") — not derivable from the `-U0` ranges-only pipeline; v1 = "Open in Files view", recorded
as the v2 ambition. A file-level "Viewed" checkbox — rejected (second source of truth vs
per-chunk coverage).

---

## Slice 3 — auto-read + bulk confirm (R-053)

**Scope.** As the reviewer reads, chunks that pass a genuine reading gate enter a distinct
**auto-read** tier that is *not* counted as reviewed; the reviewer promotes them to `reviewed`
in bulk with one click. Never silent auto-promotion — R-026 forbids passivity producing a green
ledger.

**Design** (auto-review pass). Two provenance **flags** on `ChunkReview`, not a 4th enum state
(the coverage denominator, done gate, `findUnreviewed`, `hideReviewed` all key off
`=== 'reviewed'` and must not change). A chunk upgrades `seen → autoRead` when **all** hold
(thresholds verbatim from the pass): eligible (not low-signal, not collapsed, **fits within the
viewport** — taller chunks always need an explicit mark), ≥60% visible, dwelled continuously for
`clamp(300ms × diffLineCount, 1500ms, 8000ms)`, and **not flung** (scroll velocity >2000 px/s at
any moment while on screen resets that chunk's dwell to zero). Explicit marks always win and
overwrite the auto flag; unmarking `reviewed` returns to `autoRead` if the flag is still set,
else `seen`. Three **non-modal** confirm moments, all clickable: (1) **per section** — generalize
`batchableSections` to fire when every remaining chunk is auto-read or stub, header button
`Confirm N read in this section` → `Undo confirm (N)` (single-element morph, focus survives;
mixed remainder reads `Confirm 6 (4 read, 2 stubs)`); (2) **progress cluster** — `N auto-read ▸
Confirm` confirms all across the book; (3) **done/end row** — when the only gap is unconfirmed
auto-read, `Confirm K auto-read as reviewed`. Visuals: sidebar glyph `◑` between `•` and `✓`;
chunk rail dashed + neutral tint for auto-read vs solid green for explicit; per-chunk header
button `Auto-read — click to confirm`. **The `seen → autoRead` transition is silent** (ambient,
like `seen`); confirms announce via the existing `say()` channel.

**API/data-model.** Core `ChunkReview` (`review.ts`) gains `autoRead?: true` and
`reviewedVia?: 'explicit' | 'auto'` (absent ⇒ explicit; same trivial extension as
`markedUnseen`; `ReviewPatch` extends to match). **Done gate unchanged** — the bar fill and
`done` stay `reviewedCount === distinctChunks`; auto-read never turns it green. New web hook
`useReadTracking.ts` (sibling to `useSeenTracking.ts`) + pure `read-tracking-logic.ts`
(`gateDecision(item, viewport, dwellMs, velocity) → boolean`, the whole gate as a testable
function). Done banner gains an honest provenance line when any reviewed chunk was
auto-confirmed: `K of N confirmed from auto-read (seen at reading pace, then confirmed in bulk)`.

**Acceptance.** Walking a lexbox book at a natural pace banks auto-read on dwelt chunks and
**zero** on scrolled-through / flung chunks; stubs and taller-than-viewport chunks never
auto-read; auto-read chunks show `◑` + dashed rail and do **not** fill the progress bar; the
three confirm buttons promote correctly and `Undo confirm` restores prior states; the done
banner stays green-only for true `reviewed` and shows the provenance line; explicit mark on an
auto-read chunk stamps `reviewedVia:'explicit'`. Mouse-first: auto-read accrues from scrolling;
every confirm is a button. `read-tracking-logic.ts` unit-tests the gate at each threshold edge.

**Deferred/ambitious.** Auto-confirmed count in the markdown export (recommended for
end-to-end ledger honesty, not required for the interaction). A `c` keyboard accelerator to
confirm the current section (optional, never required). Threshold tuning is a dogfood signal —
treat `reviewedVia:'auto'` as an eval flag like `markedUnseen`.

---

## Slice 4 — segmented progress, chapter beat, done moment, "Why this order?" (R-057, R-058)

**Scope.** Make progress feel like proximity to a goal, acknowledge chapter completion quietly,
land a substantive done moment, and answer "why this order?" — all without gamification.

**Design** (progress/rationale pass). Replace the flat `.progress-fill` with a
**chapter-segmented bar**: one segment per section, flex-widthed by chunk count, three
colour-independent states (untouched grey / partial green fill / complete = filled + inset tick),
1px gaps, per-segment `aria-label` `"FilterBar — 3 of 5 reviewed"`. Data is already in
`sectionStats`. **Chapter-completion beat**: a new effect watches `sectionStats`; on the
incomplete→complete edge (guarded against batch-mark firing many at once and against
unmark→remark churn) fire the existing toast + `aria-live`: `Chapter done — FilterBar. 3
chapters left.` **Resume** copy reframed to proximity: `Resumed — 62% through. 3 chapters left,
next up: FilterBar.` **Done moment**: keep the neutral facts + per-section table + honest
frontier note; add a hero line `Review complete — all N chunks, M chapters.` + `+added −removed
lines read. Nothing was skipped — every chunk required your mark.` + (if any) `k were marked in
bulk as low-signal.`; the one motion allowance is the bar animating once to full (≤220ms,
`prefers-reduced-motion` → already full). No streaks, XP, confetti, or sound. **"Why this
order?"**: a quiet `Why this order?` text button beside the AI-order indicator opens a
non-modal popover (reuse `ShortcutOverlay` styling) with 2–3 sentences derived from the active
`StoryConfig` — **AI-badged when an AI order is applied, un-badged factual text when tier-0**
(deterministic order has a known rule; state it, never fake a narrative). Copy tracks the live
`direction`/`testPlacement` so it stays true after a runtime flip (#114).

**API/data-model.** None server-side. Web: new pure `progress-logic.ts` —
`segmentModel(sectionStats) → Segment[]`, `chapterCompletionEdges(prev, next) → sectionId[]`
(the batch/churn-guarded edge detector), `whyThisOrderCopy(config, aiApplied) → { text, aiBadged }`.
No new persisted state (all data already available — this is why it's the cheap high-value slice).

**Acceptance.** The bar shows one segment per chapter sized by chunk count, each with correct
tri-state fill readable without colour; completing a chapter fires exactly one toast on the
true edge (not on unmark→remark, not N times on a batch mark); resume shows percent + chapters
left; the done banner shows the hero + coverage-guarantee + bulk-provenance lines and animates
to full once; "Why this order?" opens in every state (AI, tier-0, file view) with config-correct
copy, AI-badged only when an AI order is applied, dismiss on Esc/click-out with focus return.
Mouse-first: bar + toast are passive; the popover opens on click.

**Deferred/ambitious.** Elapsed-time / sittings in the summary (needs new timestamp persistence
— the only piece requiring backend state). Hoverable segments previewing a chapter's rationale
+ jump (nav accelerator). Between-section connective transitions — **rejected** (density,
redundancy with the header blurb, and the highest hallucination surface, which already broke the
faithfulness floor in dogfood 4).

---

## Slice 5 — chunk narration v2 + 2-word badges, default-on (R-055, R-056; closes #115)

**Scope.** Narration visible in the **default chapter mode** (spec 03's file-section keying is
invisible there — #115), plus a 2–4-word badge per chunk. Default-on with an opt-out.

**Design.** Re-key narration **per-chunk, order-independent** so the order overlay can never
invalidate it. A new `NarrationOverlayV2` supersedes the section-keyed v1 for chunk lines and
badges; v1 overlays stay *readable* (back-compat) but chapter mode uses only v2. Section-level
intros are unchanged this round: **file mode keeps v1 section intros; chapter mode headers keep
the existing order-overlay rationales** (already rendered via `sectionAiLine`). No new section
narration. The generation job groups chunks **by file** for prompting (order-independent
batches with file context), one `claude -p` call per file-batch, resumable per batch like
today's per-section persistence, reusing the 6k-token cap + omission-marker machinery. Chunk
ids in the prompt use the **aliased form** (c1..cN — the #44 truncation lesson); the reply JSON
is `{ <alias>: { line, badge } }`, foreign/unknown aliases rejected. The **register gate applies
per text**: the line keeps the full spec-03 gate (length/sentence/judgment-lint/backtick-aware
Flesch); the **badge gets a lighter gate — length + caps only** (≤4 words, sentence-case).
**Auto-kick on compile** like order (#71 pattern): `shouldAutoKickNarration` + a failed-fingerprint
Set (anti-retry-storm, per daemon lifetime) + opt-out `--no-ai-narration` /
`CODE_STORY_NO_AI_NARRATION`. This flips narration from spec-03's opt-in to default-on, on
R-055's authority; **lines stay AI-badged** and #58's point-don't-assert faithfulness iteration
continues on spec 03's eval track — this spec does not bump the narration prompt version for
faithfulness.

**Web render.** Badge = a small **neutral chip** in the chunk header, AI-labeled tooltip;
the chunk line renders where the existing chunk AI line renders (`RowView.tsx:206-210`).
Low-signal stub rows show **no badge** (they carry their own reason text). Partial-state honesty
retained: `AI narration: N of M` in the cluster.

**API/data-model.** Core `narration.ts`:

```ts
interface NarrationEntryV2 {
  fingerprint: string;   // fnv1a(headSha + CORE_VERSION + chunkId) — order-independent
  line?: string;
  badge?: string;        // 2–4 words, sentence-case
  generatedAt: string;
  gateFailures?: string[];
}
interface NarrationOverlayV2 {
  version: 2;
  model: string;
  promptVersion: string;
  chunks: Record<string, NarrationEntryV2>;   // keyed by chunkId
}
type AnyNarrationOverlay = NarrationOverlay | NarrationOverlayV2;  // v1 stays readable
```

`filterFreshNarrationV2` drops entries whose fingerprint mismatches (**fail-open = drop the
entry, never passthrough**). The v2 overlay lives in the **existing** narration file
(`reviews/<b12>..<h12>.narration.json`) as `{ version: 2 }` — a new file shape superseding v1;
old v1 files simply fail freshness and regenerate (acceptable). Server: `runNarrationJobV2`
groups by file, per-batch persist + resume, `invoke?` seam; auto-kick wired like
`kickOrderJob` with the opt-out flag. **No CORE_VERSION bump** (narration is per-reviewer
overlay state, not a chunking/ordering derivation).

**Acceptance.** In chapter mode, chunks show an AI line + a ≤4-word badge; the overlay survives
applying/dismissing the order overlay (order-independent fingerprint) and partial regeneration;
the job resumes after a daemon restart with no loss (per-file-batch persistence); aliased ids
round-trip (foreign aliases rejected); the badge passes the lighter gate and the line the full
gate; stubs show no badge; auto-kick runs on compile unless opted out, and a failed fingerprint
is not retried in a storm. New server test passes `autoNarration:false` (analog of
`autoOrder:false`). Mouse-first: badge tooltip on hover/focus, no keyboard needed.

**Deferred/ambitious.** New section-level chapter narration (chapter mode uses order rationales
for now). Judgment-lint on badges (deferred tightening if dogfood shows reassuring badges — the
lighter gate is the ratified call). The book opener in chapter mode. Narration prompt iteration
for faithfulness (#58 — stays on spec 03's eval track).

---

## Slice 6 — deferral (R-059)

**Scope.** Defer a chunk to the end of the story with a note-to-self or a background-AI prompt;
for AI, deferring is the default but inline is available.

**Design** (deferral pass — build exactly to it). A **Defer** button in the chunk header
(mirrors `Mark reviewed`) opens a `<details>` popover (the app's disclosure idiom) with one
textarea and a **split-button**: primary **`Ask AI & defer`** (default), sibling **`Defer with
a note`** (morphs to `Defer to end` when empty), caret alternate **`Ask AI inline`** (answer in
place, chunk stays mainline). Deferring **collapses the chunk in place** to a stub and appends
it to a **pinned "Deferred" section at the end** (like `LEFTOVERS_SECTION_ID`); the deferred
chunk **auto-sets `seen`** if currently `unseen`. Deferred chunks are simply *not reviewed*, so
the done gate (`reviewedCount === distinctChunks`) holds the book open with **zero change to the
done computation** — resolution is marking the chunk reviewed. AI answers come from a **single
serial background worker** (narration-job-shaped: `JobRuntime` + `claude -p --tools ''`, FIFO
drain, per-item persist, resumable, one re-ask then `failed` fail-open per deferral). A
**scoped ~10s poll** runs only while any answer is `running` and **self-terminates** when none
are; a **passive** progress-cluster count (`N deferred` → `· M answers ready`) + polite
`aria-live` on a `running`→`done` transition — **never a toast or modal** (the reviewer deferred
to avoid interruption). Optional captured CM6 selection → `lineRange` metadata (descriptive, not
a review unit). The deferral prompt context = the reviewer's text + the chunk's diff + optional
`lineRange`.

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

Endpoints: `POST /api/deferrals` (persist; if `kind:'ai'` enqueue the worker, 202),
`GET /api/deferrals` (`{ deferrals }` with `JobRuntime.resolve` orphan handling so a
restart-orphaned `running` reads as `failed`), `DELETE /api/deferrals/:id`. Resolution reuses
`PATCH /api/review`. New pure web module `defer-logic.ts` (split-button action model, poll
lifecycle decision `shouldPoll(deferrals) → boolean`, in-place stub copy). New server test
passes `autoOrder:false` and the `autoNarration:false` analog.

**Acceptance.** Defer opens the popover; `Ask AI & defer` (disabled on empty text) collapses the
chunk and appends a Deferred-section card, the chunk becomes `seen`; the worker fills the answer
FIFO, persists per item, and survives a daemon restart (orphaned `running` → `failed` with the
prompt preserved + a Retry); the scoped poll runs only while answers are pending and stops
itself; inline AI answers render in a focusable sibling region below the diff (never inside CM6)
with a brief highlight + polite announce; a bare `Defer to end` (empty) works; done does **not**
fire while any deferred chunk is unreviewed; the Deferred section is absent when empty.
Mouse-first: the entire flow is buttons + textarea; no new global key in v1.

**Deferred/ambitious.** True line-level review state; live push/SSE (the scoped poll is the one
new client mechanism); a dedicated open-defer keystroke; per-deferral resolution independent of
chunk-review (v1 = Remove to discard); multi-turn AI threads (BYO-agent vision); deferrals in
the markdown export; per-deferral model choice.

---

## Interaction hazards

The slices share surfaces; these are the collisions and their resolutions, each a testable AC.

- **Progress-cluster crowding.** Six potential items. Resolved by the fixed layout above:
  zero-count items hidden; AI indicators collapse behind `AI ▾` on a narrow window. No item
  blinks; only the segmented bar animates (once, ≤220ms, reduced-motion-safe).
- **Auto-read vs deferral.** A deferred chunk collapses in place, and **collapsed + stub-shaped
  chunks are ineligible for auto-read** by the gate (diff not rendered). So a deferred chunk
  **must not accrue auto-read** while parked — verify the gate sees it as ineligible. (It also
  can't be flung into auto-read on the way past, since it's collapsed.)
- **Auto-read vs hide-reviewed.** Auto-read chunks are `seen`, not `reviewed`, so hide-reviewed
  keeps them visible (correct — they still need confirming). Confirming auto-read while
  hide-reviewed is on makes those chunks vanish; that is intended, and the `say()` announce
  covers the disappearance. Auto-read must not accrue for chunks removed from the feed by
  hide-reviewed (they aren't rendered → ineligible).
- **Narration badge vs low-signal stubs.** Stub rows show **no badge** — they already carry a
  reason string, and a "Minor refactor" chip on a lockfile is noise. The badge renderer skips
  `isLowSignal` chunks.
- **Scrollspy vs pieces-menu / neighbor jumps.** A jump (`jumpToNeighbor`, outline click, piece
  step) moves the cursor and scrolls; the spy then **follows** the new top-visible section on
  the next scroll frame — the spy tracks the viewport, not the jump origin, so it never fights
  the jump. Auto-scroll uses `block:'nearest'` so the landed item sits at the sidebar edge, not
  a disorienting recenter.
- **Done-banner priority when deferrals remain.** Deferred chunks are **unreviewed**, so
  `done` cannot fire while any deferral is open — state it plainly. The Deferred section shows
  `M of N still being answered…` with per-card status; the reviewer resolves each by marking it
  reviewed. There is no separate "resolved" axis to reconcile with done.
- **Poll lifecycle vs daemon restart.** The scoped poll self-terminates when no answer is
  `running`; across a daemon restart, `GET /api/deferrals` uses `JobRuntime.resolve` so an
  orphaned `running` reads as `failed` (prompt preserved, Retry offered) rather than a stuck
  spinner the poll would chase forever.

## Testing stance

Every slice extends the headless `*-logic.ts` pattern (no jsdom): new pure modules
`scrollspy-logic`, `piece-nav-logic`, `read-tracking-logic`, `progress-logic`, `defer-logic`.
Server slices (5, 6) get vitest with the `invoke?` seam, and **all new server tests pass
`autoOrder:false` and the new `autoNarration:false` flag** (the #71 composition hazard — a
default-on auto-job otherwise spawns real `claude` in every test). Per-slice browser
verification is on the lexbox books in real headless Chromium (the hidden-pane screenshot caveat
stands — drive real Chrome). No CORE_VERSION bump; regenerate no overlays.

## Slices (sequenced, filed just-in-time when this spec lands)

1. Scrollspy + linking (R-052) — smallest diff, biggest orientation win; ship first.
2. File-piece indicator + pieces menu (R-051).
3. Auto-read + bulk confirm (R-053).
4. Segmented progress + chapter beat + done moment + "Why this order?" (R-057, R-058).
5. Chunk narration v2 + 2-word badges, default-on (R-055, R-056; closes #115).
6. Deferral (R-059).

Each slice demoable on a real lexbox diff; mouse-first (R-054) verified on every one.
