# Spec 05 — Milestone 5: the chunk graph and its traversals

**Status: draft — not yet grilled.**

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
reading order is "an optimal grouping of the change parts by relatedness" — i.e. **every story
is a linearization of a relatedness graph** (research 06 §3). Today we compute fragments of
that graph (file-level imports for ordering, line-level references for context payloads), use
them, and throw the graph away — exactly what research 06 shows every competitor doing. M5
makes the graph a first-class primitive: consumer-first call-path stories fall out as its
default traversal, and the lawn-mower falls out as its free traversal.

Research verdict (docs/research/06-chunk-graph-traversal.md): the combination — chunk grain,
line-provenance edges, status-carrying links, free traversal under a coverage guarantee, linear
backbone — is unoccupied; the ingredients are separately validated (Stacksplorer/Blaze/Prodet
on filtered graph navigation, GBSCI on change-dependency graphs, Reviewable on
minimize-re-review); and the one way to build it *badly* is known and named (§ the design
gates below).

Requirements: R-044, R-045, R-046, R-048, R-049 (new); R-043 + its context rider; advances
R-004 (occurrences as graph re-encounters), R-005 (the backbone), R-007 (edges are
navigation), R-001 (coverage extends to edges). R-034 stays the eval bar.

## The model: ChunkGraph

```
ChunkEdge {
  from, to: chunkId
  kind: 'calls' | 'imports' | 'exercises'   // exercises = test chunk → impl chunk
  fromLines: LineRange[]                     // the lines responsible (R-048), from-side
  source: 'references' | 'import-graph' | 'test-anchor'
}
```

