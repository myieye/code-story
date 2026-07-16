# Spec 00a — Book UI (milestone 0)

Status: draft — awaiting Tim's review
Date: 2026-07-16
Parent: [spec 00](00-chunker-and-naive-book.md). Produced via ux-expert pass (R-029).
Design gates honored: R-001 (coverage), R-002 (collapse ≠ removal), R-026 (anti-automation-bias
— a hard gate here, several decisions below exist because of it), R-027 (speed).

Scope note: this spec designs the surface M1 will stack onto, so it names states and affordances
(`deferred`, `reopened`, occurrence cycling) that are **inert in M0** — the rail and keymap
support them; nothing produces them yet.

## Decisions

1. **Book flow**: continuous virtualized scroll + a keyboard-driven **reading cursor** (hybrid).
   Not a pager.
2. **Chunk anatomy**: file = sticky section heading; chunk = flat block with one header row
   (symbol path · badges · ±size · occurrence marker · state) and a left **state rail**; diff
   below; empty slots reserved for M1 prose/context.
3. **Reviewed state**: explicit keystroke only (`Enter` = mark & advance), never on scroll;
   reviewed chunks stay expanded, dimmed via the rail — never auto-collapsed. `seen` is tracked
   automatically, displayed, and never counts toward coverage.
4. **Progress**: top-bar count + thin bar; sidebar outline is the queue; `n` jumps to next
   unreviewed; the done state is a neutral coverage statement, not an endorsement.
5. **Collapsed low-signal chunks**: a visible stub is **not** "handled" — explicit
   acknowledgment required, but batchable per enumerated group. (Resolves R-001's open
   question.)
6. **Page structure**: left collapsible outline sidebar + slim top bar + single centered book
   column (max ~1120px); right gutter left empty for M1.

## Why

