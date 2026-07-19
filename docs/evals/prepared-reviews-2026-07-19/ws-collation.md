# Code story — 208b520ab01b..5d5dfbf326fe

141 chunks · 27 sections · head 5d5dfbf3

## backend/FwLite/MiniLcm/Models/WritingSystem.cs

### WritingSystem

other · +9 -0

```diff
@@ -37,0 +38,4 @@
+    /// <summary>
+    /// Compiled ICU tailoring rules imported from FLEx (Custom Simple / Custom ICU).
+    /// Null uses legacy collation fallback at runtime. Not persisted as empty on import.
+    /// </summary>
@@ -43,0 +43,4 @@
+
+    /// <summary>
+    /// .NET locale tag for FLEx "same as another language" collation.
+    /// </summary>
@@ -48,0 +48,1 @@
+
```

### WritingSystem.IcuCollationRules

method · +1 -0

```diff
@@ -42,0 +42,1 @@
+    public virtual string? IcuCollationRules { get; set; }
```

### WritingSystem.SystemCollationLocale

method · +1 -0

```diff
@@ -47,0 +47,1 @@
+    public virtual string? SystemCollationLocale { get; set; }
```

### WritingSystem.Copy

method · +2 -0

```diff
@@ -61,0 +73,2 @@
+            IcuCollationRules = IcuCollationRules,
+            SystemCollationLocale = SystemCollationLocale,
```

## backend/FwLite/MiniLcm/Culture/IWritingSystemCollatorProvider.cs

### lines 1–5

other · +4 -0

```diff
@@ -0,0 +1,3 @@
+using MiniLcm.Models;
+using SIL.WritingSystems;
+
@@ -5,0 +5,1 @@
+
```

### MiniLcm.Culture

other · +1 -0

```diff
@@ -4,0 +4,1 @@
+namespace MiniLcm.Culture;
```

### IWritingSystemCollatorProvider

other · +3 -0

```diff
@@ -6,0 +6,2 @@
+public interface IWritingSystemCollatorProvider
+{
@@ -9,0 +9,1 @@
+}
```

### IWritingSystemCollatorProvider.GetCollator

method · +1 -0

```diff
@@ -8,0 +8,1 @@
+    ICollator GetCollator(WritingSystem writingSystem);
```

## backend/FwLite/LcmCrdt/Culture/WritingSystemCollatorProvider.cs

### lines 1–9

other · +8 -0

```diff
@@ -0,0 +1,7 @@
+using System.Globalization;
+using Microsoft.Extensions.Caching.Memory;
+using Microsoft.Extensions.Logging;
+using MiniLcm.Culture;
+using MiniLcm.Models;
+using SIL.WritingSystems;
+
@@ -9,0 +9,1 @@
+
```

### LcmCrdt.Culture

other · +1 -0

```diff
@@ -8,0 +8,1 @@
+namespace LcmCrdt.Culture;
```

### WritingSystemCollatorProvider

other · +11 -0

```diff
@@ -10,0 +10,5 @@
+public class WritingSystemCollatorProvider(
+    IMemoryCache cache,
+    IMiniLcmCultureProvider cultureProvider,
+    ILogger<WritingSystemCollatorProvider> logger) : IWritingSystemCollatorProvider
+{
@@ -23,0 +23,1 @@
+
@@ -38,0 +38,1 @@
+
@@ -55,0 +55,1 @@
+
@@ -71,0 +71,1 @@
+
@@ -84,0 +84,1 @@
+
@@ -87,0 +87,1 @@
+}
```

### WritingSystemCollatorProvider.GetCollator

method · +8 -0

```diff
@@ -15,0 +15,8 @@
+    public ICollator GetCollator(WritingSystem writingSystem)
+    {
+        return cache.GetOrCreate(CacheKey(writingSystem), entry =>
+        {
+            entry.SlidingExpiration = TimeSpan.FromHours(1);
+            return CreateCollator(writingSystem);
+        }) ?? CreateCollator(writingSystem);
+    }
```

### WritingSystemCollatorProvider.CacheKey

method · +2 -0

```diff
@@ -85,0 +85,2 @@
+    private static string CacheKey(WritingSystem writingSystem) =>
+        $"collator|{writingSystem.WsId}|{writingSystem.Type}|{writingSystem.IcuCollationRules}|{writingSystem.SystemCollationLocale}";
```

### WritingSystemCollatorProvider.CreateCollator

method · +14 -0

```diff
@@ -24,0 +24,14 @@
+    private ICollator CreateCollator(WritingSystem writingSystem)
+    {
+        if (!string.IsNullOrEmpty(writingSystem.SystemCollationLocale))
+        {
+            return TryCreateLocaleCollator(writingSystem);
+        }
+
+        if (!string.IsNullOrEmpty(writingSystem.IcuCollationRules))
+        {
+            return TryCreateRulesCollator(writingSystem);
+        }
+
+        return new LegacyCompareInfoCollator(cultureProvider.GetCompareInfo(writingSystem));
+    }
```

### WritingSystemCollatorProvider.TryCreateLocaleCollator

method · +16 -0

```diff
@@ -39,0 +39,16 @@
+    private ICollator TryCreateLocaleCollator(WritingSystem writingSystem)
+    {
+        try
+        {
+            return new Icu4NLocaleCollator(writingSystem.SystemCollationLocale!);
+        }
+        catch (Exception ex)
+        {
+            logger.LogWarning(
+                ex,
+                "Failed to create ICU4N locale collator for '{Locale}' on writing system '{WsId}'; using .NET collation fallback",
+                writingSystem.SystemCollationLocale,
+                writingSystem.WsId);
+            return CreateCultureCollator(writingSystem.SystemCollationLocale!);
+        }
+    }
```

### WritingSystemCollatorProvider.CreateCultureCollator

method · +12 -0

```diff
@@ -72,0 +72,12 @@
+    private ICollator CreateCultureCollator(string locale)
+    {
+        try
+        {
+            return new CultureCompareInfoCollator(CultureInfo.GetCultureInfo(locale).CompareInfo);
+        }
+        catch (CultureNotFoundException ex)
+        {
+            logger.LogWarning(ex, "Unknown system collation locale '{Locale}'; using invariant collation", locale);
+            return new CultureCompareInfoCollator(CultureInfo.InvariantCulture.CompareInfo);
+        }
+    }
```

### WritingSystemCollatorProvider.TryCreateRulesCollator

method · +15 -0

```diff
@@ -56,0 +56,15 @@
+    private ICollator TryCreateRulesCollator(WritingSystem writingSystem)
+    {
+        try
+        {
+            return new Icu4NRulesCollator(writingSystem.IcuCollationRules!);
+        }
+        catch (Exception ex)
+        {
+            logger.LogWarning(
+                ex,
+                "Failed to create ICU4N rules collator for writing system '{WsId}'; using legacy collation fallback",
+                writingSystem.WsId);
+            return new LegacyCompareInfoCollator(cultureProvider.GetCompareInfo(writingSystem));
+        }
+    }
```

## backend/FwLite/LcmCrdt/Culture/Icu4NLocaleCollator.cs

### lines 1–7

other · +6 -0

```diff
@@ -0,0 +1,5 @@
+using System.Collections;
+using System.Globalization;
+using ICU4N.Text;
+using SIL.WritingSystems;
+
@@ -7,0 +7,1 @@
+
```

### LcmCrdt.Culture

other · +1 -0

```diff
@@ -6,0 +6,1 @@
+namespace LcmCrdt.Culture;
```

### Icu4NLocaleCollator

other · +8 -0

```diff
@@ -8,0 +8,4 @@
+internal sealed class Icu4NLocaleCollator : ICollator
+{
+    private readonly Collator _collator;
+
@@ -14,0 +14,1 @@
+
@@ -17,0 +17,1 @@
+
@@ -20,0 +20,1 @@
+
@@ -22,0 +22,1 @@
+}
```

### Icu4NLocaleCollator.Icu4NLocaleCollator

method · +2 -0

```diff
@@ -12,0 +12,2 @@
+    public Icu4NLocaleCollator(string locale) =>
+        _collator = Collator.GetInstance(CultureInfo.GetCultureInfo(locale));
```

### Icu4NLocaleCollator.Compare

method · +2 -0

```diff
@@ -15,0 +15,2 @@
+    public int Compare(string? x, string? y) =>
+        _collator.Compare(x ?? string.Empty, y ?? string.Empty);
```

### Icu4NLocaleCollator.GetSortKey

method · +2 -0

```diff
@@ -18,0 +18,2 @@
+    public SortKey GetSortKey(string source) =>
+        throw new NotSupportedException("ICU4N sort keys are not used by FwLite collation.");
```

### Icu4NLocaleCollator.Compare

method · +1 -0

```diff
@@ -21,0 +21,1 @@
+    int IComparer.Compare(object? x, object? y) => Compare(x as string, y as string);
```

## backend/FwLite/LcmCrdt/Culture/Icu4NRulesCollator.cs

### lines 1–7

other · +6 -0

```diff
@@ -0,0 +1,5 @@
+using System.Collections;
+using System.Globalization;
+using ICU4N.Text;
+using SIL.WritingSystems;
+
@@ -7,0 +7,1 @@
+
```

### LcmCrdt.Culture

other · +1 -0

```diff
@@ -6,0 +6,1 @@
+namespace LcmCrdt.Culture;
```

### Icu4NRulesCollator

other · +8 -0

```diff
@@ -8,0 +8,4 @@
+internal sealed class Icu4NRulesCollator : ICollator
+{
+    private readonly RuleBasedCollator _collator;
+
@@ -13,0 +13,1 @@
+
@@ -16,0 +16,1 @@
+
@@ -19,0 +19,1 @@
+
@@ -21,0 +21,1 @@
+}
```

### Icu4NRulesCollator.Icu4NRulesCollator

method · +1 -0

```diff
@@ -12,0 +12,1 @@
+    public Icu4NRulesCollator(string rules) => _collator = new RuleBasedCollator(rules);
```

### Icu4NRulesCollator.Compare

method · +2 -0

```diff
@@ -14,0 +14,2 @@
+    public int Compare(string? x, string? y) =>
+        _collator.Compare(x ?? string.Empty, y ?? string.Empty);
```

### Icu4NRulesCollator.GetSortKey

method · +2 -0

```diff
@@ -17,0 +17,2 @@
+    public SortKey GetSortKey(string source) =>
+        throw new NotSupportedException("ICU4N sort keys are not used by FwLite collation.");
```

### Icu4NRulesCollator.Compare

method · +1 -0

```diff
@@ -20,0 +20,1 @@
+    int IComparer.Compare(object? x, object? y) => Compare(x as string, y as string);
```

## backend/FwLite/LcmCrdt/Culture/CultureCompareInfoCollator.cs

### lines 1–9

other · +8 -0

