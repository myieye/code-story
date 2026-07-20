import { describe, expect, test } from 'vitest';
import { createModelPolicy } from './model-policy.js';

describe('ModelPolicy', () => {
  test('defaults map tiers to opus/sonnet/haiku', () => {
    const policy = createModelPolicy();
    expect(policy.resolve('top')).toBe('opus');
    expect(policy.resolve('mid')).toBe('sonnet');
    expect(policy.resolve('cheap')).toBe('haiku');
  });

  test('config overrides replace only the named tiers', () => {
    const policy = createModelPolicy({ top: 'opus-4-8', cheap: 'haiku-4-5' });
    expect(policy.resolve('top')).toBe('opus-4-8');
    expect(policy.resolve('mid')).toBe('sonnet');
    expect(policy.resolve('cheap')).toBe('haiku-4-5');
  });

  test('per-task override wins over the tier default', () => {
    const policy = createModelPolicy();
    expect(policy.resolve('top', { taskModel: 'custom-model' })).toBe('custom-model');
  });

  test("tier 'none' is rejected, even with a per-task override", () => {
    const policy = createModelPolicy();
    expect(() => policy.resolve('none')).toThrow("cannot resolve tier 'none'");
    expect(() => policy.resolve('none', { taskModel: 'x' })).toThrow("cannot resolve tier 'none'");
  });
});
