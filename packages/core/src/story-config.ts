/**
 * Story ordering configuration (spec 05, R-045): two independent axes the reviewer controls, each
 * defaulting to Tim's ratified axioms (R-043/R-044) — consumer-first, tests before their impl.
 * File mode (`FILE_MODE_STORY_CONFIG`, selected by `isFileModeConfig`) stays reachable via config
 * so the file-section linearizer and its v1 AI-order path remain available (R-045).
 */
export interface StoryConfig {
  /**
   * `consumer-first` reads a caller before the chunks it calls (flow down each call path);
   * `dependency-first` reads callees before their callers (today's file-mode spine).
   */
  direction: 'consumer-first' | 'dependency-first';
  /** Where a test reads relative to the impl it exercises: just `before`, just `after`, or at the `end`. */
  testPlacement: 'before' | 'after' | 'end';
}

/** Active default: Tim's axioms (R-043/R-044) — consumer-first, tests before their impl. */
export const DEFAULT_STORY_CONFIG: StoryConfig = { direction: 'consumer-first', testPlacement: 'before' };

/** The file-section linearizer's axes (dependency-first, tests after) — selectable, no longer default. */
export const FILE_MODE_STORY_CONFIG: StoryConfig = { direction: 'dependency-first', testPlacement: 'after' };

/** True when a config selects the file-mode linearizer (no chapter linearizer needed). */
export function isFileModeConfig(config: StoryConfig): boolean {
  return config.direction === 'dependency-first' && config.testPlacement === 'after';
}

/** A stable value-based key for a config — the map key for per-config book caching (#114). */
export function storyConfigKey(config: StoryConfig): string {
  return `${config.direction}/${config.testPlacement}`;
}

const DIRECTIONS = new Set<StoryConfig['direction']>(['consumer-first', 'dependency-first']);
const TEST_PLACEMENTS = new Set<StoryConfig['testPlacement']>(['before', 'after', 'end']);

/**
 * Merges a raw config object (from `.code-story.json`, or CLI-derived) onto a base, keeping only
 * recognised values — an unknown or malformed field is ignored, never fatal. Pure so both the CLI
 * and the daemon read the same rules; the caller supplies the base (defaults, or defaults already
 * overlaid with flags). Returns a fresh object.
 */
export function resolveStoryConfig(
  base: StoryConfig,
  raw: { direction?: unknown; testPlacement?: unknown } | null | undefined,
): StoryConfig {
  const direction = DIRECTIONS.has(raw?.direction as StoryConfig['direction'])
    ? (raw!.direction as StoryConfig['direction'])
    : base.direction;
  const testPlacement = TEST_PLACEMENTS.has(raw?.testPlacement as StoryConfig['testPlacement'])
    ? (raw!.testPlacement as StoryConfig['testPlacement'])
    : base.testPlacement;
  return { direction, testPlacement };
}
