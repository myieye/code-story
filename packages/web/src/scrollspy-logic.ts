/**
 * Pure helpers for the outline scrollspy (spec 06 slice 1). The sidebar tracks the section/occurrence
 * currently under the feed viewport; these functions decide what to auto-expand and whether the
 * active item needs the sidebar scrolled to keep it visible. No DOM, no React — unit-tested headless.
 */

export interface AutoExpand {
  /** Sections the sidebar renders open: the user's manual expansions plus the one auto-expanded section. */
  expanded: ReadonlySet<string>;
  /** The section the scrollspy expanded — carried to the next call so its successor can supersede it. */
  autoExpandedId: string | undefined;
}

/**
 * Recompute the open outline sections when the current section changes. Manual expansions always
 * stay open; exactly one section auto-expands to follow the viewport, so the prior auto-expansion
 * collapses unless the user had also opened it. When no section resolves (a momentary boundary),
 * the prior auto stays open rather than flickering shut.
 */
export function resolveAutoExpand(
  currentId: string | undefined,
  prevAutoId: string | undefined,
  manual: ReadonlySet<string>,
): AutoExpand {
  const auto = currentId ?? prevAutoId;
  const expanded = new Set(manual);
  if (auto !== undefined) expanded.add(auto);
  return { expanded, autoExpandedId: auto };
}

export interface Bounds {
  top: number;
  bottom: number;
}

/** True when `item` is not fully contained in `box` — the trigger to scroll the sidebar to it. */
export function isOutsideBox(item: Bounds, box: Bounds): boolean {
  return item.top < box.top || item.bottom > box.bottom;
}
