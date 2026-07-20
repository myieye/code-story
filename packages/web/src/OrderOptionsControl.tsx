import type { StoryConfig } from '@code-story/core';
import {
  configSummary,
  DIRECTION_OPTIONS,
  orderSourceLabel,
  TEST_PLACEMENT_OPTIONS,
} from './order-options-logic.js';

/**
 * Top-bar control for the two ordering axes (#114): re-orders the book live instead of relaunching
 * with CLI flags. A `<details>` popover — discoverable, keyboard-native, no extra open/close state.
 */
export function OrderOptionsControl({
  config,
  orderApplied,
  busy,
  fileView,
  onChange,
}: {
  config: StoryConfig;
  orderApplied: boolean;
  busy: boolean;
  /** In file view the ordering axes don't apply — the selects are disabled with a one-line note. */
  fileView: boolean;
  onChange: (config: StoryConfig) => void;
}) {
  return (
    <details className="order-options">
      <summary className="bar-button" title="Change the reading order">
        Order: {fileView ? 'by file' : configSummary(config)}
      </summary>
      <div className="order-options-panel" role="group" aria-label="Reading order options">
        <label>
          Reading order
          <select
            value={config.direction}
            disabled={busy || fileView}
            onChange={(e) => onChange({ ...config, direction: e.currentTarget.value as StoryConfig['direction'] })}
          >
            {DIRECTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tests
          <select
            value={config.testPlacement}
            disabled={busy || fileView}
            onChange={(e) => onChange({ ...config, testPlacement: e.currentTarget.value as StoryConfig['testPlacement'] })}
          >
            {TEST_PLACEMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <p className="order-source">
          {fileView
            ? 'File view groups each file’s changes together. Switch to Story view for reading-order options.'
            : busy
              ? 'Re-ordering…'
              : orderSourceLabel(orderApplied)}
        </p>
      </div>
    </details>
  );
}
