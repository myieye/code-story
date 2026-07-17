# Addendum: ordering preferences — tests, direction, configurability (2026-07-17)

Tim's words, verbatim, from chat (context: Claude had summarized the settled ordering —
dependencies-before-consumers, tests-after-their-impl — and offered a consumer-first A/B
experiment). This corrects a spec-01 scoping misunderstanding: Tim's earlier "impl-then-tests"
answer was given thinking the question was about building code-story itself, not the product's
book ordering.

> I want the tests first, actually. When I answered the question I thought it was about how you
> were going to build code story. Or what are your thoughts about where tests belong?
>
> Also, I think that consumers before dependencies is probably the right order if we truly get
> the chunk/change ordering done well. Then I can smoothly flow through each calling path
> instead of keeping IOU's in my head.
>
> these are probably user preferences. it would be excellent if they were thoroughly
> configurable but that the defaults are what I prefer.
>
> whatever is configured, it sounds like it should be calculated/augmented, by default, by AI.
>
> I'm nervous about running more trials now. they cost a decent amount of tokens, right?

## Follow-up answers (same day, ~07:40Z)

Asked: (1) interim direction before chunk-level interleaving exists; (2) e2e-vs-unit test
placement. Tim, verbatim:

> 1) focus on getting a good consumer first implementation built. that's an mvp goal, so
> whichever oath gets us there fastest - I don't mind
>
> 2) yes, I trust your judgments on the varied test placements depending on kinds. remember it
> should be easy to get more context if e.g. a user finds that seeing only a single specific
> test without setup code is not sufficient.
