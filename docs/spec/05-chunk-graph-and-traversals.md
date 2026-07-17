# Spec 05 — Milestone 5: the chunk graph and its traversals

**Status: grilled same-day (14 findings, verdict "needs surgery" — folded in below; the big
three: chunk-grain call-path flow requires a new traversal-derived *chapter* primitive, not
the file-section renderer; the graph decouples from M4's unchanged-file machinery; and the
frontier display is honest surfacing, not a gate). Slices filed when this lands.**

## Why this milestone

Two of Tim's directives converged into one design (both 2026-07-17, verbatim in
`docs/vision/addendum-2026-07-17-ordering-preferences.md`):

> "consumers before dependencies is probably the right order if we truly get the chunk/change
> ordering done well. Then I can smoothly flow through each calling path instead of keeping
> IOU's in my head." (R-044 — an MVP goal, "whichever path gets us there fastest")

> "perhaps it's supported by a thorough code graph of chunks. each chunk is aware of what
> chunks it's related to, which lines are responsible for that relationship… the reviewer can
> traverse the change graph a bit like a mindless lawn mower robot that eventually covers
> everything" (R-048/R-049)

They are the same thing seen twice: Baum & Schneider's review-ordering theory says an optimal
reading order is "an optimal grouping of the change parts by relatedness" — **every story is a
linearization of a relatedness graph** (research 06 §3). Today we compute fragments of that
graph, use them, and throw the graph away — exactly what research 06 shows every competitor
doing. M5 makes the graph a first-class primitive: consumer-first call-path stories fall out
as its default traversal, the lawn-mower as its free traversal.

Research verdict (docs/research/06-chunk-graph-traversal.md): the combination — chunk grain,
line-provenance edges, status-carrying links, free traversal under a coverage guarantee,
linear backbone — is unoccupied; the ingredients are separately validated (Stacksplorer/Blaze
/Prodet on filtered graph navigation, GBSCI on change-dependency graphs, Reviewable on
minimize-re-review); and the known way to build it badly is named in the design gates below.

Requirements: R-044, R-045, R-046, R-048, R-049 (new); R-043 + its context rider; advances
R-004 (occurrences as graph re-encounters), R-005 (the backbone), R-007 (edges are
navigation), R-001 (unchanged — see gate 1's honesty note). R-034 stays the eval bar.
**R-049 scope honesty**: M5 delivers the *within-pass* half of "minimize re-review"
(status-visible neighbors turn re-encounters into free glances). The *across-version* half —
never re-reviewing a chunk that survived a new PR revision — is the R-038–R-041 fingerprint
carry-forward, deferred with those requirements. The spec does not claim it.

## The model: ChunkGraph

```
ChunkEdge {
  from, to: chunkId
  kind: 'calls' | 'file-imports' | 'exercises'
  fromLines: LineRange[]      // caller/test-side lines responsible (R-048)
  source: 'references' | 'import-graph' | 'test-anchor'
}
```

- **`calls`** — from `references.ts` hits (M4 slice 2, built) resolved to the defining
  *changed* chunk via the tree-sitter symbol tables `computeChunks` already builds. This is a
  small new changed-file-only resolver — **not** M4 #64's unchanged-file machinery (head path
  index, `fileAt` on unchanged files, definition bodies): none of that is on the edge path.
  M4 #64–#68 proceed independently and in parallel; neither milestone blocks the other.
- **Provenance is caller-sided by design**: `fromLines` are the call-site lines; the
  callee-side "lines responsible" are the defining chunk itself, so they are not stored —
  an incoming edge in the UI reads "called from <file>:<lines>", an outgoing one "calls
  <symbol> (defined in <chunk>)".
