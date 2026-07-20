I have enough grounding across the code and the convention literature. Writing the design now.

---

# code-story orientation design: file-piece wayfinding (Ask 1) + feed↔outline linking (Ask 2)

**Triage: Tier 2.** Both asks are high-frequency (used continuously during a review) and low-irreversibility (navigation), but the composite is mildly novel because a diff-as-scattered-book has no direct precedent. The saving grace: every *sub-*pattern here is strongly conventional (position indicators, scrollspy/"you-are-here", back-stack return, GitHub file diffs), and the app already ships the exact machinery both asks need. So the dominant design force is **consistency with existing code**, not invention. I did a focused research pass (NN/g navigation, ARIA `aria-current`, WCAG 1.3.1) plus a full read of `BookPage.tsx`, `RowView.tsx`, `OutlineSidebar.tsx`, `rows.ts`, `neighbor-strip-logic.ts`, `model.ts`.

The load-bearing observation: **Ask 1 is the neighbor-strip pattern pointed at a new relation ("same file"), and Ask 2 is a scrollspy the app has already 80%-built** (`currentSection` + `cursorOccurrence` are computed and passed into the sidebar; they're just under-wired). Neither needs new interaction vocabulary. That is the recommendation's backbone.

---

## ASK 1 — "which piece of the file is this, and let me move through the file's pieces"

### Recommendation

Add a **file-position indicator** to the chunk header — `Foo.cs · piece 2 / 5` — that is itself the control: it's a small popover-button opening a **file-pieces menu** listing every chunk of that file in file order, each a click-to-jump target with its state glyph. Stepping to a piece is a **feed jump reusing the existing `jumpToNeighbor` back-stack** (not an in-place swap). "Show all like GitHub" v1 is a one-click **"Open in Files view"** that reuses the existing Files toggle scrolled to that file; the true stitched full-file-with-context diff is explicitly a **v2 cut**. File-level "reviewed" maps to a **batch of per-chunk marks** (undoable), never a new file-level state.

### Why

- **The indicator answers a real orientation loss the book's core design creates.** Chapter mode deliberately scatters a file's chunks (`CLAUDE.md`; `occurrence.label` = "from <file>"). NN/g: *"Failing to indicate the current location is probably the single most common mistake we see on website menus… navigation should show not only where you can go but where you are now"* ([NN/g, You-Are-Here](https://www.nngroup.com/articles/navigation-you-are-here/)). "piece 2 / 5" is the "you are here" for the file dimension the scatter hides.
- **Feed-jump, not in-place swap, because the feed is virtualized and place-sense is fragile.** An in-place swap (chunk morphs to the next piece without moving) fights the virtualizer's measure/re-mount cycle (`estimateRowHeight` + `measureElement` in `RowView.tsx:259`, the double-invoke `scrollToRow` in `BookPage.tsx:139` exists precisely because long jumps land on estimated offsets) and, worse, breaks the reviewer's mental map: the outline, the current-file bar, and the row's own book position would all silently disagree with what's rendered. A jump keeps every existing orientation cue truthful.
- **Reuse `jumpToNeighbor` + back-stack verbatim.** `BookPage.tsx:313` already implements "push origin, move cursor, re-highlight target as a re-encounter (reviewed stays reviewed), announce," and `goBack` (`:324`) + the `← back` button (`:530`) + `b` key already give the return path. Tim's ask — *"step through… with a jump back to the primary chunk"* — **is** this pattern. Building a second return mechanism would violate consistency-beats-local-optimality: the reviewer already learns one back-stack; give them exactly one.
- **Steps mark *seen*, never *reviewed* — and this falls out for free.** `moveCursor` scrolls the target into view, and `useSeenTracking` (`useSeenTracking.ts`) flips it to `seen` once both edges pass through the viewport. Reviewed is reserved for an explicit mark (per-chunk invariant). Identical to how neighbor jumps already behave — no new semantics.
- **"Show all like GitHub" via the existing Files view is nearly free and coverage-safe.** Files view already groups a file's changes in file order (`FILE_MODE_STORY_CONFIG`, `setView('files')` at `:391`). Jumping there is one `changeConfig` call the app already makes. Jakob's Law: reviewers expect "see the whole file" to mean GitHub's file-scoped diff, and Files view is the closest honest primitive we own.
- **A true inline stitched full-file diff is not buildable on today's data and is the right gradual cut.** The pipeline is `-U0`, ranges-only (`CLAUDE.md`; `DiffView` renders `data.diffs[chunk.id]` from hunks with no between-chunk context). GitHub's "expand file" shows *unchanged* context lines we do not have client-side. Per the repo's standing gradual-auto-pick rule, defer it and record the ambitious path.

### Spec

**Indicator (in `RowView.tsx` chunk header, `.chunk-header` ~`:173`).** Place it immediately after the existing `chunk-from` label / kind badge, before `chunk-size`, so file identity reads left-to-right: `title · from Foo.cs · [piece 2 / 5 ▾]`. When the file has only one chunk, render `Foo.cs · only piece` as plain text (no menu) — do not show `1 / 1` as a control (dead affordance).
- **Format:** `piece {n} / {total}` where the ordering is that file's distinct chunks sorted by `headRange.start ?? baseRange.start` (compute once in `BookPage` as `fileOrderIndex: Map<chunkId, {n, total, fileChunkIdsInOrder}>` from `bookData.chunks`; pass the focused chunk's entry down like `neighborChips` is passed only to the cursor row, `:692`). Use **distinct chunks**, not occurrences — position is a property of the file, not the book.
- **It is a button** (`aria-haspopup="menu"`, `aria-expanded`), shown on the cursor row always and on hover/focus for non-cursor rows (matches how the neighbor strip is cursor-scoped).

**File-pieces menu (new small component, model it on `NeighborStrip`/roving-tabindex, `neighbor-strip-logic.ts`).** A popover anchored to the indicator, ARIA `menu` with `menuitem`s:
- One row per file chunk in file order: `[glyph] piece n  ·  {chunkTitle}  ·  {+a −r}`. Glyph = `STATE_GLYPH` reused from `OutlineSidebar.tsx:7` (○/•/✓ — shape-coded, not colour, WCAG 1.4.1). The current piece row is marked `aria-current="true"` and visually flagged.
- **Header row:** `Foo.cs — 5 pieces, 3 reviewed`. 
- **Footer actions:** `Open in Files view` (calls `setView('files')` then jumps to the file's section) and `Mark all 5 pieces reviewed` (see marks, below).
- **Keyboard:** `↑/↓` move, `Enter`/click jumps and closes, `Esc` closes and returns focus to the indicator button; `Home/End` to first/last piece. Clicking a piece = `jumpToNeighbor(pieceChunkId)` (reuses back-stack + re-encounter + announce). This means **stepping is just repeated menu-jumps**; no separate "next piece / prev piece" keystroke is needed for v1 (keep the global keymap lean). *Optional accelerator (can ship or cut):* `[` / `]` step to prev/next piece of the current file without opening the menu, each a `jumpToNeighbor`.

**"Jump back to primary."** No new mechanism. The origin you were on when you opened the menu is pushed to `backStack` by `jumpToNeighbor`; `← back` / `b` returns. Announce on jump already names the target and file (`:321`); extend the message to *"piece 3 of Foo.cs — unreviewed"* so the SR user hears the file-position, not just the symbol.

**File-level "reviewed" = batch of per-chunk marks.** `Mark all N pieces reviewed` calls `review.setMany` over the file's chunk ids (mirroring `markSection`, `:288`) and records a `lastBatch`-style undo entry so the existing `Undo batch` button (`:534`) covers it. **It never sets a file-level flag** — coverage (R-001) and per-chunk state stay the source of truth. Announce: *"5 pieces of Foo.cs marked reviewed. N remaining."*

**States (UI Stack).**
- *Ideal:* multi-piece file, indicator + menu as above.
- *Empty/degenerate:* single-piece file → plain `only piece` text, no menu.
- *Partial:* file where some pieces are low-signal stubs → menu still lists them with their stub glyph; `Mark all` label borrows the section-ack phrasing pattern.
- *Loading:* none — all data is already in `bookData.chunks`; the menu is synchronous.
- *Error:* a piece whose `firstIndexByChunkId` lookup misses (shouldn't happen in-book) → that menu row is disabled with title "not in this book"; jump is a no-op guarded exactly like `jumpToNeighbor:314`.

### Rejected (Ask 1)

- **In-place chunk swap (feed stays, content morphs).** Rejected: fights the virtualizer's measurement (guaranteed layout jump on height change) and desyncs the outline, current-file bar, and back-stack from what's shown — the reviewer's place-sense is the thing we're trying to protect.
- **A dedicated per-file back button separate from the neighbor back-stack.** Rejected: two return mechanisms for one mental model. The existing `b`/`← back` already means "undo my last jump," which is exactly right.
- **Inline stitched full-file diff with unchanged context (true GitHub "view file").** Rejected for v1: not derivable from the `-U0` ranges-only pipeline without new server work; the Files-view jump delivers ~90% of the value now. Recorded as the v2 ambition.
- **A file-level "Viewed" checkbox mirroring GitHub 1:1.** Rejected: introduces a file-level state parallel to per-chunk marks, which breaks the coverage invariant and the occurrence model. The batch-of-marks gesture gives the same one-click feel without a second source of truth.

---

## ASK 2 — visible linking between the feed viewport and the outline

### Recommendation

Turn the already-computed `currentSection`/`cursorOccurrence` into a proper **scrollspy**: highlight the current section and current occurrence with `aria-current`, **auto-expand the current section** (collapsing the previously-auto-expanded one), and **auto-scroll the sidebar** to keep the active item visible — but only when it's out of the sidebar's viewport, and never hijacking the feed. Add a lightweight **viewport-range rail** marking which sections are on screen. Keep linking **feed→outline automatic** and **outline→feed click-to-jump** (already present); **reject hover-peek** as noise for v1.

### Why

- **The single most-cited navigation failure is not showing "where am I."** ([NN/g You-Are-Here](https://www.nngroup.com/articles/navigation-you-are-here/); [NN/g Local Navigation](https://www.nngroup.com/articles/local-navigation/) — local nav "works as an orientation element, similar to a 'You are here' indicator on a map"). The app computes the answer (`currentSection` at `BookPage.tsx:443`, `cursorOccurrence` at `:630`) but under-delivers it: the current-occurrence highlight is **invisible unless the reviewer manually expands the section** (`OutlineSidebar.tsx:28`, `expanded` starts empty), and the sidebar never scrolls to follow. Fixing that is the highest-value, lowest-risk move here.
- **`aria-current` is the established, WCAG-1.3.1-satisfying convention** for "active item in a nav that tracks scroll" (Bootstrap/Boosted scrollspy move `.active` **and** `aria-current` together; [ARIA/WCAG 1.3.1](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html) requires the relationship be programmatically determinable, not colour-only). Today the highlight is a CSS class with no ARIA and no text alternative.
- **Auto-scroll must be conditional and confined to the sidebar.** NN/g and scrollspy practice agree the nav should follow, but unconditional `scrollIntoView` is disorienting and can feel like scroll-hijacking. Confine it to the outline's own scroll container and fire only when the active item is outside it (`block: 'nearest'`), so a reviewer manually browsing the outline isn't yanked.
- **Section-title matching is fragile; switch the spy to id.** `currentSection` returns a **title string** and falls back to `row.chunk.file` (`:443–454`), and the sidebar matches on `section.title === currentSection` (`OutlineSidebar.tsx:38`). In chapter mode a chunk can live outside its anchor file, so the string can match the wrong (or no) outline row. Spy on **section id** instead (available on every chunk row as `row.sectionId`), which is unambiguous.
- **Hover-peek linking is low-value here and risks noise.** A single-reviewer desktop tool with an always-present outline doesn't need hover-to-preview; the scrollspy already answers "which outline item am I on," and click-to-jump answers the reverse. Adding hover highlighting in both directions doubles the visual churn on a virtualized feed for marginal gain — cut it.

### Spec

**Scrollspy core (in `currentSection` computation + `OutlineSidebar`).**
- Change the tracked value from title to `{ sectionId, occurrenceKey }` derived from the top-most fully/first-visible chunk row (reuse the existing `items.find(it => it.end > top)` logic at `:446`). Pass both down.
- In `OutlineSidebar`, mark the matching section row `.current` + `aria-current="true"` (keep the existing `.current` visual, `app.css:286`), and the matching occurrence `.outline-chunk.current` + `aria-current="true"`.
- **Auto-expand the current section, auto-collapse the prior auto-expansion.** Track `autoExpandedId` separately from the user's manual `expanded` set so a reviewer who manually opened extra sections keeps them open; only the *auto* one moves. When `currentSection.sectionId` changes, add it to the render-expanded set and remove the previous auto id (unless the user also manually expanded it).
- **Auto-scroll:** in a `useEffect` on the current occurrence/section, if the active outline element is outside the `.outline` scroll box, call `el.scrollIntoView({ block: 'nearest' })` (respect `prefers-reduced-motion`: use `behavior: 'auto'`, no smooth animation — matches the codebase's existing instant-scroll stance at `jumpToNeighbor:313`).

**Viewport-range rail (lightweight, v1-optional — ship if cheap).** Render a 2px left-edge accent on outline section rows whose section has **any** chunk currently in the virtual window (derive an on-screen `Set<sectionId>` from `virtualizer.getVirtualItems()`, which `BookPage` already reads at `:442`). This shows "these are the sections on screen" vs the single strongest "you are here." Distinct treatment from `.current` (the rail is faint; `.current` is the filled highlight). If it complicates the diff, cut it — the single current highlight is the must-have.

**700-item behaviour.**
- Sections stay rendered (there are far fewer sections than occurrences); **occurrences render only when their section is expanded** — already true (`OutlineSidebar.tsx:66`). With auto-expand-current + collapse-prior, at most one section's occurrences (plus any the user pinned open) are in the DOM, so the occurrence count on screen stays small regardless of a 700-occurrence book.
- Do **not** virtualize the sidebar in v1 — section count is the only thing rendered at rest and it's modest. If a future subject has hundreds of *sections*, revisit (note it in the review doc). 
- Auto-scroll uses `block: 'nearest'` so long jumps (`n`, outline click, file-piece jump) land the active item at the sidebar edge without a disorienting recenter.

**Keyboard / SR.**
- Outline items are already `<button>`s (focusable, `OutlineSidebar.tsx:39,52,73`) — no change.
- `aria-current="true"` on the active section and occurrence is the SR "you are here"; no extra live-region spam (the feed's existing `aria-live` toast at `BookPage.tsx:709` already announces jumps).
- Focus is unaffected: scrollspy is a passive visual/ARIA state change, it must **never** move focus (focus stays in the feed while reading).

**States (UI Stack).**
- *Ideal:* one section highlighted + auto-expanded, current occurrence highlighted, sidebar scrolled to it.
- *First-use / top of book:* first section current; nothing jarring.
- *No-match / leftovers or between sections:* fall back to the last section id seen (guard the `for` loop's `return undefined` at `:453` → keep the previous value rather than clearing the highlight, so it never flickers to "nowhere").
- *Reorder (config change):* `pendingReorder` (`:380`) resets cursor to first-unreviewed; the spy recomputes from the new `flat` on the next scroll frame — no special-casing needed.
- *Loading:* n/a (all client-side).

### Rejected (Ask 2)

- **Bidirectional hover-peek (hover outline → flash the feed chunk; hover feed → flash the outline).** Rejected for v1: on a single-reviewer desktop tool with a persistent outline, the scrollspy + click-to-jump already close both directions; hover doubles visual churn on a virtualized feed for little gain. Revisit only if driving reveals a real "which one is that?" gap.
- **Keep title-based matching, just add auto-scroll.** Rejected: the title string is ambiguous in chapter mode (cross-file occurrences, `file` fallback). Spying on `sectionId` is strictly more correct for the same effort.
- **Unconditional `scrollIntoView` / recenter on every scroll tick.** Rejected: reads as scroll-hijacking and fights a reviewer browsing the outline manually. Conditional `block:'nearest'` only-when-offscreen is the accessible form.
- **Virtualize the sidebar now.** Rejected as premature: with collapse-others, DOM size is bounded by section count. Adds measurement complexity mirroring the feed's for no current payoff.
- **A minimap/scrollbar-overview of the whole book.** Rejected: heavier than the outline we already have; the range-rail gives the "what's on screen" signal at a fraction of the cost.

---

## Shared machinery (both asks lean on it)

- `jumpToNeighbor` + `backStack` + `goBack`/`b`/`← back` (`BookPage.tsx:313–334`) — Ask 1 stepping *is* this.
- `STATE_GLYPH` ○/•/✓ (`OutlineSidebar.tsx:7`) — reuse in the file-pieces menu so state reads identically in three places.
- `moveCursor` + `useSeenTracking` — makes "stepping marks seen, not reviewed" automatic.
- `review.setMany` + `lastBatch`/`Undo batch` (`:288,534`) — file-level "mark all pieces."
- `currentSection`/`cursorOccurrence`/`virtualizer.getVirtualItems()` (`:442–454,630`) — Ask 2 already computes the inputs.

## What v1 explicitly cuts (gradual bias)

1. **Inline stitched full-file diff with unchanged context** (true GitHub "view file"). v1 = "Open in Files view." Blocked on `-U0` pipeline; record as v2.
2. **`[` / `]` step-without-menu accelerator** — nice-to-have; menu-jump covers the need. Ship only if trivial.
3. **Viewport-range rail** on the outline — ship if cheap, cut if it complicates; single current-highlight is the must-have.
4. **Any hover-peek linking** — deferred pending real driving feedback.
5. **Sidebar virtualization** — deferred until section (not occurrence) counts demand it.

## Risks / validate later

- **File ordering by `headRange.start` assumes one contiguous position per chunk.** True for M0/M1 chunks (hunk∩symbol), but a fragment-split chunk spanning gaps could order oddly. Low stakes (it's a menu order); watch during dogfooding.
- **Auto-expand-current could feel "jumpy"** if a reviewer scrolls fast across many small sections. Mitigate with `block:'nearest'` and no smooth animation; if it still churns, debounce the auto-expand on the same 160ms cadence as `useSeenTracking`.
- **"piece N / M" vs the section/chapter count** already shown in the header could read as two competing denominators. Keep them visually distinct: piece-count is file-scoped (with the `from Foo.cs` label), section stats are book-scoped. Confirm on a real multi-file chapter that it doesn't crowd the header — this is exactly the kind of thing Tim's "drive the product" feedback loop will surface.
- The whole design is bench-reasoned against the code; **it hasn't been driven**. The repo's mode is "Tim drives and gives concrete feedback" — the highest-value validation is shipping Ask 2's scrollspy first (smallest diff, biggest orientation win) and letting a real 100+ chunk book expose whether the file-pieces menu or a lighter inline indicator is warranted.

**Sources:** [NN/g You-Are-Here Navigation](https://www.nngroup.com/articles/navigation-you-are-here/) · [NN/g Local Navigation](https://www.nngroup.com/articles/local-navigation/) · [Bootstrap Scrollspy (`aria-current` convention)](https://getbootstrap.com/docs/5.0/components/scrollspy/) · [WCAG 1.3.1 Info & Relationships](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html)