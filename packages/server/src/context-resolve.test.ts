import type { Chunk, ImportGraph } from '@code-story/core';
import { describe, expect, it } from 'vitest';
import { type ChangedFile, createContextResolver } from './context-resolve.js';

/** In-memory (sha, path) store so the resolver runs with real tree-sitter parsing but no git. */
function resolverOver(files: Record<string, { head?: string; base?: string }>, headSha = 'HEAD', baseSha = 'BASE') {
  return createContextResolver({
    fileAt: async (sha, filePath) => {
      const entry = files[filePath];
      const content = sha === headSha ? entry?.head : entry?.base;
      return content;
    },
    headPaths: new Set(Object.keys(files).filter((p) => files[p]!.head !== undefined)),
    headSha,
    baseSha,
  });
}

/** A modified chunk owning one head hunk over `[start, end]` of `file`. */
function chunk(id: string, file: string, start: number, end: number): Chunk {
  return {
    id,
    file,
    symbolPath: [],
    displayPath: [],
    headRange: { start, end },
    kind: 'other',
    changeTypes: [],
    hunks: [{ baseStart: start, baseCount: 0, headStart: start, headCount: end - start + 1 }],
  };
}

const noGraph: ImportGraph = { edges: [], unresolved: 0 };

describe('createContextResolver', () => {
  it('resolves a util symbol from a consuming chunk when the util is not in the diff', async () => {
    // The demo (issue #64): consumer.ts changed, util.ts unchanged — the definition of `formatName`
    // is only reachable through this panel.
    const util = `export function formatName(first: string, last: string): string {
  return \`\${last}, \${first}\`;
}
`;
    const consumer = `import { formatName } from './util';

export function greet(u: { first: string; last: string }): string {
  return 'Hi ' + formatName(u.first, u.last);
}
`;
    const resolver = resolverOver({
      'src/consumer.ts': { head: consumer, base: 'export function greet() {}\n' },
      'src/util.ts': { head: util },
    });
    const changed: ChangedFile[] = [{ path: 'src/consumer.ts', status: 'modified' }];
    const payload = await resolver.resolve(chunk('c1', 'src/consumer.ts', 3, 5), changed, noGraph);

    const def = payload.facts.definitions.find((d) => d.symbol === 'formatName');
    expect(def).toBeDefined();
    expect(def!.file).toBe('src/util.ts');
    expect(def!.changed).toBe(false);
    expect(def!.sha).toBe('HEAD');
    expect(def!.body).toContain('function formatName');
    expect(def!.lineStart).toBe(1);
  });

  it('resolves a callee defined in another changed file (changed: true)', async () => {
    const helper = `export function slugify(s: string): string {
  return s.toLowerCase();
}
`;
    const page = `import { slugify } from './helper';
export function route(name: string) {
  return slugify(name);
}
`;
    const resolver = resolverOver({
      'a/page.ts': { head: page, base: 'export function route() {}\n' },
      'a/helper.ts': { head: helper, base: 'export function slugify() {}\n' },
    });
    const changed: ChangedFile[] = [
      { path: 'a/page.ts', status: 'modified' },
      { path: 'a/helper.ts', status: 'modified' },
    ];
    const graph: ImportGraph = { edges: [{ from: 'a/page.ts', to: 'a/helper.ts' }], unresolved: 0 };
    const payload = await resolver.resolve(chunk('c1', 'a/page.ts', 3, 3), changed, graph);
    const def = payload.facts.definitions.find((d) => d.symbol === 'slugify');
    expect(def).toBeDefined();
    expect(def!.file).toBe('a/helper.ts');
    expect(def!.changed).toBe(true);
  });

  it('drops a lone cross-file match with no import edge to justify it (#91)', async () => {
    const helper = `export function slugify(s: string): string {
  return s.toLowerCase();
}
`;
    const page = `export function route(name: string) {
  return slugify(name);
}
`;
    const resolver = resolverOver({
      'a/page.ts': { head: page, base: 'export function route() {}\n' },
      'a/helper.ts': { head: helper, base: 'export function slugify() {}\n' },
    });
    const changed: ChangedFile[] = [
      { path: 'a/page.ts', status: 'modified' },
      { path: 'a/helper.ts', status: 'modified' },
    ];
    const payload = await resolver.resolve(chunk('c1', 'a/page.ts', 1, 3), changed, noGraph);
    expect(payload.facts.definitions.find((d) => d.symbol === 'slugify')).toBeUndefined();
  });

  it('disambiguates a name defined in two changed files by the import edge', async () => {
    const a = `export function build() { return 1; }\n`;
    const b = `export function build() { return 2; }\n`;
    const consumer = `import { build } from './a';
export function run() { return build(); }
`;
    const resolver = resolverOver({
      'x/consumer.ts': { head: consumer, base: 'export function run() {}\n' },
      'x/a.ts': { head: a, base: a },
      'x/b.ts': { head: b, base: b },
    });
    const changed: ChangedFile[] = [
      { path: 'x/consumer.ts', status: 'modified' },
      { path: 'x/a.ts', status: 'modified' },
      { path: 'x/b.ts', status: 'modified' },
    ];
    const graph: ImportGraph = { edges: [{ from: 'x/consumer.ts', to: 'x/a.ts' }], unresolved: 0 };
    const payload = await resolver.resolve(chunk('c1', 'x/consumer.ts', 2, 2), changed, graph);
    const def = payload.facts.definitions.find((d) => d.symbol === 'build');
    expect(def?.file).toBe('x/a.ts');
  });

  it('gives no definition when the name is ambiguous with no disambiguating edge', async () => {
    const consumer = `export function run() { return build(); }\n`;
    const resolver = resolverOver({
      'consumer.ts': { head: consumer, base: 'export function run() {}\n' },
      'a.ts': { head: 'export function build() { return 1; }\n' },
      'b.ts': { head: 'export function build() { return 2; }\n' },
    });
    const changed: ChangedFile[] = [
      { path: 'consumer.ts', status: 'modified' },
      { path: 'a.ts', status: 'modified' },
      { path: 'b.ts', status: 'modified' },
    ];
    const payload = await resolver.resolve(chunk('c1', 'consumer.ts', 1, 1), changed, noGraph);
    expect(payload.facts.definitions.find((d) => d.symbol === 'build')).toBeUndefined();
  });

  it('does not resolve a symbol the chunk itself declares (circular)', async () => {
    const file = `export function helper() { return 1; }
export function main() { return helper(); }
`;
    const resolver = resolverOver({ 'self.ts': { head: file, base: 'export function main() {}\n' } });
    // The chunk covers both lines, so `helper` is declared inside it — not called-code-you-can't-see.
    const payload = await resolver.resolve(chunk('c1', 'self.ts', 1, 2), [{ path: 'self.ts', status: 'modified' }], noGraph);
    expect(payload.facts.definitions.find((d) => d.symbol === 'helper')).toBeUndefined();
  });

  it('does not attempt unchanged-file resolution for C# (SCIP door stays closed)', async () => {
    const cs = `namespace App;
public class Svc { public void Run() { Helper.Go(); } }
`;
    const resolver = resolverOver({
      'Svc.cs': { head: cs, base: 'namespace App; public class Svc {}\n' },
      'Helper.cs': { head: 'namespace App; public static class Helper { public static void Go() {} }\n' },
    });
    const payload = await resolver.resolve(chunk('c1', 'Svc.cs', 2, 2), [{ path: 'Svc.cs', status: 'modified' }], noGraph);
    // Helper.cs is unchanged; C# has no path-specifier lookup, so Go stays unresolved.
    expect(payload.facts.definitions).toHaveLength(0);
  });

  it('caps an over-long definition body', async () => {
    const longUtil = `export function big() {\n${Array.from({ length: 100 }, (_, i) => `  const x${i} = ${i};`).join('\n')}\n}\n`;
    const consumer = `import { big } from './big';
export function run() { return big(); }
`;
    const resolver = resolverOver({
      'consumer.ts': { head: consumer, base: 'export function run() {}\n' },
      'big.ts': { head: longUtil },
    });
    const payload = await resolver.resolve(chunk('c1', 'consumer.ts', 2, 2), [{ path: 'consumer.ts', status: 'modified' }], noGraph);
    const def = payload.facts.definitions.find((d) => d.symbol === 'big');
    expect(def).toBeDefined();
    expect(def!.body).toContain('more line');
  });

  it('lifts the chunk file import edges into facts.edges', async () => {
    const resolver = resolverOver({ 'a.ts': { head: 'export const a = 1;\n', base: '' } });
    const graph: ImportGraph = {
      edges: [
        { from: 'a.ts', to: 'b.ts' },
        { from: 'c.ts', to: 'a.ts' },
      ],
      unresolved: 0,
    };
    const payload = await resolver.resolve(chunk('c1', 'a.ts', 1, 1), [{ path: 'a.ts', status: 'modified' }], graph);
    expect(payload.facts.edges.imports).toEqual(['b.ts']);
    expect(payload.facts.edges.importedBy).toEqual(['c.ts']);
  });
});
