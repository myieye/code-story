# Agent Protocols & Harness Integration Research

Research for a harness-agnostic local code-review tool that drives the user's own coding agent (Claude Code on a Pro/Max subscription; Codex CLI, Gemini CLI, opencode, etc. for other users). Current as of **2026-07-15**.

---

## 1. Riding a Claude subscription programmatically

### Headless Claude Code (`claude -p`)

Official docs: [Run Claude Code programmatically](https://code.claude.com/docs/en/headless).

- `claude -p "<prompt>"` runs one non-interactive turn to completion.
- `--output-format text | json | stream-json`. `json` returns result + `session_id` + `total_cost_usd`; `stream-json` emits newline-delimited JSON events (requires `--verbose`; add `--include-partial-messages` for token-level deltas). `--input-format stream-json` exists for driving multi-turn from stdin.
- Session management: `--continue`/`-c` resumes the most recent conversation in the cwd; `--resume <session_id>` (or name) resumes a specific session. The standard multi-step pattern: capture `session_id` from the first run's JSON, `--resume` it in later steps. Sessions persist on disk per project, so **one session per review thread** is directly supported.
- Permissions in headless mode: `--allowedTools`, `--disallowedTools`, `--permission-mode`, `--dangerously-skip-permissions`, and `--permission-prompt-tool` (route permission prompts to an MCP tool you provide — useful for unattended runs that must never hang).

### Claude Agent SDK (TypeScript / Python)

Docs: [Agent SDK TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript) ([Python](https://code.claude.com/docs/en/agent-sdk/python)).

The SDK (`@anthropic-ai/claude-agent-sdk`, `claude-agent-sdk` on PyPI) **spawns the Claude Code CLI as a subprocess** and speaks its stream-json protocol. Key `query()` options for a review tool:

- `permissionMode`: `default | acceptEdits | bypassPermissions | plan | dontAsk | auto`.
- `allowedTools` / `disallowedTools` (supports scoped patterns like `Bash(rm *)`), plus a `tools` list to remove tools entirely.
- `canUseTool` callback — programmatic allow/deny/modify (`updatedInput`) for any tool call that falls through the static rules. This is the hook for **routing every proposed edit through the host app**.
- `hooks` (PreToolUse/PostToolUse/etc.) directly in SDK options.
- Sessions: `resume: <id>`, `forkSession: true`, `continue`, explicit `sessionId`, `persistSession`.
- Streaming input mode (`prompt` as `AsyncIterable`) for interactive multi-turn; mid-session `q.setPermissionMode()`, `q.interrupt()`, `q.setModel()`.
- Budgets: `maxTurns`, `maxBudgetUsd`, `effort`.
- `mcpServers` config — inject your own MCP server per session.

### Does it work on a Pro/Max subscription (no API key)?

**Yes — and this is the officially sanctioned path.**

- Auth is Claude Code's own: the SDK subprocess reads the credentials created by `claude login` (keychain / `~/.claude` credentials). If you log in with subscription credentials only, SDK and `claude -p` usage bills against the subscription. **Caveat:** an `ANTHROPIC_API_KEY` in the environment can silently switch billing to metered API — a review tool should scrub it from the child env. ([Anthropic help center](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan), [community how-to](https://dev.to/aviv_shaked/how-to-use-your-claude-promax-subscription-with-the-agent-sdk-python-typescript-4emi))
- Anthropic announced a monthly **Agent SDK credit** (Pro $20 / Max 5x $100 / Max 20x $200) covering "Claude Agent SDK usage, the `claude -p` command, and third-party apps built on the Agent SDK" — then **paused the change on June 15, 2026**: as of today, Agent SDK / `claude -p` / SDK-based third-party apps **still draw from normal subscription usage limits**, exactly as before. Watch this — the credit-pool model may return. ([help center](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan), [timeline](https://www.digitalapplied.com/blog/anthropic-claude-credit-overhaul-june-15-2026))

### ToS: the February 2026 third-party OAuth ban

Critical constraint. On **Feb 20, 2026** Anthropic updated its terms: *"The use of OAuth tokens obtained via Claude Free, Pro, or Max accounts in any other product, tool, or service is not permitted."* Server-side blocking rolled out Feb–Apr 2026 and cut off tools (OpenClaw, opencode, NanoClaw, …) that had reverse-engineered Claude Code's OAuth flow to call the API directly on subscription quota. ([winbuzzer](https://winbuzzer.com/2026/02/19/anthropic-bans-claude-subscription-oauth-in-third-party-apps-xcxwbn/), [analysis](https://groundy.com/articles/anthropic-bans-third-party-use-subscription-auth-three-stage-repricing/))

**The line that matters for us:**
- ❌ Forbidden: extracting/pretending-to-be-Claude-Code OAuth tokens and calling the Anthropic API from your own harness.
- ✅ Sanctioned: shelling out to the **`claude` CLI / Agent SDK** so the Claude Code runtime itself makes the model calls. Anthropic's own help article explicitly contemplates "third-party apps built on the Agent SDK" using plan usage; Zed's Claude integration ([claude-agent-acp](https://github.com/agentclientprotocol/claude-agent-acp)) works this way and advertises Pro/Max login.

Rate limits: subscription 5-hour rolling windows plus weekly caps apply; usage is **per-user, not poolable**. A review tool doing bulk background jobs must throttle/queue against those windows (and ideally surface `total_cost_usd` / usage events from stream-json).

---

## 2. ACP — Agent Client Protocol

Site: [agentclientprotocol.com](https://agentclientprotocol.com) · initiated by Zed (Aug 2025), now governed under the `agentclientprotocol` GitHub org.

### What it standardizes

JSON-RPC 2.0, typically over **stdio with the agent as a subprocess of the client** ([overview](https://agentclientprotocol.com/protocol/overview)):

- **Initialization**: version + capability negotiation, `authenticate`.
- **Sessions**: `session/new`, `session/load` (replay/resume an existing session — capability-gated per agent), session modes.
- **Prompt turns**: `session/prompt` → streamed `session/update` notifications: `plan`, `agent_message_chunk`, `tool_call`, `tool_call_update` (pending/in_progress/completed, with diffs/locations), `usage_update`; turn ends with a stop reason (`end_turn`, `max_tokens`, `refusal`, `cancelled`…); `session/cancel` for cooperative cancellation. ([prompt-turn](https://agentclientprotocol.com/protocol/prompt-turn))
- **Permission requests**: `session/request_permission` — the agent asks the **client** before executing a gated tool call; client answers with options (allow once/always, reject). This puts approval policy on our side of the wire.
- **Client-provided file system**: `fs/read_text_file`, `fs/write_text_file` — agents can route file access through the client (unsaved editor state; also an interception point).
- **Terminals**: create/monitor/kill terminal sessions owned by the client.
- Extensibility via `_meta`/custom methods.

Clients are "typically code editors … **but can also be other UIs for interacting with agents**" — a review tool as ACP client is an explicitly intended use.

### Adoption (mid-2026)

- **Editors/clients**: Zed and JetBrains native ([JetBrains ACP](https://www.jetbrains.com/acp/), [Zed blog](https://zed.dev/blog/jetbrains-on-acp)); joint **ACP Registry** launched Jan 2026; Neovim (CodeCompanion, avante.nvim), Emacs (agent-shell), a VS Code ACP-client extension, Devin Desktop (June 2026). Backing/buy-in from Anthropic, OpenAI, Google, GitHub. ~**50 agents** implement the spec as of June 2026. ([ACP progress report](https://zed.dev/blog/acp-progress-report))
- **Agents**:
  - **Claude**: [`@agentclientprotocol/claude-agent-acp`](https://github.com/agentclientprotocol/claude-agent-acp) (renamed from `@zed-industries/claude-code-acp`; v0.59.0, July 2026, Apache-2.0, 122 releases). Wraps the **official Claude Agent SDK** → uses the user's Claude Code login, i.e. **Pro/Max subscription billing**. Supports permission requests, edit review, terminals, TODO/plan updates, slash commands, client-side MCP passthrough. (Community alternates: [Xuanwo/acp-claude-code](https://github.com/Xuanwo/acp-claude-code), a Rust `claude-code-acp-rs`.) Claude Code itself has no built-in `--acp` flag; the adapter is the official path.
  - **Codex**: [`agentclientprotocol/codex-acp`](https://github.com/agentclientprotocol/codex-acp) bridges the Codex **App Server** protocol to ACP.
  - **Gemini CLI**: native `gemini --experimental-acp` ([docs](https://geminicli.com/docs/cli/acp-mode/)).
  - **opencode**: native ACP server ([docs](https://opencode.ai/docs/acp/)). Also Qwen Code, Copilot CLI, Cursor agent, and others.

### Headless ACP clients (precedent for us)

[`openclaw/acpx`](https://github.com/openclaw/acpx) is exactly the shape we'd build: a headless ACP client with **stateful named sessions per repo**, auto-resume of dead agent processes, permission policies (`--approve-reads` default, `--approve-all`, `--deny-all`, JSON escalation policies), and NDJSON event output. Built-in adapters for Claude, Codex, Gemini, OpenCode, Cursor, Copilot + ~10 more, with an `--agent` escape hatch. Related: [acp-bridge](https://github.com/allvegetable/acp-bridge) multi-agent orchestrator; official ACP client libraries exist in TypeScript and Rust.

**Fit for a review tool acting as client: strong.** One caveat: `session/load` support varies by agent; a robust tool keeps its own thread→(agent, session-id) mapping and falls back to re-priming context when an agent can't reload.

---

## 3. MCP — where it fits

### Our tool as an MCP server

Exposing review state as MCP tools/resources (`get_review_thread`, `list_findings`, `submit_patch`, `resolve_thread`, `post_comment`) is the **one integration every harness already supports**: Claude Code ([MCP docs](https://code.claude.com/docs/en/mcp)), Codex CLI, Gemini CLI, opencode, Amp, Copilot — all are MCP clients. It also works when the user is just sitting in their own interactive session, no orchestration needed.

- **Transports**: stdio (local, simplest) and **Streamable HTTP**. The [2026-07-28 spec release candidate](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/) is the largest revision since launch: **stateless core** (protocol-level sessions and the GET stream removed), `Mcp-Method`/`Mcp-Name` routing headers, OAuth/OIDC-aligned authorization, and a **Tasks extension** for long-running work. Server-initiated requests are now only allowed while processing a client request, delivered via Multi Round-Trip Requests (SEP-2322). ([what changed](https://stacktr.ee/blog/mcp-2026-spec-changes)) For a localhost tool, stdio for per-session servers + one Streamable HTTP server for shared state is the pragmatic split.
- **Sampling — do not build on it.** `sampling/createMessage` (server asks the client's model to generate) is **deprecated as of 2026-07-28** (SEP-2577; ≥12-month sunset; "new implementations SHOULD NOT adopt it"). Claude Code never implemented client-side sampling anyway ([anthropics/claude-code#1785](https://github.com/anthropics/claude-code/issues/1785)) — so MCP sampling was never a way to ride the subscription for our bulk generation jobs.
- **MCP Apps** (interactive UI): [SEP-1865](https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp) became the **first official MCP extension, released 2026-01-26** ([announcement](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/), [spec](https://github.com/modelcontextprotocol/ext-apps)). Built with the [mcp-ui](https://mcpui.dev) creators plus OpenAI and Anthropic. `ui://` resources, `text/html` in sandboxed iframes, bidirectional JSON-RPC postMessage. Shipped in ChatGPT, Claude (claude.ai/desktop), Goose, VS Code. **Terminal CLIs don't render MCP Apps**, so our review UI can't rely on it as the primary surface — but it's a nice optional embed for users of GUI clients.

---

## 4. The "lavish-axi" mystery — solved

It's real: [**kunchenguid/lavish-axi**](https://github.com/kunchenguid/lavish-axi) ("HTML is the new markdown. Lavish is the new editor for your HTML artifacts"), by Kun Chen — the ex-Meta L8 whose agentic setup went viral ([ByteByteGo writeup](https://blog.bytebytego.com/p/an-ex-meta-l8s-agentic-engineering)).

**AXI = Agent eXperience Interface** ([axi.md](https://axi.md/), [kunchenguid/axi](https://github.com/kunchenguid/axi)): design principles for **agent-native CLIs** — token-budget-first, zero-install (`npx -y …`), claimed higher accuracy at lower token cost than MCP or ordinary CLIs. Sibling implementations: [gh-axi](https://github.com/kunchenguid/gh-axi), [chrome-devtools-axi](https://github.com/kunchenguid/chrome-devtools-axi).

**How Lavish works** (the pattern the user remembered, slightly refined):
1. The agent (e.g. Claude Code via the `/lavish` skill: `npx skills add kunchenguid/lavish-axi --skill lavish`) writes a plan/diagram/comparison as an **HTML artifact** and runs `npx -y lavish-axi <file>.html`, which starts a background **localhost server (port 4387)** and opens the artifact in the browser with an injected SDK (annotation chrome, feedback controls, Mermaid→Excalidraw editing, layout audits).
2. The human clicks elements / selects text ranges / edits diagrams and **queues feedback**.
3. The agent runs **`lavish-axi poll <file>`** — a **long-poll CLI call that blocks until feedback arrives**, then returns it as structured data (selectors, text ranges, `.excalidraw` scene paths). Session state lives in **`~/.lavish-axi/`** on disk; queued feedback survives disconnects; `status: ended` tells the agent to stop polling.
4. `lavish-axi end/export/share` close out the loop. `lavish-axi setup hooks` installs SessionStart ambient context for Claude Code, Codex, OpenCode, and Copilot CLI.

So it's not literally "webpage and agent write to a shared file" — it's **browser UI → local server queue (file-backed state dir) → agent long-polls via a CLI command inside its own session**. The genius is that the *agent's own tool-use loop* is the transport: no protocol integration with the harness at all, so it works in any agent that can run a shell command. This is directly relevant prior art for our review-thread UI. Its ceiling: the agent only sees feedback when it chooses to poll, and a blocked `poll` occupies a turn — fine for review-response loops, weaker for unsolicited pushes.

---

## 5. File-based / local protocols for talking to a live session

### Claude Code hooks (the richest surface)

Docs: [hooks reference](https://code.claude.com/docs/en/hooks). Events: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`, `PermissionDenied`, `Stop`, `SubagentStop`, `SessionEnd`, `PreCompact`/`PostCompact`, **`FileChanged`** (watch specific files!), and more. Hook types now include:

- `command` (JSON on stdin; exit 2 blocks; JSON out controls behavior),
- **`http`** — POST the event to a local endpoint (perfect for streaming session activity into a review-tool server),
- `mcp_tool` — call a tool on a configured MCP server,
- `prompt` / `agent` — model-evaluated policies.

Control surface: `PreToolUse` returns `permissionDecision: allow|deny|ask` plus **`updatedInput`** (rewrite the tool call); `PostToolUse` can block/annotate results; **`Stop` can refuse to let the agent finish** (`decision: "block"`, reason fed back — the standard trick to keep a session working a queue); `additionalContext` injects text into the agent's context; `SessionStart` + `CLAUDE_ENV_FILE` seeds environment.

### Patterns observed in the wild for binding a session to an external UI

1. **Blocking CLI long-poll inside a tool call** (Lavish): UI queues → agent polls. Harness-agnostic, zero config.
2. **Blocking MCP tool call**: same shape, but typed; our MCP server's `wait_for_review_feedback` tool can simply not return until the human acts (mind harness tool timeouts).
3. **Hooks → local HTTP**: Claude Code `http` hooks push every tool call/stop event to our server; `Stop` hook keeps the session alive while a thread has pending items. Claude-specific.
4. **FileChanged hooks / file watching**: drop a JSON message into a watched path to wake logic; crude but dependable.
5. **stream-json over stdio** (`--input-format stream-json --output-format stream-json` or the SDK's streaming-input mode): a fully interactive, programmatic session — this is what claude-agent-acp itself rides on.
6. Named pipes/sockets: rarely used directly; opencode instead exposes a real HTTP server (`opencode serve`).

Output styles exist for shaping the assistant's prose, but structured behavior is better enforced with system-prompt append (`systemPrompt: {preset: "claude_code", append: …}`) + tools.

---

## 6. Other agent CLIs' automation surfaces

| Harness | Headless exec | Structured output | Session resume | Native ACP | Notes |
|---|---|---|---|---|---|
| **Claude Code** | `claude -p`, Agent SDK | `stream-json` in/out | `--resume`, `--continue`, SDK `resume/forkSession` | via [claude-agent-acp](https://github.com/agentclientprotocol/claude-agent-acp) adapter (Agent SDK, subscription auth) | hooks, `canUseTool`, `--permission-prompt-tool` |
| **Codex CLI** | [`codex exec`](https://developers.openai.com/codex/noninteractive) | `--json` NDJSON events | `codex exec resume <id>` / `--last` | via [codex-acp](https://github.com/agentclientprotocol/codex-acp) bridge | **read-only sandbox by default**; sandbox (`read-only`/`workspace-write`/`danger-full-access`) × approval policies; [**App Server**](https://developers.openai.com/codex/app-server) = long-lived JSON-RPC-over-stdio host (what the IDE ext and codex-acp use) |
| **Gemini CLI** | `-p` / non-TTY ([headless](https://geminicli.com/docs/cli/headless/)) | `--output-format json` (streaming JSON less mature) | weaker; `--approval-mode`, `--yolo` for auto-approve | **native** `--experimental-acp` | free tier makes it a good "bulk" engine for Gemini users |
| **opencode** | `opencode run`; **`opencode serve`** = headless HTTP server with a real client/server API | server API + JSON | server-side sessions | **native** ([docs](https://opencode.ai/docs/acp/)) | lost Claude-subscription auth in the Feb 2026 ban — users bring API keys/other providers |
| **Amp** | `amp -x`; [`--stream-json` + `--stream-json-input`](https://github.com/sourcegraph/amp-examples-and-guides/blob/main/guides/cli/README.md) | stream-JSON both directions | threads (`amp threads`) | not native | now `@ampcode/cli` |
| **Aider** | `aider --message`, Python scripting API | limited | git-history-centric | no | oldest; declining relevance for harness integration |

ACP is the only *cross-harness interactive* surface with real momentum (Zed+JetBrains registry, ~50 agents). Every harness above is also an **MCP client**, and all have some patch-only story: ACP permission gating (client-side), Claude `disallowedTools`/hooks, Codex read-only sandbox, Gemini approval modes, opencode permission config.

---

## 7. Recommendation: hybrid — ACP client core + MCP server + headless subprocess for bulk

**(a) Bulk background context-generation jobs → plain headless subprocess.**
`claude -p --output-format stream-json` (or Agent SDK `query()` with `maxTurns`/`maxBudgetUsd`), `codex exec --json --sandbox read-only`, `gemini -p --output-format json`. These jobs are read-only, parallelizable (one process per job, cheap), and easy to queue offline. Build a small scheduler that (1) caps concurrency, (2) tracks subscription rate-limit windows (back off on limit events in the stream), (3) persists a job queue on disk so work resumes when limits reset. Don't use ACP here — you don't need streaming UI for batch jobs, and process-per-job is simpler.

**(b) Interactive per-thread conversations → tool-as-ACP-client.**
Spawn `claude-agent-acp` / `codex-acp` / `gemini --experimental-acp` / `opencode` per thread (or via an acpx-style adapter registry). ACP gives exactly the review-thread needs: streamed `agent_message_chunk` + `tool_call`/`tool_call_update` for a live UI, `session/request_permission` so **approval policy lives in our tool**, `session/cancel`, plans, and usage updates — uniformly across harnesses. Keep our own thread→(agent, session-id) map; use `session/load` where supported, re-prime where not. Crucially, the Claude adapter is built on the Agent SDK, so it **legitimately bills the user's Pro/Max subscription** — the only sanctioned way to ride it (post-Feb-2026 OAuth ban, direct API reuse of subscription tokens is out).

**(c) Our tool also exposes an MCP server** (stdio per session; optionally Streamable HTTP): `get_thread`, `list_findings`, `post_comment`, and **`submit_patch(diff)`** — the controlled channel for code changes. This one server works in *every* harness, including when the user is chatting in their own interactive Claude Code/Codex session with no orchestration at all (the "meet users where they are" path, and the Lavish-style long-poll tool `wait_for_feedback` fits here too). Skip MCP sampling (deprecated 2026-07-28); treat MCP Apps as an optional GUI embed, not the main UI.

**(d) Patch-only enforcement — belt and suspenders, per layer:**
1. **Universal backstop (don't trust the harness):** run each session in an **ephemeral git worktree/clone**; the only thing that leaves is `git diff` harvested by our tool, surfaced as a patch in the review UI. Even a misbehaving agent can't touch the real tree.
2. Harness-level: ACP — deny `fs/write_text_file` and write-permission requests; Claude — `disallowedTools: ["Edit","Write","NotebookEdit"]` + `canUseTool`/PreToolUse deny + system-prompt append "return changes via submit_patch"; Codex — `--sandbox read-only`; Gemini — restrictive `--approval-mode`.
3. Channel-level: the MCP `submit_patch` tool validates/applies the diff onto the review baseline and records it on the thread.

**Why not ACP-only or MCP-only:** MCP alone can't *drive* the agent (no way to start turns, stream progress, or gate permissions — and sampling is dead); ACP alone doesn't cover users in their own interactive sessions and is overkill for batch jobs. The hybrid uses each protocol for what it uniquely does, and every leg preserves subscription billing by always going through the vendor's own runtime.

---

### Key sources

- Claude headless: https://code.claude.com/docs/en/headless · Agent SDK TS: https://code.claude.com/docs/en/agent-sdk/typescript · Hooks: https://code.claude.com/docs/en/hooks
- Subscription + Agent SDK policy: https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan · June-15 pause: https://www.digitalapplied.com/blog/anthropic-claude-credit-overhaul-june-15-2026 · OAuth ban: https://winbuzzer.com/2026/02/19/anthropic-bans-claude-subscription-oauth-in-third-party-apps-xcxwbn/
- ACP: https://agentclientprotocol.com/protocol/overview · https://agentclientprotocol.com/protocol/prompt-turn · https://zed.dev/blog/acp-progress-report · https://www.jetbrains.com/acp/
- Adapters: https://github.com/agentclientprotocol/claude-agent-acp · https://github.com/agentclientprotocol/codex-acp · https://geminicli.com/docs/cli/acp-mode/ · https://opencode.ai/docs/acp/ · https://github.com/openclaw/acpx
- MCP: https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/ · https://stacktr.ee/blog/mcp-2026-spec-changes · MCP Apps: https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/ · https://github.com/modelcontextprotocol/ext-apps · Sampling gap in Claude Code: https://github.com/anthropics/claude-code/issues/1785
- Lavish/AXI: https://github.com/kunchenguid/lavish-axi · https://axi.md/ · https://github.com/kunchenguid/axi · https://blog.bytebytego.com/p/an-ex-meta-l8s-agentic-engineering
- Codex: https://developers.openai.com/codex/noninteractive · https://developers.openai.com/codex/app-server · Gemini: https://geminicli.com/docs/cli/headless/ · Amp: https://github.com/sourcegraph/amp-examples-and-guides/blob/main/guides/cli/README.md
