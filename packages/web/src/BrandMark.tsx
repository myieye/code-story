/**
 * The code-story mark: a bookmark holding a two-row mini-diff — "your saved place in the changes".
 * Mono by design (single fill + paper knockouts); the bookmark body inherits `currentColor` so the
 * lockup tracks the wordmark ink, and the diff rows knock out in --surface. Colour (green add / red
 * remove) is a documented ≥32px flourish, not used at top-bar size.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 34"
      role="img"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="currentColor"
        d="M4 2H20Q22 2 22 4V32L12 25L2 32V4Q2 2 4 2Z"
      />
      <g fill="var(--surface)">
        <rect x="6.3" y="10" width="1.4" height="4" />
        <rect x="5" y="11.3" width="4" height="1.4" />
        <rect x="10.5" y="10.7" width="7.5" height="2.6" rx="1" />
        <rect x="5" y="17.8" width="4" height="1.4" />
        <rect x="10.5" y="17.2" width="5" height="2.6" rx="1" />
      </g>
    </svg>
  );
}
