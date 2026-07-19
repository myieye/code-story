import type { StoryConfig } from '@code-story/core';
import { describe, expect, test } from 'vitest';
import {
  bookQuery,
  configSummary,
  directionLabel,
  orderSourceLabel,
  testPlacementLabel,
} from './order-options-logic.js';

describe('order-options-logic (#114)', () => {
  test('bookQuery encodes both axes as /api/book params', () => {
    const config: StoryConfig = { direction: 'dependency-first', testPlacement: 'end' };
    expect(bookQuery(config)).toBe('?direction=dependency-first&testPlacement=end');
  });

  test('labels are human, never the raw enum jargon', () => {
    expect(directionLabel('consumer-first')).toBe('Consumer first');
    expect(directionLabel('dependency-first')).toBe('Dependency first');
    expect(testPlacementLabel('before')).toBe('Before their code');
    expect(testPlacementLabel('end')).toBe('At the end');
  });

  test('orderSourceLabel tells AI from deterministic', () => {
    expect(orderSourceLabel(true)).toBe('AI reading order');
    expect(orderSourceLabel(false)).toBe('Deterministic order');
  });

  test('configSummary reads as a compact active-state line', () => {
    expect(configSummary({ direction: 'consumer-first', testPlacement: 'before' })).toBe('Consumer first · tests before');
    expect(configSummary({ direction: 'dependency-first', testPlacement: 'end' })).toBe('Dependency first · tests at end');
  });
});
