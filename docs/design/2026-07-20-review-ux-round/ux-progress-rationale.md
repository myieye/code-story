I have enough evidence and full codebase grounding. Writing the decision.

---

## UX Decision — code-story review satisfaction + order rationale

**Triage: Tier 2 for both asks.** Frequent encounter (every review, every section boundary) × moderate confusion cost × low irreversibility, but genuinely contested design space with a strong anti-cheese constraint and an existing implementation to respect. Not Tier 3 — nothing here is hard to reverse, and there's a clear book/e-reader convention to anchor on.

A load-bearing finding up front: **most of ask 2 is already built.** Order rationale already renders as a per-section-header blurb (`RowView.tsx:105-109`, fallback logic in `narration-logic.ts:14-24`, styled `.section-rationale` `app.css:437-445`). And ask 1 already has a calm baseline: top-bar `X / Y reviewed` + a flat green fill (`BookPage.tsx:487-527`), green state-rail + reviewed-tint per chunk (`app.css:494-535`), outline glyphs, a toast channel, and a neutral done banner (`RowView.tsx:113-142`). Both recommendations are *enhancements that respect the existing dialect*, not new systems.

---

# ASK 1 — the satisfaction / progress layer

**Recommendation.** Turn the one flat progress bar into a **chapter-segmented progress bar** in the top bar (one segment per chapter, filling per-chunk, a segment "locking" when its chapter completes), fire a **quiet chapter-completion beat** through the existing toast at each chapter boundary, reframe **resume** as proximity ("62% through — 3 chapters left"), and make the **done moment "wow" through substance** (a crisp accomplishment summary + the coverage guarantee restated) with exactly one allowed motion (the bar animating to full once). No streaks, no confetti, no sound, no XP. The cumulative bar advancing is itself the per-mark reward; per-mark motion stays a single ≤220ms non-looping "settle" that degrades to instant.

## Why

