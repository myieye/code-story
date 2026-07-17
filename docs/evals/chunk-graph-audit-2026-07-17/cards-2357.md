# Audit cards — PR 2357 (Add activity filters to the activity view — mixed C#/Svelte/TS)

Range `277e418d8~1..277e418d8` · head `277e418d87c1` · seed `2321623440`.
`calls` edges in graph: **38** · sampled: **30** (cap 30).

Each card: caller chunk + the call-site line(s), then the callee chunk + its first defining lines. No labels here.

## 2357-e01 _(in Tim subsample)_

**Caller:** `frontend/viewer/src/lib/activity/ActivityFilter.svelte :: script`
chunk id: `frontend/viewer/src/lib/activity/ActivityFilter.svelte::script.fragment 2::1yb5282`
call site (L55):
```
   55        const data = await historyService.listActivityChangeTypes();
```
**Callee:** `frontend/viewer/src/lib/services/history-service.ts :: HistoryService.listActivityChangeTypes`
chunk id: `frontend/viewer/src/lib/services/history-service.ts::HistoryService.listActivityChangeTypes::fq7y9q`
defining lines (first 10):
```
   77    async listActivityChangeTypes(): Promise<IActivityChangeType[]> {
   78      this.ensureLoaded();
   79      return await this.historyApi.listActivityChangeTypes();
   80    }
```

## 2357-e02 _(in Tim subsample)_

**Caller:** `backend/FwLite/LcmCrdt/HistoryService.cs :: HistoryService.ListActivityChangeTypes`
chunk id: `backend/FwLite/LcmCrdt/HistoryService.cs::HistoryService.ListActivityChangeTypes::74h6z7`
call site (L123):
```
  123              .Select(t => new ActivityChangeType(
```
**Callee:** `backend/FwLite/LcmCrdt/HistoryService.cs :: ActivityChangeType`
chunk id: `backend/FwLite/LcmCrdt/HistoryService.cs::ActivityChangeType::29pkd0`
defining lines (first 10):
```
   17  public record ActivityChangeType(string Key, string Label, int CommitCount);
```

## 2357-e03 _(in Tim subsample)_

**Caller:** `frontend/viewer/src/lib/activity/ActivityView.svelte :: script`
chunk id: `frontend/viewer/src/lib/activity/ActivityView.svelte::script.fragment 1::1oylxck`
call site (L33):
```
   33    const queryKey = $derived.by(() => serverQueryKey(filters));
```
**Callee:** `frontend/viewer/src/lib/activity/utils.ts :: serverQueryKey`
chunk id: `frontend/viewer/src/lib/activity/utils.ts::serverQueryKey::1wgif83`
defining lines (first 10):
```
   53  export function serverQueryKey(filters: ActivityFilters): string {
   54    return JSON.stringify(toServerQuery(filters));
   55  }
```

## 2357-e04 _(in Tim subsample)_

**Caller:** `frontend/viewer/src/lib/services/history-service.ts :: HistoryService.fetchSnapshot`
chunk id: `frontend/viewer/src/lib/services/history-service.ts::HistoryService.fetchSnapshot::b5lf69`
call site (L58):
```
   58      this.ensureLoaded();
```
**Callee:** `frontend/viewer/src/lib/services/history-service.ts :: HistoryService.ensureLoaded`
chunk id: `frontend/viewer/src/lib/services/history-service.ts::HistoryService.ensureLoaded::visswd`
defining lines (first 10):
```
   97    private ensureLoaded(): asserts this is {loaded: true, historyApi: IHistoryServiceJsInvokable} {
```

## 2357-e05 _(in Tim subsample)_

**Caller:** `frontend/viewer/src/lib/activity/utils.ts :: authorSortRank`
chunk id: `frontend/viewer/src/lib/activity/utils.ts::authorSortRank::u68vum`
call site (L72):
```
   72    const key = authorFilterKey(author);
```
**Callee:** `frontend/viewer/src/lib/activity/utils.ts :: authorFilterKey`
chunk id: `frontend/viewer/src/lib/activity/utils.ts::authorFilterKey::1c5rka7`
defining lines (first 10):
```
   65  export function authorFilterKey(author: Omit<IActivityAuthor, 'commitCount'>): string {
   66    if (!author.authorId && !author.authorName) return UNKNOWN_AUTHOR_KEY;
   67    if (author.authorId) return author.authorId;
   68    return `name:${author.authorName}`;
   69  }
```

