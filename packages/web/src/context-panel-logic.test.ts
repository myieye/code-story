import type { ContextDefinition, ContextPayload } from '@code-story/core';
import { describe, expect, it } from 'vitest';
import {
  affordanceLabel,
  definitionSymbols,
  hasDefinitions,
  type PayloadState,
  shouldExpandOnArrival,
  toggleInSet,
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

describe('hasDefinitions', () => {
  it('is false for unfetched (undefined) and fetched-empty (null)', () => {
    expect(hasDefinitions(undefined)).toBe(false);
    expect(hasDefinitions(null)).toBe(false);
  });

  it('is false when the payload carries no definitions', () => {
    expect(hasDefinitions(payload([]))).toBe(false);
  });

  it('is true when at least one definition is present', () => {
    expect(hasDefinitions(payload([def('foo')]))).toBe(true);
  });
});

describe('definitionSymbols', () => {
  it('is empty for absent payloads', () => {
    const cases: PayloadState[] = [undefined, null, payload([])];
    for (const c of cases) expect(definitionSymbols(c)).toEqual([]);
  });

  it('lists symbols in payload order and de-duplicates', () => {
    expect(definitionSymbols(payload([def('a'), def('b'), def('a', { file: 'other.ts' })]))).toEqual(['a', 'b']);
  });
});

describe('affordanceLabel', () => {
  it('is empty when there are no definitions', () => {
    expect(affordanceLabel(null)).toBe('');
  });

  it('lists all symbols when within the cap', () => {
    expect(affordanceLabel(payload([def('a'), def('b')]))).toBe('definitions: a, b');
  });

  it('trails off past the cap rather than wrapping the header', () => {
    expect(affordanceLabel(payload([def('a'), def('b'), def('c'), def('d'), def('e'), def('f')]), 4)).toBe(
      'definitions: a, b, c, d +2 more',
    );
  });
});

describe('shouldExpandOnArrival', () => {
  it('signals expand only when the intent stands and there are definitions', () => {
    expect(shouldExpandOnArrival(true, payload([def('foo')]))).toBe(true);
  });

  it('stays silent when the user did not want it', () => {
    expect(shouldExpandOnArrival(false, payload([def('foo')]))).toBe(false);
  });

  it('stays silent when the arriving payload has nothing to show', () => {
    expect(shouldExpandOnArrival(true, payload([]))).toBe(false);
    expect(shouldExpandOnArrival(true, null)).toBe(false);
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
