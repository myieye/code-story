import type { StoryConfig } from '@code-story/core';

/**
 * Human labels for the two ordering axes (#114). The reviewer picks these, not the jargon — the
 * StoryConfig values ('consumer-first', 'before', …) never surface in the control.
 */
export const DIRECTION_OPTIONS: { value: StoryConfig['direction']; label: string }[] = [
  { value: 'consumer-first', label: 'Consumer first' },
  { value: 'dependency-first', label: 'Dependency first' },
];

export const TEST_PLACEMENT_OPTIONS: { value: StoryConfig['testPlacement']; label: string }[] = [
  { value: 'before', label: 'Before their code' },
  { value: 'after', label: 'After their code' },
  { value: 'end', label: 'At the end' },
];

export function directionLabel(direction: StoryConfig['direction']): string {
  return DIRECTION_OPTIONS.find((o) => o.value === direction)?.label ?? direction;
}

export function testPlacementLabel(placement: StoryConfig['testPlacement']): string {
  return TEST_PLACEMENT_OPTIONS.find((o) => o.value === placement)?.label ?? placement;
}

/** The `/api/book` query string for a config — the axes the daemon reads to override the launch config. */
export function bookQuery(config: StoryConfig): string {
  const params = new URLSearchParams({ direction: config.direction, testPlacement: config.testPlacement });
  return `?${params.toString()}`;
}

/** Order provenance shown alongside the active config: AI only when the applier actually reordered. */
export function orderSourceLabel(orderApplied: boolean): string {
  return orderApplied ? 'AI reading order' : 'Deterministic order';
}

/** Compact active-config line for the control's summary (visible without opening the menu). */
export function configSummary(config: StoryConfig): string {
  const tests = config.testPlacement === 'end' ? 'tests at end' : `tests ${config.testPlacement}`;
  return `${directionLabel(config.direction)} · ${tests}`;
}
