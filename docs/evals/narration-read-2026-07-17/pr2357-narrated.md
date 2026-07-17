# Code story — 5ae05546..277e418d

125 chunks · 30 sections · head 277e418d

## backend/FwLite/LcmCrdt/HistoryService.cs

> AI: Adds activity filtering, sorting, author/change-type listing to HistoryService. Look at how filters and sort build SQL over commit metadata JSON.

### lines 8–38

other · +6 -0

```diff
@@ -7,0 +8,1 @@
+using System.Text.Json.Serialization;
@@ -16,0 +16,1 @@
+
@@ -18,0 +18,1 @@
+
@@ -27,0 +27,1 @@
+
@@ -32,0 +32,1 @@
+
@@ -38,0 +38,1 @@
+
```

### ActivityAuthor

other · +1 -0

```diff
@@ -13,0 +15,1 @@
+public record ActivityAuthor(string? AuthorId, string? AuthorName, int CommitCount);
```

### ActivityChangeType

other · +1 -0

```diff
@@ -17,0 +17,1 @@
+public record ActivityChangeType(string Key, string Label, int CommitCount);
```

### ActivitySort

other · +8 -0

```diff
@@ -19,0 +19,8 @@
+[JsonConverter(typeof(JsonStringEnumConverter))]
+public enum ActivitySort
+{
+    NewestFirst = 0,
+    OldestFirst = 1,
+    SyncedNewestFirst = 2,
+    SyncedOldestFirst = 3,
+}
```

### ActivityQuery

other · +4 -0

```diff
@@ -28,0 +28,4 @@
+public record ActivityQuery(
+    string[]? AuthorFilterKeys = null,
+    string[]? ChangeTypeKeys = null,
+    ActivitySort Sort = ActivitySort.NewestFirst);
```

### ActivityFilterKeys

other · +5 -0

```diff
@@ -33,0 +33,5 @@
+public static class ActivityFilterKeys
+{
+    public const string UnknownAuthor = "__unknown__";
+    public const string AuthorNamePrefix = "name:";
+}
```

### ProjectActivity.ChangeTypes

method · +1 -0

> AI: New ChangeTypes property derives distinct change-type keys from the commit's changes.

```diff
@@ -20,0 +46,1 @@
+    public string[] ChangeTypes { get; } = Changes.Select(c => HistoryService.GetChangeTypeKey(c.Change)).Distinct().ToArray();
```

### HistoryService

other · +8 -1

```diff
@@ -70,1 +96,1 @@
-    public async IAsyncEnumerable<ProjectActivity> ProjectActivity(int skip = 0, int take = 100)
+
@@ -110,0 +110,1 @@
+
@@ -133,0 +133,1 @@
+
@@ -197,0 +197,1 @@
+
@@ -222,0 +222,1 @@
+
@@ -231,0 +231,1 @@
+
@@ -234,0 +234,1 @@
+
@@ -246,0 +246,1 @@
+
```

### HistoryService.ListActivityAuthors

method · +13 -0

```diff
@@ -97,0 +97,13 @@
+    public async Task<ActivityAuthor[]> ListActivityAuthors()
+    {
+        await using ICrdtDbContext dbContext = await dbContextFactory.CreateDbContextAsync();
+        var authors = await dbContext.Commits
+            .GroupBy(c => new
+            {
+                AuthorId = Json.Value(c.Metadata, m => m.AuthorId),
+                AuthorName = Json.Value(c.Metadata, m => m.AuthorName),
+            })
+            .Select(g => new ActivityAuthor(g.Key.AuthorId, g.Key.AuthorName, g.Count()))
+            .ToListAsyncLinqToDB();
+        return authors.OrderBy(a => a.AuthorName ?? "").ThenBy(a => a.AuthorId ?? "").ToArray();
+    }
```

### HistoryService.ListActivityChangeTypes

method · +22 -0

```diff
@@ -111,0 +111,22 @@
+    public async Task<ActivityChangeType[]> ListActivityChangeTypes()
+    {
+        await using ICrdtDbContext dbContext = await dbContextFactory.CreateDbContextAsync();
+        var changeCounts = await dbContext.Set<ChangeEntity<IChange>>()
+            .GroupBy(c => new
+            {
+                ChangeTypeKey = Sql.Expr<string>("json_extract({0}, '$.\"$type\"')", c.Change)
+            })
+            .Select(g => new KeyValuePair<string, int>(g.Key.ChangeTypeKey, g.Count()))
+            .ToDictionaryAsyncLinqToDB(p => p.Key, p => p.Value);
+
+        var registeredTypes = LcmCrdtKernel.AllChangeTypes()
+            .Select(t => new ActivityChangeType(
+                GetChangeTypeKeyFromType(t),
+                ChangeTypeLabel(t),
+                changeCounts.GetValueOrDefault(GetChangeTypeKeyFromType(t))))
+            .Where(t => t.CommitCount > 0)
+            .OrderBy(t => t.Label)
+            .ToArray();
+
+        return registeredTypes;
+    }
```

### HistoryService.ProjectActivity

method · +8 -9

> AI: Rewrites the query; note the doubled query init and dbContext lines shown in the diff.

```diff
@@ -134,0 +134,1 @@
+    public async IAsyncEnumerable<ProjectActivity> ProjectActivity(int skip = 0, int take = 100, ActivityQuery? query = null)
@@ -71,0 +136,1 @@
+        query ??= new ActivityQuery();
@@ -73,7 +138,4 @@
-        var changeEntities = dbContext.Set<ChangeEntity<IChange>>();
-        var query =
-            from commit in dbContext.Commits.DefaultOrderDescending()
-            join changeEntity in changeEntities
-                on commit.Id equals changeEntity.CommitId into changes
-            join snapshot in dbContext.Snapshots
-                on commit.Id equals snapshot.CommitId into snapshots
+        var commits = ApplyActivityFilters(dbContext.Commits, query);
+        commits = ApplyActivitySort(commits, query.Sort);
+        var queryable =
+            from commit in commits.Skip(skip).Take(take)
@@ -82,1 +144,1 @@
-                changes.ToList(),
+                commit.ChangeEntities.ToList(),
@@ -84,1 +146,1 @@
-        await foreach (var projectActivity in query.Skip(skip).Take(take).ToLinqToDB().AsAsyncEnumerable())
+        await foreach (var projectActivity in queryable.ToLinqToDB().AsAsyncEnumerable())
```

### HistoryService.ApplyActivityFilters.fragment 1

method-fragment · +35 -0

> AI: Empty author-filter array returns no commits; keys split into ids, name-prefixed names, and unknown.

```diff
@@ -89,0 +152,35 @@
+    private static IQueryable<Commit> ApplyActivityFilters(IQueryable<Commit> commits, ActivityQuery query)
+    {
+        if (query.AuthorFilterKeys is { Length: 0 })
+        {
+            return commits.ToLinqToDB().Where(_ => false);
+        }
+
+        if (query.AuthorFilterKeys is { Length: > 0 })
+        {
+            var authorIds = new List<string>();
+            var authorNames = new List<string>();
+            var includeUnknown = false;
+            foreach (var key in query.AuthorFilterKeys)
+            {
+                if (key == ActivityFilterKeys.UnknownAuthor)
+                    includeUnknown = true;
+                else if (key.StartsWith(ActivityFilterKeys.AuthorNamePrefix, StringComparison.Ordinal))
+                    authorNames.Add(key[ActivityFilterKeys.AuthorNamePrefix.Length..]);
+                else
+                    authorIds.Add(key);
+            }
+
+            commits = commits.ToLinqToDB().Where(c =>
+                (includeUnknown
+                 && (Json.Value(c.Metadata, m => m.AuthorId) ?? "") == ""
+                 && (Json.Value(c.Metadata, m => m.AuthorName) ?? "") == "")
+                || authorIds.Contains(Json.Value(c.Metadata, m => m.AuthorId) ?? "")
+                || authorNames.Contains(Json.Value(c.Metadata, m => m.AuthorName) ?? ""));
+        }
+
+        if (query.ChangeTypeKeys is { Length: 0 })
+        {
+            return commits.ToLinqToDB().Where(_ => false);
+        }
+
```

### HistoryService.ApplyActivityFilters.fragment 2

method-fragment · +10 -0

```diff
@@ -187,0 +187,10 @@
+        if (query.ChangeTypeKeys is { Length: > 0 })
+        {
+            var changeTypeKeys = query.ChangeTypeKeys;
+            commits = commits.ToLinqToDB().Where(c => c.ChangeEntities
+                .Any(ce => changeTypeKeys.Contains(Sql.Expr<string>("json_extract({0}, '$.\"$type\"')", ce.Change)))
+            );
+        }
+
+        return commits;
+    }
```

### HistoryService.ApplyActivitySort

method · +24 -0

> AI: Synced sorts order by the JSON SyncDate, with nulls pushed last.

```diff
@@ -198,0 +198,24 @@
+    private static IQueryable<Commit> ApplyActivitySort(IQueryable<Commit> commits, ActivitySort sort)
+    {
+        return sort switch
+        {
+            ActivitySort.OldestFirst => commits.DefaultOrder(),
+            ActivitySort.SyncedNewestFirst => commits.ToLinqToDB()
+                .OrderByDescending(c => Sql.Expr<int>(
+                    "CASE WHEN json_extract({0}, '$.ExtraMetadata.SyncDate') IS NULL THEN 1 ELSE 0 END", c.Metadata))
+                .ThenByDescending(c => Sql.Expr<string>(
+                    "json_extract({0}, '$.ExtraMetadata.SyncDate')", c.Metadata))
+                .ThenByDescending(c => c.HybridDateTime.DateTime)
+                .ThenByDescending(c => c.HybridDateTime.Counter)
+                .ThenByDescending(c => c.Id),
+            ActivitySort.SyncedOldestFirst => commits.ToLinqToDB()
+                .OrderBy(c => Sql.Expr<int>(
+                    "CASE WHEN json_extract({0}, '$.ExtraMetadata.SyncDate') IS NULL THEN 1 ELSE 0 END", c.Metadata))
+                .ThenBy(c => Sql.Expr<string>(
+                    "json_extract({0}, '$.ExtraMetadata.SyncDate')", c.Metadata))
+                .ThenBy(c => c.HybridDateTime.DateTime)
+                .ThenBy(c => c.HybridDateTime.Counter)
+                .ThenBy(c => c.Id),
+            _ => commits.DefaultOrderDescending(),
+        };
+    }
```

### HistoryService.GetChangeTypeKeyFromType

method · +8 -0

```diff
@@ -223,0 +223,8 @@
+    private static string GetChangeTypeKeyFromType(Type changeType)
+    {
+        var typeNameProp = changeType.GetProperty("TypeName",
+            System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.FlattenHierarchy);
+        if (typeNameProp?.GetValue(null) is string name)
+            return name;
+        return changeType.Name;
+    }
```

### HistoryService.GetChangeTypeKey

method · +2 -0

```diff
@@ -232,0 +232,2 @@
+    internal static string GetChangeTypeKey(IChange change) =>
+        GetChangeTypeKeyFromType(change.GetType());
```

### HistoryService.ChangeTypeLabel

method · +11 -0

```diff
@@ -235,0 +235,11 @@
+    public static string ChangeTypeLabel(Type changeType)
+    {
+        if (changeType.IsGenericType && changeType.Name.Contains("JsonPatch", StringComparison.Ordinal))
+            return $"Edit{changeType.GetGenericArguments()[0].Name}".Humanize();
+        if (changeType.IsGenericType && changeType.GetGenericTypeDefinition() == typeof(DeleteChange<>))
+            return $"Delete{changeType.GetGenericArguments()[0].Name}".Humanize();
+        if (changeType.IsGenericType && changeType.Name.StartsWith("SetOrderChange", StringComparison.Ordinal))
+            return $"Reorder{changeType.GetGenericArguments()[0].Name}".Humanize();
+        var changeName = changeType.Name.Humanize();
+        return Regex.Replace(changeName, " Change$", "", RegexOptions.IgnoreCase);
+    }
```

## backend/FwLite/LcmCrdt.Tests/HistoryServiceActivityTests.cs

> AI: New test file covering HistoryService activity queries: author/change-type listings, author and change-type filters, sort orders, sync-date ordering, and pagination.

### lines 1–9

other · +8 -0

```diff
@@ -0,0 +1,7 @@
+using LcmCrdt.Changes;
+using LcmCrdt.Utils;
+using Microsoft.EntityFrameworkCore;
+using MiniLcm.Tests.AutoFakerHelpers;
+using SIL.Harmony.Core;
+using Soenneker.Utils.AutoBogus;
+
@@ -9,0 +9,1 @@
+
```

### LcmCrdt.Tests

other · +1 -0

```diff
@@ -8,0 +8,1 @@
+namespace LcmCrdt.Tests;
```

### HistoryServiceActivityTests

other · +24 -0

