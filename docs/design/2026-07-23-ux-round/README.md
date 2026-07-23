# 2026-07-23 UX round — specs, plans, and handoff state

Tim's feedback round (verbatim: `docs/vision/addendum-2026-07-23-beauty-and-review-flow.md`,
traced as R-061–R-066) turned into issues #134–#140 plus a "work long and hard, impress me"
autonomy mandate. This folder is the handoff hub: every design decision was made and
spec'd; the build wave was killed mid-flight by a Claude session limit (~18:10 local), and
Tim then asked for a documented handoff. **Everything a next agent needs is in this folder
+ the issues.** All specs here are approved ux-expert output — build contracts, not
proposals.

## State of play (what's done / in flight / not started)

| Issue | What | Spec/plan here | Build state |
|---|---|---|---|
| #134 | Chip review-state glyphs | spec-134-139-140… | **Branch `claude/134-chip-states` pushed**: commit "Extract review glyph logic into its own module" + a WIP commit with the strip/logic/test changes mid-flight (tests NOT green yet — the agent died while updating chipAriaLabel expectations and adding glyph tests). Resume: finish neighbor-strip-logic.test.ts updates, run web tests, then Feature 3 (gist) which it had NOT started. |
| #139 | "+N unreviewed" pill | same spec (Decision 2) | Partially in the WIP commit — verify against the spec. |
| #140 | Gist forefront placement | same spec (Decision 3) | Not started. |
| #137 | Partial-chunk deferral | spec-137-partial-defer.md | Not started (agent died during orientation reading; no branch). v1 is web-only, zero data-model change — `Deferral.lineRange` already exists end-to-end. |
| #138 | Ask-AI progress feedback | spec-138-ask-ai-feedback.md | Not started. Build AFTER #137 (same files). Q4 (failure invisibility) is a real correctness gap, not polish. |
| #135 | Theme/fonts/texture | beauty-direction.md + brief-135-theme-agent.md | Not started. Sequencing: build AFTER the feature PRs merge (it tokenizes all of app.css — merging it first makes every feature PR conflict). |
| #136 | Logo + favicon | logo/critique.md + 3 candidate SVGs | Design decided: candidate C (bookmark-diff) with the 2-row mini-diff payload + a separately drawn 16px favicon. Next: implement the geometry fixes in SVG, wire favicon + top-bar mark (after #135 so the wordmark font exists). |
| #112 | Cursor/back-stack stale on mid-review reorder | brief-112-remap.md | Not started, but the dead agent completed its AUDIT — see below; its conclusions make the fix small and well-bounded. |
| — | Chunk-narration rubric eval (G2 fast-follow) | brief-narration-eval.md | **Branch `claude/chunk-narration-eval` pushed** with WIP `tools/chunk-narration-eval.mjs`. Known Windows gotcha it hit: dynamic `import()` of dist paths needs `file://` URLs on Windows (`pathToFileURL`). No judging had run yet. |

## Salvaged learnings from the killed agents

**#112 audit (complete, trustworthy — re-verify cheaply if main moved):** the only
cross-render flat indices in packages/web are `cursor` (number into chunkRowIndexes) and
`backStack` (number[]) — both stale on reorder, both need the occurrence-key fix. Everything
else is already safe: the server-persisted cursor is a CHUNK ID (wire format already
order-independent — keep it); the resume-toast derives from chunk id at mount; piece-menu
jumps resolve via `firstIndexByChunkId` at call time; `scrollToDeferred`/`goToChunk`/
`pendingJumpChunk` are id-based at call time. So the fix is exactly cursor + back-stack.

**Chips build:** `review-glyph-logic.ts` extraction landed cleanly as its own commit before
the strip work — if the WIP commit proves messy, keep the extraction commit and redo the
strip on top of the spec.

**Eval build:** on Windows, `node --experimental-...`-free dynamic import of built dist
modules requires `pathToFileURL(...)` hrefs; the Linux-born tools (order-eval) hardcode
POSIX-style paths.

## Sequencing plan (the intended build order)

1. Finish #134/#139/#140 on `claude/134-chip-states` → PR → merge.
2. #137 partial deferral (fresh branch off main) → PR → merge.
3. #138 ask-AI feedback on top → PR → merge.
4. #112 remap (independent, can run parallel to 2–3 — different files mostly; BookPage
   overlaps, rebase whoever lands second).
5. #135 theme LAST of the CSS-heavy set → PR → merge. Then #136 logo on top.
6. Chunk-narration eval is independent — any time.
7. After all merges: rebuild, bounce the live daemon (see below), drive the whole UI on the
   real 2468 book headless, fix what falls out, update CLAUDE.md.

## Live instance / dogfood facts

- Tim's running book: http://localhost:7468 — daemon PID at last check 50472, serving lexbox
  PR 2468, range `ccd29d0804640bf3d1c1f29d4a7e869639f2f0bb..pr-2468-updater`, launched from
  the `historyservice-nav-duplicates-9c1faa` worktree's dist with
  `--pr-url https://github.com/sillsdev/languageforge-lexbox/pull/2468`. To bounce with new
  code: build in any worktree, kill that PID, relaunch same args from the new dist. Review
  state survives (server store, head-keyed).
- NEVER start test daemons on 7468; use 7480+.
- Smoke subject that needs no lexbox: code-story's own history `a53e79f~1..a53e79f`.
- Windows: kill daemons by PID (netstat -ano | findstr <port>), never by name pattern.

## Standing constraints that bit this session

- Session quota limits kill subagents mid-flight; the two consults survived because they
  finished early. Persist-and-resume design (worktree branches pushed early, briefs in the
  repo not the scratchpad) is what made this handoff possible — keep doing it. Push WIP
  branches BEFORE the crunch, not after.
- Agent-tool worktree isolation put worktrees under `D:\code\code-story\.claude\worktrees\`
  (gitignored). Two of six agents ran WITHOUT visible worktrees and died leaving nothing on
  disk — treat isolation as best-effort and rely on early pushes.
- No CORE_VERSION bump is needed for ANY of this round (web/display + docs only).
