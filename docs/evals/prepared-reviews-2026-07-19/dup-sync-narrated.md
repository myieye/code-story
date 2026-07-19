# Code story — 5f21a55d6011..e5b1028d72b1

123 chunks · 16 sections · head e5b1028d

## frontend/viewer/src/lib/components/dictionary/DictionaryEntry.svelte

> AI: Adds an `inline` prop to DictionaryEntry so senses can flow on one line for compact previews. Look at how the per-sense break is swapped for a space.

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

## frontend/viewer/src/lib/entry-editor/duplicate-check.ts

### fragment 1

other · +34 -0

```diff
@@ -0,0 +1,20 @@
+import type {IEntry, ISense} from '$lib/dotnet-types';
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
+ * Which field an exact match hit: 'headword' when the value matched the displayed headword
+ * (citation form, or a morph-token-decorated lexeme), 'lexeme' when it matched only the bare
+ * lexeme form while the headword differs. Same severity either way; it only exists so the badge
+ * doesn't claim "Same headword" for a lexeme-only match.
+ */
+export type SameWordField = 'headword' | 'lexeme';
+
@@ -26,0 +26,1 @@
+
@@ -37,0 +37,1 @@
+
@@ -44,0 +44,1 @@
+
@@ -50,0 +50,2 @@
+
+/** Hosts submit on Enter; interacting with duplicate UI must never also create the entry. */
@@ -55,0 +55,9 @@
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

other · +10 -0

```diff
@@ -27,0 +27,10 @@
+export interface VernacularQuery {
+  /** Diacritic-stripped, case-folded form sent to the backend search and used for the fuzzy
+   *  (accent-insensitive) similar-word match. The backend only matches accent-insensitively when
+   *  the query has no diacritics (MiniLcm StringExtensions.ContainsDiacriticMatch). */
+  text: string;
+  /** Case-folded form with diacritics kept, used to decide the exact same-word match. */
+  exact: string;
+  /** The writing system the text was typed in — used to rank that WS's headword matches first */
+  wsId: string;
+}
```

### DuplicateQueries

other · +6 -0

```diff
@@ -38,0 +38,6 @@
+export interface DuplicateQueries {
+  /** Texts the user typed into vernacular fields (lexeme form, citation form) */
+  vernacular: VernacularQuery[];
+  /** Texts the user typed into gloss fields */
+  analysis: string[];
+}
```

### duplicateTintClass

method · +5 -0

```diff
@@ -45,0 +45,5 @@
+export function duplicateTintClass(hasExactWordMatch: boolean): string {
+  return hasExactWordMatch
+    ? 'border-amber-600/40 bg-amber-500/10 dark:border-amber-400/40'
+    : 'border-border bg-muted/50';
+}
```

### trapEnter

method · +3 -0

```diff
@@ -52,0 +52,3 @@
+export function trapEnter(event: KeyboardEvent): void {
+  if (event.key === 'Enter') event.stopPropagation();
+}
```

### isSimilarWord

method · +4 -0

```diff
@@ -64,0 +64,4 @@
+export function isSimilarWord(a: string, b: string): boolean {
+  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
+  return longer.length - shorter.length <= MAX_SIMILAR_LENGTH_DELTA && longer.includes(shorter);
+}
```

### fragment 2

other · +25 -0

```diff
@@ -68,0 +68,13 @@
+
+const kindRank: Record<DuplicateMatchKind, number> = {
+  'same-word': 0,
+  'similar-word': 1,
+  'same-meaning': 2,
+};
+
+/**
+ * Case-folds invariantly (never by the host locale) and, unless asked to keep them, strips
+ * diacritics. The two modes back the two comparison tiers: keep diacritics to decide an exact
+ * same-word match, drop them for the accent-insensitive similar-word match. Collation-level
+ * equivalences (ß≈ss, ligatures, ICU-ignorable characters like soft hyphens) are not replicated.
+ */
@@ -86,0 +86,1 @@
+
@@ -117,0 +117,2 @@
+
+/** Merges per-query search results into a single relevance-ordered candidate list. */
@@ -127,0 +127,3 @@
+
+/** The slice of WritingSystemService the classifier reads. Structural, so the classifier stays a
+ *  pure function unit-testable without a live project context. */
@@ -136,0 +136,6 @@
+
+/**
+ * Classifies each candidate against the queries, returning matches strongest-first. `candidates`
+ * must be in search-relevance order: that order is kept among equally-strong matches, and similar
+ * words are then ordered closest-in-length first.
+ */
```

### normalizeForCompare

method · +5 -0

```diff
@@ -81,0 +81,5 @@
+export function normalizeForCompare(value: string | undefined, keepDiacritics = false): string {
+  const decomposed = value?.normalize('NFD').toLowerCase().trim() ?? '';
+  if (keepDiacritics) return decomposed;
+  return decomposed.replace(/\p{Mn}/gu, '');
+}
```

### getDuplicateEntryQueries

method · +30 -0

> AI: Builds per-WS vernacular queries and gloss queries, dropping short or fold-collapsed values.

```diff
@@ -87,0 +87,30 @@
+export function getDuplicateEntryQueries(
+  entry: Pick<IEntry, 'lexemeForm' | 'citationForm'>,
+  sense: Pick<ISense, 'gloss'> | undefined,
+  vernacularWsIds: string[],
+  analysisWsIds: string[],
+): DuplicateQueries {
+  const vernacular: VernacularQuery[] = [];
+  for (const wsId of vernacularWsIds) {
+    // The same text typed in two writing systems stays two queries — each is searched sorted by
+    // its own WS so that WS's headword matches rank first. Within a WS, lexeme/citation forms that
+    // fold to the same form (identical, or differing only by case) collapse; accent variants are
+    // kept, so each keeps its own exact same-word match.
+    const seen = new Set<string>();
+    for (const value of [entry.lexemeForm?.[wsId], entry.citationForm?.[wsId]]) {
+      const text = normalizeForCompare(value);
+      const exact = normalizeForCompare(value, true);
+      if (text.length < MIN_QUERY_LENGTH || seen.has(exact)) continue;
+      seen.add(exact);
+      vernacular.push({text, exact, wsId});
+    }
+  }
+
+  const analysis: string[] = [];
+  for (const value of analysisWsIds.map(wsId => sense?.gloss?.[wsId])) {
+    const normalized = normalizeForCompare(value);
+    if (normalized.length < MIN_QUERY_LENGTH) continue;
+    analysis.push(normalized);
+  }
+  return {vernacular, analysis};
+}
```

### mergeSearchResults

method · +8 -0

```diff
@@ -119,0 +119,8 @@
+export function mergeSearchResults(results: IEntry[][]): IEntry[] {
+  const seen = new Set<string>();
+  return results.flat().filter(entry => {
+    if (seen.has(entry.id)) return false;
+    seen.add(entry.id);
+    return true;
+  });
+}
```

### DuplicateWritingSystems

other · +6 -0

```diff
@@ -130,0 +130,6 @@
+export interface DuplicateWritingSystems {
+  vernacularNoAudio: readonly {wsId: string}[];
+  analysisNoAudio: readonly {wsId: string}[];
+  /** Displayed headword for a writing system: citation form, else the morph-token-decorated lexeme. */
+  headword(entry: IEntry, wsId: string): string | undefined;
+}
```

### classifyQueryResults

method · +25 -0

> AI: Sets up query normalization and inner helpers, then classifies and sorts candidates by kind then length delta.

```diff
@@ -142,0 +142,13 @@
+export function classifyQueryResults(
+  candidates: IEntry[],
+  queries: DuplicateQueries,
+  writingSystems: DuplicateWritingSystems,
+): DuplicateMatch[] {
+  const vernacularWsIds = writingSystems.vernacularNoAudio.map(ws => ws.wsId);
+  const analysisWsIds = writingSystems.analysisNoAudio.map(ws => ws.wsId);
+  const vernQueries = queries.vernacular.map(({exact, text}) => ({
+    exact: normalizeForCompare(exact, true),
+    fuzzy: normalizeForCompare(text),
+  }));
+  const analysisQueries = queries.analysis.map(text => normalizeForCompare(text));
+
@@ -158,0 +158,1 @@
+
@@ -162,0 +162,1 @@
+
@@ -170,0 +170,1 @@
+
@@ -181,0 +181,1 @@
+
@@ -189,0 +189,1 @@
+
@@ -203,0 +203,7 @@
+
+  return candidates
+    .map(entry => ({entry, match: classify(entry)}))
+    .filter((candidate): candidate is {entry: IEntry, match: NonNullable<ReturnType<typeof classify>>} => candidate.match !== undefined)
+    .sort((a, b) => (kindRank[a.match.kind] - kindRank[b.match.kind]) || (a.match.lengthDelta - b.match.lengthDelta))
+    .map(({entry, match}) => ({entry, kind: match.kind, field: match.field}));
+}
```

### classifyQueryResults.vernacularForms

method · +3 -0

```diff
@@ -155,0 +155,3 @@
+  function vernacularForms(pick: (wsId: string) => string | undefined): string[] {
+    return vernacularWsIds.map(pick).filter((form): form is string => !!form);
+  }
```

### classifyQueryResults.matchesExactly

method · +3 -0

```diff
@@ -159,0 +159,3 @@
+  function matchesExactly(forms: string[]): boolean {
+    return vernQueries.some(query => forms.some(form => normalizeForCompare(form, true) === query.exact));
+  }
```

### classifyQueryResults.sameWordField

method · +7 -0

```diff
@@ -163,0 +163,7 @@
+  function sameWordField(headwordForms: string[], lexemeForms: string[]): SameWordField | undefined {
+    if (matchesExactly(headwordForms)) return 'headword';
+    // a bare-lexeme hit is only 'lexeme' when the headword differs; a stem (lexeme IS the
+    // headword) already matched as 'headword' above
+    if (matchesExactly(lexemeForms)) return 'lexeme';
+    return undefined;
+  }
```

### classifyQueryResults.similarWordDelta

method · +10 -0

```diff
@@ -171,0 +171,10 @@
+  function similarWordDelta(forms: string[]): number | undefined {
+    const normalized = forms.map(form => normalizeForCompare(form));
+    let delta = Infinity;
+    for (const query of vernQueries) {
+      for (const form of normalized) {
+        if (isSimilarWord(form, query.fuzzy)) delta = Math.min(delta, Math.abs(form.length - query.fuzzy.length));
+      }
+    }
+    return delta === Infinity ? undefined : delta;
+  }
```

### classifyQueryResults.isSameMeaning

method · +7 -0

```diff
@@ -182,0 +182,7 @@
+  function isSameMeaning(entry: IEntry): boolean {
+    const glosses = (entry.senses ?? [])
+      .flatMap(sense => analysisWsIds.map(wsId => sense.gloss?.[wsId]))
+      .filter((gloss): gloss is string => !!gloss)
+      .map(gloss => normalizeForCompare(gloss));
+    return analysisQueries.some(query => glosses.some(gloss => gloss.includes(query) || query.includes(gloss)));
+  }
```

### classifyQueryResults.classify

method · +13 -0

> AI: Picks the strongest match tier for one entry: same-word, then similar-word, then same-meaning.

```diff
@@ -190,0 +190,13 @@
+  function classify(entry: IEntry): {kind: DuplicateMatchKind, field?: SameWordField, lengthDelta: number} | undefined {
+    const headwordForms = vernacularForms(wsId => writingSystems.headword(entry, wsId));
+    const lexemeForms = vernacularForms(wsId => entry.lexemeForm?.[wsId]);
+
+    const field = sameWordField(headwordForms, lexemeForms);
+    if (field) return {kind: 'same-word', field, lengthDelta: 0};
+
+    const lengthDelta = similarWordDelta([...headwordForms, ...lexemeForms]);
+    if (lengthDelta !== undefined) return {kind: 'similar-word', lengthDelta};
+
+    if (isSameMeaning(entry)) return {kind: 'same-meaning', lengthDelta: 0};
+    return undefined;
+  }
```

## frontend/viewer/src/lib/entry-editor/duplicate-check.test.ts

> AI: New unit tests for the duplicate-check helpers: normalization, Enter trapping, query building, result merging, and match classification. Check that the test setup helpers model the real service.

### fragment 1

other · +26 -0

```diff
@@ -0,0 +1,16 @@
+import {describe, expect, it, vi} from 'vitest';
+import type {IEntry} from '$lib/dotnet-types';
+import {MorphTypeKind} from '$lib/dotnet-types';
+import {
+  classifyQueryResults,
+  getDuplicateEntryQueries,
+  mergeSearchResults,
+  normalizeForCompare,
+  trapEnter,
+  type DuplicateQueries,
+  type DuplicateWritingSystems,
+} from './duplicate-check';
+
+const vernWs = ['seh', 'por'];
+const analysisWs = ['en', 'fr'];
+
@@ -20,0 +20,3 @@
+
+// Stands in for writingSystemService.headword: citation form wins, else a suffix's lexeme shows a
+// leading token (e.g. "-aji"). Passed to exercise the morph-token classification paths.
@@ -30,0 +30,2 @@
+
+// The WritingSystemService slice classifyQueryResults reads; defaults to the undecorated headword.
@@ -39,0 +39,1 @@
+
@@ -49,0 +49,1 @@
+
@@ -56,0 +56,3 @@
+
+// Models a typed vernacular value: `exact` keeps its diacritics, `text` is the stripped form sent
+// to the backend. classifyQueryResults re-normalizes both, so passing the raw text for each is fine.
```

### undecoratedHeadword

method · +3 -0

```diff
@@ -17,0 +17,3 @@
+function undecoratedHeadword(entry: IEntry, wsId: string): string | undefined {
+  return entry.citationForm?.[wsId]?.trim() || entry.lexemeForm?.[wsId]?.trim() || undefined;
+}
```

### decoratedHeadword

method · +7 -0

```diff
@@ -23,0 +23,7 @@
+function decoratedHeadword(entry: IEntry, wsId: string): string | undefined {
+  const citation = entry.citationForm?.[wsId]?.trim();
+  if (citation) return citation;
+  const lexeme = entry.lexemeForm?.[wsId]?.trim();
+  if (!lexeme) return undefined;
+  return entry.morphType === MorphTypeKind.Suffix ? `-${lexeme}` : lexeme;
+}
```

### ws

method · +7 -0

```diff
@@ -32,0 +32,7 @@
+function ws(headword = undecoratedHeadword): DuplicateWritingSystems {
+  return {
+    vernacularNoAudio: vernWs.map(wsId => ({wsId})),
+    analysisNoAudio: analysisWs.map(wsId => ({wsId})),
+    headword,
+  };
+}
```

### makeEntry

method · +9 -0

```diff
@@ -40,0 +40,9 @@
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
@@ -50,0 +50,6 @@
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
@@ -59,0 +59,3 @@
+function vernQueries(...texts: string[]): DuplicateQueries {
+  return {vernacular: texts.map(text => ({text, exact: text, wsId: 'seh'})), analysis: []};
+}
```

### fragment 2

other · +38 -0

```diff
@@ -62,0 +62,38 @@
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
+
+  it('treats a missing value as empty', () => {
+    expect(normalizeForCompare(undefined)).toBe('');
+  });
+});
+
+
+describe('trapEnter', () => {
+  // the host dialog submits on Enter; a leak here silently creates the duplicate being warned about
+  it('stops Enter from reaching the dialog, letting other keys through', () => {
+    const enter = new KeyboardEvent('keydown', {key: 'Enter'});
+    const enterStop = vi.spyOn(enter, 'stopPropagation');
+    trapEnter(enter);
+    expect(enterStop).toHaveBeenCalledOnce();
+
+    const space = new KeyboardEvent('keydown', {key: ' '});
+    const spaceStop = vi.spyOn(space, 'stopPropagation');
+    trapEnter(space);
+    expect(spaceStop).not.toHaveBeenCalled();
+  });
+});
+
```

### fragment 3

other · +36 -0

```diff
@@ -100,0 +100,36 @@
+describe('getDuplicateEntryQueries', () => {
+  it('collects vernacular values tagged with their writing system, and gloss texts', () => {
+    const queries = getDuplicateEntryQueries(
+      {lexemeForm: {seh: 'nyumba', por: 'casa'}, citationForm: {}},
+      {gloss: {en: 'house', fr: ''}},
+      vernWs,
+      analysisWs,
+    );
+    expect(queries.vernacular).toEqual([
+      {text: 'nyumba', exact: 'nyumba', wsId: 'seh'},
+      {text: 'casa', exact: 'casa', wsId: 'por'},
+    ]);
+    expect(queries.analysis).toEqual(['house']);
+  });
+
+  it('skips blank and too-short values', () => {
+    const queries = getDuplicateEntryQueries(
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
+    const queries = getDuplicateEntryQueries(
+      {lexemeForm: {seh: 'ba'}, citationForm: {}},
+      undefined,
+      vernWs,
+      analysisWs,
+    );
+    expect(queries.vernacular).toEqual([{text: 'ba', exact: 'ba', wsId: 'seh'}]);
+  });
+
```

### fragment 4

other · +40 -0

```diff
@@ -136,0 +136,40 @@
+  it('measures the length threshold on the normalized text', () => {
+    // 'e' + combining acute is 2 chars raw but 1 char once marks are stripped
+    const queries = getDuplicateEntryQueries(
+      {lexemeForm: {seh: 'é'}, citationForm: {}},
+      undefined,
+      vernWs,
+      analysisWs,
+    );
+    expect(queries.vernacular).toEqual([]);
+  });
+
+  it('keeps the same text typed in different writing systems as separate queries', () => {
+    // each search is sorted by its own WS so that WS's headword matches rank first
+    const queries = getDuplicateEntryQueries(
+      {lexemeForm: {seh: 'kalata', por: 'kalata'}, citationForm: {}},
+      undefined,
+      vernWs,
+      analysisWs,
+    );
+    expect(queries.vernacular).toEqual([
+      {text: 'kalata', exact: 'kalata', wsId: 'seh'},
+      {text: 'kalata', exact: 'kalata', wsId: 'por'},
+    ]);
+  });
+
+  it('keeps accent variants within a writing system, sharing the stripped query but not the exact form', () => {
+    // lexeme 'café' + citation 'cafe' both search the backend for 'cafe', but each keeps its own
+    // exact form so the classifier can mark whichever one the user typed as the same word
+    const queries = getDuplicateEntryQueries(
+      {lexemeForm: {seh: 'café'}, citationForm: {seh: 'cafe'}},
+      undefined,
+      vernWs,
+      analysisWs,
+    );
+    expect(queries.vernacular).toEqual([
+      {text: 'cafe', exact: 'café'.normalize('NFD'), wsId: 'seh'},
+      {text: 'cafe', exact: 'cafe', wsId: 'seh'},
+    ]);
+  });
+
```

### fragment 5

other · +40 -0

```diff
@@ -176,0 +176,40 @@
+  it('collapses lexeme and citation forms that fold together (identical, or case-only difference)', () => {
+    const identical = getDuplicateEntryQueries(
+      {lexemeForm: {seh: 'nyumba'}, citationForm: {seh: 'nyumba'}},
+      undefined,
+      vernWs,
+      analysisWs,
+    );
+    expect(identical.vernacular).toEqual([{text: 'nyumba', exact: 'nyumba', wsId: 'seh'}]);
+
+    // 'Cafe' and 'cafe' fold to the same form, so they collapse (accent variants would not — see above)
+    const caseOnly = getDuplicateEntryQueries(
+      {lexemeForm: {seh: 'Cafe'}, citationForm: {seh: 'cafe'}},
+      undefined,
+      vernWs,
+      analysisWs,
+    );
+    expect(caseOnly.vernacular).toEqual([{text: 'cafe', exact: 'cafe', wsId: 'seh'}]);
+  });
+
+  it('keeps a gloss query even when the same text was typed as a vernacular value', () => {
+    // loanword case: lexeme 'radio' glossed 'radio' — the gloss query must survive so
+    // same-meaning matches on other entries still classify
+    const queries = getDuplicateEntryQueries(
+      {lexemeForm: {seh: 'radio'}, citationForm: {}},
+      {gloss: {en: 'radio'}},
+      vernWs,
+      analysisWs,
+    );
+    expect(queries.vernacular).toEqual([{text: 'radio', exact: 'radio', wsId: 'seh'}]);
+    expect(queries.analysis).toEqual(['radio']);
+  });
+
+  it('ignores values in writing systems outside the given lists', () => {
+    const queries = getDuplicateEntryQueries(
+      {lexemeForm: {'seh-Zxxx-x-audio': 'clip.wav', seh: 'nyumba'}, citationForm: {}},
+      undefined,
+      vernWs,
+      analysisWs,
+    );
+    expect(queries.vernacular).toEqual([{text: 'nyumba', exact: 'nyumba', wsId: 'seh'}]);
```

### fragment 6

other · +36 -0

```diff
@@ -216,0 +216,36 @@
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
+describe('classifyQueryResults', () => {
+  const queries: DuplicateQueries = {vernacular: [{text: 'nyumba', exact: 'nyumba', wsId: 'seh'}], analysis: ['house']};
+
+  it('classifies exact headword matches as same-word, even via citation form or other ws', () => {
+    // case-only difference still folds to the same word; accent differences are exercised below
+    const byLexeme = makeEntry({lexemeForm: {seh: 'Nyumba'}});
+    const byCitation = makeEntry({citationForm: {por: 'nyumba'}});
+    const result = classifyQueryResults([byLexeme, byCitation], queries, ws());
+    expect(result.map(m => m.kind)).toEqual(['same-word', 'same-word']);
+  });
+
+  it('classifies partial headword overlap (either direction) as similar-word', () => {
+    const superstring = makeEntry({lexemeForm: {seh: 'nyumbazi'}});
+    const substring = makeEntry({lexemeForm: {seh: 'yumba'}});
+    const result = classifyQueryResults([superstring, substring], queries, ws());
+    expect(result.map(m => m.kind)).toEqual(['similar-word', 'similar-word']);
+  });
+
+  it('classifies mid-word containment as similar-word, not just starts-with', () => {
+    // real user story: typing "liman" must surface the existing entry "naliman"
+    const buried = makeEntry({lexemeForm: {seh: 'kumanyumba'}});
+    expect(classifyQueryResults([buried], queries, ws())[0]?.kind).toBe('similar-word');
+  });
+
```

### fragment 7

other · +40 -0

```diff
@@ -252,0 +252,40 @@
+  it('drops containment matches just past the length-delta cap', () => {
+    // real user story: typing "uz" must not surface every word containing it;
+    // 'uzembez' is delta 5 (kept, exactly at the cap) and 'uzembeza' is delta 6 (dropped)
+    const atCap = makeEntry({lexemeForm: {seh: 'uzembez'}});
+    const pastCap = makeEntry({lexemeForm: {seh: 'uzembeza'}});
+    const result = classifyQueryResults([atCap, pastCap], vernQueries('uz'), ws());
+    expect(result).toEqual([{entry: atCap, kind: 'similar-word'}]);
+  });
+
+  it('sorts similar words closest in length first', () => {
+    const far = makeEntry({lexemeForm: {seh: 'kumanyumba'}});
+    const near = makeEntry({lexemeForm: {seh: 'nyumbazi'}});
+    const result = classifyQueryResults([far, near], queries, ws());
+    expect(result.map(m => m.entry.id)).toEqual([near.id, far.id]);
+  });
+
+  it('ranks an entry by its closest form when several forms are similar', () => {
+    // closeViaCitation: lexeme is delta 4 but citation is delta 1 — the citation should rank it
+    const closeViaCitation = makeEntry({lexemeForm: {seh: 'kunyumbaza'}, citationForm: {seh: 'nyumbaz'}});
+    const middling = makeEntry({lexemeForm: {seh: 'nyumbazi'}});
+    const result = classifyQueryResults([middling, closeViaCitation], queries, ws());
+    expect(result.map(m => m.entry.id)).toEqual([closeViaCitation.id, middling.id]);
+  });
+
+  it('matches a typed morph token against the decorated headword: "-aji" is the suffix entry "aji"', () => {
+    const suffixEntry = makeEntry({lexemeForm: {seh: 'aji'}, morphType: MorphTypeKind.Suffix});
+    const result = classifyQueryResults([suffixEntry], vernQueries('-aji'), ws(decoratedHeadword));
+    expect(result[0]).toMatchObject({kind: 'same-word', field: 'headword'});
+  });
+
+  it('matches a typed token against the decorated headword, not against a bare citation form', () => {
+    const byLexeme = makeEntry({lexemeForm: {seh: 'aji'}, morphType: MorphTypeKind.Suffix});
+    // citation forms are never token-decorated, so its headword stays 'aji'
+    const byCitation = makeEntry({citationForm: {seh: 'aji'}, morphType: MorphTypeKind.Suffix});
+    const result = classifyQueryResults([byLexeme, byCitation], vernQueries('-aji'), ws(decoratedHeadword));
+    const kindById = new Map(result.map(m => [m.entry.id, m.kind]));
+    expect(kindById.get(byLexeme.id)).toBe('same-word');
+    // the token can't match the bare citation as the same word; it only lands as a loose similar hit
+    expect(kindById.get(byCitation.id)).toBe('similar-word');
+  });
```

### fragment 8

other · +35 -0

```diff
@@ -292,0 +292,35 @@
+
+  it('matches the bare lexeme of a suffix as a lexeme hit, not a headword hit', () => {
+    // typing 'aji' (no token) against suffix entry '-aji': the lexeme matched, the headword didn't
+    const suffixEntry = makeEntry({lexemeForm: {seh: 'aji'}, morphType: MorphTypeKind.Suffix});
+    const result = classifyQueryResults([suffixEntry], vernQueries('aji'), ws(decoratedHeadword));
+    expect(result[0]).toMatchObject({kind: 'same-word', field: 'lexeme'});
+  });
+
+  it('treats an exact-diacritic match as same-word and an accent-only difference as similar-word', () => {
+    const plain = makeEntry({lexemeForm: {seh: 'cafe'}});
+    const accented = makeEntry({lexemeForm: {seh: 'café'}});
+    // typed 'cafe': 'cafe' is the same word; 'café' matches only once accents are ignored -> similar
+    const typedPlain = new Map(
+      classifyQueryResults([accented, plain], vernQueries('cafe'), ws()).map(m => [m.entry.id, m.kind]));
+    expect(typedPlain.get(plain.id)).toBe('same-word');
+    expect(typedPlain.get(accented.id)).toBe('similar-word');
+    // typed 'café': now the accented entry is the exact match; the plain one is only similar
+    const typedAccented = classifyQueryResults([plain, accented], vernQueries('café'), ws());
+    expect(typedAccented.find(m => m.entry.id === accented.id)).toMatchObject({kind: 'same-word', field: 'headword'});
+    expect(typedAccented.find(m => m.entry.id === plain.id)?.kind).toBe('similar-word');
+  });
+
+  it('attributes a same-word match to the field that hit', () => {
+    // lexeme 'fuz' + citation 'fuza': the headword shown is 'fuza', so a match on the
+    // typed 'fuz' is the same entry but NOT the same headword
+    const viaLexemeOnly = makeEntry({lexemeForm: {seh: 'fuz'}, citationForm: {seh: 'fuza'}});
+    const viaCitation = makeEntry({lexemeForm: {seh: 'fu'}, citationForm: {seh: 'fuz'}});
+    const lexemeIsHeadword = makeEntry({lexemeForm: {seh: 'fuz'}});
+    const result = classifyQueryResults([viaLexemeOnly, viaCitation, lexemeIsHeadword], vernQueries('fuz'), ws());
+    const fieldById = new Map(result.map(m => [m.entry.id, m.field]));
+    expect(fieldById.get(viaLexemeOnly.id)).toBe('lexeme');
+    expect(fieldById.get(viaCitation.id)).toBe('headword');
+    expect(fieldById.get(lexemeIsHeadword.id)).toBe('headword');
+  });
+
```

### fragment 9

other · +33 -0

```diff
@@ -327,0 +327,33 @@
+  it('prefers a citation-form hit over an earlier lexeme-only hit across queries', () => {
+    // one entry, two typed values: 'fuz' hits only the lexeme form, 'fuza' hits the
+    // citation form — the citation hit must win the field attribution
+    const entry = makeEntry({lexemeForm: {seh: 'fuz'}, citationForm: {seh: 'fuza'}});
+    const result = classifyQueryResults([entry], vernQueries('fuz', 'fuza'), ws());
+    expect(result[0]).toEqual({entry, kind: 'same-word', field: 'headword'});
+  });
+
+  it('classifies gloss overlap as same-meaning', () => {
+    const entry = withGloss('cabana', 'house');
+    expect(classifyQueryResults([entry], queries, ws())[0].kind).toBe('same-meaning');
+  });
+
+  it('classifies partial gloss containment in either direction as same-meaning', () => {
+    const glossContainsQuery = withGloss('cabana', 'houseboat');
+    const queryContainsGloss = withGloss('cabana', 'use');
+    const result = classifyQueryResults([glossContainsQuery, queryContainsGloss], queries, ws());
+    expect(result.map(m => m.kind)).toEqual(['same-meaning', 'same-meaning']);
+  });
+
+  it('drops candidates that overlap in neither headword nor gloss', () => {
+    // the full-text search can return an entry via a field we don't classify (e.g. definition);
+    // it should be dropped, not shown as a vague match
+    const entry = withGloss('cabana', 'dwelling');
+    expect(classifyQueryResults([entry], queries, ws())).toEqual([]);
+  });
+
+  it('drops a candidate whose gloss equals a typed vernacular value (cross-field coincidence)', () => {
+    // typing lexeme 'nyumba' must not surface an entry merely because its gloss is 'nyumba'
+    const entry = withGloss('cabana', 'nyumba');
+    expect(classifyQueryResults([entry], vernQueries('nyumba'), ws())).toEqual([]);
+  });
+
```

### fragment 10

other · +16 -0

> AI: Diff omitted here for budget; read the file for these final cases.

```diff
@@ -360,0 +360,16 @@
+  it('sorts word matches above meaning matches, preserving relevance order within a kind', () => {
+    const meaning = withGloss('cabana', 'house');
+    const similarA = makeEntry({lexemeForm: {seh: 'nyumbazi'}});
+    const similarB = makeEntry({lexemeForm: {seh: 'manyumba'}});
+    const exact = makeEntry({lexemeForm: {seh: 'nyumba'}});
+    const result = classifyQueryResults([meaning, similarA, similarB, exact], queries, ws());
+    expect(result.map(m => m.entry.id)).toEqual([exact.id, similarA.id, similarB.id, meaning.id]);
+  });
+
+  it('never reports a headword match when no vernacular text was typed', () => {
+    // gloss-only query: an entry matched purely by headword is a cross-field coincidence and dropped
+    const entry = makeEntry({lexemeForm: {seh: 'nyumba'}});
+    const result = classifyQueryResults([entry], {vernacular: [], analysis: ['house']}, ws());
+    expect(result).toEqual([]);
+  });
+});
```

## frontend/viewer/src/lib/entry-editor/DuplicateCheck.svelte

> AI: New DuplicateCheck widget that searches for similar entries as the user types and shows matches. Look at how it fetches, classifies, and lets users jump to or add a sense to an existing entry.

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

### template

markup-region · +1 -0 · low-signal (whitespace)

```diff
@@ -12,0 +12,1 @@
+
```

### script.fragment 1

other · +24 -0

```diff
@@ -13,0 +13,24 @@
+<script lang="ts">
+  import type {IEntry, ISense} from '$lib/dotnet-types';
+  import {SortField} from '$lib/dotnet-types';
+  import {resource, watch} from 'runed';
+  import {SvelteMap} from 'svelte/reactivity';
+  import {plural, t} from 'svelte-i18n-lingui';
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
+  import {useWritingSystemService} from '$project/data';
+  import {useViewService} from '$lib/views/view-service.svelte';
+  import {pt} from '$lib/views/view-text';
+  import {entryBrowseParams} from '$lib/utils/search-params';
+  import {DEFAULT_DEBOUNCE_TIME} from '$lib/utils/time';
+  import {classifyQueryResults, getDuplicateEntryQueries as buildQueries, duplicateTintClass, mergeSearchResults, trapEnter, type DuplicateMatch, type DuplicateQueries} from './duplicate-check';
+
```

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

### script.fragment 2

other · +22 -0

```diff
@@ -47,0 +47,22 @@
+
+  let {entry, sense, onNavigateToEntry, busy = $bindable(false), summary = $bindable()}: Props = $props();
+
+  const lexboxApi = useLexboxApi();
+  const writingSystemService = useWritingSystemService();
+  const viewService = useViewService();
+  const saveHandler = useSaveHandler();
+  const {base} = useRouter();
+
+  // Over-fetch: the backend is not queryable exactly how we want to use it, so we use the generic/forgiving query api
+  // (which sorts best matches to the front) and then pull out the results that are most appropriate
+  const FETCH_COUNT = 30;
+  const INITIAL_DISPLAY_COUNT = 3;
+
+  const vernacularWsIds = $derived(writingSystemService.vernacularNoAudio.map(ws => ws.wsId));
+  const analysisWsIds = $derived(writingSystemService.analysisNoAudio.map(ws => ws.wsId));
+  const queries = $derived(buildQueries(entry, sense, vernacularWsIds, analysisWsIds));
+  const hasQueries = $derived(queries.vernacular.length + queries.analysis.length > 0);
+
+  // Use a cache as a quick way to prevent ALL redundant queries
+  // (not just the user typing the same thing twice, but also querying vernacular again when only an analysis query changed, etc.)
+  const searchCache = new SvelteMap<string, Promise<IEntry[]>>();
```

### script.search

method · +15 -0

```diff
@@ -69,0 +69,15 @@
+  function search(text: string, writingSystem: string): Promise<IEntry[]> {
+    const key = `${writingSystem}:${text}`;
+    let result = searchCache.get(key);
+    if (!result) {
+      result = lexboxApi.searchEntries(text, {
+        offset: 0,
+        count: FETCH_COUNT,
+        order: {field: SortField.SearchRelevance, writingSystem, ascending: true},
+      });
+      searchCache.set(key, result);
+      // don't cache a failure — a transient error must not poison the query for the dialog's life
+      result.catch(() => searchCache.delete(key));
+    }
+    return result;
+  }
```

### script.fragment 3

other · +40 -0

> AI: Searching runs in the resource; classification is derived separately so it re-runs when headwords load.

```diff
@@ -84,0 +84,40 @@
+
+  const duplicatesResource = resource(
+    () => queries,
+    async (queries, _prev, {signal}): Promise<{candidates: IEntry[], queries: DuplicateQueries, capped: boolean} | undefined> => {
+      // query.text / analysis texts are already diacritic-stripped (see getDuplicateEntryQueries):
+      // the backend only matches accent-insensitively for a diacritic-free query, and stripping
+      // there is what surfaces accent variants for the client to classify. Each query is searched
+      // sorted by the writing system it was typed in, so that WS's headword matches sort first.
+      const searches = [
+        ...queries.vernacular.map(query => ({text: query.text, writingSystem: query.wsId})),
+        ...queries.analysis.map(text => ({text, writingSystem: 'default'})),
+      ];
+      if (!searches.length) return undefined;
+      const results = await Promise.all(searches.map(s => search(s.text, s.writingSystem)));
+      signal.throwIfAborted();
+      return {
+        candidates: mergeSearchResults(results),
+        // the queries these candidates answer — the live `queries` may already be newer
+        queries,
+        capped: results.some(result => result.length >= FETCH_COUNT),
+      };
+    },
+    {debounce: DEFAULT_DEBOUNCE_TIME},
+  );
+
+  // Classification lives outside the resource so it can compare against the displayed headword:
+  // writingSystemService.headword reads the lazy morph-types resource, so once that loads matches
+  // re-classify (with the correct morph tokens) without re-searching.
+  const matches = $derived.by(() => {
+    const result = duplicatesResource.current;
+    if (!result) return undefined;
+    return classifyQueryResults(result.candidates, result.queries, writingSystemService);
+  });
+  const hasExactWordMatch = $derived(!!matches?.some(match => match.kind === 'same-word'));
+  // Matched headwords (strongest first) shown in the collapsed header, truncated by the
+  // trigger's ellipsis, so users can dismiss a wall of loose matches at a glance.
+  const previewHeadwords = $derived([...new Set(
+    (matches ?? []).map(match => writingSystemService.headword(match.entry)).filter(Boolean),
+  )].join(', '));
+  const summaryMessage = $derived.by(() => {
```

### script.fragment 4

other · +40 -0

> AI: Publishes the summary via effect, auto-expands on exact match, and resets state when matches clear.

```diff
@@ -124,0 +124,14 @@
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
@@ -142,0 +142,18 @@
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
@@ -174,0 +174,1 @@
+
@@ -179,0 +179,5 @@
+
+  // Rescues the meaning the user already typed: instead of creating a duplicate entry,
+  // it becomes a new sense of the existing one.
+  const canAddSense = $derived(!!sense && !!writingSystemService.firstDefOrGlossVal(sense));
+
@@ -201,0 +201,2 @@
+
+</script>
```

### script.expand

method · +4 -0

```diff
@@ -138,0 +138,4 @@
+  export function expand(): void {
+    expanded = true;
+    userToggled = true;
+  }
```

### script.kindLabel

method · +14 -0

```diff
@@ -160,0 +160,14 @@
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

### script.openEntry

method · +4 -0

```diff
@@ -175,0 +175,4 @@
+  function openEntry(target: IEntry): void {
+    onNavigateToEntry?.(target);
+    navigate(`${$base.uri}/browse?${entryBrowseParams(target.id)}`);
+  }
```

### script.addSenseToEntry

method · +17 -0

> AI: Creates a new sense on the target entry using a fresh id so the dialog's sense id is never reused.

```diff
@@ -184,0 +184,17 @@
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

### template.fragment 1

markup-region · +40 -0

```diff
@@ -203,0 +203,40 @@
+
+<div class="min-h-9 flex flex-col justify-center w-full" aria-live="polite">
+  {#if !matches?.length}
+    {#if (duplicatesResource.loading && hasQueries) || matches || duplicatesResource.error}
+      <div class="flex items-center gap-2 px-1 text-sm text-muted-foreground" transition:slide={{duration: 150}}>
+        {#if duplicatesResource.loading}
+          <Loading class="size-4" />
+          {pt($t`Checking for similar entries…`, $t`Checking for similar words…`, viewService.currentView)}
+        {:else if duplicatesResource.error}
+          <!-- inline, not AppNotification.error: this search re-fires per typing pause, and a
+            failure toast per pause would bury the dialog; the strip already owns a status line -->
+          <Icon icon="i-mdi-alert-outline" class="size-4" />
+          {pt($t`Could not check for similar entries`, $t`Could not check for similar words`, viewService.currentView)}
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
@@ -243,0 +243,40 @@
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
@@ -283,0 +283,30 @@
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
+                {$plural(remainingEntries, {one: 'Show # more...', other: 'Show # more...'})}
+              </Button>
+            </li>
+          {/if}
+        </ul>
+      </Collapsible.Content>
+    </Collapsible.Root>
+  {/if}
+</div>
```

## frontend/viewer/src/lib/entry-editor/DuplicateSummaryPill.svelte

> AI: New pill component that shows a duplicate-check summary with a jump button and a dismiss button. Check the message, count/capped badge, and the two icon states.

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
@@ -13,0 +13,3 @@
+
+  let {summary, onJump, onDismiss}: Props = $props();
+</script>
```

### script.Props

other · +5 -0

```diff
@@ -8,0 +8,5 @@
+  interface Props {
+    summary: DuplicateSummary;
+    onJump: () => void;
+    onDismiss: () => void;
+  }
```

### template

markup-region · +35 -0

```diff
@@ -16,0 +16,35 @@
+
+<div class="pointer-events-auto max-w-[min(100%,32rem)] rounded-full bg-background shadow-md">
+  <div class="max-w-full flex items-center rounded-full border text-sm {duplicateTintClass(summary.hasExactWordMatch)}">
+    <button
+      type="button"
+      aria-label={summary.message}
+      class="min-w-0 flex items-center gap-2 rounded-s-full ps-3 py-1.5 relative after:absolute after:content-[''] after:-inset-y-2.5 after:-inset-s-2.5 after:inset-e-0"
+      onkeydown={trapEnter}
+      onmousedown={e => e.preventDefault() /* focusing the pill can cancel the scroll it triggers */}
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
+      class="flex items-center rounded-e-full ps-1.5 pe-2.5 py-1.5 self-stretch relative after:absolute after:content-[''] after:-inset-y-2.5 after:inset-s-0 after:-inset-e-2.5"
+      onkeydown={trapEnter}
+      onmousedown={e => e.preventDefault()}
+      onclick={onDismiss}>
+      <Icon icon="i-mdi-close" class="size-4 shrink-0" />
+    </button>
+  </div>
+</div>
```

## frontend/viewer/src/lib/entry-editor/DuplicateCheckSection.svelte

> AI: New component wrapping the duplicate-check widget plus a floating summary pill. Look at the IntersectionObserver logic and the fragment-root/sticky positioning constraints.

### template

markup-region · +3 -0

```diff
@@ -0,0 +1,3 @@
+<!-- Keep this fragment-rooted (no wrapping element): the pill's `sticky bottom-0` is clamped to
+  its parent's box, which must stay the tall dialog-content column. A wrapper here — or around the
+  component at the call site — would collapse its travel room and the pill would stop floating. -->
```

### script

other · +28 -0

> AI: The effect watches the widget's visibility inside the dialog-content box and cleans up the observer.

```diff
@@ -4,0 +4,6 @@
+<script lang="ts">
+  import type {IEntry, ISense} from '$lib/dotnet-types';
+  import {tick} from 'svelte';
+  import DuplicateCheck, {type DuplicateSummary} from './DuplicateCheck.svelte';
+  import DuplicateSummaryPill from './DuplicateSummaryPill.svelte';
+
@@ -18,0 +18,9 @@
+
+  let {entry, sense, onNavigateToEntry, busy = $bindable(false)}: Props = $props();
+
+  let duplicateWidgetEl = $state<HTMLElement>();
+  let duplicateCheck = $state<DuplicateCheck>();
+  let duplicateSummary = $state<DuplicateSummary>();
+
+  // Expand first: the widget sits near the end of the scrollable content, so without the
+  // expanded list below it there isn't enough scroll room to bring its top up the dialog.
@@ -32,0 +32,13 @@
+
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
+</script>
```

### script.Props

other · +8 -0

```diff
@@ -10,0 +10,8 @@
+  interface Props {
+    entry: IEntry;
+    sense?: ISense;
+    /** Called right before navigating to an existing entry, so the host dialog can close itself. */
+    onNavigateToEntry?: (entry: IEntry) => void;
+    /** True while an add-sense save is in flight — the host should block submitting until it settles. */
+    busy?: boolean;
+  }
```

### script.jumpToDuplicates

method · +5 -0

```diff
@@ -27,0 +27,5 @@
+  async function jumpToDuplicates(): Promise<void> {
+    duplicateCheck?.expand();
+    await tick();
+    duplicateWidgetEl?.scrollIntoView({behavior: 'smooth', block: 'start'});
+  }
```

### template

markup-region · +14 -0

> AI: The pill shows only when a summary exists, the widget is off-screen, and it hasn't been dismissed.

```diff
@@ -45,0 +45,14 @@
+
+<div class="mt-3 scroll-mt-2" bind:this={duplicateWidgetEl}>
+  <DuplicateCheck {entry} {sense} bind:this={duplicateCheck} bind:busy bind:summary={duplicateSummary}
+    {onNavigateToEntry} />
+</div>
+{#if duplicateSummary && !duplicateWidgetVisible && !pillDismissed}
+  <div class="sticky bottom-0 z-20 h-0 pointer-events-none">
+    <div class="absolute bottom-3 inset-x-0 flex justify-center">
+      <DuplicateSummaryPill summary={duplicateSummary}
+        onJump={() => jumpToDuplicates()}
+        onDismiss={() => pillDismissed = true} />
+    </div>
+  </div>
+{/if}
```

## frontend/viewer/src/lib/entry-editor/NewEntryDialog.svelte

> AI: Wires a duplicate-check section into the new-entry dialog and guards create against concurrent runs. Look at the reworked createEntry flow and the new busy flag.

### script

other · +2 -0

```diff
@@ -25,0 +26,1 @@
+  import DuplicateCheckSection from './DuplicateCheckSection.svelte';
@@ -33,0 +35,1 @@
+  let duplicateActionBusy = $state(false);
```

### script.createEntry

method · +17 -12

> AI: The commit/validate/save steps move into a try with loading reset in finally; check the early-return guard.

```diff
@@ -61,0 +64,2 @@
+    // we might already be creating something (double-Enter or Add sense)
+    if (loading || duplicateActionBusy) return;
@@ -64,5 +67,0 @@
-    await editor?.commit();
-    await addMainPublicationPromise; // make sure the main publication landed before we snapshot the entry
-    entry.senses = sense ? [sense] : [];
-    if (!validateEntry()) return;
-
@@ -70,7 +69,15 @@
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

### template

markup-region · +10 -3

```diff
@@ -181,1 +188,4 @@
-  <Dialog.DialogContent onkeydown={handleKeydown} class="sm:min-h-[min(calc(100%-16px),30rem)] max-md:px-2">
+  <!-- Fixed width (not min/max): the duplicate check adds and reshapes content while the
+    dialog is open, and a content-sized dialog jumps around with every keystroke -->
+  <Dialog.DialogContent onkeydown={handleKeydown}
+    class="sm:min-h-[min(calc(100%-16px),30rem)] sm:w-[min(calc(100%-32px),50rem)] max-md:px-2">
@@ -185,1 +195,3 @@
-    <div>
+    <!-- min-w-0: as a grid item this div defaults to min-width:auto, letting long duplicate
+      headword lists widen the dialog instead of truncating -->
+    <div class="min-w-0">
@@ -213,0 +226,2 @@
+      <DuplicateCheckSection {entry} {sense} bind:busy={duplicateActionBusy}
+        onNavigateToEntry={() => open = false} />
@@ -224,1 +238,1 @@
-      <Button onclick={e => createEntry(e)} disabled={loading} {loading}>
+      <Button onclick={e => createEntry(e)} disabled={loading || duplicateActionBusy} {loading}>
```

## frontend/viewer/tests/ui/new-entry-duplicates.test.ts

> AI: New Playwright tests for the new-entry dialog's possible-duplicates check. Look at how each test asserts the strip, rows, jump pill, and entry counts.

### fragment 1

other · +23 -0

```diff
@@ -0,0 +1,14 @@
+import {expect, test, type Locator, type Page} from '@playwright/test';
+import {DemoProjectPage} from './demo-project.page';
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

> AI: Covers exact-match navigation, the new-word indicator, and starts the add-to-existing test.

```diff
@@ -42,0 +42,37 @@
+
+test.describe('New entry possible duplicates', () => {
+  test('typing an existing word shows duplicates and can navigate to one', async ({page}) => {
+    const projectPage = new DemoProjectPage(page);
+    await projectPage.goto();
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
+    const openedLexeme = await projectPage.entryView.getLexemeInput();
+    await expect(openedLexeme).toHaveValue(existingLexeme);
+  });
+
+  test('brand-new word shows the new-word indicator', async ({page}) => {
+    const projectPage = new DemoProjectPage(page);
+    await projectPage.goto();
+
+    const dialog = await openNewEntryDialog(page);
+    await lexemeInput(dialog).fill('zyzzyvazz');
+    await expect(dialog.getByText(newWordIndicator)).toBeVisible();
+    await expect(stripSummary(dialog)).toBeHidden();
+  });
+
+  test('typed meaning can be added to an existing entry instead', async ({page}) => {
+    const projectPage = new DemoProjectPage(page);
+    await projectPage.goto();
+
```

### fragment 3

other · +34 -0

> AI: Checks a gloss lands on the existing entry with no new entry created, and Enter only expands the row.

```diff
@@ -79,0 +79,34 @@
+    const entryCountBefore = await projectPage.api.countEntries();
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
+      expect(await projectPage.api.entryHasGlossValue(entryId!, newGloss)).toBe(true);
+    }).toPass({timeout: 5000});
+    // the sense landed on the existing entry INSTEAD of a new one being created
+    expect(await projectPage.api.countEntries()).toBe(entryCountBefore);
+  });
+
+  test('Enter inside the duplicate strip expands the row without creating the entry', async ({page}) => {
+    const projectPage = new DemoProjectPage(page);
+    await projectPage.goto();
+
+    const entryCountBefore = await projectPage.api.countEntries();
+    const dialog = await openNewEntryDialog(page);
+    await lexemeInput(dialog).fill(existingLexeme);
+
+    const duplicateRow = duplicateRows(dialog).filter({hasText: existingLexeme}).first();
+    await duplicateRow.focus();
+    await page.keyboard.press('Enter');
+
```

### fragment 4

other · +34 -0

```diff
@@ -113,0 +113,34 @@
+    // Enter activated the focused row, and was NOT also swallowed by the dialog's
+    // submit-on-Enter handler — which would have created the very duplicate being warned about
+    await expect(duplicateRow).toHaveAttribute('aria-expanded', 'true');
+    await expect(dialog).toBeVisible();
+    expect(await projectPage.api.countEntries()).toBe(entryCountBefore);
+  });
+
+  test('partial headword match shows a collapsed strip with a similar-word badge', async ({page}) => {
+    const projectPage = new DemoProjectPage(page);
+    await projectPage.goto();
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
+    const projectPage = new DemoProjectPage(page);
+    await projectPage.goto();
+
+    const dialog = await openNewEntryDialog(page);
+    await lexemeInput(dialog).fill('ba');
+
+    const summary = stripSummary(dialog);
+    await expect(summary).toBeVisible();
+    // dozens of demo lexemes contain 'ba', so the fetch cap is hit and the count renders as 'N+'
+    await expect(dialog.getByText(/^\d+\+$/).first()).toBeVisible();
+
```

### fragment 5

other · +37 -0

> AI: Show-more expansion, gloss-match badge, and the out-of-view jump pill.

```diff
@@ -147,0 +147,37 @@
+    const rows = duplicateRows(dialog);
+    if (await rows.count() === 0) await summary.click(); // expands automatically only on an exact match
+    // 3 = the component's initial display count
+    await expect(rows).toHaveCount(3);
+    await dialog.getByRole('button', {name: /show \d+ more/i}).click();
+    expect(await rows.count()).toBeGreaterThan(3);
+  });
+
+  test('matching gloss shows duplicates with a meaning badge', async ({page}) => {
+    const projectPage = new DemoProjectPage(page);
+    await projectPage.goto();
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
+    const projectPage = new DemoProjectPage(page);
+    await projectPage.goto();
+
+    const dialog = await openNewEntryDialog(page);
+    await lexemeInput(dialog).fill(existingLexeme);
+
+    // the pill's accessible name is exactly the summary message; the strip trigger's name has more text
+    const pill = dialog.getByRole('button', {name: /^this (entry|word) may already exist$/i});
+    await expect(pill).toBeVisible();
+    await pill.click();
+
```

### fragment 6

other · +26 -0

```diff
@@ -184,0 +184,26 @@
+    // jumping scrolls the strip into view, which dismisses the pill and shows the match rows
+    await expect(duplicateRows(dialog).first()).toBeInViewport();
+    await expect(pill).toBeHidden();
+  });
+
+  test('the jump pill can be dismissed and stays dismissed', async ({page}) => {
+    await page.setViewportSize({width: 1024, height: 560});
+    const projectPage = new DemoProjectPage(page);
+    await projectPage.goto();
+
+    const dialog = await openNewEntryDialog(page);
+    await lexemeInput(dialog).fill(existingLexeme);
+
+    const pill = dialog.getByRole('button', {name: /^this (entry|word) may already exist$/i});
+    await expect(pill).toBeVisible();
+    // the pill's Close is its sibling; dialogs have their own Close button, so scope to the pill's parent
+    await pill.locator('..').getByRole('button', {name: /close/i}).click();
+    await expect(pill).toBeHidden();
+
+    // still dismissed while matches keep changing out of view
+    await lexemeInput(dialog).fill(existingLexeme.slice(0, -1));
+    await lexemeInput(dialog).fill(existingLexeme);
+    await expect(dialog.getByText(duplicatesSummary).first()).toBeAttached();
+    await expect(pill).toBeHidden();
+  });
+});
```

## frontend/viewer/src/locales/en.po

> AI: New translation strings for the duplicate-check feature in the New Entry/New Word dialogs, each paired across Classic and Lite views. Check msgid/msgstr and view-equivalent notes.

### fragment 1

other · +40 -0

```diff
@@ -84,0 +85,5 @@
+#. Button revealing the rest of a truncated possible-duplicates list in the New Entry dialog; # is the number of hidden matches
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "{num, plural, one {Show # more...} other {Show # more...}}"
+msgstr "{num, plural, one {Show # more...} other {Show # more...}}"
+
@@ -104,0 +110,14 @@
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
@@ -154,0 +174,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense"
+#. Short button label on a possible-duplicate result in the New Word dialog; fuller form: "Add meaning to this word"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning"
+msgstr "Add meaning"
+
@@ -163,0 +190,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense to this entry"
+#. Button on a possible-duplicate result in the New Word dialog: saves the meaning being typed onto that existing word (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning to this word"
+msgstr "Add meaning to this word"
+
@@ -175,0 +209,7 @@
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
@@ -183,0 +224,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Add meaning to this word"
+#. Button on a possible-duplicate result in the New Entry dialog: saves the sense being typed onto that existing entry (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add sense to this entry"
+msgstr "Add sense to this entry"
+
@@ -383,0 +431,14 @@
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
@@ -419,0 +481,1 @@
+#: src/lib/entry-editor/DuplicateSummaryPill.svelte
@@ -514,0 +577,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Could not check for similar words"
+#. Status line in the New Entry dialog when the background duplicate search failed (e.g. connection lost); typing again retries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Could not check for similar entries"
+msgstr "Could not check for similar entries"
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Could not check for similar entries"
+#. Status line in the New Word dialog when the background duplicate search failed (e.g. connection lost); typing again retries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Could not check for similar words"
+msgstr "Could not check for similar words"
+
```

### fragment 3

other · +35 -0

```diff
@@ -1137,0 +1214,14 @@
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
@@ -1381,0 +1472,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "No similar entries found"
+#. Reassuring status line in the New Word dialog: the duplicate check found no existing words like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Looks like a new word"
+msgstr "Looks like a new word"
+
@@ -1426,0 +1524,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Sense added to \"{0}\""
+#. Success notification after adding the typed meaning to an existing word; {0} is that word's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Meaning added to \"{0}\""
+msgstr "Meaning added to \"{0}\""
+
@@ -1628,0 +1733,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Looks like a new word"
+#. Status line in the New Entry dialog: the duplicate check found no existing entries like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "No similar entries found"
+msgstr "No similar entries found"
+
```

### fragment 4

other · +29 -0

```diff
@@ -2006,0 +2118,22 @@
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
@@ -2105,0 +2239,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Meaning added to \"{0}\""
+#. Success notification after adding the typed sense to an existing entry; {0} is that entry's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Sense added to \"{0}\""
+msgstr "Sense added to \"{0}\""
+
```

### fragment 5

other · +35 -0

```diff
@@ -2151,0 +2292,35 @@
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
@@ -2327,0 +2327,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar entries already exist"
+#. Warning banner in the New Word dialog; expands to a list of possible duplicate words
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar words already exist"
+msgstr "Similar words already exist"
+
@@ -2353,0 +2536,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "This word may already exist"
+#. Warning banner in the New Entry dialog when an entry with the exact same headword exists; expands to a list of possible duplicates
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "This entry may already exist"
+msgstr "This entry may already exist"
+
@@ -2390,0 +2580,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "This entry may already exist"
+#. Warning banner in the New Word dialog when a word with the exact same spelling exists; expands to a list of possible duplicates
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "This word may already exist"
+msgstr "This word may already exist"
+
```

## frontend/viewer/src/locales/es.po

### fragment 1

other · +40 -0 · low-signal (translations)

```diff
@@ -89,0 +90,5 @@
+#. Button revealing the rest of a truncated possible-duplicates list in the New Entry dialog; # is the number of hidden matches
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "{num, plural, one {Show # more...} other {Show # more...}}"
+msgstr ""
+
@@ -109,0 +115,14 @@
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
@@ -159,0 +179,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense"
+#. Short button label on a possible-duplicate result in the New Word dialog; fuller form: "Add meaning to this word"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning"
+msgstr ""
+
@@ -168,0 +195,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense to this entry"
+#. Button on a possible-duplicate result in the New Word dialog: saves the meaning being typed onto that existing word (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning to this word"
+msgstr ""
+
@@ -180,0 +214,7 @@
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
@@ -188,0 +229,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Add meaning to this word"
+#. Button on a possible-duplicate result in the New Entry dialog: saves the sense being typed onto that existing entry (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add sense to this entry"
+msgstr ""
+
@@ -388,0 +436,14 @@
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
@@ -424,0 +486,1 @@
+#: src/lib/entry-editor/DuplicateSummaryPill.svelte
@@ -519,0 +582,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Could not check for similar words"
+#. Status line in the New Entry dialog when the background duplicate search failed (e.g. connection lost); typing again retries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Could not check for similar entries"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Could not check for similar entries"
+#. Status line in the New Word dialog when the background duplicate search failed (e.g. connection lost); typing again retries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Could not check for similar words"
+msgstr ""
+
```

### fragment 3

other · +35 -0 · low-signal (translations)

```diff
@@ -1142,0 +1219,14 @@
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
@@ -1386,0 +1477,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "No similar entries found"
+#. Reassuring status line in the New Word dialog: the duplicate check found no existing words like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Looks like a new word"
+msgstr ""
+
@@ -1431,0 +1529,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Sense added to \"{0}\""
+#. Success notification after adding the typed meaning to an existing word; {0} is that word's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Meaning added to \"{0}\""
+msgstr ""
+
@@ -1633,0 +1738,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Looks like a new word"
+#. Status line in the New Entry dialog: the duplicate check found no existing entries like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "No similar entries found"
+msgstr ""
+
```

### fragment 4

other · +29 -0 · low-signal (translations)

```diff
@@ -2011,0 +2123,22 @@
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
@@ -2110,0 +2244,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Meaning added to \"{0}\""
+#. Success notification after adding the typed sense to an existing entry; {0} is that entry's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Sense added to \"{0}\""
+msgstr ""
+
```

### fragment 5

other · +35 -0 · low-signal (translations)

```diff
@@ -2156,0 +2297,35 @@
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
@@ -2332,0 +2332,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar entries already exist"
+#. Warning banner in the New Word dialog; expands to a list of possible duplicate words
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar words already exist"
+msgstr ""
+
@@ -2358,0 +2541,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "This word may already exist"
+#. Warning banner in the New Entry dialog when an entry with the exact same headword exists; expands to a list of possible duplicates
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "This entry may already exist"
+msgstr ""
+
@@ -2395,0 +2585,7 @@
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

other · +40 -0 · low-signal (translations)

```diff
@@ -89,0 +90,5 @@
+#. Button revealing the rest of a truncated possible-duplicates list in the New Entry dialog; # is the number of hidden matches
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "{num, plural, one {Show # more...} other {Show # more...}}"
+msgstr ""
+
@@ -109,0 +115,14 @@
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
@@ -159,0 +179,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense"
+#. Short button label on a possible-duplicate result in the New Word dialog; fuller form: "Add meaning to this word"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning"
+msgstr ""
+
@@ -168,0 +195,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense to this entry"
+#. Button on a possible-duplicate result in the New Word dialog: saves the meaning being typed onto that existing word (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning to this word"
+msgstr ""
+
@@ -180,0 +214,7 @@
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
@@ -188,0 +229,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Add meaning to this word"
+#. Button on a possible-duplicate result in the New Entry dialog: saves the sense being typed onto that existing entry (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add sense to this entry"
+msgstr ""
+
@@ -388,0 +436,14 @@
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
@@ -424,0 +486,1 @@
+#: src/lib/entry-editor/DuplicateSummaryPill.svelte
@@ -519,0 +582,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Could not check for similar words"
+#. Status line in the New Entry dialog when the background duplicate search failed (e.g. connection lost); typing again retries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Could not check for similar entries"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Could not check for similar entries"
+#. Status line in the New Word dialog when the background duplicate search failed (e.g. connection lost); typing again retries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Could not check for similar words"
+msgstr ""
+
```

### fragment 3

other · +35 -0 · low-signal (translations)

```diff
@@ -1142,0 +1219,14 @@
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
@@ -1386,0 +1477,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "No similar entries found"
+#. Reassuring status line in the New Word dialog: the duplicate check found no existing words like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Looks like a new word"
+msgstr ""
+
@@ -1431,0 +1529,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Sense added to \"{0}\""
+#. Success notification after adding the typed meaning to an existing word; {0} is that word's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Meaning added to \"{0}\""
+msgstr ""
+
@@ -1633,0 +1738,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Looks like a new word"
+#. Status line in the New Entry dialog: the duplicate check found no existing entries like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "No similar entries found"
+msgstr ""
+
```

### fragment 4

other · +29 -0 · low-signal (translations)

```diff
@@ -2011,0 +2123,22 @@
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
@@ -2110,0 +2244,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Meaning added to \"{0}\""
+#. Success notification after adding the typed sense to an existing entry; {0} is that entry's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Sense added to \"{0}\""
+msgstr ""
+
```

### fragment 5

other · +35 -0 · low-signal (translations)

```diff
@@ -2156,0 +2297,35 @@
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
@@ -2332,0 +2332,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar entries already exist"
+#. Warning banner in the New Word dialog; expands to a list of possible duplicate words
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar words already exist"
+msgstr ""
+
@@ -2358,0 +2541,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "This word may already exist"
+#. Warning banner in the New Entry dialog when an entry with the exact same headword exists; expands to a list of possible duplicates
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "This entry may already exist"
+msgstr ""
+
@@ -2395,0 +2585,7 @@
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

other · +40 -0 · low-signal (translations)

```diff
@@ -89,0 +90,5 @@
+#. Button revealing the rest of a truncated possible-duplicates list in the New Entry dialog; # is the number of hidden matches
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "{num, plural, one {Show # more...} other {Show # more...}}"
+msgstr ""
+
@@ -109,0 +115,14 @@
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
@@ -159,0 +179,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense"
+#. Short button label on a possible-duplicate result in the New Word dialog; fuller form: "Add meaning to this word"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning"
+msgstr ""
+
@@ -168,0 +195,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense to this entry"
+#. Button on a possible-duplicate result in the New Word dialog: saves the meaning being typed onto that existing word (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning to this word"
+msgstr ""
+
@@ -180,0 +214,7 @@
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
@@ -188,0 +229,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Add meaning to this word"
+#. Button on a possible-duplicate result in the New Entry dialog: saves the sense being typed onto that existing entry (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add sense to this entry"
+msgstr ""
+
@@ -388,0 +436,14 @@
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
@@ -424,0 +486,1 @@
+#: src/lib/entry-editor/DuplicateSummaryPill.svelte
@@ -519,0 +582,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Could not check for similar words"
+#. Status line in the New Entry dialog when the background duplicate search failed (e.g. connection lost); typing again retries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Could not check for similar entries"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Could not check for similar entries"
+#. Status line in the New Word dialog when the background duplicate search failed (e.g. connection lost); typing again retries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Could not check for similar words"
+msgstr ""
+
```

### fragment 3

other · +35 -0 · low-signal (translations)

```diff
@@ -1142,0 +1219,14 @@
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
@@ -1386,0 +1477,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "No similar entries found"
+#. Reassuring status line in the New Word dialog: the duplicate check found no existing words like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Looks like a new word"
+msgstr ""
+
@@ -1431,0 +1529,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Sense added to \"{0}\""
+#. Success notification after adding the typed meaning to an existing word; {0} is that word's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Meaning added to \"{0}\""
+msgstr ""
+
@@ -1633,0 +1738,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Looks like a new word"
+#. Status line in the New Entry dialog: the duplicate check found no existing entries like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "No similar entries found"
+msgstr ""
+
```

### fragment 4

other · +29 -0 · low-signal (translations)

```diff
@@ -2011,0 +2123,22 @@
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
@@ -2110,0 +2244,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Meaning added to \"{0}\""
+#. Success notification after adding the typed sense to an existing entry; {0} is that entry's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Sense added to \"{0}\""
+msgstr ""
+
```

### fragment 5

other · +35 -0 · low-signal (translations)

```diff
@@ -2156,0 +2297,35 @@
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
@@ -2332,0 +2332,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar entries already exist"
+#. Warning banner in the New Word dialog; expands to a list of possible duplicate words
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar words already exist"
+msgstr ""
+
@@ -2358,0 +2541,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "This word may already exist"
+#. Warning banner in the New Entry dialog when an entry with the exact same headword exists; expands to a list of possible duplicates
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "This entry may already exist"
+msgstr ""
+
@@ -2395,0 +2585,7 @@
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

other · +40 -0 · low-signal (translations)

```diff
@@ -89,0 +90,5 @@
+#. Button revealing the rest of a truncated possible-duplicates list in the New Entry dialog; # is the number of hidden matches
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "{num, plural, one {Show # more...} other {Show # more...}}"
+msgstr ""
+
@@ -109,0 +115,14 @@
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
@@ -159,0 +179,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense"
+#. Short button label on a possible-duplicate result in the New Word dialog; fuller form: "Add meaning to this word"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning"
+msgstr ""
+
@@ -168,0 +195,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense to this entry"
+#. Button on a possible-duplicate result in the New Word dialog: saves the meaning being typed onto that existing word (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning to this word"
+msgstr ""
+
@@ -180,0 +214,7 @@
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
@@ -188,0 +229,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Add meaning to this word"
+#. Button on a possible-duplicate result in the New Entry dialog: saves the sense being typed onto that existing entry (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add sense to this entry"
+msgstr ""
+
@@ -388,0 +436,14 @@
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
@@ -424,0 +486,1 @@
+#: src/lib/entry-editor/DuplicateSummaryPill.svelte
@@ -519,0 +582,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Could not check for similar words"
+#. Status line in the New Entry dialog when the background duplicate search failed (e.g. connection lost); typing again retries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Could not check for similar entries"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Could not check for similar entries"
+#. Status line in the New Word dialog when the background duplicate search failed (e.g. connection lost); typing again retries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Could not check for similar words"
+msgstr ""
+
```

### fragment 3

other · +35 -0 · low-signal (translations)

```diff
@@ -1142,0 +1219,14 @@
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
@@ -1386,0 +1477,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "No similar entries found"
+#. Reassuring status line in the New Word dialog: the duplicate check found no existing words like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Looks like a new word"
+msgstr ""
+
@@ -1431,0 +1529,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Sense added to \"{0}\""
+#. Success notification after adding the typed meaning to an existing word; {0} is that word's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Meaning added to \"{0}\""
+msgstr ""
+
@@ -1633,0 +1738,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Looks like a new word"
+#. Status line in the New Entry dialog: the duplicate check found no existing entries like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "No similar entries found"
+msgstr ""
+
```

### fragment 4

other · +29 -0 · low-signal (translations)

```diff
@@ -2011,0 +2123,22 @@
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
@@ -2110,0 +2244,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Meaning added to \"{0}\""
+#. Success notification after adding the typed sense to an existing entry; {0} is that entry's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Sense added to \"{0}\""
+msgstr ""
+
```

### fragment 5

other · +35 -0 · low-signal (translations)

```diff
@@ -2156,0 +2297,35 @@
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
@@ -2332,0 +2332,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar entries already exist"
+#. Warning banner in the New Word dialog; expands to a list of possible duplicate words
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar words already exist"
+msgstr ""
+
@@ -2358,0 +2541,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "This word may already exist"
+#. Warning banner in the New Entry dialog when an entry with the exact same headword exists; expands to a list of possible duplicates
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "This entry may already exist"
+msgstr ""
+
@@ -2395,0 +2585,7 @@
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

other · +40 -0 · low-signal (translations)

```diff
@@ -89,0 +90,5 @@
+#. Button revealing the rest of a truncated possible-duplicates list in the New Entry dialog; # is the number of hidden matches
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "{num, plural, one {Show # more...} other {Show # more...}}"
+msgstr ""
+
@@ -109,0 +115,14 @@
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
@@ -159,0 +179,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense"
+#. Short button label on a possible-duplicate result in the New Word dialog; fuller form: "Add meaning to this word"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning"
+msgstr ""
+
@@ -168,0 +195,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense to this entry"
+#. Button on a possible-duplicate result in the New Word dialog: saves the meaning being typed onto that existing word (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning to this word"
+msgstr ""
+
@@ -180,0 +214,7 @@
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
@@ -188,0 +229,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Add meaning to this word"
+#. Button on a possible-duplicate result in the New Entry dialog: saves the sense being typed onto that existing entry (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add sense to this entry"
+msgstr ""
+
@@ -388,0 +436,14 @@
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
@@ -424,0 +486,1 @@
+#: src/lib/entry-editor/DuplicateSummaryPill.svelte
@@ -519,0 +582,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Could not check for similar words"
+#. Status line in the New Entry dialog when the background duplicate search failed (e.g. connection lost); typing again retries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Could not check for similar entries"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Could not check for similar entries"
+#. Status line in the New Word dialog when the background duplicate search failed (e.g. connection lost); typing again retries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Could not check for similar words"
+msgstr ""
+
```

### fragment 3

other · +35 -0 · low-signal (translations)

```diff
@@ -1142,0 +1219,14 @@
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
@@ -1386,0 +1477,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "No similar entries found"
+#. Reassuring status line in the New Word dialog: the duplicate check found no existing words like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Looks like a new word"
+msgstr ""
+
@@ -1431,0 +1529,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Sense added to \"{0}\""
+#. Success notification after adding the typed meaning to an existing word; {0} is that word's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Meaning added to \"{0}\""
+msgstr ""
+
@@ -1633,0 +1738,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Looks like a new word"
+#. Status line in the New Entry dialog: the duplicate check found no existing entries like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "No similar entries found"
+msgstr ""
+
```

### fragment 4

other · +29 -0 · low-signal (translations)

```diff
@@ -2011,0 +2123,22 @@
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
@@ -2110,0 +2244,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Meaning added to \"{0}\""
+#. Success notification after adding the typed sense to an existing entry; {0} is that entry's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Sense added to \"{0}\""
+msgstr ""
+
```

### fragment 5

other · +35 -0 · low-signal (translations)

```diff
@@ -2156,0 +2297,35 @@
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
@@ -2332,0 +2332,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar entries already exist"
+#. Warning banner in the New Word dialog; expands to a list of possible duplicate words
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar words already exist"
+msgstr ""
+
@@ -2358,0 +2541,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "This word may already exist"
+#. Warning banner in the New Entry dialog when an entry with the exact same headword exists; expands to a list of possible duplicates
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "This entry may already exist"
+msgstr ""
+
@@ -2395,0 +2585,7 @@
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

other · +40 -0 · low-signal (translations)

```diff
@@ -89,0 +90,5 @@
+#. Button revealing the rest of a truncated possible-duplicates list in the New Entry dialog; # is the number of hidden matches
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "{num, plural, one {Show # more...} other {Show # more...}}"
+msgstr ""
+
@@ -109,0 +115,14 @@
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
@@ -159,0 +179,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense"
+#. Short button label on a possible-duplicate result in the New Word dialog; fuller form: "Add meaning to this word"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning"
+msgstr ""
+
@@ -168,0 +195,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense to this entry"
+#. Button on a possible-duplicate result in the New Word dialog: saves the meaning being typed onto that existing word (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning to this word"
+msgstr ""
+
@@ -180,0 +214,7 @@
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
@@ -188,0 +229,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Add meaning to this word"
+#. Button on a possible-duplicate result in the New Entry dialog: saves the sense being typed onto that existing entry (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add sense to this entry"
+msgstr ""
+
@@ -388,0 +436,14 @@
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
@@ -424,0 +486,1 @@
+#: src/lib/entry-editor/DuplicateSummaryPill.svelte
@@ -519,0 +582,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Could not check for similar words"
+#. Status line in the New Entry dialog when the background duplicate search failed (e.g. connection lost); typing again retries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Could not check for similar entries"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Could not check for similar entries"
+#. Status line in the New Word dialog when the background duplicate search failed (e.g. connection lost); typing again retries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Could not check for similar words"
+msgstr ""
+
```

### fragment 3

other · +35 -0 · low-signal (translations)

```diff
@@ -1142,0 +1219,14 @@
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
@@ -1386,0 +1477,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "No similar entries found"
+#. Reassuring status line in the New Word dialog: the duplicate check found no existing words like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Looks like a new word"
+msgstr ""
+
@@ -1431,0 +1529,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Sense added to \"{0}\""
+#. Success notification after adding the typed meaning to an existing word; {0} is that word's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Meaning added to \"{0}\""
+msgstr ""
+
@@ -1633,0 +1738,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Looks like a new word"
+#. Status line in the New Entry dialog: the duplicate check found no existing entries like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "No similar entries found"
+msgstr ""
+
```

### fragment 4

other · +29 -0 · low-signal (translations)

```diff
@@ -2011,0 +2123,22 @@
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
@@ -2110,0 +2244,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Meaning added to \"{0}\""
+#. Success notification after adding the typed sense to an existing entry; {0} is that entry's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Sense added to \"{0}\""
+msgstr ""
+
```

### fragment 5

other · +35 -0 · low-signal (translations)

```diff
@@ -2156,0 +2297,35 @@
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
@@ -2332,0 +2332,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar entries already exist"
+#. Warning banner in the New Word dialog; expands to a list of possible duplicate words
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar words already exist"
+msgstr ""
+
@@ -2358,0 +2541,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "This word may already exist"
+#. Warning banner in the New Entry dialog when an entry with the exact same headword exists; expands to a list of possible duplicates
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "This entry may already exist"
+msgstr ""
+
@@ -2395,0 +2585,7 @@
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

other · +40 -0 · low-signal (translations)

```diff
@@ -89,0 +90,5 @@
+#. Button revealing the rest of a truncated possible-duplicates list in the New Entry dialog; # is the number of hidden matches
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "{num, plural, one {Show # more...} other {Show # more...}}"
+msgstr ""
+
@@ -109,0 +115,14 @@
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
@@ -159,0 +179,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense"
+#. Short button label on a possible-duplicate result in the New Word dialog; fuller form: "Add meaning to this word"
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning"
+msgstr ""
+
@@ -168,0 +195,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Add sense to this entry"
+#. Button on a possible-duplicate result in the New Word dialog: saves the meaning being typed onto that existing word (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add meaning to this word"
+msgstr ""
+
@@ -180,0 +214,7 @@
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
@@ -188,0 +229,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Add meaning to this word"
+#. Button on a possible-duplicate result in the New Entry dialog: saves the sense being typed onto that existing entry (instead of creating a duplicate) and opens it
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Add sense to this entry"
+msgstr ""
+
@@ -388,0 +436,14 @@
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
@@ -424,0 +486,1 @@
+#: src/lib/entry-editor/DuplicateSummaryPill.svelte
@@ -519,0 +582,14 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Could not check for similar words"
+#. Status line in the New Entry dialog when the background duplicate search failed (e.g. connection lost); typing again retries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Could not check for similar entries"
+msgstr ""
+
+#. Relevant view: Lite
+#. Classic view equivalent: "Could not check for similar entries"
+#. Status line in the New Word dialog when the background duplicate search failed (e.g. connection lost); typing again retries
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Could not check for similar words"
+msgstr ""
+
```

### fragment 3

other · +35 -0 · low-signal (translations)

```diff
@@ -1142,0 +1219,14 @@
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
@@ -1386,0 +1477,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "No similar entries found"
+#. Reassuring status line in the New Word dialog: the duplicate check found no existing words like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Looks like a new word"
+msgstr ""
+
@@ -1431,0 +1529,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Sense added to \"{0}\""
+#. Success notification after adding the typed meaning to an existing word; {0} is that word's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Meaning added to \"{0}\""
+msgstr ""
+
@@ -1633,0 +1738,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Looks like a new word"
+#. Status line in the New Entry dialog: the duplicate check found no existing entries like the one being typed
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "No similar entries found"
+msgstr ""
+
```

### fragment 4

other · +29 -0 · low-signal (translations)

```diff
@@ -2011,0 +2123,22 @@
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
@@ -2110,0 +2244,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "Meaning added to \"{0}\""
+#. Success notification after adding the typed sense to an existing entry; {0} is that entry's headword
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Sense added to \"{0}\""
+msgstr ""
+
```

### fragment 5

other · +35 -0 · low-signal (translations)

```diff
@@ -2156,0 +2297,35 @@
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
@@ -2332,0 +2332,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "Similar entries already exist"
+#. Warning banner in the New Word dialog; expands to a list of possible duplicate words
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "Similar words already exist"
+msgstr ""
+
@@ -2358,0 +2541,7 @@
+#. Relevant view: Classic
+#. Lite view equivalent: "This word may already exist"
+#. Warning banner in the New Entry dialog when an entry with the exact same headword exists; expands to a list of possible duplicates
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "This entry may already exist"
+msgstr ""
+
@@ -2395,0 +2585,7 @@
+#. Relevant view: Lite
+#. Classic view equivalent: "This entry may already exist"
+#. Warning banner in the New Word dialog when a word with the exact same spelling exists; expands to a list of possible duplicates
+#: src/lib/entry-editor/DuplicateCheck.svelte
+msgid "This word may already exist"
+msgstr ""
+
```
