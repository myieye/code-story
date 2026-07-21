import { describe, expect, it } from 'vitest';
import { compactStamp, slugify, storyId, toStorySummary, type StorySnapshot } from './story.js';

describe('slugify', () => {
  it('lowercases and collapses non-alnum runs to single dashes', () => {
    expect(slugify('main..HEAD')).toBe('main-head');
    expect(slugify('feature/Cool_Thing #42')).toBe('feature-cool-thing-42');
  });

  it('trims leading/trailing dashes and falls back when empty', () => {
    expect(slugify('///')).toBe('story');
    expect(slugify('  ..  ')).toBe('story');
  });

  it('caps length without leaving a trailing dash', () => {
    const slug = slugify('a'.repeat(40) + '-' + 'b'.repeat(40));
    expect(slug.length).toBeLessThanOrEqual(32);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('storyId', () => {
  it('leads with a sortable UTC stamp then the slug (conflict-free, R-064)', () => {
    const a = storyId('main..HEAD', new Date('2026-07-21T06:30:00.123Z'));
    expect(a).toBe('20260721T063000123-main-head');
  });

  it('sorts chronologically as plain strings', () => {
    const early = storyId('x', new Date('2026-07-21T06:30:00.000Z'));
    const late = storyId('x', new Date('2026-07-21T06:30:00.001Z'));
    expect([late, early].sort()).toEqual([early, late]);
  });
});

describe('compactStamp', () => {
  it('strips separators from the ISO string', () => {
    expect(compactStamp(new Date('2026-07-21T06:30:00.000Z'))).toBe('20260721T063000000');
  });
});

describe('toStorySummary', () => {
  it('drops the bundled overlays', () => {
    const snap: StorySnapshot = {
      id: 'x',
      createdAt: '2026-07-21T00:00:00.000Z',
      title: 't',
      range: { base: 'a', head: 'b', baseSha: 'aa', headSha: 'bb', label: 'a..b' },
      config: { direction: 'consumer-first', testPlacement: 'before' },
      mode: 'chapter',
      aiOrder: true,
      toolVersion: '1.0.0',
      coreVersion: '0.0.6',
      models: { order: 'opus' },
      orderOverlay: { version: 1 } as never,
      narration: {},
    };
    const summary = toStorySummary(snap);
    expect('orderOverlay' in summary).toBe(false);
    expect('narration' in summary).toBe(false);
    expect(summary.id).toBe('x');
  });
});
