# Chunk-narration rubric eval — 2026-07-23

The named G2 fast-follow for spec 07: per-chunk narration v2 (2–4-word badges + one-line AI
notes, prompt `narration-chunk-1`) shipped DEFAULT-ON without its own eval. This is that eval.
It judges what the hard register/badge gates at generation time cannot: **faithfulness** (does
the badge/line claim match the real diff?) and **grounding value** (would the label actually
orient a reviewer before they read the diff?).

Tool: `tools/chunk-narration-eval.mjs`. JSON sidecar (per-chunk scores + summary):
`docs/evals/reports/chunk-narration-eval-codestory-a53e79f.json`.

## Tool design (3 sentences)

The tool grades an already-persisted chunk-narration overlay — it does not run the narration
job, so generation and judging are decoupled — reconstructing each chunk's unified diff with the
exact same core render (`unifiedChunkLines` → `+/-/space`, gaps as `…`) the generator saw, then
handing each narrated chunk's title + diff + badge + line to an LLM judge (`claude -p`, sonnet)
that scores register 1–5, faithfulness PASS/FLAG, and grounding 1–5. Per-chunk results persist to
the sidecar as they complete so a crash or usage-limit kill resumes cheaply, and a free
deterministic pre-stage re-runs the hard gates on the shipped text (a failure there is a bug
signal, not a rubric result). Judge tier (sonnet) sits deliberately below the generator tier
(opus) so the single-family self-preference caveat is blunted but not removed.

## Subject

**code-story's own history, range `a53e79f~1..a53e79f`** ("Mouse-first review controls, clearer
reviewed state, file view, draggable sidebar" — 5 web files, +228/-21). This is the standing
no-lexbox smoke subject; the lexbox PR-2468/2470 books the brief preferred were unreachable
(lexbox is not cloneable in this container — proxy only serves `myieye/code-story`). **One
subject only** — weaker evidence than a multi-subject dogfood; read the verdict with that caveat.

Generation: real pipeline via `--narrate-chunks`, generator **opus**, prompt `narration-chunk-1`,
15 overlay entries of which **12 shipped a badge and/or line** (the other 3 were bare/gate-handled
and ship nothing to the reviewer, so there is nothing to judge). Judge: **sonnet**, 12 chunks,
0 invalid, 0 missing-id, 0 stale-fingerprint, **0 hard-gate failures on shipped text**.

## Results — codestory-a53e79f

| metric | value |
| --- | --- |
| narrated chunks judged | 12 |
| register median | **5** |
| grounding median | **4** |
| faithfulness flags | **1** (assessed below as a judge false-positive) |
| hard-gate failures on shipped text | 0 |
| invalid judgements | 0 |

Register held at the ceiling (median 5) — the R-036 "light, plain, ≤ a sentence" bet holds for
the short chunk labels, same as it did for section narration in dogfood 4. Grounding median 4
("real orientation") on the ten chunks that carried an orientation line; the three chunks that
scored grounding **1** are exactly the three that shipped a **bare generic badge with no line**
("New styles" ×2, "New feature" ×1) — see the prompt-iteration note.

### The one FLAG — assessed as a judge false-positive

**Chunk:** `packages/web/src/BookPage.tsx :: BookPage.startResize` — badge `New feature`, no line.

**Judge's quote:** "New feature" — *"the diff shows startResize's implementation being added, but
the comment above indicates the resizable outline drag behavior already exists conceptually
(documented pre-existing behavior)… this is completing or wiring up an existing function rather
than introducing a brand-new feature."*

**Diff evidence (verbatim, every line is an addition):**

```
+  // Draggable outline width. Tracks the pointer on window (so a fast drag off the 6px handle keeps
+  // working) and persists the final width; a body class kills text-selection + sets the resize cursor.
+  const startResize = (e: React.PointerEvent) => {
+    e.preventDefault();
+    const startX = e.clientX;
+    const startW = outlineWidth;
...
+    window.addEventListener('pointermove', onMove);
+    window.addEventListener('pointerup', onUp);
+    document.body.classList.add('resizing-outline');
+  };
```

`startResize` is a wholly-new function — every line is `+`, and the diffstat confirms the whole
change is a new draggable-sidebar feature. The badge "New feature" is **faithful**. The judge
invented "pre-existing behavior" out of the function's own descriptive comment; that is the judge
being confident-wrong, not the narration. So the **substantive faithfulness floor is met** — no
narration label made a confident-wrong claim. The tool's automated `faithfulnessFloorMet: false`
is driven entirely by this single judge misread.

## Verdict

**Default-on STANDS** on this subject. Register median 5, grounding median 4, zero hard-gate
failures on shipped text, and the sole faithfulness flag is a judge false-positive on a correctly
faithful badge (a 100%-added function badged "New feature"). No narration label made a
confident-wrong claim — the substantive faithfulness floor holds.

Caveats, stated plainly: (1) **one subject only** — this is a smoke subject, not the multi-subject
dogfood the brief wanted; treat as a green light to keep default-on, not as a settled cross-language
verdict. (2) **Self-preference**: single-family judge (Claude sonnet) vs Claude-opus generator; the
tier gap blunts but does not remove it. (3) The one flag being a false-positive cuts both ways —
the judge is not a perfect faithfulness oracle, and a sterner subject could surface a real flag the
smoke subject did not.

## Prompt-iteration note (grounding, not faithfulness)

The three grounding-1 chunks are all **bare badge, no orientation line** ("New styles" on a chunk
titled `app.css`; "New feature" on `startResize`). "New feature" on a chunk already titled
`startResize` tells a reviewer nothing a first glance at the title would not — it restates the
obvious, which is exactly grounding 1 by the rubric. The ten chunks with a line scored grounding 4.
Signal for a future `narration-chunk-2`: when the badge would only restate the symbol name, the
one-line note is where the orientation value lives — a generic badge alone is filler. This is a
grounding/usefulness finding, **not** a faithfulness failure, so it does not gate default-on; filed
as a watch, actionable if a sterner subject repeats the pattern.

## Costs

- **Generation (ledgered, opus):** 7 opus calls, **$0.74** total
  (`<range>.glue-ledger.jsonl`; by-file batching split `BookPage.tsx` and `RowView.tsx` into
  multiple units, hence 7 calls for 5 files). All outcomes `ok`.
- **Judging (sonnet):** 12 calls, 0 re-asks needed, 0 invalid. The eval spawns `claude-cli`
  directly (`invokeClaudeJson`), which does not capture usage, so judge cost is recorded as a call
  count per the brief, not a dollar figure — 12 small sonnet calls, a few cents.
