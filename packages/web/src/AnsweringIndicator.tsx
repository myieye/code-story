import { useEffect, useState } from 'react';
import { elapsedLabel } from './defer-logic.js';

/**
 * The live in-flight signal for a pending AI deferral (spec 138 Q1): an honest count-up since the
 * question was asked, plus opacity-pulsed dots. Owns its own 1s tick so only this ~1 mounted node
 * re-renders per second — BookPage never does. Both parts are aria-hidden (WCAG 4.1.3: announce
 * discrete transitions, never every tick); the surrounding "AI answering" text carries the meaning.
 */
export function AnsweringIndicator({ createdAtIso }: { createdAtIso: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <span className="answering-live" aria-hidden="true">
      {' '}
      {elapsedLabel(createdAtIso, now)}
      <span className="answering-dots" />
    </span>
  );
}
