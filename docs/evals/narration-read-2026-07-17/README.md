# Narrated-vs-bare read — the human half of the M3 narration gate

Two narrated books (`> AI:` lines are the narration — opener under the title, an intro under
each section heading, sparse one-liners above some chunks). The bare versions of the same books
are the blind-read pair sources: `../blind-read-2026-07-16/pr2309-*.md` and `pr2357-*.md`
(either copy — ordering differs, text is identical).

This read is deliberately not blind — you can't hide which book has narration. The question is
different from the ordering A/B (spec 03, "The narration eval"):

**Does the narration reduce the felt wall-of-diffs burden, or is it pleasant-but-not-load-bearing
noise?** Read one narrated book the way you'd review the PR. Then ask:

1. Did the opener give you a thread to follow, and did you actually use it?
2. Did section intros change where you looked first, or did you skip them by the third section?
3. Chunk lines are sparse by design — did the ones that exist add something the diff didn't say?
4. Did any line feel like it was *selling* the change rather than orienting you? (That's a
   register-gate escape — quote it, it grows the banned-phrase list.)
5. Would you turn this on for your next real review?

A "pleasant but I'd not miss it" verdict is a named acceptable outcome: it shelves default-on
narration and pivots M4 toward code-context payloads (R-008) instead. Record the verdict in the
baseline doc's Dogfood 4 section; the judge-model scores are already there for comparison.

Known gaps in these copies (deliberate, recorded in the overlays; regenerated 2026-07-17 with
`narration-4` after the duplication-claim and register-cap fixes): PR 2309 is fully narrated.
PR 2357 has one section without an intro and no opener — opus overflowed the 3-sentence opener
cap on all three asks; the failure is recorded, not hidden ("faithful or silent").
