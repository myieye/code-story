I now have full grounding. This is a **Tier 3** decision (frequent, touches the core product promise, genuinely novel — no settled convention for auto-review with ledger integrity). Here is my recommendation.

---

# Recommendation

Build a **two-rung evidence ledger with an explicit bulk-confirm step** — never auto-promote to `reviewed`. As the reviewer reads, chunks that pass a genuine reading gate (full visibility + size-scaled dwell, defeated by fast scroll) enter a new, visually distinct **auto-read** tier that is *not* counted as reviewed. The reviewer promotes auto-read chunks to the accountable `reviewed` state in **bulk, per section and at the end**, via a persistent non-modal button with trivial undo. Provenance (explicit vs. confirmed-from-auto-read) is recorded in the ledger, and the done banner stays green only for truly-`reviewed` chunks.

This deliberately rejects the literal request ("auto-mark reviewed on scroll"). The mechanic that reduces 300 clicks is not silent auto-marking — it's replacing *O(chunks)* individual marks with *O(sections)* bulk confirmations over evidence the system gathered automatically. The human still decides; they just decide in batches.

**Tier: 3.** I triaged high because this is encountered every session, its failure mode (a hollow ledger) destroys the product's entire reason to exist (R-001/R-026), and there is no off-the-shelf convention for "automatic review with integrity" — the two nearest conventions point in opposite directions (see Why).

---

# Why

**The two candidate conventions come from different-stakes categories, and the higher-stakes one governs.**
- The direct comparable — code review — is deliberately **explicit**. GitHub's per-file "Viewed" checkbox is manual by design; auto-marking was never shipped, and it auto-*unmarks* on change to protect the "I actually looked" meaning ([GitHub blog](https://github.blog/news-insights/product-news/mark-files-as-viewed/), [GitHub Docs](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/reviewing-proposed-changes-in-a-pull-request)). By Jakob's Law this is the dialect a senior dev already knows.
- Auto-mark-as-read *on scroll* is a real convention, but only in **content consumption** (RSS/email) where a false "read" costs nothing — it's an unread-count, not an accountability record ([Feedly auto-mark-on-scroll request](https://github.com/olsh/Feedly-Notifier/issues/171)). Importing that mechanic into a coverage ledger imports a design that assumes the record is disposable. Here it is the product.

**R-026 flips the usual "undo beats confirmation" rule for this specific case.** Normally, for a *reversible, frequent* action you prefer silent action + undo (Gmail model) over an opt-in confirm. But the product's founding gate is that the human is "really in the forefront… not being convinced by AI that the code is perfect" (R-026, `docs/requirements/inventory.md:201`). If doing nothing produces a fully-green ledger, the *default outcome of passivity is a completed review* — the exact "scroll to bottom = fake 100%" failure. Undo does not defend against a **passive** failure (you never notice you should undo). So `reviewed` must require a positive human act. This is the contingency-table point: the generic principle says undo; the product constraint says opt-in confirm — and the constraint wins.

