import type { ExplainedOption, StorySummary } from '@code-story/core';
import { describe, expect, it } from 'vitest';
import { chipTooltip, costGlyph, formatCreatedAt, isActiveStory, statsLabel, versionBadge } from './library-logic.js';

const story = (overrides: Partial<StorySummary> = {}): StorySummary => ({
  id: '20260721T100000000-demo',
  createdAt: '2026-07-21T10:00:00.000Z',
  title: 'demo',
  range: { base: 'main', head: 'HEAD', baseSha: 'abc123', headSha: 'def456', label: 'main..HEAD' },
  config: { direction: 'consumer-first', testPlacement: 'before' },
  mode: 'chapter',
  aiOrder: true,
  toolVersion: '1.0.0',
  coreVersion: '0.0.5',
  models: {},
  ...overrides,
});

describe('formatCreatedAt', () => {
  it('renders a light, date-only stamp regardless of local timezone', () => {
    expect(formatCreatedAt('2026-07-21T10:00:00.000Z')).toBe('Jul 21, 2026');
  });
});

describe('statsLabel', () => {
  it('is null when stats are absent', () => {
    expect(statsLabel(undefined)).toBeNull();
  });

  it('pluralizes both counts', () => {
    expect(statsLabel({ sections: 5, chunks: 40 })).toBe('5 sections · 40 chunks');
    expect(statsLabel({ sections: 1, chunks: 1 })).toBe('1 section · 1 chunk');
  });
});

describe('isActiveStory', () => {
  it('matches when the resolved sha range equals the active range', () => {
    expect(isActiveStory(story(), 'abc123..def456')).toBe(true);
  });

  it('does not match a different range or a null active range', () => {
    expect(isActiveStory(story(), 'zzz..yyy')).toBe(false);
    expect(isActiveStory(story(), null)).toBe(false);
  });
});

describe('versionBadge', () => {
  it('prefixes the version with v', () => {
    expect(versionBadge('1.0.0')).toBe('v1.0.0');
  });
});

describe('costGlyph', () => {
  it('flags a regenerating option and checks a free one', () => {
    expect(costGlyph('regenerates')).toBe('💸');
    expect(costGlyph('free')).toBe('free');
  });
});

describe('chipTooltip', () => {
  const option = (overrides: Partial<ExplainedOption> = {}): ExplainedOption => ({
    key: 'direction',
    label: 'Reading order',
    value: 'Consumer-first',
    meaning: 'You read callers before callees.',
    cost: 'regenerates',
    ...overrides,
  });

  it('appends the cost note when present', () => {
    expect(chipTooltip(option({ costNote: 'Needs a fresh AI run.' }))).toBe('You read callers before callees. Needs a fresh AI run.');
  });

  it('is just the meaning when there is no cost note', () => {
    expect(chipTooltip(option({ costNote: undefined }))).toBe('You read callers before callees.');
  });
});
