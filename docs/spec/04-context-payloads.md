# Spec 04 — Milestone 4: context payloads (facts first)

**Status: grilled same-day (14 findings, verdict "needs surgery" — folded in below; the grill
killed four feasibility overclaims: there is no reusable parse to piggyback on, Svelte
templates have no grammar, unchanged-file resolution needs a head path index that doesn't
exist yet, and C# cannot name an unchanged file without the deferred SCIP index). Slices filed
when this lands.**

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
bulk (R-024). The AI half (`narrative`) stays deferred.

Honest reach on the dogfood corpus: full resolution (changed *and* unchanged files) works for
the path-specifier languages — TS/JS/TSX and Svelte script blocks. **C# resolves within the
diff only** (a `using` names a namespace, not a file; unchanged-C#-callee lookup needs the
SCIP index ADR 0001 defers). Cross-section definition jumps still cover the C# dogfood
subjects; the unchanged-callee half shines on the Svelte/TS side. That split is acceptable
for facts-v1 and is exactly the SCIP door.

Requirements satisfied or advanced: R-006 (inline non-diff context, boundary-disciplined),
R-008 (facts payloads, proactive-bulk + on-demand), R-027 (fast: git + tree-sitter, no model
calls), R-024/R-042 (the "scripts" half of the bargain). R-007 is **not** claimed as advanced
— its navigation substance stays deferred; this spec only holds its door open (SCIP, and
`fileAt` working at either sha).

## Goal

When a reviewer meets a chunk that calls something they can't see, one keystroke shows the
definition — the body of the called function/component as it exists at head — rendered as
clearly-not-diff context. All of it is computed by scripts; none of it waits on a model.

Two deliverables:

1. **The resolution pipeline** — chunk → referenced symbols → definitions, cached per head.
2. **The context surface** — an on-demand, collapsed-by-default definition panel per chunk in
   the book UI, plus the payload store and bulk precompute job.

## What a payload is (v1 = facts only)

```
ContextPayload v1 {
  chunkId, fingerprint, generatedAt
  facts: {
    definitions: [{ symbol, file, changed: boolean, body, lineStart, sha }]
    edges: { imports: [file], importedBy: [file] }   // from the existing graph, free
  }
}
```

- **`fingerprint`** = fnv1a over headSha + CORE_VERSION + chunk id — the freshness key. Chunk
  ids alone don't carry CORE_VERSION, and a version bump can change resolver/cap behavior
  without changing the diff; the filter mirrors `filterFreshNarration` exactly (stale or
  malformed = absent, never wrong).
- **`definitions`** — for identifiers referenced in the chunk's changed lines whose definition
  the resolver can find: the defining file, whether it is part of this diff (changed → the
  reviewer will meet it as a section; unchanged → this panel is the only way they'll see it),
  and the definition body with the sha it was read at. Resolution is precision-over-recall
  like the import graph: never fabricate; unresolved references are simply absent.
- **`edges`** — the chunk's section-level import edges, already computed for ordering.
- **No `narrative`, no `depth`** in v1. The schema carries them as optional future fields the
  way the narration overlay's per-chunk values were designed to grow.
- A chunk's payload is shared across its occurrences (same rule as narration lines — same
  code, same facts; web rows look it up by `row.chunk.id`).

## Resolution pipeline (all scripts, R-024 — and a new parse pass, stated plainly)

Nothing here reuses a retained parse: the chunker consumes a symbol *outline* and the server's
`extractSymbols` discards its tree. M4 adds a **second parse pass** with new queries
(`call_expression`/member calls and JSX tags for TS/TSX/JS; `invocation_expression`/
`object_creation_expression` for C#), run only over each chunk's line ranges. Svelte `<script>`
blocks parse with the TS grammar as they do for chunking; **Svelte template markup has no
grammar and gets no reference extraction** (non-goal — a regex would fabricate edges, and
precision beats recall here; this is also where R-019's markup↔handler jump waits).

1. **Reference extraction** (server, alongside `extractSymbols`): candidate identifiers from
   the chunk's added lines, deduped, locals filtered by the symbol outline where possible.
2. **Definition lookup**, in order:
   - **Changed files**: match against the tree-sitter symbol tables `computeChunks` already
     builds, preferring files connected by an import edge. Works for all four languages.
   - **Unchanged files (TS/JS/TSX/Svelte-script only)**: a new head path index — one
     `git ls-tree -r --name-only <head>` per range, cached — turns the chunk's file's import
     specifiers into repo paths using the same relative/alias resolution rules as the import
     graph, now matched against the full listing (alias suffix-matching keeps its uniqueness
     requirement; against a whole repo it will miss more — accepted, precision over recall).
     Then `fileAt(repo, head, path)` + parse + symbol lookup. C# unchanged callees: not
     resolvable without an index — recorded as the SCIP door, not attempted.
   - Ambiguity (same name, multiple candidates, no edge to disambiguate) = no definition.
3. **Deleted files**: resolution for a chunk whose file is deleted runs at base (the pipeline
   receives per-file status from the diff; `fileAt` takes either sha). Otherwise head.
4. **Body cap**: definitions over ~80 lines truncate at a statement boundary with an explicit
   `… (N more lines)` marker — a payload must never become a second wall of diffs.
5. **Cost discipline**: `fileAt` results and parses are memoized per (sha, path) across the
   whole job; definitions dedupe by (file, symbol); the payload store is capped (~2 MB per
   range — beyond it, on-demand still works, bulk stops persisting and says so in the job
   record). A 125-chunk book re-fetching one popular util once, not 40 times, is the test.
- **Store**: `reviews/<b12>..<h12>.context.json`, same atomic write + versioned loader as the
  sibling overlays.

## Runtime shape

- **On-demand first** (R-008's second half): `GET /api/context?chunk=<id>` resolves one chunk
  (compute-on-miss, then cached). Warm cache feels instant; cold is one `git show` + one parse
  per unresolved file (no model calls, R-027).
- **Bulk precompute** (R-008's "in bulk would be preferable"): `POST /api/context-job` walks
  all narratable sections' chunks and fills the cache — same job-record lifecycle as the
  narration job (one in flight, resumable per chunk, orphan = failed) minus the model calls;
  CLI `--context`, plus `--dump-context` for dogfooding. Facts are free, so bulk-by-default
  is safe — no token economy to guard, only IO.
- **Web surface**: each chunk with a non-empty payload gets a quiet affordance ("definitions:
  debouncedFilter, FilterBar"); expanding renders read-only code blocks **visually distinct
  from the diff** (R-006's hard rule — distinct background, explicit `file @ sha` caption,
  never inside the CM6 merge view). Collapsed by default: the reviewer controls depth (R-009),
  and the book stays un-cluttered (R-036's spirit) — expansion is always one keystroke away.
  Keyboard: a toggle key on the focused chunk; an **expanded panel takes focus** (it must be
  scrollable — an 80-line body with no focus would strand keyboard users), Esc returns to the
  chunk, and a collapsed panel is never a focus stop. ux-expert pass required (R-029).
- **The narration bridge — plumbing here, gate stays with spec 03.** `buildSectionNarrationInput`
  gains an optional definitions block **with its own token budget** (~2k, additive): the
  section's diff text keeps absolute priority under the existing 6k cap — a definition must
  never evict a chunk's own diff (that would worsen the exact blindness this fixes). The block
  is marked `context — not part of the diff` and the prompt must state its boundaries
  (callees only, head only, no callers — review-science principle 7: say what the model did
  NOT see). The prompt version bump and rubric re-eval belong to the narration eval track
  (spec 03's gate, currently #58's assert-vs-point iteration) — this spec only delivers the
  input; the re-eval must watch for a *new* over-assertion class, not just the old
  duplication one.

## Scoping calls (gradual auto-picked; ambitious path recorded)

1. **Head-side definitions; base only for deleted files.** Ambitious: R-007's both-versions
   navigation with diffed bodies. `fileAt` works at either sha — the door is free; the UI is
   what's deferred.
2. **Callees + edges only; no callers, tests, blame, history.** Ambitious: the sketch's full
   facts list. Callers need a project-wide index (SCIP, ADR 0001 §3) — the named door, which
   also unlocks C# unchanged-file lookup and true go-to-def.
3. **Path-specifier languages get unchanged-file resolution; C# stays in-diff.** Ambitious:
   ship SCIP indexing now. Deferred: it's explicit per-language infrastructure (ADR 0001
   consequences) and facts-v1 must first prove the surface is worth it.
4. **No `narrative` payloads.** Ambitious: AI-written "why this matters" per payload. The
   narration bridge already gives AI the same information with an eval harness attached.
5. **No adaptive depth, first-sweep flagging, reviewer model, defer-with-question**
   (R-009/R-015/R-016/R-017). Bulk-precompute-everything makes first-sweep flagging moot for
   *facts* (they're free); flagging earns its place when narrative payloads cost tokens.
6. **No UI-code mode** (R-019). Blocked twice: Svelte templates don't parse, and the mode's
   flow checks are their own milestone once the plain panel proves out.

## Non-goals (M4)

- SCIP/ctags/LSP indexes, go-to-definition UI, callers/references (R-007 full form).
- Reference extraction from Svelte template markup (no grammar; precision over recall).
- Unchanged-file resolution for C# (needs the index above).
- AI narrative payloads; findings of any kind; narration prompt changes (spec 03's gate owns
  those).
- Editing, threads, first-sweep flagging, reviewer/author model.
- Payloads for low-signal stubs or the leftovers section.

## Slices (filed just-in-time when this spec lands)

1. **Core payload model** — `ContextPayload` types, payload fingerprint + freshness filter,
   body-cap logic (the genuinely pure parts; core stays dependency-free).
2. **Server reference extraction** — the new parse pass + queries (TS/TSX/JS + C#; Svelte
   script blocks), scoped to chunk line ranges, unit-tested per language.
3. **Server resolution + store + API** — head path index (`git ls-tree`), unchanged-file
   lookup for path-specifier languages, changed-file lookup for all, (sha, path) memoization,
   store + `GET /api/context` compute-on-miss.
4. **Bulk job + CLI** — resumable model-free job, `--context`, `--dump-context`, store cap.
5. **Web definition panel** — collapsed-by-default affordance, R-006 boundary styling,
   focus-on-expand keyboard model, ux-expert pass (R-029).
6. **Narration-input definitions block** — the additive-budget input change only (prompt bump
   + re-eval routed through spec 03's track).
7. **Dogfood 5** — real-PR walk on both language mixes: does one-keystroke called-code context
   reduce the jump-out-of-the-book moments? Baseline-doc section + read notes for Tim.

Each slice demoable on a real diff.