- **Subgoals are the mechanism, and chapters are ready-made subgoals.** The goal-gradient effect (Hull 1932; [Laws of UX](https://lawsofux.com/goal-gradient-effect/)) says effort accelerates with visible proximity to a goal, and that *providing intermediate progress sustains motivation across a long task*. A 700-chunk flat bar barely moves per mark (goal feels infinitely far); chapter segments give the reviewer a *near* goal at all times ("finish this chapter"), which is exactly the artificial-proximity lever the research names. This is the single highest-value change for "reviewing is a drag."
- **Progress visualization measurably raises satisfaction and persistence.** NN/g's progress-indicator work found users shown a moving progress representation were satisfied and *willing to stay ~3× longer*; for long forms the sense of progression "fosters a feeling of accomplishment… motivates users to continue" ([NN/g, Progress Indicators](https://www.nngroup.com/articles/progress-indicators/)).
- **The book metaphor makes chapter-progress the *convention*, not an invention.** Broadly, a segmented/chapter progress bar is the dominant pattern for "how far through a defined linear sequence" (e-readers, courses, multi-step forms). code-story literally calls itself a book with chapters, so this reads as the expected thing (Jakob's Law) and costs almost no novelty. Note the deviation from pure GitHub convention (GitHub shows only "N/M files viewed," no bar) is justified: code-story's differentiator is the *ordered narrative*, and a flat bar already exists — segmenting it is an increment, not a departure.
- **At 300 repetitions, restraint is the feature.** Microinteraction guidance is explicit that per-action motion must be fast, single-purpose, and respect `prefers-reduced-motion` with a static equivalent ([accessible microinteractions summary](https://www.accessibilitychecker.org/blog/microinteractions/)). A looping or celebratory per-mark animation would become nauseating by chunk 50. The cumulative bar carries the reward; the per-mark cue is a settle, not a party.
- **Anti-cheese is a hard audience constraint.** A senior dev reads gamification (streaks/XP/confetti) as condescending — it also collides with R-036's register rule and the repo's honesty gate (R-026). The "wow" for this audience is *earned substance*: "you reviewed 187 chunks across 12 chapters, 100% covered, nothing skipped." That's a real accomplishment stated plainly, which lands harder than confetti.
- **Honesty is preserved by construction.** The denominator stays `distinctChunks` (`BookPage.tsx:99-102`); a mark is a mark in the bar (fragmenting the headline metric would punish legitimate fast review). Depth honesty moves to the *summary*, which already knows bulk/stub marks (`pendingStubCount`, `markedUnseen`) — surface "N marked in bulk (low-signal)" there so the celebratory fill never implies deep scrutiny of lockfiles.

## Spec

**Segmented progress bar** (replaces `.progress-fill`, `BookPage.tsx:498-500` / `app.css:73-85`):
- One segment per chapter/section, flex-widthed by that chapter's chunk count (so segment width = share of the work). Data is already in `sectionStats` (`BookPage.tsx:104-117`).
- Three visual states per segment, distinguishable **without colour** (WCAG 1.4.1, matching the outline glyph doctrine): *untouched* = track grey `#e5e2dc`; *in progress* = partial green fill within the segment (`done/total`); *complete* = fully filled + a subtle inset top tick or slightly darker green so "locked" reads at a glance. 1px gaps between segments.
- Keep the total `140px` width; segments just subdivide it. Add `title`/`aria-label` per segment: `"FilterBar — 3 of 5 reviewed"`. Hover → tie into ask 2 (show the chapter's rationale) as a v1.1 accelerator.
- Reduced-motion: fills update with no transition; otherwise a 180ms width ease on the active segment only.

**Per-mark micro-feedback** (the `markCurrent`/`toggleChunkReviewed` path, `BookPage.tsx:198-239`):
- Primary reward = the segment advancing (free, never fatigues).
- Secondary = a single `~220ms` one-shot on the state-rail: the green rail wipes in top→bottom (transform/opacity only) as state flips to `reviewed`. Non-looping. `@media (prefers-reduced-motion: reduce)` → rail is instantly green (reuse the existing precedent at `app.css:688-692`).
- The header green-tint + "✓ Reviewed" button (`app.css:533-562`) stay as the persistent static truth. No sound.

**Chapter-completion beat** (new small effect watching `sectionStats`):
- When a section's `done` reaches `total` (transition from `<total`), and it wasn't already complete, fire the existing toast (`BookPage.tsx:157-162,709-712`) + `aria-live`: **"Chapter done — FilterBar. 3 chapters left."** Auto-dismiss 2.6s (existing). The segment locks to complete; the outline row (`OutlineSidebar.tsx`) shows a filled ✓ on the section. **No modal, no scroll interruption** — it's a passing acknowledgment.
- Guard against firing on batch-mark of a whole chapter at once (fire once, count it) and on unmark→remark churn (only fire on the incomplete→complete edge).

**Resume framing** (replace `BookPage.tsx:182-186`):
- `"Resumed — 62% through. 3 chapters left, next up: FilterBar."` Percent = `reviewedCount/distinctChunks`. Motivating per goal-gradient (shows proximity); honest (real numbers).

**Done moment** (upgrade the banner, `RowView.tsx:113-142`):
- Keep the neutral facts + per-section table + honest frontier note — those are the trust anchors, don't remove them.
- Add above the table a single quiet hero line and an accomplishment row:
  - **"Review complete — all {N} chunks, {M} chapters."**
  - **"+{added} −{removed} lines read. Nothing was skipped — every chunk required your mark."** (the coverage guarantee is code-story's real flex; state it as the reward.)
  - Depth honesty: if bulk/stub marks exist, **"{k} were marked in bulk as low-signal."**
- The one motion allowance: on reaching done, the segmented bar animates once to full and the header flips to the existing green `.done` state (`app.css:68-71`). Optional restrained flourish: a 1px green top-border on the banner. Reduced-motion → bar is simply already full. **No confetti.**
- Time/sittings ("across 2 sittings, 34 min") is a genuine wow but needs new persisted timestamps → **cut from v1** (see below).

**v1 vs deferred (gradual-scope bias):**
- **v1 (cheap, all data already available):** segmented bar + subgoal semantics; chapter-completion toast; resume-percent copy; done-summary substance + single bar-to-full animation. High value, no new persisted state.
- **v1.1 / deferred:** the per-mark rail "settle" animation (the advancing segment already rewards; add only if hand-driving feels flat); hoverable segments that preview a chapter's rationale + jump (nav accelerator, ties to ask 2); elapsed-time / sittings in the summary (needs new timestamp persistence in the review store — the only piece requiring backend state).

## Rejected

- **Gamification (streaks, XP, points, confetti, sound).** Fails the senior-dev audience, R-036 register, and R-026 honesty. Confetti at the end is the specific cheese to avoid.
- **A progress *ring* instead of a bar.** A ring has no natural mapping to a linear sequence of chapters and can't show "you are here in the book" or per-chapter subgoals — the whole motivational point. Bars own linear-sequence progress by convention.
- **Per-mark celebratory animation (bounce/scale/color burst).** Nauseating at 300 reps; violates the "nothing distracting" constraint. Cumulative bar + ≤220ms settle only.
- **Fragmenting the headline metric by mark-provenance** (e.g. two bars, deep vs bulk). Punishes fast legitimate review and adds noise to the calm bar; depth honesty belongs in the summary, not the always-on indicator.

## Risks & validate later

- **Sparse/one-chapter diffs**: 700 chunks in 3 chapters makes segments coarse; 60 tiny chapters makes them slivers. Mitigation: min segment width, and merge the low-signal tail into one segment. Watch on the fragmented tier-0 case (#100).
- **Chapter-completion toast frequency**: on a 40-chapter diff, 40 toasts could nag. If Tim finds it chatty when driving, gate it to chapters above a size threshold (e.g. ≥3 chunks) — cheap follow-up.
- **Validate by driving**, not testing: does the segmented bar make a 200-chunk lexbox PR *feel* shorter? That's Tim's felt-read (the current mode-shift: he drives, gives concrete feedback).

---

# ASK 2 — why the chunks landed in this order

**Recommendation.** Keep the **per-section-header orientation blurb as the primary, always-visible channel** (it already exists and is placed correctly — it sits at the seam and orients into the next chapter). Add **one book-level "Why this order?" affordance** near the AI-order indicator that opens a 2–3 sentence explanation of the *ordering strategy* — AI-labeled when an AI order is applied, and a **plain, un-badged, factual description of the deterministic rule when it's tier-0** (which can't hallucinate and gives the honest fallback its own answer). **Do not add separate between-section connective transitions.**

## Why

- **The header blurb already answers "why this chunk is here," and it's placed at the exact reading seam.** A section header begins chapter N+1, so its blurb (`RowView.tsx:105-109`) reads as "here's the next chapter and what to look for" — which *is* connective tissue, just attached to the header rather than floating between. Recognition-over-recall (Nielsen #6) says this needs to be visible at every boundary, not hidden behind a click.
- **A second AI text stream (transitions) is the wrong bet three ways.** (1) It duplicates the header voice and doubles AI prose density across 30–700 chunks — fatiguing, and it collides with spec 03's ratified "one AI voice per section" decision (`narration-logic.ts` docstring). (2) Transition copy like *"now that you've seen the data model…"* asserts the reviewer's *path* and an inter-section *causal* claim — both frequently false (the reviewer may have jumped via the neighbor strip, or the order may be tier-0 with no narrative intent). (3) That's precisely the highest-hallucination surface — narration's faithfulness floor already *failed* dogfood 4 on confident-but-wrong relational claims (#48/#58). Connective transitions would reopen that wound.
- **The user's literal question ("why this order") is mostly a *global* question, answered once.** They want to trust the ordering strategy ("callers before callees, tests after impl, built toward the point"), not re-justify every seam. A single "Why this order?" overlay satisfies that without per-seam prose, and it's the natural home for the R-026 AI label and the tier-0 honesty.
- **Tier-0 gets an honest, non-AI answer.** Today when no AI overlay is applied, `sectionAiLine` returns `undefined` and nothing shows (`narration-logic.ts:21-23`) — correct (no fake connective copy), but it leaves "why this order?" unanswered. The deterministic order has a *known rule*, so the overlay can state it as fact ("callees before callers; tests after the code they exercise") with **no AI badge** — it's describing an algorithm, not a model's opinion, so it's both honest and un-hallucinatable.

## Spec

**Per-section blurb (keep as-is, minor guarantees):**
- Renders when an AI order is applied and that section has a rationale; AI-badged, italic, muted (`.section-rationale`). Absent rationale for one section while others have it → show nothing for that section (partial-state honesty, already the model).
- Length: ≤12 words, plain English, orient-don't-judge — already enforced in `order-prompt.ts` (`orderPrompt` / `chapterOrderPrompt` rationale rules). No change needed.
- Copy examples (register check): *"The store the panel reads from — start here."* · *"Wires the new check into the dialog; watch the busy flag."* · *"The tests for the matcher above — confirm the tiers match."*

**"Why this order?" affordance (new, small):**
- A quiet text button beside the `AI reading order` indicator (`BookPage.tsx:509-513`): `Why this order?`. Opens a small popover/overlay (reuse `ShortcutOverlay` styling, `app.css:900-940`) — not a modal that blocks the feed; dismiss on Esc/click-out, focus returns to the trigger (standard disclosure focus management).
- Content, **AI order applied** (AI-badged): *"An AI read the whole change and grouped it into chapters. It put callers before the code they call, and each test right after what it tests, so the story builds toward the point of the change."* (adjust verb to the active `direction`/`testPlacement` config — the copy is derived from the config, so it stays true when Tim flips axes via the order-options control).
- Content, **tier-0 / no AI** (no badge, factual): *"Ordered without AI. Each file's callees come before the code that calls them, and tests follow the code they exercise."* Again generated from the active `StoryConfig` so it never contradicts the live order.
- This makes "why this order?" answerable in *every* state — AI, tier-0, and file view — which the current UI can't do.

**Absent-everything state:** file view or a diff with no graph → the button still explains the deterministic rule in effect. Never a dead end, never a fake narrative.

**v1 vs deferred:**
- **v1:** the "Why this order?" overlay (config-derived copy, both AI and tier-0 branches). Keep the existing header blurb untouched. Cheap — no new AI calls, copy is templated from `StoryConfig`.
- **Deferred:** hoverable progress-bar segments that preview a chapter's rationale (the ask-1/ask-2 synergy nav accelerator). And: if Tim *drives it and still wants* explicit seam transitions, revisit — but only as a controlled, eval-gated addition on the narration track, never a free-running second voice.

## Rejected

- **Between-section connective transitions ("Now that you've seen X, here's Y").** Loses on density (doubles AI prose over hundreds of chunks), redundancy (duplicates the header blurb / spec 03's one-voice rule), and — decisively — hallucination risk: it asserts the reviewer's path and inter-section causality that are often false and already broke the faithfulness floor (#48/#58).
- **On-demand-only per section (hide the blurb behind a click).** Violates recognition-over-recall; the "why this chapter" is wanted at every seam, so a click per section is friction. The blurb is one quiet italic line — cheap to keep visible.
- **Nothing / rely on order alone.** The user explicitly asked, and an unexplained computed order reads as arbitrary — reviewers fight orders they don't trust. The global overlay is the low-cost trust anchor.
- **A fabricated tier-0 "narrative" blurb.** Dishonest (R-026) — deterministic order has no narrative intent. State the rule as fact instead.

## Risks & validate later

- **Config-derived copy must track the live axes.** The order-options control (#114) lets Tim flip consumer/dependency-first and test placement at runtime; the overlay copy is templated from the active `StoryConfig`, so it stays correct — but verify the wording after a live flip.
- **Does the header blurb alone feel sufficient, or does Tim want the seam narration after all?** This is exactly the felt-read best answered by him driving (#54 narrated-vs-bare is still open, decision pending). Ship the visible blurb + global overlay; let his concrete feedback decide whether seam transitions ever earn their eval.

---

**One instruction-feedback note (per my global AGENTS.md):** the brief said "the order overlay already carries short AI rationale strings per section… design how order-rationale reads in the book" — grounding in the code showed it's already *rendered* in section headers, not just carried. That saved a wrong recommendation (proposing to surface something already surfaced); worth the caller knowing ask 2 is ~70% a copy/affordance refinement, not net-new plumbing.