- **`file-imports`** — the existing file-level import edges, kept at their true granularity:
  they connect *section-anchor chunks* (each file's first primary chunk) and are labeled
  file-level in any UI. They exist as fallback relatedness where no call edge resolved; they
  never pretend to chunk precision (the grill killed the silent file→chunk demotion).
- **`exercises`** — the sole test→impl edge kind (a test's call into its impl is *not* also a
  `calls` edge). The calls-DFS never traverses `exercises`; the test-placement rule owns them.
- **Precision over recall, edges are hints** (research 06 §5e): a missing edge costs a jump
  affordance, never coverage — coverage rides the backbone (R-001). A wrong edge is worse
  than a missing one; ambiguity rules stay strict; every edge shows its provenance lines so
  the reviewer can judge the link.
- **Chunk-grained, occurrence-rendered**: edges connect chunks; jumps resolve to the nearest
  occurrence (R-004). A neighbor shown "already reviewed" is a *re-encounter* (free glance),
  never a *re-audit* (research 06 §5d).
- **Chunk grain inherited from M0** (fragments split >40 lines): whether that is small enough
  for R-049's "small chunks" premise is *measured, not assumed* — slice 0 reports the chunk
  -size distribution and per-re-encounter cost alongside edge precision. Finer chunking is
  deferred unless those numbers demand it.
- Persisted per range, CORE_VERSION-folding fingerprints, fail-open to no-graph.

## Traversal 1: the story (default path, consumer-first)

**This is a new linearizer and a new grouping primitive — priced honestly (grill F1).** The
current Book model is one section per file; cross-file call-path flow cannot live inside it.
M5 introduces the **chapter**: a Section whose occurrences may span files, produced by the
traversal. `checkOrder` moves from section-position to **chunk-position** semantics. What
survives from `book.ts`: role classification, the low-signal tail, leftovers-last, cycle
discipline (Tarjan break, deterministic ties). What is superseded: file-section assembly,
`topoSort`-over-files as the story's spine, and `orderTestBlock` (rewritten, not
parameterized — R-043 inverts both its anchor logic and `checkOrder`'s `testBeforeImpl`
gate, which currently treats tests-first as the violation).

- **Anchors, precisely** (grill F11): a chunk with no incoming intra-diff `calls` edge is an
  entry point; anchors order by role config (pages/routes first), then git order. A diff with
  no `calls` edges at all (all leaves — common) degenerates gracefully: the story falls back
  to file-grouped git order, i.e. today's backbone. The graph adds nothing there, and that is
  fine — the strip still shows `file-imports` relatedness.
