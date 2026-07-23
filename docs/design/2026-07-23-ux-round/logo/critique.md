# Logo critique — expert verdict on the three candidates (2026-07-23)

logo-expert review of the three SVG candidates in this folder, rendered at 16/24/32/64px in
colour + grayscale (raster.png, zoom.png alongside). Brand context: warm-paper identity
(#f6f3ec paper, #fffdf9 cards, #2b2822 ink), IBM Plex UI, Fraunces wordmark; surfaces =
16px favicon, ~20–24px top-bar mark, README, eventual site.

## Verdict

**Rank: C (bookmark-diff) → ADVANCE with fixes. B (brace-book) → park (concept has a
ceiling, execution dies at 16px). A (openbook-diff) → KILL as the system mark.**

| Axis (0–4) | A openbook | B brace-book | C bookmark-diff |
|---|:--:|:--:|:--:|
| Distinctiveness | 1 | 2 | 3 |
| Simplicity & focus | 3 | 2 | 3 |
| Appropriateness | 2 | 3 | 4 |
| Reproduction robustness | 2 | 1 | 4 |
| Craft precision | 3 | 2 | 3 |
| System fit | 3 | 3 | 3 |

Key findings:
- A's differentiator (green/red diff lines in a book) dies in BOTH mandatory contexts:
  grayscale collapses the diff colours into generic text rows; 16px turns them to sub-pixel
  mud. What remains is the textbook reader/docs cliché — fails the swap test outright.
- B fuses into a vertical almond blob at 16px (confirmed by render, not predicted); carries
  three ideas (book + braces + ribbon) against the one-idea rule; braces leak toward
  "JSON-formatter tool". Cleverest concept, sunk by small-size physics.
- C has the strongest 16px silhouette, is mono-native (filled shape + paper knockouts), and
  its metaphor is the most on-brief: bookmark = your saved place in the reading; diff marks =
  in the changes. Review-specific, not reader-generic.
- C's two fixable risks: silhouette alone reads "save-for-later" (Pocket trope), and `+`
  over `−` reads as zoom controls / "add bookmark".

## The distinctiveness lever (adopted direction)

Make the diff the STRUCTURAL payload of the bookmark: replace the floating `+`/`−` symbols
with an explicit two-row mini-diff — an added row (leading `+`, a hair longer) above a
removed row (leading `−`, shorter) drawn like gutter lines of text — "a place held inside a
set of changes". No bookmark/save app and no reader has that. Optional ≥32px colour move:
added row #3fa661, removed row #b3261e — but row SHAPES must already distinguish add/remove
in mono.

## Geometry fixes for C (primary mark, ≥24px)

1. Drop the `stroke#1c3a6e/2px` outline — single flat fill #2f4a8c (the one filled element
   in the identity).
2. Rebuild counters as the 2-row diff: rows h≈5 units (was 3.6 — sub-legible), gap ≥3, `+`/`−`
   at the left gutter, real diff length asymmetry.
3. Recenter content optically (nudge row group ~2 units down; it floats high above the notch).
4. Colour flourish at ≥32px only; must be a bonus over a one-ink mark.

## Favicon: separately drawn 16px variant, not a shrink

Native `viewBox="0 0 16 16"`, fill-only, whole-pixel edges, wider bookmark (~10px of the
cell). The 2-row diff cannot survive 16px: keep two flat 2px paper bars as "held text"
(reads as reading, distinct from a plain save-bookmark); drop `+`/`−` entirely. Provide mono
ink-on-paper and reversed paper-on-dark variants.

## Open checks before public use

Five-minute category sweep of bookmark-silhouette read-later/annotation apps (Pocket-trope
collision is stated from recall; the 2-row-diff fix likely resolves it regardless). If a
bolder 16px-native redraw of B's book+braces ever reads clearly, its concept is the most
literally "code-story" — that would be a fresh redraw, not an iteration of the file here.
