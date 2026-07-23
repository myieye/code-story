# Approved UX spec — issues #134 (chip state glyphs), #139 (+N pill), #140 (gist placement)

ux-expert recommendations (2026-07-23), adopted as the build contract for R-061, R-065, R-066.
A build agent started this on branch `claude/134-chip-states` (glyph-module extraction commit
pushed; the rest was mid-flight when the session limit killed it — see the README in this
folder for exact salvage state).

## Decision 1 — Review-state markers on chips (#134, R-061)

Give every jump chip a single leading state glyph drawn from the outline's exact vocabulary
(`○` unseen / `•` seen / `◑` auto-read / `✓` reviewed), driven by the SAME function the
outline uses. Keep chip salience (border + weight + opacity) BINARY — reviewed vs not — so
four glyphs never become four visual weights. Seen/unseen/auto-read chips look identical
except for the glyph; only "reviewed" gets the dim/dashed demotion.

Why: the outline already teaches `○ • ◑ ✓` (OutlineSidebar). Chips today speak a different
dialect (border/opacity/✓-only) — exactly the subconscious inconsistency Tim named. WCAG
1.4.1: the glyph must not be the only cue — the existing binary border/weight stays the
colour-independent "still owes me / done" signal. No fifth state: `◑` covers
read-not-confirmed; the subtree being partly done is what the +N pill says (Decision 2).

Spec:
- Extract `STATE_GLYPH`, `AUTO_READ_GLYPH`, `GlyphState`, `isAutoReadReview`, `reviewGlyph`,
  `reviewGlyphClass` from OutlineSidebar.tsx into `packages/web/src/review-glyph-logic.ts`;
  OutlineSidebar (and any other importer) imports from it. Zero behavior change; carry tests.
- neighbor-strip-logic.ts: `computeNeighborChips` takes `reviewOf(id) → {state, autoRead?}`
  instead of `stateOf(id) → state`; derive stateOf internally so reachableUnreviewed /
  frontier / created are untouched. `NeighborChip` gains `glyph` + `glyphClass` (jump chips
  only; reveal chips get no glyph). Keep binary `state` for salience.
- NeighborStrip.tsx: replace the reviewed-only `.chip-check` block with an always-present
  leading `<span className={"chip-state state-dot " + glyphClass} aria-hidden>` — reusing
  `.state-dot` inherits the outline's colours. Delete `.chip-check` CSS.
- chipAriaLabel: precise state words — 'unseen' / 'seen' / 'auto-read, not yet confirmed' /
  'reviewed'; keep boundary/behind clauses.
- Keep-options-open lever (R-025): if four glyphs test noisy, collapse `•`/`◑` → `○` in the
  shared mapper — one line, both surfaces move together.

Rejected: status-quo binary only (second dialect); four salience weights (noise); two-glyph
collapse (meaning drift: `○` = unseen in outline but not-reviewed on chips).

## Decision 2 — "+2" becomes "+2 unreviewed" (#139, R-065)

Visible pill text `+2` → `+2 unreviewed`; add a `title` tooltip "2 more unreviewed chunks
reachable past this one". A tooltip ALONE is not the fix (NN/g: essential info on the page,
not hidden in hover). `unreviewed` is the app's own state word — ties to Decision 1's
vocabulary. aria: "N more unreviewed reachable past here". `.chip-behind` CSS unchanged;
the strip scrolls horizontally, so occasional wider chips are fine.

Rejected: tooltip-only; `+2 behind` (jargon, answers "where" not "what"); `+2 more`.

## Decision 3 — Gist first in the header as serif lead-in (#140, R-066)

Move the AI gist (2–4-word badge) to the FIRST position in the chunk header, before the
title, restyled from grey chip to a serif "book-voice" lead-in (Fraunces stack with Georgia
fallback) preceded by a small visible `AI` marker. INLINE in the header row — not its own
line (a late-arriving gist must never change chunk height → no virtualized-feed jump; a
header insert only reflows horizontally). The mono title stays bold + flex:1 — it keeps the
identity-anchor job (weight/width/font) while the gist takes first-fixation (NN/g F-pattern,
horizontal attention leans left).

Markup:
```jsx
{chunkBadge && !lowSignal && (
  <span className="chunk-gist" title="AI summary of this chunk">
    <span className="sr-only">AI summary: </span>
    <span className="badge ai-badge" aria-hidden="true">AI</span>
    <span className="chunk-gist-text">{chunkBadge}</span>
  </span>
)}
```
CSS: `.chunk-gist` inline-flex baseline gap 6px flex:none; `.chunk-gist-text` font-family
'Fraunces', Georgia, serif; 13.5px; colour matching `.chunk-ai-line`'s warm AI text; max-width
~220px ellipsis. No background. Visible `AI` badge carries R-026 attribution (tooltip-only
attribution is not enough for a headline element). The full-sentence `.chunk-ai-line` stays
where it is (two-tier disclosure).

Rejected: emphasise-in-place (fights reading order); own headline row (height change on late
arrival — DEFERRED ambitious path: revisit if narration becomes reliably pre-computed);
sticky-bar placement (grain mismatch); outline echo (locator map, not arrival surface).

## Cross-decision noise budget

Worst-case chip after D1+D2: `○ → calls Foo new +2 unreviewed`. Dense but each addition is
minimal. If real books show overload, the release valve is the ARROW (`→`/`←`) — the relation
verb already encodes direction — never the state glyph or the pill label. Don't pull it
pre-emptively.

## Validate later

Horizontal title-shift on late gist arrival (reserve-slot mitigation if distracting); four
glyphs vs two on a real 6+-chip strip; whether "unreviewed" lands with first-timers ("to
review" is the friendlier swap).
