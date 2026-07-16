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
      if (e.key === 'Escape') {
        if (target?.closest('.cm-editor')) {
          const rowIndex = flat.chunkRowIndexes[cursor];
          if (rowIndex !== undefined) rowEls.current.get(rowIndex)?.focus({ preventScroll: true });
          e.preventDefault();
        }
        return;
      }
      if (target?.closest('.cm-editor, input, textarea, select, button')) return;
      const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
      if (plain && (e.key === 'j' || e.key === 'PageDown')) moveCursor(cursor + 1);
      else if (plain && (e.key === 'k' || e.key === 'PageUp')) moveCursor(cursor - 1);
      else if (plain && e.key === 'n') jumpUnreviewed(1);
      else if (plain && e.key === 'N') jumpUnreviewed(-1);
      else if (plain && e.key === 'Enter') {
        // Key-repeat never marks: each mark requires a fresh keydown (R-026).
        if (!e.repeat) markCurrent();
      } else if (plain && e.key === 'u') unmarkCurrent();
      else if (plain && e.key === 'x') toggleCollapseCurrent();
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
