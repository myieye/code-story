# Claude's sealed edge labels — DO NOT OPEN UNTIL TIM'S LABELS ARE COMMITTED

**Tim: please don't read this file until your ticks in the three `tim-audit-*.md` files are
committed.** The whole point of the blind audit (R-026) is that the generator's self-grade
can't anchor yours. If Claude's numbers here diverge optimistically from yours, Claude's
number is thrown out and yours is the gate.

Claude did not build the resolver (shipped in #75); these labels are an honest read of each
card. A wrong edge is worse than a missing one, so the bar is "does this link point at what
the call actually resolves to, and would a reviewer want the jump."

Label key: **R** = relevant (real, useful link) · **X** = irrelevant (wrong target or noise).

## PR 2309 (1 calls edge)

| card | label | why |
|------|-------|-----|
| 2309-e01 | R | `FilterBar` really calls `debouncedFilter`; resolves to the exact exported function. |

**2309 precision (Claude): 1/1 = 1.00.**

## PR 2357 (30 sampled of 38)

Every sampled edge resolves to the correct definition. The `HistoryService.ensureLoaded`
cluster (e04/e11/e17/e24) is a real private guard method called from four sites — correct
target, and the guard's loaded-state assertion is worth a jump, so relevant not noise.

| card | label | why |
|------|-------|-----|
| 2357-e01 | R | `ActivityFilter` → `HistoryService.listActivityChangeTypes` (TS), exact. |
| 2357-e02 | R | `new ActivityChangeType(...)` → the `ActivityChangeType` record it constructs. |
| 2357-e03 | R | `serverQueryKey(filters)` → `utils.serverQueryKey`, exact. |
| 2357-e04 | R | `fetchSnapshot` → `ensureLoaded` guard, correct target. |
| 2357-e05 | R | `authorSortRank` → `authorFilterKey`, exact. |
| 2357-e06 | R | `allSelectionIcon` → `isAllFilterSelection`, exact. |
| 2357-e07 | R | JS-invokable wrapper → `HistoryService.ListActivityAuthors` (C#), exact. |
| 2357-e08 | R | JS-invokable wrapper → `HistoryService.ListActivityChangeTypes`, exact. |
| 2357-e09 | R | `ActivityFilter` → `resolveFilterKeys`, exact. |
| 2357-e10 | R | `ProjectActivity.ChangeTypes` → `HistoryService.GetChangeTypeKey`, exact. |
| 2357-e11 | R | `activity()` → `ensureLoaded` guard, correct target. |
| 2357-e12 | R | `new ActivityQuery()` → the `ActivityQuery` record, exact. |
| 2357-e13 | R | route handler `new ActivityQuery(...)` → `ActivityQuery` record, exact. |
| 2357-e14 | R | `ActivityView` → `toServerQuery`, exact. |
| 2357-e15 | R | `new ActivityAuthor(...)` → the `ActivityAuthor` record, exact. |
| 2357-e16 | R | `ActivityView` → `createDefaultActivityFilters`, exact. |
| 2357-e17 | R | `load()` → `ensureLoaded` guard, correct target. |
| 2357-e18 | R | `ActivityFilter` prop default → `createDefaultActivityFilters`, exact. |
| 2357-e19 | R | `onAuthorValueChange` → `applyMultiSelectValue`, exact. |
| 2357-e20 | R | JS-invokable `new ActivityQuery(...)` → `ActivityQuery` record, exact. |
| 2357-e21 | R | `onChangeTypeValueChange` → `applyMultiSelectValue`, exact. |
| 2357-e22 | R | route handler → `HistoryService.ListActivityAuthors`, exact. |
| 2357-e23 | R | route handler → `HistoryService.ListActivityChangeTypes`, exact. |
| 2357-e24 | R | `listActivityAuthors` → `ensureLoaded` guard, correct target. |
| 2357-e25 | R | `ProjectActivity` → `ApplyActivityFilters` (its fragment-1 defining chunk), exact. |
| 2357-e26 | R | `ActivityView` → `hasActiveServerSideFilters`, exact. |
| 2357-e27 | R | `authorKeyToLabel` → `authorFilterKey`, exact. |
| 2357-e28 | R | `ActivityView` → `HistoryService.activity`, exact. |
| 2357-e29 | R | `serverQueryKey` → `toServerQuery`, exact. |
| 2357-e30 | R | `ActivityFilter` → `HistoryService.listActivityAuthors`, exact. |

**2357 precision (Claude): 30/30 = 1.00.**

## PR 2379 (11 calls edges, all sampled)

| card | label | why |
|------|-------|-----|
| 2379-e01 | R | `ConfigureDbOptions` → `QueryMorphType` (SQL association helper), exact. |
| 2379-e02 | R | `e.HeadwordWithTokens(ws, e.QueryMorphType())` → the 2-arg `(ws, MorphType?)` overload — the right one. |
| 2379-e03 | R | `ConfigureDbOptions` → `QueryComplexFormEntry`, exact. |
| 2379-e04 | R | same call site, `e.QueryMorphType()` → `QueryMorphType`, exact. |
| 2379-e05 | R | `ConfigureDbOptions` → `QueryComponentSense`, exact. |
| 2379-e06 | **X** | **Wrong overload.** Call is `HeadwordWithTokens(ws, morphType!.Prefix, morphType!.Postfix)` (3-arg `string?,string?`), but the edge points to the 2-arg `(ws, MorphType?)` chunk. The resolver is name-only and keeps the first same-name span per file, so the second overload's chunk is unreachable as a target. |
| 2379-e07 | R | `.QueryHeadwordWithTokens(...)` → `QueryHeadwordWithTokens` (single overload), exact. |
| 2379-e08 | R | `Sql.Ext.SQLite().NullIf(...)` → `NullIf` extension, exact. |
| 2379-e09 | R | `ConfigureDbOptions` → `QueryComponentEntry`, exact. |
| 2379-e10 | R | `...ConcatWs(...)` → `ConcatWs` extension, exact. |
| 2379-e11 | R | `EntryQueryHelpers.DefaultWritingSystem(...)` → `DefaultWritingSystem`, exact. |

**2379 precision (Claude): 10/11 = 0.909.** The single miss (e06) is an overload-resolution
gap, not a random misfire — worth a follow-up issue (arity-aware resolution, or drop the edge
when a name has multiple same-file overloads) but it does not by itself sink the gate.

## Claude-side totals

| subject | correct / sampled | precision |
|---------|-------------------|-----------|
| PR 2309 | 1 / 1 | 1.00 |
| PR 2357 | 30 / 30 | 1.00 |
| PR 2379 | 10 / 11 | 0.909 |
| **overall** | **41 / 42** | **0.976** |

On Tim's 27-edge blind subsample specifically, Claude's read is 26/27 = 0.963 (the one X,
e06, falls in the 2379 subsample). Above the 0.90 go threshold on every subject — but this is
Claude's self-grade; **Tim's blind labels are the real gate.**
