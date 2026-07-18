import { useEffect, useRef, useState } from 'react';
import { chipAriaLabel, chipText, type NeighborChip } from './neighbor-strip-logic.js';

/**
 * The lawn-mower strip (spec 05 slice 5): the focused chunk's direct graph neighbors as a horizontal
 * ARIA `toolbar` of clickable chips. Mouse click is the primary jump; the roving-tabindex keyboard
 * model (Left/Right between chips, Enter/Space to follow, Esc back to the chunk) is the accelerator.
 * Overflow scrolls horizontally — the strip never wraps to a second row and is never a canvas.
 */
export function NeighborStrip({
  chips,
  onJump,
  onExit,
  registerEl,
}: {
  chips: NeighborChip[];
  onJump: (chunkId: string) => void;
  onExit: () => void;
  registerEl: (el: HTMLElement | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  // A neighbor changing under a stale index would leave a dangling roving stop.
  useEffect(() => setActive((i) => Math.min(i, Math.max(0, chips.length - 1))), [chips.length]);

  const focusAt = (i: number) => {
    setActive(i);
    ref.current?.querySelectorAll<HTMLButtonElement>('button.neighbor-chip')[i]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') focusAt(Math.min(active + 1, chips.length - 1));
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') focusAt(Math.max(active - 1, 0));
    else if (e.key === 'Home') focusAt(0);
    else if (e.key === 'End') focusAt(chips.length - 1);
    else if (e.key === 'Escape') onExit();
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      className="neighbor-strip"
      role="toolbar"
      aria-label="Related chunks we found — press Escape to return to the chunk"
      ref={(el) => {
        ref.current = el;
        registerEl(el);
      }}
      onKeyDown={onKeyDown}
    >
      {chips.map((chip, i) => (
        <button
          key={`${chip.chunkId}:${chip.kind}:${chip.direction}`}
          type="button"
          className={`neighbor-chip chip-${chip.state}${chip.fileLevel ? ' chip-file-level' : ''}${chip.frontier ? ' chip-frontier' : ''}`}
          tabIndex={i === active ? 0 : -1}
          title={chip.fileLevel ? chip.file : undefined}
          aria-label={chipAriaLabel(chip)}
          // Reconcile the roving pointer with whatever actually took focus — the `g` accelerator,
          // mouse, or Tab — so re-entering the strip doesn't leave `active` pointing at a stale chip.
          onFocus={() => setActive(i)}
          onClick={(e) => {
            // Chips live inside <article onClick={onSelect}>; without this the bubbling click
            // re-selects the origin chunk and cancels the jump.
            e.stopPropagation();
            onJump(chip.chunkId);
          }}
        >
          {chip.state === 'reviewed' && (
            <span className="chip-check" aria-hidden="true">
              ✓
            </span>
          )}
          <span className="chip-text">{chipText(chip)}</span>
          {chip.behind > 0 && (
            <span className="chip-behind" aria-hidden="true">
              +{chip.behind}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
