import type { ChangelogResponse } from '@code-story/core';
import { useEffect, useState } from 'react';
import { fetchChangelog } from './api.js';

type State = { phase: 'loading' } | { phase: 'error'; message: string } | { phase: 'ready'; data: ChangelogResponse };

/** R-063: a plain, user-facing history of what changed and when. */
export function ChangelogPage() {
  const [state, setState] = useState<State>({ phase: 'loading' });

  useEffect(() => {
    fetchChangelog()
      .then((data) => setState({ phase: 'ready', data }))
      .catch((e: unknown) => setState({ phase: 'error', message: e instanceof Error ? e.message : String(e) }));
  }, []);

  if (state.phase === 'loading') {
    return <main className="notice">Loading the changelog…</main>;
  }
  if (state.phase === 'error') {
    return (
      <main className="notice">
        <h1>code-story</h1>
        <p>Could not load the changelog: {state.message}</p>
      </main>
    );
  }

  return (
    <div className="app">
      <header className="top-bar">
        <h1>code-story</h1>
        <span className="range">v{state.data.version}</span>
        <span className="spacer" />
        <a className="bar-button" href="#/library">
          ← Library
        </a>
        <a className="bar-button" href="#/">
          Reader
        </a>
      </header>
      <main className="changelog">
        {state.data.entries.map((entry) => (
          <section className="changelog-entry" key={entry.version}>
            <h2>
              v{entry.version} — {entry.title}
            </h2>
            <p className="changelog-date">{entry.date}</p>
            <ul>
              {entry.changes.map((change, i) => (
                <li key={i}>{change}</li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
