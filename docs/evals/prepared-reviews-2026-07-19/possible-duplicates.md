# Code story — 9e5502df118f..2dc41fb37157

111 chunks · 17 sections · head 2dc41fb3

## frontend/viewer/src/lib/entry-editor/NewEntryDialog.svelte

### script

other · +22 -1

```diff
@@ -10,1 +10,1 @@
-  import {untrack} from 'svelte';
+  import {tick, untrack} from 'svelte';
@@ -25,0 +26,2 @@
+  import DuplicateCheck, {type DuplicateSummary} from './DuplicateCheck.svelte';
+  import DuplicateSummaryPill from './DuplicateSummaryPill.svelte';
@@ -33,0 +36,1 @@
+  let duplicateActionBusy = $state(false);
@@ -165,0 +177,7 @@
+
+  let duplicateWidgetEl = $state<HTMLElement>();
+  let duplicateCheck = $state<DuplicateCheck>();
+  let duplicateSummary = $state<DuplicateSummary>();
+
+  // Expand first: the widget sits near the end of the scrollable content, so without the
+  // expanded list below it there isn't enough scroll room to bring its top up the dialog.
@@ -189,0 +189,11 @@
+  let duplicateWidgetVisible = $state(true);
+  let pillDismissed = $state(false);
+  $effect(() => {
+    const el = duplicateWidgetEl;
+    if (!el) return;
+    const observer = new IntersectionObserver(
+      ([intersection]) => duplicateWidgetVisible = intersection.isIntersecting,
+      {root: el.closest('[data-slot="dialog-content"]')});
+    observer.observe(el);
+    return () => observer.disconnect();
+  });
```

### script.createEntry

method · +18 -12

```diff
@@ -61,0 +65,3 @@
+    // loading: double-Enter must not create twice, so it flips before the first await
+    // duplicateActionBusy: a pending add-sense already consumes the typed meaning
+    if (loading || duplicateActionBusy) return;
@@ -64,5 +69,0 @@
-    await editor?.commit();
-    await addMainPublicationPromise; // make sure the main publication landed before we snapshot the entry
-    entry.senses = sense ? [sense] : [];
-    if (!validateEntry()) return;
-
@@ -70,7 +71,15 @@
-    const entrySnapshot = $state.snapshot(entry);
-    // The dialog pre-populates publishIn (main publication + any active filter), so always create the entry as-is.
-    await saveHandler.handleSave(() => lexboxApi.createEntry(entrySnapshot, createEntryOptions.asIs));
-    requester.resolve(entry);
-    requester = undefined;
-    loading = false;
-    open = false;
+    try {
+      await editor?.commit();
+      await addMainPublicationPromise; // make sure the main publication landed before we snapshot the entry
+      entry.senses = sense ? [sense] : [];
+      if (!validateEntry()) return;
+
+      const entrySnapshot = $state.snapshot(entry);
+      // The dialog pre-populates publishIn (main publication + any active filter), so always create the entry as-is.
+      await saveHandler.handleSave(() => lexboxApi.createEntry(entrySnapshot, createEntryOptions.asIs));
+      requester.resolve(entry);
+      requester = undefined;
+      open = false;
+    } finally {
+      loading = false;
+    }
```

### script.openWithValue

method · +2 -0

```diff
@@ -126,0 +136,2 @@
+      pillDismissed = false;
+      duplicateWidgetVisible = true;
```

### script.jumpToDuplicates

method · +5 -0

```diff
@@ -184,0 +184,5 @@
+  async function jumpToDuplicates(): Promise<void> {
+    duplicateCheck?.expand();
+    await tick();
+    duplicateWidgetEl?.scrollIntoView({behavior: 'smooth', block: 'start'});
+  }
```

### template

markup-region · +21 -3

```diff
@@ -181,1 +215,4 @@
-  <Dialog.DialogContent onkeydown={handleKeydown} class="sm:min-h-[min(calc(100%-16px),30rem)] max-md:px-2">
+  <!-- Fixed frame (not min/max): the duplicate check adds and reshapes content while the
+    dialog is open, and a content-sized dialog jumps around with every keystroke -->
+  <Dialog.DialogContent onkeydown={handleKeydown}
+    class="sm:min-h-[min(calc(100%-16px),30rem)] sm:w-[min(calc(100%-32px),50rem)] max-md:px-2">
@@ -185,1 +222,3 @@
-    <div>
+    <!-- min-w-0: as a grid item this div defaults to min-width:auto, letting long duplicate
+      headword lists widen the dialog instead of truncating -->
+    <div class="min-w-0">
@@ -213,0 +253,13 @@
+      <div class="mt-3 scroll-mt-2" bind:this={duplicateWidgetEl}>
+        <DuplicateCheck {entry} {sense} bind:this={duplicateCheck} bind:busy={duplicateActionBusy} bind:summary={duplicateSummary}
+          onNavigateToEntry={() => open = false} />
+      </div>
+      {#if duplicateSummary && !duplicateWidgetVisible && !pillDismissed}
+        <div class="sticky bottom-0 z-20 h-0 pointer-events-none">
+          <div class="absolute bottom-3 inset-x-0 flex justify-center">
+            <DuplicateSummaryPill summary={duplicateSummary}
+              onJump={() => jumpToDuplicates()}
+              onDismiss={() => pillDismissed = true} />
+          </div>
+        </div>
+      {/if}
@@ -224,1 +276,1 @@
-      <Button onclick={e => createEntry(e)} disabled={loading} {loading}>
+      <Button onclick={e => createEntry(e)} disabled={loading || duplicateActionBusy} {loading}>
```

## frontend/viewer/src/lib/entry-editor/DuplicateCheck.svelte

### script.Props

other · +10 -0

```diff
@@ -37,0 +37,10 @@
+  interface Props {
+    entry: IEntry;
+    sense?: ISense;
+    /** Called right before navigating to an existing entry, so the host dialog can close itself. */
+    onNavigateToEntry?: (entry: IEntry) => void;
+    /** True while an add-sense save is in flight — the host dialog should block submitting until it settles. */
+    busy?: boolean;
+    /** Set while there are matches, so the host can render an out-of-view indicator. */
+    summary?: DuplicateSummary;
+  }
```

### module script

other · +2 -0

```diff
@@ -0,0 +1,1 @@
+<script lang="ts" module>
@@ -11,0 +11,1 @@
+</script>
```

### module script.DuplicateSummary

other · +9 -0

```diff
@@ -2,0 +2,9 @@
+  export interface DuplicateSummary {
+    count: number;
+    capped: boolean;
+    hasExactWordMatch: boolean;
+    /** Matched headwords, strongest first, comma-joined for one-line display */
+    previewHeadwords: string;
+    /** One-line banner text, shared by this widget's header and the host's jump pill */
+    message: string;
+  }
```

### script.fragment 1

other · +24 -0

```diff
@@ -13,0 +13,24 @@
+<script lang="ts">
+  import type {IEntry, ISense} from '$lib/dotnet-types';
+  import {SortField} from '$lib/dotnet-types';
+  import {resource, watch} from 'runed';
+  import {t} from 'svelte-i18n-lingui';
+  import {slide} from 'svelte/transition';
+  import {navigate, useRouter} from 'svelte-routing';
+  import * as Collapsible from '$lib/components/ui/collapsible';
+  import {Badge} from '$lib/components/ui/badge';
+  import {Icon} from '$lib/components/ui/icon';
+  import {Button} from '$lib/components/ui/button';
+  import DictionaryEntry from '$lib/components/dictionary/DictionaryEntry.svelte';
+  import Loading from '$lib/components/Loading.svelte';
+  import {AppNotification} from '$lib/notifications/notifications';
+  import {useSaveHandler} from '$lib/services/save-event-service.svelte';
+  import {useLexboxApi} from '$lib/services/service-provider';
+  import {useMorphTypesService} from '$project/data/morph-types.svelte';
+  import {useWritingSystemService} from '$project/data';
+  import {useViewService} from '$lib/views/view-service.svelte';
+  import {pt} from '$lib/views/view-text';
+  import {entryBrowseParams} from '$lib/utils/search-params';
+  import {DEFAULT_DEBOUNCE_TIME} from '$lib/utils/time';
+  import {classifyDuplicates, duplicateQueries, duplicateTintClass, mergeSearchResults, trapEnter, type DuplicateMatch, type DuplicateQueries} from './duplicate-check';
+
```

### script.fragment 2

other · +40 -0

```diff
@@ -47,0 +47,40 @@
+
+  let {entry, sense, onNavigateToEntry, busy = $bindable(false), summary = $bindable()}: Props = $props();
+
+  const lexboxApi = useLexboxApi();
+  const writingSystemService = useWritingSystemService();
+  const morphTypesService = useMorphTypesService();
+  const viewService = useViewService();
+  const saveHandler = useSaveHandler();
+  const {base} = useRouter();
+
+  // Over-fetch: the full-text search also returns cross-field hits (e.g. a typed lexeme that
+  // coincidentally equals some entry's gloss) which classifyDuplicates drops, so fetch extra
+  // to keep enough real matches after filtering.
+  const FETCH_COUNT = 20;
+  const INITIAL_DISPLAY_COUNT = 3;
+
+  const vernacularWsIds = $derived(writingSystemService.vernacularNoAudio.map(ws => ws.wsId));
+  const analysisWsIds = $derived(writingSystemService.analysisNoAudio.map(ws => ws.wsId));
+  const queries = $derived(duplicateQueries(entry, sense, vernacularWsIds, analysisWsIds));
+  const hasQueries = $derived(queries.vernacular.length + queries.analysis.length > 0);
+
+  const duplicatesResource = resource(
+    // string key, so edits to unrelated fields don't retrigger the search
+    () => JSON.stringify([queries.vernacular, queries.analysis]),
+    async (_key, _prev, {signal}): Promise<{candidates: IEntry[], queries: DuplicateQueries, capped: boolean} | undefined> => {
+      // rank each search by the writing system the text was typed in, so that WS's headword matches sort first
+      const searches = [
+        ...queries.vernacular.map(query => ({text: query.text, writingSystem: query.wsId})),
+        ...queries.analysis.map(text => ({text, writingSystem: 'default'})),
+      ];
+      if (!searches.length) return undefined;
+      const results = await Promise.all(searches.map(search => lexboxApi.searchEntries(search.text, {
+        offset: 0,
+        count: FETCH_COUNT,
+        order: {field: SortField.SearchRelevance, writingSystem: search.writingSystem, ascending: true},
+      })));
+      // searchEntries can't take the abort signal over JSInterop and `resource` keeps whatever
+      // resolves last, so discard results that a newer keystroke has already superseded
+      if (signal.aborted) throw new DOMException('superseded duplicate search', 'AbortError');
+      return {
```

### script.fragment 3

other · +38 -0

```diff
@@ -87,0 +87,38 @@
+        candidates: mergeSearchResults(results),
+        // the queries these candidates answer — the live `queries` may already be newer
+        queries,
+        capped: results.some(result => result.length >= FETCH_COUNT),
+      };
+    },
+    {debounce: DEFAULT_DEBOUNCE_TIME},
+  );
+
+  // Classification lives outside the resource so it tracks the lazy morph-types resource:
+  // reading it here starts its load at mount, and once loaded matches re-classify without re-searching.
+  const matches = $derived.by(() => {
+    const morphTypes = morphTypesService.current;
+    const result = duplicatesResource.current;
+    if (!result) return undefined;
+    return classifyDuplicates(result.candidates, result.queries, vernacularWsIds, analysisWsIds, morphTypes);
+  });
+  const hasExactWordMatch = $derived(!!matches?.some(match => match.kind === 'same-word'));
+  // Matched headwords (strongest first) shown in the collapsed header, truncated by the
+  // trigger's ellipsis, so users can dismiss a wall of loose matches at a glance.
+  const previewHeadwords = $derived([...new Set(
+    (matches ?? []).map(match => writingSystemService.headword(match.entry)).filter(Boolean),
+  )].join(', '));
+  const summaryMessage = $derived.by(() => {
+    if (hasExactWordMatch) return pt($t`This entry may already exist`, $t`This word may already exist`, viewService.currentView);
+    if (matches?.length === 1) return pt($t`A similar entry already exists`, $t`A similar word already exists`, viewService.currentView);
+    return pt($t`Similar entries already exist`, $t`Similar words already exist`, viewService.currentView);
+  });
+  $effect(() => {
+    summary = matches?.length
+      ? {count: matches.length, capped: !!duplicatesResource.current?.capped, hasExactWordMatch, previewHeadwords, message: summaryMessage}
+      : undefined;
+  });
+
+  let expanded = $state(false);
+  let userToggled = $state(false);
+
+  /** Opens the match list, counting as a user toggle (the host's jump-pill calls this). */
```

### script.fragment 4

other · +26 -0

```diff
@@ -129,0 +129,18 @@
+  let displayCount = $state(INITIAL_DISPLAY_COUNT);
+  let expandedEntryId = $state<string>();
+  const displayedMatches = $derived(matches?.slice(0, displayCount) ?? []);
+
+  // Unfold automatically when the word itself already exists — that's the "stop and look" case.
+  // A manual collapse/expand always wins afterwards.
+  $effect(() => {
+    if (hasExactWordMatch && !userToggled) expanded = true;
+  });
+  watch(() => matches, current => {
+    if (!current?.length) {
+      expanded = false;
+      userToggled = false;
+      displayCount = INITIAL_DISPLAY_COUNT;
+      expandedEntryId = undefined;
+    }
+  });
+
@@ -161,0 +161,1 @@
+
@@ -166,0 +166,5 @@
+
+  // Rescues the meaning the user already typed: instead of creating a duplicate entry,
+  // it becomes a new sense of the existing one.
+  const canAddSense = $derived(!!sense && !!writingSystemService.firstDefOrGlossVal(sense));
+
@@ -188,0 +188,2 @@
+
+</script>
```