```diff
@@ -0,0 +1,4 @@
+using System.Collections;
+using System.Globalization;
+using SIL.WritingSystems;
+
@@ -6,0 +6,4 @@
+
+/// <summary>
+/// Locale collation via .NET CompareInfo, without the legacy case tie-break.
+/// </summary>
```

### LcmCrdt.Culture

other · +1 -0

```diff
@@ -5,0 +5,1 @@
+namespace LcmCrdt.Culture;
```

### CultureCompareInfoCollator

other · +5 -0

```diff
@@ -10,0 +10,2 @@
+internal sealed class CultureCompareInfoCollator(CompareInfo compareInfo) : ICollator
+{
@@ -14,0 +14,1 @@
+
@@ -16,0 +16,1 @@
+
@@ -18,0 +18,1 @@
+}
```

### CultureCompareInfoCollator.Compare

method · +2 -0

```diff
@@ -12,0 +12,2 @@
+    public int Compare(string? x, string? y) =>
+        compareInfo.Compare(x ?? string.Empty, y ?? string.Empty, CompareOptions.None);
```

### CultureCompareInfoCollator.GetSortKey

method · +1 -0

```diff
@@ -15,0 +15,1 @@
+    public SortKey GetSortKey(string source) => compareInfo.GetSortKey(source);
```

### CultureCompareInfoCollator.Compare

method · +1 -0

```diff
@@ -17,0 +17,1 @@
+    int IComparer.Compare(object? x, object? y) => Compare(x as string, y as string);
```

## backend/FwLite/LcmCrdt/Culture/LegacyCompareInfoCollator.cs

### lines 1–9

other · +8 -0

```diff
@@ -0,0 +1,4 @@
+using System.Collections;
+using System.Globalization;
+using SIL.WritingSystems;
+
@@ -6,0 +6,4 @@
+
+/// <summary>
+/// Pre-collation-import fallback: case-insensitive compare with lowercase-before-uppercase tie-break.
+/// </summary>
```

### LcmCrdt.Culture

other · +1 -0

```diff
@@ -5,0 +5,1 @@
+namespace LcmCrdt.Culture;
```

### LegacyCompareInfoCollator

other · +5 -0

```diff
@@ -10,0 +10,2 @@
+internal sealed class LegacyCompareInfoCollator(CompareInfo compareInfo) : ICollator
+{
@@ -24,0 +24,1 @@
+
@@ -26,0 +26,1 @@
+
@@ -28,0 +28,1 @@
+}
```

### LegacyCompareInfoCollator.Compare

method · +12 -0

```diff
@@ -12,0 +12,12 @@
+    public int Compare(string? x, string? y)
+    {
+        x ??= string.Empty;
+        y ??= string.Empty;
+        var caseInsensitiveResult = compareInfo.Compare(x, y, CompareOptions.IgnoreCase);
+        if (caseInsensitiveResult != 0)
+        {
+            return caseInsensitiveResult;
+        }
+
+        return compareInfo.Compare(x, y, CompareOptions.None);
+    }
```

### LegacyCompareInfoCollator.GetSortKey

method · +1 -0

```diff
@@ -25,0 +25,1 @@
+    public SortKey GetSortKey(string source) => compareInfo.GetSortKey(source);
```

### LegacyCompareInfoCollator.Compare

method · +1 -0

```diff
@@ -27,0 +27,1 @@
+    int IComparer.Compare(object? x, object? y) => Compare(x as string, y as string);
```

## backend/FwLite/LcmCrdt/Data/SetupCollationInterceptor.cs

### lines 11–11

other · +1 -0

```diff
@@ -10,0 +11,1 @@
+using LcmCrdt.Culture;
```

### SetupCollationInterceptor

other · +6 -1

```diff
@@ -16,1 +17,5 @@
-public class SetupCollationInterceptor(IMemoryCache cache, IMiniLcmCultureProvider cultureProvider, IOptions<CrdtConfig> crdtConfig) : IDbConnectionInterceptor, ISaveChangesInterceptor, IConnectionInterceptor
+public class SetupCollationInterceptor(
+    IMemoryCache cache,
+    IMiniLcmCultureProvider cultureProvider,
+    IWritingSystemCollatorProvider collatorProvider,
+    IOptions<CrdtConfig> crdtConfig) : IDbConnectionInterceptor, ISaveChangesInterceptor, IConnectionInterceptor
@@ -224,0 +224,1 @@
+
```

### SetupCollationInterceptor.GetWritingSystems

method · +37 -32

```diff
@@ -21,2 +26,17 @@
-        return cache.GetOrCreate(CacheKey(connection),
-            entry =>
+        var cacheKey = CacheKey(connection);
+        if (cache.TryGetValue(cacheKey, out WritingSystem[]? cached) && cached is not null)
+        {
+            return cached;
+        }
+
+        try
+        {
+            var localContext = dbContext;
+            if (localContext is null)
+            {
+                var optionsBuilder = new DbContextOptionsBuilder<LcmCrdtDbContext>();
+                optionsBuilder.UseSqlite(connection);
+                localContext = new LcmCrdtDbContext(optionsBuilder.Options, crdtConfig);
+            }
+
+            try
@@ -24,2 +44,2 @@
-                entry.SlidingExpiration = TimeSpan.FromMinutes(30);
-                try
+                WsTableName ??= localContext.Model.FindRuntimeEntityType(typeof(WritingSystem))?.GetTableName() ?? "WritingSystem";
+                if (!HasTable(localContext, WsTableName))
@@ -27,25 +47,2 @@
-                    var localContext = dbContext;
-                    if (localContext is null)
-                    {
-                        var optionsBuilder = new DbContextOptionsBuilder<LcmCrdtDbContext>();
-                        optionsBuilder.UseSqlite(connection);
-                        localContext = new LcmCrdtDbContext(optionsBuilder.Options, crdtConfig);
-                    }
-
-                    try
-                    {
-                        WsTableName ??= localContext.Model.FindRuntimeEntityType(typeof(WritingSystem))?.GetTableName() ?? "WritingSystem";
-                        if (!HasTable(localContext, WsTableName))
-                        {
-                            return [];
-                        }
-
-                        return localContext.WritingSystems.ToArray();
-                    }
-                    finally
-                    {
-                        if (dbContext is null)
-                        {
-                            localContext.Dispose();
-                        }
-                    }
+                    // Schema not migrated yet — don't cache so a later open can register collations.
+                    return [];
@@ -53,1 +50,8 @@
-                catch (SqliteException)
+
+                var writingSystems = localContext.WritingSystems.ToArray();
+                cache.Set(cacheKey, writingSystems, TimeSpan.FromMinutes(30));
+                return writingSystems;
+            }
+            finally
+            {
+                if (dbContext is null)
@@ -55,1 +59,1 @@
-                    return [];
+                    localContext.Dispose();
@@ -57,1 +61,7 @@
-            }) ?? [];
+            }
+        }
+        catch (SqliteException)
+        {
+            // Model/schema mismatch (e.g. connection opened mid-migration) — don't cache.
+            return [];
+        }
```

### SetupCollationInterceptor.SetupCollation

method · +8 -1

```diff
@@ -188,0 +199,8 @@
+        if (HasImportedCollation(writingSystem))
+        {
+            var collator = collatorProvider.GetCollator(writingSystem);
+            connection.CreateCollation(SqlSortingExtensions.CollationName(writingSystem.WsId),
+                (x, y) => collator.Compare(x, y));
+            return;
+        }
+
@@ -191,1 +208,0 @@
-        //todo use custom comparison based on the writing system
```

### SetupCollationInterceptor.HasImportedCollation

method · +3 -0

```diff
@@ -203,0 +221,3 @@
+    private static bool HasImportedCollation(WritingSystem writingSystem) =>
+        !string.IsNullOrEmpty(writingSystem.SystemCollationLocale)
+        || !string.IsNullOrEmpty(writingSystem.IcuCollationRules);
```

## backend/FwLite/LcmCrdt/Data/Sorting.cs

### Sorting.ApplyRoughBestMatchOrder

method · +2 -2

```diff
@@ -54,1 +54,1 @@
-                    e.Headword(order.WritingSystem),
+                    e.Headword(order.WritingSystem).CollateUnicode(order.WritingSystem),
@@ -70,1 +70,1 @@
-                    e.Headword(order.WritingSystem) descending,
+                    e.Headword(order.WritingSystem).CollateUnicode(order.WritingSystem) descending,
```

## backend/FwLite/LcmCrdt/Changes/CreateWritingSystemChange.cs

### CreateWritingSystemChange.IcuCollationRules

method · +1 -0

```diff
@@ -17,0 +18,1 @@
+    public string? IcuCollationRules { get; init; }
```

### CreateWritingSystemChange.SystemCollationLocale

method · +1 -0

```diff
@@ -19,0 +19,1 @@
+    public string? SystemCollationLocale { get; init; }
```

### CreateWritingSystemChange.CreateWritingSystemChange

method · +2 -0

```diff
@@ -29,0 +32,2 @@
+        IcuCollationRules = writingSystem.IcuCollationRules;
+        SystemCollationLocale = writingSystem.SystemCollationLocale;
```

### CreateWritingSystemChange.NewEntity

method · +2 -0

```diff
@@ -49,0 +54,2 @@
+            IcuCollationRules = IcuCollationRules,
+            SystemCollationLocale = SystemCollationLocale,
```

## backend/FwLite/LcmCrdt/Migrations/20260702040259_AddWritingSystemCollation.cs

### lines 1–4

other · +4 -0

```diff
@@ -0,0 +1,4 @@
+﻿using Microsoft.EntityFrameworkCore.Migrations;
+
+#nullable disable
+
```

### LcmCrdt.Migrations

other · +4 -0

```diff
@@ -5,0 +5,3 @@
+namespace LcmCrdt.Migrations
+{
+    /// <inheritdoc />
@@ -38,0 +38,1 @@
+}
```

### LcmCrdt.Migrations.AddWritingSystemCollation

other · +6 -0

```diff
@@ -8,0 +8,3 @@
+    public partial class AddWritingSystemCollation : Migration
+    {
+        /// <inheritdoc />
@@ -25,0 +25,2 @@
+
+        /// <inheritdoc />
@@ -37,0 +37,1 @@
+    }
```

### LcmCrdt.Migrations.AddWritingSystemCollation.Up

method · +14 -0

```diff
@@ -11,0 +11,14 @@
+        protected override void Up(MigrationBuilder migrationBuilder)
+        {
+            migrationBuilder.AddColumn<string>(
+                name: "IcuCollationRules",
+                table: "WritingSystem",
+                type: "TEXT",
+                nullable: true);
+
+            migrationBuilder.AddColumn<string>(
+                name: "SystemCollationLocale",
+                table: "WritingSystem",
+                type: "TEXT",
+                nullable: true);
+        }
```