```diff
@@ -10,0 +10,5 @@
+public class HistoryServiceActivityTests : IAsyncLifetime, IAsyncDisposable
+{
+    private static readonly AutoFaker AutoFaker = new(AutoFakerDefault.MakeConfig(["en"]));
+    private MiniLcmApiFixture _fixture = null!;
+
@@ -18,0 +18,1 @@
+
@@ -24,0 +24,1 @@
+
@@ -26,0 +26,1 @@
+
@@ -28,0 +28,1 @@
+
@@ -41,0 +41,1 @@
+
@@ -56,0 +56,1 @@
+
@@ -68,0 +68,1 @@
+
@@ -80,0 +80,1 @@
+
@@ -94,0 +94,1 @@
+
@@ -106,0 +106,1 @@
+
@@ -118,0 +118,1 @@
+
@@ -131,0 +131,1 @@
+
@@ -144,0 +144,1 @@
+
@@ -159,0 +159,1 @@
+
@@ -169,0 +169,1 @@
+
@@ -177,0 +177,1 @@
+
@@ -185,0 +185,1 @@
+
@@ -193,0 +193,1 @@
+
@@ -202,0 +202,1 @@
+}
```

### HistoryServiceActivityTests.Service

method · +1 -0

```diff
@@ -15,0 +15,1 @@
+    private HistoryService Service => _fixture.GetService<HistoryService>();
```

### HistoryServiceActivityTests.DataModel

method · +1 -0

```diff
@@ -16,0 +16,1 @@
+    private DataModel DataModel => _fixture.DataModel;
```

### HistoryServiceActivityTests.ClientId

method · +1 -0

```diff
@@ -17,0 +17,1 @@
+    private Guid ClientId => _fixture.GetService<CurrentProjectService>().ProjectData.ClientId;
```

### HistoryServiceActivityTests.InitializeAsync

method · +5 -0

```diff
@@ -19,0 +19,5 @@
+    public async Task InitializeAsync()
+    {
+        _fixture = MiniLcmApiFixture.Create();
+        await _fixture.InitializeAsync();
+    }
```

### HistoryServiceActivityTests.DisposeAsync

method · +1 -0

```diff
@@ -25,0 +25,1 @@
+    public async Task DisposeAsync() => await _fixture.DisposeAsync();
```

### HistoryServiceActivityTests.DisposeAsync

method · +1 -0

```diff
@@ -27,0 +27,1 @@
+    async ValueTask IAsyncDisposable.DisposeAsync() => await DisposeAsync();
```

### HistoryServiceActivityTests.ListActivityAuthors_ReturnsDistinctAuthorsWithCounts

method · +12 -0

```diff
@@ -29,0 +29,12 @@
+    [Fact]
+    public async Task ListActivityAuthors_ReturnsDistinctAuthorsWithCounts()
+    {
+        await AddEntryCommit(new CommitMetadata { AuthorName = "Alice", AuthorId = "alice-id" });
+        await AddEntryCommit(new CommitMetadata { AuthorName = "Alice", AuthorId = "alice-id" });
+        await AddEntryCommit(new CommitMetadata { AuthorName = "Bob", AuthorId = "bob-id" });
+
+        var authors = await Service.ListActivityAuthors();
+
+        authors.Should().Contain(a => a.AuthorId == "alice-id" && a.AuthorName == "Alice" && a.CommitCount == 2);
+        authors.Should().Contain(a => a.AuthorId == "bob-id" && a.AuthorName == "Bob" && a.CommitCount == 1);
+    }
```

### HistoryServiceActivityTests.ListActivityChangeTypes_IncludesCreateEntry

method · +14 -0

```diff
@@ -42,0 +42,14 @@
+    [Fact]
+    public async Task ListActivityChangeTypes_IncludesCreateEntry()
+    {
+        await AddEntryCommit(new CommitMetadata { AuthorName = "Alice", AuthorId = "alice-id" });
+        await AddEntryCommit(new CommitMetadata { AuthorName = "Alice", AuthorId = "alice-id" });
+        await AddNewPublicationCommit(new CommitMetadata { AuthorName = "Alice", AuthorId = "alice-id" });
+        await AddNewPartOfSpeechCommit(new CommitMetadata { AuthorName = "Alice", AuthorId = "alice-id" });
+
+        var changeTypes = await Service.ListActivityChangeTypes();
+
+        changeTypes.Should().Contain(t => t.Key == nameof(CreateEntryChange) && t.CommitCount >= 2);
+        changeTypes.Should().Contain(t => t.Key == nameof(CreatePublicationChange) && t.CommitCount >= 1);
+        changeTypes.Should().Contain(t => t.Key == nameof(CreatePartOfSpeechChange) && t.CommitCount >= 1);
+    }
```

### HistoryServiceActivityTests.ProjectActivity_FiltersByAuthorId

method · +11 -0

```diff
@@ -57,0 +57,11 @@
+    [Fact]
+    public async Task ProjectActivity_FiltersByAuthorId()
+    {
+        await AddEntryCommit(new CommitMetadata { AuthorName = "Alice", AuthorId = "alice-id" });
+        await AddEntryCommit(new CommitMetadata { AuthorName = "Bob", AuthorId = "bob-id" });
+
+        var activities = await Service.ProjectActivity(0, 100, new ActivityQuery(AuthorFilterKeys: ["alice-id"])).ToArrayAsync();
+
+        activities.Should().OnlyContain(a => a.Metadata.AuthorId == "alice-id");
+        activities.Should().HaveCountGreaterThanOrEqualTo(1);
+    }
```

### HistoryServiceActivityTests.ProjectActivity_AuthorFilterKeys_ExcludesUnselectedAuthors

method · +11 -0

```diff
@@ -69,0 +69,11 @@
+    [Fact]
+    public async Task ProjectActivity_AuthorFilterKeys_ExcludesUnselectedAuthors()
+    {
+        await AddEntryCommit(new CommitMetadata { AuthorName = "Alice", AuthorId = "alice-id" });
+        await AddEntryCommit(new CommitMetadata { AuthorName = "FieldWorks" });
+
+        var activities = await Service.ProjectActivity(0, 100, new ActivityQuery(AuthorFilterKeys: ["alice-id"])).ToArrayAsync();
+
+        activities.Should().NotContain(a => a.Metadata.AuthorName == "FieldWorks");
+        activities.Should().Contain(a => a.Metadata.AuthorName == "Alice");
+    }
```

### HistoryServiceActivityTests.ProjectActivity_SortsOldestFirst

method · +13 -0

```diff
@@ -81,0 +81,13 @@
+    [Fact]
+    public async Task ProjectActivity_SortsOldestFirst()
+    {
+        await AddEntryCommit(new CommitMetadata { AuthorName = "First", AuthorId = "first" }, "alpha");
+        await Task.Delay(5);
+        await AddEntryCommit(new CommitMetadata { AuthorName = "Second", AuthorId = "second" }, "beta");
+
+        var activities = await Service.ProjectActivity(0, 1000, new ActivityQuery(Sort: ActivitySort.OldestFirst)).ToArrayAsync();
+        var firstIndex = Array.FindIndex(activities, a => a.Metadata.AuthorId == "first");
+        var secondIndex = Array.FindIndex(activities, a => a.Metadata.AuthorId == "second");
+        firstIndex.Should().BeGreaterThanOrEqualTo(0);
+        secondIndex.Should().BeGreaterThan(firstIndex);
+    }
```

### HistoryServiceActivityTests.ProjectActivity_SyncedNewestFirst_PlacesUnsyncedFirst

method · +11 -0

> AI: SetSyncDate marks one commit as synced to check unsynced sorts before synced.

```diff
@@ -95,0 +95,11 @@
+    [Fact]
+    public async Task ProjectActivity_SyncedNewestFirst_PlacesUnsyncedFirst()
+    {
+        var syncedCommit = await AddEntryCommit(new CommitMetadata { AuthorName = "Synced", AuthorId = "synced" }, "synced-entry");
+        await SetSyncDate(syncedCommit.Id, new DateTimeOffset(2025, 6, 1, 12, 0, 0, TimeSpan.Zero));
+        await AddEntryCommit(new CommitMetadata { AuthorName = "Unsynced", AuthorId = "unsynced" }, "unsynced-entry");
+
+        var activities = await Service.ProjectActivity(0, 1000, new ActivityQuery(Sort: ActivitySort.SyncedNewestFirst)).ToArrayAsync();
+        var commitAuthors = activities.Select(a => a.Metadata.AuthorId).Where(a => a is not null);
+        commitAuthors.Should().ContainInOrder(["unsynced", "synced"]);
+    }
```

### HistoryServiceActivityTests.ProjectActivity_SyncedOldestFirst_PlacesUnsyncedLast

method · +11 -0

```diff
@@ -107,0 +107,11 @@
+    [Fact]
+    public async Task ProjectActivity_SyncedOldestFirst_PlacesUnsyncedLast()
+    {
+        var syncedCommit = await AddEntryCommit(new CommitMetadata { AuthorName = "Synced", AuthorId = "synced" }, "synced-entry");
+        await SetSyncDate(syncedCommit.Id, new DateTimeOffset(2025, 6, 1, 12, 0, 0, TimeSpan.Zero));
+        await AddEntryCommit(new CommitMetadata { AuthorName = "Unsynced", AuthorId = "unsynced" }, "unsynced-entry");
+
+        var activities = await Service.ProjectActivity(0, 1000, new ActivityQuery(Sort: ActivitySort.SyncedOldestFirst)).ToArrayAsync();
+        var commitAuthors = activities.Select(a => a.Metadata.AuthorId).Where(a => a is not null);
+        commitAuthors.Should().ContainInOrder(["synced", "unsynced"]);
+    }
```

### HistoryServiceActivityTests.ProjectActivity_PaginationRespectsFilters

method · +12 -0

```diff
@@ -119,0 +119,12 @@
+    [Fact]
+    public async Task ProjectActivity_PaginationRespectsFilters()
+    {
+        await AddEntryCommit(new CommitMetadata { AuthorName = "Alice", AuthorId = "alice-id" });
+        await AddEntryCommit(new CommitMetadata { AuthorName = "Alice", AuthorId = "alice-id" });
+        await AddEntryCommit(new CommitMetadata { AuthorName = "Bob", AuthorId = "bob-id" });
+
+        var page = await Service.ProjectActivity(0, 1, new ActivityQuery(AuthorFilterKeys: ["alice-id"])).ToArrayAsync();
+
+        page.Should().HaveCount(1);
+        page[0].Metadata.AuthorId.Should().Be("alice-id");
+    }
```

### HistoryServiceActivityTests.ProjectActivity_FiltersByChangeTypeKeys

method · +12 -0

```diff
@@ -132,0 +132,12 @@
+    [Fact]
+    public async Task ProjectActivity_FiltersByChangeTypeKeys()
+    {
+        await AddEntryCommit(new CommitMetadata { AuthorName = "Alice", AuthorId = "alice-id" });
+        await AddNewPublicationCommit(new CommitMetadata { AuthorName = "Alice", AuthorId = "alice-id" });
+
+        var activities = await Service.ProjectActivity(0, 100, new ActivityQuery(ChangeTypeKeys: [nameof(CreateEntryChange)])).ToArrayAsync();
+
+        activities.Should().OnlyContain(a => a.ChangeTypes.Contains(nameof(CreateEntryChange)));
+        activities.Should().HaveCountGreaterThanOrEqualTo(1);
+        activities.Should().NotContain(a => a.ChangeTypes.Contains(nameof(CreatePublicationChange)));
+    }
```

### HistoryServiceActivityTests.ProjectActivity_ChangeTypeKeys_FiltersMultipleTypes

method · +14 -0

> AI: First asserts the part-of-speech change shows up unfiltered before checking the multi-type filter excludes it.

```diff
@@ -145,0 +145,14 @@
+    [Fact]
+    public async Task ProjectActivity_ChangeTypeKeys_FiltersMultipleTypes()
+    {
+        await AddEntryCommit(new CommitMetadata { AuthorName = "Alice", AuthorId = "alice-id" });
+        await AddNewPublicationCommit(new CommitMetadata { AuthorName = "Alice", AuthorId = "alice-id" });
+        await AddNewPartOfSpeechCommit(new CommitMetadata { AuthorName = "Alice", AuthorId = "alice-id" });
+        (await Service.ProjectActivity(0, 100, new ActivityQuery()).ToArrayAsync())
+            .Should().Contain(a => a.ChangeTypes.Contains(nameof(CreatePartOfSpeechChange)));
+
+        var activities = await Service.ProjectActivity(0, 100, new ActivityQuery(ChangeTypeKeys: [nameof(CreateEntryChange), nameof(CreatePublicationChange)])).ToArrayAsync();
+
+        activities.Should().OnlyContain(a => a.ChangeTypes.Any(t => t == nameof(CreateEntryChange) || t == nameof(CreatePublicationChange)));
+        activities.Should().NotContain(a => a.ChangeTypes.Contains(nameof(CreatePartOfSpeechChange)));
+    }
```

