import { useEffect, useState } from 'react';

export type Route = 'book' | 'library' | 'changelog';

/** Maps `location.hash` to a route. Anything unrecognized falls back to the book reader. */
export function parseRoute(hash: string): Route {
  if (hash === '#/library') return 'library';
  if (hash === '#/changelog') return 'changelog';
  return 'book';
}

/** Tracks `location.hash` as a route, re-rendering on `hashchange`. */
export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute(location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return route;
}
