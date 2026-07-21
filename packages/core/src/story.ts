import type { NarrationOverlay, NarrationOverlayV2 } from './narration.js';
import type { AnyOrderOverlay } from './order.js';
import type { StoryConfig } from './story-config.js';

/**
 * The range a story reviews. SHAs are resolved once at generation so a snapshot is reproducible even
 * if refs move; `label` is the human range the reviewer typed (e.g. `main..HEAD`).
 */
export interface StoryRange {
  base: string;
  head: string;
  baseSha: string;
  headSha: string;
  label: string;
}

/**
 * A persisted, conflict-free snapshot of one generated code-story (R-064). Written to
 * `<repo>/.code-story/stories/<id>.json`, git-tracked so it syncs across environments. The `id`
 * carries a timestamp so two environments generating the same range never overwrite each other.
 *
 * Live review marks are deliberately NOT bundled — they are per-reviewer and conflict-prone, so
 * they stay in `~/.code-story/`. A snapshot bundles the expensive-to-regenerate AI artifacts so a
 * peer environment need not repay for them.
 */
export interface StorySnapshot {
  id: string;
  /** ISO-8601 creation time. */
  createdAt: string;
  title: string;
  range: StoryRange;
  config: StoryConfig;
  mode: 'file' | 'chapter';
  aiOrder: boolean;
  /** User-facing tool version (APP_VERSION) at generation — the changelog key (R-063). */
  toolVersion: string;
  /** CORE_VERSION at generation — determines whether the bundled overlays still apply. */
  coreVersion: string;
  models: { order?: string; narration?: string };
  stats?: { sections: number; chunks: number };
  /** Bundled AI artifacts (R-064) — present once the glue has produced them. */
  orderOverlay?: AnyOrderOverlay;
  narration?: { v1?: NarrationOverlay; v2?: NarrationOverlayV2 };
}

/** The compact list item `GET /api/stories` returns — metadata only, no bundled overlays. */
export type StorySummary = Omit<StorySnapshot, 'orderOverlay' | 'narration'>;

export function toStorySummary(s: StorySnapshot): StorySummary {
  const { orderOverlay: _o, narration: _n, ...summary } = s;
  return summary;
}

const SLUG_MAX = 32;

/** Lowercase, filesystem- and URL-safe slug: keep [a-z0-9], collapse the rest to single dashes. */
export function slugify(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '');
  return slug || 'story';
}

/** Compact UTC stamp `YYYYMMDDTHHMMSSmmm` — sorts lexically, safe in a filename, sub-second unique. */
export function compactStamp(date: Date): string {
  return date.toISOString().replace(/[-:.]/g, '').replace('Z', '');
}

/**
 * A conflict-free story id (R-064): `<compact-utc>-<slug>`. The timestamp leads so ids sort
 * chronologically; the slug makes them recognisable. Sub-second precision plus the per-environment
 * timing makes collisions across machines effectively impossible.
 */
export function storyId(rangeLabel: string, createdAt: Date): string {
  return `${compactStamp(createdAt)}-${slugify(rangeLabel)}`;
}
