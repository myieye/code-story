# PR versions (design sketch)

Direction for R-038…R-041 ([verbatim source](../vision/addendum-2026-07-16-pr-versions.md)).
Status: sketch — **deliberately deferred** (Tim: leaving it out still gets ~80%); recorded now
so nothing built in the meantime closes the door. Not scheduled for any milestone yet.

## The good news: the primitives already fit

Tim's appended-chapter model maps onto the existing data model
([core-primitives-sketch](core-primitives-sketch.md)) with almost no new machinery:

1. **A chapter is just more sections.** The book is ordered sections of occurrences; a new PR
   version compiles `prevHead..newHead` into sections appended at the end. This resolves the
   sketch's open question "incremental recompile vs whole editions" → **append chapters;
   `crunch` produces a fresh edition**.
2. **Stale is an occurrence attribute, not a chunk state.** When version N+1 re-touches code
   shown in an earlier occurrence, chunk-identity matching (the same machinery R-014's
   `reopened` already needs) marks the *old occurrence* `staleAsOf: versionN+1` with a forward
   link to its superseding occurrence in the new chapter. Nothing moves, nothing is deleted
   (R-039) — exactly the R-001 posture applied over time.
3. **Review state already survives.** State is keyed by chunk id and append-only; a chunk
   unchanged across versions keeps its `reviewed` (no re-review, R-038); a changed one gets a
   fresh chunk in the new chapter while its ancestor's occurrence goes stale (no
   stale-reviewing, R-038).

## Incremental vs absolute (R-040)

A version-N chapter's chunks are computed against `head(N-1)` (incremental — that's what the
reviewer reads). The absolute view is a per-chunk toggle: re-diff the chunk's symbol at
`base..head(N)` on demand. Scripts-only (R-024); no stored duplication.

## Crunch (R-041)

`crunch` = recompile `base..currentHead` as a fresh single-story edition, then replay:

- **Review state carries only by proof**: a chunk in the new edition starts `reviewed` iff
  identity matching shows its exact content was already reviewed in the old edition
  (fingerprint match, not symbol-path match). Anything weaker fabricates coverage
  (R-001/R-026). Everything else re-enters the queue.
- **AI analysis is reused, then adapted**: context payloads cached per fingerprint still apply;
  narration is regenerated (cheap-model pass) so prose treats the current diff as the only diff
  — no "as we saw in version 2" ghosts.
- Old editions remain readable (they're just books; the store is append-only).

## The hard case: force-push / rebase

`prevHead..newHead` is meaningless across a rebase — incremental chapters can't be computed
honestly. Direction: detect it (merge-base moved) and offer `crunch` as the *fallback path* —
a rebase invalidates the linear-appendix story, so start a fresh edition with proven-reviewed
carryover. `git range-diff`-style matching could later upgrade this to partial chapter
recovery; not worth it before dogfooding shows rebases are frequent mid-review.

## What today's code must preserve (the door-stays-open invariants)

1. Chunks stay **derived and fingerprinted** — identity matching is the enabler for stale
   marking, reopen, and crunch carryover alike (slice #3 builds this).
2. Books stay **occurrence-based references** to chunks — chapters and stale-marks are then
   pure data additions.
3. Review state stays **append-only and keyed by chunk id + head SHA** — never overwritten, so
   any future recompile can replay it.
