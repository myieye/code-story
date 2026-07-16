import type { Virtualizer } from '@tanstack/react-virtual';
import { type RefObject, useEffect, useRef } from 'react';
import type { StateOf } from './review-logic.js';
import type { FlatBook } from './rows.js';

export interface SeenTrackingOptions {
  scrollRef: RefObject<HTMLDivElement | null>;
  virtualizer: Pick<Virtualizer<HTMLDivElement, Element>, 'getVirtualItems'>;
  flat: FlatBook;
  stateOf: StateOf;
  setSeen: (chunkIds: string[]) => void;
}

// seen = both edges of the block have been inside the viewport (covers blocks taller than it)
export function useSeenTracking({ scrollRef, virtualizer, flat, stateOf, setSeen }: SeenTrackingOptions): void {
  const seenEdges = useRef(new Map<string, { top?: boolean; bottom?: boolean }>());
  const seenTimer = useRef<number | undefined>(undefined);

  // No dep array: re-registers every render so the scan reads fresh review state (intentional).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scan = () => {
      const top = el.scrollTop;
      const bottom = top + el.clientHeight;
      const newlySeen: string[] = [];
      for (const item of virtualizer.getVirtualItems()) {
        const row = flat.rows[item.index];
        if (row?.kind !== 'chunk') continue;
        if (stateOf(row.chunk.id) !== 'unseen') continue;
        const edges = seenEdges.current.get(row.chunk.id) ?? {};
        if (item.start >= top && item.start <= bottom) edges.top = true;
        if (item.end >= top && item.end <= bottom) edges.bottom = true;
        seenEdges.current.set(row.chunk.id, edges);
        if (edges.top && edges.bottom) newlySeen.push(row.chunk.id);
      }
      setSeen(newlySeen);
    };
    const onScroll = () => {
      window.clearTimeout(seenTimer.current);
      seenTimer.current = window.setTimeout(scan, 160);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    const initial = window.setTimeout(scan, 400);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.clearTimeout(initial);
    };
  });
}
