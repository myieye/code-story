import { describe, expect, it } from 'vitest';
import { DEFAULT_STORY_CONFIG, isDefaultStoryConfig, resolveStoryConfig, TIM_STORY_CONFIG } from './story-config.js';

describe('resolveStoryConfig', () => {
  it('keeps the base when raw is absent or empty', () => {
    expect(resolveStoryConfig(DEFAULT_STORY_CONFIG, undefined)).toEqual(DEFAULT_STORY_CONFIG);
    expect(resolveStoryConfig(DEFAULT_STORY_CONFIG, {})).toEqual(DEFAULT_STORY_CONFIG);
  });

  it('overlays only recognised fields, ignoring garbage', () => {
    expect(resolveStoryConfig(DEFAULT_STORY_CONFIG, { direction: 'consumer-first', testPlacement: 'nonsense' })).toEqual({
      direction: 'consumer-first',
      testPlacement: 'after',
    });
    expect(resolveStoryConfig(DEFAULT_STORY_CONFIG, { direction: 42 })).toEqual(DEFAULT_STORY_CONFIG);
  });

  it('lets a later layer (flags) win over an earlier one (file)', () => {
    const fromFile = resolveStoryConfig(DEFAULT_STORY_CONFIG, { direction: 'consumer-first', testPlacement: 'before' });
    expect(resolveStoryConfig(fromFile, { testPlacement: 'end' })).toEqual({ direction: 'consumer-first', testPlacement: 'end' });
  });

  it('recognises the file-mode default', () => {
    expect(isDefaultStoryConfig(DEFAULT_STORY_CONFIG)).toBe(true);
    expect(isDefaultStoryConfig(TIM_STORY_CONFIG)).toBe(false);
    expect(isDefaultStoryConfig({ direction: 'dependency-first', testPlacement: 'end' })).toBe(false);
  });
});
