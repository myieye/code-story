import type { Chunk } from '@code-story/core';
import { useCallback, useRef, useState } from 'react';
import { fetchContext } from './api.js';
import { type PayloadState, shouldExpandOnArrival, type ToggleOutcome, toggleInSet, visibleDefinitions } from './context-panel-logic.js';

export interface ContextPanelsState {
  /** `undefined` until fetched, `null` when fetched-but-empty, else the payload (spec 04). */
  payloadFor: (chunkId: string) => PayloadState;
  isExpanded: (chunkId: string) => boolean;
  /** Fetch on demand, once per chunk — payload is shared across a chunk's occurrences. */
  ensureFetched: (chunkId: string) => void;
  /** Toggle the panel; fetches first if needed. Returns what the page should do about focus. */
  toggle: (chunkId: string) => ToggleOutcome;
}

/**
 * On-demand definition payloads for the book, keyed by chunk id (never fetched in bulk on load —
 * R-009 reviewer-controlled depth). One in-flight request per chunk; results cached across the
 * chunk's occurrences. Mirrors useOrderOverlay/useSeenTracking: local state, fire-and-forget IO.
 *
 * `onDeferredExpand` fires when a `toggle` made before the fetch landed later auto-expands the panel,
 * so the page can focus + announce on arrival exactly as it does for a synchronous expand.
 */
export function useContextPanels(
  chunks: readonly Chunk[],
  onDeferredExpand?: (chunkId: string, payload: PayloadState) => void,
): ContextPanelsState {
  const [cache, setCache] = useState<ReadonlyMap<string, PayloadState>>(new Map());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const inFlight = useRef(new Set<string>());
  // A `toggle` before the fetch lands records intent; the fetch expands on arrival if it stuck.
  const wantExpand = useRef(new Set<string>());

  const cacheRef = useRef(cache);
  cacheRef.current = cache;
  const deferredRef = useRef(onDeferredExpand);
  deferredRef.current = onDeferredExpand;

  const ensureFetched = useCallback((chunkId: string) => {
    if (cacheRef.current.has(chunkId) || inFlight.current.has(chunkId)) return;
    inFlight.current.add(chunkId);
    void fetchContext(chunkId)
      .then((res) => {
        setCache((prev) => new Map(prev).set(chunkId, res.payload));
        if (shouldExpandOnArrival(wantExpand.current.delete(chunkId), visibleDefinitions(res.payload, chunks))) {
          setExpanded((prev) => new Set(prev).add(chunkId));
          deferredRef.current?.(chunkId, res.payload);
        }
      })
      .catch(() => {
        // Fail-open to "no definitions": the book flow never blocks on context (spec 04).
        setCache((prev) => new Map(prev).set(chunkId, null));
        wantExpand.current.delete(chunkId);
      })
      .finally(() => inFlight.current.delete(chunkId));
  }, [chunks]);

  const toggle = useCallback(
    (chunkId: string): ToggleOutcome => {
      const payload = cacheRef.current.get(chunkId);
      if (!cacheRef.current.has(chunkId)) {
        wantExpand.current.add(chunkId);
        ensureFetched(chunkId);
        return 'none';
      }
      if (visibleDefinitions(payload, chunks).length === 0) return 'none';
      const willExpand = !expanded.has(chunkId);
      setExpanded((prev) => toggleInSet(prev, chunkId));
      return willExpand ? 'expanded' : 'collapsed';
    },
    [ensureFetched, expanded, chunks],
  );

  return {
    payloadFor: (chunkId) => cache.get(chunkId),
    isExpanded: (chunkId) => expanded.has(chunkId),
    ensureFetched,
    toggle,
  };
}
