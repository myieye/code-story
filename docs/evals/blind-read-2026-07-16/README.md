# Blind A/B read-through — the open half of the M2 ship gate

Three pairs of books. Each pair is the **same changes in two different section orders** — one
order is the deterministic tier 0, the other came from the AI ordering job. Which is which was
randomized per pair and sealed (base64) in `mapping.sealed`. **Don't decode it until you've
picked.**

How to do it (10–20 min per pair, PR 2379 is the short one):

1. Read `pr2379-A.md` and `pr2379-B.md` (or skim far enough to feel the difference).
2. Pick the one that reads better as a story: do you meet things before they're used, one
   concern at a time, building toward the point of the change? Note one line on why.
3. Same for the `pr2357-*` pair (bigger; skimming section flow is fine) and the `pr2309-*`
   pair (Svelte/TS-only, 16 sections — added by Dogfood 3, issue #30).
4. `base64 -d mapping.sealed` — then record picks + reveal in the baseline doc's Dogfood 2
   section and flip spec 02's status line to ship or hold.

Honesty caveat: the Dogfood 2 write-up in `dogfood-0-baseline.md` describes what the AI
changed per subject — if you've already read those details closely, you're partially unblinded;
say so in the write-up if it felt that way.
