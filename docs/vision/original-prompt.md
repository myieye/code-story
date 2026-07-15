# Original vision prompt (verbatim)

> Persisted verbatim per the author's request, so future passes can verify that
> everything in it is adequately considered and reflected in the final result.
> Date: 2026-07-15. Author: Tim Haasdyk.

---

AI is great at spewing out code, but that means more diff reviewing for humans.
Human code can also be a lot of work to review.
Part of the problem is that classic reviewing tools, just show a wall of diffs, 1 file after another. That is almost certainly never the most efficient way or order to understand and evaluate the changes.
We need to find the best way to harness the power of AI to ease the process of diff reviewing.
I'm thinking a tool that helps process each segment of code with all the relevant context. There are several things to consider:
-Don't exclude any part of the diff/branch/PR. But, certainly some things can potentially be initially collapsed.
-Likely smaller chunks then the file-level
-Potentially shows the diff itself as well as maybe some of the methods that the diff calls. Needs to be clear what the diff is and what is not the diff
-Even with potential help like the previous bullet, it should be possible to seamlessly navigate to/view code referenced by the diff (both old and new). Should be fast.
-Potentially a way to annotate/comment on the code. As a thread that is either local only for iterating with AI (i.e. I start a thread and Claude ony machine replies in the context of the same thread rather than just giving me a walk of text about what it changed). When AI changes the referenced code, it should be easy to see each version (different diffs likely associated with there's comments). The system would need a way to ensure that the diffs truly line up with what is displayed. Perhaps AI never actually writes code directly, but only writes gut patches and then applies those and links them to comments? Sounds a bit slower than optimally but it also sounds like one good way of ensuring that the diffs are well structured in the context of the reviewing tool and are definitely perfectly represented. (Do you know what I'm going for? I just want to ensure AI can view different iteration versions and be confident that the change that AI made that is related to the comment it left is truly displayed in its entirety when viewing the version of the code related to AI's comment.)
-It should obviously be totally painless for me to edit the code manually.
-Generates "context payload" for code/lines/methods/elements/classes/files that thinks it needs it, but allows loading the same context easily on-demand for any part of the diff (and maybe any code at all)
-Considers code complexity, the skill of the reviewer vs the author, the knowledge of the reviewer regarding tools, languages, packages, parts of the code base etc (also compared to the author, but that's not the only metric)
-Detects change types: generated, especially complex changes, tricky parallelism, UI code (UI presents a unique challenge in that you often need to jump back and forth between the UI code e.g. html and the code it references/uses e.g. handlers and variables, whether it's a web framework or C# UI)
-Some stuff needs thorough contextual descriptions, some can be easily collapsed
-Will probably never know exactly what things need thorough context
-Perhaps the reviewer typically does a first sweep, noting things they want context for? Loading context can take time, so when possible doing it in bulk would be preferable).
-User should be able to track what parts they've already reviewed. (Not just files scope like GH)
-Should also provide UI and/or automatic suggestions for things that should feed into agent instructions (repo or user/local/global) (E.G. regression JSON desirialization files might need agent instructions about how to validate whether added JSON is worth keeping)
-I should be able to mark code as essentially viewed and reviewed, but with one thing/comment I need clarification on. That perhaps "closes" that code area in general, but kicks of an AI enquiry that will be presented again later on essentially deferring the little tricky things. So often I have to rereview a whole file just because there was only one thing I didn't grasp and because review tools only support seeing an entire file.
-It should consider who the pr/code author is. If it's my/my agent then it should be helping work out every wrinkle and not shy from not picks. Of it's someone else's then we're more looking for real bugs and clear objective improvements.
In this tool:
-AI does ground work to augment the original diff with useful context and explanations. Fairly granular: most methods, but also smaller pieces of larger methods/chunks of code.
-AI is readily available for iterating, explaining and refactoring.
-Every AI change/version of every piece of code is easily viewable
-There needs to be insurance that all the code is handled to some extent. e.g. treat the whole diff as a queue and pop things until everything's been processed. The entire diff needs to be represented and accessible. However, there should not be a restriction only letting each diff section appear only once in the final outcome. Things that are used multiple times (e.g. when explaining other areas or showing code flows/paths in other areas) should potentially be marked noting that it's the nth time I'm seeing it and letting me jump between the different occurences.
Do you catch the vision? Reviewing code requires structure, flow, context and power tools. Sometimes it's complex backend stuff. Sometimes HTML/svelte is the most work, because, sometimes a rather simple structured backend feature requires a new HTML dialog, which can sound small and look small visually, but be a huge painful HTML diff. I.e. UI code is often very diluted, while backend code tends to be more dense. Is that true? If I'm right, those are potentially 2 ends of a spectrum that demonstrate that different kinds of code need different handling in the tool I'm dreaming of. So much HTML, CSS classes, little js helper methods, lots of jumping between JS and HTML trying to figure out if the flow really makes sense, if the UI shows a good loading state in the right place(a) at the right time etc.
I bet there's a bunch more to consider.
Is there a tool out there that can do this?
Is this a VS Code plugin or a new web app?
I need to be able to use my Claude subscription. Maybe we need something like lavish-axi? I have no idea how it passes messages back and forth between the generated webpage and the Claude session. Oh, it writes to a file.
What I'm describing is probably resemblant of Devin's "flags" or how Devin AI summarizes code. Maybe it does most of what I want, but I don't think it actually lets me dig into the code base quickly.
AI should not be used for anything that a script can easily handle. Scripts are way faster and free. We could certainly pull in heavy dependencies that can parse syntax. But, only if that would clearly add value. VS code would get us a lot for free.
Our tool needs to be agent harness/tool agnostic. E.g. MCP server or just our own write-to-file protocol or similar. Maybe AXI (e.g. lavish AXI)? I'm not quite sure what that is, but it sounds desirable.
One paradigm that might be worth exploring is the idea of making the diff/PR/branch sort of read like a book, with every piece of code being explicitly referenced (with a reasonable granularity). That format could potentially be fed to an AI model to assess the "readability" of the "book". That's not the whole idea/behaviour/feel of the tool I'm envisioning, but it sounds like a decent paradigm.
If we build this ourselves, there are probably a lot of requirements to flesh out. I'm heard that some Internet presence named "Matt" or someone has a popular collection of skills and at least one is for turning an idea into an AI pipeline of GH issue creating and processing.
This prompt is absolutely loaded with tidbits that I care about. Persist it verbatim, so we can do future passes on it ensuring that everything is adequately considered and reflected in the final result.
This is essentially an entire product with all sorts of UX aspects. We will use the ux-expert for lots of things as we build it. If we get this right, we can transform painful scrolling and code navigating up and down, back and forth into a linear process that makes sense, walks us through the code and makes iterating easily.
You're an expert on code, reviewing practices, optimization etc. Surely you have a feel for what I'm after here and whether this is something someone has already built or not.
Whatever it is, it should be AI harness agnostic e.g. I should be able to use my Claude code subscription, but anyone with a local agent from a different product should also be able to use it. So, some sort of clean protocol is necessary. Either an existing one or our own.
What do we need to hammer out before we start building?
-Does it already exist?
-How will we flesh out a spec?
-What tools should we use so you can work on this iteratively, creating issues, recording bugs, trying it out on real PRs, evaluating the results, improving it, noting limitations, ensuring humans are really in the forefront being empowered to easily review, not being convinced by AI that the code is perfect, but rather being able to easily and effectively critique it.
Start digging into this problem space as thoroughly as possible without asking questions up front, because I'm afk.

languageforge-lexbox is a project/repo I would use the reviewing tool for, but it should not be limited to that repo.
feel free to use parallel subagents as helpful.
be really thorough. an excellent tool would be immeasurably valuable in this space.

you're working in a brand new repo. feel free to do some basic setup. especially if it looks like we're going to actually build something rather than use an existing (open source) tool. we could also consider forking something.
