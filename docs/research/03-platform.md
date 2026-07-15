# 03 — Delivery platform research

Research date: 2026-07-15. Question: what should code-story be delivered as — a VS Code
extension, a local web app, a hybrid, or a Zed extension? Evaluated against the vision
([../vision/vision.md](../vision/vision.md)): book-order sub-file chunks, diff + non-diff context
interleaved with unmistakable visual distinction, instant navigation in **both** old and new
versions, AI comment threads whose iterations are verbatim patches, painless manual edits of the
working tree, sub-file progress tracking, collapsible chunks, a possible queue/"deck" UX, and
syntax-aware chunking across C# and Svelte/TS (languageforge/lexbox).

Shorthand for the needs, used in scoring:

| # | Need |
|---|------|
| N1 | Sub-file chunks in a custom, non-linear reading order ("book") |
| N2 | Diff hunks interleaved with non-diff context, visually distinct |
| N3 | Go-to-definition/references in old AND new versions, instant |
| N4 | Inline AI threads; each AI iteration an exact verbatim patch |
| N5 | Painless manual editing of working-tree files |
| N6 | Sub-file review-progress tracking |
| N7 | Collapsible/expandable chunks (100% of diff always reachable) |
| N8 | Queue/"deck" UX popping diff segments |
| N9 | Syntax-aware chunking (tree-sitter/LSP), multi-language |

---

## 1. VS Code extension platform — capabilities and hard limits

### 1.1 Comments API (`CommentController`)