**The project's own research says automation here narrows attention and saves no time.** Tufano et al.'s controlled study (29 experts) found AI-pre-flagged review anchors reviewers, finds no extra high-severity bugs, and saves no time (`docs/research/04…` Part D #6, A5). A system that pre-decides "reviewed" is the strongest possible anchor. Part D #4 explicitly frames GitHub "Viewed" as "the crude ancestor — make attention coverage a first-class artifact," and #9 says collapse/short-circuit mechanical content "only after per-hunk checks." Both point to: automate the *evidence*, not the *judgment*.

**The thresholds are anchored in reading science, not vibes.** Effective defect detection collapses past ~500 LOC/hour ≈ **7.2 s/line** (Part D #3, SmartBear/Cisco) — that's the ceiling of *real* review. Silent prose reading averages 238 wpm ([Brysbaert 2019 meta-analysis, 190 studies](https://gwern.net/doc/psychology/linguistics/2019-brysbaert.pdf)). A dwell gate of ~300 ms/line (≈200 lines/min) sits comfortably below a scroll-past (a chunk crosses the viewport in <200 ms) and well above nothing — it credibly means "eyes passed at reading pace," which is exactly the right bar for a tier that *still requires confirmation*, not for `reviewed` itself. Skim-vs-read is a measurable behavioral distinction ([reading-vs-skimming eye-tracking review](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12801452/)).

**It reuses two patterns already in the app**, so it's consistent, not invented: the low-signal stub **batch-ack with morph-to-undo** (`review-logic.ts:batchableSections`, `RowView.tsx:94-103`) and the **provenance flag** precedent (`markedUnseen` on `ChunkReview`, `review.ts:5-8`).

---

# Spec

### Ledger model (core — `packages/core/src/review.ts`, `model.ts`)
Keep the three-value `ChunkReviewState` (`unseen | seen | reviewed`). Add two optional provenance fields to `ChunkReview` (same shape as `markedUnseen`, so `applyReviewPatch` and the patch type extend trivially):

- `autoRead?: true` — set when a `seen` chunk clears the reading gate. **State stays `seen`**; this is an evidence flag, not a new coverage state. R-001's coverage invariant (counts `reviewed`) is untouched.
- `reviewedVia?: 'explicit' | 'auto'` — stamped when a chunk becomes `reviewed`. Absent ⇒ `'explicit'` (back-compat). `'auto'` = promoted from an auto-read batch.

Rationale for a flag over a 4th enum value: the coverage denominator, done gate, `findUnreviewed`, and `hideReviewed` all key off `=== 'reviewed'` and must not change; a 4th state would ripple through every one. The flag keeps auto-read *below* the coverage line by construction.

### Evidence gate — when a chunk becomes `autoRead` (new hook, sibling to `useSeenTracking.ts`)
A chunk upgrades `seen → autoRead` when **all** hold:
1. **Eligible**: not low-signal (`isLowSignal` false), not collapsed (diff is actually rendered), and the chunk's rendered height **fits within the scroll viewport**. Chunks taller than the viewport are *never* auto-read — they require deliberate internal scrolling, so an explicit mark is the honest record. (This also sidesteps the "both edges can't be simultaneously visible" problem the current seen-scan handles awkwardly.)
2. **Visible**: ≥ **60%** of the chunk's height in the viewport (extend the existing virtualizer scan — you already compute `item.start/end` vs `top/bottom`).
3. **Dwelled**: condition 2 held continuously for `dwellMs = clamp(300ms × diffLineCount, 1500ms, 8000ms)`. Use `data.diffs[chunk.id].length` for the line count.
4. **Not flung**: if scroll velocity exceeds **~2000 px/s** at any moment while the chunk is on screen, reset *that chunk's* dwell timer to zero. This is the abuse-resistance — you cannot bank auto-read credit while scrolling fast.

Transition table:
- `unseen → seen`: unchanged (both edges once; the weak breadcrumb).
- `seen → autoRead`: gate above. Persisted on the existing 800 ms debounce (it's low-value like `seen`, not an explicit act).
- `autoRead → reviewed` (`reviewedVia:'auto'`): only via a **confirm** action.
- `* → reviewed` (`reviewedVia:'explicit'`): any explicit mark (click "Mark reviewed", Enter, `m`). Explicit **always wins** and overwrites any auto flag; auto-read never downgrades or overrides an explicit state.
- Unmark `reviewed`: returns to `autoRead` if the evidence flag is still set, else `seen` (mirrors today's "unmark → seen").

### Bulk confirm — the three moments (all non-modal; hard constraint satisfied)
Reuse and generalize `batchableSections`. Today it fires when every *remaining* chunk in a section is a stub; generalize it to also fire when every remaining chunk in a section is **auto-read** (or stub). The section header button (`RowView.tsx:94`) then shows, using the existing single-element morph so focus survives:

1. **Per section** (primary bulk moment, aligns with Part D #3 sitting-sized pacing): `Confirm N read in this section` → promotes that section's auto-read chunks to `reviewed`/`'auto'`. Morphs to `Undo confirm (N)`.
2. **Progress cluster** (`BookPage.tsx:487`), persistent whenever any auto-read exist: append `· N auto-read ▸ Confirm`. Clicking confirms **all** auto-read across the book. This is the always-available accelerator.
3. **End / done row** (`RowView.tsx:113`): if `reviewed < distinct` only because of unconfirmed auto-read, the end row reads `N of M reviewed — K auto-read awaiting your confirm` with a single `Confirm K auto-read as reviewed` button (replaces/【sits beside】 "Jump to next unreviewed" when the only gap is auto-read).

Confirm is one click; it is the human's single accountable act vouching for a batch that already passed under their eyes at reading pace — structurally identical to today's stub batch-ack, which Tim already accepted.

### Done state — stays honest (hard constraint)
- Green "All N reviewed ✓" (`BookPage.tsx:490`, `RowView.tsx:117`) fires **only** when `reviewedCount === distinctChunks`. Unconfirmed auto-read does **not** turn it green — the progress bar fill stays `reviewed/distinct`.
- The green done banner adds one honest provenance line when any reviewed chunks were auto-confirmed: `K of N confirmed from auto-read (seen at reading pace, then confirmed in bulk).` The per-section done table can show the auto-confirmed count as a parenthetical. This directly serves R-026's "never imply completeness you don't have" (Part D #7).

### Visuals — distinct state, color-independent (WCAG 1.4.1)
The outline already uses shape, not color (`OutlineSidebar.tsx:7`: `○ • ✓`). Insert auto-read as a shape between `seen` and `reviewed`:

- Sidebar glyph: **`◑`** (half-filled circle) — reads as "part-way to done," shape-distinct from `○ • ✓`.
- Chunk rail/header (`RowView.tsx:171` `state-rail`, `.state-*`): auto-read = **dashed rail + faint/neutral header tint**; explicitly reviewed keeps the **solid green rail + solid tint**. The difference (dashed vs solid, neutral vs green) is legible without relying on hue and in dark theme.
- The header mark button (`RowView.tsx:184`): for an auto-read chunk show `Auto-read — click to confirm` (button, `aria-pressed=false`), so a mouse user can confirm a single chunk in place too. Reviewed still shows `✓ Reviewed`.

### Mouse-first, keyboard optional (hard directive)
- Every confirm is a **clickable button** (section header, progress cluster, end row, per-chunk header). No shortcut is required to reach any of them.
- Auto-read accrues purely from scrolling with the mouse/trackpad — the default reading motion — so the automatic tier needs zero keyboard.
- Keyboard is additive only: existing Enter/`m` still explicit-mark; optionally a `c` accelerator to confirm the current section's auto-read (novices never need it). Not required.

### Focus & screen-reader
- Confirm buttons reuse the section-ack morph so focus survives mark→undo (already solved, `RowView.tsx:93`).
- Announce via the existing `say()` aria-live channel: on section confirm, `Confirmed N chunks reviewed. M remaining.`; on undo, `Undo — N chunks back to auto-read.` The `seen → autoRead` transition itself is **silent** (it's ambient, announcing it would be noise and would nag — matching `seen` being silent today).
- Auto-read state is conveyed to AT via the glyph text and the button label (`Auto-read — click to confirm`), not color.

### Copy
- Progress cluster: `12/40 reviewed · 9 auto-read ▸ Confirm · 3 pending stubs`
- Section header: `Confirm 6 read in this section` / `Undo confirm (6)`
- Per-chunk button (auto-read): `Auto-read — click to confirm`
- End row: `31 of 40 reviewed — 9 auto-read awaiting your confirm` + `Confirm 9 auto-read as reviewed`
- Done provenance line: `9 of 40 confirmed from auto-read (seen at reading pace, then confirmed in bulk).`

### Interaction with stubs
No change to stubs. They start collapsed with no diff, so they're **ineligible** for auto-read (nothing was read) — they keep their own batch-ack path. A section can offer a *combined* batch button when its remainder is a mix of stubs and auto-read: `Confirm 6 (4 read, 2 stubs)`.

---

# Rejected alternatives

- **Explicit-only, just make marking cheaper (the null / GitHub convention).** Fully honest and zero-automation, but it doesn't answer Tim's ask — 300 chunks still cost ~300 deliberate acts, only slightly cheaper. The whole point is to *use* the automatic reading signal. Kept as the fallback if auto-read evidence proves untrustworthy in dogfooding.
- **Auto-mark `reviewed` on scroll/dwell (the literal request).** Hollows the ledger and is the textbook R-026 automation-bias failure (Part D #6): the default outcome of passivity becomes a green review. The done banner's "every chunk required your mark" becomes a lie. Rejected outright.
- **Auto-mark `reviewed` with a global undo (Gmail model).** The generically-correct pattern for reversible frequent actions — but undo protects against *active* mistakes, not *passive* ones. Here the failure is inaction silently completing the review; the user never triggers undo because nothing felt wrong. R-026 makes opt-in confirm mandatory. Rejected for this app specifically.
- **Cursor-passage as the evidence** ("mark what the j/k cursor moves past"). The cursor jumps (`findUnreviewed` wraps, neighbor-strip navigation teleports it), so passage doesn't imply the pixels were seen. Also keyboard-coupled, violating mouse-first. Rejected; dwell+visibility is the honest signal.
- **A confirmation modal per batch.** Violates the no-modal-interruption constraint and the modal-is-a-cost principle. The persistent inline button is strictly better here (self-contained, non-blocking). Rejected.
- **A genuine 4th `ChunkReviewState`.** Cleaner conceptually, but ripples through every `=== 'reviewed'` check (coverage, done gate, `hideReviewed`, `findUnreviewed`, order/narration fingerprints) and risks a coverage-invariant regression. The flag keeps auto-read below the coverage line by construction. Rejected on cost/risk.

---

# Risks & validate later

- **Load-bearing assumption: the dwell gate correlates with real reading.** If dogfooding shows reviewers routinely confirm auto-read batches without genuinely having read them, auto-read becomes theater and you should fall back to explicit-only or lengthen `dwellMs`. **Watch:** in a dogfood run, log auto-read→confirm latency and the fraction of confirmed-from-auto chunks that later get a comment/change — treat `reviewedVia:'auto'` as an eval signal exactly like `markedUnseen`.
- **Threshold calibration** (300 ms/line, 60%, 2000 px/s, 8 s cap) are evidence-anchored starting points, not tested constants. Tune on the existing dogfood subjects (2309/2357/2379) by walking a book at a natural pace and checking that scroll-throughs bank *zero* auto-read while genuine reading banks it. These are the numbers most likely to need adjustment.
- **Nag risk in the progress cluster.** A permanent "N auto-read ▸ Confirm" could read as pressure to click. If it feels naggy in use, demote it to appear only at section boundaries + end. Validate by feel on the first real drive.
- **Tall-chunk exclusion** means big chunks always need an explicit mark. That's intended (they're where careful reading matters most), but confirm the exclusion doesn't leave a frustrating residue of "why won't these auto-read?" — if so, add a short in-header hint on tall chunks: `too tall to auto-read — mark when done`.
- **Provenance in export/markdown** (`exportBookMarkdown`) should carry the auto-confirmed count so the honesty survives outside the browser; not strictly required for the interaction but recommended for the ledger's integrity end-to-end.

Implementation touchpoints: new `useReadTracking.ts` (sibling to `useSeenTracking.ts`) for the gate; `review.ts`/`model.ts` for the two flags + patch fields; `review-logic.ts:batchableSections` generalized to auto-read; `RowView.tsx` (rail/glyph/button/section-ack/end-row) and `OutlineSidebar.tsx` glyph; `BookPage.tsx` progress cluster + confirm handlers + `say()` announcements. No CORE_VERSION bump needed unless you also fold the flags into a fingerprint (you shouldn't — they're per-reviewer ledger state, not derived content).