### script.kindLabel

method · +14 -0

```diff
@@ -147,0 +147,14 @@
+  function kindLabel(match: DuplicateMatch): string {
+    switch (match.kind) {
+      case 'same-word':
+        // a lexeme-only match on an entry whose citation form differs must not claim "Same
+        // headword" — the row displays that (different) citation form as the headword
+        return match.field === 'lexeme'
+          ? pt($t`Same lexeme form`, $t`Same word`, viewService.currentView)
+          : pt($t`Same headword`, $t`Same word`, viewService.currentView);
+      case 'similar-word':
+        return pt($t`Similar headword`, $t`Similar word`, viewService.currentView);
+      case 'same-meaning':
+        return pt($t`Similar gloss`, $t`Similar meaning`, viewService.currentView);
+    }
+  }
```

### script.addSenseToEntry

method · +17 -0

```diff
@@ -171,0 +171,17 @@
+  async function addSenseToEntry(target: IEntry): Promise<void> {
+    if (!sense || busy) return;
+    busy = true;
+    try {
+      // fresh id: the dialog's sense id must never end up on two entries (e.g. add-sense then create)
+      const senseSnapshot = {...$state.snapshot(sense), id: crypto.randomUUID(), entryId: target.id};
+      await saveHandler.handleSave(() => lexboxApi.createSense(target.id, senseSnapshot));
+    } finally {
+      busy = false;
+    }
+    AppNotification.display(
+      pt($t`Sense added to "${writingSystemService.headword(target)}"`,
+        $t`Meaning added to "${writingSystemService.headword(target)}"`,
+        viewService.currentView),
+      {type: 'success', timeout: 'short'});
+    openEntry(target);
+  }
```

### script.openEntry

method · +4 -0

```diff
@@ -162,0 +162,4 @@
+  function openEntry(target: IEntry): void {
+    onNavigateToEntry?.(target);
+    navigate(`${$base.uri}/browse?${entryBrowseParams(target.id)}`);
+  }
```

### script.expand

method · +4 -0

```diff
@@ -125,0 +125,4 @@
+  export function expand(): void {
+    expanded = true;
+    userToggled = true;
+  }
```

## frontend/viewer/src/lib/entry-editor/DuplicateCheck.svelte

### template

markup-region · +1 -0 · low-signal (whitespace)

```diff
@@ -12,0 +12,1 @@
+
```

### template.fragment 1

markup-region · +35 -0

```diff
@@ -190,0 +190,35 @@
+
+<div class="min-h-9 flex flex-col justify-center w-full" aria-live="polite">
+  {#if !matches?.length}
+    {#if (duplicatesResource.loading && hasQueries) || matches}
+      <div class="flex items-center gap-2 px-1 text-sm text-muted-foreground" transition:slide={{duration: 150}}>
+        {#if duplicatesResource.loading}
+          <Loading class="size-4" />
+          {pt($t`Checking for similar entries…`, $t`Checking for similar words…`, viewService.currentView)}
+        {:else}
+          <Icon icon="i-mdi-check-circle-outline" class="size-4 text-green-600 dark:text-green-500" />
+          {pt($t`No similar entries found`, $t`Looks like a new word`, viewService.currentView)}
+        {/if}
+      </div>
+    {/if}
+  {:else}
+    <Collapsible.Root
+      bind:open={expanded}
+      onOpenChange={() => userToggled = true}
+      class="rounded-md border {duplicateTintClass(hasExactWordMatch)}"
+      >
+      <Collapsible.Trigger class="w-full flex items-center gap-2 px-3 py-2 text-sm cursor-pointer" onkeydown={trapEnter}>
+        {#if hasExactWordMatch}
+          <Icon icon="i-mdi-alert-circle-outline" class="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
+        {:else}
+          <Icon icon="i-mdi-information-outline" class="size-5 shrink-0 text-muted-foreground" />
+        {/if}
+        <span class="grow min-w-0 truncate text-start font-medium">
+          {summaryMessage}
+          {#if !expanded && previewHeadwords}
+            <span class="text-muted-foreground font-normal">— {previewHeadwords}</span>
+          {/if}
+        </span>
+        {#if duplicatesResource.loading}
+          <Loading class="size-4" />
+        {/if}
```

### template.fragment 2

markup-region · +40 -0

```diff
@@ -225,0 +225,40 @@
+        <Badge variant="secondary">{matches.length}{duplicatesResource.current?.capped ? '+' : ''}</Badge>
+        <Icon icon={expanded ? 'i-mdi-chevron-up' : 'i-mdi-chevron-down'} class="size-5 shrink-0" />
+      </Collapsible.Trigger>
+      <Collapsible.Content>
+        <ul class="px-1.5 pb-1.5 space-y-1.5 max-h-56 overflow-y-auto">
+          {#each displayedMatches as match (match.entry.id)}
+            {@const badge = kindLabel(match)}
+            {@const isExpanded = expandedEntryId === match.entry.id}
+            <li class="rounded bg-background/80">
+              <button
+                type="button"
+                class="w-full flex items-center gap-2 {isExpanded ? 'rounded-t' : 'rounded'} hover:bg-accent px-2.5 py-2 text-start"
+                aria-expanded={isExpanded}
+                onkeydown={trapEnter}
+                onclick={() => expandedEntryId = isExpanded ? undefined : match.entry.id}>
+                <div class="grow min-w-0 text-sm {isExpanded ? '' : 'line-clamp-1'}">
+                  <DictionaryEntry entry={match.entry} inline={!isExpanded} hideExamples={!isExpanded} />
+                </div>
+                {#if badge}
+                  <Badge variant="outline" class="shrink-0 self-start whitespace-nowrap {match.kind === 'same-word' ? 'border-amber-600/50 dark:border-amber-400/50' : ''}">
+                    {badge}
+                  </Badge>
+                {/if}
+                <Icon icon={isExpanded ? 'i-mdi-chevron-up' : 'i-mdi-chevron-down'} class="size-4 shrink-0 self-start mt-0.5 text-muted-foreground" />
+              </button>
+              {#if isExpanded}
+                <div class="flex flex-wrap justify-end gap-1.5 px-2.5 pt-1 pb-2" transition:slide={{duration: 150}}>
+                  {#if canAddSense && (match.kind === 'same-word' || match.kind === 'similar-word')}
+                    {@const addSenseLabel = pt($t`Add sense`, $t`Add meaning`, viewService.currentView)}
+                    {@const addSenseHint = pt($t`Add sense to this entry`, $t`Add meaning to this word`, viewService.currentView)}
+                    <Button
+                      variant="outline"
+                      size="sm"
+                      icon="i-mdi-playlist-plus"
+                      title={addSenseHint}
+                      aria-label={addSenseHint}
+                      disabled={busy}
+                      onkeydown={trapEnter}
+                      onclick={() => addSenseToEntry(match.entry)}>
+                      {addSenseLabel}
```

### template.fragment 3

markup-region · +30 -0

```diff
@@ -265,0 +265,30 @@
+                    </Button>
+                  {/if}
+                  <Button
+                    variant="outline"
+                    size="sm"
+                    icon="i-mdi-arrow-right"
+                    disabled={busy}
+                    onkeydown={trapEnter}
+                    onclick={() => openEntry(match.entry)}>
+                    {pt($t`Go to entry`, $t`Go to word`, viewService.currentView)}
+                  </Button>
+                </div>
+              {/if}
+            </li>
+          {/each}
+          {#if matches.length > displayedMatches.length}
+            {@const remainingEntries = matches.length - displayedMatches.length}
+            <li>
+              <Button variant="ghost" size="sm" class="w-full text-muted-foreground"
+                onkeydown={trapEnter}
+                onclick={() => displayCount = matches.length}>
+                {$t`Show ${remainingEntries} more...`}
+              </Button>
+            </li>
+          {/if}
+        </ul>
+      </Collapsible.Content>
+    </Collapsible.Root>
+  {/if}
+</div>
```

## frontend/viewer/src/lib/entry-editor/duplicate-check.ts

### fragment 1 — from frontend/viewer/src/lib/entry-editor/duplicate-check.test.ts

other · +19 -0

```diff
@@ -0,0 +1,17 @@
+import {describe, expect, it} from 'vitest';
+import type {IEntry} from '$lib/dotnet-types';
+import {
+  classifyDuplicates,
+  duplicateQueries,
+  hasDiacritics,
+  mergeSearchResults,
+  normalizeForCompare,
+  stripMorphTokens,
+  type DuplicateQueries,
+} from './duplicate-check';
+
+const vernWs = ['seh', 'por'];
+const analysisWs = ['en', 'fr'];
+// canonical suffix/prefix morph-token shapes (CanonicalMorphTypes)
+const morphTypes = [{prefix: '-', postfix: undefined}, {prefix: undefined, postfix: '-'}];
+
@@ -27,0 +27,1 @@
+
@@ -34,0 +34,1 @@
+
```

### fragment 1

other · +36 -0

```diff
@@ -0,0 +1,20 @@
+import type {IEntry, IMorphType, ISense} from '$lib/dotnet-types';
+
+export const MIN_QUERY_LENGTH = 2;
+
+/**
+ * Ordered strongest to weakest. Candidates the backend's full-text search returned but that
+ * don't match one of these — a typed vernacular value that only hit a gloss, or a typed gloss
+ * that only hit a headword — are dropped rather than shown as a vague "related" hit: for a
+ * duplicate warning those cross-field coincidences are noise, not signal.
+ */
+export type DuplicateMatchKind = 'same-word' | 'similar-word' | 'same-meaning';
+
+/**
+ * Which field an exact match hit: 'headword' when the citation form matched (or the lexeme
+ * form of an entry with no citation form — the lexeme IS the headword then), 'lexeme' when
+ * only the lexeme form matched while a different citation form exists. Same severity either
+ * way; it only exists so the badge doesn't claim "Same headword" for a lexeme-only match.
+ */
+export type SameWordField = 'headword' | 'lexeme';
+
@@ -26,0 +26,1 @@
+
@@ -32,0 +32,1 @@
+
@@ -39,0 +39,3 @@
+
+export type MorphTokenSource = Pick<IMorphType, 'prefix' | 'postfix'>;
+
@@ -47,0 +47,2 @@
+
+/** Hosts submit on Enter; interacting with duplicate UI must never also create the entry. */
@@ -52,0 +52,9 @@
+
+export const MAX_SIMILAR_LENGTH_DELTA = 5;
+
+/**
+ * Deliberately broader than a starts-with headword match: mid-word containment must count
+ * (typing "liman" has to surface an existing "naliman"), so it's containment in either
+ * direction with no positional threshold. The length-delta cap keeps short fragments from
+ * matching half the lexicon (typing "uz" must not surface every word containing it).
+ */
```

### DuplicateMatch

other · +5 -0

```diff
@@ -21,0 +21,5 @@
+export interface DuplicateMatch {
+  entry: IEntry;
+  kind: DuplicateMatchKind;
+  field?: SameWordField;
+}
```

### VernacularQuery

other · +5 -0

```diff
@@ -27,0 +27,5 @@
+export interface VernacularQuery {
+  text: string;
+  /** The writing system the text was typed in — used to rank that WS's headword matches first */
+  wsId: string;
+}
```

### DuplicateQueries

other · +6 -0

```diff
@@ -33,0 +33,6 @@
+export interface DuplicateQueries {
+  /** Texts the user typed into vernacular fields (lexeme form, citation form) */
+  vernacular: VernacularQuery[];
+  /** Texts the user typed into gloss fields */
+  analysis: string[];
+}
```

## frontend/viewer/src/lib/entry-editor/duplicate-check.ts

### fragment 3 — from frontend/viewer/src/lib/entry-editor/duplicate-check.test.ts

other · +38 -0

```diff
@@ -78,0 +78,38 @@
+  it('leaves untokenized input alone', () => {
+    expect(stripMorphTokens('aji', morphTypes)).toBe('aji');
+  });
+});
+
+describe('duplicateQueries', () => {
+  it('collects distinct vernacular texts with their writing system, and gloss texts', () => {
+    const queries = duplicateQueries(
+      {lexemeForm: {seh: 'nyumba', por: 'casa'}, citationForm: {seh: 'nyumba'}},
+      {gloss: {en: 'house', fr: ''}},
+      vernWs,
+      analysisWs,
+    );
+    expect(queries.vernacular).toEqual([{text: 'nyumba', wsId: 'seh'}, {text: 'casa', wsId: 'por'}]);
+    expect(queries.analysis).toEqual(['house']);
+  });
+
+  it('skips blank and too-short values', () => {
+    const queries = duplicateQueries(
+      {lexemeForm: {seh: ' n '}, citationForm: {}},
+      {gloss: {en: '  '}},
+      vernWs,
+      analysisWs,
+    );
+    expect(queries.vernacular).toEqual([]);
+    expect(queries.analysis).toEqual([]);
+  });
+
+  it('accepts a value exactly at the length threshold', () => {
+    const queries = duplicateQueries(
+      {lexemeForm: {seh: 'ba'}, citationForm: {}},
+      undefined,
+      vernWs,
+      analysisWs,
+    );
+    expect(queries.vernacular).toEqual([{text: 'ba', wsId: 'seh'}]);
+  });
+
```

### fragment 4 — from frontend/viewer/src/lib/entry-editor/duplicate-check.test.ts

