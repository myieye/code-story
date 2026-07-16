import type { ChunkReview, ChunkReviewState, ReviewFile } from '@code-story/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sendReviewPatch } from './api.js';

export interface Review {
  states: Record<string, ChunkReview>;
  stateOf: (chunkId: string) => ChunkReviewState;
  /** Explicit mark/unmark — persisted immediately. */
  setState: (chunkId: string, state: ChunkReviewState, markedUnseen?: boolean) => void;
  /** Automatic seen-tracking — batched and persisted on a debounce. */
  setSeen: (chunkIds: string[]) => void;
  setCursor: (chunkId: string) => void;
}

const FLUSH_DELAY_MS = 800;

export function useReview(initial: ReviewFile): Review {
  const [states, setStates] = useState<Record<string, ChunkReview>>(initial.chunks);
  const statesRef = useRef(states);
  statesRef.current = states;
  const pendingSet = useRef(new Map<string, { state: ChunkReviewState; markedUnseen?: boolean }>());
  const pendingCursor = useRef<string | undefined>(undefined);
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    if (pendingSet.current.size === 0 && pendingCursor.current === undefined) return;
    const patch = {
      set: [...pendingSet.current].map(([chunkId, v]) => ({ chunkId, ...v })),
      ...(pendingCursor.current !== undefined ? { cursor: pendingCursor.current } : {}),
    };
    pendingSet.current = new Map();
    pendingCursor.current = undefined;
    void sendReviewPatch(patch).catch((e: unknown) => console.error('code-story: review save failed', e));
  }, []);

  const scheduleFlush = useCallback(() => {
    timer.current ??= window.setTimeout(flush, FLUSH_DELAY_MS);
  }, [flush]);

  useEffect(() => {
    window.addEventListener('pagehide', flush);
    return () => {
      flush();
      window.removeEventListener('pagehide', flush);
    };
  }, [flush]);

  const applyLocal = useCallback((chunkId: string, state: ChunkReviewState, markedUnseen?: boolean) => {
    setStates((prev) => {
      const entry: ChunkReview = { state };
      if (markedUnseen ?? prev[chunkId]?.markedUnseen) entry.markedUnseen = true;
      return { ...prev, [chunkId]: entry };
    });
  }, []);

  return {
    states,
    stateOf: (chunkId) => states[chunkId]?.state ?? 'unseen',
    setState: (chunkId, state, markedUnseen) => {
      applyLocal(chunkId, state, markedUnseen);
      pendingSet.current.set(chunkId, { state, ...(markedUnseen ? { markedUnseen } : {}) });
      flush();
    },
    setSeen: (chunkIds) => {
      // seen only ever upgrades unseen — callers may hold stale state, so re-check here
      const fresh = chunkIds.filter((id) => (statesRef.current[id]?.state ?? 'unseen') === 'unseen');
      for (const id of fresh) {
        applyLocal(id, 'seen');
        pendingSet.current.set(id, { state: 'seen' });
      }
      if (fresh.length > 0) scheduleFlush();
    },
    setCursor: (chunkId) => {
      pendingCursor.current = chunkId;
      scheduleFlush();
    },
  };
}
