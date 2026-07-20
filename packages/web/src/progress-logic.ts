/**
 * Pure progress model for the segmented bar, chapter-completion beat, and resume/done copy
 * (spec 06 slice 4). No React, no DOM — every threshold and every string is unit-tested headlessly.
 */

/** The web-only synthetic deferral section (spec 06 slice 6, not built yet): excluded everywhere so
 * the bar composes later without double-counting chunks that already live in their home chapters. */
export const DEFERRED_WEB_SECTION_ID = 'deferred:web';

export type SegmentState = 'untouched' | 'partial' | 'complete';

export interface Segment {
  sectionId: string;
  title: string;
  done: number;
  total: number;
  state: SegmentState;
}

interface SectionStat {
  done: number;
  total: number;
}

/** A chapter's short display label — the file basename, so a toast reads `FilterBar`, not a path. */
export function sectionLabel(title: string): string {
  const bare = title.split('/').pop() ?? title;
  return bare.replace(/\.[^.]+$/, '') || bare;
}

/** One segment per section, flex-widthed by chunk count, tri-state by reviewed share. Deferred excluded. */
export function segmentModel(
  sections: readonly { id: string; title: string }[],
  stats: ReadonlyMap<string, SectionStat>,
): Segment[] {
  const segments: Segment[] = [];
  for (const section of sections) {
    if (section.id === DEFERRED_WEB_SECTION_ID) continue;
    const stat = stats.get(section.id);
    const total = stat?.total ?? 0;
    if (total === 0) continue;
    const done = stat?.done ?? 0;
    const state: SegmentState = done === 0 ? 'untouched' : done >= total ? 'complete' : 'partial';
    segments.push({ sectionId: section.id, title: section.title, done, total, state });
  }
  return segments;
}

function isComplete(stat: SectionStat | undefined): boolean {
  return stat !== undefined && stat.total > 0 && stat.done >= stat.total;
}

/**
 * Sections that crossed the incomplete→complete edge between two snapshots. Edge-only, so an
 * already-complete section (or an unmark→remark that lands back where it was on the same tick)
 * never re-fires. Deferred and empty sections are ignored.
 */
export function newlyCompleted(prev: ReadonlyMap<string, SectionStat>, next: ReadonlyMap<string, SectionStat>): string[] {
  const ids: string[] = [];
  for (const [id, stat] of next) {
    if (id === DEFERRED_WEB_SECTION_ID || stat.total === 0) continue;
    if (isComplete(stat) && !isComplete(prev.get(id))) ids.push(id);
  }
  return ids;
}

/** Chapters not yet fully reviewed (deferred/empty excluded) — the "N chapters left" figure. */
export function chaptersRemaining(stats: ReadonlyMap<string, SectionStat>): number {
  let n = 0;
  for (const [id, stat] of stats) {
    if (id === DEFERRED_WEB_SECTION_ID || stat.total === 0) continue;
    if (!isComplete(stat)) n++;
  }
  return n;
}

function chaptersLeftPhrase(n: number): string {
  return n === 1 ? '1 chapter left' : `${n} chapters left`;
}

/**
 * The single toast for one completion tick: `undefined` when nothing completed, `Chapter done — X.
 * N chapters left.` for one, `K chapters done — N left.` for a batch. Never zero, never K toasts.
 * `titles` are display labels (basenames) already.
 */
export function completionToastCopy(titles: string[], chaptersLeft: number): string | undefined {
  if (titles.length === 0) return undefined;
  if (titles.length === 1) {
    return chaptersLeft > 0 ? `Chapter done — ${titles[0]}. ${chaptersLeftPhrase(chaptersLeft)}.` : `Chapter done — ${titles[0]}.`;
  }
  return chaptersLeft > 0 ? `${titles.length} chapters done — ${chaptersLeft} left.` : `${titles.length} chapters done.`;
}

/** Resume framed as proximity (spec 06 slice 4): `Resumed — 62% through. 3 chapters left, next up: FilterBar.` */
export function resumeCopy(percentThrough: number, chaptersLeft: number, nextUp: string | undefined): string {
  const parts = [`Resumed — ${percentThrough}% through.`];
  if (chaptersLeft > 0) {
    parts.push(nextUp ? `${chaptersLeftPhrase(chaptersLeft)}, next up: ${nextUp}.` : `${chaptersLeftPhrase(chaptersLeft)}.`);
  }
  return parts.join(' ');
}
