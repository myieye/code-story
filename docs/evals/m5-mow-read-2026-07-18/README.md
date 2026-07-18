# M5 lawn-mower read (Tim) — the felt half of the R-048/R-049 bet

The M5 UI (neighbor strip #78 + frontier surfacing #79) is built and works end-to-end. Dogfood 6
measured the **structural** half (`docs/evals/dogfood-0-baseline.md`, "Dogfood 6"): the graph-guided
mow genuinely surfaces a change's *connected core* (it reconstructed the whole `EntryQueryHelpers`
hub-and-spoke from the strip alone), but real changed-file graphs are **island-dominated** (2379:
53% of chunks touch no interaction edge; 2309: 89%), so the mow is a local aid layered on the linear
safety net, not a replacement for it.

**The one thing no measurement can answer — your call:** when you follow the neighbor strip through
a change's connected core, does criss-crossing **actually ease the wall-of-diffs burden** more than
reading top-to-bottom? Or is the straight read fine and the strip just pleasant garnish? This is the
R-048/R-049 bet's human half — the same kind of felt read as #54 (narration) and #74 (edges).

## How to try it (~15 min)

1. Build + serve a dense-core subject (the `EntryQueryHelpers` hub):
   ```
   pnpm build
   cd /home/user/lexbox
   node <code-story>/packages/server/dist/cli.js "8dd70ba~1..8dd70ba" --no-ai-order --port 7357
   ```
   Open the book. (For the near-null contrast, also try `c0448522..pr-2309` — mostly islands.)
2. **Straight read:** j/k top-to-bottom, mark each with Enter. Notice where you lose the thread of
   *how the pieces connect* (e.g. which chunk wires up the helpers, which tests cover what).
3. **Restart the daemon** (it holds review state in memory — restart to reset), then **strip-guided
   read:** start at the kernel-wiring chunk, follow its `→ calls` chips out to the helpers, then the
   `exercised by` chips to the tests. Feel whether following the edges made the hub's structure
   click into place faster.
4. Compare the two passes: did edge-following help you *hold the change in your head*, or was the
   criss-crossing more distraction than aid?

## Honest caveats before you judge

- **Judge the concept, not today's gesture.** There is a real, unfixed friction (harvested, and it
  needs your design call — see the linked issue): Enter's mark-and-advance moves the cursor in *book
  order*, and the strip only shows for the cursor chunk, so a smooth "mark this, now follow its call"
  mow isn't one gesture yet. To feel the *concept* cleanly, jump with click / `g` **without** marking
  (just read along the edges); don't let the current clunk color the verdict on whether edge-following
  helps.
- The mow only guides the connected core; most of a real PR is still a linear sweep. That's expected
  and honest — the strip is a local aid, the coverage queue is the backbone.

## Outcome

Record the verdict in the baseline doc's "Dogfood 6" section. **"The straight read was fine — I'd not
miss the mow" is a named, acceptable result**: it shelves graph-traversal-as-primary-navigation and
keeps the strip as a light reference aid (which the island rate already argues for). A "yes, the core
was much clearer" result promotes the mow and makes the gesture fix (below) worth prioritizing.
Either way, independent of the gesture-design decision.
