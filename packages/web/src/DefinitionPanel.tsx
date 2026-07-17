import type { ContextPayload } from '@code-story/core';

/**
 * Called-code context rendered as a sibling region below the chunk's diff — never inside the CM6
 * merge view (R-006's hard rule). Each definition is a read-only code block captioned `file @ sha`,
 * on its own background so it can't be mistaken for the diff. The panel is a focusable scroll region
 * (tabIndex 0): expanding hands it focus, arrows scroll it, Esc returns to the chunk (see the keymap).
 */
export function DefinitionPanel({
  payload,
  registerEl,
}: {
  payload: ContextPayload;
  registerEl: (el: HTMLElement | null) => void;
}) {
  return (
    <section
      className="definition-panel"
      tabIndex={0}
      ref={registerEl}
      role="region"
      aria-label="Definitions — context, not part of the diff. Press Escape to return to the chunk."
    >
      <p className="definition-panel-note">Context — the code these changes call, as it stands at head. Not part of the diff.</p>
      {payload.facts.definitions.map((def, i) => (
        <div className="definition" key={`${def.file}:${def.symbol}:${i}`}>
          <div className="definition-caption">
            <span className="definition-symbol">{def.symbol}</span>
            <span className="definition-source">
              {def.file} @ {def.sha.slice(0, 7)}
            </span>
            {def.changed && <span className="badge definition-changed">in this diff</span>}
          </div>
          <pre className="definition-body">
            <code>{def.body}</code>
          </pre>
        </div>
      ))}
    </section>
  );
}
