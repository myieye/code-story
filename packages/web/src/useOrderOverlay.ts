import { applyOrderOverlay, type Book, type ChunkReview } from '@code-story/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type BookResponse, type OrderResponse, sendOrderPatch } from './api.js';
import { orderDecision } from './order-logic.js';

export interface OrderOverlayState {
  /** `data` with the AI order applied when active; the input object otherwise. */
  bookData: BookResponse;
  orderApplied: boolean;
  rationales: Record<string, string> | undefined;
  offer: boolean;
  applyOrder: () => void;
  dismissOrder: () => void;
}

/** Overlay state + persistence for the book UI, alongside useReview/useSeenTracking. */
export function useOrderOverlay(
  data: BookResponse,
  initialOrder: OrderResponse,
  reviewStates: Record<string, ChunkReview>,
): OrderOverlayState {
  const [overlay, setOverlay] = useState(initialOrder.overlay);
  const decision = useMemo(() => orderDecision(overlay, reviewStates), [overlay, reviewStates]);

  const orderedBook = useMemo((): Book => {
    if (decision !== 'apply' || overlay === null) return data.book;
    return applyOrderOverlay(data.book, data.graph, data.chunks, overlay);
  }, [data, decision, overlay]);
  // The indicator must tell the truth: claim AI order only when the applier actually reordered,
  // not merely when the decision said to — a fail-open apply must not be labeled AI (R-026).
  const orderApplied = orderedBook !== data.book;

  // Auto-apply persists appliedAt immediately: a mark made before the PATCH lands would
  // otherwise flip the decision to 'offer' and reorder underfoot.
  const autoApplySent = useRef(false);
  useEffect(() => {
    if (!orderApplied || overlay?.appliedAt || autoApplySent.current) return;
    autoApplySent.current = true;
    setOverlay((prev) => (prev ? { ...prev, appliedAt: new Date().toISOString() } : prev));
    void sendOrderPatch({ applied: true });
  }, [orderApplied, overlay]);

  const bookData = useMemo(
    (): BookResponse => (orderApplied ? { ...data, book: orderedBook } : data),
    [data, orderApplied, orderedBook],
  );

  return {
    bookData,
    orderApplied,
    rationales: orderApplied && overlay !== null ? overlay.rationales : undefined,
    offer: decision === 'offer',
    applyOrder: () => {
      setOverlay((prev) => (prev ? { ...prev, appliedAt: new Date().toISOString() } : prev));
      void sendOrderPatch({ applied: true });
    },
    dismissOrder: () => {
      setOverlay((prev) => (prev ? { ...prev, dismissedAt: new Date().toISOString() } : prev));
      void sendOrderPatch({ dismissed: true });
    },
  };
}