## 2357-e06 _(in Tim subsample)_

**Caller:** `frontend/viewer/src/lib/activity/ActivityFilter.svelte :: script.allSelectionIcon`
chunk id: `frontend/viewer/src/lib/activity/ActivityFilter.svelte::script.allSelectionIcon::1gejbo7`
call site (L88):
```
   88      if (selected === 'all' || isAllFilterSelection(selected, allKeys)) return 'i-mdi-check';
```
**Callee:** `frontend/viewer/src/lib/activity/utils.ts :: isAllFilterSelection`
chunk id: `frontend/viewer/src/lib/activity/utils.ts::isAllFilterSelection::wl8zn1`
defining lines (first 10):
```
   37  export function isAllFilterSelection(selected: MultiFilterSelection, allKeys: string[]): boolean {
   38    return selected === 'all' || (allKeys.length > 0 && selected.length === allKeys.length && allKeys.every(k => selected.includes(k)));
   39  }
```

## 2357-e07 _(in Tim subsample)_

**Caller:** `backend/FwLite/FwLiteShared/Services/HistoryServiceJsInvokable.cs :: HistoryServiceJsInvokable.ListActivityAuthors`
chunk id: `backend/FwLite/FwLiteShared/Services/HistoryServiceJsInvokable.cs::HistoryServiceJsInvokable.ListActivityAuthors::lsnc9`
call site (L31):
```
   31          return historyService.ListActivityAuthors();
```
**Callee:** `backend/FwLite/LcmCrdt/HistoryService.cs :: HistoryService.ListActivityAuthors`
chunk id: `backend/FwLite/LcmCrdt/HistoryService.cs::HistoryService.ListActivityAuthors::pxevia`
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

## 2357-e08 _(in Tim subsample)_

**Caller:** `backend/FwLite/FwLiteShared/Services/HistoryServiceJsInvokable.cs :: HistoryServiceJsInvokable.ListActivityChangeTypes`
chunk id: `backend/FwLite/FwLiteShared/Services/HistoryServiceJsInvokable.cs::HistoryServiceJsInvokable.ListActivityChangeTypes::8mmwdj`
call site (L37):
```
   37          return historyService.ListActivityChangeTypes();
```
**Callee:** `backend/FwLite/LcmCrdt/HistoryService.cs :: HistoryService.ListActivityChangeTypes`
chunk id: `backend/FwLite/LcmCrdt/HistoryService.cs::HistoryService.ListActivityChangeTypes::74h6z7`
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

## 2357-e09 _(in Tim subsample)_

**Caller:** `frontend/viewer/src/lib/activity/ActivityFilter.svelte :: script`
chunk id: `frontend/viewer/src/lib/activity/ActivityFilter.svelte::script.fragment 2::1yb5282`
call site (L64):
```
   64    const authorSelectValue = $derived(resolveFilterKeys(filters.authorFilterKeys, authorKeys));
```
**Callee:** `frontend/viewer/src/lib/activity/utils.ts :: resolveFilterKeys`
chunk id: `frontend/viewer/src/lib/activity/utils.ts::resolveFilterKeys::uywqxm`
defining lines (first 10):
```
   41  export function resolveFilterKeys(selected: MultiFilterSelection, allKeys: string[]): string[] {
   42    return selected === 'all' ? allKeys : selected;
   43  }
```

## 2357-e10 _(in Tim subsample)_

**Caller:** `backend/FwLite/LcmCrdt/HistoryService.cs :: ProjectActivity.ChangeTypes`
chunk id: `backend/FwLite/LcmCrdt/HistoryService.cs::ProjectActivity.ChangeTypes::ffudzz`
call site (L46):
```
   46      public string[] ChangeTypes { get; } = Changes.Select(c => HistoryService.GetChangeTypeKey(c.Change)).Distinct().ToArray();
```
**Callee:** `backend/FwLite/LcmCrdt/HistoryService.cs :: HistoryService.GetChangeTypeKey`
chunk id: `backend/FwLite/LcmCrdt/HistoryService.cs::HistoryService.GetChangeTypeKey::py4rw3`
defining lines (first 10):
```
  232      internal static string GetChangeTypeKey(IChange change) =>
  233          GetChangeTypeKeyFromType(change.GetType());
```

