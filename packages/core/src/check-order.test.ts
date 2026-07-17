import { describe, expect, it } from 'vitest';
import { compileBook } from './book.js';
import { checkOrder } from './check-order.js';
import { type FileDiff } from './diff.js';
import { type ImportGraph } from './import-graph.js';
import { type Book, type ChangeType, type Chunk } from './model.js';

const HUNK = { baseStart: 1, baseCount: 0, headStart: 1, headCount: 2 };

function file(path: string): FileDiff {
  return { path, status: 'modified', binary: false, hunks: [HUNK] };
}

function chunk(path: string, changeTypes: ChangeType[] = []): Chunk {
  return {
    id: `${path}::x::0`,
    file: path,
    symbolPath: [],
    displayPath: [],
    kind: 'other',
    changeTypes,
    hunks: [HUNK],
    headRange: { start: 1, end: 2 },
  };
}

function bookOf(ids: string[]): Book {
  return { sections: ids.map((id) => ({ id, title: id, occurrences: [] })), headSha: 'head' };
}

function graphOf(...edges: [string, string][]): ImportGraph {
  return { edges: edges.map(([from, to]) => ({ from, to })), unresolved: 0 };
}

describe('checkOrder', () => {
  it('flags a consumer ordered before its dependency', () => {
    const report = checkOrder(bookOf(['a.ts', 'b.ts']), graphOf(['a.ts', 'b.ts']), [chunk('a.ts'), chunk('b.ts')]);
    expect(report.ok).toBe(false);
    expect(report.importInversions).toEqual([{ earlier: 'a.ts', later: 'b.ts' }]);
    expect(report.cycleInversions).toEqual([]);
    expect(report.testBeforeImpl).toEqual([]);
  });

  it('reports a 2-cycle inversion informationally without failing', () => {
    const report = checkOrder(bookOf(['a.ts', 'b.ts']), graphOf(['a.ts', 'b.ts'], ['b.ts', 'a.ts']), [
      chunk('a.ts'),
      chunk('b.ts'),
    ]);
    expect(report.ok).toBe(true);
    expect(report.importInversions).toEqual([]);
    expect(report.cycleInversions).toEqual([{ earlier: 'a.ts', later: 'b.ts' }]);
  });

  it('classifies inversions inside a 3-cycle as cycle inversions', () => {
    const report = checkOrder(
      bookOf(['a.ts', 'b.ts', 'c.ts']),
      graphOf(['a.ts', 'b.ts'], ['b.ts', 'c.ts'], ['c.ts', 'a.ts']),
      [chunk('a.ts'), chunk('b.ts'), chunk('c.ts')],
    );
    expect(report.ok).toBe(true);
    expect(report.importInversions).toEqual([]);
    expect(report.cycleInversions).toEqual([
      { earlier: 'a.ts', later: 'b.ts' },
      { earlier: 'b.ts', later: 'c.ts' },
    ]);
  });

  it('still fails an acyclic inversion when an unrelated cycle exists', () => {
    const report = checkOrder(
      bookOf(['a.ts', 'b.ts', 'c.ts', 'd.ts']),
      graphOf(['a.ts', 'b.ts'], ['b.ts', 'a.ts'], ['c.ts', 'd.ts']),
      [chunk('a.ts'), chunk('b.ts'), chunk('c.ts'), chunk('d.ts')],
    );
    expect(report.ok).toBe(false);
    expect(report.importInversions).toEqual([{ earlier: 'c.ts', later: 'd.ts' }]);
    expect(report.cycleInversions).toEqual([{ earlier: 'a.ts', later: 'b.ts' }]);
  });

  it('sends a test-impl pair in the same cycle to cycleInversions', () => {
    const report = checkOrder(bookOf(['x.test.ts', 'x.ts']), graphOf(['x.test.ts', 'x.ts'], ['x.ts', 'x.test.ts']), [
      chunk('x.test.ts'),
      chunk('x.ts'),
    ]);
    expect(report.ok).toBe(true);
    expect(report.testBeforeImpl).toEqual([]);
    expect(report.cycleInversions).toEqual([{ earlier: 'x.test.ts', later: 'x.ts' }]);
  });

  it('passes compileBook output built from the same inputs', () => {
    const files = [file('a.ts'), file('b.ts')];
    const chunks = [chunk('a.ts'), chunk('b.ts')];
    const graph = graphOf(['a.ts', 'b.ts']);
    const { book } = compileBook({ files, chunks, graph, headSha: 'head' });
    expect(book.sections.map((s) => s.id)).toEqual(['b.ts', 'a.ts']);
    expect(checkOrder(book, graph, chunks)).toMatchObject({ ok: true, importInversions: [], testBeforeImpl: [] });
  });

  it('flags a test reading before the impl it imports', () => {
    const report = checkOrder(bookOf(['x.test.ts', 'x.ts']), graphOf(['x.test.ts', 'x.ts']), [
      chunk('x.test.ts'),
      chunk('x.ts'),
    ]);
    expect(report.ok).toBe(false);
    expect(report.testBeforeImpl).toEqual([{ test: 'x.test.ts', impl: 'x.ts' }]);
    expect(report.importInversions).toEqual([]);
  });

  it('ignores the synthetic leftovers section', () => {
    const book = bookOf(['a.ts']);
    book.sections.push({ id: '(leftovers)', title: 'Leftovers', occurrences: [] });
    const report = checkOrder(book, graphOf(['a.ts', '(leftovers)']), [chunk('a.ts')]);
    expect(report).toMatchObject({ ok: true, importInversions: [] });
  });

  it('exempts edges into all-stub sections', () => {
    const report = checkOrder(bookOf(['app.ts', 'generated/types.ts']), graphOf(['app.ts', 'generated/types.ts']), [
      chunk('app.ts'),
      chunk('generated/types.ts', ['generated']),
    ]);
    expect(report).toMatchObject({ ok: true, importInversions: [] });
  });

  describe('PR-2357-shaped fixture', () => {
    const test = 'backend/Testing/ActivityTests/HistoryServiceActivityTests.cs';
    const service = 'backend/FwHeadless/Services/HistoryService.cs';
    const filter = 'frontend/src/lib/activity/ActivityFilter.svelte';
    const page = 'frontend/src/lib/activity/activity-page.svelte';
    const utils = 'frontend/src/lib/activity/utils.ts';
    const selectItem = 'frontend/src/lib/components/select-item.svelte';
    const generated = 'frontend/src/lib/generated-types/types.ts';
    const catalog = 'frontend/src/locales/de.po';
    const lockfile = 'pnpm-lock.yaml';

    const gitOrder = [test, service, filter, page, utils, selectItem, generated, catalog, lockfile];
    const files = gitOrder.map(file);
    const chunks = gitOrder.map((p) =>
      chunk(p, [generated, catalog, lockfile].includes(p) ? ['generated'] : []),
    );
    const graph = graphOf(
      [test, service],
      [filter, utils],
      [page, utils],
      [page, filter],
      [filter, generated],
    );

    it('flags both dogfood-0 inversions in naive git order', () => {
      const report = checkOrder(bookOf(gitOrder), graph, chunks);
      expect(report.ok).toBe(false);
      expect(report.testBeforeImpl).toEqual([{ test, impl: service }]);
      expect(report.importInversions).toEqual([
        { earlier: filter, later: utils },
        { earlier: page, later: utils },
      ]);
    });

    it('reports ok after compileBook', () => {
      const { book, chunks: all } = compileBook({ files, chunks, graph, headSha: 'head' });
      expect(book.sections.map((s) => s.id)).toEqual([
        service,
        test,
        utils,
        filter,
        page,
        selectItem,
        generated,
        catalog,
        lockfile,
      ]);
      expect(checkOrder(book, graph, all)).toMatchObject({ ok: true, importInversions: [], testBeforeImpl: [] });
    });
  });

  // PR-2309 (#32): the old stall fallback dragged a cycle's dependents forward by git order.
  describe('PR-2309-shaped cycle-stall fixture', () => {
    const dep = 'frontend/src/lib/ProjectFilter.svelte';
    const page = 'frontend/src/routes/admin/+page.svelte';
    const projects = 'frontend/src/lib/AdminProjects.svelte';
    const helper1 = 'frontend/src/e2e/loginPage.ts';
    const helper2 = 'frontend/src/e2e/envVars.ts';
    const e2e = 'frontend/src/e2e/adminPage.test.ts';

    // git order deliberately places the dependent before the cycle so the old fallback fails.
    const gitOrder = [dep, page, projects, helper1, helper2, e2e];
    const files = gitOrder.map(file);
    const chunks = gitOrder.map((p) => chunk(p));
    const graph = graphOf([dep, page], [page, projects], [projects, page], [e2e, helper1], [e2e, helper2]);

    it('drops the acyclic inversions, keeping only the same-cycle one', () => {
      const { book, chunks: all } = compileBook({ files, chunks, graph, headSha: 'head' });
      const report = checkOrder(book, graph, all);
      expect(report.ok).toBe(true);
      expect(report.importInversions).toEqual([]);
      expect(report.testBeforeImpl).toEqual([]);
      expect(report.cycleInversions).toEqual([{ earlier: page, later: projects }]);

      const pos = (id: string) => book.sections.findIndex((s) => s.id === id);
      expect(pos(dep)).toBeGreaterThan(pos(page)); // dependent reads after the dependency it imports
      expect(pos(helper1)).toBeLessThan(pos(e2e));
      expect(pos(helper2)).toBeLessThan(pos(e2e));
    });
  });

  // PR-2309 (#52): a test's page-object/fixture helpers are test-role too; the tests-after-impl
  // rule anchored the test by stem match but left its helpers in the unanchored tail, after it.
  describe('PR-2309-shaped test-helper fixture', () => {
    const page = 'frontend/src/routes/admin/+page.svelte';
    const service = 'frontend/src/lib/service.ts';
    const serviceTest = 'frontend/src/lib/service.test.ts';
    const e2e = 'frontend/tests/pages/adminPage.test.ts';
    const loginPage = 'frontend/tests/pages/loginPage.ts';
    const envVars = 'frontend/tests/envVars.ts';
    const dashboard = 'frontend/tests/pages/adminDashboardPage.ts';

    // git order deliberately places the test and its helpers ahead of the impl.
    const gitOrder = [e2e, loginPage, envVars, dashboard, page, service, serviceTest];
    const files = gitOrder.map(file);
    const chunks = gitOrder.map((p) => chunk(p));
    const graph = graphOf([e2e, page], [e2e, loginPage], [e2e, envVars], [e2e, dashboard], [serviceTest, service]);

    it('orders test-role helpers before the test that imports them', () => {
      const { book, chunks: all } = compileBook({ files, chunks, graph, headSha: 'head' });
      const report = checkOrder(book, graph, all);
      expect(report.ok).toBe(true);
      expect(report.importInversions).toEqual([]);
      expect(report.testBeforeImpl).toEqual([]);

      const pos = (id: string) => book.sections.findIndex((s) => s.id === id);
      expect(pos(loginPage)).toBeLessThan(pos(e2e));
      expect(pos(envVars)).toBeLessThan(pos(e2e));
      expect(pos(dashboard)).toBeLessThan(pos(e2e));
      expect(pos(service)).toBeLessThan(pos(serviceTest)); // normal impl+test anchoring still holds
    });
  });
});