### LcmCrdt.Migrations.AddWritingSystemCollation.Down

method · +10 -0

```diff
@@ -27,0 +27,10 @@
+        protected override void Down(MigrationBuilder migrationBuilder)
+        {
+            migrationBuilder.DropColumn(
+                name: "IcuCollationRules",
+                table: "WritingSystem");
+
+            migrationBuilder.DropColumn(
+                name: "SystemCollationLocale",
+                table: "WritingSystem");
+        }
```

## backend/FwLite/LcmCrdt/ExampleProjectData.cs

### ExampleProjectData

other · +3 -0

```diff
@@ -6,0 +7,3 @@
+    /// <summary>ICU tailoring that sorts B before A so demo fruit headwords visibly differ from default order.</summary>
+    internal const string DemoIcuCollationRules = "&b < a &B < A";
+
```

### ExampleProjectData.CreateWritingSystems

method · +2 -2

```diff
@@ -23,2 +26,2 @@
-        // The template path already provides vernacular "de" and analysis "en", so we only add the
-        // remaining demo writing systems here. They're appended after the template's, preserving the
+        // The template path already provides vernacular "de" (with demo ICU collation) and analysis "en".
+        // Add the remaining demo writing systems. They're appended after the template's, preserving the
```

## backend/FwLite/LcmCrdt/Project/ProjectTemplate.cs

### ProjectTemplate.CreateNewSnapshot

method · +3 -2

```diff
@@ -25,1 +25,2 @@
-        WritingSystemId? analysisWs = null)
+        WritingSystemId? analysisWs = null,
+        Func<WritingSystem, WritingSystem>? configureVernacular = null)
@@ -36,1 +37,1 @@
-        return snapshot with { WritingSystems = WithRequestedWritingSystems(snapshot.WritingSystems, vernacularWs, analysisWs) };
+        return snapshot with { WritingSystems = WithRequestedWritingSystems(snapshot.WritingSystems, vernacularWs, analysisWs, configureVernacular) };
```

### ProjectTemplate.WithRequestedWritingSystems

method · +9 -2

```diff
@@ -39,1 +40,5 @@
-    private static WritingSystems WithRequestedWritingSystems(WritingSystems template, WritingSystemId vernacularWs, WritingSystemId? analysisWs)
+    private static WritingSystems WithRequestedWritingSystems(
+        WritingSystems template,
+        WritingSystemId vernacularWs,
+        WritingSystemId? analysisWs,
+        Func<WritingSystem, WritingSystem>? configureVernacular = null)
@@ -41,1 +46,4 @@
-        WritingSystem[] vernacular = [.. template.Vernacular, DefaultWritingSystem(vernacularWs, WritingSystemType.Vernacular)];
+        var vernacularWsEntity = DefaultWritingSystem(vernacularWs, WritingSystemType.Vernacular);
+        if (configureVernacular is not null)
+            vernacularWsEntity = configureVernacular(vernacularWsEntity);
+        WritingSystem[] vernacular = [.. template.Vernacular, vernacularWsEntity];
```

## backend/FwLite/LcmCrdt/CrdtProjectsService.cs

### CrdtProjectsService.CreateExampleProject

method · +4 -1

```diff
@@ -134,1 +134,4 @@
-        return await CreateProjectFromTemplate(new(name, name.ToLowerInvariant(), AfterCreate: ExampleProjectData.Seed, Role: UserProjectRole.Manager), vernacularWs: "de");
+        return await CreateProjectFromTemplate(
+            new(name, name.ToLowerInvariant(), AfterCreate: ExampleProjectData.Seed, Role: UserProjectRole.Manager),
+            vernacularWs: "de",
+            configureVernacular: ws => ws with { IcuCollationRules = ExampleProjectData.DemoIcuCollationRules });
```

### CrdtProjectsService.CreateProjectFromTemplate

method · +3 -2

```diff
@@ -147,1 +150,2 @@
-        WritingSystemId? analysisWs = null)
+        WritingSystemId? analysisWs = null,
+        Func<WritingSystem, WritingSystem>? configureVernacular = null)
@@ -163,1 +167,1 @@
-                var snapshot = ProjectTemplate.CreateNewSnapshot(jsonOptions, vernacularWs, analysisWs);
+                var snapshot = ProjectTemplate.CreateNewSnapshot(jsonOptions, vernacularWs, analysisWs, configureVernacular);
```

## backend/FwLite/MiniLcm/SyncHelpers/WritingSystemSync.cs

### lines 1–5 — from backend/FwLite/MiniLcm.Tests/WritingSystemSyncTests.cs

other · +4 -0

```diff
@@ -0,0 +1,3 @@
+using MiniLcm.Models;
+using MiniLcm.SyncHelpers;
+
@@ -5,0 +5,1 @@
+
```

### WritingSystemSync.WritingSystemDiffToUpdate

method · +6 -0

```diff
@@ -46,0 +47,6 @@
+        patchDocument.Operations.AddRange(SimpleStringDiff.GetStringDiff<WritingSystem>(nameof(WritingSystem.IcuCollationRules),
+            beforeWritingSystem.IcuCollationRules,
+            afterWritingSystem.IcuCollationRules));
+        patchDocument.Operations.AddRange(SimpleStringDiff.GetStringDiff<WritingSystem>(nameof(WritingSystem.SystemCollationLocale),
+            beforeWritingSystem.SystemCollationLocale,
+            afterWritingSystem.SystemCollationLocale));
```

## backend/FwLite/FwDataMiniLcmBridge/Api/FwDataMiniLcmApi.cs

### FwDataMiniLcmApi.FromLcmWritingSystem

method · +4 -1

```diff
@@ -115,0 +117,1 @@
+        var (icuCollationRules, systemCollationLocale) = WritingSystemCollationExtractor.Extract(ws);
@@ -128,1 +130,3 @@
-            Exemplars = ws.CharacterSets.FirstOrDefault(s => s.Type == "index")?.Characters.ToArray() ?? []
+            Exemplars = ws.CharacterSets.FirstOrDefault(s => s.Type == "index")?.Characters.ToArray() ?? [],
+            IcuCollationRules = icuCollationRules,
+            SystemCollationLocale = systemCollationLocale,
```

### lines 5–5

other · +1 -0

```diff
@@ -4,0 +5,1 @@
+using FwDataMiniLcmBridge.Collation;
```

### lines 1–5 — from backend/FwLite/FwDataMiniLcmBridge/Collation/WritingSystemCollationExtractor.cs

other · +4 -0

```diff
@@ -0,0 +1,3 @@
+using SIL.LCModel.Core.WritingSystems;
+using SIL.WritingSystems;
+
@@ -5,0 +5,1 @@
+
```

### FwDataMiniLcmBridge.Collation — from backend/FwLite/FwDataMiniLcmBridge/Collation/WritingSystemCollationExtractor.cs

other · +1 -0

```diff
@@ -4,0 +4,1 @@
+namespace FwDataMiniLcmBridge.Collation;
```

### WritingSystemCollationExtractor — from backend/FwLite/FwDataMiniLcmBridge/Collation/WritingSystemCollationExtractor.cs

other · +3 -0

```diff
@@ -6,0 +6,2 @@
+public static class WritingSystemCollationExtractor
+{
@@ -21,0 +21,1 @@
+}
```

### WritingSystemCollationExtractor.Extract — from backend/FwLite/FwDataMiniLcmBridge/Collation/WritingSystemCollationExtractor.cs

method · +13 -0

```diff
@@ -8,0 +8,13 @@
+    public static (string? IcuCollationRules, string? SystemCollationLocale) Extract(CoreWritingSystemDefinition ws)
+    {
+        var cd = ws.DefaultCollation;
+        cd.Validate(out _);
+
+        return cd switch
+        {
+            SystemCollationDefinition sys => (null, sys.LanguageTag),
+            RulesCollationDefinition rules when !string.IsNullOrEmpty(rules.CollationRules)
+                => (rules.CollationRules, null),
+            _ => (null, null)
+        };
+    }
```

## backend/FwLite/FwDataMiniLcmBridge/Api/UpdateProxy/UpdateWritingSystemProxy.cs

### UpdateWritingSystemProxy

other · +3 -0

```diff
@@ -49,0 +50,2 @@
+
+    // Collation is import-only from FLEx LDML; MiniLcm updates do not write back to fwdata.
@@ -57,0 +57,1 @@
+
```

### UpdateWritingSystemProxy.IcuCollationRules

method · +5 -0

```diff
@@ -52,0 +52,5 @@
+    public override string? IcuCollationRules
+    {
+        get => null;
+        set { }
+    }
```

### UpdateWritingSystemProxy.SystemCollationLocale

method · +5 -0

```diff
@@ -58,0 +58,5 @@
+    public override string? SystemCollationLocale
+    {
+        get => null;
+        set { }
+    }
```

## backend/FwLite/LcmCrdt/LcmCrdtKernel.cs

### lines 1–9 — from backend/FwLite/LcmCrdt.Tests/Culture/WritingSystemCollatorProviderTests.cs

other · +8 -0

```diff
@@ -0,0 +1,7 @@
+using LcmCrdt.Culture;
+using Microsoft.Extensions.Caching.Memory;
+using Microsoft.Extensions.DependencyInjection;
+using MiniLcm.Culture;
+using MiniLcm.Models;
+using SIL.WritingSystems;
+
@@ -9,0 +9,1 @@
+
```

### LcmCrdt.Tests.MiniLcmTests — from backend/FwLite/LcmCrdt.Tests/MiniLcmTests/CustomCollationSortingTests.cs

other · +1 -0

```diff
@@ -0,0 +1,1 @@
+namespace LcmCrdt.Tests.MiniLcmTests;
```

### OpenProjectTests.CanCreateExampleProject — from backend/FwLite/LcmCrdt.Tests/OpenProjectTests.cs

method · +8 -0

```diff
@@ -34,0 +35,1 @@
+        writingSystems.Vernacular.Single(ws => ws.WsId == "de").IcuCollationRules.Should().Be(ExampleProjectData.DemoIcuCollationRules);
@@ -43,0 +45,7 @@
+        var headwords = await api
+            .GetEntries(new QueryOptions(new SortOptions(SortField.Headword, "de")))
+            .Select(e => e.LexemeForm["de"])
+            .ToArrayAsync();
+        headwords.Should().Equal(
+            "Banane", "Beere", "Apfel", "Erdbeere", "Heidelbeere", "Orange", "Traube");
+
```

### LcmCrdtKernel.AddLcmCrdtClientCore

method · +1 -0

```diff
@@ -56,0 +57,1 @@
+        services.AddSingleton<IWritingSystemCollatorProvider, WritingSystemCollatorProvider>();
```

### FwLiteWebServer.SetupAppServer — from backend/FwLite/FwLiteWeb/FwLiteWebServer.cs

method · +2 -5

