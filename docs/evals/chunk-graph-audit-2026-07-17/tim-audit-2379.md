# Tim's blind edge audit — PR 2379

**What this is.** Each card below is one `calls` edge the tool drew between two code chunks:
a caller (with the exact line where the call sits) and the callee it thinks that call lands in.

**Your job.** For each card, decide whether that link would genuinely help a reviewer —
would you want a one-key jump between these two chunks? Tick one box per card:

- **RELEVANT** — the link is real and useful; the caller really uses the callee.
- **IRRELEVANT** — noise or wrong: the callee is not what that call actually resolves to,
  or the link is too trivial to be worth an affordance.

Go with your gut on a quick glance — that is the reviewer experience we are testing.
Please don't open the sealed Claude-labels file until your ticks here are committed.

## 2379-e01

**Caller:** `backend/FwLite/LcmCrdt/LcmCrdtKernel.cs :: LcmCrdtKernel.ConfigureDbOptions`
call site (L138):
```
  138                      .Entity<Entry>().Association(e => e.QueryMorphType(), e => e.MorphType, m => m!.Kind)
```
**Callee:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.QueryMorphType`
defining lines (first 10):
```
   41      public static MorphType? QueryMorphType(this Entry e) => throw new NotSupportedException();
```
- [ ] RELEVANT
- [ ] IRRELEVANT

## 2379-e02

**Caller:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.QueryHeadwordWithTokensExpression`
call site (L60):
```
   60          (e, ws) => e.HeadwordWithTokens(ws, e.QueryMorphType());
```
**Callee:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.HeadwordWithTokens`
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
- [ ] RELEVANT
- [ ] IRRELEVANT

## 2379-e03

**Caller:** `backend/FwLite/LcmCrdt/LcmCrdtKernel.cs :: LcmCrdtKernel.ConfigureDbOptions`
call site (L141):
```
  141                      .Entity<ComplexFormComponent>().Association(c => EntryQueryHelpers.QueryComplexFormEntry(c), c => c.ComplexFormEntryId, e => e!.Id)
```
**Callee:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.QueryComplexFormEntry`
defining lines (first 10):
```
   44      public static Entry? QueryComplexFormEntry(ComplexFormComponent c) => throw new NotSupportedException();
```
- [ ] RELEVANT
- [ ] IRRELEVANT

## 2379-e04

**Caller:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.QueryHeadwordWithTokensExpression`
call site (L60):
```
   60          (e, ws) => e.HeadwordWithTokens(ws, e.QueryMorphType());
```
**Callee:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.QueryMorphType`
defining lines (first 10):
```
   41      public static MorphType? QueryMorphType(this Entry e) => throw new NotSupportedException();
```
- [ ] RELEVANT
- [ ] IRRELEVANT

## 2379-e05

**Caller:** `backend/FwLite/LcmCrdt/LcmCrdtKernel.cs :: LcmCrdtKernel.ConfigureDbOptions`
call site (L140):
```
  140                      .Entity<ComplexFormComponent>().Association(c => EntryQueryHelpers.QueryComponentSense(c), c => c.ComponentSenseId, s => s!.Id)
```
**Callee:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.QueryComponentSense`
defining lines (first 10):
```
   43      public static Sense? QueryComponentSense(ComplexFormComponent c) => throw new NotSupportedException();
```
- [ ] RELEVANT
- [ ] IRRELEVANT

## 2379-e06

**Caller:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.HeadwordFromMorphTypeExpression`
call site (L73):
```
   73          (e, ws, morphType) => e.HeadwordWithTokens(ws, morphType!.Prefix, morphType!.Postfix);
```
**Callee:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.HeadwordWithTokens`
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
- [ ] RELEVANT
- [ ] IRRELEVANT

## 2379-e07

**Caller:** `backend/FwLite/LcmCrdt/LcmCrdtKernel.cs :: LcmCrdtKernel.ConfigureDbOptions`
call site (L142):
```
  142                      .Entity<ComplexFormComponent>().Property(c => c.ComponentHeadword).IsExpression(c => EntryQueryHelpers.QueryComponentEntry(c)!.QueryHeadwordWithTokens(EntryQueryHelpers.DefaultWritingSystem(WritingSystemType.Vernacular)), isColumn: true, alias: "componentHeadword")
```
**Callee:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.QueryHeadwordWithTokens`
defining lines (first 10):
```
   56      [ExpressionMethod(nameof(QueryHeadwordWithTokensExpression))]
   57      public static string QueryHeadwordWithTokens(this Entry e, WritingSystemId ws) => throw new NotSupportedException();
```
- [ ] RELEVANT
- [ ] IRRELEVANT

## 2379-e08

**Caller:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.HeadwordWithTokensExpression`
call site (L87):
```
   87              Sql.Ext.SQLite().NullIf(Json.Value(e.CitationForm, ms => ms[ws])!.Trim(), "")
```
**Callee:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.NullIf`
defining lines (first 10):
```
   37      [Sql.Function("nullif", ServerSideOnly = true, ArgIndices = [1, 2])]
   38      public static T? NullIf<T>(this ISQLiteExtensions? ext, T? value, T? other) =>
   39          (value is null && other is null) || value?.Equals(other) == true ? default : value;
```
- [ ] RELEVANT
- [ ] IRRELEVANT

## 2379-e09

**Caller:** `backend/FwLite/LcmCrdt/LcmCrdtKernel.cs :: LcmCrdtKernel.ConfigureDbOptions`
call site (L139):
```
  139                      .Entity<ComplexFormComponent>().Association(c => EntryQueryHelpers.QueryComponentEntry(c), c => c.ComponentEntryId, e => e!.Id)
```
**Callee:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.QueryComponentEntry`
defining lines (first 10):
```
   42      public static Entry? QueryComponentEntry(ComplexFormComponent c) => throw new NotSupportedException();
```
- [ ] RELEVANT
- [ ] IRRELEVANT

## 2379-e10

**Caller:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.HeadwordWithTokensExpression`
call site (L91):
```
   91              ?? Sql.Ext.SQLite().ConcatWs(Sql.Ext.SQLite().NullIf(Json.Value(e.LexemeForm, ms => ms[ws])!.Trim(), ""), leading ?? " ", trailing ?? " ")!.Trim();
```
**Callee:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.ConcatWs`
defining lines (first 10):
```
   26      [Sql.Function("concat_ws", ServerSideOnly = true, ArgIndices = [1, 2, 3])]
   27      public static string? ConcatWs(this ISQLiteExtensions? ext, string? sep, string? val1, string? val2)
   28      {
   29          if (sep is null) return null;
   30          return string.Join(sep, val1, val2);
   31      }
```
- [ ] RELEVANT
- [ ] IRRELEVANT

## 2379-e11

**Caller:** `backend/FwLite/LcmCrdt/LcmCrdtKernel.cs :: LcmCrdtKernel.ConfigureDbOptions`
call site (L142):
```
  142                      .Entity<ComplexFormComponent>().Property(c => c.ComponentHeadword).IsExpression(c => EntryQueryHelpers.QueryComponentEntry(c)!.QueryHeadwordWithTokens(EntryQueryHelpers.DefaultWritingSystem(WritingSystemType.Vernacular)), isColumn: true, alias: "componentHeadword")
```
**Callee:** `backend/FwLite/LcmCrdt/Data/EntryQueryHelpers.cs :: EntryQueryHelpers.DefaultWritingSystem`
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
- [ ] RELEVANT
- [ ] IRRELEVANT
