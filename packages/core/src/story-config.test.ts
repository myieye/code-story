import { describe, expect, it } from 'vitest';
import { DEFAULT_STORY_CONFIG, FILE_MODE_STORY_CONFIG, isFileModeConfig, resolveStoryConfig } from './story-config.js';

describe('resolveStoryConfig', () => {
  it('keeps the base when raw is absent or empty', () => {
    expect(resolveStoryConfig(DEFAULT_STORY_CONFIG, undefined)).toEqual(DEFAULT_STORY_CONFIG);
    expect(resolveStoryConfig(DEFAULT_STORY_CONFIG, {})).toEqual(DEFAULT_STORY_CONFIG);
  });

  it('overlays only recognised fields, ignoring garbage', () => {
    expect(resolveStoryConfig(DEFAULT_STORY_CONFIG, { direction: 'dependency-first', testPlacement: 'nonsense' })).toEqual({
      direction: 'dependency-first',
      testPlacement: 'before',
    });
    expect(resolveStoryConfig(DEFAULT_STORY_CONFIG, { direction: 42 })).toEqual(DEFAULT_STORY_CONFIG);
  });

  it('lets a later layer (flags) win over an earlier one (file)', () => {
    const fromFile = resolveStoryConfig(DEFAULT_STORY_CONFIG, { direction: 'dependency-first', testPlacement: 'after' });
    expect(resolveStoryConfig(fromFile, { testPlacement: 'end' })).toEqual({ direction: 'dependency-first', testPlacement: 'end' });
  });

  it('recognises the file-mode config', () => {
    expect(isFileModeConfig(FILE_MODE_STORY_CONFIG)).toBe(true);
    expect(isFileModeConfig(DEFAULT_STORY_CONFIG)).toBe(false);
    expect(isFileModeConfig({ direction: 'dependency-first', testPlacement: 'end' })).toBe(false);
  });
});
