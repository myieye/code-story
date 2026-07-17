# Tim's blind edge audit — PR 2357

**What this is.** Each card below is one `calls` edge the tool drew between two code chunks:
a caller (with the exact line where the call sits) and the callee it thinks that call lands in.

**Your job.** For each card, decide whether that link would genuinely help a reviewer —
would you want a one-key jump between these two chunks? Tick one box per card:

- **RELEVANT** — the link is real and useful; the caller really uses the callee.
- **IRRELEVANT** — noise or wrong: the callee is not what that call actually resolves to,
  or the link is too trivial to be worth an affordance.

Go with your gut on a quick glance — that is the reviewer experience we are testing.
Please don't open the sealed Claude-labels file until your ticks here are committed.

## 2357-e01

**Caller:** `frontend/viewer/src/lib/activity/ActivityFilter.svelte :: script`
call site (L55):
```
   55        const data = await historyService.listActivityChangeTypes();
```
**Callee:** `frontend/viewer/src/lib/services/history-service.ts :: HistoryService.listActivityChangeTypes`
defining lines (first 10):
```
   77    async listActivityChangeTypes(): Promise<IActivityChangeType[]> {
   78      this.ensureLoaded();
   79      return await this.historyApi.listActivityChangeTypes();
   80    }
```
- [ ] RELEVANT
- [ ] IRRELEVANT

## 2357-e02

**Caller:** `backend/FwLite/LcmCrdt/HistoryService.cs :: HistoryService.ListActivityChangeTypes`
call site (L123):
```
  123              .Select(t => new ActivityChangeType(
```
**Callee:** `backend/FwLite/LcmCrdt/HistoryService.cs :: ActivityChangeType`
defining lines (first 10):
```
   17  public record ActivityChangeType(string Key, string Label, int CommitCount);
```
- [ ] RELEVANT
- [ ] IRRELEVANT

## 2357-e03

**Caller:** `frontend/viewer/src/lib/activity/ActivityView.svelte :: script`
call site (L33):
```
   33    const queryKey = $derived.by(() => serverQueryKey(filters));
```
**Callee:** `frontend/viewer/src/lib/activity/utils.ts :: serverQueryKey`
defining lines (first 10):
```
   53  export function serverQueryKey(filters: ActivityFilters): string {
   54    return JSON.stringify(toServerQuery(filters));
   55  }
```
- [ ] RELEVANT
- [ ] IRRELEVANT

## 2357-e04

**Caller:** `frontend/viewer/src/lib/services/history-service.ts :: HistoryService.fetchSnapshot`
call site (L58):
```
   58      this.ensureLoaded();
```
**Callee:** `frontend/viewer/src/lib/services/history-service.ts :: HistoryService.ensureLoaded`
defining lines (first 10):
```
   97    private ensureLoaded(): asserts this is {loaded: true, historyApi: IHistoryServiceJsInvokable} {
```
- [ ] RELEVANT
- [ ] IRRELEVANT

## 2357-e05

**Caller:** `frontend/viewer/src/lib/activity/utils.ts :: authorSortRank`
call site (L72):
```
   72    const key = authorFilterKey(author);
```
**Callee:** `frontend/viewer/src/lib/activity/utils.ts :: authorFilterKey`
defining lines (first 10):
```
   65  export function authorFilterKey(author: Omit<IActivityAuthor, 'commitCount'>): string {
   66    if (!author.authorId && !author.authorName) return UNKNOWN_AUTHOR_KEY;
   67    if (author.authorId) return author.authorId;
   68    return `name:${author.authorName}`;
   69  }
```
- [ ] RELEVANT
- [ ] IRRELEVANT

## 2357-e06

**Caller:** `frontend/viewer/src/lib/activity/ActivityFilter.svelte :: script.allSelectionIcon`
call site (L88):
```
   88      if (selected === 'all' || isAllFilterSelection(selected, allKeys)) return 'i-mdi-check';
```
**Callee:** `frontend/viewer/src/lib/activity/utils.ts :: isAllFilterSelection`
defining lines (first 10):
```
   37  export function isAllFilterSelection(selected: MultiFilterSelection, allKeys: string[]): boolean {
   38    return selected === 'all' || (allKeys.length > 0 && selected.length === allKeys.length && allKeys.every(k => selected.includes(k)));
   39  }
```
- [ ] RELEVANT
- [ ] IRRELEVANT

## 2357-e07

**Caller:** `backend/FwLite/FwLiteShared/Services/HistoryServiceJsInvokable.cs :: HistoryServiceJsInvokable.ListActivityAuthors`
call site (L31):
```
   31          return historyService.ListActivityAuthors();
```
**Callee:** `backend/FwLite/LcmCrdt/HistoryService.cs :: HistoryService.ListActivityAuthors`
defining lines (first 10):
```
   97      public async Task<ActivityAuthor[]> ListActivityAuthors()
   98      {
   99          await using ICrdtDbContext dbContext = await dbContextFactory.CreateDbContextAsync();
  100          var authors = await dbContext.Commits
  101              .GroupBy(c => new
  102              {
  103                  AuthorId = Json.Value(c.Metadata, m => m.AuthorId),
  104                  AuthorName = Json.Value(c.Metadata, m => m.AuthorName),
  105              })
  106              .Select(g => new ActivityAuthor(g.Key.AuthorId, g.Key.AuthorName, g.Count()))
```
- [ ] RELEVANT
- [ ] IRRELEVANT

## 2357-e08

