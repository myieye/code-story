# code-story UI-feature map (Explore agent, 2026-07-20)

All line numbers are `file:line`. Paths are absolute from `/home/user/code-story`.

## 1. Chunk / fragment identity as the web sees it

A chunk row's data is the `Chunk` interface: `packages/core/src/model.ts:19-35` — `id`, `file`, `symbolPath[]`, `displayPath[]`, `baseRange?`, `headRange?`, `kind`, `changeTypes[]`, `generatedReason?`, `hunks[]`. The web carries these verbatim in `BookResponse.chunks` (`packages/core/src/api.ts:18`) plus a parallel `diffs: Record<chunkId, UnifiedLine[]>` (`api.ts:27`).

**Fragment ordinals / "piece N of M":** partial. When a symbol group exceeds `DEFAULT_MAX_LINES=40` (`packages/core/src/chunker.ts:24`) it splits into fragments (`chunker.ts:67-78`). The fragment index is baked only into the *display label* `fragment ${i+1}` (`chunker.ts:76`) and the chunk `id`/`displayPath` (`chunker.ts:216,219`), and kind becomes `method-fragment` (`chunker.ts:74`). There is **no** stored "of M" total, no sibling-chunk link field, and no per-file chunk-list on the chunk. Fragments are only implicitly siblings via shared `file`+`symbolPath`. Per-file grouping is reconstructed at compile time (`book.ts:29-34` `byFile` map) and in file-mode sections, not carried on the chunk.

**Chunk titles:** core `chunkTitle` (`model.ts:114-118`) = `displayPath.join('.')`, else `lines N–M`, else `file`. `displayPath` is set by the chunker (`chunker.ts:69-78`): `symbolPath`, or `[...symbolPath, "fragment N"]`, or `["(binary)"]`/`["(leftover)", "lines a–b"]` (`chunker.ts:35`, `book.ts:285`). The order/narration manifests reuse `chunkTitle` (`order.ts:133`, `narration.ts:260`). Web re-exports it (`rows.ts:2`) and renders it at `RowView.tsx:174`.

**Chapter-mode `label` (= source file path):** set on cross-file occurrences in `chapters.ts:399` (`...(slot.crossFile ? { label: fileById.get(...) } : {})`); the `Occurrence.label` field is documented at `model.ts:42-48`. Rendered in the web at `RowView.tsx:175-176` as `from {row.occurrence.label}` (`<span className="chunk-from">`). The neighbor strip also uses file basenames for symbol-less chunks (`neighbor-strip-logic.ts:152`).

## 2. OutlineSidebar

`packages/web/src/OutlineSidebar.tsx`. It lists **sections** (`data.book.sections.map`, `:33`), each an expandable disclosure (`:39-51`) whose expansion is component-local `expanded` state (`:28`). Under an open section it lists that section's **occurrences** (`:66-85`), each resolved to a chunk. Data inputs (`:9-27`): `data` (BookResponse), `flat` (FlatBook), `width`, `stateOf`, `sectionStats`, `currentSection`, `cursorOccurrence`, `onJump`.

**Click behavior:** clicking a section row jumps to its first occurrence's cursor index via `flat.indexByOccurrence` (`:55-58`); clicking a chunk jumps to that occurrence's index (`:76`). Both call `onJump` = `moveCursor` (`BookPage.tsx:631`).

**Highlight:** the section row gets class `current` when `section.title === currentSection` (`:38`); a chunk gets `current` when `key === cursorOccurrence` (`:75`). `currentSection` is computed in `BookPage.tsx:443-454` from the top visible virtual row (scroll-synced feed→sidebar, one-directional). `cursorOccurrence` is the cursor row's occurrence key (`BookPage.tsx:630`).

**State glyphs:** `STATE_GLYPH` (`:7`) `{reviewed:'✓', seen:'•', unseen:'○'}`, shape-not-colour (WCAG note `:6`), rendered `:79-81`. Counts show `done/total` from `sectionStats` else occurrence count (`:61-63`). `shortPath` truncates to last two path segments (`:93-96`).

## 3. Review marking

State lives in **`useReview`** (`packages/web/src/useReview.ts`): `states: Record<chunkId, ChunkReview>` (`:30`), debounced (`FLUSH_DELAY_MS=800`, `:27`) PATCH to `/api/review` via `sendReviewPatch` (`api.ts:58`), with retry re-queue (`:58-66`) and `pagehide` flush (`:70-76`). `ChunkReview` = `{state, markedUnseen?, expanded?}` (`core/src/review.ts:4-10`).

