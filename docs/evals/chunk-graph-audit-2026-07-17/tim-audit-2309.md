# Tim's blind edge audit — PR 2309

**What this is.** Each card below is one `calls` edge the tool drew between two code chunks:
a caller (with the exact line where the call sits) and the callee it thinks that call lands in.

**Your job.** For each card, decide whether that link would genuinely help a reviewer —
would you want a one-key jump between these two chunks? Tick one box per card:

- **RELEVANT** — the link is real and useful; the caller really uses the callee.
- **IRRELEVANT** — noise or wrong: the callee is not what that call actually resolves to,
  or the link is too trivial to be worth an affordance.

Go with your gut on a quick glance — that is the reviewer experience we are testing.
Please don't open the sealed Claude-labels file until your ticks here are committed.

## 2309-e01

**Caller:** `frontend/src/lib/components/FilterBar/FilterBar.svelte :: script`
call site (L64):
```
   64      return debouncedFilter(filters, searchKey, debounceMs);
```
**Callee:** `frontend/src/lib/util/debouncedFilter.svelte.ts :: debouncedFilter`
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
- [ ] RELEVANT
- [ ] IRRELEVANT
