# Addendum — review-UX feedback round (Tim, 2026-07-20)

Tim's second round of concrete feedback from driving the tryable product (after the
first round landed as PRs #118/#119: mouse-first mark button, reviewed-state visuals,
Files view, draggable sidebar). Verbatim, as received:

> It should be more obvious what piece (e.g. 1 / X) Each segment is in its respective file e.g. so I know if there's more and how much and so I can jump to different pieces in that file (probably in place e.g. step through? with a jump back to the primary chunk that this piece represents. or I can just say "Show all the chunks like GitHub does right here".
>
> there should also be some sort of visual linking between what I see and the items in the sidebar
>
> Design and build a good pattern for things being automatically reviewed as a reviewer goes through content.
>
> keyboard shortcuts are handy, but I want mouse navigation to be a first-class citizen. don't assume a user will use keyboard shortcuts.
>
> I definitely want narration on chunks. what's blacking that?
>
>  also a short blurb or tag like "Minor refactor", "Simple Optimization". e.g. a badge that summarizes the chunk into usually 2 words.
>
>
> if you have questions for me ensure you always/each time ask them clearly with enough context (at least one question - the one with the biggest bang for our buck in terms how how much it unblocks)
>
> Also reviewing can be a drag, so think of great ways to make it more satisfying. e.g. clear progress indicators. nothing too distracting, but something that wows the reviewer is definitely worth considering.
>
> It would also be really helpful if it was somehow clear WHY the chunks landed in the order they're in. maybe narration handles that, maybe we need a quick blurb that connects each 2 sections.
>
> use subagents to protect your context windkw. you'll be working long
>
> be fully autonomous.oly ask me things that absolutely need me. you can do thorough research that's better than most answers I can give you.
>
> think through what the user/reviewer sees and if it makes sense for them and optimizes the review process to the max.
>
> We still need tools for deferring specific lines to the end of the story sometimes with a comment for myself and sometimes with a promt for AI that runs in the background and is then ready for me when I get to the end. (deferring in that case should probably be the default, but not required i.e. it can also just happen inline)
>
> surely there's a lot more in the spec that you can build without answers from me.

Traced as R-051–R-059 in the [inventory](../requirements/inventory.md). Two lines are
process, not product, and live in CLAUDE.md's working agreements instead: the
ask-at-least-one-highest-value-question rule, and the standing autonomy/subagent guidance.
"I definitely want narration on chunks" is also a decision: it answers the steer #115 asked
for (narration must be visible in the default chapter mode) and reframes #54 — the want is
established; the remaining question is quality (faithfulness floor, #58), not whether.
