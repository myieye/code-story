# Audit cards — PR 2309 (Fix user-filter input loss under rapid typing — Svelte/TS)

Range `c0448522..pr-2309` · head `fd182f314589` · seed `2321623287`.
`calls` edges in graph: **1** · sampled: **1** (cap 30).
> Fewer than 30 `calls` edges — **all** of them are sampled.

Each card: caller chunk + the call-site line(s), then the callee chunk + its first defining lines. No labels here.

## 2309-e01 _(in Tim subsample)_

**Caller:** `frontend/src/lib/components/FilterBar/FilterBar.svelte :: script`
chunk id: `frontend/src/lib/components/FilterBar/FilterBar.svelte::script::mqxhkf`
call site (L64):
```
   64      return debouncedFilter(filters, searchKey, debounceMs);
```
**Callee:** `frontend/src/lib/util/debouncedFilter.svelte.ts :: debouncedFilter`
chunk id: `frontend/src/lib/util/debouncedFilter.svelte.ts::debouncedFilter::1lylj32`
defining lines (first 10):
```
   17  export function debouncedFilter<T extends Record<string, unknown>, K extends keyof T>(
   18    filters: T,
   19    key: K,
   20    debounceMs: number,
   21  ): {value: T[K]} {
   22    let local: T[K] = $state(untrack(() => filters[key]));
   23    let pendingEcho: T[K] | undefined = undefined;
   24  
   25    // Flush typing → upstream store, debounced.
   26    const flushed = new Debounced(() => local, debounceMs);
```
