# Changelog

The user-facing change list (R-063). Mirrors `packages/core/src/changelog.ts` — the app's
`APP_VERSION` and the in-app Changelog page read the same entries. The list starts at 1.0.0; there
are deliberately no retroactive entries for the build windows before versioning existed.

`APP_VERSION` is the reviewer-facing tool version. It is distinct from `CORE_VERSION`, whose only
job is invalidating persisted AI overlays when chunking/ordering logic changes.

## 1.0.0 — 2026-07-21 — Story library, config visibility, and versioning

- A library page lists every story you have generated and lets you start a new review from the browser.
- Each story now records exactly which options generated it, shown both in the library and inside the story.
- Every option explains what it does, and whether changing it needs a paid AI re-run or is free.
- Stories are saved to disk and synced through the repo, so they follow you across environments.
- This changelog: each story is stamped with the tool version that made it.
