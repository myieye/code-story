import { type RefObject, useEffect } from 'react';
import type { FlatBook } from './rows.js';

export interface BookKeymapOptions {
  overlayOpen: boolean;
  setOverlayOpen: (open: boolean) => void;
  cursor: number;
  totalOccurrences: number;
  flat: FlatBook;
  rowEls: RefObject<Map<number, HTMLElement>>;
  moveCursor: (next: number) => void;
  jumpUnreviewed: (dir: 1 | -1) => void;
  markCurrent: () => void;
  unmarkCurrent: () => void;
  toggleCollapseCurrent: () => void;
  toggleDefinitionsCurrent: () => void;
  /** Move focus into the focused chunk's neighbor strip (spec 05 slice 5). */
  focusNeighborStrip: () => void;
  /** Pop the neighbor-jump back-stack, restoring the origin chunk. */
  goBack: () => void;
}

export function useBookKeymap({
  overlayOpen,
  setOverlayOpen,
  cursor,
  totalOccurrences,
  flat,
  rowEls,
  moveCursor,
  jumpUnreviewed,
  markCurrent,
  unmarkCurrent,
  toggleCollapseCurrent,
  toggleDefinitionsCurrent,
  focusNeighborStrip,
  goBack,
}: BookKeymapOptions): void {
  // No dep array: re-registers every render so the handler closes over fresh state (intentional).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (overlayOpen) {
        if (e.key === 'Escape' || e.key === '?') {
          setOverlayOpen(false);
          e.preventDefault();
        }
        return;
      }
      const target = e.target as HTMLElement | null;
      const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
      if (e.key === 'Escape') {
        // Both the code editor and an expanded definition panel hand focus back to the chunk.
        if (target?.closest('.cm-editor, .definition-panel')) {
          const rowIndex = flat.chunkRowIndexes[cursor];
          if (rowIndex !== undefined) rowEls.current.get(rowIndex)?.focus({ preventScroll: true });
          e.preventDefault();
        }
        return;
      }
      // `d` toggles definitions from the chunk or from inside its focused panel — but not while
      // typing in the editor/an input. Handled before the scroll-region guard so it works in-panel.
      if (plain && e.key === 'd' && !e.repeat && !target?.closest('.cm-editor, input, textarea, select')) {
        toggleDefinitionsCurrent();
        e.preventDefault();
        return;
      }
      // The panel is a focusable scroll region: arrows/space/PageDown scroll it natively, and j/k
      // must not hijack that — so it joins the editor/inputs in the navigation guard.
      if (target?.closest('.cm-editor, .definition-panel, input, textarea, select, button')) return;
      if (plain && (e.key === 'j' || e.key === 'PageDown')) moveCursor(cursor + 1);
      else if (plain && (e.key === 'k' || e.key === 'PageUp')) moveCursor(cursor - 1);
      else if (plain && e.key === 'n') jumpUnreviewed(1);
      else if (plain && e.key === 'N') jumpUnreviewed(-1);
      else if (plain && e.key === 'Enter') {
        // Key-repeat never marks: each mark requires a fresh keydown (R-026).
        if (!e.repeat) markCurrent();
      } else if (plain && e.key === 'u') unmarkCurrent();
      else if (plain && e.key === 'x') toggleCollapseCurrent();
      else if (plain && e.key === 'g') focusNeighborStrip();
      else if (plain && e.key === 'b') goBack();
      else if (plain && e.key === '?') setOverlayOpen(true);
      else if (e.ctrlKey && e.key === 'Home') moveCursor(0);
      else if (e.ctrlKey && e.key === 'End') moveCursor(totalOccurrences - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });
}
