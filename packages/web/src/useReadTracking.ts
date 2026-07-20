import { type Chunk, type ChunkReview, isLowSignal } from '@code-story/core';
import type { Virtualizer } from '@tanstack/react-virtual';
import { type RefObject, useEffect, useRef } from 'react';
import type { BookResponse } from './api.js';
import { AUTO_READ_VELOCITY_LIMIT, type ChunkDwell, clearsGate, stepDwell, visibleFraction } from './read-tracking-logic.js';
import type { FlatBook } from './rows.js';

export interface ReadTrackingOptions {
  scrollRef: RefObject<HTMLDivElement | null>;
  virtualizer: Pick<Virtualizer<HTMLDivElement, Element>, 'getVirtualItems'>;
  flat: FlatBook;
  data: BookResponse;
  reviewOf: (chunkId: string) => ChunkReview;
  isCollapsed: (chunk: Chunk) => boolean;
  setAutoRead: (chunkIds: string[]) => void;
}

// A stationary reader still banks dwell; a slow interval covers that without the rAF cost of scrolling.
const IDLE_TICK_MS = 500;
// Clamp per-tick dt so a backgrounded tab (or a stalled rAF) can't bank many seconds in one step.
const MAX_TICK_DT_MS = 700;

/**
 * Banks reading evidence per chunk and upgrades seen→autoRead when a chunk clears the gate (spec 06
 * slice 3). Distinct from useSeenTracking: this samples on a rAF loop while scrolling and a slow idle
 * interval while stationary — it must observe continuous dwell and scroll velocity, which the 160ms
 * post-settle seen-scan cannot. Accumulation lives in a ref keyed by chunkId, so a row re-measure
 * (async narration) never resets it.
 */
export function useReadTracking({ scrollRef, virtualizer, flat, data, reviewOf, isCollapsed, setAutoRead }: ReadTrackingOptions): void {
  const dwell = useRef(new Map<string, ChunkDwell>());
  const lastTick = useRef<number | undefined>(undefined);
  const lastScroll = useRef<{ top: number; time: number } | undefined>(undefined);
  // A velocity spike seen since the last tick, to be consumed by that tick for the visible rows.
  const spike = useRef(false);

  // No dep array: re-registers each render so the tick reads fresh review state and virtual items.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const tick = () => {
      const now = performance.now();
      const dt = lastTick.current === undefined ? 0 : Math.min(now - lastTick.current, MAX_TICK_DT_MS);
      lastTick.current = now;
      const flung = spike.current;
      spike.current = false;

      const viewTop = el.scrollTop;
      const viewBottom = viewTop + el.clientHeight;
      const viewportHeight = el.clientHeight;
      const cleared: string[] = [];
      for (const item of virtualizer.getVirtualItems()) {
        const row = flat.rows[item.index];
        if (row?.kind !== 'chunk') continue;
        const chunk = row.chunk;
        const current = reviewOf(chunk.id);
        // Already reviewed or already banked as auto-read: nothing more to gate.
        if (current.state === 'reviewed' || current.autoRead) continue;
        const height = item.end - item.start;
        const next = stepDwell(dwell.current.get(chunk.id), {
          eligible: !isLowSignal(chunk) && !isCollapsed(chunk),
          fitsViewport: height <= viewportHeight,
          visibleFraction: visibleFraction(item.start, item.end, viewTop, viewBottom),
          dt,
          velocitySpike: flung,
        });
        dwell.current.set(chunk.id, next);
        if (clearsGate(next, data.diffs[chunk.id]?.length ?? 1)) cleared.push(chunk.id);
      }
      if (cleared.length > 0) setAutoRead(cleared);
    };

    let rafId = 0;
    let rafPending = false;
    const scheduleRaf = () => {
      if (rafPending) return;
      rafPending = true;
      rafId = requestAnimationFrame(() => {
        rafPending = false;
        tick();
      });
    };

    const onScroll = () => {
      const now = performance.now();
      const prev = lastScroll.current;
      if (prev && now > prev.time) {
        const velocity = (Math.abs(el.scrollTop - prev.top) / (now - prev.time)) * 1000;
        if (velocity > AUTO_READ_VELOCITY_LIMIT) spike.current = true;
      }
      lastScroll.current = { top: el.scrollTop, time: now };
      scheduleRaf();
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    const idle = window.setInterval(tick, IDLE_TICK_MS);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.clearInterval(idle);
      cancelAnimationFrame(rafId);
    };
  });
}
