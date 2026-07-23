import { describe, expect, test } from 'vitest';
import { linkHost } from './links-logic.js';

describe('linkHost', () => {
  test('returns the host of a well-formed URL', () => {
    expect(linkHost('http://localhost:5173/some/path')).toBe('localhost:5173');
    expect(linkHost('https://example.com')).toBe('example.com');
  });

  test('falls back to the raw string when the URL does not parse', () => {
    expect(linkHost('not a url')).toBe('not a url');
  });
});
