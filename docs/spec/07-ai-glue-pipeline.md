# Spec 07 — the AI glue pipeline

**Status: accepted — Tim's 2026-07-20 directive (verbatim in
`docs/vision/addendum-2026-07-20-ai-pipeline.md`, R-060) is the scoping decision.**
Facts base: `docs/design/2026-07-20-review-ux-round/glue-harvest-survey.md` (the exact
state of the three existing AI jobs, with file:line cites). Written at top tier per Tim's
"critical piece of architecture — build it carefully."

## Traceability

- **R-060** — one pipeline that optimizes which agent gets called when, with what context,
  for what task; modular so pieces move as we learn. This spec.
- **R-024 / R-042** — scripts before AI; never skip AI where it truly earns intuition.
  The pipeline hosts model-less tasks too (context payloads), and the tier field makes the
  script/cheap/judgment choice explicit per task instead of implicit per job file.
- **Model economy (Tim, standing)** — cheap tiers for mechanical work, top tier only where
  judgment matters. Tiers become a first-class field, not a hardcoded `'opus'`.
- **R-026** — the ledger makes AI activity visible and honest (what ran, which model, what
  it cost); nothing here hides AI involvement.
- M4/M5 review, "job-lifecycle triplication" — this is the principled fix.

## Goals

1. **One task registry**: every piece of AI glue (ordering, chunk narration + badges,
   deferral answers, context payloads, future checks/evals) is a `GlueTask` declaring its
   unit of work, context assembly, model tier, gates, freshness, and trigger.
2. **One scheduler**: priority across tasks (a deferral answer the reviewer is waiting on
   must never queue behind a 40-batch narration fill), dedupe by fingerprint, anti-retry-storm,
   persist-per-unit resume, graceful shutdown.
3. **One invoker**: the `claude -p` spawn, retry taxonomy, JSON extraction, and tier→model
   resolution in one place — with actual token usage harvested from the CLI envelope instead
   of discarded.
