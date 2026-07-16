# Addendum (2026-07-16) — "real code editor" features

Tim's words, verbatim (from a build-session conversation):

> Do we have the "real code editor" features anywhere? Stuff like:
>
> * ctrl+click or similar to navigate to definition (does not need to be exactly this, but
>   real-code context should be readily available somehow). Maybe not highest priority, but I'm
>   concerned it would be totally impossible if we didn't plan for it. Maybe we just open a
>   dialog when a user can rummage and navigation as much as they want? But it's not necessarily
>   the main work flow. So perhaps defer?
> * Inline code editing is important
>
> Just incorporate those autonomously where you think they belong.

Traced: amends [R-007](../requirements/inventory.md) (definition navigation — deferrable,
rummage-dialog acceptable, but the architecture must never make it impossible) and reinforces
[R-012](../requirements/inventory.md)/[R-035](../requirements/inventory.md) (inline editing is
important, not a nice-to-have).
