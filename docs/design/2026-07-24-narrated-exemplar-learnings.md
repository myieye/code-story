# What the richly-narrated exemplar teaches us — and the first stab

**Source**: a Claude-generated "code story" Tim shared on 2026-07-24 — *The Labeller: a narrated
reading of `ActivityChangeInfoResolver.cs`* (a 589-line lexbox C# file). It is far more narrated
than anything code-story ships today. Tim's steer (verbatim in
`docs/vision/addendum-2026-07-24-narration-depth.md`): *"it's too verbose, but … go a bit more
in this direction as needed to explain more complex code."*

This doc separates **what to learn** (durable) from **what to build first** (this session).

## The devices, ranked by value to our thesis

The exemplar is one HTML page: a prologue, 16 chapters (one per code region), an epilogue. Its
power is not the typography — it's a handful of narration *moves*. Ranked by how much they serve
code-story's actual differentiator (reviewer-side intelligence; R-026 "make critique easy"):

1. **Reviewer-verification notes — the "Check" callout.** The single most on-thesis device.
   Beside a hard chunk it says *what could be wrong and where to look*: "the hand-spelled commit
   ordering must match Harmony's — open `Commit.DefaultOrderDescending` and confirm the three
   keys." Not "this looks correct." It points the reviewer at the risk. code-story produces
   **none** of this today — our narration orients ("what changed") but never says "verify this."
   This *is* the moat and R-026, made concrete. → **R-068**, and the build below.

2. **Adaptive depth.** Simple regions get a sentence; the one genuinely hard function
   (`SenseGlossPart`) is read "slowly," with a worked-example table of its four outcomes. Tim's
   exact ask. Our narration is uniform-depth today. → **R-067**.

3. **Orientation-first framing.** Before any logic: a prologue ("why this file exists," its two
   governing principles) and *the output contract* ("look at the target before the resolution
   logic"). You can't judge a branch until you know what it fills in. We have section
   openers/intros — partial credit — but never "here's the contract you're checking against."

4. **Cross-references that build one argument.** "hold that thought for ch. 5"; "these two must
   move together." Isolated chunks become a connected model. Our chunk lines are independent
   one-liners by design (sparse, order-independent) — a deliberate constraint we should *not*
   casually break, but worth noting the exemplar's connective tissue is what makes it read as a
   story rather than annotations.

5. **The consolidated punch list (epilogue).** Every "Check" note gathered into one actionable
   list: "verify these eight and the rest is mechanical." This is the reviewer's takeaway
   artifact — it turns narration into a review plan. Natural follow-up once notes exist.

6. **Typed callouts (Why / Check / Safe) + reading typography.** We already did a beauty pass
   (#135/#150) and have AI-badged lines, so this is the smallest gap.

## The tension worth naming: our anchoring gate vs. the exemplar's "Safe" notes

The exemplar has **Safe** callouts — reassurance that something degrades correctly ("trace the
four combinations, every one resolves"). Our register gate (`BANNED_PHRASES`) deliberately
**rejects** exactly this language: `looks good`, `correctly`, `safe to`, `no issues`. That ban is
right — bare reassurance is an automation-bias trap (R-026, research 04 Part D). But note *why*
the exemplar's Safe notes don't feel like lulling: they are **traced arguments**, not assertions
("here are the four combinations…"), which is our own point-don't-assert principle done well.

The resolution: **we should import the "Check" register, not the "Safe" register.** A note that
invites scrutiny strengthens R-026; a note that soothes weakens it. So the first build adds
*verification prompts*, and keeps the ban on reassurance — a review note that trips
`BANNED_PHRASES` is dropped like any other gate failure.

## The first stab (this session): complexity-gated **review notes** on chunk narration

One change that captures learnings #1 and #2 together, rides the existing v2 chunk-narration seam
(no new job, no new spawn — the model already reads the diff to write the badge+line), and stays
disciplined about Tim's "too verbose" caution:

- **Model.** Add an optional `reviewNote?: string` to `NarrationEntryV2`, alongside the existing
  terse `line` and `badge`. The separation is the whole design: **`line` = orientation (every
  chunk, terse, ≤110 chars); `reviewNote` = what-to-verify (complex chunks only, richer).** Depth
  where it's earned, terseness everywhere else.
- **Sparse by construction.** The prompt (`narration-chunk-1` → `narration-chunk-2`) instructs:
  emit `note` **only** for a genuinely complex, subtle, or risky chunk — a non-obvious invariant,
  a hand-maintained coupling, an easy-to-miss edge case. Most chunks get no note. Phrased as
  *what a reviewer should confirm*, never reassurance.
- **Gate.** A dedicated `reviewNote` gate: point-don't-assert (reuses `BANNED_PHRASES`), a char
  cap generous enough to explain but not ramble, sentence cap. A failing note is dropped
  independently of `line`/`badge` — "faithful or silent" holds.
- **Render.** A distinct "Check"-style note under the chunk header (its own affordance, AI-badged,
  visually separate from the terse gist line).
- **Deferred to a follow-up** (kept out of this slice to stay small): the epilogue **punch list**
  — roll every chunk's `reviewNote` into the done-banner as the reviewer's takeaway (learning
  #5). Filed as a follow-up issue.

### Why extend v2 rather than a new overlay
The note is generated in the *same* model call as the badge+line, so there is no extra spawn and
no new store file — one optional field on the existing per-chunk entry, riding the existing
job/parse/persist/render path. This is the cheap, reversible move; a separate overlay would be
premature.

### What we are deliberately *not* doing yet
- No cross-chunk narrative threading (#4) — it fights the order-independence invariant; needs its
  own design.
- No forced depth — the note is opt-in per chunk, at the model's judgment, capped in length.
- No CORE_VERSION bump — this adds an optional field; old overlays stay valid (they simply carry
  no notes). Only `promptVersion` moves.
