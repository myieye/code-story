# Build process (R-030)

How we go from vision → spec → issues → working tool, with humans in the forefront.

## Spec pipeline

Adopt the Matt Pocock skills pipeline ([`mattpocock/skills`](https://github.com/mattpocock/skills),
identified in [research 04](../research/04-review-science-and-leads.md) Part C) — adapted, not
worshipped:

1. **Grill** (`grill-with-docs` / `grill-me`): interrogate the vision doc + requirements
   inventory to surface unresolved decisions. Tim answers in batches (async-friendly).
2. **Spec** (`to-spec`): per feature area, synthesize a spec doc in `docs/spec/`, each spec
   section citing the R-numbers it satisfies (traceability passes stay mechanical).
3. **Issues** (`prd-to-issues` / `to-tickets`): vertical-slice GitHub issues on this repo with
   explicit blocking edges. Every slice is demoable on a real diff.
4. **Implement**: one agent session per issue, human-reviewed — **not** an autonomous loop; the
   product's UX is novel and needs taste in the loop. Use the ux-expert agent for every
   user-facing surface (R-029).

Install: `npx skills@latest add mattpocock/skills` (verify current install path when adopting).

## Model economy

Scripts before AI (R-024); cheap models before expensive ones. Route mechanical work (bulk
context-payload drafting, issue formatting, changelog chores) to cheaper models (Haiku/Sonnet
tier); reserve top-tier models for chunk-ordering judgment, thread conversations, and
spec/design work. The daemon's job queue should carry a per-job model tier from day one.

## Dogfooding loop

- **Primary test bed**: languageforge/lexbox PRs (C# + Svelte — both ends of the dense↔diluted
  spectrum), plus this repo's own agent-built PRs. Every PR the pipeline produces gets reviewed
  *through* code-story as soon as it can render anything.
- **Evaluation artifacts**: after each dogfood session, file issues tagged `dogfood` with:
  what the ordering got wrong, context payloads that missed/wasted, coverage friction, trust
  failures (moments the tool felt like it was selling the code). The book export (R-005) doubles
  as an eval input: score readability with a model, track over time.
- **Session limits**: bulk jobs persist and resume (we hit a real limit during research);
  never design a flow that assumes uninterrupted agent availability.

## Working agreements

- Requirements traceability: any spec/PR that satisfies or amends an R-number says so; periodic
  passes re-read [the verbatim prompt](../vision/original-prompt.md) against
  [the inventory](../requirements/inventory.md) (R-028).
- Human-in-forefront checks (R-026): every AI-produced explanation in the product is labeled as
  such; findings-mode is separate from comprehension-mode; anchoring research
  ([04](../research/04-review-science-and-leads.md) Part D #6-7) is a design gate, not advice.
- Decisions land as ADRs in `docs/decisions/` while they're still cheap to reverse.
