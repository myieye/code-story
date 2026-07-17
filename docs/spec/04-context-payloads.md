# Spec 04 — Milestone 4: context payloads (facts first)

**Status: draft — not yet grilled.**

## Why this milestone

Dogfood 4 gave M4 its mandate twice over. First, the narration faithfulness failures were
mechanically caused by blindness: the generator sees only `-U0` fragments, so it guesses at
what surrounds them ("a second copy of [JsonConverter] is added" — it couldn't see there was
only one). Second, spec 03 named the risk that orientation prose alone is
pleasant-but-not-load-bearing, and pointed the fix here:

> "Potentially shows the diff itself as well as maybe some of the methods that the diff calls.
> Needs to be clear what the diff is and what is not the diff" (original prompt, R-006)

> "Generates 'context payload' for code… that thinks it needs it, but allows loading the same
> context easily on-demand" (original prompt, R-008)

M4 builds the code-access layer M3 deferred and ships the **facts half** of the ContextPayload
sketch (`docs/design/core-primitives-sketch.md` §4): script-derived, free, safe to compute in
bulk (R-024). The AI half (`narrative`) stays deferred — except for one bridge slice where the
new plumbing feeds the *existing* narration prompt, attacking the measured faithfulness failure
at its root.

Requirements satisfied or advanced: R-006 (inline non-diff context, boundary-disciplined),
R-008 (facts payloads, proactive-bulk + on-demand), R-027 (fast: facts are git+tree-sitter,
no model calls), R-024/R-042 (this milestone is the "scripts" half of the bargain), R-007
advanced narrowly (definition lookup within the daemon's reach; full navigation stays open).

## Goal

When a reviewer meets a chunk that calls something they can't see, one keystroke shows the
definition — the body of the called method/component as it exists at head — rendered as
clearly-not-diff context. All of it is computed by scripts; none of it waits on a model.

Two deliverables:

1. **The resolution pipeline** — chunk → referenced symbols → definitions (changed *or*
   unchanged files, via the existing `fileAt` + tree-sitter machinery), cached per head.
2. **The context surface** — an on-demand, collapsed-by-default definition panel per chunk in
   the book UI, plus the payload store and bulk precompute job.

## What a payload is (v1 = facts only)

Per the primitives sketch, narrowed:

```
ContextPayload v1 {
  chunkId, headSha, generatedAt
  facts: {
    definitions: [{ symbol, file, changed: boolean, body, lineStart }]
    edges: { imports: [file], importedBy: [file] }   // from the existing graph, free
  }
}
```

- **`definitions`** — for identifiers referenced in the chunk's changed lines whose definition
  the resolver can find: the defining file, whether that file is part of this diff (changed →
  the reviewer will meet it as a section; unchanged → this panel is the only way they'll see
  it), and the definition body at head. Resolution is precision-over-recall like the import
  graph: never fabricate; an unresolved reference is simply absent.
- **`edges`** — the chunk's section-level import edges, already computed for ordering; surfaced
  because "what does this file lean on" is orientation the graph already knows.
- **No `narrative`, no `depth`** in v1 (scoping calls 3–4). The schema carries them as optional
  future fields exactly the way the narration overlay's per-chunk values were designed to grow.

## Resolution pipeline (all scripts, R-024)

1. **Reference extraction** (core, pure): from a chunk's added/context lines, collect candidate
   identifiers — call expressions and JSX/Svelte component tags via the tree-sitter parse the
   chunker already runs; no new grammars.
2. **Definition lookup** (server):
   - Changed files first: the tree-sitter symbol tables `computeChunks` already builds cover
     every changed file — match by symbol name, prefer the import-graph-connected file.
   - Unchanged files: follow the chunk's file's import specifiers (same resolution rules as
     the import graph, now allowed to leave the changed set), `fileAt(repo, head, path)` the
     target, parse it with the existing tree-sitter machinery, extract the named symbol's body.
   - Ambiguity (same name, multiple candidates, no import edge to disambiguate) = no
     definition. Precision over recall, stated in the payload's absence.
3. **Body cap**: a definition body over ~80 lines is truncated at a statement boundary with an
   explicit `… (N more lines)` marker — a payload must never become a second wall of diffs.
4. **Cache**: payloads persist at `reviews/<b12>..<h12>.context.json`, keyed by chunk id (which
   already fingerprints content) + headSha. The freshness filter follows
   `filterFreshNarration`'s fail-open pattern: stale or malformed = absent, never wrong.

## Runtime shape

- **On-demand first** (R-008's second half): `GET /api/context?chunk=<id>` resolves one chunk
  (compute-on-miss, then cached). Target: fast enough to feel instant on a warm cache and
  tolerable cold (`git show` + one parse; no model calls, R-027).
- **Bulk precompute** (R-008's "in bulk would be preferable"): `POST /api/context-job` walks
  all narratable sections' chunks and fills the cache — same job-record lifecycle as the
  narration job (one in flight, resumable per chunk, orphan = failed) minus the model calls;
  CLI `--context` runs it inline. Because facts are free, bulk-by-default is safe — no token
  economy to guard, only IO.
- **Web surface**: each chunk with a non-empty payload gets a quiet affordance ("definitions:
  debouncedFilter, FilterBar"); expanding renders read-only code blocks **visually distinct
  from the diff** (R-006's hard rule — different background, explicit file@head caption, never
  inside the CM6 merge view). Collapsed by default and *stays* collapsed until asked:
  the anchoring research (Tufano et al.; design gate #6) says proactive AI-selected emphasis
  narrows attention — a facts panel must widen it, on the reviewer's initiative. Keyboard: one
  key to toggle on the focused chunk; never a focus stop.
- **The narration bridge (the one AI-touching slice)**: `buildSectionNarrationInput` gains the
  chunk's resolved definitions (capped, clearly marked `context — not part of the diff`) so
  the narration model stops guessing at unseen code. Prompt bump + rubric re-eval on both
  subjects; the hypothesis is a faithfulness-floor pass with register holding. This is the
  R-042 line: scripts fetch the truth, AI only phrases it.

## Scoping calls (gradual auto-picked; ambitious path recorded)

1. **Head-side definitions only; base-side fallback for deletions.** Ambitious: R-007's full
   both-versions navigation (base and head bodies, diffed). `fileAt` works at either sha, so
   the door is architecture-free; the UI cost is what's deferred. A chunk whose file is
   deleted resolves at base — otherwise head.
2. **Definitions + edges only; no callers, tests, blame, or history facts.** Ambitious: the
   sketch's full facts list. Callers-of-this-symbol needs a project-wide index (SCIP per ADR
   0001 §3, still unbuilt); starting with callees keeps M4 index-free. SCIP stays the named
   door for callers and true go-to-def (R-007).
3. **No `narrative` payloads.** Ambitious: AI-written "why this context matters" per payload.
   Deferred until the facts surface proves itself in dogfood — and the narration bridge
   already gives AI the same information with an eval harness attached.
4. **No adaptive depth, first-sweep flagging, reviewer model, or defer-with-question**
   (R-009/R-015/R-016/R-017). Same deferral as spec 03 scoping call 3; the payload schema's
   optional fields are the open door. Bulk-precompute-everything makes first-sweep flagging
   unnecessary for *facts* (they're free); flagging earns its place when narrative payloads
   cost tokens.
5. **No UI-code mode** (R-019). The markup→handler jump is a definition lookup this pipeline
   can already serve for changed files; a dedicated mode (flow checks, loading-state
   reasoning) is its own milestone once dogfood shows the plain panel isn't enough.

## Non-goals (M4)

- SCIP/ctags/LSP indexes, go-to-definition UI, callers/references (R-007 full form).
- AI narrative payloads; findings of any kind (comprehension surface only, anchoring gate).
- Editing, threads, first-sweep flagging, reviewer/author model.
- Payloads for low-signal stubs or the leftovers section (same exclusion as narration).

## Slices (filed just-in-time when this spec lands)

1. **Core reference extraction + payload model** — identifier/call extraction from chunk
   lines (tree-sitter, pure), `ContextPayload` types, freshness filter, body-cap logic.
2. **Server resolution + store + API** — definition lookup across changed/unchanged files
   (`fileAt` + existing parsers), context store, `GET /api/context`, compute-on-miss.
3. **Bulk job + CLI** — `POST /api/context-job` (resumable, model-free), `--context`,
   `--dump-context` for dogfooding.
4. **Web definition panel** — collapsed-by-default affordance, R-006 boundary styling,
   keyboard toggle, ux-expert pass (R-029).
5. **Narration bridge + re-eval** — definitions in the narration input, prompt bump, rubric
   eval on both subjects; gate: faithfulness floor clears, register median holds.
6. **Dogfood 5** — real-PR walk: does one-keystroke called-code context reduce the
   jump-out-of-the-book moments? Baseline-doc section + read notes for Tim.

Each slice demoable on a real diff.