other · +34 -0

```diff
@@ -116,0 +116,34 @@
+  it('measures the length threshold on the normalized text', () => {
+    // 'e' + combining acute is 2 chars raw but 1 char once marks are stripped
+    const queries = duplicateQueries(
+      {lexemeForm: {seh: 'é'}, citationForm: {}},
+      undefined,
+      vernWs,
+      analysisWs,
+    );
+    expect(queries.vernacular).toEqual([]);
+  });
+
+  it('dedupes values that only differ by case or accents', () => {
+    const queries = duplicateQueries(
+      {lexemeForm: {seh: 'café'}, citationForm: {seh: 'Cafe'}},
+      undefined,
+      vernWs,
+      analysisWs,
+    );
+    expect(queries.vernacular).toEqual([{text: 'café', wsId: 'seh'}]);
+  });
+
+  it('keeps a gloss query even when the same text was typed as a vernacular value', () => {
+    // loanword case: lexeme 'radio' glossed 'radio' — the gloss query must survive so
+    // same-meaning matches on other entries still classify
+    const queries = duplicateQueries(
+      {lexemeForm: {seh: 'radio'}, citationForm: {}},
+      {gloss: {en: 'radio'}},
+      vernWs,
+      analysisWs,
+    );
+    expect(queries.vernacular).toEqual([{text: 'radio', wsId: 'seh'}]);
+    expect(queries.analysis).toEqual(['radio']);
+  });
+
```

### fragment 5 — from frontend/viewer/src/lib/entry-editor/duplicate-check.test.ts

other · +37 -0

```diff
@@ -150,0 +150,37 @@
+  it('ignores values in writing systems outside the given lists', () => {
+    const queries = duplicateQueries(
+      {lexemeForm: {'seh-Zxxx-x-audio': 'clip.wav', seh: 'nyumba'}, citationForm: {}},
+      undefined,
+      vernWs,
+      analysisWs,
+    );
+    expect(queries.vernacular).toEqual([{text: 'nyumba', wsId: 'seh'}]);
+  });
+});
+
+describe('mergeSearchResults', () => {
+  it('dedupes entries matched by multiple queries, preserving first-seen order', () => {
+    const a = makeEntry({});
+    const b = makeEntry({});
+    const c = makeEntry({});
+    expect(mergeSearchResults([[a, b], [b, c, a]])).toEqual([a, b, c]);
+  });
+});
+
+describe('classifyDuplicates', () => {
+  const queries: DuplicateQueries = {vernacular: [{text: 'nyumba', wsId: 'seh'}], analysis: ['house']};
+
+  it('classifies exact headword matches as same-word, even via citation form or other ws', () => {
+    const byLexeme = makeEntry({lexemeForm: {seh: 'Nyumbá'}});
+    const byCitation = makeEntry({citationForm: {por: 'nyumba'}});
+    const result = classifyDuplicates([byLexeme, byCitation], queries, vernWs, analysisWs);
+    expect(result.map(m => m.kind)).toEqual(['same-word', 'same-word']);
+  });
+
+  it('classifies partial headword overlap (either direction) as similar-word', () => {
+    const superstring = makeEntry({lexemeForm: {seh: 'nyumbazi'}});
+    const substring = makeEntry({lexemeForm: {seh: 'yumba'}});
+    const result = classifyDuplicates([superstring, substring], queries, vernWs, analysisWs);
+    expect(result.map(m => m.kind)).toEqual(['similar-word', 'similar-word']);
+  });
+
```

### duplicateQueries

method · +33 -0

```diff
@@ -112,0 +112,33 @@
+export function duplicateQueries(
+  entry: Pick<IEntry, 'lexemeForm' | 'citationForm'>,
+  sense: Pick<ISense, 'gloss'> | undefined,
+  vernacularWsIds: string[],
+  analysisWsIds: string[],
+): DuplicateQueries {
+  // dedupe per field kind, not across: the same text typed as both lexeme and gloss must
+  // still produce an analysis query, or its same-meaning matches are never classified
+  const seenVernacular = new Set<string>();
+  const vernacular: VernacularQuery[] = [];
+  for (const wsId of vernacularWsIds) {
+    for (const value of [entry.lexemeForm?.[wsId], entry.citationForm?.[wsId]]) {
+      const trimmed = value?.trim();
+      if (!trimmed) continue;
+      const normalized = normalizeForCompare(trimmed);
+      if (normalized.length < MIN_QUERY_LENGTH || seenVernacular.has(normalized)) continue;
+      seenVernacular.add(normalized);
+      vernacular.push({text: trimmed, wsId});
+    }
+  }
+
+  const seenAnalysis = new Set<string>();
+  const analysis: string[] = [];
+  for (const value of analysisWsIds.map(wsId => sense?.gloss?.[wsId])) {
+    const trimmed = value?.trim();
+    if (!trimmed) continue;
+    const normalized = normalizeForCompare(trimmed);
+    if (normalized.length < MIN_QUERY_LENGTH || seenAnalysis.has(normalized)) continue;
+    seenAnalysis.add(normalized);
+    analysis.push(trimmed);
+  }
+  return {vernacular, analysis};
+}
```

### mergeSearchResults

method · +8 -0

```diff
@@ -147,0 +147,8 @@
+export function mergeSearchResults(results: IEntry[][]): IEntry[] {
+  const seen = new Set<string>();
+  return results.flat().filter(entry => {
+    if (seen.has(entry.id)) return false;
+    seen.add(entry.id);
+    return true;
+  });
+}
```

### duplicateTintClass

method · +5 -0

```diff
@@ -42,0 +42,5 @@
+export function duplicateTintClass(hasExactWordMatch: boolean): string {
+  return hasExactWordMatch
+    ? 'border-amber-600/40 bg-amber-500/10 dark:border-amber-400/40'
+    : 'border-border bg-muted/50';
+}
```

### trapEnter

method · +3 -0

```diff
@@ -49,0 +49,3 @@
+export function trapEnter(event: KeyboardEvent): void {
+  if (event.key === 'Enter') event.stopPropagation();
+}
```

### fragment 2

other · +33 -0

```diff
@@ -65,0 +65,14 @@
+
+const kindRank: Record<DuplicateMatchKind, number> = {
+  'same-word': 0,
+  'similar-word': 1,
+  'same-meaning': 2,
+};
+
+/**
+ * Mirrors the backend fold (SqlHelpers.ContainsIgnoreCaseAccents → StringExtensions):
+ * invariant case fold, and diacritics are significant only when the search text itself
+ * contains them — hence the keepDiacritics mode, chosen per query via hasDiacritics().
+ * Collation-level equivalences (ß≈ss, ligatures, ICU-ignorable characters like soft hyphens)
+ * are not replicated.
+ */
@@ -84,0 +84,1 @@
+
@@ -88,0 +88,2 @@
+
+/** Mirrors the backend's EntrySearchService.StripMorphTokens best-match strip. */
@@ -111,0 +111,1 @@
+
@@ -145,0 +145,2 @@
+
+/** Merges per-query search results into a single relevance-ordered candidate list. */
@@ -155,0 +155,13 @@
+
+/**
+ * Classifies search results against what the user typed, drops cross-field coincidences, and
+ * orders survivors strongest match first (headword matches before gloss matches; similar words
+ * closest in length first). `candidates` are expected in search-relevance order, which is
+ * preserved between equally-strong matches.
+ *
+ * Match rules mirror the CRDT FTS backend (EntrySearchService): a typed value counts against a
+ * lexeme or citation form in any vernacular WS, but typed morph tokens (e.g. the "-" on a suffix)
+ * are stripped before comparing against lexeme forms and kept when comparing against citation
+ * forms. The FwData search and the backend's short-query (< 3 chars) fallback never strip morph
+ * tokens — that only affects which candidates arrive, not how they're classified here.
+ */
```

### fragment 6 — from frontend/viewer/src/lib/entry-editor/duplicate-check.test.ts

other · +36 -0

```diff
@@ -187,0 +187,36 @@
+  it('classifies mid-word containment as similar-word, not just starts-with', () => {
+    // real user story: typing "liman" must surface the existing entry "naliman"
+    const buried = makeEntry({lexemeForm: {seh: 'kumanyumba'}});
+    expect(classifyDuplicates([buried], queries, vernWs, analysisWs)[0]?.kind).toBe('similar-word');
+  });
+
+  it('drops containment matches just past the length-delta cap', () => {
+    // real user story: typing "uz" must not surface every word containing it;
+    // 'uzembez' is delta 5 (kept, exactly at the cap) and 'uzembeza' is delta 6 (dropped)
+    const atCap = makeEntry({lexemeForm: {seh: 'uzembez'}});
+    const pastCap = makeEntry({lexemeForm: {seh: 'uzembeza'}});
+    const result = classifyDuplicates([atCap, pastCap], vernQueries('uz'), vernWs, analysisWs);
+    expect(result).toEqual([{entry: atCap, kind: 'similar-word'}]);
+  });
+
+  it('sorts similar words closest in length first', () => {
+    const far = makeEntry({lexemeForm: {seh: 'kumanyumba'}});
+    const near = makeEntry({lexemeForm: {seh: 'nyumbazi'}});
+    const result = classifyDuplicates([far, near], queries, vernWs, analysisWs);
+    expect(result.map(m => m.entry.id)).toEqual([near.id, far.id]);
+  });
+
+  it('ranks an entry by its closest form when several forms are similar', () => {
+    // closeViaCitation: lexeme is delta 4 but citation is delta 1 — the citation should rank it
+    const closeViaCitation = makeEntry({lexemeForm: {seh: 'kunyumbaza'}, citationForm: {seh: 'nyumbaz'}});
+    const middling = makeEntry({lexemeForm: {seh: 'nyumbazi'}});
+    const result = classifyDuplicates([middling, closeViaCitation], queries, vernWs, analysisWs);
+    expect(result.map(m => m.entry.id)).toEqual([closeViaCitation.id, middling.id]);
+  });
+
+  it('treats a typed morph token like the backend: "-aji" is the same word as suffix entry "aji"', () => {
+    const suffixEntry = makeEntry({lexemeForm: {seh: 'aji'}});
+    const result = classifyDuplicates([suffixEntry], vernQueries('-aji'), vernWs, analysisWs, morphTypes);
+    expect(result[0].kind).toBe('same-word');
+  });
+
```

### fragment 7 — from frontend/viewer/src/lib/entry-editor/duplicate-check.test.ts

other · +35 -0

```diff
@@ -223,0 +223,35 @@
+  it('strips morph tokens for lexeme forms but keeps them for citation forms (backend parity)', () => {
+    const byLexeme = makeEntry({lexemeForm: {seh: 'aji'}});
+    const byCitation = makeEntry({citationForm: {seh: 'aji'}});
+    const result = classifyDuplicates([byLexeme, byCitation], vernQueries('-aji'), vernWs, analysisWs, morphTypes);
+    const kindById = new Map(result.map(m => [m.entry.id, m.kind]));
+    expect(kindById.get(byLexeme.id)).toBe('same-word');
+    // citation form 'aji' is compared against the un-stripped '-aji', so it is not the same word
+    expect(kindById.get(byCitation.id)).not.toBe('same-word');
+  });
+
+  it('is accent-insensitive only when the typed text has no diacritics (backend parity)', () => {
+    const plain = makeEntry({lexemeForm: {seh: 'cafe'}});
+    const accented = makeEntry({lexemeForm: {seh: 'café'}});
+    // typed without diacritics -> accents ignored -> both are the same word
+    expect(classifyDuplicates([plain, accented], vernQueries('cafe'), vernWs, analysisWs).map(m => m.kind))
+      .toEqual(['same-word', 'same-word']);
+    // typed with diacritics -> accents significant -> only the accented entry matches exactly
+    const result = classifyDuplicates([accented, plain], vernQueries('café'), vernWs, analysisWs);
+    expect(result[0]).toEqual({entry: accented, kind: 'same-word', field: 'headword'});
+    expect(result[1].kind).not.toBe('same-word');
+  });
+
+  it('attributes a same-word match to the field that hit', () => {
+    // lexeme 'fuz' + citation 'fuza': the headword shown is 'fuza', so a match on the
+    // typed 'fuz' is the same entry but NOT the same headword
+    const viaLexemeOnly = makeEntry({lexemeForm: {seh: 'fuz'}, citationForm: {seh: 'fuza'}});
+    const viaCitation = makeEntry({lexemeForm: {seh: 'fu'}, citationForm: {seh: 'fuz'}});
+    const lexemeIsHeadword = makeEntry({lexemeForm: {seh: 'fuz'}});
+    const result = classifyDuplicates([viaLexemeOnly, viaCitation, lexemeIsHeadword], vernQueries('fuz'), vernWs, analysisWs);
+    const fieldById = new Map(result.map(m => [m.entry.id, m.field]));
+    expect(fieldById.get(viaLexemeOnly.id)).toBe('lexeme');
+    expect(fieldById.get(viaCitation.id)).toBe('headword');
+    expect(fieldById.get(lexemeIsHeadword.id)).toBe('headword');
+  });
+
```

### fragment 8 — from frontend/viewer/src/lib/entry-editor/duplicate-check.test.ts

other · +33 -0

