import type { ExplainedOption, OptionCost, StorySummary } from '@code-story/core';

/** Light, date-only rendering of a story's creation stamp — UTC so it's stable across environments. */
export function formatCreatedAt(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(iso));
}

/** "N sections · M chunks", or null before the daemon has recorded stats. */
export function statsLabel(stats: StorySummary['stats']): string | null {
  if (!stats) return null;
  const sections = stats.sections === 1 ? '1 section' : `${stats.sections} sections`;
  const chunks = stats.chunks === 1 ? '1 chunk' : `${stats.chunks} chunks`;
  return `${sections} · ${chunks}`;
}

/** The library highlights the story whose resolved range matches the daemon's active range. */
export function isActiveStory(story: StorySummary, activeRange: string | null): boolean {
  return activeRange !== null && `${story.range.baseSha}..${story.range.headSha}` === activeRange;
}

export function versionBadge(version: string): string {
  return `v${version}`;
}

/** `💸` when picking this value costs an AI re-run, `free` when it never does (spec 08 §0). */
export function costGlyph(cost: OptionCost): string {
  return cost === 'regenerates' ? '💸' : 'free';
}

/** One tooltip line combining an option's meaning and its cost nuance, for the chip's `title=`. */
export function chipTooltip(option: ExplainedOption): string {
  return option.costNote ? `${option.meaning} ${option.costNote}` : option.meaning;
}