## 2357-e11 _(in Tim subsample)_

**Caller:** `frontend/viewer/src/lib/services/history-service.ts :: HistoryService.activity`
chunk id: `frontend/viewer/src/lib/services/history-service.ts::HistoryService.activity::zyh03`
call site (L83):
```
   83      this.ensureLoaded();
```
**Callee:** `frontend/viewer/src/lib/services/history-service.ts :: HistoryService.ensureLoaded`
chunk id: `frontend/viewer/src/lib/services/history-service.ts::HistoryService.ensureLoaded::visswd`
defining lines (first 10):
```
   97    private ensureLoaded(): asserts this is {loaded: true, historyApi: IHistoryServiceJsInvokable} {
```

## 2357-e12 _(in Tim subsample)_

**Caller:** `backend/FwLite/LcmCrdt/HistoryService.cs :: HistoryService.ProjectActivity`
chunk id: `backend/FwLite/LcmCrdt/HistoryService.cs::HistoryService.ProjectActivity::17et1ev`
call site (L136):
```
  136          query ??= new ActivityQuery();
```
**Callee:** `backend/FwLite/LcmCrdt/HistoryService.cs :: ActivityQuery`
chunk id: `backend/FwLite/LcmCrdt/HistoryService.cs::ActivityQuery::9jimum`
defining lines (first 10):
```
   28  public record ActivityQuery(
   29      string[]? AuthorFilterKeys = null,
   30      string[]? ChangeTypeKeys = null,
   31      ActivitySort Sort = ActivitySort.NewestFirst);
```

## 2357-e13 _(in Tim subsample)_

**Caller:** `backend/FwLite/FwLiteWeb/Routes/ActivityRoutes.cs :: ActivityRoutes.MapActivities`
chunk id: `backend/FwLite/FwLiteWeb/Routes/ActivityRoutes.cs::ActivityRoutes.MapActivities::kcc5o`
call site (L28):
```
   28              historyService.ProjectActivity(skip, take, new ActivityQuery(authorFilterKeys, changeTypeKeys, sort)));
```
**Callee:** `backend/FwLite/LcmCrdt/HistoryService.cs :: ActivityQuery`
chunk id: `backend/FwLite/LcmCrdt/HistoryService.cs::ActivityQuery::9jimum`
defining lines (first 10):
```
   28  public record ActivityQuery(
   29      string[]? AuthorFilterKeys = null,
   30      string[]? ChangeTypeKeys = null,
   31      ActivitySort Sort = ActivitySort.NewestFirst);
```

## 2357-e14 _(in Tim subsample)_

**Caller:** `frontend/viewer/src/lib/activity/ActivityView.svelte :: script`
chunk id: `frontend/viewer/src/lib/activity/ActivityView.svelte::script.fragment 1::1oylxck`
call site (L34):
```
   34    const serverQuery = $derived.by(() => toServerQuery(filters));
```
**Callee:** `frontend/viewer/src/lib/activity/utils.ts :: toServerQuery`
chunk id: `frontend/viewer/src/lib/activity/utils.ts::toServerQuery::1bo9sq2`
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

## 2357-e15 _(in Tim subsample)_

**Caller:** `backend/FwLite/LcmCrdt/HistoryService.cs :: HistoryService.ListActivityAuthors`
chunk id: `backend/FwLite/LcmCrdt/HistoryService.cs::HistoryService.ListActivityAuthors::pxevia`
call site (L106):
```
  106              .Select(g => new ActivityAuthor(g.Key.AuthorId, g.Key.AuthorName, g.Count()))
```
**Callee:** `backend/FwLite/LcmCrdt/HistoryService.cs :: ActivityAuthor`
chunk id: `backend/FwLite/LcmCrdt/HistoryService.cs::ActivityAuthor::i8jt6y`
defining lines (first 10):
```
   15  public record ActivityAuthor(string? AuthorId, string? AuthorName, int CommitCount);
```

## 2357-e16

