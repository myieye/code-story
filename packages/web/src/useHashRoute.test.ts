import { describe, expect, it } from 'vitest';
import { parseRoute } from './useHashRoute.js';

describe('parseRoute', () => {
  it('treats the empty hash and #/ as the book route', () => {
    expect(parseRoute('')).toBe('book');
    expect(parseRoute('#/')).toBe('book');
    expect(parseRoute('#/story')).toBe('book');
  });

  it('recognizes the library and changelog routes', () => {
    expect(parseRoute('#/library')).toBe('library');
    expect(parseRoute('#/changelog')).toBe('changelog');
  });

  it('falls back to the book route for anything unrecognized', () => {
    expect(parseRoute('#/nonsense')).toBe('book');
  });
});