```diff
@@ -27,5 +27,2 @@
-        if (builder.Environment.IsDevelopment())
-        {
-            //do this early so we catch bugs on startup
-            ProjectLoader.Init();
-        }
+        // ICU required for FwData bridge (liblcm / icu.net), not for CRDT collation (ICU4N).
+        ProjectLoader.Init();
```

## backend/FwLite/LcmCrdt/LcmCrdt.csproj

### lines 27–27

config · +1 -0

```diff
@@ -26,0 +27,1 @@
+    <PackageReference Include="ICU4N.Collation" />
```

### lines 32–32 — from backend/Directory.Packages.props

config · +1 -0

```diff
@@ -31,0 +32,1 @@
+    <PackageVersion Include="ICU4N.Collation" Version="60.1.0-alpha.356" />
```

## backend/FwLite/CONTEXT.md

### fragment 1

other · +38 -1

```diff
@@ -1,1 +1,38 @@
-# FwLite Commenting
+# FwLite
+
+## Collation
+
+How strings in a writing system are compared when ordering dictionary content. Imported from FLEx per writing system; stored on `WritingSystem` without LDML at runtime.
+
+**Collation**:
+The rules that govern string comparison for a writing system (ICU tailoring or .NET locale alias). Distinct from list position and from the user action of sorting entries.
+_Avoid_: Sort rules (when meaning collation specifically), custom sorting (as a model term)
+
+**Writing system order**:
+Where a writing system appears in the project's vernacular or analysis list (`WritingSystem.Order`). Not how strings alphabetize.
+_Avoid_: Confusing with collation
+
+**Entry sort**:
+The user-facing action of ordering the entry list (e.g. by headword in a chosen writing system). Uses the selected writing system's collation for headword comparison.
+_Avoid_: Collation (when meaning the user action)
+
+**Collation scope (v1)**:
+Collation governs headword entry sort (`SortField.Headword`) and the alphabetical tie-break when search results fall through to headword order (`SortField.SearchRelevance`). It does not govern search matching (whether a query matches text) or FTS ranking.
+_Avoid_: Applying collation to `ContainsDiacriticMatch`, prefix/contains predicates, or FTS rank
+
+**Imported collation**:
+Collation metadata synced from FLEx onto `WritingSystem`. Two optional fields: compiled ICU rules, or a .NET locale alias for "same as another language." No LDML at FwLite runtime.
+_Avoid_: Storing LDML, simple-rule source text, or import metadata
+
+**Legacy collation fallback**:
+When neither field is set, headword comparison uses the pre-existing FwLite behavior (`CultureInfo` from `WsId`, case-insensitive with lowercase-before-uppercase tie-break). FLEx "Default Ordering" is imported as this fallback too — FwLite does not replicate FLEx's empty-rule ICU default until we choose to.
+_Avoid_: Treating `null` and `""` as different states for `IcuCollationRules`
+
+**Collation compare (imported)**:
+When `IcuCollationRules` or `SystemCollationLocale` is set, use ICU4N (`RuleBasedCollator` / locale `Collator`) `Compare` with no legacy case tie-break layered on top. Matches FLEx for custom and other-language modes. FwData/FLEx bridge code still uses icu.net separately.
+_Avoid_: Applying case-insensitive or lowercase-first logic on top of imported ICU4N collation
+
+**Collation import (from FLEx)**:
+Populated when mapping `CoreWritingSystemDefinition` → `WritingSystem` in the FwData bridge. Custom modes: store non-empty compiled ICU rules only. Other-language: store .NET locale tag only. Default ordering: leave both fields null (legacy fallback). Import-only — no write-back to fwdata LDML.
+_Avoid_: Parsing LDML in FwLite; persisting empty `IcuCollationRules` for default ordering
+
```

### fragment 2

other · +5 -0

```diff
@@ -39,0 +39,5 @@
+**Collation write-back**:
+Explicitly a no-op. The fwdata `UpdateWritingSystemProxy` overrides collation fields and does not write them to LDML.
+_Avoid_: Assuming bidirectional collation sync
+
+## Commenting
```

### lines 7–7 — from CONTEXT-MAP.md

other · +1 -1

```diff
@@ -7,1 +7,1 @@
-- [FwLite Commenting](./backend/FwLite/CONTEXT.md) — collaborative comments on dictionary entries, senses, and example sentences
+- [FwLite](./backend/FwLite/CONTEXT.md) — dictionary editing concerns including collation and collaborative comments
```

## backend/FwLite/LcmCrdt.Tests/Changes/ChangeDeserializationRegressionData.latest.verified.txt

### lines 759–779

other · +17 -0

```diff
@@ -758,0 +759,2 @@
+    "IcuCollationRules": null,
+    "SystemCollationLocale": null,
@@ -762,0 +765,15 @@
+  {
+    "$type": "CreateWritingSystemChange",
+    "WsId": "prl",
+    "Name": "Investment Account",
+    "Abbreviation": "JBOD",
+    "Font": "SCSI",
+    "Exemplars": [
+      "Games \u0026 Industrial"
+    ],
+    "IcuCollationRules": "parsing",
+    "SystemCollationLocale": "interactive",
+    "Type": 1,
+    "Order": 0.10446673530044903,
+    "EntityId": "f6928dbf-09ad-c0e8-a12a-23616641b071"
+  },
```

### fragment 1 — from backend/FwLite/LcmCrdt.Tests/Changes/ChangeDeserializationRegressionData.legacy.verified.txt

other · +33 -0

```diff
@@ -627,0 +628,33 @@
+  },
+  {
+    "Input": {
+      "$type": "CreateWritingSystemChange",
+      "WsId": "zms",
+      "Name": "quantify",
+      "Abbreviation": "Ergonomic",
+      "Font": "software",
+      "Exemplars": [
+        "Berkshire"
+      ],
+      "Type": 1,
+      "Order": 0.7988004089201804,
+      "EntityId": "0fccfaaa-1e55-f6fb-966f-5c1e6caedf45"
+    },
+    "Output": {
+      "$type": "CreateWritingSystemChange",
+      "WsId": "zms",
+      "Name": "quantify",
+      "Abbreviation": "Ergonomic",
+      "Font": "software",
+      "Exemplars": [
+        "Berkshire"
+      ],
+      "IcuCollationRules": null,
+      "SystemCollationLocale": null,
+      "Type": 1,
+      "Order": 0.7988004089201804,
+      "EntityId": "0fccfaaa-1e55-f6fb-966f-5c1e6caedf45"
+    }
+  },
+  {
+    "Input": {
```

### fragment 2 — from backend/FwLite/LcmCrdt.Tests/Changes/ChangeDeserializationRegressionData.legacy.verified.txt

other · +27 -0

```diff
@@ -661,0 +661,27 @@
+      "$type": "CreateWritingSystemChange",
+      "WsId": "zms",
+      "Name": "quantify",
+      "Abbreviation": "Ergonomic",
+      "Font": "software",
+      "Exemplars": [
+        "Berkshire"
+      ],
+      "Type": 1,
+      "Order": 0.7988004089201804,
+      "EntityId": "0fccfaaa-1e55-f6fb-966f-5c1e6caedf45"
+    },
+    "Output": {
+      "$type": "CreateWritingSystemChange",
+      "WsId": "zms",
+      "Name": "quantify",
+      "Abbreviation": "Ergonomic",
+      "Font": "software",
+      "Exemplars": [
+        "Berkshire"
+      ],
+      "IcuCollationRules": null,
+      "SystemCollationLocale": null,
+      "Type": 1,
+      "Order": 0.7988004089201804,
+      "EntityId": "0fccfaaa-1e55-f6fb-966f-5c1e6caedf45"
+    }
```

### fragment 1 — from backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

other · +27 -0

```diff
@@ -3496,0 +3497,2 @@
+      "IcuCollationRules": null,
+      "SystemCollationLocale": null,
@@ -3501,0 +3504,23 @@
+  {
+    "$type": "MiniLcmCrdtAdapter",
+    "Obj": {
+      "$type": "WritingSystem",
+      "Id": "3b85e4c8-6330-9167-2349-3bba70056346",
+      "MaybeId": "3b85e4c8-6330-9167-2349-3bba70056346",
+      "WsId": "syk",
+      "IsAudio": false,
+      "Name": "vortals",
+      "Abbreviation": "Granite",
+      "Font": "Iowa",
+      "DeletedAt": null,
+      "Type": 1,
+      "Exemplars": [
+        "Incredible Metal Chair"
+      ],
+      "IcuCollationRules": "Customizable",
+      "SystemCollationLocale": "Borders",
+      "Order": 0.03765569767409571
+    },
+    "Id": "3b85e4c8-6330-9167-2349-3bba70056346",
+    "DeletedAt": null
+  },
@@ -3517,0 +3543,2 @@
+      "IcuCollationRules": null,
+      "SystemCollationLocale": null,
```

### fragment 2 — from backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

other · +25 -0

```diff
@@ -3522,0 +3550,23 @@
+  {
+    "$type": "MiniLcmCrdtAdapter",
+    "Obj": {
+      "$type": "WritingSystem",
+      "Id": "9be8f583-63b4-cf64-4202-0e09481317c0",
+      "MaybeId": "9be8f583-63b4-cf64-4202-0e09481317c0",
+      "WsId": "enh",
+      "IsAudio": false,
+      "Name": "internet solution",
+      "Abbreviation": "Walk",
+      "Font": "payment",
+      "DeletedAt": null,
+      "Type": 0,
+      "Exemplars": [
+        "Licensed Fresh Cheese"
+      ],
+      "IcuCollationRules": "connect",
+      "SystemCollationLocale": "Oregon",
+      "Order": 0.9633181157872764
+    },
+    "Id": "9be8f583-63b4-cf64-4202-0e09481317c0",
+    "DeletedAt": null
+  },
@@ -3563,0 +3614,2 @@
+      "IcuCollationRules": null,
+      "SystemCollationLocale": null,
```

### fragment 3 — from backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

other · +25 -0

```diff
@@ -3568,0 +3621,23 @@
+  {
+    "$type": "MiniLcmCrdtAdapter",
+    "Obj": {
+      "$type": "WritingSystem",
+      "Id": "3b9876d2-3b5d-a9f6-735d-7b6a8c232acd",
+      "MaybeId": "3b9876d2-3b5d-a9f6-735d-7b6a8c232acd",
+      "WsId": "ksh",
+      "IsAudio": false,
+      "Name": "Refined",
+      "Abbreviation": "Coordinator",
+      "Font": "indexing",
+      "DeletedAt": null,
+      "Type": 1,
+      "Exemplars": [
+        "National"
+      ],
+      "IcuCollationRules": "Monitored",
+      "SystemCollationLocale": "bandwidth",
+      "Order": 0.2935114043495951
+    },
+    "Id": "3b9876d2-3b5d-a9f6-735d-7b6a8c232acd",
+    "DeletedAt": null
+  },
@@ -3584,0 +3660,2 @@
+      "IcuCollationRules": null,
+      "SystemCollationLocale": null,
```