**Caller:** `frontend/viewer/src/lib/activity/ActivityView.svelte :: script`
chunk id: `frontend/viewer/src/lib/activity/ActivityView.svelte::script.fragment 1::1oylxck`
call site (L30):
```
   30    let filters = $state<ActivityFilters>(createDefaultActivityFilters());
```
**Callee:** `frontend/viewer/src/lib/activity/utils.ts :: createDefaultActivityFilters`
chunk id: `frontend/viewer/src/lib/activity/utils.ts::createDefaultActivityFilters::1wz9e8k`
defining lines (first 10):
```
   29  export function createDefaultActivityFilters(): ActivityFilters {
   30    return {
   31      authorFilterKeys: 'all',
   32      changeTypeFilterKeys: 'all',
   33      sort: ActivitySort.NewestFirst,
   34    };
   35  }
```

## 2357-e17

**Caller:** `frontend/viewer/src/lib/services/history-service.ts :: HistoryService.load`
chunk id: `frontend/viewer/src/lib/services/history-service.ts::HistoryService.load::ookii9`
call site (L47):
```
   47      this.ensureLoaded();
```
**Callee:** `frontend/viewer/src/lib/services/history-service.ts :: HistoryService.ensureLoaded`
chunk id: `frontend/viewer/src/lib/services/history-service.ts::HistoryService.ensureLoaded::visswd`
defining lines (first 10):
```
   97    private ensureLoaded(): asserts this is {loaded: true, historyApi: IHistoryServiceJsInvokable} {
```

## 2357-e18

**Caller:** `frontend/viewer/src/lib/activity/ActivityFilter.svelte :: script`
chunk id: `frontend/viewer/src/lib/activity/ActivityFilter.svelte::script.fragment 1::n4o3xn`
call site (L34):
```
   34    let {filters = $bindable(createDefaultActivityFilters())}: Props = $props();
```
**Callee:** `frontend/viewer/src/lib/activity/utils.ts :: createDefaultActivityFilters`
chunk id: `frontend/viewer/src/lib/activity/utils.ts::createDefaultActivityFilters::1wz9e8k`
defining lines (first 10):
```
   29  export function createDefaultActivityFilters(): ActivityFilters {
   30    return {
   31      authorFilterKeys: 'all',
   32      changeTypeFilterKeys: 'all',
   33      sort: ActivitySort.NewestFirst,
   34    };
   35  }
```

## 2357-e19

**Caller:** `frontend/viewer/src/lib/activity/ActivityFilter.svelte :: script.onAuthorValueChange`
chunk id: `frontend/viewer/src/lib/activity/ActivityFilter.svelte::script.onAuthorValueChange::1mxab2g`
call site (L94):
```
   94      filters.authorFilterKeys = applyMultiSelectValue(value, authorKeys, ALL_AUTHORS, filters.authorFilterKeys);
```
**Callee:** `frontend/viewer/src/lib/activity/utils.ts :: applyMultiSelectValue`
chunk id: `frontend/viewer/src/lib/activity/utils.ts::applyMultiSelectValue::1kfsejq`
defining lines (first 10):
```
   84  export function applyMultiSelectValue(
   85    value: string[],
   86    allKeys: string[],
   87    allKey: string,
   88    currentSelection: MultiFilterSelection,
   89  ): MultiFilterSelection {
   90    if (value.includes(allKey)) {
   91      return isAllFilterSelection(currentSelection, allKeys) ? [] : 'all';
   92    }
   93    if (isAllFilterSelection(value, allKeys)) {
```

## 2357-e20

**Caller:** `backend/FwLite/FwLiteShared/Services/HistoryServiceJsInvokable.cs :: HistoryServiceJsInvokable.ProjectActivity`
chunk id: `backend/FwLite/FwLiteShared/Services/HistoryServiceJsInvokable.cs::HistoryServiceJsInvokable.ProjectActivity::qbp0yt`
call site (L25):
```
   25              new ActivityQuery(authorFilterKeys, changeTypeKeys, sort)).ToArrayAsync();
```
**Callee:** `backend/FwLite/LcmCrdt/HistoryService.cs :: ActivityQuery`
chunk id: `backend/FwLite/LcmCrdt/HistoryService.cs::ActivityQuery::9jimum`
defining lines (first 10):
```
   28  public record ActivityQuery(
   29      string[]? AuthorFilterKeys = null,
   30      string[]? ChangeTypeKeys = null,
   31      ActivitySort Sort = ActivitySort.NewestFirst);
```

