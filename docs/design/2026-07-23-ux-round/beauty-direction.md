# code-story visual identity — design direction (session 2026-07-23)

## Concept: "the review is a book"

The product's whole metaphor is a narrated book. The visual identity leans in: a
well-typeset manuscript crossed with a serious dev tool. Warm paper surfaces, ink text,
a literary serif for the book's voice, crisp mono for code. No skeuomorphism (no leather,
no page curls) — warmth comes from color temperature, typographic care, and a whisper of
paper grain.

## Type system (self-hosted via @fontsource, Vite-bundled, zero CDN)

- **UI sans: IBM Plex Sans** — professional, technical character, excellent at 11–14px UI
  sizes, not "default" like Inter/system-ui.
- **Code mono: IBM Plex Mono** — family-coherent with the sans, sharp in diffs. Replaces
  Cascadia/Consolas everywhere (CM6 theme, chunk titles, outline paths, definition panels).
- **Book voice: Fraunces (variable, italic)** — the AI narration lines, section/chapter
  narration, the wordmark, done-banner headline. The serif literally marks "the book is
  speaking" vs. the sans UI chrome. This distinction is the load-bearing design idea.
  Headings-and-narration only; never body UI text.

## Palette (tokenize first, then tune)

Introduce `:root` custom properties; migrate all ~79 hard-coded hex values in app.css onto
them. Semantic tokens, not color-name tokens:

- `--paper` page background: warm `#f6f3ec` (slightly warmer than today's #faf9f7), with a
  2–3% opacity SVG grain (feTurbulence data URI) on body only — never on code surfaces.
- `--surface` cards/top-bar/outline: `#fffdf9` (warm white, not pure #fff).
- `--ink` `#2b2822`; `--ink-muted` `#6f6a5f`; `--line` borders `#e3ded2`.
- `--accent` brand: deep story-indigo family compatible with the entrenched AI blue
  (#1c3a6e/#2f5aa8 today) — unify AI + cursor + links on one refined indigo ramp.
- Semantic: `--ok` reviewed green (desaturate toward sage from #3fa661), `--warn` amber
  (#b8791f family), `--danger` red (#b3261e family), `--add`/`--del` diff line tints kept
  close to today's (#e6f4e6/#fbe9e9) but re-derived from the ramp so they sit on warm paper.
- CM6 theme + .state-dot + chips + badges all read from tokens.

Contrast floor: all text pairs ≥ 4.5:1 (WCAG AA), muted-on-paper included. Verify the worst
pairs (muted ink on paper, amber on paper) numerically.

## Texture

One subtle move only: the body paper grain. Optionally a hairline double-rule under the
top bar (classic book title-page flourish) — cheap, typographic, no images.

## Explicitly deferred (record, don't build)

- Dark mode: tokens make it cheap later; not part of this pass.
- Print/export styling of the book markdown.

## Acceptance

- No CDN/external requests (daemon is self-contained; check dist for stray fetches).
- Screenshot pass on the real 2468 book: header, feed, outline, chips, deferred section,
  done banner — nothing unreadable, no layout shifts from font metrics (set
  `font-display: swap` fallbacks with matched x-heights, or size-adjust if needed).
- All web tests stay green; zero behavior changes (CSS + font imports + index.html only).