**Caller:** `backend/FwLite/FwLiteShared/Services/HistoryServiceJsInvokable.cs :: HistoryServiceJsInvokable.ListActivityChangeTypes`
call site (L37):
```
   37          return historyService.ListActivityChangeTypes();
```
**Callee:** `backend/FwLite/LcmCrdt/HistoryService.cs :: HistoryService.ListActivityChangeTypes`
defining lines (first 10):
```
  111      public async Task<ActivityChangeType[]> ListActivityChangeTypes()
  112      {
  113          await using ICrdtDbContext dbContext = await dbContextFactory.CreateDbContextAsync();
  114          var changeCounts = await dbContext.Set<ChangeEntity<IChange>>()
  115              .GroupBy(c => new
  116              {
  117                  ChangeTypeKey = Sql.Expr<string>("json_extract({0}, '$.\"$type\"')", c.Change)
  118              })
  119              .Select(g => new KeyValuePair<string, int>(g.Key.ChangeTypeKey, g.Count()))
  120              .ToDictionaryAsyncLinqToDB(p => p.Key, p => p.Value);
```
- [ ] RELEVANT
- [ ] IRRELEVANT

## 2357-e09

**Caller:** `frontend/viewer/src/lib/activity/ActivityFilter.svelte :: script`
call site (L64):
```
   64    const authorSelectValue = $derived(resolveFilterKeys(filters.authorFilterKeys, authorKeys));
```
**Callee:** `frontend/viewer/src/lib/activity/utils.ts :: resolveFilterKeys`
defining lines (first 10):
```
   41  export function resolveFilterKeys(selected: MultiFilterSelection, allKeys: string[]): string[] {
   42    return selected === 'all' ? allKeys : selected;
   43  }
```
- [ ] RELEVANT
- [ ] IRRELEVANT

## 2357-e10

**Caller:** `backend/FwLite/LcmCrdt/HistoryService.cs :: ProjectActivity.ChangeTypes`
call site (L46):
```
   46      public string[] ChangeTypes { get; } = Changes.Select(c => HistoryService.GetChangeTypeKey(c.Change)).Distinct().ToArray();
```
**Callee:** `backend/FwLite/LcmCrdt/HistoryService.cs :: HistoryService.GetChangeTypeKey`
defining lines (first 10):
```
  232      internal static string GetChangeTypeKey(IChange change) =>
  233          GetChangeTypeKeyFromType(change.GetType());
```
- [ ] RELEVANT
- [ ] IRRELEVANT

## 2357-e11

**Caller:** `frontend/viewer/src/lib/services/history-service.ts :: HistoryService.activity`
call site (L83):
```
   83      this.ensureLoaded();
```
**Callee:** `frontend/viewer/src/lib/services/history-service.ts :: HistoryService.ensureLoaded`
defining lines (first 10):
```
   97    private ensureLoaded(): asserts this is {loaded: true, historyApi: IHistoryServiceJsInvokable} {
```
- [ ] RELEVANT
- [ ] IRRELEVANT

## 2357-e12

**Caller:** `backend/FwLite/LcmCrdt/HistoryService.cs :: HistoryService.ProjectActivity`
call site (L136):
```
  136          query ??= new ActivityQuery();
```
**Callee:** `backend/FwLite/LcmCrdt/HistoryService.cs :: ActivityQuery`
defining lines (first 10):
```
   28  public record ActivityQuery(
   29      string[]? AuthorFilterKeys = null,
   30      string[]? ChangeTypeKeys = null,
   31      ActivitySort Sort = ActivitySort.NewestFirst);
```
- [ ] RELEVANT
- [ ] IRRELEVANT

## 2357-e13

**Caller:** `backend/FwLite/FwLiteWeb/Routes/ActivityRoutes.cs :: ActivityRoutes.MapActivities`
call site (L28):
```
   28              historyService.ProjectActivity(skip, take, new ActivityQuery(authorFilterKeys, changeTypeKeys, sort)));
```
**Callee:** `backend/FwLite/LcmCrdt/HistoryService.cs :: ActivityQuery`
defining lines (first 10):
```
   28  public record ActivityQuery(
   29      string[]? AuthorFilterKeys = null,
   30      string[]? ChangeTypeKeys = null,
   31      ActivitySort Sort = ActivitySort.NewestFirst);
```
- [ ] RELEVANT
- [ ] IRRELEVANT

## 2357-e14

**Caller:** `frontend/viewer/src/lib/activity/ActivityView.svelte :: script`
call site (L34):
```
   34    const serverQuery = $derived.by(() => toServerQuery(filters));
```
**Callee:** `frontend/viewer/src/lib/activity/utils.ts :: toServerQuery`
defining lines (first 10):
```
   45  export function toServerQuery(filters: ActivityFilters): IActivityQuery {
   46    return {
   47      authorFilterKeys: filters.authorFilterKeys === 'all' ? undefined : filters.authorFilterKeys,
   48      changeTypeKeys: filters.changeTypeFilterKeys === 'all' ? undefined : filters.changeTypeFilterKeys,
   49      sort: filters.sort,
   50    };
   51  }
```
- [ ] RELEVANT
- [ ] IRRELEVANT

## 2357-e15

**Caller:** `backend/FwLite/LcmCrdt/HistoryService.cs :: HistoryService.ListActivityAuthors`
call site (L106):
```
  106              .Select(g => new ActivityAuthor(g.Key.AuthorId, g.Key.AuthorName, g.Count()))
```
**Callee:** `backend/FwLite/LcmCrdt/HistoryService.cs :: ActivityAuthor`
defining lines (first 10):
```
   15  public record ActivityAuthor(string? AuthorId, string? AuthorName, int CommitCount);
```
- [ ] RELEVANT
- [ ] IRRELEVANT
