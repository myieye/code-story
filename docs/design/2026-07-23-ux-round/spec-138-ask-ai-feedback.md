# Approved UX spec — issue #138: ask-AI progress feedback (R-064)

ux-expert recommendation (2026-07-23), adopted as the build contract. Not started — build
after #137 lands (same files: DeferredCard, RowView, BookPage, defer-logic).

Key code finding that shapes everything: **failure is currently invisible outside the
end-of-book card.** A failed AI deferral on a collapsed chunk falls through `stubCopy` to the
plain note branch with no failure signal, and `deferCluster` counts failed as neither
`answering` nor `answersReady`, so the top-bar count silently drops. Q4 is a correctness gap,
not polish.

## Q1 — In-flight: indeterminate pulse + honest elapsed count-up

Anchored on the collapsed chunk stub (where the reviewer's gaze already is when the popover
closes): an opacity-pulsed `…` (reduced-motion → static) plus a live elapsed count-up
("AI answering 12s"). Same indicator reused inline and in the Deferred card. NO staged copy
("queued → asking → writing" is fabrication — the record only carries running|done|failed,
the lane is single-flight, no streaming), NO percent-done (nothing to measure; NN/g percent
guidance is conditional on estimability). `Date.now() − createdAt` is always true.

Spec:
- `elapsedLabel(createdAtIso, now)` in defer-logic.ts — "12s", "1m 05s". Unit-tested.
- New `AnsweringIndicator({ createdAtIso })` component owning its own 1s interval — BookPage
  never re-renders per second; only the ~1 mounted indicator does.
- Replace `stubCopy(...)` with `stubModel(...): { kind: 'answering'|'ready'|'failed'|'other',
  text, createdAtIso? }` (discriminated union, pure, tested). RowView renders the indicator
  for `answering`; same component in the inline branch and DeferredCard.
- CSS on `.deferral-answer.answering`: `.answering-dots::after { content:'…'; animation:
  dot-pulse 1.2s infinite }`, disabled under prefers-reduced-motion (the count-up stays — it
  IS the liveness signal there).
- Copy: stub answering ⇒ "AI answering ↓" + elapsed; ready ⇒ unchanged. Elapsed + dots are
  aria-hidden (never per-tick SR announcements — WCAG 4.1.3: discrete transitions only).

## Q2 — Poll: adaptive 3s/8s, no queue-position plumbing

`pollIntervalMs(deferrals, now): number | null` in defer-logic.ts: no pending AI deferrals ⇒
null (stop); youngest pending < 30s old ⇒ 3000; else 8000. Self-rescheduling setTimeout (not
fixed interval), fail-open on error (reschedule same tier). Replaces the flat 10s poll.
Queue position: SKIP — single-flight lane, single reviewer; precise position would need new
server ordering surface for a rare condition. Zero server changes; the deferrals list stays
the single source of truth. Documented honesty caveat: while queued behind another question,
elapsed reads as "time since you asked" — acceptable; revisit only if dogfooding shows real
multi-question contention (v2: ordered queued ids on the /api/deferrals GET).

## Q3 — Global visibility: make the existing top-bar cluster live

The progress-cluster deferred tail stays the single global home (passive, click-to-jump).
Add: the same `.answering-dots` animation while answering; count flips answering → ready on
arrival; one subtle one-shot pulse of the cluster (~1.4s class toggle, keyframe background
flash, reduced-motion → none) when `newlyAnswered > 0`. Keep the existing polite announce.
No new toast/tracker; don't animate the outline ⏲ row (navigation, not a status board).

## Q4 — Failure surfacing (the correctness gap)

- `stubModel` failed case ⇒ "Deferred — AI couldn't answer · retry at end ↓" with the
  existing `.failed` tone.
- `deferCluster` gains a `failed` count; tail composition priority: include ready + failed
  whenever >0, include answering only when both are 0 — e.g. "3 deferred · 1 answer ready ·
  1 failed"; failed count wrapped in `.cluster-failed` (red). Unit-test the composition.
- New `newlyFailed(prev, next)` (mirror of newlyAnswered) → one polite announce: "An AI
  answer couldn't be completed — retry in Deferred."
- Retry stays in the card + inline (where resolution happens); stubs point, don't act.
  The server's orphan-restart failure (ORPHAN_ERROR) rides the same rendering.

## v1/v2

v1 = all of the above; web-only, zero server change, logic in defer-logic.ts + one component.
v2 (evidence-gated): per-deferral queue position; per-card "new answer" marking; global
"AI working through N questions" line.

Rejected: staged copy (dishonest); percent bar (unmeasurable); dedicated toast (interrupts a
reviewer who deferred to avoid interruption); always-on queue position (noise + new server
surface); retry-on-stubs (multiplies affordances); animating the outline row; flat 3s poll
(needless churn through a 90s tail).

Files: defer-logic.ts (+tests), BookPage.tsx, RowView.tsx, DeferredCard.tsx, app.css, new
AnsweringIndicator.tsx.
