# Build brief — issue #112: remap cursor + back-stack when the AI order applies mid-review

Repo worktree base: D:\code\lexbox-claude-worktrees\code-story\diff-display-bugs-ux-6ae07d.
Branch `claude/112-order-remap` cut from origin/main (fetch first; other PRs may land before
you — always rebase your understanding on current main).

Problem (issue #112, filed from the M5 review): the web keeps the review cursor and the
neighbor-strip back-stack as FLAT ROW INDICES. When the AI order overlay applies mid-review
(auto-order is default-on, so this WILL happen to a reviewer who starts reading before the
~36s order job lands), the flat list is rebuilt in a different order and the stored indices
now point at different rows: cursor jumps to an unrelated chunk, back-stack "back" lands
wrong. Proper fix (named in the issue): store `chunkId#ordinal` occurrence keys instead of
indices, resolve to an index at use time via flat.indexByOccurrence, drop entries that no
longer resolve.

Scope: packages/web only. Find every place a flat index is persisted across renders:
cursor state in BookPage.tsx (+ its persistence via the review store PATCH — check
useReview.ts cursor field semantics: if the SERVER stores a cursor index, keep the wire
format but re-derive defensively), the back-stack (useBackStack or in BookPage — find it),
piece-menu jumps, resume-toast target, deferred-section jump. Convert state to occurrence
keys where cheap and safe; at minimum cursor + back-stack (the filed bug). Guard: when a
stored key doesn't resolve after reorder (shouldn't happen — same chunk multiset), fall back
to index 0 rather than crashing.

Tests: extend the relevant *-logic.ts test files (order-apply/rows) with a reorder scenario:
build a flat book, record cursor+stack keys, apply a permuted section order, assert
resolution lands on the same chunks. Keyboard flows must not regress (j/k, Enter advance).

Verify: `pnpm --filter @code-story/web test` green (tsc + vitest). No server/core changes.
Commit granularly, push `git push origin HEAD:refs/heads/claude/112-order-remap`, open PR
against main titled "Track cursor and back-stack by occurrence key, not flat index" with a
one-line *[Claude, autonomous]* body + "Closes #112". Do NOT merge. Report: PR number, what
you converted vs left as index (and why), test names added.
