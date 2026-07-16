# Maintainability pass — 2026-07-16 (post dogfood-0 fixes)

Requested by Tim: "ensure the code base remains maintainable, that concerns are well separated
and everything feels extendable." Follow-up to the
[architecture review](2026-07-16-architecture-review.md) — several of its "revisit when"
triggers had fired.

## Landed in this pass

| Change | Commit | Why |
|---|---|---|
| `isLowSignal`/`lowSignalReason` consolidated into core model; export, CLI, and web all consume them | 3443e5f | The stub predicate + label had grown four divergent expressions after the whitespace change |
| `detectChangeTypes` seam in the chunker | 3443e5f | One named place for future chunk-level detectors (format-only, rename, …) |
| `checkCoverage` in core; CLI's inline R-001 self-check deleted | 3443e5f | Pure + unit-tested; the pattern spec 01's `--check-order` eval tool should follow. Deliberately runs on raw chunker output so the book compiler's leftover backstop can't mask chunker gaps |
| Web rows keyed by occurrence (`chunkId#ordinal`) | f2d438f | The architecture review's flagged M1 blocker (R-004). Walk stops = occurrences; review progress = distinct chunks; state stays on the chunk. Behavior-identical today, locked by multi-occurrence tests in `review-logic.test.ts` |

Verified: full suite green (88 tests), plus a live Playwright pass on the lexbox PR 2357 book
(resume, mark/unmark, outline occurrence-jumps, done morph).

## Where the next session picks up

Remaining from this pass, in order of value — neither is blocking:

1. **In-repo dogfood walk harness.** The architecture review's trigger has fired: two sessions
   have now rewritten the same Playwright walk-mark-verify script in scratchpad (see
   `docs/evals/dogfood-0-baseline.md` methodology + the #14 verification). Shape: a
   `tools/dogfood-walk.mjs` using `playwright-core` (devDependency; `channel: 'chrome'`, so no
   browser download) parameterized by port, printing walk stats. Keep it a tool, not a test
   framework.
2. **Extract `useBookKeymap` + `useSeenTracking` hooks from `BookPage.tsx`** (~410 lines; the
   keydown handler and seen-scan effects are self-contained). Behavior-identical move; keep the
   deliberate re-register-every-render pattern (documented in the architecture review). Do it
   before M1 mounts prose/threads onto BookPage, not necessarily sooner.

Bigger picture next steps (not this pass's scope): spec 01 (`docs/spec/01-story-ordering.md`)
awaits Tim's answers to its four open questions; M1 slices get filed after that. Issue #13
stays open as the ordering evidence.

## Judged fine as-is (don't churn)

- `classify.ts` as an if-chain — a rule table would be speculative generality at 5 rules.
- `chunkFile`'s pipeline (split → fragment → bucketize → makeChunk) — each stage is named and
  single-purpose after the seam extraction.
- The monolithic `/api/book` payload and serial `computeChunks` fetches — the architecture
  review's original "revisit when" conditions have not fired yet.
