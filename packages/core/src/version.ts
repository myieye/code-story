/**
 * User-facing tool version (R-063), distinct from CORE_VERSION. CORE_VERSION's only job is
 * invalidating persisted AI overlays when chunking/ordering logic changes; APP_VERSION is the
 * human-readable release the reviewer sees stamped on each story and looks up in the changelog.
 * The changelog (changelog.ts) is the source of truth for what each version added.
 */
export const APP_VERSION = '1.0.0';
