/**
 * The auto-read evidence gate (spec 06 slice 3). Pure so every threshold edge is unit-tested.
 *
 * A chunk banks dwell time per chunkId across the whole session. Dwell is split into `banked` (time
 * committed from completed visits) and `current` (the in-progress visit). A fast scroll ("fling")
 * voids only the current run — banked time from earlier separate visits survives — and a row-height
 * change (async narration/badge arrival) never touches the accumulation, because it is keyed by
 * chunkId, not by pixels. A chunk auto-reads once banked + current clears its size-scaled threshold.
 */

export const AUTO_READ_MIN_VISIBLE = 0.6;
/** px/s: any scroll faster than this while a chunk is visible voids that chunk's current dwell run. */
export const AUTO_READ_VELOCITY_LIMIT = 2000;
const DWELL_PER_LINE_MS = 300;
const DWELL_MIN_MS = 1500;
const DWELL_MAX_MS = 8000;

/** Dwell a chunk must accumulate before it auto-reads: clamp(300ms × lines, 1500ms, 8000ms). */
export function dwellThresholdMs(diffLineCount: number): number {
  return Math.min(Math.max(DWELL_PER_LINE_MS * Math.max(diffLineCount, 0), DWELL_MIN_MS), DWELL_MAX_MS);
}

/** Fraction of a row's own height currently inside the viewport (0..1). */
export function visibleFraction(top: number, bottom: number, viewTop: number, viewBottom: number): number {
  const height = bottom - top;
  if (height <= 0) return 0;
  const overlap = Math.min(bottom, viewBottom) - Math.max(top, viewTop);
  return Math.max(0, Math.min(overlap, height)) / height;
}

export interface ChunkDwell {
  /** ms committed from completed visits — never reset by a fling or a re-measure. */
  banked: number;
  /** ms of the in-progress visit — voided by a fling, committed to `banked` on leaving. */
  current: number;
  /** Whether the row was accruing on the previous tick (so a fall-off can commit the run). */
  accruing: boolean;
}

export interface DwellTick {
  /** Not a low-signal stub and not collapsed — a diff the reviewer can actually read. */
  eligible: boolean;
  /** Rendered height fits the viewport; a taller chunk never auto-reads (needs an explicit mark). */
  fitsViewport: boolean;
  visibleFraction: number;
  /** ms since the previous tick (clamped by the caller against background-tab gaps). */
  dt: number;
  /** A scroll velocity spike (> limit) was observed while this chunk was on screen since last tick. */
  velocitySpike: boolean;
}

const EMPTY: ChunkDwell = { banked: 0, current: 0, accruing: false };

/** Advance one chunk's dwell accumulation by a tick. */
export function stepDwell(prev: ChunkDwell | undefined, tick: DwellTick): ChunkDwell {
  const state = prev ?? EMPTY;
  const accruing = tick.eligible && tick.fitsViewport && tick.visibleFraction >= AUTO_READ_MIN_VISIBLE;
  if (!accruing) {
    // Leaving the accruing state commits the run (a completed visit); banked is preserved.
    return state.accruing ? { banked: state.banked + state.current, current: 0, accruing: false } : { ...state, accruing: false };
  }
  // A fling while visible voids the in-progress run but keeps banked time from prior visits.
  if (tick.velocitySpike) return { banked: state.banked, current: 0, accruing: true };
  return { banked: state.banked, current: state.current + Math.max(tick.dt, 0), accruing: true };
}

export function totalDwell(state: ChunkDwell | undefined): number {
  return state ? state.banked + state.current : 0;
}

/** Whether accumulated dwell (banked + in-progress) clears the chunk's size-scaled threshold. */
export function clearsGate(state: ChunkDwell | undefined, diffLineCount: number): boolean {
  return totalDwell(state) >= dwellThresholdMs(diffLineCount);
}