The [Comments API](https://code.visualstudio.com/api/references/vscode-api) (see the official
[comment sample](https://github.com/microsoft/vscode-extension-samples/blob/main/comment-sample/src/extension.ts))
is the strongest single argument for VS Code:

- An extension creates a `CommentController`, provides a `commentingRangeProvider` (which URIs and
  ranges can host threads), and creates `CommentThread`s at `(uri, range)`. Threads render inline
  in any matching text editor **including both sides of diff editors** (this is exactly how the
  GitHub PR extension renders review comments), and also aggregate into the built-in Comments
  panel.
- Comment bodies are `MarkdownString`s: fenced code blocks render with syntax highlighting, so
  **an AI iteration shown as a verbatim ```diff block inside a thread is natively supported**
  (N4). Trusted markdown supports `command:` links, so "Apply patch / Reject" buttons can live in
  the comment body; richer actions come from menu contributions keyed on `contextValue`
  (`comments/comment/title`, `comments/commentThread/context` etc.).
- Threads have `collapsibleState`, `canReply`, resolved/unresolved `state`, author icons; custom
  reactions require you to supply a `reactionHandler` — the *set* of reactions is yours, the
  *rendering* is VS Code's.
- Hard limits: the thread UI itself is not restylable (it's VS Code's widget — you control content
  and menus, not layout); you [cannot query or interact with other extensions'
  comments](https://github.com/microsoft/vscode/issues/200371); marking "which comments are mine"
  has long-standing gaps ([#143005](https://github.com/microsoft/vscode/issues/143005)). For a
  thread with a *live agent* on the other end, streaming into a comment body means repeatedly
  replacing `thread.comments` — workable (the GitHub PR extension's Copilot integration does
  something similar) but clunky compared to owning the DOM.

Verdict: N4 is genuinely well-served natively. This API is also how
[CodeTour](https://github.com/microsoft/codetour) implements step-by-step guided walkthroughs —
proof that "guided reading anchored to lines, with next/previous navigation" can be built on the
comment widget alone.

### 1.2 Virtual documents (`TextDocumentContentProvider`)

`workspace.registerTextDocumentContentProvider(scheme, provider)` serves read-only documents under
a custom URI scheme ([docs](https://code.visualstudio.com/api/extension-guides/virtual-documents)).
The built-in git extension serves old revisions this way (`git:` scheme); GitLens (`gitlens:`) and
the GitHub PR extension (its review schemes) do the same. Virtual docs get full syntax
highlighting, folding, decorations, and can be either side of a diff editor. They are the
mechanism for "show the old version of X". Their weakness is §1.9: language services mostly
ignore them.

### 1.3 Diff editors: `vscode.diff` and the multi-diff editor

- `vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title, options)` opens the
  native diff editor over any two URIs (file, virtual, untitled) — the workhorse of every review
  extension ([commands reference](https://code.visualstudio.com/api/references/commands)).
- `vscode.changes` (same reference) opens the **multi-diff editor**: one scrollable editor of many
  per-file diffs, each collapsible ([expand/collapse all
  shipped](https://github.com/microsoft/vscode/pull/199623)). Order of entries is the order you
  pass — so *file-level* custom ordering is possible.
- The native diff editor gives collapsed unchanged regions (`diffEditor.hideUnchangedRegions`),
  inline/side-by-side toggle, and moved-code detection.
- **Hard limits, and they are the crux:** you cannot reorder *hunks within* a diff, you cannot
  interleave arbitrary non-diff blocks (callee bodies, prose) between hunks, you cannot splice
  content from multiple files into one diff surface, and you cannot restyle how a hunk is drawn.
  The unit of composition is "a whole file pair". N1/N2 at sub-file granularity are **not
  achievable in the native diff editor, period.**

### 1.4 Custom editors and the new custom *diff* editor proposal

The [Custom Editor API](https://code.visualstudio.com/api/extension-guides/custom-editors) lets an
extension own the entire surface for a resource — but it's webview-based, applies to resources
matching a registered selector, and explicitly lists embedding VS Code's real text editor as a
non-goal. Historically diffs of custom-editor resources opened as *two side-by-side webviews*,
useless for unified rendering. In late 2025 the `resolveCustomDiffEditor` proposal
([microsoft/vscode#298924](https://github.com/microsoft/vscode/issues/298924), milestone 1.120,
insiders-released) added a single webview receiving both documents — i.e. **fully custom diff
rendering is arriving**, but (a) it is a proposed API, unusable in Marketplace-published
extensions until finalized, and (b) it's still "a webview you fill yourself" — VS Code contributes
chrome, not editor features.

### 1.5 Webview panels and webview views

Webviews ([guide](https://code.visualstudio.com/api/extension-guides/webview)) are sandboxed
iframes with a message channel to the extension host: any HTML/JS, virtual scrolling, drag/drop,
arbitrary layout — the "book" could be drawn here. Reality checks:

- **No native editor features inside**: no VS Code IntelliSense, no user keybindings by default
  (you must re-dispatch), no find widget beyond a basic one, no comment widgets.
- **Monaco can be embedded but is a separate copy of the editor** — it won't pick up the user's
  theme/settings/extensions, TextMate grammars aren't available in stock Monaco, and maintainers
  describe it as "a lot of work" with a strange half-native feel
  ([discussion](https://github.com/microsoft/vscode-discussions/discussions/74), open feature
  request [#196705](https://github.com/microsoft/vscode/issues/196705)).
- **Syntax highlighting is solvable without Monaco**: [Shiki](https://shiki.style/) uses VS Code's
  own TextMate engine; a documented pattern streams the user's installed grammars + active theme
  JSON from the extension host into the webview, matching editor rendering pixel-for-pixel
  ([Code Telescope write-up](https://dev.to/guilhermeccosta/how-code-telescope-handles-syntax-highlighting-in-a-vs-code-webview-41o2)).
- Webview *views* put webviews in the sidebar/panel — right shape for a "deck" or thread panel.
- Cost: `retainContextWhenHidden` keeps the whole page alive (memory), and everything inside is
  yours to build.

Conclusion: inside VS Code, the book surface is buildable **only** as a webview — at which point
you are writing a web app that happens to live in a VS Code tab.

### 1.6 Marking progress and structure: decorations, CodeLens, folding, FileDecorationProvider, TreeView

All solid, all editor-attached:

- `TextEditorDecorationType` — gutter icons, background tints, borders; ideal for
  "reviewed/unreviewed range" tinting in real editors and diff editors (N6 within a file).
- `CodeLensProvider` — clickable per-range actions ("mark reviewed", "expand context") above any
  line, works on virtual docs too.
- `FoldingRangeProvider` — custom collapse units (e.g. per-chunk) in real editors (N7, partially).
- `FileDecorationProvider` — badges/colors on Explorer and TreeView items ("3/7 chunks
  reviewed").
- `TreeView` — fully custom tree in a view container, with checkboxes (native since 1.80),
  drag/drop, and `reveal()`; the natural home of a chunk queue (N8 as a list, not as "cards").

These give a decent *file/чunk index + progress* story, but always alongside VS Code's own
editors — they decorate, they don't compose a new reading surface.

### 1.7 Notebook API as a "book" renderer — seriously evaluated

The [Notebook API](https://code.visualstudio.com/api/extension-guides/notebook) is the only
non-webview surface in VS Code that renders **an ordered sequence of mixed cells** — markdown
(prose/context) + code cells (real Monaco editors with real language modes, theming, folding) —
plus [custom renderers](https://github.com/Microsoft/vscode-extension-samples/tree/main/notebook-renderer-sample)
(webviews) for cell outputs. A "review book" as a virtual notebook: markdown cells for narrative,
code cells for context snippets, and diff hunks as custom-rendered outputs is a genuinely clever
fit for N1/N7 (arbitrary cell order, per-cell collapse).

Why it still loses:

- Diff hunks would live in *output* renderers (isolated webviews) — you're back to hand-rendering
  diffs, now inside a stricter sandbox, one iframe per cell (heavy for 200 chunks; VS Code's
  notebook list virtualization helps but output webviews are the expensive part).
- Code cells edit the *notebook document*, not the working tree — N5 requires a bespoke sync
  layer with all its conflict cases.
- Language features in cells require **notebook-aware language servers** (LSP 3.17
  `notebookDocument/*`, [spec](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/),
  good explainer by [Pyrefly](https://pyrefly.org/blog/notebook/)). Python/Pylance supports this;
  **Roslyn C# and svelte-language-server do not** — so N3 dies in cells for exactly our target
  languages.
- Comment threads (N4) are designed for text editors; anchoring them to notebook cells is not a
  supported first-class scenario.

Verdict: the most interesting dead end in the whole investigation. Reserve as inspiration for the
web UI's structure, not as the platform.

### 1.8 SCM API

The [SCM API](https://code.visualstudio.com/api/extension-guides/scm-provider) contributes
repositories, resource groups and quick-diff providers to the Source Control view. Useful only if
code-story wants to *be* a source-control-ish view; the built-in git extension already covers repo
state, and review state fits better in a custom TreeView. Low relevance.

### 1.9 Code navigation on old/new revisions — the hard truth

`vscode.executeDefinitionProvider(uri, position)` works on any document **for which a provider is
registered**. The catch: real language servers register `documentSelector: { scheme: 'file' }`
(see the [LSP guide](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide));
they index the checked-out workspace. Consequences, confirmed across the ecosystem:

- The GitHub PR extension's non-checkout "virtual review mode" explicitly has **no IntelliSense
  and no codebase navigation**; rich navigation requires checking the PR branch out locally
  ([VS Code docs](https://code.visualstudio.com/docs/sourcecontrol/github), independent
  [2026 write-up](https://aicodereview.cc/blog/review-pr-vscode/)).
- The [Gerrit Change Analyzer](https://marketplace.visualstudio.com/items?itemName=turntide.gerrit-change-analyzer)
  advertises "full code navigation on patchsets" — achieved by **checking the patchset out**.
- GitLens revision tabs interact badly with definition providers
  ([gitkraken/vscode-gitlens#301](https://github.com/Axosoft/vscode-gitlens/issues/301));
  cross-revision navigation is a long-open request
  ([#777](https://github.com/eamodio/vscode-gitlens/issues/777)).

So VS Code gives **superb navigation on exactly one version** (whatever is checked out — for a
review, the new version) and essentially nothing on the old version. Making old-side
go-to-definition work would mean serving the old tree (worktree at BASE + second LSP instance, or
a SCIP index of BASE — §6) — the same work the web route needs, minus any head start.

### 1.10 Extensions that push these APIs (what the ceiling looks like)

- [GitHub Pull Requests](https://github.com/microsoft/vscode-pull-request-github) — Comments API +
  virtual schemes + TreeViews + a webview "description" page. Its architecture is the best proof
  of both the power (threads in diffs feel native) and the ceiling (the review is still
  file-after-file native diffs; anything custom is a webview page).
- [GitLens](https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens) — decorations,
  virtual revision docs; its most ambitious UI (Commit Graph) is… a webview.
- [CodeTour](https://github.com/microsoft/codetour) — guided steps via the comment widget; the
  closest existing thing to "reading order" in VS Code, and it's linear, one step at a time, no
  diff integration.
- [SanderRonde/VSCode-Gerrit](https://github.com/SanderRonde/VSCode-Gerrit) — a full external
  review workflow (changes panel, inline comments, voting) squeezed into native surfaces.
- [Sapling ISL's VS Code extension](https://sapling-scm.com/docs/addons/vscode/) — embeds the
  same React ISL app in a webview that `sl web` serves in a browser: the hybrid pattern, shipped
  by Meta (§4).
- [SemanticDiff](https://semanticdiff.com/) — language-aware diffs in VS Code; renders in its own
  view precisely because the native diff editor can't express its output.

The pattern is unmistakable: **everything ambitious inside VS Code becomes a webview.**

---

## 2. What VS Code gives for free vs what it makes hard

| Free (and excellent) | Hard or impossible |
|---|---|
| Real editors: user's theme, keybindings, settings | Custom reading-order surface across files (N1) — webview only |
| Full LSP on the checked-out (new) version | Any LSP on the old version (§1.9) |
| Native diff editor w/ collapsed unchanged regions, move detection | Reordering/interleaving *within* a diff; mixing non-diff context between hunks (N2) |
| Comment threads in editors & diffs, markdown+code bodies (N4) | Restyling the thread widget; streaming agent output elegantly |
| Working-tree editing = just editing (N5) | Controlling whole-screen layout; "deck" cards (N8) |
| Decorations/CodeLens/folding/FileDecorations/TreeView for progress (N6, partial N7) | Custom diff rendering in stable API (proposal only, §1.4) |
| Git integration, file watching, install base, distribution via Marketplace | Webviews: no native editor features, separate highlighting stack, memory cost |

The structural conclusion: VS Code is optimized for *file-shaped* surfaces. code-story's core
surface is *narrative-shaped*. The mismatch is at N1/N2 — the heart of the product.

---

## 3. The web app route (local CLI-served)

### 3.1 Rendering: CodeMirror 6 vs Monaco

- **CodeMirror 6** is the better fit for a book renderer. Its decoration system (inline widgets,
  **block widgets**, replacing decorations) is designed for interleaving arbitrary DOM between and
  around lines — exactly N2. [@codemirror/merge](https://github.com/codemirror/merge) ships a
  `unifiedMergeView` that renders deleted content as widgets inside a single editor, with
  accept/reject chunk buttons and inline-diff display options — a working skeleton of "diff hunk
  as an editable, decorated document". Many small editors on one page is a supported,
  cheap pattern (each CM instance is light); syntax via [Lezer] or tree-sitter-backed
  highlighting; theming is CSS.
- **Monaco** gives the VS Code diff editor verbatim (side-by-side, inline, moved-code) and
  [monaco-languageclient](https://github.com/TypeFox/monaco-languageclient) for LSP wiring, but is
  heavy per-instance (many-editors-per-page is not its design point), and its layout model fights
  "document with embedded editors".
- Pragmatic mix: CodeMirror for the book (dozens of chunk editors per page), and — if ever needed —
  one Monaco diff editor as a "full-file diff" escape hatch. Static context snippets can even be
  plain [Shiki](https://shiki.style/) HTML until interacted with (zero-cost until hydrated).

### 3.2 Language intelligence: a local daemon running real LSPs

The pattern is mature: a local server speaks WebSocket JSON-RPC to the browser
(`vscode-ws-jsonrpc`), spawning stdio language servers per language
([monaco-languageclient docs and examples](https://github.com/TypeFox/monaco-languageclient/blob/main/docs/index.md));
the client side works with CodeMirror too (the LSP plumbing is transport-level, several
`codemirror-languageserver` bridges exist). For lexbox:

- **TS/Svelte**: `typescript-language-server` / `svelte-language-server` — trivial to spawn,
  open-source.
- **C#**: Roslyn's `Microsoft.CodeAnalysis.LanguageServer` (MIT-licensed in the roslyn repo,
  though the C# *extension* packaging is proprietary) or the fully open `csharp-ls` — spawnable,
  needs a solution load; slower startup, so the daemon should keep it warm.

Key advantage over VS Code: the daemon can run **two** instances of each server — one on the
working tree (new), one on a `git worktree` checkout of BASE (old) — giving live, symmetric
old+new navigation (N3) that no editor extension currently offers. Disk-cheap, memory-costs one
extra server set; SCIP (§3.3) is the lighter alternative.

### 3.3 SCIP indexes: navigation without a live LSP

[SCIP](https://github.com/scip-code/scip) ([Sourcegraph's LSIF successor](https://sourcegraph.com/blog/announcing-scip);
protobuf, ~8x smaller, 3x faster to process than LSIF) is a *precomputed* index of
definitions/references per snapshot:

- [scip-typescript](https://github.com/sourcegraph/scip-typescript) — mature, fast (1k–5k loc/s),
  cross-project.
- [scip-dotnet](https://github.com/sourcegraph/scip-dotnet) — **exists and is alive**: Roslyn-based,
  v0.2.14 (May 2026) on .NET 10 SDK ([releases](https://github.com/sourcegraph/scip-dotnet/releases));
  also consumed by [Glean](https://glean.software/docs/indexer/scip-dotnet/).
- Index BASE and HEAD once at ingest (background, fits the vision's "slow AI work is bulk"),
  load both into the daemon → **instant, zero-LSP go-to-def/refs on both versions**, hyperlink
  every identifier in every chunk ahead of time. Live LSP remains for the working tree as edits
  accumulate.
- [stack-graphs is dead](https://github.com/github/stack-graphs) — archived by GitHub on
  2025-09-09; do not build on it.

This is the single biggest *positive* differentiator of the daemon route: N3 becomes better than
what any editor gives, not a compromise.

### 3.4 tree-sitter for chunking

[web-tree-sitter](https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web) runs all
grammars (C#, TypeScript, Svelte, …) in WASM, incrementally, in Node or the browser; the daemon
parses both file versions, maps hunks to enclosing functions/methods/blocks, and emits semantic
chunks (N9). Prior art for the mapping problem:
[difftastic](https://difftastic.wilfred.me.uk/) (tree-sitter CSTs + Dijkstra over a graph of tree
edits; explicitly *not* a patch producer — [tricky cases](https://difftastic.wilfred.me.uk/tricky_cases.html)
document where structural diffing bites), [diffsitter](https://github.com/afnanenayet/diffsitter),
and the GumTree AST-matching family. Recommendation: keep git's line diff as ground truth
(guarantees "100% of the diff represented", and patches stay `git apply`-able) and use tree-sitter
only to *segment and label* it — difftastic's experience says full structural diffing costs
patch-applicability, which the vision's verbatim-patch requirement can't give up. Market
validation that ordering/grouping is the right axis: [CodeRabbit's dependency-ordered
walkthrough](https://www.coderabbit.ai/blog/coderabbit-review-reads-a-pr-how-author-would-explain-it)
and research on review file-ordering effects
([arxiv](https://arxiv.org/pdf/2306.06956)).

### 3.5 Serving pattern: CLI + localhost, proven repeatedly

- [Sapling ISL](https://sapling-scm.com/docs/addons/isl/): `sl web` starts a local server +
  React UI ([command](https://sapling-scm.com/docs/commands/web/)); the *same* UI is embedded in
  a VS Code webview by their extension.
- [opencode](https://opencode.ai/docs/server/): `opencode serve` = headless HTTP API;
  `opencode web` = same daemon + browser UI; TUI can attach to the same server — one core, many
  clients.
- [Aider `--browser`](https://aider.chat/docs/usage/browser.html) — LLM pair-programming over a
  local git repo through a browser UI.
- Sourcegraph's [cody-agent](https://www.npmjs.com/package/@sourcegraph/cody-agent) — headless
  JSON-RPC core reused by JetBrains/Neovim clients: the "editor-agnostic brain" pattern.

`code-story review <branch>` → daemon (indexer, tree-sitter chunker, agent orchestrator, SQLite
state) → opens `http://127.0.0.1:PORT`. Bind loopback only; auth token in the URL (opencode and
ISL both do this).

### 3.6 Desktop shell — defer

[Tauri 2 vs Electron in 2026](https://www.buildmvpfast.com/blog/tauri-v2-vs-electron-desktop-apps-2026):
Tauri = OS webview, tiny (MBs vs ~85MB), lower RAM; Electron = bundled Chromium, consistent
rendering. A localhost web app needs neither on day one — the browser is the shell, DevTools are
the debugger, and a Tauri wrapper can be added later for window management/menu polish without
architectural change. Do not start with Electron for a tool whose core is a local daemon.

### 3.7 Honest pain points of the web route

- **Manual editing (N5)** is the real casualty: an in-browser CodeMirror edit-and-save (daemon
  writes the file, watches for external changes) is fine for small touch-ups, but it will never be
  the user's real editor. Mitigation is the hybrid handoff (§4): every chunk gets an
  "open in editor" affordance (`vscode://file/<abs>:<line>:<col>` deep links or `code --goto`
  from the daemon) — plus the vision's own bet that most modifications flow through **agent
  patches**, which the daemon applies and re-diffs regardless of UI.
- You rebuild comment-thread UI, keybinding handling, find-in-page, theme (light/dark) — real
  work, but bounded, fully under your control, and the kind of UI code AI agents produce well.
- Two-version LSP/SCIP infrastructure is on you — but §1.9 showed VS Code wouldn't have carried
  that anyway.

---

## 4. Hybrid: daemon + web UI + thin editor extension (recommended pattern)

Prior art says the winning shape for tools whose UI outgrows editor APIs is:

**One local daemon** (owns: git/worktrees, tree-sitter chunking, SCIP indexes + LSP pool, agent
orchestration/MCP-ACP endpoint, review state in SQLite) **+ a browser UI** as the primary surface
**+ a thin VS Code extension** that (a) embeds or links the same UI (Sapling ISL's exact move),
(b) provides `openInEditor(file, line)` handoff and jumps back, (c) optionally mirrors threads as
native comment threads and reviewed-ranges as decorations for people who live in the editor.
Examples of every leg: ISL (web+VS Code webview), opencode (serve + web + TUI attach), cody-agent
(JSON-RPC core, many editor skins), Aider (CLI + browser). Nothing about this pattern is exotic
in 2026; it is how local dev tools with strong opinions about UI ship.

The thin extension is *optional at v1* — deep links (`vscode://file/...`) already work from a
browser with zero extension installed, which keeps the editor-handoff painless even for JetBrains
(`jetbrains://` URLs) or terminal editors later.

## 5. Zed — verdict: not viable as a platform (2026)

Zed extensions are WASM/WIT sandboxed and can contribute: language servers, grammars
(tree-sitter), themes, snippets, slash commands, context/agent servers, debug adapters —
**and no UI whatsoever**: no panels, no webviews, no comment threads, no custom views
([Life of a Zed Extension](https://zed.dev/blog/zed-decoded-extensions),
["Are the extensions so limited?"](https://github.com/zed-industries/zed/discussions/31602),
open [RFC for a visual extension API](https://github.com/zed-industries/zed/discussions/53403)).
Until that RFC lands, code-story-on-Zed is impossible beyond a slash command. Zed *is* relevant as
an agent client (ACP), and the hybrid's browser UI serves Zed users fine.

## 6. Syntax/structure tooling summary

| Tool | Role for code-story | Status |
|---|---|---|
| [web-tree-sitter](https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web) | Chunk hunks into functions/members; label change types | Active, all target langs |
| [difftastic](https://github.com/Wilfred/difftastic) | Design reference for structural diffing (not a dependency — output not patch-safe) | Active |
| [diffsitter](https://github.com/afnanenayet/diffsitter) / GumTree | AST-diff alternatives; same caveat | Active/academic |
| [SCIP](https://github.com/scip-code/scip) + [scip-typescript](https://github.com/sourcegraph/scip-typescript) + [scip-dotnet](https://github.com/sourcegraph/scip-dotnet) | Precomputed old+new def/refs; hyperlink every identifier | Active (scip-dotnet v0.2.14, May 2026) |
| LSP servers (`typescript-language-server`, `svelte-language-server`, Roslyn LS/`csharp-ls`) | Live working-tree intelligence in the daemon | Active |
| [stack-graphs](https://github.com/github/stack-graphs) | — | **Archived 2025-09-09; avoid** |

## 7. Scoring and verdict

Scores 1–5 (5 = best). "VS Code ext" = native-surfaces-first extension (diff editors + comments +
trees, webviews only where forced). "Web+daemon" = browser UI only. "Hybrid" = §4.

| Criterion | VS Code ext | Web+daemon | Hybrid |
|---|---|---|---|
| Implementation effort (5 = least) | 2 — fighting APIs at N1/N2; webviews anyway | 3 — build UI, but no platform fights | 3 — web+daemon plus a thin, optional extension |
| UX ceiling for the "book" (N1,N2,N7,N8) | 1 — impossible in native diff surfaces; 3 if fully webview (then why VS Code?) | 5 — full control | 5 |
| Old+new code navigation (N3) | 2 — new side only; old side needs the same daemon work | 5 — dual LSP + SCIP on both revisions | 5 |
| AI threads w/ verbatim patches (N4) | 4 — Comments API is genuinely good | 4 — build it, but own streaming/layout | 4–5 (both surfaces possible) |
| Manual-edit painlessness (N5) | 5 — it's the editor | 2 — in-browser edits + save | 4 — deep-link handoff + agent patches |
| Sub-file progress (N6) | 3 — decorations/trees, fragmented | 5 — first-class in the data model & UI | 5 |
| Syntax-aware chunking (N9) | 4 — same daemon logic, awkward host | 5 | 5 |
| Cross-editor reach | 1 — VS Code only; Zed/JetBrains excluded | 5 — any browser | 5 |
| Maintainability (small team + AI agents) | 2 — API ceilings, proposed-API churn, extension-host constraints | 4 — ordinary web stack, easily agent-codeable | 4 |

**Recommendation: the hybrid — a local daemon with a browser-based book UI as the primary
surface, plus editor deep-link handoff (thin VS Code extension later, optional).** The product's
identity *is* the reading surface, and §1 establishes that VS Code cannot draw that surface with
native parts — every serious precedent (GitHub PRs' description page, GitLens graph, ISL,
SemanticDiff) retreats to webviews, which buys VS Code's constraints without VS Code's editors.
Meanwhile the two capabilities that looked like VS Code trump cards dissolve on inspection:
old-version navigation doesn't exist there either (§1.9), and manual editing is recoverable via
handoff plus the agent-patch loop that the vision centers anyway. The daemon route uniquely
delivers N3 *better than any editor* (dual SCIP/LSP), keeps the tool harness- and editor-agnostic
(a stated constraint), and concentrates the team's work in plain web + Node/CLI code — the stack
AI agents are strongest at.

**Runner-up: VS Code extension, native-surfaces-first.** Choose it only if the book paradigm is
negotiable down to "curated multi-diff order + CodeTour-style guided steps + comment threads"
(N1/N2 at file granularity, not chunk). It ships faster to a v0.5, inherits N4/N5 for free, and
`resolveCustomDiffEditor` may eventually reopen the rendering question — but it caps the product
at a better GitHub-PR extension rather than the thing the vision describes. A pragmatic hedge the
hybrid preserves: because chunking/ordering/threads/patches all live in the daemon, a future
VS Code (or Zed, post-RFC) front-end is a client, not a rewrite.
