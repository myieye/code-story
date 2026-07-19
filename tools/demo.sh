#!/usr/bin/env bash
# Launch code-story's book UI on a demo diff, then open the printed URL in a browser.
#
#   tools/demo.sh                      # default demo: lexbox PR 2379 (a C# change with a real
#                                      #   call graph — the neighbor strip has something to show)
#   tools/demo.sh <repo-dir> <range>   # any local git repo + range, e.g. ~/myrepo "main~5..main"
#
# AI chapter ordering auto-kicks on load (needs the `claude` CLI on PATH); the book shows the
# deterministic order immediately and re-orders a few seconds later. Add CODE_STORY_NO_AI_ORDER=1
# to skip it. Press ? in the UI for the full keymap.
set -euo pipefail

CS="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="${1:-/home/user/lexbox}"
RANGE="${2:-8dd70ba~1..8dd70ba}"

if [ ! -d "$REPO/.git" ]; then
  echo "error: '$REPO' is not a git repository. Pass a repo dir + range:" >&2
  echo "  tools/demo.sh <repo-dir> <base>..<head>" >&2
  exit 1
fi

echo "Building code-story…"
(cd "$CS" && pnpm build >/dev/null)

echo "Serving $RANGE from $REPO — open the URL printed below."
cd "$REPO"
exec node "$CS/packages/server/dist/cli.js" "$RANGE"
