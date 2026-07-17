/**
 * Story ordering configuration (spec 05, R-045): two independent axes the reviewer controls.
 * Tim's preferred values (`TIM_STORY_CONFIG`) are the intended defaults, but this slice ships
 * `DEFAULT_STORY_CONFIG` as the active default so the shipped AI order prompt (dependency-first)
 * keeps passing its checkOrder pre-gate — the flip to Tim's values is slice 3's job (#77), gated
 * on the consumer-first linearizer clearing its evals.
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

/** Active default: today's file-mode behaviour (see the file header for why this isn't Tim's picks yet). */
export const DEFAULT_STORY_CONFIG: StoryConfig = { direction: 'dependency-first', testPlacement: 'after' };

/** Tim's stated preferences — the intended defaults, deferred to slice 3 (#77). */
export const TIM_STORY_CONFIG: StoryConfig = { direction: 'consumer-first', testPlacement: 'before' };

/** True when a config selects only today's file-mode behaviour (no chapter linearizer needed). */
export function isDefaultStoryConfig(config: StoryConfig): boolean {
  return config.direction === 'dependency-first' && config.testPlacement === 'after';
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
