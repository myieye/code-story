import type { Deferral, ReviewFile } from '@code-story/core';
import { useEffect, useState } from 'react';
import {
  type BookResponse,
  type NarrationResponse,
  type OrderResponse,
  fetchBook,
  fetchDeferrals,
  fetchNarration,
  fetchOrder,
  fetchReview,
} from './api.js';
import { BookPage } from './BookPage.js';
import { ChangelogPage } from './ChangelogPage.js';
import { LibraryPage } from './LibraryPage.js';
import { useHashRoute } from './useHashRoute.js';

type State =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | {
      phase: 'ready';
      data: BookResponse;
      review: ReviewFile;
      order: OrderResponse;
      narration: NarrationResponse;
      deferrals: Deferral[];
    };

export function App() {
  const route = useHashRoute();
  const [state, setState] = useState<State>({ phase: 'loading' });

  useEffect(() => {
    if (route !== 'book') return;
    Promise.all([fetchBook(), fetchReview(), fetchOrder(), fetchNarration(), fetchDeferrals()])
      .then(([data, review, order, narration, deferrals]) =>
        setState({ phase: 'ready', data, review, order, narration, deferrals: deferrals.deferrals }),
      )
      .catch((e: unknown) => setState({ phase: 'error', message: e instanceof Error ? e.message : String(e) }));
  }, [route]);

  if (route === 'library') {
    return <LibraryPage />;
  }
  if (route === 'changelog') {
    return <ChangelogPage />;
  }

  if (state.phase === 'loading') {
    return <main className="notice">Compiling the book…</main>;
  }
  if (state.phase === 'error') {
    return (
      <main className="notice">
        <h1>code-story</h1>
        <p>Could not load the book: {state.message}</p>
      </main>
    );
  }
  if (state.data.book.sections.length === 0) {
    return (
      <main className="notice">
        <h1>code-story</h1>
        <p>
          No changes between <code>{state.data.base.slice(0, 12)}</code> and{' '}
          <code>{state.data.head.slice(0, 12)}</code>. Wrong base? Run{' '}
          <code>code-story &lt;base&gt;..&lt;head&gt;</code> with the range you meant, or start one from the{' '}
          <a href="#/library">library</a>.
        </p>
      </main>
    );
  }
  return (
    <BookPage
      data={state.data}
      initialReview={state.review}
      initialOrder={state.order}
      initialNarration={state.narration}
      initialDeferrals={state.deferrals}
    />
  );
}