### fragment 4 — from backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

other · +23 -0

```diff
@@ -3589,0 +3667,23 @@
+  {
+    "$type": "MiniLcmCrdtAdapter",
+    "Obj": {
+      "$type": "WritingSystem",
+      "Id": "6e82adb2-46c1-7a00-e603-c18419f13d4f",
+      "MaybeId": "6e82adb2-46c1-7a00-e603-c18419f13d4f",
+      "WsId": "mnm",
+      "IsAudio": false,
+      "Name": "uniform",
+      "Abbreviation": "feed",
+      "Font": "Intelligent Plastic Chips",
+      "DeletedAt": null,
+      "Type": 1,
+      "Exemplars": [
+        "Beauty, Games \u0026 Movies"
+      ],
+      "IcuCollationRules": "Assurance",
+      "SystemCollationLocale": "Kids \u0026 Electronics",
+      "Order": 0.34200726440404006
+    },
+    "Id": "6e82adb2-46c1-7a00-e603-c18419f13d4f",
+    "DeletedAt": null
+  },
```

### lines 356–360 — from backend/FwLite/LcmCrdt.Tests/DataModelSnapshotTests.VerifyDbModel.verified.txt

other · +2 -0

```diff
@@ -355,0 +356,1 @@
+      IcuCollationRules (string)
@@ -358,0 +360,1 @@
+      SystemCollationLocale (string)
```

## backend/FwLite/LcmCrdt.Tests/Culture/WritingSystemCollatorProviderTests.cs

### LcmCrdt.Tests.Culture

other · +1 -0

```diff
@@ -8,0 +8,1 @@
+namespace LcmCrdt.Tests.Culture;
```

### WritingSystemCollatorProviderTests

other · +11 -0

```diff
@@ -10,0 +10,2 @@
+public class WritingSystemCollatorProviderTests
+{
@@ -21,0 +21,1 @@
+
@@ -31,0 +31,1 @@
+
@@ -39,0 +39,1 @@
+
@@ -47,0 +47,1 @@
+
@@ -56,0 +56,1 @@
+
@@ -64,0 +64,1 @@
+
@@ -72,0 +72,1 @@
+
@@ -80,0 +80,1 @@
+
@@ -89,0 +89,1 @@
+}
```

### WritingSystemCollatorProviderTests.CreateProvider

method · +9 -0

```diff
@@ -12,0 +12,9 @@
+    private static IWritingSystemCollatorProvider CreateProvider()
+    {
+        var services = new ServiceCollection();
+        services.AddLogging();
+        services.AddMemoryCache();
+        services.AddSingleton<IMiniLcmCultureProvider, LcmCrdtCultureProvider>();
+        services.AddSingleton<IWritingSystemCollatorProvider, WritingSystemCollatorProvider>();
+        return services.BuildServiceProvider().GetRequiredService<IWritingSystemCollatorProvider>();
+    }
```

### WritingSystemCollatorProviderTests.BaseWs

method · +9 -0

```diff
@@ -22,0 +22,9 @@
+    private static WritingSystem BaseWs() => new()
+    {
+        Id = Guid.NewGuid(),
+        WsId = "en",
+        Name = "English",
+        Abbreviation = "En",
+        Font = "Arial",
+        Type = WritingSystemType.Vernacular,
+    };
```

### WritingSystemCollatorProviderTests.GetCollator_UsesIcu4NLocaleCollator_WhenLocaleSet

method · +7 -0

```diff
@@ -32,0 +32,7 @@
+    [Fact]
+    public void GetCollator_UsesIcu4NLocaleCollator_WhenLocaleSet()
+    {
+        var provider = CreateProvider();
+        var collator = provider.GetCollator(BaseWs() with { SystemCollationLocale = "de" });
+        collator.Should().BeOfType<Icu4NLocaleCollator>();
+    }
```

### WritingSystemCollatorProviderTests.GetCollator_UsesIcu4NRulesCollator_WhenRulesSet

method · +7 -0

```diff
@@ -40,0 +40,7 @@
+    [Fact]
+    public void GetCollator_UsesIcu4NRulesCollator_WhenRulesSet()
+    {
+        var provider = CreateProvider();
+        var collator = provider.GetCollator(BaseWs() with { IcuCollationRules = "&a < b" });
+        collator.Should().BeOfType<Icu4NRulesCollator>();
+    }
```

### WritingSystemCollatorProviderTests.GetCollator_UsesLegacyFallback_WhenCollationUnset

method · +8 -0

```diff
@@ -48,0 +48,8 @@
+    [Fact]
+    public void GetCollator_UsesLegacyFallback_WhenCollationUnset()
+    {
+        var provider = CreateProvider();
+        var collator = provider.GetCollator(BaseWs());
+        collator.Should().NotBeOfType<Icu4NLocaleCollator>();
+        collator.Should().NotBeOfType<Icu4NRulesCollator>();
+    }
```

### WritingSystemCollatorProviderTests.Icu4NRulesCollator_SortsByCustomRules

method · +7 -0

```diff
@@ -57,0 +57,7 @@
+    [Fact]
+    public void Icu4NRulesCollator_SortsByCustomRules()
+    {
+        var provider = CreateProvider();
+        var collator = provider.GetCollator(BaseWs() with { IcuCollationRules = "&z < a" });
+        collator.Compare("z", "a").Should().BeLessThan(0);
+    }
```

### WritingSystemCollatorProviderTests.Icu4NRulesCollator_ReversesAAndB

method · +7 -0

```diff
@@ -65,0 +65,7 @@
+    [Fact]
+    public void Icu4NRulesCollator_ReversesAAndB()
+    {
+        var provider = CreateProvider();
+        var collator = provider.GetCollator(BaseWs() with { IcuCollationRules = "&b < a &B < A" });
+        collator.Compare("Banane", "Apfel").Should().BeLessThan(0);
+    }
```

### WritingSystemCollatorProviderTests.LegacyCollator_PrefersLowercaseOnCaseInsensitiveTie

method · +7 -0

```diff
@@ -73,0 +73,7 @@
+    [Fact]
+    public void LegacyCollator_PrefersLowercaseOnCaseInsensitiveTie()
+    {
+        var provider = CreateProvider();
+        var collator = provider.GetCollator(BaseWs());
+        collator.Compare("Ab", "ab").Should().BeGreaterThan(0);
+    }
```

### WritingSystemCollatorProviderTests.GetCollator_FallsBackToLegacy_WhenRulesInvalid

method · +8 -0

```diff
@@ -81,0 +81,8 @@
+    [Fact]
+    public void GetCollator_FallsBackToLegacy_WhenRulesInvalid()
+    {
+        var provider = CreateProvider();
+        var collator = provider.GetCollator(BaseWs() with { IcuCollationRules = "not valid icu rules <<<<" });
+        collator.Should().NotBeOfType<Icu4NRulesCollator>();
+        collator.Should().BeOfType<LegacyCompareInfoCollator>();
+    }
```

## backend/FwLite/LcmCrdt.Tests/MiniLcmTests/CustomCollationSortingTests.cs

### lines 2–2

other · +1 -0 · low-signal (whitespace)

```diff
@@ -2,0 +2,1 @@
+
```

### CustomCollationSortingTests

other · +4 -0

```diff
@@ -3,0 +3,2 @@
+public class CustomCollationSortingTests(MiniLcmApiFixture fixture) : IClassFixture<MiniLcmApiFixture>
+{
@@ -32,0 +32,1 @@
+
@@ -61,0 +61,1 @@
+}
```

### CustomCollationSortingTests.HeadwordSort_UsesIcuCollationRules

method · +27 -0

```diff
@@ -5,0 +5,27 @@
+    [Fact]
+    public async Task HeadwordSort_UsesIcuCollationRules()
+    {
+        const string wsId = "en-x-icu-test";
+        await fixture.Api.CreateWritingSystem(new()
+        {
+            Id = Guid.NewGuid(),
+            Type = WritingSystemType.Vernacular,
+            WsId = wsId,
+            Name = "Custom ICU",
+            Abbreviation = "Ci",
+            Font = "Arial",
+            IcuCollationRules = "&z < a",
+        });
+
+        var apple = await fixture.Api.CreateEntry(new() { LexemeForm = { { wsId, "apple" } } });
+        var zebra = await fixture.Api.CreateEntry(new() { LexemeForm = { { wsId, "zebra" } } });
+        var ids = new[] { apple.Id, zebra.Id }.ToHashSet();
+
+        var headwords = await fixture.Api
+            .GetEntries(new QueryOptions(new SortOptions(SortField.Headword, wsId)))
+            .Where(e => ids.Contains(e.Id))
+            .Select(e => e.Headword())
+            .ToArrayAsync();
+
+        headwords.Should().Equal("zebra", "apple");
+    }
```

### CustomCollationSortingTests.HeadwordSort_UsesSystemCollationLocale

method · +28 -0

```diff
@@ -33,0 +33,28 @@
+    [Fact]
+    public async Task HeadwordSort_UsesSystemCollationLocale()
+    {
+        const string wsId = "cs";
+        await fixture.Api.CreateWritingSystem(new()
+        {
+            Id = Guid.NewGuid(),
+            Type = WritingSystemType.Vernacular,
+            WsId = wsId,
+            Name = "Czech",
+            Abbreviation = "Cs",
+            Font = "Arial",
+            SystemCollationLocale = "cs",
+        });
+
+        // English sorts c before h; Czech treats "ch" as a letter after h.
+        var cha = await fixture.Api.CreateEntry(new() { LexemeForm = { { wsId, "cha" } } });
+        var ha = await fixture.Api.CreateEntry(new() { LexemeForm = { { wsId, "ha" } } });
+        var ids = new[] { cha.Id, ha.Id }.ToHashSet();
+
+        var headwords = await fixture.Api
+            .GetEntries(new QueryOptions(new SortOptions(SortField.Headword, wsId)))
+            .Where(e => ids.Contains(e.Id))
+            .Select(e => e.Headword())
+            .ToArrayAsync();
+
+        headwords.Should().Equal("ha", "cha");
+    }
```

## backend/FwLite/MiniLcm.Tests/WritingSystemSyncTests.cs

### MiniLcm.Tests

other · +1 -0

```diff
@@ -4,0 +4,1 @@
+namespace MiniLcm.Tests;
```

### WritingSystemSyncTests

other · +6 -0

```diff
@@ -6,0 +6,2 @@
+public class WritingSystemSyncTests
+{
@@ -17,0 +17,1 @@
+
@@ -30,0 +30,1 @@
+
@@ -43,0 +43,1 @@
+
@@ -54,0 +54,1 @@
+}
```

### WritingSystemSyncTests.BaseWs

