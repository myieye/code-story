# Prepared code-story reviews — sillsdev/languageforge-lexbox (2026-07-19)

Pre-generated code-story review "books" for real lexbox PR branches, so the AI tokens are already
spent and you can read/iterate whenever. Each `.md` is a self-contained export (chapters/sections +
the diff of every chunk); the AI work (chapter ordering, and narration where noted) is baked in.

Generated with the current build (M0–M5). To drive any of these **interactively** instead of reading
the markdown, launch the daemon on its range and open the book UI:

```bash
tools/demo.sh /home/user/lexbox "<range from below>"
```

(The interactive run re-runs the ~30s AI-ordering job — cheap — and gives you the M5 neighbor strip +
mow live. The markdown here is the durable, already-paid artifact.)

## How these were chosen — read this

I could **not** read PR metadata this session: the proxy gates the sillsdev GitHub API, and
`sillsdev/harmony` couldn't be added at all (cross-owner). So there is **no harmony review**, and
these lexbox PRs were picked by a **git heuristic** (branch diff size + recency + your active
duplicate-detection signal), **not** by actual review-state. If these aren't the PRs you care about,
that's the one thing to tell me — with the real PR list I can regenerate in minutes.

## The files

| File | Branch / range | Order | Notes |
|------|----------------|-------|-------|
| `dup-sync.md` | `claude/duplicate-entry-detection-sync` · `5f21a55d6011..e5b1028d72b1` | **AI chapters** (consumer-first) | 123 chunks / 17 sections / 8 chapters |
| `dup-sync-narrated.md` | same | file-mode + **narration** | 16 sections, 21 `> AI:` lines |
| `possible-duplicates.md` | `feat/possible-duplicates` · `9e5502df118f..2dc41fb37157` | **AI chapters** | 111 chunks / 17 sections / 8 chapters |
| `possible-duplicates-narrated.md` | same | file-mode + **narration** | 15 sections, 26 `> AI:` lines |
| `ws-collation.md` | `feature/writing-system-collation` (Kevin) · `208b520ab01b..5d5dfbf326fe` | **AI chapters** | 141 chunks / 27 sections / 21 chapters |
| `variants-backend.md` | `feat/variants-backend` · `a9cf4ca78a1b..55d4485cd507` | **tier-0** (see below) | **726 chunks / 577 sections**, 636 KB — the big-PR stress case |

**Two "directions" to compare** (per your "people are different" point): for both duplicate PRs there's
an **AI-chapter** book (grouped by call path, consumer-first) *and* a **narrated file-mode** book
(one section per file, dependency-first, with the AI voice). Read them side by side — which order do
you actually prefer to review in?

## Findings from generating these (worth your eye)

- **Narration is invisible in the default (chapter) mode** — it only embeds in file mode
  ([#115](https://github.com/myieye/code-story/issues/115)). That's why the narrated books are
  file-mode. The narration reads well (light, orient-don't-judge), but the faithfulness floor is
  still under evaluation — trust it as orientation, not verified claims.
- **AI ordering has a size ceiling.** `variants-backend` (87 files) refused AI ordering — its order
  manifest was ~20 000 tokens vs the 8 000 guard — and fell back to tier-0. The 8 000 limit may be
  too conservative for today's models; raising it (or compacting the manifest) is a candidate.
- **Tier-0 over-fragments at scale** ([#100](https://github.com/myieye/code-story/issues/100)):
  variants tier-0 produced 577 sections for 726 chunks — mostly singleton "chapters" because the
  call graph between changed chunks is sparse. This is exactly where AI ordering (or the #100
  same-file grouping pass) would help, and where it's currently absent (the size ceiling).
