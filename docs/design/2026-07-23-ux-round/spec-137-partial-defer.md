# Approved UX spec — issue #137: partial-chunk deferral (R-063)

ux-expert recommendation, adopted as the build contract. v1 needs NO data-model change:
`Deferral.lineRange` already exists, RowView already captures the CM6 selection, the AI
prompt already highlights the slice. v1 = discoverable trigger + parent semantics + slice-
scoped card content. Store stays `version: 1`; server and core untouched.

## Q1 — Selection mechanic: floating "Defer lines N–M" pill

- A floating pill appears on text-selection inside the FOCUSED (cursor) chunk's diff,
  anchored near the selection; click opens the EXISTING defer popover pre-seeded with the
  range. (Convention: GitHub's select-lines → floating "+"; Docs/Medium selection toolbars.)
- The header **Defer** button becomes WHOLE-CHUNK ONLY — it stops reading the selection
  (today it silently defers a slice if a selection is active: RowView.tsx:294–301 — that
  hidden-state branch is a slip generator; kill it).
- DiffView.tsx: add `onSelectionChange?: (docLines: {from:number;to:number} | undefined) => void`
  via a CM6 `EditorView.updateListener` on `update.selectionSet`; empty selection → undefined.
  Pass a useCallback-stable handler (editor effect deps include callbacks — don't rebuild the
  view every render).
- RowView.tsx: map reported doc lines through `selectionLineRange(from, to, diffLines)` into
  local `sliceRange` state; render the pill only for the cursor row when defined.
  `onMouseDown={e => e.preventDefault()}` on the pill (keeps selection/focus from clearing
  before onClick — deserves a code comment). Click → open defer popover with the range.
- Position: absolute inside a `position:relative` .diff-view at the vertical offset of
  `view.coordsAtPos(sel.from)` (container-relative), right-aligned. Corner-pin (top-right of
  the diff) is the sanctioned fallback if coord math fights the virtualizer.
- aria-label: "Defer lines 34 to 35 to the end". Enter/m/j/k untouched.
- v1 keyboard path = whole-chunk defer via the header button (outcome parity); true keyboard
  slice-defer (editable from/to inputs in the popover) is named v2.

## Q2 — Parent semantics: slice-defer marks the parent reviewed

- Scope computed once: `deferScope(range, chunkHeadSpan)` — range covers the chunk's full
  changed-line span → 'whole'; strict subset → 'slice'.
- submitDefer (BookPage.tsx:473) branches:
  - slice: set chunk reviewed ('explicit'), do NOT collapse, do NOT set markedUnseen even if
    prior was unseen (selecting lines is engagement evidence); still POST with lineRange.
  - whole: unchanged (collapse + seen-if-unseen).
- Parent header pill (derived, no new state): "⏲ 1 deferred · lines 34–35 →" after the size
  cluster; click jumps to the chunk's Deferred card. Derived via
  `deferredSliceSummary(chunkDeferrals)` → {count, firstRange}.
- Unmark returns the chunk to seen and leaves slices untouched. No new review state, no
  in-diff dimming in v1 (v2: `cm-line-deferred` left-rail).

## Q3 — DeferredCard: per-slice preview

- Each deferral with a lineRange renders its own slice preview EAGERLY inline under its
  `lines N–M` badge: slice rows + 3 context lines each side, gaps preserved.
- `sliceLinesToRange(lines, range, context=3): UnifiedLine[]` in defer-logic.ts — filter rows
  whose (head ?? base) ∈ [start−ctx, end+ctx], preserving gap markers between kept runs;
  headless-tested.
- Card keeps the lazy full-diff toggle, relabeled "Show full chunk diff", and "Go to chunk ↑".

## Q4 — Resolve flow + multiplicity

- A slice is open until "✓ Resolve" (= existing DELETE /api/deferrals/:id). Parent stays
  reviewed on resolve AND on un-defer — never auto-un-review.
- Multiple slices per chunk are fine (each its own Deferral).
- Book-level: parent reviewed + open slices ⇒ done on the main walk, tracked in Deferred —
  deliberate ("leave it behind, come back"). Whole-chunk defers still block done.
- Done banner gains "N item(s) still parked in Deferred." beside the arriving-answers line.
- Focus after Resolve: next deferral's control, else the card's "Go to chunk ↑" (never body).
- v2: additive `resolvedAt` field for a grey resolved-trail that keeps AI answers.

## Q5 — Unify by selection presence

One rule: "Defer parks what you selected; select nothing and it parks the whole chunk."
Popover consequence copy via `deferConsequenceCopy(scope, range)` in defer-logic.ts:
- slice → "Defer lines 34–35 — the rest of this chunk is marked reviewed"
- whole → "Defer this whole chunk to the end — resolve it later" (today's copy)

## Announcements (existing polite aria-live `say`)

- slice submit: "Lines 34–35 deferred. The rest of this chunk is marked reviewed. N remaining."
- whole submit: "Deferred to the end." (unchanged)
- parent pill jump: "Jumped to Deferred: <chunk>."
- resolve: "Resolved. N parked."
- go-to-chunk: "Jumped to <chunk> — reviewed, 1 slice deferred."

## Touch-points

defer-logic.ts (chunkHeadSpan, deferScope, deferConsequenceCopy, deferredSliceSummary,
sliceLinesToRange — all headless + vitest), DiffView.tsx (onSelectionChange), RowView.tsx
(pill, header-defer change, parent pill, popover copy, done-row line), BookPage.tsx
(submitDefer branch, goToDeferredCard, threading), DeferredCard.tsx (per-slice preview,
Resolve label). Server/core: NONE.

## Risks the builder should honor

- Auto-mark-reviewed is the load-bearing assumption; consequence copy must be visible in the
  popover BEFORE submit.
- If pill coord-positioning fights TanStack measurement, corner-pin — appearance-on-selection
  carries the discoverability, not the exact pixel.
- i18n: let pill/copy wrap, don't fix widths.
