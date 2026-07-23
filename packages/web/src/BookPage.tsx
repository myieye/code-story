import {
  type Chunk,
  type ChunkReview,
  type ChunkReviewState,
  DEFAULT_STORY_CONFIG,
  type Deferral,
  type DeferralRequest,
  FILE_MODE_STORY_CONFIG,
  isFileModeConfig,
  isLowSignal,
  type LineRange,
  type ReviewFile,
  type StoryConfig,
  storyConfigKey,
} from '@code-story/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type BookResponse,
  deleteDeferral,
  fetchBook,
  fetchDeferrals,
  type NarrationResponse,
  type OrderResponse,
  postDeferral,
} from './api.js';
import {
  answersStillArriving,
  deferCluster,
  deferredChunkIds,
  newlyAnswered,
  shouldPoll,
  stubCopy,
} from './defer-logic.js';
import { DeferredCard } from './DeferredCard.js';
import { configSummary } from './order-options-logic.js';
import { OrderOptionsControl } from './OrderOptionsControl.js';
import { OutlineSidebar } from './OutlineSidebar.js';
import { computeNeighborChips } from './neighbor-strip-logic.js';
import { isAutoReadReview } from './review-glyph-logic.js';
import { FilePiecesMenu } from './FilePiecesMenu.js';
import { fileOrderIndex, pieceMenuModel, stepPieceTarget } from './piece-nav-logic.js';
import { frontierCount, interactionCount } from './frontier-logic.js';
import { linkHost } from './links-logic.js';
import { batchableSections, cursorAfterMark, findUnreviewed, pendingStubCount } from './review-logic.js';
import { estimateRowHeight, RowView, type SectionAck } from './RowView.js';
import { AnchoredPopover } from './AnchoredPopover.js';
import { whyThisOrderCopy } from './order-explain-logic.js';
import {
  chaptersRemaining,
  completionToastCopy,
  newlyCompleted,
  resumeCopy,
  sectionLabel,
  segmentModel,
} from './progress-logic.js';
import { remapBackStack, remapCursor } from './cursor-remap.js';
import { chunkSize, chunkTitle, DEFERRED_SECTION_ID, flattenBook, type Row } from './rows.js';
import { ShortcutOverlay } from './ShortcutOverlay.js';
import { affordanceLabel, type PayloadState, visibleDefinitions } from './context-panel-logic.js';
import { useBookKeymap } from './useBookKeymap.js';
import { useContextPanels } from './useContextPanels.js';
import { useNarration } from './useNarration.js';
import { useOrderOverlay } from './useOrderOverlay.js';
import { useReadTracking } from './useReadTracking.js';
import { useReview } from './useReview.js';
import { useSeenTracking } from './useSeenTracking.js';

/** Top-bar width below which the right controls + AI cluster items collapse into overflow popovers. */
const COMPACT_WIDTH = 1080;

