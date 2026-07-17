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

## Same conversation (~08:00Z): the comment doctrine applies to narration

> It's very likely that the commenting instructions in your session are relevant for the
> narration. what do you think?

(Context: Tim's global agent instructions carry a strict code-commenting doctrine — "a comment
is a confession that the code couldn't say it itself"; comment only what code can't carry;
state each rationale exactly once; a wrong comment is worse than none; never state an
unverified cause, a verifiable symptom beats an unverifiable cause; when unsure whether a
comment earns its place, it doesn't.)

## Same conversation (~08:15Z): the chunk graph under the story

> I'm wondering if a linear review path/story is enough. maybe it's a really good backbone.
> but, perhaps it's supported by a thorough code graph of chunks. each chunk is aware of what
> chunks it's related to, which lines are responsible for that relationship and then it's
> clearly visible whether that related/linked chunk is already approved/reviewed or maybe only
> the next step, but not everything behind it etc. and the current chunk CAN be marked
> reviewed before all linked chunks are reviewed.
>
> then the reviewer can traverse the change graph a bit like a mindless lawn mower robot that
> eventually covers everything, criss-crossing through the graph as they seem most
> appropriate. small chunks can be marked as reviewed, to try to radically minimize every
> rereviewing the same chunk twice.
>
> I want you to do thorough research of this idea. compare it to existing tools while
> definitely not letting existing tools tell us it's bad just because no one has done it.
>
> if you're also confident that this is worth doing, then go ahead and incorporate it into
> the spec