## 2357-e21

**Caller:** `frontend/viewer/src/lib/activity/ActivityFilter.svelte :: script.onChangeTypeValueChange`
chunk id: `frontend/viewer/src/lib/activity/ActivityFilter.svelte::script.onChangeTypeValueChange::7o4sb6`
call site (L98):
```
   98      filters.changeTypeFilterKeys = applyMultiSelectValue(value, changeTypeKeys, ALL_CHANGE_TYPES, filters.changeTypeFilterKeys);
```
**Callee:** `frontend/viewer/src/lib/activity/utils.ts :: applyMultiSelectValue`
chunk id: `frontend/viewer/src/lib/activity/utils.ts::applyMultiSelectValue::1kfsejq`
defining lines (first 10):
```
   84  export function applyMultiSelectValue(
   85    value: string[],
   86    allKeys: string[],
   87    allKey: string,
   88    currentSelection: MultiFilterSelection,
   89  ): MultiFilterSelection {
   90    if (value.includes(allKey)) {
   91      return isAllFilterSelection(currentSelection, allKeys) ? [] : 'all';
   92    }
   93    if (isAllFilterSelection(value, allKeys)) {
```

## 2357-e22

**Caller:** `backend/FwLite/FwLiteWeb/Routes/ActivityRoutes.cs :: ActivityRoutes.MapActivities`
chunk id: `backend/FwLite/FwLiteWeb/Routes/ActivityRoutes.cs::ActivityRoutes.MapActivities::kcc5o`
call site (L29):
```
   29          group.MapGet("/authors", (HistoryService historyService) => historyService.ListActivityAuthors());
```
**Callee:** `backend/FwLite/LcmCrdt/HistoryService.cs :: HistoryService.ListActivityAuthors`
chunk id: `backend/FwLite/LcmCrdt/HistoryService.cs::HistoryService.ListActivityAuthors::pxevia`
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

## 2357-e23

**Caller:** `backend/FwLite/FwLiteWeb/Routes/ActivityRoutes.cs :: ActivityRoutes.MapActivities`
chunk id: `backend/FwLite/FwLiteWeb/Routes/ActivityRoutes.cs::ActivityRoutes.MapActivities::kcc5o`
call site (L30):
```
   30          group.MapGet("/change-types", (HistoryService historyService) => historyService.ListActivityChangeTypes());
```
**Callee:** `backend/FwLite/LcmCrdt/HistoryService.cs :: HistoryService.ListActivityChangeTypes`
chunk id: `backend/FwLite/LcmCrdt/HistoryService.cs::HistoryService.ListActivityChangeTypes::74h6z7`
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

## 2357-e24

**Caller:** `frontend/viewer/src/lib/services/history-service.ts :: HistoryService.listActivityAuthors`
chunk id: `frontend/viewer/src/lib/services/history-service.ts::HistoryService.listActivityAuthors::1szv5ps`
call site (L73):
```
   73      this.ensureLoaded();
```
**Callee:** `frontend/viewer/src/lib/services/history-service.ts :: HistoryService.ensureLoaded`
chunk id: `frontend/viewer/src/lib/services/history-service.ts::HistoryService.ensureLoaded::visswd`
defining lines (first 10):
```
   97    private ensureLoaded(): asserts this is {loaded: true, historyApi: IHistoryServiceJsInvokable} {
```

## 2357-e25

**Caller:** `backend/FwLite/LcmCrdt/HistoryService.cs :: HistoryService.ProjectActivity`
chunk id: `backend/FwLite/LcmCrdt/HistoryService.cs::HistoryService.ProjectActivity::17et1ev`
call site (L138):
```
  138          var commits = ApplyActivityFilters(dbContext.Commits, query);
```
**Callee:** `backend/FwLite/LcmCrdt/HistoryService.cs :: HistoryService.ApplyActivityFilters`
chunk id: `backend/FwLite/LcmCrdt/HistoryService.cs::HistoryService.ApplyActivityFilters.fragment 1::12z90jb`
defining lines (first 10):
```
  152      private static IQueryable<Commit> ApplyActivityFilters(IQueryable<Commit> commits, ActivityQuery query)
  153      {
  154          if (query.AuthorFilterKeys is { Length: 0 })
  155          {
  156              return commits.ToLinqToDB().Where(_ => false);
  157          }
  158  
  159          if (query.AuthorFilterKeys is { Length: > 0 })
  160          {
  161              var authorIds = new List<string>();
```