- **Hybrid flow, not pager.** A one-chunk-at-a-time pager couples "make progress" to "mark
  reviewed" — exactly the swipe-momentum mechanism R-026 forbids — and hides same-file
  neighbors, which diluted UI code needs (R-019, vision). Pure scroll gives no unambiguous
  target for "mark this reviewed." Scroll-plus-cursor is the established power-reviewer
  convention (Gerrit's fully keyboard-driven review UI; Gmail's j/k lineage; GitHub's new Files
  Changed keyboard nav). The accessible skeleton is the ARIA APG **feed** pattern
  (https://www.w3.org/WAI/ARIA/apg/patterns/feed/), which anticipates virtualized loading.
- **Explicit marking only.** Eye-tracking shows reviewers fixate on a small fraction of lines
  (research 04, Part D) — scroll position is not attention, so auto-mark-on-scroll fabricates
  coverage; low coverage measurably ships defects (McIntosh MSR'14). The label is "Reviewed,"
  never "Approve/LGTM" — the tool must not sell the code (R-026).
- **Reviewed ≠ collapsed.** GitHub/Reviewable collapse-on-viewed optimizes for triage; this tool
  optimizes for *reading a book* — later chunks in the same file need reviewed neighbors visible
  (R-019). Dimming the rail keeps state visible without reducing code contrast.
- **Stub ≠ handled.** GitHub's auto-collapse of generated files is the "silent exclusion" this
  repo's research critiques (research 01d), and M0's classifier is dumb path-matching —
  misclassification is certain eventually, so a human keystroke must close every chunk. But
  forcing ~40 individual acks on a lockfile trains click-through (confirmation fatigue). Batch
  acknowledgment of a visibly enumerated group, with undo, is the calibrated middle.
- **No gamified progress.** Goal-gradient acceleration near 100% is an anti-quality force at
  end-of-review; progress stays numeric and quiet.
- **Sidebar outline.** "Always know what's left" needs a persistent answer (visibility of system
  status); Reviewable independently converged on the same sidebar-with-counters shape.

## Component tree

```
<BookPage>
├── <TopBar>            repo + range title · <ProgressCluster> · [Next unreviewed] · [Export] · [?]
├── <OutlineSidebar>    collapsible, ~280px, virtualized
│   └── <OutlineSection>*   file path · state summary "5/7" · expandable chunk rows (symbol, state dot)
└── <BookFeed>          role="feed", virtualized scroll container
    ├── <SectionHeader>*    sticky; file path · per-section progress · [Mark all N reviewed] (only when
    │                       every unreviewed chunk in the section is a collapsed stub)
    ├── <ChunkBlock>*       role="article", aria-posinset/aria-setsize, tabindex=-1
    │   ├── <StateRail>     left edge strip: unseen | seen | reviewed | deferred | reopened; doubles as cursor ring
    │   ├── <ChunkHeader>   state icon · symbolPath (primary, mono) · kind/changeType badges ·
    │   │                   "+120 −8" · occurrence marker "2nd of 3 ▸" (cycles occurrences, R-004) ·
    │   │                   file-path subtitle only when block renders outside its own file section
    │   ├── <ProseSlot/>    empty in M0 — M1 narration mounts here, above the diff
    │   ├── <DiffView>      CM6 unified merge view, read-only (ADR 0001); horizontal scroll for long lines
    │   └── <ContextDrawer/> empty in M0 — M1 context payloads mount here, below the diff
    └── <EndOfBook>         terminal block: done banner or "N remaining — jump to next" link
```

Collapsed stub = `<ChunkBlock collapsed>`: header + reason badge ("lockfile" / "generated" /
rule name) + "Show diff"; `<DiffView>` unmounted (perf win — these are the largest chunks).

## Flow & virtualization

- One vertical document, occurrence order (M0: file-grouped). Virtualize with variable-size
  measurement (TanStack Virtual or react-virtuoso): estimate block height from line count, cache
  measured heights, overscan ~2 viewports. CM6 `EditorView`s exist only for materialized blocks.
  The **cursor chunk is always kept mounted** even off-screen so focus and marking never race
  the virtualizer.
- Exactly one **current chunk** (cursor). Keyboard acts on it; click anywhere in a block sets
  it; mouse scroll never moves it. Cursor motion scrolls the block's header to ~8px below the
  sticky section header; instant (no smooth-scroll) when `prefers-reduced-motion`.
- Known tradeoff: virtualization breaks browser Ctrl-F. Accepted for M0; outline filter/search
  is the later answer.

## Keyboard map

Active when focus is on a chunk container or the feed; never inside CM or inputs.

| Key | Action |
|---|---|
| `j` / `k` (and `PageDown`/`PageUp`, per APG feed) | cursor to next / previous chunk |
| `n` / `Shift+N` | next / previous **unreviewed** chunk (wraps; wrap announced) |
| `Enter` | mark current chunk reviewed, advance to next unreviewed after it. **Ignore key-repeat** — each mark requires a fresh keydown (structural anti-machine-gunning, R-026). No-op while focus is inside the CM editor. |
| `u` | unmark current chunk (undo, no confirmation) |
| `x` | expand/collapse current chunk (works on stubs and reviewed chunks) |
| `o` | cycle to next occurrence of current chunk (R-004; inert in M0) |
| `Ctrl+Home` / `Ctrl+End` | top / end of book |
| `Tab` / `Esc` | into current chunk's interactive elements (CM selection, links) / back to chunk container |
| `?` | shortcut overlay (Gerrit/Gmail convention) |

## Review-state rules

- `unseen → seen` automatic: the chunk's entire body has been inside the viewport at least
  once. Displayed (rail + outline dot) but **never counts toward coverage**.
- `seen/unseen → reviewed` only via explicit action (`Enter`, header control click, or group
  batch). Never on scroll, never on expand, never on timer.
- Reviewed appearance: rail turns reviewed-color, header gets checkmark and slight dimming;
  **code contrast unchanged; block stays expanded**. Global "Hide reviewed" toggle (top bar,
  default **off**) collapses reviewed chunks to stubs for resume/orientation passes;
  individually re-expandable (`x`).
- `reopened` (set by chunk-identity matching after a push — M1+, primitives §6) re-enters the
  queue and un-dims; banner: "3 chunks reopened by new push."
- Marking an unseen chunk is allowed (expert speed, R-027) but logged as `marked-unseen` for the
  dogfood eval loop.
- Collapsed stubs: `Enter` on a stub marks it reviewed without expanding — the header (path,
  reason, size) is what the reviewer vouches for. Section-level "Mark all N reviewed" appears
  only when the section's remaining chunks are all stubs; it lists count + reason inline, fires
  one action, is undoable via toolbar Undo, and announces once.
- Stubs remain inline at their book position (R-002 "never removed"); they count in the
  denominator from the start.

## Progress, queue, done

- `<ProgressCluster>`: "142 / 307 reviewed · 12 pending stubs" + thin single-fill bar (reviewed
  fraction). No streaks, no confetti, no color escalation near 100%.
- Outline sidebar: per-section "5/7" summaries; chunk rows show state dots; current chunk
  highlighted (scrollspy). Click = set cursor + scroll.
- Done (reviewed = total): `<EndOfBook>` becomes: "**All 307 chunks reviewed.** Nothing was
  skipped — every chunk required your mark." + table: reopened history, per-section totals +
  [Export]. Book remains fully navigable above it. Tone: coverage facts only — never "looks
  good."
- Resume: cursor + scroll position persisted; on load, restore and toast "Resumed — 165
  remaining."

## States

- **Loading**: skeleton sidebar + main placeholder; determinate text as compile progresses
  ("Chunking 42 files…"); counts appear as soon as known.
- **Empty (no diff)**: show the exact range examined (`main..feature-x`), likely causes (wrong
  base), CLI hint. No book chrome.
- **Error (parser failure on a file)**: degrade that file to whole-hunk chunks via the leftovers
  guarantee; non-blocking banner "3 files fell back to raw hunks (parser error)." Coverage is
  preserved by construction; no chunk is ever dropped.
- **Partial (3-chunk PR)**: identical layout, no special casing.
- **Overflow**: long lines → CM horizontal scroll per block; giant chunks (10k-line lockfile)
  start as stubs anyway; long paths truncate middle with full path in tooltip; sidebar
  virtualized for hundreds of sections.

## Accessibility & announcements

- Feed: `role="feed"` + `aria-label` (book title); blocks: `role="article"`,
  `aria-labelledby` → header, `aria-posinset`/`aria-setsize` (total is known), `aria-busy` while
  the virtualizer mounts (APG feed pattern).
- Roving focus: cursor = DOM focus on the block container (`tabindex=-1`). After `Enter`, focus
  lands on the next unreviewed block's container. After batch-mark, focus stays on the section
  button. If "Hide reviewed" collapses the focused block, focus stays on the same (now stub)
  element.
- Single polite `aria-live` region: "Reviewed. 164 remaining." / "Unmarked." / "37 chunks marked
  reviewed. 128 remaining." / "Wrapped to start of book." / "All chunks reviewed."
- i18n: skipped for M0 (single known user); avoid hardcoded direction/width assumptions in
  layout primitives.

## Rejected alternatives

- **One-chunk-at-a-time pager** — couples progress to marking (rubber-stamp momentum, R-026
  gate); hides same-file neighbors needed for diluted UI code (R-019).
- **Pure continuous scroll, no cursor** — no unambiguous target for mark/keyboard ops.
- **Auto-mark on scroll / "seen counts as reviewed"** — scroll ≠ attention; fabricates coverage.
- **Collapse-on-reviewed by default** (GitHub/Reviewable convention) — triage-shaped, breaks
  neighbor context; kept as opt-in toggle instead.
- **Auto-handled collapsed stubs** (stub = handled) — reproduces GitHub's silent exclusion;
  classifier misclassification would silently skip real code.
- **Per-chunk forced ack for every lockfile chunk** — confirmation fatigue trains click-through,
  destroying the mark's meaning.
- **Prominent gamified progress** — goal-gradient acceleration is an anti-quality force at
  end-of-review.
- **Right-side queue panel** — the right rail is reserved for M1+ threads; left ToC is the book
  convention.
- **One CM instance per book (single mega-document)** — 300 chunks with interleaved React prose
  slots fights CM's block-widget model and the virtualizer; per-chunk instances + list
  virtualization is the tractable inversion.

## Risks — validate in dogfood 0

- **Enter = mark-&-advance may still build momentum.** Watch `marked-unseen` rate and
  time-per-chunk distribution; if end-of-session marks get abnormally fast, add a session pacing
  nudge (SmartBear 60–90 min ceiling, research 04) — not more friction per mark.
- **"Reviewed stays expanded" on 300-chunk books** may make resume scanning tedious; if the
  "Hide reviewed" toggle proves always-on in practice, flip the default (cheap reversal).
- **Batch-ack granularity** (section-level) assumes low-signal chunks cluster by file in M0's
  ordering; M1 reordering may scatter them — revisit the grouping key then.
- **Virtualization + CM6 mount cost**: verify j/k latency stays <50ms with ~20 mounted merge
  views on a real lexbox monster PR before building more on top (R-027).
- **Chunk-container vs CM focus split** is the likeliest keyboard/a11y bug source; test the
  Tab/Esc boundary explicitly in dogfood 0.