```diff
@@ -258,0 +258,33 @@
+  it('prefers a citation-form hit over an earlier lexeme-only hit across queries', () => {
+    // one entry, two typed values: 'fuz' hits only the lexeme form, 'fuza' hits the
+    // citation form — the citation hit must win the field attribution
+    const entry = makeEntry({lexemeForm: {seh: 'fuz'}, citationForm: {seh: 'fuza'}});
+    const result = classifyDuplicates([entry], vernQueries('fuz', 'fuza'), vernWs, analysisWs);
+    expect(result[0]).toEqual({entry, kind: 'same-word', field: 'headword'});
+  });
+
+  it('classifies gloss overlap as same-meaning', () => {
+    const entry = withGloss('cabana', 'house');
+    expect(classifyDuplicates([entry], queries, vernWs, analysisWs)[0].kind).toBe('same-meaning');
+  });
+
+  it('classifies partial gloss containment in either direction as same-meaning', () => {
+    const glossContainsQuery = withGloss('cabana', 'houseboat');
+    const queryContainsGloss = withGloss('cabana', 'use');
+    const result = classifyDuplicates([glossContainsQuery, queryContainsGloss], queries, vernWs, analysisWs);
+    expect(result.map(m => m.kind)).toEqual(['same-meaning', 'same-meaning']);
+  });
+
+  it('drops candidates that overlap in neither headword nor gloss', () => {
+    // the full-text search can return an entry via a field we don't classify (e.g. definition);
+    // it should be dropped, not shown as a vague match
+    const entry = withGloss('cabana', 'dwelling');
+    expect(classifyDuplicates([entry], queries, vernWs, analysisWs)).toEqual([]);
+  });
+
+  it('drops a candidate whose gloss equals a typed vernacular value (cross-field coincidence)', () => {
+    // typing lexeme 'nyumba' must not surface an entry merely because its gloss is 'nyumba'
+    const entry = withGloss('cabana', 'nyumba');
+    expect(classifyDuplicates([entry], vernQueries('nyumba'), vernWs, analysisWs)).toEqual([]);
+  });
+
```

### fragment 9 — from frontend/viewer/src/lib/entry-editor/duplicate-check.test.ts

other · +16 -0

```diff
@@ -291,0 +291,16 @@
+  it('sorts word matches above meaning matches, preserving relevance order within a kind', () => {
+    const meaning = withGloss('cabana', 'house');
+    const similarA = makeEntry({lexemeForm: {seh: 'nyumbazi'}});
+    const similarB = makeEntry({lexemeForm: {seh: 'manyumba'}});
+    const exact = makeEntry({lexemeForm: {seh: 'nyumba'}});
+    const result = classifyDuplicates([meaning, similarA, similarB, exact], queries, vernWs, analysisWs);
+    expect(result.map(m => m.entry.id)).toEqual([exact.id, similarA.id, similarB.id, meaning.id]);
+  });
+
+  it('never reports a headword match when no vernacular text was typed', () => {
+    // gloss-only query: an entry matched purely by headword is a cross-field coincidence and dropped
+    const entry = makeEntry({lexemeForm: {seh: 'nyumba'}});
+    const result = classifyDuplicates([entry], {vernacular: [], analysis: ['house']}, vernWs, analysisWs);
+    expect(result).toEqual([]);
+  });
+});
```

### classifyDuplicates

method · +27 -0

```diff
@@ -168,0 +168,20 @@
+export function classifyDuplicates(
+  candidates: IEntry[],
+  queries: DuplicateQueries,
+  vernacularWsIds: string[],
+  analysisWsIds: string[],
+  morphTypes: readonly MorphTokenSource[] = [],
+): DuplicateMatch[] {
+  const vernQueries = queries.vernacular.map(({text}) => {
+    const keepDiacritics = hasDiacritics(text);
+    return {
+      keepDiacritics,
+      lexeme: normalizeForCompare(stripMorphTokens(text, morphTypes), keepDiacritics),
+      citation: normalizeForCompare(text, keepDiacritics),
+    };
+  });
+  const analysisQueries = queries.analysis.map(text => ({
+    keepDiacritics: hasDiacritics(text),
+    text,
+  }));
+
@@ -232,0 +232,7 @@
+
+  return candidates
+    .map(entry => ({entry, match: classify(entry)}))
+    .filter((candidate): candidate is {entry: IEntry, match: NonNullable<ReturnType<typeof classify>>} => candidate.match !== undefined)
+    .sort((a, b) => (kindRank[a.match.kind] - kindRank[b.match.kind]) || (a.match.lengthDelta - b.match.lengthDelta))
+    .map(({entry, match}) => ({entry, kind: match.kind, field: match.field}));
+}
```

### fragment 2 — from frontend/viewer/src/lib/entry-editor/duplicate-check.test.ts

other · +40 -0

```diff
@@ -38,0 +38,40 @@
+
+describe('normalizeForCompare', () => {
+  it('ignores case and accents by default', () => {
+    expect(normalizeForCompare('Ñumbá ')).toBe('numba');
+    expect(normalizeForCompare('CAFÉ')).toBe('cafe');
+  });
+
+  it('keeps diacritics when asked, still folding case', () => {
+    expect(normalizeForCompare('CAFÉ', true)).toBe('café'.normalize('NFD'));
+    expect(normalizeForCompare('CAFÉ', true)).not.toBe('cafe');
+  });
+
+  it('folds case invariantly, not by host locale', () => {
+    // must never produce Turkish dotless ı for ASCII I
+    expect(normalizeForCompare('IZGARA')).toBe('izgara');
+  });
+});
+
+describe('hasDiacritics', () => {
+  it('detects combining marks in composed and decomposed input', () => {
+    expect(hasDiacritics('café')).toBe(true);
+    expect(hasDiacritics('café')).toBe(true);
+    expect(hasDiacritics('cafe')).toBe(false);
+  });
+});
+
+describe('stripMorphTokens', () => {
+  it('strips a leading token', () => {
+    expect(stripMorphTokens('-aji', morphTypes)).toBe('aji');
+  });
+
+  it('strips a trailing token', () => {
+    expect(stripMorphTokens('a-', morphTypes)).toBe('a');
+  });
+
+  it('prefers the type matching a leading token over a trailing one', () => {
+    // '-a-' matches both shapes; leading-token match scores higher (mirrors backend scoring)
+    expect(stripMorphTokens('-a-', [{prefix: '-', postfix: '-'}])).toBe('a');
+  });
+
```

### hasDiacritics

method · +3 -0

```diff
@@ -85,0 +85,3 @@
+export function hasDiacritics(value: string): boolean {
+  return /\p{Mn}/u.test(value.normalize('NFD'));
+}
```

### stripMorphTokens

method · +21 -0

```diff
@@ -90,0 +90,21 @@
+export function stripMorphTokens(value: string, morphTypes: readonly MorphTokenSource[]): string {
+  let bestScore = 0;
+  let bestMatch: MorphTokenSource | undefined;
+  for (const morphType of morphTypes) {
+    const prefix = morphType.prefix?.trim() ? morphType.prefix : undefined;
+    const postfix = morphType.postfix?.trim() ? morphType.postfix : undefined;
+    const matchesPrefix = !!prefix && value.startsWith(prefix);
+    const matchesPostfix = !!postfix && value.endsWith(postfix)
+      && (!matchesPrefix || value.length >= prefix.length + postfix.length);
+    const score = (matchesPrefix ? 2 : 0) + (matchesPostfix ? 1 : 0);
+    if (score > bestScore) {
+      bestScore = score;
+      bestMatch = morphType;
+    }
+  }
+  if (!bestMatch) return value;
+  let result = value;
+  if (bestMatch.prefix?.trim() && result.startsWith(bestMatch.prefix)) result = result.slice(bestMatch.prefix.length);
+  if (bestMatch.postfix?.trim() && result.endsWith(bestMatch.postfix)) result = result.slice(0, -bestMatch.postfix.length);
+  return result;
+}
```

### classifyDuplicates.classify.fragment 1

method-fragment · +40 -0

```diff
@@ -188,0 +188,40 @@
+  function classify(entry: IEntry): {kind: DuplicateMatchKind, field?: SameWordField, lengthDelta: number} | undefined {
+    const lexemeForms = vernacularWsIds.map(wsId => entry.lexemeForm?.[wsId]).filter((form): form is string => !!form);
+    const citationForms = vernacularWsIds.map(wsId => entry.citationForm?.[wsId]).filter((form): form is string => !!form);
+    if (lexemeForms.length || citationForms.length) {
+      let sameWordField: SameWordField | undefined;
+      for (const query of vernQueries) {
+        const lex = lexemeForms.map(form => normalizeForCompare(form, query.keepDiacritics));
+        const cit = citationForms.map(form => normalizeForCompare(form, query.keepDiacritics));
+        if (cit.includes(query.citation)) {
+          sameWordField = 'headword';
+          break;
+        }
+        if (lex.includes(query.lexeme)) sameWordField ??= citationForms.length ? 'lexeme' : 'headword';
+      }
+      if (sameWordField) return {kind: 'same-word', field: sameWordField, lengthDelta: 0};
+      let lengthDelta = Infinity;
+      for (const query of vernQueries) {
+        const lex = lexemeForms.map(form => normalizeForCompare(form, query.keepDiacritics));
+        const cit = citationForms.map(form => normalizeForCompare(form, query.keepDiacritics));
+        for (const {form, queryText} of [
+          ...lex.map(form => ({form, queryText: query.lexeme})),
+          ...cit.map(form => ({form, queryText: query.citation})),
+        ]) {
+          if (isSimilarWord(form, queryText)) {
+            lengthDelta = Math.min(lengthDelta, Math.abs(form.length - queryText.length));
+          }
+        }
+      }
+      if (lengthDelta !== Infinity) return {kind: 'similar-word', lengthDelta};
+    }
+    if (analysisQueries.length) {
+      const rawGlosses = (entry.senses ?? [])
+        .flatMap(sense => analysisWsIds.map(wsId => sense.gloss?.[wsId]))
+        .filter((gloss): gloss is string => !!gloss);
+      for (const query of analysisQueries) {
+        const queryText = normalizeForCompare(query.text, query.keepDiacritics);
+        const glosses = rawGlosses.map(gloss => normalizeForCompare(gloss, query.keepDiacritics));
+        if (glosses.some(gloss => gloss.includes(queryText) || queryText.includes(gloss))) {
+          return {kind: 'same-meaning', lengthDelta: 0};
+        }
```

### normalizeForCompare

method · +5 -0

```diff
@@ -79,0 +79,5 @@
+export function normalizeForCompare(value: string, keepDiacritics = false): string {
+  const decomposed = value.normalize('NFD');
+  const folded = keepDiacritics ? decomposed : decomposed.replace(/\p{Mn}/gu, '');
+  return folded.toLowerCase().trim();
+}
```

### isSimilarWord

method · +4 -0

```diff
@@ -61,0 +61,4 @@
+export function isSimilarWord(a: string, b: string): boolean {
+  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
+  return longer.length - shorter.length <= MAX_SIMILAR_LENGTH_DELTA && longer.includes(shorter);
+}
```

### classifyDuplicates.classify.fragment 2

method-fragment · +4 -0

```diff
@@ -228,0 +228,4 @@
+      }
+    }
+    return undefined;
+  }
```

## frontend/viewer/src/lib/entry-editor/DuplicateSummaryPill.svelte

### script

other · +10 -0

```diff
@@ -0,0 +1,7 @@
+<script lang="ts">
+  import {t} from 'svelte-i18n-lingui';
+  import {Badge} from '$lib/components/ui/badge';
+  import {Icon} from '$lib/components/ui/icon';
+  import {duplicateTintClass, trapEnter} from './duplicate-check';
+  import type {DuplicateSummary} from './DuplicateCheck.svelte';
+
@@ -14,0 +14,3 @@
+
+  let {summary, onJump, onDismiss}: Props = $props();
+</script>
```

### script.Props

other · +6 -0

```diff
@@ -8,0 +8,6 @@
+  interface Props {
+    summary: DuplicateSummary;
+    /** Called when the pill body is activated — the host scrolls the duplicate widget into view. */
+    onJump: () => void;
+    onDismiss: () => void;
+  }
```

### template

markup-region · +39 -0

```diff
@@ -17,0 +17,39 @@
+
+<!-- One visual pill, two sibling buttons (a button can't nest a button).
+  mousedown preventDefault: focusing the pill makes Chromium cancel the smooth scroll it triggers -->
+<!-- opaque bg-background underlay: the tint colors are translucent washes shared with
+  the duplicate widget's trigger, and the pill floats over form content -->
+<div class="pointer-events-auto max-w-full rounded-full bg-background shadow-md">
+  <div class="max-w-full flex items-center rounded-full border text-sm {duplicateTintClass(summary.hasExactWordMatch)}">
+    <button
+      type="button"
+      aria-label={summary.message}
+      class="min-w-0 flex items-center gap-2 rounded-s-full ps-3 py-1.5 relative after:absolute after:content-[''] after:-inset-y-2.5 after:-start-2.5 after:end-0"
+      onkeydown={trapEnter}
+      onmousedown={e => e.preventDefault()}
+      onclick={onJump}>
+      {#if summary.hasExactWordMatch}
+        <Icon icon="i-mdi-alert-circle-outline" class="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
+      {:else}
+        <Icon icon="i-mdi-information-outline" class="size-4 shrink-0 text-muted-foreground" />
+      {/if}
+      <span class="min-w-0 truncate font-medium">
+        {summary.message}
+        {#if summary.previewHeadwords}
+          <span class="text-muted-foreground font-normal">— {summary.previewHeadwords}</span>
+        {/if}
+      </span>
+      <Badge variant="secondary">{summary.count}{summary.capped ? '+' : ''}</Badge>
+      <Icon icon="i-mdi-chevron-down" class="size-4 shrink-0" />
+    </button>
+    <button
+      type="button"
+      aria-label={$t`Close`}
+      class="flex items-center rounded-e-full ps-1.5 pe-2.5 py-1.5 self-stretch relative after:absolute after:content-[''] after:-inset-y-2.5 after:start-0 after:-end-2.5"
+      onkeydown={trapEnter}
+      onmousedown={e => e.preventDefault()}
+      onclick={onDismiss}>
+      <Icon icon="i-mdi-close" class="size-4 shrink-0" />
+    </button>
+  </div>
+</div>
```

