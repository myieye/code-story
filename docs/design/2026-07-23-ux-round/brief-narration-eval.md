# Build brief — G2 fast-follow: per-chunk narration rubric eval

Repo worktree base: D:\code\lexbox-claude-worktrees\code-story\diff-display-bugs-ux-6ae07d.
Doc-only + tools output — work directly on a branch `claude/chunk-narration-eval` from
origin/main.

Context: G2 shipped per-chunk narration v2 (badges = 2–4-word gist + one-line AI notes,
prompt `narration-chunk-1`, bakes in point-don't-assert) DEFAULT-ON without its own eval —
the named fast-follow is a rubric eval (register + faithfulness floor) on real dogfood
subjects; revisit default-on if the faithfulness floor fails. Spec 03's eval track
(docs/spec/03-narration.md) defines the rubric idea for v1 SECTION narration; the M3 eval
lived around tools/ and docs/evals/ (find the prior art: rubric eval from issue #39, reports
under docs/evals/). Existing register gate code: packages/core/src/narration.ts (caps,
22-word, judgment-lint) — the HARD gates already run at generation; your eval judges what
SHIPPED PLUS what the hard gates can't check: faithfulness (does the badge/line claim match
the actual diff?) and usefulness of register (grounding value, not just rule compliance).

Subjects: two books with chunk narration already generated on this machine:
lexbox PR 2468 (state dir ~/.code-story/languageforge-lexbox-32093c12aded/, range
ccd29d08..8d6b66e5 — check exact file names; chunk overlay = *.narration-chunks.json) and
PR 2470 (same dir, its own range). The lexbox repo is at D:\code\languageforge-lexbox with
worktrees under D:\code\lexbox-claude-worktrees\ — you can read real diffs via git there
(fetch refs pull/2468/head, pull/2470/head if missing). If 2470's overlay is missing chunk
narration, fall back to code-story's own history range a53e79f~1..a53e79f (generate via the
daemon with default-on narration — budget note below).

Method (mirror the M3 rubric eval's honesty rules):
- For EVERY narrated chunk (not a sample; these books are ~30–130 chunks), a judge agent
  (claude -p, model sonnet — judge≠generator tier, note the self-preference caveat since
  generator was opus) receives: the chunk's unified diff text (reconstruct via the book
  export or the API), its badge + AI line, and scores: register 1–5 (light, plain, ≤ a
  sentence), faithfulness PASS/FLAG (FLAG = asserts something the diff doesn't show;
  point-don't-assert phrasing that stays hedged is PASS), grounding value 1–5 (would this
  2-worder genuinely orient a reviewer before the diff?).
- Faithfulness floor: ANY chunk with a confident-wrong claim = floor failure (same rule as
  spec 03: gated on a floor, not a median).
- Use the glue ledger pattern for costs if you spawn via the pipeline; otherwise plain
  `claude -p` with the tool-less spawn helper (packages/server/src/claude-cli.ts via dist —
  `pnpm build` first) and record call counts.
- Write the report to docs/evals/chunk-narration-eval-2026-07-23.md: per-subject tables
  (medians, floor result, flagged chunks verbatim with the diff evidence), verdict line:
  default-on STANDS or REVERT TO OPT-IN, and prompt-iteration notes if flags cluster.
- If the verdict is REVERT, do NOT change the default yourself — report back; the root
  session decides (it may prefer a prompt bump + re-eval).

Verify: report file complete, evidence quoted for every FLAG. Commit, push
`git push origin HEAD:refs/heads/claude/chunk-narration-eval`, PR against main titled
"Chunk-narration rubric eval on 2468/2470" body *[Claude, autonomous]* one-liner. Do NOT
merge. Report: verdict, flag count, cost, PR number.
