# Addendum — the AI glue pipeline (Tim, 2026-07-20)

Received while the review-UX feedback round (same day) was in design. Verbatim:

> Because we're going to be generating quite a lot of AI "glue", annotations, narration,
> ordering etc.
>
> a good pipeline that optimizes what agents gets called when with what context for what task
> is probably something that would be really valuable.
>
> that's something you should build. it should be built with the best initial pieces you can
> think of for our final goals, but be modular so that we can tweak and move pieces around
> later as we learn and improve the tool.
>
> that's a critical piece of architecture. build it carefully.

Traced as **R-060** in the [inventory](../requirements/inventory.md). Connects to R-024
(scripts before AI), Tim's standing model-economy directive (cheap tiers for mechanical work,
top tier only where judgment matters), and the M4/M5 review's job-lifecycle-triplication
finding — the pipeline is the principled unification of the order/narration/context job
pattern, and the substrate for all future glue (badges, deferral answers, faithfulness
checks, evals).
