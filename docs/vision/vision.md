# Vision (distilled)

Source of truth: [original-prompt.md](original-prompt.md) (verbatim). Requirements are traced in
[../requirements/inventory.md](../requirements/inventory.md). This document is the readable
distillation.

## The problem

AI makes producing code cheap; reviewing it is now the bottleneck — and human-authored code was
already expensive to review. Classic tools present a *wall of diffs*, one file after another, in
alphabetical order. That is almost never the right order, the right granularity, or the right
amount of context. Reviewers scroll up and down, jump between markup and handlers, re-review whole
files because one line was unclear, and lose track of what they've actually covered.

## The bet

A diff can be restructured into something that **reads like a book**: a linear narrative of
sub-file-level chunks, ordered so each chunk makes sense given what came before, each carrying
exactly the context it needs (callee bodies, explanations, flow notes) — with the diff always
unmistakably distinct from the context around it. Structure, flow, context, and power tools turn
painful scrolling into a linear process that walks the reviewer through the change.

Two ends of a spectrum prove different code needs different handling:

- **Backend code is dense** — few lines, high meaning; needs deep context (invariants,
  concurrency, callers).
- **UI code is diluted** — a "small" dialog is a huge HTML/Svelte diff; the work is jumping
  between markup and the handlers/state it references, and checking flows (does the loading state
  show in the right place at the right time?). Needs linked markup↔logic navigation, aggressive
  collapsing, and flow-oriented presentation.

## The stance: the human is the reviewer

AI does *ground work*: chunking, ordering, context payloads, explanations, change-type detection,
flagging. The human does *judgment*. The tool must never lull the reviewer into "AI says it's
fine" — it exists to make critique easy, not to sell the code. Trust is engineered:

- 100% of the diff is always represented and reachable; collapsing hides nothing permanently.
- AI code changes happen only as **patches** applied by the tool and pinned to the thread that
  produced them — so what you see in a thread is provably exactly what changed.
- Anything a script can do, a script does. AI is reserved for what only AI can do.

## The interaction loop

1. **Ingest** a branch/PR → chunk the diff (syntax-aware, sub-file), detect change types,
   propose a reading order, pre-generate context where clearly needed.
2. **First sweep** (optional) — reviewer skims, flags chunks for deep context; flagged context is
   generated in bulk in the background.
3. **The read** — reviewer walks the book. Per chunk: accept (mark reviewed), dig (expand
   context, navigate old/new code), discuss (open a local AI thread), edit (by hand or via AI
   patch iterations), or **defer** (reviewed-except-this-question; the question is answered
   asynchronously and resurfaces later — never forcing a whole-file re-review).
4. **Learn** — findings that should change future behavior become suggested additions to agent
   instruction files (repo/user/global).

Progress is tracked per chunk. The review is done when the queue is empty — by construction,
nothing was skipped.

## Adaptivity

Depth of explanation calibrates to code complexity and to the reviewer's knowledge (languages,
packages, codebase areas) — including relative to the author. Posture calibrates to authorship:
own/agent-authored code gets every wrinkle worked out; someone else's code gets real bugs and
clear, objective improvements.

## Constraints

- **Harness-agnostic**: works with the author's Claude subscription via Claude Code, and equally
  with any other local agent, through a clean protocol (MCP / ACP / file-based — decision pending
  research).
- **Repo-agnostic**: first target is languageforge/lexbox (C# + Svelte/TS), but general.
- **Fast**: interactive navigation is instant; slow AI work is bulk/background.