### HistoryServiceActivityTests.ProjectActivity_IncludesChangeTypes

method · +9 -0

```diff
@@ -160,0 +160,9 @@
+    [Fact]
+    public async Task ProjectActivity_IncludesChangeTypes()
+    {
+        await AddEntryCommit(new CommitMetadata { AuthorName = "Alice", AuthorId = "alice-id" });
+
+        var activity = await Service.ProjectActivity(0, 1).SingleAsync();
+
+        activity.ChangeTypes.Should().Contain("CreateEntryChange");
+    }
```

### HistoryServiceActivityTests.AddEntryCommit

method · +7 -0

> AI: Headword null path builds a faked entry via AutoFaker instead of a fixed one.

```diff
@@ -170,0 +170,7 @@
+    private async Task<Commit> AddEntryCommit(CommitMetadata metadata, string? headword = null)
+    {
+        var entry = headword is null
+            ? await AutoFaker.EntryReadyForCreation(_fixture.Api)
+            : new Entry { Id = Guid.NewGuid(), LexemeForm = new MultiString { ["en"] = headword } };
+        return await DataModel.AddChange(ClientId, new CreateEntryChange(entry), metadata);
+    }
```

### HistoryServiceActivityTests.AddNewPublicationCommit

method · +7 -0

```diff
@@ -178,0 +178,7 @@
+    private async Task<Commit> AddNewPublicationCommit(CommitMetadata metadata, string publicationName = "Test Publication")
+    {
+        return await DataModel.AddChange(ClientId, new CreatePublicationChange(Guid.NewGuid(), new MultiString
+        {
+            ["en"] = publicationName
+        }), metadata);
+    }
```

### HistoryServiceActivityTests.AddNewPartOfSpeechCommit

method · +7 -0

```diff
@@ -186,0 +186,7 @@
+    private async Task<Commit> AddNewPartOfSpeechCommit(CommitMetadata metadata, string partOfSpeechName = "Test Part of Speech")
+    {
+        return await DataModel.AddChange(ClientId, new CreatePartOfSpeechChange(Guid.NewGuid(), new MultiString
+        {
+            ["en"] = partOfSpeechName
+        }), metadata);
+    }
```

### HistoryServiceActivityTests.SetSyncDate

method · +8 -0

```diff
@@ -194,0 +194,8 @@
+    private async Task SetSyncDate(Guid commitId, DateTimeOffset syncDate)
+    {
+        var db = _fixture.DbContext;
+        var commit = await db.Set<Commit>().SingleAsync(c => c.Id == commitId);
+        commit.SetSyncDate(syncDate);
+        db.Entry(commit).Property(c => c.Metadata).IsModified = true;
+        await db.SaveChangesAsync();
+    }
```

## backend/FwLite/FwLiteShared/Services/HistoryServiceJsInvokable.cs

> AI: Widens the JS-invokable ProjectActivity to take filter/sort args and adds passthrough methods for listing authors and change types. Check the new ActivityQuery build.

### HistoryServiceJsInvokable.ProjectActivity

method · +9 -2

> AI: The old single-arg call is dropped and replaced by the ActivityQuery version.

```diff
@@ -17,1 +17,6 @@
-    public async ValueTask<ProjectActivity[]> ProjectActivity(int skip, int take)
+    public async ValueTask<ProjectActivity[]> ProjectActivity(
+        int skip,
+        int take,
+        string[]? authorFilterKeys = null,
+        string[]? changeTypeKeys = null,
+        ActivitySort sort = ActivitySort.NewestFirst)
@@ -19,1 +24,3 @@
-        return await historyService.ProjectActivity(skip, take).ToArrayAsync();
+        return await historyService.ProjectActivity(skip, take,
+            new ActivityQuery(authorFilterKeys, changeTypeKeys, sort)).ToArrayAsync();
+    }
```

### HistoryServiceJsInvokable

other · +2 -0 · low-signal (whitespace)

```diff
@@ -27,0 +27,1 @@
+
@@ -33,0 +33,1 @@
+
```

### HistoryServiceJsInvokable.ListActivityAuthors

method · +5 -0

```diff
@@ -28,0 +28,5 @@
+    [JSInvokable]
+    public Task<ActivityAuthor[]> ListActivityAuthors()
+    {
+        return historyService.ListActivityAuthors();
+    }
```

### HistoryServiceJsInvokable.ListActivityChangeTypes

method · +4 -0

```diff
@@ -34,0 +34,4 @@
+    [JSInvokable]
+    public Task<ActivityChangeType[]> ListActivityChangeTypes()
+    {
+        return historyService.ListActivityChangeTypes();
```

## backend/FwLite/FwLiteShared/TypeGen/ReinforcedFwLiteTypingConfig.cs

> AI: This file registers new history/activity types for TypeScript generation. Check that the added types and enum match the new activity API.

### ReinforcedFwLiteTypingConfig.ConfigureFwLiteSharedTypes

method · +4 -0

```diff
@@ -177,0 +178,3 @@
+            typeof(ActivityAuthor),
+            typeof(ActivityChangeType),
+            typeof(ActivityQuery),
@@ -187,0 +191,1 @@
+        builder.ExportAsEnum<ActivitySort>().UseString();
```

## backend/FwLite/FwLiteWeb/Routes/ActivityRoutes.cs

> AI: The activity endpoint gains query params for filtering and sorting, plus two new routes for authors and change types.

### ActivityRoutes.MapActivities

method · +10 -1

```diff
@@ -21,1 +21,10 @@
-        group.MapGet("/", (HistoryService historyService, int skip, int take) => historyService.ProjectActivity(skip, take));
+        group.MapGet("/", (
+            HistoryService historyService,
+            int skip = 0,
+            int take = 100,
+            string[]? authorFilterKeys = null,
+            string[]? changeTypeKeys = null,
+            ActivitySort sort = ActivitySort.NewestFirst) =>
+            historyService.ProjectActivity(skip, take, new ActivityQuery(authorFilterKeys, changeTypeKeys, sort)));
+        group.MapGet("/authors", (HistoryService historyService) => historyService.ListActivityAuthors());
+        group.MapGet("/change-types", (HistoryService historyService) => historyService.ListActivityChangeTypes());
```

## frontend/viewer/src/lib/activity/utils.ts

> AI: New shared utils for the activity feature: filter types, constants, server-query mapping, and author sort helpers. Check the filter selection logic.

### lines 1–98

other · +38 -0

> AI: Declares the constants, types, and empty-load default the rest of the file and its callers build on.

```diff
@@ -0,0 +1,28 @@
+import {ActivitySort, type IActivityAuthor, type IActivityQuery, type IProjectActivity} from '$lib/dotnet-types';
+
+export const ALL_AUTHORS = '__all__';
+export const UNKNOWN_AUTHOR_KEY = '__unknown__';
+export const FIELDWORKS_AUTHOR_KEY = authorFilterKey({authorName: 'FieldWorks'});
+export const ALL_CHANGE_TYPES = '__all__';
+export const MIN_VISIBLE_FILTERED = 20;
+
+export type ActivityLoad = {
+  items: IProjectActivity[];
+  hasMorePages: boolean;
+  queryKey: string;
+};
+
+export const emptyActivityLoad: ActivityLoad = {
+  items: [],
+  hasMorePages: true,
+  queryKey: '',
+};
+
+export type MultiFilterSelection = string[] | 'all';
+
+export type ActivityFilters = {
+  authorFilterKeys: MultiFilterSelection;
+  changeTypeFilterKeys: MultiFilterSelection;
+  sort: ActivitySort;
+};
+
@@ -36,0 +36,1 @@
+
@@ -40,0 +40,1 @@
+
@@ -44,0 +44,1 @@
+
@@ -52,0 +52,1 @@
+
@@ -56,0 +56,1 @@
+
@@ -64,0 +64,1 @@
+
@@ -70,0 +70,1 @@
+
@@ -77,0 +77,1 @@
+
@@ -83,0 +83,1 @@
+
@@ -98,0 +98,1 @@
+
```

### createDefaultActivityFilters

method · +7 -0

```diff
@@ -29,0 +29,7 @@
+export function createDefaultActivityFilters(): ActivityFilters {
+  return {
+    authorFilterKeys: 'all',
+    changeTypeFilterKeys: 'all',
+    sort: ActivitySort.NewestFirst,
+  };
+}
```

### isAllFilterSelection

method · +3 -0

```diff
@@ -37,0 +37,3 @@
+export function isAllFilterSelection(selected: MultiFilterSelection, allKeys: string[]): boolean {
+  return selected === 'all' || (allKeys.length > 0 && selected.length === allKeys.length && allKeys.every(k => selected.includes(k)));
+}
```

### resolveFilterKeys

method · +3 -0

```diff
@@ -41,0 +41,3 @@
+export function resolveFilterKeys(selected: MultiFilterSelection, allKeys: string[]): string[] {
+  return selected === 'all' ? allKeys : selected;
+}
```

### toServerQuery

method · +7 -0

```diff
@@ -45,0 +45,7 @@
+export function toServerQuery(filters: ActivityFilters): IActivityQuery {
+  return {
+    authorFilterKeys: filters.authorFilterKeys === 'all' ? undefined : filters.authorFilterKeys,
+    changeTypeKeys: filters.changeTypeFilterKeys === 'all' ? undefined : filters.changeTypeFilterKeys,
+    sort: filters.sort,
+  };
+}
```

### serverQueryKey

method · +3 -0

```diff
@@ -53,0 +53,3 @@
+export function serverQueryKey(filters: ActivityFilters): string {
+  return JSON.stringify(toServerQuery(filters));
+}
```

### formatJsonForUi

method · +5 -4

```diff
@@ -3,4 +59,5 @@
-    .split('\n') // Split into lines
-    .slice(1, -1) // Remove the first and last line
-    .map(line => line.slice(2)) // Remove one level of indentation
-    .join('\n'); // Join the lines back together;
+    .split('\n')
+    .slice(1, -1)
+    .map(line => line.slice(2))
+    .join('\n');
+}
```

### authorFilterKey

method · +5 -0

```diff
@@ -65,0 +65,5 @@
+export function authorFilterKey(author: Omit<IActivityAuthor, 'commitCount'>): string {
+  if (!author.authorId && !author.authorName) return UNKNOWN_AUTHOR_KEY;
+  if (author.authorId) return author.authorId;
+  return `name:${author.authorName}`;
+}
```

### authorSortRank

method · +6 -0

```diff
@@ -71,0 +71,6 @@
+function authorSortRank(author: IActivityAuthor): number {
+  const key = authorFilterKey(author);
+  if (key === UNKNOWN_AUTHOR_KEY) return 0; // 1st
+  if (key === FIELDWORKS_AUTHOR_KEY) return 1; // 2nd
+  return 2;
+}
```

### compareActivityAuthors

method · +5 -0

```diff
@@ -78,0 +78,5 @@
+export function compareActivityAuthors(a: IActivityAuthor, b: IActivityAuthor): number {
+  const rankDiff = authorSortRank(a) - authorSortRank(b);
+  if (rankDiff !== 0) return rankDiff;
+  return (a.authorName || '').localeCompare(b.authorName || '');
+}
```

### applyMultiSelectValue

method · +14 -0

> AI: Clicking the 'all' key toggles between selecting all and clearing to empty.

```diff
@@ -84,0 +84,14 @@
+export function applyMultiSelectValue(
+  value: string[],
+  allKeys: string[],
+  allKey: string,
+  currentSelection: MultiFilterSelection,
+): MultiFilterSelection {
+  if (value.includes(allKey)) {
+    return isAllFilterSelection(currentSelection, allKeys) ? [] : 'all';
+  }
+  if (isAllFilterSelection(value, allKeys)) {
+    return 'all';
+  }
+  return value;
+}
```

### hasActiveServerSideFilters

method · +2 -0

```diff
@@ -99,0 +99,2 @@
+export function hasActiveServerSideFilters(filters: ActivityFilters): boolean {
+  return filters.authorFilterKeys !== 'all' || filters.changeTypeFilterKeys !== 'all';
```

## frontend/viewer/src/lib/activity/ActivityItemChangePreview.svelte

### template

markup-region · +26 -28