- **Call-path DFS**: from each anchor, callee chunks follow their call sites. A chapter is one
  DFS run; its heading names the anchor's file (occurrences from other files carry a `from
  <file>` label). First visit renders the chunk; later meetings are occurrences (R-004).
- **Tests by kind** (R-043, delegated judgment): unit-test chunks precede the impl chunk they
  exercise (contract first); e2e/journey specs close the book, page-objects just-in-time
  before them; setup fixtures collapse like stubs. The rider is honored via M4's payload
  panel: one keystroke on a lone test pulls its setup/helper context.
- **Two independent config axes** (R-045, grill F3): call-direction (consumer-first default /
  dependency-first) and test placement (before default / after / end) — CLI flags + per-repo
  config file. `checkOrder(direction, testPlacement)` validates against the *configured*
  axioms.
- **AI augmentation on by default** (R-046): the model proposes anchor choice, sibling order,
  chapter grouping *within* the configured constraints; validator + `checkOrder` reject
  violations; fail-open to the deterministic linearization; R-026 labeling unchanged.
- **#71 ships first, on current axioms** (grill F6 — surfaced, decided, Tim can veto): the
  ratified default-on is a default flag plus auto-run plumbing that is direction-agnostic.
  Deferring it weeks behind slice 3 to avoid one later default flip would silently reverse a
  ship decision. #71 lands on today's dependency-first axioms; slice 3 re-flips the default
  direction when the consumer-first linearizer passes its gates.
- Ordering changes bump **CORE_VERSION** (invalidating persisted overlays) — budgeted in
  slice 3, regeneration noted.

## Traversal 2: the lawn-mower (free criss-cross)

- **The neighbor strip** — the only graph UI in M5: on the focused chunk, an in-flow strip of
  direct neighbors (`calls` in/out, `exercises`, `file-imports` labeled as such), each showing
  review state: **reviewed ✓ / unreviewed / unreviewed-with-more-behind-it** (R-048's "only
  the next step, but not everything behind it" — the count of unreviewed chunks reachable
  beyond that neighbor). Research 06 §3's design lesson: Stacksplorer *won* by showing the
  filtered local neighborhood; the baseline that showed more of the graph (Eclipse's Call
  Hierarchy) was the null result. There is no whole-PR canvas in M5, ever.
- **Jump and return**: a keystroke follows an edge to the target's nearest occurrence; a
  back-stack returns. Cursor, seen-tracking, and marking work identically anywhere — a chunk
  CAN be marked reviewed while neighbors aren't (R-048; already true today).
- **The queue stays the safety net**: n/N and the coverage queue are unchanged; any mowing
  pattern can always fall back to "next unmowed patch," and 100% means 100% of chunks.

## The design gates (from research 06)

1. **Frontier surfacing — honest scope (grill F4).** The progress cluster and done banner
   report **frontier edges** (reviewed ↔ unreviewed) throughout the review; the strip colors
   them. This *prevents nothing*: 100% chunk coverage always implies zero frontier, and M5
   adds no completion barrier — it is composition *surfacing*, not a gate. The research's
   real gate (explicit per-edge "interaction checked" sign-off with its own queue) is the
   recorded ambitious path. What M5 does bind: the done banner states plainly, R-026-style,
   "all chunks reviewed; N cross-chunk interactions were surfaced during review — none were
   individually verified" — the tool never implies composition was checked when it wasn't.
2. **The backbone must survive.** The book order remains the surface a reviewer can follow
   mindlessly to 100%; the graph is an affordance on top. If dogfood shows strip-chasing with
   comprehension loss, the strip collapses to on-demand.
3. **Local only.** Direct neighbors in-flow; "more behind it" is a count, never a subgraph.
4. **Hints, not promises.** Edge coverage is never claimed complete; UI language is "related
   chunks we found"; done-state authority remains chunk coverage.

## The gated experiment (slice 0 — before any UI, token-free)

1. **Edge precision, falsifiably** (grill F5): build the graph offline on the three dogfood
   subjects; sample **30 `calls` edges per subject** (or all, if fewer); **blind audit: Tim
   labels a 15-edge subsample per subject** (relevant / irrelevant, with Claude's labels
   sealed until after), Claude labels all 90. **Go threshold: ≥0.90 precision on Tim's blind
   subsample** and no systematic disagreement with Claude's labels (if Claude's self-audit
   diverges optimistically, Claude's number is discarded — generator self-grading is the
   trap R-026 exists for). Below threshold, M5 stops at the resolver until precision is
   fixed; the UI slices never start.
2. **Free-glance proxy** (labeled a proxy — grill F14): instrument the existing linear walk
   to count, per mark, how many graph-neighbors were already reviewed. This bounds the
   *within-pass* re-encounter benefit from below; it cannot measure free-traversal value
   (that's dogfood 6's job). Also reports chunk-size distribution (grill F7).

## Scoping calls (gradual auto-picked; ambitious path recorded)

1. **Frontier display, no edge sign-off.** Ambitious: per-edge "interaction checked" marks
   with their own queue — the real composition gate, deferred until the display proves wanted.
2. **Chapters as traversal-derived sections; no AI chapter authoring.** Ambitious: AI-titled
   chapters/groupings. The heading is the anchor file's path; good enough for M5.
3. **Anchors from graph shape + role config; AI refines.** Ambitious: GBSCI-style salient
   -chunk detection. The eval decides if deterministic anchoring suffices.
4. **Config = CLI flags + per-repo file** (two axes). Ambitious: per-reviewer profiles
   (R-017) — deferred.
5. **Graph needs only #63 + a changed-file symbol→chunk resolver** (grill F2). M4 #64–#68
   continue independently; neither blocks the other. #71 ships before slice 3 (see above).

## Non-goals (M5)

- Whole-graph canvas/minimap; SCIP; edges into unchanged code (that context stays M4's panel).
- Explicit edge sign-off (ambitious path of gate 1); per-reviewer traversal (R-017); threads.
- Across-version re-review carry-forward (R-038–R-041 — deferred with those requirements).
- Any change to R-001's chunk-coverage definition.
- Finer chunking than M0's grain (unless slice 0's size numbers demand a follow-up issue).

## Slices (filed just-in-time when this spec lands)

1. **Slice 0 — the gated experiment** (token-free): offline graph build, blind edge-precision
   audit with the ≥0.90 threshold, free-glance proxy + chunk-size distribution; go/no-go note
   in the baseline doc. **Blocks slices 4–6, not #71 or M4.**
2. **Core ChunkGraph** — edge model, changed-file symbol→chunk resolver over #63's
   references, file-import fallback at anchor chunks, `exercises` edges, fingerprints,
   `--dump-chunk-graph`.
3. **The chapter linearizer** — chunk-position `checkOrder(direction, testPlacement)`,
   call-path DFS chapters, tests-by-kind placement (orderTestBlock rewrite), config plumbing,
   CORE_VERSION bump; mechanical gates on all three dogfood subjects (token-free).
4. **AI traversal augmentation** — order prompt v2 against configured axioms; judge eval
   re-run (the token-spending slice, ~70k tokens/subject). (#71 has already shipped by now;
   this re-flips the default direction.)
5. **The neighbor strip + jump/back** — status-aware local edges, keyboard model,
   re-encounter presentation; ux-expert pass (R-029). Gated on slice 0.
6. **Frontier surfacing** — progress cluster + honest done-banner language (gate 1). Gated
   on slice 0.
7. **Dogfood 6** — lawn-mower session on a real PR: coverage time, re-review counts,
   comprehension probe; baseline-doc verdict on the whole bet.
