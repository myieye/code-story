import { describe, expect, it } from 'vitest';
import { isOutsideBox, resolveAutoExpand } from './scrollspy-logic.js';

describe('resolveAutoExpand', () => {
  it('auto-expands the current section', () => {
    const { expanded, autoExpandedId } = resolveAutoExpand('B', undefined, new Set());
    expect([...expanded]).toEqual(['B']);
    expect(autoExpandedId).toBe('B');
  });

  it('collapses the prior auto-expansion when the current section changes', () => {
    const first = resolveAutoExpand('A', undefined, new Set());
    const second = resolveAutoExpand('B', first.autoExpandedId, new Set());
    expect(second.expanded.has('A')).toBe(false);
    expect(second.expanded.has('B')).toBe(true);
  });

  it('keeps manual expansions open even when they are no longer current', () => {
    const manual = new Set(['A']);
    const { expanded } = resolveAutoExpand('B', 'A', manual);
    expect(expanded.has('A')).toBe(true);
    expect(expanded.has('B')).toBe(true);
  });

  it('holds the prior auto open when no section resolves (boundary)', () => {
    const { expanded, autoExpandedId } = resolveAutoExpand(undefined, 'B', new Set());
    expect(expanded.has('B')).toBe(true);
    expect(autoExpandedId).toBe('B');
  });
});

describe('isOutsideBox', () => {
  it('is false when the item is fully inside the box', () => {
    expect(isOutsideBox({ top: 20, bottom: 40 }, { top: 0, bottom: 100 })).toBe(false);
  });

  it('is true when the item sits above the box', () => {
    expect(isOutsideBox({ top: -10, bottom: 5 }, { top: 0, bottom: 100 })).toBe(true);
  });

  it('is true when the item sits below the box', () => {
    expect(isOutsideBox({ top: 90, bottom: 120 }, { top: 0, bottom: 100 })).toBe(true);
  });
});