## 2357-e26

**Caller:** `frontend/viewer/src/lib/activity/ActivityView.svelte :: script`
chunk id: `frontend/viewer/src/lib/activity/ActivityView.svelte::script.fragment 3::1w0aeqf`
call site (L102):
```
  102      if (!hasActiveServerSideFilters(filters) || activity.loading || visibleActivity === null || !hasMorePages) return;
```
**Callee:** `frontend/viewer/src/lib/activity/utils.ts :: hasActiveServerSideFilters`
chunk id: `frontend/viewer/src/lib/activity/utils.ts::hasActiveServerSideFilters::1j7djwh`
defining lines (first 10):
```
   99  export function hasActiveServerSideFilters(filters: ActivityFilters): boolean {
  100    return filters.authorFilterKeys !== 'all' || filters.changeTypeFilterKeys !== 'all';
```

## 2357-e27

**Caller:** `frontend/viewer/src/lib/activity/ActivityFilter.svelte :: script.authorKeyToLabel`
chunk id: `frontend/viewer/src/lib/activity/ActivityFilter.svelte::script.authorKeyToLabel::n2ma7c`
call site (L83):
```
   83      const author = authors.current.find(a => authorFilterKey(a) === key);
```
**Callee:** `frontend/viewer/src/lib/activity/utils.ts :: authorFilterKey`
chunk id: `frontend/viewer/src/lib/activity/utils.ts::authorFilterKey::1c5rka7`
defining lines (first 10):
```
   65  export function authorFilterKey(author: Omit<IActivityAuthor, 'commitCount'>): string {
   66    if (!author.authorId && !author.authorName) return UNKNOWN_AUTHOR_KEY;
   67    if (author.authorId) return author.authorId;
   68    return `name:${author.authorName}`;
   69  }
```

## 2357-e28

**Caller:** `frontend/viewer/src/lib/activity/ActivityView.svelte :: script`
chunk id: `frontend/viewer/src/lib/activity/ActivityView.svelte::script.fragment 1::1oylxck`
call site (L46):
```
   46        const data = await historyService.activity(skip, BATCH_SIZE, query);
```
**Callee:** `frontend/viewer/src/lib/services/history-service.ts :: HistoryService.activity`
chunk id: `frontend/viewer/src/lib/services/history-service.ts::HistoryService.activity::zyh03`
defining lines (first 10):
```
   82    async activity(skip: number, take: number, query?: IActivityQuery): Promise<IProjectActivity[]> {
   83      this.ensureLoaded();
   84      return await this.historyApi.projectActivity(
   85          skip,
   86          take,
   87          query?.authorFilterKeys,
   88          query?.changeTypeKeys,
   89          query?.sort ?? ActivitySort.NewestFirst);
```

## 2357-e29

**Caller:** `frontend/viewer/src/lib/activity/utils.ts :: serverQueryKey`
chunk id: `frontend/viewer/src/lib/activity/utils.ts::serverQueryKey::1wgif83`
call site (L54):
```
   54    return JSON.stringify(toServerQuery(filters));
```
**Callee:** `frontend/viewer/src/lib/activity/utils.ts :: toServerQuery`
chunk id: `frontend/viewer/src/lib/activity/utils.ts::toServerQuery::1bo9sq2`
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

## 2357-e30

**Caller:** `frontend/viewer/src/lib/activity/ActivityFilter.svelte :: script`
chunk id: `frontend/viewer/src/lib/activity/ActivityFilter.svelte::script.fragment 2::1yb5282`
call site (L42):
```
   42        const data = await historyService.listActivityAuthors();
```
**Callee:** `frontend/viewer/src/lib/services/history-service.ts :: HistoryService.listActivityAuthors`
chunk id: `frontend/viewer/src/lib/services/history-service.ts::HistoryService.listActivityAuthors::1szv5ps`
defining lines (first 10):
```
   72    async listActivityAuthors(): Promise<IActivityAuthor[]> {
   73      this.ensureLoaded();
   74      return await this.historyApi.listActivityAuthors();
   75    }
```