4. **A ledger**: append-only per-invoke records so "optimize what gets called when" becomes
   measurable. No spend ceiling in v1 (Tim's pending call); spend is recorded and shown.
5. **Contract-stable migration**: nothing persisted (overlays, prompt versions, file paths,
   API routes/status codes) changes meaning. Existing tests keep passing; `autoOrder:false`
   keeps working.

## Non-goals (v1)

Cross-range/global queues (state stays per range); parallel model calls beyond the two lanes
below; a cancel API (shutdown aborts, per-job cancel deferred); API-key/direct-SDK invokers
(the invoker is an interface — `claude -p` is the only v1 implementation, per the
subscription rule); spend ceilings (recorded, not enforced — Tim may set a policy later);
moving prompts or fingerprints (byte-stable this round); BYO-agent interactive threads
(different beast: interactive, session-ful — only their *background* pieces would ever land
here).

## Concepts

All new code in `packages/server/src/glue/`. Core stays dependency-free (fingerprint helpers
remain in `packages/core` where they live today).

### Work units and tasks

A task splits its work into **units** — the grain of scheduling, persistence, and resume.
Order = one whole-book unit. Chunk narration = one unit per file-batch. Deferral answers =
one unit per deferral. Context = one unit per chunk.

```ts
type ModelTier = 'top' | 'mid' | 'cheap' | 'none';        // none = script task, no model
type GluePriority = 'interactive' | 'startup' | 'bulk';

interface GlueUnit {
  key: string;          // stable id within the task, e.g. file path, deferral id, 'book'
  fingerprint: string;  // freshness key; folds CORE_VERSION where derivation-coupled
}

interface GlueTask<Out> {
  kind: string;                          // 'order' | 'chunk-narration' | 'deferral' | 'context'
  tier: ModelTier;                       // may be overridden per config
  priority: GluePriority;
  plan(): Promise<GlueUnit[]>;           // enumerate work; already-fresh units are skipped
  isFresh(unit: GlueUnit): Promise<boolean>;      // per-unit resume check (persisted state)
  run(unit: GlueUnit, invoke: GlueInvoke): Promise<GlueOutcome<Out>>;
  // run() owns: context assembly (with token budget + aliasing), prompt build (versioned),
  // reply parse/validation, gates, and per-unit persistence. Task-specific by design —
  // the survey shows validators/manifests are the genuinely non-duplicated 20%.
}

type GlueOutcome<Out> =
  | { status: 'done'; out: Out }
  | { status: 'gate-failed'; failures: string[] }   // recorded, not retried by the scheduler
  | { status: 'refused' | 'invalid-output' | 'transient'; error: string }; // retry taxonomy
```

`run()` is a closure over task deps (book, stores, resolvers) built at registration time.
The pipeline deliberately does **not** abstract context assembly into a generic framework:
the three existing assemblers (order manifest, narration input, context resolver) share only
the token-estimate helper and the aliasing lesson, and forcing them under one interface would
be speculative structure. What *is* shared moves to `glue/`: `estimateTokens`, alias
assignment (`c1..cN`), and the omission-marker convention, as plain exported helpers.
(Modularity = small pieces with seams, not a grand abstraction.)

### Scheduler

```ts
interface GlueScheduler {
  register(task: GlueTask<unknown>): void;
  kick(kind: string, opts?: { force?: boolean }): KickResult;   // enqueue plan()'s stale units
  status(): GlueStatus;                                          // for /api/glue + summaries
  shutdown(): Promise<void>;                                     // abort children, flush ledger
}
```

- **Two lanes**, each single-flight: an **interactive** lane (deferral answers; anything a
  reviewer is actively waiting on) and a **background** lane (startup + bulk). Two lanes is
  the smallest design where a waiting human never queues behind bulk fill; more lanes/N-way
  parallelism stays behind the same interface. Within a lane, units run FIFO ordered by
  priority (`startup` before `bulk`).
- **Dedupe**: a unit whose `(kind, fingerprint)` is already queued, running, or in the
  failed set is not enqueued again. **Anti-retry-storm**: per-daemon-lifetime failed set,
  generalizing `failedFingerprints` (#71).
- **The queue is derived state**: it is rebuilt from `plan()` + `isFresh()` on every kick
  (startup, compile, on-demand POST). Nothing about the queue is persisted — per-unit
  persistence inside `run()` (the proven narration-per-section contract) makes resume
  automatic after a restart. A killed daemon loses only the in-flight unit.
- **Retry policy lives in the scheduler**, not in each task (kills the copied loop the
  survey found): `transient` → backoff [2s, 4s] then park in failed set; `invalid-output` →
  1 retry; `refused` → no retry; `gate-failed` → recorded on the unit's persisted state
  (task-owned), no scheduler retry. One re-ask *with an amended prompt* (narration's gate
  re-ask, the opener's second re-ask) is task-internal — `run()` may invoke twice before
  returning; the scheduler doesn't know.
- **Triggers**: tasks with `priority: 'startup'`-eligible work are kicked from the compile
  path exactly where `maybeAutoKickOrder` fires today. Config gates each: order (existing
  `--no-ai-order`/`CODE_STORY_NO_AI_ORDER`), narration (new `--no-ai-narration`/
  `CODE_STORY_NO_AI_NARRATION`). A master `glue: false` server option (tests) disables all
  auto-kicks; **`autoOrder:false` is kept as an alias** so the existing test corpus stands.

### Invoker

```ts
type GlueInvoke = (req: {
  prompt: string;
  tier: ModelTier;               // resolved to a model id by ModelPolicy
  timeoutMs?: number;
}) => Promise<{ text: string; usage?: { inputTokens: number; outputTokens: number; costUsd?: number } }>;
```

- Default implementation wraps the existing `invokeClaudeJson` (`claude-cli.ts` keeps its
  exports and file — the order-eval imports it from dist). It gains one addition: the CLI
  JSON envelope's `usage`/`total_cost_usd` fields are returned instead of discarded.
- **ModelPolicy** resolves tier → model id: defaults `{ top: 'opus', mid: 'sonnet',
  cheap: 'haiku' }`, overridable in `.code-story.json` (`glue.tiers`), env, and per-run
  CLI `--model` (which pins the *task being run*, preserving today's behavior).
- cwd = data home with the `mkdir` ENOENT guard (once, in the invoker). `extractJsonBlock`
  behavior is kept byte-identical.
- The invoker is a constructor arg of the scheduler → the single test seam. Per-task
  `invoke?` seams remain accepted during migration so existing tests don't churn.

### Initial tier assignments

| Task | Tier | Why |
|---|---|---|
| order | top | Judgment call (story quality); today's opus default, unchanged. |
| chunk narration + badges | top | Spec 03 gate: cheap tier only after the eval clears it. Badges ride the same call as lines (one file-batch invoke returns both), so they inherit it; if ever split out, badges are the first cheap-tier candidate. |
| deferral answer | top | The reviewer asked a judgment question; quality over latency — but it runs on the interactive lane so it never waits behind bulk. |
| context payloads | none | Scripts (R-024), unchanged. |
| eval judges (tools/) | mid | Existing sonnet-judge convention; evals stay outside the daemon but use the same ModelPolicy names. |

### Ledger

Append-only JSONL at `<repoId>/reviews/<b12>..<h12>.glue-ledger.jsonl`, one line per invoke:

```ts
interface GlueLedgerEntry {
  ts: string; kind: string; unitKey: string; lane: 'interactive' | 'background';
  tier: ModelTier; model: string; promptVersion?: string;
  durationMs: number; outcome: 'done' | 'gate-failed' | 'refused' | 'invalid-output' | 'transient' | 'aborted';
  retryOf?: number;              // line number of the attempt this retries
  usage?: { inputTokens: number; outputTokens: number; costUsd?: number };
}
```

Surfaces: `GET /api/glue` → `{ tasks: [{kind, lane, queued, running, done, failed, model}],
spend: { calls, inputTokens, outputTokens, costUsd? } }`; CLI `--dump-glue` prints the same.
The web's `AI ▾` cluster popover (spec 06 cross-cutting section) reads this endpoint — the
honest "what AI ran and what it cost" view. Ledger writes ride a dedicated save-chain
(append, not read-modify-write). The ledger is observability, not state: deleting it loses
history, never correctness.

## Contract stability (survey §5 — each kept, with the reason)

| Contract | Status |
|---|---|
| Prompt version constants (`order-1`, `order-chapter-1`, `narration-4`) | Unchanged — overlays record them; resume compares them. The new chunk-narration task gets its own new constant (`narration-chunk-1`, spec 06 slice 5). |
| Fingerprint fns (`bookFingerprint`, `sectionFingerprint`, `contextFingerprint`) | Unchanged, stay in core. New per-chunk narration fingerprint is additive. |
| Store path templates (`<b12>..<h12>.{order,narration,context}[-job].json`) | Unchanged. New files: `.deferrals.json`, `.glue-ledger.jsonl`. |
| Overlay/store JSON shapes + version tags | Unchanged; narration file gains the v2 shape per spec 06 slice 5. |
| API routes + status codes (202/200/409/404 per route) | Unchanged per route, including the inconsistencies — they are contract; harmonizing is a recorded deferred item, not a silent change. |
| `claude-cli.ts` export names + `extractJsonBlock` | Unchanged (order-eval imports from dist). |
| `chapter:<anchorChunkId>` rationale keying | Unchanged. |
| Job-record files + `JobRuntime` orphan-resolve semantics | Kept: each migrated task still writes its job-record file with the same shape, and orphan detection works as today. `JobRuntime` becomes the lane executor's internals. |

## Migration plan (gradual; each phase leaves the tree green)

- **Phase A — the module + new tasks native** (slices G1–G3): build `glue/` (scheduler,
  lanes, ModelPolicy, invoker wrapper + usage harvest, ledger, status endpoint), then land
  **chunk-narration+badges** (spec 06 slice 5) and **deferral answers** (spec 06 slice 6
  server half) as its first native tasks. No existing job is touched; narration's *new*
  auto-kick goes through the scheduler from day one.
- **Phase B — adapt order + context** (slices G4–G5): wrap the existing `runOrderJob`/
  `runChapterOrderJob` and `runContextJob` bodies as `GlueTask.run()` closures behind their
  existing contracts (files, routes, flags, `autoOrder` alias, per-task invoke seams).
  Deletion of the triplicated retry/store/summary scaffolding happens here — behavior-
  identical, verified by the existing 100+ server tests passing unmodified (except seam
  plumbing).
- **Phase C — recorded, not built**: cross-range scheduling, cancel API, N-way lanes,
  API-key invoker, spend ceilings (pending Tim), route-semantics harmonization, moving evals
  in-daemon.

## Testing stance

`glue/` logic is pure where possible: lane selection, dedupe, retry state machine, and
ledger-entry construction get direct vitest coverage with fake tasks + a scripted invoker
(no `claude` spawn, no timers beyond vitest fake timers). Scheduler integration tests reuse
the `invoke` seam pattern. **Every new server test passes `glue:false` (or the `autoOrder`
alias) unless it is testing auto-kick** — the #71 composition-hazard rule, generalized.
Phase B's acceptance is the untouched existing test corpus staying green.

## Slices

- **G1** — `glue/` module: scheduler (2 lanes, dedupe, retry taxonomy, failed set, shutdown
  abort), ModelPolicy + config wiring, invoker wrapper with usage harvest, ledger +
  `GET /api/glue` + `--dump-glue`. Pure-logic tests.
- **G2** — chunk-narration+badges as a native task (= spec 06 slice 5; auto-kick via
  scheduler, `--no-ai-narration` gate).
- **G3** — deferral-answer task on the interactive lane (= spec 06 slice 6 server half).
- **G4** — order task adapted, contract-stable (`autoOrder` alias; triplicated scaffolding
  in order-job deleted).
- **G5** — context task adapted; store/summary scaffolding unified; survey's duplication
  inventory re-checked and closed out.

Sequencing with spec 06: web-only slices 06-1…06-4 are independent of the pipeline;
06-5/06-6 land as G2/G3.

## Interaction hazards

- **Two lanes, one subprocess world**: both lanes spawn `claude` children; two concurrent
  spawns are acceptable (they're I/O-bound), but the scheduler must cap total live children
  at 2 (one per lane) — no hidden fan-out.
- **Auto-kick vs on-demand POST**: a POST for a kind whose units are already queued returns
  the existing per-route semantics (200/409) computed from scheduler state, not from a
  separate `running` flag — one source of truth.
- **Ledger growth**: JSONL appends are tiny (~200B/invoke); no rotation in v1 (a review
  range's glue is bounded). Revisit if a ledger ever exceeds ~1MB.
- **Shutdown**: `shutdown()` aborts in-flight children; the aborted unit's persisted state
  simply stays stale → re-planned on next kick. The `aborted` outcome is ledgered; the
  job-record orphan path stays for hard kills.
- **A gate-failed unit must not block siblings**: gate failures are per-unit outcomes
  (recorded on the task's persisted state), and the scheduler continues the queue — the
  "faithful or silent" per-section behavior generalized.
