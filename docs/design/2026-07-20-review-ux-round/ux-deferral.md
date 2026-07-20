I have everything I need. The subagent's map confirms the critical constraint that shapes the async design: **the web has no polling/SSE/websocket — it only observes job state at page load** (App.tsx:15; grep-confirmed no `setInterval`/`EventSource`), and job answers live in server-owned stores separate from the client-PATCHed review state. The done-gate is purely `reviewedCount === distinctChunks` (BookPage.tsx:471), and review state is keyed by `chunkId` alone with occurrences as mere walk-stops. That lets deferral piggyback on the existing coverage invariant with zero change to the done computation.

Here is the design.

---

# Deferral for code-story — UX decision

**Triage: Tier 2** (novel-feeling but composed of known patterns: save-for-later queue, background job, split-button, passive status). Frequent, moderate error-cost, hard to reverse once reviewers build habits. ~9 grounding + research tool calls, 3 sources.

## Recommendation

Add a **"Defer" button in the chunk header** (mirroring the existing `Mark reviewed` toggle, RowView.tsx:184-195). It opens a `<details>` popover (the app's own control idiom, OrderOptionsControl.tsx:9-12) with **one textarea** and three actions: primary **"Ask AI & defer"** (default), sibling **"Defer with a note"**, and, behind the primary's caret, **"Ask AI inline"**. Deferring **collapses the chunk in place** and appends it to a pinned **"Deferred" section at the end of the book**, where the note or the AI answer is waiting and the chunk is resolved by marking it reviewed. Deferred chunks are simply *not reviewed*, so the existing coverage gate (`done = reviewedCount === distinctChunks`) holds the book open with **zero change to the done computation**. AI answers are produced by a **single serial background worker** (narration-job-shaped) writing to a server-owned `deferrals` store, surfaced by a **scoped, self-terminating poll** and a **passive** progress-cluster count — never a toast or modal, because the reviewer deferred precisely to avoid interruption.

**Line-level:** v1 is **chunk-level with an optional line-range annotation** captured from the CM6 selection — descriptive metadata on the deferral, not a new review unit.

---

## Why

- **Gesture = header button, not a gutter gesture.** Consistency beats local optimality: the header already carries the primary per-chunk action (`Mark reviewed`), a real `<button>` reachable by Tab+Enter, mouse-first per Tim's hard directive. A line-gutter drag/selection gesture would be a novel invention in a read-only CM6 feed and has no ARIA pattern to lean on. Chunks are *already* sub-file (the product's core value), so chunk-grain deferral is not coarse.
- **`<details>` popover is the app's established disclosure idiom** — "discoverable, keyboard-native, no extra open/close state" (OrderOptionsControl.tsx:9-12). Reusing it means no new focus-trap/escape-handling code and instant visual consistency.
- **Split-button for the AI default.** The verbatim ask makes *defer* the default for AI prompts but keeps inline available. NN/g: a split button gives one-click access to the default and hides the alternate behind the caret, lowering interaction cost for the common path ([Split Buttons, NN/g](https://www.nngroup.com/articles/split-buttons/)). "Ask AI & defer" is the one-click default; "Ask AI inline" is the caret alternate; "Defer with a note" stays a visible sibling because a note is a *different intent* (self vs machine), not an alternate of the same action.
- **Deferral rides the existing coverage invariant.** Because review state is keyed by `chunkId` and done is purely `reviewedCount === distinctChunks` (confirmed BookPage.tsx:471, review.ts:20), a deferred-but-unreviewed chunk automatically holds the book open. No new "resolved" axis, no done-gate edit — deferral *is* "seen but not reviewed, parked with a payload." R-001 coverage is preserved for free.
- **Passive notification, salient destination.** NN/g's long-waits guidance says background completions should be *salient* so they aren't missed ([Designing for Long Waits, NN/g](https://www.nngroup.com/articles/designing-for-waits-and-interruptions/)); its notification taxonomy says non-urgent, no-action-needed status changes should be *passive* badges, never faded toasts ([Indicators, Validations, Notifications, NN/g](https://www.nngroup.com/articles/indicators-validations-notifications/)). These reconcile perfectly here: the reviewer *chose* to receive the answer "at the end," so we make it salient **at the destination they're walking toward** (the Deferred section + its cards) and merely **passive while mid-flow** (a progress-cluster count + polite live-region). A toast/modal would violate the deferral contract itself.
- **Answer lives server-side, separate from review state** — matching order/narration/context (overlays are written by the job to their own store, served by GET; App.tsx:15). The client PATCHes the *intent* (note/prompt), the worker fills the *answer*. R-026 honored: the answer is always AI-badged with the prompt shown, and **an answer landing never marks anything reviewed** — the human still decides.

---

## Spec

### Data model

**Server-owned store** `reviews/<base12>..<head12>.deferrals.json` (mirrors order-store.ts path template; atomic `saveJson`, serialized on the existing `saveChain`, server.ts:321):

```ts
interface Deferral {
  id: string;                 // crypto.randomUUID(), client-generated
  chunkId: string;
  kind: 'note' | 'ai';
  text: string;               // note body, or the AI prompt ('' allowed for a bare note = bookmark)
  lineRange?: LineRange;      // optional captured CM6 selection (1-based), else whole chunk
  inline?: boolean;           // ai only: true = answer-in-place, chunk NOT deferred; falsy = deferred
  createdAt: string;
  // ai answer, filled by the worker:
  answer?: string;
  answerStatus?: 'running' | 'done' | 'failed';
  answerError?: string;
  answeredAt?: string;
}
interface DeferralStoreFile { version: 1; base: string; head: string; deferrals: Deferral[]; }
```

`ChunkReviewState` (`unseen|seen|reviewed`) and the done-gate are **untouched**. A deferral is *open* iff its `chunkId` is not `reviewed` (derived — no resolved flag). Deferring sets the chunk to `seen` if currently `unseen` (it's explicitly held, not un-encountered).

**Endpoints** (all `autoOrder:false`-style, no auth):
- `POST /api/deferrals` — body `Deferral` (minus answer fields). Persists; if `kind==='ai'`, enqueues the worker (202). Returns the stored record.
- `GET /api/deferrals` — returns `{ deferrals: Deferral[] }` with the worker's live/orphan-resolved status (reuse `JobRuntime.resolve`, job-runtime.ts:33-41, so a restart-orphaned answer reads as `failed`, not stuck `running`).
- `DELETE /api/deferrals/:id` — removes a deferral (discard).
- Resolution reuses the existing `PATCH /api/review` (`state:'reviewed'`).

**AI worker** — one narration-job-shaped serial worker per range (JobRuntime + `claude -p --tools ''` in the data home, claude-cli.ts:8-26): drains pending `kind:'ai'` deferrals FIFO, persists each answer as it completes (resumable — a restart skips already-answered ones, re-queues `running` orphans). Single serial worker (not N parallel spawns) bounds resource use. 10-min timeout (existing `JOB_TIMEOUT_MS`), transient backoff + one re-ask on empty output, then `failed` (fail-open per deferral — one bad answer never kills the queue). Prompt: the reviewer's text + the chunk's diff + (if set) the line range, register-linted per #58 "point, don't assert."

### The popover (input surface)

`<details class="defer-popover">` anchored to the header **Defer** button:

```
┌─────────────────────────────────────────────┐
│ Defer this chunk to the end            [×]   │
│ ⓘ Deferring lines 34–41   (or: whole chunk)  │   ← only if a CM6 selection exists
│ ┌─────────────────────────────────────────┐ │
│ │ Note to yourself, or a question for AI…  │ │   ← <textarea>, autofocus
│ └─────────────────────────────────────────┘ │
│ [ Ask AI & defer  ▾ ]   [ Defer with a note ]│   ← primary split + sibling
│   └▾ Ask AI inline (answer here, don't defer) │
│ ⓘ 1 existing deferral on this chunk           │   ← only if ≥1 already
└─────────────────────────────────────────────┘
```

- **Primary "Ask AI & defer"** (default, per verbatim): `kind:'ai'`, deferred. Disabled while textarea empty (an AI ask needs a prompt).
- **Caret → "Ask AI inline"**: `kind:'ai', inline:true`. Chunk stays mainline; answer renders in place.
- **"Defer with a note"**: `kind:'note'`, deferred. Empty text allowed — label morphs to **"Defer to end"** when empty (a bare bookmark).
- **Submit accelerators:** `Cmd/Ctrl+Enter` fires the primary; `Esc` closes without deferring (native `<details>` + textarea).
- **Line-range:** if the read-only CM6 view has a non-empty selection when the popover opens, prefill `lineRange` and show the ⓘ line; else the deferral covers the whole chunk.

### States (UI Stack)

- **Ideal — deferred (note):** chunk collapses in place to a one-line stub: *"Deferred — <note preview> · resolve at end ↓"* (reuse `collapsedOverride` + the low-signal stub row). Appears as a card in the Deferred section.
- **Ideal — deferred (AI):** in-place stub: *"Deferred — AI answering… ↓"* → *"Deferred — AI answer ready ↓"*. Deferred-section card shows the prompt (as the question) + answer under an **AI** badge (reuse `.badge.ai-badge` / `.chunk-ai-line`).
- **Ideal — inline AI:** chunk stays in place; a focusable **sibling region below the diff** (never inside CM6 — same rule as DefinitionPanel, RowView.tsx:239-244) shows *"AI · <prompt>"* then the answer, with a brief `reencounter`-style highlight + polite announce when it lands. No scroll-jump.
- **Deferred section (the destination):** pinned last (like `LEFTOVERS_SECTION_ID`). Header: *"Deferred — N chunks · M answering"*. One card per chunk (grouping multiple deferrals, stacked). Each card: title + `from <file>`, optional line-range badge, each deferral's note/prompt+answer, a **"Show diff"** lazy-CM6 expander (collapsed-stub pattern), a **"Mark reviewed"** button (header-toggle semantics — resolves), and per-deferral **"✕ Remove"**. Resolved chunks (reviewed) grey out / collapse.
- **Empty:** zero deferrals → the Deferred section is **not rendered** (no empty cluster at the end). No first-run coach beyond the button tooltip + the `?` overlay entry.
- **Error (AI failed/orphaned):** card shows *"AI couldn't answer this — the prompt is saved."* + **[Retry]** (re-POST). Prompt/note never lost; chunk still resolvable manually.
- **Partial (reviewer reaches end, answers pending):** done banner does **not** fire (deferred chunks unreviewed). Deferred section shows *"M of N still being answered…"* with per-card spinners; poll updates them in place. Reviewer waits or resolves manually.
- **Loading:** per-card *"answering…"*; the store GET is fetched when the Deferred section mounts (compute/return-on-load) and refreshed by the poll.

### Async delivery + notification

- **Scoped poll:** while `GET /api/deferrals` reports any `answerStatus:'running'` for this range, poll every ~10 s; **stop when none running**. This is the one new client mechanism (the app has no push) — justified because inline auto-appear and the "answer ready" count are dead without it; context-panels already set precedent for on-demand server fetch.
- **Passive indicator** in the progress cluster (BookPage.tsx:487, beside frontier/AI-order): *"N deferred"* → *"N deferred · M answers ready"* / *"· M answering"*. Clicking scrolls to the Deferred section. `aria-live="polite"`: *"An AI answer is ready in Deferred."* when a `running`→`done` transition is observed. **No toast, no modal, no jump.**

### Keyboard / focus / a11y

- **Mouse-first primary** (Tim's directive). Keyboard path: from the focused chunk article, `Tab` reaches the header buttons; `Enter`/`Space` opens the Defer `<details>`; focus moves to the textarea; controls are native and tabbable; `Esc` closes and returns focus to the article (reuse the existing Esc-to-article handler, useBookKeymap.ts:54-61). **No new global single-key in v1** (avoids collision with the dense j/k/n/m/u/x/g/b/d/? map and honors mouse-first) — a dedicated open-defer keystroke is an open path.
- Split-button follows the ARIA menu-button pattern (`aria-haspopup`, `aria-expanded`, arrow-key menu, [APG Menu Button](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/)); the caret target is visibly signified (NN/g).
- Deferred-section "Mark reviewed" reuses the header toggle's `aria-pressed` semantics. "Show diff" is `aria-expanded`. AI answers carry the visible **AI** label (R-026), not ARIA-only.

### Copy

- Button: **Defer** (title: *"Set this chunk aside for the end — with a note or an AI question"*).
- Popover placeholder: *"Note to yourself, or a question for AI…"*
- Actions: **Ask AI & defer**, **Ask AI inline (answer here, don't defer)**, **Defer with a note** / **Defer to end** (empty).
- In-place stubs: *"Deferred — {preview} · resolve at end ↓"*, *"Deferred — AI answering… ↓"*, *"Deferred — AI answer ready ↓"*.
- Deferred header: *"Deferred — {N} chunks{, M answering}"*. Error: *"AI couldn't answer this — the prompt is saved."* + **Retry**.

---

## Rejected alternatives

- **Line-gutter selection as the primary gesture** — no ARIA pattern for gutter interactions in a read-only feed; a novel invention against the mouse-first + convention principles; chunks are already sub-file so the payoff is small. Kept as an optional *annotation* (captured selection → `lineRange`), not the unit of deferral.
- **New `ChunkReviewState = 'deferred'`** — would force edits to the done-gate, `reviewedCount`, `batchableSections`, frontier, and every occurrence/coverage site, and couldn't hold a note/prompt/answer or multiple entries. A separate `deferrals` list keyed to `chunkId`, with "open = not reviewed" derived, changes the done computation by *nothing*.
- **Toast / modal when an answer lands** — directly violates the reviewer's stated intent (they deferred to avoid dealing with it now); NN/g warns faded toasts get missed and modals interrupt. Passive count + salient destination is the reconciliation.
- **Answer stored in `ReviewFile`** — the client PATCHes review state; a background worker writing answers into the same file would race the flush/retry logic (useReview.ts:58-66) and mix machine output into human-authored state. Server-owned store matches order/narration/context exactly.
- **Parallel AI job per deferral** — unbounded `claude -p` spawns. One serial worker (narration-shaped, persist-per-item, resumable) bounds resources and reuses proven restart-survival.
- **Separate "Deferred" tab/route** — the book is one linear virtualized feed; "to the end" literally means an end section, reachable by reading through and by `n` (deferred = unreviewed). A route split breaks the single-queue mental model and the outline sidebar.
- **Duplicating the full live diff into the Deferred card by default** — doubles heavy CM6 mounts and re-raises occurrence identity. Link-back ("Go to chunk ↑") + lazy "Show diff" expander gives the code-beside-answer view on demand at near-zero cost.
- **A mode segmented-control ("For AI / Note") + a "defer at end" checkbox** — more controls and clicks than the split-button; the default (AI & defer) is no longer one click. Split-button encodes the verbatim's "defer is the default (but not required)" with lower interaction cost.

---

## Risks & validate later

- **The scoped poll is the one architectural deviation** (the app is deliberately poll-free). If Tim wants *zero* new client mechanism, the even-more-gradual cut is: fetch answers only when the Deferred section mounts / a card opens — this still satisfies "ready when I get to the end," but loses the mid-flow "answers ready" count and inline auto-appear (inline would need a manual "check for answer"). Watch whether the 10 s poll feels laggy for inline; if so, shorten while the popover-origin chunk is on screen.
- **Assumption: AI-defer is the most common intent** (hence primary). If dogfooding shows notes dominate, swap which action is the one-click primary — cheap to reverse.
- **Multiple deferrals resolving together** (all clear when the chunk is reviewed) may feel blunt if a reviewer wants to keep a chunk parked while dismissing one question. Cut in v1 (use **Remove** to discard); revisit if it bites.
- **Watch:** does the in-place "Deferred" stub declutter enough, or do reviewers want the chunk fully hidden from the mainline until the end? A/B the collapse-vs-hide behavior when Tim drives it.

**v1 cuts (kept open):** true line-level review state; live push/SSE; a dedicated open-defer keystroke; per-deferral resolution independent of chunk-review; multi-turn AI threads / the BYO-agent thread vision (single-shot prompt→answer only); deferrals in the markdown export (could add a "Deferred" appendix later); per-deferral model choice.

---

*Note on the CLAUDE.md delegation rule: spawning the Explore subagent for the job/review-state map paid off — it returned exact interfaces, path templates, and the load-bearing "web has no polling" fact (App.tsx:15) that flipped the notification design from a toast to a passive-indicator-plus-scoped-poll. That fact would have been easy to assume wrong from memory. No instruction backfired this turn.*