# Audit cards — PR 2379 (Ensure headwords are set on complex form components — C#-only)

Range `8dd70ba~1..8dd70ba` · head `8dd70ba171e1` · seed `2321623504`.
`calls` edges in graph: **11** · sampled: **11** (cap 30).
> Fewer than 30 `calls` edges — **all** of them are sampled.

Each card: caller chunk + the call-site line(s), then the callee chunk + its first defining lines. No labels here.

## 2379-e01 _(in Tim subsample)_

**Caller:** `backend/FwLite/LcmCrdt/LcmCrdtKernel.cs :: LcmCrdtKernel.ConfigureDbOptions`
chunk id: `backend/FwLite/LcmCrdt/LcmCrdtKernel.cs::LcmCrdtKernel.ConfigureDbOptions::8tas18`
call site (L138):
```
  138                      .Entity<Entry>().Association(e => e.QueryMorphType(), e => e.MorphType, m => m!.Kind)
```
**Callee:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.QueryMorphType`
chunk id: `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs::EntryQueryHelpers.QueryMorphType::a1u31y`
defining lines (first 10):
```
   41      public static MorphType? QueryMorphType(this Entry e) => throw new NotSupportedException();
```

## 2379-e02 _(in Tim subsample)_

**Caller:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.QueryHeadwordWithTokensExpression`
chunk id: `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs::EntryQueryHelpers.QueryHeadwordWithTokensExpression::68ldhb`
call site (L60):
```
   60          (e, ws) => e.HeadwordWithTokens(ws, e.QueryMorphType());
```
**Callee:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.HeadwordWithTokens`
chunk id: `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs::EntryQueryHelpers.HeadwordWithTokens::vhxv0m`
defining lines (first 10):
```
   62      [ExpressionMethod(nameof(HeadwordFromMorphTypeExpression))]
   63      public static string HeadwordWithTokens(this Entry e, WritingSystemId ws, MorphType? morphType)
   64      {
   65          var citation = e.CitationForm[ws]?.Trim();
   66          if (!string.IsNullOrEmpty(citation)) return citation;
   67          var lexeme = e.LexemeForm[ws]?.Trim();
   68          if (string.IsNullOrEmpty(lexeme)) return string.Empty;
   69          return ((morphType?.Prefix ?? "") + lexeme + (morphType?.Postfix ?? "")).Trim();
   70      }
```

## 2379-e03 _(in Tim subsample)_

**Caller:** `backend/FwLite/LcmCrdt/LcmCrdtKernel.cs :: LcmCrdtKernel.ConfigureDbOptions`
chunk id: `backend/FwLite/LcmCrdt/LcmCrdtKernel.cs::LcmCrdtKernel.ConfigureDbOptions::8tas18`
call site (L141):
```
  141                      .Entity<ComplexFormComponent>().Association(c => EntryQueryHelpers.QueryComplexFormEntry(c), c => c.ComplexFormEntryId, e => e!.Id)
```
**Callee:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.QueryComplexFormEntry`
chunk id: `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs::EntryQueryHelpers.QueryComplexFormEntry::g3cf63`
defining lines (first 10):
```
   44      public static Entry? QueryComplexFormEntry(ComplexFormComponent c) => throw new NotSupportedException();
```

## 2379-e04 _(in Tim subsample)_

**Caller:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.QueryHeadwordWithTokensExpression`
chunk id: `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs::EntryQueryHelpers.QueryHeadwordWithTokensExpression::68ldhb`
call site (L60):
```
   60          (e, ws) => e.HeadwordWithTokens(ws, e.QueryMorphType());
```
**Callee:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.QueryMorphType`
chunk id: `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs::EntryQueryHelpers.QueryMorphType::a1u31y`
defining lines (first 10):
```
   41      public static MorphType? QueryMorphType(this Entry e) => throw new NotSupportedException();
```

## 2379-e05 _(in Tim subsample)_

**Caller:** `backend/FwLite/LcmCrdt/LcmCrdtKernel.cs :: LcmCrdtKernel.ConfigureDbOptions`
chunk id: `backend/FwLite/LcmCrdt/LcmCrdtKernel.cs::LcmCrdtKernel.ConfigureDbOptions::8tas18`
call site (L140):
```
  140                      .Entity<ComplexFormComponent>().Association(c => EntryQueryHelpers.QueryComponentSense(c), c => c.ComponentSenseId, s => s!.Id)
```
**Callee:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.QueryComponentSense`
chunk id: `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs::EntryQueryHelpers.QueryComponentSense::1fdpwkk`
defining lines (first 10):
```
   43      public static Sense? QueryComponentSense(ComplexFormComponent c) => throw new NotSupportedException();
```

## 2379-e06 _(in Tim subsample)_

**Caller:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.HeadwordFromMorphTypeExpression`
chunk id: `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs::EntryQueryHelpers.HeadwordFromMorphTypeExpression::1xth6zl`
call site (L73):
```
   73          (e, ws, morphType) => e.HeadwordWithTokens(ws, morphType!.Prefix, morphType!.Postfix);
```
**Callee:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.HeadwordWithTokens`
chunk id: `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs::EntryQueryHelpers.HeadwordWithTokens::vhxv0m`
defining lines (first 10):
```
   62      [ExpressionMethod(nameof(HeadwordFromMorphTypeExpression))]
   63      public static string HeadwordWithTokens(this Entry e, WritingSystemId ws, MorphType? morphType)
   64      {
   65          var citation = e.CitationForm[ws]?.Trim();
   66          if (!string.IsNullOrEmpty(citation)) return citation;
   67          var lexeme = e.LexemeForm[ws]?.Trim();
   68          if (string.IsNullOrEmpty(lexeme)) return string.Empty;
   69          return ((morphType?.Prefix ?? "") + lexeme + (morphType?.Postfix ?? "")).Trim();
   70      }
