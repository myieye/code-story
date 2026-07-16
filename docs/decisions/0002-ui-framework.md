# ADR 0002 — Book UI framework: React

Status: **accepted** — chosen by Tim 2026-07-16 (milestone-0 scoping)
Date: 2026-07-16

## Decision

The browser book UI (ADR 0001 §2) is built with **React** (+ TypeScript + Vite).

## Alternatives considered

- **Svelte 5** — Tim's daily stack (lexbox is Svelte/TS); recommended by Claude for stack
  alignment. Not chosen.
- **Plain TS / lit-html** — minimal dependencies, but hand-rolls the panel/state plumbing the
  product will need.

React's case as presented at the decision: largest ecosystem of ready-made components and
CodeMirror 6 wrappers, and the most example code for agents to pattern-match during an
agent-heavy build.

## Consequences

- CodeMirror 6 owns the book document itself (it is framework-agnostic); React owns only the
  shell (panels, queue, controls). A later framework change would be contained to the shell.
- The dogfood target (lexbox) stays Svelte, so sessions switch idioms between product code and
  reviewed code.