Paths that mark reviewed (all in `BookPage.tsx`):
- **Enter** → `markCurrent` (`:198-210`) → `markCursorReviewed` (`:190-196`) then advance (`cursorAfterMark`).
- **`m`** → `markInPlace` (`:213-218`) — marks, cursor stays.
- **Mouse "Reviewed" button** → `toggleChunkReviewed` (`:229-239`), wired at `RowView.tsx:184-195` (`aria-pressed`, `✓ Reviewed`/`Mark reviewed`).
- **Batch (stubs)** → `markSection` (`:288-301`) using `batchableSections` (`review-logic.ts:58-80`) — sections whose every remaining unreviewed chunk is low-signal; rendered as section-header button `RowView.tsx:94-103`.
- Keymap wiring: `useBookKeymap.ts:77-82` (Enter/m/u).

`markedUnseen` flag (R-026 signal) is set when marking a still-`unseen` chunk (`:194,236,296`; core `review.ts:8`).

**Seen-tracking (`useSeenTracking.ts`):** a chunk becomes `seen` when **both its top and bottom edges** have been inside the viewport (`:14-35`), scanned 160 ms after scroll settles (`:39-42`) plus a 400 ms initial scan (`:44`). `setSeen` only upgrades `unseen` (`useReview.ts:103-111`), debounced. No dep array — re-registers each render to read fresh state (`:20`).

**Undo paths:** `unmarkCurrent` (key `u`, `:220-225`) → sets `seen`; mouse toggle un-marks to `seen` (`:231-234`); **batch undo** `undoBatch` (`:303-308`) restores `lastBatch.prior` (captured `:291`), surfaced as a top-bar button (`:534-538`) and section-header morph (`RowView.tsx:96-102`, "One element … so focus survives the mark→undo morph"). There is no marked-unseen *log* view; the signal is only the per-chunk `markedUnseen` boolean persisted in the review file.

## 4. Narration

Core overlay: `packages/core/src/narration.ts`. `NarrationOverlay` (`:30-38`): `version`, `model`, `promptVersion`, `opener{text,key,failures?}`, `sections: Record<sectionId, NarrationSectionEntry>`. Entry (`:20-28`): `fingerprint`, `intro`, `chunks: Record<chunkId,string>`, `generatedAt`, `gateFailures?`.

**Keying:** `sections` is **keyed by Book section id** — explicitly "the changed-file path" (`:37`). `sectionFingerprint` = fnv1a over `headSha + CORE_VERSION + section.id + occurrence chunk ids` (`:46-49`); opener key over the sorted set of section fingerprints (`:52-55`). `filterFreshNarration` (`:63-77`) drops entries whose section id is gone or whose fingerprint mismatches.

**Server:** job `runNarrationJob` (`server/src/narration-job.ts:66-123`), resumable per section, persists overlay after each (`:105,117`). Endpoints: `GET /api/narration` (`server.ts:489-500`, applies `filterFreshNarration`), `POST /api/narration-job` (`server.ts:502-539`, 409 if running). Register gate `checkNarrationText` (`narration.ts:122-145`), banned phrases (`:92-104`). Narration is **not** auto-kicked (only order is, `server.ts:445-461,700`).

**Web rendering:** yes, the web renders narration — no `NarrationView` component; it renders inline. `useNarration` (`web/src/useNarration.ts`) exposes `opener`, `indicator`, `sectionLine`, `chunkLine`. Rendered: book opener `BookPage.tsx:616-621`; progress-cluster indicators `BookPage.tsx:514-526`; section AI line `RowView.tsx:105-109`; chunk AI line `RowView.tsx:206-210`. Section line falls back intro→rationale (`narration-logic.ts:14-24`). **The web never triggers the narration job** — `web/src/api.ts` has only `fetchNarration` (GET), no POST. So narration only appears if a CLI/manual job populated the overlay.

