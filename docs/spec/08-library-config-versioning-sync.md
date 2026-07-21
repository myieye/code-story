# Spec 08 — Story library, config visibility, versioning, and disk sync

Source: [addendum 2026-07-21](../vision/addendum-2026-07-21-self-explanatory-and-library.md) →
R-061 (library UI), R-062 (config visibility, self-explanatory), R-063 (versioning + changelog),
R-064 (persist + auto-commit/push, conflict-free names). Overarching goal: make code-story **way
more self-explanatory** — a reviewer should be able to open the tool cold and understand what
stories exist, how each was generated, what every option does, and what changed between versions.

Status: `specced` — building on branch `claude/reviews-ui-config-visibility-q81jq1`.

## 0. Grounding: which config actually costs tokens to change

Traced in code (order-prompt.ts, order-job.ts, chapters.ts, order.ts, narration-*.ts,
model-policy.ts). This is the factual basis for the R-062 "what does it trigger / does it cost"
display. **Do not re-derive — this table is the source of truth for the UI copy.**

| Option | Feeds AI prompt? | Changing after generation |
|---|---|---|
| `direction` (consumer/dependency-first) | Yes — a hard-rule sentence differs by direction | **Regenerates** — changes book structure → `bookFingerprint` changes → order overlay dropped → free tier-0 until a paid re-run |
| `testPlacement` (before/after/end) | No — prompt never receives it | **Regenerates (wastefully)** — changes `book.sections` so overlay is dropped, but the re-run prompt is byte-identical. Efficiency bug → **#TBD** (skip re-order when only test-weave changed) |
| file-mode vs chapter-mode | Yes, wholesale (different prompt + overlay shape) | **Regenerates**; also fixed at daemon launch, not AI-live-toggleable |
| order model / narration model | No (same prompt, different answerer) | **Free** until a deliberate re-run. Narration re-run on a model change repays *all* sections, not just changed ones |
| narration on/off, AI-order on/off | No (scheduling gates) | **Free** — existing overlays keep serving |
| context payloads | No (deterministic, no model calls; unwired into prompts today) | **Free** |
| CORE_VERSION bump | Indirect (accompanies logic change) | Universal invalidator — order + both narration generations + context all re-run |

UI rule: label each option `regenerates` (💸) or `free`, with a one-line plain-language "what it
does" drawn from the middle column. `testPlacement` is labelled `regenerates` today with a note
that it *shouldn't* need to — until the efficiency bug lands.

## 1. The Story snapshot (R-064)

A **Story** is a persisted, immutable-at-creation snapshot of one generated code-story.

```
interface StorySnapshot {
  id: string;            // `${createdAt-compact}-${slug}` — timestamped ⇒ conflict-free names (R-064)
  createdAt: string;     // ISO-8601
  title: string;         // human label, default = range + short config summary
  range: { base: string; head: string; baseSha: string; headSha: string; label: string };
  config: StoryConfig;   // the exact axes used
  mode: 'file' | 'chapter';
  aiOrder: boolean;      // whether an AI order overlay is bundled
  toolVersion: string;   // user-facing app version (§3), NOT CORE_VERSION
  coreVersion: string;   // CORE_VERSION at generation (drives overlay validity)
  models: { order?: string; narration?: string };
  stats?: { sections: number; chunks: number };
  // Bundled expensive artifacts so a peer environment need not repay for them:
  orderOverlay?: AnyOrderOverlay;
  narration?: { v1?: NarrationOverlay; v2?: ChunkNarrationOverlay };
}
```

Live review marks are **not** bundled (they are the conflict-prone, per-reviewer part; they stay
in `~/.code-story/`). Deferred/ambitious: conflict-free review-state sync (append-only, per R-041
door-stays-open). Recorded here, not built.

### Persistence + git sync (R-064)

- Stories are written to `<repo>/.code-story/stories/<id>.json` inside the **reviewed** repo, so
  they travel with the repo history. `saveJson` atomics (tmp+rename) reused.
- A `<repo>/.code-story/stories/` that is git-tracked ⇒ `git add .code-story/stories && git commit
  && git push` after each new story. **Best-effort and non-fatal**: failures log and never break a
  compile; disabled when not a git repo, in tests, or when sync is off.