export function BookPage({
  data,
  initialReview,
  initialOrder,
  initialNarration,
  initialDeferrals,
}: {
  data: BookResponse;
  initialReview: ReviewFile;
  initialOrder: OrderResponse;
  initialNarration: NarrationResponse;
  initialDeferrals: Deferral[];
}) {
  const review = useReview(initialReview);
  const [deferrals, setDeferrals] = useState<Deferral[]>(initialDeferrals);
  // The open Defer popover: which chunk, its draft text, and any captured CM6 selection.
  const [deferState, setDeferState] = useState<{ chunkId: string; text: string; lineRange?: LineRange } | null>(null);
  // Which deferred cards have their (lazy, heavy) diff mounted.
  const [deferredDiffShown, setDeferredDiffShown] = useState<ReadonlySet<string>>(new Set());
  // The book currently displayed (config-swappable, #114). Starts at the launch-config response the
  // App fetched; changing the reading order re-fetches /api/book with the new axes and swaps it in.
  const [bookResponse, setBookResponse] = useState(data);
  const [reordering, setReordering] = useState(false);
  const pendingReorder = useRef(false);
  const order = useOrderOverlay(bookResponse, initialOrder, review.states);
  const { bookData, orderApplied } = order;
  const narration = useNarration(bookData, initialNarration, order.rationales);
  const hasSectionLine = useCallback((id: string) => narration.sectionLine(id) !== undefined, [narration]);
  const hasChunkLine = useCallback(
    (sectionId: string, chunkId: string) => narration.chunkLine(sectionId, chunkId) !== undefined,
    [narration],
  );

  // Non-inline deferrals define the pinned Deferred section; inline ones render in place. Both maps
  // and the ordered id list drive the synthetic section injected into the flat book after compile.
  const deferredIds = useMemo(() => deferredChunkIds(deferrals), [deferrals]);
  const deferralsByChunk = useMemo(() => {
    const deferred = new Map<string, Deferral[]>();
    const inline = new Map<string, Deferral[]>();
    for (const d of deferrals) {
      const target = d.inline ? inline : deferred;
      const list = target.get(d.chunkId);
      if (list) list.push(d);
      else target.set(d.chunkId, [d]);
    }
    return { deferred, inline };
  }, [deferrals]);

  const flat = useMemo(() => flattenBook(bookData.book, bookData.chunks, deferredIds), [bookData, deferredIds]);
  // A chunk shows its file label only where the file changes from the previous chunk row — a transition
  // marker. The sticky current-file bar carries the file the rest of the time, so repeating it on every
  // chunk of a same-file run is just noise. Computed over the full row list (spans off-screen rows).
  const showFileForRow = useMemo(() => {
    const show = new Set<string>();
    let lastFile: string | undefined;
    for (const row of flat.rows) {
      if (row.kind === 'chunk' || row.kind === 'deferred-card') {
        if (row.chunk.file !== lastFile) show.add(row.occurrenceKey);
        lastFile = row.chunk.file;
      }
    }
    return show;
  }, [flat]);
  const chunksById = useMemo(() => new Map(bookData.chunks.map((c) => [c.id, c])), [bookData]);
  const fileOrder = useMemo(() => fileOrderIndex(bookData.chunks), [bookData]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowEls = useRef(new Map<number, HTMLElement>());
  const panelEls = useRef(new Map<string, HTMLElement>());
  const stripEls = useRef(new Map<string, HTMLElement>());

  const [cursor, setCursor] = useState(() => {
    const resumed = initialReview.cursor ? flat.firstIndexByChunkId.get(initialReview.cursor) : undefined;
    return resumed ?? 0;
  });
  const [hideReviewed, setHideReviewed] = useState(false);
  const [outlineWidth, setOutlineWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem('code-story:outline-width'));
    return Number.isFinite(saved) && saved >= 180 && saved <= 560 ? saved : 280;
  });
  // Persisted stub expansions (review.expanded) seed the overrides so reloads keep them open.
  const [collapsedOverride, setCollapsedOverride] = useState<ReadonlyMap<string, boolean>>(() => {
    const seeded = new Map<string, boolean>();
    for (const [id, entry] of Object.entries(initialReview.chunks)) {
      if (entry.expanded) seeded.set(id, false);
    }
    return seeded;
  });
  const [overlayOpen, setOverlayOpen] = useState(false);
  // Neighbor-strip navigation: the origins we can pop back to, and the chunk to briefly re-highlight
  // after a jump (a re-encounter, never a re-audit — reviewed stays reviewed).
  const [backStack, setBackStack] = useState<number[]>([]);
  const [reencounter, setReencounter] = useState<{ chunkId: string; state: 'reviewed' | 'unreviewed'; seq: number } | null>(null);
  const [announce, setAnnounce] = useState({ msg: '', seq: 0 });
  const [toastVisible, setToastVisible] = useState(false);
  // `prior` snapshots the full ChunkReview (not just the enum) so undo restores exact values. A file
  // "mark all pieces" batch has no owning section, so `sectionId` is optional.
  const [lastBatch, setLastBatch] = useState<{ sectionId?: string; prior: { chunkId: string; review: ChunkReview }[] } | null>(null);
  const [pieceMenu, setPieceMenu] = useState<{ chunkId: string; anchorEl: HTMLElement } | null>(null);
  // A pending "jump to this chunk after the next reorder lands" (Open in Files view crosses a re-fetch).
  const pendingJumpChunk = useRef<string | undefined>(undefined);
  // The one-shot rail wipe target (spec 06 slice 4): the chunk that just flipped to reviewed.
  const [justReviewed, setJustReviewed] = useState<{ chunkId: string; seq: number } | null>(null);
  // Top-bar overflow (spec 06 slice 4d): below a width threshold the right controls + AI cluster
  // items collapse into portal popovers so the bar never wraps or crowds.
  const headerRef = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(false);
  const [whyAnchor, setWhyAnchor] = useState<HTMLElement | null>(null);
  const [overflowAnchor, setOverflowAnchor] = useState<HTMLElement | null>(null);
  const [aiAnchor, setAiAnchor] = useState<HTMLElement | null>(null);
  const [aiWhyExpanded, setAiWhyExpanded] = useState(false);

  // Two sizes: occurrences are walk stops (cursor space); distinct chunks carry review state.
  const { totalOccurrences, distinctChunks } = flat;
  const chunkRowAt = (i: number): Extract<Row, { kind: 'chunk' }> | undefined => {
    const rowIndex = flat.chunkRowIndexes[i];
    const row = rowIndex === undefined ? undefined : flat.rows[rowIndex];
    return row?.kind === 'chunk' ? row : undefined;
  };

  const reviewedCount = useMemo(
    () => [...flat.firstIndexByChunkId.keys()].reduce((n, id) => n + (review.stateOf(id) === 'reviewed' ? 1 : 0), 0),
    [flat, review.states],
  );
  const done = distinctChunks > 0 && reviewedCount === distinctChunks;

  const sectionStats = useMemo(() => {
    const stats = new Map<string, { done: number; total: number; counted: Set<string> }>();
    for (const row of flat.rows) {
      if (row.kind !== 'chunk') continue;
      const s = stats.get(row.sectionId) ?? { done: 0, total: 0, counted: new Set<string>() };
      if (!s.counted.has(row.chunk.id)) {
        s.counted.add(row.chunk.id);
        s.total++;
        if (review.stateOf(row.chunk.id) === 'reviewed') s.done++;
      }
      stats.set(row.sectionId, s);
    }
    return stats;
  }, [flat, review.states]);

  const segments = useMemo(() => segmentModel(bookData.book.sections, sectionStats), [bookData, sectionStats]);
  const chapterCount = segments.length;
  const linesRead = useMemo(
    () =>
      bookData.chunks.reduce(
        (acc, c) => {
          const s = chunkSize(c);
          return { added: acc.added + s.added, removed: acc.removed + s.removed };
        },
        { added: 0, removed: 0 },
      ),
    [bookData],
  );
  const bulkLowSignalCount = useMemo(
    () => bookData.chunks.filter((c) => isLowSignal(c) && review.stateOf(c.id) === 'reviewed').length,
    [bookData, review.states],
  );

  const batches = useMemo(() => batchableSections(flat, review.reviewOf), [flat, review.states]);
  const pendingStubs = useMemo(() => pendingStubCount(flat, review.stateOf), [flat, review.states]);

  // Auto-read chunks awaiting bulk confirm, and reviewed chunks that were confirmed from auto-read
  // (spec 06 slice 3). Both keyed off distinct chunks — the ledger lives on the chunk, not occurrences.
  const autoReadIds = useMemo(
    () => [...flat.firstIndexByChunkId.keys()].filter((id) => isAutoReadReview(review.reviewOf(id))),
    [flat, review.states],
  );
  const autoConfirmedCount = useMemo(
    () =>
      [...flat.firstIndexByChunkId.keys()].reduce((n, id) => {
        const r = review.reviewOf(id);
        return n + (r.state === 'reviewed' && r.reviewedVia === 'auto' ? 1 : 0);
      }, 0),
    [flat, review.states],
  );

  const isCollapsed = (chunk: Chunk) =>
    collapsedOverride.get(chunk.id) ?? (isLowSignal(chunk) || (hideReviewed && review.stateOf(chunk.id) === 'reviewed'));

  const setCollapsed = (chunk: Chunk, collapsed: boolean) => {
    setCollapsedOverride((prev) => new Map(prev).set(chunk.id, collapsed));
    if (isLowSignal(chunk)) review.setExpanded(chunk.id, !collapsed);
  };

  const virtualizer = useVirtualizer({
    count: flat.rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => estimateRowHeight(flat.rows[i]!, bookData, isCollapsed, { hasSectionLine, hasChunkLine }),
    overscan: 8,
  });

  // Double-invoke: with dynamic measurement a long jump lands on estimated offsets and the
  // first frame's measurements shift the layout out from under the viewport.
  const scrollToRow = (index: number) => {
    virtualizer.scrollToIndex(index, { align: 'start' });
    requestAnimationFrame(() => virtualizer.scrollToIndex(index, { align: 'start' }));
  };

  const say = (msg: string) => setAnnounce((a) => ({ msg, seq: a.seq + 1 }));

  // One-shot rail-wipe target (spec 06 slice 4), set only on the interactive single-chunk marks;
  // batch marks rely on the advancing bar instead.
  const flashReviewed = (chunkId: string) => setJustReviewed((r) => ({ chunkId, seq: (r?.seq ?? 0) + 1 }));

  // Focus + announce the definition panel. Shared by the immediate expand and the deferred one (the
  // payload arriving after `d`) so keyboard/SR users get the same signal whether or not the fetch was warm.
  const focusAndAnnouncePanel = (chunkId: string, payload: PayloadState) => {
    say(`Showing ${affordanceLabel(visibleDefinitions(payload, data.chunks))}. Escape returns to the chunk.`);
    // Hand focus to the panel once the expand has rendered it (two frames, like row focus).
    requestAnimationFrame(() =>
      requestAnimationFrame(() => panelEls.current.get(chunkId)?.focus({ preventScroll: true })),
    );
  };
  const context = useContextPanels(data.chunks, focusAndAnnouncePanel);

  useEffect(() => {
    if (!announce.msg) return;
    setToastVisible(true);
    const t = window.setTimeout(() => setToastVisible(false), 2600);
    return () => window.clearTimeout(t);
  }, [announce]);

  const moveCursor = (next: number) => {
    const clamped = Math.max(0, Math.min(totalOccurrences - 1, next));
    setCursor(clamped);
    const rowIndex = flat.chunkRowIndexes[clamped]!;
    scrollToRow(rowIndex);
    // Roving focus onto the block container once the virtualizer has it mounted.
    requestAnimationFrame(() => requestAnimationFrame(() => rowEls.current.get(rowIndex)?.focus({ preventScroll: true })));
  };

  useEffect(() => {
    const id = chunkRowAt(cursor)?.chunk.id;
    if (id) {
      review.setCursor(id);
      // On-demand, one request per focused chunk (R-009): reveals the affordance if it has any.
      context.ensureFetched(id);
    }
  }, [cursor]);

  useEffect(() => {
    if (!initialReview.cursor || cursor === 0) return;
    scrollToRow(flat.chunkRowIndexes[cursor]!);
    const percent = distinctChunks > 0 ? Math.round((reviewedCount / distinctChunks) * 100) : 0;
    const nextUp = segments.find((s) => s.state !== 'complete');
    say(resumeCopy(percent, chaptersRemaining(sectionStats), nextUp ? sectionLabel(nextUp.title) : undefined));
  }, []);

  // The shared mark step behind Enter and `m`: mark the cursor chunk reviewed (once), returning the
  // chunk and its prior state so the caller can decide whether to advance. Stubs are not expanded.
  const markCursorReviewed = (): { chunk: Chunk; prior: ChunkReviewState } | undefined => {
    const row = chunkRowAt(cursor);
    if (!row) return undefined;
    const prior = review.stateOf(row.chunk.id);
    if (prior !== 'reviewed') {
      review.setState(row.chunk.id, 'reviewed', prior === 'unseen' || undefined);
      flashReviewed(row.chunk.id);
    }
    return { chunk: row.chunk, prior };
  };

  const markCurrent = () => {
    const marked = markCursorReviewed();
    if (!marked) return;
    const remaining = distinctChunks - reviewedCount - (marked.prior !== 'reviewed' ? 1 : 0);
    const next = cursorAfterMark(flat, review.stateOf, cursor, marked.chunk.id, true);
    if (next) {
      say(next.wrapped ? `Reviewed. ${remaining} remaining. Wrapped to start of book.` : `Reviewed. ${remaining} remaining.`);
      moveCursor(next.index);
    } else {
      say('All chunks reviewed.');
      scrollToRow(flat.rows.length - 1);
    }
  };

  // Mark-in-place (m): same mark, cursor stays put so the reviewer can `g` into the chunk's strip.
  const markInPlace = () => {
    const marked = markCursorReviewed();
    if (!marked) return;
    const remaining = distinctChunks - reviewedCount - (marked.prior !== 'reviewed' ? 1 : 0);
    say(remaining === 0 ? 'Reviewed. All chunks reviewed.' : `Reviewed — staying here. ${remaining} remaining.`);
  };

  const unmarkCurrent = () => {
    const row = chunkRowAt(cursor);
    if (!row || review.stateOf(row.chunk.id) !== 'reviewed') return;
    review.setState(row.chunk.id, 'seen');
    say('Unmarked.');
  };

  // Mouse mark toggle (the per-chunk "Reviewed" button): marks an arbitrary chunk in place — not the
  // cursor — so it can't reuse markCursorReviewed. Marks reviewed, or unmarks (→ seen) if already so.
  const toggleChunkReviewed = (chunk: Chunk) => {
    const prior = review.reviewOf(chunk.id);
    if (prior.state === 'reviewed') {
      // Unmark → seen; the autoRead evidence flag (if set) survives, so the glyph returns to ◑.
      review.setState(chunk.id, 'seen');
      say('Unmarked.');
      return;
    }
    // Confirming an auto-read chunk in place is an 'auto' promotion (it was read at reading pace, not
    // re-inspected now); any other mark is an explicit act.
    const via = isAutoReadReview(prior) ? 'auto' : 'explicit';
    review.setState(chunk.id, 'reviewed', prior.state === 'unseen' || undefined, via);
    flashReviewed(chunk.id);
    const remaining = distinctChunks - reviewedCount - 1;
    say(remaining <= 0 ? 'Reviewed. All chunks reviewed.' : `Reviewed. ${remaining} remaining.`);
  };

  const jumpUnreviewed = (dir: 1 | -1) => {
    const found = findUnreviewed(flat, review.stateOf, cursor + dir, dir);
    if (!found) {
      say('All chunks reviewed.');
      return;
    }
    if (found.wrapped) say(dir === 1 ? 'Wrapped to start of book.' : 'Wrapped to end of book.');
    moveCursor(found.index);
  };

  const toggleCollapseCurrent = () => {
    const row = chunkRowAt(cursor);
    if (!row) return;
    setCollapsed(row.chunk, !isCollapsed(row.chunk));
  };

  const toggleDefinitionsFor = (chunk: Chunk) => {
    const outcome = context.toggle(chunk.id);
    if (outcome === 'expanded') focusAndAnnouncePanel(chunk.id, context.payloadFor(chunk.id));
    else if (outcome === 'collapsed') say('Definitions hidden.');
  };

  const toggleDefinitionsCurrent = () => {
    const row = chunkRowAt(cursor);
    if (row) toggleDefinitionsFor(row.chunk);
  };

  // Follow a `reveal` chip (the file-level "exercises" edge): show the exercised impl code in this
  // chunk's definition panel rather than jumping to a meaningless file anchor. Expands (never toggles
  // shut) so a click always reveals; if nothing resolved, say so honestly instead of opening an empty
  // panel — the exercised method may be off-diff-and-unreadable or an ambiguous overload.
  const revealDefinitionsFor = (chunk: Chunk) => {
    const payload = context.payloadFor(chunk.id);
    if (payload === undefined) {
      // Unfetched (rare — the cursor effect prefetches): toggle records intent and the deferred
      // arrival focuses + announces if anything resolved.
      context.toggle(chunk.id);
      return;
    }
    if (visibleDefinitions(payload, data.chunks).length === 0) {
      say('No exercised definition we could pin down — it may be defined outside the files we can read, or an ambiguous overload.');
      return;
    }
    if (!context.isExpanded(chunk.id)) context.toggle(chunk.id);
    focusAndAnnouncePanel(chunk.id, payload);
  };

  const markSection = (sectionId: string) => {
    const batch = batches.get(sectionId);
    if (!batch) return;
    setLastBatch({ sectionId, prior: batch.ids.map((id) => ({ chunkId: id, review: review.reviewOf(id) })) });
    review.setMany(
      batch.ids.map((id) => {
        const r = review.reviewOf(id);
        return {
          chunkId: id,
          state: 'reviewed' as const,
          ...(r.state === 'unseen' ? { markedUnseen: true } : {}),
          // Auto-read chunks promote as 'auto' (read at reading pace); stubs stay explicit acks.
          ...(r.autoRead ? { reviewedVia: 'auto' as const } : {}),
        };
      }),
    );
    const remaining = distinctChunks - reviewedCount - batch.ids.length;
    const verb = batch.readCount > 0 ? 'Confirmed' : 'Marked';
    say(remaining === 0 ? `${verb} ${batch.ids.length} chunks reviewed. All chunks reviewed.` : `${verb} ${batch.ids.length} chunks reviewed. ${remaining} remaining.`);
  };

  // Confirm all book-wide auto-read chunks (progress-cluster + end-row bulk). One accountable act over
  // evidence gathered at reading pace — goes through the batch path so Undo restores exact prior values.
  const confirmAutoRead = () => {
    if (autoReadIds.length === 0) return;
    setLastBatch({ prior: autoReadIds.map((id) => ({ chunkId: id, review: review.reviewOf(id) })) });
    review.setMany(autoReadIds.map((id) => ({ chunkId: id, state: 'reviewed' as const, reviewedVia: 'auto' as const })));
    const remaining = distinctChunks - reviewedCount - autoReadIds.length;
    say(remaining === 0 ? `Confirmed ${autoReadIds.length} chunks reviewed. All chunks reviewed.` : `Confirmed ${autoReadIds.length} chunks reviewed. ${remaining} remaining.`);
  };

  const undoBatch = () => {
    if (!lastBatch) return;
    review.restoreMany(lastBatch.prior);
    const restoredReviewed = lastBatch.prior.filter((p) => p.review.state === 'reviewed').length;
    say(`Batch undone. ${distinctChunks - reviewedCount + lastBatch.prior.length - restoredReviewed} remaining.`);
    setLastBatch(null);
  };

  // ---- Deferral (spec 06 slice 6) ------------------------------------------------------------
  const openDefer = (chunkId: string, lineRange: LineRange | undefined) => setDeferState({ chunkId, text: '', lineRange });
  const closeDefer = () => setDeferState(null);
  const changeDeferText = (text: string) => setDeferState((s) => (s ? { ...s, text } : s));

  // POST optimistically (an ai record starts `running` so the poll + stub react immediately), then
  // reconcile with the server's stored record. Deferring collapses the chunk in place and banks
  // `seen` if it was unseen — it's held, not un-encountered.
  const submitDefer = (chunk: Chunk, action: { kind: 'note' | 'ai'; inline: boolean }) => {
    if (!deferState) return;
    const req: DeferralRequest = {
      id: crypto.randomUUID(),
      chunkId: chunk.id,
      kind: action.kind,
      text: deferState.text,
      ...(deferState.lineRange ? { lineRange: deferState.lineRange } : {}),
      ...(action.inline ? { inline: true } : {}),
    };
    const optimistic: Deferral = {
      ...req,
      createdAt: new Date().toISOString(),
      ...(action.kind === 'ai' ? { answerStatus: 'running' as const } : {}),
    };
    setDeferrals((ds) => [...ds, optimistic]);
    closeDefer();
    if (!action.inline) setCollapsed(chunk, true);
    if (review.stateOf(chunk.id) === 'unseen') review.setSeen([chunk.id]);
    postDeferral(req)
      .then((stored) => setDeferrals((ds) => ds.map((d) => (d.id === stored.id ? stored : d))))
      .catch(() => say('Could not defer this chunk — try again.'));
    say(action.kind === 'note' ? 'Deferred to the end.' : action.inline ? 'Asking AI here.' : 'Deferred — AI is answering.');
  };

  const retryDeferral = (d: Deferral) => {
    const req: DeferralRequest = {
      id: d.id,
      chunkId: d.chunkId,
      kind: 'ai',
      text: d.text,
      ...(d.lineRange ? { lineRange: d.lineRange } : {}),
      ...(d.inline ? { inline: true } : {}),
    };
    setDeferrals((ds) => ds.map((x) => (x.id === d.id ? { ...x, answerStatus: 'running', answer: undefined, answerError: undefined } : x)));
    postDeferral(req)
      .then((stored) => setDeferrals((ds) => ds.map((x) => (x.id === stored.id ? stored : x))))
      .catch(() => say('Could not retry.'));
  };

  const removeDeferral = (id: string) => {
    const removed = deferrals.find((d) => d.id === id);
    setDeferrals((ds) => ds.filter((d) => d.id !== id));
    void deleteDeferral(id).catch(() => undefined);
    // Restore the chunk from its stub once its last deferred (non-inline) deferral is gone.
    if (removed && !removed.inline) {
      const stillDeferred = deferrals.some((d) => d.id !== id && d.chunkId === removed.chunkId && !d.inline);
      const chunk = chunksById.get(removed.chunkId);
      if (!stillDeferred && chunk) setCollapsed(chunk, false);
    }
  };

  const goToChunk = (chunkId: string) => {
    const idx = flat.firstIndexByChunkId.get(chunkId);
    if (idx !== undefined) moveCursor(idx);
  };

  const scrollToDeferred = () => {
    if (flat.deferredSectionRowIndex !== undefined) scrollToRow(flat.deferredSectionRowIndex);
  };

  const toggleDeferredDiff = (chunkId: string) =>
    setDeferredDiffShown((s) => {
      const next = new Set(s);
      if (!next.delete(chunkId)) next.add(chunkId);
      return next;
    });

  // Follow a neighbor edge to its chunk: push the origin, move the cursor, and re-highlight the
  // target (reviewed = a free re-encounter glance — never a re-audit). The move is instant scroll,
  // so prefers-reduced-motion is satisfied by construction.
  const jumpToNeighbor = (targetChunkId: string, announceOverride?: string) => {
    const targetIndex = flat.firstIndexByChunkId.get(targetChunkId);
    if (targetIndex === undefined) return;
    const target = chunksById.get(targetChunkId);
    const reviewed = review.stateOf(targetChunkId) === 'reviewed';
    setBackStack((s) => [...s, cursor]);
    setReencounter((r) => ({ chunkId: targetChunkId, state: reviewed ? 'reviewed' : 'unreviewed', seq: (r?.seq ?? 0) + 1 }));
    moveCursor(targetIndex);
    say(
      announceOverride ??
        `Jumped to ${target ? chunkTitle(target) : targetChunkId}${target ? ` in ${target.file}` : ''} — ${reviewed ? 'reviewed' : 'unreviewed'}.`,
    );
  };

  const goBack = () => {
    if (backStack.length === 0) {
      say('Nothing to go back to.');
      return;
    }
    const origin = backStack[backStack.length - 1]!;
    setBackStack(backStack.slice(0, -1));
    const originChunk = chunkRowAt(origin)?.chunk;
    moveCursor(origin);
    say(`Back to ${originChunk ? chunkTitle(originChunk) : 'the previous chunk'}.`);
  };

  // Step to a file piece (menu click, `[`/`]`): the existing neighbor jump — the back-stack is the
  // return path — with an announce that names the file-position instead of the graph relation.
  const jumpToPiece = (targetChunkId: string) => {
    const target = chunksById.get(targetChunkId);
    const piece = fileOrder.get(targetChunkId);
    const reviewed = review.stateOf(targetChunkId) === 'reviewed';
    const where = piece && target ? `piece ${piece.n} of ${target.file}` : (target?.file ?? targetChunkId);
    setPieceMenu(null);
    jumpToNeighbor(targetChunkId, `${where} — ${reviewed ? 'reviewed' : 'unreviewed'}.`);
  };

  const stepPiece = (dir: 1 | -1) => {
    const chunk = chunkRowAt(cursor)?.chunk;
    if (!chunk) return;
    const target = stepPieceTarget(fileOrder.get(chunk.id), chunk.id, dir);
    if (target) jumpToPiece(target);
  };

  // Open in Files view: switch to the file-mode grouping, then land on the file's first piece. When
  // already in Files view it's a plain jump; otherwise the target is deferred to the reorder effect
  // (the config re-fetch is async and resets the cursor).
  const openInFilesView = (fileFirstChunkId: string) => {
    setPieceMenu(null);
    if (grouping === 'files') {
      jumpToNeighbor(fileFirstChunkId);
    } else {
      pendingJumpChunk.current = fileFirstChunkId;
      setView('files');
    }
  };

  const markAllPieces = (file: string, fileChunkIds: string[]) => {
    setPieceMenu(null);
    setLastBatch({ prior: fileChunkIds.map((id) => ({ chunkId: id, review: review.reviewOf(id) })) });
    review.setMany(
      fileChunkIds.map((id) => ({
        chunkId: id,
        state: 'reviewed' as const,
        ...(review.stateOf(id) === 'unseen' ? { markedUnseen: true } : {}),
      })),
    );
    const newly = fileChunkIds.filter((id) => review.stateOf(id) !== 'reviewed').length;
    const remaining = distinctChunks - reviewedCount - newly;
    const label = `${fileChunkIds.length} piece${fileChunkIds.length === 1 ? '' : 's'} of ${file}`;
    say(remaining === 0 ? `${label} marked reviewed. All chunks reviewed.` : `${label} marked reviewed. ${remaining} remaining.`);
  };

  // `g` focuses the first chip of the focused chunk's strip (roving tabindex takes over from there).
  const focusNeighborStrip = () => {
    const id = chunkRowAt(cursor)?.chunk.id;
    const first = id ? stripEls.current.get(id)?.querySelector<HTMLButtonElement>('button.neighbor-chip') : undefined;
    if (first) first.focus();
    else say('No related chunks for this one.');
  };

  const exitNeighborStrip = () => {
    const rowIndex = flat.chunkRowIndexes[cursor];
    if (rowIndex !== undefined) rowEls.current.get(rowIndex)?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!reencounter) return;
    const t = window.setTimeout(() => setReencounter(null), 1600);
    return () => window.clearTimeout(t);
  }, [reencounter]);

  useEffect(() => {
    if (!justReviewed) return;
    const t = window.setTimeout(() => setJustReviewed(null), 240);
    return () => window.clearTimeout(t);
  }, [justReviewed]);

  // Track the top-bar width; below the threshold the right controls + AI cluster items collapse (4d).
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => setCompact((entries[0]?.contentRect.width ?? Infinity) < COMPACT_WIDTH));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Chapter-completion beat (spec 06 slice 4b): one summarizing toast on the incomplete→complete edge,
  // guarded against unmark→remark churn by diffing against the prior snapshot. The baseline (mount /
  // resume) seeds silently — already-complete chapters never announce.
  const prevStatsRef = useRef<Map<string, { done: number; total: number }> | null>(null);
  useEffect(() => {
    const prev = prevStatsRef.current;
    prevStatsRef.current = sectionStats;
    if (prev === null || done) return;
    const completed = newlyCompleted(prev, sectionStats);
    if (completed.length === 0) return;
    const byId = new Map(bookData.book.sections.map((s) => [s.id, s.title]));
    const titles = completed.map((id) => sectionLabel(byId.get(id) ?? id));
    const copy = completionToastCopy(titles, chaptersRemaining(sectionStats));
    if (copy) say(copy);
  }, [sectionStats]);

  // Scoped, self-terminating poll (spec 06 slice 6): while any ai answer is pending, refresh the
  // deferral store every ~10s; the effect tears the interval down the moment `shouldPoll` goes false.
  const polling = shouldPoll(deferrals);
  useEffect(() => {
    if (!polling) return;
    const t = window.setInterval(() => {
      void fetchDeferrals()
        .then((r) => setDeferrals(r.deferrals))
        .catch(() => undefined);
    }, 10000);
    return () => window.clearInterval(t);
  }, [polling]);

  // Polite announce once per running→done transition — never a toast or modal (the reviewer deferred
  // precisely to avoid interruption; the passive cluster count + this live-region are the whole signal).
  const prevDeferralsRef = useRef(deferrals);
  useEffect(() => {
    const prev = prevDeferralsRef.current;
    prevDeferralsRef.current = deferrals;
    if (newlyAnswered(prev, deferrals) > 0) say('An AI answer is ready in Deferred.');
  }, [deferrals]);

  // Grouping (View: Story vs Files) is derived from the config — file mode is the dependency-first +
  // tests-after combination (isFileModeConfig). The last chapter-mode config is remembered so toggling
  // back to Story restores the reviewer's prior ordering axes rather than a default.
  const grouping: 'story' | 'files' = isFileModeConfig(bookResponse.config) ? 'files' : 'story';
  const lastStoryConfig = useRef<StoryConfig>(isFileModeConfig(data.config) ? DEFAULT_STORY_CONFIG : data.config);
  useEffect(() => {
    if (!isFileModeConfig(bookResponse.config)) lastStoryConfig.current = bookResponse.config;
  }, [bookResponse.config]);

  // Live reorder (#114): re-fetch the book under the chosen axes. Review marks are per-chunk (server
  // state) so they carry over untouched; only the order changes.
  const changeConfig = (config: StoryConfig) => {
    if (reordering || storyConfigKey(config) === storyConfigKey(bookResponse.config)) return;
    setReordering(true);
    fetchBook(config)
      .then((next) => {
        pendingReorder.current = true;
        setBookResponse(next);
      })
      .catch(() => say('Could not change the reading order.'))
      .finally(() => setReordering(false));
  };

  // The cursor and back-stack are flat indices, so any reorder of the book invalidates them. Two
  // reorders reach this effect through `flat` changing:
  //  - a manual reading-order flip (`pendingReorder`): a deliberate fresh start — jump to the first
  //    unreviewed chunk and drop the back-stack;
  //  - the AI order overlay landing mid-review (or any other recompile): keep the reviewer on the
  //    chunk they were reading by remapping cursor + back-stack through their occurrence keys (#112).
  // Deferral injects and narration updates also rebuild `flat` but keep the order, so the remap is a
  // no-op there.
  const prevFlat = useRef(flat);
  useEffect(() => {
    const prev = prevFlat.current;
    prevFlat.current = flat;
    if (prev === flat) return;

    if (pendingReorder.current) {
      pendingReorder.current = false;
      setBackStack([]);
      const jumpTarget = pendingJumpChunk.current;
      pendingJumpChunk.current = undefined;
      const jumpIndex = jumpTarget ? flat.firstIndexByChunkId.get(jumpTarget) : undefined;
      if (jumpIndex !== undefined) {
        moveCursor(jumpIndex);
      } else {
        const first = findUnreviewed(flat, review.stateOf, 0, 1);
        moveCursor(first ? first.index : 0);
      }
      say(`Reading order: ${configSummary(bookResponse.config)}.`);
      return;
    }

    const remapped = remapCursor(prev, flat, cursor);
    if (remapped !== cursor) moveCursor(remapped);
    setBackStack((s) => {
      const next = remapBackStack(prev, flat, s);
      return next.length === s.length && next.every((v, i) => v === s[i]) ? s : next;
    });
  }, [flat]);

  // View toggle: Files → the file-mode config (all a file's changes grouped); Story → the remembered
  // chapter config. A no-op if already there (changeConfig guards on config equality).
  const setView = (view: 'story' | 'files') => {
    changeConfig(view === 'files' ? FILE_MODE_STORY_CONFIG : lastStoryConfig.current);
    say(view === 'files' ? 'View: all changes grouped by file.' : 'View: story.');
  };

  // Hide-reviewed toggle, shared by the inline top-bar control and the overflow popover.
  const toggleHideReviewed = (checked: boolean, el?: HTMLElement) => {
    setHideReviewed(checked);
    // Reset overrides, but keep stub expansions — they are persisted review state.
    setCollapsedOverride((prev) => {
      const kept = new Map<string, boolean>();
      for (const [id, collapsed] of prev) {
        const index = flat.firstIndexByChunkId.get(id);
        const chunk = index === undefined ? undefined : chunkRowAt(index)?.chunk;
        if (chunk && isLowSignal(chunk) && !collapsed) kept.set(id, collapsed);
      }
      return kept;
    });
    el?.blur();
  };

  // Draggable outline width. Tracks the pointer on window (so a fast drag off the 6px handle keeps
  // working) and persists the final width; a body class kills text-selection + sets the resize cursor.
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = outlineWidth;
    let latest = startW;
    const onMove = (ev: PointerEvent) => {
      latest = Math.max(180, Math.min(560, startW + (ev.clientX - startX)));
      setOutlineWidth(latest);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.classList.remove('resizing-outline');
      try {
        localStorage.setItem('code-story:outline-width', String(latest));
      } catch {
        // Private-mode storage rejection — width just isn't remembered; not fatal.
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.body.classList.add('resizing-outline');
  };

  useBookKeymap({
    overlayOpen,
    setOverlayOpen,
    cursor,
    totalOccurrences,
    flat,
    rowEls,
    moveCursor,
    jumpUnreviewed,
    markCurrent,
    markInPlace,
    unmarkCurrent,
    toggleCollapseCurrent,
    toggleDefinitionsCurrent,
    focusNeighborStrip,
    goBack,
    stepPiece,
  });

  useSeenTracking({ scrollRef, virtualizer, flat, stateOf: review.stateOf, setSeen: review.setSeen });
  useReadTracking({
    scrollRef,
    virtualizer,
    flat,
    data: bookData,
    reviewOf: review.reviewOf,
    isCollapsed,
    setAutoRead: review.setAutoRead,
  });

  const items = virtualizer.getVirtualItems();
  const spy = useMemo(() => {
    // Skip overscan rows above the viewport — the spy must name what's actually on screen.
    const top = virtualizer.scrollOffset ?? 0;
    const first = (items.find((it) => it.end > top) ?? items[0])?.index ?? 0;
    for (let i = first; i >= 0; i--) {
      const row = flat.rows[i];
      // A chapter chunk may live outside its chapter's anchor file — name the file actually on screen.
      if (row?.kind === 'chunk') return { sectionId: row.sectionId, occurrenceKey: row.occurrenceKey, title: row.chunk.file };
      if (row?.kind === 'section') return { sectionId: row.id, occurrenceKey: undefined, title: row.title };
    }
    return undefined;
  }, [items, flat]);
  // Walk-back rule: hold the last resolved section at boundaries so the highlight never flickers to
  // nowhere (spy is undefined only for an empty book).
  const lastSpyRef = useRef(spy);
  const currentSection = spy ?? lastSpyRef.current;
  lastSpyRef.current = currentSection;

  const onScreenSectionIds = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      const row = flat.rows[it.index];
      if (row?.kind === 'chunk') set.add(row.sectionId);
      else if (row?.kind === 'section') set.add(row.id);
    }
    return set;
  }, [items, flat]);

  const sectionAckFor = (sectionId: string): SectionAck | undefined => {
    if (lastBatch?.sectionId === sectionId) {
      return { kind: 'undo', count: lastBatch.prior.length, hadRead: lastBatch.prior.some((p) => p.review.autoRead === true) };
    }
    const batch = batches.get(sectionId);
    return batch
      ? { kind: 'mark', count: batch.ids.length, reason: batch.reason, readCount: batch.readCount, stubCount: batch.stubCount }
      : undefined;
  };

  const cursorRowIndex = flat.chunkRowIndexes[cursor];
  const cursorRow = chunkRowAt(cursor);
  const cursorChips = useMemo(() => {
    const chunk = cursorRow?.chunk;
    if (!chunk) return [];
    return computeNeighborChips(bookData.chunkGraph ?? { edges: [] }, chunk.id, chunksById, review.reviewOf, (id) =>
      flat.firstIndexByChunkId.has(id),
    );
  }, [cursorRow, bookData, chunksById, review.states, flat]);

  // Frontier surfacing (spec 05 gate 1) — display-only, gates nothing. The graph carries edges into
  // out-of-book chunks; only in-book endpoints count (same predicate the strip uses).
  const graph = bookData.chunkGraph ?? { edges: [] };
  const inBook = useCallback((id: string) => flat.firstIndexByChunkId.has(id), [flat]);
  const frontier = useMemo(() => frontierCount(graph, review.stateOf, inBook), [graph, review.states, inBook]);
  const interactions = useMemo(() => interactionCount(graph, inBook), [graph, inBook]);

  // Deferral surfacing (spec 06 slice 6): the passive cluster count and the done-banner arriving line.
  const deferralCluster = useMemo(() => deferCluster(deferrals), [deferrals]);
  const deferralsArriving = useMemo(() => answersStillArriving(deferrals), [deferrals]);

  // "Why this order?" copy, templated from the live config so it stays true after a runtime flip (#114).
  const whyCopy = whyThisOrderCopy(bookResponse.config, orderApplied, grouping === 'files');

  // Progress-cluster items 5–6 (spec 06): frontier + the AI indicators. Inline when there's room,
  // collapsed behind `AI ▾` when the bar is narrow (4d). Built once, rendered either way.
  const aiItems: { key: string; className: string; label: string; title: string }[] = [];
  if (!done && frontier > 0) {
    aiItems.push({
      key: 'frontier',
      className: 'frontier-indicator',
      label: `${frontier} cross-chunk interaction${frontier === 1 ? '' : 's'} still open`,
      title: 'Edges linking a reviewed chunk to an unreviewed one. Surfacing only — nothing is blocked, and no interaction is verified.',
    });
  }
  if (orderApplied) {
    aiItems.push({ key: 'order', className: 'ai-order-indicator', label: 'AI reading order', title: 'The section order was proposed by AI' });
  }
  if (narration.indicator?.kind === 'partial') {
    aiItems.push({
      key: 'narration',
      className: 'ai-narration-indicator',
      label: `AI narration: ${narration.indicator.narrated} of ${narration.indicator.narratable} sections`,
      title: 'Some sections carry an AI-written note; bare sections are not yet narrated',
    });
  } else if (narration.indicator?.kind === 'complete') {
    aiItems.push({ key: 'narration', className: 'ai-narration-indicator', label: 'AI narration', title: 'These sections carry an AI-written note' });
  }
  if (narration.chunkIndicator?.kind === 'partial') {
    aiItems.push({
      key: 'notes',
      className: 'ai-narration-indicator',
      label: `AI notes: ${narration.chunkIndicator.narrated} of ${narration.chunkIndicator.narratable} chunks`,
      title: 'Some chunks carry an AI-written note; the rest are not yet narrated',
    });
  } else if (narration.chunkIndicator?.kind === 'complete') {
    aiItems.push({ key: 'notes', className: 'ai-narration-indicator', label: 'AI notes', title: 'These chunks carry an AI-written note' });
  }

  return (
    <div className="app">
      <header className="top-bar" ref={headerRef}>
        <h1>code-story</h1>
        {bookResponse.links?.pr ? (
          <a
            className="range range-link"
            href={bookResponse.links.pr}
            target="_blank"
            rel="noreferrer"
            title={`${data.base}..${data.head} — open the pull request on GitHub (new tab)`}
          >
            {data.base.slice(0, 8)}..{data.head.slice(0, 8)} <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <span className="range" title={`${data.base}..${data.head}`}>
            {data.base.slice(0, 8)}..{data.head.slice(0, 8)}
          </span>
        )}
        {bookResponse.links?.app && (
          <a
            className="app-link"
            href={bookResponse.links.app.url}
            target="_blank"
            rel="noreferrer"
            title={`The app built from this PR, running at ${linkHost(bookResponse.links.app.url)}. Opens in a new tab — if it doesn't load, the dev server may have stopped.`}
            aria-label="Try the app — opens in a new tab"
          >
            <span aria-hidden="true">▶</span> <span className="app-link-label">{bookResponse.links.app.label ?? 'Try the app'}</span>
          </a>
        )}
        <span className="progress-cluster">
          <span className={done ? 'progress-text done' : 'progress-text'}>
            {done ? (
              `All ${distinctChunks} reviewed ✓`
            ) : (
              <>
                {reviewedCount} / {distinctChunks} reviewed
                {pendingStubs > 0 && ` · ${pendingStubs} pending stub${pendingStubs === 1 ? '' : 's'}`}
              </>
            )}
          </span>
          <span className="progress-bar segmented" role="img" aria-label={`${reviewedCount} of ${distinctChunks} chunks reviewed`}>
            {segments.map((seg) => {
              const label = `${sectionLabel(seg.title)} — ${seg.done} of ${seg.total} reviewed`;
              return (
                <span key={seg.sectionId} className={`seg seg-${seg.state}`} style={{ flexGrow: seg.total }} title={label} aria-label={label}>
                  {seg.state === 'partial' && <span className="seg-fill" style={{ width: `${(seg.done / seg.total) * 100}%` }} />}
                </span>
              );
            })}
          </span>
          {!done && autoReadIds.length > 0 && (
            <span className="autoread-cluster">
              · {autoReadIds.length} auto-read{' '}
              <button className="bar-button autoread-confirm" title="Confirm every auto-read chunk as reviewed" onClick={confirmAutoRead}>
                ▸ Confirm
              </button>
            </span>
          )}
          {deferralCluster.deferredCount > 0 && (
            <button className="bar-button deferred-cluster" title="Jump to the Deferred section" onClick={scrollToDeferred}>
              · {deferralCluster.text}
            </button>
          )}
          {compact ? (
            <button
              className="bar-button ai-collapse"
              aria-haspopup="dialog"
              aria-expanded={aiAnchor !== null}
              title="AI reading order, notes, and open interactions"
              onClick={(e) => { const t = e.currentTarget; setAiAnchor((a) => (a ? null : t)); }}
            >
              AI ▾{aiItems.length > 0 ? ` ${aiItems.length}` : ''}
            </button>
          ) : (
            <>
              {aiItems.map((it) => (
                <span key={it.key} className={it.className} title={it.title}>
                  {it.label}
                </span>
              ))}
              <button className="bar-button why-order" title="What decided this reading order?" onClick={(e) => setWhyAnchor(e.currentTarget)}>
                Why this order?
              </button>
            </>
          )}
        </span>
        <span className="spacer" />
        {backStack.length > 0 && (
          <button className="bar-button back-button" title="Back to where you jumped from (b)" onClick={goBack}>
            ← back
          </button>
        )}
        {lastBatch && (
          <button className="bar-button" onClick={undoBatch}>
            Undo batch ({lastBatch.prior.length})
          </button>
        )}
        {done ? (
          <button className="bar-button" title="End of book" onClick={() => scrollToRow(flat.rows.length - 1)}>
            View summary
          </button>
        ) : (
          <button className="bar-button" title="n" onClick={() => jumpUnreviewed(1)}>
            Next unreviewed
          </button>
        )}
        <div className="view-toggle" role="group" aria-label="View">
          <button
            type="button"
            className="bar-button"
            aria-pressed={grouping === 'story'}
            disabled={reordering}
            title="Read the story: chunks grouped into call-path chapters"
            onClick={() => setView('story')}
          >
            Story
          </button>
          <button
            type="button"
            className="bar-button"
            aria-pressed={grouping === 'files'}
            disabled={reordering}
            title="Group every file's changes together"
            onClick={() => setView('files')}
          >
            Files
          </button>
        </div>
        {compact ? (
          <button
            className="bar-button overflow-toggle"
            aria-haspopup="dialog"
            aria-expanded={overflowAnchor !== null}
            title="More controls"
            onClick={(e) => { const t = e.currentTarget; setOverflowAnchor((a) => (a ? null : t)); }}
          >
            ⋯
          </button>
        ) : (
          <>
            <label className="bar-toggle">
              <input type="checkbox" checked={hideReviewed} onChange={(e) => toggleHideReviewed(e.currentTarget.checked, e.currentTarget)} />
              Hide reviewed
            </label>
            <OrderOptionsControl
              config={bookResponse.config}
              orderApplied={orderApplied}
              busy={reordering}
              fileView={grouping === 'files'}
              onChange={changeConfig}
            />
            {bookResponse.links?.filesChanged && (
              <a
                className="export"
                href={bookResponse.links.filesChanged}
                target="_blank"
                rel="noreferrer"
                title="This diff on GitHub, in the Files changed tab (new tab)"
              >
                Files changed ↗
              </a>
            )}
            <a className="export" href="/api/export.md" target="_blank" rel="noreferrer">
              Export
            </a>
          </>
        )}
        <button className="bar-button help" title="Keyboard shortcuts (?)" onClick={() => setOverlayOpen(true)}>
          ?
        </button>
      </header>
      {order.offer && (
        <div className="order-banner" role="region" aria-label="AI reading order">
          <span>AI reading order ready — apply?</span>
          <button className="bar-button" onClick={order.applyOrder}>
            Apply
          </button>
          <button className="bar-button" onClick={order.dismissOrder}>
            Dismiss
          </button>
        </div>
      )}
      {narration.opener && (
        <div className="book-opener" role="note" aria-label="AI opener">
          <span className="badge ai-badge">AI</span>
          <span className="book-opener-text">{narration.opener}</span>
        </div>
      )}
      <div className="body">
        <OutlineSidebar
          data={bookData}
          flat={flat}
          width={outlineWidth}
          reviewOf={review.reviewOf}
          sectionStats={sectionStats}
          currentSectionId={currentSection?.sectionId}
          currentOccurrenceKey={currentSection?.occurrenceKey}
          onScreenSectionIds={onScreenSectionIds}
          onJump={moveCursor}
          deferred={
            deferredIds.length > 0
              ? { count: deferredIds.length, current: currentSection?.sectionId === DEFERRED_SECTION_ID, onJump: scrollToDeferred }
              : undefined
          }
        />
        <div
          className="outline-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          onPointerDown={startResize}
        />
        <div className="feed-wrap">
          {currentSection && <div className="current-file">{currentSection.title}</div>}
          <div
            className="feed"
            ref={scrollRef}
            role="feed"
            aria-label={`Review book ${data.base.slice(0, 8)}..${data.head.slice(0, 8)}`}
          >
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {items.map((item) => {
                const row = flat.rows[item.index]!;
                const wrap = (children: React.ReactNode) => (
                  <div
                    key={item.key}
                    data-index={item.index}
                    ref={virtualizer.measureElement}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${item.start}px)` }}
                  >
                    {children}
                  </div>
                );
                if (row.kind === 'deferred-card') {
                  return wrap(
                    <DeferredCard
                      chunk={row.chunk}
                      deferrals={deferralsByChunk.deferred.get(row.chunk.id) ?? []}
                      diffLines={bookData.diffs[row.chunk.id] ?? []}
                      reviewed={review.stateOf(row.chunk.id) === 'reviewed'}
                      showDiff={deferredDiffShown.has(row.chunk.id)}
                      onToggleDiff={() => toggleDeferredDiff(row.chunk.id)}
                      onMarkReviewed={() => toggleChunkReviewed(row.chunk)}
                      onRemove={removeDeferral}
                      onRetry={retryDeferral}
                      onGoToChunk={() => goToChunk(row.chunk.id)}
                    />,
                  );
                }
                return wrap(
                    <RowView
                      row={row}
                      data={bookData}
                      totalOccurrences={totalOccurrences}
                      distinctChunks={distinctChunks}
                      reviewedCount={reviewedCount}
                      autoReadCount={autoReadIds.length}
                      autoConfirmedCount={autoConfirmedCount}
                      onConfirmAutoRead={confirmAutoRead}
                      interactions={interactions}
                      sectionStats={sectionStats}
                      sectionAck={row.kind === 'section' ? sectionAckFor(row.id) : undefined}
                      sectionAiLine={row.kind === 'section' ? narration.sectionLine(row.id)?.text : undefined}
                      chunkAiLine={row.kind === 'chunk' ? narration.chunkLine(row.sectionId, row.chunk.id) : undefined}
                      chunkBadge={row.kind === 'chunk' ? narration.chunkBadge(row.chunk.id) : undefined}
                      onMarkSection={markSection}
                      onUndoBatch={undoBatch}
                      state={row.kind === 'chunk' ? review.stateOf(row.chunk.id) : 'unseen'}
                      autoRead={row.kind === 'chunk' && isAutoReadReview(review.reviewOf(row.chunk.id))}
                      justReviewed={row.kind === 'chunk' && justReviewed?.chunkId === row.chunk.id}
                      collapsed={row.kind === 'chunk' && isCollapsed(row.chunk)}
                      showFile={row.kind === 'chunk' && showFileForRow.has(row.occurrenceKey)}
                      chapterCount={chapterCount}
                      linesRead={linesRead}
                      bulkLowSignalCount={bulkLowSignalCount}
                      isCursor={item.index === cursorRowIndex}
                      registerEl={(el) => {
                        if (el) rowEls.current.set(item.index, el);
                        else rowEls.current.delete(item.index);
                      }}
                      onSelect={() => {
                        const i = flat.chunkRowIndexes.indexOf(item.index);
                        if (i >= 0) setCursor(i);
                      }}
                      onJumpNext={() => jumpUnreviewed(1)}
                      onExpand={(chunk) => setCollapsed(chunk, false)}
                      onToggleReviewed={toggleChunkReviewed}
                      contextPayload={row.kind === 'chunk' ? context.payloadFor(row.chunk.id) : undefined}
                      panelExpanded={row.kind === 'chunk' && context.isExpanded(row.chunk.id)}
                      onToggleDefinitions={toggleDefinitionsFor}
                      registerPanelEl={(chunkId, el) => {
                        if (el) panelEls.current.set(chunkId, el);
                        else panelEls.current.delete(chunkId);
                      }}
                      neighborChips={item.index === cursorRowIndex ? cursorChips : undefined}
                      onJumpToChunk={jumpToNeighbor}
                      onRevealDefinitions={revealDefinitionsFor}
                      onExitStrip={exitNeighborStrip}
                      registerStripEl={(chunkId, el) => {
                        if (el) stripEls.current.set(chunkId, el);
                        else stripEls.current.delete(chunkId);
                      }}
                      reencounter={row.kind === 'chunk' && reencounter?.chunkId === row.chunk.id ? reencounter.state : undefined}
                      piece={row.kind === 'chunk' ? fileOrder.get(row.chunk.id) : undefined}
                      pieceMenuOpen={row.kind === 'chunk' && pieceMenu?.chunkId === row.chunk.id}
                      onOpenPieceMenu={(chunkId, anchorEl) => setPieceMenu({ chunkId, anchorEl })}
                      deferralsArriving={row.kind === 'end' ? deferralsArriving : 0}
                      deferOpen={row.kind === 'chunk' && deferState?.chunkId === row.chunk.id}
                      deferText={row.kind === 'chunk' && deferState?.chunkId === row.chunk.id ? deferState.text : ''}
                      deferLineRange={row.kind === 'chunk' && deferState?.chunkId === row.chunk.id ? deferState.lineRange : undefined}
                      onDeferOpen={openDefer}
                      onDeferClose={closeDefer}
                      onDeferTextChange={changeDeferText}
                      onDeferSubmit={submitDefer}
                      deferStub={
                        row.kind === 'chunk' && deferralsByChunk.deferred.has(row.chunk.id)
                          ? stubCopy(deferralsByChunk.deferred.get(row.chunk.id)!)
                          : undefined
                      }
                      inlineDeferrals={row.kind === 'chunk' ? deferralsByChunk.inline.get(row.chunk.id) : undefined}
                      onRetryDeferral={retryDeferral}
                      onRemoveDeferral={removeDeferral}
                    />,
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="sr-only" aria-live="polite">
        {announce.msg}
      </div>
      {toastVisible && announce.msg && <div className="toast">{announce.msg}</div>}
      {overlayOpen && <ShortcutOverlay onClose={() => setOverlayOpen(false)} />}
      {pieceMenu &&
        (() => {
          const piece = fileOrder.get(pieceMenu.chunkId);
          const chunk = chunksById.get(pieceMenu.chunkId);
          if (!piece || !chunk) return null;
          const model = pieceMenuModel(chunk.file, piece, chunksById, review.reviewOf, pieceMenu.chunkId);
          return (
            <FilePiecesMenu
              model={model}
              anchorEl={pieceMenu.anchorEl}
              onJump={jumpToPiece}
              onOpenFiles={() => openInFilesView(piece.fileChunkIdsInOrder[0]!)}
              onMarkAll={() => markAllPieces(chunk.file, piece.fileChunkIdsInOrder)}
              onClose={() => setPieceMenu(null)}
            />
          );
        })()}
      {whyAnchor && (
        <AnchoredPopover anchorEl={whyAnchor} ariaLabel="Why this order?" className="why-popover" onClose={() => setWhyAnchor(null)}>
          <div className="why-popover-head">
            {whyCopy.aiBadged && <span className="badge ai-badge">AI</span>} Why this order?
          </div>
          <p className="why-popover-text">{whyCopy.text}</p>
        </AnchoredPopover>
      )}
      {overflowAnchor && (
        <AnchoredPopover anchorEl={overflowAnchor} ariaLabel="More controls" className="overflow-popover" onClose={() => setOverflowAnchor(null)}>
          <label className="bar-toggle">
            <input type="checkbox" checked={hideReviewed} onChange={(e) => toggleHideReviewed(e.currentTarget.checked)} />
            Hide reviewed
          </label>
          <OrderOptionsControl
            config={bookResponse.config}
            orderApplied={orderApplied}
            busy={reordering}
            fileView={grouping === 'files'}
            onChange={changeConfig}
          />
          {bookResponse.links?.filesChanged && (
            <a
              className="export"
              href={bookResponse.links.filesChanged}
              target="_blank"
              rel="noreferrer"
              title="This diff on GitHub, in the Files changed tab (new tab)"
            >
              Files changed ↗
            </a>
          )}
          <a className="export" href="/api/export.md" target="_blank" rel="noreferrer">
            Export
          </a>
        </AnchoredPopover>
      )}
      {aiAnchor && (
        <AnchoredPopover anchorEl={aiAnchor} ariaLabel="AI reading order and notes" className="ai-popover" onClose={() => setAiAnchor(null)}>
          {aiItems.map((it) => (
            <div key={it.key} className="ai-popover-line" title={it.title}>
              {it.label}
            </div>
          ))}
          <button className="link-button why-order" onClick={() => setAiWhyExpanded((v) => !v)}>
            {aiWhyExpanded ? 'Hide' : 'Why this order?'}
          </button>
          {aiWhyExpanded && (
            <p className="why-popover-text">
              {whyCopy.aiBadged && <span className="badge ai-badge">AI</span>} {whyCopy.text}
            </p>
          )}
        </AnchoredPopover>
      )}
    </div>
  );
}