## frontend/viewer/src/lib/components/dictionary/DictionaryEntry.svelte

### script

other · +3 -0

```diff
@@ -17,0 +18,1 @@
+    inline = false,
@@ -26,0 +28,2 @@
+    /** Render senses as one flowing line (no line break per sense) — for compact previews */
+    inline?: boolean;
```

### template

markup-region · +6 -1

```diff
@@ -107,1 +110,6 @@
-      <br />
+      {#if inline}
+        <!-- eslint-disable-next-line svelte/no-useless-mustaches This mustache is not useless, it preserves whitespace -->
+        {' '}
+      {:else}
+        <br />
+      {/if}
```

## frontend/viewer/src/locales/en.po

### fragment 1

other · +36 -0

```diff
@@ -22,0 +23,1 @@
+#: src/lib/entry-editor/CommentDialog.svelte
@@ -103,0 +105,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "A similar word already exists"
+#. Warning banner in the New Entry dialog when exactly one possible duplicate was found (none an exact headword match)
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "A similar entry already exists"
+msgstr "A similar entry already exists"
+
+#. Relevant view: Lite
+#. Classic view equivalent: "A similar entry already exists"
+#. Warning banner in the New Word dialog when exactly one possible duplicate was found (none spelled exactly the same)
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "A similar word already exists"
+msgstr "A similar word already exists"
+
@@ -153,0 +169,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense"
+#. Short button label on a possible-duplicate result in the New Word dialog; fuller form: "Add meaning to this word"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning"
+msgstr "Add meaning"
+
@@ -162,0 +185,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense to this entry"
+#. Button on a possible-duplicate result in the New Word dialog: saves the meaning being typed onto that existing word (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning to this word"
+msgstr "Add meaning to this word"
+
@@ -174,0 +204,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Add meaning"
+#. Short button label on a possible-duplicate result in the New Entry dialog; fuller form: "Add sense to this entry"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add sense"
+msgstr "Add sense"
+
```

### fragment 2

other · +36 -0

```diff
@@ -182,0 +219,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Add meaning to this word"
+#. Button on a possible-duplicate result in the New Entry dialog: saves the sense being typed onto that existing entry (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add sense to this entry"
+msgstr "Add sense to this entry"
+
@@ -371,0 +415,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Checking for similar words…"
+#. Status line in the New Entry dialog while searching for possible duplicate entries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Checking for similar entries…"
+msgstr "Checking for similar entries…"
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Checking for similar entries…"
+#. Status line in the New Word dialog while searching for possible duplicate words
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Checking for similar words…"
+msgstr "Checking for similar words…"
+
@@ -407,0 +465,1 @@
+#: src/lib/entry-editor/DuplicateSummaryPill.svelte
@@ -1073,0 +1132,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Go to word"
+#. Tooltip on a possible-duplicate result in the New Entry dialog; clicking closes the dialog and opens that entry
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Go to entry"
+msgstr "Go to entry"
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Go to entry"
+#. Tooltip on a possible-duplicate result in the New Word dialog; clicking closes the dialog and opens that word
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Go to word"
+msgstr "Go to word"
+
```

### fragment 3

other · +21 -0

```diff
@@ -1265,0 +1338,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "No similar entries found"
+#. Reassuring status line in the New Word dialog: the duplicate check found no existing words like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Looks like a new word"
+msgstr "Looks like a new word"
+
@@ -1310,0 +1390,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Sense added to \"{0}\""
+#. Success notification after adding the typed meaning to an existing word; {0} is that word's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Meaning added to \"{0}\""
+msgstr "Meaning added to \"{0}\""
+
@@ -1494,0 +1581,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Looks like a new word"
+#. Status line in the New Entry dialog: the duplicate check found no existing entries like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "No similar entries found"
+msgstr "No similar entries found"
+
```

### fragment 4

other · +30 -0

```diff
@@ -1784,0 +1878,22 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Same word"
+#. Badge on a possible-duplicate result: its headword is identical to the one being typed in the New Entry dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Same headword"
+msgstr "Same headword"
+
+#. Relevant view: Classic
+#. Lite view equivalent: "Same word"
+#. Badge on a possible-duplicate result: only its lexeme form matches the typed text, while its citation form (shown as the headword) differs — deliberately NOT claiming "Same headword"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Same lexeme form"
+msgstr "Same lexeme form"
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Same headword"
+#. Badge on a possible-duplicate result: it is spelled exactly like the word being typed in the New Word dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Same word"
+msgstr "Same word"
+
@@ -1874,0 +1990,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Meaning added to \"{0}\""
+#. Success notification after adding the typed sense to an existing entry; {0} is that entry's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Sense added to \"{0}\""
+msgstr "Sense added to \"{0}\""
+
@@ -1912,0 +2035,1 @@
+#: src/lib/entry-editor/DuplicateCheck.svelte
```

### fragment 5

other · +35 -0

```diff
@@ -1920,0 +2044,35 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Similar words already exist"
+#. Warning banner in the New Entry dialog; expands to a list of possible duplicate entries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar entries already exist"
+msgstr "Similar entries already exist"
+
+#. Relevant view: Classic
+#. Lite view equivalent: "Similar meaning"
+#. Badge on a possible-duplicate result: one of its glosses matches the gloss being typed in the New Entry dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar gloss"
+msgstr "Similar gloss"
+
+#. Relevant view: Classic
+#. Lite view equivalent: "Similar word"
+#. Badge on a possible-duplicate result: its headword partly matches the one being typed in the New Entry dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar headword"
+msgstr "Similar headword"
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar gloss"
+#. Badge on a possible-duplicate result: one of its meanings matches the meaning being typed in the New Word dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar meaning"
+msgstr "Similar meaning"
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar headword"
+#. Badge on a possible-duplicate result: it is spelled almost like the word being typed in the New Word dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar word"
+msgstr "Similar word"
+
```

### fragment 6

other · +21 -0

```diff
@@ -2079,0 +2079,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar entries already exist"
+#. Warning banner in the New Word dialog; expands to a list of possible duplicate words
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar words already exist"
+msgstr "Similar words already exist"
+
@@ -2117,0 +2283,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "This word may already exist"
+#. Warning banner in the New Entry dialog when an entry with the exact same headword exists; expands to a list of possible duplicates
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "This entry may already exist"
+msgstr "This entry may already exist"
+
@@ -2132,0 +2305,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "This entry may already exist"
+#. Warning banner in the New Word dialog when a word with the exact same spelling exists; expands to a list of possible duplicates
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "This word may already exist"
+msgstr "This word may already exist"
+
```

## frontend/viewer/src/lib/entry-editor/duplicate-check.test.ts

### makeEntry

method · +9 -0

```diff
@@ -18,0 +18,9 @@
+function makeEntry(partial: Partial<IEntry>): IEntry {
+  return {
+    id: crypto.randomUUID(),
+    lexemeForm: {},
+    citationForm: {},
+    senses: [],
+    ...partial,
+  } as IEntry;
+}
```

### withGloss

method · +6 -0

```diff
@@ -28,0 +28,6 @@
+function withGloss(lexeme: string, gloss: string): IEntry {
+  return makeEntry({
+    lexemeForm: {seh: lexeme},
+    senses: [{gloss: {en: gloss}} as unknown as IEntry['senses'][number]],
+  });
+}
```

### vernQueries

method · +3 -0

```diff
@@ -35,0 +35,3 @@
+function vernQueries(...texts: string[]): DuplicateQueries {
+  return {vernacular: texts.map(text => ({text, wsId: 'seh'})), analysis: []};
+}
```

## frontend/viewer/tests/new-entry-duplicates.test.ts

### fragment 1

other · +23 -0

```diff
@@ -0,0 +1,14 @@
+import {expect, test, type Locator, type Page} from '@playwright/test';
+import {BrowsePage} from './browse-page';
+
+/**
+ * Tests for the possible-duplicates check in the new entry dialog:
+ * typing an existing word/gloss surfaces similar entries, a brand-new word
+ * gets the "no similar entries" indicator, and a match row expands in place
+ * to offer "Go to entry" / "Add sense".
+ */
+
+// demo data (see demo-entry-data.ts): entry 'baba' exists, glossed 'father'
+const existingLexeme = 'baba';
+const existingGloss = 'father';
+
@@ -21,0 +21,1 @@
+
@@ -25,0 +25,1 @@
+
@@ -29,0 +29,5 @@
+
+const duplicatesSummary = /already exist/i;
+const newWordIndicator = /no similar entries found|looks like a new word/i;
+
+/** The duplicate strip's header — .first() because the jump pill repeats the message when the strip is out of view. */
@@ -37,0 +37,2 @@
+
+/** The visible match rows — each expands in place (aria-expanded) to reveal its actions; the collapsed strip keeps them in the DOM hidden. */
```

### openNewEntryDialog

method · +6 -0

```diff
@@ -15,0 +15,6 @@
+async function openNewEntryDialog(page: Page): Promise<Locator> {
+  await page.getByRole('button', {name: /new (entry|word)/i}).first().click();
+  const dialog = page.getByRole('dialog');
+  await expect(dialog).toBeVisible();
+  return dialog;
+}
```

### lexemeInput

method · +3 -0

```diff
@@ -22,0 +22,3 @@
+function lexemeInput(dialog: Locator): Locator {
+  return dialog.locator('[style*="grid-area: lexemeForm"]').locator('input').first();
+}
```

### glossInput

method · +3 -0

```diff
@@ -26,0 +26,3 @@
+function glossInput(dialog: Locator): Locator {
+  return dialog.locator('[style*="grid-area: gloss"]').locator('input').first();
+}
```

### stripSummary

method · +3 -0

```diff
@@ -34,0 +34,3 @@
+function stripSummary(dialog: Locator): Locator {
+  return dialog.getByText(duplicatesSummary).first();
+}
```

### duplicateRows

method · +3 -0

```diff
@@ -39,0 +39,3 @@
+function duplicateRows(dialog: Locator): Locator {
+  return dialog.locator('li > button[aria-expanded]:visible');
+}
```

### fragment 2

other · +37 -0

```diff
@@ -42,0 +42,37 @@
+
+test.describe('New entry possible duplicates', () => {
+  test('typing an existing word shows duplicates and can navigate to one', async ({page}) => {
+    const browsePage = new BrowsePage(page);
+    await browsePage.goto();
+
+    const dialog = await openNewEntryDialog(page);
+    await lexemeInput(dialog).fill(existingLexeme);
+
+    // exact headword match => attention strip + auto-expanded list
+    await expect(stripSummary(dialog)).toBeVisible();
+    // 'baba' is a substring of 'ubaba', so both rows match — .first() is the exact match because same-word sorts first
+    const duplicateRow = duplicateRows(dialog).filter({hasText: existingLexeme}).first();
+    await duplicateRow.click();
+    await expect(duplicateRow).toHaveAttribute('aria-expanded', 'true');
+
+    await dialog.getByRole('button', {name: /go to (entry|word)/i}).click();
+    await expect(dialog).toBeHidden();
+    await expect(page).toHaveURL(/entryId=/);
+    const openedLexeme = await browsePage.entryView.getLexemeInput();
+    await expect(openedLexeme).toHaveValue(existingLexeme);
+  });
+
+  test('brand-new word shows the new-word indicator', async ({page}) => {
+    const browsePage = new BrowsePage(page);
+    await browsePage.goto();
+
+    const dialog = await openNewEntryDialog(page);
+    await lexemeInput(dialog).fill('zyzzyvazz');
+    await expect(dialog.getByText(newWordIndicator)).toBeVisible();
+    await expect(stripSummary(dialog)).toBeHidden();
+  });
+
+  test('typed meaning can be added to an existing entry instead', async ({page}) => {
+    const browsePage = new BrowsePage(page);
+    await browsePage.goto();
+
```

### fragment 3

other · +38 -0

```diff
@@ -79,0 +79,38 @@
+    const dialog = await openNewEntryDialog(page);
+    await lexemeInput(dialog).fill(existingLexeme);
+    const newGloss = `rescued-${Date.now().toString().slice(-6)}`;
+    await glossInput(dialog).fill(newGloss);
+
+    // exact match auto-expands the list; expand the row to reach its actions
+    const duplicateRow = duplicateRows(dialog).filter({hasText: existingLexeme}).first();
+    await duplicateRow.click();
+    await dialog.getByRole('button', {name: /add (sense|meaning)/i}).click();
+
+    await expect(dialog).toBeHidden();
+    await expect(page).toHaveURL(/entryId=/);
+    const entryId = new URL(page.url()).searchParams.get('entryId');
+    expect(entryId).toBeTruthy();
+    await expect(async () => {
+      expect(await browsePage.api.entryHasGlossValue(entryId!, newGloss)).toBe(true);
+    }).toPass({timeout: 5000});
+  });
+
+  test('partial headword match shows a collapsed strip with a similar-word badge', async ({page}) => {
+    const browsePage = new BrowsePage(page);
+    await browsePage.goto();
+
+    const dialog = await openNewEntryDialog(page);
+    // substring of 'balalika' only — no exact match, so the strip stays collapsed
+    await lexemeInput(dialog).fill('balal');
+
+    const summary = stripSummary(dialog);
+    await expect(summary).toBeVisible();
+    await expect(duplicateRows(dialog)).toHaveCount(0);
+    await summary.click();
+    await expect(dialog.getByText(/similar (headword|word)/i).first()).toBeVisible();
+  });
+
+  test('long match lists collapse behind Show more and a capped count', async ({page}) => {
+    const browsePage = new BrowsePage(page);
+    await browsePage.goto();
+
```

