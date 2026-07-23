import type { Chunk, ContextDefinition, ContextPayload } from '@code-story/core';
import { describe, expect, it } from 'vitest';
import {
  affordanceLabel,
  definitionSymbols,
  shouldExpandOnArrival,
  toggleInSet,
  visibleDefinitions,
} from './context-panel-logic.js';

function def(symbol: string, over: Partial<ContextDefinition> = {}): ContextDefinition {
  return { symbol, file: 'src/a.ts', changed: false, body: 'x', lineStart: 1, sha: 'abcdef1234', ...over };
}

function payload(definitions: ContextDefinition[]): ContextPayload {
  return {
    chunkId: 'c1',
    fingerprint: 'fp',
    generatedAt: '2026-07-17T00:00:00Z',
    facts: { definitions, edges: { imports: [], importedBy: [] } },
  };
}

function chunk(file: string, symbolPath: string[], start: number, end: number): Chunk {
  return { id: `${file}::${symbolPath.join('.')}`, file, symbolPath, displayPath: symbolPath, kind: 'method', changeTypes: [], hunks: [], headRange: { start, end } };
}

describe('visibleDefinitions', () => {
  it('is empty for absent payloads', () => {
    expect(visibleDefinitions(undefined, [])).toEqual([]);
    expect(visibleDefinitions(null, [])).toEqual([]);
  });

  it('keeps a callee that is not itself in the diff', () => {
    // Defined at line 49; no chunk covers it → genuine unchanged context (the ShowUpdate… case).
    const defs = visibleDefinitions(payload([def('helper', { lineStart: 49 })]), [chunk('src/a.ts', ['Cls', 'other'], 100, 120)]);
    expect(defs.map((d) => d.symbol)).toEqual(['helper']);
  });

  it('drops a callee that has its own chunk (same file, name, line in range)', () => {
    // Deploy at line 128 lands inside the Deploy chunk's range → it's a story chunk, not context.
    const defs = visibleDefinitions(payload([def('Deploy', { lineStart: 128 })]), [chunk('src/a.ts', ['Cls', 'Deploy'], 128, 145)]);
    expect(defs).toEqual([]);
  });

  it('does not let a broad class-level chunk swallow an unchanged nested symbol', () => {
    // A wide class chunk covers 127–168, but the def name ≠ the chunk symbol, so it survives.
    const defs = visibleDefinitions(payload([def('unchangedHelper', { lineStart: 150 })]), [chunk('src/a.ts', ['Cls'], 127, 168)]);
    expect(defs.map((d) => d.symbol)).toEqual(['unchangedHelper']);
  });
});

describe('definitionSymbols', () => {
  it('is empty for an empty list', () => {
    expect(definitionSymbols([])).toEqual([]);
  });

  it('lists symbols in order and de-duplicates', () => {
    expect(definitionSymbols([def('a'), def('b'), def('a', { file: 'other.ts' })])).toEqual(['a', 'b']);
  });
});

describe('affordanceLabel', () => {
  it('is empty when there are no definitions', () => {
    expect(affordanceLabel([])).toBe('');
  });

  it('lists all symbols when within the cap', () => {
    expect(affordanceLabel([def('a'), def('b')])).toBe('definitions: a, b');
  });

  it('trails off past the cap rather than wrapping the header', () => {
    expect(affordanceLabel([def('a'), def('b'), def('c'), def('d'), def('e'), def('f')], 4)).toBe(
      'definitions: a, b, c, d +2 more',
    );
  });
});

describe('shouldExpandOnArrival', () => {
  it('signals expand only when the intent stands and there are definitions', () => {
    expect(shouldExpandOnArrival(true, [def('foo')])).toBe(true);
  });

  it('stays silent when the user did not want it', () => {
    expect(shouldExpandOnArrival(false, [def('foo')])).toBe(false);
  });

  it('stays silent when there is nothing to show', () => {
    expect(shouldExpandOnArrival(true, [])).toBe(false);
  });
});

describe('toggleInSet', () => {
  it('adds an absent id and returns a fresh set (no mutation)', () => {
    const before = new Set<string>();
    const after = toggleInSet(before, 'c1');
    expect(after.has('c1')).toBe(true);
    expect(before.has('c1')).toBe(false);
  });

  it('removes a present id', () => {
    expect(toggleInSet(new Set(['c1']), 'c1').has('c1')).toBe(false);
  });
});