- **Built from what exists**: `references.ts` hits (M4 slice 2) resolved to *defining chunks*
  (the M4 #64 resolver retargeted one level finer — file+symbol → the chunk containing that
  symbol's definition, when it is a changed chunk); `import-graph.ts` edges demoted to
  section-level fallback edges when no call edge exists; test anchors as `exercises` edges.
- **Precision over recall, edges are hints** (research 06 §5e): a missing edge costs a jump
  affordance, never coverage — coverage rides the backbone (R-001), not the graph. A wrong
  edge is worse than a missing one; the resolver's ambiguity rules stay strict, and every edge
  carries its provenance lines so the reviewer can see *why* the link exists and judge it.
- **Chunk-grained, occurrence-rendered**: edges connect chunks; the UI resolves a jump to the
  nearest occurrence (R-004). A neighbor shown "already reviewed" is a *re-encounter* (free
  glance), never a *re-audit* — the R-004/R-049 reconciliation from research 06 §5d.
- Persisted per range next to the other artifacts, keyed by the same CORE_VERSION-folding
  fingerprint discipline; fail-open to no-graph (the book still works bare).

## Traversal 1: the story (default path, consumer-first)

The compiled book becomes the graph's default linearization, direction-configurable (R-045)
with **consumer-first as the shipped default** (R-044):

- **Chunk-level call-path flow**: starting from anchor chunks (entry points: the chunks
  nothing in the diff calls; ties broken by role — pages/routes/tests first per config), walk
  DFS along `calls` edges so each callee chunk appears right after the call site that uses it.
  The IOU becomes the next page. File-section boundaries dissolve into chapter groupings by
  path locality (sections remain as headings; a chunk renders under its file heading at its
  first traversal visit — later visits are occurrences).
- **Tests by kind** (R-043, delegated judgment): unit-test chunks ride their `exercises` edge
  *before* the impl chunk they exercise (contract first); e2e/journey specs close the book
  ("proof the feature works") — their page-object helpers just-in-time before them; setup
  fixtures collapse like low-signal stubs. The rider is honored via M4: one keystroke on a
  lone test pulls its setup/helper context (payload panel), so sparse test slices never
  strand the reader.
- **Cycles and disconnected chunks**: same discipline as tier 0 today — deterministic
  fallbacks, git order ties, leftovers last, `checkOrder` grows a direction parameter (its
  inversion semantics flip with the configured direction; the validator gates AI proposals
  against the *configured* axioms, not hardcoded dependency-first).
- **AI augmentation on by default** (R-046, converges with #71): the model proposes the
  anchor choice, path ordering among siblings, and chapter grouping *within* the configured
  hard constraints; the validator + `checkOrder(direction)` still reject violations outright.
  Fail-open to the deterministic linearization; the R-026 labeling rules carry over unchanged.

## Traversal 2: the lawn-mower (free criss-cross)

- **The neighbor strip** — the only graph UI in M5: on the focused chunk, an in-flow strip of
  its direct neighbors (`calls` in/out, `exercises`, fallback `imports`), each showing its
  review state: **reviewed ✓ / unreviewed / unreviewed-with-more-behind-it** (that last =
  R-048's "only the next step, but not everything behind it": the neighbor itself plus any
  unreviewed chunks reachable beyond it). Research 06 is emphatic here: *filtered local
  neighborhood, never a whole-PR canvas* (Stacksplorer's null result; CodeSee's grave). There
  is no pan-and-zoom graph view in M5.
- **Jump and return**: a keystroke follows an edge (to the target's nearest occurrence);
  a back-stack returns. The reading cursor, seen-tracking, and marking work identically
  wherever the reviewer lands — a chunk CAN be marked reviewed while its neighbors aren't
  (R-048, already true of the review model today).
- **The queue stays the safety net**: n/N (next unreviewed) and the coverage queue are
  unchanged — mowing the lawn in any pattern, the reviewer can always fall back to "take me
  to the next unmowed patch," and 100% means 100% of chunks regardless of path taken.

## The design gates (from research 06 — non-negotiable)

1. **Edge-aware done state (the false-confidence gate, §5b).** Node-by-node green-marking
   with green neighbors is an anchoring machine unless composition is surfaced. M5 defines a
   derived edge state: an edge is *settled* when both endpoints are reviewed; the done banner
   and progress cluster report **frontier edges** (reviewed chunk ↔ unreviewed chunk) and the
   done state is reached only at zero frontier — which follows automatically from all-chunks
   -reviewed, so R-001 semantics don't change, but the *display* makes the composition
   surface visible throughout: "12 of 40 edges frontier" tells the reviewer how much
   glue code sits between green and red. Explicit per-edge sign-off ("I checked this
   interaction") is recorded as the ambitious path, not built in M5.
2. **The backbone must survive (§5a).** The book order remains the default surface a reviewer
   can follow mindlessly to 100%; the graph is an affordance layered on it. If dogfood shows
   the strip pulling attention while comprehension drops, the strip collapses to on-demand.
3. **Local only (§5c).** No whole-graph rendering. The strip shows direct neighbors; "more
   behind it" is a count, not a subgraph.
4. **Hints, not promises (§5e).** Edge coverage is never claimed complete; the UI language is
   "related chunks we found," and the done state's authority remains chunk coverage.

## The gated experiment (slice 0 — before any UI)

Research 06's falsification plan, verbatim in spirit: (1) build the chunk graph offline on the
three dogfood subjects and **hand-measure edge precision on a sample** — if precision is bad,
M5 stops at the resolver, not the UI; (2) instrument the existing walk to count would-be "free
glances" (neighbors already reviewed at each mark) — if the graph wouldn't actually save
re-encounters, the strip is decoration and we learn it for the price of a script. Both are
token-free. The UI slices are gated on both.

## Scoping calls (gradual auto-picked; ambitious path recorded)

1. **Derived edge state, no explicit edge sign-off.** Ambitious: per-edge "interaction
   checked" marks with their own queue. Deferred until the frontier display proves wanted.
2. **Call-path DFS at chunk grain within the existing section renderer** (chunks regroup
   under file headings at first visit) — not a full chapter-authoring system. Ambitious:
   AI-authored chapter titles/groupings; deferred to keep #72's "fastest path to good
   consumer-first" promise.
3. **Anchors from graph shape + role config; AI refines.** Ambitious: salient-chunk detection
   à la GBSCI (research 06 §3). The eval decides if the deterministic anchor is good enough.
4. **Config = CLI flags + per-repo file for direction and test placement** (R-045). Ambitious:
   per-reviewer profiles (R-017 territory) — deferred.
5. **Graph build reuses M4's resolver (#64)** — M4 slices #64–#65 land first (they are the
   resolution machinery this spec's edges need); #66–#68 proceed unchanged. #71's default-on
   lands *with* the R-046 slice here, not before (avoids shipping dependency-first defaults
   twice).

## Non-goals (M5)

- Whole-graph canvas or minimap; SCIP indexes; caller edges into unchanged code (edges exist
  only between changed chunks — unchanged-code context stays M4's payload panel).
- Explicit edge sign-off; per-reviewer adaptive traversal (R-017); threads.
- Any change to R-001's chunk-coverage definition (the frontier display adds, never replaces).

## Slices (filed just-in-time when this spec lands)

1. **Slice 0 — the gated experiment**: offline graph build on three subjects, edge-precision
   hand-audit, walk instrumentation for free-glance counting. Produces a go/no-go note in the
   baseline doc. Token-free.
2. **Core ChunkGraph** — edge model, build from references+imports+test-anchors via the M4
   resolver, fingerprint/freshness, precision rules; `--dump-chunk-graph`.
3. **Consumer-first linearization** — direction-parameterized `checkOrder` + compiler,
   call-path DFS, test placement by kind, config plumbing (R-045); dogfood on all three
   subjects (mechanical gates only, token-free).
4. **AI traversal augmentation** — order prompt v2 against configured axioms, validator
   direction-awareness, #71's default-on folded in (R-046); judge eval re-run (the one
   token-spending slice, ~70k tokens/subject).
5. **The neighbor strip + jump/back** — status-aware local edges in the book UI, keyboard
   model, re-encounter vs re-audit presentation; ux-expert pass (R-029).
6. **Edge-frontier display** — progress cluster + done banner facts; gate 1's surface.
7. **Dogfood 6** — lawn-mower session on a real PR: coverage time, re-review counts,
   comprehension probe (research 06's step 3), baseline-doc verdict.

Each slice demoable on a real diff; slices 5–6 gated on slice 0's numbers.