```diff
@@ -58,1 +58,1 @@
-    <DropdownMenu.Trigger class={cn('text-base w-fit mr-2 justify-between', deleted && 'pointer-events-none')}>
+    <DropdownMenu.Trigger class={cn('text-base w-fit mr-2 justify-between flex-wrap whitespace-break-spaces text-start min-h-max py-1.5', deleted && 'pointer-events-none')}>
@@ -94,11 +94,10 @@
-  <div class="@container">
-    <div class="flex flex-wrap gap-2 @lg:grid @lg:grid-cols-[2fr_4fr_auto] mb-3 items-center content-center justify-center">
-      {#if context.affectedEntries.length === 1}
-        <!--
-        If there are more than 1 affected entries (e.g. complex-form-components that link two entries together)
-        then the preview should be more explicit about what role the entries have and thus should be handled below
-        based on the entity type.
-        -->
-        {@const entry = context.affectedEntries[0]}
-        {@render entryButton(entry)}
-      {/if}
+  <div class="flex flex-wrap gap-2 mb-3 items-center content-center justify-between">
+    {#if context.affectedEntries.length === 1}
+      <!--
+      If there are more than 1 affected entries (e.g. complex-form-components that link two entries together)
+      then the preview should be more explicit about what role the entries have and thus should be handled below
+      based on the entity type.
+      -->
+      {@const entry = context.affectedEntries[0]}
+      {@render entryButton(entry)}
+    {/if}
@@ -106,14 +105,13 @@
-      <label class={cn(
-        'w-fit flex items-center gap-2 border rounded p-2 px-4 bg-secondary/25',
-        currentEntity && 'cursor-pointer')}>
-        <FormatRelativeDate date={activity.timestamp}
-                            live
-                            actualDateOptions={{ dateStyle: 'medium', timeStyle: 'short' }}/>
-        <Switch disabled={!currentEntity} bind:checked={selectedShowCurrent} class="text-destructive" />
-        {#if currentEntity}
-          <span>{$t`Current version`}</span>
-        {:else}
-          <span class="text-destructive">{$t`Deleted`}</span>
-        {/if}
-      </label>
-    </div>
+    <label class={cn(
+      'w-fit flex items-center gap-2 border rounded p-2 px-4 bg-secondary/25',
+      currentEntity && 'cursor-pointer')}>
+      <FormatRelativeDate date={activity.timestamp}
+                          live
+                          actualDateOptions={{ dateStyle: 'medium', timeStyle: 'short' }}/>
+      <Switch disabled={!currentEntity} bind:checked={selectedShowCurrent} class="text-destructive" />
+      {#if currentEntity}
+        <span>{$t`Current version`}</span>
+      {:else}
+        <span class="text-destructive">{$t`Deleted`}</span>
+      {/if}
+    </label>
@@ -150,1 +148,1 @@
-    <div class="flex gap-x-2 items-baseline">
+    <div class="flex flex-wrap gap-2 items-baseline">
@@ -158,1 +156,1 @@
-    <div class="flex gap-x-2 items-baseline">
+    <div class="flex flex-wrap gap-2 items-baseline">
```

## frontend/viewer/src/lib/services/history-service.ts

> AI: This service drops the fetch fallbacks and now calls the JS invokable directly, guarded by ensureLoaded. Look at the new activity filter args and author/change-type methods.

### lines 1–32

other · +14 -1

```diff
@@ -1,1 +1,12 @@
-import type {IEntry, IExampleSentence, IHistoryLineItem, IProjectActivity, ISense} from '$lib/dotnet-types';
+import {
+  ActivitySort,
+  type IActivityAuthor,
+  type IActivityChangeType,
+  type IActivityQuery,
+  type IChangeContext,
+  type IEntry,
+  type IExampleSentence,
+  type IHistoryLineItem,
+  type IProjectActivity,
+  type ISense,
+} from '$lib/dotnet-types';
@@ -19,0 +31,2 @@
+export type {IActivityQuery, IActivityAuthor, IActivityChangeType};
+
```

### HistoryService.historyApi

method · +0 -6

> AI: Removes the dev-only code that randomly returned undefined.

```diff
@@ -22,6 +35,0 @@
-    if (import.meta.env.DEV) {
-      //randomly return undefined to test fallback
-      if (Math.random() < 0.5) {
-        return undefined;
-      }
-    }
```

### HistoryService

other · +3 -0 · low-signal (whitespace)

```diff
@@ -20,0 +34,1 @@
+
@@ -76,0 +76,1 @@
+
@@ -81,0 +81,1 @@
+
```

### HistoryService.load

method · +2 -2

```diff
@@ -39,2 +47,2 @@
-    const data = await (this.historyApi?.getHistory(objectId) ?? fetch(`/api/history/${this.projectContext.projectCode}/${objectId}`)
-      .then(res => res.json())) as HistoryItem[];
+    this.ensureLoaded();
+    const data = await this.historyApi.getHistory(objectId) as HistoryItem[];
```

### HistoryService.fetchSnapshot

method · +2 -3

```diff
@@ -50,3 +58,2 @@
-    const data = (await this.historyApi?.getObject(history.commitId, objectId)
-      ?? await fetch(`/api/history/${this.projectContext.projectCode}/snapshot/commit/${history.commitId}?entityId=${objectId}`)
-          .then(res => res.json())) as EntityType['entity'];
+    this.ensureLoaded();
+    const data = (await this.historyApi.getObject(history.commitId, objectId)) as EntityType['entity'];
```

### HistoryService.listActivityAuthors

method · +4 -3

> AI: The old activity method is replaced here by listActivityAuthors; activity moves to a later chunk.

```diff
@@ -65,3 +72,4 @@
-  async activity(projectCode: string, skip: number, take: number): Promise<IProjectActivity[]> {
-    return await (this.historyApi?.projectActivity(skip, take)
-        ?? fetch(`/api/activity/${projectCode}?skip=${skip}&take=${take}`).then(res => res.json())) as IProjectActivity[];
+  async listActivityAuthors(): Promise<IActivityAuthor[]> {
+    this.ensureLoaded();
+    return await this.historyApi.listActivityAuthors();
+  }
```

### HistoryService.listActivityChangeTypes

method · +4 -0

```diff
@@ -77,0 +77,4 @@
+  async listActivityChangeTypes(): Promise<IActivityChangeType[]> {
+    this.ensureLoaded();
+    return await this.historyApi.listActivityChangeTypes();
+  }
```

### HistoryService.activity

method · +8 -0

> AI: New activity passes filter keys and a sort defaulting to NewestFirst.

```diff
@@ -82,0 +82,8 @@
+  async activity(skip: number, take: number, query?: IActivityQuery): Promise<IProjectActivity[]> {
+    this.ensureLoaded();
+    return await this.historyApi.projectActivity(
+        skip,
+        take,
+        query?.authorFilterKeys,
+        query?.changeTypeKeys,
+        query?.sort ?? ActivitySort.NewestFirst);
```

### HistoryService.loadChangeContext

method · +2 -2

```diff
@@ -70,1 +92,1 @@
-  loadChangeContext(commitId: string, changeIndex: number) {
+  async loadChangeContext(commitId: string, changeIndex: number): Promise<IChangeContext> {
@@ -72,1 +94,1 @@
-    return this.projectContext.historyService!.loadChangeContext(commitId, changeIndex);
+    return this.historyApi.loadChangeContext(commitId, changeIndex);
```

### HistoryService.ensureLoaded

method · +1 -1

> AI: ensureLoaded now asserts loaded and historyApi so callers can drop null checks.

```diff
@@ -75,1 +97,1 @@
-  private ensureLoaded() {
+  private ensureLoaded(): asserts this is {loaded: true, historyApi: IHistoryServiceJsInvokable} {
```

## frontend/viewer/src/lib/activity/ActivityFilter.svelte

> AI: New ActivityFilter component: multi-select author and change-type dropdowns plus a sort menu, all reading and writing a bindable filters prop.

### script.fragment 1

other · +37 -0

> AI: filters prop is $bindable, defaulting to createDefaultActivityFilters().

```diff
@@ -0,0 +1,37 @@
+<script lang="ts">
+  import flexLogo from '$lib/assets/flex-logo.png';
+  import {useHistoryService} from '$lib/services/history-service';
+  import {t} from 'svelte-i18n-lingui';
+  import {resource} from 'runed';
+  import {SidebarTrigger} from '$lib/components/ui/sidebar';
+  import {ActivitySort} from '$lib/dotnet-types';
+  import * as Select from '$lib/components/ui/select';
+  import * as ResponsiveMenu from '$lib/components/responsive-menu';
+  import {Button, buttonVariants} from '$lib/components/ui/button';
+  import {badgeVariants} from '$lib/components/ui/badge';
+  import {cn} from '$lib/utils';
+  import {Icon} from '$lib/components/ui/icon';
+  import type {IconClass} from '$lib/icon-class';
+  import {
+    ALL_AUTHORS,
+    ALL_CHANGE_TYPES,
+    FIELDWORKS_AUTHOR_KEY,
+    UNKNOWN_AUTHOR_KEY,
+    applyMultiSelectValue,
+    authorFilterKey,
+    compareActivityAuthors,
+    createDefaultActivityFilters,
+    isAllFilterSelection,
+    resolveFilterKeys,
+    type ActivityFilters,
+    type MultiFilterSelection,
+  } from './utils';
+
+  type Props = {
+    filters?: ActivityFilters;
+  };
+
+  let {filters = $bindable(createDefaultActivityFilters())}: Props = $props();
+
+  const historyService = useHistoryService();
+
```

### script.fragment 2

other · +36 -0

> AI: Loads authors and change types from the history service and derives select values and sort labels.

```diff
@@ -38,0 +38,36 @@
+  const authors = resource(
+    () => historyService.loaded,
+    async (loaded) => {
+      if (!loaded) return [];
+      const data = await historyService.listActivityAuthors();
+      if (Array.isArray(data)) {
+        return data.sort(compareActivityAuthors);
+      }
+      return [];
+    },
+    {initialValue: []},
+  );
+
+  const changeTypes = resource(
+    () => historyService.loaded,
+    async (loaded) => {
+      if (!loaded) return [];
+      const data = await historyService.listActivityChangeTypes();
+      return Array.isArray(data) ? data : [];
+    },
+    {initialValue: []},
+  );
+
+  const authorKeys = $derived(authors.current.map(authorFilterKey));
+  const changeTypeKeys = $derived(changeTypes.current.map(ct => ct.key));
+
+  const authorSelectValue = $derived(resolveFilterKeys(filters.authorFilterKeys, authorKeys));
+  const changeTypeSelectValue = $derived(resolveFilterKeys(filters.changeTypeFilterKeys, changeTypeKeys));
+
+  const sortLabels = $derived<Record<ActivitySort, string>>({
+    [ActivitySort.NewestFirst]: $t`Newest first`,
+    [ActivitySort.OldestFirst]: $t`Oldest first`,
+    [ActivitySort.SyncedNewestFirst]: $t`Synced newest`,
+    [ActivitySort.SyncedOldestFirst]: $t`Synced oldest`,
+  });
+
```

### script.fragment 3

other · +11 -0

```diff
@@ -74,0 +74,7 @@
+  const sortIcons: Record<ActivitySort, IconClass> = {
+    [ActivitySort.NewestFirst]: 'i-mdi-sort-clock-descending',
+    [ActivitySort.OldestFirst]: 'i-mdi-sort-clock-ascending',
+    [ActivitySort.SyncedNewestFirst]: 'i-mdi-cloud-arrow-down',
+    [ActivitySort.SyncedOldestFirst]: 'i-mdi-cloud-arrow-up',
+  };
+
@@ -86,0 +86,1 @@
+
@@ -92,0 +92,1 @@
+
@@ -96,0 +96,1 @@
+
@@ -100,0 +100,1 @@
+</script>
```

### script.authorKeyToLabel

method · +5 -0

```diff
@@ -81,0 +81,5 @@
+  function authorKeyToLabel(key: string): string {
+    if (key === UNKNOWN_AUTHOR_KEY) return $t`Unknown`;
+    const author = authors.current.find(a => authorFilterKey(a) === key);
+    return author?.authorName ?? key;
+  }
```

### script.allSelectionIcon

method · +5 -0

```diff
@@ -87,0 +87,5 @@
+  function allSelectionIcon(selected: MultiFilterSelection, allKeys: string[]): IconClass | undefined {
+    if (selected === 'all' || isAllFilterSelection(selected, allKeys)) return 'i-mdi-check';
+    if (selected.length === 0) return undefined;
+    return 'i-mdi-minus';
+  }
```

### script.onAuthorValueChange

method · +3 -0

```diff
@@ -93,0 +93,3 @@
+  function onAuthorValueChange(value: string[]) {
+    filters.authorFilterKeys = applyMultiSelectValue(value, authorKeys, ALL_AUTHORS, filters.authorFilterKeys);
+  }
```

### script.onChangeTypeValueChange

method · +3 -0

```diff
@@ -97,0 +97,3 @@
+  function onChangeTypeValueChange(value: string[]) {
+    filters.changeTypeFilterKeys = applyMultiSelectValue(value, changeTypeKeys, ALL_CHANGE_TYPES, filters.changeTypeFilterKeys);
+  }
```

### template.fragment 1

markup-region · +39 -0

