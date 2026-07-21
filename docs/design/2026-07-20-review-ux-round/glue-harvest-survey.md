# Harvest Survey: Unified AI-Job Pipeline (facts only)

Scope: the three AI-adjacent background jobs (order, narration, context) plus their runtime, prompts, stores, core overlay/fingerprint logic, CLI, server wiring, and the eval seam. Line cites are `path:line`.

## 1. Three-job comparison

| Dimension | Order | Narration | Context |
|---|---|---|---|
| **Trigger** | Auto-kick on compile (default-on #71, `maybeAutoKickOrder` server.ts:445-461; fires from `serve` callback server.ts:700), on-demand `POST /api/order-job` (server.ts:434-439), CLI `--ai-order` (cli.ts:423-465) | On-demand only: `POST /api/narration-job` (server.ts:502-539), CLI `--narrate` (cli.ts:467-512). No auto-kick | On-demand only: `POST /api/context-job` (server.ts:622-664), CLI `--context` (cli.ts:318-390). No auto-kick; also compute-on-miss GET (server.ts:587-609) |
| **Unit of work** | Whole book, one call (file mode: section permutation; chapter mode: chunk regroup) | Per-section, plus one book opener call (narration-job.ts:96-120) | Per-chunk (eligible chunks; no model) (context-job.ts:54-83) |
| **Batching** | Single call, whole manifest | One `claude -p` per section + one opener | One resolver call per chunk, serial loop |
| **Model source** | `input.model`; CLI default `'opus'` (cli.ts:141); server `orderModel ?? 'opus'` (server.ts:367); `POST` body.model ?? orderModel (server.ts:437) | `input.model`; CLI `'opus'`; server `POST` body.model ?? `'opus'` hardcoded (server.ts:514) | **No model** — scripts only, R-024 (context-store.ts:30) |
| **Prompt + version** | `orderPrompt`/`ORDER_PROMPT_VERSION='order-1'`; `chapterOrderPrompt`/`CHAPTER_ORDER_PROMPT_VERSION='order-chapter-1'` (order-prompt.ts:1,37) | `sectionNarrationPrompt`+`openerNarrationPrompt`/`NARRATION_PROMPT_VERSION='narration-4'` (narration-prompt.ts:1) | None |
| **Context assembly** | `buildOrderManifest`→`renderOrderManifest` (plain text, order.ts:108-156); chapter: `buildChunkOrderManifest`+`renderChunkOrderManifest` w/ alias labeler (order.ts:219-254) | `buildSectionNarrationInput`→`renderSectionNarrationInput` (narration.ts:225-343): diff text + optional additive definitions block | `createContextResolver().resolve` (context-resolve.ts:72) — facts (definitions, edges) |
| **Token caps** | `MANIFEST_TOKEN_LIMIT=8000` (order-job.ts:25); estimate = `len/4` | diff `NARRATION_INPUT_TOKEN_CAP=6000` + additive `NARRATION_DEFINITIONS_TOKEN_CAP=2000` (narration.ts:169,177) | store byte cap `DEFAULT_CONTEXT_STORE_CAP_BYTES=2MB` (context-store.ts:13); `capBody` maxLines=80 (context.ts:94) |
| **Aliasing / omission** | Chapter mode aliases chunk ids `c1..cN` in manifest order (order-job.ts:103-113); rationale re-keyed to `chapter:<anchorChunkId>` (order-job.ts:246) | Chunks over budget lose diff, land in `omitted`→recorded as `gateFailures` (narration.ts:266-280); `resolveChunkId` accepts suffix/`::`-boundary matches (#44, narration.ts:399-405) | none (no model) |
| **Invoke call shape** | `invoke(prompt, model, cwd) => Promise<string>`; default `invokeClaudeJson(p,m,cwd,JOB_TIMEOUT_MS)` (order-job.ts:132) | same signature (narration-job.ts:67,196) | n/a — `resolve(chunk)` deps injected (context-job.ts:30) |
| **Retry taxonomy + backoff** | `refused`/`invalid-output`/`transient` (order-job.ts:29-44). transient: `TRANSIENT_BACKOFF_MS=[2000,4000]` (2 retries); invalid: 1 retry; refused: none (order-job.ts:136-152) | same taxonomy in `generate` (narration-job.ts:183-220): transient 2 (same backoff), invalid 1, **gate 1** (opener **gate 2**, narration-job.ts:101). Never throws — falls open | per-chunk fail-open on resolve throw, no retry (context-job.ts:68-73) |
| **Output validation/gates** | `extractJsonBlock`→`validatePermutation` (order.ts:162) → `checkOrder` pre-gate on applied book (order-job.ts:192-199); chapter: `validateChapterComposition`→`compileChapterBook`→`checkOrder` (order-job.ts:237,259-268) | `parseNarrationReply` (narration.ts:372) → register gate `checkNarrationText` (narration.ts:122) with `BANNED_PHRASES`, char/sentence caps | none — payload trusted (script output) |
| **Persistence** | one overlay file per run, atomic `saveJson` (order-job.ts, written by caller server.ts:415 / cli.ts:448) | overlay **persisted after every section** (narration-job.ts:92,117) — resumability contract | store written per-payload atomically, or `persisted:false` at cap (context-store.ts:86-96) |
| **Resume semantics** | none — one-shot; failed fingerprint suppressed (below) | model+promptVersion match → `filterFreshNarration` survivors reused; per-section fingerprint skip; opener key skip (narration-job.ts:74-104) | `freshIds` skip (context-job.ts:61) |
| **Freshness fn** | `bookFingerprint`/`isOverlayFresh` (order.ts:76-87) | `sectionFingerprint`+`narrationOpenerKey`+`filterFreshNarration` (narration.ts:46-77) | `contextFingerprint`+`filterFreshContext` (context.ts:50-79) |
| **Failure recording** | job record `status:'failed'`+`error` (order-store.ts:18); `failedFingerprints` set (server.ts:372,419) | job record failed; per-section `gateFailures` kept in overlay (narration.ts:26) | job record failed; `capped`/`cappedCount` (context-store.ts:31-48) |
| **Single-flight / dedupe** | `JobRuntime.running` guard; `kickOrderJob` synchronous up to handle (server.ts:377-378) | `narrationRuntime.running` guard (server.ts:508) | `contextRuntime.running` guard (server.ts:627) + `contextSaveChain` |
| **Anti-retry-storm** | `failedFingerprints` blocks re-kick same fingerprint until restart (server.ts:372, order-job.ts:283-289) | none (on-demand only) | none (on-demand only) |
| **API routes** | `GET/PATCH /api/order`, `GET/POST /api/order-job`, `GET /api/export.md?order=ai` | `GET /api/narration`, `POST /api/narration-job` | `GET /api/context?chunk=`, `GET/POST /api/context-job` |
| **Status surface** | `jobSummary` (server.ts:76) | `narrationJobSummary`+sections counts (server.ts:88) | `contextJobSummary`+computed/skipped/capped (server.ts:102) |
| **CLI flags** | `--ai-order`,`--no-ai-order`/`CODE_STORY_NO_AI_ORDER`,`--order tier0\|ai`,`--model`,`--direction`,`--test-placement` (cli.ts:129-147) | `--narrate`,`--narration`,`--model` | `--context`,`--dump-context`,`--verbose` |

## 2. Duplication inventory

**Near-identical retry loop.** `order-job.ts:invokeUntilValid` (126-153) and `narration-job.ts:generate` (183-220) are the same machine: `transientLeft = TRANSIENT_BACKOFF_MS.length`, `invalidLeft = 1`, `for(;;)` invoke → catch-transient-backoff → parse-or-invalid-retry. Both define identical `const TRANSIENT_BACKOFF_MS = [2000, 4000]`, `JOB_TIMEOUT_MS = 10*60*1000` (order-job.ts:26-27, narration-job.ts:27-28), and identical private `sleep` (order-job.ts:273, narration-job.ts:233). Gratuitous drift: order throws `OrderJobError`; narration returns a result object (never throws) and adds a third `gateLeft` axis with a prompt-appending re-ask. The transient backoff indexing expression is copied verbatim: `TRANSIENT_BACKOFF_MS[TRANSIENT_BACKOFF_MS.length - transientLeft--]` (order-job.ts:144, narration-job.ts:199).

**Identical `invoke` default + cwd ENOENT guard.** Both jobs open with `const invoke = input.invoke ?? ((p,m,cwd)=>invokeClaudeJson(p,m,cwd,JOB_TIMEOUT_MS))` then `await mkdir(input.cwd,{recursive:true})` with the same comment about a fresh install (order-job.ts:132-134, narration-job.ts:67-69).

**Triplicated store module shape.** `order-store.ts`, `narration-store.ts`, `context-store.ts` each expose `<x>FilePath` + `<x>JobFilePath` (identical `path.join(dataHome, repoId,'reviews',`${base12}..${head12}.<suffix>.json`)`), a `<X>JobRecord` interface with `version:1; status; startedAt; finishedAt?; error?`, a `load<X>JobRecord` with the same ENOENT-tolerant try/catch, and re-export `saveJson`. Order/narration also share `load<Overlay>` with the identical version-check-else-warn body (order-store.ts:29-40, narration-store.ts:37-48).

**Triplicated CLI job-record scaffold.** Each CLI branch builds a `record` literal, `saveJson(jobFile, record)`, logs "running…", try→save done with spread result→catch save failed+rethrow (cli.ts:325-378 context, 424-465 order, 468-512 narration). The server duplicates the same lifecycle through `JobRuntime.run` (server.ts:387-421, 520-537, 646-662) — two parallel implementations of "initial running write / work / terminal write".

**Triplicated job-summary functions.** `jobSummary`/`narrationJobSummary`/`contextJobSummary` (server.ts:76-117) are the same conditional-spread pattern differing only in extra fields.

**Genuinely task-specific (not duplication):** the validators (`validatePermutation`, `validateChapterComposition`, `checkOrder` pre-gate, `checkNarrationText` register gate, `parseNarrationReply`), manifest builders, alias assignment, per-section salvage logic, and the context byte-cap stop.

## 3. Hidden couplings / hazards

- **#71 composition hazard (`autoOrder:false`).** The daemon auto-kicks the order job from the `serve` callback (server.ts:700). Tests that pass an `orderInvoke` seam but do **not** want a paid/real run must set `autoOrder:false`, else the background kick fires (order-server.test.ts:67-85 asserts `invoked===false`). Any pipeline that centralizes scheduling must preserve the `autoOrder` opt-out gate and the `shouldAutoKickOrder` predicate (order-job.ts:288-290).
- **Orphan-resolve semantics.** `JobRuntime.resolve` (job-runtime.ts:33-41) treats a stored `running` with no live handle as ambiguous, does exactly **one** re-read, and only then reports a synthetic `failed`/`ORPHAN_ERROR`. The invariant it relies on: the terminal write always lands before the handle clears (`run` writes done/failed, then `finally` nulls `live`, job-runtime.ts:53-66). Must not be broken.
- **`saveChain` / patch-chain serialization.** Three independent promise chains serialize read-modify-write: `saveChain` (review, server.ts:321,550-552), `orderPatchChain` (server.ts:465-480), `contextSaveChain` (server.ts:562-572). Each swallows its own error so later ops still run. The context store is re-loaded inside the chain before each persist (server.ts:564) because GET-on-miss and the bulk job share one file.
- **Data-home cwd must exist (ENOENT).** The subprocess is spawned with `cwd = dataHome`; a missing dir kills `claude` instantly, so both model jobs `mkdir(cwd,{recursive:true})` first (order-job.ts:133-134, narration-job.ts:68-69).
- **Brace-balanced JSON extraction.** `extractJsonBlock` (claude-cli.ts:33-60) is a string-literal-aware depth scan, deliberately not a regex — trailing prose containing `}` must not extend the match. The pipeline must keep this exact quirk or persisted evals/replies could parse differently.
- **Aliased-ids lesson (#44).** Models truncate long chunk ids. Chapter order sends aliases only (order-job.ts:103-113); narration tolerates truncated keys via `resolveChunkId` (narration.ts:399-405). Opener failures are recorded, never silent (`failures` field, narration.ts:34).
- **Aliased-text token guard (PR #102).** Chapter order estimates tokens on the **rendered aliased** text, not raw-id rendering, because aliases are ~3-4× shorter — estimating on raw ids would wrongly refuse (order-job.ts:112-120).
- **409/202/200/404 route semantics.** `POST /api/order-job` → 202 if started, 200 if already running (server.ts:438). `POST /api/narration-job` → **409** if running (server.ts:509), else 202. `POST /api/context-job` → 200 if running, 202 if started (server.ts:627-663). `PATCH /api/order` → 404 if no overlay (server.ts:482). `GET /api/export.md?order=ai` → **409** if no fresh overlay (server.ts:674). These differ per job and are contract.
- **order-eval imports `claude-cli` from dist.** `tools/order-eval.mjs:12-15` dynamically imports `packages/server/dist/claude-cli.js` so judge and job share one subprocess contract; requires `pnpm build` first. Any move/rename of `claude-cli.ts`'s exports (`invokeClaudeJson`, `extractJsonBlock`) breaks the eval.
- **cwd is the reviewed repo, not the install.** Static serving and serveStatic root are relative to `process.cwd()` (server.ts:692); the job cwd is deliberately the data home, *never* the reviewed repo (order-job.ts:52-53, narration-job.ts:43) — "must not become an unreviewed side channel."

## 4. Model economy state

- Model ids are plain strings threaded as `input.model` / `record.model` / overlay `model` field. No tier abstraction exists anywhere.
- Defaults: CLI `--model` → `'opus'` (cli.ts:141); server order auto-kick + `POST` default → `orderModel ?? 'opus'` (server.ts:367,437); narration `POST` → `body.model ?? 'opus'` (server.ts:514, hardcoded, does **not** read `orderModel`); context → no model. Eval judge default `'sonnet'` (`--judge-model`, order-eval.mjs:44, narration-eval.mjs:55).
- The model id is invoked verbatim as `claude -p --model <model>` (claude-cli.ts:10). Overlays persist `model` (order.ts:46,63; narration.ts:32) so stale-voice/model mismatch is detectable (narration-job.ts:77-78 refuses to blend registers).

## 5. Byte-identical / contract-stable requirements

Changing any of these invalidates persisted overlays/evals or breaks the web/eval contract:

- **Prompt version constants** — `ORDER_PROMPT_VERSION`, `CHAPTER_ORDER_PROMPT_VERSION`, `NARRATION_PROMPT_VERSION` (order-prompt.ts:1,37; narration-prompt.ts:1). Bump *only* on prompt text edits; overlays record them and resume-eligibility compares them (narration-job.ts:78).
- **Fingerprint functions** — `bookFingerprint` (order.ts:76-82), `sectionFingerprint` (narration.ts:46-49), `narrationOpenerKey` (narration.ts:52-55), `contextFingerprint` (context.ts:50-52). All fold `CORE_VERSION` (`'0.0.6'`, model.ts:7) and `fnv1a`. Any change silently invalidates every stored overlay/payload — that is the intended coupling, so it must stay stable unless intentional.
- **File path templates** — `<base12>..<head12>.{order,narration,context}[-job].json` under `<repoId>/reviews/` (order-store.ts:9-16, narration-store.ts:9-21, context-store.ts:16-28). Persisted state is addressed by these; changing the template orphans it.
- **Overlay/store JSON shapes + `version` tags** — `OrderOverlay` v1 / `OrderOverlayV2` v2 (order.ts:38-69), `NarrationOverlay` v1 (narration.ts:30-38), `ContextStoreFile`/`ContextPayload` v1 (context.ts:31-43). Loaders reject unknown versions (order-store.ts:32, etc.).
- **API response shapes** — `BookResponse`, `OrderResponse`, `NarrationResponse`, `ContextResponse`, `ContextJobResponse`, `OrderPatch` (api.ts). "Both sides compile against this one type" (api.ts:11). `aiBook` semantics (present only for launch-config fresh v2, server.ts:355-362) are load-bearing for the web.
- **`claude-cli.ts` export names + `extractJsonBlock` behavior** — imported from dist by the eval (§3).
- **Rationale keying** — chapter rationales keyed `chapter:<anchorChunkId>` (order-job.ts:246, order.ts:56) so the web header lookup resolves.

## 6. Gaps none of the three jobs solve

- **Cross-job scheduling / priority.** No shared queue or ordering across job kinds. Each `JobRuntime` is independent (server.ts:369,487,613); only order auto-kicks. Nothing coordinates "order then narration then context."
- **Concurrency.** Every job kind is strictly single-flight per range (`JobRuntime.running` guard). Within a job: narration is fully serial section-by-section (narration-job.ts:109), context serial chunk-by-chunk (context-job.ts:60). No parallel model calls, no fan-out.
- **Queue across ranges.** State is per-range (per file path). No mechanism to enqueue or batch multiple ranges; a second range's job just uses different files but there is no scheduler.
- **Cost / token recording.** Estimated tokens are computed only as size *guards* (order.ts:128, narration.ts:292) and never persisted. No actual token/cost accounting from the CLI envelope (the envelope's usage is discarded; only `result` is read, claude-cli.ts:34-35).
- **Job observability API.** Status surfaces are per-job GETs returning only status/counts/error (server.ts:76-117). No aggregate "all jobs" endpoint, no history (each run overwrites its record file), no timing/throughput metrics.
- **Cancellation.** No cancel path. `JobRuntime.run` (job-runtime.ts:49) has no abort handle; the spawned child is only killed by its own `timeout` (claude-cli.ts:12). A running job cannot be stopped; a duplicate POST is refused, not preempted.
- **Model/tier selection policy.** No per-unit model choice, escalation, or fallback (§4) — one model id for the whole run.
## 7 — Closeout, post-G4/G5

G1–G3 landed the module + the two native tasks (chunk-narration, deferral). G4 adapted order and
G5 adapted context, both contract-stable. Walking §2's duplication inventory:

1. **Near-identical retry loop.** *Order side gone.* `order-job.ts`'s `invokeUntilValid` +
   `TRANSIENT_BACKOFF_MS` + `JOB_TIMEOUT_MS` + `sleep` are **deleted**; `runOrderJob`/
   `runChapterOrderJob` are now single-attempt (build → one invoke → validate → throw
   `OrderJobError`), and the retry state machine lives once in the scheduler (`scheduler.ts`
   `runUnit`). `narration-job.ts`'s `generate` loop **deliberately stays** — that is the spec-03 **v1
   section-narration** path (`POST /api/narration-job`, `narrationRuntime`), not retired this round;
   chunk-narration **v2** already runs on the scheduler (G2). It retires when the v1 path does.
2. **Identical `invoke` default + cwd ENOENT guard.** *Order side gone.* The order job no longer
   defaults an invoke or `mkdir`s a cwd — the glue invoker owns the cwd `mkdir` once
   (`invoker.ts` `defaultSpawn`) and the order task hands the invoker through. The narration **v1**
   copy stays with its path.
3. **Triplicated store module shape.** *Job-record loaders unified.* The three byte-identical
   `load{,Narration,Context}JobRecord` bodies now delegate to one `loadJobRecordFile<Rec>(file, what)`
   in `job-runtime.ts` (exported names unchanged, so no import churn). The `<x>FilePath`/
   `<x>JobFilePath` builders and the per-store `JobRecord` interfaces **stay per-store deliberately**:
   they are the store's path/shape contract (byte-stable this round), differ only by suffix/extra
   fields, and folding them would trade a real seam for a speculative one.
4. **Triplicated CLI + server job-record scaffold.** *Order + context server scaffold gone.* The
   server's `kickOrderJob`/`orderRuntime` and `contextRuntime` `JobRuntime` wiring are **deleted**;
   the order task and context task own their `.order-job.json` / `.context-job.json` lifecycles
   (running → done/failed), and GET orphan resolution moved to the shared `resolveJobRecord` free
   function keyed on `scheduler.activity(kind)`. The CLI's **`--ai-order`** manual scaffold is
   **deleted** — it drives the order task through a throwaway scheduler (same shape as
   `--narrate-chunks`). The CLI **`--context`** branch still calls `runContextJob` directly (its
   own in-memory-store mirror): untested path, no model, low duplication value — left as-is. The
   narration **v1** scaffold (CLI `--narrate` + server `narrationRuntime`) stays with its path.
5. **Triplicated job-summary functions.** *Unified.* `jobSummary`/`narrationJobSummary`/
   `contextJobSummary` now share one `jobSummaryBase(record)` envelope (status/startedAt/
   finishedAt/error) and add only their extra fields. **Response shapes are byte-identical** — the
   extra fields are still present per job.

**Genuinely task-specific (the 20%)** — validators, manifest builders, alias assignment, the
per-section salvage logic, the context byte-cap stop — untouched, as the survey predicted.

Net: the retry/store-lifecycle/summary scaffolding is measurably gone (`order-job.ts` −~50 lines,
`server.ts` net −~90 lines) while every persisted file, route, and status code holds. What remains
duplicated (narration v1, the per-store path/shape builders, the CLI `--context` fill) is
deliberate and noted above.
