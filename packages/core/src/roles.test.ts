import { describe, expect, it } from 'vitest';
import { type ImportGraph } from './import-graph.js';
import { type ChangeType, type Chunk } from './model.js';
import { fileRoles, isTestPath } from './roles.js';

function chunk(file: string, changeTypes: ChangeType[] = []): Chunk {
  return {
    id: `${file}::${Math.random()}`,
    file,
    symbolPath: [],
    displayPath: ['c'],
    kind: 'other',
    changeTypes,
    hunks: [{ baseStart: 1, baseCount: 1, headStart: 1, headCount: 1 }],
    headRange: { start: 1, end: 1 },
  };
}

function graph(...edges: [string, string][]): ImportGraph {
  return { edges: edges.map(([from, to]) => ({ from, to })), unresolved: 0 };
}

describe('isTestPath', () => {
  it.each([
    'src/foo.test.ts',
    'src/foo.spec.tsx',
    'backend/HistoryServiceActivityTests.cs',
    'backend/UserTest.cs',
    'test/helpers.ts',
    'src/tests/helpers.ts',
    'src/__tests__/foo.ts',
  ])('matches %s', (path) => {
    expect(isTestPath(path)).toBe(true);
  });

  it.each(['src/foo.ts', 'src/latest/foo.ts', 'src/attests.cs', 'src/test.ts'])('rejects %s', (path) => {
    expect(isTestPath(path)).toBe(false);
  });
});

describe('fileRoles', () => {
  it('defaults connected non-test files to impl', () => {
    const roles = fileRoles(['a.ts', 'b.ts'], [chunk('a.ts'), chunk('b.ts')], graph(['a.ts', 'b.ts']));
    expect(roles.get('a.ts')).toBe('impl');
    expect(roles.get('b.ts')).toBe('impl');
  });

  it('marks files with no edge in either direction as periphery', () => {
    const roles = fileRoles(['a.ts', 'b.ts', 'lonely.ts'], [chunk('lonely.ts')], graph(['a.ts', 'b.ts']));
    expect(roles.get('lonely.ts')).toBe('periphery');
  });

  it('marks test paths as test', () => {
    const roles = fileRoles(['a.test.ts'], [chunk('a.test.ts')], graph());
    expect(roles.get('a.test.ts')).toBe('test');
  });

  it('marks files whose every chunk is low-signal as low-signal', () => {
    const chunks = [chunk('gen.ts', ['generated']), chunk('gen.ts', ['whitespace'])];
    expect(fileRoles(['gen.ts'], chunks, graph()).get('gen.ts')).toBe('low-signal');
  });

  it('keeps files with any high-signal chunk out of low-signal', () => {
    const chunks = [chunk('mixed.ts', ['generated']), chunk('mixed.ts')];
    expect(fileRoles(['mixed.ts'], chunks, graph()).get('mixed.ts')).toBe('periphery');
  });

  it('does not treat chunkless files as low-signal', () => {
    expect(fileRoles(['empty.ts'], [], graph()).get('empty.ts')).toBe('periphery');
  });

  it('low-signal wins over test', () => {
    const chunks = [chunk('a.test.ts', ['generated'])];
    expect(fileRoles(['a.test.ts'], chunks, graph()).get('a.test.ts')).toBe('low-signal');
  });

  it('test wins over periphery', () => {
    const roles = fileRoles(['unconnected.spec.ts'], [chunk('unconnected.spec.ts')], graph());
    expect(roles.get('unconnected.spec.ts')).toBe('test');
  });

  it('low-signal wins over impl even when connected', () => {
    const chunks = [chunk('gen.ts', ['generated']), chunk('a.ts')];
    const roles = fileRoles(['gen.ts', 'a.ts'], chunks, graph(['a.ts', 'gen.ts']));
    expect(roles.get('gen.ts')).toBe('low-signal');
    expect(roles.get('a.ts')).toBe('impl');
  });

  it('test wins over impl even when connected', () => {
    const roles = fileRoles(
      ['a.ts', 'a.test.ts'],
      [chunk('a.ts'), chunk('a.test.ts')],
      graph(['a.test.ts', 'a.ts']),
    );
    expect(roles.get('a.test.ts')).toBe('test');
  });
});
