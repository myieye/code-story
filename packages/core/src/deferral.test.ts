import { describe, expect, it } from 'vitest';
import { emptyDeferralStore } from './deferral.js';

describe('emptyDeferralStore', () => {
  it('is a v1 store with the range and no deferrals', () => {
    expect(emptyDeferralStore('base', 'head')).toEqual({ version: 1, base: 'base', head: 'head', deferrals: [] });
  });
});
