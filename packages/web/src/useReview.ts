import type { ChunkReview, ChunkReviewState, ReviewFile } from '@code-story/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sendReviewPatch } from './api.js';

export interface MarkEntry {
  chunkId: string;
  state: ChunkReviewState;
  markedUnseen?: boolean;
}

export interface Review {
  states: Record<string, ChunkReview>;
  stateOf: (chunkId: string) => ChunkReviewState;
  /** The full ChunkReview (unseen default) — snapshotted before a batch so undo restores exact values. */
  reviewOf: (chunkId: string) => ChunkReview;
  /** Explicit mark/unmark — persisted immediately. */
  setState: (chunkId: string, state: ChunkReviewState, markedUnseen?: boolean) => void;
  /** Batch acknowledgment — one local update and one immediate flush for the group. */
  setMany: (entries: MarkEntry[]) => void;
  /** Undo a batch: restore each chunk's exact prior ChunkReview (state, markedUnseen, expanded). */
  restoreMany: (entries: { chunkId: string; review: ChunkReview }[]) => void;
  /** Automatic seen-tracking — batched and persisted on a debounce. */
  setSeen: (chunkIds: string[]) => void;
  /** Stub expand/collapse (low-signal chunks only) — persisted on a debounce. */
  setExpanded: (chunkId: string, expanded: boolean) => void;
  setCursor: (chunkId: string) => void;
}

type PendingEntry = { state?: ChunkReviewState; markedUnseen?: boolean; expanded?: boolean };

const FLUSH_DELAY_MS = 800;

export function useReview(initial: ReviewFile): Review {
  const [states, setStates] = useState<Record<string, ChunkReview>>(initial.chunks);
  const statesRef = useRef(states);
  statesRef.current = states;
  const pendingSet = useRef(new Map<string, PendingEntry>());
  const pendingCursor = useRef<string | undefined>(undefined);
  const timer = useRef<number | undefined>(undefined);

  const scheduleFlush = useCallback(() => {
    timer.current ??= window.setTimeout(() => flushRef.current(), FLUSH_DELAY_MS);
  }, []);
  const flushRef = useRef(() => {});

  const queue = useCallback((chunkId: string, fields: PendingEntry) => {
    pendingSet.current.set(chunkId, { ...pendingSet.current.get(chunkId), ...fields });
  }, []);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    if (pendingSet.current.size === 0 && pendingCursor.current === undefined) return;
    const sent = pendingSet.current;
    const sentCursor = pendingCursor.current;
    const patch = {
      set: [...sent].map(([chunkId, v]) => ({ chunkId, ...v })),
      ...(sentCursor !== undefined ? { cursor: sentCursor } : {}),
    };
    pendingSet.current = new Map();
    pendingCursor.current = undefined;
    void sendReviewPatch(patch).catch((e: unknown) => {
      // Re-queue what failed (newer pending fields win) and retry — marks must not be lost.
      console.error('code-story: review save failed, retrying', e);
      for (const [id, v] of sent) {
        pendingSet.current.set(id, { ...v, ...pendingSet.current.get(id) });
      }
      pendingCursor.current ??= sentCursor;
      scheduleFlush();
    });
  }, [scheduleFlush]);
  flushRef.current = flush;

  useEffect(() => {
    window.addEventListener('pagehide', flush);
    return () => {
      flush();
      window.removeEventListener('pagehide', flush);
    };
  }, [flush]);

  const applyLocal = useCallback((updates: MarkEntry[]) => {
    setStates((prev) => {
      const next = { ...prev };
      for (const { chunkId, state, markedUnseen } of updates) {
        const entry: ChunkReview = { state };
        if (markedUnseen ?? prev[chunkId]?.markedUnseen) entry.markedUnseen = true;
        next[chunkId] = entry;
      }
      return next;
    });
  }, []);

  return {
    states,
    stateOf: (chunkId) => states[chunkId]?.state ?? 'unseen',
    reviewOf: (chunkId) => states[chunkId] ?? { state: 'unseen' },
    setState: (chunkId, state, markedUnseen) => {
      applyLocal([{ chunkId, state, ...(markedUnseen ? { markedUnseen } : {}) }]);
      queue(chunkId, { state, ...(markedUnseen ? { markedUnseen } : {}) });
      flush();
    },
    setMany: (entries) => {
      applyLocal(entries);
      for (const { chunkId, ...fields } of entries) queue(chunkId, fields);
      flush();
    },
    restoreMany: (entries) => {
      // Restore the exact snapshot locally (this is the only path that can return a field to absent);
      // the queued patch re-asserts the set fields the wire protocol carries.
      setStates((prev) => {
        const next = { ...prev };
        for (const { chunkId, review } of entries) next[chunkId] = { ...review };
        return next;
      });
      for (const { chunkId, review } of entries) {
        queue(chunkId, {
          state: review.state,
          ...(review.markedUnseen ? { markedUnseen: true } : {}),
          ...(review.expanded ? { expanded: true } : {}),
        });
      }
      flush();
    },
    setSeen: (chunkIds) => {
      // seen only ever upgrades unseen — callers may hold stale state, so re-check here
      const fresh = chunkIds.filter((id) => (statesRef.current[id]?.state ?? 'unseen') === 'unseen');
      for (const id of fresh) {
        applyLocal([{ chunkId: id, state: 'seen' }]);
        queue(id, { state: 'seen' });
      }
      if (fresh.length > 0) scheduleFlush();
    },
    setExpanded: (chunkId, expanded) => {
      queue(chunkId, { expanded });
      scheduleFlush();
    },
    setCursor: (chunkId) => {
      pendingCursor.current = chunkId;
      scheduleFlush();
    },
  };
}
