# Core primitives (design sketch)

Platform-independent primitives that hold whether this becomes a VS Code extension, a local web
app, or a hybrid. Status: pre-research sketch — expect revision, but these model the invariants in
[the requirements](../requirements/inventory.md) directly.

## 1. Chunk

The atomic unit of review (R-003). A chunk is *derived*, not stored as text:

```
Chunk {
  id            // stable hash: file path + enclosing symbol path + normalized content fingerprint
  file, symbolPath          // e.g. src/LexBox/UserService.cs :: UserService.Merge
  baseRange?, headRange?    // line ranges in base/head (absent side = add/delete)
  kind          // method | method-fragment | markup-region | config | generated | ...
  changeTypes[] // generated, parallelism, ui, high-complexity, mechanical-rename... (R-018)
}
```

Chunks come from intersecting diff hunks with the syntax tree (tree-sitter): a hunk inside one
method = one chunk; a hunk spanning methods splits; a >N-line method body may split into labeled
fragments. Chunk **identity must survive iteration**: when the head moves (AI patch, manual edit,
push), chunks are re-derived and matched to predecessors by symbol path + fingerprint similarity,
so review state (R-014) re-opens only genuinely changed chunks.

## 2. Occurrence

A chunk may appear at multiple points in the book (R-004). The narrative references chunks; it
never copies them:

```
Occurrence { chunkId, sectionId, ordinal /* nth appearance */, role /* primary | context | flow-step */ }
```

The **coverage invariant** (R-001): every chunk has ≥1 occurrence with role=primary. Enforced by
construction — the book compiler ends with a "leftovers" section that receives any chunk nothing
else claimed. There is no code path that drops a chunk.

## 3. Book

The narrative (R-005): ordered sections of occurrences plus prose. Ordering is proposed by AI but
the structure is plain data — reorderable by script or reviewer, and exportable as text so a model
can score its readability.

```
Book { sections: [ { title, prose?, occurrences[] } ], version /* re-compiled per head state */ }
```

## 4. Context payload

Attached to a chunk on demand or proactively (R-008, R-009):

```
ContextPayload {
  chunkId, generatedAt, headStateId
  facts     // script-derived, free: callers/callees, types, related tests, blame, symbol docs (R-024)
  narrative?  // AI-written explanation, clearly labeled as AI content (R-026)
  depth     // stub | standard | thorough
}
```

Script-derived `facts` are always safe to compute in bulk; `narrative` is queued to the agent in
batches (R-016, R-027). Payloads are cached per head-state and invalidated by chunk-identity
matching.

## 5. Thread & the patch ledger

A thread anchors discussion to a chunk (R-010). The ledger is the R-011 guarantee:

```
Thread { id, chunkId, status /* open | deferred | resolved */, entries[] }
Entry  = HumanNote | AgentReply | PatchRecord
PatchRecord {
  patch          // unified diff, the ONLY channel through which an agent changes code
  baseStateId    // content hash of the files before application
  resultStateId  // content hash after — recorded by the tool at apply time
  appliedAt, appliedBy
}
```

Invariants:

- Agents never write files. They call a `submit_patch(threadId, patch)` tool; the tool applies it
  (or rejects it if `baseStateId` no longer matches), records the result hash, and links the
  record to the thread. What the UI renders for an entry **is** the stored patch — there is no
  separate "what actually happened" to drift from it.
- Manual edits (R-012, R-035) are unrestricted and first-class at the point of display: editing
  the code where it's shown produces a script-generated patch applied through the same ledger
  channel as agent patches, attributed `appliedBy: human` and living in the thread history.
  Edits made outside the tool (user's own editor) are detected as anonymous state transitions
  (file watcher + hashing) so the ledger stays a truthful chain: every head state is either a
  named patch or a "manual edit" delta the tool computed itself.
- Viewing any entry's version = checking out its `resultStateId` chunk snapshot (cheap: content-
  addressed blobs, like git). "Every AI version easily viewable" falls out of the chain.

Deferred questions (R-015) are just threads with `status: deferred` plus a queued agent enquiry;
the chunk's review state can be `reviewed-except-deferred`, and the resurfacing queue is
`threads.filter(deferred && answered)`.

## 6. Review state

```
ReviewState { chunkId, state /* unseen | seen | reviewed | reviewed-except-deferred | reopened */,
              reviewedAtStateId }
```

`reopened` is set automatically when chunk identity matching says the chunk materially changed
after `reviewedAtStateId`. Progress = f(chunks), never f(files).

## 7. Posture & profile

```
ReviewPosture {
  authorKind: mine | my-agent | other-human | other-agent   // R-020
  mode: nitpick | substantive
  criticality: dev-only | prototype-to-ship | normal | critical   // R-032, declared by reviewer
  mergePressure   // derived: PR age, size, review rounds, staleness risk (R-031)
}
ReviewerProfile { languages, frameworks, codebaseAreas, comparedToAuthor? }   // R-017
```

All of these are inputs to context-payload depth, to what the agent is told to flag, and to how
the story frames suggestions — steering toward "responsibly mergeable" rather than exhaustive
polish when pressure is high and criticality is low (R-033). Profile capture mechanism is an open
question (explicit config first; inference later, if ever).

## Open questions carried forward

- Chunk fingerprint algorithm & rename tolerance thresholds.
- Patch format: unified diff vs structured (line-anchored with context hashes) for robust apply.
- ~~Where the content-addressed store lives~~ — resolved (R-037, ADR 0001): per-repo store under
  the user's data home (e.g. `~/.code-story/<repo-id>/`), never inside the reviewed repo;
  append-only so thread history stays comparable forever.
- ~~Whether the book recompiles incrementally per head state or versions whole editions~~ —
  direction chosen (R-039/R-041, [pr-versions-sketch](pr-versions-sketch.md)): new versions
  append as chapters; an explicit `crunch` produces a fresh edition.
