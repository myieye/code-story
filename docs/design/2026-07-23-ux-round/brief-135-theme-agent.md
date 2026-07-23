# Build brief — issue #135: theme, fonts, texture (R-062)

Repo worktree base: D:\code\lexbox-claude-worktrees\code-story\diff-display-bugs-ux-6ae07d
(pnpm monorepo). Work on a NEW branch `claude/135-beauty-theme` cut from origin/main (fetch
first). You are implementing the design direction in beauty-direction.md (same folder as this
brief) — read it first. Objective: give the web app a deliberate visual identity WITHOUT any
behavior change. Web package only (packages/web) — plus `pnpm-lock.yaml` for font deps.

## Deliverable shape

1. **Design tokens**: add a `:root` block at the top of packages/web/src/app.css defining the
   semantic custom properties from beauty-direction.md (--paper, --surface, --ink, --ink-muted,
   --line, --accent family, --ok, --warn, --danger, --add, --del, plus --font-ui, --font-mono,
   --font-voice). Migrate ALL hard-coded hex values in app.css (~79 distinct) onto tokens.
   Where several near-identical hexes serve one semantic role, collapse them onto one token
   (e.g. #2f5aa8 vs #1c3a6e both "AI/accent" → two steps of one ramp, not two unrelated blues).
   Keep a short comment on each token naming its role, not its color.
2. **Fonts**: `pnpm --filter @code-story/web add @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono @fontsource-variable/fraunces`
   (verify exact package names/weights on npm; plex needs 400/500/600 + italic 400).
   Import in packages/web/src/main.tsx. Wire: body/UI → IBM Plex Sans; ALL code/mono contexts
   (CM6 theme in DiffView.tsx:19, app.css Consolas/Cascadia occurrences, definition panels,
   outline paths, chunk titles) → IBM Plex Mono; the "book voice" (`.chunk-ai-line`, narration
   lines, section narration, done-banner headline, and the top-bar wordmark span) → Fraunces
   italic/regular per beauty-direction.md. NO external requests — verify dist bundles woff2.
3. **Texture**: subtle feTurbulence SVG grain as a data-URI background-image on body over the
   --paper color, 2–3% opacity equivalent. Must not appear behind CM6 code or cards.
4. **Polish sweep**: with tokens in hand, tune the worst offenders for coherence: top-bar,
   outline, chunk headers (cursor/reviewed/autoread tints re-derived from tokens), chips,
   badges, buttons, focus rings (one consistent focus style), scrollbars if trivially cheap.
   Border radii + spacing: unify onto a small scale (e.g. 3/6/10px) where inconsistent.
   Do NOT redesign layouts, move elements, or change any text/DOM structure except: the
   top-bar range/title area may gain a `code-story` wordmark span set in Fraunces (check
   BookPage top-bar structure; keep the PR-link behavior intact).
5. **Contrast check**: compute contrast ratios for every text-on-background token pair you
   introduce (script it — a tiny node script in the scratchpad is fine); all body/UI text
   ≥ 4.5:1, large/bold headings ≥ 3:1. Fix failures by darkening ink tokens, not by giving up.

## Verification (required before you finish)

- `pnpm --filter @code-story/web run build` green; `pnpm --filter @code-story/web test` green
  (tsc + vitest; there are no component tests — your change must not need new logic tests,
  it's CSS/fonts only).
- `grep`/search the built packages/web/dist for `http` font/css URLs — must be none (all
  assets local).
- Visual smoke: build server too (`pnpm build`), run the daemon on code-story's OWN history:
  `node packages/server/dist/cli.js a53e79f~1..a53e79f --port 7481 --no-open` from the repo
  root, then use Playwright (root devDep playwright-core with channel:'chrome', headless —
  see tools/dogfood-walk.mjs for the pattern) to screenshot: (a) top of book, (b) a focused
  chunk header with badges, (c) the outline sidebar. Save PNGs to your scratchpad and LOOK at
  them (Read tool renders images) — check fonts actually applied (serif visible on AI lines,
  Plex on UI), grain subtle not dirty, nothing unreadable. Iterate until it looks genuinely
  good — you are the taste gate. Kill the daemon (find pid via netstat, taskkill by pid —
  never pkill by pattern).
- Commit style: match repo (imperative subject, Co-Authored-By: Claude Fable 5
  <noreply@anthropic.com> trailer). Commit granularly (tokens migration / fonts / texture+polish).
- Push: `git push origin HEAD:refs/heads/claude/135-beauty-theme` and open a PR against main
  titled "Theme: design tokens, Plex + Fraunces type system, paper texture" with a one-line
  body starting with *[Claude, autonomous]* and "Closes #135". Do NOT merge it — the root
  session handles merge sequencing. Report back: PR number, screenshot paths, any hex you
  could NOT migrate (CM6 inline theme colors are fine to keep inline but read them from a
  shared ts constants module if cheap), contrast results, and anything you deliberately left.

## Hard rules

- No CDN/@import/external URL anywhere.
- Zero DOM/behavior changes beyond the optional wordmark span.
- Don't touch packages/core or packages/server.
- Don't edit files under docs/.
- If a font package doesn't exist under that exact name, find the right @fontsource name —
  don't substitute a different typeface without noting it prominently in your report.
