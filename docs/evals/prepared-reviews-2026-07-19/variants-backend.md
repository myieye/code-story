# Code story — a9cf4ca78a1b..55d4485cd507

726 chunks · 577 sections · head 55d4485c

## backend/FwLite/FwDataMiniLcmBridge/Api/FwDataMiniLcmApi.cs

### lines 1–41 — from backend/FwLite/FwDataMiniLcmBridge.Tests/MiniLcmTests/VariantTests.cs

other · +11 -0

```diff
@@ -0,0 +1,6 @@
+using FwDataMiniLcmBridge.Api;
+using FwDataMiniLcmBridge.LcmUtils;
+using FwDataMiniLcmBridge.Tests.Fixtures;
+using MiniLcm.Models;
+using SIL.LCModel;
+
@@ -8,0 +8,1 @@
+
@@ -38,0 +38,4 @@
+
+/// <summary>
+/// tests the per-link fidelity when FwData has multiple variant LexEntryRefs on one entry
+/// </summary>
```

### FwDataMiniLcmApi.VariantTypesFlattened

method · +1 -0

```diff
@@ -70,0 +71,1 @@
+    internal IEnumerable<ILexEntryType> VariantTypesFlattened => VariantTypes.PossibilitiesOS.Cast<ILexEntryType>().Flatten();
```

## backend/FwLite/FwDataMiniLcmBridge/Api/FwDataMiniLcmApi.cs

### FwDataMiniLcmApi

other · +26 -6

```diff
@@ -570,0 +572,2 @@
+    // flattened (unlike complex-form types' public read) because the Irregularly Inflected Form
+    // subtypes (Plural, Past) are children in the possibility list and must be assignable
@@ -578,0 +578,1 @@
+
@@ -585,0 +585,1 @@
+
@@ -590,0 +590,1 @@
+
@@ -607,0 +607,1 @@
+
@@ -622,0 +622,1 @@
+
@@ -628,0 +628,1 @@
+
@@ -641,0 +641,1 @@
+
@@ -637,6 +707,0 @@
-    public IAsyncEnumerable<VariantType> GetVariantTypes()
-    {
-        return VariantTypes.PossibilitiesOS
-            .Select(t => new VariantType() { Id = t.Guid, Name = FromLcmMultiString(t.Name) })
-            .ToAsyncEnumerable();
-    }
@@ -800,0 +800,1 @@
+
@@ -813,0 +813,1 @@
+
@@ -1398,0 +1398,1 @@
+
@@ -1405,0 +1405,1 @@
+
@@ -1421,0 +1421,1 @@
+
@@ -1437,0 +1437,1 @@
+
@@ -1455,0 +1455,1 @@
+
@@ -1472,0 +1472,4 @@
+
+    /// <summary>
+    /// must be called as part of an lcm action
+    /// </summary>
@@ -1506,0 +1506,1 @@
+
@@ -1537,0 +1537,1 @@
+
@@ -1543,0 +1543,3 @@
+
+    //match the full composite key: a sense target only counts while the sense still belongs
+    //to the link's main entry (a moved sense means this is a different link)
@@ -1552,0 +1552,1 @@
+
```

## backend/FwLite/FwDataMiniLcmBridge/Api/FwDataMiniLcmApi.cs

### VariantTests.GetVariantTypes_IncludesIrregularlyInflectedFormSubtypes — from backend/FwLite/FwDataMiniLcmBridge.Tests/MiniLcmTests/VariantTests.cs

method · +10 -0

```diff
@@ -17,0 +17,10 @@
+    [Fact]
+    public async Task GetVariantTypes_IncludesIrregularlyInflectedFormSubtypes()
+    {
+        // Plural and Past are children of Irregularly Inflected Form in the possibility
+        // list; the flattened read must surface them (they're the headline use case)
+        var types = await Api.GetVariantTypes().ToArrayAsync();
+        types.Should().Contain(t => t.Id == LexEntryTypeTags.kguidLexTypPluralVar);
+        types.Should().Contain(t => t.Id == LexEntryTypeTags.kguidLexTypPastVar);
+        types.Should().Contain(t => t.Id == LexEntryTypeTags.kguidLexTypSpellingVar);
+    }
```

### FwDataMiniLcmApi.GetVariantTypes

method · +4 -0

```diff
@@ -574,0 +574,4 @@
+    public IAsyncEnumerable<VariantType> GetVariantTypes()
+    {
+        return VariantTypesFlattened.Select(ToVariantType).ToAsyncEnumerable();
+    }
```

## backend/FwLite/FwDataMiniLcmBridge/Api/FwDataMiniLcmApi.cs

### FwDataMiniLcmApi.GetVariantType

method · +6 -0

```diff
@@ -579,0 +579,6 @@
+    public Task<VariantType?> GetVariantType(Guid id)
+    {
+        var lexEntryType = VariantTypesFlattened.SingleOrDefault(t => t.Guid == id);
+        if (lexEntryType is null) return Task.FromResult<VariantType?>(null);
+        return Task.FromResult<VariantType?>(ToVariantType(lexEntryType));
+    }
```

## backend/FwLite/FwDataMiniLcmBridge/Api/FwDataMiniLcmApi.cs

### VariantTests.CreateVariantType_LandsAsATopLevelPossibility — from backend/FwLite/FwDataMiniLcmBridge.Tests/MiniLcmTests/VariantTests.cs

method · +9 -0

```diff
@@ -28,0 +28,9 @@
+    [Fact]
+    public async Task CreateVariantType_LandsAsATopLevelPossibility()
+    {
+        // the flattened read can surface children, but created types must be top-level
+        var created = await Api.CreateVariantType(new VariantType { Id = Guid.NewGuid(), Name = new() { { "en", "custom type" } } });
+        var fwDataApi = (FwDataMiniLcmApi)BaseApi;
+        fwDataApi.Cache.LangProject.LexDbOA.VariantEntryTypesOA.PossibilitiesOS
+            .Should().Contain(p => p.Guid == created.Id);
+    }
```

### VariantTestsMultipleRefs.VariantRefsWithDifferentTypes_ReadAsSeparateLinksWithOwnTypes — from backend/FwLite/FwDataMiniLcmBridge.Tests/MiniLcmTests/VariantTests.cs

method · +21 -0

```diff
@@ -70,0 +70,21 @@
+    [Fact]
+    public async Task VariantRefsWithDifferentTypes_ReadAsSeparateLinksWithOwnTypes()
+    {
+        var otherMainEntry = await Api.CreateEntry(new()
+        {
+            Id = Guid.NewGuid(),
+            LexemeForm = { { "en", "other main" } }
+        });
+        var typeA = await Api.CreateVariantType(new VariantType { Id = Guid.NewGuid(), Name = new() { { "en", "type a" } } });
+        var typeB = await Api.CreateVariantType(new VariantType { Id = Guid.NewGuid(), Name = new() { { "en", "type b" } } });
+
+        await Api.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry) with { Types = [typeA] });
+        await Api.CreateVariant(Variant.FromEntries(_variantEntry, otherMainEntry) with { Types = [typeB] });
+
+        var entry = await Api.GetEntry(_variantEntryId);
+        entry!.VariantOf.Should().HaveCount(2);
+        entry.VariantOf.Should().ContainSingle(v => v.MainEntryId == _mainEntryId)
+            .Which.Types.Should().ContainSingle(t => t.Id == typeA.Id);
+        entry.VariantOf.Should().ContainSingle(v => v.MainEntryId == otherMainEntry.Id)
+            .Which.Types.Should().ContainSingle(t => t.Id == typeB.Id);
+    }
```

### FwDataMiniLcmApi.CreateVariantType

method · +16 -0

```diff
@@ -591,0 +591,16 @@
+    public Task<VariantType> CreateVariantType(VariantType variantType)
+    {
+        if (variantType.Id == default) variantType.Id = Guid.NewGuid();
+        UndoableUnitOfWorkHelper.DoUsingNewOrCurrentUOW("Create variant type",
+            "Remove variant type",
+            Cache.ActionHandlerAccessor,
+            () =>
+            {
+                var lexVariantType = Cache.ServiceLocator
+                    .GetInstance<ILexEntryTypeFactory>()
+                    .Create(variantType.Id);
+                VariantTypes.PossibilitiesOS.Add(lexVariantType);
+                UpdateLcmMultiString(lexVariantType.Name, variantType.Name);
+            });
+        return Task.FromResult(ToVariantType(VariantTypesFlattened.Single(t => t.Guid == variantType.Id)));
+    }
```

## backend/FwLite/FwDataMiniLcmBridge/Api/FwDataMiniLcmApi.cs

### FwDataMiniLcmApi.UpdateVariantType

method · +14 -0

```diff
@@ -608,0 +608,14 @@
+    public Task<VariantType> UpdateVariantType(Guid id, UpdateObjectInput<VariantType> update)
+    {
+        var type = VariantTypesFlattened.SingleOrDefault(t => t.Guid == id);
+        if (type is null) throw new NullReferenceException($"unable to find variant type with id {id}");
+        UndoableUnitOfWorkHelper.DoUsingNewOrCurrentUOW("Update Variant Type",
+            "Revert Variant Type",
+            Cache.ServiceLocator.ActionHandler,
+            () =>
+            {
+                var updateProxy = new UpdateVariantTypeProxy(type, this);
+                update.Apply(updateProxy);
+            });
+        return Task.FromResult(ToVariantType(type));
+    }
```

## backend/FwLite/FwDataMiniLcmBridge/Api/FwDataMiniLcmApi.cs

### FwDataMiniLcmApi.UpdateVariantType

method · +5 -0

```diff
@@ -623,0 +623,5 @@
+    public async Task<VariantType> UpdateVariantType(VariantType before, VariantType after, IMiniLcmApi? api = null)
+    {
+        await VariantTypeSync.Sync(before, after, api ?? this);
+        return ToVariantType(VariantTypesFlattened.Single(t => t.Guid == after.Id));
+    }
```

### FwDataMiniLcmApi.ToVariantType

method · +4 -0

```diff
@@ -586,0 +586,4 @@
+    private VariantType ToVariantType(ILexEntryType t)
+    {
+        return new VariantType() { Id = t.Guid, Name = FromLcmMultiString(t.Name) };
+    }
```

## backend/FwLite/FwDataMiniLcmBridge/Api/FwDataMiniLcmApi.cs

### FwDataMiniLcmApi.DeleteVariantType

method · +12 -0

```diff
@@ -629,0 +629,12 @@
+    public async Task DeleteVariantType(Guid id)
+    {
+        var type = VariantTypesFlattened.SingleOrDefault(t => t.Guid == id);
+        if (type is null) return;
+        await Cache.DoUsingNewOrCurrentUOW("Delete Variant Type",
+            "Revert delete",
+            () =>
+            {
+                type.Delete();
+                return ValueTask.CompletedTask;
+            });
+    }
```

## backend/FwLite/FwDataMiniLcmBridge/Api/FwDataMiniLcmApi.cs

### FwDataMiniLcmApi.FromLexEntry

method · +2 -0

```diff
@@ -690,0 +756,2 @@
+                VariantOf = [.. ToVariantOf(entry)],
+                Variants = [.. ToVariants(entry)],
```

### FwDataMiniLcmApi.ToVariants

method · +12 -0

```diff
@@ -801,0 +801,12 @@
+    private IEnumerable<Variant> ToVariants(ILexEntry entry)
+    {
+        return new[]
+            {
+                entry.VariantFormEntryBackRefs.Select(r => ToVariant(r.OwningEntry, r, entry, null)),
+                entry.AllSenses.SelectMany(sense =>
+                    sense.VariantFormEntryBackRefs.Select(r => ToVariant(r.OwningEntry, r, entry, sense)))
+            }
+            .SelectMany(v => v)
+            .DistinctBy(v => (v.VariantEntryId, v.MainEntryId, v.MainSenseId))
+            .Order(Variant.VariantsOrder);
+    }
```

## backend/FwLite/FwDataMiniLcmBridge/Api/FwDataMiniLcmApi.cs

### FwDataMiniLcmApi.CreateEntry

method · +13 -0

```diff
@@ -1080,0 +1165,13 @@
+
+                        foreach (var variantOf in entry.VariantOf)
+                        {
+                            if (variantOf.VariantEntryId == default) variantOf.VariantEntryId = entry.Id;
+                            AddVariant(lexEntry, variantOf);
+                        }
+
+                        foreach (var variant in entry.Variants)
+                        {
+                            if (variant.MainEntryId == default) variant.MainEntryId = entry.Id;
+                            var lexVariantEntry = EntriesRepository.GetObject(variant.VariantEntryId);
+                            AddVariant(lexVariantEntry, variant);
+                        }
```

## backend/FwLite/FwDataMiniLcmBridge/Api/FwDataMiniLcmApi.cs

### FwDataMiniLcmApi.CreateVariant

method · +13 -0

```diff
@@ -1287,0 +1385,13 @@
+    public Task<Variant> CreateVariant(Variant variant)
+    {
+        UndoableUnitOfWorkHelper.DoUsingNewOrCurrentUOW("Create Variant",
+            "Remove Variant",
+            Cache.ServiceLocator.ActionHandler,
+            () =>
+            {
+                var lexVariantEntry = EntriesRepository.GetObject(variant.VariantEntryId);
+                AddVariant(lexVariantEntry, variant);
+            });
+        return Task.FromResult(ToVariantOf(EntriesRepository.GetObject(variant.VariantEntryId))
+            .Single(v => v.MainEntryId == variant.MainEntryId && v.MainSenseId == variant.MainSenseId));
+    }
```

### FwDataMiniLcmApi.AddVariant

method · +30 -0

```diff
@@ -1476,0 +1476,30 @@
+    internal void AddVariant(ILexEntry lexVariantEntry, Variant variant)
+    {
+        if (FindVariantRef(lexVariantEntry, variant) is not null) return; //idempotent, like the CRDT side
+        ICmObject target;
+        if (variant.MainSenseId is not null)
+        {
+            var sense = SenseRepository.GetObject(variant.MainSenseId.Value);
+            //fail before mutating: a mismatched pair would create a link whose derived
+            //MainEntryId is the sense's actual entry, not the requested one
+            if (sense.Entry.Guid != variant.MainEntryId)
+                throw new InvalidOperationException($"Sense {variant.MainSenseId} does not belong to entry {variant.MainEntryId}, it belongs to {sense.Entry.Guid}");
+            target = sense;
+        }
+        else
+        {
+            target = EntriesRepository.GetObject(variant.MainEntryId);
+        }
+        //one LexEntryRef per link — multiple variant refs on an entry are how FLEx represents
+        //being a variant of multiple things with different types
+        var entryRef = Cache.ServiceLocator.GetInstance<ILexEntryRefFactory>().Create();
+        lexVariantEntry.EntryRefsOS.Add(entryRef);
+        entryRef.RefType = LexEntryRefTags.krtVariant;
+        entryRef.HideMinorEntry = variant.HideMinorEntry ? 1 : 0;
+        UpdateLcmMultiString(entryRef.Summary, variant.Comment);
+        foreach (var type in variant.Types)
+        {
+            entryRef.VariantEntryTypesRS.Add(VariantTypesFlattened.Single(t => t.Guid == type.Id));
+        }
+        entryRef.ComponentLexemesRS.Add(target);
+    }
```

## backend/FwLite/FwDataMiniLcmBridge/Api/FwDataMiniLcmApi.cs

### FwDataMiniLcmApi.UpdateVariant

method · +6 -0

```diff
@@ -1399,0 +1399,6 @@
+    public async Task<Variant> UpdateVariant(Variant before, Variant after, IMiniLcmApi? api = null)
+    {
+        await VariantSync.Sync(before, after, api ?? this);
+        return ToVariantOf(EntriesRepository.GetObject(after.VariantEntryId))
+            .Single(v => v.MainEntryId == after.MainEntryId && v.MainSenseId == after.MainSenseId);
+    }
```

### FwDataMiniLcmApi.ToVariantOf

method · +8 -17

```diff
@@ -721,1 +788,1 @@
-    private Variants? ToVariants(ILexEntry entry)
+    private IEnumerable<Variant> ToVariantOf(ILexEntry entry)
@@ -723,8 +790,2 @@
-        var variantEntryRef = entry.VariantEntryRefs.SingleOrDefault();
-        if (variantEntryRef is null) return null;
-        return new Variants
-        {
-            Id = variantEntryRef.Guid,
-            VariantsOf =
-            [
-                ..variantEntryRef.ComponentLexemesRS.Select(o => o switch
+        return entry.VariantEntryRefs.SelectMany(r => r.ComponentLexemesRS,
+                (r, o) => o switch
@@ -732,2 +793,2 @@
-                    ILexEntry component => ToEntryReference(component, entry),
-                    ILexSense s => ToSenseReference(s, entry),
+                    ILexEntry mainEntry => ToVariant(entry, r, mainEntry, null),
+                    ILexSense mainSense => ToVariant(entry, r, mainSense.Entry, mainSense),
@@ -736,6 +797,3 @@
-            ],
-            Types =
-            [
-                ..variantEntryRef.VariantEntryTypesRS.Select(t =>
-                    new VariantType() { Id = t.Guid, Name = FromLcmMultiString(t.Name), })
-            ]
+            .DistinctBy(v => (v.VariantEntryId, v.MainEntryId, v.MainSenseId))
+            .Order(Variant.VariantOfOrder);
+    }
```

### FwDataMiniLcmApi.ToVariant

method · +12 -0

```diff
@@ -814,0 +814,12 @@
+    private Variant ToVariant(ILexEntry variantEntry, ILexEntryRef variantRef, ILexEntry mainEntry, ILexSense? mainSense)
+    {
+        return new Variant
+        {
+            VariantEntryId = variantEntry.Guid,
+            VariantHeadword = variantEntry.LexEntryHeadwordOrUnknown(),
+            MainEntryId = mainEntry.Guid,
+            MainSenseId = mainSense?.Guid,
+            MainHeadword = mainEntry.LexEntryHeadwordOrUnknown(),
+            Types = [..variantRef.VariantEntryTypesRS.Select(ToVariantType)],
+            HideMinorEntry = variantRef.HideMinorEntry != 0,
+            Comment = FromLcmMultiString(variantRef.Summary),
```

## backend/FwLite/FwDataMiniLcmBridge/Api/FwDataMiniLcmApi.cs

### FwDataMiniLcmApi.SubmitUpdateVariant

method · +15 -0

```diff
@@ -1406,0 +1406,15 @@
+    public Task SubmitUpdateVariant(Variant variant, UpdateObjectInput<Variant> update)
+    {
+        var lexVariantEntry = EntriesRepository.GetObject(variant.VariantEntryId);
+        var entryRef = FindVariantRef(lexVariantEntry, variant)
+            ?? throw NotFoundException.ForType<Variant>(variant.VariantEntryId);
+        UndoableUnitOfWorkHelper.DoUsingNewOrCurrentUOW("Update Variant",
+            "Revert Variant",
+            Cache.ServiceLocator.ActionHandler,
+            () =>
+            {
+                var updateProxy = new UpdateVariantProxy(entryRef, this);
+                update.Apply(updateProxy);
+            });
+        return Task.CompletedTask;
+    }
```

## backend/FwLite/FwDataMiniLcmBridge/Api/FwDataMiniLcmApi.cs

### VariantTestsMultipleRefs.DuplicateVariantRefs_BothAreRemoved — from backend/FwLite/FwDataMiniLcmBridge.Tests/MiniLcmTests/VariantTests.cs

method · +12 -0

```diff
@@ -105,0 +105,12 @@
+    [Fact]
+    public async Task DuplicateVariantRefs_BothAreRemoved()
+    {
+        await AddDuplicateVariantRef();
+
+        var entry = await Api.GetEntry(_variantEntryId);
+        await Api.DeleteVariant(entry!.VariantOf.Single());
+
+        entry = await Api.GetEntry(_variantEntryId);
+        entry.Should().NotBeNull();
+        entry!.VariantOf.Should().BeEmpty();
+    }
```

### FwDataMiniLcmApi.DeleteVariant

method · +15 -0

```diff
@@ -1422,0 +1422,15 @@
+    public Task DeleteVariant(Variant variant)
+    {
+        //variant entry has been deleted, so this link is gone already
+        if (!EntriesRepository.TryGetObject(variant.VariantEntryId, out var lexVariantEntry))
+            return Task.CompletedTask;
+
+        UndoableUnitOfWorkHelper.DoUsingNewOrCurrentUOW("Delete Variant",
+            "Add Variant",
+            Cache.ServiceLocator.ActionHandler,
+            () =>
+            {
+                RemoveVariant(lexVariantEntry, variant);
+            });
+        return Task.CompletedTask;
+    }
```

### FwDataMiniLcmApi.RemoveVariant

method · +30 -0

```diff
@@ -1507,0 +1507,30 @@
+    internal void RemoveVariant(ILexEntry lexVariantEntry, Variant variant)
+    {
+        ICmObject target;
+        if (variant.MainSenseId is not null)
+        {
+            //sense has been deleted, so this link is gone already
+            if (!SenseRepository.TryGetObject(variant.MainSenseId.Value, out var sense)) return;
+            //links are identified by their full composite key; when the sense has moved to a
+            //different entry this link no longer exists (it became a link to the new entry)
+            if (sense.Entry.Guid != variant.MainEntryId) return;
+            target = sense;
+        }
+        else
+        {
+            //entry has been deleted, so this link is gone already
+            if (!EntriesRepository.TryGetObject(variant.MainEntryId, out var mainEntry)) return;
+            target = mainEntry;
+        }
+
+        foreach (var entryRef in lexVariantEntry.VariantEntryRefs.ToArray())
+        {
+            entryRef.ComponentLexemesRS.Remove(target);
+            if (entryRef.ComponentLexemesRS.Count == 0)
+            {
+                //an empty variant ref is meaningless; liblcm deletes them in its own cleanup paths too
+                lexVariantEntry.EntryRefsOS.Remove(entryRef);
+            }
+        }
+        //not throwing to match CRDT behavior
+    }
```

## backend/FwLite/FwDataMiniLcmBridge/Api/FwDataMiniLcmApi.cs

### FwDataMiniLcmApi.AddVariantType

method · +17 -0

```diff
@@ -1438,0 +1438,17 @@
+    public Task AddVariantType(Variant variant, Guid variantTypeId)
+    {
+        UndoableUnitOfWorkHelper.DoUsingNewOrCurrentUOW("Add Variant Type",
+            "Remove Variant Type",
+            Cache.ServiceLocator.ActionHandler,
+            () =>
+            {
+                //link (or its entry) deleted already — match CRDT tolerance
+                if (!EntriesRepository.TryGetObject(variant.VariantEntryId, out var lexVariantEntry)) return;
+                var entryRef = FindVariantRef(lexVariantEntry, variant);
+                if (entryRef is null) return;
+                var lexEntryType = VariantTypesFlattened.Single(t => t.Guid == variantTypeId);
+                if (entryRef.VariantEntryTypesRS.Contains(lexEntryType)) return;
+                entryRef.VariantEntryTypesRS.Add(lexEntryType);
+            });
+        return Task.CompletedTask;
+    }
```

## backend/FwLite/FwDataMiniLcmBridge/Api/FwDataMiniLcmApi.cs

### FwDataMiniLcmApi.RemoveVariantType

method · +16 -0

```diff
@@ -1456,0 +1456,16 @@
+    public Task RemoveVariantType(Variant variant, Guid variantTypeId)
+    {
+        UndoableUnitOfWorkHelper.DoUsingNewOrCurrentUOW("Remove Variant Type",
+            "Add Variant Type",
+            Cache.ServiceLocator.ActionHandler,
+            () =>
+            {
+                if (!EntriesRepository.TryGetObject(variant.VariantEntryId, out var lexVariantEntry)) return;
+                var entryRef = FindVariantRef(lexVariantEntry, variant);
+                if (entryRef is null) return;
+                var lexEntryType = entryRef.VariantEntryTypesRS.SingleOrDefault(t => t.Guid == variantTypeId);
+                if (lexEntryType is null) return;
+                entryRef.VariantEntryTypesRS.Remove(lexEntryType);
+            });
+        return Task.CompletedTask;
+    }
```

### FwDataMiniLcmApi.FindVariantRef

method · +5 -0

```diff
@@ -1538,0 +1538,5 @@
+    internal ILexEntryRef? FindVariantRef(ILexEntry lexVariantEntry, Variant variant)
+    {
+        return lexVariantEntry.VariantEntryRefs
+            .FirstOrDefault(r => r.ComponentLexemesRS.Any(o => MatchesVariantTarget(o, variant)));
+    }
```

### FwDataMiniLcmApi.MatchesVariantTarget

method · +6 -0

```diff
@@ -1546,0 +1546,6 @@
+    private static bool MatchesVariantTarget(ICmObject o, Variant variant)
+    {
+        return variant.MainSenseId is not null
+            ? o is ILexSense sense && sense.Guid == variant.MainSenseId && sense.Entry.Guid == variant.MainEntryId
+            : o is ILexEntry entry && entry.Guid == variant.MainEntryId;
+    }
```

## backend/FwLite/FwDataMiniLcmBridge/Api/UpdateProxy/UpdateVariantProxy.cs

### lines 1–11

other · +10 -0

```diff
@@ -0,0 +1,4 @@
+using System.Diagnostics.CodeAnalysis;
+using MiniLcm.Models;
+using SIL.LCModel;
+
@@ -6,0 +6,6 @@
+
+/// <summary>
+/// Applies patches of a variant link's own fields (HideMinorEntry, Comment) to the
+/// LexEntryRef. Endpoints and Types are not patchable — links are recreated for endpoint
+/// changes and types go through Add/RemoveVariantType.
+/// </summary>
```

## backend/FwLite/FwDataMiniLcmBridge/Api/UpdateProxy/UpdateVariantProxy.cs

### FwDataMiniLcmBridge.Api.UpdateProxy

other · +1 -0

```diff
@@ -5,0 +5,1 @@
+namespace FwDataMiniLcmBridge.Api.UpdateProxy;
```

## backend/FwLite/FwDataMiniLcmBridge/Api/UpdateProxy/UpdateVariantProxy.cs

### UpdateVariantProxy

other · +12 -0

```diff
@@ -12,0 +12,5 @@
+public record UpdateVariantProxy : Variant
+{
+    private readonly ILexEntryRef _lexEntryRef;
+    private readonly FwDataMiniLcmApi _lexboxLcmApi;
+
@@ -23,0 +23,1 @@
+
@@ -29,0 +29,1 @@
+
@@ -35,0 +35,1 @@
+
@@ -41,0 +41,1 @@
+
@@ -47,0 +47,1 @@
+
@@ -53,0 +53,1 @@
+
@@ -61,0 +61,1 @@
+}
```

## backend/FwLite/FwDataMiniLcmBridge/Api/UpdateProxy/UpdateVariantProxy.cs

### UpdateVariantProxy.UpdateVariantProxy

method · +6 -0

```diff
@@ -17,0 +17,6 @@
+    [SetsRequiredMembers]
+    public UpdateVariantProxy(ILexEntryRef lexEntryRef, FwDataMiniLcmApi lexboxLcmApi)
+    {
+        _lexEntryRef = lexEntryRef;
+        _lexboxLcmApi = lexboxLcmApi;
+    }
```

## backend/FwLite/FwDataMiniLcmBridge/Api/UpdateProxy/UpdateVariantProxy.cs

### UpdateVariantProxy.VariantEntryId

method · +5 -0

```diff
@@ -24,0 +24,5 @@
+    public override required Guid VariantEntryId
+    {
+        get => _lexEntryRef.Owner.Guid;
+        set => throw new NotImplementedException();
+    }
```

## backend/FwLite/FwDataMiniLcmBridge/Api/UpdateProxy/UpdateVariantProxy.cs

### UpdateVariantProxy.MainEntryId

method · +5 -0

```diff
@@ -30,0 +30,5 @@
+    public override required Guid MainEntryId
+    {
+        get => throw new NotImplementedException();
+        set => throw new NotImplementedException();
+    }
```

## backend/FwLite/FwDataMiniLcmBridge/Api/UpdateProxy/UpdateVariantProxy.cs

### UpdateVariantProxy.MainSenseId

method · +5 -0

```diff
@@ -36,0 +36,5 @@
+    public override Guid? MainSenseId
+    {
+        get => throw new NotImplementedException();
+        set => throw new NotImplementedException();
+    }
```

## backend/FwLite/FwDataMiniLcmBridge/Api/UpdateProxy/UpdateVariantProxy.cs

### UpdateVariantProxy.Types

method · +5 -0

```diff
@@ -42,0 +42,5 @@
+    public override List<VariantType> Types
+    {
+        get => throw new NotImplementedException();
+        set => throw new NotImplementedException();
+    }
```

## backend/FwLite/FwDataMiniLcmBridge/Api/UpdateProxy/UpdateVariantProxy.cs

### UpdateVariantProxy.HideMinorEntry

method · +5 -0

```diff
@@ -48,0 +48,5 @@
+    public override bool HideMinorEntry
+    {
+        get => _lexEntryRef.HideMinorEntry != 0;
+        set => _lexEntryRef.HideMinorEntry = value ? 1 : 0;
+    }
```

## backend/FwLite/FwDataMiniLcmBridge/Api/UpdateProxy/UpdateVariantProxy.cs

### UpdateVariantProxy.Comment

method · +7 -0

```diff
@@ -54,0 +54,7 @@
+    public override RichMultiString Comment
+    {
+        get => new UpdateRichMultiStringProxy(_lexEntryRef.Summary, _lexboxLcmApi);
+        set
+        {
+        }
+    }
```

## backend/FwLite/FwDataMiniLcmBridge/Api/UpdateProxy/UpdateVariantTypeProxy.cs

### lines 1–6

other · +5 -0

```diff
@@ -0,0 +1,4 @@
+using System.Diagnostics.CodeAnalysis;
+using MiniLcm.Models;
+using SIL.LCModel;
+
@@ -6,0 +6,1 @@
+
```

## backend/FwLite/FwDataMiniLcmBridge/Api/UpdateProxy/UpdateVariantTypeProxy.cs

### FwDataMiniLcmBridge.Api.UpdateProxy

other · +1 -0

```diff
@@ -5,0 +5,1 @@
+namespace FwDataMiniLcmBridge.Api.UpdateProxy;
```

## backend/FwLite/FwDataMiniLcmBridge/Api/UpdateProxy/UpdateVariantTypeProxy.cs

### UpdateVariantTypeProxy

other · +8 -0

```diff
@@ -7,0 +7,5 @@
+public record UpdateVariantTypeProxy : VariantType
+{
+    private readonly ILexEntryType _lexEntryType;
+    private readonly FwDataMiniLcmApi _lexboxLcmApi;
+
@@ -19,0 +19,1 @@
+
@@ -25,0 +25,1 @@
+
@@ -33,0 +33,1 @@
+}
```

## backend/FwLite/FwDataMiniLcmBridge/Api/UpdateProxy/UpdateVariantTypeProxy.cs

### UpdateVariantTypeProxy.UpdateVariantTypeProxy

method · +7 -0

```diff
@@ -12,0 +12,7 @@
+    [SetsRequiredMembers]
+    public UpdateVariantTypeProxy(ILexEntryType lexEntryType, FwDataMiniLcmApi lexboxLcmApi)
+    {
+        _lexEntryType = lexEntryType;
+        _lexboxLcmApi = lexboxLcmApi;
+        Name = base.Name = new();
+    }
```

## backend/FwLite/FwDataMiniLcmBridge/Api/UpdateProxy/UpdateVariantTypeProxy.cs

### UpdateVariantTypeProxy.Id

method · +5 -0

```diff
@@ -20,0 +20,5 @@
+    public override Guid Id
+    {
+        get => _lexEntryType.Guid;
+        set => throw new NotImplementedException();
+    }
```

## backend/FwLite/FwDataMiniLcmBridge/Api/UpdateProxy/UpdateVariantTypeProxy.cs

### UpdateVariantTypeProxy.Name

method · +7 -0

```diff
@@ -26,0 +26,7 @@
+    public override required MultiString Name
+    {
+        get => new UpdateMultiStringProxy(_lexEntryType.Name, _lexboxLcmApi);
+        set
+        {
+        }
+    }
```

## backend/FwLite/FwLiteProjectSync/CrdtFwdataProjectSyncService.cs

### EntrySyncTestsBase.CanSyncRandomEntries — from backend/FwLite/FwLiteProjectSync.Tests/EntrySyncTests.cs

method · +9 -0

```diff
@@ -372,0 +373,9 @@
+            // both apis sort variant links by composite key, not the order the expected object was built in;
+            // headwords are derived on read like the complex-form ones above (see VariantTestsBase)
+            options = options
+                .WithoutStrictOrderingFor(e => e.VariantOf)
+                .WithoutStrictOrderingFor(e => e.Variants)
+                .For(e => e.VariantOf).Exclude(v => v.VariantHeadword)
+                .For(e => e.VariantOf).Exclude(v => v.MainHeadword)
+                .For(e => e.Variants).Exclude(v => v.VariantHeadword)
+                .For(e => e.Variants).Exclude(v => v.MainHeadword);
```

### SyncTests.SyncExclusions — from backend/FwLite/FwLiteProjectSync.Tests/SyncTests.cs

method · +3 -1

```diff
@@ -95,1 +95,3 @@
-            .For(e => e.ComplexForms).Exclude(c => c.Order);
+            .For(e => e.ComplexForms).Exclude(c => c.Order)
+            .For(e => e.VariantOf).Exclude(v => v.Id)
+            .For(e => e.Variants).Exclude(v => v.Id);
```

### UpdateDiffTests.EntryDiffShouldUpdateAllFields — from backend/FwLite/FwLiteProjectSync.Tests/UpdateDiffTests.cs

method · +2 -0

```diff
@@ -27,0 +28,2 @@
+                .Excluding(x => x.VariantOf)
+                .Excluding(x => x.Variants)
```

### lines 1–6 — from backend/FwLite/FwLiteProjectSync.Tests/VariantSyncTests.cs

other · +5 -0

```diff
@@ -0,0 +1,4 @@
+using FwLiteProjectSync.Tests.Fixtures;
+using MiniLcm;
+using MiniLcm.Models;
+
@@ -6,0 +6,1 @@
+
```

### CrdtFwdataProjectSyncService.SyncInternal

method · +6 -0

```diff
@@ -136,0 +137,6 @@
+        var currentFwDataVariantTypes = await fwdataApi.GetVariantTypes().ToArrayAsync();
+        // Legacy snapshots predate variant support and deserialize with an empty list; the CRDT
+        // genuinely has no variant types yet, so that baseline correctly imports FwData's list.
+        crdtChanges += await VariantTypeSync.Sync(projectSnapshot.VariantTypes, currentFwDataVariantTypes, crdtApi);
+        fwdataChanges += await VariantTypeSync.Sync(currentFwDataVariantTypes, await crdtApi.GetVariantTypes().ToArrayAsync(), fwdataApi);
+
```

## backend/FwLite/FwLiteProjectSync/DryRunMiniLcmApi.cs

### DryRunMiniLcmApi.CreateVariantType

method · +6 -0

```diff
@@ -128,0 +129,6 @@
+    public Task<VariantType> CreateVariantType(VariantType variantType)
+    {
+        DryRunRecords.Add(new DryRunRecord(nameof(CreateVariantType),
+            $"Create variant type {variantType.Name}"));
+        return Task.FromResult(variantType);
+    }
```

## backend/FwLite/FwLiteProjectSync/DryRunMiniLcmApi.cs

### DryRunMiniLcmApi

other · +13 -0 · low-signal (whitespace)

```diff
@@ -135,0 +135,1 @@
+
@@ -141,0 +141,1 @@
+
@@ -147,0 +147,1 @@
+
@@ -153,0 +153,1 @@
+
@@ -397,0 +397,1 @@
+
@@ -403,0 +403,1 @@
+
@@ -409,0 +409,1 @@
+
@@ -415,0 +415,1 @@
+
@@ -421,0 +421,1 @@
+
@@ -426,0 +426,1 @@
+
@@ -508,0 +508,1 @@
+
@@ -514,0 +514,1 @@
+
@@ -520,0 +520,1 @@
+
```

## backend/FwLite/FwLiteProjectSync/DryRunMiniLcmApi.cs

### DryRunMiniLcmApi.UpdateVariantType

method · +5 -0

```diff
@@ -136,0 +136,5 @@
+    public async Task<VariantType> UpdateVariantType(Guid id, UpdateObjectInput<VariantType> update)
+    {
+        DryRunRecords.Add(new DryRunRecord(nameof(UpdateVariantType), $"Update variant type {id}"));
+        return await _api.GetVariantType(id) ?? throw new NullReferenceException($"unable to find variant type with id {id}");
+    }
```

## backend/FwLite/FwLiteProjectSync/DryRunMiniLcmApi.cs

### DryRunMiniLcmApi.UpdateVariantType

method · +5 -0

```diff
@@ -142,0 +142,5 @@
+    public Task<VariantType> UpdateVariantType(VariantType before, VariantType after, IMiniLcmApi? api)
+    {
+        DryRunRecords.Add(new DryRunRecord(nameof(UpdateVariantType), $"Update variant type {after.Id}"));
+        return Task.FromResult(after);
+    }
```

## backend/FwLite/FwLiteProjectSync/DryRunMiniLcmApi.cs

### DryRunMiniLcmApi.DeleteVariantType

method · +5 -0

```diff
@@ -148,0 +148,5 @@
+    public Task DeleteVariantType(Guid id)
+    {
+        DryRunRecords.Add(new DryRunRecord(nameof(DeleteVariantType), $"Delete variant type {id}"));
+        return Task.CompletedTask;
+    }
```

## backend/FwLite/FwLiteProjectSync/DryRunMiniLcmApi.cs

### DryRunMiniLcmApi.CreateEntry

method · +1 -1

```diff
@@ -155,1 +180,1 @@
-            return Task.FromResult(entry with { Components = [], ComplexForms = [] });
+            return Task.FromResult(entry with { Components = [], ComplexForms = [], VariantOf = [], Variants = [] });
```

## backend/FwLite/FwLiteProjectSync/DryRunMiniLcmApi.cs

### DryRunMiniLcmApi.CreateVariant

method · +5 -0

```diff
@@ -366,0 +392,5 @@
+    public Task<Variant> CreateVariant(Variant variant)
+    {
+        DryRunRecords.Add(new DryRunRecord(nameof(CreateVariant), $"Create variant link {VariantName(variant)}"));
+        return Task.FromResult(variant);
+    }
```

## backend/FwLite/FwLiteProjectSync/DryRunMiniLcmApi.cs

### DryRunMiniLcmApi.UpdateVariant

method · +5 -0

```diff
@@ -398,0 +398,5 @@
+    public Task<Variant> UpdateVariant(Variant before, Variant after, IMiniLcmApi? api = null)
+    {
+        DryRunRecords.Add(new DryRunRecord(nameof(UpdateVariant), $"Update variant link {VariantName(after)}"));
+        return Task.FromResult(after);
+    }
```

## backend/FwLite/FwLiteProjectSync/DryRunMiniLcmApi.cs

### DryRunMiniLcmApi.DeleteVariant

method · +5 -0

```diff
@@ -404,0 +404,5 @@
+    public Task DeleteVariant(Variant variant)
+    {
+        DryRunRecords.Add(new DryRunRecord(nameof(DeleteVariant), $"Delete variant link {VariantName(variant)}"));
+        return Task.CompletedTask;
+    }
```

## backend/FwLite/FwLiteProjectSync/DryRunMiniLcmApi.cs

### DryRunMiniLcmApi.AddVariantType

method · +5 -0

```diff
@@ -410,0 +410,5 @@
+    public Task AddVariantType(Variant variant, Guid variantTypeId)
+    {
+        DryRunRecords.Add(new DryRunRecord(nameof(AddVariantType), $"Add variant type {variantTypeId} to variant link {VariantName(variant)}"));
+        return Task.CompletedTask;
+    }
```

## backend/FwLite/FwLiteProjectSync/DryRunMiniLcmApi.cs

### DryRunMiniLcmApi.RemoveVariantType

method · +5 -0

```diff
@@ -416,0 +416,5 @@
+    public Task RemoveVariantType(Variant variant, Guid variantTypeId)
+    {
+        DryRunRecords.Add(new DryRunRecord(nameof(RemoveVariantType), $"Remove variant type {variantTypeId} from variant link {VariantName(variant)}"));
+        return Task.CompletedTask;
+    }
```

## backend/FwLite/FwLiteProjectSync/DryRunMiniLcmApi.cs

### DryRunMiniLcmApi.SubmitCreateVariant

method · +5 -0

```diff
@@ -442,0 +503,5 @@
+    public Task SubmitCreateVariant(Variant variant)
+    {
+        DryRunRecords.Add(new DryRunRecord(nameof(SubmitCreateVariant), $"Create variant link {VariantName(variant)}"));
+        return Task.CompletedTask;
+    }
```

## backend/FwLite/FwLiteProjectSync/DryRunMiniLcmApi.cs

### DryRunMiniLcmApi.SubmitUpdateVariant

method · +5 -0

```diff
@@ -509,0 +509,5 @@
+    public Task SubmitUpdateVariant(Variant variant, UpdateObjectInput<Variant> update)
+    {
+        DryRunRecords.Add(new DryRunRecord(nameof(SubmitUpdateVariant), $"Update variant link {VariantName(variant)}"));
+        return Task.CompletedTask;
+    }
```

### DryRunMiniLcmApi.VariantName

method · +4 -0

```diff
@@ -422,0 +422,4 @@
+    private static string VariantName(Variant variant)
+    {
+        return $"{variant.VariantHeadword ?? variant.VariantEntryId.ToString()} -> {variant.MainHeadword ?? variant.MainEntryId.ToString()}{(variant.MainSenseId is null ? "" : $" (sense {variant.MainSenseId})")}";
+    }
```

## backend/FwLite/FwLiteProjectSync/DryRunMiniLcmApi.cs

### DryRunMiniLcmApi.SubmitUpdateVariantType

method · +5 -0

```diff
@@ -515,0 +515,5 @@
+    public Task SubmitUpdateVariantType(Guid id, UpdateObjectInput<VariantType> update)
+    {
+        DryRunRecords.Add(new DryRunRecord(nameof(SubmitUpdateVariantType), $"Update variant type {id}"));
+        return Task.CompletedTask;
+    }
```

## backend/FwLite/FwLiteProjectSync/Import/ResumableImportApi.cs

### ResumableImportApi.CreateVariantType

method · +4 -0

```diff
@@ -60,0 +61,4 @@
+    async Task<VariantType> IMiniLcmWriteApi.CreateVariantType(VariantType variantType)
+    {
+        return await HasCreated(variantType, _api.GetVariantTypes(), () => _api.CreateVariantType(variantType));
+    }
```

## backend/FwLite/FwLiteShared/Services/MiniLcmApiNotifyWrapper.cs

### MiniLcmApiNotifyWrapper.CreateVariant

method · +6 -0

```diff
@@ -138,0 +139,6 @@
+    async Task<Variant> IMiniLcmWriteApi.CreateVariant(Variant variant)
+    {
+        var result = await _api.CreateVariant(variant);
+        NotifyEntriesChanged(result.VariantEntryId, result.MainEntryId);
+        return result;
+    }
```

## backend/FwLite/FwLiteShared/Services/MiniLcmApiNotifyWrapper.cs

### MiniLcmApiNotifyWrapper

other · +5 -0 · low-signal (whitespace)

```diff
@@ -145,0 +145,1 @@
+
@@ -152,0 +152,1 @@
+
@@ -158,0 +158,1 @@
+
@@ -164,0 +164,1 @@
+
@@ -170,0 +170,1 @@
+
```

## backend/FwLite/FwLiteShared/Services/MiniLcmApiNotifyWrapper.cs

### MiniLcmApiNotifyWrapper.UpdateVariant

method · +6 -0

```diff
@@ -146,0 +146,6 @@
+    async Task<Variant> IMiniLcmWriteApi.UpdateVariant(Variant before, Variant after, IMiniLcmApi? api)
+    {
+        var result = await _api.UpdateVariant(before, after, api ?? this);
+        NotifyEntriesChanged(result.VariantEntryId, result.MainEntryId);
+        return result;
+    }
```

## backend/FwLite/FwLiteShared/Services/MiniLcmApiNotifyWrapper.cs

### MiniLcmApiNotifyWrapper.DeleteVariant

method · +5 -0

```diff
@@ -153,0 +153,5 @@
+    async Task IMiniLcmWriteApi.DeleteVariant(Variant variant)
+    {
+        await _api.DeleteVariant(variant);
+        NotifyEntriesChanged(variant.VariantEntryId, variant.MainEntryId);
+    }
```

## backend/FwLite/FwLiteShared/Services/MiniLcmApiNotifyWrapper.cs

### MiniLcmApiNotifyWrapper.AddVariantType

method · +5 -0

```diff
@@ -159,0 +159,5 @@
+    async Task IMiniLcmWriteApi.AddVariantType(Variant variant, Guid variantTypeId)
+    {
+        await _api.AddVariantType(variant, variantTypeId);
+        NotifyEntriesChanged(variant.VariantEntryId, variant.MainEntryId);
+    }
```

## backend/FwLite/FwLiteShared/Services/MiniLcmApiNotifyWrapper.cs

### MiniLcmApiNotifyWrapper.RemoveVariantType

method · +5 -0

```diff
@@ -165,0 +165,5 @@
+    async Task IMiniLcmWriteApi.RemoveVariantType(Variant variant, Guid variantTypeId)
+    {
+        await _api.RemoveVariantType(variant, variantTypeId);
+        NotifyEntriesChanged(variant.VariantEntryId, variant.MainEntryId);
+    }
```

## backend/FwLite/FwLiteShared/Services/MiniLcmJsInvokable.cs

### MiniLcmJsInvokable.GetVariantTypes

method · +5 -0

```diff
@@ -324,0 +325,5 @@
+    [JSInvokable]
+    public ValueTask<VariantType[]> GetVariantTypes()
+    {
+        return _wrappedApi.GetVariantTypes().ToArrayAsync();
+    }
```

## backend/FwLite/FwLiteShared/Services/MiniLcmJsInvokable.cs

### MiniLcmJsInvokable

other · +6 -0 · low-signal (whitespace)

```diff
@@ -330,0 +330,1 @@
+
@@ -337,0 +337,1 @@
+
@@ -345,0 +345,1 @@
+
@@ -352,0 +352,1 @@
+
@@ -359,0 +359,1 @@
+
@@ -366,0 +366,1 @@
+
```

## backend/FwLite/FwLiteShared/Services/MiniLcmJsInvokable.cs

### MiniLcmJsInvokable.GetVariantType

method · +6 -0

```diff
@@ -331,0 +331,6 @@
+    [JSInvokable]
+    [TsFunction(Type = "Promise<IVariantType | null>")]
+    public Task<VariantType?> GetVariantType(Guid id)
+    {
+        return _wrappedApi.GetVariantType(id);
+    }
```

## backend/FwLite/FwLiteShared/Services/MiniLcmJsInvokable.cs

### MiniLcmJsInvokable.CreateVariant

method · +7 -0

```diff
@@ -338,0 +338,7 @@
+    [JSInvokable]
+    public async Task<Variant> CreateVariant(Variant variant)
+    {
+        var createdVariant = await _wrappedApi.CreateVariant(variant);
+        OnDataChanged();
+        return createdVariant;
+    }
```

## backend/FwLite/FwLiteShared/Services/MiniLcmJsInvokable.cs

### MiniLcmJsInvokable.DeleteVariant

method · +6 -0

```diff
@@ -346,0 +346,6 @@
+    [JSInvokable]
+    public async Task DeleteVariant(Variant variant)
+    {
+        await _wrappedApi.DeleteVariant(variant);
+        OnDataChanged();
+    }
```

## backend/FwLite/FwLiteShared/Services/MiniLcmJsInvokable.cs

### MiniLcmJsInvokable.AddVariantType

method · +6 -0

```diff
@@ -353,0 +353,6 @@
+    [JSInvokable]
+    public async Task AddVariantType(Variant variant, Guid variantTypeId)
+    {
+        await _wrappedApi.AddVariantType(variant, variantTypeId);
+        OnDataChanged();
+    }
```

## backend/FwLite/FwLiteShared/Services/MiniLcmJsInvokable.cs

### MiniLcmJsInvokable.RemoveVariantType

method · +6 -0

```diff
@@ -360,0 +360,6 @@
+    [JSInvokable]
+    public async Task RemoveVariantType(Variant variant, Guid variantTypeId)
+    {
+        await _wrappedApi.RemoveVariantType(variant, variantTypeId);
+        OnDataChanged();
+    }
```

## backend/FwLite/FwLiteWeb/Hubs/MiniLcmApiHubBase.cs

### MiniLcmApiHubBase.GetVariantTypes

method · +4 -0

```diff
@@ -50,0 +51,4 @@
+    public IAsyncEnumerable<VariantType> GetVariantTypes()
+    {
+        return _miniLcmApi.GetVariantTypes();
+    }
```

## backend/FwLite/FwLiteWeb/Hubs/MiniLcmApiHubBase.cs

### MiniLcmApiHubBase

other · +1 -0 · low-signal (whitespace)

```diff
@@ -55,0 +55,1 @@
+
```

## backend/FwLite/LcmCrdt/Changes/CreateVariantType.cs

### lines 1–9

other · +8 -0

```diff
@@ -0,0 +1,7 @@
+using LcmCrdt.Objects;
+using MiniLcm.Models;
+using SIL.Harmony;
+using SIL.Harmony.Changes;
+using SIL.Harmony.Core;
+using SIL.Harmony.Entities;
+
@@ -9,0 +9,1 @@
+
```

## backend/FwLite/LcmCrdt/Changes/CreateVariantType.cs

### LcmCrdt.Changes

other · +1 -0

```diff
@@ -8,0 +8,1 @@
+namespace LcmCrdt.Changes;
```

## backend/FwLite/LcmCrdt/Changes/CreateVariantType.cs

### CreateVariantType

other · +3 -0

```diff
@@ -10,0 +10,2 @@
+public class CreateVariantType(Guid entityId, MultiString name) : CreateChange<VariantType>(entityId), ISelfNamedType<CreateVariantType>
+{
@@ -21,0 +21,1 @@
+}
```

## backend/FwLite/LcmCrdt/Changes/CreateVariantType.cs

### CreateVariantType.Name

method · +1 -0

```diff
@@ -12,0 +12,1 @@
+    public MultiString Name { get; } = name;
```

## backend/FwLite/LcmCrdt/Changes/CreateVariantType.cs

### CreateVariantType.NewEntity

method · +8 -0

```diff
@@ -13,0 +13,8 @@
+    public override ValueTask<VariantType> NewEntity(Commit commit, IChangeContext context)
+    {
+        return ValueTask.FromResult(new VariantType
+        {
+            Id = EntityId,
+            Name = Name
+        });
+    }
```

## backend/FwLite/LcmCrdt/Changes/Entries/AddVariantChange.cs

### lines 1–8

other · +7 -0

```diff
@@ -0,0 +1,6 @@
+using System.Text.Json.Serialization;
+using SIL.Harmony;
+using SIL.Harmony.Changes;
+using SIL.Harmony.Core;
+using SIL.Harmony.Entities;
+
@@ -8,0 +8,1 @@
+
```

## backend/FwLite/LcmCrdt/Changes/Entries/AddVariantChange.cs

### LcmCrdt.Changes.Entries

other · +1 -0

```diff
@@ -7,0 +7,1 @@
+namespace LcmCrdt.Changes.Entries;
```

## backend/FwLite/LcmCrdt/Changes/Entries/AddVariantChange.cs

### AddVariantChange

other · +7 -0

```diff
@@ -9,0 +9,2 @@
+public class AddVariantChange : CreateChange<Variant>, ISelfNamedType<AddVariantChange>
+{
@@ -17,0 +17,1 @@
+
@@ -34,0 +34,1 @@
+
@@ -44,0 +44,1 @@
+
@@ -83,0 +83,1 @@
+
@@ -125,0 +125,1 @@
+}
```

## backend/FwLite/LcmCrdt/Changes/Entries/AddVariantChange.cs

### AddVariantChange.VariantEntryId

method · +1 -0

```diff
@@ -11,0 +11,1 @@
+    public Guid VariantEntryId { get; }
```

## backend/FwLite/LcmCrdt/Changes/Entries/AddVariantChange.cs

### AddVariantChange.MainEntryId

method · +1 -0

```diff
@@ -12,0 +12,1 @@
+    public Guid MainEntryId { get; }
```

## backend/FwLite/LcmCrdt/Changes/Entries/AddVariantChange.cs

### AddVariantChange.MainSenseId

method · +1 -0

```diff
@@ -13,0 +13,1 @@
+    public Guid? MainSenseId { get; }
```

## backend/FwLite/LcmCrdt/Changes/Entries/AddVariantChange.cs

### AddVariantChange.Types

method · +1 -0

```diff
@@ -14,0 +14,1 @@
+    public List<VariantType> Types { get; }
```

## backend/FwLite/LcmCrdt/Changes/Entries/AddVariantChange.cs

### AddVariantChange.HideMinorEntry

method · +1 -0

```diff
@@ -15,0 +15,1 @@
+    public bool HideMinorEntry { get; }
```

## backend/FwLite/LcmCrdt/Changes/Entries/AddVariantChange.cs

### AddVariantChange.Comment

method · +1 -0

```diff
@@ -16,0 +16,1 @@
+    public RichMultiString Comment { get; }
```

## backend/FwLite/LcmCrdt/Changes/Entries/AddVariantChange.cs

### AddVariantChange.AddVariantChange

method · +16 -0

```diff
@@ -18,0 +18,16 @@
+    [JsonConstructor]
+    public AddVariantChange(Guid entityId,
+        Guid variantEntryId,
+        Guid mainEntryId,
+        Guid? mainSenseId = null,
+        List<VariantType>? types = null,
+        bool hideMinorEntry = false,
+        RichMultiString? comment = null) : base(entityId)
+    {
+        VariantEntryId = variantEntryId;
+        MainEntryId = mainEntryId;
+        MainSenseId = mainSenseId;
+        Types = types ?? [];
+        HideMinorEntry = hideMinorEntry;
+        Comment = comment ?? new();
+    }
```

## backend/FwLite/LcmCrdt/Changes/Entries/AddVariantChange.cs

### AddVariantChange.AddVariantChange

method · +9 -0

```diff
@@ -35,0 +35,9 @@
+    public AddVariantChange(Variant variant) : this(variant.MaybeId ?? Guid.NewGuid(),
+        variant.VariantEntryId,
+        variant.MainEntryId,
+        variant.MainSenseId,
+        [..variant.Types.Select(t => t.Copy())],
+        variant.HideMinorEntry,
+        variant.Comment.Copy())
+    {
+    }
```

## backend/FwLite/LcmCrdt/Changes/Entries/AddVariantChange.cs

### AddVariantChange.NewEntity

method · +38 -0

```diff
@@ -45,0 +45,38 @@
+    public override async ValueTask<Variant> NewEntity(Commit commit, IChangeContext context)
+    {
+        var variantEntry = await context.GetCurrent<Entry>(VariantEntryId);
+        var mainEntry = await context.GetCurrent<Entry>(MainEntryId);
+        Sense? mainSense = null;
+        if (MainSenseId is not null)
+            mainSense = await context.GetCurrent<Sense>(MainSenseId.Value);
+        var shouldBeDeleted = (variantEntry is null or {DeletedAt: not null } ||
+                               mainEntry is null or { DeletedAt: not null } ||
+                               (MainSenseId.HasValue && mainSense?.DeletedAt is not null));
+        var types = new List<VariantType>(Types.Count);
+        foreach (var type in Types)
+        {
+            if (await context.IsObjectDeleted(type.Id)) continue;
+            types.Add(type);
+        }
+        var variant = new Variant
+        {
+            Id = EntityId,
+            VariantEntryId = VariantEntryId,
+            VariantHeadword = variantEntry?.Headword(),
+            MainEntryId = MainEntryId,
+            MainHeadword = mainEntry?.Headword(),
+            MainSenseId = MainSenseId,
+            Types = types,
+            HideMinorEntry = HideMinorEntry,
+            Comment = Comment.Copy(),
+            DeletedAt = shouldBeDeleted
+                ? commit.DateTime
+                : (DateTime?)null,
+        };
+        if (variant.DeletedAt is null && await CreatesReferenceCycleOrDuplicate(variant, context))
+        {
+            variant.DeletedAt = commit.DateTime;
+        }
+
+        return variant;
+    }
```

### AddVariantChange.CreatesReferenceCycleOrDuplicate.fragment 1

method-fragment · +40 -0

```diff
@@ -84,0 +84,40 @@
+    private static async ValueTask<bool> CreatesReferenceCycleOrDuplicate(Variant parent, IChangeContext context)
+    {
+        if (parent.VariantEntryId == parent.MainEntryId) return true;
+        await foreach (var o in context.GetObjectsReferencing(parent.VariantEntryId))
+        {
+            if (o is not Variant v) continue;
+            if (v.DeletedAt is not null) continue;
+            if (v.Id == parent.Id) continue;
+            var duplicate = v.VariantEntryId == parent.VariantEntryId &&
+                            v.MainEntryId == parent.MainEntryId &&
+                            v.MainSenseId == parent.MainSenseId;
+            if (duplicate) return true;
+        }
+
+        //LCM enforces acyclicity over the COMBINED complex-form + variant component graph
+        //(LexEntryRef.ValidateAddObjectInternal → LexEntry.AllComponents), so mirror that:
+        //walk everything the main entry depends on through both link types; if the variant
+        //entry is reachable, this link would close a cycle FLEx rejects
+        HashSet<Guid> visited = [];
+        Queue<Guid> queue = new();
+        queue.Enqueue(parent.MainEntryId);
+        while (queue.Count > 0)
+        {
+            var entryId = queue.Dequeue();
+            if (entryId == parent.VariantEntryId) return true;
+            if (!visited.Add(entryId)) continue;
+            await foreach (var o in context.GetObjectsReferencing(entryId))
+            {
+                switch (o)
+                {
+                    case Variant v when v.DeletedAt is null && v.VariantEntryId == entryId:
+                        queue.Enqueue(v.MainEntryId);
+                        break;
+                    case ComplexFormComponent cfc when cfc.DeletedAt is null && cfc.ComplexFormEntryId == entryId:
+                        queue.Enqueue(cfc.ComponentEntryId);
+                        break;
+                }
+            }
+        }
+        return false;
```

## backend/FwLite/LcmCrdt/Changes/Entries/AddVariantChange.cs

### AddVariantChange.CreatesReferenceCycleOrDuplicate.fragment 2

method-fragment · +1 -0

```diff
@@ -124,0 +124,1 @@
+    }
```

## backend/FwLite/LcmCrdt/Changes/Entries/AddVariantTypeChange.cs

### lines 1–6

other · +5 -0

```diff
@@ -0,0 +1,4 @@
+using SIL.Harmony.Changes;
+using SIL.Harmony.Core;
+using SIL.Harmony.Entities;
+
@@ -6,0 +6,1 @@
+
```

## backend/FwLite/LcmCrdt/Changes/Entries/AddVariantTypeChange.cs

### LcmCrdt.Changes.Entries

other · +1 -0

```diff
@@ -5,0 +5,1 @@
+namespace LcmCrdt.Changes.Entries;
```

## backend/FwLite/LcmCrdt/Changes/Entries/AddVariantTypeChange.cs

### UseChangesTests.GetAllChanges — from backend/FwLite/LcmCrdt.Tests/Changes/UseChangesTests.cs

method · +19 -0

```diff
@@ -240,0 +241,19 @@
+        var variantTypeName = new MultiString { { "en", "test vt" } };
+        var variantType = new VariantType { Id = Guid.NewGuid(), Name = variantTypeName };
+        var createVariantType = new CreateVariantType(variantType.Id, variantTypeName);
+        yield return new ChangeWithDependencies(createVariantType);
+
+        var variantEntry = new Entry { Id = Guid.NewGuid(), LexemeForm = { { "en", "test variant" } } };
+        var createVariantEntryChange = new CreateEntryChange(variantEntry);
+        yield return new ChangeWithDependencies(createVariantEntryChange);
+
+        var variant = Variant.FromEntries(variantEntry, entry, sense.Id);
+        var addVariantChange = new AddVariantChange(variant);
+        yield return new ChangeWithDependencies(addVariantChange, [createVariantEntryChange, createEntryChange, createSenseChange]);
+
+        var addVariantTypeChange = new AddVariantTypeChange(variant.Id, variantType);
+        yield return new ChangeWithDependencies(addVariantTypeChange, [createVariantType, addVariantChange]);
+
+        var removeVariantTypeChange = new RemoveVariantTypeChange(variant.Id, variantType.Id);
+        yield return new ChangeWithDependencies(removeVariantTypeChange, [addVariantTypeChange]);
+
```

### AddVariantTypeChange.VariantType

method · +1 -0

```diff
@@ -10,0 +10,1 @@
+    public VariantType VariantType { get; } = variantType;
```

## backend/FwLite/LcmCrdt/Changes/Entries/AddVariantTypeChange.cs

### AddVariantTypeChange.ApplyChange

method · +6 -0

```diff
@@ -12,0 +12,6 @@
+    public override async ValueTask ApplyChange(Variant entity, IChangeContext context)
+    {
+        if (entity.Types.Any(t => t.Id == VariantType.Id)) return;
+        if (await context.IsObjectDeleted(VariantType.Id)) return;
+        entity.Types.Add(VariantType);
+    }
```

## backend/FwLite/LcmCrdt/Changes/Entries/RemoveVariantTypeChange.cs

### lines 1–6

other · +5 -0

```diff
@@ -0,0 +1,4 @@
+using SIL.Harmony.Changes;
+using SIL.Harmony.Core;
+using SIL.Harmony.Entities;
+
@@ -6,0 +6,1 @@
+
```

## backend/FwLite/LcmCrdt/Changes/Entries/RemoveVariantTypeChange.cs

### LcmCrdt.Changes.Entries

other · +1 -0

```diff
@@ -5,0 +5,1 @@
+namespace LcmCrdt.Changes.Entries;
```

## backend/FwLite/LcmCrdt/Changes/Entries/RemoveVariantTypeChange.cs

### RemoveVariantTypeChange.VariantTypeId

method · +1 -0

```diff
@@ -9,0 +9,1 @@
+    public Guid VariantTypeId { get; } = variantTypeId;
```

## backend/FwLite/LcmCrdt/Changes/Entries/RemoveVariantTypeChange.cs

### RemoveVariantTypeChange.ApplyChange

method · +5 -0

```diff
@@ -10,0 +10,5 @@
+    public override ValueTask ApplyChange(Variant entity, IChangeContext context)
+    {
+        entity.Types.RemoveAll(t => t.Id == VariantTypeId);
+        return ValueTask.CompletedTask;
+    }
```

## backend/FwLite/LcmCrdt/CrdtMiniLcmApi.cs

### MigrationTests.TakeProjectSnapshot — from backend/FwLite/LcmCrdt.Tests/Data/MigrationTests.cs

method · +3 -0

```diff
@@ -166,0 +167,3 @@
+            await api.GetVariantTypes()
+                .OrderBy(v => v.Id)
+                .ToArrayAsync(),
```

### CrdtMiniLcmApi.GetVariantTypes

method · +8 -0

```diff
@@ -406,0 +407,8 @@
+    public async IAsyncEnumerable<VariantType> GetVariantTypes()
+    {
+        await using var repo = await repoFactory.CreateRepoAsync();
+        await foreach (var variantType in repo.VariantTypes.AsAsyncEnumerable())
+        {
+            yield return variantType;
+        }
+    }
```

## backend/FwLite/LcmCrdt/CrdtMiniLcmApi.cs

### CrdtMiniLcmApi

other · +15 -0 · low-signal (whitespace)

```diff
@@ -415,0 +415,1 @@
+
@@ -421,0 +421,1 @@
+
@@ -429,0 +429,1 @@
+
@@ -434,0 +434,1 @@
+
@@ -440,0 +440,1 @@
+
@@ -446,0 +446,1 @@
+
@@ -451,0 +451,1 @@
+
@@ -463,0 +463,1 @@
+
@@ -488,0 +488,1 @@
+
@@ -495,0 +495,1 @@
+
@@ -502,0 +502,1 @@
+
@@ -511,0 +511,1 @@
+
@@ -519,0 +519,1 @@
+
@@ -527,0 +527,1 @@
+
@@ -535,0 +535,1 @@
+
```

## backend/FwLite/LcmCrdt/CrdtMiniLcmApi.cs

### VariantChangeTests.AddVariant_CarriesTypesAndScalars — from backend/FwLite/LcmCrdt.Tests/Changes/VariantChangeTests.cs

method · +19 -0

```diff
@@ -31,0 +31,19 @@
+    [Fact]
+    public async Task AddVariant_CarriesTypesAndScalars()
+    {
+        var (variantEntry, mainEntry) = await CreateEntryPair();
+        var variantType = await fixture.Api.CreateVariantType(new VariantType { Id = Guid.NewGuid(), Name = new() { { "en", "spelling" } } });
+
+        var variant = Variant.FromEntries(variantEntry, mainEntry) with
+        {
+            Types = [variantType],
+            HideMinorEntry = true,
+            Comment = new() { { "en", new RichString("british spelling") } },
+        };
+        await fixture.DataModel.AddChange(Guid.NewGuid(), new AddVariantChange(variant));
+
+        var link = (await fixture.Api.GetEntry(variantEntry.Id))!.VariantOf.Should().ContainSingle().Subject;
+        link.Types.Should().ContainSingle(t => t.Id == variantType.Id);
+        link.HideMinorEntry.Should().BeTrue();
+        link.Comment["en"].GetPlainText().Should().Be("british spelling");
+    }
```

### VariantChangeTests.AddVariant_SkipsDeletedTypes — from backend/FwLite/LcmCrdt.Tests/Changes/VariantChangeTests.cs

method · +13 -0

```diff
@@ -51,0 +51,13 @@
+    [Fact]
+    public async Task AddVariant_SkipsDeletedTypes()
+    {
+        var (variantEntry, mainEntry) = await CreateEntryPair();
+        var variantType = await fixture.Api.CreateVariantType(new VariantType { Id = Guid.NewGuid(), Name = new() { { "en", "doomed" } } });
+        await fixture.Api.DeleteVariantType(variantType.Id);
+
+        var variant = Variant.FromEntries(variantEntry, mainEntry) with { Types = [variantType] };
+        await fixture.DataModel.AddChange(Guid.NewGuid(), new AddVariantChange(variant));
+
+        var link = (await fixture.Api.GetEntry(variantEntry.Id))!.VariantOf.Should().ContainSingle().Subject;
+        link.Types.Should().BeEmpty();
+    }
```

### VariantChangeTests.AddVariantType — from backend/FwLite/LcmCrdt.Tests/Changes/VariantChangeTests.cs

method · +15 -0

```diff
@@ -109,0 +109,15 @@
+    [Fact]
+    public async Task AddVariantType()
+    {
+        var (variantEntry, mainEntry) = await CreateEntryPair();
+        var variantType = await fixture.Api.CreateVariantType(new VariantType { Id = Guid.NewGuid(), Name = new() { { "en", "test" } } });
+
+        await fixture.DataModel.AddChange(Guid.NewGuid(), new AddVariantChange(Variant.FromEntries(variantEntry, mainEntry)));
+        var link = (await fixture.Api.GetEntry(variantEntry.Id))!.VariantOf.Single();
+
+        var change = new AddVariantTypeChange(link.Id, variantType);
+        await fixture.DataModel.AddChange(Guid.NewGuid(), change);
+
+        link = (await fixture.Api.GetEntry(variantEntry.Id))!.VariantOf.Single();
+        link.Types.Should().ContainSingle().Which.Id.Should().Be(variantType.Id);
+    }
```

### VariantChangeTests.RemoveVariantType — from backend/FwLite/LcmCrdt.Tests/Changes/VariantChangeTests.cs

method · +15 -0

```diff
@@ -125,0 +125,15 @@
+    [Fact]
+    public async Task RemoveVariantType()
+    {
+        var (variantEntry, mainEntry) = await CreateEntryPair();
+        var variantType = await fixture.Api.CreateVariantType(new VariantType { Id = Guid.NewGuid(), Name = new() { { "en", "test" } } });
+
+        await fixture.DataModel.AddChange(Guid.NewGuid(), new AddVariantChange(Variant.FromEntries(variantEntry, mainEntry) with { Types = [variantType] }));
+        var link = (await fixture.Api.GetEntry(variantEntry.Id))!.VariantOf.Single();
+        link.Types.Should().ContainSingle();
+
+        await fixture.DataModel.AddChange(Guid.NewGuid(), new RemoveVariantTypeChange(link.Id, variantType.Id));
+
+        link = (await fixture.Api.GetEntry(variantEntry.Id))!.VariantOf.Single();
+        link.Types.Should().BeEmpty();
+    }
```

### VariantChangeTests.DeletingVariantTypeRemovesItFromLinks — from backend/FwLite/LcmCrdt.Tests/Changes/VariantChangeTests.cs

method · +13 -0

```diff
@@ -141,0 +141,13 @@
+    [Fact]
+    public async Task DeletingVariantTypeRemovesItFromLinks()
+    {
+        var (variantEntry, mainEntry) = await CreateEntryPair();
+        var variantType = await fixture.Api.CreateVariantType(new VariantType { Id = Guid.NewGuid(), Name = new() { { "en", "test" } } });
+
+        await fixture.DataModel.AddChange(Guid.NewGuid(), new AddVariantChange(Variant.FromEntries(variantEntry, mainEntry) with { Types = [variantType] }));
+        await fixture.DataModel.AddChange(Guid.NewGuid(), new DeleteChange<VariantType>(variantType.Id));
+
+        var link = (await fixture.Api.GetEntry(variantEntry.Id))!.VariantOf.Should().ContainSingle().Subject;
+        link.DeletedAt.Should().BeNull("deleting a type must not delete the link");
+        link.Types.Should().BeEmpty();
+    }
```

### CrdtMiniLcmApi.CreateVariantType

method · +7 -0

```diff
@@ -422,0 +422,7 @@
+    public async Task<VariantType> CreateVariantType(VariantType variantType)
+    {
+        await using var repo = await repoFactory.CreateRepoAsync();
+        if (variantType.Id == default) variantType.Id = Guid.NewGuid();
+        await AddChange(new CreateVariantType(variantType.Id, variantType.Name));
+        return await repo.VariantTypes.SingleAsync(v => v.Id == variantType.Id);
+    }
```

## backend/FwLite/LcmCrdt/CrdtMiniLcmApi.cs

### CrdtMiniLcmApi.UpdateVariantType

method · +5 -0

```diff
@@ -435,0 +435,5 @@
+    public async Task<VariantType> UpdateVariantType(Guid id, UpdateObjectInput<VariantType> update)
+    {
+        await SubmitUpdateVariantType(id, update);
+        return await GetVariantType(id) ?? throw NotFoundException.ForType<VariantType>(id);
+    }
```

### CrdtMiniLcmApi.SubmitUpdateVariantType

method · +4 -0

```diff
@@ -430,0 +430,4 @@
+    public async Task SubmitUpdateVariantType(Guid id, UpdateObjectInput<VariantType> update)
+    {
+        await AddChange(new JsonPatchChange<VariantType>(id, update.Patch));
+    }
```

## backend/FwLite/LcmCrdt/CrdtMiniLcmApi.cs

### CrdtMiniLcmApi.UpdateVariantType

method · +5 -0

```diff
@@ -441,0 +441,5 @@
+    public async Task<VariantType> UpdateVariantType(VariantType before, VariantType after, IMiniLcmApi? api = null)
+    {
+        await VariantTypeSync.Sync(before, after, api ?? this);
+        return await GetVariantType(after.Id) ?? throw NotFoundException.ForType<VariantType>(after.Id);
+    }
```

### CrdtMiniLcmApi.GetVariantType

method · +5 -0

```diff
@@ -416,0 +416,5 @@
+    public async Task<VariantType?> GetVariantType(Guid id)
+    {
+        await using var repo = await repoFactory.CreateRepoAsync();
+        return await repo.VariantTypes.SingleOrDefaultAsync(v => v.Id == id);
+    }
```

## backend/FwLite/LcmCrdt/CrdtMiniLcmApi.cs

### CrdtMiniLcmApi.DeleteVariantType

method · +4 -0

```diff
@@ -447,0 +447,4 @@
+    public async Task DeleteVariantType(Guid id)
+    {
+        await AddChange(new DeleteChange<VariantType>(id));
+    }
```

## backend/FwLite/LcmCrdt/CrdtMiniLcmApi.cs

### VariantTests.Create_AlwaysAssignsNewEntityId — from backend/FwLite/LcmCrdt.Tests/MiniLcmTests/VariantTests.cs

method · +15 -0

```diff
@@ -19,0 +19,15 @@
+    [Fact]
+    public async Task Create_AlwaysAssignsNewEntityId()
+    {
+        // The caller's entity ID is never used. This matches FwData behavior (which ignores
+        // the ID entirely) and prevents Harmony duplicate-ID pitfalls during sync.
+        var input = Variant.FromEntries(
+            (await Api.GetEntry(_variantEntryId))!,
+            (await Api.GetEntry(_mainEntryId))!);
+        var providedId = input.Id;
+
+        var created = await Api.CreateVariant(input);
+
+        created.MaybeId.Should().NotBeNull();
+        created.Id.Should().NotBe(providedId);
+    }
```

### VariantTests.Create_ChangingProperty_ProducesNewEntityId — from backend/FwLite/LcmCrdt.Tests/MiniLcmTests/VariantTests.cs

method · +20 -0

```diff
@@ -35,0 +35,20 @@
+    [Fact]
+    public async Task Create_ChangingProperty_ProducesNewEntityId()
+    {
+        // When the sync diff detects a property change (e.g. MainEntryId), it does
+        // remove + add. The "add" reuses the same input object with the old entity ID.
+        var newMainEntry = await Api.CreateEntry(new()
+        {
+            LexemeForm = { { "en", "New Main" } }
+        });
+
+        var input = Variant.FromEntries(
+            (await Api.GetEntry(_variantEntryId))!,
+            (await Api.GetEntry(_mainEntryId))!);
+        var first = await Api.CreateVariant(input);
+
+        input.MainEntryId = newMainEntry.Id;
+        var second = await Api.CreateVariant(input);
+
+        second.Id.Should().NotBe(first.Id);
+    }
```

### CrdtMiniLcmApi.CreateVariant

method · +6 -0

```diff
@@ -489,0 +489,6 @@
+    public async Task<Variant> CreateVariant(Variant variant)
+    {
+        await SubmitCreateVariant(variant);
+        await using var repo = await repoFactory.CreateRepoAsync();
+        return await repo.FindVariant(variant) ?? throw NotFoundException.ForType<Variant>(variant.VariantEntryId);
+    }
```

### CrdtMiniLcmApi.SubmitCreateVariant

method · +11 -0

```diff
@@ -452,0 +452,11 @@
+    public async Task SubmitCreateVariant(Variant variant)
+    {
+        await using var repo = await repoFactory.CreateRepoAsync();
+        var existing = await repo.FindVariant(variant);
+        if (existing is not null) return;
+        // Always generate a new entity ID — the caller's ID is never used.
+        // This aligns with FwData (which ignores the ID entirely) and prevents
+        // Harmony duplicate-ID pitfalls during sync.
+        variant.Id = Guid.NewGuid();
+        await AddChange(await CreateVariantChange(repo, variant));
+    }
```

## backend/FwLite/LcmCrdt/CrdtMiniLcmApi.cs

### CrdtMiniLcmApi.UpdateVariant

method · +6 -0

```diff
@@ -496,0 +496,6 @@
+    public async Task<Variant> UpdateVariant(Variant before, Variant after, IMiniLcmApi? api = null)
+    {
+        await VariantSync.Sync(before, after, api ?? this);
+        await using var repo = await repoFactory.CreateRepoAsync();
+        return await repo.FindVariant(after) ?? throw NotFoundException.ForType<Variant>(after.VariantEntryId);
+    }
```

## backend/FwLite/LcmCrdt/CrdtMiniLcmApi.cs

### CrdtMiniLcmApi.SubmitUpdateVariant

method · +8 -0

```diff
@@ -503,0 +503,8 @@
+    public async Task SubmitUpdateVariant(Variant variant, UpdateObjectInput<Variant> update)
+    {
+        await using var repo = await repoFactory.CreateRepoAsync();
+        // resolved by composite key; a link deleted on the other side stays deleted (delete wins)
+        var existing = await repo.FindVariant(variant);
+        if (existing is null) return;
+        await AddChange(new JsonPatchChange<Variant>(existing.Id, update.Patch));
+    }
```

## backend/FwLite/LcmCrdt/CrdtMiniLcmApi.cs

### CrdtMiniLcmApi.DeleteVariant

method · +7 -0

```diff
@@ -512,0 +512,7 @@
+    public async Task DeleteVariant(Variant variant)
+    {
+        await using var repo = await repoFactory.CreateRepoAsync();
+        var existing = await repo.FindVariant(variant);
+        if (existing is null) return;
+        await AddChange(new DeleteChange<Variant>(existing.Id));
+    }
```

## backend/FwLite/LcmCrdt/CrdtMiniLcmApi.cs

### CrdtMiniLcmApi.AddVariantType

method · +7 -0

```diff
@@ -520,0 +520,7 @@
+    public async Task AddVariantType(Variant variant, Guid variantTypeId)
+    {
+        await using var repo = await repoFactory.CreateRepoAsync();
+        var existing = await repo.FindVariant(variant);
+        if (existing is null) return;
+        await AddChange(new AddVariantTypeChange(existing.Id, await repo.VariantTypes.SingleAsync(vt => vt.Id == variantTypeId)));
+    }
```

### AddVariantTypeChange — from backend/FwLite/LcmCrdt/Changes/Entries/AddVariantTypeChange.cs

other · +5 -0

```diff
@@ -7,0 +7,3 @@
+public class AddVariantTypeChange(Guid entityId, VariantType variantType)
+    : EditChange<Variant>(entityId), ISelfNamedType<AddVariantTypeChange>
+{
@@ -11,0 +11,1 @@
+
@@ -18,0 +18,1 @@
+}
```

## backend/FwLite/LcmCrdt/CrdtMiniLcmApi.cs

### CrdtMiniLcmApi.RemoveVariantType

method · +7 -0

```diff
@@ -528,0 +528,7 @@
+    public async Task RemoveVariantType(Variant variant, Guid variantTypeId)
+    {
+        await using var repo = await repoFactory.CreateRepoAsync();
+        var existing = await repo.FindVariant(variant);
+        if (existing is null) return;
+        await AddChange(new RemoveVariantTypeChange(existing.Id, variantTypeId));
+    }
```

### MiniLcmRepository.FindVariant — from backend/FwLite/LcmCrdt/Data/MiniLcmRepository.cs

method · +8 -0

```diff
@@ -123,0 +126,8 @@
+    public async Task<Variant?> FindVariant(Variant variant)
+    {
+        return await AsyncExtensions.SingleOrDefaultAsync(Variants,
+            v =>
+            v.VariantEntryId == variant.VariantEntryId
+            && v.MainEntryId == variant.MainEntryId
+            && v.MainSenseId == variant.MainSenseId);
+    }
```

## backend/FwLite/LcmCrdt/Changes/Entries/RemoveVariantTypeChange.cs

### RemoveVariantTypeChange

other · +3 -0

```diff
@@ -7,0 +7,2 @@
+public class RemoveVariantTypeChange(Guid entityId, Guid variantTypeId) : EditChange<Variant>(entityId), ISelfNamedType<RemoveVariantTypeChange>
+{
@@ -15,0 +15,1 @@
+}
```

## backend/FwLite/LcmCrdt/CrdtMiniLcmApi.cs

### CrdtMiniLcmApi.CreateEntryChanges

method · +12 -0

```diff
@@ -528,0 +658,12 @@
+        foreach (var variantOf in entry.VariantOf)
+        {
+            //only add variant links if the main entry was created already, otherwise it will be added when the main entry is created
+            if (!createdEntryIds.Contains(variantOf.MainEntryId)) continue;
+            yield return new AddVariantChange(variantOf);
+        }
+        foreach (var variant in entry.Variants)
+        {
+            //only add variant links if the variant entry was created already, otherwise it will be added when the variant entry is created
+            if (!createdEntryIds.Contains(variant.VariantEntryId)) continue;
+            yield return new AddVariantChange(variant);
+        }
```

## backend/FwLite/LcmCrdt/CrdtMiniLcmApi.cs

### CrdtMiniLcmApi.CreateEntry

method · +7 -0

```diff
@@ -604,0 +746,6 @@
+            ..options.IncludeComplexFormsAndComponents ?
+                await ToVariants(entry.VariantOf).ToArrayAsync() :
+                Enumerable.Empty<AddVariantChange>(),
+            ..options.IncludeComplexFormsAndComponents ?
+                await ToVariants(entry.Variants).ToArrayAsync() :
+                Enumerable.Empty<AddVariantChange>(),
@@ -813,0 +813,1 @@
+
```

### CrdtMiniLcmApi.CreateEntry.ToVariants

method · +14 -0

```diff
@@ -651,0 +799,14 @@
+        async IAsyncEnumerable<AddVariantChange> ToVariants(IList<Variant> variants)
+        {
+            foreach (var variant in variants)
+            {
+                if (variant.VariantEntryId == default) variant.VariantEntryId = entry.Id;
+                if (variant.MainEntryId == default) variant.MainEntryId = entry.Id;
+                if (variant.VariantEntryId == variant.MainEntryId)
+                {
+                    throw new InvalidOperationException($"Variant {variant} has the same variant entry id as its main entry");
+                }
+                if (variant.MaybeId is null) variant.Id = Guid.NewGuid();
+                yield return await CreateVariantChange(repo, variant);
+            }
+        }
```

### CrdtMiniLcmApi.CreateVariantChange

method · +24 -0

```diff
@@ -464,0 +464,24 @@
+    private static async Task<AddVariantChange> CreateVariantChange(MiniLcmRepository repo, Variant variant)
+    {
+        if (variant.MainSenseId is not null)
+        {
+            //a missing sense is tolerated (out-of-order sync; the change soft-deletes the link),
+            //but a sense that exists under a DIFFERENT entry is a bad request
+            var senseEntryId = await repo.Senses
+                .Where(s => s.Id == variant.MainSenseId.Value)
+                .Select(s => (Guid?)s.EntryId)
+                .FirstOrDefaultAsync();
+            if (senseEntryId is not null && senseEntryId != variant.MainEntryId)
+                throw new InvalidOperationException($"Sense {variant.MainSenseId} does not belong to entry {variant.MainEntryId}, it belongs to {senseEntryId}");
+        }
+        var typeIds = variant.Types.Select(t => t.Id).ToArray();
+        var resolvedTypes = await repo.VariantTypes.Where(t => typeIds.Contains(t.Id)).ToArrayAsync();
+        var missing = typeIds.Except(resolvedTypes.Select(t => t.Id)).ToArray();
+        if (missing.Length > 0)
+            throw new InvalidOperationException($"Variant {variant} references variant types which do not exist: {string.Join(", ", missing)}");
+        // use the repo's canonical type objects so embedded copies match CRDT state
+        return new AddVariantChange(variant with
+        {
+            Types = [..typeIds.Select(id => resolvedTypes.Single(t => t.Id == id))]
+        });
+    }
```

## backend/FwLite/LcmCrdt/Data/MiniLcmRepository.cs

### MiniLcmRepository.Variants

method · +1 -0

```diff
@@ -68,0 +69,1 @@
+    public IQueryable<Variant> Variants => dbContext.Variants;
```

## backend/FwLite/LcmCrdt/Data/MiniLcmRepository.cs

### MiniLcmRepository.VariantTypes

method · +1 -0

```diff
@@ -70,0 +70,1 @@
+    public IQueryable<VariantType> VariantTypes => dbContext.VariantTypes;
```

## backend/FwLite/LcmCrdt/Data/MiniLcmRepository.cs

### MiniLcmRepository

other · +1 -0 · low-signal (whitespace)

```diff
@@ -134,0 +134,1 @@
+
```

## backend/FwLite/LcmCrdt/Data/MiniLcmRepository.cs

### MiniLcmRepository.GetEntries

method · +4 -3

```diff
@@ -143,0 +155,2 @@
+            .LoadWith(e => e.VariantOf)
+            .LoadWith(e => e.Variants)
@@ -147,2 +160,1 @@
-        var complexFormComparer = cultureProvider.GetCompareInfo(await GetWritingSystem(default, WritingSystemType.Vernacular))
-            .AsComplexFormComparer();
+        var compareInfo = cultureProvider.GetCompareInfo(await GetWritingSystem(default, WritingSystemType.Vernacular));
@@ -153,1 +165,1 @@
-            entry.Finalize(complexFormComparer);
+            entry.Finalize(compareInfo);
```

## backend/FwLite/LcmCrdt/Data/MiniLcmRepository.cs

### MiniLcmRepository.GetEntry

method · +3 -3

```diff
@@ -250,0 +263,2 @@
+                .LoadWith(e => e.VariantOf)
+                .LoadWith(e => e.Variants)
@@ -255,3 +269,1 @@
-            var complexFormComparer = cultureProvider.GetCompareInfo(sortWs)
-                .AsComplexFormComparer();
-            entry.Finalize(complexFormComparer);
+            entry.Finalize(cultureProvider.GetCompareInfo(sortWs));
```

## backend/FwLite/LcmCrdt/LcmCrdtDbContext.cs

### LcmCrdtDbContext.Variants

method · +1 -0

```diff
@@ -23,0 +24,1 @@
+    public IQueryable<Variant> Variants => Set<Variant>().AsNoTracking();
```

## backend/FwLite/LcmCrdt/LcmCrdtDbContext.cs

### LcmCrdtDbContext.VariantTypes

method · +1 -0

```diff
@@ -25,0 +25,1 @@
+    public IQueryable<VariantType> VariantTypes => Set<VariantType>().AsNoTracking();
```

## backend/FwLite/LcmCrdt/LcmCrdtKernel.cs

### lines 1–6 — from backend/FwLite/LcmCrdt.Tests/Changes/VariantChangeTests.cs

other · +5 -0

```diff
@@ -0,0 +1,4 @@
+using LcmCrdt.Changes.Entries;
+using MiniLcm.Models;
+using SIL.Harmony.Changes;
+
@@ -6,0 +6,1 @@
+
```

### LcmCrdt.Tests.MiniLcmTests — from backend/FwLite/LcmCrdt.Tests/MiniLcmTests/VariantTests.cs

other · +1 -0

```diff
@@ -0,0 +1,1 @@
+namespace LcmCrdt.Tests.MiniLcmTests;
```

### SnapshotAtCommitServiceTests.AssertSnapshotsAreEquivalentEqual — from backend/FwLite/LcmCrdt.Tests/SnapshotAtCommitServiceTests.cs

method · +1 -0

```diff
@@ -28,0 +29,1 @@
+            .WithoutStrictOrderingFor(x => x.VariantTypes)
```

### LcmCrdtKernel.ConfigureDbOptions

method · +5 -0

```diff
@@ -146,0 +147,5 @@
+                    .Entity<Variant>().Association(v => EntryQueryHelpers.QueryVariantEntry(v), v => v.VariantEntryId, e => e!.Id)
+                    .Entity<Variant>().Association(v => EntryQueryHelpers.QueryMainEntry(v), v => v.MainEntryId, e => e!.Id)
+                    .Entity<Variant>().Association(v => EntryQueryHelpers.QueryMainSense(v), v => v.MainSenseId, s => s!.Id)
+                    .Entity<Variant>().Property(v => v.VariantHeadword).IsExpression(v => EntryQueryHelpers.QueryVariantEntry(v)!.QueryHeadwordWithTokens(EntryQueryHelpers.DefaultWritingSystem(WritingSystemType.Vernacular)), isColumn: true, alias: "variantHeadword")
+                    .Entity<Variant>().Property(v => v.MainHeadword).IsExpression(v => EntryQueryHelpers.QueryMainEntry(v)!.QueryHeadwordWithTokens(EntryQueryHelpers.DefaultWritingSystem(WritingSystemType.Vernacular)), isColumn: true, alias: "mainHeadword")
```

### EntryQueryHelpers.QueryVariantEntry — from backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs

method · +1 -0

```diff
@@ -44,0 +45,1 @@
+    public static Entry? QueryVariantEntry(Variant v) => throw new NotSupportedException();
```

## backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs

### EntryQueryHelpers.QueryMainEntry

method · +1 -0

```diff
@@ -46,0 +46,1 @@
+    public static Entry? QueryMainEntry(Variant v) => throw new NotSupportedException();
```

## backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs

### EntryQueryHelpers.QueryMainSense

method · +1 -0

```diff
@@ -47,0 +47,1 @@
+    public static Sense? QueryMainSense(Variant v) => throw new NotSupportedException();
```

## backend/FwLite/LcmCrdt/LcmCrdtKernel.cs

### LcmCrdtKernel.ConfigureCrdt.fragment 1

method-fragment · +40 -0

```diff
@@ -201,0 +207,10 @@
+                builder.HasMany(e => e.VariantOf)
+                    .WithOne()
+                    .HasPrincipalKey(entry => entry.Id)
+                    .HasForeignKey(v => v.VariantEntryId)
+                    .OnDelete(DeleteBehavior.Cascade);
+                builder.HasMany(e => e.Variants)
+                    .WithOne()
+                    .HasPrincipalKey(entry => entry.Id)
+                    .HasForeignKey(v => v.MainEntryId)
+                    .OnDelete(DeleteBehavior.Cascade);
@@ -220,0 +236,4 @@
+                builder.HasMany<Variant>()
+                    .WithOne()
+                    .HasForeignKey(v => v.MainSenseId)
+                    .OnDelete(DeleteBehavior.Cascade);
@@ -308,0 +328,26 @@
+            })
+            .Add<VariantType>()
+            .Add<Variant>(builder =>
+            {
+                const string mainSenseId = "MainSenseId";
+                builder.ToTable("Variants");
+                builder.Property(v => v.MainSenseId).HasColumnName(mainSenseId);
+                builder
+                    .Property(v => v.Types)
+                    .HasColumnType("jsonb")
+                    .HasConversion(list => JsonSerializer.Serialize(list, (JsonSerializerOptions?)null),
+                        json => JsonSerializer.Deserialize<List<VariantType>>(json,
+                            (JsonSerializerOptions?)null) ?? new());
+                //these indexes are used to ensure that we don't create duplicate variant links
+                //we need the filter otherwise 2 links which are the same and have a null sense id can be created because 2 rows with the same null are not considered duplicates
+                builder.HasIndex(variant => new
+                {
+                    variant.VariantEntryId,
+                    variant.MainEntryId,
+                    variant.MainSenseId
+                }).IsUnique().HasFilter($"{mainSenseId} IS NOT NULL");
+                builder.HasIndex(variant => new
+                {
+                    variant.VariantEntryId,
+                    variant.MainEntryId
+                }).IsUnique().HasFilter($"{mainSenseId} IS NULL");
```

## backend/FwLite/LcmCrdt/LcmCrdtKernel.cs

### LcmCrdtKernel.ConfigureCrdt.fragment 2

method-fragment · +8 -0

```diff
@@ -318,0 +364,2 @@
+            .Add<JsonPatchChange<VariantType>>()
+            .Add<JsonPatchChange<Variant>>()
@@ -327,0 +375,2 @@
+            .Add<DeleteChange<VariantType>>()
+            .Add<DeleteChange<Variant>>()
@@ -363,0 +413,4 @@
+            .Add<AddVariantChange>()
+            .Add<AddVariantTypeChange>()
+            .Add<RemoveVariantTypeChange>()
+            .Add<CreateVariantType>()
```

## backend/FwLite/LcmCrdt/Migrations/20260703134525_AddVariants.cs

### lines 1–5

other · +5 -0

```diff
@@ -0,0 +1,5 @@
+﻿using System;
+using Microsoft.EntityFrameworkCore.Migrations;
+
+#nullable disable
+
```

## backend/FwLite/LcmCrdt/Migrations/20260703134525_AddVariants.cs

### LcmCrdt.Migrations

other · +4 -0

```diff
@@ -6,0 +6,3 @@
+namespace LcmCrdt.Migrations
+{
+    /// <inheritdoc />
@@ -126,0 +126,1 @@
+}
```

## backend/FwLite/LcmCrdt/Migrations/20260703134525_AddVariants.cs

### LcmCrdt.Migrations.AddVariants

other · +6 -0

```diff
@@ -9,0 +9,3 @@
+    public partial class AddVariants : Migration
+    {
+        /// <inheritdoc />
@@ -115,0 +115,2 @@
+
+        /// <inheritdoc />
@@ -125,0 +125,1 @@
+    }
```

## backend/FwLite/LcmCrdt/Migrations/20260703134525_AddVariants.cs

### LcmCrdt.Migrations.AddVariants.Up.fragment 1

method-fragment · +39 -0

```diff
@@ -12,0 +12,39 @@
+        protected override void Up(MigrationBuilder migrationBuilder)
+        {
+            migrationBuilder.CreateTable(
+                name: "Variants",
+                columns: table => new
+                {
+                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
+                    DeletedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: true),
+                    VariantEntryId = table.Column<Guid>(type: "TEXT", nullable: false),
+                    VariantHeadword = table.Column<string>(type: "TEXT", nullable: true),
+                    MainEntryId = table.Column<Guid>(type: "TEXT", nullable: false),
+                    MainSenseId = table.Column<Guid>(type: "TEXT", nullable: true),
+                    MainHeadword = table.Column<string>(type: "TEXT", nullable: true),
+                    Types = table.Column<string>(type: "jsonb", nullable: false),
+                    HideMinorEntry = table.Column<bool>(type: "INTEGER", nullable: false),
+                    Comment = table.Column<string>(type: "jsonb", nullable: false),
+                    SnapshotId = table.Column<Guid>(type: "TEXT", nullable: true)
+                },
+                constraints: table =>
+                {
+                    table.PrimaryKey("PK_Variants", x => x.Id);
+                    table.ForeignKey(
+                        name: "FK_Variants_Entry_MainEntryId",
+                        column: x => x.MainEntryId,
+                        principalTable: "Entry",
+                        principalColumn: "Id",
+                        onDelete: ReferentialAction.Cascade);
+                    table.ForeignKey(
+                        name: "FK_Variants_Entry_VariantEntryId",
+                        column: x => x.VariantEntryId,
+                        principalTable: "Entry",
+                        principalColumn: "Id",
+                        onDelete: ReferentialAction.Cascade);
+                    table.ForeignKey(
+                        name: "FK_Variants_Sense_MainSenseId",
+                        column: x => x.MainSenseId,
+                        principalTable: "Sense",
+                        principalColumn: "Id",
+                        onDelete: ReferentialAction.Cascade);
```

## backend/FwLite/LcmCrdt/Migrations/20260703134525_AddVariants.cs

### LcmCrdt.Migrations.AddVariants.Up.fragment 2

method-fragment · +38 -0

```diff
@@ -51,0 +51,38 @@
+                    table.ForeignKey(
+                        name: "FK_Variants_Snapshots_SnapshotId",
+                        column: x => x.SnapshotId,
+                        principalTable: "Snapshots",
+                        principalColumn: "Id",
+                        onDelete: ReferentialAction.SetNull);
+                });
+
+            migrationBuilder.CreateTable(
+                name: "VariantType",
+                columns: table => new
+                {
+                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
+                    Name = table.Column<string>(type: "jsonb", nullable: false),
+                    DeletedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: true),
+                    SnapshotId = table.Column<Guid>(type: "TEXT", nullable: true)
+                },
+                constraints: table =>
+                {
+                    table.PrimaryKey("PK_VariantType", x => x.Id);
+                    table.ForeignKey(
+                        name: "FK_VariantType_Snapshots_SnapshotId",
+                        column: x => x.SnapshotId,
+                        principalTable: "Snapshots",
+                        principalColumn: "Id",
+                        onDelete: ReferentialAction.SetNull);
+                });
+
+            migrationBuilder.CreateIndex(
+                name: "IX_Variants_MainEntryId",
+                table: "Variants",
+                column: "MainEntryId");
+
+            migrationBuilder.CreateIndex(
+                name: "IX_Variants_MainSenseId",
+                table: "Variants",
+                column: "MainSenseId");
+
```

## backend/FwLite/LcmCrdt/Migrations/20260703134525_AddVariants.cs

### LcmCrdt.Migrations.AddVariants.Up.fragment 3

method-fragment · +26 -0

```diff
@@ -89,0 +89,26 @@
+            migrationBuilder.CreateIndex(
+                name: "IX_Variants_SnapshotId",
+                table: "Variants",
+                column: "SnapshotId",
+                unique: true);
+
+            migrationBuilder.CreateIndex(
+                name: "IX_Variants_VariantEntryId_MainEntryId",
+                table: "Variants",
+                columns: new[] { "VariantEntryId", "MainEntryId" },
+                unique: true,
+                filter: "MainSenseId IS NULL");
+
+            migrationBuilder.CreateIndex(
+                name: "IX_Variants_VariantEntryId_MainEntryId_MainSenseId",
+                table: "Variants",
+                columns: new[] { "VariantEntryId", "MainEntryId", "MainSenseId" },
+                unique: true,
+                filter: "MainSenseId IS NOT NULL");
+
+            migrationBuilder.CreateIndex(
+                name: "IX_VariantType_SnapshotId",
+                table: "VariantType",
+                column: "SnapshotId",
+                unique: true);
+        }
```

## backend/FwLite/LcmCrdt/Migrations/20260703134525_AddVariants.cs

### LcmCrdt.Migrations.AddVariants.Down

method · +8 -0

```diff
@@ -117,0 +117,8 @@
+        protected override void Down(MigrationBuilder migrationBuilder)
+        {
+            migrationBuilder.DropTable(
+                name: "Variants");
+
+            migrationBuilder.DropTable(
+                name: "VariantType");
+        }
```

## backend/FwLite/LcmCrdt/QueryHelpers.cs

### QueryHelpers.Finalize

method · +4 -3

```diff
@@ -7,2 +7,1 @@
-    public static void Finalize(this Entry entry,
-        IComparer<ComplexFormComponent> complexFormComparer)
+    public static void Finalize(this Entry entry, CompareInfo compareInfo)
@@ -12,1 +11,3 @@
-        entry.ComplexForms.Sort(complexFormComparer);
+        entry.ComplexForms.Sort(compareInfo.AsComplexFormComparer());
+        entry.VariantOf.Sort(Variant.VariantOfOrder);
+        entry.Variants.Sort(Variant.VariantsOrder);
```

## backend/FwLite/LcmCrdt/QueryHelpers.cs

### QueryHelpers

other · +1 -0 · low-signal (whitespace)

```diff
@@ -57,0 +59,1 @@
+
```

## backend/FwLite/MiniLcm.Tests/AutoFakerHelpers/EntryFakerHelper.cs

### EntryFakerHelper.EntryReadyForCreation

method · +3 -2

```diff
@@ -13,1 +13,2 @@
-        bool createPublications = true)
+        bool createPublications = true,
+        bool createVariants = true)
@@ -17,1 +18,1 @@
-        await PrepareToCreateEntry(api, entry, createComplexForms, createComplexFormTypes, createComponents, createPublications);
+        await PrepareToCreateEntry(api, entry, createComplexForms, createComplexFormTypes, createComponents, createPublications, createVariants);
```

## backend/FwLite/MiniLcm.Tests/AutoFakerHelpers/EntryFakerHelper.cs

### EntryFakerHelper.PrepareToCreateEntry

method · +12 -1

```diff
@@ -30,1 +31,2 @@
-        bool createPublications = true)
+        bool createPublications = true,
+        bool createVariants = true)
@@ -35,0 +38,10 @@
+        if (createVariants)
+        {
+            await CreateVariantLinkEntry(entry, isVariantOf: true, entry.VariantOf, api);
+            await CreateVariantLinkEntry(entry, isVariantOf: false, entry.Variants, api);
+        }
+        else
+        {
+            entry.VariantOf.Clear();
+            entry.Variants.Clear();
+        }
```

### EntryFakerHelper.CreateVariantLinkEntry.fragment 1

method-fragment · +40 -0

```diff
@@ -132,0 +145,40 @@
+    private static async Task CreateVariantLinkEntry(Entry entry,
+        bool isVariantOf,
+        IList<Variant> variants,
+        IMiniLcmApi api)
+    {
+        int i = 1;
+        foreach (var variant in variants)
+        {
+            //generated entries won't have the expected ids, so fix them up here
+            if (isVariantOf)
+            {
+                variant.VariantEntryId = entry.Id;
+            }
+            else
+            {
+                variant.MainEntryId = entry.Id;
+            }
+            //generated sense ids don't reference real senses; targeting the entry is enough here
+            variant.MainSenseId = null;
+
+            foreach (var variantType in variant.Types)
+            {
+                if (await api.GetVariantType(variantType.Id) is null)
+                    await api.CreateVariantType(variantType);
+            }
+
+            var name = $"test {(isVariantOf ? "main" : "variant")} entry {i}";
+            var createdEntry = await api.CreateEntry(new()
+            {
+                Id = isVariantOf ? variant.MainEntryId : variant.VariantEntryId,
+                LexemeForm = { { "en", name } },
+            });
+            if (isVariantOf)
+            {
+                variant.MainHeadword = createdEntry.Headword();
+                variant.VariantHeadword = entry.Headword();
+            }
+            else
+            {
+                variant.VariantHeadword = createdEntry.Headword();
```

### IMiniLcmReadApi.GetVariantType — from backend/FwLite/MiniLcm/IMiniLcmReadApi.cs

method · +1 -0

```diff
@@ -19,0 +21,1 @@
+    Task<VariantType?> GetVariantType(Guid id);
```

## backend/FwLite/MiniLcm.Tests/AutoFakerHelpers/EntryFakerHelper.cs

### EntryFakerHelper.CreateVariantLinkEntry.fragment 2

method-fragment · +5 -0

```diff
@@ -185,0 +185,5 @@
+                variant.MainHeadword = entry.Headword();
+            }
+            i++;
+        }
+    }
```

## backend/FwLite/MiniLcm.Tests/AutoFakerHelpers/EntryFakerHelper.cs

### EntryFakerHelper

other · +1 -0 · low-signal (whitespace)

```diff
@@ -190,0 +190,1 @@
+
```

## backend/FwLite/MiniLcm.Tests/FluentAssertGlobalConfig.cs

### FluentAssertGlobalConfig.Initialize

method · +1 -1

```diff
@@ -17,1 +17,1 @@
-            .Excluding(m => (m.DeclaringType == typeof(ComplexFormComponent) || m.DeclaringType == typeof(WritingSystem))
+            .Excluding(m => (m.DeclaringType == typeof(ComplexFormComponent) || m.DeclaringType == typeof(Variant) || m.DeclaringType == typeof(WritingSystem))
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### lines 1–4

other · +3 -0

```diff
@@ -0,0 +1,2 @@
+using MiniLcm.Models;
+
@@ -4,0 +4,1 @@
+
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### MiniLcm.Tests

other · +1 -0

```diff
@@ -3,0 +3,1 @@
+namespace MiniLcm.Tests;
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase

other · +39 -0

```diff
@@ -5,0 +5,9 @@
+public abstract class VariantTestsBase : MiniLcmTestBase
+{
+    protected readonly Guid _mainEntryId = Guid.NewGuid();
+    protected readonly Guid _variantEntryId = Guid.NewGuid();
+    protected readonly Guid _mainSenseId1 = Guid.NewGuid();
+    protected readonly Guid _mainSenseId2 = Guid.NewGuid();
+    protected Entry _mainEntry = null!;
+    protected Entry _variantEntry = null!;
+
@@ -42,0 +42,1 @@
+
@@ -47,0 +47,1 @@
+
@@ -61,0 +61,1 @@
+
@@ -72,0 +72,1 @@
+
@@ -97,0 +97,1 @@
+
@@ -116,0 +116,1 @@
+
@@ -128,0 +128,1 @@
+
@@ -139,0 +139,1 @@
+
@@ -149,0 +149,1 @@
+
@@ -158,0 +158,1 @@
+
@@ -167,0 +167,1 @@
+
@@ -177,0 +177,1 @@
+
@@ -192,0 +192,1 @@
+
@@ -215,0 +215,1 @@
+
@@ -222,0 +222,1 @@
+
@@ -235,0 +235,1 @@
+
@@ -251,0 +251,1 @@
+
@@ -261,0 +261,1 @@
+
@@ -275,0 +275,1 @@
+
@@ -284,0 +284,1 @@
+
@@ -293,0 +293,1 @@
+
@@ -312,0 +312,1 @@
+
@@ -322,0 +322,1 @@
+
@@ -333,0 +333,1 @@
+
@@ -343,0 +343,1 @@
+
@@ -350,0 +350,1 @@
+
@@ -359,0 +359,1 @@
+
@@ -368,0 +368,1 @@
+
@@ -378,0 +378,1 @@
+
@@ -394,0 +394,1 @@
+}
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.InitializeAsync

method · +28 -0

```diff
@@ -14,0 +14,28 @@
+    public override async Task InitializeAsync()
+    {
+        await base.InitializeAsync();
+        _mainEntry = await Api.CreateEntry(new()
+        {
+            Id = _mainEntryId,
+            LexemeForm = { { "en", "main entry" } },
+            Senses =
+            [
+                new Sense
+                {
+                    Id = _mainSenseId1,
+                    Gloss = { { "en", "main sense 1" } }
+                },
+                new Sense
+                {
+                    Id = _mainSenseId2,
+                    Gloss = { { "en", "main sense 2" } }
+                }
+            ]
+        });
+        // deliberately sense-less: FLEx's "Insert Variant" creates variant entries without senses
+        _variantEntry = await Api.CreateEntry(new()
+        {
+            Id = _variantEntryId,
+            LexemeForm = { { "en", "variant form" } }
+        });
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.CreateVariantType

method · +4 -0

```diff
@@ -43,0 +43,4 @@
+    private async Task<VariantType> CreateVariantType(string name = "test type")
+    {
+        return await Api.CreateVariantType(new VariantType { Id = Guid.NewGuid(), Name = new() { { "en", name } } });
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.CreateVariant_Works

method · +13 -0

```diff
@@ -48,0 +48,13 @@
+    [Fact]
+    public async Task CreateVariant_Works()
+    {
+        var variant = await Api.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry));
+        variant.VariantEntryId.Should().Be(_variantEntryId);
+        variant.MainEntryId.Should().Be(_mainEntryId);
+        variant.MainSenseId.Should().BeNull();
+        variant.VariantHeadword.Should().Be("variant form");
+        variant.MainHeadword.Should().Be("main entry");
+        variant.Types.Should().BeEmpty();
+        variant.HideMinorEntry.Should().BeFalse();
+        variant.Comment.Should().BeEmpty();
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.CreateVariant_WithSense_Works

method · +10 -0

```diff
@@ -62,0 +62,10 @@
+    [Fact]
+    public async Task CreateVariant_WithSense_Works()
+    {
+        var variant = await Api.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry, _mainSenseId1));
+        variant.MainSenseId.Should().Be(_mainSenseId1);
+
+        // a sense-targeted link still surfaces under the owning entry's Variants
+        var mainEntry = await Api.GetEntry(_mainEntryId);
+        mainEntry!.Variants.Should().ContainSingle(v => v.VariantEntryId == _variantEntryId && v.MainSenseId == _mainSenseId1);
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.CreateVariant_WithTypesCommentAndHideMinorEntry_RoundTrips

method · +24 -0

```diff
@@ -73,0 +73,24 @@
+    [Fact]
+    public async Task CreateVariant_WithTypesCommentAndHideMinorEntry_RoundTrips()
+    {
+        var type = await CreateVariantType();
+        var input = Variant.FromEntries(_variantEntry, _mainEntry) with
+        {
+            Types = [type],
+            HideMinorEntry = true,
+            Comment = new() { { "en", new RichString("originally meant something else") } },
+        };
+        await Api.CreateVariant(input);
+
+        var variantEntry = await Api.GetEntry(_variantEntryId);
+        var link = variantEntry!.VariantOf.Should().ContainSingle().Subject;
+        link.Types.Should().ContainSingle(t => t.Id == type.Id);
+        link.HideMinorEntry.Should().BeTrue();
+        link.Comment["en"].GetPlainText().Should().Be("originally meant something else");
+
+        var mainEntry = await Api.GetEntry(_mainEntryId);
+        var backLink = mainEntry!.Variants.Should().ContainSingle().Subject;
+        backLink.Types.Should().ContainSingle(t => t.Id == type.Id);
+        backLink.HideMinorEntry.Should().BeTrue();
+        backLink.Comment["en"].GetPlainText().Should().Be("originally meant something else");
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.VariantHeadwords_UpdateWhenReferencedEntriesChange

method · +18 -0

```diff
@@ -98,0 +98,18 @@
+    [Fact]
+    public async Task VariantHeadwords_UpdateWhenReferencedEntriesChange()
+    {
+        await Api.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry));
+
+        var beforeVariant = _variantEntry.Copy();
+        _variantEntry.LexemeForm["en"] = "renamed variant";
+        await Api.UpdateEntry(beforeVariant, _variantEntry);
+
+        var mainEntry = (await Api.GetEntry(_mainEntryId))!;
+        var beforeMain = mainEntry.Copy();
+        mainEntry.LexemeForm["en"] = "renamed main";
+        await Api.UpdateEntry(beforeMain, mainEntry);
+
+        var link = (await Api.GetEntry(_mainEntryId))!.Variants.Should().ContainSingle().Subject;
+        link.VariantHeadword.Should().Be("renamed variant");
+        link.MainHeadword.Should().Be("renamed main");
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.DeleteVariant_Works

method · +11 -0

```diff
@@ -117,0 +117,11 @@
+    [Fact]
+    public async Task DeleteVariant_Works()
+    {
+        var variant = await Api.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry));
+        await Api.DeleteVariant(variant);
+        var entries = await Api.GetEntries().ToArrayAsync();
+        var variantEntry = entries.Should().ContainSingle(e => e.Id == _variantEntryId).Subject;
+        var mainEntry = entries.Should().ContainSingle(e => e.Id == _mainEntryId).Subject;
+        variantEntry.VariantOf.Should().BeEmpty();
+        mainEntry.Variants.Should().BeEmpty();
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.GetEntries_Works

method · +10 -0

```diff
@@ -129,0 +129,10 @@
+    [Fact]
+    public async Task GetEntries_Works()
+    {
+        await Api.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry));
+        var entries = await Api.GetEntries().ToArrayAsync();
+        var variantEntry = entries.Should().ContainSingle(e => e.Id == _variantEntryId).Subject;
+        var mainEntry = entries.Should().ContainSingle(e => e.Id == _mainEntryId).Subject;
+        variantEntry.VariantOf.Should().ContainSingle(v => v.MainEntryId == _mainEntryId);
+        mainEntry.Variants.Should().ContainSingle(v => v.VariantEntryId == _variantEntryId);
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.VariantEntryWithoutSenses_RoundTrips

method · +9 -0

```diff
@@ -140,0 +140,9 @@
+    [Fact]
+    public async Task VariantEntryWithoutSenses_RoundTrips()
+    {
+        await Api.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry));
+        var variantEntry = await Api.GetEntry(_variantEntryId);
+        variantEntry.Should().NotBeNull();
+        variantEntry!.Senses.Should().BeEmpty();
+        variantEntry.VariantOf.Should().ContainSingle();
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.CreateVariant_UsingTheSameLinkDoesNothing

method · +8 -0

```diff
@@ -150,0 +150,8 @@
+    [Fact]
+    public async Task CreateVariant_UsingTheSameLinkDoesNothing()
+    {
+        var variant1 = await Api.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry));
+        var variant2 = await Api.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry));
+        variant2.Should().BeEquivalentTo(variant1);
+        (await Api.GetEntry(_variantEntryId))!.VariantOf.Should().ContainSingle();
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.CreateVariant_UsingTheSameLinkWithSenseDoesNothing

method · +8 -0

```diff
@@ -159,0 +159,8 @@
+    [Fact]
+    public async Task CreateVariant_UsingTheSameLinkWithSenseDoesNothing()
+    {
+        var variant1 = await Api.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry, _mainSenseId1));
+        var variant2 = await Api.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry, _mainSenseId1));
+        variant2.Should().BeEquivalentTo(variant1);
+        (await Api.GetEntry(_variantEntryId))!.VariantOf.Should().ContainSingle();
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.CreateVariant_ReplayingReturnedObject_IsIdempotent

method · +9 -0

```diff
@@ -168,0 +168,9 @@
+    [Fact]
+    public async Task CreateVariant_ReplayingReturnedObject_IsIdempotent()
+    {
+        // Sync can be interrupted and replayed, so the exact same object (including its
+        // internal entity ID) may be passed to CreateVariant again.
+        var created = await Api.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry));
+        var again = await Api.CreateVariant(created);
+        again.Should().BeEquivalentTo(created);
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.CreateVariant_CanTargetMultipleSensesOfSameEntry

method · +14 -0

```diff
@@ -178,0 +178,14 @@
+    [Fact]
+    public async Task CreateVariant_CanTargetMultipleSensesOfSameEntry()
+    {
+        var variant1 = await Api.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry, _mainSenseId1));
+        variant1.MainSenseId.Should().Be(_mainSenseId1);
+        var variant2 = await Api.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry, _mainSenseId2));
+        variant2.MainSenseId.Should().Be(_mainSenseId2);
+
+        // ensure our sync code can handle them too
+        _variantEntry = (await Api.GetEntry(_variantEntryId))!;
+        await Api.UpdateEntry(_variantEntry, _variantEntry);
+        _mainEntry = (await Api.GetEntry(_mainEntryId))!;
+        await Api.UpdateEntry(_mainEntry, _mainEntry);
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.CreateVariant_ChangingPropertyAndCreatingAgain_CreatesBoth

method · +22 -0

```diff
@@ -193,0 +193,22 @@
+    [Fact]
+    public async Task CreateVariant_ChangingPropertyAndCreatingAgain_CreatesBoth()
+    {
+        var newMainEntry = await Api.CreateEntry(new()
+        {
+            Id = Guid.NewGuid(),
+            LexemeForm = { { "en", "new main" } }
+        });
+
+        var input = Variant.FromEntries(_variantEntry, _mainEntry);
+        var first = await Api.CreateVariant(input);
+        first.MainEntryId.Should().Be(_mainEntryId);
+
+        // Mutate a property on the same object and create again.
+        // The sync diff does this when a property changes (remove + add).
+        input.MainEntryId = newMainEntry.Id;
+        var second = await Api.CreateVariant(input);
+        second.MainEntryId.Should().Be(newMainEntry.Id);
+
+        var entry = await Api.GetEntry(_variantEntryId);
+        entry!.VariantOf.Should().HaveCount(2);
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.CreateVariant_ThrowsOnSelfReference

method · +6 -0

```diff
@@ -216,0 +216,6 @@
+    [Fact]
+    public async Task CreateVariant_ThrowsOnSelfReference()
+    {
+        var act = async () => await Api.CreateVariant(Variant.FromEntries(_mainEntry, _mainEntry));
+        await act.Should().ThrowAsync<Exception>();
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.CreateVariant_ThrowsWhenSenseBelongsToADifferentEntry

method · +12 -0

```diff
@@ -223,0 +223,12 @@
+    [Fact]
+    public async Task CreateVariant_ThrowsWhenSenseBelongsToADifferentEntry()
+    {
+        var otherEntry = await Api.CreateEntry(new()
+        {
+            Id = Guid.NewGuid(),
+            LexemeForm = { { "en", "other entry" } }
+        });
+        //_mainSenseId1 belongs to _mainEntry, not otherEntry
+        var act = async () => await Api.CreateVariant(Variant.FromEntries(_variantEntry, otherEntry, _mainSenseId1));
+        await act.Should().ThrowAsync<Exception>();
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.CreateVariant_AllowsChains

method · +15 -0

```diff
@@ -236,0 +236,15 @@
+    [Fact]
+    public async Task CreateVariant_AllowsChains()
+    {
+        // FLEx allows variant chains (a variant of a variant); we must too
+        var entry3 = await Api.CreateEntry(new()
+        {
+            Id = Guid.NewGuid(),
+            LexemeForm = { { "en", "entry3" } }
+        });
+        await Api.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry));
+        await Api.CreateVariant(Variant.FromEntries(entry3, _variantEntry));
+        var middle = await Api.GetEntry(_variantEntryId);
+        middle!.VariantOf.Should().ContainSingle(v => v.MainEntryId == _mainEntryId);
+        middle.Variants.Should().ContainSingle(v => v.VariantEntryId == entry3.Id);
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.CreateVariant_ThrowsWhenMakingA2LayerReferenceCycle

method · +9 -0

```diff
@@ -252,0 +252,9 @@
+    [Fact]
+    public async Task CreateVariant_ThrowsWhenMakingA2LayerReferenceCycle()
+    {
+        // LCM rejects circular component references (LexEntryRef.ValidateAddObjectInternal),
+        // so both implementations must too
+        await Api.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry));
+        var act = async () => await Api.CreateVariant(Variant.FromEntries(_mainEntry, _variantEntry));
+        await act.Should().ThrowAsync<Exception>();
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.CreateVariant_ThrowsWhenMakingA3LayerReferenceCycle

method · +13 -0

```diff
@@ -262,0 +262,13 @@
+    [Fact]
+    public async Task CreateVariant_ThrowsWhenMakingA3LayerReferenceCycle()
+    {
+        var entry3 = await Api.CreateEntry(new()
+        {
+            Id = Guid.NewGuid(),
+            LexemeForm = { { "en", "entry3" } }
+        });
+        await Api.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry));
+        await Api.CreateVariant(Variant.FromEntries(_mainEntry, entry3));
+        var act = async () => await Api.CreateVariant(Variant.FromEntries(entry3, _variantEntry));
+        await act.Should().ThrowAsync<Exception>();
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.CreateVariant_ThrowsWhenClosingAMixedCycleThroughAComplexForm

method · +8 -0

```diff
@@ -276,0 +276,8 @@
+    [Fact]
+    public async Task CreateVariant_ThrowsWhenClosingAMixedCycleThroughAComplexForm()
+    {
+        // LCM's cycle check spans the combined complex-form + variant component graph
+        await Api.CreateComplexFormComponent(ComplexFormComponent.FromEntries(_mainEntry, _variantEntry));
+        var act = async () => await Api.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry));
+        await act.Should().ThrowAsync<Exception>();
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.CreateVariant_WorksWhenALinkWasDeletedWhichWouldCauseACycle

method · +8 -0

```diff
@@ -285,0 +285,8 @@
+    [Fact]
+    public async Task CreateVariant_WorksWhenALinkWasDeletedWhichWouldCauseACycle()
+    {
+        var created = await Api.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry));
+        await Api.DeleteVariant(created);
+        var act = async () => await Api.CreateVariant(Variant.FromEntries(_mainEntry, _variantEntry));
+        await act.Should().NotThrowAsync("a link was deleted which was part of the cycle");
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.UpdateVariant_SyncsTypesAndScalars

method · +18 -0

```diff
@@ -294,0 +294,18 @@
+    [Fact]
+    public async Task UpdateVariant_SyncsTypesAndScalars()
+    {
+        var typeA = await CreateVariantType("type a");
+        var typeB = await CreateVariantType("type b");
+        var created = await Api.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry) with { Types = [typeA] });
+
+        var after = created.Copy();
+        after.Types = [typeB];
+        after.HideMinorEntry = true;
+        after.Comment = new() { { "en", new RichString("now hidden") } };
+        await Api.UpdateVariant(created, after);
+
+        var link = (await Api.GetEntry(_variantEntryId))!.VariantOf.Should().ContainSingle().Subject;
+        link.Types.Should().ContainSingle(t => t.Id == typeB.Id);
+        link.HideMinorEntry.Should().BeTrue();
+        link.Comment["en"].GetPlainText().Should().Be("now hidden");
+    }
```

### IMiniLcmWriteApi.UpdateVariant — from backend/FwLite/MiniLcm/IMiniLcmWriteApi.cs

method · +1 -0

```diff
@@ -78,0 +78,1 @@
+    Task<Variant> UpdateVariant(Variant before, Variant after, IMiniLcmApi? api = null);
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.AddVariantType_Works

method · +9 -0

```diff
@@ -313,0 +313,9 @@
+    [Fact]
+    public async Task AddVariantType_Works()
+    {
+        var type = await CreateVariantType();
+        var variant = await Api.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry));
+        await Api.AddVariantType(variant, type.Id);
+        var link = (await Api.GetEntry(_variantEntryId))!.VariantOf.Should().ContainSingle().Subject;
+        link.Types.Should().ContainSingle(t => t.Id == type.Id);
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.AddVariantType_IsIdempotent

method · +10 -0

```diff
@@ -323,0 +323,10 @@
+    [Fact]
+    public async Task AddVariantType_IsIdempotent()
+    {
+        var type = await CreateVariantType();
+        var variant = await Api.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry));
+        await Api.AddVariantType(variant, type.Id);
+        await Api.AddVariantType(variant, type.Id);
+        var link = (await Api.GetEntry(_variantEntryId))!.VariantOf.Should().ContainSingle().Subject;
+        link.Types.Should().ContainSingle(t => t.Id == type.Id);
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.RemoveVariantType_Works

method · +9 -0

```diff
@@ -334,0 +334,9 @@
+    [Fact]
+    public async Task RemoveVariantType_Works()
+    {
+        var type = await CreateVariantType();
+        var variant = await Api.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry) with { Types = [type] });
+        await Api.RemoveVariantType(variant, type.Id);
+        var link = (await Api.GetEntry(_variantEntryId))!.VariantOf.Should().ContainSingle().Subject;
+        link.Types.Should().BeEmpty();
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.RemoveVariantType_WorksWhenTypeIsNotOnLink

method · +6 -0

```diff
@@ -344,0 +344,6 @@
+    [Fact]
+    public async Task RemoveVariantType_WorksWhenTypeIsNotOnLink()
+    {
+        var variant = await Api.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry));
+        await Api.RemoveVariantType(variant, Guid.NewGuid());
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.CreateVariantType_Works

method · +8 -0

```diff
@@ -351,0 +351,8 @@
+    [Fact]
+    public async Task CreateVariantType_Works()
+    {
+        var variantType = new VariantType() { Id = Guid.NewGuid(), Name = new() { { "en", "test" } } };
+        await Api.CreateVariantType(variantType);
+        var types = await Api.GetVariantTypes().ToArrayAsync();
+        types.Should().ContainSingle(t => t.Id == variantType.Id);
+    }
```

### ResumableTests.ImportProject_IsResumable_AcrossRandomFailures — from backend/FwLite/FwLiteProjectSync.Tests/Import/ResumableTests.cs

method · +6 -0

```diff
@@ -84,0 +85,6 @@
+        mockFrom.Setup(f => f.GetVariantTypes())
+            .Returns(MockAsyncEnumerable([new VariantType()
+            {
+                Id = Guid.NewGuid(),
+                Name = new(){ ["en"] = "Test Variant Type" }
+            }]));
```

### VariantSyncTests.GetVariantType — from backend/FwLite/FwLiteProjectSync.Tests/VariantSyncTests.cs

method · +4 -0

```diff
@@ -56,0 +56,4 @@
+    private async Task<VariantType> GetVariantType(IMiniLcmApi api, string name)
+    {
+        return (await api.GetVariantTypes().ToArrayAsync()).Single(t => t.Name["en"] == name);
+    }
```

### VariantSyncTests.VariantTypesSyncFwToCrdtAtProjectImport — from backend/FwLite/FwLiteProjectSync.Tests/VariantSyncTests.cs

method · +10 -0

```diff
@@ -61,0 +61,10 @@
+    [Fact]
+    [Trait("Category", "Integration")]
+    public async Task VariantTypesSyncFwToCrdtAtProjectImport()
+    {
+        await _syncService.Import(_fixture.CrdtApi, _fixture.FwDataApi);
+        var fwdataVariantTypes = await _fixture.FwDataApi.GetVariantTypes().ToArrayAsync();
+        var crdtVariantTypes = await _fixture.CrdtApi.GetVariantTypes().ToArrayAsync();
+        fwdataVariantTypes.Should().NotBeEmpty();
+        crdtVariantTypes.Should().BeEquivalentTo(fwdataVariantTypes);
+    }
```

### VariantSyncTests.VariantTypesSyncBothWays — from backend/FwLite/FwLiteProjectSync.Tests/VariantSyncTests.cs

method · +33 -0

```diff
@@ -146,0 +146,33 @@
+    [Fact]
+    [Trait("Category", "Integration")]
+    public async Task VariantTypesSyncBothWays()
+    {
+        var crdtApi = _fixture.CrdtApi;
+        var fwdataApi = _fixture.FwDataApi;
+        await _syncService.Import(crdtApi, fwdataApi);
+        var projectSnapshot = await _fixture.RegenerateAndGetSnapshot();
+
+        var fwType = new VariantType()
+        {
+            Id = Guid.NewGuid(),
+            Name = new() { { "en", "fw custom type" } },
+        };
+        await fwdataApi.CreateVariantType(fwType);
+
+        var crdtType = new VariantType()
+        {
+            Id = Guid.NewGuid(),
+            Name = new() { { "en", "crdt custom type" } },
+        };
+        await crdtApi.CreateVariantType(crdtType);
+
+        await _syncService.Sync(crdtApi, fwdataApi, projectSnapshot);
+
+        var crdtVariantTypes = await crdtApi.GetVariantTypes().ToArrayAsync();
+        var fwdataVariantTypes = await fwdataApi.GetVariantTypes().ToArrayAsync();
+        crdtVariantTypes.Should().ContainEquivalentOf(fwType);
+        crdtVariantTypes.Should().ContainEquivalentOf(crdtType);
+        fwdataVariantTypes.Should().ContainEquivalentOf(fwType);
+        fwdataVariantTypes.Should().ContainEquivalentOf(crdtType);
+        crdtVariantTypes.Should().BeEquivalentTo(fwdataVariantTypes);
+    }
```

### VariantSyncTests.LegacySnapshotWithoutVariantTypes_FirstSyncImportsVariantsIntoCrdt — from backend/FwLite/FwLiteProjectSync.Tests/VariantSyncTests.cs

method · +35 -0

```diff
@@ -275,0 +275,34 @@
+    [Fact]
+    [Trait("Category", "Integration")]
+    public async Task LegacySnapshotWithoutVariantTypes_FirstSyncImportsVariantsIntoCrdt()
+    {
+        var crdtApi = _fixture.CrdtApi;
+        var fwdataApi = _fixture.FwDataApi;
+        await _syncService.Import(crdtApi, fwdataApi);
+        var projectSnapshot = await _fixture.RegenerateAndGetSnapshot();
+
+        // wipe the variants a CRDT imported before variant support would have missed;
+        // pre-variant snapshot json deserializes with an empty VariantTypes list
+        // (ProjectSnapshot normalizes the missing property)
+        foreach (var entry in await crdtApi.GetAllEntries().ToArrayAsync())
+        {
+            foreach (var link in entry.VariantOf)
+            {
+                await crdtApi.DeleteVariant(link);
+            }
+        }
+        var legacySnapshot = projectSnapshot with
+        {
+            VariantTypes = [],
+            Entries = [..projectSnapshot.Entries.Select(e => StripVariants(e.Copy()))]
+        };
+
+        var fwdataVariant = await fwdataApi.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry));
+
+        await _syncService.Sync(crdtApi, fwdataApi, legacySnapshot);
+
+        // FwData kept its link and the CRDT gained it
+        (await fwdataApi.GetEntry(_variantEntryId))!.VariantOf.Should().ContainSingle();
+        (await crdtApi.GetEntry(_variantEntryId))!.VariantOf.Should().ContainSingle(v => v.MainEntryId == fwdataVariant.MainEntryId);
+        (await crdtApi.GetVariantTypes().ToArrayAsync()).Should().NotBeEmpty();
+
@@ -315,0 +315,1 @@
+    }
```

### IMiniLcmReadApi.GetVariantTypes — from backend/FwLite/MiniLcm/IMiniLcmReadApi.cs

method · +1 -0

```diff
@@ -17,0 +18,1 @@
+    IAsyncEnumerable<VariantType> GetVariantTypes();
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.UpdateVariantType_Works

method · +8 -0

```diff
@@ -360,0 +360,8 @@
+    [Fact]
+    public async Task UpdateVariantType_Works()
+    {
+        var variantType = new VariantType() { Id = Guid.NewGuid(), Name = new() { { "en", "test" } } };
+        await Api.CreateVariantType(variantType);
+        var updatedVariantType = await Api.UpdateVariantType(variantType.Id, new UpdateObjectInput<VariantType>().Set(c => c.Name["en"], "updated"));
+        updatedVariantType.Name["en"].Should().Be("updated");
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.UpdateVariantTypeSync_Works

method · +9 -0

```diff
@@ -369,0 +369,9 @@
+    [Fact]
+    public async Task UpdateVariantTypeSync_Works()
+    {
+        var variantType = new VariantType() { Id = Guid.NewGuid(), Name = new() { { "en", "test" } } };
+        await Api.CreateVariantType(variantType);
+        var afterVariantType = variantType with { Name = new() { { "en", "updated" } } };
+        var actualVariantType = await Api.UpdateVariantType(variantType, afterVariantType);
+        actualVariantType.Should().BeEquivalentTo(afterVariantType, options => options.Excluding(c => c.Id));
+    }
```

## backend/FwLite/MiniLcm.Tests/VariantTestsBase.cs

### VariantTestsBase.EntryCanBeBothVariantAndComponent

method · +15 -0

```diff
@@ -379,0 +379,15 @@
+    [Fact]
+    public async Task EntryCanBeBothVariantAndComponent()
+    {
+        var complexFormEntry = await Api.CreateEntry(new()
+        {
+            Id = Guid.NewGuid(),
+            LexemeForm = { { "en", "complex form" } }
+        });
+        await Api.CreateComplexFormComponent(ComplexFormComponent.FromEntries(complexFormEntry, _variantEntry));
+        await Api.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry));
+
+        var entry = await Api.GetEntry(_variantEntryId);
+        entry!.ComplexForms.Should().ContainSingle(c => c.ComplexFormEntryId == complexFormEntry.Id);
+        entry.VariantOf.Should().ContainSingle(v => v.MainEntryId == _mainEntryId);
+    }
```

### EntrySyncTestsBase.CanSyncVariantWhenTargetSenseMovesToDifferentEntry — from backend/FwLite/FwLiteProjectSync.Tests/EntrySyncTests.cs

method · +36 -0

```diff
@@ -954,0 +964,36 @@
+    [Fact]
+    public async Task CanSyncVariantWhenTargetSenseMovesToDifferentEntry()
+    {
+        var senseId = Guid.NewGuid();
+        var oldMainEntry = await Api.CreateEntry(new() { LexemeForm = { { "en", "old-main" } }, Senses = [new() { Id = senseId }] });
+        var oldMainEntryAfter = oldMainEntry.Copy();
+        oldMainEntryAfter.Senses.Clear(); // sense is moved from here
+
+        var newMainEntry = await Api.CreateEntry(new() { Id = Guid.NewGuid(), LexemeForm = { { "en", "new-main" } } });
+        var newMainEntryAfter = newMainEntry.Copy();
+        newMainEntryAfter.Senses.Add(new Sense() { Id = senseId }); // sense is moved to here
+
+        var variantEntry = new Entry
+        {
+            Id = Guid.NewGuid(),
+            LexemeForm = { { "en", "variant" } },
+        };
+        variantEntry.VariantOf.Add(Variant.FromEntries(variantEntry, oldMainEntry, senseId));
+        variantEntry = await Api.CreateEntry(variantEntry);
+
+        var variantEntryAfter = variantEntry.Copy();
+        variantEntryAfter.VariantOf = [Variant.FromEntries(variantEntry, newMainEntry, senseId)];
+
+        await EntrySync.SyncFull(
+            [variantEntry, oldMainEntry, newMainEntry],
+            [variantEntryAfter, oldMainEntryAfter, newMainEntryAfter],
+            Api);
+
+        var actualVariantEntry = await Api.GetEntry(variantEntry.Id);
+        actualVariantEntry.Should().NotBeNull();
+        var link = actualVariantEntry!.VariantOf.Should().ContainSingle().Subject;
+        link.MainEntryId.Should().Be(newMainEntry.Id);
+        link.MainSenseId.Should().Be(senseId);
+        (await Api.GetEntry(oldMainEntry.Id))!.Variants.Should().BeEmpty();
+        (await Api.GetEntry(newMainEntry.Id))!.Variants.Should().ContainSingle();
+    }
```

### VariantSyncTests.CreatingVariantInFwDataSyncsWithoutIssue — from backend/FwLite/FwLiteProjectSync.Tests/VariantSyncTests.cs

method · +33 -0

```diff
@@ -72,0 +72,33 @@
+    [Fact]
+    [Trait("Category", "Integration")]
+    public async Task CreatingVariantInFwDataSyncsWithoutIssue()
+    {
+        var crdtApi = _fixture.CrdtApi;
+        var fwdataApi = _fixture.FwDataApi;
+        await _syncService.Import(crdtApi, fwdataApi);
+        var projectSnapshot = await _fixture.RegenerateAndGetSnapshot();
+
+        var dialectal = await GetVariantType(fwdataApi, "Dialectal Variant");
+        await fwdataApi.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry) with
+        {
+            Types = [dialectal],
+            HideMinorEntry = true,
+            Comment = new() { { "en", new RichString("british spelling") } },
+        });
+
+        await _syncService.Sync(crdtApi, fwdataApi, projectSnapshot);
+
+        SyncTests.AssertSnapshotsAreEquivalent(await fwdataApi.TakeProjectSnapshot(), await crdtApi.TakeProjectSnapshot());
+        var crdtVariantEntry = await crdtApi.GetEntry(_variantEntryId);
+        crdtVariantEntry.Should().NotBeNull();
+        crdtVariantEntry!.Senses.Should().BeEmpty();
+        var link = crdtVariantEntry.VariantOf.Should().ContainSingle().Subject;
+        link.Types.Should().ContainSingle(t => t.Id == dialectal.Id);
+        link.HideMinorEntry.Should().BeTrue();
+
+        // Sync again, ensure no problems or changes
+        var secondSnapshot = await _fixture.RegenerateAndGetSnapshot();
+        var secondSync = await _syncService.Sync(crdtApi, fwdataApi, secondSnapshot);
+        secondSync.CrdtChanges.Should().Be(0);
+        secondSync.FwdataChanges.Should().Be(0);
+    }
```

### VariantSyncTests.CreatingVariantInCrdtSyncsWithoutIssue — from backend/FwLite/FwLiteProjectSync.Tests/VariantSyncTests.cs

method · +20 -0

```diff
@@ -106,0 +106,20 @@
+    [Fact]
+    [Trait("Category", "Integration")]
+    public async Task CreatingVariantInCrdtSyncsWithoutIssue()
+    {
+        var crdtApi = _fixture.CrdtApi;
+        var fwdataApi = _fixture.FwDataApi;
+        await _syncService.Import(crdtApi, fwdataApi);
+        var projectSnapshot = await _fixture.RegenerateAndGetSnapshot();
+
+        var spelling = await GetVariantType(crdtApi, "Spelling Variant");
+        await crdtApi.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry) with { Types = [spelling] });
+
+        await _syncService.Sync(crdtApi, fwdataApi, projectSnapshot);
+
+        SyncTests.AssertSnapshotsAreEquivalent(await fwdataApi.TakeProjectSnapshot(), await crdtApi.TakeProjectSnapshot());
+        var fwVariantEntry = await fwdataApi.GetEntry(_variantEntryId);
+        fwVariantEntry.Should().NotBeNull();
+        var link = fwVariantEntry!.VariantOf.Should().ContainSingle().Subject;
+        link.Types.Should().ContainSingle(t => t.Id == spelling.Id);
+    }
```

### VariantSyncTests.SenseTargetedVariantWithNewSenseSyncs — from backend/FwLite/FwLiteProjectSync.Tests/VariantSyncTests.cs

method · +18 -0

```diff
@@ -127,0 +127,18 @@
+    [Fact]
+    [Trait("Category", "Integration")]
+    public async Task SenseTargetedVariantWithNewSenseSyncs()
+    {
+        var crdtApi = _fixture.CrdtApi;
+        var fwdataApi = _fixture.FwDataApi;
+        await _syncService.Import(crdtApi, fwdataApi);
+        var projectSnapshot = await _fixture.RegenerateAndGetSnapshot();
+
+        var newSense = await fwdataApi.CreateSense(_mainEntryId, new Sense { Gloss = { { "en", "new target sense" } } });
+        await fwdataApi.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry, newSense.Id));
+
+        await _syncService.Sync(crdtApi, fwdataApi, projectSnapshot);
+
+        SyncTests.AssertSnapshotsAreEquivalent(await fwdataApi.TakeProjectSnapshot(), await crdtApi.TakeProjectSnapshot());
+        var crdtMainEntry = await crdtApi.GetEntry(_mainEntryId);
+        crdtMainEntry!.Variants.Should().ContainSingle(v => v.MainSenseId == newSense.Id);
+    }
```

### VariantSyncTests.VariantLinkEditsSyncBothWays — from backend/FwLite/FwLiteProjectSync.Tests/VariantSyncTests.cs

method · +31 -0

```diff
@@ -180,0 +180,31 @@
+    [Fact]
+    [Trait("Category", "Integration")]
+    public async Task VariantLinkEditsSyncBothWays()
+    {
+        var crdtApi = _fixture.CrdtApi;
+        var fwdataApi = _fixture.FwDataApi;
+        var free = await GetVariantType(fwdataApi, "Free Variant");
+        var created = await fwdataApi.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry) with { Types = [free] });
+        await _syncService.Import(crdtApi, fwdataApi);
+        var projectSnapshot = await _fixture.RegenerateAndGetSnapshot();
+
+        // edit the same link's own fields on each side (types in FwData, scalars in CRDT)
+        var dialectal = await GetVariantType(fwdataApi, "Dialectal Variant");
+        var fwLink = (await fwdataApi.GetEntry(_variantEntryId))!.VariantOf.Single();
+        await fwdataApi.AddVariantType(fwLink, dialectal.Id);
+        await fwdataApi.RemoveVariantType(fwLink, free.Id);
+
+        var crdtLink = (await crdtApi.GetEntry(_variantEntryId))!.VariantOf.Single();
+        var crdtAfter = crdtLink.Copy();
+        crdtAfter.HideMinorEntry = true;
+        crdtAfter.Comment = new() { { "en", new RichString("prefer the main entry") } };
+        await crdtApi.UpdateVariant(crdtLink, crdtAfter);
+
+        await _syncService.Sync(crdtApi, fwdataApi, projectSnapshot);
+
+        SyncTests.AssertSnapshotsAreEquivalent(await fwdataApi.TakeProjectSnapshot(), await crdtApi.TakeProjectSnapshot());
+        var merged = (await crdtApi.GetEntry(_variantEntryId))!.VariantOf.Should().ContainSingle().Subject;
+        merged.Types.Should().ContainSingle(t => t.Id == dialectal.Id);
+        merged.HideMinorEntry.Should().BeTrue();
+        merged.Comment["en"].GetPlainText().Should().Be("prefer the main entry");
+    }
```

### VariantSyncTests.DeletingMainEntryInCrdtRemovesLinkOnSync — from backend/FwLite/FwLiteProjectSync.Tests/VariantSyncTests.cs

method · +20 -0

```diff
@@ -212,0 +212,20 @@
+    [Fact]
+    [Trait("Category", "Integration")]
+    public async Task DeletingMainEntryInCrdtRemovesLinkOnSync()
+    {
+        var crdtApi = _fixture.CrdtApi;
+        var fwdataApi = _fixture.FwDataApi;
+        await fwdataApi.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry));
+        await _syncService.Import(crdtApi, fwdataApi);
+        var projectSnapshot = await _fixture.RegenerateAndGetSnapshot();
+
+        await crdtApi.DeleteEntry(_mainEntryId);
+
+        await _syncService.Sync(crdtApi, fwdataApi, projectSnapshot);
+
+        (await fwdataApi.GetEntry(_mainEntryId)).Should().BeNull();
+        var fwVariantEntry = await fwdataApi.GetEntry(_variantEntryId);
+        fwVariantEntry.Should().NotBeNull("only the link dies, not the variant entry");
+        fwVariantEntry!.VariantOf.Should().BeEmpty();
+        (await crdtApi.GetEntry(_variantEntryId))!.VariantOf.Should().BeEmpty();
+    }
```

### VariantSyncTests.DeletingVariantEntryInFwDataRemovesLinkOnSync — from backend/FwLite/FwLiteProjectSync.Tests/VariantSyncTests.cs

method · +20 -0

```diff
@@ -233,0 +233,20 @@
+    [Fact]
+    [Trait("Category", "Integration")]
+    public async Task DeletingVariantEntryInFwDataRemovesLinkOnSync()
+    {
+        var crdtApi = _fixture.CrdtApi;
+        var fwdataApi = _fixture.FwDataApi;
+        await fwdataApi.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry));
+        await _syncService.Import(crdtApi, fwdataApi);
+        var projectSnapshot = await _fixture.RegenerateAndGetSnapshot();
+
+        await fwdataApi.DeleteEntry(_variantEntryId);
+
+        await _syncService.Sync(crdtApi, fwdataApi, projectSnapshot);
+
+        (await crdtApi.GetEntry(_variantEntryId)).Should().BeNull();
+        var crdtMainEntry = await crdtApi.GetEntry(_mainEntryId);
+        crdtMainEntry.Should().NotBeNull("only the link dies, not the main entry");
+        crdtMainEntry!.Variants.Should().BeEmpty();
+        (await fwdataApi.GetEntry(_mainEntryId))!.Variants.Should().BeEmpty();
+    }
```

### VariantSyncTests.VariantAddedInFwDataWhileMainEntryDeletedInCrdt_SyncDoesNotThrow — from backend/FwLite/FwLiteProjectSync.Tests/VariantSyncTests.cs

method · +20 -0

```diff
@@ -254,0 +254,20 @@
+    [Fact]
+    [Trait("Category", "Integration")]
+    public async Task VariantAddedInFwDataWhileMainEntryDeletedInCrdt_SyncDoesNotThrow()
+    {
+        var crdtApi = _fixture.CrdtApi;
+        var fwdataApi = _fixture.FwDataApi;
+        await _syncService.Import(crdtApi, fwdataApi);
+        var projectSnapshot = await _fixture.RegenerateAndGetSnapshot();
+
+        await fwdataApi.CreateVariant(Variant.FromEntries(_variantEntry, _mainEntry));
+        await crdtApi.DeleteEntry(_mainEntryId);
+
+        await _syncService.Sync(crdtApi, fwdataApi, projectSnapshot);
+
+        (await crdtApi.GetEntry(_mainEntryId)).Should().BeNull();
+        (await fwdataApi.GetEntry(_mainEntryId)).Should().BeNull();
+        var crdtVariantEntry = await crdtApi.GetEntry(_variantEntryId);
+        crdtVariantEntry.Should().NotBeNull();
+        crdtVariantEntry!.VariantOf.Should().BeEmpty();
+    }
```

### VariantChangeTests.AddVariant — from backend/FwLite/LcmCrdt.Tests/Changes/VariantChangeTests.cs

method · +14 -0

```diff
@@ -16,0 +16,14 @@
+    [Fact]
+    public async Task AddVariant()
+    {
+        var (variantEntry, mainEntry) = await CreateEntryPair();
+
+        await fixture.DataModel.AddChange(Guid.NewGuid(), new AddVariantChange(Variant.FromEntries(variantEntry, mainEntry)));
+        var updatedVariantEntry = await fixture.Api.GetEntry(variantEntry.Id);
+        updatedVariantEntry.Should().NotBeNull();
+        updatedVariantEntry!.VariantOf.Should().ContainSingle(v => v.MainEntryId == mainEntry.Id);
+
+        var updatedMainEntry = await fixture.Api.GetEntry(mainEntry.Id);
+        updatedMainEntry.Should().NotBeNull();
+        updatedMainEntry!.Variants.Should().ContainSingle(v => v.VariantEntryId == variantEntry.Id);
+    }
```

### VariantChangeTests.DeleteVariant — from backend/FwLite/LcmCrdt.Tests/Changes/VariantChangeTests.cs

method · +12 -0

```diff
@@ -65,0 +65,12 @@
+    [Fact]
+    public async Task DeleteVariant()
+    {
+        var (variantEntry, mainEntry) = await CreateEntryPair();
+
+        await fixture.DataModel.AddChange(Guid.NewGuid(), new AddVariantChange(Variant.FromEntries(variantEntry, mainEntry)));
+        var link = (await fixture.Api.GetEntry(variantEntry.Id))!.VariantOf.Should().ContainSingle().Subject;
+
+        await fixture.DataModel.AddChange(Guid.NewGuid(), new DeleteChange<Variant>(link.Id));
+        (await fixture.Api.GetEntry(variantEntry.Id))!.VariantOf.Should().BeEmpty();
+        (await fixture.Api.GetEntry(mainEntry.Id))!.Variants.Should().BeEmpty();
+    }
```

### VariantChangeTests.DuplicateVariantsAreDeleted — from backend/FwLite/LcmCrdt.Tests/Changes/VariantChangeTests.cs

method · +16 -0

```diff
@@ -78,0 +78,16 @@
+    [Fact]
+    public async Task DuplicateVariantsAreDeleted()
+    {
+        var (variantEntry, mainEntry) = await CreateEntryPair();
+
+        await fixture.DataModel.AddChange(Guid.NewGuid(), new AddVariantChange(Variant.FromEntries(variantEntry, mainEntry)));
+        await fixture.DataModel.AddChange(Guid.NewGuid(), new AddVariantChange(Variant.FromEntries(variantEntry, mainEntry)));
+
+        var updatedVariantEntry = await fixture.Api.GetEntry(variantEntry.Id);
+        updatedVariantEntry.Should().NotBeNull();
+        updatedVariantEntry!.VariantOf.Should().ContainSingle(v => v.MainEntryId == mainEntry.Id);
+
+        var updatedMainEntry = await fixture.Api.GetEntry(mainEntry.Id);
+        updatedMainEntry.Should().NotBeNull();
+        updatedMainEntry!.Variants.Should().ContainSingle(v => v.VariantEntryId == variantEntry.Id);
+    }
```

### VariantChangeTests.DeletingMainEntryDeletesTheLink — from backend/FwLite/LcmCrdt.Tests/Changes/VariantChangeTests.cs

method · +12 -0

```diff
@@ -155,0 +155,12 @@
+    [Fact]
+    public async Task DeletingMainEntryDeletesTheLink()
+    {
+        var (variantEntry, mainEntry) = await CreateEntryPair();
+        await fixture.DataModel.AddChange(Guid.NewGuid(), new AddVariantChange(Variant.FromEntries(variantEntry, mainEntry)));
+
+        await fixture.DataModel.AddChange(Guid.NewGuid(), new DeleteChange<Entry>(mainEntry.Id));
+
+        var updatedVariantEntry = await fixture.Api.GetEntry(variantEntry.Id);
+        updatedVariantEntry.Should().NotBeNull("only the link dies, not the variant entry");
+        updatedVariantEntry!.VariantOf.Should().BeEmpty();
+    }
```

### VariantChangeTests.DeletingVariantEntryDeletesTheLink — from backend/FwLite/LcmCrdt.Tests/Changes/VariantChangeTests.cs

method · +12 -0

```diff
@@ -168,0 +168,12 @@
+    [Fact]
+    public async Task DeletingVariantEntryDeletesTheLink()
+    {
+        var (variantEntry, mainEntry) = await CreateEntryPair();
+        await fixture.DataModel.AddChange(Guid.NewGuid(), new AddVariantChange(Variant.FromEntries(variantEntry, mainEntry)));
+
+        await fixture.DataModel.AddChange(Guid.NewGuid(), new DeleteChange<Entry>(variantEntry.Id));
+
+        var updatedMainEntry = await fixture.Api.GetEntry(mainEntry.Id);
+        updatedMainEntry.Should().NotBeNull("only the link dies, not the main entry");
+        updatedMainEntry!.Variants.Should().BeEmpty();
+    }
```

### VariantChangeTests.DeletingTargetSenseDeletesTheLink — from backend/FwLite/LcmCrdt.Tests/Changes/VariantChangeTests.cs

method · +12 -0

```diff
@@ -181,0 +181,12 @@
+    [Fact]
+    public async Task DeletingTargetSenseDeletesTheLink()
+    {
+        var (variantEntry, mainEntry) = await CreateEntryPair();
+        var sense = await fixture.Api.CreateSense(mainEntry.Id, new Sense { Id = Guid.NewGuid(), Gloss = { { "en", "target" } } });
+        await fixture.DataModel.AddChange(Guid.NewGuid(), new AddVariantChange(Variant.FromEntries(variantEntry, mainEntry, sense.Id)));
+
+        await fixture.Api.DeleteSense(mainEntry.Id, sense.Id);
+
+        (await fixture.Api.GetEntry(variantEntry.Id))!.VariantOf.Should().BeEmpty();
+        (await fixture.Api.GetEntry(mainEntry.Id))!.Variants.Should().BeEmpty();
+    }
```

### Variant.FromEntries — from backend/FwLite/MiniLcm/Models/Variant.cs

method · +16 -0

```diff
@@ -15,0 +15,16 @@
+    public static Variant FromEntries(Entry variantEntry,
+        Entry mainEntry,
+        Guid? mainSenseId = null)
+    {
+        if (mainEntry.Id == default) throw new ArgumentException("mainEntry.Id is empty");
+        if (variantEntry.Id == default) throw new ArgumentException("variantEntry.Id is empty");
+        return new Variant
+        {
+            Id = Guid.NewGuid(),
+            VariantEntryId = variantEntry.Id,
+            VariantHeadword = variantEntry.Headword(),
+            MainEntryId = mainEntry.Id,
+            MainHeadword = mainEntry.Headword(),
+            MainSenseId = mainSenseId,
+        };
+    }
```

## backend/FwLite/MiniLcm/CreateEntryOptions.cs

### CreateEntryOptions

other · +2 -1

```diff
@@ -5,1 +5,2 @@
-    /// Can be excluded for the purpose of deferring referencing entities that might not exist yet.
+    /// Also gates variant links. Can be excluded for the purpose of deferring
+    /// referencing entities that might not exist yet.
```

## backend/FwLite/MiniLcm/IMiniLcmWriteApi.cs

### IMiniLcmWriteApi

other · +9 -0

```diff
@@ -46,0 +47,1 @@
+    #region VariantType
@@ -52,0 +52,2 @@
+    #endregion
+
@@ -67,0 +75,2 @@
+    // Variant links are unordered (no position/move) and resolved by their composite key
+    // (VariantEntryId, MainEntryId, MainSenseId) — see VARIANTS.md
@@ -164,0 +164,4 @@
+    /// <summary>
+    /// Patches a variant link's own fields (HideMinorEntry, Comment) — the link is located by
+    /// its composite key, not its Id, since FwData links have no stable Id.
+    /// </summary>
```

## backend/FwLite/MiniLcm/IMiniLcmWriteApi.cs

### IMiniLcmWriteApi.UpdateVariantType

method · +1 -0

```diff
@@ -49,0 +49,1 @@
+    Task<VariantType> UpdateVariantType(Guid id, UpdateObjectInput<VariantType> update);
```

## backend/FwLite/MiniLcm/IMiniLcmWriteApi.cs

### IMiniLcmWriteApi.UpdateVariantType

method · +1 -0

```diff
@@ -50,0 +50,1 @@
+    Task<VariantType> UpdateVariantType(VariantType before, VariantType after, IMiniLcmApi? api = null);
```

## backend/FwLite/MiniLcm/Import/ProjectImporter.cs

### lines 9–11

other · +3 -3

```diff
@@ -9,3 +9,3 @@
-/// (writing systems → parts of speech → publications → complex-form types → morph types →
-/// semantic domains → entries). Both FwData→CRDT import and template-based project creation funnel
-/// through here, so the ordering and the create-vs-update rules live in exactly one place.
+/// (writing systems → parts of speech → publications → complex-form types → variant types →
+/// morph types → semantic domains → entries). Both FwData→CRDT import and template-based project
+/// creation funnel through here, so the ordering and the create-vs-update rules live in exactly one place.
```

## backend/FwLite/MiniLcm/Import/ProjectImporter.cs

### ProjectImporter.ImportProject

method · +7 -0

```diff
@@ -41,0 +42,7 @@
+        logger.LogInformation("Importing {Count} variant types", snapshot.VariantTypes.Length);
+        foreach (var variantType in snapshot.VariantTypes)
+        {
+            await importTo.CreateVariantType(variantType);
+            logger.LogInformation("Imported variant type {Id}", variantType.Id);
+        }
+
```

## backend/FwLite/MiniLcm/MiniLcmApiExtensions.cs

### MiniLcmExtensions.TakeProjectSnapshot

method · +1 -0

```diff
@@ -20,0 +21,1 @@
+            await api.GetVariantTypes().ToArrayAsync(),
```

## backend/FwLite/MiniLcm/Models/Entry.cs

### EntryApiHelper.createEntryAtIndex — from frontend/viewer/tests/entry-api-helper.ts

method · +2 -0

```diff
@@ -81,0 +82,2 @@
+        variantOf: [],
+        variants: [],
```

### Entry

other · +8 -14

```diff
@@ -35,0 +36,3 @@
+    /// <summary>
+    /// This entry is a variant of these entries/senses
+    /// </summary>
@@ -40,0 +40,4 @@
+
+    /// <summary>
+    /// Entries which are variants of this entry (or one of its senses)
+    /// </summary>
@@ -45,0 +45,1 @@
+
@@ -94,14 +111,0 @@
-
-public class Variants
-{
-    public Guid Id { get; set; }
-    public IList<ComplexFormComponent> VariantsOf { get; set; } = [];
-    public IList<VariantType> Types { get; set; } = [];
-}
-
-
-public class VariantType
-{
-    public required Guid Id { get; set; }
-    public required MultiString Name { get; set; }
-}
```

## backend/FwLite/MiniLcm/Models/Entry.cs

### Entry.VariantOf

method · +1 -0

```diff
@@ -39,0 +39,1 @@
+    public virtual List<Variant> VariantOf { get; set; } = [];
```

## backend/FwLite/MiniLcm/Models/Entry.cs

### Entry.Variants

method · +1 -0

```diff
@@ -44,0 +44,1 @@
+    public virtual List<Variant> Variants { get; set; } = [];
```

## backend/FwLite/MiniLcm/Models/Entry.cs

### Entry.Copy

method · +8 -0

```diff
@@ -80,0 +91,8 @@
+            VariantOf =
+            [
+                ..VariantOf.Select(v => v.Copy())
+            ],
+            Variants =
+            [
+                ..Variants.Select(v => v.Copy())
+            ],
```

## backend/FwLite/MiniLcm/Models/IObjectWithId.cs

### IObjectWithId

other · +2 -0

```diff
@@ -14,0 +15,2 @@
+[JsonDerivedType(typeof(VariantType), nameof(VariantType))]
+[JsonDerivedType(typeof(Variant), nameof(Variant))]
```

## backend/FwLite/MiniLcm/Models/Variant.cs

### lines 1–12

other · +11 -0

```diff
@@ -0,0 +1,3 @@
+using System.Diagnostics;
+using MiniLcm.Attributes;
+
@@ -5,0 +5,8 @@
+
+/// <summary>
+/// One variant relationship: a variant (minor) entry pointing at the main entry (or sense)
+/// it is a variant of. Maps 1:1 to a FieldWorks LexEntryRef with RefType = Variant, so the
+/// per-relationship fields (Types, HideMinorEntry, Comment) live here rather than on the
+/// entry. Unlike <see cref="ComplexFormComponent"/> there is no Order — variant lists have
+/// no user-meaningful order in FieldWorks.
+/// </summary>
```

## backend/FwLite/MiniLcm/Models/Variant.cs

### MiniLcm.Models

other · +1 -0

```diff
@@ -4,0 +4,1 @@
+namespace MiniLcm.Models;
```

## backend/FwLite/MiniLcm/Models/Variant.cs

### Variant.Id

method · +13 -0

```diff
@@ -33,0 +33,13 @@
+    [MiniLcmInternal]
+    public Guid Id
+    {
+        get
+        {
+            Debug.Assert(_id != Guid.Empty, "Id is not set and should not be used");
+            return _id;
+        }
+        set
+        {
+            _id = value;
+        }
+    }
```

## backend/FwLite/MiniLcm/Models/Variant.cs

### Variant.MaybeId

method · +2 -0

```diff
@@ -47,0 +47,2 @@
+    [MiniLcmInternal]
+    public Guid? MaybeId => _id == Guid.Empty ? null : _id;
```

## backend/FwLite/MiniLcm/Models/Variant.cs

### Variant.DeletedAt

method · +1 -0

```diff
@@ -50,0 +50,1 @@
+    public DateTimeOffset? DeletedAt { get; set; }
```

## backend/FwLite/MiniLcm/Models/Variant.cs

### Variant.VariantEntryId

method · +1 -0

```diff
@@ -51,0 +51,1 @@
+    public virtual required Guid VariantEntryId { get; set; }
```

## backend/FwLite/MiniLcm/Models/Variant.cs

### Variant.VariantHeadword

method · +1 -0

```diff
@@ -52,0 +52,1 @@
+    public string? VariantHeadword { get; set; }
```

## backend/FwLite/MiniLcm/Models/Variant.cs

### Variant.MainEntryId

method · +1 -0

```diff
@@ -53,0 +53,1 @@
+    public virtual required Guid MainEntryId { get; set; }
```

## backend/FwLite/MiniLcm/Models/Variant.cs

### Variant.MainSenseId

method · +1 -0

```diff
@@ -54,0 +54,1 @@
+    public virtual Guid? MainSenseId { get; set; } = null;
```

## backend/FwLite/MiniLcm/Models/Variant.cs

### Variant.MainHeadword

method · +1 -0

```diff
@@ -55,0 +55,1 @@
+    public string? MainHeadword { get; set; }
```

## backend/FwLite/MiniLcm/Models/Variant.cs

### Variant.Types

method · +1 -0

```diff
@@ -56,0 +56,1 @@
+    public virtual List<VariantType> Types { get; set; } = [];
```

## backend/FwLite/MiniLcm/Models/Variant.cs

### Variant.HideMinorEntry

method · +1 -0

```diff
@@ -57,0 +57,1 @@
+    public virtual bool HideMinorEntry { get; set; }
```

## backend/FwLite/MiniLcm/Models/Variant.cs

### Variant.Comment

method · +1 -0

```diff
@@ -58,0 +58,1 @@
+    public virtual RichMultiString Comment { get; set; } = new();
```

## backend/FwLite/MiniLcm/Models/Variant.cs

### Variant.GetReferences

method · +11 -0

```diff
@@ -60,0 +60,11 @@
+    public Guid[] GetReferences()
+    {
+        Span<Guid> senseId = (MainSenseId.HasValue ? [MainSenseId.Value] : []);
+        return
+        [
+            VariantEntryId,
+            MainEntryId,
+            ..senseId,
+            ..Types.Select(t => t.Id)
+        ];
+    }
```

## backend/FwLite/MiniLcm/Models/Variant.cs

### Variant.RemoveReference

method · +9 -0

```diff
@@ -72,0 +72,9 @@
+    public void RemoveReference(Guid id, DateTimeOffset time)
+    {
+        if (MainEntryId == id || VariantEntryId == id || MainSenseId == id)
+        {
+            DeletedAt = time;
+            return;
+        }
+        Types.RemoveAll(t => t.Id == id);
+    }
```

## backend/FwLite/MiniLcm/Models/Variant.cs

### Variant.Copy

method · +16 -0

```diff
@@ -82,0 +82,16 @@
+    public Variant Copy()
+    {
+        return new Variant
+        {
+            Id = _id,
+            VariantEntryId = VariantEntryId,
+            VariantHeadword = VariantHeadword,
+            MainEntryId = MainEntryId,
+            MainHeadword = MainHeadword,
+            MainSenseId = MainSenseId,
+            Types = [..Types.Select(t => t.Copy())],
+            HideMinorEntry = HideMinorEntry,
+            Comment = Comment.Copy(),
+            DeletedAt = DeletedAt,
+        };
+    }
```

### VariantChangeTests.SelfReferenceVariantIsDeleted — from backend/FwLite/LcmCrdt.Tests/Changes/VariantChangeTests.cs

method · +13 -0

```diff
@@ -95,0 +95,13 @@
+    [Fact]
+    public async Task SelfReferenceVariantIsDeleted()
+    {
+        var (variantEntry, _) = await CreateEntryPair();
+
+        await fixture.DataModel.AddChange(Guid.NewGuid(),
+            new AddVariantChange(new Variant { Id = Guid.NewGuid(), VariantEntryId = variantEntry.Id, MainEntryId = variantEntry.Id }));
+
+        var updated = await fixture.Api.GetEntry(variantEntry.Id);
+        updated.Should().NotBeNull();
+        updated!.VariantOf.Should().BeEmpty();
+        updated.Variants.Should().BeEmpty();
+    }
```

### Variant

other · +28 -0

```diff
@@ -13,0 +13,2 @@
+public record Variant : IObjectWithId<Variant>
+{
@@ -31,0 +31,2 @@
+
+    private Guid _id;
@@ -46,0 +46,1 @@
+
@@ -49,0 +49,1 @@
+
@@ -59,0 +59,1 @@
+
@@ -71,0 +71,1 @@
+
@@ -81,0 +81,1 @@
+
@@ -98,0 +98,18 @@
+
+    //variant lists have no user-meaningful order, so both IMiniLcmApi implementations sort them by
+    //their composite key — deterministic and culture-free, unlike headword sorting (which is why
+    //ComplexForms sort alphabetically: FieldWorks does; there's no such convention for variants)
+    public static readonly Comparer<Variant> VariantOfOrder = Comparer<Variant>.Create((a, b) =>
+    {
+        var result = a.MainEntryId.CompareTo(b.MainEntryId);
+        if (result != 0) return result;
+        return (a.MainSenseId ?? Guid.Empty).CompareTo(b.MainSenseId ?? Guid.Empty);
+    });
+
+    public static readonly Comparer<Variant> VariantsOrder = Comparer<Variant>.Create((a, b) =>
+    {
+        var result = a.VariantEntryId.CompareTo(b.VariantEntryId);
+        if (result != 0) return result;
+        return (a.MainSenseId ?? Guid.Empty).CompareTo(b.MainSenseId ?? Guid.Empty);
+    });
+
@@ -121,0 +121,1 @@
+}
```

## backend/FwLite/MiniLcm/Models/Variant.cs

### Variant.ToString

method · +5 -0

```diff
@@ -116,0 +116,5 @@
+    public override string ToString()
+    {
+        return
+            $"{nameof(DeletedAt)}: {DeletedAt}, {nameof(VariantEntryId)}: {VariantEntryId}, {nameof(VariantHeadword)}: {VariantHeadword}, {nameof(MainEntryId)}: {MainEntryId}, {nameof(MainSenseId)}: {MainSenseId}, {nameof(MainHeadword)}: {MainHeadword}, Types: [{string.Join(", ", Types.Select(t => t.Id))}]";
+    }
```

## backend/FwLite/MiniLcm/Models/VariantType.cs

### MiniLcm.Models

other · +1 -0

```diff
@@ -0,0 +1,1 @@
+namespace MiniLcm.Models;
```

## backend/FwLite/MiniLcm/Models/VariantType.cs

### lines 2–2

other · +1 -0 · low-signal (whitespace)

```diff
@@ -2,0 +2,1 @@
+
```

## backend/FwLite/MiniLcm/Models/VariantType.cs

### VariantType.Id

method · +1 -0

```diff
@@ -5,0 +5,1 @@
+    public virtual Guid Id { get; set; }
```

## backend/FwLite/MiniLcm/Models/VariantType.cs

### VariantType.Name

method · +1 -0

```diff
@@ -6,0 +6,1 @@
+    public virtual required MultiString Name { get; set; }
```

## backend/FwLite/MiniLcm/Models/VariantType.cs

### VariantType.DeletedAt

method · +1 -0

```diff
@@ -8,0 +8,1 @@
+    public DateTimeOffset? DeletedAt { get; set; }
```

## backend/FwLite/MiniLcm/Models/VariantType.cs

### VariantType.GetReferences

method · +4 -0

```diff
@@ -10,0 +10,4 @@
+    public Guid[] GetReferences()
+    {
+        return [];
+    }
```

## backend/FwLite/MiniLcm/Models/VariantType.cs

### VariantType.RemoveReference

method · +3 -0

```diff
@@ -15,0 +15,3 @@
+    public void RemoveReference(Guid id, DateTimeOffset time)
+    {
+    }
```

## backend/FwLite/MiniLcm/Models/VariantType.cs

### VariantType.Copy

method · +4 -0

```diff
@@ -19,0 +19,4 @@
+    public VariantType Copy()
+    {
+        return new VariantType { Id = Id, Name = Name.Copy(), DeletedAt = DeletedAt };
+    }
```

### VariantType

other · +7 -0

```diff
@@ -3,0 +3,2 @@
+public record VariantType : IObjectWithId<VariantType>
+{
@@ -7,0 +7,1 @@
+
@@ -9,0 +9,1 @@
+
@@ -14,0 +14,1 @@
+
@@ -18,0 +18,1 @@
+
@@ -23,0 +23,1 @@
+}
```

## backend/FwLite/MiniLcm/Normalization/MiniLcmApiWriteNormalizationWrapper.cs

### MiniLcmApiWriteNormalizationWrapper

other · +17 -0

```diff
@@ -209,0 +210,2 @@
+    #region VariantType
+
@@ -216,0 +216,1 @@
+
@@ -221,0 +221,2 @@
+
+
@@ -227,0 +227,1 @@
+
@@ -232,0 +232,1 @@
+
@@ -240,0 +240,3 @@
+
+    #endregion
+
@@ -326,0 +326,1 @@
+
@@ -331,0 +331,1 @@
+
@@ -336,0 +336,1 @@
+
@@ -341,0 +341,1 @@
+
@@ -346,0 +346,1 @@
+
@@ -351,0 +351,1 @@
+
@@ -397,0 +397,1 @@
+
```

## backend/FwLite/MiniLcm/Normalization/MiniLcmApiWriteNormalizationWrapper.cs

### MiniLcmApiWriteNormalizationWrapper.CreateVariantType

method · +4 -0

```diff
@@ -212,0 +212,4 @@
+    public async Task<VariantType> CreateVariantType(VariantType variantType)
+    {
+        return await _api.CreateVariantType(NormalizeVariantType(variantType));
+    }
```

## backend/FwLite/MiniLcm/Normalization/MiniLcmApiWriteNormalizationWrapper.cs

### MiniLcmApiWriteNormalizationWrapper.UpdateVariantType

method · +4 -0

```diff
@@ -217,0 +217,4 @@
+    public Task<VariantType> UpdateVariantType(Guid id, UpdateObjectInput<VariantType> update)
+    {
+        return _api.UpdateVariantType(id, NormalizePatch(update));
+    }
```

## backend/FwLite/MiniLcm/Normalization/MiniLcmApiWriteNormalizationWrapper.cs

### MiniLcmApiWriteNormalizationWrapper.UpdateVariantType

method · +4 -0

```diff
@@ -223,0 +223,4 @@
+    public async Task<VariantType> UpdateVariantType(VariantType before, VariantType after, IMiniLcmApi? api = null)
+    {
+        return await _api.UpdateVariantType(NormalizeVariantType(before), NormalizeVariantType(after), api);
+    }
```

### MiniLcmApiWriteNormalizationWrapper.NormalizeVariantType

method · +7 -0

```diff
@@ -233,0 +233,7 @@
+    private static VariantType NormalizeVariantType(VariantType vt)
+    {
+        return vt with
+        {
+            Name = StringNormalizer.Normalize(vt.Name)
+        };
+    }
```

## backend/FwLite/MiniLcm/Normalization/MiniLcmApiWriteNormalizationWrapper.cs

### MiniLcmApiWriteNormalizationWrapper.DeleteVariantType

method · +4 -0

```diff
@@ -228,0 +228,4 @@
+    public Task DeleteVariantType(Guid id)
+    {
+        return _api.DeleteVariantType(id);
+    }
```

## backend/FwLite/MiniLcm/Normalization/MiniLcmApiWriteNormalizationWrapper.cs

### MiniLcmApiWriteNormalizationWrapper.CreateVariant

method · +4 -0

```diff
@@ -288,0 +322,4 @@
+    public async Task<Variant> CreateVariant(Variant variant)
+    {
+        return await _api.CreateVariant(NormalizeVariant(variant));
+    }
```

## backend/FwLite/MiniLcm/Normalization/MiniLcmApiWriteNormalizationWrapper.cs

### MiniLcmApiWriteNormalizationWrapper.UpdateVariant

method · +4 -0

```diff
@@ -327,0 +327,4 @@
+    public async Task<Variant> UpdateVariant(Variant before, Variant after, IMiniLcmApi? api = null)
+    {
+        return await _api.UpdateVariant(NormalizeVariant(before), NormalizeVariant(after), api);
+    }
```

### MiniLcmApiWriteNormalizationWrapper.NormalizeVariant

method · +10 -0

```diff
@@ -321,0 +387,10 @@
+    private static Variant NormalizeVariant(Variant variant)
+    {
+        return variant with
+        {
+            VariantHeadword = StringNormalizer.Normalize(variant.VariantHeadword),
+            MainHeadword = StringNormalizer.Normalize(variant.MainHeadword),
+            Comment = StringNormalizer.Normalize(variant.Comment),
+            Types = [.. variant.Types.Select(NormalizeVariantType)]
+        };
+    }
```

## backend/FwLite/MiniLcm/Normalization/MiniLcmApiWriteNormalizationWrapper.cs

### MiniLcmApiWriteNormalizationWrapper.SubmitUpdateVariant

method · +4 -0

```diff
@@ -332,0 +332,4 @@
+    public Task SubmitUpdateVariant(Variant variant, UpdateObjectInput<Variant> update)
+    {
+        return _api.SubmitUpdateVariant(variant, NormalizePatch(update));
+    }
```

## backend/FwLite/MiniLcm/Normalization/MiniLcmApiWriteNormalizationWrapper.cs

### MiniLcmApiWriteNormalizationWrapper.DeleteVariant

method · +4 -0

```diff
@@ -337,0 +337,4 @@
+    public Task DeleteVariant(Variant variant)
+    {
+        return _api.DeleteVariant(variant);
+    }
```

## backend/FwLite/MiniLcm/Normalization/MiniLcmApiWriteNormalizationWrapper.cs

### MiniLcmApiWriteNormalizationWrapper.AddVariantType

method · +4 -0

```diff
@@ -342,0 +342,4 @@
+    public Task AddVariantType(Variant variant, Guid variantTypeId)
+    {
+        return _api.AddVariantType(variant, variantTypeId);
+    }
```

## backend/FwLite/MiniLcm/Normalization/MiniLcmApiWriteNormalizationWrapper.cs

### MiniLcmApiWriteNormalizationWrapper.RemoveVariantType

method · +4 -0

```diff
@@ -347,0 +347,4 @@
+    public Task RemoveVariantType(Variant variant, Guid variantTypeId)
+    {
+        return _api.RemoveVariantType(variant, variantTypeId);
+    }
```

## backend/FwLite/MiniLcm/Normalization/MiniLcmApiWriteNormalizationWrapper.cs

### MiniLcmApiWriteNormalizationWrapper.NormalizeEntry

method · +3 -1

```diff
@@ -309,1 +372,3 @@
-            ComplexForms = [.. entry.ComplexForms.Select(NormalizeComplexFormComponent)]
+            ComplexForms = [.. entry.ComplexForms.Select(NormalizeComplexFormComponent)],
+            VariantOf = [.. entry.VariantOf.Select(NormalizeVariant)],
+            Variants = [.. entry.Variants.Select(NormalizeVariant)]
```

## backend/FwLite/MiniLcm/ProjectSnapshot.cs

### ProjectSnapshot

other · +3 -0

```diff
@@ -11,0 +12,1 @@
+    VariantType[] VariantTypes,
@@ -16,0 +16,2 @@
+
+    //snapshots and templates serialized before variant support deserialize this as null
```

## backend/FwLite/MiniLcm/ProjectSnapshot.cs

### ProjectSnapshot.VariantTypes

method · +1 -0

```diff
@@ -18,0 +18,1 @@
+    public VariantType[] VariantTypes { get; init; } = VariantTypes ?? [];
```

## backend/FwLite/MiniLcm/SyncHelpers/EntrySync.cs

### EntrySync.SyncComplexFormsAndComponents

method · +2 -0

```diff
@@ -72,0 +73,2 @@
+            changes += await SyncVariants(beforeEntry.VariantOf, afterEntry.VariantOf, api);
+            changes += await SyncVariants(beforeEntry.Variants, afterEntry.Variants, api);
```

### EntrySync.SyncVariants

method · +8 -0

```diff
@@ -120,0 +123,8 @@
+    private static async Task<int> SyncVariants(IList<Variant> beforeVariants, IList<Variant> afterVariants, IMiniLcmApi api)
+    {
+        return await DiffCollection.Diff(
+            beforeVariants,
+            afterVariants,
+            new VariantsDiffApi(api)
+        );
+    }
```

### EntrySync.VariantsDiffApi

other · +6 -0

```diff
@@ -288,0 +300,2 @@
+    private class VariantsDiffApi(IMiniLcmApi api) : CollectionDiffApi<Variant, (Guid, Guid, Guid?)>
+    {
@@ -307,0 +307,1 @@
+
@@ -313,0 +313,1 @@
+
@@ -319,0 +319,1 @@
+
@@ -325,0 +325,1 @@
+    }
```

## backend/FwLite/MiniLcm/SyncHelpers/EntrySync.cs

### EntrySync

other · +2 -0 · low-signal (whitespace)

```diff
@@ -131,0 +131,1 @@
+
@@ -326,0 +326,1 @@
+
```

## backend/FwLite/MiniLcm/SyncHelpers/EntrySync.cs

### EntrySync.VariantsDiffApi.GetId

method · +5 -0

```diff
@@ -302,0 +302,5 @@
+        public override (Guid, Guid, Guid?) GetId(Variant variant)
+        {
+            //we can't use the ID as there's none defined by Fw so it won't work as a sync key
+            return (variant.VariantEntryId, variant.MainEntryId, variant.MainSenseId);
+        }
```

## backend/FwLite/MiniLcm/SyncHelpers/EntrySync.cs

### EntrySync.VariantsDiffApi.Add

method · +5 -0

```diff
@@ -308,0 +308,5 @@
+        public override async Task<int> Add(Variant after)
+        {
+            await api.SubmitCreateVariant(after);
+            return 1;
+        }
```

### IMiniLcmWriteApi.SubmitCreateVariant — from backend/FwLite/MiniLcm/IMiniLcmWriteApi.cs

method · +1 -0

```diff
@@ -148,0 +163,1 @@
+    Task SubmitCreateVariant(Variant variant) => CreateVariant(variant);
```

### IMiniLcmWriteApi.CreateVariant — from backend/FwLite/MiniLcm/IMiniLcmWriteApi.cs

method · +1 -0

```diff
@@ -77,0 +77,1 @@
+    Task<Variant> CreateVariant(Variant variant);
```

## backend/FwLite/MiniLcm/SyncHelpers/EntrySync.cs

### EntrySync.VariantsDiffApi.Remove

method · +5 -0

```diff
@@ -314,0 +314,5 @@
+        public override async Task<int> Remove(Variant before)
+        {
+            await api.DeleteVariant(before);
+            return 1;
+        }
```

### IMiniLcmWriteApi.DeleteVariant — from backend/FwLite/MiniLcm/IMiniLcmWriteApi.cs

method · +1 -0

```diff
@@ -79,0 +79,1 @@
+    Task DeleteVariant(Variant variant);
```

## backend/FwLite/MiniLcm/SyncHelpers/EntrySync.cs

### EntrySync.VariantsDiffApi.Replace

method · +5 -0

```diff
@@ -320,0 +320,5 @@
+        public override Task<int> Replace(Variant beforeVariant, Variant afterVariant)
+        {
+            //endpoints match (same composite key) — sync the link's own data (types, HideMinorEntry, Comment)
+            return VariantSync.Sync(beforeVariant, afterVariant, api);
+        }
```

## backend/FwLite/MiniLcm/SyncHelpers/VariantSync.cs

### lines 1–6

other · +5 -0

```diff
@@ -0,0 +1,4 @@
+using MiniLcm.Models;
+using SystemTextJsonPatch;
+using SystemTextJsonPatch.Operations;
+
@@ -6,0 +6,1 @@
+
```

## backend/FwLite/MiniLcm/SyncHelpers/VariantSync.cs

### MiniLcm.SyncHelpers

other · +1 -0

```diff
@@ -5,0 +5,1 @@
+namespace MiniLcm.SyncHelpers;
```

## backend/FwLite/MiniLcm/SyncHelpers/VariantSync.cs

### VariantSync

other · +10 -0

```diff
@@ -7,0 +7,7 @@
+public static class VariantSync
+{
+    /// <summary>
+    /// Syncs one variant link's own data (types, HideMinorEntry, Comment). The link is
+    /// located by its composite key; changing endpoints is delete-and-recreate, handled by
+    /// the collection diff in <see cref="EntrySync"/>.
+    /// </summary>
@@ -26,0 +26,1 @@
+
@@ -36,0 +36,1 @@
+
@@ -57,0 +57,1 @@
+}
```

## backend/FwLite/MiniLcm/SyncHelpers/VariantSync.cs

### VariantSync.Sync

method · +12 -0

```diff
@@ -14,0 +14,12 @@
+    public static async Task<int> Sync(Variant before, Variant after, IMiniLcmApi api)
+    {
+        var changes = 0;
+        var updateObjectInput = VariantDiffToUpdate(before, after);
+        if (updateObjectInput is not null)
+        {
+            await api.SubmitUpdateVariant(after, updateObjectInput);
+            changes++;
+        }
+        changes += await DiffCollection.Diff(before.Types, after.Types, new VariantTypesDiffApi(api, after));
+        return changes;
+    }
```

### VariantSync.VariantDiffToUpdate

method · +9 -0

```diff
@@ -27,0 +27,9 @@
+    public static UpdateObjectInput<Variant>? VariantDiffToUpdate(Variant before, Variant after)
+    {
+        JsonPatchDocument<Variant> patchDocument = new();
+        if (before.HideMinorEntry != after.HideMinorEntry)
+            patchDocument.Operations.Add(new Operation<Variant>("replace", $"/{nameof(Variant.HideMinorEntry)}", null, after.HideMinorEntry));
+        patchDocument.Operations.AddRange(MultiStringDiff.GetMultiStringDiff<Variant>(nameof(Variant.Comment), before.Comment, after.Comment));
+        if (patchDocument.Operations.Count == 0) return null;
+        return new UpdateObjectInput<Variant>(patchDocument);
+    }
```

## backend/FwLite/MiniLcm/IMiniLcmWriteApi.cs

### IMiniLcmWriteApi.SubmitUpdateVariant

method · +1 -0

```diff
@@ -168,0 +168,1 @@
+    Task SubmitUpdateVariant(Variant variant, UpdateObjectInput<Variant> update);
```

## backend/FwLite/MiniLcm/SyncHelpers/VariantSync.cs

### VariantSync.VariantTypesDiffApi

other · +5 -0

```diff
@@ -37,0 +37,2 @@
+    private class VariantTypesDiffApi(IMiniLcmApi api, Variant variant) : ObjectWithIdCollectionDiffApi<VariantType>
+    {
@@ -44,0 +44,1 @@
+
@@ -50,0 +50,1 @@
+
@@ -56,0 +56,1 @@
+    }
```

## backend/FwLite/MiniLcm/SyncHelpers/VariantSync.cs

### VariantSync.VariantTypesDiffApi.Add

method · +5 -0

```diff
@@ -39,0 +39,5 @@
+        public override async Task<int> Add(VariantType afterVariantType)
+        {
+            await api.AddVariantType(variant, afterVariantType.Id);
+            return 1;
+        }
```

### IMiniLcmWriteApi.AddVariantType — from backend/FwLite/MiniLcm/IMiniLcmWriteApi.cs

method · +1 -0

```diff
@@ -80,0 +80,1 @@
+    Task AddVariantType(Variant variant, Guid variantTypeId);
```

## backend/FwLite/MiniLcm/SyncHelpers/VariantSync.cs

### VariantSync.VariantTypesDiffApi.Remove

method · +5 -0

```diff
@@ -45,0 +45,5 @@
+        public override async Task<int> Remove(VariantType beforeVariantType)
+        {
+            await api.RemoveVariantType(variant, beforeVariantType.Id);
+            return 1;
+        }
```

### IMiniLcmWriteApi.RemoveVariantType — from backend/FwLite/MiniLcm/IMiniLcmWriteApi.cs

method · +1 -0

```diff
@@ -81,0 +81,1 @@
+    Task RemoveVariantType(Variant variant, Guid variantTypeId);
```

## backend/FwLite/MiniLcm/SyncHelpers/VariantSync.cs

### VariantSync.VariantTypesDiffApi.Replace

method · +5 -0

```diff
@@ -51,0 +51,5 @@
+        public override Task<int> Replace(VariantType before, VariantType after)
+        {
+            // type renames sync via VariantTypeSync (top-level list), not through the link
+            return Task.FromResult(0);
+        }
```

## backend/FwLite/MiniLcm/SyncHelpers/VariantTypeSync.cs

### lines 1–5

other · +4 -0

```diff
@@ -0,0 +1,3 @@
+using MiniLcm.Models;
+using SystemTextJsonPatch;
+
@@ -5,0 +5,1 @@
+
```

## backend/FwLite/MiniLcm/SyncHelpers/VariantTypeSync.cs

### MiniLcm.SyncHelpers

other · +1 -0

```diff
@@ -4,0 +4,1 @@
+namespace MiniLcm.SyncHelpers;
```

## backend/FwLite/MiniLcm/SyncHelpers/VariantTypeSync.cs

### VariantTypeSync

other · +6 -0

```diff
@@ -6,0 +6,2 @@
+public static class VariantTypeSync
+{
@@ -17,0 +17,1 @@
+
@@ -26,0 +26,1 @@
+
@@ -36,0 +36,1 @@
+
@@ -56,0 +56,1 @@
+}
```

## backend/FwLite/MiniLcm/SyncHelpers/VariantTypeSync.cs

### VariantTypeSync.Sync

method · +9 -0

```diff
@@ -8,0 +8,9 @@
+    public static async Task<int> Sync(VariantType[] beforeVariantTypes,
+        VariantType[] afterVariantTypes,
+        IMiniLcmApi api)
+    {
+        return await DiffCollection.Diff(
+            beforeVariantTypes,
+            afterVariantTypes,
+            new VariantTypesDiffApi(api));
+    }
```

### VariantTypeSync.VariantTypesDiffApi

other · +5 -0

```diff
@@ -37,0 +37,2 @@
+    private class VariantTypesDiffApi(IMiniLcmApi api) : ObjectWithIdCollectionDiffApi<VariantType>
+    {
@@ -44,0 +44,1 @@
+
@@ -50,0 +50,1 @@
+
@@ -55,0 +55,1 @@
+    }
```

## backend/FwLite/MiniLcm/SyncHelpers/VariantTypeSync.cs

### VariantTypeSync.Sync

method · +8 -0

```diff
@@ -18,0 +18,8 @@
+    public static async Task<int> Sync(VariantType before,
+        VariantType after,
+        IMiniLcmApi api)
+    {
+        var updateObjectInput = VariantTypeDiffToUpdate(before, after);
+        if (updateObjectInput is not null) await api.SubmitUpdateVariantType(after.Id, updateObjectInput);
+        return updateObjectInput is null ? 0 : 1;
+    }
```

### VariantTypeSync.VariantTypeDiffToUpdate

method · +9 -0

```diff
@@ -27,0 +27,9 @@
+    public static UpdateObjectInput<VariantType>? VariantTypeDiffToUpdate(VariantType before, VariantType after)
+    {
+        JsonPatchDocument<VariantType> patchDocument = new();
+        patchDocument.Operations.AddRange(MultiStringDiff.GetMultiStringDiff<VariantType>(nameof(VariantType.Name),
+            before.Name,
+            after.Name));
+        if (patchDocument.Operations.Count == 0) return null;
+        return new UpdateObjectInput<VariantType>(patchDocument);
+    }
```

## backend/FwLite/MiniLcm/IMiniLcmWriteApi.cs

### IMiniLcmWriteApi.SubmitUpdateVariantType

method · +1 -0

```diff
@@ -159,0 +180,1 @@
+    Task SubmitUpdateVariantType(Guid id, UpdateObjectInput<VariantType> update) => UpdateVariantType(id, update);
```

## backend/FwLite/MiniLcm/SyncHelpers/VariantTypeSync.cs

### VariantTypeSync.VariantTypesDiffApi.Add

method · +5 -0

```diff
@@ -39,0 +39,5 @@
+        public override async Task<int> Add(VariantType afterVariantType)
+        {
+            await api.CreateVariantType(afterVariantType);
+            return 1;
+        }
```

### IMiniLcmWriteApi.CreateVariantType — from backend/FwLite/MiniLcm/IMiniLcmWriteApi.cs

method · +1 -0

```diff
@@ -48,0 +48,1 @@
+    Task<VariantType> CreateVariantType(VariantType variantType);
```

## backend/FwLite/MiniLcm/SyncHelpers/VariantTypeSync.cs

### VariantTypeSync.VariantTypesDiffApi.Remove

method · +5 -0

```diff
@@ -45,0 +45,5 @@
+        public override async Task<int> Remove(VariantType beforeVariantType)
+        {
+            await api.DeleteVariantType(beforeVariantType.Id);
+            return 1;
+        }
```

### IMiniLcmWriteApi.DeleteVariantType — from backend/FwLite/MiniLcm/IMiniLcmWriteApi.cs

method · +1 -0

```diff
@@ -51,0 +51,1 @@
+    Task DeleteVariantType(Guid id);
```

## backend/FwLite/MiniLcm/SyncHelpers/VariantTypeSync.cs

### VariantTypeSync.VariantTypesDiffApi.Replace

method · +4 -0

```diff
@@ -51,0 +51,4 @@
+        public override Task<int> Replace(VariantType beforeVariantType, VariantType afterVariantType)
+        {
+            return Sync(beforeVariantType, afterVariantType, api);
+        }
```

## backend/FwLite/MiniLcm/Validators/EntryValidator.cs

### EntryValidator.EntryValidator

method · +8 -0

```diff
@@ -24,0 +25,8 @@
+        RuleForEach(e => e.VariantOf).Must(NotBeEmptyMainEntryReference).WithMessage("Variant main-entry reference must not be empty.");
+        RuleForEach(e => e.VariantOf).Must(NotBeVariantOfSelfReference).WithMessage("Variant main-entry reference must not be the same as the entry.");
+        RuleForEach(e => e.VariantOf).Must(HaveCorrectVariantEntryReference).WithMessage("Variant entry reference must be correct.");
+        RuleForEach(e => e.Variants).Must(NotBeEmptyVariantEntryReference).WithMessage("Variant entry reference must not be empty.");
+        RuleForEach(e => e.Variants).Must(NotBeVariantSelfReference).WithMessage("Variant entry reference must not be the same as the entry.");
+        RuleForEach(e => e.Variants).Must(HaveCorrectMainEntryReference).WithMessage("Variant main-entry reference must be correct.");
+        RuleForEach(e => e.VariantOf).SetValidator(new VariantValidator());
+        RuleForEach(e => e.Variants).SetValidator(new VariantValidator());
```

## backend/FwLite/MiniLcm/Validators/EntryValidator.cs

### EntryValidator.NotBeEmptyMainEntryReference

method · +4 -0

```diff
@@ -53,0 +62,4 @@
+    private bool NotBeEmptyMainEntryReference(Entry entry, Variant variant)
+    {
+        return variant.MainEntryId != Guid.Empty;
+    }
```

## backend/FwLite/MiniLcm/Validators/EntryValidator.cs

### EntryValidator

other · +6 -0 · low-signal (whitespace)

```diff
@@ -66,0 +66,1 @@
+
@@ -71,0 +71,1 @@
+
@@ -76,0 +76,1 @@
+
@@ -82,0 +82,1 @@
+
@@ -87,0 +87,1 @@
+
@@ -93,0 +93,1 @@
+
```

## backend/FwLite/MiniLcm/Validators/EntryValidator.cs

### EntryValidator.NotBeEmptyVariantEntryReference

method · +4 -0

```diff
@@ -67,0 +67,4 @@
+    private bool NotBeEmptyVariantEntryReference(Entry entry, Variant variant)
+    {
+        return variant.VariantEntryId != Guid.Empty;
+    }
```

## backend/FwLite/MiniLcm/Validators/EntryValidator.cs

### EntryValidator.NotBeVariantOfSelfReference

method · +4 -0

```diff
@@ -72,0 +72,4 @@
+    private bool NotBeVariantOfSelfReference(Entry entry, Variant variant)
+    {
+        return variant.MainEntryId != entry.Id;
+    }
```

## backend/FwLite/MiniLcm/Validators/EntryValidator.cs

### EntryValidator.HaveCorrectVariantEntryReference

method · +5 -0

```diff
@@ -77,0 +77,5 @@
+    private bool HaveCorrectVariantEntryReference(Entry entry, Variant variant)
+    {
+        // Empty GUID is okay here because it can be guessed from the parent object
+        return variant.VariantEntryId == entry.Id || variant.VariantEntryId == Guid.Empty;
+    }
```

## backend/FwLite/MiniLcm/Validators/EntryValidator.cs

### EntryValidator.NotBeVariantSelfReference

method · +4 -0

```diff
@@ -83,0 +83,4 @@
+    private bool NotBeVariantSelfReference(Entry entry, Variant variant)
+    {
+        return variant.VariantEntryId != entry.Id || variant.VariantEntryId == Guid.Empty;
+    }
```

## backend/FwLite/MiniLcm/Validators/EntryValidator.cs

### EntryValidator.HaveCorrectMainEntryReference

method · +5 -0

```diff
@@ -88,0 +88,5 @@
+    private bool HaveCorrectMainEntryReference(Entry entry, Variant variant)
+    {
+        // Empty GUID is okay here because it can be guessed from the parent object
+        return variant.MainEntryId == entry.Id || variant.MainEntryId == Guid.Empty;
+    }
```

## backend/FwLite/MiniLcm/Validators/MiniLcmApiValidationWrapper.cs

### MiniLcmApiValidationWrapper.CreateVariantType

method · +5 -0

```diff
@@ -131,0 +132,5 @@
+    public async Task<VariantType> CreateVariantType(VariantType variantType)
+    {
+        await validators.ValidateAndThrow(variantType);
+        return await _api.CreateVariantType(variantType);
+    }
```

## backend/FwLite/MiniLcm/Validators/MiniLcmApiValidationWrapper.cs

### MiniLcmApiValidationWrapper

other · +4 -0 · low-signal (whitespace)

```diff
@@ -137,0 +137,1 @@
+
@@ -143,0 +143,1 @@
+
@@ -149,0 +149,1 @@
+
@@ -155,0 +155,1 @@
+
```

## backend/FwLite/MiniLcm/Validators/MiniLcmApiValidationWrapper.cs

### MiniLcmApiValidationWrapper.UpdateVariantType

method · +5 -0

```diff
@@ -138,0 +138,5 @@
+    public async Task<VariantType> UpdateVariantType(VariantType before, VariantType after, IMiniLcmApi? api = null)
+    {
+        await validators.ValidateAndThrow(after);
+        return await _api.UpdateVariantType(before, after, api ?? this);
+    }
```

## backend/FwLite/MiniLcm/Validators/MiniLcmApiValidationWrapper.cs

### MiniLcmApiValidationWrapper.CreateVariant

method · +5 -0

```diff
@@ -144,0 +144,5 @@
+    public async Task<Variant> CreateVariant(Variant variant)
+    {
+        await validators.ValidateAndThrow(variant);
+        return await _api.CreateVariant(variant);
+    }
```

## backend/FwLite/MiniLcm/Validators/MiniLcmApiValidationWrapper.cs

### MiniLcmApiValidationWrapper.UpdateVariant

method · +5 -0

```diff
@@ -150,0 +150,5 @@
+    public async Task<Variant> UpdateVariant(Variant before, Variant after, IMiniLcmApi? api = null)
+    {
+        await validators.ValidateAndThrow(after);
+        return await _api.UpdateVariant(before, after, api ?? this);
+    }
```

## backend/FwLite/MiniLcm/Validators/MiniLcmValidators.cs

### MiniLcmValidators

other · +4 -0

```diff
@@ -10,0 +11,2 @@
+    IValidator<VariantType> VariantTypeValidator,
+    IValidator<Variant> VariantValidator,
@@ -34,0 +34,1 @@
+
@@ -39,0 +39,1 @@
+
```

## backend/FwLite/MiniLcm/Validators/MiniLcmValidators.cs

### MiniLcmValidators.ValidateAndThrow

method · +4 -0

```diff
@@ -27,0 +30,4 @@
+    public async Task ValidateAndThrow(VariantType value)
+    {
+        await VariantTypeValidator.ValidateAndThrowAsync(value);
+    }
```

## backend/FwLite/MiniLcm/Validators/MiniLcmValidators.cs

### MiniLcmValidators.ValidateAndThrow

method · +4 -0

```diff
@@ -35,0 +35,4 @@
+    public async Task ValidateAndThrow(Variant value)
+    {
+        await VariantValidator.ValidateAndThrowAsync(value);
+    }
```

## backend/FwLite/MiniLcm/Validators/MiniLcmValidators.cs

### MiniLcmValidatorsExtensions.AddMiniLcmValidators

method · +2 -0

```diff
@@ -90,0 +103,2 @@
+        services.AddTransient<IValidator<VariantType>, VariantTypeValidator>();
+        services.AddTransient<IValidator<Variant>, VariantValidator>();
```

## backend/FwLite/MiniLcm/Validators/VariantTypeValidator.cs

### lines 1–5

other · +4 -0

```diff
@@ -0,0 +1,3 @@
+using FluentValidation;
+using MiniLcm.Models;
+
@@ -5,0 +5,1 @@
+
```

## backend/FwLite/MiniLcm/Validators/VariantTypeValidator.cs

### MiniLcm.Validators

other · +1 -0

```diff
@@ -4,0 +4,1 @@
+namespace MiniLcm.Validators;
```

## backend/FwLite/MiniLcm/Validators/VariantTypeValidator.cs

### VariantTypeValidator

other · +3 -0

```diff
@@ -6,0 +6,2 @@
+internal class VariantTypeValidator : AbstractValidator<VariantType>
+{
@@ -13,0 +13,1 @@
+}
```

## backend/FwLite/MiniLcm/Validators/VariantTypeValidator.cs

### VariantTypeValidator.VariantTypeValidator

method · +5 -0

```diff
@@ -8,0 +8,5 @@
+    public VariantTypeValidator()
+    {
+        RuleFor(c => c.DeletedAt).Null();
+        RuleFor(c => c.Name).Required(c => c.Id.ToString("D"));
+    }
```

## backend/FwLite/MiniLcm/Validators/VariantValidator.cs

### lines 1–5 — from backend/FwLite/MiniLcm.Tests/Validators/VariantTypeValidationTests.cs

other · +4 -0

```diff
@@ -0,0 +1,3 @@
+using FluentValidation.TestHelper;
+using MiniLcm.Validators;
+
@@ -5,0 +5,1 @@
+
```

### lines 1–5 — from backend/FwLite/MiniLcm.Tests/Validators/VariantValidationTests.cs

other · +4 -0

```diff
@@ -0,0 +1,3 @@
+using FluentValidation.TestHelper;
+using MiniLcm.Validators;
+
@@ -5,0 +5,1 @@
+
```

### lines 1–5

other · +4 -0

```diff
@@ -0,0 +1,3 @@
+using FluentValidation;
+using MiniLcm.Models;
+
@@ -5,0 +5,1 @@
+
```

## backend/FwLite/MiniLcm/Validators/VariantValidator.cs

### MiniLcm.Validators

other · +1 -0

```diff
@@ -4,0 +4,1 @@
+namespace MiniLcm.Validators;
```

## backend/FwLite/MiniLcm/Validators/VariantValidator.cs

### VariantValidator

other · +4 -0

```diff
@@ -6,0 +6,2 @@
+internal class VariantValidator : AbstractValidator<Variant>
+{
@@ -19,0 +19,1 @@
+
@@ -24,0 +24,1 @@
+}
```

## backend/FwLite/MiniLcm/Validators/VariantValidator.cs

### VariantValidator.VariantValidator

method · +11 -0

```diff
@@ -8,0 +8,11 @@
+    public VariantValidator()
+    {
+        RuleFor(v => v.DeletedAt).Null();
+        //one endpoint may be an empty guid when nested in an entry (inferred from the parent),
+        //so only reject self-reference when both are set
+        RuleFor(v => v)
+            .Must(v => v.VariantEntryId == Guid.Empty || v.VariantEntryId != v.MainEntryId)
+            .WithMessage(v => $"Variant {GetIdentifier(v)} must not be a variant of itself.");
+        RuleFor(v => v.Comment).NoEmptyValues(GetIdentifier).NoDefaultWritingSystems(GetIdentifier);
+        RuleForEach(v => v.Types).SetValidator(new VariantTypeValidator());
+    }
```

### VariantValidator.GetIdentifier

method · +4 -0

```diff
@@ -20,0 +20,4 @@
+    private string GetIdentifier(Variant variant)
+    {
+        return $"{variant.VariantHeadword} -> {variant.MainHeadword} ({variant.VariantEntryId} -> {variant.MainEntryId})";
+    }
```

## backend/LfClassicData/LfClassicMiniLcmApi.cs

### LfClassicMiniLcmApi.GetVariantTypes

method · +4 -0

```diff
@@ -28,0 +29,4 @@
+    public IAsyncEnumerable<VariantType> GetVariantTypes()
+    {
+        return AsyncEnumerable.Empty<VariantType>();
+    }
```

### ProjectSnapshot.Empty — from backend/FwLite/MiniLcm/ProjectSnapshot.cs

method · +1 -1

```diff
@@ -14,1 +15,1 @@
-    public static ProjectSnapshot Empty { get; } = new([], [], [], [], [], [], new WritingSystems());
+    public static ProjectSnapshot Empty { get; } = new([], [], [], [], [], [], [], new WritingSystems());
```

## backend/LfClassicData/LfClassicMiniLcmApi.cs

### LfClassicMiniLcmApi

other · +2 -0 · low-signal (whitespace)

```diff
@@ -33,0 +33,1 @@
+
@@ -38,0 +38,1 @@
+
```

## backend/LfClassicData/LfClassicMiniLcmApi.cs

### LfClassicMiniLcmApi.GetVariantType

method · +4 -0

```diff
@@ -34,0 +34,4 @@
+    public Task<VariantType?> GetVariantType(Guid id)
+    {
+        return Task.FromResult<VariantType?>(null);
+    }
```

## frontend/viewer/src/lib/dotnet-types/index.ts

### lines 13–14

other · +2 -0

```diff
@@ -12,0 +13,2 @@
+export * from './generated-types/MiniLcm/Models/IVariant';
+export * from './generated-types/MiniLcm/Models/IVariantType';
```

## frontend/viewer/src/project/data/index.ts

### lines 6–6

other · +1 -0

```diff
@@ -5,0 +6,1 @@
+export * from './variant-types';
```

## frontend/viewer/src/project/data/variant-types.ts

### lines 1–10

other · +6 -0

```diff
@@ -0,0 +1,3 @@
+import {useProjectContext} from '$project/project-context.svelte';
+
+const variantTypesSymbol = Symbol.for('fw-lite-variant-types');
@@ -8,0 +8,3 @@
+
+/** Unspecified Variant — the type FLEx assigns when none is chosen (well-known guid) */
+export const UNSPECIFIED_VARIANT_TYPE_ID = '3942addb-99fd-43e9-ab7d-99025ceb0d4e';
```

## frontend/viewer/src/project/data/variant-types.ts

### useVariantTypes

method · +4 -0

```diff
@@ -4,0 +4,4 @@
+export function useVariantTypes() {
+  const projectContext = useProjectContext();
+  return projectContext.getOrAddAsync(variantTypesSymbol, [], api => api.getVariantTypes());
+}
```

## frontend/viewer/src/project/demo/demo-entry-data.ts

### lines 1–368

other · +34 -3

```diff
@@ -1,1 +1,1 @@
-import {type IEntry, type IMorphType, type IWritingSystems, MorphTypeKind, WritingSystemType} from '$lib/dotnet-types';
+import {type IEntry, type IMorphType, type IVariant, type IVariantType, type IWritingSystems, MorphTypeKind, WritingSystemType} from '$lib/dotnet-types';
@@ -210,1 +210,1 @@
-    complexForms: [], complexFormTypes: [], components: [], publishIn: [],
+    complexForms: [], complexFormTypes: [], components: [], variantOf: [], variants: [], publishIn: [],
@@ -279,0 +280,2 @@
+    variantOf: [],
+    variants: [],
@@ -324,1 +326,1 @@
-  complexForms: [], complexFormTypes: [], components: [], publishIn: [],
+  complexForms: [], complexFormTypes: [], components: [], variantOf: [], variants: [], publishIn: [],
@@ -336,0 +339,6 @@
+// entries in the JSON blob predate variants
+for (const entry of entries) {
+  entry.variantOf ??= [];
+  entry.variants ??= [];
+}
+
@@ -337,0 +346,23 @@
+
+// FLEx standard variant types (well-known guids)
+export const variantTypes: IVariantType[] = [
+  {id: '3942addb-99fd-43e9-ab7d-99025ceb0d4e', name: {en: 'Unspecified Variant'}},
+  {id: '024b62c9-93b3-41a0-ab19-587a0030219a', name: {en: 'Dialectal Variant'}},
+  {id: '0c4663b3-4d9a-47af-b9a1-c8565d8112ed', name: {en: 'Spelling Variant'}},
+];
+
+// seed a variant pair so the demo project shows the feature
+const demoVariantEntry = entries[2];
+const demoMainEntry = entries[3];
+const demoVariant: IVariant = {
+  id: 'b6d5be87-9958-0d55-8788-79e04c8cc001',
+  variantEntryId: demoVariantEntry.id,
+  variantHeadword: Object.values(demoVariantEntry.citationForm)[0] ?? Object.values(demoVariantEntry.lexemeForm)[0],
+  mainEntryId: demoMainEntry.id,
+  mainHeadword: Object.values(demoMainEntry.citationForm)[0] ?? Object.values(demoMainEntry.lexemeForm)[0],
+  types: [variantTypes[0]],
+  hideMinorEntry: false,
+  comment: {},
+};
+demoVariantEntry.variantOf = [demoVariant];
+demoMainEntry.variants = [demoVariant];
```

## frontend/viewer/src/project/demo/in-memory-demo-api.ts

### lines 6–31

other · +3 -1

```diff
@@ -5,0 +6,2 @@
+  type IVariant,
+  type IVariantType,
@@ -29,1 +31,1 @@
-import {entries, morphTypes, partsOfSpeech, projectName, writingSystems} from './demo-entry-data';
+import {entries, morphTypes, partsOfSpeech, projectName, variantTypes, writingSystems} from './demo-entry-data';
```

## frontend/viewer/src/project/demo/in-memory-demo-api.ts

### InMemoryDemoApi.getVariantTypes

method · +3 -0

```diff
@@ -469,0 +472,3 @@
+  getVariantTypes(): Promise<IVariantType[]> {
+    return Promise.resolve(variantTypes);
+  }
```

## frontend/viewer/src/project/demo/in-memory-demo-api.ts

### InMemoryDemoApi

other · +6 -0 · low-signal (whitespace)

```diff
@@ -475,0 +475,1 @@
+
@@ -479,0 +479,1 @@
+
@@ -483,0 +483,1 @@
+
@@ -487,0 +487,1 @@
+
@@ -491,0 +491,1 @@
+
@@ -495,0 +495,1 @@
+
```

## frontend/viewer/src/project/demo/in-memory-demo-api.ts

### InMemoryDemoApi.getVariantType

method · +3 -0

```diff
@@ -476,0 +476,3 @@
+  getVariantType(_id: string): Promise<IVariantType | null> {
+    return Promise.resolve(variantTypes.find(vt => vt.id === _id) ?? null);
+  }
```

## frontend/viewer/src/project/demo/in-memory-demo-api.ts

### InMemoryDemoApi.createVariant

method · +3 -0

```diff
@@ -480,0 +480,3 @@
+  createVariant(_variant: IVariant): Promise<IVariant> {
+    throw new Error('Method not implemented.');
+  }
```

## frontend/viewer/src/project/demo/in-memory-demo-api.ts

### InMemoryDemoApi.deleteVariant

method · +3 -0

```diff
@@ -484,0 +484,3 @@
+  deleteVariant(_variant: IVariant): Promise<void> {
+    throw new Error('Method not implemented.');
+  }
```

## frontend/viewer/src/project/demo/in-memory-demo-api.ts

### InMemoryDemoApi.addVariantType

method · +3 -0

```diff
@@ -488,0 +488,3 @@
+  addVariantType(_variant: IVariant, _variantTypeId: string): Promise<void> {
+    throw new Error('Method not implemented.');
+  }
```

## frontend/viewer/src/project/demo/in-memory-demo-api.ts

### InMemoryDemoApi.removeVariantType

method · +3 -0

```diff
@@ -492,0 +492,3 @@
+  removeVariantType(_variant: IVariant, _variantTypeId: string): Promise<void> {
+    throw new Error('Method not implemented.');
+  }
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 1

other · +40 -0

```diff
@@ -100,0 +101,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -240,0 +243,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -315,0 +320,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -479,0 +486,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -530,0 +539,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -581,0 +592,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -664,0 +677,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -715,0 +730,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -766,0 +783,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -874,0 +893,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -917,0 +938,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -968,0 +991,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -1078,0 +1103,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -1165,0 +1192,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -1216,0 +1245,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -1267,0 +1298,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -1334,0 +1367,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -1385,0 +1420,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -1436,0 +1473,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -1487,0 +1526,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 2

other · +40 -0

```diff
@@ -1580,0 +1621,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -1660,0 +1703,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -1730,0 +1775,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -1817,0 +1864,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -1880,0 +1929,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -1966,0 +2017,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -2053,0 +2106,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -2173,0 +2228,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -2264,0 +2321,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -2349,0 +2408,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -2427,0 +2488,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -2478,0 +2541,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -2573,0 +2638,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -2653,0 +2720,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -2721,0 +2790,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -2782,0 +2853,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -2945,0 +3018,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -3023,0 +3098,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -3091,0 +3168,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -3159,0 +3238,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 3

other · +40 -0

```diff
@@ -3220,0 +3301,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -3283,0 +3366,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -3360,0 +3445,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -3478,0 +3565,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -3549,0 +3638,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -3634,0 +3725,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -3702,0 +3795,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -3787,0 +3882,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -3850,0 +3947,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -3930,0 +4029,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -4025,0 +4126,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -4086,0 +4189,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -4218,0 +4323,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -4322,0 +4429,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -4468,0 +4577,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -4553,0 +4664,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -4614,0 +4727,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -4675,0 +4790,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -4735,0 +4852,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -4812,0 +4931,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 4

other · +40 -0

```diff
@@ -4897,0 +5018,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -4977,0 +5100,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -5037,0 +5162,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -5098,0 +5225,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -5149,0 +5278,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -5219,0 +5350,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -5354,0 +5487,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -5507,0 +5642,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -5570,0 +5707,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -5633,0 +5772,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -5705,0 +5846,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -5773,0 +5916,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -5834,0 +5979,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -6003,0 +6150,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -6096,0 +6245,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -6168,0 +6319,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -6269,0 +6422,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -6372,0 +6527,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -6440,0 +6597,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -6503,0 +6662,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 5

other · +40 -0

```diff
@@ -6615,0 +6776,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -6732,0 +6895,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -6811,0 +6976,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -6904,0 +7071,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -6981,0 +7150,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -7075,0 +7246,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -7138,0 +7311,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -7224,0 +7399,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -7277,0 +7454,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -7362,0 +7541,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -7432,0 +7613,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -7525,0 +7708,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -7634,0 +7819,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -7713,0 +7900,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -7776,0 +7965,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -7853,0 +8044,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -7916,0 +8109,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -7986,0 +8181,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -8037,0 +8234,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -8107,0 +8306,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 6

other · +40 -0

```diff
@@ -8160,0 +8361,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -8203,0 +8406,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -8304,0 +8509,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -8384,0 +8591,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -8454,0 +8663,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -8534,0 +8745,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -8604,0 +8817,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -8674,0 +8889,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -8744,0 +8961,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -8814,0 +9033,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -8901,0 +9122,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -8952,0 +9175,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -9053,0 +9278,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -9116,0 +9343,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -9186,0 +9415,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -9327,0 +9558,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -9431,0 +9664,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -9494,0 +9729,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -9564,0 +9801,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -9627,0 +9866,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 7

other · +40 -0

```diff
@@ -9690,0 +9931,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -9753,0 +9996,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -9806,0 +10051,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -9874,0 +10121,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -9937,0 +10186,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -10000,0 +10251,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -10062,0 +10315,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -10154,0 +10409,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -10224,0 +10481,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -10294,0 +10553,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -10379,0 +10640,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -10442,0 +10705,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -10512,0 +10777,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -10589,0 +10856,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -10676,0 +10945,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -10739,0 +11010,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -10802,0 +11075,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -10940,0 +11215,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -11049,0 +11326,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -11100,0 +11379,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 8

other · +40 -0

```diff
@@ -11211,0 +11492,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -11291,0 +11574,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -11371,0 +11656,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -11443,0 +11730,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -11506,0 +11795,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -11569,0 +11860,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -11632,0 +11925,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -11695,0 +11990,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -11767,0 +12064,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -11837,0 +12136,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -11888,0 +12189,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -11968,0 +12271,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -12031,0 +12336,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -12130,0 +12437,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -12181,0 +12490,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -12268,0 +12579,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -12355,0 +12668,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -12418,0 +12733,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -12490,0 +12807,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -12579,0 +12898,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 9

other · +40 -0

```diff
@@ -12642,0 +12963,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -12726,0 +13049,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -12804,0 +13129,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -12867,0 +13194,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -12962,0 +13291,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -13039,0 +13370,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -13090,0 +13423,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -13160,0 +13495,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -13263,0 +13600,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -13326,0 +13665,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -13413,0 +13754,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -13507,0 +13850,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -13560,0 +13905,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -13630,0 +13977,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -13700,0 +14049,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -13761,0 +14112,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -13901,0 +14254,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -13964,0 +14319,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -14043,0 +14400,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -14106,0 +14465,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 10

other · +40 -0

```diff
@@ -14185,0 +14546,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -14267,0 +14630,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -14361,0 +14726,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -14448,0 +14815,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -14518,0 +14887,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -14591,0 +14962,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -14664,0 +15037,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -14734,0 +15109,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -14802,0 +15179,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -14897,0 +15276,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -14991,0 +15372,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -15061,0 +15444,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -15122,0 +15507,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -15192,0 +15579,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -15262,0 +15651,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -15315,0 +15706,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -15378,0 +15771,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -15472,0 +15867,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -15542,0 +15939,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -15612,0 +16011,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 11

other · +40 -0

```diff
@@ -15682,0 +16083,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -15762,0 +16165,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -15841,0 +16246,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -15911,0 +16318,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -15993,0 +16402,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -16069,0 +16480,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -16163,0 +16576,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -16233,0 +16648,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -16284,0 +16701,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -16347,0 +16766,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -16438,0 +16859,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -16532,0 +16955,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -16614,0 +17039,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -16742,0 +17169,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -16821,0 +17250,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -16893,0 +17324,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -16953,0 +17386,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -17023,0 +17458,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -17093,0 +17530,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -17161,0 +17600,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 12

other · +40 -0

```diff
@@ -17221,0 +17662,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -17306,0 +17749,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -17369,0 +17814,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -17456,0 +17903,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -17524,0 +17973,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -17587,0 +18038,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -17655,0 +18108,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -17716,0 +18171,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -17795,0 +18252,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -17858,0 +18317,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -17943,0 +18404,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -18011,0 +18474,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -18072,0 +18537,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -18125,0 +18592,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -18195,0 +18664,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -18282,0 +18753,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -18373,0 +18846,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -18436,0 +18911,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -18487,0 +18964,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -18578,0 +19057,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 13

other · +40 -0

```diff
@@ -18656,0 +19137,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -18724,0 +19207,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -18835,0 +19320,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -18920,0 +19407,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -19013,0 +19502,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -19130,0 +19621,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -19235,0 +19728,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -19303,0 +19798,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -19373,0 +19870,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -19441,0 +19940,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -19509,0 +20010,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -19596,0 +20099,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -19666,0 +20171,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -19729,0 +20236,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -19792,0 +20301,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -19862,0 +20373,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -19965,0 +20478,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -20035,0 +20550,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -20098,0 +20615,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -20201,0 +20720,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 14

other · +40 -0

```diff
@@ -20330,0 +20851,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -20422,0 +20945,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -20482,0 +21007,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -20568,0 +21095,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -20636,0 +21165,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -20715,0 +21246,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -20766,0 +21299,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -20836,0 +21371,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -20947,0 +21484,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -21010,0 +21549,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -21071,0 +21612,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -21132,0 +21675,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -21195,0 +21740,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -21246,0 +21793,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -21355,0 +21904,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -21423,0 +21974,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -21543,0 +22096,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -21611,0 +22166,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -21672,0 +22229,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -21740,0 +22299,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 15

other · +40 -0

```diff
@@ -21803,0 +22364,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -21882,0 +22445,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -21952,0 +22517,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -22122,0 +22689,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -22208,0 +22777,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -22261,0 +22832,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -22324,0 +22897,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -22404,0 +22979,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -22465,0 +23042,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -22533,0 +23112,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -22611,0 +23192,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -22691,0 +23274,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -22776,0 +23361,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -22829,0 +23416,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -22897,0 +23486,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -22960,0 +23551,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -23038,0 +23631,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -23129,0 +23724,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -23216,0 +23813,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -23284,0 +23883,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 16

other · +40 -0

```diff
@@ -23371,0 +23972,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -23465,0 +24068,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -23530,0 +24135,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -23653,0 +24260,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -23704,0 +24313,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -23764,0 +24375,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -23834,0 +24447,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -23902,0 +24517,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -24044,0 +24661,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -24114,0 +24733,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -24206,0 +24827,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -24274,0 +24897,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -24354,0 +24979,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -24426,0 +25053,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -24513,0 +25142,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -24574,0 +25205,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -24627,0 +25260,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -24680,0 +25315,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -24750,0 +25387,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -24803,0 +25442,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 17

other · +40 -0

```diff
@@ -24866,0 +25507,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -24971,0 +25614,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -25053,0 +25698,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -25106,0 +25753,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -25167,0 +25816,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -25235,0 +25886,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -25321,0 +25974,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -25391,0 +26046,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -25478,0 +26135,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -25565,0 +26224,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -25704,0 +26365,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -25795,0 +26458,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -25858,0 +26523,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -25921,0 +26588,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -25974,0 +26643,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -26074,0 +26745,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -26137,0 +26810,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -26224,0 +26899,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -26287,0 +26964,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -26350,0 +27029,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 18

other · +40 -0

```diff
@@ -26412,0 +27093,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -26498,0 +27181,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -26568,0 +27253,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -26638,0 +27325,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -26715,0 +27404,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -26849,0 +27540,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -26900,0 +27593,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -26968,0 +27663,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -27029,0 +27726,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -27116,0 +27815,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -27196,0 +27897,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -27264,0 +27967,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -27317,0 +28022,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -27397,0 +28104,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -27490,0 +28199,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -27560,0 +28271,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -27623,0 +28336,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -27693,0 +28408,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -27773,0 +28490,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -27861,0 +28580,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 19

other · +40 -0

```diff
@@ -27948,0 +28669,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -28011,0 +28734,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -28096,0 +28821,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -28167,0 +28894,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -28230,0 +28959,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -28316,0 +29047,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -28369,0 +29102,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -28432,0 +29167,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -28527,0 +29264,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -28614,0 +29353,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -28698,0 +29439,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -28766,0 +29509,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -28889,0 +29634,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -28990,0 +29737,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29041,0 +29790,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29101,0 +29852,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29171,0 +29924,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29222,0 +29977,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29275,0 +30032,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29335,0 +30094,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 20

other · +40 -0

```diff
@@ -29405,0 +30166,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29458,0 +30221,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29528,0 +30293,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29596,0 +30363,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29689,0 +30458,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29759,0 +30530,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29811,0 +30584,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29890,0 +30665,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29941,0 +30718,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29992,0 +30771,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30043,0 +30824,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30111,0 +30894,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30263,0 +31048,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30314,0 +31101,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30365,0 +31154,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30435,0 +31226,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30488,0 +31281,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30548,0 +31343,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30623,0 +31420,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30674,0 +31473,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 21

other · +40 -0

```diff
@@ -30742,0 +31543,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30793,0 +31596,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30861,0 +31666,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30929,0 +31736,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30980,0 +31789,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31040,0 +31851,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31091,0 +31904,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31151,0 +31966,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31211,0 +32028,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31358,0 +32177,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31450,0 +32271,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31501,0 +32324,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31569,0 +32394,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31656,0 +32483,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31724,0 +32553,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31785,0 +32616,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31846,0 +32679,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31933,0 +32768,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31996,0 +32833,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -32081,0 +32920,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 22

other · +40 -0

```diff
@@ -32201,0 +33042,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -32262,0 +33105,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -32403,0 +33248,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -32464,0 +33311,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -32556,0 +33405,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -32624,0 +33475,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -32702,0 +33555,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -32782,0 +33637,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -32850,0 +33707,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -32928,0 +33787,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -32989,0 +33850,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -33059,0 +33922,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -33127,0 +33992,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -33195,0 +34062,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -33263,0 +34132,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -33331,0 +34202,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -33408,0 +34281,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -33547,0 +34422,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -33632,0 +34509,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -33700,0 +34579,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 23

other · +40 -0

```diff
@@ -33773,0 +34654,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -33856,0 +34739,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -33924,0 +34809,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -33975,0 +34862,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -34043,0 +34932,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -34175,0 +35066,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -34266,0 +35159,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -34327,0 +35222,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -34395,0 +35292,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -34519,0 +35418,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -34613,0 +35514,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -34700,0 +35603,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -34761,0 +35666,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -34896,0 +35803,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -34959,0 +35868,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -35100,0 +36011,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -35197,0 +36110,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -35282,0 +36197,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -35352,0 +36269,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -35447,0 +36366,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 24

other · +40 -0

```diff
@@ -35498,0 +36419,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -35583,0 +36506,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -35651,0 +36576,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -35714,0 +36641,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -35775,0 +36704,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -35861,0 +36792,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -35938,0 +36871,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -36023,0 +36958,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -36091,0 +37028,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -36161,0 +37100,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -36233,0 +37174,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -36320,0 +37263,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -36413,0 +37358,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -36500,0 +37447,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -36568,0 +37517,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -36652,0 +37603,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -36732,0 +37685,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -36795,0 +37750,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -36858,0 +37815,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -36977,0 +37936,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 25

other · +40 -0

```diff
@@ -37056,0 +38017,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37119,0 +38082,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37189,0 +38154,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37257,0 +38224,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37321,0 +38290,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37382,0 +38353,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37443,0 +38416,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37504,0 +38479,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37584,0 +38561,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37647,0 +38626,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37724,0 +38705,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37777,0 +38760,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37880,0 +38865,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37943,0 +38930,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -38033,0 +39022,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -38149,0 +39140,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -38221,0 +39214,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -38284,0 +39279,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -38354,0 +39351,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -38424,0 +39423,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 26

other · +40 -0

```diff
@@ -38485,0 +39486,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -38572,0 +39575,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -38719,0 +39724,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -38842,0 +39849,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -38910,0 +39919,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -38961,0 +39972,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -39012,0 +40025,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -39124,0 +40139,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -39319,0 +40336,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -39387,0 +40406,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -39474,0 +40495,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -39546,0 +40569,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -39633,0 +40658,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -39726,0 +40753,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -39788,0 +40817,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -39841,0 +40872,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -39949,0 +40982,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -40099,0 +41134,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -40169,0 +41206,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -40239,0 +41278,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 27

other · +40 -0

```diff
@@ -40302,0 +41343,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -40363,0 +41406,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -40426,0 +41471,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -40494,0 +41541,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -40587,0 +41636,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -40680,0 +41731,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -40748,0 +41801,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -40827,0 +41882,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -40913,0 +41970,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -41023,0 +42082,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -41083,0 +42144,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -41153,0 +42216,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -41278,0 +42343,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -41372,0 +42439,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -41445,0 +42514,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -41539,0 +42610,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -41623,0 +42696,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -41693,0 +42768,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -41787,0 +42864,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -41867,0 +42946,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 28

other · +40 -0

```diff
@@ -41930,0 +43011,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -41993,0 +43076,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -42053,0 +43138,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -42133,0 +43220,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -42196,0 +43285,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -42290,0 +43381,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -42418,0 +43511,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -42481,0 +43576,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -42560,0 +43657,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -42630,0 +43729,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -42700,0 +43801,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -42794,0 +43897,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -42857,0 +43962,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -42937,0 +44044,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -43017,0 +44126,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -43090,0 +44201,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -43153,0 +44266,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -43216,0 +44331,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -43303,0 +44420,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -43371,0 +44490,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 29

other · +40 -0

```diff
@@ -43453,0 +44574,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -43521,0 +44644,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -43614,0 +44739,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -43701,0 +44828,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -43781,0 +44910,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -43851,0 +44982,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -43921,0 +45054,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -43991,0 +45126,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -44061,0 +45198,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -44124,0 +45263,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -44192,0 +45333,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -44260,0 +45403,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -44347,0 +45492,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -44440,0 +45587,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -44503,0 +45652,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -44575,0 +45726,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -44688,0 +45841,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -44805,0 +45960,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -44896,0 +46053,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -44966,0 +46125,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 30

other · +40 -0

```diff
@@ -45029,0 +46190,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45117,0 +46280,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45219,0 +46384,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45289,0 +46456,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45352,0 +46521,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45422,0 +46593,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45499,0 +46672,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45560,0 +46735,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45623,0 +46800,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45686,0 +46865,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45746,0 +46927,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45837,0 +47020,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45915,0 +47100,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45978,0 +47165,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -46102,0 +47291,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -46153,0 +47344,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -46273,0 +47466,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -46343,0 +47538,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -46406,0 +47603,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -46457,0 +47656,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 31

other · +40 -0

```diff
@@ -46527,0 +47728,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -46590,0 +47793,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -46682,0 +47887,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -46745,0 +47952,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -46796,0 +48005,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -46847,0 +48058,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -46917,0 +48130,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -46996,0 +48211,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -47099,0 +48316,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -47162,0 +48381,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -47232,0 +48453,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -47298,0 +48521,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -47378,0 +48603,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -47446,0 +48673,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -47569,0 +48798,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -47744,0 +48975,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -47830,0 +49063,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -47915,0 +49150,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -47978,0 +49215,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -48039,0 +49278,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 32

other · +40 -0

```diff
@@ -48092,0 +49333,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -48143,0 +49386,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -48204,0 +49449,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -48329,0 +49576,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -48408,0 +49657,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -48471,0 +49722,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -48568,0 +49821,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -48677,0 +49932,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -48740,0 +49997,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -48921,0 +50180,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -48989,0 +50250,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -49078,0 +50341,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -49162,0 +50427,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -49239,0 +50506,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -49333,0 +50602,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -49427,0 +50698,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -49499,0 +50772,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -49634,0 +50909,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -49694,0 +50971,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -49755,0 +51034,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 33

other · +40 -0

```diff
@@ -49823,0 +51104,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -49900,0 +51183,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -49979,0 +51264,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -50049,0 +51336,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -50119,0 +51408,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -50180,0 +51471,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -50243,0 +51536,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -50306,0 +51601,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -50378,0 +51675,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -50496,0 +51795,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -50573,0 +51874,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -50650,0 +51953,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -50720,0 +52025,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -50781,0 +52088,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -50842,0 +52151,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -50929,0 +52240,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -51008,0 +52321,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -51069,0 +52384,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -51140,0 +52457,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -51210,0 +52529,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 34

other · +40 -0

```diff
@@ -51280,0 +52601,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -51350,0 +52673,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -51460,0 +52785,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -51540,0 +52867,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -51620,0 +52949,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -51707,0 +53038,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -51794,0 +53127,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -51847,0 +53182,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -51917,0 +53254,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -51987,0 +53326,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -52038,0 +53379,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -52117,0 +53460,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -52197,0 +53542,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -52282,0 +53629,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -52350,0 +53699,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -52418,0 +53769,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -52503,0 +53856,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -52573,0 +53928,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -52650,0 +54007,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -52739,0 +54098,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 35

other · +40 -0

```diff
@@ -52824,0 +54185,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -52894,0 +54257,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53024,0 +54389,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53104,0 +54471,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53184,0 +54553,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53252,0 +54623,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53315,0 +54688,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53395,0 +54770,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53458,0 +54835,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53528,0 +54907,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53614,0 +54995,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53734,0 +55117,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53787,0 +55172,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53857,0 +55244,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53920,0 +55309,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53990,0 +55381,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -54060,0 +55453,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -54139,0 +55534,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -54190,0 +55587,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -54260,0 +55659,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 36

other · +40 -0

```diff
@@ -54328,0 +55729,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -54422,0 +55825,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -54502,0 +55907,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -54572,0 +55979,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -54635,0 +56044,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -54729,0 +56140,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -54809,0 +56222,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -54860,0 +56275,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -54921,0 +56338,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -54991,0 +56410,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -55061,0 +56482,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -55131,0 +56554,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -55201,0 +56626,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -55264,0 +56691,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -55343,0 +56772,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -55413,0 +56844,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -55476,0 +56909,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -55519,0 +56954,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -55649,0 +57086,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -55746,0 +57185,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 37

other · +40 -0

```diff
@@ -55816,0 +57257,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -55886,0 +57329,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -55956,0 +57401,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -56121,0 +57568,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -56200,0 +57649,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -56263,0 +57714,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -56333,0 +57786,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -56401,0 +57856,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -56464,0 +57921,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -56517,0 +57976,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -56587,0 +58048,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -56690,0 +58153,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -56760,0 +58225,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -56823,0 +58290,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -56893,0 +58362,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -56963,0 +58434,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -57026,0 +58499,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -57120,0 +58595,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -57183,0 +58660,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -57246,0 +58725,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 38

other · +40 -0

```diff
@@ -57347,0 +58828,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -57425,0 +58908,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -57519,0 +59004,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -57589,0 +59076,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -57683,0 +59172,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -57753,0 +59244,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -57840,0 +59333,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -57910,0 +59405,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -57980,0 +59477,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -58050,0 +59549,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -58120,0 +59621,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -58199,0 +59702,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -58262,0 +59767,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -58332,0 +59839,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -58445,0 +59954,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -58517,0 +60028,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -58587,0 +60100,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -58665,0 +60180,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -58743,0 +60260,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -58794,0 +60313,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 39

other · +40 -0

```diff
@@ -58869,0 +60390,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -58944,0 +60467,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -59012,0 +60537,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -59080,0 +60607,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -59227,0 +60756,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -59336,0 +60867,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -59505,0 +61038,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -59591,0 +61126,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -59673,0 +61210,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -59743,0 +61282,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -59865,0 +61406,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -59945,0 +61488,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -60015,0 +61560,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -60085,0 +61632,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -60148,0 +61697,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -60211,0 +61762,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -60331,0 +61884,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -60418,0 +61973,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -60505,0 +62062,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -60612,0 +62171,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 40

other · +40 -0

```diff
@@ -60692,0 +62253,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -60762,0 +62325,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -60854,0 +62419,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -60924,0 +62491,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -60987,0 +62556,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -61066,0 +62637,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -61136,0 +62709,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -61214,0 +62789,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -61277,0 +62854,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -61340,0 +62919,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -61402,0 +62983,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -61499,0 +63082,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -61612,0 +63197,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -61682,0 +63269,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -61802,0 +63391,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -61882,0 +63473,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -61952,0 +63545,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -62015,0 +63610,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -62095,0 +63692,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -62165,0 +63764,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 41

other · +40 -0

```diff
@@ -62259,0 +63860,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -62312,0 +63915,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -62425,0 +64030,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -62517,0 +64124,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -62635,0 +64244,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -62714,0 +64325,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -62784,0 +64397,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -62847,0 +64462,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -62917,0 +64534,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -63004,0 +64623,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -63067,0 +64688,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -63130,0 +64753,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -63200,0 +64825,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -63251,0 +64878,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -63314,0 +64943,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -63392,0 +65023,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -63486,0 +65119,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -63556,0 +65191,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -63619,0 +65256,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -63706,0 +65345,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 42

other · +40 -0

```diff
@@ -63785,0 +65426,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -63855,0 +65498,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -63952,0 +65597,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -64048,0 +65695,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -64128,0 +65777,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -64215,0 +65866,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -64285,0 +65938,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -64336,0 +65991,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -64713,0 +66370,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -64775,0 +66434,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -64843,0 +66504,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -64911,0 +66574,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -64995,0 +66660,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -65080,0 +66747,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -65141,0 +66810,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -65221,0 +66892,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -65291,0 +66964,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -65361,0 +67036,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -65424,0 +67101,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -65494,0 +67173,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 43

other · +40 -0

```diff
@@ -65564,0 +67245,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -65634,0 +67317,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -65704,0 +67389,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -65767,0 +67454,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -65828,0 +67517,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -65891,0 +67582,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -65987,0 +67680,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -66048,0 +67743,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -66111,0 +67808,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -66163,0 +67862,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -66231,0 +67932,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -66292,0 +67995,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -66380,0 +68085,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -66457,0 +68164,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -66517,0 +68226,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -66568,0 +68279,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -66629,0 +68342,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -66697,0 +68412,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -66844,0 +68561,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -66914,0 +68633,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 44

other · +40 -0

```diff
@@ -67048,0 +68769,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -67135,0 +68858,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -67268,0 +68993,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -67350,0 +69077,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -67420,0 +69149,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -67501,0 +69232,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -67552,0 +69285,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -67595,0 +69330,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -67712,0 +69449,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -67765,0 +69504,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -67842,0 +69583,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -67920,0 +69663,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -67981,0 +69726,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -68058,0 +69805,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -68128,0 +69877,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -68222,0 +69973,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -68292,0 +70045,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -68362,0 +70117,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -68487,0 +70244,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -68572,0 +70331,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 45

other · +40 -0

```diff
@@ -68623,0 +70384,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -68691,0 +70454,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -68759,0 +70524,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -68836,0 +70603,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -69012,0 +70781,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -69096,0 +70867,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -69190,0 +70963,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -69269,0 +71044,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -69337,0 +71114,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -69416,0 +71195,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -69510,0 +71291,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -69629,0 +71412,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -69702,0 +71487,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -69770,0 +71557,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -69840,0 +71629,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -69903,0 +71694,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -69988,0 +71781,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -70085,0 +71880,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -70164,0 +71961,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -70232,0 +72031,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 46

other · +40 -0

```diff
@@ -70302,0 +72103,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -70365,0 +72168,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -70435,0 +72240,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -70503,0 +72310,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -70590,0 +72399,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -70658,0 +72469,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -70728,0 +72541,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -70845,0 +72660,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -70997,0 +72814,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -71067,0 +72886,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -71146,0 +72967,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -71225,0 +73048,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -71295,0 +73120,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -71393,0 +73220,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -71463,0 +73292,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -71524,0 +73355,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -71585,0 +73418,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -71679,0 +73514,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -71742,0 +73579,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -71822,0 +73661,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 47

other · +40 -0

```diff
@@ -71892,0 +73733,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -71962,0 +73805,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72032,0 +73877,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72123,0 +73970,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72193,0 +74042,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72272,0 +74123,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72351,0 +74204,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72419,0 +74274,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72522,0 +74379,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72583,0 +74442,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72646,0 +74507,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72714,0 +74577,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72786,0 +74651,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72866,0 +74733,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72929,0 +74798,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72992,0 +74863,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -73062,0 +74935,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -73216,0 +75091,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -73284,0 +75161,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -73370,0 +75249,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 48

other · +40 -0

```diff
@@ -73440,0 +75321,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -73503,0 +75386,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -73573,0 +75458,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -73653,0 +75540,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -73715,0 +75604,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -73806,0 +75697,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -73867,0 +75760,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -73930,0 +75825,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -74020,0 +75917,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -74083,0 +75982,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -74146,0 +76047,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -74209,0 +76112,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -74279,0 +76184,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -74349,0 +76256,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -74419,0 +76328,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -74506,0 +76417,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -74596,0 +76509,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -74685,0 +76600,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -74748,0 +76665,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -74827,0 +76746,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 49

other · +40 -0

```diff
@@ -74897,0 +76818,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75014,0 +76937,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75094,0 +77019,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75164,0 +77091,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75234,0 +77163,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75297,0 +77228,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75367,0 +77300,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75437,0 +77372,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75500,0 +77437,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75551,0 +77490,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75636,0 +77577,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75723,0 +77666,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75810,0 +77755,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75880,0 +77827,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75941,0 +77890,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -76026,0 +77977,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -76096,0 +78049,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -76159,0 +78114,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -76229,0 +78186,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -76292,0 +78251,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 50

other · +40 -0

```diff
@@ -76362,0 +78323,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -76455,0 +78418,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -76518,0 +78483,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -76581,0 +78548,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -76658,0 +78627,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -76721,0 +78692,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -76784,0 +78757,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -76873,0 +78848,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -76941,0 +78918,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -77009,0 +78988,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -77079,0 +79060,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -77149,0 +79132,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -77212,0 +79197,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -77280,0 +79267,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -77350,0 +79339,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -77413,0 +79404,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -77481,0 +79474,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -77572,0 +79567,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -77635,0 +79632,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -77724,0 +79723,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 51

other · +40 -0

```diff
@@ -77777,0 +79778,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -77856,0 +79859,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -77947,0 +79952,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -78017,0 +80024,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -78070,0 +80079,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -78131,0 +80142,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -78222,0 +80235,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -78300,0 +80315,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -78397,0 +80414,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -78494,0 +80513,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -78580,0 +80601,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -78648,0 +80671,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -78734,0 +80759,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -78838,0 +80865,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -78927,0 +80956,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -78995,0 +81026,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -79065,0 +81098,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -79144,0 +81179,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -79214,0 +81251,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -79293,0 +81332,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 52

other · +40 -0

```diff
@@ -79361,0 +81402,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -79422,0 +81465,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -79490,0 +81535,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -79553,0 +81600,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -79621,0 +81670,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -79698,0 +81749,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -79766,0 +81819,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -79837,0 +81892,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -79905,0 +81962,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -79977,0 +82036,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -80038,0 +82099,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -80099,0 +82162,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -80167,0 +82232,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -80245,0 +82312,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -80330,0 +82399,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -80422,0 +82493,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -80483,0 +82556,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -80551,0 +82626,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -80619,0 +82696,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -80670,0 +82749,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 53

other · +40 -0

```diff
@@ -80731,0 +82812,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -80799,0 +82882,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -80870,0 +82955,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -80973,0 +83060,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -81043,0 +83132,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -81111,0 +83202,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -81188,0 +83281,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -81302,0 +83397,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -81372,0 +83469,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -81433,0 +83532,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -81501,0 +83602,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -81588,0 +83691,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -81658,0 +83763,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -81726,0 +83833,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -81794,0 +83903,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -81922,0 +84033,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -81993,0 +84106,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -82070,0 +84185,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -82155,0 +84272,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -82240,0 +84359,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 54

other · +40 -0

```diff
@@ -82320,0 +84441,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -82390,0 +84513,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -82468,0 +84593,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -82539,0 +84666,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -82674,0 +84803,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -82772,0 +84903,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -82833,0 +84966,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -82903,0 +85038,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -82971,0 +85108,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -83050,0 +85189,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -83103,0 +85244,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -83171,0 +85314,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -83232,0 +85377,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -83295,0 +85442,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -83358,0 +85507,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -83428,0 +85579,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -83577,0 +85730,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -83630,0 +85785,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -83717,0 +85874,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -83780,0 +85939,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 55

other · +40 -0

```diff
@@ -83850,0 +86011,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -83913,0 +86076,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -83983,0 +86148,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -84046,0 +86213,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -84116,0 +86285,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -84269,0 +86440,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -84339,0 +86512,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -84409,0 +86584,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -84502,0 +86679,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -84598,0 +86777,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -84668,0 +86849,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -84721,0 +86904,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -84791,0 +86976,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -84876,0 +87063,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -85064,0 +87253,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -85115,0 +87306,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -85217,0 +87410,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -85287,0 +87482,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -85378,0 +87575,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -85484,0 +87683,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 56

other · +40 -0

```diff
@@ -85554,0 +87755,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -85631,0 +87834,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -85731,0 +87936,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -85792,0 +87999,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -85845,0 +88054,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -85936,0 +88147,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -85987,0 +88200,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -86050,0 +88265,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -86118,0 +88335,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -86187,0 +88406,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -86250,0 +88471,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -86344,0 +88567,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -86435,0 +88660,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -86505,0 +88732,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -86575,0 +88804,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -86638,0 +88869,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -86708,0 +88941,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -86771,0 +89006,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -86905,0 +89142,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -86998,0 +89237,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 57

other · +40 -0

```diff
@@ -87091,0 +89332,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87152,0 +89395,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87220,0 +89465,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87314,0 +89561,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87382,0 +89631,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87445,0 +89696,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87513,0 +89766,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87595,0 +89850,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87646,0 +89903,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87706,0 +89965,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87782,0 +90043,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87845,0 +90108,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87915,0 +90180,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87987,0 +90254,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -88057,0 +90326,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -88300,0 +90571,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -88384,0 +90657,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -88454,0 +90729,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -88522,0 +90799,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -88611,0 +90890,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 58

other · +40 -0

```diff
@@ -88681,0 +90962,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -88734,0 +91017,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -88813,0 +91098,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -88883,0 +91170,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -88953,0 +91242,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -89023,0 +91314,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -89093,0 +91386,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -89197,0 +91492,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -89260,0 +91557,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -89330,0 +91629,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -89400,0 +91701,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -89473,0 +91776,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -89591,0 +91896,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -89654,0 +91961,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -89724,0 +92033,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -89817,0 +92128,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -89887,0 +92200,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -89966,0 +92281,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -90036,0 +92353,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -90130,0 +92449,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 59

other · +40 -0

```diff
@@ -90200,0 +92521,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -90268,0 +92591,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -90348,0 +92673,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -90420,0 +92747,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -90483,0 +92812,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -90553,0 +92884,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -90616,0 +92949,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -90689,0 +93024,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -90776,0 +93113,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -90844,0 +93183,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -90948,0 +93289,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -91034,0 +93377,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -91097,0 +93442,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -91160,0 +93507,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -91230,0 +93579,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -91300,0 +93651,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -91380,0 +93733,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -91460,0 +93815,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -91530,0 +93887,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -91591,0 +93950,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 60

other · +40 -0

```diff
@@ -91714,0 +94075,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -91793,0 +94156,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -91940,0 +94305,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -91991,0 +94358,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -92068,0 +94437,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -92159,0 +94530,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -92246,0 +94619,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -92326,0 +94701,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -92394,0 +94771,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -92457,0 +94836,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -92510,0 +94891,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -92611,0 +94994,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -92757,0 +95142,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -92829,0 +95216,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -92909,0 +95298,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -92989,0 +95380,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -93076,0 +95469,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -93177,0 +95572,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -93247,0 +95644,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -93402,0 +95801,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 61

other · +40 -0

```diff
@@ -93482,0 +95883,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -93573,0 +95976,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -93643,0 +96048,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -93711,0 +96118,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -93774,0 +96183,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -93842,0 +96253,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -93910,0 +96323,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -93989,0 +96404,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -94083,0 +96500,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -94153,0 +96572,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -94223,0 +96644,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -94293,0 +96716,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -94363,0 +96788,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -94426,0 +96853,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -94489,0 +96918,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -94557,0 +96988,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -94627,0 +97060,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -94697,0 +97132,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -94790,0 +97227,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -94858,0 +97297,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 62

other · +40 -0

```diff
@@ -94919,0 +97360,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -94999,0 +97442,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95052,0 +97497,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95113,0 +97560,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95197,0 +97646,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95267,0 +97718,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95337,0 +97790,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95407,0 +97862,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95477,0 +97934,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95547,0 +98006,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95619,0 +98080,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95682,0 +98145,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95754,0 +98219,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95850,0 +98317,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95913,0 +98382,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -96038,0 +98509,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -96099,0 +98572,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -96193,0 +98668,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -96254,0 +98731,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -96324,0 +98803,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 63

other · +40 -0

```diff
@@ -96403,0 +98884,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -96490,0 +98973,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -96558,0 +99043,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -96626,0 +99113,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -96677,0 +99166,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -96754,0 +99245,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -96817,0 +99310,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -96889,0 +99384,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -96939,0 +99436,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -97007,0 +99506,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -97100,0 +99601,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -97170,0 +99673,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -97233,0 +99738,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -97377,0 +99884,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -97471,0 +99980,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -97534,0 +100045,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -97597,0 +100110,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -97722,0 +100237,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -97808,0 +100325,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -97871,0 +100390,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 64

other · +40 -0

```diff
@@ -97957,0 +100478,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98027,0 +100550,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98097,0 +100622,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98174,0 +100701,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98244,0 +100773,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98305,0 +100836,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98375,0 +100908,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98445,0 +100980,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98515,0 +101052,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98585,0 +101124,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98638,0 +101179,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98706,0 +101249,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98776,0 +101321,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98846,0 +101393,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98914,0 +101463,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98982,0 +101533,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -99045,0 +101598,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -99108,0 +101663,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -99178,0 +101735,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -99255,0 +101814,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 65

other · +40 -0

```diff
@@ -99506,0 +102067,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -99569,0 +102132,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -99762,0 +102327,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -99830,0 +102397,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100011,0 +102580,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100073,0 +102644,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100136,0 +102709,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100199,0 +102774,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100252,0 +102829,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100337,0 +102916,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100413,0 +102994,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100483,0 +103066,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100546,0 +103131,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100633,0 +103220,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100703,0 +103292,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100773,0 +103364,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100870,0 +103463,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100957,0 +103552,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -101025,0 +103622,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -101086,0 +103685,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 66

other · +40 -0

```diff
@@ -101158,0 +103759,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -101218,0 +103821,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -101305,0 +103910,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -101373,0 +103980,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -101424,0 +104033,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -101496,0 +104107,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -101576,0 +104189,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -101654,0 +104269,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -101722,0 +104339,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -101801,0 +104420,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -101864,0 +104485,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -101927,0 +104550,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -102030,0 +104655,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -102100,0 +104727,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -102163,0 +104792,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -102216,0 +104847,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -102333,0 +104966,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -102394,0 +105029,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -102462,0 +105099,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -102523,0 +105162,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 67

other · +40 -0

```diff
@@ -102610,0 +105251,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -102678,0 +105321,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -102739,0 +105384,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -102802,0 +105449,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -102862,0 +105511,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -102939,0 +105590,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103031,0 +105684,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103115,0 +105770,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103166,0 +105823,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103258,0 +105917,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103321,0 +105982,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103372,0 +106035,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103424,0 +106089,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103506,0 +106173,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103607,0 +106276,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103701,0 +106372,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103764,0 +106437,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103834,0 +106509,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103914,0 +106591,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103994,0 +106673,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 68

other · +40 -0

```diff
@@ -104047,0 +106728,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -104132,0 +106815,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -104185,0 +106870,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -104236,0 +106923,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -104352,0 +107041,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -104487,0 +107178,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -104555,0 +107248,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -104704,0 +107399,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -104767,0 +107464,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -104818,0 +107517,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -104903,0 +107604,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -104998,0 +107701,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -105059,0 +107764,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -105127,0 +107834,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -105190,0 +107899,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -105260,0 +107971,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -105396,0 +108109,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -105466,0 +108181,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -105536,0 +108253,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -105604,0 +108323,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 69

other · +40 -0

```diff
@@ -105683,0 +108404,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -105753,0 +108476,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -105823,0 +108548,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -105876,0 +108603,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -105948,0 +108677,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -106011,0 +108742,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -106083,0 +108816,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -106194,0 +108929,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -106362,0 +109099,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -106430,0 +109169,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -106553,0 +109294,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -106652,0 +109395,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -106703,0 +109448,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -106803,0 +109550,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -106892,0 +109641,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -106962,0 +109713,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -107032,0 +109785,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -107100,0 +109855,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -107168,0 +109925,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -107236,0 +109995,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 70

other · +40 -0

```diff
@@ -107349,0 +110110,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -107426,0 +110189,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -107510,0 +110275,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -107573,0 +110340,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -107641,0 +110410,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -107709,0 +110480,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -107787,0 +110560,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -107873,0 +110648,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -107924,0 +110701,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108016,0 +110795,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108067,0 +110848,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108144,0 +110927,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108204,0 +110989,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108257,0 +111044,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108320,0 +111109,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108405,0 +111196,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108456,0 +111249,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108519,0 +111314,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108596,0 +111393,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108676,0 +111475,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 71

other · +40 -0

```diff
@@ -108762,0 +111563,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108825,0 +111628,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108893,0 +111698,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108956,0 +111763,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -109007,0 +111816,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -109077,0 +111888,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -109164,0 +111977,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -109241,0 +112056,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -109292,0 +112109,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -109355,0 +112174,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -109423,0 +112244,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -109534,0 +112357,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -109635,0 +112460,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -109720,0 +112547,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -109805,0 +112634,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -109892,0 +112723,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -109962,0 +112795,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -110032,0 +112867,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -110102,0 +112939,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -110170,0 +113009,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 72

other · +40 -0

```diff
@@ -110233,0 +113074,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -110363,0 +113206,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -110431,0 +113276,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -110501,0 +113348,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -110598,0 +113447,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -110692,0 +113543,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -110743,0 +113596,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -110813,0 +113668,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -110892,0 +113749,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -110986,0 +113845,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -111037,0 +113898,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -111100,0 +113963,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -111161,0 +114026,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -111231,0 +114098,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -111311,0 +114180,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -111374,0 +114245,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -111491,0 +114364,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -111563,0 +114438,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -111698,0 +114575,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -111766,0 +114645,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 73

other · +40 -0

```diff
@@ -111836,0 +114717,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -111904,0 +114787,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -111972,0 +114857,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -112033,0 +114920,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -112084,0 +114973,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -112145,0 +115036,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -112225,0 +115118,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -112293,0 +115188,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -112344,0 +115241,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -112414,0 +115313,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -112482,0 +115383,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -112566,0 +115469,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -112629,0 +115534,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -112692,0 +115599,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -112755,0 +115664,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -112902,0 +115813,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -113033,0 +115946,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -113112,0 +116027,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -113175,0 +116092,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -113238,0 +116157,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/Snapshots/sena-3_snapshot.2026-06-18.verified.txt

### fragment 74

other · +6 -1

```diff
@@ -113308,0 +116229,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -113371,0 +116294,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -130493,1 +133417,2 @@
-  }
+  },
+  "VariantTypes": []
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live.verified.sqlite

### (binary)

other · +0 -0

_content not available (binary or submodule)_

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 1

other · +28 -0

```diff
@@ -100,0 +101,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -240,0 +243,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -315,0 +320,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -479,0 +486,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -530,0 +539,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -581,0 +592,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -664,0 +677,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -715,0 +730,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -766,0 +783,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -874,0 +893,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -917,0 +938,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -968,0 +991,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -1078,0 +1103,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -1165,0 +1192,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 2

other · +39 -0

```diff
@@ -1216,0 +1245,25 @@
+      "VariantOf": [],
+      "Variants": [
+        {
+          "Id": "3b4ca7e3-ad5a-4d5c-93cd-19ddb0aa5027",
+          "MaybeId": "3b4ca7e3-ad5a-4d5c-93cd-19ddb0aa5027",
+          "DeletedAt": null,
+          "VariantEntryId": "6485b811-120d-486b-bb97-425faa9008d9",
+          "VariantHeadword": "inde",
+          "MainEntryId": "425289f4-fbcd-4644-99d7-c9417e20fa66",
+          "MainSenseId": null,
+          "MainHeadword": "ande",
+          "Types": [
+            {
+              "Id": "bbd4adb3-9af5-4542-94e8-b0932124108b",
+              "Name": {
+                "en": "Pronunciation Variant",
+                "pt": "Variac\u0327a\u0303o da Pronuncia"
+              },
+              "DeletedAt": null
+            }
+          ],
+          "HideMinorEntry": false,
+          "Comment": {}
+        }
+      ],
@@ -1267,0 +1321,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -1334,0 +1390,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -1385,0 +1443,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -1436,0 +1496,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -1487,0 +1549,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -1580,0 +1644,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -1660,0 +1726,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 3

other · +40 -0

```diff
@@ -1730,0 +1798,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -1817,0 +1887,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -1880,0 +1952,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -1966,0 +2040,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -2053,0 +2129,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -2173,0 +2251,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -2264,0 +2344,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -2349,0 +2431,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -2427,0 +2511,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -2478,0 +2564,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -2573,0 +2661,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -2653,0 +2743,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -2721,0 +2813,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -2782,0 +2876,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -2945,0 +3041,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -3023,0 +3121,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -3091,0 +3191,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -3159,0 +3261,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -3220,0 +3324,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -3283,0 +3389,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 4

other · +40 -0

```diff
@@ -3360,0 +3468,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -3478,0 +3588,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -3549,0 +3661,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -3634,0 +3748,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -3702,0 +3818,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -3787,0 +3905,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -3850,0 +3970,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -3930,0 +4052,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -4025,0 +4149,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -4086,0 +4212,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -4218,0 +4346,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -4322,0 +4452,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -4468,0 +4600,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -4553,0 +4687,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -4614,0 +4750,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -4675,0 +4813,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -4735,0 +4875,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -4812,0 +4954,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -4897,0 +5041,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -4977,0 +5123,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 5

other · +40 -0

```diff
@@ -5037,0 +5185,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -5098,0 +5248,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -5149,0 +5301,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -5219,0 +5373,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -5354,0 +5510,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -5507,0 +5665,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -5570,0 +5730,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -5633,0 +5795,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -5705,0 +5869,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -5773,0 +5939,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -5834,0 +6002,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -6003,0 +6173,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -6096,0 +6268,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -6168,0 +6342,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -6269,0 +6445,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -6372,0 +6550,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -6440,0 +6620,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -6503,0 +6685,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -6615,0 +6799,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -6732,0 +6918,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 6

other · +40 -0

```diff
@@ -6811,0 +6999,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -6904,0 +7094,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -6981,0 +7173,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -7075,0 +7269,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -7138,0 +7334,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -7224,0 +7422,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -7277,0 +7477,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -7362,0 +7564,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -7432,0 +7636,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -7525,0 +7731,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -7634,0 +7842,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -7713,0 +7923,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -7776,0 +7988,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -7853,0 +8067,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -7916,0 +8132,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -7986,0 +8204,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -8037,0 +8257,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -8107,0 +8329,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -8160,0 +8384,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -8203,0 +8429,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 7

other · +40 -0

```diff
@@ -8304,0 +8532,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -8384,0 +8614,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -8454,0 +8686,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -8534,0 +8768,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -8604,0 +8840,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -8674,0 +8912,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -8744,0 +8984,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -8814,0 +9056,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -8901,0 +9145,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -8952,0 +9198,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -9053,0 +9301,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -9116,0 +9366,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -9186,0 +9438,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -9327,0 +9581,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -9431,0 +9687,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -9494,0 +9752,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -9564,0 +9824,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -9627,0 +9889,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -9690,0 +9954,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -9753,0 +10019,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 8

other · +40 -0

```diff
@@ -9806,0 +10074,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -9874,0 +10144,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -9937,0 +10209,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -10000,0 +10274,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -10062,0 +10338,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -10154,0 +10432,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -10224,0 +10504,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -10294,0 +10576,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -10379,0 +10663,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -10442,0 +10728,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -10512,0 +10800,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -10589,0 +10879,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -10676,0 +10968,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -10739,0 +11033,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -10802,0 +11098,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -10940,0 +11238,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -11049,0 +11349,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -11100,0 +11402,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -11211,0 +11515,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -11291,0 +11597,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 9

other · +40 -0

```diff
@@ -11371,0 +11679,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -11443,0 +11753,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -11506,0 +11818,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -11569,0 +11883,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -11632,0 +11948,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -11695,0 +12013,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -11767,0 +12087,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -11837,0 +12159,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -11888,0 +12212,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -11968,0 +12294,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -12031,0 +12359,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -12130,0 +12460,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -12181,0 +12513,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -12268,0 +12602,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -12355,0 +12691,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -12418,0 +12756,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -12490,0 +12830,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -12579,0 +12921,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -12642,0 +12986,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -12726,0 +13072,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 10

other · +40 -0

```diff
@@ -12804,0 +13152,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -12867,0 +13217,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -12962,0 +13314,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -13039,0 +13393,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -13090,0 +13446,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -13160,0 +13518,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -13263,0 +13623,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -13326,0 +13688,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -13413,0 +13777,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -13507,0 +13873,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -13560,0 +13928,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -13630,0 +14000,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -13700,0 +14072,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -13761,0 +14135,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -13901,0 +14277,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -13964,0 +14342,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -14043,0 +14423,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -14106,0 +14488,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -14185,0 +14569,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -14267,0 +14653,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 11

other · +40 -0

```diff
@@ -14361,0 +14749,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -14448,0 +14838,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -14518,0 +14910,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -14591,0 +14985,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -14664,0 +15060,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -14734,0 +15132,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -14802,0 +15202,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -14897,0 +15299,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -14991,0 +15395,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -15061,0 +15467,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -15122,0 +15530,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -15192,0 +15602,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -15262,0 +15674,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -15315,0 +15729,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -15378,0 +15794,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -15472,0 +15890,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -15542,0 +15962,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -15612,0 +16034,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -15682,0 +16106,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -15762,0 +16188,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 12

other · +40 -0

```diff
@@ -15841,0 +16269,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -15911,0 +16341,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -15993,0 +16425,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -16069,0 +16503,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -16163,0 +16599,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -16233,0 +16671,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -16284,0 +16724,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -16347,0 +16789,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -16438,0 +16882,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -16532,0 +16978,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -16614,0 +17062,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -16742,0 +17192,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -16821,0 +17273,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -16893,0 +17347,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -16953,0 +17409,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -17023,0 +17481,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -17093,0 +17553,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -17161,0 +17623,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -17221,0 +17685,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -17306,0 +17772,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 13

other · +40 -0

```diff
@@ -17369,0 +17837,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -17456,0 +17926,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -17524,0 +17996,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -17587,0 +18061,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -17655,0 +18131,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -17716,0 +18194,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -17795,0 +18275,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -17858,0 +18340,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -17943,0 +18427,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -18011,0 +18497,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -18072,0 +18560,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -18125,0 +18615,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -18195,0 +18687,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -18282,0 +18776,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -18373,0 +18869,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -18436,0 +18934,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -18487,0 +18987,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -18578,0 +19080,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -18656,0 +19160,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -18724,0 +19230,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 14

other · +40 -0

```diff
@@ -18835,0 +19343,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -18920,0 +19430,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -19013,0 +19525,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -19130,0 +19644,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -19235,0 +19751,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -19303,0 +19821,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -19373,0 +19893,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -19441,0 +19963,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -19509,0 +20033,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -19596,0 +20122,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -19666,0 +20194,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -19729,0 +20259,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -19792,0 +20324,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -19862,0 +20396,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -19965,0 +20501,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -20035,0 +20573,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -20098,0 +20638,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -20201,0 +20743,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -20330,0 +20874,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -20422,0 +20968,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 15

other · +40 -0

```diff
@@ -20482,0 +21030,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -20568,0 +21118,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -20636,0 +21188,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -20715,0 +21269,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -20766,0 +21322,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -20836,0 +21394,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -20947,0 +21507,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -21010,0 +21572,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -21071,0 +21635,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -21132,0 +21698,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -21195,0 +21763,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -21246,0 +21816,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -21355,0 +21927,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -21423,0 +21997,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -21543,0 +22119,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -21611,0 +22189,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -21672,0 +22252,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -21740,0 +22322,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -21803,0 +22387,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -21882,0 +22468,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 16

other · +40 -0

```diff
@@ -21952,0 +22540,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -22122,0 +22712,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -22208,0 +22800,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -22261,0 +22855,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -22324,0 +22920,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -22404,0 +23002,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -22465,0 +23065,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -22533,0 +23135,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -22611,0 +23215,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -22691,0 +23297,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -22776,0 +23384,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -22829,0 +23439,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -22897,0 +23509,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -22960,0 +23574,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -23038,0 +23654,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -23129,0 +23747,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -23216,0 +23836,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -23284,0 +23906,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -23371,0 +23995,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -23465,0 +24091,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 17

other · +39 -0

```diff
@@ -23530,0 +24158,25 @@
+      "VariantOf": [],
+      "Variants": [
+        {
+          "Id": "dafa2dec-2fe6-4c6c-a07c-121de360d7b1",
+          "MaybeId": "dafa2dec-2fe6-4c6c-a07c-121de360d7b1",
+          "DeletedAt": null,
+          "VariantEntryId": "564fffa0-0aec-46ab-8d41-cbd30be82be1",
+          "VariantHeadword": "yenda",
+          "MainEntryId": "2bde7e2c-9ddc-4de0-b416-c24c0710c2fa",
+          "MainSenseId": null,
+          "MainHeadword": "enda",
+          "Types": [
+            {
+              "Id": "bbd4adb3-9af5-4542-94e8-b0932124108b",
+              "Name": {
+                "en": "Pronunciation Variant",
+                "pt": "Variac\u0327a\u0303o da Pronuncia"
+              },
+              "DeletedAt": null
+            }
+          ],
+          "HideMinorEntry": false,
+          "Comment": {}
+        }
+      ],
@@ -23653,0 +24306,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -23704,0 +24359,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -23764,0 +24421,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -23834,0 +24493,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -23902,0 +24563,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -24044,0 +24707,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -24114,0 +24779,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 18

other · +40 -0

```diff
@@ -24206,0 +24873,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -24274,0 +24943,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -24354,0 +25025,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -24426,0 +25099,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -24513,0 +25188,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -24574,0 +25251,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -24627,0 +25306,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -24680,0 +25361,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -24750,0 +25433,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -24803,0 +25488,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -24866,0 +25553,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -24971,0 +25660,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -25053,0 +25744,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -25106,0 +25799,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -25167,0 +25862,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -25235,0 +25932,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -25321,0 +26020,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -25391,0 +26092,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -25478,0 +26181,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -25565,0 +26270,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 19

other · +40 -0

```diff
@@ -25704,0 +26411,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -25795,0 +26504,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -25858,0 +26569,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -25921,0 +26634,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -25974,0 +26689,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -26074,0 +26791,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -26137,0 +26856,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -26224,0 +26945,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -26287,0 +27010,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -26350,0 +27075,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -26412,0 +27139,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -26498,0 +27227,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -26568,0 +27299,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -26638,0 +27371,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -26715,0 +27450,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -26849,0 +27586,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -26900,0 +27639,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -26968,0 +27709,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -27029,0 +27772,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -27116,0 +27861,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 20

other · +40 -0

```diff
@@ -27196,0 +27943,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -27264,0 +28013,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -27317,0 +28068,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -27397,0 +28150,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -27490,0 +28245,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -27560,0 +28317,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -27623,0 +28382,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -27693,0 +28454,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -27773,0 +28536,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -27861,0 +28626,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -27948,0 +28715,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -28011,0 +28780,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -28096,0 +28867,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -28167,0 +28940,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -28230,0 +29005,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -28316,0 +29093,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -28369,0 +29148,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -28432,0 +29213,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -28527,0 +29310,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -28614,0 +29399,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 21

other · +38 -0

```diff
@@ -28698,0 +29485,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -28766,0 +29555,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -28889,0 +29680,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -28990,0 +29783,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29041,0 +29836,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29101,0 +29898,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29171,0 +29970,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29222,0 +30023,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29275,0 +30078,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29335,0 +30140,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29405,0 +30212,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29458,0 +30267,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29528,0 +30339,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29596,0 +30409,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29689,0 +30504,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29759,0 +30576,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29811,0 +30630,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29890,0 +30711,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -29941,0 +30764,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 22

other · +39 -0

```diff
@@ -29992,0 +30817,25 @@
+      "VariantOf": [
+        {
+          "Id": "3b4ca7e3-ad5a-4d5c-93cd-19ddb0aa5027",
+          "MaybeId": "3b4ca7e3-ad5a-4d5c-93cd-19ddb0aa5027",
+          "DeletedAt": null,
+          "VariantEntryId": "6485b811-120d-486b-bb97-425faa9008d9",
+          "VariantHeadword": "inde",
+          "MainEntryId": "425289f4-fbcd-4644-99d7-c9417e20fa66",
+          "MainSenseId": null,
+          "MainHeadword": "ande",
+          "Types": [
+            {
+              "Id": "bbd4adb3-9af5-4542-94e8-b0932124108b",
+              "Name": {
+                "en": "Pronunciation Variant",
+                "pt": "Variac\u0327a\u0303o da Pronuncia"
+              },
+              "DeletedAt": null
+            }
+          ],
+          "HideMinorEntry": false,
+          "Comment": {}
+        }
+      ],
+      "Variants": [],
@@ -30043,0 +30893,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30111,0 +30963,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30263,0 +31117,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30314,0 +31170,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30365,0 +31223,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30435,0 +31295,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30488,0 +31350,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 23

other · +40 -0

```diff
@@ -30548,0 +31412,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30623,0 +31489,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30674,0 +31542,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30742,0 +31612,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30793,0 +31665,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30861,0 +31735,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30929,0 +31805,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -30980,0 +31858,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31040,0 +31920,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31091,0 +31973,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31151,0 +32035,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31211,0 +32097,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31358,0 +32246,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31450,0 +32340,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31501,0 +32393,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31569,0 +32463,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31656,0 +32552,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31724,0 +32622,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31785,0 +32685,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31846,0 +32748,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 24

other · +40 -0

```diff
@@ -31933,0 +32837,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -31996,0 +32902,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -32081,0 +32989,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -32201,0 +33111,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -32262,0 +33174,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -32403,0 +33317,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -32464,0 +33380,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -32556,0 +33474,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -32624,0 +33544,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -32702,0 +33624,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -32782,0 +33706,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -32850,0 +33776,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -32928,0 +33856,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -32989,0 +33919,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -33059,0 +33991,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -33127,0 +34061,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -33195,0 +34131,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -33263,0 +34201,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -33331,0 +34271,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -33408,0 +34350,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 25

other · +40 -0

```diff
@@ -33547,0 +34491,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -33632,0 +34578,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -33700,0 +34648,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -33773,0 +34723,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -33856,0 +34808,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -33924,0 +34878,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -33975,0 +34931,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -34043,0 +35001,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -34175,0 +35135,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -34266,0 +35228,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -34327,0 +35291,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -34395,0 +35361,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -34519,0 +35487,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -34613,0 +35583,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -34700,0 +35672,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -34761,0 +35735,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -34896,0 +35872,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -34959,0 +35937,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -35100,0 +36080,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -35197,0 +36179,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 26

other · +40 -0

```diff
@@ -35282,0 +36266,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -35352,0 +36338,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -35447,0 +36435,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -35498,0 +36488,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -35583,0 +36575,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -35651,0 +36645,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -35714,0 +36710,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -35775,0 +36773,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -35861,0 +36861,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -35938,0 +36940,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -36023,0 +37027,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -36091,0 +37097,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -36161,0 +37169,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -36233,0 +37243,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -36320,0 +37332,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -36413,0 +37427,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -36500,0 +37516,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -36568,0 +37586,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -36652,0 +37672,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -36732,0 +37754,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 27

other · +40 -0

```diff
@@ -36795,0 +37819,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -36858,0 +37884,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -36977,0 +38005,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37056,0 +38086,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37119,0 +38151,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37189,0 +38223,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37257,0 +38293,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37321,0 +38359,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37382,0 +38422,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37443,0 +38485,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37504,0 +38548,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37584,0 +38630,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37647,0 +38695,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37724,0 +38774,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37777,0 +38829,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37880,0 +38934,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -37943,0 +38999,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -38033,0 +39091,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -38149,0 +39209,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -38221,0 +39283,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 28

other · +40 -0

```diff
@@ -38284,0 +39348,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -38354,0 +39420,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -38424,0 +39492,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -38485,0 +39555,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -38572,0 +39644,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -38719,0 +39793,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -38842,0 +39918,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -38910,0 +39988,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -38961,0 +40041,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -39012,0 +40094,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -39124,0 +40208,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -39319,0 +40405,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -39387,0 +40475,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -39474,0 +40564,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -39546,0 +40638,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -39633,0 +40727,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -39726,0 +40822,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -39788,0 +40886,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -39841,0 +40941,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -39949,0 +41051,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 29

other · +40 -0

```diff
@@ -40099,0 +41203,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -40169,0 +41275,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -40239,0 +41347,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -40302,0 +41412,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -40363,0 +41475,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -40426,0 +41540,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -40494,0 +41610,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -40587,0 +41705,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -40680,0 +41800,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -40748,0 +41870,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -40827,0 +41951,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -40913,0 +42039,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -41023,0 +42151,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -41083,0 +42213,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -41153,0 +42285,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -41278,0 +42412,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -41372,0 +42508,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -41445,0 +42583,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -41539,0 +42679,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -41623,0 +42765,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 30

other · +40 -0

```diff
@@ -41693,0 +42837,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -41787,0 +42933,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -41867,0 +43015,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -41930,0 +43080,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -41993,0 +43145,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -42053,0 +43207,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -42133,0 +43289,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -42196,0 +43354,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -42290,0 +43450,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -42418,0 +43580,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -42481,0 +43645,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -42560,0 +43726,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -42630,0 +43798,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -42700,0 +43870,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -42794,0 +43966,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -42857,0 +44031,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -42937,0 +44113,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -43017,0 +44195,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -43090,0 +44270,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -43153,0 +44335,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 31

other · +40 -0

```diff
@@ -43216,0 +44400,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -43303,0 +44489,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -43371,0 +44559,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -43453,0 +44643,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -43521,0 +44713,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -43614,0 +44808,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -43701,0 +44897,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -43781,0 +44979,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -43851,0 +45051,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -43921,0 +45123,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -43991,0 +45195,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -44061,0 +45267,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -44124,0 +45332,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -44192,0 +45402,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -44260,0 +45472,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -44347,0 +45561,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -44440,0 +45656,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -44503,0 +45721,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -44575,0 +45795,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -44688,0 +45910,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 32

other · +40 -0

```diff
@@ -44805,0 +46029,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -44896,0 +46122,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -44966,0 +46194,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45029,0 +46259,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45117,0 +46349,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45219,0 +46453,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45289,0 +46525,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45352,0 +46590,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45422,0 +46662,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45499,0 +46741,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45560,0 +46804,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45623,0 +46869,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45686,0 +46934,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45746,0 +46996,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45837,0 +47089,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45915,0 +47169,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -45978,0 +47234,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -46102,0 +47360,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -46153,0 +47413,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -46273,0 +47535,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 33

other · +40 -0

```diff
@@ -46343,0 +47607,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -46406,0 +47672,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -46457,0 +47725,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -46527,0 +47797,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -46590,0 +47862,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -46682,0 +47956,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -46745,0 +48021,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -46796,0 +48074,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -46847,0 +48127,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -46917,0 +48199,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -46996,0 +48280,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -47099,0 +48385,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -47162,0 +48450,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -47232,0 +48522,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -47298,0 +48590,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -47378,0 +48672,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -47446,0 +48742,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -47569,0 +48867,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -47744,0 +49044,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -47830,0 +49132,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 34

other · +40 -0

```diff
@@ -47915,0 +49219,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -47978,0 +49284,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -48039,0 +49347,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -48092,0 +49402,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -48143,0 +49455,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -48204,0 +49518,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -48329,0 +49645,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -48408,0 +49726,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -48471,0 +49791,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -48568,0 +49890,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -48677,0 +50001,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -48740,0 +50066,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -48921,0 +50249,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -48989,0 +50319,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -49078,0 +50410,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -49162,0 +50496,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -49239,0 +50575,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -49333,0 +50671,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -49427,0 +50767,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -49499,0 +50841,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 35

other · +40 -0

```diff
@@ -49634,0 +50978,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -49694,0 +51040,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -49755,0 +51103,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -49823,0 +51173,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -49900,0 +51252,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -49979,0 +51333,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -50049,0 +51405,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -50119,0 +51477,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -50180,0 +51540,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -50243,0 +51605,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -50306,0 +51670,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -50378,0 +51744,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -50496,0 +51864,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -50573,0 +51943,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -50650,0 +52022,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -50720,0 +52094,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -50781,0 +52157,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -50842,0 +52220,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -50929,0 +52309,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -51008,0 +52390,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 36

other · +40 -0

```diff
@@ -51069,0 +52453,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -51140,0 +52526,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -51210,0 +52598,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -51280,0 +52670,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -51350,0 +52742,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -51460,0 +52854,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -51540,0 +52936,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -51620,0 +53018,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -51707,0 +53107,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -51794,0 +53196,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -51847,0 +53251,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -51917,0 +53323,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -51987,0 +53395,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -52038,0 +53448,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -52117,0 +53529,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -52197,0 +53611,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -52282,0 +53698,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -52350,0 +53768,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -52418,0 +53838,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -52503,0 +53925,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 37

other · +40 -0

```diff
@@ -52573,0 +53997,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -52650,0 +54076,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -52739,0 +54167,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -52824,0 +54254,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -52894,0 +54326,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53024,0 +54458,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53104,0 +54540,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53184,0 +54622,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53252,0 +54692,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53315,0 +54757,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53395,0 +54839,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53458,0 +54904,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53528,0 +54976,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53614,0 +55064,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53734,0 +55186,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53787,0 +55241,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53857,0 +55313,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53920,0 +55378,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -53990,0 +55450,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -54060,0 +55522,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 38

other · +40 -0

```diff
@@ -54139,0 +55603,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -54190,0 +55656,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -54260,0 +55728,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -54328,0 +55798,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -54422,0 +55894,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -54502,0 +55976,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -54572,0 +56048,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -54635,0 +56113,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -54729,0 +56209,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -54809,0 +56291,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -54860,0 +56344,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -54921,0 +56407,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -54991,0 +56479,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -55061,0 +56551,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -55131,0 +56623,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -55201,0 +56695,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -55264,0 +56760,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -55343,0 +56841,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -55413,0 +56913,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -55476,0 +56978,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 39

other · +40 -0

```diff
@@ -55519,0 +57023,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -55649,0 +57155,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -55746,0 +57254,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -55816,0 +57326,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -55886,0 +57398,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -55956,0 +57470,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -56121,0 +57637,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -56200,0 +57718,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -56263,0 +57783,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -56333,0 +57855,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -56401,0 +57925,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -56464,0 +57990,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -56517,0 +58045,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -56587,0 +58117,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -56690,0 +58222,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -56760,0 +58294,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -56823,0 +58359,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -56893,0 +58431,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -56963,0 +58503,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -57026,0 +58568,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 40

other · +40 -0

```diff
@@ -57120,0 +58664,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -57183,0 +58729,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -57246,0 +58794,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -57347,0 +58897,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -57425,0 +58977,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -57519,0 +59073,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -57589,0 +59145,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -57683,0 +59241,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -57753,0 +59313,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -57840,0 +59402,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -57910,0 +59474,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -57980,0 +59546,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -58050,0 +59618,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -58120,0 +59690,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -58199,0 +59771,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -58262,0 +59836,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -58332,0 +59908,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -58445,0 +60023,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -58517,0 +60097,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -58587,0 +60169,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 41

other · +40 -0

```diff
@@ -58665,0 +60249,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -58743,0 +60329,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -58794,0 +60382,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -58869,0 +60459,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -58944,0 +60536,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -59012,0 +60606,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -59080,0 +60676,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -59227,0 +60825,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -59336,0 +60936,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -59505,0 +61107,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -59591,0 +61195,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -59673,0 +61279,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -59743,0 +61351,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -59865,0 +61475,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -59945,0 +61557,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -60015,0 +61629,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -60085,0 +61701,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -60148,0 +61766,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -60211,0 +61831,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -60331,0 +61953,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 42

other · +40 -0

```diff
@@ -60418,0 +62042,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -60505,0 +62131,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -60612,0 +62240,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -60692,0 +62322,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -60762,0 +62394,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -60854,0 +62488,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -60924,0 +62560,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -60987,0 +62625,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -61066,0 +62706,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -61136,0 +62778,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -61214,0 +62858,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -61277,0 +62923,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -61340,0 +62988,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -61402,0 +63052,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -61499,0 +63151,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -61612,0 +63266,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -61682,0 +63338,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -61802,0 +63460,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -61882,0 +63542,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -61952,0 +63614,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 43

other · +40 -0

```diff
@@ -62015,0 +63679,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -62095,0 +63761,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -62165,0 +63833,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -62259,0 +63929,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -62312,0 +63984,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -62425,0 +64099,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -62517,0 +64193,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -62635,0 +64313,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -62714,0 +64394,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -62784,0 +64466,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -62847,0 +64531,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -62917,0 +64603,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -63004,0 +64692,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -63067,0 +64757,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -63130,0 +64822,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -63200,0 +64894,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -63251,0 +64947,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -63314,0 +65012,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -63392,0 +65092,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -63486,0 +65188,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 44

other · +40 -0

```diff
@@ -63556,0 +65260,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -63619,0 +65325,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -63706,0 +65414,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -63785,0 +65495,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -63855,0 +65567,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -63952,0 +65666,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -64048,0 +65764,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -64128,0 +65846,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -64215,0 +65935,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -64285,0 +66007,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -64336,0 +66060,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -64713,0 +66439,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -64775,0 +66503,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -64843,0 +66573,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -64911,0 +66643,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -64995,0 +66729,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -65080,0 +66816,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -65141,0 +66879,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -65221,0 +66961,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -65291,0 +67033,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 45

other · +40 -0

```diff
@@ -65361,0 +67105,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -65424,0 +67170,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -65494,0 +67242,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -65564,0 +67314,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -65634,0 +67386,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -65704,0 +67458,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -65767,0 +67523,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -65828,0 +67586,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -65891,0 +67651,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -65987,0 +67749,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -66048,0 +67812,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -66111,0 +67877,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -66163,0 +67931,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -66231,0 +68001,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -66292,0 +68064,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -66380,0 +68154,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -66457,0 +68233,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -66517,0 +68295,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -66568,0 +68348,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -66629,0 +68411,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 46

other · +40 -0

```diff
@@ -66697,0 +68481,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -66844,0 +68630,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -66914,0 +68702,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -67048,0 +68838,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -67135,0 +68927,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -67268,0 +69062,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -67350,0 +69146,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -67420,0 +69218,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -67501,0 +69301,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -67552,0 +69354,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -67595,0 +69399,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -67712,0 +69518,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -67765,0 +69573,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -67842,0 +69652,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -67920,0 +69732,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -67981,0 +69795,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -68058,0 +69874,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -68128,0 +69946,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -68222,0 +70042,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -68292,0 +70114,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 47

other · +40 -0

```diff
@@ -68362,0 +70186,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -68487,0 +70313,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -68572,0 +70400,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -68623,0 +70453,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -68691,0 +70523,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -68759,0 +70593,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -68836,0 +70672,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -69012,0 +70850,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -69096,0 +70936,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -69190,0 +71032,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -69269,0 +71113,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -69337,0 +71183,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -69416,0 +71264,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -69510,0 +71360,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -69629,0 +71481,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -69702,0 +71556,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -69770,0 +71626,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -69840,0 +71698,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -69903,0 +71763,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -69988,0 +71850,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 48

other · +40 -0

```diff
@@ -70085,0 +71949,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -70164,0 +72030,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -70232,0 +72100,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -70302,0 +72172,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -70365,0 +72237,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -70435,0 +72309,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -70503,0 +72379,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -70590,0 +72468,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -70658,0 +72538,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -70728,0 +72610,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -70845,0 +72729,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -70997,0 +72883,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -71067,0 +72955,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -71146,0 +73036,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -71225,0 +73117,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -71295,0 +73189,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -71393,0 +73289,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -71463,0 +73361,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -71524,0 +73424,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -71585,0 +73487,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 49

other · +40 -0

```diff
@@ -71679,0 +73583,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -71742,0 +73648,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -71822,0 +73730,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -71892,0 +73802,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -71962,0 +73874,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72032,0 +73946,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72123,0 +74039,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72193,0 +74111,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72272,0 +74192,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72351,0 +74273,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72419,0 +74343,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72522,0 +74448,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72583,0 +74511,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72646,0 +74576,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72714,0 +74646,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72786,0 +74720,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72866,0 +74802,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72929,0 +74867,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -72992,0 +74932,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -73062,0 +75004,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 50

other · +40 -0

```diff
@@ -73216,0 +75160,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -73284,0 +75230,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -73370,0 +75318,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -73440,0 +75390,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -73503,0 +75455,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -73573,0 +75527,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -73653,0 +75609,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -73715,0 +75673,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -73806,0 +75766,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -73867,0 +75829,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -73930,0 +75894,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -74020,0 +75986,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -74083,0 +76051,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -74146,0 +76116,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -74209,0 +76181,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -74279,0 +76253,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -74349,0 +76325,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -74419,0 +76397,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -74506,0 +76486,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -74596,0 +76578,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 51

other · +40 -0

```diff
@@ -74685,0 +76669,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -74748,0 +76734,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -74827,0 +76815,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -74897,0 +76887,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75014,0 +77006,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75094,0 +77088,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75164,0 +77160,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75234,0 +77232,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75297,0 +77297,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75367,0 +77369,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75437,0 +77441,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75500,0 +77506,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75551,0 +77559,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75636,0 +77646,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75723,0 +77735,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75810,0 +77824,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75880,0 +77896,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -75941,0 +77959,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -76026,0 +78046,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -76096,0 +78118,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 52

other · +40 -0

```diff
@@ -76159,0 +78183,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -76229,0 +78255,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -76292,0 +78320,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -76362,0 +78392,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -76455,0 +78487,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -76518,0 +78552,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -76581,0 +78617,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -76658,0 +78696,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -76721,0 +78761,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -76784,0 +78826,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -76873,0 +78917,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -76941,0 +78987,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -77009,0 +79057,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -77079,0 +79129,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -77149,0 +79201,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -77212,0 +79266,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -77280,0 +79336,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -77350,0 +79408,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -77413,0 +79473,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -77481,0 +79543,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 53

other · +40 -0

```diff
@@ -77572,0 +79636,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -77635,0 +79701,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -77724,0 +79792,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -77777,0 +79847,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -77856,0 +79928,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -77947,0 +80021,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -78017,0 +80093,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -78070,0 +80148,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -78131,0 +80211,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -78222,0 +80304,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -78300,0 +80384,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -78397,0 +80483,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -78494,0 +80582,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -78580,0 +80670,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -78648,0 +80740,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -78734,0 +80828,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -78838,0 +80934,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -78927,0 +81025,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -78995,0 +81095,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -79065,0 +81167,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 54

other · +40 -0

```diff
@@ -79144,0 +81248,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -79214,0 +81320,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -79293,0 +81401,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -79361,0 +81471,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -79422,0 +81534,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -79490,0 +81604,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -79553,0 +81669,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -79621,0 +81739,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -79698,0 +81818,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -79766,0 +81888,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -79837,0 +81961,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -79905,0 +82031,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -79977,0 +82105,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -80038,0 +82168,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -80099,0 +82231,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -80167,0 +82301,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -80245,0 +82381,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -80330,0 +82468,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -80422,0 +82562,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -80483,0 +82625,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 55

other · +40 -0

```diff
@@ -80551,0 +82695,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -80619,0 +82765,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -80670,0 +82818,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -80731,0 +82881,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -80799,0 +82951,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -80870,0 +83024,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -80973,0 +83129,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -81043,0 +83201,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -81111,0 +83271,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -81188,0 +83350,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -81302,0 +83466,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -81372,0 +83538,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -81433,0 +83601,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -81501,0 +83671,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -81588,0 +83760,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -81658,0 +83832,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -81726,0 +83902,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -81794,0 +83972,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -81922,0 +84102,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -81993,0 +84175,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 56

other · +40 -0

```diff
@@ -82070,0 +84254,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -82155,0 +84341,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -82240,0 +84428,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -82320,0 +84510,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -82390,0 +84582,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -82468,0 +84662,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -82539,0 +84735,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -82674,0 +84872,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -82772,0 +84972,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -82833,0 +85035,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -82903,0 +85107,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -82971,0 +85177,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -83050,0 +85258,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -83103,0 +85313,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -83171,0 +85383,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -83232,0 +85446,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -83295,0 +85511,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -83358,0 +85576,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -83428,0 +85648,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -83577,0 +85799,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 57

other · +40 -0

```diff
@@ -83630,0 +85854,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -83717,0 +85943,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -83780,0 +86008,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -83850,0 +86080,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -83913,0 +86145,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -83983,0 +86217,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -84046,0 +86282,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -84116,0 +86354,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -84269,0 +86509,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -84339,0 +86581,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -84409,0 +86653,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -84502,0 +86748,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -84598,0 +86846,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -84668,0 +86918,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -84721,0 +86973,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -84791,0 +87045,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -84876,0 +87132,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -85064,0 +87322,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -85115,0 +87375,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -85217,0 +87479,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 58

other · +40 -0

```diff
@@ -85287,0 +87551,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -85378,0 +87644,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -85484,0 +87752,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -85554,0 +87824,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -85631,0 +87903,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -85731,0 +88005,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -85792,0 +88068,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -85845,0 +88123,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -85936,0 +88216,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -85987,0 +88269,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -86050,0 +88334,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -86118,0 +88404,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -86187,0 +88475,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -86250,0 +88540,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -86344,0 +88636,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -86435,0 +88729,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -86505,0 +88801,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -86575,0 +88873,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -86638,0 +88938,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -86708,0 +89010,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 59

other · +40 -0

```diff
@@ -86771,0 +89075,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -86905,0 +89211,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -86998,0 +89306,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87091,0 +89401,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87152,0 +89464,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87220,0 +89534,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87314,0 +89630,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87382,0 +89700,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87445,0 +89765,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87513,0 +89835,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87595,0 +89919,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87646,0 +89972,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87706,0 +90034,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87782,0 +90112,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87845,0 +90177,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87915,0 +90249,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -87987,0 +90323,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -88057,0 +90395,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -88300,0 +90640,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -88384,0 +90726,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 60

other · +40 -0

```diff
@@ -88454,0 +90798,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -88522,0 +90868,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -88611,0 +90959,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -88681,0 +91031,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -88734,0 +91086,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -88813,0 +91167,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -88883,0 +91239,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -88953,0 +91311,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -89023,0 +91383,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -89093,0 +91455,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -89197,0 +91561,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -89260,0 +91626,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -89330,0 +91698,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -89400,0 +91770,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -89473,0 +91845,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -89591,0 +91965,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -89654,0 +92030,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -89724,0 +92102,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -89817,0 +92197,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -89887,0 +92269,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 61

other · +40 -0

```diff
@@ -89966,0 +92350,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -90036,0 +92422,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -90130,0 +92518,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -90200,0 +92590,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -90268,0 +92660,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -90348,0 +92742,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -90420,0 +92816,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -90483,0 +92881,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -90553,0 +92953,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -90616,0 +93018,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -90689,0 +93093,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -90776,0 +93182,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -90844,0 +93252,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -90948,0 +93358,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -91034,0 +93446,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -91097,0 +93511,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -91160,0 +93576,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -91230,0 +93648,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -91300,0 +93720,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -91380,0 +93802,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 62

other · +40 -0

```diff
@@ -91460,0 +93884,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -91530,0 +93956,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -91591,0 +94019,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -91714,0 +94144,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -91793,0 +94225,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -91940,0 +94374,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -91991,0 +94427,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -92068,0 +94506,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -92159,0 +94599,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -92246,0 +94688,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -92326,0 +94770,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -92394,0 +94840,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -92457,0 +94905,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -92510,0 +94960,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -92611,0 +95063,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -92757,0 +95211,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -92829,0 +95285,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -92909,0 +95367,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -92989,0 +95449,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -93076,0 +95538,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 63

other · +40 -0

```diff
@@ -93177,0 +95641,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -93247,0 +95713,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -93402,0 +95870,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -93482,0 +95952,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -93573,0 +96045,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -93643,0 +96117,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -93711,0 +96187,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -93774,0 +96252,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -93842,0 +96322,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -93910,0 +96392,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -93989,0 +96473,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -94083,0 +96569,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -94153,0 +96641,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -94223,0 +96713,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -94293,0 +96785,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -94363,0 +96857,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -94426,0 +96922,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -94489,0 +96987,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -94557,0 +97057,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -94627,0 +97129,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 64

other · +40 -0

```diff
@@ -94697,0 +97201,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -94790,0 +97296,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -94858,0 +97366,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -94919,0 +97429,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -94999,0 +97511,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95052,0 +97566,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95113,0 +97629,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95197,0 +97715,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95267,0 +97787,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95337,0 +97859,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95407,0 +97931,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95477,0 +98003,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95547,0 +98075,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95619,0 +98149,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95682,0 +98214,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95754,0 +98288,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95850,0 +98386,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95913,0 +98451,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -96038,0 +98578,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -96099,0 +98641,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 65

other · +39 -0

```diff
@@ -96193,0 +98737,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -96254,0 +98800,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -96324,0 +98872,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -96403,0 +98953,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -96490,0 +99042,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -96558,0 +99112,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -96626,0 +99182,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -96677,0 +99235,25 @@
+      "VariantOf": [
+        {
+          "Id": "be2fc635-b543-4267-9dbc-b1fc96711f48",
+          "MaybeId": "be2fc635-b543-4267-9dbc-b1fc96711f48",
+          "DeletedAt": null,
+          "VariantEntryId": "d03f39d0-10ef-4d35-b13b-a965124a9230",
+          "VariantHeadword": "sia",
+          "MainEntryId": "05640c89-1b5b-463b-83e9-778928d23fc7",
+          "MainSenseId": null,
+          "MainHeadword": "siya",
+          "Types": [
+            {
+              "Id": "0c4663b3-4d9a-47af-b9a1-c8565d8112ed",
+              "Name": {
+                "en": "Spelling Variant",
+                "pt": "Variac\u0327a\u0303o de Soletrac\u0327a\u0303o"
+              },
+              "DeletedAt": null
+            }
+          ],
+          "HideMinorEntry": false,
+          "Comment": {}
+        }
+      ],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 66

other · +16 -0

```diff
@@ -96754,0 +99337,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -96817,0 +99402,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -96889,0 +99476,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -96939,0 +99528,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -97007,0 +99598,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -97100,0 +99693,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -97170,0 +99765,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -97233,0 +99830,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 67

other · +39 -0

```diff
@@ -97377,0 +99976,25 @@
+      "VariantOf": [],
+      "Variants": [
+        {
+          "Id": "be2fc635-b543-4267-9dbc-b1fc96711f48",
+          "MaybeId": "be2fc635-b543-4267-9dbc-b1fc96711f48",
+          "DeletedAt": null,
+          "VariantEntryId": "d03f39d0-10ef-4d35-b13b-a965124a9230",
+          "VariantHeadword": "sia",
+          "MainEntryId": "05640c89-1b5b-463b-83e9-778928d23fc7",
+          "MainSenseId": null,
+          "MainHeadword": "siya",
+          "Types": [
+            {
+              "Id": "0c4663b3-4d9a-47af-b9a1-c8565d8112ed",
+              "Name": {
+                "en": "Spelling Variant",
+                "pt": "Variac\u0327a\u0303o de Soletrac\u0327a\u0303o"
+              },
+              "DeletedAt": null
+            }
+          ],
+          "HideMinorEntry": false,
+          "Comment": {}
+        }
+      ],
@@ -97471,0 +100095,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -97534,0 +100160,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -97597,0 +100225,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -97722,0 +100352,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -97808,0 +100440,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -97871,0 +100505,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -97957,0 +100593,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 68

other · +40 -0

```diff
@@ -98027,0 +100665,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98097,0 +100737,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98174,0 +100816,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98244,0 +100888,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98305,0 +100951,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98375,0 +101023,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98445,0 +101095,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98515,0 +101167,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98585,0 +101239,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98638,0 +101294,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98706,0 +101364,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98776,0 +101436,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98846,0 +101508,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98914,0 +101578,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -98982,0 +101648,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -99045,0 +101713,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -99108,0 +101778,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -99178,0 +101850,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -99255,0 +101929,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -99506,0 +102182,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 69

other · +40 -0

```diff
@@ -99569,0 +102247,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -99762,0 +102442,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -99830,0 +102512,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100011,0 +102695,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100073,0 +102759,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100136,0 +102824,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100199,0 +102889,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100252,0 +102944,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100337,0 +103031,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100413,0 +103109,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100483,0 +103181,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100546,0 +103246,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100633,0 +103335,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100703,0 +103407,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100773,0 +103479,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100870,0 +103578,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -100957,0 +103667,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -101025,0 +103737,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -101086,0 +103800,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -101158,0 +103874,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 70

other · +40 -0

```diff
@@ -101218,0 +103936,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -101305,0 +104025,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -101373,0 +104095,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -101424,0 +104148,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -101496,0 +104222,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -101576,0 +104304,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -101654,0 +104384,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -101722,0 +104454,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -101801,0 +104535,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -101864,0 +104600,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -101927,0 +104665,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -102030,0 +104770,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -102100,0 +104842,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -102163,0 +104907,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -102216,0 +104962,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -102333,0 +105081,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -102394,0 +105144,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -102462,0 +105214,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -102523,0 +105277,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -102610,0 +105366,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 71

other · +40 -0

```diff
@@ -102678,0 +105436,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -102739,0 +105499,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -102802,0 +105564,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -102862,0 +105626,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -102939,0 +105705,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103031,0 +105799,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103115,0 +105885,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103166,0 +105938,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103258,0 +106032,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103321,0 +106097,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103372,0 +106150,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103424,0 +106204,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103506,0 +106288,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103607,0 +106391,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103701,0 +106487,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103764,0 +106552,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103834,0 +106624,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103914,0 +106706,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -103994,0 +106788,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -104047,0 +106843,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 72

other · +40 -0

```diff
@@ -104132,0 +106930,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -104185,0 +106985,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -104236,0 +107038,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -104352,0 +107156,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -104487,0 +107293,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -104555,0 +107363,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -104704,0 +107514,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -104767,0 +107579,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -104818,0 +107632,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -104903,0 +107719,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -104998,0 +107816,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -105059,0 +107879,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -105127,0 +107949,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -105190,0 +108014,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -105260,0 +108086,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -105396,0 +108224,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -105466,0 +108296,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -105536,0 +108368,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -105604,0 +108438,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -105683,0 +108519,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 73

other · +40 -0

```diff
@@ -105753,0 +108591,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -105823,0 +108663,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -105876,0 +108718,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -105948,0 +108792,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -106011,0 +108857,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -106083,0 +108931,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -106194,0 +109044,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -106362,0 +109214,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -106430,0 +109284,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -106553,0 +109409,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -106652,0 +109510,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -106703,0 +109563,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -106803,0 +109665,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -106892,0 +109756,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -106962,0 +109828,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -107032,0 +109900,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -107100,0 +109970,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -107168,0 +110040,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -107236,0 +110110,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -107349,0 +110225,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 74

other · +40 -0

```diff
@@ -107426,0 +110304,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -107510,0 +110390,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -107573,0 +110455,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -107641,0 +110525,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -107709,0 +110595,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -107787,0 +110675,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -107873,0 +110763,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -107924,0 +110816,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108016,0 +110910,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108067,0 +110963,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108144,0 +111042,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108204,0 +111104,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108257,0 +111159,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108320,0 +111224,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108405,0 +111311,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108456,0 +111364,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108519,0 +111429,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108596,0 +111508,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108676,0 +111590,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108762,0 +111678,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 75

other · +40 -0

```diff
@@ -108825,0 +111743,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108893,0 +111813,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -108956,0 +111878,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -109007,0 +111931,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -109077,0 +112003,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -109164,0 +112092,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -109241,0 +112171,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -109292,0 +112224,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -109355,0 +112289,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -109423,0 +112359,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -109534,0 +112472,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -109635,0 +112575,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -109720,0 +112662,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -109805,0 +112749,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -109892,0 +112838,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -109962,0 +112910,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -110032,0 +112982,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -110102,0 +113054,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -110170,0 +113124,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -110233,0 +113189,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 76

other · +40 -0

```diff
@@ -110363,0 +113321,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -110431,0 +113391,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -110501,0 +113463,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -110598,0 +113562,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -110692,0 +113658,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -110743,0 +113711,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -110813,0 +113783,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -110892,0 +113864,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -110986,0 +113960,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -111037,0 +114013,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -111100,0 +114078,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -111161,0 +114141,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -111231,0 +114213,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -111311,0 +114295,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -111374,0 +114360,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -111491,0 +114479,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -111563,0 +114553,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -111698,0 +114690,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -111766,0 +114760,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -111836,0 +114832,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 77

other · +39 -0

```diff
@@ -111904,0 +114902,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -111972,0 +114972,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -112033,0 +115035,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -112084,0 +115088,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -112145,0 +115151,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -112225,0 +115233,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -112293,0 +115303,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -112344,0 +115356,25 @@
+      "VariantOf": [
+        {
+          "Id": "dafa2dec-2fe6-4c6c-a07c-121de360d7b1",
+          "MaybeId": "dafa2dec-2fe6-4c6c-a07c-121de360d7b1",
+          "DeletedAt": null,
+          "VariantEntryId": "564fffa0-0aec-46ab-8d41-cbd30be82be1",
+          "VariantHeadword": "yenda",
+          "MainEntryId": "2bde7e2c-9ddc-4de0-b416-c24c0710c2fa",
+          "MainSenseId": null,
+          "MainHeadword": "enda",
+          "Types": [
+            {
+              "Id": "bbd4adb3-9af5-4542-94e8-b0932124108b",
+              "Name": {
+                "en": "Pronunciation Variant",
+                "pt": "Variac\u0327a\u0303o da Pronuncia"
+              },
+              "DeletedAt": null
+            }
+          ],
+          "HideMinorEntry": false,
+          "Comment": {}
+        }
+      ],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 78

other · +26 -0

```diff
@@ -112414,0 +115451,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -112482,0 +115521,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -112566,0 +115607,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -112629,0 +115672,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -112692,0 +115737,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -112755,0 +115802,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -112902,0 +115951,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -113033,0 +116084,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -113112,0 +116165,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -113175,0 +116230,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -113238,0 +116295,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -113308,0 +116367,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -113371,0 +116432,2 @@
+      "VariantOf": [],
+      "Variants": [],
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 79

other · +37 -1

```diff
@@ -130493,1 +133555,37 @@
-  }
+  },
+  "VariantTypes": [
+    {
+      "Id": "024b62c9-93b3-41a0-ab19-587a0030219a",
+      "Name": {
+        "en": "Dialectal Variant",
+        "pt": "Variac\u0327a\u0303o Dialectal"
+      },
+      "DeletedAt": null
+    },
+    {
+      "Id": "86dd5eb3-b90a-4296-afd3-60c312b63a9a",
+      "Name": {
+        "en": "Semantic Dialect Variant",
+        "pt": "Variac\u0327a\u0303o Sema\u0302ntica"
+      },
+      "DeletedAt": null
+    },
+    {
+      "Id": "bbd4adb3-9af5-4542-94e8-b0932124108b",
+      "Name": {
+        "en": "Pronunciation Variant",
+        "pt": "Variac\u0327a\u0303o da Pronuncia"
+      },
+      "DeletedAt": null
+    },
+    {
+      "Id": "c7fe4c4a-abaf-4a0b-b633-d3e73f4057ee",
+      "Name": {
+        "en": "Lexical Dialect Variant",
+        "pt": "Variac\u0327a\u0303o Lexical"
+      },
+      "DeletedAt": null
+    },
+    {
+      "Id": "4343b1ef-b54f-4fa4-9998-271319a6d74c",
+      "Name": {
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 80

other · +38 -0

```diff
@@ -133592,0 +133592,38 @@
+        "en": "Free Variant",
+        "pt": "Variac\u0327a\u0303o livre"
+      },
+      "DeletedAt": null
+    },
+    {
+      "Id": "fcc61889-00e6-467b-9cf0-8c4f48b9a486",
+      "Name": {
+        "en": "Inflectional Variant",
+        "pt": "Variac\u0327a\u0303o Inflectional"
+      },
+      "DeletedAt": null
+    },
+    {
+      "Id": "0c4663b3-4d9a-47af-b9a1-c8565d8112ed",
+      "Name": {
+        "en": "Spelling Variant",
+        "pt": "Variac\u0327a\u0303o de Soletrac\u0327a\u0303o"
+      },
+      "DeletedAt": null
+    },
+    {
+      "Id": "01d4fbc1-3b0c-4f52-9163-7ab0d4f4711c",
+      "Name": {
+        "en": "Irregularly Inflected Form"
+      },
+      "DeletedAt": null
+    },
+    {
+      "Id": "a32f1d1c-4832-46a2-9732-c2276d6547e8",
+      "Name": {
+        "en": "Plural"
+      },
+      "DeletedAt": null
+    },
+    {
+      "Id": "837ebe72-8c1d-4864-95d9-fa313c499d78",
+      "Name": {
```

## backend/FwLite/FwLiteProjectSync.Tests/sena-3-live_snapshot.verified.txt

### fragment 81

other · +12 -0

```diff
@@ -133630,0 +133630,12 @@
+        "en": "Past"
+      },
+      "DeletedAt": null
+    },
+    {
+      "Id": "3942addb-99fd-43e9-ab7d-99025ceb0d4e",
+      "Name": {
+        "en": "Unspecified Variant"
+      },
+      "DeletedAt": null
+    }
+  ]
```

## backend/FwLite/LcmCrdt.Tests/Changes/ChangeDeserializationRegressionData.latest.verified.txt

### fragment 1

other · +40 -0

```diff
@@ -1295,0 +1296,40 @@
+  },
+  {
+    "$type": "jsonPatch:VariantType",
+    "PatchDocument": [],
+    "EntityId": "7f36b194-09c4-1938-164e-820359470a8d"
+  },
+  {
+    "$type": "jsonPatch:Variant",
+    "PatchDocument": [],
+    "EntityId": "2c441083-20d5-f98e-bd30-453dee57152e"
+  },
+  {
+    "$type": "delete:VariantType",
+    "EntityId": "c76a3a53-8fa6-d2c3-df38-a742996e450e"
+  },
+  {
+    "$type": "delete:Variant",
+    "EntityId": "a33e0d22-ca25-baaa-b103-61595e8d8443"
+  },
+  {
+    "$type": "AddVariantChange",
+    "VariantEntryId": "6d309276-3cdc-3d59-7564-174855c2a66d",
+    "MainEntryId": "4ee3936e-f7bb-7bff-43ba-57a83f6e9090",
+    "MainSenseId": "51be3bfc-8d80-10f3-04a0-2f1b6b02a54a",
+    "Types": [
+      {
+        "Id": "d0d4caf3-7fcf-3cca-9044-fd1c8874a40e",
+        "Name": {
+          "bge": "Tactics",
+          "lla": "teal"
+        },
+        "DeletedAt": null
+      },
+      {
+        "Id": "eccfe67c-656e-b7a1-61f8-16fd6115f982",
+        "Name": {
+          "mrs": "ability"
+        },
+        "DeletedAt": null
+      }
```

## backend/FwLite/LcmCrdt.Tests/Changes/ChangeDeserializationRegressionData.latest.verified.txt

### fragment 2

other · +34 -0

```diff
@@ -1336,0 +1336,34 @@
+    ],
+    "HideMinorEntry": true,
+    "Comment": {
+      "dzl": {
+        "Spans": [
+          {
+            "Text": "Home Loan Account",
+            "Ws": "tdd",
+            "Bold": "Invert",
+            "FontSize": -635375918,
+            "ForeColor": "#FF0000",
+            "Tags": [
+              "284e5f58-55ce-28ae-b48a-2c683cfb7cd9"
+            ]
+          },
+          {
+            "Text": "calculate",
+            "Ws": "dzl",
+            "Tags": [
+              "f58baf48-036d-457f-a52f-359d4b662ee4"
+            ]
+          },
+          {
+            "Text": "XML",
+            "Ws": "dzl",
+            "Tags": [
+              "6f8f8ed2-6ada-498e-8bbf-1516e1a38946"
+            ]
+          }
+        ]
+      },
+      "poh": {
+        "Spans": [
+          {
```

## backend/FwLite/LcmCrdt.Tests/Changes/ChangeDeserializationRegressionData.latest.verified.txt

### fragment 3

other · +39 -0

```diff
@@ -1370,0 +1370,39 @@
+            "Text": "navigating",
+            "Ws": "plv",
+            "Bold": "Invert",
+            "FontSize": -1766572977,
+            "ForeColor": "#FF0000",
+            "Tags": [
+              "9a7525d3-a3a0-f5b6-75b8-dcc31842bd4b"
+            ]
+          },
+          {
+            "Text": "Buckinghamshire",
+            "Ws": "poh",
+            "Tags": [
+              "9733340e-a780-4915-9c6e-6a0a773bb624"
+            ]
+          },
+          {
+            "Text": "Reactive",
+            "Ws": "khw",
+            "Bold": "On",
+            "FontSize": 217067649,
+            "ForeColor": "#FF0000",
+            "Tags": [
+              "6590d40b-9c9e-6bf4-022e-cbef362e2539"
+            ]
+          },
+          {
+            "Text": "bypassing",
+            "Ws": "bao",
+            "Bold": "On",
+            "FontSize": -1139203638,
+            "ForeColor": "#00FFFF",
+            "Tags": [
+              "a158092c-95c6-ece7-40f0-245eef31b440"
+            ]
+          }
+        ]
+      },
+      "mto": {
```

## backend/FwLite/LcmCrdt.Tests/Changes/ChangeDeserializationRegressionData.latest.verified.txt

### fragment 4

other · +40 -0

```diff
@@ -1409,0 +1409,40 @@
+        "Spans": [
+          {
+            "Text": "Small Wooden Mouse",
+            "Ws": "mto",
+            "Tags": [
+              "82ce54e3-899e-49f9-b68e-a32aac910447"
+            ]
+          },
+          {
+            "Text": "invoice",
+            "Ws": "ggo",
+            "Bold": "Off",
+            "FontSize": 156095798,
+            "ForeColor": "#FF0000",
+            "Tags": [
+              "8c03dece-11db-82ec-d8db-7f5b322993eb"
+            ]
+          },
+          {
+            "Text": "Square",
+            "Ws": "mto",
+            "Tags": [
+              "bb75edd3-cfcf-49f2-ac3a-a675fc34068d"
+            ]
+          },
+          {
+            "Text": "Borders",
+            "Ws": "mof",
+            "Bold": "Off",
+            "FontSize": 1551749924,
+            "ForeColor": "#A52A2A",
+            "Tags": [
+              "83245146-9102-463d-6702-9805ecddf9ed"
+            ]
+          }
+        ]
+      },
+      "boj": {
+        "Spans": [
+          {
```

## backend/FwLite/LcmCrdt.Tests/Changes/ChangeDeserializationRegressionData.latest.verified.txt

### fragment 5

other · +40 -0

```diff
@@ -1449,0 +1449,40 @@
+            "Text": "Customer",
+            "Ws": "boj",
+            "Tags": [
+              "ab794f7a-1958-4c2f-82d8-dd80b331317f"
+            ]
+          },
+          {
+            "Text": "Response",
+            "Ws": "aso",
+            "Bold": "On",
+            "FontSize": 745397328,
+            "ForeColor": "#ADFF2F",
+            "Tags": [
+              "45286390-397e-4f46-c918-fc743707fe27"
+            ]
+          },
+          {
+            "Text": "visionary",
+            "Ws": "boj",
+            "Tags": [
+              "7f95818c-4e9f-4d43-85e4-91e2b1b7d7f6"
+            ]
+          }
+        ]
+      }
+    },
+    "EntityId": "696c660f-bc0e-75b2-3dc8-cd549fb77bc0"
+  },
+  {
+    "$type": "AddVariantTypeChange",
+    "VariantType": {
+      "Id": "c1d3f294-1a67-25b2-5110-864e2debb6bc",
+      "Name": {
+        "ggt": "Viaduct"
+      },
+      "DeletedAt": null
+    },
+    "EntityId": "0da6b6a5-5e7a-6f91-9610-a62c595dbdfb"
+  },
+  {
```

## backend/FwLite/LcmCrdt.Tests/Changes/ChangeDeserializationRegressionData.latest.verified.txt

### fragment 6

other · +12 -0

```diff
@@ -1489,0 +1489,12 @@
+    "$type": "RemoveVariantTypeChange",
+    "VariantTypeId": "33b6d5be-8799-580d-5587-8879e04c8cc9",
+    "EntityId": "8181bc40-4b7a-5402-4442-7eed4904cff1"
+  },
+  {
+    "$type": "CreateVariantType",
+    "Name": {
+      "csj": "calculating",
+      "ljp": "open system",
+      "nab": "Overpass"
+    },
+    "EntityId": "6a8e727c-2e47-90af-a1ec-42d94fc3e38e"
```

## backend/FwLite/LcmCrdt.Tests/Data/MigrationTests_FromScriptedDb.v1.ProjectSnapshot.verified.txt

### lines 73–257

other · +4 -1

```diff
@@ -72,0 +73,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -254,1 +256,2 @@
-  }
+  },
+  "VariantTypes": []
```

## backend/FwLite/LcmCrdt.Tests/Data/MigrationTests_FromScriptedDb.v1.Snapshots.verified.txt

### lines 80–81

other · +2 -0

```diff
@@ -79,0 +80,2 @@
+        "VariantOf": [],
+        "Variants": [],
```

## backend/FwLite/LcmCrdt.Tests/Data/MigrationTests_FromScriptedDb.v2.ProjectSnapshot.verified.txt

### lines 167–745

other · +10 -1

```diff
@@ -166,0 +167,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -250,0 +253,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -322,0 +327,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -394,0 +401,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -736,1 +744,2 @@
-  }
+  },
+  "VariantTypes": []
```

## backend/FwLite/LcmCrdt.Tests/Data/MigrationTests_FromScriptedDb.v2.Snapshots.verified.txt

### lines 110–537

other · +18 -0

```diff
@@ -109,0 +110,2 @@
+        "VariantOf": [],
+        "Variants": [],
@@ -154,0 +157,2 @@
+        "VariantOf": [],
+        "Variants": [],
@@ -200,0 +205,2 @@
+        "VariantOf": [],
+        "Variants": [],
@@ -254,0 +261,2 @@
+        "VariantOf": [],
+        "Variants": [],
@@ -316,0 +325,2 @@
+        "VariantOf": [],
+        "Variants": [],
@@ -387,0 +398,2 @@
+        "VariantOf": [],
+        "Variants": [],
@@ -431,0 +444,2 @@
+        "VariantOf": [],
+        "Variants": [],
@@ -475,0 +490,2 @@
+        "VariantOf": [],
+        "Variants": [],
@@ -519,0 +536,2 @@
+        "VariantOf": [],
+        "Variants": [],
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 1

other · +38 -0

```diff
@@ -90,0 +91,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -95,0 +98,36 @@
+  {
+    "$type": "MiniLcmCrdtAdapter",
+    "Obj": {
+      "$type": "Entry",
+      "Id": "2e6a7e6c-7abf-cd99-94b0-80c04d315d98",
+      "DeletedAt": null,
+      "LexemeForm": {
+        "xbn": "Direct",
+        "hla": "Soft"
+      },
+      "CitationForm": {
+        "mxb": "Money Market Account",
+        "lkb": "payment"
+      },
+      "LiteralMeaning": {
+        "ong": {
+          "Spans": [
+            {
+              "Text": "reciprocal",
+              "Ws": "ong",
+              "Tags": [
+                "ea0639e3-938a-40fa-b8dd-da4672d64210"
+              ]
+            }
+          ]
+        },
+        "kxu": {
+          "Spans": [
+            {
+              "Text": "invoice",
+              "Ws": "kxu",
+              "Tags": [
+                "42b03468-0642-407f-a3d8-eea36bfc95a0"
+              ]
+            },
+            {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 2

other · +35 -0

```diff
@@ -134,0 +134,35 @@
+              "Text": "Outdoors \u0026 Shoes",
+              "Ws": "kxu",
+              "Tags": [
+                "3ad34dad-b720-427c-9dd0-6090c5d6a5c6"
+              ]
+            },
+            {
+              "Text": "feed",
+              "Ws": "kxu",
+              "Tags": [
+                "b912d284-481e-48de-a9b4-870a5e285a08"
+              ]
+            },
+            {
+              "Text": "SMTP",
+              "Ws": "kxu",
+              "Tags": [
+                "0d3c4aa2-a3b3-4871-bf66-8406e5e8ec3c"
+              ]
+            }
+          ]
+        },
+        "ihi": {
+          "Spans": [
+            {
+              "Text": "generate",
+              "Ws": "wwb",
+              "Bold": "Off",
+              "FontSize": 1075171932,
+              "ForeColor": "#ADFF2F",
+              "Tags": [
+                "422d0492-d48e-0c65-b609-1690caad3603"
+              ]
+            },
+            {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 3

other · +39 -0

```diff
@@ -169,0 +169,39 @@
+              "Text": "synergistic",
+              "Ws": "ihi",
+              "Tags": [
+                "dacf7482-f6ec-4ac3-9a30-9c105833df66"
+              ]
+            },
+            {
+              "Text": "Computers",
+              "Ws": "ihi",
+              "Tags": [
+                "41ca560f-1ae7-41d1-a37d-c4faf18b0b58"
+              ]
+            }
+          ]
+        }
+      },
+      "MorphType": "Simulfix",
+      "HomographNumber": -1674377933,
+      "Senses": [],
+      "Note": {
+        "xuo": {
+          "Spans": [
+            {
+              "Text": "Security",
+              "Ws": "gin",
+              "Bold": "Off",
+              "FontSize": 1340465988,
+              "ForeColor": "#ADFF2F",
+              "Tags": [
+                "5879c653-6e26-d703-ce85-9ca519ef0bcb"
+              ]
+            },
+            {
+              "Text": "calculating",
+              "Ws": "xuo",
+              "Tags": [
+                "072c66e5-b950-45f4-b7e7-b70e4e279ecf"
+              ]
+            }
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 4

other · +38 -0

```diff
@@ -208,0 +208,38 @@
+          ]
+        }
+      },
+      "Components": [],
+      "ComplexForms": [],
+      "ComplexFormTypes": [
+        {
+          "Id": "3aca6492-07a4-3de2-e2c6-aba408f397bb",
+          "Name": {
+            "vmd": "reboot",
+            "duk": "invoice",
+            "ium": "Practical Plastic Towels",
+            "kxr": "withdrawal"
+          },
+          "DeletedAt": null
+        }
+      ],
+      "VariantOf": [
+        {
+          "Id": "4c619f87-442f-23b4-2983-41412a7ffe95",
+          "MaybeId": "4c619f87-442f-23b4-2983-41412a7ffe95",
+          "DeletedAt": null,
+          "VariantEntryId": "81176034-5b4d-85c1-2a47-04f8176759bd",
+          "VariantHeadword": "Wall",
+          "MainEntryId": "d93de12e-07f9-4f2f-8954-190e2abe06e9",
+          "MainSenseId": "96e31a4a-bbee-996b-759c-5187b29cfa7f",
+          "MainHeadword": "Tasty Soft Salad",
+          "Types": [
+            {
+              "Id": "99ab5593-63d1-ca4f-b979-d5e1af87d1ea",
+              "Name": {
+                "mok": "El Salvador",
+                "trx": "Coordinator",
+                "duc": "lime",
+                "xua": "cross-platform"
+              },
+              "DeletedAt": null
+            }
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 5

other · +38 -0

```diff
@@ -246,0 +246,38 @@
+          ],
+          "HideMinorEntry": true,
+          "Comment": {
+            "gew": {
+              "Spans": [
+                {
+                  "Text": "program",
+                  "Ws": "gew",
+                  "Tags": [
+                    "cc0c91a9-eea7-4948-8990-cc07a570056d"
+                  ]
+                },
+                {
+                  "Text": "Denmark",
+                  "Ws": "gew",
+                  "Tags": [
+                    "dc29b510-b94d-4eb6-af91-0903deea2fc6"
+                  ]
+                },
+                {
+                  "Text": "invoice",
+                  "Ws": "gew",
+                  "Tags": [
+                    "29a99076-1ccb-4b95-9beb-338ad843962f"
+                  ]
+                }
+              ]
+            },
+            "nik": {
+              "Spans": [
+                {
+                  "Text": "synthesize",
+                  "Ws": "nik",
+                  "Tags": [
+                    "6f54f2fd-e638-403d-9735-16257878b92a"
+                  ]
+                },
+                {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 6

other · +39 -0

```diff
@@ -284,0 +284,39 @@
+                  "Text": "Multi-lateral",
+                  "Ws": "nik",
+                  "Tags": [
+                    "4d67e4b7-1604-4262-afd4-af42580aa1b5"
+                  ]
+                }
+              ]
+            },
+            "aeq": {
+              "Spans": [
+                {
+                  "Text": "Rustic",
+                  "Ws": "ojp",
+                  "Bold": "Off",
+                  "FontSize": -1057944399,
+                  "ForeColor": "#A52A2A",
+                  "Tags": [
+                    "e454379a-dbba-1d27-58b0-45d4b40b6742"
+                  ]
+                }
+              ]
+            }
+          }
+        }
+      ],
+      "Variants": [
+        {
+          "Id": "86a01a92-d1aa-d020-4806-f4f7472b56d3",
+          "MaybeId": "86a01a92-d1aa-d020-4806-f4f7472b56d3",
+          "DeletedAt": null,
+          "VariantEntryId": "0a076330-b823-c5f3-092f-7df61125a364",
+          "VariantHeadword": "Dynamic",
+          "MainEntryId": "5cc279a5-baa9-1049-c88c-f2bde24e2531",
+          "MainSenseId": "587131ac-caff-2f98-9279-8fb32b29fed6",
+          "MainHeadword": "Communications",
+          "Types": [
+            {
+              "Id": "66c9952f-5b85-39fd-e4f9-cdcc1c69273c",
+              "Name": {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 7

other · +40 -0

```diff
@@ -323,0 +323,40 @@
+                "nlk": "copy"
+              },
+              "DeletedAt": null
+            }
+          ],
+          "HideMinorEntry": false,
+          "Comment": {
+            "mdp": {
+              "Spans": [
+                {
+                  "Text": "Jewelery",
+                  "Ws": "eri",
+                  "Bold": "On",
+                  "FontSize": -1242542580,
+                  "ForeColor": "#ADFF2F",
+                  "Tags": [
+                    "89d044a5-c286-2b2b-1682-64d47fc7d4bf"
+                  ]
+                },
+                {
+                  "Text": "methodologies",
+                  "Ws": "aba",
+                  "Bold": "On",
+                  "FontSize": 110774510,
+                  "ForeColor": "#A52A2A",
+                  "Tags": [
+                    "d744100f-a080-0581-82db-f7d2344df273"
+                  ]
+                }
+              ]
+            },
+            "xkg": {
+              "Spans": [
+                {
+                  "Text": "Intelligent Rubber Pizza",
+                  "Ws": "xkg",
+                  "Tags": [
+                    "c648d2fd-77c1-4a80-90f7-67e4da636439"
+                  ]
+                }
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 8

other · +40 -0

```diff
@@ -363,0 +363,40 @@
+              ]
+            },
+            "cpg": {
+              "Spans": [
+                {
+                  "Text": "calculating",
+                  "Ws": "cpg",
+                  "Tags": [
+                    "31ebc98f-9179-4edc-9e89-7c4711220151"
+                  ]
+                }
+              ]
+            },
+            "ify": {
+              "Spans": [
+                {
+                  "Text": "olive",
+                  "Ws": "ify",
+                  "Tags": [
+                    "6b281f29-55b9-4f4c-bf31-945fc1f12407"
+                  ]
+                },
+                {
+                  "Text": "Granite",
+                  "Ws": "agz",
+                  "Bold": "On",
+                  "FontSize": -1607886368,
+                  "ForeColor": "#A52A2A",
+                  "Tags": [
+                    "674f1746-1295-ea46-3a8a-24375fc1dca7"
+                  ]
+                },
+                {
+                  "Text": "Sleek Rubber Hat",
+                  "Ws": "ify",
+                  "Tags": [
+                    "2b5777aa-eb2a-4291-aef7-bd714ca05900"
+                  ]
+                },
+                {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 9

other · +40 -48

```diff
@@ -403,0 +403,28 @@
+                  "Text": "reboot",
+                  "Ws": "nsw",
+                  "Bold": "Invert",
+                  "FontSize": -1160287576,
+                  "ForeColor": "#00FFFF",
+                  "Tags": [
+                    "e3ad9b6e-8b58-187e-d876-e40a78e36968"
+                  ]
+                }
+              ]
+            }
+          }
+        }
+      ],
+      "PublishIn": [
+        {
+          "Id": "ee0b6860-87ac-709a-aa8c-0f20b06efa0b",
+          "DeletedAt": null,
+          "IsMain": false,
+          "Name": {
+            "amf": "Refined"
+          }
+        }
+      ]
+    },
+    "Id": "2e6a7e6c-7abf-cd99-94b0-80c04d315d98",
+    "DeletedAt": null
+  },
@@ -189,0 +525,2 @@
+      "VariantOf": [],
+      "Variants": [],
@@ -208,43 +545,1 @@
-      "Id": "82cf7254-3a4f-497a-9e15-7d93fc830356",
-      "DeletedAt": null,
-      "LexemeForm": {
-        "en": "\uD83C\uDF4C",
-        "th": "\u0E01\u0E25\u0E49\u0E27\u0E22"
-      },
-      "CitationForm": {},
-      "LiteralMeaning": {
-        "en": {
-          "Spans": [
-            {
-              "Text": "yellow fruit that comes in bunches.",
-              "Ws": "en"
-            }
-          ]
-        }
-      },
-      "MorphType": "Stem",
-      "HomographNumber": 0,
-      "Senses": [],
-      "Note": {
-        "en": {
-          "Spans": [
-            {
-              "Text": "often used in cartoon gags for slipping",
-              "Ws": "en"
-            }
-          ]
-        }
-      },
-      "Components": [],
-      "ComplexForms": [],
-      "ComplexFormTypes": [],
-      "PublishIn": []
-    },
-    "Id": "82cf7254-3a4f-497a-9e15-7d93fc830356",
-    "DeletedAt": null
-  },
-  {
-    "$type": "MiniLcmCrdtAdapter",
-    "Obj": {
-      "$type": "Entry",
-      "Id": "8dbc0f41-998e-836a-97e1-f05d46d95c92",
+      "Id": "a9cd7853-c982-5959-3186-ec248d8d41de",
@@ -253,1 +548,2 @@
-        "mqs": "maximized"
+        "cnl": "hard drive",
+        "all": "Taiwan"
@@ -256,1 +552,1 @@
-        "nrz": "Portugal"
+        "pam": "District"
@@ -259,1 +555,1 @@
-        "juy": {
+        "ama": {
@@ -262,2 +558,5 @@
-              "Text": "Kyat",
-              "Ws": "juy",
+              "Text": "Sleek",
+              "Ws": "bbd",
+              "Bold": "Invert",
+              "FontSize": -85638709,
+              "ForeColor": "#ADFF2F",
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 10

other · +24 -11

```diff
@@ -265,1 +564,1 @@
-                "bc47798c-6e35-430e-a94a-2d1aa82d9119"
+                "52197334-e928-b0cc-8914-ee3cca6d000e"
@@ -269,2 +568,2 @@
-              "Text": "synthesize",
-              "Ws": "juy",
+              "Text": "Personal Loan Account",
+              "Ws": "ama",
@@ -272,1 +571,1 @@
-                "75fc659a-ae47-45ec-87a8-2475d5667496"
+                "c6badbfd-0430-4245-b1f3-6dbfc3cf5ced"
@@ -274,4 +573,14 @@
-            }
-          ]
-        },
-        "rer": {
+            },
+            {
+              "Text": "Wooden",
+              "Ws": "fgr",
+              "Bold": "Invert",
+              "FontSize": -1658278656,
+              "ForeColor": "#A52A2A",
+              "Tags": [
+                "99c5aa5c-271c-d860-b815-a713850e4403"
+              ]
+            }
+          ]
+        },
+        "jaj": {
@@ -280,2 +589,5 @@
-              "Text": "Licensed",
-              "Ws": "rer",
+              "Text": "connect",
+              "Ws": "noi",
+              "Bold": "Off",
+              "FontSize": -1470543244,
+              "ForeColor": "#FF0000",
@@ -283,1 +595,1 @@
-                "adf734b1-3abb-4644-a5b7-e712c29a59e6"
+                "87c38be9-027c-83c7-cb99-59210e09f3d8"
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 11

other · +35 -2

```diff
@@ -287,2 +599,35 @@
-              "Text": "architectures",
-              "Ws": "dos",
+              "Text": "streamline",
+              "Ws": "jaj",
+              "Tags": [
+                "c49682bf-c285-4acf-9a3e-f6cb391b184b"
+              ]
+            },
+            {
+              "Text": "Bedfordshire",
+              "Ws": "xcw",
+              "Bold": "Invert",
+              "FontSize": 1053195674,
+              "ForeColor": "#FF0000",
+              "Tags": [
+                "f0ab79c7-ddff-63a0-1746-2825fd24206e"
+              ]
+            }
+          ]
+        }
+      },
+      "MorphType": "Suffix",
+      "HomographNumber": 996368112,
+      "Senses": [],
+      "Note": {
+        "nrb": {
+          "Spans": [
+            {
+              "Text": "blockchains",
+              "Ws": "nrb",
+              "Tags": [
+                "b62b9429-69ad-4f80-a66b-b3678383663b"
+              ]
+            },
+            {
+              "Text": "Ergonomic Soft Shoes",
+              "Ws": "jac",
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 12

other · +32 -8

```diff
@@ -290,1 +635,18 @@
-              "FontSize": -1392951304,
+              "FontSize": -1052383363,
+              "ForeColor": "#A52A2A",
+              "Tags": [
+                "a9a9dec9-08cc-2c34-a5ca-cf78d1107839"
+              ]
+            },
+            {
+              "Text": "Tasty",
+              "Ws": "nrb",
+              "Tags": [
+                "462f2665-8c79-4f7f-be99-86a100958929"
+              ]
+            },
+            {
+              "Text": "Shoes",
+              "Ws": "khr",
+              "Bold": "Invert",
+              "FontSize": 492536191,
@@ -293,1 +655,1 @@
-                "b316a4f4-208a-e75f-13f0-09a91a2b3506"
+                "27770394-7f08-6701-ac8a-e78f75048a9b"
@@ -298,1 +660,1 @@
-        "zpa": {
+        "cky": {
@@ -301,2 +663,2 @@
-              "Text": "Concrete",
-              "Ws": "zpa",
+              "Text": "Auto Loan Account",
+              "Ws": "cky",
@@ -304,1 +666,1 @@
-                "10cb16c2-6f15-4101-8689-7c77e6576f52"
+                "d864c261-66c8-4887-94ec-32d891358f72"
@@ -308,2 +670,9 @@
-              "Text": "Shoals",
-              "Ws": "cjy",
+              "Text": "Montana",
+              "Ws": "cky",
+              "Tags": [
+                "4562dc77-f99d-4de1-b832-cd8473543713"
+              ]
+            },
+            {
+              "Text": "optimal",
+              "Ws": "avt",
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 13

other · +16 -2

```diff
@@ -311,1 +680,15 @@
-              "FontSize": -437265941,
+              "FontSize": 212594793,
+              "ForeColor": "#00FFFF",
+              "Tags": [
+                "8bbd2e0e-13a5-b378-3193-a1a9498f4a1d"
+              ]
+            }
+          ]
+        },
+        "aqp": {
+          "Spans": [
+            {
+              "Text": "cross-platform",
+              "Ws": "wbq",
+              "Bold": "On",
+              "FontSize": -1898908819,
@@ -314,1 +697,1 @@
-                "53cd8e2b-15c6-0490-70d6-738a6708b9ca"
+                "1a98d7cc-742b-9e51-64e8-4849f6811d32"
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 14

other · +35 -1

```diff
@@ -320,1 +703,35 @@
-      "MorphType": "BoundStem",
+      "Components": [],
+      "ComplexForms": [],
+      "ComplexFormTypes": [
+        {
+          "Id": "bfea70b0-ebd5-86d8-ecfc-9ad4facfd9ca",
+          "Name": {
+            "aoe": "bypass"
+          },
+          "DeletedAt": null
+        }
+      ],
+      "VariantOf": [
+        {
+          "Id": "54c228d3-10b3-20c2-d7e6-38cbb280740c",
+          "MaybeId": "54c228d3-10b3-20c2-d7e6-38cbb280740c",
+          "DeletedAt": null,
+          "VariantEntryId": "d141258e-c100-a4fb-c1cd-63b059ddfb62",
+          "VariantHeadword": "Corporate",
+          "MainEntryId": "fc6512ab-e796-7a71-da3d-5c3edb7b3b10",
+          "MainSenseId": "43bf7d1b-292e-ba0c-9e10-56d4229036af",
+          "MainHeadword": "Chief",
+          "Types": [
+            {
+              "Id": "766ce347-e58e-c772-7e7c-ec5332c5b48b",
+              "Name": {
+                "bhh": "Avon"
+              },
+              "DeletedAt": null
+            }
+          ],
+          "HideMinorEntry": false,
+          "Comment": {
+            "iry": {
+              "Spans": [
+                {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 15

other · +38 -0

```diff
@@ -738,0 +738,38 @@
+                  "Text": "Practical Cotton Pants",
+                  "Ws": "iry",
+                  "Tags": [
+                    "49a57a3f-8891-49be-8487-9bbd4f399f84"
+                  ]
+                }
+              ]
+            }
+          }
+        }
+      ],
+      "Variants": [
+        {
+          "Id": "5b9c87d1-f228-81fd-e6fc-463b4ed48bb6",
+          "MaybeId": "5b9c87d1-f228-81fd-e6fc-463b4ed48bb6",
+          "DeletedAt": null,
+          "VariantEntryId": "a50a0851-684a-795c-5f22-8275682b0caa",
+          "VariantHeadword": "Lead",
+          "MainEntryId": "b26c4da8-08fe-9bf7-5ceb-6538be2ad689",
+          "MainSenseId": "710bd056-4f07-0627-407d-e744ffb759c3",
+          "MainHeadword": "Fantastic Fresh Shirt",
+          "Types": [
+            {
+              "Id": "d5886872-d109-8e7c-21f0-aaac0e8efe15",
+              "Name": {
+                "ett": "Berkshire",
+                "gbn": "Rubber",
+                "suw": "payment",
+                "xtu": "paradigm"
+              },
+              "DeletedAt": null
+            }
+          ],
+          "HideMinorEntry": true,
+          "Comment": {
+            "mls": {
+              "Spans": [
+                {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 16

other · +35 -0

```diff
@@ -776,0 +776,35 @@
+                  "Text": "architect",
+                  "Ws": "chl",
+                  "Bold": "Off",
+                  "FontSize": 1325800089,
+                  "ForeColor": "#A52A2A",
+                  "Tags": [
+                    "3ca232e9-ef03-a7c3-d5b1-75f06befc75c"
+                  ]
+                },
+                {
+                  "Text": "Executive",
+                  "Ws": "mls",
+                  "Tags": [
+                    "b0c2ea57-6dac-4d6e-8146-c5d383587416"
+                  ]
+                },
+                {
+                  "Text": "Unbranded",
+                  "Ws": "mls",
+                  "Tags": [
+                    "442f2eb4-936b-415b-807b-f0556f2f7ec5"
+                  ]
+                }
+              ]
+            },
+            "ibm": {
+              "Spans": [
+                {
+                  "Text": "override",
+                  "Ws": "ibm",
+                  "Tags": [
+                    "f9d5659d-2e1e-48cf-bee6-0f1453705837"
+                  ]
+                },
+                {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 17

other · +40 -0

```diff
@@ -811,0 +811,40 @@
+                  "Text": "Virginia",
+                  "Ws": "ibm",
+                  "Tags": [
+                    "ef5e05cf-c1ed-4497-a243-ad1e3365c5d1"
+                  ]
+                }
+              ]
+            },
+            "wac": {
+              "Spans": [
+                {
+                  "Text": "Avon",
+                  "Ws": "gwa",
+                  "Bold": "Invert",
+                  "FontSize": 279365784,
+                  "ForeColor": "#A52A2A",
+                  "Tags": [
+                    "770c6ac7-0a37-293a-fcdb-cbd7d402f71b"
+                  ]
+                },
+                {
+                  "Text": "initiatives",
+                  "Ws": "wac",
+                  "Tags": [
+                    "a99c4e9b-95a0-490d-89c0-13200670d310"
+                  ]
+                }
+              ]
+            },
+            "tl": {
+              "Spans": [
+                {
+                  "Text": "back up",
+                  "Ws": "tl",
+                  "Tags": [
+                    "cad367a0-ba3c-412d-b5aa-19db5f5d7037"
+                  ]
+                }
+              ]
+            }
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 18

other · +40 -1

```diff
@@ -851,0 +851,39 @@
+          }
+        }
+      ],
+      "PublishIn": [
+        {
+          "Id": "dc1d47e6-1a02-204d-923f-c8cb761a7e36",
+          "DeletedAt": null,
+          "IsMain": false,
+          "Name": {
+            "gra": "Tennessee"
+          }
+        }
+      ]
+    },
+    "Id": "a9cd7853-c982-5959-3186-ec248d8d41de",
+    "DeletedAt": null
+  },
+  {
+    "$type": "MiniLcmCrdtAdapter",
+    "Obj": {
+      "$type": "Entry",
+      "Id": "82cf7254-3a4f-497a-9e15-7d93fc830356",
+      "DeletedAt": null,
+      "LexemeForm": {
+        "en": "\uD83C\uDF4C",
+        "th": "\u0E01\u0E25\u0E49\u0E27\u0E22"
+      },
+      "CitationForm": {},
+      "LiteralMeaning": {
+        "en": {
+          "Spans": [
+            {
+              "Text": "yellow fruit that comes in bunches.",
+              "Ws": "en"
+            }
+          ]
+        }
+      },
+      "MorphType": "Stem",
@@ -324,1 +893,1 @@
-        "rkw": {
+        "en": {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 19

other · +35 -4

```diff
@@ -327,4 +896,35 @@
-              "Text": "XML",
-              "Ws": "vot",
-              "Bold": "On",
-              "FontSize": -1698959192,
+              "Text": "often used in cartoon gags for slipping",
+              "Ws": "en"
+            }
+          ]
+        }
+      },
+      "Components": [],
+      "ComplexForms": [],
+      "ComplexFormTypes": [],
+      "VariantOf": [],
+      "Variants": [],
+      "PublishIn": []
+    },
+    "Id": "82cf7254-3a4f-497a-9e15-7d93fc830356",
+    "DeletedAt": null
+  },
+  {
+    "$type": "MiniLcmCrdtAdapter",
+    "Obj": {
+      "$type": "Entry",
+      "Id": "3cdafca5-46e6-60ed-0b8a-e302d40f7ab8",
+      "DeletedAt": null,
+      "LexemeForm": {
+        "pkt": "reboot"
+      },
+      "CitationForm": {
+        "bqw": "Auto Loan Account",
+        "myq": "1080p",
+        "ula": "Director",
+        "xwg": "Toys \u0026 Kids"
+      },
+      "LiteralMeaning": {
+        "hav": {
+          "Spans": [
+            {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 20

other · +27 -3

```diff
@@ -931,0 +931,21 @@
+              "Text": "system",
+              "Ws": "hav",
+              "Tags": [
+                "1d22ad30-96dc-47c3-a7f8-761b3d830b25"
+              ]
+            },
+            {
+              "Text": "front-end",
+              "Ws": "mnw",
+              "Bold": "Off",
+              "FontSize": 1230763621,
+              "ForeColor": "#00000000",
+              "Tags": [
+                "fd1b73bd-ad1b-a20d-c981-905c8823e12c"
+              ]
+            },
+            {
+              "Text": "Stream",
+              "Ws": "bve",
+              "Bold": "Off",
+              "FontSize": 621343644,
@@ -333,1 +954,1 @@
-                "9218c79b-f453-0ef3-de05-ea5eeba26367"
+                "aaeeb616-fd0d-f67d-7738-b0d39c4c9512"
@@ -337,2 +958,5 @@
-              "Text": "invoice",
-              "Ws": "rkw",
+              "Text": "Electronics",
+              "Ws": "aiy",
+              "Bold": "Invert",
+              "FontSize": 39794053,
+              "ForeColor": "#A52A2A",
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 21

other · +22 -5

```diff
@@ -340,1 +964,15 @@
-                "6ef3cf72-b5a5-488c-9381-fb7a7f6f961e"
+                "7e50c044-9786-1e39-a9ac-92d54342ac3e"
+              ]
+            }
+          ]
+        },
+        "dyr": {
+          "Spans": [
+            {
+              "Text": "extend",
+              "Ws": "kve",
+              "Bold": "Invert",
+              "FontSize": -422062800,
+              "ForeColor": "#00FFFF",
+              "Tags": [
+                "b6172c2b-3580-8f98-81c5-4789bb11e455"
@@ -344,2 +982,5 @@
-              "Text": "bypass",
-              "Ws": "rkw",
+              "Text": "synthesizing",
+              "Ws": "aja",
+              "Bold": "Invert",
+              "FontSize": 1174438189,
+              "ForeColor": "#00000000",
@@ -347,1 +988,1 @@
-                "e615bb12-61d9-452e-bac5-06deb6942851"
+                "41548c3d-3532-3798-84aa-9d40adf93824"
@@ -352,1 +993,1 @@
-        "kee": {
+        "pea": {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 22

other · +39 -5

```diff
@@ -355,5 +996,39 @@
-              "Text": "Money Market Account",
-              "Ws": "ekp",
-              "Bold": "On",
-              "FontSize": -315220510,
-              "ForeColor": "#A52A2A",
+              "Text": "back-end",
+              "Ws": "pea",
+              "Tags": [
+                "3cb309a7-8115-4482-bfdc-ac8f257eb4ad"
+              ]
+            }
+          ]
+        }
+      },
+      "MorphType": "Particle",
+      "HomographNumber": -762509614,
+      "Senses": [],
+      "Note": {
+        "mda": {
+          "Spans": [
+            {
+              "Text": "frictionless",
+              "Ws": "mda",
+              "Tags": [
+                "2c0851ea-e5be-41d5-b49e-cf8fec10c89c"
+              ]
+            },
+            {
+              "Text": "collaborative",
+              "Ws": "prb",
+              "Bold": "Off",
+              "FontSize": -1566428427,
+              "ForeColor": "#00FFFF",
+              "Tags": [
+                "c1c64703-55b8-e014-a74d-a979ac3d8e02"
+              ]
+            },
+            {
+              "Text": "Congo",
+              "Ws": "mda",
+              "Tags": [
+                "e48be2ae-71b7-45d7-a57f-358267cfff47"
+              ]
+            }
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 23

other · +40 -0

```diff
@@ -1035,0 +1035,40 @@
+          ]
+        },
+        "kyx": {
+          "Spans": [
+            {
+              "Text": "web-enabled",
+              "Ws": "sgh",
+              "Bold": "Off",
+              "FontSize": 1542390070,
+              "ForeColor": "#00FFFF",
+              "Tags": [
+                "b23f7a6a-1857-cb51-3aa5-6694483629fe"
+              ]
+            },
+            {
+              "Text": "back-end",
+              "Ws": "npl",
+              "Bold": "On",
+              "FontSize": -1671856556,
+              "ForeColor": "#0000FF",
+              "Tags": [
+                "4304b005-673b-15e7-1b73-a16c7e107d62"
+              ]
+            }
+          ]
+        }
+      },
+      "Components": [],
+      "ComplexForms": [],
+      "ComplexFormTypes": [
+        {
+          "Id": "ccfdf2a2-ac60-433a-41ea-22b4ffff2d4b",
+          "Name": {
+            "gno": "Massachusetts"
+          },
+          "DeletedAt": null
+        }
+      ],
+      "VariantOf": [
+        {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 24

other · +38 -0

```diff
@@ -1075,0 +1075,38 @@
+          "Id": "9db32aab-3ce1-a8e8-3ed9-cf3b240f6968",
+          "MaybeId": "9db32aab-3ce1-a8e8-3ed9-cf3b240f6968",
+          "DeletedAt": null,
+          "VariantEntryId": "6d4179be-9789-faa0-a60d-0124b5e6aedc",
+          "VariantHeadword": "purple",
+          "MainEntryId": "36b6909e-b5e9-397d-05d4-1dbae22ec50a",
+          "MainSenseId": "266fba93-8a74-c0b3-ca71-65164b008f52",
+          "MainHeadword": "convergence",
+          "Types": [
+            {
+              "Id": "54162871-9d18-ad79-b155-ce2f98f97265",
+              "Name": {
+                "bwh": "back up",
+                "xba": "reinvent",
+                "aza": "Mews"
+              },
+              "DeletedAt": null
+            }
+          ],
+          "HideMinorEntry": false,
+          "Comment": {
+            "niz": {
+              "Spans": [
+                {
+                  "Text": "alarm",
+                  "Ws": "niz",
+                  "Tags": [
+                    "8cf34d1a-b942-4794-a42d-568e56fb1249"
+                  ]
+                },
+                {
+                  "Text": "Manager",
+                  "Ws": "niz",
+                  "Tags": [
+                    "749f132e-5b62-42b7-86ff-059a2a4fcd5e"
+                  ]
+                },
+                {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 25

other · +40 -0

```diff
@@ -1113,0 +1113,40 @@
+                  "Text": "Madagascar",
+                  "Ws": "ktw",
+                  "Bold": "Off",
+                  "FontSize": -1245901176,
+                  "ForeColor": "#00FFFF",
+                  "Tags": [
+                    "f002ec10-2a72-7416-f135-278e82c48b14"
+                  ]
+                },
+                {
+                  "Text": "Fresh",
+                  "Ws": "niz",
+                  "Tags": [
+                    "4257831c-6cf6-445c-bdfc-d2e10c6546fc"
+                  ]
+                }
+              ]
+            },
+            "pmz": {
+              "Spans": [
+                {
+                  "Text": "Realigned",
+                  "Ws": "mzi",
+                  "Bold": "Invert",
+                  "FontSize": -208583590,
+                  "ForeColor": "#00FFFF",
+                  "Tags": [
+                    "946afd05-dfdd-48cf-6615-a55dbc30ce72"
+                  ]
+                },
+                {
+                  "Text": "Optimized",
+                  "Ws": "pmz",
+                  "Tags": [
+                    "c14fd0d8-9f8f-4d81-b40e-0dc89703b261"
+                  ]
+                }
+              ]
+            },
+            "khr": {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 26

other · +40 -0

```diff
@@ -1153,0 +1153,40 @@
+              "Spans": [
+                {
+                  "Text": "knowledge user",
+                  "Ws": "mlc",
+                  "Bold": "Off",
+                  "FontSize": 81689857,
+                  "ForeColor": "#ADFF2F",
+                  "Tags": [
+                    "8a91586b-d2a7-c062-8089-300cf9e5b686"
+                  ]
+                },
+                {
+                  "Text": "Trail",
+                  "Ws": "khr",
+                  "Tags": [
+                    "e75ec01a-e52c-4e30-b929-ad09a709fd7f"
+                  ]
+                },
+                {
+                  "Text": "Metrics",
+                  "Ws": "khr",
+                  "Tags": [
+                    "f1c8ab11-3d04-484b-83aa-b473de8ce350"
+                  ]
+                }
+              ]
+            }
+          }
+        }
+      ],
+      "Variants": [
+        {
+          "Id": "9a6a68d5-58a6-81c0-ab95-e365558ee35a",
+          "MaybeId": "9a6a68d5-58a6-81c0-ab95-e365558ee35a",
+          "DeletedAt": null,
+          "VariantEntryId": "7618d904-0761-ab81-ba1c-853b9401d1d5",
+          "VariantHeadword": "interfaces",
+          "MainEntryId": "ccc647fd-fca5-9c93-d296-43f13c223506",
+          "MainSenseId": "90f4721d-d38c-497f-955b-955acb2499f4",
+          "MainHeadword": "Fresh",
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 27

other · +35 -0

```diff
@@ -1193,0 +1193,35 @@
+          "Types": [
+            {
+              "Id": "aa41d766-846e-2d53-cebd-50ca612bd6de",
+              "Name": {
+                "pxm": "magenta",
+                "lmi": "database"
+              },
+              "DeletedAt": null
+            }
+          ],
+          "HideMinorEntry": false,
+          "Comment": {
+            "gcl": {
+              "Spans": [
+                {
+                  "Text": "Refined Rubber Sausages",
+                  "Ws": "cmt",
+                  "Bold": "Off",
+                  "FontSize": -430354912,
+                  "ForeColor": "#00FFFF",
+                  "Tags": [
+                    "19fbeff0-b9b2-dbc0-83c0-18af65ac176d"
+                  ]
+                },
+                {
+                  "Text": "Bedfordshire",
+                  "Ws": "ald",
+                  "Bold": "On",
+                  "FontSize": -605772228,
+                  "ForeColor": "#0000FF",
+                  "Tags": [
+                    "ea667bb7-8cd0-872e-aff4-6534377ff096"
+                  ]
+                },
+                {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 28

other · +38 -0

```diff
@@ -1228,0 +1228,38 @@
+                  "Text": "Director",
+                  "Ws": "gcl",
+                  "Tags": [
+                    "45b61b57-989d-41f8-9ffd-ff957f611934"
+                  ]
+                },
+                {
+                  "Text": "Generic Rubber Chicken",
+                  "Ws": "omp",
+                  "Bold": "On",
+                  "FontSize": 1234054480,
+                  "ForeColor": "#ADFF2F",
+                  "Tags": [
+                    "93241b11-508c-6711-2e9f-99d55ed4c489"
+                  ]
+                }
+              ]
+            },
+            "sdu": {
+              "Spans": [
+                {
+                  "Text": "e-services",
+                  "Ws": "sdu",
+                  "Tags": [
+                    "69d83464-b127-45a3-8e80-1f12c6414995"
+                  ]
+                },
+                {
+                  "Text": "rich",
+                  "Ws": "psy",
+                  "Bold": "Invert",
+                  "FontSize": 425981535,
+                  "ForeColor": "#A52A2A",
+                  "Tags": [
+                    "cb4eafe1-71dc-53cf-e8d1-87fee8792d65"
+                  ]
+                },
+                {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 29

other · +38 -0

```diff
@@ -1266,0 +1266,38 @@
+                  "Text": "Cote d\u0027Ivoire",
+                  "Ws": "gyi",
+                  "Bold": "Off",
+                  "FontSize": -802216504,
+                  "ForeColor": "#ADFF2F",
+                  "Tags": [
+                    "3be90aaa-fb8b-21c8-f217-daa170c8d4f6"
+                  ]
+                }
+              ]
+            }
+          }
+        }
+      ],
+      "PublishIn": [
+        {
+          "Id": "d2892b2c-fc81-8c2f-5586-baa81b6d1530",
+          "DeletedAt": null,
+          "IsMain": false,
+          "Name": {
+            "mnj": "Plastic"
+          }
+        }
+      ]
+    },
+    "Id": "3cdafca5-46e6-60ed-0b8a-e302d40f7ab8",
+    "DeletedAt": null
+  },
+  {
+    "$type": "MiniLcmCrdtAdapter",
+    "Obj": {
+      "$type": "Entry",
+      "Id": "8dbc0f41-998e-836a-97e1-f05d46d95c92",
+      "DeletedAt": null,
+      "LexemeForm": {
+        "mqs": "maximized"
+      },
+      "CitationForm": {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 30

other · +40 -0

```diff
@@ -1304,0 +1304,40 @@
+        "nrz": "Portugal"
+      },
+      "LiteralMeaning": {
+        "juy": {
+          "Spans": [
+            {
+              "Text": "Kyat",
+              "Ws": "juy",
+              "Tags": [
+                "bc47798c-6e35-430e-a94a-2d1aa82d9119"
+              ]
+            },
+            {
+              "Text": "synthesize",
+              "Ws": "juy",
+              "Tags": [
+                "75fc659a-ae47-45ec-87a8-2475d5667496"
+              ]
+            }
+          ]
+        },
+        "rer": {
+          "Spans": [
+            {
+              "Text": "Licensed",
+              "Ws": "rer",
+              "Tags": [
+                "adf734b1-3abb-4644-a5b7-e712c29a59e6"
+              ]
+            },
+            {
+              "Text": "architectures",
+              "Ws": "dos",
+              "Bold": "On",
+              "FontSize": -1392951304,
+              "ForeColor": "#ADFF2F",
+              "Tags": [
+                "b316a4f4-208a-e75f-13f0-09a91a2b3506"
+              ]
+            }
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 31

other · +40 -0

```diff
@@ -1344,0 +1344,40 @@
+          ]
+        },
+        "zpa": {
+          "Spans": [
+            {
+              "Text": "Concrete",
+              "Ws": "zpa",
+              "Tags": [
+                "10cb16c2-6f15-4101-8689-7c77e6576f52"
+              ]
+            },
+            {
+              "Text": "Shoals",
+              "Ws": "cjy",
+              "Bold": "Invert",
+              "FontSize": -437265941,
+              "ForeColor": "#ADFF2F",
+              "Tags": [
+                "53cd8e2b-15c6-0490-70d6-738a6708b9ca"
+              ]
+            }
+          ]
+        }
+      },
+      "MorphType": "BoundStem",
+      "HomographNumber": 0,
+      "Senses": [],
+      "Note": {
+        "rkw": {
+          "Spans": [
+            {
+              "Text": "XML",
+              "Ws": "vot",
+              "Bold": "On",
+              "FontSize": -1698959192,
+              "ForeColor": "#ADFF2F",
+              "Tags": [
+                "9218c79b-f453-0ef3-de05-ea5eeba26367"
+              ]
+            },
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 32

other · +36 -0

```diff
@@ -1384,0 +1384,36 @@
+            {
+              "Text": "invoice",
+              "Ws": "rkw",
+              "Tags": [
+                "6ef3cf72-b5a5-488c-9381-fb7a7f6f961e"
+              ]
+            },
+            {
+              "Text": "bypass",
+              "Ws": "rkw",
+              "Tags": [
+                "e615bb12-61d9-452e-bac5-06deb6942851"
+              ]
+            }
+          ]
+        },
+        "kee": {
+          "Spans": [
+            {
+              "Text": "Money Market Account",
+              "Ws": "ekp",
+              "Bold": "On",
+              "FontSize": -315220510,
+              "ForeColor": "#A52A2A",
+              "Tags": [
+                "424e0f12-78a7-37c7-8fa5-74dd81ccc8a7"
+              ]
+            },
+            {
+              "Text": "Glens",
+              "Ws": "kee",
+              "Tags": [
+                "a323544c-2b85-4fa7-b3c7-f5321ad75c49"
+              ]
+            },
+            {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 33

other · +37 -0

```diff
@@ -1420,0 +1420,37 @@
+              "Text": "Buckinghamshire",
+              "Ws": "kee",
+              "Tags": [
+                "13a974bf-8b90-4f36-99c6-9f0771f53db0"
+              ]
+            },
+            {
+              "Text": "SMTP",
+              "Ws": "cly",
+              "Bold": "Invert",
+              "FontSize": 872689318,
+              "ForeColor": "#0000FF",
+              "Tags": [
+                "498aea00-217b-9a3e-7fd0-2748edadf3b3"
+              ]
+            }
+          ]
+        }
+      },
+      "Components": [],
+      "ComplexForms": [],
+      "ComplexFormTypes": [
+        {
+          "Id": "292e9847-8c7c-56e1-87fb-41d200c789e1",
+          "Name": {
+            "hup": "THX",
+            "rsk": "Reduced",
+            "zmq": "hard drive",
+            "nnx": "cyan"
+          },
+          "DeletedAt": null
+        }
+      ],
+      "VariantOf": [],
+      "Variants": [],
+      "PublishIn": [
+        {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 34

other · +40 -0

```diff
@@ -1457,0 +1457,40 @@
+          "Id": "bd874c92-e063-2a20-d263-bdc6897a1e85",
+          "DeletedAt": null,
+          "IsMain": false,
+          "Name": {
+            "zrg": "cross-platform",
+            "bno": "heuristic"
+          }
+        }
+      ]
+    },
+    "Id": "8dbc0f41-998e-836a-97e1-f05d46d95c92",
+    "DeletedAt": null
+  },
+  {
+    "$type": "MiniLcmCrdtAdapter",
+    "Obj": {
+      "$type": "Entry",
+      "Id": "21b941a4-fbb7-f706-0aab-529c84b402b5",
+      "DeletedAt": null,
+      "LexemeForm": {
+        "nar": "Tasty Rubber Chair",
+        "luh": "Brunei Dollar",
+        "mok": "navigate"
+      },
+      "CitationForm": {
+        "mih": "hub",
+        "tiq": "New Zealand Dollar"
+      },
+      "LiteralMeaning": {
+        "mtu": {
+          "Spans": [
+            {
+              "Text": "Unbranded Rubber Sausages",
+              "Ws": "qvo",
+              "Bold": "Off",
+              "FontSize": 1178067194,
+              "ForeColor": "#A52A2A",
+              "Tags": [
+                "d321668f-b5fb-4eea-8064-de2784319aa4"
+              ]
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 35

other · +33 -0

```diff
@@ -1497,0 +1497,33 @@
+            },
+            {
+              "Text": "Soft",
+              "Ws": "jio",
+              "Bold": "On",
+              "FontSize": 897718303,
+              "ForeColor": "#A52A2A",
+              "Tags": [
+                "9a5e7604-a21f-546d-3b49-d730a05bacb7"
+              ]
+            },
+            {
+              "Text": "haptic",
+              "Ws": "mtu",
+              "Tags": [
+                "ba19fe02-0e18-4e92-9fb4-73f7b4ff7e29"
+              ]
+            }
+          ]
+        },
+        "tnc": {
+          "Spans": [
+            {
+              "Text": "Practical",
+              "Ws": "wof",
+              "Bold": "Off",
+              "FontSize": -1535748655,
+              "ForeColor": "#00FFFF",
+              "Tags": [
+                "bfb0c24e-3275-7312-a6af-171f2e77adea"
+              ]
+            },
+            {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 36

other · +40 -0

```diff
@@ -1530,0 +1530,40 @@
+              "Text": "quantifying",
+              "Ws": "awy",
+              "Bold": "Off",
+              "FontSize": -281573942,
+              "ForeColor": "#ADFF2F",
+              "Tags": [
+                "e9bdeced-7404-3248-6b7d-3d73579133b4"
+              ]
+            },
+            {
+              "Text": "Lebanese Pound",
+              "Ws": "tnc",
+              "Tags": [
+                "d9b188e4-9a17-4636-a39b-ca4268035281"
+              ]
+            },
+            {
+              "Text": "Officer",
+              "Ws": "kwy",
+              "Bold": "Off",
+              "FontSize": -907207124,
+              "ForeColor": "#ADFF2F",
+              "Tags": [
+                "6f598667-4c76-a59f-6639-d85fa5caaee3"
+              ]
+            }
+          ]
+        },
+        "met": {
+          "Spans": [
+            {
+              "Text": "incremental",
+              "Ws": "kpl",
+              "Bold": "On",
+              "FontSize": 309135679,
+              "ForeColor": "#A52A2A",
+              "Tags": [
+                "b76f0bac-9fe3-afb3-cc64-c01aa7c650cc"
+              ]
+            },
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 37

other · +36 -0

```diff
@@ -1570,0 +1570,36 @@
+            {
+              "Text": "Awesome Steel Shirt",
+              "Ws": "met",
+              "Tags": [
+                "421ee914-5d3a-4ccb-b71e-114b560efe88"
+              ]
+            },
+            {
+              "Text": "XSS",
+              "Ws": "met",
+              "Tags": [
+                "9cf1278d-37a5-4ba7-968d-0817a1280b1d"
+              ]
+            },
+            {
+              "Text": "Wyoming",
+              "Ws": "lkh",
+              "Bold": "Off",
+              "FontSize": 2029647080,
+              "ForeColor": "#00FFFF",
+              "Tags": [
+                "ccf7b25b-931a-7f85-62e9-5fe9b49d7aa0"
+              ]
+            }
+          ]
+        },
+        "bmk": {
+          "Spans": [
+            {
+              "Text": "incubate",
+              "Ws": "bmk",
+              "Tags": [
+                "27ff80df-e700-49db-8a7b-517933050d07"
+              ]
+            },
+            {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 38

other · +40 -0

```diff
@@ -1606,0 +1606,40 @@
+              "Text": "Rubber",
+              "Ws": "ddi",
+              "Bold": "Off",
+              "FontSize": 1247133799,
+              "ForeColor": "#A52A2A",
+              "Tags": [
+                "520317dc-2190-3cf0-bbba-bcd6ff830999"
+              ]
+            },
+            {
+              "Text": "Buckinghamshire",
+              "Ws": "bmk",
+              "Tags": [
+                "35e9e4c6-24fe-46aa-b3ea-788e4729a500"
+              ]
+            }
+          ]
+        }
+      },
+      "MorphType": "Enclitic",
+      "HomographNumber": 288646034,
+      "Senses": [],
+      "Note": {
+        "obl": {
+          "Spans": [
+            {
+              "Text": "Maryland",
+              "Ws": "yhd",
+              "Bold": "Off",
+              "FontSize": -49334912,
+              "ForeColor": "#00000000",
+              "Tags": [
+                "2d8fec7c-5396-ea81-55e2-28e9ca2fb19a"
+              ]
+            }
+          ]
+        },
+        "urn": {
+          "Spans": [
+            {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 39

other · +40 -0

```diff
@@ -1646,0 +1646,40 @@
+              "Text": "PCI",
+              "Ws": "apz",
+              "Bold": "Invert",
+              "FontSize": -101349684,
+              "ForeColor": "#ADFF2F",
+              "Tags": [
+                "3f4fcdb6-49ae-0047-84a9-dd8c5387e0c6"
+              ]
+            }
+          ]
+        },
+        "vmd": {
+          "Spans": [
+            {
+              "Text": "whiteboard",
+              "Ws": "vmd",
+              "Tags": [
+                "ac082b83-c17e-4dde-88e4-f5496c06da55"
+              ]
+            },
+            {
+              "Text": "cutting-edge",
+              "Ws": "vmd",
+              "Tags": [
+                "ebc22ab4-9861-469b-8eb3-24bd8ee77271"
+              ]
+            }
+          ]
+        },
+        "lo": {
+          "Spans": [
+            {
+              "Text": "Graphical User Interface",
+              "Ws": "sjc",
+              "Bold": "Invert",
+              "FontSize": 1010008301,
+              "ForeColor": "#FF0000",
+              "Tags": [
+                "738f95ee-777f-bd8e-9c25-fdf853919571"
+              ]
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 40

other · +36 -0

```diff
@@ -1686,0 +1686,36 @@
+            },
+            {
+              "Text": "Trace",
+              "Ws": "lo",
+              "Tags": [
+                "cec5d529-8bef-40d1-9007-8284f9b62813"
+              ]
+            }
+          ]
+        }
+      },
+      "Components": [],
+      "ComplexForms": [],
+      "ComplexFormTypes": [
+        {
+          "Id": "e011543b-218d-8dc9-cb5b-ef51b039e01b",
+          "Name": {
+            "hih": "transition"
+          },
+          "DeletedAt": null
+        }
+      ],
+      "VariantOf": [
+        {
+          "Id": "81e7a0f3-07ae-9501-c9fc-012c9f4d72f8",
+          "MaybeId": "81e7a0f3-07ae-9501-c9fc-012c9f4d72f8",
+          "DeletedAt": null,
+          "VariantEntryId": "0d7ecb9e-640e-0136-3177-5f3725e3ff9c",
+          "VariantHeadword": "copying",
+          "MainEntryId": "c28531d2-4de4-3de3-36c3-c4eda08de343",
+          "MainSenseId": "917b785c-8a5c-d651-e6bf-8ee95b975268",
+          "MainHeadword": "matrix",
+          "Types": [
+            {
+              "Id": "47b33565-0be3-32c4-e0ad-348f191b6763",
+              "Name": {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 41

other · +39 -0

```diff
@@ -1722,0 +1722,39 @@
+                "tto": "Function-based",
+                "mln": "Toys \u0026 Health"
+              },
+              "DeletedAt": null
+            }
+          ],
+          "HideMinorEntry": false,
+          "Comment": {
+            "kdu": {
+              "Spans": [
+                {
+                  "Text": "Soft",
+                  "Ws": "lbb",
+                  "Bold": "Off",
+                  "FontSize": 1504894779,
+                  "ForeColor": "#ADFF2F",
+                  "Tags": [
+                    "23000220-e88c-70d5-9add-4df3ce8fe113"
+                  ]
+                },
+                {
+                  "Text": "Azerbaijanian Manat",
+                  "Ws": "kdu",
+                  "Tags": [
+                    "84781e74-2daf-4343-9163-07146adbf10d"
+                  ]
+                },
+                {
+                  "Text": "Fantastic",
+                  "Ws": "kdu",
+                  "Tags": [
+                    "bf26f933-43e6-4836-8110-83a70c57ed9c"
+                  ]
+                }
+              ]
+            },
+            "kgu": {
+              "Spans": [
+                {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 42

other · +35 -0

```diff
@@ -1761,0 +1761,35 @@
+                  "Text": "Savings Account",
+                  "Ws": "hmi",
+                  "Bold": "Invert",
+                  "FontSize": -1415115979,
+                  "ForeColor": "#A52A2A",
+                  "Tags": [
+                    "eae2f706-1777-c843-9406-53c52fa6c245"
+                  ]
+                },
+                {
+                  "Text": "index",
+                  "Ws": "kgu",
+                  "Tags": [
+                    "7a3a569c-2ed4-4fa2-8c32-79435d943ba6"
+                  ]
+                }
+              ]
+            },
+            "dlg": {
+              "Spans": [
+                {
+                  "Text": "Wooden",
+                  "Ws": "dlg",
+                  "Tags": [
+                    "fd4f43a8-1fa6-4269-aab0-4e6d4d4bcd92"
+                  ]
+                },
+                {
+                  "Text": "website",
+                  "Ws": "dlg",
+                  "Tags": [
+                    "03d3f612-c192-428d-97f4-419ca77bed8e"
+                  ]
+                },
+                {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 43

other · +40 -0

```diff
@@ -1796,0 +1796,40 @@
+                  "Text": "Manager",
+                  "Ws": "gvs",
+                  "Bold": "On",
+                  "FontSize": -1069962004,
+                  "ForeColor": "#00FFFF",
+                  "Tags": [
+                    "8dc4a280-da41-d085-2e52-9787f7db26ea"
+                  ]
+                }
+              ]
+            },
+            "mtf": {
+              "Spans": [
+                {
+                  "Text": "Licensed Plastic Sausages",
+                  "Ws": "nra",
+                  "Bold": "On",
+                  "FontSize": -883851573,
+                  "ForeColor": "#0000FF",
+                  "Tags": [
+                    "4f6ea9d5-5680-42bb-93b4-ceb1d18b90a3"
+                  ]
+                },
+                {
+                  "Text": "Progressive",
+                  "Ws": "mtf",
+                  "Tags": [
+                    "3a8e2fe9-679c-4a3d-a980-d82240464ed2"
+                  ]
+                },
+                {
+                  "Text": "Borders",
+                  "Ws": "mtf",
+                  "Tags": [
+                    "0af175a1-59ef-42e2-886c-73b6a11ad0e1"
+                  ]
+                }
+              ]
+            }
+          }
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 44

other · +37 -0

```diff
@@ -1836,0 +1836,37 @@
+        }
+      ],
+      "Variants": [
+        {
+          "Id": "9bfecd7f-6382-5236-4f2f-0a762a72fb90",
+          "MaybeId": "9bfecd7f-6382-5236-4f2f-0a762a72fb90",
+          "DeletedAt": null,
+          "VariantEntryId": "43f0a46f-364f-eee0-a013-1812448b50e1",
+          "VariantHeadword": "olive",
+          "MainEntryId": "9441127f-18dd-b52f-d49e-629ca50611ac",
+          "MainSenseId": "519758f1-a6c0-7833-468e-8f326607cf0c",
+          "MainHeadword": "Orchestrator",
+          "Types": [
+            {
+              "Id": "0bc3123f-673b-215f-1f24-5fae892969ee",
+              "Name": {
+                "blb": "calculating",
+                "rga": "Awesome Metal Chicken"
+              },
+              "DeletedAt": null
+            }
+          ],
+          "HideMinorEntry": true,
+          "Comment": {
+            "sfe": {
+              "Spans": [
+                {
+                  "Text": "synthesize",
+                  "Ws": "wmc",
+                  "Bold": "On",
+                  "FontSize": -410677030,
+                  "ForeColor": "#00FFFF",
+                  "Tags": [
+                    "793b16c8-e48a-7890-bb1a-7381255585b4"
+                  ]
+                },
+                {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 45

other · +38 -0

```diff
@@ -1873,0 +1873,38 @@
+                  "Text": "Planner",
+                  "Ws": "smc",
+                  "Bold": "On",
+                  "FontSize": 190202871,
+                  "ForeColor": "#A52A2A",
+                  "Tags": [
+                    "6109cb4e-9d80-7172-070f-aaab5148e02b"
+                  ]
+                }
+              ]
+            },
+            "mkp": {
+              "Spans": [
+                {
+                  "Text": "Port",
+                  "Ws": "yxu",
+                  "Bold": "Invert",
+                  "FontSize": 1607188846,
+                  "ForeColor": "#00FFFF",
+                  "Tags": [
+                    "58bc979b-7c64-d947-165b-c7f2ebe2f63b"
+                  ]
+                }
+              ]
+            },
+            "ckz": {
+              "Spans": [
+                {
+                  "Text": "Product",
+                  "Ws": "ywn",
+                  "Bold": "Invert",
+                  "FontSize": -23641957,
+                  "ForeColor": "#A52A2A",
+                  "Tags": [
+                    "b0594316-051c-beca-3f4a-fd5a3500a18d"
+                  ]
+                },
+                {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 46

other · +35 -0

```diff
@@ -1911,0 +1911,35 @@
+                  "Text": "approach",
+                  "Ws": "pbm",
+                  "Bold": "Off",
+                  "FontSize": 1715313845,
+                  "ForeColor": "#A52A2A",
+                  "Tags": [
+                    "0eb2ca90-dde1-95d6-9801-54c992c804b3"
+                  ]
+                }
+              ]
+            }
+          }
+        }
+      ],
+      "PublishIn": [
+        {
+          "Id": "cb689065-ea18-98a0-74a6-5cb471da3fbc",
+          "DeletedAt": null,
+          "IsMain": false,
+          "Name": {
+            "lnu": "Applications"
+          }
+        }
+      ]
+    },
+    "Id": "21b941a4-fbb7-f706-0aab-529c84b402b5",
+    "DeletedAt": null
+  },
+  {
+    "$type": "MiniLcmCrdtAdapter",
+    "Obj": {
+      "$type": "Entry",
+      "Id": "84bb5f48-b2a9-d0c8-85ee-aec9203830ee",
+      "DeletedAt": null,
+      "LexemeForm": {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 47

other · +39 -0

```diff
@@ -1946,0 +1946,39 @@
+        "dkk": "Product"
+      },
+      "CitationForm": {},
+      "LiteralMeaning": {},
+      "MorphType": "Infix",
+      "HomographNumber": 1102525176,
+      "Senses": [],
+      "Note": {},
+      "Components": [],
+      "ComplexForms": [],
+      "ComplexFormTypes": [],
+      "VariantOf": [],
+      "Variants": [],
+      "PublishIn": [
+        {
+          "Id": "78c00e29-d69e-56ba-77f5-b5be25469c4f",
+          "DeletedAt": null,
+          "IsMain": true,
+          "Name": {
+            "mps": "Small Granite Salad"
+          }
+        }
+      ]
+    },
+    "Id": "84bb5f48-b2a9-d0c8-85ee-aec9203830ee",
+    "DeletedAt": null
+  },
+  {
+    "$type": "MiniLcmCrdtAdapter",
+    "Obj": {
+      "$type": "Entry",
+      "Id": "7ccb582e-442b-9cde-6f59-7d2658224810",
+      "DeletedAt": null,
+      "LexemeForm": {
+        "alt": "redefine",
+        "mtg": "feed",
+        "cie": "haptic"
+      },
+      "CitationForm": {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 48

other · +35 -0

```diff
@@ -1985,0 +1985,35 @@
+        "nqo": "Investment Account",
+        "dkg": "Optimization"
+      },
+      "LiteralMeaning": {
+        "gnr": {
+          "Spans": [
+            {
+              "Text": "Springs",
+              "Ws": "gnr",
+              "Tags": [
+                "18fbfdb3-2e2a-4291-8b21-00702f47a4c6"
+              ]
+            },
+            {
+              "Text": "human-resource",
+              "Ws": "gnr",
+              "Tags": [
+                "90ec01f7-a258-41c9-b9dd-b4eccd570f9c"
+              ]
+            }
+          ]
+        },
+        "stt": {
+          "Spans": [
+            {
+              "Text": "withdrawal",
+              "Ws": "tpi",
+              "Bold": "On",
+              "FontSize": -1350488265,
+              "ForeColor": "#FF0000",
+              "Tags": [
+                "39acebc8-f34a-93c9-4c84-f7cc84c5985d"
+              ]
+            },
+            {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 49

other · +40 -0

```diff
@@ -2020,0 +2020,40 @@
+              "Text": "Intelligent Concrete Table",
+              "Ws": "guq",
+              "Bold": "On",
+              "FontSize": -25655285,
+              "ForeColor": "#ADFF2F",
+              "Tags": [
+                "b72087c2-32d8-29af-97ca-53158f52e13b"
+              ]
+            },
+            {
+              "Text": "Research",
+              "Ws": "ani",
+              "Bold": "Invert",
+              "FontSize": 611743561,
+              "ForeColor": "#00FFFF",
+              "Tags": [
+                "7debebd6-974d-0fd4-c077-c55407f924ea"
+              ]
+            }
+          ]
+        },
+        "czh": {
+          "Spans": [
+            {
+              "Text": "Future",
+              "Ws": "ypo",
+              "Bold": "Off",
+              "FontSize": 1307816951,
+              "ForeColor": "#FF0000",
+              "Tags": [
+                "86cf0663-8ac2-0d8e-b85b-007c44ee27d2"
+              ]
+            },
+            {
+              "Text": "Square",
+              "Ws": "czh",
+              "Tags": [
+                "ca6c94cc-2237-4dad-af21-1e4f048b7ab4"
+              ]
+            }
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 50

other · +40 -0

```diff
@@ -2060,0 +2060,40 @@
+          ]
+        }
+      },
+      "MorphType": "Circumfix",
+      "HomographNumber": -1416309114,
+      "Senses": [],
+      "Note": {
+        "xsy": {
+          "Spans": [
+            {
+              "Text": "backing up",
+              "Ws": "nsh",
+              "Bold": "Off",
+              "FontSize": -559106786,
+              "ForeColor": "#FF0000",
+              "Tags": [
+                "9c63fff5-5626-197d-9952-cca19e542578"
+              ]
+            }
+          ]
+        },
+        "rgn": {
+          "Spans": [
+            {
+              "Text": "Streamlined",
+              "Ws": "rgn",
+              "Tags": [
+                "9edca3e0-5249-4f77-bfbb-c900353ae5c1"
+              ]
+            },
+            {
+              "Text": "Micronesia",
+              "Ws": "env",
+              "Bold": "Invert",
+              "FontSize": 87635850,
+              "ForeColor": "#00FFFF",
+              "Tags": [
+                "041fd30c-a5e7-f92a-e0b3-a59400a752af"
+              ]
+            },
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 51

other · +39 -0

```diff
@@ -2100,0 +2100,39 @@
+            {
+              "Text": "transform",
+              "Ws": "cnc",
+              "Bold": "On",
+              "FontSize": -1985104153,
+              "ForeColor": "#FF0000",
+              "Tags": [
+                "5c74852f-f7e5-249f-31f5-6b1d45ed8630"
+              ]
+            },
+            {
+              "Text": "Identity",
+              "Ws": "byf",
+              "Bold": "Off",
+              "FontSize": -1853399160,
+              "ForeColor": "#0000FF",
+              "Tags": [
+                "b6a400e8-2427-45a3-5ab1-758a2e28a6d1"
+              ]
+            }
+          ]
+        },
+        "zkt": {
+          "Spans": [
+            {
+              "Text": "COM",
+              "Ws": "yle",
+              "Bold": "Off",
+              "FontSize": 229320307,
+              "ForeColor": "#A52A2A",
+              "Tags": [
+                "38575d9b-1ae7-0daa-3572-b22dcde78f5d"
+              ]
+            }
+          ]
+        },
+        "sav": {
+          "Spans": [
+            {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 52

other · +40 -0

```diff
@@ -2139,0 +2139,40 @@
+              "Text": "Generic Steel Shirt",
+              "Ws": "cho",
+              "Bold": "Invert",
+              "FontSize": 1060021924,
+              "ForeColor": "#A52A2A",
+              "Tags": [
+                "754ec847-76fb-1ccb-a494-dd703a87a162"
+              ]
+            },
+            {
+              "Text": "Rustic Fresh Sausages",
+              "Ws": "mmv",
+              "Bold": "Off",
+              "FontSize": 1033279533,
+              "ForeColor": "#00000000",
+              "Tags": [
+                "e2a95409-ebd0-322b-c20d-a2f3b3c98397"
+              ]
+            },
+            {
+              "Text": "Tasty Plastic Table",
+              "Ws": "sav",
+              "Tags": [
+                "0ac2af44-1be6-4bd7-9899-117faf3089ec"
+              ]
+            },
+            {
+              "Text": "New Zealand",
+              "Ws": "sav",
+              "Tags": [
+                "46d65c88-2ff5-4966-8463-cb5feade8426"
+              ]
+            }
+          ]
+        }
+      },
+      "Components": [],
+      "ComplexForms": [],
+      "ComplexFormTypes": [
+        {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 53

other · +40 -0

```diff
@@ -2179,0 +2179,40 @@
+          "Id": "e4009891-0d12-f226-b1c8-aa5558128394",
+          "Name": {
+            "ril": "Human"
+          },
+          "DeletedAt": null
+        }
+      ],
+      "VariantOf": [
+        {
+          "Id": "d1ceb8e2-7b90-c398-3589-7509df51c011",
+          "MaybeId": "d1ceb8e2-7b90-c398-3589-7509df51c011",
+          "DeletedAt": null,
+          "VariantEntryId": "9970c40e-d0c0-d21a-b1b9-1da8bc1e03de",
+          "VariantHeadword": "Sleek Soft Bacon",
+          "MainEntryId": "6638f491-2bb0-d597-aac2-c7a3f7401ac1",
+          "MainSenseId": "f145e4a2-c26e-6e1a-b638-cfa8e7c76b22",
+          "MainHeadword": "Coordinator",
+          "Types": [
+            {
+              "Id": "9b171c50-74e6-0153-0532-9e150820fd84",
+              "Name": {
+                "daa": "next-generation",
+                "tzh": "Credit Card Account",
+                "soo": "Orchestrator"
+              },
+              "DeletedAt": null
+            }
+          ],
+          "HideMinorEntry": true,
+          "Comment": {
+            "put": {
+              "Spans": [
+                {
+                  "Text": "overriding",
+                  "Ws": "put",
+                  "Tags": [
+                    "73d43eb7-259e-46b6-b97e-e862bf483e93"
+                  ]
+                },
+                {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 54

other · +34 -0

```diff
@@ -2219,0 +2219,34 @@
+                  "Text": "Central",
+                  "Ws": "jao",
+                  "Bold": "On",
+                  "FontSize": 583944008,
+                  "ForeColor": "#00000000",
+                  "Tags": [
+                    "67f97cd8-36bb-87d6-48c8-8032e5bc70f0"
+                  ]
+                },
+                {
+                  "Text": "generate",
+                  "Ws": "gbv",
+                  "Bold": "On",
+                  "FontSize": -1131714599,
+                  "ForeColor": "#A52A2A",
+                  "Tags": [
+                    "576874ce-c7a4-ca02-57f2-96707015cf7e"
+                  ]
+                },
+                {
+                  "Text": "Baby \u0026 Grocery",
+                  "Ws": "hur",
+                  "Bold": "Off",
+                  "FontSize": 105023831,
+                  "ForeColor": "#0000FF",
+                  "Tags": [
+                    "8ee1c6c3-4571-550f-aab0-c74250e744ae"
+                  ]
+                }
+              ]
+            },
+            "kdp": {
+              "Spans": [
+                {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 55

other · +38 -0

```diff
@@ -2253,0 +2253,38 @@
+                  "Text": "EXE",
+                  "Ws": "kdp",
+                  "Tags": [
+                    "d81a9037-f01a-442e-945e-2da83fc59b72"
+                  ]
+                },
+                {
+                  "Text": "Street",
+                  "Ws": "bxb",
+                  "Bold": "Off",
+                  "FontSize": -1107158038,
+                  "ForeColor": "#FF0000",
+                  "Tags": [
+                    "86a630b1-0d04-0ce0-4e33-b4328f318e4f"
+                  ]
+                },
+                {
+                  "Text": "Cross-group",
+                  "Ws": "kdp",
+                  "Tags": [
+                    "028304f1-6068-456c-9dd6-daf2e6318035"
+                  ]
+                }
+              ]
+            },
+            "slc": {
+              "Spans": [
+                {
+                  "Text": "fresh-thinking",
+                  "Ws": "rn",
+                  "Bold": "On",
+                  "FontSize": -1290428814,
+                  "ForeColor": "#00000000",
+                  "Tags": [
+                    "c8622d2c-cfdd-f92c-85f3-0c594aee98e1"
+                  ]
+                },
+                {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 56

other · +39 -0

```diff
@@ -2291,0 +2291,39 @@
+                  "Text": "Executive",
+                  "Ws": "slc",
+                  "Tags": [
+                    "1024acaa-5a55-48f6-a801-6d033e58f225"
+                  ]
+                },
+                {
+                  "Text": "Egyptian Pound",
+                  "Ws": "slc",
+                  "Tags": [
+                    "234f074f-8d0d-4629-884f-2441eea1ddfa"
+                  ]
+                },
+                {
+                  "Text": "moderator",
+                  "Ws": "slc",
+                  "Tags": [
+                    "81b664ca-2179-43ec-a71c-025af7fe288d"
+                  ]
+                }
+              ]
+            }
+          }
+        }
+      ],
+      "Variants": [
+        {
+          "Id": "3f49ac95-a997-74af-e061-6159fc340fd2",
+          "MaybeId": "3f49ac95-a997-74af-e061-6159fc340fd2",
+          "DeletedAt": null,
+          "VariantEntryId": "36c20f18-c9ae-c828-7cea-7bf5f4ddee03",
+          "VariantHeadword": "Borders",
+          "MainEntryId": "cc77233c-a886-c6ee-703a-4e5a4443c087",
+          "MainSenseId": "18a2340e-56f8-94de-bf35-bef23f6a3d76",
+          "MainHeadword": "Concrete",
+          "Types": [
+            {
+              "Id": "39b5de5d-fc3e-6516-2ac5-fbdde15e8d90",
+              "Name": {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 57

other · +36 -0

```diff
@@ -2330,0 +2330,36 @@
+                "ygi": "Granite",
+                "ihp": "Small Granite Salad",
+                "bzx": "Avon"
+              },
+              "DeletedAt": null
+            }
+          ],
+          "HideMinorEntry": true,
+          "Comment": {
+            "pna": {
+              "Spans": [
+                {
+                  "Text": "Guinea",
+                  "Ws": "twq",
+                  "Bold": "Off",
+                  "FontSize": 548037479,
+                  "ForeColor": "#00FFFF",
+                  "Tags": [
+                    "b31e5ede-63ce-0ec0-f672-6801296e0617"
+                  ]
+                },
+                {
+                  "Text": "Minnesota",
+                  "Ws": "zor",
+                  "Bold": "On",
+                  "FontSize": -1619185103,
+                  "ForeColor": "#00000000",
+                  "Tags": [
+                    "6db14049-c1d8-4610-67b6-f080a67d198c"
+                  ]
+                }
+              ]
+            },
+            "nii": {
+              "Spans": [
+                {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 58

other · +38 -0

```diff
@@ -2366,0 +2366,38 @@
+                  "Text": "Florida",
+                  "Ws": "kqj",
+                  "Bold": "On",
+                  "FontSize": 1839918198,
+                  "ForeColor": "#00FFFF",
+                  "Tags": [
+                    "54a11218-ede8-4a66-e796-8fb5954a2866"
+                  ]
+                }
+              ]
+            },
+            "goh": {
+              "Spans": [
+                {
+                  "Text": "Re-engineered",
+                  "Ws": "ppu",
+                  "Bold": "On",
+                  "FontSize": 121777806,
+                  "ForeColor": "#FF0000",
+                  "Tags": [
+                    "d7394e85-12ef-0453-59a4-f789ec8cd6b6"
+                  ]
+                }
+              ]
+            },
+            "mss": {
+              "Spans": [
+                {
+                  "Text": "Rustic",
+                  "Ws": "sok",
+                  "Bold": "On",
+                  "FontSize": -232538291,
+                  "ForeColor": "#FF0000",
+                  "Tags": [
+                    "672e67c4-f22f-4f38-e5ef-fa8230ae0642"
+                  ]
+                },
+                {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 59

other · +40 -0

```diff
@@ -2404,0 +2404,40 @@
+                  "Text": "Fantastic",
+                  "Ws": "mss",
+                  "Tags": [
+                    "4b2371f2-69a7-4056-a1c5-f0b4151e85b8"
+                  ]
+                },
+                {
+                  "Text": "Gibraltar Pound",
+                  "Ws": "mss",
+                  "Tags": [
+                    "0ef5a73e-8c43-42b3-8637-1bb90d0b2b62"
+                  ]
+                }
+              ]
+            }
+          }
+        }
+      ],
+      "PublishIn": [
+        {
+          "Id": "a27a7789-bcba-ee7a-57d3-fa256d3356c1",
+          "DeletedAt": null,
+          "IsMain": false,
+          "Name": {
+            "kkk": "Analyst",
+            "dkk": "Investment Account"
+          }
+        }
+      ]
+    },
+    "Id": "7ccb582e-442b-9cde-6f59-7d2658224810",
+    "DeletedAt": null
+  },
+  {
+    "$type": "MiniLcmCrdtAdapter",
+    "Obj": {
+      "$type": "Entry",
+      "Id": "249c38f3-fc0d-195f-7533-97e8c140d0d7",
+      "DeletedAt": null,
+      "LexemeForm": {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 60

other · +36 -0

```diff
@@ -2444,0 +2444,36 @@
+        "kvj": "Florida"
+      },
+      "CitationForm": null,
+      "LiteralMeaning": null,
+      "MorphType": "Prefix",
+      "HomographNumber": 4,
+      "Senses": [],
+      "Note": null,
+      "Components": [],
+      "ComplexForms": [],
+      "ComplexFormTypes": [],
+      "VariantOf": [],
+      "Variants": [],
+      "PublishIn": []
+    },
+    "Id": "249c38f3-fc0d-195f-7533-97e8c140d0d7",
+    "DeletedAt": null
+  },
+  {
+    "$type": "MiniLcmCrdtAdapter",
+    "Obj": {
+      "$type": "Entry",
+      "Id": "c3c7439d-8508-897d-ec90-dfb8c6233f52",
+      "DeletedAt": null,
+      "LexemeForm": {
+        "sbf": "Triple-buffered",
+        "nuo": "clear-thinking",
+        "ewo": "modular"
+      },
+      "CitationForm": {
+        "mzp": "Rial Omani"
+      },
+      "LiteralMeaning": {
+        "mku": {
+          "Spans": [
+            {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 61

other · +36 -0

```diff
@@ -2480,0 +2480,36 @@
+              "Text": "holistic",
+              "Ws": "mku",
+              "Tags": [
+                "9350e875-0918-4188-8b80-e94b87a852bf"
+              ]
+            },
+            {
+              "Text": "Oklahoma",
+              "Ws": "bnx",
+              "Bold": "On",
+              "FontSize": 1103510228,
+              "ForeColor": "#FF0000",
+              "Tags": [
+                "ed09f714-b175-6596-9983-16cdf0cf34d8"
+              ]
+            },
+            {
+              "Text": "Handcrafted",
+              "Ws": "mku",
+              "Tags": [
+                "182d16db-157e-4fbc-9d8d-fb3df1acc534"
+              ]
+            }
+          ]
+        },
+        "kdr": {
+          "Spans": [
+            {
+              "Text": "Liaison",
+              "Ws": "kdr",
+              "Tags": [
+                "f526be31-e1dc-4710-b90d-0c747d57434f"
+              ]
+            }
+          ]
+        }
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 62

other · +36 -0

```diff
@@ -2516,0 +2516,36 @@
+      },
+      "MorphType": "Prefix",
+      "HomographNumber": -1630247524,
+      "Senses": [],
+      "Note": {
+        "crv": {
+          "Spans": [
+            {
+              "Text": "Isle of Man",
+              "Ws": "crv",
+              "Tags": [
+                "7bde6377-d4cb-49ae-9803-86cd678d56d7"
+              ]
+            },
+            {
+              "Text": "projection",
+              "Ws": "crv",
+              "Tags": [
+                "764ca726-5a42-499a-8965-0da244a52a6a"
+              ]
+            },
+            {
+              "Text": "transmitting",
+              "Ws": "hnn",
+              "Bold": "Off",
+              "FontSize": -1687247291,
+              "ForeColor": "#ADFF2F",
+              "Tags": [
+                "54262fd2-0ed1-d0ec-59b2-c2ade27b2a03"
+              ]
+            }
+          ]
+        },
+        "gnw": {
+          "Spans": [
+            {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 63

other · +40 -18

```diff
@@ -2552,0 +2552,5 @@
+              "Text": "Neck",
+              "Ws": "bvo",
+              "Bold": "Off",
+              "FontSize": -990208762,
+              "ForeColor": "#00FFFF",
@@ -361,1 +2558,1 @@
-                "424e0f12-78a7-37c7-8fa5-74dd81ccc8a7"
+                "99ed537a-80b3-8de1-7650-6365d2e6083f"
@@ -365,2 +2562,2 @@
-              "Text": "Glens",
-              "Ws": "kee",
+              "Text": "Data",
+              "Ws": "gnw",
@@ -368,1 +2565,1 @@
-                "a323544c-2b85-4fa7-b3c7-f5321ad75c49"
+                "d241a639-233a-45c7-8935-7b9f3f06157a"
@@ -372,2 +2569,5 @@
-              "Text": "Buckinghamshire",
-              "Ws": "kee",
+              "Text": "withdrawal",
+              "Ws": "pmf",
+              "Bold": "Off",
+              "FontSize": -1959771791,
+              "ForeColor": "#0000FF",
@@ -375,1 +2575,1 @@
-                "13a974bf-8b90-4f36-99c6-9f0771f53db0"
+                "8fd780f0-42f6-34ec-0f95-356321691992"
@@ -377,1 +2577,5 @@
-            },
+            }
+          ]
+        },
+        "ekm": {
+          "Spans": [
@@ -379,2 +2583,2 @@
-              "Text": "SMTP",
-              "Ws": "cly",
+              "Text": "Developer",
+              "Ws": "hag",
@@ -382,1 +2586,1 @@
-              "FontSize": 872689318,
+              "FontSize": -858017395,
@@ -385,1 +2589,11 @@
-                "498aea00-217b-9a3e-7fd0-2748edadf3b3"
+                "846f0198-2a38-de9c-5c83-d597ce88fecd"
+              ]
+            },
+            {
+              "Text": "Handcrafted",
+              "Ws": "mix",
+              "Bold": "On",
+              "FontSize": -1819622732,
+              "ForeColor": "#FF0000",
+              "Tags": [
+                "bce2d057-9660-de23-ad57-3783b9014de8"
@@ -395,1 +2609,1 @@
-          "Id": "292e9847-8c7c-56e1-87fb-41d200c789e1",
+          "Id": "68f76f7d-5ec4-2006-ed56-236b8c0acdb3",
@@ -397,4 +2611,4 @@
-            "hup": "THX",
-            "rsk": "Reduced",
-            "zmq": "hard drive",
-            "nnx": "cyan"
+            "mtn": "Libyan Dinar",
+            "kot": "white",
+            "sax": "Accounts",
+            "tlu": "invoice"
@@ -405,1 +2619,1 @@
-      "PublishIn": [
+      "VariantOf": [
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 64

other · +38 -5

```diff
@@ -407,1 +2621,2 @@
-          "Id": "bd874c92-e063-2a20-d263-bdc6897a1e85",
+          "Id": "30687039-cd15-839f-0f15-88239cea4ee7",
+          "MaybeId": "30687039-cd15-839f-0f15-88239cea4ee7",
@@ -409,4 +2624,36 @@
-          "IsMain": false,
-          "Name": {
-            "zrg": "cross-platform",
-            "bno": "heuristic"
+          "VariantEntryId": "a7cea784-faa5-08b1-5a30-ea546c3e84a6",
+          "VariantHeadword": "methodologies",
+          "MainEntryId": "d38e046a-5051-8542-0ee0-a8816c4a38fc",
+          "MainSenseId": "20ae5516-4681-5b6f-9a37-441f37d30636",
+          "MainHeadword": "National",
+          "Types": [
+            {
+              "Id": "4efbf4f2-7182-25a1-8279-18849ca5d1dc",
+              "Name": {
+                "xpu": "Intelligent Soft Shirt"
+              },
+              "DeletedAt": null
+            }
+          ],
+          "HideMinorEntry": false,
+          "Comment": {
+            "ug": {
+              "Spans": [
+                {
+                  "Text": "input",
+                  "Ws": "ug",
+                  "Tags": [
+                    "009c5014-9b97-498d-94d7-b49c2f60f7ce"
+                  ]
+                },
+                {
+                  "Text": "high-level",
+                  "Ws": "pub",
+                  "Bold": "On",
+                  "FontSize": 1878116492,
+                  "ForeColor": "#0000FF",
+                  "Tags": [
+                    "5a727ee0-4a4d-6d0f-5ff0-7225db4443b9"
+                  ]
+                },
+                {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 65

other · +40 -0

```diff
@@ -2660,0 +2660,40 @@
+                  "Text": "Liberian Dollar",
+                  "Ws": "ug",
+                  "Tags": [
+                    "9def2648-5fc8-473b-91a0-e4b870483323"
+                  ]
+                },
+                {
+                  "Text": "teal",
+                  "Ws": "dux",
+                  "Bold": "On",
+                  "FontSize": -447656843,
+                  "ForeColor": "#00FFFF",
+                  "Tags": [
+                    "3f01efa1-0307-9615-9c0a-abd13268297f"
+                  ]
+                }
+              ]
+            },
+            "tkx": {
+              "Spans": [
+                {
+                  "Text": "Handcrafted Plastic Gloves",
+                  "Ws": "ktm",
+                  "Bold": "Off",
+                  "FontSize": 980860579,
+                  "ForeColor": "#0000FF",
+                  "Tags": [
+                    "3aa66e0d-0c3b-f1fe-000b-f2b073e8bbcf"
+                  ]
+                },
+                {
+                  "Text": "teal",
+                  "Ws": "tkx",
+                  "Tags": [
+                    "ffc128c8-dd58-490e-bbb6-ff9c9dae2c21"
+                  ]
+                }
+              ]
+            },
+            "mvg": {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 66

other · +37 -0

```diff
@@ -2700,0 +2700,37 @@
+              "Spans": [
+                {
+                  "Text": "Synchronised",
+                  "Ws": "lof",
+                  "Bold": "Off",
+                  "FontSize": -448515709,
+                  "ForeColor": "#A52A2A",
+                  "Tags": [
+                    "cccf656b-6627-2403-6651-e9778e6784b3"
+                  ]
+                },
+                {
+                  "Text": "pink",
+                  "Ws": "mvg",
+                  "Tags": [
+                    "227cf26e-397c-4d4c-9799-5bb7c880ffcd"
+                  ]
+                },
+                {
+                  "Text": "Tasty Rubber Tuna",
+                  "Ws": "jcs",
+                  "Bold": "Invert",
+                  "FontSize": -1218964834,
+                  "ForeColor": "#FF0000",
+                  "Tags": [
+                    "8d1b02a7-1a2b-3cad-ee5b-5d9d44e54785"
+                  ]
+                },
+                {
+                  "Text": "Rue",
+                  "Ws": "mvg",
+                  "Tags": [
+                    "98ac4a79-c23c-47d3-af3b-6352a3905df4"
+                  ]
+                }
+              ]
+            }
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 67

other · +35 -23

```diff
@@ -415,23 +2739,35 @@
-      ]
-    },
-    "Id": "8dbc0f41-998e-836a-97e1-f05d46d95c92",
-    "DeletedAt": null
-  },
-  {
-    "$type": "MiniLcmCrdtAdapter",
-    "Obj": {
-      "$type": "Entry",
-      "Id": "84bb5f48-b2a9-d0c8-85ee-aec9203830ee",
-      "DeletedAt": null,
-      "LexemeForm": {
-        "dkk": "Product"
-      },
-      "CitationForm": {},
-      "LiteralMeaning": {},
-      "MorphType": "Infix",
-      "HomographNumber": 1102525176,
-      "Senses": [],
-      "Note": {},
-      "Components": [],
-      "ComplexForms": [],
-      "ComplexFormTypes": [],
+      ],
+      "Variants": [
+        {
+          "Id": "eb7771bf-50ec-05c5-f943-2f36625e25db",
+          "MaybeId": "eb7771bf-50ec-05c5-f943-2f36625e25db",
+          "DeletedAt": null,
+          "VariantEntryId": "dd84ea90-cfe1-a254-021d-efca8b022ddf",
+          "VariantHeadword": "Configuration",
+          "MainEntryId": "2bae2145-2f23-b490-102b-cf1d03c8f5bf",
+          "MainSenseId": "bb0e0056-9948-fd94-0c89-e89fd4ba8cce",
+          "MainHeadword": "withdrawal",
+          "Types": [
+            {
+              "Id": "e2b0fab5-16ff-63da-ab2c-3137e2d8fcea",
+              "Name": {
+                "nli": "Architect",
+                "dcc": "Decentralized",
+                "dgd": "leverage",
+                "pne": "Intelligent Steel Cheese"
+              },
+              "DeletedAt": null
+            }
+          ],
+          "HideMinorEntry": true,
+          "Comment": {
+            "afs": {
+              "Spans": [
+                {
+                  "Text": "Investment Account",
+                  "Ws": "afs",
+                  "Tags": [
+                    "222a259a-328a-41e6-8d2e-ad2e0a06cf21"
+                  ]
+                },
+                {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 68

other · +25 -27

```diff
@@ -2774,0 +2774,18 @@
+                  "Text": "Morocco",
+                  "Ws": "afs",
+                  "Tags": [
+                    "184ab8d1-b318-407d-8eaf-d60d2615e680"
+                  ]
+                },
+                {
+                  "Text": "Kids \u0026 Kids",
+                  "Ws": "afs",
+                  "Tags": [
+                    "805122d3-96f3-4129-a887-edb34bd994c5"
+                  ]
+                }
+              ]
+            }
+          }
+        }
+      ],
@@ -440,1 +2794,1 @@
-          "Id": "78c00e29-d69e-56ba-77f5-b5be25469c4f",
+          "Id": "5421adab-b84b-1d1c-5da9-ff96c4e76d6f",
@@ -442,1 +2796,1 @@
-          "IsMain": true,
+          "IsMain": false,
@@ -444,1 +2798,4 @@
-            "mps": "Small Granite Salad"
+            "arn": "Money Market Account",
+            "myt": "withdrawal",
+            "bni": "Libyan Arab Jamahiriya",
+            "peh": "web-readiness"
@@ -449,24 +2806,1 @@
-    "Id": "84bb5f48-b2a9-d0c8-85ee-aec9203830ee",
-    "DeletedAt": null
-  },
-  {
-    "$type": "MiniLcmCrdtAdapter",
-    "Obj": {
-      "$type": "Entry",
-      "Id": "249c38f3-fc0d-195f-7533-97e8c140d0d7",
-      "DeletedAt": null,
-      "LexemeForm": {
-        "kvj": "Florida"
-      },
-      "CitationForm": null,
-      "LiteralMeaning": null,
-      "MorphType": "Prefix",
-      "HomographNumber": 4,
-      "Senses": [],
-      "Note": null,
-      "Components": [],
-      "ComplexForms": [],
-      "ComplexFormTypes": [],
-      "PublishIn": []
-    },
-    "Id": "249c38f3-fc0d-195f-7533-97e8c140d0d7",
+    "Id": "c3c7439d-8508-897d-ec90-dfb8c6233f52",
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 69

other · +40 -0

```diff
@@ -3937,0 +6272,40 @@
+  },
+  {
+    "$type": "MiniLcmCrdtAdapter",
+    "Obj": {
+      "$type": "VariantType",
+      "Id": "ab0ff154-d4bb-e26d-4136-805ff65fe3f7",
+      "Name": {
+        "kvv": "Idaho"
+      },
+      "DeletedAt": null
+    },
+    "Id": "ab0ff154-d4bb-e26d-4136-805ff65fe3f7",
+    "DeletedAt": null
+  },
+  {
+    "$type": "MiniLcmCrdtAdapter",
+    "Obj": {
+      "$type": "Variant",
+      "Id": "f3c8bd18-ddae-319c-7af9-aec8a1f24db9",
+      "MaybeId": "f3c8bd18-ddae-319c-7af9-aec8a1f24db9",
+      "DeletedAt": null,
+      "VariantEntryId": "8844401a-9b59-2dbb-d0a6-b8072698fdbe",
+      "VariantHeadword": "compressing",
+      "MainEntryId": "4c6734dd-5df2-ef98-f925-4bedccafffd6",
+      "MainSenseId": "5299433f-bed8-0440-f6b7-be7185a94c91",
+      "MainHeadword": "Future-proofed",
+      "Types": [
+        {
+          "Id": "bd29dadc-ed05-75a2-2dd2-1f4e7a8ed28c",
+          "Name": {
+            "qvs": "transition",
+            "bnj": "input",
+            "prx": "1080p",
+            "stw": "Cotton"
+          },
+          "DeletedAt": null
+        }
+      ],
+      "HideMinorEntry": true,
+      "Comment": {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 70

other · +34 -0

```diff
@@ -6312,0 +6312,34 @@
+        "mkv": {
+          "Spans": [
+            {
+              "Text": "FTP",
+              "Ws": "afg",
+              "Bold": "Off",
+              "FontSize": 786310720,
+              "ForeColor": "#FF0000",
+              "Tags": [
+                "080df177-19fa-0182-fd6d-8bfe3c6899b8"
+              ]
+            }
+          ]
+        },
+        "jup": {
+          "Spans": [
+            {
+              "Text": "Configuration",
+              "Ws": "jkr",
+              "Bold": "Invert",
+              "FontSize": 901303494,
+              "ForeColor": "#00000000",
+              "Tags": [
+                "4764d0bd-8463-ac55-13e6-5c97bf5e1eeb"
+              ]
+            },
+            {
+              "Text": "Extended",
+              "Ws": "jup",
+              "Tags": [
+                "cc3de0c0-de63-4f90-b243-ed8cffce4b43"
+              ]
+            },
+            {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 71

other · +40 -0

```diff
@@ -6346,0 +6346,40 @@
+              "Text": "Berkshire",
+              "Ws": "duq",
+              "Bold": "Invert",
+              "FontSize": -820321295,
+              "ForeColor": "#FF0000",
+              "Tags": [
+                "89b096e2-d417-54cc-90ce-6b3d0d6beea9"
+              ]
+            },
+            {
+              "Text": "Handmade",
+              "Ws": "jup",
+              "Tags": [
+                "8b3d963a-e282-4efa-b1b3-72bd5cc0b97a"
+              ]
+            }
+          ]
+        },
+        "knq": {
+          "Spans": [
+            {
+              "Text": "back-end",
+              "Ws": "rga",
+              "Bold": "On",
+              "FontSize": -1164842275,
+              "ForeColor": "#0000FF",
+              "Tags": [
+                "e16af6f0-6073-064a-be78-5476ae80129b"
+              ]
+            },
+            {
+              "Text": "Fresh",
+              "Ws": "hrt",
+              "Bold": "Off",
+              "FontSize": -1676676744,
+              "ForeColor": "#00FFFF",
+              "Tags": [
+                "04081eef-8df9-8078-2aff-8a1fc6f565d6"
+              ]
+            },
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.latest.verified.txt

### fragment 72

other · +26 -0

```diff
@@ -6386,0 +6386,26 @@
+            {
+              "Text": "Bedfordshire",
+              "Ws": "xag",
+              "Bold": "Off",
+              "FontSize": 588490506,
+              "ForeColor": "#ADFF2F",
+              "Tags": [
+                "d5d24888-6538-6447-e34b-90436626e505"
+              ]
+            },
+            {
+              "Text": "neural",
+              "Ws": "kpw",
+              "Bold": "Off",
+              "FontSize": 1635502143,
+              "ForeColor": "#FF0000",
+              "Tags": [
+                "3ff5314e-8007-7517-f840-e3a86ec6f913"
+              ]
+            }
+          ]
+        }
+      }
+    },
+    "Id": "f3c8bd18-ddae-319c-7af9-aec8a1f24db9",
+    "DeletedAt": null
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.legacy.verified.txt

### fragment 1

other · +4 -0

```diff
@@ -160,0 +161,2 @@
+        "VariantOf": [],
+        "Variants": [],
@@ -248,0 +251,2 @@
+        "VariantOf": [],
+        "Variants": [],
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.legacy.verified.txt

### fragment 2

other · +40 -0

```diff
@@ -3902,0 +3907,40 @@
+  },
+  {
+    "Input": {
+      "$type": "MiniLcmCrdtAdapter",
+      "Obj": {
+        "$type": "Entry",
+        "Id": "8f403ae3-9859-4a74-a52d-3c0736bb5917",
+        "DeletedAt": null,
+        "LexemeForm": {
+          "en": "Pineapple"
+        },
+        "CitationForm": {},
+        "LiteralMeaning": {},
+        "MorphType": "Stem",
+        "HomographNumber": 0,
+        "Senses": [],
+        "Note": {},
+        "Components": [],
+        "ComplexForms": [],
+        "ComplexFormTypes": [
+          {
+            "Id": "1f6ae209-141a-40db-983c-bee93af0ca3c",
+            "Name": {
+              "en": "Compound"
+            },
+            "DeletedAt": null
+          }
+        ],
+        "PublishIn": []
+      },
+      "Id": "8f403ae3-9859-4a74-a52d-3c0736bb5917",
+      "DeletedAt": null
+    },
+    "Output": {
+      "$type": "MiniLcmCrdtAdapter",
+      "Obj": {
+        "$type": "Entry",
+        "Id": "8f403ae3-9859-4a74-a52d-3c0736bb5917",
+        "DeletedAt": null,
+        "LexemeForm": {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.legacy.verified.txt

### fragment 3

other · +38 -0

```diff
@@ -3947,0 +3947,38 @@
+          "en": "Pineapple"
+        },
+        "CitationForm": {},
+        "LiteralMeaning": {},
+        "MorphType": "Stem",
+        "HomographNumber": 0,
+        "Senses": [],
+        "Note": {},
+        "Components": [],
+        "ComplexForms": [],
+        "ComplexFormTypes": [
+          {
+            "Id": "1f6ae209-141a-40db-983c-bee93af0ca3c",
+            "Name": {
+              "en": "Compound"
+            },
+            "DeletedAt": null
+          }
+        ],
+        "VariantOf": [],
+        "Variants": [],
+        "PublishIn": []
+      },
+      "Id": "8f403ae3-9859-4a74-a52d-3c0736bb5917",
+      "DeletedAt": null
+    }
+  },
+  {
+    "Input": {
+      "$type": "MiniLcmCrdtAdapter",
+      "Obj": {
+        "$type": "Entry",
+        "Id": "691dda9c-b83e-71c6-3638-e66a279c396e",
+        "DeletedAt": null,
+        "LexemeForm": {
+          "luq": "Communications"
+        },
+        "CitationForm": {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.legacy.verified.txt

### fragment 4

other · +39 -0

```diff
@@ -3985,0 +3985,39 @@
+          "ykl": "Dominican Republic",
+          "tw": "Unbranded",
+          "sqh": "hack"
+        },
+        "LiteralMeaning": {
+          "rpn": {
+            "Spans": [
+              {
+                "Text": "Home Loan Account",
+                "Ws": "kmd",
+                "Bold": "On",
+                "FontSize": 1210454949,
+                "ForeColor": "#A52A2A",
+                "Tags": [
+                  "7231e128-410a-9cae-4141-997965f4a853"
+                ]
+              }
+            ]
+          }
+        },
+        "MorphType": "Particle",
+        "HomographNumber": 0,
+        "Senses": [],
+        "Note": {
+          "ekl": {
+            "Spans": [
+              {
+                "Text": "Sleek",
+                "Ws": "akv",
+                "Bold": "Off",
+                "FontSize": 2066121125,
+                "ForeColor": "#ADFF2F",
+                "Tags": [
+                  "82408188-7ce4-ba9a-5f35-8ffec5b3b254"
+                ]
+              }
+            ]
+          },
+          "uki": {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.legacy.verified.txt

### fragment 5

other · +38 -0

```diff
@@ -4024,0 +4024,38 @@
+            "Spans": [
+              {
+                "Text": "Refined Fresh Computer",
+                "Ws": "uki",
+                "Tags": [
+                  "122f575c-140b-4bb1-9c8c-f98e1969951d"
+                ]
+              },
+              {
+                "Text": "internet solution",
+                "Ws": "uki",
+                "Tags": [
+                  "a5bd8ab1-99a0-4bcc-baaf-93c7ccc77429"
+                ]
+              },
+              {
+                "Text": "wireless",
+                "Ws": "uki",
+                "Tags": [
+                  "005d71cb-4f05-486c-897c-710a7a6b5346"
+                ]
+              },
+              {
+                "Text": "navigate",
+                "Ws": "uki",
+                "Tags": [
+                  "f04879c9-1e04-49b5-b4e0-0ce28e77aacd"
+                ]
+              }
+            ]
+          }
+        },
+        "Components": [],
+        "ComplexForms": [],
+        "ComplexFormTypes": [
+          {
+            "Id": "15a8d32f-5cac-8a71-7b31-cbefa36ad322",
+            "Name": {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.legacy.verified.txt

### fragment 6

other · +39 -0

```diff
@@ -4062,0 +4062,39 @@
+              "tgi": "input",
+              "gnk": "silver",
+              "suo": "Refined Wooden Chair"
+            },
+            "DeletedAt": null
+          }
+        ],
+        "PublishIn": [
+          {
+            "Id": "ec21b4b7-3861-38d4-bc7b-fe77bd2321c2",
+            "DeletedAt": null,
+            "IsMain": false,
+            "Name": {
+              "nak": "CSS"
+            }
+          }
+        ]
+      },
+      "Id": "691dda9c-b83e-71c6-3638-e66a279c396e",
+      "DeletedAt": null
+    },
+    "Output": {
+      "$type": "MiniLcmCrdtAdapter",
+      "Obj": {
+        "$type": "Entry",
+        "Id": "691dda9c-b83e-71c6-3638-e66a279c396e",
+        "DeletedAt": null,
+        "LexemeForm": {
+          "luq": "Communications"
+        },
+        "CitationForm": {
+          "ykl": "Dominican Republic",
+          "tw": "Unbranded",
+          "sqh": "hack"
+        },
+        "LiteralMeaning": {
+          "rpn": {
+            "Spans": [
+              {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.legacy.verified.txt

### fragment 7

other · +40 -0

```diff
@@ -4101,0 +4101,40 @@
+                "Text": "Home Loan Account",
+                "Ws": "kmd",
+                "Bold": "On",
+                "FontSize": 1210454949,
+                "ForeColor": "#A52A2A",
+                "Tags": [
+                  "7231e128-410a-9cae-4141-997965f4a853"
+                ]
+              }
+            ]
+          }
+        },
+        "MorphType": "Particle",
+        "HomographNumber": 0,
+        "Senses": [],
+        "Note": {
+          "ekl": {
+            "Spans": [
+              {
+                "Text": "Sleek",
+                "Ws": "akv",
+                "Bold": "Off",
+                "FontSize": 2066121125,
+                "ForeColor": "#ADFF2F",
+                "Tags": [
+                  "82408188-7ce4-ba9a-5f35-8ffec5b3b254"
+                ]
+              }
+            ]
+          },
+          "uki": {
+            "Spans": [
+              {
+                "Text": "Refined Fresh Computer",
+                "Ws": "uki",
+                "Tags": [
+                  "122f575c-140b-4bb1-9c8c-f98e1969951d"
+                ]
+              },
+              {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.legacy.verified.txt

### fragment 8

other · +40 -0

```diff
@@ -4141,0 +4141,40 @@
+                "Text": "internet solution",
+                "Ws": "uki",
+                "Tags": [
+                  "a5bd8ab1-99a0-4bcc-baaf-93c7ccc77429"
+                ]
+              },
+              {
+                "Text": "wireless",
+                "Ws": "uki",
+                "Tags": [
+                  "005d71cb-4f05-486c-897c-710a7a6b5346"
+                ]
+              },
+              {
+                "Text": "navigate",
+                "Ws": "uki",
+                "Tags": [
+                  "f04879c9-1e04-49b5-b4e0-0ce28e77aacd"
+                ]
+              }
+            ]
+          }
+        },
+        "Components": [],
+        "ComplexForms": [],
+        "ComplexFormTypes": [
+          {
+            "Id": "15a8d32f-5cac-8a71-7b31-cbefa36ad322",
+            "Name": {
+              "tgi": "input",
+              "gnk": "silver",
+              "suo": "Refined Wooden Chair"
+            },
+            "DeletedAt": null
+          }
+        ],
+        "VariantOf": [],
+        "Variants": [],
+        "PublishIn": [
+          {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.legacy.verified.txt

### fragment 9

other · +40 -0

```diff
@@ -4181,0 +4181,40 @@
+            "Id": "ec21b4b7-3861-38d4-bc7b-fe77bd2321c2",
+            "DeletedAt": null,
+            "IsMain": false,
+            "Name": {
+              "nak": "CSS"
+            }
+          }
+        ]
+      },
+      "Id": "691dda9c-b83e-71c6-3638-e66a279c396e",
+      "DeletedAt": null
+    }
+  },
+  {
+    "Input": {
+      "$type": "MiniLcmCrdtAdapter",
+      "Obj": {
+        "$type": "Entry",
+        "Id": "82cf7254-3a4f-497a-9e15-7d93fc830356",
+        "DeletedAt": null,
+        "LexemeForm": {
+          "en": "\uD83C\uDF4C",
+          "th": "\u0E01\u0E25\u0E49\u0E27\u0E22"
+        },
+        "CitationForm": {},
+        "LiteralMeaning": {
+          "en": {
+            "Spans": [
+              {
+                "Text": "yellow fruit that comes in bunches.",
+                "Ws": "en"
+              }
+            ]
+          }
+        },
+        "MorphType": "Stem",
+        "HomographNumber": 0,
+        "Senses": [],
+        "Note": {
+          "en": {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.legacy.verified.txt

### fragment 10

other · +36 -0

```diff
@@ -4221,0 +4221,36 @@
+            "Spans": [
+              {
+                "Text": "often used in cartoon gags for slipping",
+                "Ws": "en"
+              }
+            ]
+          }
+        },
+        "Components": [],
+        "ComplexForms": [],
+        "ComplexFormTypes": [],
+        "PublishIn": []
+      },
+      "Id": "82cf7254-3a4f-497a-9e15-7d93fc830356",
+      "DeletedAt": null
+    },
+    "Output": {
+      "$type": "MiniLcmCrdtAdapter",
+      "Obj": {
+        "$type": "Entry",
+        "Id": "82cf7254-3a4f-497a-9e15-7d93fc830356",
+        "DeletedAt": null,
+        "LexemeForm": {
+          "en": "\uD83C\uDF4C",
+          "th": "\u0E01\u0E25\u0E49\u0E27\u0E22"
+        },
+        "CitationForm": {},
+        "LiteralMeaning": {
+          "en": {
+            "Spans": [
+              {
+                "Text": "yellow fruit that comes in bunches.",
+                "Ws": "en"
+              }
+            ]
+          }
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.legacy.verified.txt

### fragment 11

other · +40 -0

```diff
@@ -4257,0 +4257,40 @@
+        },
+        "MorphType": "Stem",
+        "HomographNumber": 0,
+        "Senses": [],
+        "Note": {
+          "en": {
+            "Spans": [
+              {
+                "Text": "often used in cartoon gags for slipping",
+                "Ws": "en"
+              }
+            ]
+          }
+        },
+        "Components": [],
+        "ComplexForms": [],
+        "ComplexFormTypes": [],
+        "VariantOf": [],
+        "Variants": [],
+        "PublishIn": []
+      },
+      "Id": "82cf7254-3a4f-497a-9e15-7d93fc830356",
+      "DeletedAt": null
+    }
+  },
+  {
+    "Input": {
+      "$type": "MiniLcmCrdtAdapter",
+      "Obj": {
+        "$type": "Entry",
+        "Id": "8dbc0f41-998e-836a-97e1-f05d46d95c92",
+        "DeletedAt": null,
+        "LexemeForm": {
+          "mqs": "maximized"
+        },
+        "CitationForm": {
+          "nrz": "Portugal"
+        },
+        "LiteralMeaning": {
+          "juy": {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.legacy.verified.txt

### fragment 12

other · +39 -0

```diff
@@ -4297,0 +4297,39 @@
+            "Spans": [
+              {
+                "Text": "Kyat",
+                "Ws": "juy",
+                "Tags": [
+                  "bc47798c-6e35-430e-a94a-2d1aa82d9119"
+                ]
+              },
+              {
+                "Text": "synthesize",
+                "Ws": "juy",
+                "Tags": [
+                  "75fc659a-ae47-45ec-87a8-2475d5667496"
+                ]
+              }
+            ]
+          },
+          "rer": {
+            "Spans": [
+              {
+                "Text": "Licensed",
+                "Ws": "rer",
+                "Tags": [
+                  "adf734b1-3abb-4644-a5b7-e712c29a59e6"
+                ]
+              },
+              {
+                "Text": "architectures",
+                "Ws": "dos",
+                "Bold": "On",
+                "FontSize": -1392951304,
+                "ForeColor": "#ADFF2F",
+                "Tags": [
+                  "b316a4f4-208a-e75f-13f0-09a91a2b3506"
+                ]
+              }
+            ]
+          },
+          "zpa": {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.legacy.verified.txt

### fragment 13

other · +38 -0

```diff
@@ -4336,0 +4336,38 @@
+            "Spans": [
+              {
+                "Text": "Concrete",
+                "Ws": "zpa",
+                "Tags": [
+                  "10cb16c2-6f15-4101-8689-7c77e6576f52"
+                ]
+              },
+              {
+                "Text": "Shoals",
+                "Ws": "cjy",
+                "Bold": "Invert",
+                "FontSize": -437265941,
+                "ForeColor": "#ADFF2F",
+                "Tags": [
+                  "53cd8e2b-15c6-0490-70d6-738a6708b9ca"
+                ]
+              }
+            ]
+          }
+        },
+        "MorphType": "BoundStem",
+        "HomographNumber": 0,
+        "Senses": [],
+        "Note": {
+          "rkw": {
+            "Spans": [
+              {
+                "Text": "XML",
+                "Ws": "vot",
+                "Bold": "On",
+                "FontSize": -1698959192,
+                "ForeColor": "#ADFF2F",
+                "Tags": [
+                  "9218c79b-f453-0ef3-de05-ea5eeba26367"
+                ]
+              },
+              {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.legacy.verified.txt

### fragment 14

other · +35 -0

```diff
@@ -4374,0 +4374,35 @@
+                "Text": "invoice",
+                "Ws": "rkw",
+                "Tags": [
+                  "6ef3cf72-b5a5-488c-9381-fb7a7f6f961e"
+                ]
+              },
+              {
+                "Text": "bypass",
+                "Ws": "rkw",
+                "Tags": [
+                  "e615bb12-61d9-452e-bac5-06deb6942851"
+                ]
+              }
+            ]
+          },
+          "kee": {
+            "Spans": [
+              {
+                "Text": "Money Market Account",
+                "Ws": "ekp",
+                "Bold": "On",
+                "FontSize": -315220510,
+                "ForeColor": "#A52A2A",
+                "Tags": [
+                  "424e0f12-78a7-37c7-8fa5-74dd81ccc8a7"
+                ]
+              },
+              {
+                "Text": "Glens",
+                "Ws": "kee",
+                "Tags": [
+                  "a323544c-2b85-4fa7-b3c7-f5321ad75c49"
+                ]
+              },
+              {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.legacy.verified.txt

### fragment 15

other · +39 -0

```diff
@@ -4409,0 +4409,39 @@
+                "Text": "Buckinghamshire",
+                "Ws": "kee",
+                "Tags": [
+                  "13a974bf-8b90-4f36-99c6-9f0771f53db0"
+                ]
+              },
+              {
+                "Text": "SMTP",
+                "Ws": "cly",
+                "Bold": "Invert",
+                "FontSize": 872689318,
+                "ForeColor": "#0000FF",
+                "Tags": [
+                  "498aea00-217b-9a3e-7fd0-2748edadf3b3"
+                ]
+              }
+            ]
+          }
+        },
+        "Components": [],
+        "ComplexForms": [],
+        "ComplexFormTypes": [
+          {
+            "Id": "292e9847-8c7c-56e1-87fb-41d200c789e1",
+            "Name": {
+              "hup": "THX",
+              "rsk": "Reduced",
+              "zmq": "hard drive",
+              "nnx": "cyan"
+            },
+            "DeletedAt": null
+          }
+        ],
+        "PublishIn": [
+          {
+            "Id": "bd874c92-e063-2a20-d263-bdc6897a1e85",
+            "DeletedAt": null,
+            "IsMain": false,
+            "Name": {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.legacy.verified.txt

### fragment 16

other · +38 -0

```diff
@@ -4448,0 +4448,38 @@
+              "zrg": "cross-platform",
+              "bno": "heuristic"
+            }
+          }
+        ]
+      },
+      "Id": "8dbc0f41-998e-836a-97e1-f05d46d95c92",
+      "DeletedAt": null
+    },
+    "Output": {
+      "$type": "MiniLcmCrdtAdapter",
+      "Obj": {
+        "$type": "Entry",
+        "Id": "8dbc0f41-998e-836a-97e1-f05d46d95c92",
+        "DeletedAt": null,
+        "LexemeForm": {
+          "mqs": "maximized"
+        },
+        "CitationForm": {
+          "nrz": "Portugal"
+        },
+        "LiteralMeaning": {
+          "juy": {
+            "Spans": [
+              {
+                "Text": "Kyat",
+                "Ws": "juy",
+                "Tags": [
+                  "bc47798c-6e35-430e-a94a-2d1aa82d9119"
+                ]
+              },
+              {
+                "Text": "synthesize",
+                "Ws": "juy",
+                "Tags": [
+                  "75fc659a-ae47-45ec-87a8-2475d5667496"
+                ]
+              }
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.legacy.verified.txt

### fragment 17

other · +33 -0

```diff
@@ -4486,0 +4486,33 @@
+            ]
+          },
+          "rer": {
+            "Spans": [
+              {
+                "Text": "Licensed",
+                "Ws": "rer",
+                "Tags": [
+                  "adf734b1-3abb-4644-a5b7-e712c29a59e6"
+                ]
+              },
+              {
+                "Text": "architectures",
+                "Ws": "dos",
+                "Bold": "On",
+                "FontSize": -1392951304,
+                "ForeColor": "#ADFF2F",
+                "Tags": [
+                  "b316a4f4-208a-e75f-13f0-09a91a2b3506"
+                ]
+              }
+            ]
+          },
+          "zpa": {
+            "Spans": [
+              {
+                "Text": "Concrete",
+                "Ws": "zpa",
+                "Tags": [
+                  "10cb16c2-6f15-4101-8689-7c77e6576f52"
+                ]
+              },
+              {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.legacy.verified.txt

### fragment 18

other · +36 -0

```diff
@@ -4519,0 +4519,36 @@
+                "Text": "Shoals",
+                "Ws": "cjy",
+                "Bold": "Invert",
+                "FontSize": -437265941,
+                "ForeColor": "#ADFF2F",
+                "Tags": [
+                  "53cd8e2b-15c6-0490-70d6-738a6708b9ca"
+                ]
+              }
+            ]
+          }
+        },
+        "MorphType": "BoundStem",
+        "HomographNumber": 0,
+        "Senses": [],
+        "Note": {
+          "rkw": {
+            "Spans": [
+              {
+                "Text": "XML",
+                "Ws": "vot",
+                "Bold": "On",
+                "FontSize": -1698959192,
+                "ForeColor": "#ADFF2F",
+                "Tags": [
+                  "9218c79b-f453-0ef3-de05-ea5eeba26367"
+                ]
+              },
+              {
+                "Text": "invoice",
+                "Ws": "rkw",
+                "Tags": [
+                  "6ef3cf72-b5a5-488c-9381-fb7a7f6f961e"
+                ]
+              },
+              {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.legacy.verified.txt

### fragment 19

other · +35 -0

```diff
@@ -4555,0 +4555,35 @@
+                "Text": "bypass",
+                "Ws": "rkw",
+                "Tags": [
+                  "e615bb12-61d9-452e-bac5-06deb6942851"
+                ]
+              }
+            ]
+          },
+          "kee": {
+            "Spans": [
+              {
+                "Text": "Money Market Account",
+                "Ws": "ekp",
+                "Bold": "On",
+                "FontSize": -315220510,
+                "ForeColor": "#A52A2A",
+                "Tags": [
+                  "424e0f12-78a7-37c7-8fa5-74dd81ccc8a7"
+                ]
+              },
+              {
+                "Text": "Glens",
+                "Ws": "kee",
+                "Tags": [
+                  "a323544c-2b85-4fa7-b3c7-f5321ad75c49"
+                ]
+              },
+              {
+                "Text": "Buckinghamshire",
+                "Ws": "kee",
+                "Tags": [
+                  "13a974bf-8b90-4f36-99c6-9f0771f53db0"
+                ]
+              },
+              {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.legacy.verified.txt

### fragment 20

other · +38 -0

```diff
@@ -4590,0 +4590,38 @@
+                "Text": "SMTP",
+                "Ws": "cly",
+                "Bold": "Invert",
+                "FontSize": 872689318,
+                "ForeColor": "#0000FF",
+                "Tags": [
+                  "498aea00-217b-9a3e-7fd0-2748edadf3b3"
+                ]
+              }
+            ]
+          }
+        },
+        "Components": [],
+        "ComplexForms": [],
+        "ComplexFormTypes": [
+          {
+            "Id": "292e9847-8c7c-56e1-87fb-41d200c789e1",
+            "Name": {
+              "hup": "THX",
+              "rsk": "Reduced",
+              "zmq": "hard drive",
+              "nnx": "cyan"
+            },
+            "DeletedAt": null
+          }
+        ],
+        "VariantOf": [],
+        "Variants": [],
+        "PublishIn": [
+          {
+            "Id": "bd874c92-e063-2a20-d263-bdc6897a1e85",
+            "DeletedAt": null,
+            "IsMain": false,
+            "Name": {
+              "zrg": "cross-platform",
+              "bno": "heuristic"
+            }
+          }
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.legacy.verified.txt

### fragment 21

other · +40 -0

```diff
@@ -4628,0 +4628,40 @@
+        ]
+      },
+      "Id": "8dbc0f41-998e-836a-97e1-f05d46d95c92",
+      "DeletedAt": null
+    }
+  },
+  {
+    "Input": {
+      "$type": "MiniLcmCrdtAdapter",
+      "Obj": {
+        "$type": "Entry",
+        "Id": "84bb5f48-b2a9-d0c8-85ee-aec9203830ee",
+        "DeletedAt": null,
+        "LexemeForm": {
+          "dkk": "Product"
+        },
+        "CitationForm": {},
+        "LiteralMeaning": {},
+        "MorphType": "Infix",
+        "HomographNumber": 1102525176,
+        "Senses": [],
+        "Note": {},
+        "Components": [],
+        "ComplexForms": [],
+        "ComplexFormTypes": [],
+        "PublishIn": [
+          {
+            "Id": "78c00e29-d69e-56ba-77f5-b5be25469c4f",
+            "DeletedAt": null,
+            "IsMain": true,
+            "Name": {
+              "mps": "Small Granite Salad"
+            }
+          }
+        ]
+      },
+      "Id": "84bb5f48-b2a9-d0c8-85ee-aec9203830ee",
+      "DeletedAt": null
+    },
+    "Output": {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.legacy.verified.txt

### fragment 22

other · +38 -0

```diff
@@ -4668,0 +4668,38 @@
+      "$type": "MiniLcmCrdtAdapter",
+      "Obj": {
+        "$type": "Entry",
+        "Id": "84bb5f48-b2a9-d0c8-85ee-aec9203830ee",
+        "DeletedAt": null,
+        "LexemeForm": {
+          "dkk": "Product"
+        },
+        "CitationForm": {},
+        "LiteralMeaning": {},
+        "MorphType": "Infix",
+        "HomographNumber": 1102525176,
+        "Senses": [],
+        "Note": {},
+        "Components": [],
+        "ComplexForms": [],
+        "ComplexFormTypes": [],
+        "VariantOf": [],
+        "Variants": [],
+        "PublishIn": [
+          {
+            "Id": "78c00e29-d69e-56ba-77f5-b5be25469c4f",
+            "DeletedAt": null,
+            "IsMain": true,
+            "Name": {
+              "mps": "Small Granite Salad"
+            }
+          }
+        ]
+      },
+      "Id": "84bb5f48-b2a9-d0c8-85ee-aec9203830ee",
+      "DeletedAt": null
+    }
+  },
+  {
+    "Input": {
+      "$type": "MiniLcmCrdtAdapter",
+      "Obj": {
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.legacy.verified.txt

### fragment 23

other · +40 -0

```diff
@@ -4706,0 +4706,40 @@
+        "$type": "Entry",
+        "Id": "249c38f3-fc0d-195f-7533-97e8c140d0d7",
+        "DeletedAt": null,
+        "LexemeForm": {
+          "kvj": "Florida"
+        },
+        "CitationForm": null,
+        "LiteralMeaning": null,
+        "MorphType": "Prefix",
+        "HomographNumber": 4,
+        "Senses": [],
+        "Note": null,
+        "Components": [],
+        "ComplexForms": [],
+        "ComplexFormTypes": [],
+        "PublishIn": []
+      },
+      "Id": "249c38f3-fc0d-195f-7533-97e8c140d0d7",
+      "DeletedAt": null
+    },
+    "Output": {
+      "$type": "MiniLcmCrdtAdapter",
+      "Obj": {
+        "$type": "Entry",
+        "Id": "249c38f3-fc0d-195f-7533-97e8c140d0d7",
+        "DeletedAt": null,
+        "LexemeForm": {
+          "kvj": "Florida"
+        },
+        "CitationForm": null,
+        "LiteralMeaning": null,
+        "MorphType": "Prefix",
+        "HomographNumber": 4,
+        "Senses": [],
+        "Note": null,
+        "Components": [],
+        "ComplexForms": [],
+        "ComplexFormTypes": [],
+        "VariantOf": [],
+        "Variants": [],
```

## backend/FwLite/LcmCrdt.Tests/Data/SnapshotDeserializationRegressionData.legacy.verified.txt

### fragment 24

other · +5 -0

```diff
@@ -4746,0 +4746,5 @@
+        "PublishIn": []
+      },
+      "Id": "249c38f3-fc0d-195f-7533-97e8c140d0d7",
+      "DeletedAt": null
+    }
```

## backend/FwLite/LcmCrdt.Tests/Data/VerifyRegeneratedSnapshotsAfterMigrationFromScriptedDb.v1.verified.json

### lines 73–74

config · +2 -0

```diff
@@ -72,0 +73,2 @@
+        "VariantOf": [],
+        "Variants": [],
```

## backend/FwLite/LcmCrdt.Tests/Data/VerifyRegeneratedSnapshotsAfterMigrationFromScriptedDb.v2.verified.json

### lines 125–255

config · +8 -0

```diff
@@ -124,0 +125,2 @@
+        "VariantOf": [],
+        "Variants": [],
@@ -165,0 +168,2 @@
+        "VariantOf": [],
+        "Variants": [],
@@ -206,0 +211,2 @@
+        "VariantOf": [],
+        "Variants": [],
@@ -247,0 +254,2 @@
+        "VariantOf": [],
+        "Variants": [],
```

## backend/FwLite/LcmCrdt.Tests/DataModelSnapshotTests.VerifyChangeModels.verified.txt

### lines 43–242

other · +32 -0

```diff
@@ -42,0 +43,8 @@
+    {
+      DerivedType: JsonPatchChange<VariantType>,
+      TypeDiscriminator: jsonPatch:VariantType
+    },
+    {
+      DerivedType: JsonPatchChange<Variant>,
+      TypeDiscriminator: jsonPatch:Variant
+    },
@@ -78,0 +87,8 @@
+    {
+      DerivedType: DeleteChange<VariantType>,
+      TypeDiscriminator: delete:VariantType
+    },
+    {
+      DerivedType: DeleteChange<Variant>,
+      TypeDiscriminator: delete:Variant
+    },
@@ -210,0 +227,16 @@
+    {
+      DerivedType: AddVariantChange,
+      TypeDiscriminator: AddVariantChange
+    },
+    {
+      DerivedType: AddVariantTypeChange,
+      TypeDiscriminator: AddVariantTypeChange
+    },
+    {
+      DerivedType: RemoveVariantTypeChange,
+      TypeDiscriminator: RemoveVariantTypeChange
+    },
+    {
+      DerivedType: CreateVariantType,
+      TypeDiscriminator: CreateVariantType
+    },
```

## backend/FwLite/LcmCrdt.Tests/DataModelSnapshotTests.VerifyDbModel.verified.txt

### fragment 1

other · +2 -0

```diff
@@ -162,0 +163,2 @@
+      VariantOf (List<Variant>) Collection ToDependent Variant
+      Variants (List<Variant>) Collection ToDependent Variant
```

## backend/FwLite/LcmCrdt.Tests/DataModelSnapshotTests.VerifyDbModel.verified.txt

### fragment 2

other · +40 -0

```diff
@@ -346,0 +349,40 @@
+  EntityType: Variant
+    Properties: 
+      Id (_id, Guid) Required PK AfterSave:Throw ValueGenerated.OnAdd
+      Comment (RichMultiString) Required
+        Annotations: 
+          Relational:ColumnType: jsonb
+      DeletedAt (DateTimeOffset?)
+      HideMinorEntry (bool) Required
+      MainEntryId (Guid) Required FK Index
+      MainHeadword (string)
+      MainSenseId (Guid?) FK Index
+        Annotations: 
+          Relational:ColumnName: MainSenseId
+      SnapshotId (no field, Guid?) Shadow FK Index
+      Types (List<VariantType>) Required
+        Annotations: 
+          Relational:ColumnType: jsonb
+      VariantEntryId (Guid) Required FK Index
+      VariantHeadword (string)
+    Keys: 
+      Id PK
+    Foreign keys: 
+      Variant {'MainEntryId'} -> Entry {'Id'} Required Cascade ToDependent: Variants
+      Variant {'MainSenseId'} -> Sense {'Id'} Cascade
+      Variant {'SnapshotId'} -> ObjectSnapshot {'Id'} Unique SetNull
+      Variant {'VariantEntryId'} -> Entry {'Id'} Required Cascade ToDependent: VariantOf
+    Indexes: 
+      MainEntryId
+      MainSenseId
+      SnapshotId Unique
+      VariantEntryId, MainEntryId Unique
+        Annotations: 
+          Relational:Filter: MainSenseId IS NULL
+      VariantEntryId, MainEntryId, MainSenseId Unique
+        Annotations: 
+          Relational:Filter: MainSenseId IS NOT NULL
+    Annotations: 
+      Relational:FunctionName: 
+      Relational:Schema: 
+      Relational:SqlQuery: 
```

## backend/FwLite/LcmCrdt.Tests/DataModelSnapshotTests.VerifyDbModel.verified.txt

### fragment 3

other · +24 -0

```diff
@@ -389,0 +389,24 @@
+      Relational:TableName: Variants
+      Relational:ViewName: 
+      Relational:ViewSchema: 
+  EntityType: VariantType
+    Properties: 
+      Id (Guid) Required PK AfterSave:Throw ValueGenerated.OnAdd
+      DeletedAt (DateTimeOffset?)
+      Name (MultiString) Required
+        Annotations: 
+          Relational:ColumnType: jsonb
+      SnapshotId (no field, Guid?) Shadow FK Index
+    Keys: 
+      Id PK
+    Foreign keys: 
+      VariantType {'SnapshotId'} -> ObjectSnapshot {'Id'} Unique SetNull
+    Indexes: 
+      SnapshotId Unique
+    Annotations: 
+      Relational:FunctionName: 
+      Relational:Schema: 
+      Relational:SqlQuery: 
+      Relational:TableName: VariantType
+      Relational:ViewName: 
+      Relational:ViewSchema: 
```

## backend/FwLite/LcmCrdt.Tests/DataModelSnapshotTests.VerifyIObjectWithIdModels.verified.txt

### lines 39–46

other · +8 -0

```diff
@@ -38,0 +39,8 @@
+    {
+      DerivedType: VariantType,
+      TypeDiscriminator: VariantType
+    },
+    {
+      DerivedType: Variant,
+      TypeDiscriminator: Variant
+    },
```

## backend/FwLite/LcmCrdt/Templates/blank-project-template.json

### fragment 1

config · +2 -2

```diff
@@ -16742,2 +16742,2 @@
-        "Id": "e15928c1-48ce-439c-bbf7-f23457718d72",
-        "MaybeId": "e15928c1-48ce-439c-bbf7-f23457718d72",
+        "Id": "53f7afa3-13c7-4c07-a9e4-038912170095",
+        "MaybeId": "53f7afa3-13c7-4c07-a9e4-038912170095",
```

## backend/FwLite/LcmCrdt/Templates/blank-project-template.json

### fragment 2

config · +40 -1

```diff
@@ -16783,1 +16783,40 @@
-  }
+  },
+  "VariantTypes": [
+    {
+      "Id": "3942addb-99fd-43e9-ab7d-99025ceb0d4e",
+      "Name": {
+        "en": "Unspecified Variant"
+      },
+      "DeletedAt": null
+    },
+    {
+      "Id": "024b62c9-93b3-41a0-ab19-587a0030219a",
+      "Name": {
+        "en": "Dialectal Variant"
+      },
+      "DeletedAt": null
+    },
+    {
+      "Id": "4343b1ef-b54f-4fa4-9998-271319a6d74c",
+      "Name": {
+        "en": "Free Variant"
+      },
+      "DeletedAt": null
+    },
+    {
+      "Id": "01d4fbc1-3b0c-4f52-9163-7ab0d4f4711c",
+      "Name": {
+        "en": "Irregularly Inflected Form"
+      },
+      "DeletedAt": null
+    },
+    {
+      "Id": "a32f1d1c-4832-46a2-9732-c2276d6547e8",
+      "Name": {
+        "en": "Plural"
+      },
+      "DeletedAt": null
+    },
+    {
+      "Id": "837ebe72-8c1d-4864-95d9-fa313c499d78",
+      "Name": {
```

## backend/FwLite/LcmCrdt/Templates/blank-project-template.json

### fragment 3

config · +12 -0

```diff
@@ -16823,0 +16823,12 @@
+        "en": "Past"
+      },
+      "DeletedAt": null
+    },
+    {
+      "Id": "0c4663b3-4d9a-47af-b9a1-c8565d8112ed",
+      "Name": {
+        "en": "Spelling Variant"
+      },
+      "DeletedAt": null
+    }
+  ]
```

## backend/FwLite/VARIANTS.md

### fragment 1

other · +40 -0

```diff
@@ -0,0 +1,40 @@
+# Variants in FieldWorks Lite — design & work log
+
+Working document for adding variant support to FwLite (model → sync → UI). Written so any
+dev/agent can pick up the work mid-stream. Update the **Status** section as steps land.
+
+## Status
+
+- [x] Exploration (complex-forms blueprint, liblcm variant model, viewer UI)
+- [x] Design review with Tim (2026-07-03): per-link model confirmed, naming settled
+- [x] Step 1+2 — model, changes, both APIs, sync orchestration + round-trip suite
+  (all backend suites green: MiniLcm.Tests, LcmCrdt.Tests, FwDataMiniLcmBridge.Tests,
+  FwLiteProjectSync.Tests incl. Sena3 live db regen; the WS-font failure on Windows is
+  the known local-only false-fail)
+- [x] Step 3 — Viewer UI (fields, per-link type menu, demo seed, i18n, Playwright green)
+- [x] Review (8-agent pass; fixes: sense-move composite-key lookup in the FwData bridge,
+  type-toggle re-render, hub read parity) + draft PRs:
+  backend [#2408](https://github.com/sillsdev/languageforge-lexbox/pull/2408),
+  UI [#2409](https://github.com/sillsdev/languageforge-lexbox/pull/2409) (stacked)
+
+**Boundary change vs the original plan**: steps 1 and 2 merged — the moment the FwData
+bridge reads variants, importing a variant-containing project crashes unless variant types
+are imported before entries, so a "model-only" PR can't be green against real projects.
+Final split: one backend PR (model through sync) + one UI PR stacked on it.
+
+### Step 2/3 decision addenda
+
+- **Deterministic variant-list order on both sides** (`Variant.VariantOfOrder`/`VariantsOrder`,
+  composite-key based, culture-free). ComplexForms sort alphabetically because FieldWorks
+  does; variants have no such convention, and guid order keeps snapshot comparisons and
+  sync stable across cultures. UI can sort for display later if wanted.
+- **`CrdtMiniLcmApi.BulkCreateEntries`** (import fast path) emits `AddVariantChange` with the
+  same only-if-other-endpoint-already-created trick as components.
+- **Sena3 verified live db/snapshot regenerated**: sena-3 really contains variants
+  (*inde*→*ande*, *yenda*→*enda*, custom bilingual "Pronunciation Variant" type), which now
+  round-trip — the diff was inspected and is purely additive.
+- **Blank-project template regenerated**: new CRDT projects seed the 7 standard FLEx variant
+  types (well-known guids).
+- **UI**: `Variant of` (picker: entries-and-senses) and `Variants` (picker: only-entries)
+  fields, both shown by default in both views; per-link variant types via a "Variant type"
+  checkbox submenu on each link badge; new links default to *Unspecified Variant* (FLEx
```

## backend/FwLite/VARIANTS.md

### fragment 2

other · +39 -0

```diff
@@ -41,0 +41,39 @@
+  behavior); all edits flow through `updateEntry` (before/after diff → EntrySync), so the
+  in-memory demo works without dedicated endpoints. `useVariantTypes()` is **eager** —
+  the type list must be loaded before the first pick applies the default.
+- **helpIds**: `Variant_of_field.htm` verified to exist (fetched); there's no dedicated
+  FLEx topic for the Variants back-reference field, so it reuses the same topic.
+
+## The LCM model (authority: liblcm)
+
+A variant relationship is a `LexEntryRef` **owned by the variant (minor) entry**
+(`LexEntry.EntryRefsOS`), with:
+
+| LexEntryRef field | Variant usage | FLEx UI label |
+|---|---|---|
+| `RefType` | `LexEntryRefTags.krtVariant` (= 0; complex form = 1) | — |
+| `ComponentLexemesRS` | The main entry **or sense** this is a variant of. Sequence — multiple targets allowed by the model; FLEx UI uses one per ref. | "Variant of" |
+| `VariantEntryTypesRS` | Types from `LexDb.VariantEntryTypesOA` (per ref!) | "Variant Type" |
+| `HideMinorEntry` | 0 = show as minor entry (default on create) | "Show Minor Entry" (inverted) |
+| `Summary` | Per-ref note | "Comment" |
+| `PrimaryLexemesRS` | **Unused** for variants (complex-forms only) | — |
+
+Key liblcm business rules (`SIL.LCModel/DomainImpl/OverridesLing_Lex.cs`):
+
+- `LexEntry.MakeVariantOf` creates the ref with `HideMinorEntry = 0` and defaults the type
+  to *Unspecified Variant* when none is given.
+- A `LexEntryRef` is deleted when its `ComponentLexemesRS` becomes empty (merge/cleanup paths).
+- An entry can own **multiple** variant refs (e.g. variant of two entries with different
+  types); back-refs (`VariantFormEntryBackRefs`, also on senses) are computed.
+- Variant entries **may have senses** (no model restriction). An entry created *as* a variant
+  has none; an entry converted to a variant keeps its senses (FLEx course A7: *pagaye* vs
+  *placoter*).
+
+The variant-types list is **hierarchical**: *Irregularly Inflected Form* (a `LexEntryInflType`)
+has child types *Plural* and *Past*. `LexEntryInflType` extends `LexEntryType` with
+`GlossPrepend/GlossAppend/InflFeatsOA/SlotsRC` (not modeled in v1). Well-known GUIDs:
+Unspecified `3942addb…`, Dialectal `024b62c9…`, Free `4343b1ef…`, Spelling `0c4663b3…`,
+Irregularly Inflected Form `01d4fbc1…`, Plural `a32f1d1c…`, Past `837ebe72…`.
+
+## Design: one link = one LexEntryRef (per-link types)
+
```

## backend/FwLite/VARIANTS.md

### fragment 3

other · +33 -0

````diff
@@ -80,0 +80,33 @@
+**FLEx compatibility is the top priority** (Tim, design review): we don't have to model every
+field, but what we model must round-trip losslessly. Variant Type / Show Minor Entry /
+Comment are **per relationship** in FLEx (they live on the `LexEntryRef`), so the MiniLcm
+link carries them — unlike complex forms, which flatten types to entry level.
+
+```csharp
+public record Variant : IObjectWithId<Variant>
+{
+    Guid Id;                    // synthetic in CRDT; unset when read from FwData (sync keys on the composite below)
+    Guid VariantEntryId;        // the variant (minor) entry — owns the LexEntryRef in FW
+    string? VariantHeadword;    // derived cache, like ComplexFormComponent headwords
+    Guid MainEntryId;           // the entry this is a variant of (LCM: ComponentLexemes)
+    Guid? MainSenseId;          //   …or a specific sense of it
+    string? MainHeadword;       // derived cache
+    List<VariantType> Types;    // LexEntryRef.VariantEntryTypesRS
+    bool HideMinorEntry;        // LexEntryRef.HideMinorEntry != 0 (LCM polarity kept; UI shows "Show minor entry" inverted)
+    RichMultiString? Comment;   // LexEntryRef.Summary (FLEx UI labels it "Comment") — check actual MultiString kind at impl time
+    DateTimeOffset? DeletedAt;
+}
+```
+
+- **`Entry.Variants: List<Variant>`** — links where this entry (or one of its senses) is the
+  main. Matches the FLEx "Variants" section on a main entry.
+- **`Entry.VariantOf: List<Variant>`** — links where this entry is the variant. Matches the
+  FLEx "Variant of" field on a minor entry.
+- **`VariantType`**: `Id`, `Name`, `DeletedAt` — same shape as `ComplexFormType`, a
+  first-class CRDT object with its own sync.
+- Sync key: **composite `(VariantEntryId, MainEntryId, MainSenseId)`**, never `Id`
+  (FW-side links are keyed by the ref they live in; ids don't line up across sides —
+  same rule as `ComplexFormComponent`).
+
+### Decisions (and the reasoning)
+
````

## backend/FwLite/VARIANTS.md

### fragment 4

other · +33 -0

```diff
@@ -113,0 +113,33 @@
+1. **Per-link model, not complex-form parity flattening** (Tim confirmed). One `Variant` =
+   one `LexEntryRef` with exactly one target. Reading a multi-target ref (model-legal, rare,
+   not creatable in FLEx UI) yields one link per target sharing the ref's types/fields;
+   writing back would split into per-link refs. Two refs to the *same* target collapse to
+   one link (composite-key dedupe, first ref wins) — documented edge, mirrors complex forms.
+2. **Naming leans FLEx-user-facing, not LCM-internal** (Tim: "Component = the main entry" is
+   unintuitive, even though liblcm's `ComponentLexemesRS` is exactly that). Hence
+   `MainEntryId`/`MainSenseId`, record name `Variant`, entry fields `Variants`/`VariantOf`.
+   `Comment` (FLEx label) maps to LCM `Summary`; precedent: MiniLcm `Entry.Note` ↔ LCM
+   `LexEntry.Comment`. `HideMinorEntry` keeps LCM's name *and polarity* so bridge code never
+   flips signs; the UI can present "Show minor entry".
+3. **`HideMinorEntry` + `Comment` are modeled and synced in v1, UI deferred** (Tim). Cheap on
+   the link entity, avoids a second migration + sync fanout later, and deleting/recreating a
+   link in FWL can never silently drop FLEx data.
+4. **Variant types are read *flattened*** (`GetVariantTypes` must be changed — it exists today
+   reading only top-level `PossibilitiesOS`): the IIF subtypes (*Plural*, *Past*) are children
+   in the list and are what IIF-heavy projects assign. Creating a type missing on the other
+   side creates a **plain top-level `LexEntryType`** — standard types exist everywhere
+   (well-known GUIDs), so this is rare; hierarchy and `LexEntryInflType` payloads don't
+   round-trip in v1.
+5. **Link edits are allowed** (unlike complex forms' "delete and recreate"): type add/remove
+   are dedicated CRDT changes on the link (`AddVariantTypeChange`/`RemoveVariantTypeChange`,
+   `EditChange<Variant>`); `HideMinorEntry`/`Comment` sync via `JsonPatchChange<Variant>`.
+   This is what makes concurrent type edits merge instead of last-writer-wins.
+6. **No ordering.** Variant lists have no user-meaningful order in FLEx; both directions diff
+   as sets. No `IOrderable`, no `SetOrderChange`, no Move API.
+7. **Self-references, duplicates AND cycles are rejected; chains are allowed.** (This
+   decision reversed mid-implementation: `MakeVariantOf` has no cycle check, but the FwData
+   conformance tests proved liblcm rejects circular refs at a lower level —
+   `LexEntryRef.ValidateAddObjectInternal` → `LexEntry.AllComponents`, which walks the
+   **combined** complex-form + variant component graph. Allowing in the CRDT what FLEx
+   rejects would wedge sync, so `AddVariantChange` mirrors the combined-graph walk.)
+   The duplicate/cycle guard lives in `AddVariantChange` (soft-delete, sync-tolerant);
```

## backend/FwLite/VARIANTS.md

### fragment 5

other · +39 -0

```diff
@@ -146,0 +146,39 @@
+   self-reference is additionally rejected by `VariantValidator` in the validation wrapper
+   (consistent across both implementations). Chains (a variant of a variant) remain legal,
+   as in FLEx.
+8. **Deleted `VariantType` cleanup**: `Variant.GetReferences()` includes its `Types` ids, and
+   `RemoveReference` removes the type from the list (only endpoint ids soft-delete the link).
+   Better than the complex-forms quirk where deleted types linger in `Entry.ComplexFormTypes`.
+   Like `Entry.ComplexFormTypes`, `Variant.Types` stores denormalized copies (jsonb), so a
+   type *rename* reaches already-linked variants on the next sync/read, not instantly.
+9. **Variant entries with no senses are first-class** and must be covered by tests both ways
+   (headline behavioral difference; FLEx "Insert Variant" creates sense-less entries).
+10. **A variant can target a sense** (`MainSenseId`); on the main side such links still
+    surface under the owning entry's `Variants`.
+11. **Minor-entry visibility in FWL UI** (step 3): users must be able to see at a glance that
+    an entry is a variant, not a first-class entry (badge / "Variant of X" in the editor;
+    list styling is a follow-up).
+
+### FwData bridge mapping
+
+Read (`FwDataMiniLcmApi.FromLexEntry`):
+- `VariantOf` ← each `entry.VariantEntryRefs` ref × each `ComponentLexemesRS` target
+  (`ILexEntry`/`ILexSense`), `DistinctBy` composite key; per-link `Types`/`HideMinorEntry`/
+  `Comment` from the ref.
+- `Variants` ← back-refs: `entry.VariantFormEntryBackRefs` + per-sense back-refs (verify
+  exact liblcm property names at impl time), mapped the same way.
+- `GetVariantTypes()` ← `LexDb.VariantEntryTypesOA` **flattened** (decision 4).
+
+Write:
+- `CreateVariant` → **new** `LexEntryRef` on the variant entry (`RefType = krtVariant`),
+  `HideMinorEntry`/`Summary`/types from the link, add the single target. Idempotent when the
+  composite already exists.
+- `DeleteVariant` → find the ref holding the target; remove the target; delete the ref when
+  its components empty (liblcm's own cleanup semantics).
+- `AddVariantType`/`RemoveVariantType` (link-locator + type id) → that ref's
+  `VariantEntryTypesRS`.
+- `SubmitUpdateVariant` (scalars) → proxy over the ref (`UpdateComplexFormTypeProxy` pattern).
+- Type CRUD → possibility list (create = plain top-level `LexEntryType`).
+
+### CRDT side
+
```

## backend/FwLite/VARIANTS.md

### fragment 6

other · +39 -0

```diff
@@ -185,0 +185,39 @@
+- `Variant` table (`Variants`): FK cascades — Entry×2 (`VariantEntryId`, `MainEntryId`),
+  Sense (`MainSenseId`); filtered unique indexes on the composite (sense null / not null),
+  mirroring `ComplexFormComponents`; `Types` jsonb; `Comment` jsonb.
+- `VariantType` snapshot table (mirror `ComplexFormType`).
+- linq2db headword expressions for `VariantHeadword`/`MainHeadword` (mirror the
+  `ComplexFormComponent` `IsExpression` mappings in `ConfigureDbOptions`), plus `Finalize`
+  sorting for deterministic list order.
+- EF migration `AddVariants`.
+- Changes (register in `LcmCrdtKernel.ConfigureCrdt` **and** add instances to
+  `UseChangesTests.GetAllChanges()` — kernel comment mandates it):
+  `AddVariantChange` (create; carries types+scalars; dedupe/cycle/deleted-ref handling
+  mirroring `AddEntryComponentChange`),
+  `AddVariantTypeChange`/`RemoveVariantTypeChange` (`EditChange<Variant>`),
+  `CreateVariantType`, `JsonPatchChange<Variant>`, `JsonPatchChange<VariantType>`,
+  `DeleteChange<Variant>`, `DeleteChange<VariantType>`.
+  A `SetVariantChange` (mirror of `SetComplexFormComponentChange`) was considered and
+  dropped: that change turned out to be test/wire-legacy only for complex forms; variant
+  scalars go through `JsonPatchChange<Variant>` and endpoint changes are delete+recreate.
+
+### API surface (both implementations + wrappers)
+
+Read: `GetVariantTypes()`, `GetVariantType(Guid)`.
+Write: `CreateVariantType`, `UpdateVariantType` ×2, `DeleteVariantType`,
+`CreateVariant(variant)`, `DeleteVariant(variant)`, `UpdateVariant(before, after)`,
+`AddVariantType(variant, typeId)`, `RemoveVariantType(variant, typeId)` — link-locator
+arguments resolve by composite key on both sides.
+Submit (sync, result-less): `SubmitCreateVariant`, `SubmitUpdateVariant(variant, patch)`,
+`SubmitUpdateVariantType`.
+
+Fanout sites that must stay in lockstep:
+- `CrdtMiniLcmApi`, `FwDataMiniLcmApi` (manual implementations)
+- `DryRunMiniLcmApi` (manual write methods; reads auto-forward)
+- `MiniLcmApiWriteNormalizationWrapper` (manual write methods)
+- `MiniLcmApiValidationWrapper` — **explicit** additions or the new writes silently skip
+  validation (BeaKona auto-forwards; the CreateEntry gap #2362 is the cautionary tale)
+- `ResumableImportApi` — cache `CreateVariantType` like `CreateComplexFormType` (step 2)
+- `MiniLcmApiNotifyWrapper` (FwLiteShared) — notify on variant writes for UI refresh
+- `MiniLcmJsInvokable`, `InMemoryDemoApi`, generated TS types (step 3)
+
```

## backend/FwLite/VARIANTS.md

### fragment 7

other · +34 -0

```diff
@@ -224,0 +224,34 @@
+### Sync design (step 2)
+
+- `VariantTypeSync` (mirror `ComplexFormTypeSync`); runs in `SyncInternal` next to
+  `ComplexFormTypeSync`, before entries.
+- `VariantSync` (per-link): types diff via `Add/RemoveVariantType`; `HideMinorEntry`/`Comment`
+  via `SubmitUpdateVariant` patch. Used by EntrySync diff Replace and `UpdateVariant`.
+- `VariantOf`/`Variants` link diffs join **phase 2** (`SyncComplexFormsAndComponents`, both
+  directions — a one-direction wiring won't reconcile deletes). Phase/option names stay
+  as-is in these PRs (`…ComplexFormsAndComponents` now covers variants too; renaming is a
+  separate no-behavior PR — reviewer advice, keeps the critical diff small).
+- `CreateEntryOptions.IncludeComplexFormsAndComponents` also gates variant links (doc
+  comment updated; entry-to-entry refs need both endpoints to exist).
+- `ProjectSnapshot` gains `VariantTypes` — update **`TakeProjectSnapshot()`**
+  (`MiniLcmApiExtensions`) and `ProjectSnapshot.Empty`, or it compiles-but-snapshots-empty
+  (landmine #1912-class).
+- `ProjectImporter`/`MiniLcmImport`: explicit `VariantType` creation loop (same slot as
+  complex-form types, before entries) — import is a separate code path from sync.
+- `ResumableImportApi`: cache `CreateVariantType`.
+- Legacy snapshots need **no** MorphTypes-style patch: CRDT genuinely has no variants yet, so
+  the first sync after upgrade imports FwData variants into the CRDT (dedicated upgrade test:
+  snapshot without variants + FwData with variants → added to CRDT, nothing deleted from
+  FwData).
+- **Verified files must be regenerated regardless of Sena3 content**: entry shape changes
+  break `ProjectSnapshotSerializationTests.LatestSena3SnapshotRoundTrips` (+ the dated
+  `Snapshots/` files) and possibly `LiveSena3Sync`'s `sena-3-live.verified.sqlite` /
+  `CrdtChanges == 0` assertion (Sena 3 contains variants → first sync after upgrade
+  produces changes). Regenerate + eyeball, don't hand-edit.
+- `EntryFakerHelper`/AutoFaker: `CanSyncRandomEntries` will start generating variant links —
+  extend `PrepareToCreateEntry` to create referenced variant entries/types (mirror the
+  `createComponents` flag) and extend `SyncTests.SyncExclusions` for the derived
+  `VariantHeadword`/`MainHeadword` caches.
+
+### Rollout / compatibility notes
+
```

## backend/FwLite/VARIANTS.md

### fragment 8

other · +40 -0

```diff
@@ -258,0 +258,40 @@
+- Same story as every previous model addition (MorphTypes, Publications): the lexbox server
+  stores change JSON opaquely, but **old FwLite clients cannot deserialize a new change
+  type** — they break only when someone actually uses variants in a synced project, and
+  auto-update closes the window. No extra gating exists or is added (precedent).
+- FwHeadless consumes the same sync libraries; it must be deployed with/before a client
+  release that writes variant changes.
+
+### Test plan
+
+Mirror the *named* complex-forms cases (test-auditor sweep), not just categories:
+
+- `MiniLcm.Tests/VariantTestsBase` (subclassed by LcmCrdt.Tests + FwDataMiniLcmBridge.Tests):
+  create/delete; headwords update when referenced entries change; replaying returned object
+  is idempotent; same-link-again does nothing (null and non-null sense); changing a property
+  and creating again creates both; multi-layer cycle guards (1/2/3 levels) + works when a
+  would-be-cycle member was deleted; **variant entry without senses; variant-of-a-sense;
+  entry that is both a variant and a component; per-link types round-trip; type add/remove;
+  HideMinorEntry/Comment round-trip**.
+- `LcmCrdt.Tests/Changes/VariantTests` (mirror `ComplexFormTests`: add/remove type, add
+  link, delete link, duplicate links are soft-deleted) + `UseChangesTests.GetAllChanges()`
+  entries + `ChangeSerializationTests` generator branch + regression-data regen.
+- Validator tests (self-reference, empty refs, wrong-direction ids, nested type validation).
+- `FwLiteProjectSync.Tests`: EntrySync diff tests; round-trip create/edit/delete both
+  directions (two named delete-cascade tests: delete main entry vs delete variant entry);
+  link-target deleted between syncs (delete-vs-edit race); sense-targeted link when the
+  sense moves entries; new link referencing a new sense; sense-less variant round-trip;
+  legacy-snapshot upgrade; flattened-type read + create-missing-type-lands-top-level
+  (FwData bridge); Sena3 + verified files regen.
+- Playwright (step 3): add/remove a variant link + type via the demo project.
+
+## Stacked PR plan
+
+1. **`feat/variants-model`** — models, validators, API surface, CRDT entities + changes +
+   migration, FwData bridge read/write, SyncHelpers (`VariantTypeSync`, `VariantSync`,
+   EntrySync diffs — they also power `UpdateEntry(before, after)`), conformance tests.
+   Green standalone; project-sync orchestration doesn't move variants yet.
+2. **`feat/variants-sync`** — `CrdtFwdataProjectSyncService` + `ProjectSnapshot.VariantTypes`
+   + `TakeProjectSnapshot`, `ProjectImporter`/`MiniLcmImport`/`ResumableImportApi`,
+   round-trip + upgrade tests, verified-file regens (incl. Sena3).
+3. **`feat/variants-ui`** — `MiniLcmJsInvokable` + `MiniLcmApiNotifyWrapper` hooks,
```

## backend/FwLite/VARIANTS.md

### fragment 9

other · +20 -0

```diff
@@ -298,0 +298,20 @@
+   regenerated dotnet-types, entity-config + view-data fields (`variantOf`, `variants` —
+   decide `show` defaults: mirror complexForms=true; variant-type picker inside the link
+   rows), `VariantOf.svelte`/`Variants.svelte` (reuse `EntryOrSensePicker` +
+   `EntryOrSenseItemList`, **both non-orderable**, `pt()` dual labels for FW-Classic view,
+   disable self/duplicates but allow cross-type overlap with components), variant badge for
+   minor entries (decision 11), demo data seeded with a variant pair + real (not stub)
+   `InMemoryDemoApi` support for the paths the UI uses, i18n extraction **with context
+   comments**, Playwright test.
+
+## Open questions / follow-ups (not blockers)
+
+- Dictionary preview (`DictionaryEntry.svelte`) shows neither complex forms nor variants;
+  "variant of X" there is a follow-up.
+- `LexEntryInflType` extras (GlossPrepend/Append, InflFeats, Slots), type hierarchy
+  round-trip — future work.
+- Entry-list styling of minor entries (beyond the editor badge) — follow-up.
+- FLEx "Insert Variant" convenience (create variant entry + link in one step) in the
+  new-entry dialog — follow-up UX; v1 links existing entries.
+- `HideMinorEntry` is modeled as bool; LCM docs hint the int may become per-publication bit
+  flags someday — revisit if FLEx ever uses values other than 0/1.
```

## frontend/viewer/src/lib/utils.ts

### defaultEntry

method · +2 -0

```diff
@@ -46,0 +47,2 @@
+    variantOf: [],
+    variants: [],
```

## frontend/viewer/src/stories/editor/entity-primitives/entry-editor-primitive.stories.svelte

### module script

other · +2 -0

```diff
@@ -42,0 +43,2 @@
+    variantOf: [],
+    variants: [],
```

## backend/FwLite/FwDataMiniLcmBridge.Tests/MiniLcmTests/VariantTests.cs

### FwDataMiniLcmBridge.Tests.MiniLcmTests

other · +1 -0

```diff
@@ -7,0 +7,1 @@
+namespace FwDataMiniLcmBridge.Tests.MiniLcmTests;
```

### VariantTests

other · +6 -0

```diff
@@ -9,0 +9,3 @@
+[Collection(ProjectLoaderFixture.Name)]
+public class VariantTests(ProjectLoaderFixture fixture) : VariantTestsBase
+{
@@ -16,0 +16,1 @@
+
@@ -27,0 +27,1 @@
+
@@ -37,0 +37,1 @@
+}
```

### VariantTests.NewApi

method · +4 -0

```diff
@@ -12,0 +12,4 @@
+    protected override Task<IMiniLcmApi> NewApi()
+    {
+        return Task.FromResult<IMiniLcmApi>(fixture.NewProjectApi("variant-test", "en", "en"));
+    }
```

### VariantTestsMultipleRefs

other · +9 -0

```diff
@@ -42,0 +42,3 @@
+[Collection(ProjectLoaderFixture.Name)]
+public class VariantTestsMultipleRefs(ProjectLoaderFixture fixture) : VariantTestsBase
+{
@@ -49,0 +49,1 @@
+
@@ -69,0 +69,1 @@
+
@@ -91,0 +91,1 @@
+
@@ -104,0 +104,1 @@
+
@@ -117,0 +117,1 @@
+
@@ -132,0 +132,1 @@
+}
```

### VariantTestsMultipleRefs.NewApi

method · +4 -0

```diff
@@ -45,0 +45,4 @@
+    protected override Task<IMiniLcmApi> NewApi()
+    {
+        return Task.FromResult<IMiniLcmApi>(fixture.NewProjectApi("variant-test-multipleRefs", "en", "en"));
+    }
```

### VariantTestsMultipleRefs.InitializeAsync

method · +19 -0

```diff
@@ -50,0 +50,19 @@
+    public override async Task InitializeAsync()
+    {
+        await base.InitializeAsync();
+        var fwDataApi = (FwDataMiniLcmApi)BaseApi;
+        var variantEntry = fwDataApi.EntriesRepository.GetObject(_variantEntryId);
+        await fwDataApi.Cache.DoUsingNewOrCurrentUOW("Add dangling variant LexEntryRefs",
+            "Remove dangling variant LexEntryRefs",
+            () =>
+            {
+                //FLEx data can contain variant refs with no components; they must not confuse reads or writes
+                foreach (var _ in Enumerable.Range(0, 2))
+                {
+                    var entryRef = fwDataApi.Cache.ServiceLocator.GetInstance<ILexEntryRefFactory>().Create();
+                    variantEntry.EntryRefsOS.Add(entryRef);
+                    entryRef.RefType = LexEntryRefTags.krtVariant;
+                }
+                return ValueTask.CompletedTask;
+            });
+    }
```

### VariantTestsMultipleRefs.DuplicateVariantRefs_AreNotDuplicated

method · +12 -0

```diff
@@ -92,0 +92,12 @@
+    [Fact]
+    public async Task DuplicateVariantRefs_AreNotDuplicated()
+    {
+        await AddDuplicateVariantRef();
+
+        var entry = await Api.GetEntry(_variantEntryId);
+        entry.Should().NotBeNull();
+        entry!.VariantOf.Should().HaveCount(1);
+        var mainEntry = await Api.GetEntry(_mainEntryId);
+        mainEntry.Should().NotBeNull();
+        mainEntry!.Variants.Should().HaveCount(1);
+    }
```

### VariantTestsMultipleRefs.AddDuplicateVariantRef

method · +14 -0

```diff
@@ -118,0 +118,14 @@
+    private async Task AddDuplicateVariantRef()
+    {
+        var fwDataApi = (FwDataMiniLcmApi)BaseApi;
+        var variantEntry = fwDataApi.EntriesRepository.GetObject(_variantEntryId);
+        var mainEntry = fwDataApi.EntriesRepository.GetObject(_mainEntryId);
+        await fwDataApi.Cache.DoUsingNewOrCurrentUOW("Add variant LexEntryRefs",
+            "Remove variant LexEntryRefs",
+            () =>
+            {
+                variantEntry.MakeVariantOf(mainEntry, fwDataApi.VariantTypesFlattened.First());
+                variantEntry.MakeVariantOf(mainEntry, fwDataApi.VariantTypesFlattened.Last());
+                return ValueTask.CompletedTask;
+            });
+    }
```

## backend/FwLite/FwLiteProjectSync.Tests/EntrySyncTests.cs

### EntrySyncTestsBase

other · +1 -0 · low-signal (whitespace)

```diff
@@ -1000,0 +1000,1 @@
+
```

## backend/FwLite/FwLiteProjectSync.Tests/SyncTests.cs

### SyncTests.AssertSnapshotsAreEquivalent

method · +2 -1

```diff
@@ -102,1 +104,1 @@
-        var excludeIds = new[] { typeof(ComplexFormComponent), typeof(WritingSystem) };
+        var excludeIds = new[] { typeof(ComplexFormComponent), typeof(Variant), typeof(WritingSystem) };
@@ -111,0 +114,1 @@
+                    .WithoutStrictOrderingFor(x => x.VariantTypes)
```

## backend/FwLite/FwLiteProjectSync.Tests/VariantSyncTests.cs

### FwLiteProjectSync.Tests

other · +1 -0

```diff
@@ -5,0 +5,1 @@
+namespace FwLiteProjectSync.Tests;
```

### VariantSyncTests

other · +24 -0

```diff
@@ -7,0 +7,10 @@
+public class VariantSyncTests : IClassFixture<SyncFixture>, IAsyncLifetime
+{
+    private readonly SyncFixture _fixture;
+    private readonly CrdtFwdataProjectSyncService _syncService;
+
+    private readonly Guid _mainEntryId = Guid.NewGuid();
+    private readonly Guid _variantEntryId = Guid.NewGuid();
+    private Entry _mainEntry = null!;
+    private Entry _variantEntry = null!;
+
@@ -22,0 +22,1 @@
+
@@ -42,0 +42,1 @@
+
@@ -55,0 +55,1 @@
+
@@ -60,0 +60,1 @@
+
@@ -71,0 +71,1 @@
+
@@ -105,0 +105,1 @@
+
@@ -126,0 +126,1 @@
+
@@ -145,0 +145,1 @@
+
@@ -179,0 +179,1 @@
+
@@ -211,0 +211,1 @@
+
@@ -232,0 +232,1 @@
+
@@ -253,0 +253,1 @@
+
@@ -274,0 +274,1 @@
+
@@ -316,0 +316,1 @@
+}
```

### VariantSyncTests.VariantSyncTests

method · +5 -0

```diff
@@ -17,0 +17,5 @@
+    public VariantSyncTests(SyncFixture fixture)
+    {
+        _fixture = fixture;
+        _syncService = _fixture.SyncService;
+    }
```

### VariantSyncTests.InitializeAsync

method · +19 -0

```diff
@@ -23,0 +23,19 @@
+    public async Task InitializeAsync()
+    {
+        _fixture.DeleteSyncSnapshot();
+        _mainEntry = await _fixture.FwDataApi.CreateEntry(new()
+        {
+            Id = _mainEntryId,
+            LexemeForm = { { "en", "color" } },
+            Senses =
+            [
+                new Sense { Gloss = { { "en", "colour sense" } } }
+            ]
+        });
+        // sense-less on purpose — the FLEx "Insert Variant" shape
+        _variantEntry = await _fixture.FwDataApi.CreateEntry(new()
+        {
+            Id = _variantEntryId,
+            LexemeForm = { { "en", "colour" } }
+        });
+    }
```

### VariantSyncTests.DisposeAsync

method · +12 -0

```diff
@@ -43,0 +43,12 @@
+    public async Task DisposeAsync()
+    {
+        await foreach (var entry in _fixture.FwDataApi.GetAllEntries())
+        {
+            await _fixture.FwDataApi.DeleteEntry(entry.Id);
+        }
+        foreach (var entry in await _fixture.CrdtApi.GetAllEntries().ToArrayAsync())
+        {
+            await _fixture.CrdtApi.DeleteEntry(entry.Id);
+        }
+        _fixture.DeleteSyncSnapshot();
+    }
```

### VariantSyncTests.LegacySnapshotWithoutVariantTypes_FirstSyncImportsVariantsIntoCrdt.StripVariants

method · +6 -0

```diff
@@ -309,0 +309,6 @@
+        static Entry StripVariants(Entry entry)
+        {
+            entry.VariantOf = [];
+            entry.Variants = [];
+            return entry;
+        }
```

## backend/FwLite/LcmCrdt.Tests/Changes/VariantChangeTests.cs

### LcmCrdt.Tests.Changes

other · +1 -0

```diff
@@ -5,0 +5,1 @@
+namespace LcmCrdt.Tests.Changes;
```

### VariantChangeTests

other · +15 -0

```diff
@@ -7,0 +7,2 @@
+public class VariantChangeTests(MiniLcmApiFixture fixture) : IClassFixture<MiniLcmApiFixture>
+{
@@ -15,0 +15,1 @@
+
@@ -30,0 +30,1 @@
+
@@ -50,0 +50,1 @@
+
@@ -64,0 +64,1 @@
+
@@ -77,0 +77,1 @@
+
@@ -94,0 +94,1 @@
+
@@ -108,0 +108,1 @@
+
@@ -124,0 +124,1 @@
+
@@ -140,0 +140,1 @@
+
@@ -154,0 +154,1 @@
+
@@ -167,0 +167,1 @@
+
@@ -180,0 +180,1 @@
+
@@ -193,0 +193,1 @@
+}
```

### VariantChangeTests.CreateEntryPair

method · +6 -0

```diff
@@ -9,0 +9,6 @@
+    private async Task<(Entry variantEntry, Entry mainEntry)> CreateEntryPair()
+    {
+        var variantEntry = await fixture.Api.CreateEntry(new() { LexemeForm = { { "en", "colour" } }, });
+        var mainEntry = await fixture.Api.CreateEntry(new() { LexemeForm = { { "en", "color" } }, });
+        return (variantEntry, mainEntry);
+    }
```

## backend/FwLite/LcmCrdt.Tests/MiniLcmTests/VariantTests.cs

### lines 2–2

other · +1 -0 · low-signal (whitespace)

```diff
@@ -2,0 +2,1 @@
+
```

### VariantTests

other · +8 -0

```diff
@@ -3,0 +3,4 @@
+public class VariantTests : VariantTestsBase
+{
+    private readonly MiniLcmApiFixture _fixture = new();
+
@@ -12,0 +12,1 @@
+
@@ -18,0 +18,1 @@
+
@@ -34,0 +34,1 @@
+
@@ -55,0 +55,1 @@
+}
```

### VariantTests.NewApi

method · +5 -0

```diff
@@ -7,0 +7,5 @@
+    protected override async Task<IMiniLcmApi> NewApi()
+    {
+        await _fixture.InitializeAsync();
+        return _fixture.Api;
+    }
```

### VariantTests.DisposeAsync

method · +5 -0

```diff
@@ -13,0 +13,5 @@
+    public override async Task DisposeAsync()
+    {
+        await base.DisposeAsync();
+        await _fixture.DisposeAsync();
+    }
```

## backend/FwLite/MiniLcm.Tests/Validators/VariantTypeValidationTests.cs

### MiniLcm.Tests.Validators

other · +1 -0

```diff
@@ -4,0 +4,1 @@
+namespace MiniLcm.Tests.Validators;
```

### VariantTypeValidationTests

other · +8 -0

```diff
@@ -6,0 +6,4 @@
+public class VariantTypeValidationTests
+{
+    private readonly VariantTypeValidator _validator = new();
+
@@ -16,0 +16,1 @@
+
@@ -23,0 +23,1 @@
+
@@ -33,0 +33,1 @@
+
@@ -44,0 +44,1 @@
+}
```

### VariantTypeValidationTests.FailsForEmptyName

method · +6 -0

```diff
@@ -10,0 +10,6 @@
+    [Fact]
+    public void FailsForEmptyName()
+    {
+        var variantType = new VariantType() { Name = new MultiString() };
+        _validator.TestValidate(variantType).ShouldHaveValidationErrorFor(c => c.Name);
+    }
```

### VariantTypeValidationTests.FailsForNameWithEmptyStringValue

method · +6 -0

```diff
@@ -17,0 +17,6 @@
+    [Fact]
+    public void FailsForNameWithEmptyStringValue()
+    {
+        var variantType = new VariantType() { Name = new() { { "en", string.Empty } } };
+        _validator.TestValidate(variantType).ShouldHaveValidationErrorFor(c => c.Name);
+    }
```

### VariantTypeValidationTests.FailsForNonNullDeletedAt

method · +9 -0

```diff
@@ -24,0 +24,9 @@
+    [Fact]
+    public void FailsForNonNullDeletedAt()
+    {
+        var variantType = new VariantType()
+        {
+            Name = new() { { "en", "test" } }, DeletedAt = DateTimeOffset.UtcNow
+        };
+        _validator.TestValidate(variantType).ShouldHaveValidationErrorFor(c => c.DeletedAt);
+    }
```

### VariantTypeValidationTests.Succeeds

method · +10 -0

```diff
@@ -34,0 +34,10 @@
+    [Fact]
+    public void Succeeds()
+    {
+        var variantType = new VariantType()
+        {
+            Name = new() { { "en", "test" } },
+            DeletedAt = null
+        };
+        _validator.TestValidate(variantType).ShouldNotHaveAnyValidationErrors();
+    }
```

## backend/FwLite/MiniLcm.Tests/Validators/VariantValidationTests.cs

### MiniLcm.Tests.Validators

other · +1 -0

```diff
@@ -4,0 +4,1 @@
+namespace MiniLcm.Tests.Validators;
```

### VariantValidationTests

other · +11 -0

```diff
@@ -6,0 +6,4 @@
+public class VariantValidationTests
+{
+    private readonly VariantValidator _validator = new();
+
@@ -19,0 +19,1 @@
+
@@ -25,0 +25,1 @@
+
@@ -32,0 +32,1 @@
+
@@ -40,0 +40,1 @@
+
@@ -48,0 +48,1 @@
+
@@ -56,0 +56,1 @@
+
@@ -64,0 +64,1 @@
+}
```

### VariantValidationTests.NewVariant

method · +9 -0

```diff
@@ -10,0 +10,9 @@
+    private static Variant NewVariant()
+    {
+        return new Variant
+        {
+            Id = Guid.NewGuid(),
+            VariantEntryId = Guid.NewGuid(),
+            MainEntryId = Guid.NewGuid(),
+        };
+    }
```

### VariantValidationTests.Succeeds

method · +5 -0

```diff
@@ -20,0 +20,5 @@
+    [Fact]
+    public void Succeeds()
+    {
+        _validator.TestValidate(NewVariant()).ShouldNotHaveAnyValidationErrors();
+    }
```

### VariantValidationTests.FailsForNonNullDeletedAt

method · +6 -0

```diff
@@ -26,0 +26,6 @@
+    [Fact]
+    public void FailsForNonNullDeletedAt()
+    {
+        var variant = NewVariant() with { DeletedAt = DateTimeOffset.UtcNow };
+        _validator.TestValidate(variant).ShouldHaveValidationErrorFor(v => v.DeletedAt);
+    }
```

### VariantValidationTests.FailsForSelfReference

method · +7 -0

```diff
@@ -33,0 +33,7 @@
+    [Fact]
+    public void FailsForSelfReference()
+    {
+        var id = Guid.NewGuid();
+        var variant = NewVariant() with { VariantEntryId = id, MainEntryId = id };
+        _validator.TestValidate(variant).IsValid.Should().BeFalse();
+    }
```

### VariantValidationTests.SucceedsWhenVariantEntryIdIsEmpty

method · +7 -0

```diff
@@ -41,0 +41,7 @@
+    [Fact]
+    public void SucceedsWhenVariantEntryIdIsEmpty()
+    {
+        // nested in an entry the variant-entry side may be inferred from the parent
+        var variant = NewVariant() with { VariantEntryId = Guid.Empty };
+        _validator.TestValidate(variant).ShouldNotHaveAnyValidationErrors();
+    }
```

### VariantValidationTests.FailsForCommentWithEmptyStringValue

method · +7 -0

```diff
@@ -49,0 +49,7 @@
+    [Fact]
+    public void FailsForCommentWithEmptyStringValue()
+    {
+        var variant = NewVariant();
+        variant.Comment = new() { { "en", new RichString(string.Empty) } };
+        _validator.TestValidate(variant).ShouldHaveValidationErrorFor(v => v.Comment);
+    }
```

### VariantValidationTests.FailsForTypeWithEmptyName

method · +7 -0

```diff
@@ -57,0 +57,7 @@
+    [Fact]
+    public void FailsForTypeWithEmptyName()
+    {
+        var variant = NewVariant();
+        variant.Types = [new VariantType { Id = Guid.NewGuid(), Name = new MultiString() }];
+        _validator.TestValidate(variant).IsValid.Should().BeFalse();
+    }
```

## frontend/viewer/tests/entry-api-helper.ts

### EntryApiHelper.createEntryWithHeadword

method · +2 -0

```diff
@@ -103,0 +106,2 @@
+        variantOf: [],
+        variants: [],
```

## backend/FwLite/LcmCrdt/Migrations/20260703134525_AddVariants.Designer.cs

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
@@ -972,0 +972,1 @@
+}
```

### LcmCrdt.Migrations.AddVariants

other · +6 -0 · low-signal (generated)

```diff
@@ -14,0 +14,5 @@
+    [DbContext(typeof(LcmCrdtDbContext))]
+    [Migration("20260703134525_AddVariants")]
+    partial class AddVariants
+    {
+        /// <inheritdoc />
@@ -971,0 +971,1 @@
+    }
```

### LcmCrdt.Migrations.AddVariants.BuildTargetModel.fragment 1

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

### LcmCrdt.Migrations.AddVariants.BuildTargetModel.fragment 2

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

### LcmCrdt.Migrations.AddVariants.BuildTargetModel.fragment 3

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

### LcmCrdt.Migrations.AddVariants.BuildTargetModel.fragment 4

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

### LcmCrdt.Migrations.AddVariants.BuildTargetModel.fragment 5

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

### LcmCrdt.Migrations.AddVariants.BuildTargetModel.fragment 6

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

### LcmCrdt.Migrations.AddVariants.BuildTargetModel.fragment 7

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

### LcmCrdt.Migrations.AddVariants.BuildTargetModel.fragment 8

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

### LcmCrdt.Migrations.AddVariants.BuildTargetModel.fragment 9

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

### LcmCrdt.Migrations.AddVariants.BuildTargetModel.fragment 10

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

### LcmCrdt.Migrations.AddVariants.BuildTargetModel.fragment 11

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

### LcmCrdt.Migrations.AddVariants.BuildTargetModel.fragment 12

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

### LcmCrdt.Migrations.AddVariants.BuildTargetModel.fragment 13

method-fragment · +38 -0 · low-signal (generated)

```diff
@@ -478,0 +478,38 @@
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
+            modelBuilder.Entity("MiniLcm.Models.Variant", b =>
+                {
+                    b.Property<Guid>("Id")
+                        .ValueGeneratedOnAdd()
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Comment")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.Property<DateTimeOffset?>("DeletedAt")
+                        .HasColumnType("TEXT");
+
+                    b.Property<bool>("HideMinorEntry")
+                        .HasColumnType("INTEGER");
+
+                    b.Property<Guid>("MainEntryId")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("MainHeadword")
+                        .HasColumnType("TEXT");
+
+                    b.Property<Guid?>("MainSenseId")
+                        .HasColumnType("TEXT")
+                        .HasColumnName("MainSenseId");
+
```

### LcmCrdt.Migrations.AddVariants.BuildTargetModel.fragment 14

method-fragment · +39 -0 · low-signal (generated)

```diff
@@ -516,0 +516,39 @@
+                    b.Property<Guid?>("SnapshotId")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Types")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.Property<Guid>("VariantEntryId")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("VariantHeadword")
+                        .HasColumnType("TEXT");
+
+                    b.HasKey("Id");
+
+                    b.HasIndex("MainEntryId");
+
+                    b.HasIndex("MainSenseId");
+
+                    b.HasIndex("SnapshotId")
+                        .IsUnique();
+
+                    b.HasIndex("VariantEntryId", "MainEntryId")
+                        .IsUnique()
+                        .HasFilter("MainSenseId IS NULL");
+
+                    b.HasIndex("VariantEntryId", "MainEntryId", "MainSenseId")
+                        .IsUnique()
+                        .HasFilter("MainSenseId IS NOT NULL");
+
+                    b.ToTable("Variants", (string)null);
+                });
+
+            modelBuilder.Entity("MiniLcm.Models.VariantType", b =>
+                {
+                    b.Property<Guid>("Id")
+                        .ValueGeneratedOnAdd()
+                        .HasColumnType("TEXT");
+
```

### LcmCrdt.Migrations.AddVariants.BuildTargetModel.fragment 15

method-fragment · +39 -0 · low-signal (generated)

```diff
@@ -555,0 +555,39 @@
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
+                    b.ToTable("VariantType");
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
```

### LcmCrdt.Migrations.AddVariants.BuildTargetModel.fragment 16

method-fragment · +37 -0 · low-signal (generated)

```diff
@@ -594,0 +594,37 @@
+                    b.Property<string>("Name")
+                        .IsRequired()
+                        .HasColumnType("TEXT");
+
+                    b.Property<double>("Order")
+                        .HasColumnType("REAL");
+
+                    b.Property<Guid?>("SnapshotId")
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
```

### LcmCrdt.Migrations.AddVariants.BuildTargetModel.fragment 17

method-fragment · +40 -0 · low-signal (generated)

```diff
@@ -631,0 +631,40 @@
+                    b.Property<string>("Hash")
+                        .IsRequired()
+                        .HasColumnType("TEXT");
+
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
```

### LcmCrdt.Migrations.AddVariants.BuildTargetModel.fragment 18

method-fragment · +37 -0 · low-signal (generated)

```diff
@@ -671,0 +671,37 @@
+                    b.Property<string>("Change")
+                        .HasColumnType("jsonb");
+
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
```

### LcmCrdt.Migrations.AddVariants.BuildTargetModel.fragment 19

method-fragment · +38 -0 · low-signal (generated)

```diff
@@ -708,0 +708,38 @@
+                    b.Property<string>("TypeName")
+                        .IsRequired()
+                        .HasColumnType("TEXT");
+
+                    b.HasKey("Id");
+
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
```

### LcmCrdt.Migrations.AddVariants.BuildTargetModel.fragment 20

method-fragment · +39 -0 · low-signal (generated)

```diff
@@ -746,0 +746,39 @@
+                    b.Property<string>("RemoteId")
+                        .HasColumnType("TEXT");
+
+                    b.Property<Guid?>("SnapshotId")
+                        .HasColumnType("TEXT");
+
+                    b.HasKey("Id");
+
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
```

### LcmCrdt.Migrations.AddVariants.BuildTargetModel.fragment 21

method-fragment · +38 -0 · low-signal (generated)

```diff
@@ -785,0 +785,38 @@
+            modelBuilder.Entity("MiniLcm.Models.ComplexFormType", b =>
+                {
+                    b.HasOne("SIL.Harmony.Db.ObjectSnapshot", null)
+                        .WithOne()
+                        .HasForeignKey("MiniLcm.Models.ComplexFormType", "SnapshotId")
+                        .OnDelete(DeleteBehavior.SetNull);
+                });
+
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
```

### LcmCrdt.Migrations.AddVariants.BuildTargetModel.fragment 22

method-fragment · +40 -0 · low-signal (generated)

```diff
@@ -823,0 +823,40 @@
+            modelBuilder.Entity("MiniLcm.Models.MorphType", b =>
+                {
+                    b.HasOne("SIL.Harmony.Db.ObjectSnapshot", null)
+                        .WithOne()
+                        .HasForeignKey("MiniLcm.Models.MorphType", "SnapshotId")
+                        .OnDelete(DeleteBehavior.SetNull);
+                });
+
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
```

### LcmCrdt.Migrations.AddVariants.BuildTargetModel.fragment 23

method-fragment · +38 -0 · low-signal (generated)

```diff
@@ -863,0 +863,38 @@
+                    b.HasOne("MiniLcm.Models.PartOfSpeech", "PartOfSpeech")
+                        .WithMany()
+                        .HasForeignKey("PartOfSpeechId")
+                        .OnDelete(DeleteBehavior.SetNull);
+
+                    b.HasOne("SIL.Harmony.Db.ObjectSnapshot", null)
+                        .WithOne()
+                        .HasForeignKey("MiniLcm.Models.Sense", "SnapshotId")
+                        .OnDelete(DeleteBehavior.SetNull);
+
+                    b.Navigation("PartOfSpeech");
+                });
+
+            modelBuilder.Entity("MiniLcm.Models.Variant", b =>
+                {
+                    b.HasOne("MiniLcm.Models.Entry", null)
+                        .WithMany("Variants")
+                        .HasForeignKey("MainEntryId")
+                        .OnDelete(DeleteBehavior.Cascade)
+                        .IsRequired();
+
+                    b.HasOne("MiniLcm.Models.Sense", null)
+                        .WithMany()
+                        .HasForeignKey("MainSenseId")
+                        .OnDelete(DeleteBehavior.Cascade);
+
+                    b.HasOne("SIL.Harmony.Db.ObjectSnapshot", null)
+                        .WithOne()
+                        .HasForeignKey("MiniLcm.Models.Variant", "SnapshotId")
+                        .OnDelete(DeleteBehavior.SetNull);
+
+                    b.HasOne("MiniLcm.Models.Entry", null)
+                        .WithMany("VariantOf")
+                        .HasForeignKey("VariantEntryId")
+                        .OnDelete(DeleteBehavior.Cascade)
+                        .IsRequired();
+                });
+
```

### LcmCrdt.Migrations.AddVariants.BuildTargetModel.fragment 24

method-fragment · +36 -0 · low-signal (generated)

```diff
@@ -901,0 +901,36 @@
+            modelBuilder.Entity("MiniLcm.Models.VariantType", b =>
+                {
+                    b.HasOne("SIL.Harmony.Db.ObjectSnapshot", null)
+                        .WithOne()
+                        .HasForeignKey("MiniLcm.Models.VariantType", "SnapshotId")
+                        .OnDelete(DeleteBehavior.SetNull);
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

### LcmCrdt.Migrations.AddVariants.BuildTargetModel.fragment 25

method-fragment · +34 -0 · low-signal (generated)

```diff
@@ -937,0 +937,34 @@
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
+
+                    b.Navigation("VariantOf");
+
+                    b.Navigation("Variants");
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

### LcmCrdt.Migrations.LcmCrdtDbContextModelSnapshot.BuildModel.fragment 1

method-fragment · +39 -0 · low-signal (migration snapshot)

```diff
@@ -486,0 +487,39 @@
+            modelBuilder.Entity("MiniLcm.Models.Variant", b =>
+                {
+                    b.Property<Guid>("Id")
+                        .ValueGeneratedOnAdd()
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Comment")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.Property<DateTimeOffset?>("DeletedAt")
+                        .HasColumnType("TEXT");
+
+                    b.Property<bool>("HideMinorEntry")
+                        .HasColumnType("INTEGER");
+
+                    b.Property<Guid>("MainEntryId")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("MainHeadword")
+                        .HasColumnType("TEXT");
+
+                    b.Property<Guid?>("MainSenseId")
+                        .HasColumnType("TEXT")
+                        .HasColumnName("MainSenseId");
+
+                    b.Property<Guid?>("SnapshotId")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("Types")
+                        .IsRequired()
+                        .HasColumnType("jsonb");
+
+                    b.Property<Guid>("VariantEntryId")
+                        .HasColumnType("TEXT");
+
+                    b.Property<string>("VariantHeadword")
+                        .HasColumnType("TEXT");
+
```

### LcmCrdt.Migrations.LcmCrdtDbContextModelSnapshot.BuildModel.fragment 2

method-fragment · +38 -0 · low-signal (migration snapshot)

```diff
@@ -526,0 +526,38 @@
+                    b.HasKey("Id");
+
+                    b.HasIndex("MainEntryId");
+
+                    b.HasIndex("MainSenseId");
+
+                    b.HasIndex("SnapshotId")
+                        .IsUnique();
+
+                    b.HasIndex("VariantEntryId", "MainEntryId")
+                        .IsUnique()
+                        .HasFilter("MainSenseId IS NULL");
+
+                    b.HasIndex("VariantEntryId", "MainEntryId", "MainSenseId")
+                        .IsUnique()
+                        .HasFilter("MainSenseId IS NOT NULL");
+
+                    b.ToTable("Variants", (string)null);
+                });
+
+            modelBuilder.Entity("MiniLcm.Models.VariantType", b =>
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
```

### LcmCrdt.Migrations.LcmCrdtDbContextModelSnapshot.BuildModel.fragment 3

method-fragment · +39 -0 · low-signal (migration snapshot)

```diff
@@ -564,0 +564,6 @@
+                    b.HasIndex("SnapshotId")
+                        .IsUnique();
+
+                    b.ToTable("VariantType");
+                });
+
@@ -789,0 +873,33 @@
+            modelBuilder.Entity("MiniLcm.Models.Variant", b =>
+                {
+                    b.HasOne("MiniLcm.Models.Entry", null)
+                        .WithMany("Variants")
+                        .HasForeignKey("MainEntryId")
+                        .OnDelete(DeleteBehavior.Cascade)
+                        .IsRequired();
+
+                    b.HasOne("MiniLcm.Models.Sense", null)
+                        .WithMany()
+                        .HasForeignKey("MainSenseId")
+                        .OnDelete(DeleteBehavior.Cascade);
+
+                    b.HasOne("SIL.Harmony.Db.ObjectSnapshot", null)
+                        .WithOne()
+                        .HasForeignKey("MiniLcm.Models.Variant", "SnapshotId")
+                        .OnDelete(DeleteBehavior.SetNull);
+
+                    b.HasOne("MiniLcm.Models.Entry", null)
+                        .WithMany("VariantOf")
+                        .HasForeignKey("VariantEntryId")
+                        .OnDelete(DeleteBehavior.Cascade)
+                        .IsRequired();
+                });
+
+            modelBuilder.Entity("MiniLcm.Models.VariantType", b =>
+                {
+                    b.HasOne("SIL.Harmony.Db.ObjectSnapshot", null)
+                        .WithOne()
+                        .HasForeignKey("MiniLcm.Models.VariantType", "SnapshotId")
+                        .OnDelete(DeleteBehavior.SetNull);
+                });
+
```

### LcmCrdt.Migrations.LcmCrdtDbContextModelSnapshot.BuildModel.fragment 4

method-fragment · +4 -0 · low-signal (migration snapshot)

```diff
@@ -832,0 +949,4 @@
+
+                    b.Navigation("VariantOf");
+
+                    b.Navigation("Variants");
```

## frontend/viewer/src/lib/dotnet-types/generated-types/FwLiteShared/Services/IMiniLcmJsInvokable.ts

### lines 22–23

other · +2 -0 · low-signal (generated)

```diff
@@ -21,0 +22,2 @@
+import type {IVariantType} from '../../MiniLcm/Models/IVariantType';
+import type {IVariant} from '../../MiniLcm/Models/IVariant';
```

### IMiniLcmJsInvokable

other · +6 -0 · low-signal (generated)

```diff
@@ -69,0 +72,6 @@
+	getVariantTypes() : Promise<IVariantType[]>;
+	getVariantType(id: string) : Promise<IVariantType | null>;
+	createVariant(variant: IVariant) : Promise<IVariant>;
+	deleteVariant(variant: IVariant) : Promise<void>;
+	addVariantType(variant: IVariant, variantTypeId: string) : Promise<void>;
+	removeVariantType(variant: IVariant, variantTypeId: string) : Promise<void>;
```

## frontend/viewer/src/lib/dotnet-types/generated-types/MiniLcm/Models/IEntry.ts

### lines 13–13

other · +1 -0 · low-signal (generated)

```diff
@@ -12,0 +13,1 @@
+import type {IVariant} from './IVariant';
```

### IEntry

other · +2 -0 · low-signal (generated)

```diff
@@ -28,0 +30,2 @@
+	variantOf: IVariant[];
+	variants: IVariant[];
```

## frontend/viewer/src/lib/dotnet-types/generated-types/MiniLcm/Models/IVariant.ts

### lines 1–22

other · +10 -0 · low-signal (generated)

```diff
@@ -0,0 +1,9 @@
+/* eslint-disable */
+//     This code was generated by a Reinforced.Typings tool.
+//     Changes to this file may cause incorrect behavior and will be lost if
+//     the code is regenerated.
+
+import type {IObjectWithId} from './IObjectWithId';
+import type {IVariantType} from './IVariantType';
+import type {IRichMultiString} from '$lib/dotnet-types/i-multi-string';
+
@@ -22,0 +22,1 @@
+/* eslint-enable */
```

### IVariant

other · +12 -0 · low-signal (generated)

```diff
@@ -10,0 +10,12 @@
+export interface IVariant extends IObjectWithId
+{
+	deletedAt?: string;
+	variantEntryId: string;
+	variantHeadword?: string;
+	mainEntryId: string;
+	mainSenseId?: string;
+	mainHeadword?: string;
+	types: IVariantType[];
+	hideMinorEntry: boolean;
+	comment: IRichMultiString;
+}
```

## frontend/viewer/src/lib/dotnet-types/generated-types/MiniLcm/Models/IVariantType.ts

### lines 1–15

other · +9 -0 · low-signal (generated)

```diff
@@ -0,0 +1,8 @@
+/* eslint-disable */
+//     This code was generated by a Reinforced.Typings tool.
+//     Changes to this file may cause incorrect behavior and will be lost if
+//     the code is regenerated.
+
+import type {IObjectWithId} from './IObjectWithId';
+import type {IMultiString} from '$lib/dotnet-types/i-multi-string';
+
@@ -15,0 +15,1 @@
+/* eslint-enable */
```

### IVariantType

other · +6 -0 · low-signal (generated)

```diff
@@ -9,0 +9,6 @@
+export interface IVariantType extends IObjectWithId
+{
+	id: string;
+	name: IMultiString;
+	deletedAt?: string;
+}
```