- Sync is controlled by `.code-story.json` `"sync"` (default: on when the file opts in). Enabled
  for this repo via its own `.code-story.json`. The heavy per-range live state stays in
  `~/.code-story/` (unchanged); only the snapshot files are committed.
- **Open question for Tim (closing report):** committing snapshots onto the *current working
  branch* mixes review artifacts into feature branches. Gradual choice shipped: scoped commit of
  only `.code-story/` to the current branch. Ambitious deferred: a dedicated `code-story/stories`
  orphan branch or a separate sync remote.

## 2. Multi-story server + trigger (R-061)

Today one daemon = one fixed range for its whole life (every cache keyed to one closure range).
Gradual refactor: **range-parameterized routes with a per-range store/cache `Map`**, defaulting to
the launch range so the existing single-range launch keeps working byte-identically.

- `GET /api/stories` — list snapshots (newest first) from `.code-story/stories/`.
- Existing routes accept `?story=<id>` (resolve the snapshot's range) or default to the launch
  range. `/api/book`, `/api/review`, `/api/order`, `/api/narration`, `/api/context`, `/api/export.md`
  become range-aware; per-range caches move behind a `Map<rangeKey, …>`.
- `POST /api/stories` — trigger a new review: body `{ range, config?, aiOrder?, narrate? }`,
  resolve range, compile, persist a snapshot, kick glue as configured, return the new story id.
  Rejects a range with zero changes.
- Snapshot artifacts are populated from the live overlays once the glue settles (or updated
  in-place when a later re-run produces them). A story with pending AI work lists as such.

Launch model unchanged: `code-story <base>..<head>` still boots a story reader; launched with no
range it opens the library.

## 3. Versioning + changelog (R-063)

- A **user-facing tool version** (`APP_VERSION`), distinct from `CORE_VERSION` (whose only job is
  overlay invalidation). `APP_VERSION` starts at **1.0.0** with this milestone (the change list
  starts now, no retroactive entries — R-063).
- A structured changelog (`packages/core/src/changelog.ts` as data + `docs/CHANGELOG.md` as the
  human doc, kept in sync) with entries `{ version, date, title, changes: string[] }`.
- Each new story stamps `toolVersion = APP_VERSION`. Old ranges without a snapshot show
  "version unknown" (no backfill).
- `GET /api/changelog` serves the entries; a **Changelog page** reachable from the top bar and the
  library renders them; each story's version links to its entry.

## 4. Web: library + config visibility (R-061, R-062)

No router today. Add the lightest possible client routing (read `location.pathname`/hash, no new
dependency) with three destinations:
- `#/` — **Library**: story cards (title, range, created, version→changelog, config chips with
  free/regenerates badges), a "New review" form (range + config), pick-to-open.
- `#/story?id=…` (or the range) — the existing **BookPage** reader, plus a "How this story was
  generated" panel: full config with per-option plain-language meaning + free/regenerates badge,
  version, models, mode. Extends `order-explain-logic.ts` conventions.
- `#/changelog` — the **Changelog page**.

Config explanations live in a pure, tested `config-explain-logic.ts` (one entry per option: label,
what-it-does sentence, `regenerates`|`free`), reused by both the library chips and the story panel
so the copy never drifts. Styling: extend `app.css`; reuse `.notice`, `.top-bar`, card patterns.

## 5. Slices

- **S1** core: `StorySnapshot` type + `story-id` (timestamped slug) + `changelog.ts` + `APP_VERSION`.
- **S2** server: snapshot store (`story-store.ts`), git-sync module (best-effort), `.code-story.json`
  `sync`.
- **S3** server: range-parameterized routes + `Map` caches + `GET/POST /api/stories` + `/api/changelog`.
- **S4** web: routing shell + Library page + New-review form.
- **S5** web: config-explain-logic + "How this story was generated" panel + library config chips.
- **S6** web: Changelog page + version stamps + links.
- **S7** dogfood on code-story's own history; file the `testPlacement` efficiency bug.

Gradual auto-picks recorded: scoped current-branch commit (not orphan branch); snapshot artifacts
only (not review-state sync); client routing via `location` (no router dep). Ambitious paths noted
inline for later.
