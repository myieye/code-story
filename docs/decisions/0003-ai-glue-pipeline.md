# ADR 0003 — one pipeline for all AI glue

**Status: accepted** (Tim's 2026-07-20 directive, R-060; design in
[spec 07](../spec/07-ai-glue-pipeline.md)).

## Decision

All AI "glue" (ordering, chunk narration + badges, deferral answers, context payloads,
future checks) runs through one server-side pipeline: a task registry (unit of work +
context assembly + gates + freshness per task), a two-lane priority scheduler
(interactive vs background, dedupe by fingerprint, per-unit persist/resume, unified retry
taxonomy), one invoker with tier→model resolution (`top`/`mid`/`cheap`/`none`), and an
append-only ledger recording model, duration, and token usage per call.

## Why

- Tim: "a good pipeline that optimizes what agents gets called when with what context for
  what task … critical piece of architecture. build it carefully." (R-060)
- The three existing jobs triplicate the retry loop, store scaffolding, and job lifecycle
  with accidental drift (M4/M5 review; harvest survey in
  `docs/design/2026-07-20-review-ux-round/glue-harvest-survey.md`).
- Model economy (cheap tiers for mechanical work) needs a first-class tier field, not
  hardcoded `'opus'` strings.
- "Optimize" requires measurement: today token usage from the CLI envelope is discarded.

## Alternatives rejected

- **Status quo (bespoke job per feature)**: each new glue feature copies the pattern again;
  drift compounds; no cross-task priority (a deferral answer can queue behind bulk fill).
- **External job-queue library**: brings persistence/worker machinery built for distributed
  systems into a single-process local daemon; our queue is derived state (re-planned from
  persisted per-unit freshness), so a durable queue is structure without value.
- **One grand context-assembly abstraction**: the assemblers (order manifest, narration
  input, context resolver) genuinely differ; only token estimation, aliasing, and omission
  markers are shared. Forcing one interface would be speculative.

## Consequences

- Migration is contract-stable (file paths, prompt versions, fingerprints, route status
  codes unchanged) and phased: new tasks native first, order/context adapted after.
- `autoOrder:false` remains a supported test seam (aliased to the master `glue:false`).
- Spend is recorded, not capped — ceilings are an open product call (Tim).