method · +9 -0

```diff
@@ -8,0 +8,9 @@
+    private static WritingSystem BaseWs() => new()
+    {
+        Id = Guid.NewGuid(),
+        WsId = "en",
+        Name = "English",
+        Abbreviation = "En",
+        Font = "Arial",
+        Type = WritingSystemType.Vernacular,
+    };
```

### WritingSystemSyncTests.DiffToUpdate_IncludesIcuCollationRules

method · +12 -0

```diff
@@ -18,0 +18,12 @@
+    [Fact]
+    public void DiffToUpdate_IncludesIcuCollationRules()
+    {
+        var before = BaseWs();
+        var after = before with { IcuCollationRules = "&a < b" };
+
+        var update = WritingSystemSync.WritingSystemDiffToUpdate(before, after);
+
+        update.Should().NotBeNull();
+        var op = update!.Patch.Operations.Single(o => o.Path == $"/{nameof(WritingSystem.IcuCollationRules)}");
+        op.Value?.ToString().Should().Be("&a < b");
+    }
```

### WritingSystemSyncTests.DiffToUpdate_IncludesSystemCollationLocale

method · +12 -0

```diff
@@ -31,0 +31,12 @@
+    [Fact]
+    public void DiffToUpdate_IncludesSystemCollationLocale()
+    {
+        var before = BaseWs();
+        var after = before with { SystemCollationLocale = "de" };
+
+        var update = WritingSystemSync.WritingSystemDiffToUpdate(before, after);
+
+        update.Should().NotBeNull();
+        var op = update!.Patch.Operations.Single(o => o.Path == $"/{nameof(WritingSystem.SystemCollationLocale)}");
+        op.Value?.ToString().Should().Be("de");
+    }
```

### WritingSystemSyncTests.DiffToUpdate_NoOpsWhenCollationUnchanged

method · +10 -0

```diff
@@ -44,0 +44,10 @@
+    [Fact]
+    public void DiffToUpdate_NoOpsWhenCollationUnchanged()
+    {
+        var before = BaseWs() with { IcuCollationRules = "&a < b" };
+        var after = before with { };
+
+        var update = WritingSystemSync.WritingSystemDiffToUpdate(before, after);
+
+        update.Should().BeNull();
+    }
```

## backend/FwLite/LcmCrdt/Migrations/20260702040259_AddWritingSystemCollation.Designer.cs

### lines 1–11

other · +11 -0 · low-signal (generated)

```diff
@@ -0,0 +1,11 @@
+﻿// <auto-generated />
+using System;
+using System.Collections.Generic;
+using LcmCrdt;
+using Microsoft.EntityFrameworkCore;
+using Microsoft.EntityFrameworkCore.Infrastructure;
+using Microsoft.EntityFrameworkCore.Migrations;
+using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
+
+#nullable disable
+
```

### LcmCrdt.Migrations

other · +3 -0 · low-signal (generated)

```diff
@@ -12,0 +12,2 @@
+namespace LcmCrdt.Migrations
+{
@@ -858,0 +858,1 @@
+}
```

### LcmCrdt.Migrations.AddWritingSystemCollation

other · +6 -0 · low-signal (generated)

```diff
@@ -14,0 +14,5 @@
+    [DbContext(typeof(LcmCrdtDbContext))]
+    [Migration("20260702040259_AddWritingSystemCollation")]
+    partial class AddWritingSystemCollation
+    {
+        /// <inheritdoc />
@@ -857,0 +857,1 @@
+    }
```

### LcmCrdt.Migrations.AddWritingSystemCollation.BuildTargetModel.fragment 1

method-fragment · +39 -0 · low-signal (generated)

```diff
@@ -19,0 +19,39 @@
+        protected override void BuildTargetModel(ModelBuilder modelBuilder)
+        {
+#pragma warning disable 612, 618
+            modelBuilder.HasAnnotation("ProductVersion", "10.0.8");
+
+            modelBuilder.Entity("LcmCrdt.FullTextSearch.EntrySearchRecord", b =>
+                {
+                    b.Property<Guid>("Id")
+                        .ValueGeneratedOnAdd()
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("CitationForm")
+                        .IsRequired()
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Definition")
+                        .IsRequired()
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Gloss")
+                        .IsRequired()
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Headword")
+                        .IsRequired()
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("LexemeForm")
+                        .IsRequired()
+                        .HasColumnType("TEXT");
+
+                    b.HasKey("Id");
+
+                    b.ToTable("EntrySearchRecord", null, t =>
+                        {
+                            t.ExcludeFromMigrations();
+                        });
+                });
+
```

### LcmCrdt.Migrations.AddWritingSystemCollation.BuildTargetModel.fragment 2

method-fragment · +40 -0 · low-signal (generated)

```diff
@@ -58,0 +58,40 @@
+            modelBuilder.Entity("LcmCrdt.ProjectData", b =>
+                {
+                    b.Property<Guid>("Id")
+                        .ValueGeneratedOnAdd()
+                        .HasColumnType("TEXT");
+
+                    b.Property<Guid>("ClientId")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Code")
+                        .IsRequired()
+                        .HasColumnType("TEXT");
+
+                    b.Property<Guid?>("FwProjectId")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("LastUserId")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("LastUserName")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Name")
+                        .IsRequired()
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("OriginDomain")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Role")
+                        .IsRequired()
+                        .ValueGeneratedOnAdd()
+                        .HasColumnType("TEXT")
+                        .HasDefaultValue("Editor");
+
+                    b.HasKey("Id");
+
+                    b.ToTable("ProjectData");
+                });
+
```

### LcmCrdt.Migrations.AddWritingSystemCollation.BuildTargetModel.fragment 3

method-fragment · +40 -0 · low-signal (generated)

```diff
@@ -98,0 +98,40 @@
+            modelBuilder.Entity("MiniLcm.Models.ComplexFormComponent", b =>
+                {
+                    b.Property<Guid>("Id")
+                        .ValueGeneratedOnAdd()
+                        .HasColumnType("TEXT");
+
+                    b.Property<Guid>("ComplexFormEntryId")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("ComplexFormHeadword")
+                        .HasColumnType("TEXT");
+
+                    b.Property<Guid>("ComponentEntryId")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("ComponentHeadword")
+                        .HasColumnType("TEXT");
+
+                    b.Property<Guid?>("ComponentSenseId")
+                        .HasColumnType("TEXT")
+                        .HasColumnName("ComponentSenseId");
+
+                    b.Property<DateTimeOffset?>("DeletedAt")
+                        .HasColumnType("TEXT");
+
+                    b.Property<double>("Order")
+                        .HasColumnType("REAL");
+
+                    b.Property<Guid?>("SnapshotId")
+                        .HasColumnType("TEXT");
+
+                    b.HasKey("Id");
+
+                    b.HasIndex("ComponentEntryId");
+
+                    b.HasIndex("ComponentSenseId");
+
+                    b.HasIndex("SnapshotId")
+                        .IsUnique();
+
```

### LcmCrdt.Migrations.AddWritingSystemCollation.BuildTargetModel.fragment 4

method-fragment · +35 -0 · low-signal (generated)

```diff
@@ -138,0 +138,35 @@
+                    b.HasIndex("ComplexFormEntryId", "ComponentEntryId")
+                        .IsUnique()
+                        .HasFilter("ComponentSenseId IS NULL");
+
+                    b.HasIndex("ComplexFormEntryId", "ComponentEntryId", "ComponentSenseId")
+                        .IsUnique()
+                        .HasFilter("ComponentSenseId IS NOT NULL");
+
+                    b.ToTable("ComplexFormComponents", (string)null);
+                });
+
+            modelBuilder.Entity("MiniLcm.Models.ComplexFormType", b =>
+                {
+                    b.Property<Guid>("Id")
+                        .ValueGeneratedOnAdd()
+                        .HasColumnType("TEXT");
+
+                    b.Property<DateTimeOffset?>("DeletedAt")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Name")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.Property<Guid?>("SnapshotId")
+                        .HasColumnType("TEXT");
+
+                    b.HasKey("Id");
+
+                    b.HasIndex("SnapshotId")
+                        .IsUnique();
+
+                    b.ToTable("ComplexFormType");
+                });
+
```

### LcmCrdt.Migrations.AddWritingSystemCollation.BuildTargetModel.fragment 5

method-fragment · +39 -0 · low-signal (generated)

```diff
@@ -173,0 +173,39 @@
+            modelBuilder.Entity("MiniLcm.Models.CustomView", b =>
+                {
+                    b.Property<Guid>("Id")
+                        .ValueGeneratedOnAdd()
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Analysis")
+                        .HasColumnType("jsonb");
+
+                    b.Property<int>("Base")
+                        .HasColumnType("INTEGER");
+
+                    b.Property<DateTimeOffset?>("DeletedAt")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("EntryFields")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.Property<string>("ExampleFields")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.Property<string>("Name")
+                        .IsRequired()
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("SenseFields")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.Property<Guid?>("SnapshotId")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Vernacular")
+                        .HasColumnType("jsonb");
+
+                    b.HasKey("Id");
+
```

### LcmCrdt.Migrations.AddWritingSystemCollation.BuildTargetModel.fragment 6

method-fragment · +37 -0 · low-signal (generated)

```diff
@@ -212,0 +212,37 @@
+                    b.HasIndex("SnapshotId")
+                        .IsUnique();
+
+                    b.ToTable("CustomView");
+                });
+
+            modelBuilder.Entity("MiniLcm.Models.Entry", b =>
+                {
+                    b.Property<Guid>("Id")
+                        .ValueGeneratedOnAdd()
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("CitationForm")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.Property<string>("ComplexFormTypes")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.Property<DateTimeOffset?>("DeletedAt")
+                        .HasColumnType("TEXT");
+
+                    b.Property<int>("HomographNumber")
+                        .HasColumnType("INTEGER");
+
+                    b.Property<string>("LexemeForm")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.Property<string>("LiteralMeaning")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.Property<int>("MorphType")
+                        .HasColumnType("INTEGER");
+
```

### LcmCrdt.Migrations.AddWritingSystemCollation.BuildTargetModel.fragment 7

method-fragment · +37 -0 · low-signal (generated)

```diff
@@ -249,0 +249,37 @@
+                    b.Property<string>("Note")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.Property<string>("PublishIn")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.Property<Guid?>("SnapshotId")
+                        .HasColumnType("TEXT");
+
+                    b.HasKey("Id");
+
+                    b.HasIndex("SnapshotId")
+                        .IsUnique();
+
+                    b.ToTable("Entry");
+                });
+
+            modelBuilder.Entity("MiniLcm.Models.ExampleSentence", b =>
+                {
+                    b.Property<Guid>("Id")
+                        .ValueGeneratedOnAdd()
+                        .HasColumnType("TEXT");
+
+                    b.Property<DateTimeOffset?>("DeletedAt")
+                        .HasColumnType("TEXT");
+
+                    b.Property<double>("Order")
+                        .HasColumnType("REAL");
+
+                    b.Property<string>("Reference")
+                        .HasColumnType("jsonb");
+
+                    b.Property<Guid>("SenseId")
+                        .HasColumnType("TEXT");
+
```

