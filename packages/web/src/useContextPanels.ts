import { useCallback, useRef, useState } from 'react';
import { fetchContext } from './api.js';
import { hasDefinitions, type PayloadState, type ToggleOutcome, toggleInSet } from './context-panel-logic.js';

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
 */
export function useContextPanels(): ContextPanelsState {
  const [cache, setCache] = useState<ReadonlyMap<string, PayloadState>>(new Map());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const inFlight = useRef(new Set<string>());
  // A `toggle` before the fetch lands records intent; the fetch expands on arrival if it stuck.
  const wantExpand = useRef(new Set<string>());

  const cacheRef = useRef(cache);
  cacheRef.current = cache;

  const ensureFetched = useCallback((chunkId: string) => {
    if (cacheRef.current.has(chunkId) || inFlight.current.has(chunkId)) return;
    inFlight.current.add(chunkId);
    void fetchContext(chunkId)
      .then((res) => {
        setCache((prev) => new Map(prev).set(chunkId, res.payload));
        if (wantExpand.current.delete(chunkId) && hasDefinitions(res.payload)) {
          setExpanded((prev) => new Set(prev).add(chunkId));
        }
      })
      .catch(() => {
        // Fail-open to "no definitions": the book flow never blocks on context (spec 04).
        setCache((prev) => new Map(prev).set(chunkId, null));
        wantExpand.current.delete(chunkId);
      })
      .finally(() => inFlight.current.delete(chunkId));
  }, []);

  const toggle = useCallback(
    (chunkId: string): ToggleOutcome => {
      const payload = cacheRef.current.get(chunkId);
      if (!cacheRef.current.has(chunkId)) {
        wantExpand.current.add(chunkId);
        ensureFetched(chunkId);
        return 'none';
      }
      if (!hasDefinitions(payload)) return 'none';
      const willExpand = !expanded.has(chunkId);
      setExpanded((prev) => toggleInSet(prev, chunkId));
      return willExpand ? 'expanded' : 'collapsed';
    },
    [ensureFetched, expanded],
  );

  return {
    payloadFor: (chunkId) => cache.get(chunkId),
    isExpanded: (chunkId) => expanded.has(chunkId),
    ensureFetched,
    toggle,
  };
}