```diff
@@ -101,0 +101,39 @@
+
+{#snippet authorLabel(key: string)}
+  {@const label = authorKeyToLabel(key)}
+  <span class="inline-flex items-center gap-1">
+    {#if key === UNKNOWN_AUTHOR_KEY}
+      <span class="italic">{$t`Unknown`}</span>
+    {:else}
+      {label}
+    {/if}
+    {#if key === FIELDWORKS_AUTHOR_KEY}
+      <Icon class="size-5" src={flexLogo} alt={$t`FieldWorks logo`} />
+    {/if}
+  </span>
+{/snippet}
+
+<div class="flex flex-col gap-2 mb-1">
+  <div class="flex flex-wrap gap-2">
+    <SidebarTrigger icon="i-mdi-menu" class="aspect-square p-0 shrink-0" />
+
+    <Select.Root type="multiple" value={authorSelectValue} onValueChange={onAuthorValueChange}>
+      <Select.Trigger class="w-32 max-w-full grow">
+        {#if isAllFilterSelection(filters.authorFilterKeys, authorKeys)}
+          {$t`All authors`}
+        {:else if filters.authorFilterKeys.length === 0}
+          {$t`No authors`}
+        {:else if filters.authorFilterKeys.length === 1}
+          {@render authorLabel(filters.authorFilterKeys[0])}
+        {:else}
+          {$t`${filters.authorFilterKeys.length} authors`}
+        {/if}
+      </Select.Trigger>
+      <Select.Content>
+        <Select.Item value={ALL_AUTHORS} label={$t`All authors`}>
+          {#snippet selectedIndicator()}
+            {@const icon = allSelectionIcon(filters.authorFilterKeys, authorKeys)}
+            {#if icon}
+              <Icon {icon} class="size-4" />
+            {/if}
+          {/snippet}
```

### template.fragment 2

markup-region · +40 -0

```diff
@@ -140,0 +140,40 @@
+          <span class="font-bold">{$t`All authors`}</span>
+        </Select.Item>
+        {#each authors.current as author (authorFilterKey(author))}
+          {@const key = authorFilterKey(author)}
+          <Select.Item value={key} label={author.authorName ?? $t`Unknown`}>
+            {@render authorLabel(key)}
+            <span class="text-muted-foreground ml-1">({author.commitCount})</span>
+          </Select.Item>
+        {/each}
+      </Select.Content>
+    </Select.Root>
+
+    <Select.Root type="multiple" value={changeTypeSelectValue} onValueChange={onChangeTypeValueChange}>
+      <Select.Trigger class="w-44 max-w-full grow">
+        {#if isAllFilterSelection(filters.changeTypeFilterKeys, changeTypeKeys)}
+          {$t`All activity types`}
+        {:else if filters.changeTypeFilterKeys.length === 0}
+          {$t`No activity types`}
+        {:else if filters.changeTypeFilterKeys.length === 1}
+          {changeTypes.current.find(ct => ct.key === filters.changeTypeFilterKeys[0])?.label ?? filters.changeTypeFilterKeys[0]}
+        {:else}
+          {$t`${filters.changeTypeFilterKeys.length} activity types`}
+        {/if}
+      </Select.Trigger>
+      <Select.Content>
+        <Select.Item value={ALL_CHANGE_TYPES} label={$t`All activity types`}>
+          {#snippet selectedIndicator()}
+            {@const icon = allSelectionIcon(filters.changeTypeFilterKeys, changeTypeKeys)}
+            {#if icon}
+              <Icon {icon} class="size-4" />
+            {/if}
+          {/snippet}
+          <span class="font-bold">{$t`All activity types`}</span>
+        </Select.Item>
+        {#each changeTypes.current as changeType (changeType.key)}
+          <Select.Item value={changeType.key} label={changeType.label}>
+            {changeType.label}
+            <span class="text-muted-foreground ml-1">({changeType.commitCount})</span>
+          </Select.Item>
+        {/each}
```

### template.fragment 3

markup-region · +24 -0

```diff
@@ -180,0 +180,24 @@
+      </Select.Content>
+    </Select.Root>
+  </div>
+
+  <ResponsiveMenu.Root>
+    <ResponsiveMenu.Trigger class={cn(buttonVariants({variant: 'secondary', size: 'xs'}), badgeVariants({variant: 'secondary'}), 'border-none h-7')}>
+      {#snippet child({props})}
+        <Button {...props} icon={sortIcons[filters.sort]} iconProps={{class: 'size-4'}}>
+          {sortLabels[filters.sort]}
+        </Button>
+      {/snippet}
+    </ResponsiveMenu.Trigger>
+    <ResponsiveMenu.Content align="start">
+      {#each Object.values(ActivitySort) as sortOption (sortOption)}
+        <ResponsiveMenu.Item
+          onSelect={() => filters.sort = sortOption}
+          class={cn(filters.sort === sortOption && 'bg-muted')}>
+          <Icon icon={sortIcons[sortOption]} />
+          {sortLabels[sortOption]}
+        </ResponsiveMenu.Item>
+      {/each}
+    </ResponsiveMenu.Content>
+  </ResponsiveMenu.Root>
+</div>
```

## frontend/viewer/src/lib/activity/ActivityItem.svelte

> AI: Adds an optional History button on each change and a HistoryView dialog it opens; also adds cloud icons to the synced/not-synced labels.

### script

other · +6 -0

```diff
@@ -31,0 +32,3 @@
+  import {Button} from '$lib/components/ui/button';
+  import HistoryView from '$lib/history/HistoryView.svelte';
+  import {Icon} from '$lib/components/ui/icon';
@@ -34,0 +38,1 @@
+    showHistoryButton?: boolean;
@@ -38,0 +43,1 @@
+    showHistoryButton = false,
@@ -43,0 +49,1 @@
+  let openHistoryId = $state<string>()
```

### template

markup-region · +26 -9