### LcmCrdt.Migrations.AddWritingSystemCollation.BuildTargetModel.fragment 8

method-fragment · +38 -0 · low-signal (generated)

```diff
@@ -286,0 +286,38 @@
+                    b.Property<string>("Sentence")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.Property<Guid?>("SnapshotId")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Translations")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.HasKey("Id");
+
+                    b.HasIndex("SenseId");
+
+                    b.HasIndex("SnapshotId")
+                        .IsUnique();
+
+                    b.ToTable("ExampleSentence");
+                });
+
+            modelBuilder.Entity("MiniLcm.Models.MorphType", b =>
+                {
+                    b.Property<Guid>("Id")
+                        .ValueGeneratedOnAdd()
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Abbreviation")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.Property<DateTimeOffset?>("DeletedAt")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Description")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
```

### LcmCrdt.Migrations.AddWritingSystemCollation.BuildTargetModel.fragment 9

method-fragment · +39 -0 · low-signal (generated)

```diff
@@ -324,0 +324,39 @@
+                    b.Property<int>("Kind")
+                        .HasColumnType("INTEGER");
+
+                    b.Property<string>("Name")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.Property<string>("Postfix")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Prefix")
+                        .HasColumnType("TEXT");
+
+                    b.Property<int>("SecondaryOrder")
+                        .HasColumnType("INTEGER");
+
+                    b.Property<Guid?>("SnapshotId")
+                        .HasColumnType("TEXT");
+
+                    b.HasKey("Id");
+
+                    b.HasIndex("Kind")
+                        .IsUnique();
+
+                    b.HasIndex("SnapshotId")
+                        .IsUnique();
+
+                    b.ToTable("MorphType");
+                });
+
+            modelBuilder.Entity("MiniLcm.Models.PartOfSpeech", b =>
+                {
+                    b.Property<Guid>("Id")
+                        .ValueGeneratedOnAdd()
+                        .HasColumnType("TEXT");
+
+                    b.Property<DateTimeOffset?>("DeletedAt")
+                        .HasColumnType("TEXT");
+
```

### LcmCrdt.Migrations.AddWritingSystemCollation.BuildTargetModel.fragment 10

method-fragment · +39 -0 · low-signal (generated)

```diff
@@ -363,0 +363,39 @@
+                    b.Property<string>("Name")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.Property<bool>("Predefined")
+                        .HasColumnType("INTEGER");
+
+                    b.Property<Guid?>("SnapshotId")
+                        .HasColumnType("TEXT");
+
+                    b.HasKey("Id");
+
+                    b.HasIndex("SnapshotId")
+                        .IsUnique();
+
+                    b.ToTable("PartOfSpeech");
+                });
+
+            modelBuilder.Entity("MiniLcm.Models.Publication", b =>
+                {
+                    b.Property<Guid>("Id")
+                        .ValueGeneratedOnAdd()
+                        .HasColumnType("TEXT");
+
+                    b.Property<DateTimeOffset?>("DeletedAt")
+                        .HasColumnType("TEXT");
+
+                    b.Property<bool>("IsMain")
+                        .HasColumnType("INTEGER");
+
+                    b.Property<string>("Name")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.Property<Guid?>("SnapshotId")
+                        .HasColumnType("TEXT");
+
+                    b.HasKey("Id");
+
```

### LcmCrdt.Migrations.AddWritingSystemCollation.BuildTargetModel.fragment 11

method-fragment · +37 -0 · low-signal (generated)

```diff
@@ -402,0 +402,37 @@
+                    b.HasIndex("SnapshotId")
+                        .IsUnique();
+
+                    b.ToTable("Publication");
+                });
+
+            modelBuilder.Entity("MiniLcm.Models.SemanticDomain", b =>
+                {
+                    b.Property<Guid>("Id")
+                        .ValueGeneratedOnAdd()
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Code")
+                        .IsRequired()
+                        .HasColumnType("TEXT");
+
+                    b.Property<DateTimeOffset?>("DeletedAt")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Name")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.Property<bool>("Predefined")
+                        .HasColumnType("INTEGER");
+
+                    b.Property<Guid?>("SnapshotId")
+                        .HasColumnType("TEXT");
+
+                    b.HasKey("Id");
+
+                    b.HasIndex("SnapshotId")
+                        .IsUnique();
+
+                    b.ToTable("SemanticDomain");
+                });
+
```

### LcmCrdt.Migrations.AddWritingSystemCollation.BuildTargetModel.fragment 12

method-fragment · +39 -0 · low-signal (generated)

```diff
@@ -439,0 +439,39 @@
+            modelBuilder.Entity("MiniLcm.Models.Sense", b =>
+                {
+                    b.Property<Guid>("Id")
+                        .ValueGeneratedOnAdd()
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Definition")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.Property<DateTimeOffset?>("DeletedAt")
+                        .HasColumnType("TEXT");
+
+                    b.Property<Guid>("EntryId")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Gloss")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.Property<double>("Order")
+                        .HasColumnType("REAL");
+
+                    b.Property<Guid?>("PartOfSpeechId")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Pictures")
+                        .IsRequired()
+                        .ValueGeneratedOnAdd()
+                        .HasColumnType("jsonb")
+                        .HasDefaultValueSql("'[]'");
+
+                    b.Property<string>("SemanticDomains")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.Property<Guid?>("SnapshotId")
+                        .HasColumnType("TEXT");
+
```

### LcmCrdt.Migrations.AddWritingSystemCollation.BuildTargetModel.fragment 13

method-fragment · +40 -0 · low-signal (generated)

```diff
@@ -478,0 +478,40 @@
+                    b.HasKey("Id");
+
+                    b.HasIndex("EntryId");
+
+                    b.HasIndex("PartOfSpeechId");
+
+                    b.HasIndex("SnapshotId")
+                        .IsUnique();
+
+                    b.ToTable("Sense");
+                });
+
+            modelBuilder.Entity("MiniLcm.Models.WritingSystem", b =>
+                {
+                    b.Property<Guid>("Id")
+                        .ValueGeneratedOnAdd()
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Abbreviation")
+                        .IsRequired()
+                        .HasColumnType("TEXT");
+
+                    b.Property<DateTimeOffset?>("DeletedAt")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Exemplars")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.Property<string>("Font")
+                        .IsRequired()
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("IcuCollationRules")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Name")
+                        .IsRequired()
+                        .HasColumnType("TEXT");
+
```

### LcmCrdt.Migrations.AddWritingSystemCollation.BuildTargetModel.fragment 14

method-fragment · +40 -0 · low-signal (generated)

```diff
@@ -518,0 +518,40 @@
+                    b.Property<double>("Order")
+                        .HasColumnType("REAL");
+
+                    b.Property<Guid?>("SnapshotId")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("SystemCollationLocale")
+                        .HasColumnType("TEXT");
+
+                    b.Property<int>("Type")
+                        .HasColumnType("INTEGER");
+
+                    b.Property<string>("WsId")
+                        .IsRequired()
+                        .HasColumnType("TEXT");
+
+                    b.HasKey("Id");
+
+                    b.HasIndex("SnapshotId")
+                        .IsUnique();
+
+                    b.HasIndex("WsId", "Type")
+                        .IsUnique();
+
+                    b.ToTable("WritingSystem");
+                });
+
+            modelBuilder.Entity("SIL.Harmony.Commit", b =>
+                {
+                    b.Property<Guid>("Id")
+                        .ValueGeneratedOnAdd()
+                        .HasColumnType("TEXT");
+
+                    b.Property<Guid>("ClientId")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Hash")
+                        .IsRequired()
+                        .HasColumnType("TEXT");
+
```

### LcmCrdt.Migrations.AddWritingSystemCollation.BuildTargetModel.fragment 15

method-fragment · +39 -0 · low-signal (generated)

```diff
@@ -558,0 +558,39 @@
+                    b.Property<string>("Metadata")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.Property<string>("ParentHash")
+                        .IsRequired()
+                        .HasColumnType("TEXT");
+
+                    b.ComplexProperty(typeof(Dictionary<string, object>), "HybridDateTime", "SIL.Harmony.Commit.HybridDateTime#HybridDateTime", b1 =>
+                        {
+                            b1.IsRequired();
+
+                            b1.Property<long>("Counter")
+                                .HasColumnType("INTEGER")
+                                .HasColumnName("Counter");
+
+                            b1.Property<DateTime>("DateTime")
+                                .HasColumnType("TEXT")
+                                .HasColumnName("DateTime");
+                        });
+
+                    b.HasKey("Id");
+
+                    b.ToTable("Commits", (string)null);
+
+                    b.HasAnnotation("CustomIndex:CompositeIndexes", "[{\"paths\":[\"HybridDateTime.DateTime\",\"HybridDateTime.Counter\",\"Id\"],\"unique\":false,\"name\":\"IX_Commits_DateTime_Counter_Id\"}]");
+                });
+
+            modelBuilder.Entity("SIL.Harmony.Core.ChangeEntity<SIL.Harmony.Changes.IChange>", b =>
+                {
+                    b.Property<Guid>("CommitId")
+                        .HasColumnType("TEXT");
+
+                    b.Property<int>("Index")
+                        .HasColumnType("INTEGER");
+
+                    b.Property<string>("Change")
+                        .HasColumnType("jsonb");
+
```

### LcmCrdt.Migrations.AddWritingSystemCollation.BuildTargetModel.fragment 16

method-fragment · +40 -0 · low-signal (generated)

```diff
@@ -597,0 +597,40 @@
+                    b.Property<Guid>("EntityId")
+                        .HasColumnType("TEXT");
+
+                    b.HasKey("CommitId", "Index");
+
+                    b.ToTable("ChangeEntities", (string)null);
+                });
+
+            modelBuilder.Entity("SIL.Harmony.Db.ObjectSnapshot", b =>
+                {
+                    b.Property<Guid>("Id")
+                        .ValueGeneratedOnAdd()
+                        .HasColumnType("TEXT");
+
+                    b.Property<Guid>("CommitId")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Entity")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.Property<Guid>("EntityId")
+                        .HasColumnType("TEXT");
+
+                    b.Property<bool>("EntityIsDeleted")
+                        .HasColumnType("INTEGER");
+
+                    b.Property<bool>("IsRoot")
+                        .HasColumnType("INTEGER");
+
+                    b.PrimitiveCollection<string>("References")
+                        .IsRequired()
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("TypeName")
+                        .IsRequired()
+                        .HasColumnType("TEXT");
+
+                    b.HasKey("Id");
+
```