### fragment 4

other · +40 -0

```diff
@@ -117,0 +117,40 @@
+    const dialog = await openNewEntryDialog(page);
+    await lexemeInput(dialog).fill('ba');
+
+    const summary = stripSummary(dialog);
+    await expect(summary).toBeVisible();
+    // dozens of demo lexemes contain 'ba', so the fetch cap is hit and the count renders as 'N+'
+    await expect(dialog.getByText(/^\d+\+$/).first()).toBeVisible();
+
+    const rows = duplicateRows(dialog);
+    if (await rows.count() === 0) await summary.click(); // expands automatically only on an exact match
+    // 3 = the component's initial display count
+    await expect(rows).toHaveCount(3);
+    await dialog.getByRole('button', {name: /show \d+ more/i}).click();
+    expect(await rows.count()).toBeGreaterThan(3);
+  });
+
+  test('matching gloss shows duplicates with a meaning badge', async ({page}) => {
+    const browsePage = new BrowsePage(page);
+    await browsePage.goto();
+
+    const dialog = await openNewEntryDialog(page);
+    await lexemeInput(dialog).fill('zyzzyvazz');
+    await glossInput(dialog).fill(existingGloss);
+
+    const summary = stripSummary(dialog);
+    await expect(summary).toBeVisible();
+    // gloss-only matches don't auto-expand; expand to see the badge
+    await summary.click();
+    await expect(dialog.getByText(/similar (gloss|meaning)/i).first()).toBeVisible();
+  });
+
+  test('an out-of-view duplicate strip surfaces a jump pill', async ({page}) => {
+    // small viewport so the duplicate strip (below the editor grid) starts outside the dialog's scroll view
+    await page.setViewportSize({width: 1024, height: 560});
+    const browsePage = new BrowsePage(page);
+    await browsePage.goto();
+
+    const dialog = await openNewEntryDialog(page);
+    await lexemeInput(dialog).fill(existingLexeme);
+
```

### fragment 5

other · +10 -0

```diff
@@ -157,0 +157,10 @@
+    // the pill's accessible name is exactly the summary message; the strip trigger's name has more text
+    const pill = dialog.getByRole('button', {name: /^this (entry|word) may already exist$/i});
+    await expect(pill).toBeVisible();
+    await pill.click();
+
+    // jumping scrolls the strip into view, which dismisses the pill and shows the match rows
+    await expect(duplicateRows(dialog).first()).toBeInViewport();
+    await expect(pill).toBeHidden();
+  });
+});
```

## frontend/viewer/src/locales/es.po

### fragment 1

other · +36 -0 · low-signal (translations)

```diff
@@ -27,0 +28,1 @@
+#: src/lib/entry-editor/CommentDialog.svelte
@@ -108,0 +110,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "A similar word already exists"
+#. Warning banner in the New Entry dialog when exactly one possible duplicate was found (none an exact headword match)
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "A similar entry already exists"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "A similar entry already exists"
+#. Warning banner in the New Word dialog when exactly one possible duplicate was found (none spelled exactly the same)
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "A similar word already exists"
+msgstr ""
+
@@ -158,0 +174,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense"
+#. Short button label on a possible-duplicate result in the New Word dialog; fuller form: "Add meaning to this word"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning"
+msgstr ""
+
@@ -167,0 +190,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense to this entry"
+#. Button on a possible-duplicate result in the New Word dialog: saves the meaning being typed onto that existing word (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning to this word"
+msgstr ""
+
@@ -179,0 +209,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Add meaning"
+#. Short button label on a possible-duplicate result in the New Entry dialog; fuller form: "Add sense to this entry"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add sense"
+msgstr ""
+
```

### fragment 2

other · +36 -0 · low-signal (translations)

```diff
@@ -187,0 +224,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Add meaning to this word"
+#. Button on a possible-duplicate result in the New Entry dialog: saves the sense being typed onto that existing entry (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add sense to this entry"
+msgstr ""
+
@@ -376,0 +420,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Checking for similar words…"
+#. Status line in the New Entry dialog while searching for possible duplicate entries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Checking for similar entries…"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Checking for similar entries…"
+#. Status line in the New Word dialog while searching for possible duplicate words
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Checking for similar words…"
+msgstr ""
+
@@ -412,0 +470,1 @@
+#: src/lib/entry-editor/DuplicateSummaryPill.svelte
@@ -1078,0 +1137,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Go to word"
+#. Tooltip on a possible-duplicate result in the New Entry dialog; clicking closes the dialog and opens that entry
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Go to entry"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Go to entry"
+#. Tooltip on a possible-duplicate result in the New Word dialog; clicking closes the dialog and opens that word
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Go to word"
+msgstr ""
+
```

### fragment 3

other · +21 -0 · low-signal (translations)

```diff
@@ -1270,0 +1343,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "No similar entries found"
+#. Reassuring status line in the New Word dialog: the duplicate check found no existing words like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Looks like a new word"
+msgstr ""
+
@@ -1315,0 +1395,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Sense added to \"{0}\""
+#. Success notification after adding the typed meaning to an existing word; {0} is that word's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Meaning added to \"{0}\""
+msgstr ""
+
@@ -1499,0 +1586,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Looks like a new word"
+#. Status line in the New Entry dialog: the duplicate check found no existing entries like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "No similar entries found"
+msgstr ""
+
```

### fragment 4

other · +30 -0 · low-signal (translations)

```diff
@@ -1789,0 +1883,22 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Same word"
+#. Badge on a possible-duplicate result: its headword is identical to the one being typed in the New Entry dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Same headword"
+msgstr ""
+
+#. Relevant view: Classic
+#. Lite view equivalent: "Same word"
+#. Badge on a possible-duplicate result: only its lexeme form matches the typed text, while its citation form (shown as the headword) differs — deliberately NOT claiming "Same headword"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Same lexeme form"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Same headword"
+#. Badge on a possible-duplicate result: it is spelled exactly like the word being typed in the New Word dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Same word"
+msgstr ""
+
@@ -1879,0 +1995,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Meaning added to \"{0}\""
+#. Success notification after adding the typed sense to an existing entry; {0} is that entry's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Sense added to \"{0}\""
+msgstr ""
+
@@ -1917,0 +2040,1 @@
+#: src/lib/entry-editor/DuplicateCheck.svelte
```

### fragment 5

other · +35 -0 · low-signal (translations)

```diff
@@ -1925,0 +2049,35 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Similar words already exist"
+#. Warning banner in the New Entry dialog; expands to a list of possible duplicate entries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar entries already exist"
+msgstr ""
+
+#. Relevant view: Classic
+#. Lite view equivalent: "Similar meaning"
+#. Badge on a possible-duplicate result: one of its glosses matches the gloss being typed in the New Entry dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar gloss"
+msgstr ""
+
+#. Relevant view: Classic
+#. Lite view equivalent: "Similar word"
+#. Badge on a possible-duplicate result: its headword partly matches the one being typed in the New Entry dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar headword"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar gloss"
+#. Badge on a possible-duplicate result: one of its meanings matches the meaning being typed in the New Word dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar meaning"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar headword"
+#. Badge on a possible-duplicate result: it is spelled almost like the word being typed in the New Word dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar word"
+msgstr ""
+
```

### fragment 6

other · +21 -0 · low-signal (translations)

```diff
@@ -2084,0 +2084,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar entries already exist"
+#. Warning banner in the New Word dialog; expands to a list of possible duplicate words
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar words already exist"
+msgstr ""
+
@@ -2122,0 +2288,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "This word may already exist"
+#. Warning banner in the New Entry dialog when an entry with the exact same headword exists; expands to a list of possible duplicates
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "This entry may already exist"
+msgstr ""
+
@@ -2137,0 +2310,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "This entry may already exist"
+#. Warning banner in the New Word dialog when a word with the exact same spelling exists; expands to a list of possible duplicates
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "This word may already exist"
+msgstr ""
+
```

## frontend/viewer/src/locales/fr.po

### fragment 1

other · +36 -0 · low-signal (translations)

```diff
@@ -27,0 +28,1 @@
+#: src/lib/entry-editor/CommentDialog.svelte
@@ -108,0 +110,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "A similar word already exists"
+#. Warning banner in the New Entry dialog when exactly one possible duplicate was found (none an exact headword match)
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "A similar entry already exists"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "A similar entry already exists"
+#. Warning banner in the New Word dialog when exactly one possible duplicate was found (none spelled exactly the same)
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "A similar word already exists"
+msgstr ""
+
@@ -158,0 +174,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense"
+#. Short button label on a possible-duplicate result in the New Word dialog; fuller form: "Add meaning to this word"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning"
+msgstr ""
+
@@ -167,0 +190,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense to this entry"
+#. Button on a possible-duplicate result in the New Word dialog: saves the meaning being typed onto that existing word (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning to this word"
+msgstr ""
+
@@ -179,0 +209,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Add meaning"
+#. Short button label on a possible-duplicate result in the New Entry dialog; fuller form: "Add sense to this entry"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add sense"
+msgstr ""
+
```

### fragment 2

other · +36 -0 · low-signal (translations)

```diff
@@ -187,0 +224,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Add meaning to this word"
+#. Button on a possible-duplicate result in the New Entry dialog: saves the sense being typed onto that existing entry (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add sense to this entry"
+msgstr ""
+
@@ -376,0 +420,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Checking for similar words…"
+#. Status line in the New Entry dialog while searching for possible duplicate entries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Checking for similar entries…"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Checking for similar entries…"
+#. Status line in the New Word dialog while searching for possible duplicate words
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Checking for similar words…"
+msgstr ""
+
@@ -412,0 +470,1 @@
+#: src/lib/entry-editor/DuplicateSummaryPill.svelte
@@ -1078,0 +1137,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Go to word"
+#. Tooltip on a possible-duplicate result in the New Entry dialog; clicking closes the dialog and opens that entry
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Go to entry"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Go to entry"
+#. Tooltip on a possible-duplicate result in the New Word dialog; clicking closes the dialog and opens that word
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Go to word"
+msgstr ""
+
```

### fragment 3

other · +21 -0 · low-signal (translations)

```diff
@@ -1270,0 +1343,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "No similar entries found"
+#. Reassuring status line in the New Word dialog: the duplicate check found no existing words like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Looks like a new word"
+msgstr ""
+
@@ -1315,0 +1395,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Sense added to \"{0}\""
+#. Success notification after adding the typed meaning to an existing word; {0} is that word's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Meaning added to \"{0}\""
+msgstr ""
+
@@ -1499,0 +1586,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Looks like a new word"
+#. Status line in the New Entry dialog: the duplicate check found no existing entries like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "No similar entries found"
+msgstr ""
+
```

### fragment 4

other · +30 -0 · low-signal (translations)

```diff
@@ -1789,0 +1883,22 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Same word"
+#. Badge on a possible-duplicate result: its headword is identical to the one being typed in the New Entry dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Same headword"
+msgstr ""
+
+#. Relevant view: Classic
+#. Lite view equivalent: "Same word"
+#. Badge on a possible-duplicate result: only its lexeme form matches the typed text, while its citation form (shown as the headword) differs — deliberately NOT claiming "Same headword"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Same lexeme form"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Same headword"
+#. Badge on a possible-duplicate result: it is spelled exactly like the word being typed in the New Word dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Same word"
+msgstr ""
+
@@ -1879,0 +1995,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Meaning added to \"{0}\""
+#. Success notification after adding the typed sense to an existing entry; {0} is that entry's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Sense added to \"{0}\""
+msgstr ""
+
@@ -1917,0 +2040,1 @@
+#: src/lib/entry-editor/DuplicateCheck.svelte
```

### fragment 5

other · +35 -0 · low-signal (translations)

```diff
@@ -1925,0 +2049,35 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Similar words already exist"
+#. Warning banner in the New Entry dialog; expands to a list of possible duplicate entries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar entries already exist"
+msgstr ""
+
+#. Relevant view: Classic
+#. Lite view equivalent: "Similar meaning"
+#. Badge on a possible-duplicate result: one of its glosses matches the gloss being typed in the New Entry dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar gloss"
+msgstr ""
+
+#. Relevant view: Classic
+#. Lite view equivalent: "Similar word"
+#. Badge on a possible-duplicate result: its headword partly matches the one being typed in the New Entry dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar headword"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar gloss"
+#. Badge on a possible-duplicate result: one of its meanings matches the meaning being typed in the New Word dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar meaning"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar headword"
+#. Badge on a possible-duplicate result: it is spelled almost like the word being typed in the New Word dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar word"
+msgstr ""
+
```

### fragment 6

other · +21 -0 · low-signal (translations)

```diff
@@ -2084,0 +2084,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar entries already exist"
+#. Warning banner in the New Word dialog; expands to a list of possible duplicate words
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar words already exist"
+msgstr ""
+
@@ -2122,0 +2288,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "This word may already exist"
+#. Warning banner in the New Entry dialog when an entry with the exact same headword exists; expands to a list of possible duplicates
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "This entry may already exist"
+msgstr ""
+
@@ -2137,0 +2310,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "This entry may already exist"
+#. Warning banner in the New Word dialog when a word with the exact same spelling exists; expands to a list of possible duplicates
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "This word may already exist"
+msgstr ""
+
```

