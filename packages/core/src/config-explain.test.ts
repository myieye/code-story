import { describe, expect, it } from 'vitest';
import { explainConfig, explainStoryOptions } from './config-explain.js';
import { changelogHeadMatchesAppVersion } from './changelog.js';

describe('explainConfig', () => {
  it('marks the ordering axes as regenerates (they cost a paid re-run)', () => {
    const opts = explainConfig({ direction: 'consumer-first', testPlacement: 'before' }, 'chapter');
    const byKey = Object.fromEntries(opts.map((o) => [o.key, o]));
    expect(byKey.direction!.cost).toBe('regenerates');
    expect(byKey.testPlacement!.cost).toBe('regenerates');
    expect(byKey.mode!.cost).toBe('regenerates');
    expect(byKey.direction!.value).toBe('Consumer-first');
  });
});

describe('explainStoryOptions', () => {
  it('marks toggles and model choices as free', () => {
    const opts = explainStoryOptions({
      config: { direction: 'dependency-first', testPlacement: 'end' },
      mode: 'file',
      aiOrder: true,
      models: { order: 'opus', narration: 'sonnet' },
    });
    const byKey = Object.fromEntries(opts.map((o) => [o.key, o]));
    expect(byKey.aiOrder!.cost).toBe('free');
    expect(byKey.orderModel!.cost).toBe('free');
    expect(byKey.narrationModel!.cost).toBe('free');
    expect(byKey.orderModel!.value).toBe('opus');
  });

  it('omits model rows when models are absent', () => {
    const opts = explainStoryOptions({
      config: { direction: 'consumer-first', testPlacement: 'before' },
      mode: 'chapter',
      aiOrder: false,
    });
    expect(opts.some((o) => o.key === 'orderModel')).toBe(false);
    expect(opts.some((o) => o.key === 'narrationModel')).toBe(false);
  });
});

describe('changelog', () => {
  it('head entry tracks APP_VERSION', () => {
    expect(changelogHeadMatchesAppVersion()).toBe(true);
  });
});