**What breaks in chapter mode (#115):** narration entries key on `section.id` and `sectionFingerprint` bakes in `section.id` (`narration.ts:37,46-49`), designed for file-mode where "section id = the changed-file path" (comment `:37`, and `SectionNarrationInput.key` "= the changed-file path" `:190`). In chapter mode (the *default* config, `story-config.ts:18`) section ids are `chapter:<anchorChunkId>` (`model.ts:77`, `chapters.ts:107,245`) and a chunk may recur across chapters — so overlays generated/expected against file-mode section ids don't line up with chapter section ids, and `buildSectionNarrationInput` computes role/imports treating `section.id` as a file path (`narration.ts:233,240`). The `isFileModeBook` guard (`model.ts:87-89`) exists precisely because these helpers assume file-path section ids.

## 5. Order overlay v2 (chapter composition)

`OrderOverlayV2` (`order.ts:56-67`): `version:2`, `bookFingerprint`, `chapters: string[][]` (partition of story chunk ids; each chapter's first id is its anchor), `rationales: Record<string,string>`, `model`, `promptVersion`, `createdAt`, `appliedAt?`, `dismissedAt?`. `AnyOrderOverlay = OrderOverlay | OrderOverlayV2` (`:69`).

**Per-chapter rationale strings:** yes — `rationales` keyed by chapter section id `chapter:<anchorChunkId>` (comment `order.ts:53-55`; re-keyed in `order-job.ts:246`: rationales[`chapter:${idOf.get(anchorAlias)}`]).

**Does the web display v2 rationale?** Yes, via the same section-line path. `useOrderOverlay` exposes `rationales` only when applied (`useOrderOverlay.ts:54`); `useNarration` receives them (`BookPage.tsx:51`) and `sectionAiLine` uses rationale as fallback when no intro (`narration-logic.ts:20-23`), rendered at `RowView.tsx:105-109` with an `AI` badge. So a v2 chapter rationale shows on the chapter header keyed by `chapter:<anchorChunkId>` — matching the recomposed book's section ids.

**Chapter section titles:** section `id` = `chapter:<anchorChunkId>` but `title` = the **anchor file path** (`chapters.ts:401` `sections.push({ id: chapterId, title: anchorFile, ... })`; spine `:245`). So the displayed header text (`RowView.tsx:91` `row.title`; sidebar `OutlineSidebar.tsx:60`) is the anchor file, never the raw `chapter:` id. `currentSection` also returns titles/file (`BookPage.tsx:449-451`).

v2 is applied **server-side** (`applyChapterOverlay`, `order.ts:263-272`) and shipped as `BookResponse.aiBook` (`api.ts:41`, built at `server.ts:356-362`); the web can't recompose (no chunk graph) so `useOrderOverlay.ts:27-30` reads `data.aiBook` for v2.

## 6. Progress display

Cluster in `BookPage.tsx:487-527` (`<span className="progress-cluster">`):
- **counts:** `reviewedCount / distinctChunks reviewed` (`:493`), where `reviewedCount` (`:99-102`) and `distinctChunks` (`flat`, `rows.ts:62`).
- **pending stubs:** `· N pending stub(s)` (`:494`) from `pendingStubCount` (`review-logic.ts:82-88`, wired `BookPage.tsx:120`).
- **progress bar:** `:498-500`.
- **frontier:** `N cross-chunk interaction(s) still open` (`:501-508`) from `frontierCount` (`frontier-logic.ts:23-33`; interaction kinds `calls`+`exercises`, `:10`).
- **AI indicators:** `AI reading order` (`:509-513`), narration partial/complete (`:514-526`).

**Done banner / "All N reviewed" morph:** `done = reviewedCount === distinctChunks` (`:471`); progress text morphs to `All ${distinctChunks} reviewed ✓` (`:489-491`) with class `done`. Top-bar button morphs "Next unreviewed"→"View summary" (`:539-547`). End-of-book done panel with per-section table + interaction-count sentence: `RowView.tsx:113-142`.

## 7. Server API surface

All in `packages/server/src/server.ts`; request/response types in `packages/core/src/api.ts`. Web fetchers in `packages/web/src/api.ts`.

| Route | Handler | Type | Web fetch |
|---|---|---|---|
| `GET /api/health` | `server.ts:323` | ad-hoc | — |
| `GET /api/diff` | `server.ts:325-327` | `{...range, files}` | — (no hook) |
| `GET /api/book` | `server.ts:329-364` | `BookResponse` (`api.ts:14-42`); reads `?direction`/`?testPlacement` | `fetchBook(config?)` `web/api.ts:16-20` |
| `GET /api/order` | `server.ts:425-432` | `OrderResponse` (`api.ts:45-55`) | `fetchOrder` `:28-32` |
| `PATCH /api/order` | `server.ts:466-483` | `OrderPatch` (`api.ts:85-88`) | `sendOrderPatch` `:48-55` |
| `POST /api/order-job` | `server.ts:434-439` | `{job}` (202/200) | — (CLI/auto only) |
| `GET /api/narration` | `server.ts:489-500` | `NarrationResponse` (`api.ts:95-107`) | `fetchNarration` `:34-38` |
| `POST /api/narration-job` | `server.ts:502-539` | `{job}` (202/409) | — |
| `GET /api/review` | `server.ts:541-544` | `ReviewFile` (`review.ts:13-21`) | `fetchReview` `:22-26` |
| `PATCH /api/review` | `server.ts:546-555` | `ReviewPatch` (`review.ts:28-31`) | `sendReviewPatch` `:58-65` |
| `GET /api/context` | `server.ts:587-609` | `ContextResponse` (`api.ts:61-63`); `?chunk=` | `fetchContext` `:41-45` |
| `GET/POST /api/context-job` | `server.ts:615-664` | `ContextJobResponse` (`api.ts:69-82`) | — |
| `GET /api/export.md` | `server.ts:668-688` | markdown text; `?order=ai` | `<a href>` `BookPage.tsx:598` |

App loads book/review/order/narration in parallel on mount (`App.tsx:14-18`).

## 8. Chunk graph in the web

`BookResponse.chunkGraph: ChunkGraph` (`api.ts:34`; empty `{edges:[]}` in file mode). Core types: `ChunkEdge`/`ChunkEdgeKind`/`ChunkEdgeSource`/`ChunkGraph` (`chunk-graph.ts:11-33`); `neighborsOf` (`:107-115`).

**Neighbors strip:** component `packages/web/src/NeighborStrip.tsx` — ARIA `toolbar` of chips, roving tabindex (Arrow/Home/End/Esc `:34-43`), mouse click primary (`:67-73`). Chip model `computeNeighborChips` (`neighbor-strip-logic.ts:121-170`): `ChipState = 'reviewed'|'unreviewed'` (`:13`), `NeighborChip` (`:16-48`) carrying `action:'jump'|'reveal'`, `arrow`, `relation`, `behind` (+N reachable-unreviewed, `:90-114`), `frontier`. Relations table `:57-64`, kind rank `:72-79`. Chip states in DOM: `chip-${state}`, `chip-file-level`, `chip-frontier` (`NeighborStrip.tsx:60`); `✓` check `:75-79`, `+N behind` `:81-85`.

**Back-stack:** `backStack: number[]` (`BookPage.tsx:85`); `jumpToNeighbor` pushes origin (`:313-322`), `goBack` pops (`:324-334`, key `b` `useBookKeymap.ts:85`); `reencounter` transient highlight (`:86,349-353`; `RowView.tsx:160,700`). Strip shown only for the cursor row (`BookPage.tsx:464-470,692`; `RowView.tsx:197-205`). `g` focuses first chip (`BookPage.tsx:337-342`).

## 9. File view toggle (Story/Files, PR #119)

`grouping` derived from config: `isFileModeConfig(config)` → `'files'` else `'story'` (`BookPage.tsx:358`; core predicate `story-config.ts:24-26` = dependency-first + tests-after). Buttons `BookPage.tsx:569-590` (`aria-pressed`), `setView` (`:391-394`) calls `changeConfig(FILE_MODE_STORY_CONFIG | lastStoryConfig)`. Last story config remembered (`:359-362`).

**Config-varied fetch:** `changeConfig` (`:366-376`) → `fetchBook(config)` → `/api/book?direction=&testPlacement=` (`web/api.ts:16-19`, `bookQuery` `order-options-logic.ts:27-30`). Server resolves per-request config (`server.ts:329-336`, `resolveStoryConfig`), caches one `Built` per config key (`server.ts:179,208-242`); base inputs (diff/chunks/graph) shared across configs (`server.ts:168-200`). `aiBook` only for the launch config (`server.ts:355-362`).

**Review marks survive regroup:** marks are per-chunk server state keyed by chunk id (`review.ts:20`), independent of order; comment `BookPage.tsx:364-365`. After reorder the cursor resets to first-unreviewed and back-stack clears (`:380-387`). Chunk ids are order-independent (`model.ts:69-71`), so the same chunk keeps its state across Story/Files.

## 10. Web test setup

Web tests are pure-logic `*.test.ts` (no `.tsx`, no React rendering) — no jsdom; vitest default Node env; no vitest.config in web. Web `test` script: `tsc -p . --noEmit && vitest run` (`packages/web/package.json`).

Test files (8): `review-logic.test.ts` (13), `order-logic.test.ts` (8), `order-options-logic.test.ts` (4), `neighbor-strip-logic.test.ts` (18), `frontier-logic.test.ts` (7), `narration-logic.test.ts` (15), `context-panel-logic.test.ts` (13), `rows.test.ts` (1) — **79 cases**. Hooks and components have no tests — logic is deliberately extracted into `*-logic.ts` modules tested headlessly.

## 11. Background job pattern

**Runtime:** `JobRuntime<Rec>` (`server/src/job-runtime.ts`) — single-flight (`running` `:20`), owns in-flight `live` promise + mirrored `record` (`:17-18`); `run()` writes `running`→work→`done`/`failed` records via `saveJson` (`:49-69`); `resolve()` detects daemon-restart orphans (`:33-41`, `ORPHAN_ERROR :9`). One instance each for order/narration/context (`server.ts:369,487,613`).

**Launch/persist/resume per type:**
- Order: `kickOrderJob` (`server.ts:377-423`) guards on `orderRuntime.running`, spawns `runOrderJob`/`runChapterOrderJob` (`order-job.ts:74,95`), persists overlay to `orderFile` (`server.ts:415`). Auto-kick on startup (`server.ts:445-461,700`; `shouldAutoKickOrder` `order-job.ts:288-290`; `failedFingerprints` anti-retry-storm `server.ts:372,419`).
- Narration: `server.ts:502-539`, resumable via overlay persisted per section (`narration-job.ts:74-120`).
- Context: `server.ts:615-664`, `runContextJob` (`context-job.ts:54-84`) resumes via `freshIds` skip, caps by store size.

**Spawn seam:** `invokeClaudeJson` (`server/src/claude-cli.ts:8-26`) — `spawn('claude', ['-p','--model',model,'--output-format','json','--tools',''])`, prompt on stdin, JSON envelope out; `extractJsonBlock` (`:33-60`) balance-scans the `result` string. Every job takes an `invoke?` test seam (`order-job.ts:55`, `narration-job.ts:50`, server options `server.ts:133-136`). Retry taxonomy `refused`/`invalid-output`/`transient` with backoff (`order-job.ts:29-44,126-153`). A new "deferred AI prompt" job type would: add a `JobRuntime` instance + a `POST /api/<x>-job` route mirroring `server.ts:502-539`, a `run<X>Job` using `input.invoke ?? invokeClaudeJson` + `extractJsonBlock` + the `invokeUntilValid` loop (`order-job.ts:127-153`), a store file (`saveJson`/`loadJobRecord`, `order-store.ts`), and a `Rec extends JobRecordBase`.

## 12. Pre-existing resemblances

- **Per-file grouping in the feed:** EXISTS — the "Files" view (`FILE_MODE_STORY_CONFIG`), one section per changed file (`compileBook`, `book.ts:28-54`, `title = file.path` `:42`). Chapter mode instead groups by call-path chapters spanning files (`chapters.ts:54`).
- **"Show whole file":** ABSENT — per-chunk collapse/expand (`x`, `toggleCollapseCurrent` `BookPage.tsx:251-255`; `isCollapsed`/`setCollapsed` `:122-128`) and a global "Hide reviewed" (`:548-568`) exist, but no "show the entire file's changes" affordance. Diffs render only the chunk's own hunks (`DiffView`, `RowView.tsx:226`).
- **Auto-mark-on-scroll:** PARTIAL — scrolling auto-marks `seen` (both edges in viewport), never `reviewed`. Reviewed always requires an explicit mark (R-026; `useBookKeymap.ts:78-79` "key-repeat never marks").
- **Inter-section blurbs:** EXISTS as the section AI line (narration intro, else order rationale) `RowView.tsx:105-109` via `sectionAiLine` (`narration-logic.ts:14-24`), and the per-chunk AI line `RowView.tsx:206-210`. There is no separate free-standing "between two sections" blurb component beyond these header/chunk lines and the book opener (`BookPage.tsx:616-621`).

## Current suite (verified green 2026-07-20): core+server+web all pass; web 79, server 101.