## frontend/viewer/src/locales/id.po

### fragment 1

other · +36 -0 · low-signal (translations)

```diff
@@ -27,0 +28,1 @@
+#: src/lib/entry-editor/CommentDialog.svelte
@@ -108,0 +110,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "A similar word already exists"
+#. Warning banner in the New Entry dialog when exactly one possible duplicate was found (none an exact headword match)
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "A similar entry already exists"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "A similar entry already exists"
+#. Warning banner in the New Word dialog when exactly one possible duplicate was found (none spelled exactly the same)
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "A similar word already exists"
+msgstr ""
+
@@ -158,0 +174,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense"
+#. Short button label on a possible-duplicate result in the New Word dialog; fuller form: "Add meaning to this word"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning"
+msgstr ""
+
@@ -167,0 +190,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense to this entry"
+#. Button on a possible-duplicate result in the New Word dialog: saves the meaning being typed onto that existing word (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning to this word"
+msgstr ""
+
@@ -179,0 +209,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Add meaning"
+#. Short button label on a possible-duplicate result in the New Entry dialog; fuller form: "Add sense to this entry"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add sense"
+msgstr ""
+
```

### fragment 2

other · +36 -0 · low-signal (translations)

```diff
@@ -187,0 +224,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Add meaning to this word"
+#. Button on a possible-duplicate result in the New Entry dialog: saves the sense being typed onto that existing entry (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add sense to this entry"
+msgstr ""
+
@@ -376,0 +420,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Checking for similar words…"
+#. Status line in the New Entry dialog while searching for possible duplicate entries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Checking for similar entries…"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Checking for similar entries…"
+#. Status line in the New Word dialog while searching for possible duplicate words
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Checking for similar words…"
+msgstr ""
+
@@ -412,0 +470,1 @@
+#: src/lib/entry-editor/DuplicateSummaryPill.svelte
@@ -1078,0 +1137,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Go to word"
+#. Tooltip on a possible-duplicate result in the New Entry dialog; clicking closes the dialog and opens that entry
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Go to entry"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Go to entry"
+#. Tooltip on a possible-duplicate result in the New Word dialog; clicking closes the dialog and opens that word
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Go to word"
+msgstr ""
+
```

### fragment 3

other · +21 -0 · low-signal (translations)

```diff
@@ -1270,0 +1343,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "No similar entries found"
+#. Reassuring status line in the New Word dialog: the duplicate check found no existing words like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Looks like a new word"
+msgstr ""
+
@@ -1315,0 +1395,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Sense added to \"{0}\""
+#. Success notification after adding the typed meaning to an existing word; {0} is that word's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Meaning added to \"{0}\""
+msgstr ""
+
@@ -1499,0 +1586,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Looks like a new word"
+#. Status line in the New Entry dialog: the duplicate check found no existing entries like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "No similar entries found"
+msgstr ""
+
```

### fragment 4

other · +30 -0 · low-signal (translations)

```diff
@@ -1789,0 +1883,22 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Same word"
+#. Badge on a possible-duplicate result: its headword is identical to the one being typed in the New Entry dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Same headword"
+msgstr ""
+
+#. Relevant view: Classic
+#. Lite view equivalent: "Same word"
+#. Badge on a possible-duplicate result: only its lexeme form matches the typed text, while its citation form (shown as the headword) differs — deliberately NOT claiming "Same headword"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Same lexeme form"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Same headword"
+#. Badge on a possible-duplicate result: it is spelled exactly like the word being typed in the New Word dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Same word"
+msgstr ""
+
@@ -1879,0 +1995,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Meaning added to \"{0}\""
+#. Success notification after adding the typed sense to an existing entry; {0} is that entry's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Sense added to \"{0}\""
+msgstr ""
+
@@ -1917,0 +2040,1 @@
+#: src/lib/entry-editor/DuplicateCheck.svelte
```

### fragment 5

other · +35 -0 · low-signal (translations)

```diff
@@ -1925,0 +2049,35 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Similar words already exist"
+#. Warning banner in the New Entry dialog; expands to a list of possible duplicate entries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar entries already exist"
+msgstr ""
+
+#. Relevant view: Classic
+#. Lite view equivalent: "Similar meaning"
+#. Badge on a possible-duplicate result: one of its glosses matches the gloss being typed in the New Entry dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar gloss"
+msgstr ""
+
+#. Relevant view: Classic
+#. Lite view equivalent: "Similar word"
+#. Badge on a possible-duplicate result: its headword partly matches the one being typed in the New Entry dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar headword"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar gloss"
+#. Badge on a possible-duplicate result: one of its meanings matches the meaning being typed in the New Word dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar meaning"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar headword"
+#. Badge on a possible-duplicate result: it is spelled almost like the word being typed in the New Word dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar word"
+msgstr ""
+
```

### fragment 6

other · +21 -0 · low-signal (translations)

```diff
@@ -2084,0 +2084,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar entries already exist"
+#. Warning banner in the New Word dialog; expands to a list of possible duplicate words
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar words already exist"
+msgstr ""
+
@@ -2122,0 +2288,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "This word may already exist"
+#. Warning banner in the New Entry dialog when an entry with the exact same headword exists; expands to a list of possible duplicates
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "This entry may already exist"
+msgstr ""
+
@@ -2137,0 +2310,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "This entry may already exist"
+#. Warning banner in the New Word dialog when a word with the exact same spelling exists; expands to a list of possible duplicates
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "This word may already exist"
+msgstr ""
+
```

## frontend/viewer/src/locales/ko.po

### fragment 1

other · +36 -0 · low-signal (translations)

```diff
@@ -27,0 +28,1 @@
+#: src/lib/entry-editor/CommentDialog.svelte
@@ -108,0 +110,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "A similar word already exists"
+#. Warning banner in the New Entry dialog when exactly one possible duplicate was found (none an exact headword match)
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "A similar entry already exists"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "A similar entry already exists"
+#. Warning banner in the New Word dialog when exactly one possible duplicate was found (none spelled exactly the same)
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "A similar word already exists"
+msgstr ""
+
@@ -158,0 +174,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense"
+#. Short button label on a possible-duplicate result in the New Word dialog; fuller form: "Add meaning to this word"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning"
+msgstr ""
+
@@ -167,0 +190,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense to this entry"
+#. Button on a possible-duplicate result in the New Word dialog: saves the meaning being typed onto that existing word (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning to this word"
+msgstr ""
+
@@ -179,0 +209,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Add meaning"
+#. Short button label on a possible-duplicate result in the New Entry dialog; fuller form: "Add sense to this entry"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add sense"
+msgstr ""
+
```

### fragment 2

other · +36 -0 · low-signal (translations)

```diff
@@ -187,0 +224,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Add meaning to this word"
+#. Button on a possible-duplicate result in the New Entry dialog: saves the sense being typed onto that existing entry (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add sense to this entry"
+msgstr ""
+
@@ -376,0 +420,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Checking for similar words…"
+#. Status line in the New Entry dialog while searching for possible duplicate entries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Checking for similar entries…"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Checking for similar entries…"
+#. Status line in the New Word dialog while searching for possible duplicate words
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Checking for similar words…"
+msgstr ""
+
@@ -412,0 +470,1 @@
+#: src/lib/entry-editor/DuplicateSummaryPill.svelte
@@ -1078,0 +1137,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Go to word"
+#. Tooltip on a possible-duplicate result in the New Entry dialog; clicking closes the dialog and opens that entry
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Go to entry"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Go to entry"
+#. Tooltip on a possible-duplicate result in the New Word dialog; clicking closes the dialog and opens that word
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Go to word"
+msgstr ""
+
```

### fragment 3

other · +21 -0 · low-signal (translations)

```diff
@@ -1270,0 +1343,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "No similar entries found"
+#. Reassuring status line in the New Word dialog: the duplicate check found no existing words like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Looks like a new word"
+msgstr ""
+
@@ -1315,0 +1395,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Sense added to \"{0}\""
+#. Success notification after adding the typed meaning to an existing word; {0} is that word's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Meaning added to \"{0}\""
+msgstr ""
+
@@ -1499,0 +1586,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Looks like a new word"
+#. Status line in the New Entry dialog: the duplicate check found no existing entries like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "No similar entries found"
+msgstr ""
+
```

### fragment 4

other · +30 -0 · low-signal (translations)

```diff
@@ -1789,0 +1883,22 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Same word"
+#. Badge on a possible-duplicate result: its headword is identical to the one being typed in the New Entry dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Same headword"
+msgstr ""
+
+#. Relevant view: Classic
+#. Lite view equivalent: "Same word"
+#. Badge on a possible-duplicate result: only its lexeme form matches the typed text, while its citation form (shown as the headword) differs — deliberately NOT claiming "Same headword"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Same lexeme form"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Same headword"
+#. Badge on a possible-duplicate result: it is spelled exactly like the word being typed in the New Word dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Same word"
+msgstr ""
+
@@ -1879,0 +1995,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Meaning added to \"{0}\""
+#. Success notification after adding the typed sense to an existing entry; {0} is that entry's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Sense added to \"{0}\""
+msgstr ""
+
@@ -1917,0 +2040,1 @@
+#: src/lib/entry-editor/DuplicateCheck.svelte
```

### fragment 5

other · +35 -0 · low-signal (translations)

```diff
@@ -1925,0 +2049,35 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Similar words already exist"
+#. Warning banner in the New Entry dialog; expands to a list of possible duplicate entries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar entries already exist"
+msgstr ""
+
+#. Relevant view: Classic
+#. Lite view equivalent: "Similar meaning"
+#. Badge on a possible-duplicate result: one of its glosses matches the gloss being typed in the New Entry dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar gloss"
+msgstr ""
+
+#. Relevant view: Classic
+#. Lite view equivalent: "Similar word"
+#. Badge on a possible-duplicate result: its headword partly matches the one being typed in the New Entry dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar headword"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar gloss"
+#. Badge on a possible-duplicate result: one of its meanings matches the meaning being typed in the New Word dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar meaning"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar headword"
+#. Badge on a possible-duplicate result: it is spelled almost like the word being typed in the New Word dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar word"
+msgstr ""
+
```

### fragment 6

other · +21 -0 · low-signal (translations)

```diff
@@ -2084,0 +2084,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar entries already exist"
+#. Warning banner in the New Word dialog; expands to a list of possible duplicate words
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar words already exist"
+msgstr ""
+
@@ -2122,0 +2288,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "This word may already exist"
+#. Warning banner in the New Entry dialog when an entry with the exact same headword exists; expands to a list of possible duplicates
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "This entry may already exist"
+msgstr ""
+
@@ -2137,0 +2310,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "This entry may already exist"
+#. Warning banner in the New Word dialog when a word with the exact same spelling exists; expands to a list of possible duplicates
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "This word may already exist"
+msgstr ""
+
```

## frontend/viewer/src/locales/ms.po

### fragment 1

other · +36 -0 · low-signal (translations)

```diff
@@ -27,0 +28,1 @@
+#: src/lib/entry-editor/CommentDialog.svelte
@@ -108,0 +110,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "A similar word already exists"
+#. Warning banner in the New Entry dialog when exactly one possible duplicate was found (none an exact headword match)
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "A similar entry already exists"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "A similar entry already exists"
+#. Warning banner in the New Word dialog when exactly one possible duplicate was found (none spelled exactly the same)
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "A similar word already exists"
+msgstr ""
+
@@ -158,0 +174,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense"
+#. Short button label on a possible-duplicate result in the New Word dialog; fuller form: "Add meaning to this word"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning"
+msgstr ""
+
@@ -167,0 +190,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense to this entry"
+#. Button on a possible-duplicate result in the New Word dialog: saves the meaning being typed onto that existing word (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning to this word"
+msgstr ""
+
@@ -179,0 +209,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Add meaning"
+#. Short button label on a possible-duplicate result in the New Entry dialog; fuller form: "Add sense to this entry"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add sense"
+msgstr ""
+
```

### fragment 2

other · +36 -0 · low-signal (translations)

```diff
@@ -187,0 +224,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Add meaning to this word"
+#. Button on a possible-duplicate result in the New Entry dialog: saves the sense being typed onto that existing entry (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add sense to this entry"
+msgstr ""
+
@@ -376,0 +420,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Checking for similar words…"
+#. Status line in the New Entry dialog while searching for possible duplicate entries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Checking for similar entries…"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Checking for similar entries…"
+#. Status line in the New Word dialog while searching for possible duplicate words
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Checking for similar words…"
+msgstr ""
+
@@ -412,0 +470,1 @@
+#: src/lib/entry-editor/DuplicateSummaryPill.svelte
@@ -1078,0 +1137,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Go to word"
+#. Tooltip on a possible-duplicate result in the New Entry dialog; clicking closes the dialog and opens that entry
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Go to entry"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Go to entry"
+#. Tooltip on a possible-duplicate result in the New Word dialog; clicking closes the dialog and opens that word
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Go to word"
+msgstr ""
+
```

### fragment 3

other · +21 -0 · low-signal (translations)

```diff
@@ -1270,0 +1343,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "No similar entries found"
+#. Reassuring status line in the New Word dialog: the duplicate check found no existing words like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Looks like a new word"
+msgstr ""
+
@@ -1315,0 +1395,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Sense added to \"{0}\""
+#. Success notification after adding the typed meaning to an existing word; {0} is that word's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Meaning added to \"{0}\""
+msgstr ""
+
@@ -1499,0 +1586,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Looks like a new word"
+#. Status line in the New Entry dialog: the duplicate check found no existing entries like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "No similar entries found"
+msgstr ""
+
```

