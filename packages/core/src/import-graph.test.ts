import { describe, expect, it } from 'vitest';
import { buildImportGraph, type FileImports } from './import-graph.js';

function edges(files: FileImports[]): string[] {
  return buildImportGraph(files).edges.map((e) => `${e.from} -> ${e.to}`);
}

describe('buildImportGraph — TS/Svelte', () => {
  it('resolves relative specifiers, trying extensions and index files', () => {
    const files: FileImports[] = [
      { path: 'src/a.ts', specifiers: ['./b', './sub'] },
      { path: 'src/b.ts', specifiers: [] },
      { path: 'src/sub/index.ts', specifiers: ['../b'] },
    ];
    expect(edges(files)).toEqual(['src/a.ts -> src/b.ts', 'src/a.ts -> src/sub/index.ts', 'src/sub/index.ts -> src/b.ts']);
  });

  it('matches an explicit .svelte specifier without appending an extension', () => {
    const files: FileImports[] = [
      { path: 'ui/View.svelte', specifiers: ['./Item.svelte'] },
      { path: 'ui/Item.svelte', specifiers: [] },
    ];
    expect(edges(files)).toEqual(['ui/View.svelte -> ui/Item.svelte']);
  });

  it('resolves $lib aliases by unique ≥2-segment path suffix', () => {
    const files: FileImports[] = [
      { path: 'frontend/src/lib/activity/Item.svelte', specifiers: ['$lib/services/history-service'] },
      { path: 'frontend/src/lib/services/history-service.ts', specifiers: [] },
    ];
    expect(edges(files)).toEqual(['frontend/src/lib/activity/Item.svelte -> frontend/src/lib/services/history-service.ts']);
  });

  it('drops a single-segment alias suffix rather than latch onto a same-named file', () => {
    const files: FileImports[] = [
      { path: 'src/ui/select/item.svelte', specifiers: ['$lib/utils'] },
      { path: 'src/activity/utils.ts', specifiers: [] },
    ];
    expect(buildImportGraph(files)).toEqual({ edges: [], unresolved: 1 });
  });

  it('drops an ambiguous alias suffix (two changed files match)', () => {
    const files: FileImports[] = [
      { path: 'a/shared/index.ts', specifiers: ['$lib/shared/index'] },
      { path: 'b/shared/index.ts', specifiers: [] },
    ];
    expect(edges(files)).toEqual([]);
  });

  it('counts non-relative package imports as unresolved', () => {
    const files: FileImports[] = [{ path: 'src/a.ts', specifiers: ['svelte', 'virtua/svelte', '@scope/pkg'] }];
    expect(buildImportGraph(files)).toEqual({ edges: [], unresolved: 3 });
  });

  it('never emits a self-edge', () => {
    const files: FileImports[] = [{ path: 'src/a.ts', specifiers: ['./a'] }];
    expect(edges(files)).toEqual([]);
  });
});

describe('buildImportGraph — C#', () => {
  it('edges from a using to the file declaring that namespace', () => {
    const files: FileImports[] = [
      { path: 'Routes.cs', specifiers: ['LcmCrdt', 'Microsoft.AspNetCore'], declaredNamespaces: ['App.Routes'] },
      { path: 'HistoryService.cs', specifiers: [], declaredNamespaces: ['LcmCrdt'] },
    ];
    expect(buildImportGraph(files)).toEqual({ edges: [{ from: 'Routes.cs', to: 'HistoryService.cs' }], unresolved: 1 });
  });

  it('edges from a child namespace to an ancestor namespace with no explicit using', () => {
    const files: FileImports[] = [
      { path: 'Tests.cs', specifiers: ['LcmCrdt.Changes', 'Xunit'], declaredNamespaces: ['LcmCrdt.Tests'] },
      { path: 'HistoryService.cs', specifiers: [], declaredNamespaces: ['LcmCrdt'] },
    ];
    expect(edges(files)).toEqual(['Tests.cs -> HistoryService.cs']);
  });

  it('same-namespace files get no edge', () => {
    const files: FileImports[] = [
      { path: 'A.cs', specifiers: ['LcmCrdt'], declaredNamespaces: ['LcmCrdt'] },
      { path: 'B.cs', specifiers: [], declaredNamespaces: ['LcmCrdt'] },
    ];
    expect(edges(files)).toEqual([]);
  });

  it('drops a using that no changed file declares', () => {
    const files: FileImports[] = [{ path: 'A.cs', specifiers: ['System.Text'], declaredNamespaces: ['App'] }];
    expect(buildImportGraph(files)).toEqual({ edges: [], unresolved: 1 });
  });

  it('deduplicates the using-edge and the ancestor-edge to the same file', () => {
    const files: FileImports[] = [
      { path: 'Child.cs', specifiers: ['App'], declaredNamespaces: ['App.Sub'] },
      { path: 'Parent.cs', specifiers: [], declaredNamespaces: ['App'] },
    ];
    expect(edges(files)).toEqual(['Child.cs -> Parent.cs']);
  });
});