```

## 2379-e07 _(in Tim subsample)_

**Caller:** `backend/FwLite/LcmCrdt/LcmCrdtKernel.cs :: LcmCrdtKernel.ConfigureDbOptions`
chunk id: `backend/FwLite/LcmCrdt/LcmCrdtKernel.cs::LcmCrdtKernel.ConfigureDbOptions::8tas18`
call site (L142):
```
  142                      .Entity<ComplexFormComponent>().Property(c => c.ComponentHeadword).IsExpression(c => EntryQueryHelpers.QueryComponentEntry(c)!.QueryHeadwordWithTokens(EntryQueryHelpers.DefaultWritingSystem(WritingSystemType.Vernacular)), isColumn: true, alias: "componentHeadword")
```
**Callee:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.QueryHeadwordWithTokens`
chunk id: `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs::EntryQueryHelpers.QueryHeadwordWithTokens::15olqyt`
defining lines (first 10):
```
   56      [ExpressionMethod(nameof(QueryHeadwordWithTokensExpression))]
   57      public static string QueryHeadwordWithTokens(this Entry e, WritingSystemId ws) => throw new NotSupportedException();
```

## 2379-e08 _(in Tim subsample)_

**Caller:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.HeadwordWithTokensExpression`
chunk id: `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs::EntryQueryHelpers.HeadwordWithTokensExpression::1m01lag`
call site (L87):
```
   87              Sql.Ext.SQLite().NullIf(Json.Value(e.CitationForm, ms => ms[ws])!.Trim(), "")
```
**Callee:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.NullIf`
chunk id: `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs::EntryQueryHelpers.NullIf::m4r93a`
defining lines (first 10):
```
   37      [Sql.Function("nullif", ServerSideOnly = true, ArgIndices = [1, 2])]
   38      public static T? NullIf<T>(this ISQLiteExtensions? ext, T? value, T? other) =>
   39          (value is null && other is null) || value?.Equals(other) == true ? default : value;
```

## 2379-e09 _(in Tim subsample)_

**Caller:** `backend/FwLite/LcmCrdt/LcmCrdtKernel.cs :: LcmCrdtKernel.ConfigureDbOptions`
chunk id: `backend/FwLite/LcmCrdt/LcmCrdtKernel.cs::LcmCrdtKernel.ConfigureDbOptions::8tas18`
call site (L139):
```
  139                      .Entity<ComplexFormComponent>().Association(c => EntryQueryHelpers.QueryComponentEntry(c), c => c.ComponentEntryId, e => e!.Id)
```
**Callee:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.QueryComponentEntry`
chunk id: `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs::EntryQueryHelpers.QueryComponentEntry::145d25g`
defining lines (first 10):
```
   42      public static Entry? QueryComponentEntry(ComplexFormComponent c) => throw new NotSupportedException();
```

## 2379-e10 _(in Tim subsample)_

**Caller:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.HeadwordWithTokensExpression`
chunk id: `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs::EntryQueryHelpers.HeadwordWithTokensExpression::1m01lag`
call site (L91):
```
   91              ?? Sql.Ext.SQLite().ConcatWs(Sql.Ext.SQLite().NullIf(Json.Value(e.LexemeForm, ms => ms[ws])!.Trim(), ""), leading ?? " ", trailing ?? " ")!.Trim();
```
**Callee:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.ConcatWs`
chunk id: `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs::EntryQueryHelpers.ConcatWs::kkoz05`
defining lines (first 10):
```
   26      [Sql.Function("concat_ws", ServerSideOnly = true, ArgIndices = [1, 2, 3])]
   27      public static string? ConcatWs(this ISQLiteExtensions? ext, string? sep, string? val1, string? val2)
   28      {
   29          if (sep is null) return null;
   30          return string.Join(sep, val1, val2);
   31      }
```

## 2379-e11 _(in Tim subsample)_

**Caller:** `backend/FwLite/LcmCrdt/LcmCrdtKernel.cs :: LcmCrdtKernel.ConfigureDbOptions`
chunk id: `backend/FwLite/LcmCrdt/LcmCrdtKernel.cs::LcmCrdtKernel.ConfigureDbOptions::8tas18`
call site (L142):
```
  142                      .Entity<ComplexFormComponent>().Property(c => c.ComponentHeadword).IsExpression(c => EntryQueryHelpers.QueryComponentEntry(c)!.QueryHeadwordWithTokens(EntryQueryHelpers.DefaultWritingSystem(WritingSystemType.Vernacular)), isColumn: true, alias: "componentHeadword")
```
**Callee:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.DefaultWritingSystem`
chunk id: `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs::EntryQueryHelpers.DefaultWritingSystem::1d29gl0`
defining lines (first 10):
```
   46      [Sql.Expression("""
   47                      (select WsId
   48                      from WritingSystem
   49                      where Type = {0}
   50                      order by "Order", Id
   51                      limit 1)
   52                      """,
   53          ServerSideOnly = true)]
   54      public static WritingSystemId DefaultWritingSystem(WritingSystemType type) => throw new NotSupportedException();
```