### fragment 4

other · +30 -0 · low-signal (translations)

```diff
@@ -1789,0 +1883,22 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Same word"
+#. Badge on a possible-duplicate result: its headword is identical to the one being typed in the New Entry dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Same headword"
+msgstr ""
+
+#. Relevant view: Classic
+#. Lite view equivalent: "Same word"
+#. Badge on a possible-duplicate result: only its lexeme form matches the typed text, while its citation form (shown as the headword) differs — deliberately NOT claiming "Same headword"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Same lexeme form"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Same headword"
+#. Badge on a possible-duplicate result: it is spelled exactly like the word being typed in the New Word dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Same word"
+msgstr ""
+
@@ -1879,0 +1995,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Meaning added to \"{0}\""
+#. Success notification after adding the typed sense to an existing entry; {0} is that entry's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Sense added to \"{0}\""
+msgstr ""
+
@@ -1917,0 +2040,1 @@
+#: src/lib/entry-editor/DuplicateCheck.svelte
```

### fragment 5

other · +35 -0 · low-signal (translations)

```diff
@@ -1925,0 +2049,35 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Similar words already exist"
+#. Warning banner in the New Entry dialog; expands to a list of possible duplicate entries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar entries already exist"
+msgstr ""
+
+#. Relevant view: Classic
+#. Lite view equivalent: "Similar meaning"
+#. Badge on a possible-duplicate result: one of its glosses matches the gloss being typed in the New Entry dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar gloss"
+msgstr ""
+
+#. Relevant view: Classic
+#. Lite view equivalent: "Similar word"
+#. Badge on a possible-duplicate result: its headword partly matches the one being typed in the New Entry dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar headword"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar gloss"
+#. Badge on a possible-duplicate result: one of its meanings matches the meaning being typed in the New Word dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar meaning"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar headword"
+#. Badge on a possible-duplicate result: it is spelled almost like the word being typed in the New Word dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar word"
+msgstr ""
+
```

### fragment 6

other · +21 -0 · low-signal (translations)

```diff
@@ -2084,0 +2084,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar entries already exist"
+#. Warning banner in the New Word dialog; expands to a list of possible duplicate words
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar words already exist"
+msgstr ""
+
@@ -2122,0 +2288,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "This word may already exist"
+#. Warning banner in the New Entry dialog when an entry with the exact same headword exists; expands to a list of possible duplicates
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "This entry may already exist"
+msgstr ""
+
@@ -2137,0 +2310,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "This entry may already exist"
+#. Warning banner in the New Word dialog when a word with the exact same spelling exists; expands to a list of possible duplicates
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "This word may already exist"
+msgstr ""
+
```

## frontend/viewer/src/locales/sw.po

### fragment 1

other · +36 -0 · low-signal (translations)

```diff
@@ -27,0 +28,1 @@
+#: src/lib/entry-editor/CommentDialog.svelte
@@ -108,0 +110,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "A similar word already exists"
+#. Warning banner in the New Entry dialog when exactly one possible duplicate was found (none an exact headword match)
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "A similar entry already exists"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "A similar entry already exists"
+#. Warning banner in the New Word dialog when exactly one possible duplicate was found (none spelled exactly the same)
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "A similar word already exists"
+msgstr ""
+
@@ -158,0 +174,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense"
+#. Short button label on a possible-duplicate result in the New Word dialog; fuller form: "Add meaning to this word"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning"
+msgstr ""
+
@@ -167,0 +190,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense to this entry"
+#. Button on a possible-duplicate result in the New Word dialog: saves the meaning being typed onto that existing word (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning to this word"
+msgstr ""
+
@@ -179,0 +209,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Add meaning"
+#. Short button label on a possible-duplicate result in the New Entry dialog; fuller form: "Add sense to this entry"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add sense"
+msgstr ""
+
```

### fragment 2

other · +36 -0 · low-signal (translations)

```diff
@@ -187,0 +224,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Add meaning to this word"
+#. Button on a possible-duplicate result in the New Entry dialog: saves the sense being typed onto that existing entry (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add sense to this entry"
+msgstr ""
+
@@ -376,0 +420,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Checking for similar words…"
+#. Status line in the New Entry dialog while searching for possible duplicate entries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Checking for similar entries…"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Checking for similar entries…"
+#. Status line in the New Word dialog while searching for possible duplicate words
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Checking for similar words…"
+msgstr ""
+
@@ -412,0 +470,1 @@
+#: src/lib/entry-editor/DuplicateSummaryPill.svelte
@@ -1078,0 +1137,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Go to word"
+#. Tooltip on a possible-duplicate result in the New Entry dialog; clicking closes the dialog and opens that entry
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Go to entry"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Go to entry"
+#. Tooltip on a possible-duplicate result in the New Word dialog; clicking closes the dialog and opens that word
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Go to word"
+msgstr ""
+
```

### fragment 3

other · +21 -0 · low-signal (translations)

```diff
@@ -1270,0 +1343,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "No similar entries found"
+#. Reassuring status line in the New Word dialog: the duplicate check found no existing words like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Looks like a new word"
+msgstr ""
+
@@ -1315,0 +1395,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Sense added to \"{0}\""
+#. Success notification after adding the typed meaning to an existing word; {0} is that word's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Meaning added to \"{0}\""
+msgstr ""
+
@@ -1499,0 +1586,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Looks like a new word"
+#. Status line in the New Entry dialog: the duplicate check found no existing entries like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "No similar entries found"
+msgstr ""
+
```

### fragment 4

other · +30 -0 · low-signal (translations)

```diff
@@ -1789,0 +1883,22 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Same word"
+#. Badge on a possible-duplicate result: its headword is identical to the one being typed in the New Entry dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Same headword"
+msgstr ""
+
+#. Relevant view: Classic
+#. Lite view equivalent: "Same word"
+#. Badge on a possible-duplicate result: only its lexeme form matches the typed text, while its citation form (shown as the headword) differs — deliberately NOT claiming "Same headword"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Same lexeme form"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Same headword"
+#. Badge on a possible-duplicate result: it is spelled exactly like the word being typed in the New Word dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Same word"
+msgstr ""
+
@@ -1879,0 +1995,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Meaning added to \"{0}\""
+#. Success notification after adding the typed sense to an existing entry; {0} is that entry's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Sense added to \"{0}\""
+msgstr ""
+
@@ -1917,0 +2040,1 @@
+#: src/lib/entry-editor/DuplicateCheck.svelte
```

### fragment 5

other · +35 -0 · low-signal (translations)

```diff
@@ -1925,0 +2049,35 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Similar words already exist"
+#. Warning banner in the New Entry dialog; expands to a list of possible duplicate entries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar entries already exist"
+msgstr ""
+
+#. Relevant view: Classic
+#. Lite view equivalent: "Similar meaning"
+#. Badge on a possible-duplicate result: one of its glosses matches the gloss being typed in the New Entry dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar gloss"
+msgstr ""
+
+#. Relevant view: Classic
+#. Lite view equivalent: "Similar word"
+#. Badge on a possible-duplicate result: its headword partly matches the one being typed in the New Entry dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar headword"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar gloss"
+#. Badge on a possible-duplicate result: one of its meanings matches the meaning being typed in the New Word dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar meaning"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar headword"
+#. Badge on a possible-duplicate result: it is spelled almost like the word being typed in the New Word dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar word"
+msgstr ""
+
```

### fragment 6

other · +21 -0 · low-signal (translations)

```diff
@@ -2084,0 +2084,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar entries already exist"
+#. Warning banner in the New Word dialog; expands to a list of possible duplicate words
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar words already exist"
+msgstr ""
+
@@ -2122,0 +2288,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "This word may already exist"
+#. Warning banner in the New Entry dialog when an entry with the exact same headword exists; expands to a list of possible duplicates
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "This entry may already exist"
+msgstr ""
+
@@ -2137,0 +2310,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "This entry may already exist"
+#. Warning banner in the New Word dialog when a word with the exact same spelling exists; expands to a list of possible duplicates
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "This word may already exist"
+msgstr ""
+
```

## frontend/viewer/src/locales/vi.po

### fragment 1

other · +36 -0 · low-signal (translations)

```diff
@@ -27,0 +28,1 @@
+#: src/lib/entry-editor/CommentDialog.svelte
@@ -108,0 +110,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "A similar word already exists"
+#. Warning banner in the New Entry dialog when exactly one possible duplicate was found (none an exact headword match)
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "A similar entry already exists"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "A similar entry already exists"
+#. Warning banner in the New Word dialog when exactly one possible duplicate was found (none spelled exactly the same)
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "A similar word already exists"
+msgstr ""
+
@@ -158,0 +174,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense"
+#. Short button label on a possible-duplicate result in the New Word dialog; fuller form: "Add meaning to this word"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning"
+msgstr ""
+
@@ -167,0 +190,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense to this entry"
+#. Button on a possible-duplicate result in the New Word dialog: saves the meaning being typed onto that existing word (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning to this word"
+msgstr ""
+
@@ -179,0 +209,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Add meaning"
+#. Short button label on a possible-duplicate result in the New Entry dialog; fuller form: "Add sense to this entry"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add sense"
+msgstr ""
+
```

### fragment 2

other · +36 -0 · low-signal (translations)

```diff
@@ -187,0 +224,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Add meaning to this word"
+#. Button on a possible-duplicate result in the New Entry dialog: saves the sense being typed onto that existing entry (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add sense to this entry"
+msgstr ""
+
@@ -376,0 +420,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Checking for similar words…"
+#. Status line in the New Entry dialog while searching for possible duplicate entries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Checking for similar entries…"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Checking for similar entries…"
+#. Status line in the New Word dialog while searching for possible duplicate words
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Checking for similar words…"
+msgstr ""
+
@@ -412,0 +470,1 @@
+#: src/lib/entry-editor/DuplicateSummaryPill.svelte
@@ -1078,0 +1137,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Go to word"
+#. Tooltip on a possible-duplicate result in the New Entry dialog; clicking closes the dialog and opens that entry
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Go to entry"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Go to entry"
+#. Tooltip on a possible-duplicate result in the New Word dialog; clicking closes the dialog and opens that word
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Go to word"
+msgstr ""
+
```

### fragment 3

other · +21 -0 · low-signal (translations)

```diff
@@ -1270,0 +1343,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "No similar entries found"
+#. Reassuring status line in the New Word dialog: the duplicate check found no existing words like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Looks like a new word"
+msgstr ""
+
@@ -1315,0 +1395,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Sense added to \"{0}\""
+#. Success notification after adding the typed meaning to an existing word; {0} is that word's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Meaning added to \"{0}\""
+msgstr ""
+
@@ -1499,0 +1586,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Looks like a new word"
+#. Status line in the New Entry dialog: the duplicate check found no existing entries like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "No similar entries found"
+msgstr ""
+
```

### fragment 4

other · +30 -0 · low-signal (translations)

```diff
@@ -1789,0 +1883,22 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Same word"
+#. Badge on a possible-duplicate result: its headword is identical to the one being typed in the New Entry dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Same headword"
+msgstr ""
+
+#. Relevant view: Classic
+#. Lite view equivalent: "Same word"
+#. Badge on a possible-duplicate result: only its lexeme form matches the typed text, while its citation form (shown as the headword) differs — deliberately NOT claiming "Same headword"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Same lexeme form"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Same headword"
+#. Badge on a possible-duplicate result: it is spelled exactly like the word being typed in the New Word dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Same word"
+msgstr ""
+
@@ -1879,0 +1995,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Meaning added to \"{0}\""
+#. Success notification after adding the typed sense to an existing entry; {0} is that entry's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Sense added to \"{0}\""
+msgstr ""
+
@@ -1917,0 +2040,1 @@
+#: src/lib/entry-editor/DuplicateCheck.svelte
```

### fragment 5

other · +35 -0 · low-signal (translations)

```diff
@@ -1925,0 +2049,35 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Similar words already exist"
+#. Warning banner in the New Entry dialog; expands to a list of possible duplicate entries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar entries already exist"
+msgstr ""
+
+#. Relevant view: Classic
+#. Lite view equivalent: "Similar meaning"
+#. Badge on a possible-duplicate result: one of its glosses matches the gloss being typed in the New Entry dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar gloss"
+msgstr ""
+
+#. Relevant view: Classic
+#. Lite view equivalent: "Similar word"
+#. Badge on a possible-duplicate result: its headword partly matches the one being typed in the New Entry dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar headword"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar gloss"
+#. Badge on a possible-duplicate result: one of its meanings matches the meaning being typed in the New Word dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar meaning"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar headword"
+#. Badge on a possible-duplicate result: it is spelled almost like the word being typed in the New Word dialog
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar word"
+msgstr ""
+
```

### fragment 6

other · +21 -0 · low-signal (translations)

```diff
@@ -2084,0 +2084,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar entries already exist"
+#. Warning banner in the New Word dialog; expands to a list of possible duplicate words
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar words already exist"
+msgstr ""
+
@@ -2122,0 +2288,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "This word may already exist"
+#. Warning banner in the New Entry dialog when an entry with the exact same headword exists; expands to a list of possible duplicates
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "This entry may already exist"
+msgstr ""
+
@@ -2137,0 +2310,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "This entry may already exist"
+#. Warning banner in the New Word dialog when a word with the exact same spelling exists; expands to a list of possible duplicates
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "This word may already exist"
+msgstr ""
+
```
