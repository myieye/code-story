# Addendum — PR versions (2026-07-16, verbatim)

Tim's words, verbatim (mid-build-session-1, after slices #1–#2 shipped). Traced as R-038…R-041
in [../requirements/inventory.md](../requirements/inventory.md).

> We haven't really thought about PR VERSIONS yet have we?
> It would be great if we had a really good way of handling them that prevented reviewers from
> re-reviewing things as well as from reviewing stale things.
> Something like:
>
> * Append new diffs at the end in additional chapters
> * Stale things stay where they are and are marked as such
> * So, the entire review remains a linear top-to-bottom with PR versions added after the
>   initial review acting as new sections/chapters.
> * It should probably be possible to see both the incremental diff as well as the absolute
>   diff against the base
> * Should probably be a "crunch all version/current total diff into a single story again" that
>   just more or less starts fresh. Reusing AI analysis, but adapting it so it's treats the
>   current diff as the only diff
>
> This is truly challenging. Many review tools handle this somehow. We need to find the
> ultimate solution for also handling this in our paradigm. However, this is perhaps something
> we defer. It might be really hard and complicated while leaving it out still gets us 80% of
> what we want.