```diff
@@ -75,5 +81,10 @@
-                <T msg="Synced: #">
-                  <FormatRelativeDate
-                    class="font-semibold"
-                    date={new Date(activity.metadata.extraMetadata['SyncDate'])} />
-                </T>
+                <span class="inline-flex gap-2 items-center">
+                  <Icon icon="i-mdi-cloud-outline" class="size-4 shrink-0" />
+                  <span>
+                    <T msg="Synced: #">
+                      <FormatRelativeDate
+                        class="font-semibold"
+                        date={new Date(activity.metadata.extraMetadata['SyncDate'])} />
+                    </T>
+                  </span>
+                </span>
@@ -87,1 +98,2 @@
-          <span class="text-red-500 font-semibold" title={$t`These changes have not been uploaded yet. Ensure you're online and logged in to share your changes.`}>
+          <span class="inline-flex gap-2 items-center font-semibold" title={$t`These changes have not been uploaded yet. Ensure you're online and logged in to share your changes.`}>
+            <Icon icon="i-mdi-cloud-off-outline" class="size-4 shrink-0 text-muted-foreground" />
@@ -92,0 +105,5 @@
+    
+    {#if openHistoryId}
+    <!-- this is a dialog so it doesn't matter where it is in the DOM -->
+        <HistoryView bind:open={() => !!openHistoryId, (open) => (open ? undefined : openHistoryId = undefined)} id={openHistoryId} selectedCommitId={activity.commitId}/>
+    {/if}
@@ -111,2 +128,8 @@
-                  <div class="px-4 pt-2 flex font-semibold">
-                    <span>{context.changeName}</span>
+                  <div class="px-4 pt-2 flex font-semibold items-center">
+                    <span class="grow">{context.changeName}</span>
+
+                    {#if showHistoryButton}
+                      <Button icon="i-mdi-history" onclick={() => openHistoryId = context.snapshot?.id}>
+                        {$t`History`}
+                      </Button>
+                    {/if}
@@ -114,1 +137,1 @@
-                  <Tabs.Root value="preview" class="px-2 mt-2">
+                  <Tabs.Root value="preview" class="px-2 mt-2 grow">
```

## frontend/viewer/src/lib/activity/ActivityView.svelte

> AI: Reworks activity loading to use a filter panel and server-side query with page-based paging, plus loading/error UI. Check the resource rewrite and the auto-paging effects.

### script.fragment 1

other · +36 -16

> AI: Drops projectCode/loadCount paging for filter-driven queryKey, serverQuery, and pageCount inputs.

```diff
@@ -4,3 +4,1 @@
-  import {useProjectContext} from '$project/project-context.svelte';
-  import {resource} from 'runed';
-  import {SidebarTrigger} from '$lib/components/ui/sidebar';
+  import {Debounced, resource} from 'runed';
@@ -10,0 +9,4 @@
+  import ActivityFilter from './ActivityFilter.svelte';
+  import Loading from '$lib/components/Loading.svelte';
+  import {Icon} from '$lib/components/ui/icon';
+  import {AppNotification} from '$lib/notifications/notifications';
@@ -11,0 +14,10 @@
+  import {
+    createDefaultActivityFilters,
+    emptyActivityLoad,
+    hasActiveServerSideFilters,
+    MIN_VISIBLE_FILTERED,
+    serverQueryKey,
+    toServerQuery,
+    type ActivityFilters,
+    type ActivityLoad,
+  } from './utils';
@@ -14,1 +25,0 @@
-  const projectContext = useProjectContext();
@@ -17,2 +28,7 @@
-  const BATCH_SIZE = THRESHOLD * 4;
-  let loadCount = $state(BATCH_SIZE);
+  const BATCH_SIZE = THRESHOLD * 2;
+
+  let filters = $state<ActivityFilters>(createDefaultActivityFilters());
+  let pageCount = $state(1);
+
+  const queryKey = $derived.by(() => serverQueryKey(filters));
+  const serverQuery = $derived.by(() => toServerQuery(filters));
@@ -21,9 +37,13 @@
-    [() => projectContext.projectCode, () => loadCount],
-    async ([projectCode, loadCount], [_, prevLoadCount]): Promise<IProjectActivity[]> => {
-      if (!projectCode) return [];
-
-      prevLoadCount ??= 0;
-      const skip = prevLoadCount;
-      const take = loadCount - prevLoadCount;
-      const data = (await historyService.activity(projectCode, skip, take));
-      console.debug('Activity data', skip, take, data);
+    [() => queryKey, () => pageCount, () => serverQuery, () => historyService.loaded],
+    async ([key, pages, query, loaded], _previous, current): Promise<ActivityLoad> => {
+      if (!loaded) return emptyActivityLoad;
+
+      if (pages > 1 && current.data?.queryKey !== key) {
+        return current.data ?? emptyActivityLoad;
+      }
+
+      const skip = (pages - 1) * BATCH_SIZE;
+      const data = await historyService.activity(skip, BATCH_SIZE, query);
+      if (key !== queryKey || pages !== pageCount) {
+        return current.data ?? emptyActivityLoad;
+      }
@@ -32,1 +52,1 @@
-        return [];
+        return {items: [], hasMorePages: false, queryKey: key};
```

### script.fragment 2

other · +30 -7

```diff
@@ -34,7 +54,9 @@
-
-      const activityData = [...activity.current, ...data];
-      selectedRow ??= activityData[0];
-      return activityData;
-    },
-    {
-      initialValue: [],
+      const prev =
+        pages > 1 && current.data?.queryKey === key
+          ? current.data.items
+          : [];
+      return {
+        items: [...prev, ...data],
+        hasMorePages: data.length >= BATCH_SIZE,
+        queryKey: key,
+      };
@@ -41,0 +64,8 @@
+    {initialValue: emptyActivityLoad},
+  );
+
+  const loading = new Debounced(() => activity.loading, 0);
+  const loadedQueryKey = $derived(activity.current?.queryKey ?? '');
+  const awaitingFreshData = $derived(loadedQueryKey !== queryKey);
+  const hasMorePages = $derived(
+    awaitingFreshData ? true : (activity.current?.hasMorePages ?? true),
@@ -43,0 +74,13 @@
+  $effect(() => {
+    if (activity.error) {
+      AppNotification.error($t`Failed to load activity`, activity.error.message);
+    }
+  });
+
+  const visibleActivity = $derived.by(() => {
+    if (awaitingFreshData) {
+      return null;
+    }
+    return activity.current?.items ?? [];
+  });
+
```

### script.fragment 3

other · +30 -0

> AI: Effects reset selectedRow, bump pageCount to fill filtered results, and reset pages when the query changes.

```diff
@@ -45,0 +89,30 @@
+
+  $effect(() => {
+    const visible = visibleActivity;
+    if (!visible?.length) {
+      selectedRow = undefined;
+      return;
+    }
+    if (!selectedRow || !visible.some(a => a.commitId === selectedRow?.commitId)) {
+      selectedRow = visible[0];
+    }
+  });
+
+  $effect(() => {
+    if (!hasActiveServerSideFilters(filters) || activity.loading || visibleActivity === null || !hasMorePages) return;
+    const filtered = visibleActivity.length;
+    const loaded = activity.current?.items.length ?? 0;
+    if (filtered < MIN_VISIBLE_FILTERED && loaded >= (pageCount - 1) * BATCH_SIZE && loaded > 0) {
+      pageCount += 1;
+    }
+  });
+
+  let prevQueryKey = '';
+  $effect.pre(() => {
+    const key = queryKey;
+    if (prevQueryKey && prevQueryKey !== key) {
+      pageCount = 1;
+    }
+    prevQueryKey = key;
+  });
+
```

### script.onListScroll

method · +3 -3

```diff
@@ -47,1 +120,1 @@
-    if (!vlist) return;
+    if (!vlist || visibleActivity === null) return;
@@ -50,2 +123,2 @@
-    if (endIndex + THRESHOLD >= loadCount) {
-      loadCount += BATCH_SIZE;
+    if (endIndex + THRESHOLD >= visibleActivity.length && hasMorePages && !activity.loading) {
+      pageCount += 1;
```

### template

markup-region · +32 -17

> AI: Adds loading/error branches, an unsynced-changes icon, and an Unknown author fallback.

```diff
@@ -56,3 +129,2 @@
-{#if activity.current.length}
-  <div class="h-full m-4 grid gap-x-6 gap-y-1 overflow-hidden"
-       style="grid-template-rows: auto minmax(0,100%); minmax(min-content, 1fr) minmax(min-content, 2fr); grid-template-columns: 1fr 2fr">
+<div class="h-full m-4 grid gap-x-6 gap-y-1 overflow-hidden"
+     style="grid-template-rows: auto minmax(0,100%); grid-template-columns: minmax(8rem,25%) 2fr">
@@ -60,2 +132,1 @@
-    <SidebarTrigger icon="i-mdi-menu" class="aspect-square p-0" />
-    <div class="gap-4 overflow-hidden row-start-2">
+  <ActivityFilter bind:filters />
@@ -63,1 +134,12 @@
-            <VList bind:this={vlist} data={activity.current ?? []}
+  <div class="gap-4 overflow-hidden row-start-2 relative">
+    {#if activity.error && awaitingFreshData}
+      <div class="flex h-full items-center justify-center gap-2 text-muted-foreground">
+        <Icon icon="i-mdi-alert-circle-outline" />
+        <p>{$t`Failed to load activity`}</p>
+      </div>
+    {:else if awaitingFreshData}
+      <div class="flex h-full items-center justify-center">
+        <Loading class="size-8 text-muted-foreground" aria-label={$t`Loading activity`} />
+      </div>
+    {:else if visibleActivity && visibleActivity.length}
+      <VList bind:this={vlist} data={visibleActivity}
@@ -66,1 +148,1 @@
-              getKey={row => row.commitId} bufferSize={400}>
+             getKey={row => row.commitId} bufferSize={400}>
@@ -73,2 +155,8 @@
-            <div class="text-sm text-muted-foreground flex flex-wrap gap-x-2 justify-between">
-              <span>
+            <div class="text-sm text-muted-foreground flex flex-wrap gap-x-2 justify-between items-center">
+              <span class="flex items-center gap-1">
+                {#if !row.metadata.extraMetadata['SyncDate']}
+                  <Icon
+                    icon="i-mdi-cloud-off-outline"
+                    class="size-4 shrink-0 text-muted-foreground"
+                    title={$t`These changes have not been uploaded yet. Ensure you're online and logged in to share your changes.`} />
+                {/if}
@@ -79,1 +167,1 @@
-                {row.metadata.authorName}
+                {row.metadata.authorName ?? $t`Unknown`}
@@ -85,6 +173,2 @@
-      {#if activity.current.length === 0}
-        <div class="p-4 text-center opacity-75">{$t`No activity found`}</div>
-      {/if}
-    </div>
-    {#if selectedRow}
-      <ActivityItem class="sub-grid row-span-2 col-start-2" activity={selectedRow} />
+    {:else if !loading.current}
+      <div class="p-4 text-center opacity-75">{$t`No activity matches these filters`}</div>
@@ -93,1 +177,5 @@
-{/if}
+
+  {#if selectedRow}
+    <ActivityItem class="sub-grid row-span-2 col-start-2" activity={selectedRow} showHistoryButton />
+  {/if}
+</div>
```

## frontend/viewer/src/lib/history/HistoryView.svelte

> AI: Rewrites HistoryView to Svelte 5 runes and drives selection through a new bindable selectedCommitId prop instead of a local record.

### script.Props

other · +5 -2

```diff
@@ -11,2 +11,5 @@
-  export let id: string;
-  export let open: boolean;
+  interface Props {
+    id: string;
+    open: boolean;
+    selectedCommitId?: string | undefined;
+  }
```

### script

other · +16 -7

> AI: record is now derived from selectedCommitId, and load/reset run inside an $effect.

```diff
@@ -16,0 +16,6 @@
+
+  let {
+    id,
+    open = $bindable(),
+    selectedCommitId = $bindable(undefined)
+  }: Props = $props();
@@ -20,2 +29,1 @@
-  let loading = false;
-  let record: HistoryItem | undefined;
+  let loading = $state(false);
@@ -23,1 +31,1 @@
-  let history: HistoryItem[];
+  let history: HistoryItem[] = $state([]);
@@ -25,4 +32,0 @@
-  $: if (open && id) {
-    void load();
-  }
-  $: if (!open) reset();
@@ -52,0 +58,8 @@
+
+  let record = $derived(selectedCommitId ? history.find(h => h.commitId == selectedCommitId) : undefined);
+  $effect(() => {
+    if (open && id) {
+      void load();
+    }
+    if (!open) reset();
+  });
```

### script.load

method · +2 -1

> AI: load now seeds selectedCommitId from the first commit only when none is set.

```diff
@@ -35,1 +39,2 @@
-      record = history[0];
+      if (!selectedCommitId)
+        selectedCommitId = history[0]?.commitId;
```

### script.showEntry

method · +1 -1

```diff
@@ -46,1 +51,1 @@
-    record = row;
+    selectedCommitId = row.commitId;
```

### script.reset

method · +1 -1

```diff
@@ -50,1 +55,1 @@
-    record = undefined;
+    selectedCommitId = undefined;
```

### template

markup-region · +9 -7

> AI: Mostly reformatting; note the added changeTypes: [] passed to ActivityItem.

```diff
@@ -56,1 +69,2 @@
-  <Dialog.DialogContent interactOutsideBehavior={loading ? 'ignore' : 'close'} class="flex flex-col sm:min-h-[min(calc(100%-16px),30rem)] overflow-hidden w-[70rem]">
+  <Dialog.DialogContent interactOutsideBehavior={loading ? 'ignore' : 'close'}
+                        class="flex flex-col sm:min-h-[min(calc(100%-16px),30rem)] overflow-hidden w-[70rem]">
@@ -61,1 +75,2 @@
-      <div class="grid gap-x-6 gap-y-1 grow overflow-hidden" style="grid-template-columns: minmax(min-content, 1fr) minmax(min-content, 2fr);">
+      <div class="grid gap-x-6 gap-y-1 grow overflow-hidden"
+           style="grid-template-columns: minmax(min-content, 1fr) minmax(min-content, 2fr);">
@@ -67,2 +82,2 @@
-                    getKey={row => `${row.commitId}_${row.changeIndex}`}
-                    class="h-full p-0.5 md:pr-3 after:h-12 after:block !contain-content">
+                   getKey={row => `${row.commitId}_${row.changeIndex}`}
+                   class="h-full p-0.5 md:pr-3 after:h-12 after:block !contain-content">
@@ -78,1 +93,1 @@
-                              actualDateOptions={{ dateStyle: 'medium', timeStyle: 'short' }}/>
+                                          actualDateOptions={{ dateStyle: 'medium', timeStyle: 'short' }}/>
@@ -85,1 +100,1 @@
-                {/snippet}
+              {/snippet}
@@ -91,1 +106,1 @@
-            <ActivityItem activity={{...record, changes: [record.change]}} />
+            <ActivityItem activity={{...record, changes: [record.change], changeTypes: []}}/>
```

## frontend/viewer/src/lib/components/ui/select/select-item.svelte

> AI: Adds an optional `selectedIndicator` snippet prop so callers can override the default check icon. Check the new Props type and the template branch.

### script

other · +7 -1

```diff
@@ -4,0 +5,5 @@
+  import type {Snippet} from 'svelte';
+
+  type Props = WithoutChild<SelectPrimitive.ItemProps> & {
+    selectedIndicator?: Snippet;
+  };
@@ -11,0 +17,1 @@
+    selectedIndicator,
@@ -13,1 +19,1 @@
-  }: WithoutChild<SelectPrimitive.ItemProps> = $props();
+  }: Props = $props();
```

### template

markup-region · +3 -1

```diff
@@ -28,1 +34,3 @@
-      {#if selected}
+      {#if selectedIndicator}
+        {@render selectedIndicator()}
+      {:else if selected}
```

## frontend/viewer/src/lib/components/ui/select/select-trigger.svelte

> AI: This file's Select trigger gets a styling tweak. Look at the added class on the trigger element.

### template

markup-region · +1 -0

> AI: Adds ellipsis truncation and right margin to the trigger.

```diff
@@ -37,0 +38,1 @@
+      'x-ellipsis mr-4',
```

## frontend/viewer/src/lib/services/service-provider-dotnet.ts

> AI: This file wraps dotnet proxy calls. Look at the added try/catch around invokeMethodAsync that logs and rethrows errors.

### wrapInProxy.get

method · +8 -3

```diff
@@ -68,3 +68,8 @@
-        const result = await target.invokeMethodAsync(dotnetMethodName, ...args);
-        console.debug(`[Dotnet Proxy] ${serviceName} method ${dotnetMethodName} returned`, result);
-        return result;
+        try {
+          const result = await target.invokeMethodAsync(dotnetMethodName, ...args);
+          console.debug(`[Dotnet Proxy] ${serviceName} method ${dotnetMethodName} returned`, result);
+          return result;
+        } catch (error) {
+          console.error(`[Dotnet Proxy] ${serviceName} method ${dotnetMethodName} failed`, error);
+          throw error;
+        }
```

## frontend/viewer/src/locales/en.po

> AI: New activity filter/view UI strings added to the English catalog. Check the new msgids and their source-file references.

### fragment 1

other · +40 -0

```diff
@@ -40,0 +41,4 @@
+#: src/lib/activity/ActivityFilter.svelte
+msgid "{0} activity types"
+msgstr "{0} activity types"
+
@@ -45,0 +50,4 @@
+#: src/lib/activity/ActivityFilter.svelte
+msgid "{0} authors"
+msgstr "{0} authors"
+
@@ -187,0 +196,14 @@
+#. Filter option in activity view activity-type dropdown — show all kinds of edits.
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+msgid "All activity types"
+msgstr "All activity types"
+
+#. Filter option in activity view author dropdown — show commits from every author.
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+msgid "All authors"
+msgstr "All authors"
+
@@ -758,0 +781,6 @@
+#. Error message when the activity feed fails to load (toast and empty state).
+#: src/lib/activity/ActivityView.svelte
+#: src/lib/activity/ActivityView.svelte
+msgid "Failed to load activity"
+msgstr "Failed to load activity"
+
@@ -821,0 +850,1 @@
+#: src/lib/activity/ActivityFilter.svelte
@@ -984,0 +1014,1 @@
+#: src/lib/activity/ActivityItem.svelte
@@ -1098,0 +1129,5 @@
+#. Accessible label on the activity view loading spinner while filtered commits are fetched.
+#: src/lib/activity/ActivityView.svelte
+msgid "Loading activity"
+msgstr "Loading activity"
+
@@ -1273,0 +1309,5 @@
+#. Sort option in activity view — most recent commit first.
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Newest first"
+msgstr "Newest first"
+
```

### fragment 2

other · +31 -2

> AI: "No activity found" is dropped and replaced by a second "No activity matches these filters" entry.

```diff
@@ -1277,0 +1318,1 @@
+#. Empty state when activity list filters exclude every commit.
@@ -1279,2 +1320,6 @@
-msgid "No activity found"
-msgstr "No activity found"
+msgid "No activity matches these filters"
+msgstr "No activity matches these filters"
+
+#: src/lib/activity/ActivityFilter.svelte
+msgid "No activity types"
+msgstr "No activity types"
@@ -1287,0 +1333,4 @@
+#: src/lib/activity/ActivityFilter.svelte
+msgid "No authors"
+msgstr "No authors"
+
@@ -1401,0 +1451,5 @@
+#. Sort option in activity view — earliest commit first.
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Oldest first"
+msgstr "Oldest first"
+
@@ -1823,0 +1878,10 @@
+#. Sort option in activity view — by upload/download time, newest synced first (unsynced commits last).
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Synced newest"
+msgstr "Synced newest"
+
+#. Sort option in activity view — by upload/download time, oldest synced first (unsynced commits last).
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Synced oldest"
+msgstr "Synced oldest"
+
@@ -1909,0 +1974,1 @@
+#: src/lib/activity/ActivityView.svelte
@@ -1996,0 +2062,3 @@
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
@@ -1997,0 +2066,1 @@
+#: src/lib/activity/ActivityView.svelte
```

## frontend/viewer/src/lib/dotnet-types/generated-types/FwLiteShared/Services/IHistoryServiceJsInvokable.ts

### lines 8–10

other · +3 -0 · low-signal (generated)

```diff
@@ -7,0 +8,3 @@
+import type {ActivitySort} from '../../LcmCrdt/ActivitySort';
+import type {IActivityAuthor} from '../../LcmCrdt/IActivityAuthor';
+import type {IActivityChangeType} from '../../LcmCrdt/IActivityChangeType';
```

### IHistoryServiceJsInvokable

other · +3 -1 · low-signal (generated)

```diff
@@ -15,1 +18,3 @@
-	projectActivity(skip: number, take: number) : Promise<IProjectActivity[]>;
+	projectActivity(skip: number, take: number, authorFilterKeys?: string[], changeTypeKeys?: string[], sort?: ActivitySort) : Promise<IProjectActivity[]>;
+	listActivityAuthors() : Promise<IActivityAuthor[]>;
+	listActivityChangeTypes() : Promise<IActivityChangeType[]>;
```

## frontend/viewer/src/lib/dotnet-types/generated-types/LcmCrdt/ActivitySort.ts

### lines 1–12

other · +6 -0 · low-signal (generated)

```diff
@@ -0,0 +1,5 @@
+/* eslint-disable */
+//     This code was generated by a Reinforced.Typings tool.
+//     Changes to this file may cause incorrect behavior and will be lost if
+//     the code is regenerated.
+
@@ -12,0 +12,1 @@
+/* eslint-enable */
```

### ActivitySort

other · +6 -0 · low-signal (generated)

```diff
@@ -6,0 +6,6 @@
+export enum ActivitySort {
+	NewestFirst = "NewestFirst",
+	OldestFirst = "OldestFirst",
+	SyncedNewestFirst = "SyncedNewestFirst",
+	SyncedOldestFirst = "SyncedOldestFirst"
+}
```

## frontend/viewer/src/lib/dotnet-types/generated-types/LcmCrdt/IActivityAuthor.ts

### lines 1–12

other · +6 -0 · low-signal (generated)

```diff
@@ -0,0 +1,5 @@
+/* eslint-disable */
+//     This code was generated by a Reinforced.Typings tool.
+//     Changes to this file may cause incorrect behavior and will be lost if
+//     the code is regenerated.
+
@@ -12,0 +12,1 @@
+/* eslint-enable */
```

### IActivityAuthor

other · +6 -0 · low-signal (generated)

```diff
@@ -6,0 +6,6 @@
+export interface IActivityAuthor
+{
+	authorId?: string;
+	authorName?: string;
+	commitCount: number;
+}
```

## frontend/viewer/src/lib/dotnet-types/generated-types/LcmCrdt/IActivityChangeType.ts

### lines 1–12

other · +6 -0 · low-signal (generated)

```diff
@@ -0,0 +1,5 @@
+/* eslint-disable */
+//     This code was generated by a Reinforced.Typings tool.
+//     Changes to this file may cause incorrect behavior and will be lost if
+//     the code is regenerated.
+
@@ -12,0 +12,1 @@
+/* eslint-enable */
```

### IActivityChangeType

other · +6 -0 · low-signal (generated)

```diff
@@ -6,0 +6,6 @@
+export interface IActivityChangeType
+{
+	key: string;
+	label: string;
+	commitCount: number;
+}
```

## frontend/viewer/src/lib/dotnet-types/generated-types/LcmCrdt/IActivityQuery.ts

### lines 1–14

other · +8 -0 · low-signal (generated)

```diff
@@ -0,0 +1,7 @@
+/* eslint-disable */
+//     This code was generated by a Reinforced.Typings tool.
+//     Changes to this file may cause incorrect behavior and will be lost if
+//     the code is regenerated.
+
+import type {ActivitySort} from './ActivitySort';
+
@@ -14,0 +14,1 @@
+/* eslint-enable */
```

### IActivityQuery

other · +6 -0 · low-signal (generated)

```diff
@@ -8,0 +8,6 @@
+export interface IActivityQuery
+{
+	authorFilterKeys?: string[];
+	changeTypeKeys?: string[];
+	sort: ActivitySort;
+}
```

## frontend/viewer/src/lib/dotnet-types/generated-types/LcmCrdt/IProjectActivity.ts

### IProjectActivity

other · +1 -0 · low-signal (generated)

```diff
@@ -15,0 +16,1 @@
+	changeTypes: string[];
```

## frontend/viewer/src/lib/dotnet-types/generated-types/LcmCrdt/index.ts

### lines 7–10

other · +4 -0 · low-signal (generated)

```diff
@@ -6,0 +7,4 @@
+export * from './IActivityAuthor'
+export * from './IActivityChangeType'
+export * from './IActivityQuery'
+export * from './ActivitySort'
```

## frontend/viewer/src/locales/es.po

### fragment 1

other · +40 -0 · low-signal (translations)

```diff
@@ -45,0 +46,4 @@
+#: src/lib/activity/ActivityFilter.svelte
+msgid "{0} activity types"
+msgstr ""
+
@@ -50,0 +55,4 @@
+#: src/lib/activity/ActivityFilter.svelte
+msgid "{0} authors"
+msgstr ""
+
@@ -192,0 +201,14 @@
+#. Filter option in activity view activity-type dropdown — show all kinds of edits.
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+msgid "All activity types"
+msgstr ""
+
+#. Filter option in activity view author dropdown — show commits from every author.
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+msgid "All authors"
+msgstr ""
+
@@ -763,0 +786,6 @@
+#. Error message when the activity feed fails to load (toast and empty state).
+#: src/lib/activity/ActivityView.svelte
+#: src/lib/activity/ActivityView.svelte
+msgid "Failed to load activity"
+msgstr ""
+
@@ -826,0 +855,1 @@
+#: src/lib/activity/ActivityFilter.svelte
@@ -989,0 +1019,1 @@
+#: src/lib/activity/ActivityItem.svelte
@@ -1103,0 +1134,5 @@
+#. Accessible label on the activity view loading spinner while filtered commits are fetched.
+#: src/lib/activity/ActivityView.svelte
+msgid "Loading activity"
+msgstr ""
+
@@ -1278,0 +1314,5 @@
+#. Sort option in activity view — most recent commit first.
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Newest first"
+msgstr ""
+
```

### fragment 2

other · +32 -2 · low-signal (translations)

```diff
@@ -1282,0 +1323,1 @@
+#. Empty state when activity list filters exclude every commit.
@@ -1284,2 +1325,6 @@
-msgid "No activity found"
-msgstr "No se ha encontrado actividad"
+msgid "No activity matches these filters"
+msgstr ""
+
+#: src/lib/activity/ActivityFilter.svelte
+msgid "No activity types"
+msgstr ""
@@ -1292,0 +1338,4 @@
+#: src/lib/activity/ActivityFilter.svelte
+msgid "No authors"
+msgstr ""
+
@@ -1406,0 +1456,5 @@
+#. Sort option in activity view — earliest commit first.
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Oldest first"
+msgstr ""
+
@@ -1828,0 +1883,10 @@
+#. Sort option in activity view — by upload/download time, newest synced first (unsynced commits last).
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Synced newest"
+msgstr ""
+
+#. Sort option in activity view — by upload/download time, oldest synced first (unsynced commits last).
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Synced oldest"
+msgstr ""
+
@@ -1914,0 +1979,1 @@
+#: src/lib/activity/ActivityView.svelte
@@ -2001,0 +2067,3 @@
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
@@ -2002,0 +2071,1 @@
+#: src/lib/activity/ActivityView.svelte
@@ -2183,0 +2253,1 @@
+#. Warning toast shown when a login attempt can't connect to the server. {0} is the server name (e.g. "Lexbox").
```

## frontend/viewer/src/locales/fr.po

### fragment 1

other · +40 -0 · low-signal (translations)

```diff
@@ -45,0 +46,4 @@
+#: src/lib/activity/ActivityFilter.svelte
+msgid "{0} activity types"
+msgstr ""
+
@@ -50,0 +55,4 @@
+#: src/lib/activity/ActivityFilter.svelte
+msgid "{0} authors"
+msgstr ""
+
@@ -192,0 +201,14 @@
+#. Filter option in activity view activity-type dropdown — show all kinds of edits.
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+msgid "All activity types"
+msgstr ""
+
+#. Filter option in activity view author dropdown — show commits from every author.
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+msgid "All authors"
+msgstr ""
+
@@ -763,0 +786,6 @@
+#. Error message when the activity feed fails to load (toast and empty state).
+#: src/lib/activity/ActivityView.svelte
+#: src/lib/activity/ActivityView.svelte
+msgid "Failed to load activity"
+msgstr ""
+
@@ -826,0 +855,1 @@
+#: src/lib/activity/ActivityFilter.svelte
@@ -989,0 +1019,1 @@
+#: src/lib/activity/ActivityItem.svelte
@@ -1103,0 +1134,5 @@
+#. Accessible label on the activity view loading spinner while filtered commits are fetched.
+#: src/lib/activity/ActivityView.svelte
+msgid "Loading activity"
+msgstr ""
+
@@ -1278,0 +1314,5 @@
+#. Sort option in activity view — most recent commit first.
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Newest first"
+msgstr ""
+
```

### fragment 2

other · +32 -2 · low-signal (translations)

```diff
@@ -1282,0 +1323,1 @@
+#. Empty state when activity list filters exclude every commit.
@@ -1284,2 +1325,6 @@
-msgid "No activity found"
-msgstr "Aucune activité trouvée"
+msgid "No activity matches these filters"
+msgstr ""
+
+#: src/lib/activity/ActivityFilter.svelte
+msgid "No activity types"
+msgstr ""
@@ -1292,0 +1338,4 @@
+#: src/lib/activity/ActivityFilter.svelte
+msgid "No authors"
+msgstr ""
+
@@ -1406,0 +1456,5 @@
+#. Sort option in activity view — earliest commit first.
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Oldest first"
+msgstr ""
+
@@ -1828,0 +1883,10 @@
+#. Sort option in activity view — by upload/download time, newest synced first (unsynced commits last).
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Synced newest"
+msgstr ""
+
+#. Sort option in activity view — by upload/download time, oldest synced first (unsynced commits last).
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Synced oldest"
+msgstr ""
+
@@ -1914,0 +1979,1 @@
+#: src/lib/activity/ActivityView.svelte
@@ -2001,0 +2067,3 @@
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
@@ -2002,0 +2071,1 @@
+#: src/lib/activity/ActivityView.svelte
@@ -2183,0 +2253,1 @@
+#. Warning toast shown when a login attempt can't connect to the server. {0} is the server name (e.g. "Lexbox").
```

## frontend/viewer/src/locales/id.po

### fragment 1

other · +40 -0 · low-signal (translations)

```diff
@@ -45,0 +46,4 @@
+#: src/lib/activity/ActivityFilter.svelte
+msgid "{0} activity types"
+msgstr ""
+
@@ -50,0 +55,4 @@
+#: src/lib/activity/ActivityFilter.svelte
+msgid "{0} authors"
+msgstr ""
+
@@ -192,0 +201,14 @@
+#. Filter option in activity view activity-type dropdown — show all kinds of edits.
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+msgid "All activity types"
+msgstr ""
+
+#. Filter option in activity view author dropdown — show commits from every author.
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+msgid "All authors"
+msgstr ""
+
@@ -763,0 +786,6 @@
+#. Error message when the activity feed fails to load (toast and empty state).
+#: src/lib/activity/ActivityView.svelte
+#: src/lib/activity/ActivityView.svelte
+msgid "Failed to load activity"
+msgstr ""
+
@@ -826,0 +855,1 @@
+#: src/lib/activity/ActivityFilter.svelte
@@ -989,0 +1019,1 @@
+#: src/lib/activity/ActivityItem.svelte
@@ -1103,0 +1134,5 @@
+#. Accessible label on the activity view loading spinner while filtered commits are fetched.
+#: src/lib/activity/ActivityView.svelte
+msgid "Loading activity"
+msgstr ""
+
@@ -1278,0 +1314,5 @@
+#. Sort option in activity view — most recent commit first.
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Newest first"
+msgstr ""
+
```

### fragment 2

other · +32 -2 · low-signal (translations)

```diff
@@ -1282,0 +1323,1 @@
+#. Empty state when activity list filters exclude every commit.
@@ -1284,2 +1325,6 @@
-msgid "No activity found"
-msgstr "Tidak ada aktivitas yang ditemukan"
+msgid "No activity matches these filters"
+msgstr ""
+
+#: src/lib/activity/ActivityFilter.svelte
+msgid "No activity types"
+msgstr ""
@@ -1292,0 +1338,4 @@
+#: src/lib/activity/ActivityFilter.svelte
+msgid "No authors"
+msgstr ""
+
@@ -1406,0 +1456,5 @@
+#. Sort option in activity view — earliest commit first.
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Oldest first"
+msgstr ""
+
@@ -1828,0 +1883,10 @@
+#. Sort option in activity view — by upload/download time, newest synced first (unsynced commits last).
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Synced newest"
+msgstr ""
+
+#. Sort option in activity view — by upload/download time, oldest synced first (unsynced commits last).
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Synced oldest"
+msgstr ""
+
@@ -1914,0 +1979,1 @@
+#: src/lib/activity/ActivityView.svelte
@@ -2001,0 +2067,3 @@
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
@@ -2002,0 +2071,1 @@
+#: src/lib/activity/ActivityView.svelte
@@ -2183,0 +2253,1 @@
+#. Warning toast shown when a login attempt can't connect to the server. {0} is the server name (e.g. "Lexbox").
```

## frontend/viewer/src/locales/ko.po

### fragment 1

other · +40 -0 · low-signal (translations)

```diff
@@ -45,0 +46,4 @@
+#: src/lib/activity/ActivityFilter.svelte
+msgid "{0} activity types"
+msgstr ""
+
@@ -50,0 +55,4 @@
+#: src/lib/activity/ActivityFilter.svelte
+msgid "{0} authors"
+msgstr ""
+
@@ -192,0 +201,14 @@
+#. Filter option in activity view activity-type dropdown — show all kinds of edits.
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+msgid "All activity types"
+msgstr ""
+
+#. Filter option in activity view author dropdown — show commits from every author.
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+msgid "All authors"
+msgstr ""
+
@@ -763,0 +786,6 @@
+#. Error message when the activity feed fails to load (toast and empty state).
+#: src/lib/activity/ActivityView.svelte
+#: src/lib/activity/ActivityView.svelte
+msgid "Failed to load activity"
+msgstr ""
+
@@ -826,0 +855,1 @@
+#: src/lib/activity/ActivityFilter.svelte
@@ -989,0 +1019,1 @@
+#: src/lib/activity/ActivityItem.svelte
@@ -1103,0 +1134,5 @@
+#. Accessible label on the activity view loading spinner while filtered commits are fetched.
+#: src/lib/activity/ActivityView.svelte
+msgid "Loading activity"
+msgstr ""
+
@@ -1278,0 +1314,5 @@
+#. Sort option in activity view — most recent commit first.
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Newest first"
+msgstr ""
+
```

### fragment 2

other · +32 -2 · low-signal (translations)

```diff
@@ -1282,0 +1323,1 @@
+#. Empty state when activity list filters exclude every commit.
@@ -1284,2 +1325,6 @@
-msgid "No activity found"
-msgstr "활동을 찾을 수 없습니다."
+msgid "No activity matches these filters"
+msgstr ""
+
+#: src/lib/activity/ActivityFilter.svelte
+msgid "No activity types"
+msgstr ""
@@ -1292,0 +1338,4 @@
+#: src/lib/activity/ActivityFilter.svelte
+msgid "No authors"
+msgstr ""
+
@@ -1406,0 +1456,5 @@
+#. Sort option in activity view — earliest commit first.
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Oldest first"
+msgstr ""
+
@@ -1828,0 +1883,10 @@
+#. Sort option in activity view — by upload/download time, newest synced first (unsynced commits last).
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Synced newest"
+msgstr ""
+
+#. Sort option in activity view — by upload/download time, oldest synced first (unsynced commits last).
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Synced oldest"
+msgstr ""
+
@@ -1914,0 +1979,1 @@
+#: src/lib/activity/ActivityView.svelte
@@ -2001,0 +2067,3 @@
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
@@ -2002,0 +2071,1 @@
+#: src/lib/activity/ActivityView.svelte
@@ -2183,0 +2253,1 @@
+#. Warning toast shown when a login attempt can't connect to the server. {0} is the server name (e.g. "Lexbox").
```

## frontend/viewer/src/locales/ms.po

### fragment 1

other · +40 -0 · low-signal (translations)

```diff
@@ -45,0 +46,4 @@
+#: src/lib/activity/ActivityFilter.svelte
+msgid "{0} activity types"
+msgstr ""
+
@@ -50,0 +55,4 @@
+#: src/lib/activity/ActivityFilter.svelte
+msgid "{0} authors"
+msgstr ""
+
@@ -192,0 +201,14 @@
+#. Filter option in activity view activity-type dropdown — show all kinds of edits.
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+msgid "All activity types"
+msgstr ""
+
+#. Filter option in activity view author dropdown — show commits from every author.
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+msgid "All authors"
+msgstr ""
+
@@ -763,0 +786,6 @@
+#. Error message when the activity feed fails to load (toast and empty state).
+#: src/lib/activity/ActivityView.svelte
+#: src/lib/activity/ActivityView.svelte
+msgid "Failed to load activity"
+msgstr ""
+
@@ -826,0 +855,1 @@
+#: src/lib/activity/ActivityFilter.svelte
@@ -989,0 +1019,1 @@
+#: src/lib/activity/ActivityItem.svelte
@@ -1103,0 +1134,5 @@
+#. Accessible label on the activity view loading spinner while filtered commits are fetched.
+#: src/lib/activity/ActivityView.svelte
+msgid "Loading activity"
+msgstr ""
+
@@ -1278,0 +1314,5 @@
+#. Sort option in activity view — most recent commit first.
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Newest first"
+msgstr ""
+
```

### fragment 2

other · +32 -2 · low-signal (translations)

```diff
@@ -1282,0 +1323,1 @@
+#. Empty state when activity list filters exclude every commit.
@@ -1284,2 +1325,6 @@
-msgid "No activity found"
-msgstr "Tiada aktiviti ditemui"
+msgid "No activity matches these filters"
+msgstr ""
+
+#: src/lib/activity/ActivityFilter.svelte
+msgid "No activity types"
+msgstr ""
@@ -1292,0 +1338,4 @@
+#: src/lib/activity/ActivityFilter.svelte
+msgid "No authors"
+msgstr ""
+
@@ -1406,0 +1456,5 @@
+#. Sort option in activity view — earliest commit first.
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Oldest first"
+msgstr ""
+
@@ -1828,0 +1883,10 @@
+#. Sort option in activity view — by upload/download time, newest synced first (unsynced commits last).
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Synced newest"
+msgstr ""
+
+#. Sort option in activity view — by upload/download time, oldest synced first (unsynced commits last).
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Synced oldest"
+msgstr ""
+
@@ -1914,0 +1979,1 @@
+#: src/lib/activity/ActivityView.svelte
@@ -2001,0 +2067,3 @@
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
@@ -2002,0 +2071,1 @@
+#: src/lib/activity/ActivityView.svelte
@@ -2183,0 +2253,1 @@
+#. Warning toast shown when a login attempt can't connect to the server. {0} is the server name (e.g. "Lexbox").
```

## frontend/viewer/src/locales/sw.po

### fragment 1

other · +40 -0 · low-signal (translations)

```diff
@@ -45,0 +46,4 @@
+#: src/lib/activity/ActivityFilter.svelte
+msgid "{0} activity types"
+msgstr ""
+
@@ -50,0 +55,4 @@
+#: src/lib/activity/ActivityFilter.svelte
+msgid "{0} authors"
+msgstr ""
+
@@ -192,0 +201,14 @@
+#. Filter option in activity view activity-type dropdown — show all kinds of edits.
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+msgid "All activity types"
+msgstr ""
+
+#. Filter option in activity view author dropdown — show commits from every author.
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+msgid "All authors"
+msgstr ""
+
@@ -763,0 +786,6 @@
+#. Error message when the activity feed fails to load (toast and empty state).
+#: src/lib/activity/ActivityView.svelte
+#: src/lib/activity/ActivityView.svelte
+msgid "Failed to load activity"
+msgstr ""
+
@@ -826,0 +855,1 @@
+#: src/lib/activity/ActivityFilter.svelte
@@ -989,0 +1019,1 @@
+#: src/lib/activity/ActivityItem.svelte
@@ -1103,0 +1134,5 @@
+#. Accessible label on the activity view loading spinner while filtered commits are fetched.
+#: src/lib/activity/ActivityView.svelte
+msgid "Loading activity"
+msgstr ""
+
@@ -1278,0 +1314,5 @@
+#. Sort option in activity view — most recent commit first.
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Newest first"
+msgstr ""
+
```

### fragment 2

other · +32 -2 · low-signal (translations)

```diff
@@ -1282,0 +1323,1 @@
+#. Empty state when activity list filters exclude every commit.
@@ -1284,2 +1325,6 @@
-msgid "No activity found"
-msgstr "Hakuna shughuli iliyopatikana"
+msgid "No activity matches these filters"
+msgstr ""
+
+#: src/lib/activity/ActivityFilter.svelte
+msgid "No activity types"
+msgstr ""
@@ -1292,0 +1338,4 @@
+#: src/lib/activity/ActivityFilter.svelte
+msgid "No authors"
+msgstr ""
+
@@ -1406,0 +1456,5 @@
+#. Sort option in activity view — earliest commit first.
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Oldest first"
+msgstr ""
+
@@ -1828,0 +1883,10 @@
+#. Sort option in activity view — by upload/download time, newest synced first (unsynced commits last).
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Synced newest"
+msgstr ""
+
+#. Sort option in activity view — by upload/download time, oldest synced first (unsynced commits last).
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Synced oldest"
+msgstr ""
+
@@ -1914,0 +1979,1 @@
+#: src/lib/activity/ActivityView.svelte
@@ -2001,0 +2067,3 @@
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
@@ -2002,0 +2071,1 @@
+#: src/lib/activity/ActivityView.svelte
@@ -2183,0 +2253,1 @@
+#. Warning toast shown when a login attempt can't connect to the server. {0} is the server name (e.g. "Lexbox").
```

## frontend/viewer/src/locales/vi.po

### fragment 1

other · +40 -0 · low-signal (translations)

```diff
@@ -45,0 +46,4 @@
+#: src/lib/activity/ActivityFilter.svelte
+msgid "{0} activity types"
+msgstr ""
+
@@ -50,0 +55,4 @@
+#: src/lib/activity/ActivityFilter.svelte
+msgid "{0} authors"
+msgstr ""
+
@@ -192,0 +201,14 @@
+#. Filter option in activity view activity-type dropdown — show all kinds of edits.
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+msgid "All activity types"
+msgstr ""
+
+#. Filter option in activity view author dropdown — show commits from every author.
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+msgid "All authors"
+msgstr ""
+
@@ -763,0 +786,6 @@
+#. Error message when the activity feed fails to load (toast and empty state).
+#: src/lib/activity/ActivityView.svelte
+#: src/lib/activity/ActivityView.svelte
+msgid "Failed to load activity"
+msgstr ""
+
@@ -826,0 +855,1 @@
+#: src/lib/activity/ActivityFilter.svelte
@@ -989,0 +1019,1 @@
+#: src/lib/activity/ActivityItem.svelte
@@ -1103,0 +1134,5 @@
+#. Accessible label on the activity view loading spinner while filtered commits are fetched.
+#: src/lib/activity/ActivityView.svelte
+msgid "Loading activity"
+msgstr ""
+
@@ -1278,0 +1314,5 @@
+#. Sort option in activity view — most recent commit first.
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Newest first"
+msgstr ""
+
```

### fragment 2

other · +32 -2 · low-signal (translations)

```diff
@@ -1282,0 +1323,1 @@
+#. Empty state when activity list filters exclude every commit.
@@ -1284,2 +1325,6 @@
-msgid "No activity found"
-msgstr "Không tìm thấy hoạt động"
+msgid "No activity matches these filters"
+msgstr ""
+
+#: src/lib/activity/ActivityFilter.svelte
+msgid "No activity types"
+msgstr ""
@@ -1292,0 +1338,4 @@
+#: src/lib/activity/ActivityFilter.svelte
+msgid "No authors"
+msgstr ""
+
@@ -1406,0 +1456,5 @@
+#. Sort option in activity view — earliest commit first.
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Oldest first"
+msgstr ""
+
@@ -1828,0 +1883,10 @@
+#. Sort option in activity view — by upload/download time, newest synced first (unsynced commits last).
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Synced newest"
+msgstr ""
+
+#. Sort option in activity view — by upload/download time, oldest synced first (unsynced commits last).
+#: src/lib/activity/ActivityFilter.svelte
+msgid "Synced oldest"
+msgstr ""
+
@@ -1914,0 +1979,1 @@
+#: src/lib/activity/ActivityView.svelte
@@ -2001,0 +2067,3 @@
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
+#: src/lib/activity/ActivityFilter.svelte
@@ -2002,0 +2071,1 @@
+#: src/lib/activity/ActivityView.svelte
@@ -2183,0 +2253,1 @@
+#. Warning toast shown when a login attempt can't connect to the server. {0} is the server name (e.g. "Lexbox").
```