### LcmCrdt.Migrations.AddWritingSystemCollation.BuildTargetModel.fragment 17

method-fragment · +40 -0 · low-signal (generated)

```diff
@@ -637,0 +637,40 @@
+                    b.HasIndex("EntityId");
+
+                    b.HasIndex("CommitId", "EntityId")
+                        .IsUnique();
+
+                    b.ToTable("Snapshots", (string)null);
+                });
+
+            modelBuilder.Entity("SIL.Harmony.Resource.LocalResource", b =>
+                {
+                    b.Property<Guid>("Id")
+                        .ValueGeneratedOnAdd()
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("LocalPath")
+                        .IsRequired()
+                        .HasColumnType("TEXT");
+
+                    b.HasKey("Id");
+
+                    b.ToTable("LocalResource");
+                });
+
+            modelBuilder.Entity("SIL.Harmony.Resource.RemoteResource", b =>
+                {
+                    b.Property<Guid>("Id")
+                        .ValueGeneratedOnAdd()
+                        .HasColumnType("TEXT");
+
+                    b.Property<DateTimeOffset?>("DeletedAt")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("RemoteId")
+                        .HasColumnType("TEXT");
+
+                    b.Property<Guid?>("SnapshotId")
+                        .HasColumnType("TEXT");
+
+                    b.HasKey("Id");
+
```

### LcmCrdt.Migrations.AddWritingSystemCollation.BuildTargetModel.fragment 18

method-fragment · +39 -0 · low-signal (generated)

```diff
@@ -677,0 +677,39 @@
+                    b.HasIndex("SnapshotId")
+                        .IsUnique();
+
+                    b.ToTable("RemoteResource");
+                });
+
+            modelBuilder.Entity("MiniLcm.Models.ComplexFormComponent", b =>
+                {
+                    b.HasOne("MiniLcm.Models.Entry", null)
+                        .WithMany("Components")
+                        .HasForeignKey("ComplexFormEntryId")
+                        .OnDelete(DeleteBehavior.Cascade)
+                        .IsRequired();
+
+                    b.HasOne("MiniLcm.Models.Entry", null)
+                        .WithMany("ComplexForms")
+                        .HasForeignKey("ComponentEntryId")
+                        .OnDelete(DeleteBehavior.Cascade)
+                        .IsRequired();
+
+                    b.HasOne("MiniLcm.Models.Sense", null)
+                        .WithMany()
+                        .HasForeignKey("ComponentSenseId")
+                        .OnDelete(DeleteBehavior.Cascade);
+
+                    b.HasOne("SIL.Harmony.Db.ObjectSnapshot", null)
+                        .WithOne()
+                        .HasForeignKey("MiniLcm.Models.ComplexFormComponent", "SnapshotId")
+                        .OnDelete(DeleteBehavior.SetNull);
+                });
+
+            modelBuilder.Entity("MiniLcm.Models.ComplexFormType", b =>
+                {
+                    b.HasOne("SIL.Harmony.Db.ObjectSnapshot", null)
+                        .WithOne()
+                        .HasForeignKey("MiniLcm.Models.ComplexFormType", "SnapshotId")
+                        .OnDelete(DeleteBehavior.SetNull);
+                });
+
```

### LcmCrdt.Migrations.AddWritingSystemCollation.BuildTargetModel.fragment 19

method-fragment · +38 -0 · low-signal (generated)

```diff
@@ -716,0 +716,38 @@
+            modelBuilder.Entity("MiniLcm.Models.CustomView", b =>
+                {
+                    b.HasOne("SIL.Harmony.Db.ObjectSnapshot", null)
+                        .WithOne()
+                        .HasForeignKey("MiniLcm.Models.CustomView", "SnapshotId")
+                        .OnDelete(DeleteBehavior.SetNull);
+                });
+
+            modelBuilder.Entity("MiniLcm.Models.Entry", b =>
+                {
+                    b.HasOne("SIL.Harmony.Db.ObjectSnapshot", null)
+                        .WithOne()
+                        .HasForeignKey("MiniLcm.Models.Entry", "SnapshotId")
+                        .OnDelete(DeleteBehavior.SetNull);
+                });
+
+            modelBuilder.Entity("MiniLcm.Models.ExampleSentence", b =>
+                {
+                    b.HasOne("MiniLcm.Models.Sense", null)
+                        .WithMany("ExampleSentences")
+                        .HasForeignKey("SenseId")
+                        .OnDelete(DeleteBehavior.Cascade)
+                        .IsRequired();
+
+                    b.HasOne("SIL.Harmony.Db.ObjectSnapshot", null)
+                        .WithOne()
+                        .HasForeignKey("MiniLcm.Models.ExampleSentence", "SnapshotId")
+                        .OnDelete(DeleteBehavior.SetNull);
+                });
+
+            modelBuilder.Entity("MiniLcm.Models.MorphType", b =>
+                {
+                    b.HasOne("SIL.Harmony.Db.ObjectSnapshot", null)
+                        .WithOne()
+                        .HasForeignKey("MiniLcm.Models.MorphType", "SnapshotId")
+                        .OnDelete(DeleteBehavior.SetNull);
+                });
+
```

### LcmCrdt.Migrations.AddWritingSystemCollation.BuildTargetModel.fragment 20

method-fragment · +37 -0 · low-signal (generated)

```diff
@@ -754,0 +754,37 @@
+            modelBuilder.Entity("MiniLcm.Models.PartOfSpeech", b =>
+                {
+                    b.HasOne("SIL.Harmony.Db.ObjectSnapshot", null)
+                        .WithOne()
+                        .HasForeignKey("MiniLcm.Models.PartOfSpeech", "SnapshotId")
+                        .OnDelete(DeleteBehavior.SetNull);
+                });
+
+            modelBuilder.Entity("MiniLcm.Models.Publication", b =>
+                {
+                    b.HasOne("SIL.Harmony.Db.ObjectSnapshot", null)
+                        .WithOne()
+                        .HasForeignKey("MiniLcm.Models.Publication", "SnapshotId")
+                        .OnDelete(DeleteBehavior.SetNull);
+                });
+
+            modelBuilder.Entity("MiniLcm.Models.SemanticDomain", b =>
+                {
+                    b.HasOne("SIL.Harmony.Db.ObjectSnapshot", null)
+                        .WithOne()
+                        .HasForeignKey("MiniLcm.Models.SemanticDomain", "SnapshotId")
+                        .OnDelete(DeleteBehavior.SetNull);
+                });
+
+            modelBuilder.Entity("MiniLcm.Models.Sense", b =>
+                {
+                    b.HasOne("MiniLcm.Models.Entry", null)
+                        .WithMany("Senses")
+                        .HasForeignKey("EntryId")
+                        .OnDelete(DeleteBehavior.Cascade)
+                        .IsRequired();
+
+                    b.HasOne("MiniLcm.Models.PartOfSpeech", "PartOfSpeech")
+                        .WithMany()
+                        .HasForeignKey("PartOfSpeechId")
+                        .OnDelete(DeleteBehavior.SetNull);
+
```

### LcmCrdt.Migrations.AddWritingSystemCollation.BuildTargetModel.fragment 21

method-fragment · +36 -0 · low-signal (generated)

```diff
@@ -791,0 +791,36 @@
+                    b.HasOne("SIL.Harmony.Db.ObjectSnapshot", null)
+                        .WithOne()
+                        .HasForeignKey("MiniLcm.Models.Sense", "SnapshotId")
+                        .OnDelete(DeleteBehavior.SetNull);
+
+                    b.Navigation("PartOfSpeech");
+                });
+
+            modelBuilder.Entity("MiniLcm.Models.WritingSystem", b =>
+                {
+                    b.HasOne("SIL.Harmony.Db.ObjectSnapshot", null)
+                        .WithOne()
+                        .HasForeignKey("MiniLcm.Models.WritingSystem", "SnapshotId")
+                        .OnDelete(DeleteBehavior.SetNull);
+                });
+
+            modelBuilder.Entity("SIL.Harmony.Core.ChangeEntity<SIL.Harmony.Changes.IChange>", b =>
+                {
+                    b.HasOne("SIL.Harmony.Commit", null)
+                        .WithMany("ChangeEntities")
+                        .HasForeignKey("CommitId")
+                        .OnDelete(DeleteBehavior.Cascade)
+                        .IsRequired();
+                });
+
+            modelBuilder.Entity("SIL.Harmony.Db.ObjectSnapshot", b =>
+                {
+                    b.HasOne("SIL.Harmony.Commit", "Commit")
+                        .WithMany("Snapshots")
+                        .HasForeignKey("CommitId")
+                        .OnDelete(DeleteBehavior.Cascade)
+                        .IsRequired();
+
+                    b.Navigation("Commit");
+                });
+
```

### LcmCrdt.Migrations.AddWritingSystemCollation.BuildTargetModel.fragment 22

method-fragment · +30 -0 · low-signal (generated)

```diff
@@ -827,0 +827,30 @@
+            modelBuilder.Entity("SIL.Harmony.Resource.RemoteResource", b =>
+                {
+                    b.HasOne("SIL.Harmony.Db.ObjectSnapshot", null)
+                        .WithOne()
+                        .HasForeignKey("SIL.Harmony.Resource.RemoteResource", "SnapshotId")
+                        .OnDelete(DeleteBehavior.SetNull);
+                });
+
+            modelBuilder.Entity("MiniLcm.Models.Entry", b =>
+                {
+                    b.Navigation("ComplexForms");
+
+                    b.Navigation("Components");
+
+                    b.Navigation("Senses");
+                });
+
+            modelBuilder.Entity("MiniLcm.Models.Sense", b =>
+                {
+                    b.Navigation("ExampleSentences");
+                });
+
+            modelBuilder.Entity("SIL.Harmony.Commit", b =>
+                {
+                    b.Navigation("ChangeEntities");
+
+                    b.Navigation("Snapshots");
+                });
+#pragma warning restore 612, 618
+        }
```

## backend/FwLite/LcmCrdt/Migrations/LcmCrdtDbContextModelSnapshot.cs

### LcmCrdt.Migrations.LcmCrdtDbContextModelSnapshot.BuildModel

method · +6 -0 · low-signal (migration snapshot)

```diff
@@ -507,0 +508,3 @@
+                    b.Property<string>("IcuCollationRules")
+                        .HasColumnType("TEXT");
+
@@ -517,0 +521,3 @@
+                    b.Property<string>("SystemCollationLocale")
+                        .HasColumnType("TEXT");
+
```

## frontend/viewer/src/lib/dotnet-types/generated-types/MiniLcm/Models/IWritingSystem.ts

### IWritingSystem

other · +2 -0 · low-signal (generated)

```diff
@@ -18,0 +19,2 @@
+	icuCollationRules?: string;
+	systemCollationLocale?: string;
```
