import { describe, expect, test } from 'vitest';
import { extractJsonBlock } from './claude-cli.js';

const envelope = (result: string) => JSON.stringify({ result });

describe('extractJsonBlock', () => {
  test('plain JSON result', () => {
    expect(extractJsonBlock(envelope('{"order": ["a.ts"]}'))).toEqual({ order: ['a.ts'] });
  });

  test('prose before and after, trailing prose containing a brace', () => {
    const result = 'Here you go:\n{"choice": "A", "reason": "b before a"}\nCall me with {options} if needed.';
    expect(extractJsonBlock(envelope(result))).toEqual({ choice: 'A', reason: 'b before a' });
  });

  test('braces inside string values do not end the object early', () => {
    const result = '{"reason": "the {config} object moved", "choice": "B"}';
    expect(extractJsonBlock(envelope(result))).toEqual({ reason: 'the {config} object moved', choice: 'B' });
  });

  test('escaped quotes inside strings', () => {
    const result = '{"reason": "uses \\"brace\\" chars {}", "choice": "A"}';
    expect(extractJsonBlock(envelope(result))).toEqual({ reason: 'uses "brace" chars {}', choice: 'A' });
  });

  test('no object at all throws', () => {
    expect(() => extractJsonBlock(envelope('nothing here'))).toThrow('no JSON object');
  });

  test('unbalanced object throws', () => {
    expect(() => extractJsonBlock(envelope('{"a": 1'))).toThrow('unbalanced');
  });
});
