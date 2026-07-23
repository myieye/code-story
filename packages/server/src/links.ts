import type { BookResponse } from '@code-story/core';

export type BookLinks = NonNullable<BookResponse['links']>;

/**
 * GitHub's Files-changed tab for a PR page URL, or undefined when the URL isn't PR-shaped
 * (`/pull/<n>` at the end). The trailing slash is trimmed first so `.../pull/5/` still resolves.
 */
export function filesChangedUrl(prUrl: string): string | undefined {
  const trimmed = prUrl.replace(/\/+$/, '');
  return /\/pull\/\d+$/.test(trimmed) ? `${trimmed}/files` : undefined;
}

/** Assemble the book links from launch flags; undefined when nothing was supplied. */
export function buildLinks(opts: { prUrl?: string; appUrl?: string; appLabel?: string }): BookLinks | undefined {
  const links: BookLinks = {};
  if (opts.prUrl) {
    links.pr = opts.prUrl;
    const files = filesChangedUrl(opts.prUrl);
    if (files) links.filesChanged = files;
  }
  if (opts.appUrl) links.app = { url: opts.appUrl, ...(opts.appLabel ? { label: opts.appLabel } : {}) };
  return Object.keys(links).length > 0 ? links : undefined;
}
