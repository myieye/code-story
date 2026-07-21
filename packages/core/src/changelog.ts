import { APP_VERSION } from './version.js';

/**
 * A user-facing changelog entry (R-063). This array is the source of truth the Changelog page and
 * `GET /api/changelog` render; `docs/CHANGELOG.md` mirrors it for readers browsing the repo. The
 * change list starts now — no retroactive entries for earlier build windows (R-063).
 *
 * Keep entries newest-first. The top entry's `version` must equal APP_VERSION.
 */
export interface ChangelogEntry {
  version: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  title: string;
  /** Plain, light-register lines (R-036) — what a reviewer would notice, not commit-level detail. */
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.0.0',
    date: '2026-07-21',
    title: 'Story library, config visibility, and versioning',
    changes: [
      'A library page lists every story you have generated and lets you start a new review from the browser.',
      'Each story now records exactly which options generated it, shown both in the library and inside the story.',
      'Every option explains what it does, and whether changing it needs a paid AI re-run or is free.',
      'Stories are saved to disk and synced through the repo, so they follow you across environments.',
      'This changelog: each story is stamped with the tool version that made it.',
    ],
  },
];

/** Invariant guard for tests: the newest changelog entry tracks the shipped APP_VERSION. */
export function changelogHeadMatchesAppVersion(): boolean {
  return CHANGELOG.length > 0 && CHANGELOG[0]!.version === APP_VERSION;
}
