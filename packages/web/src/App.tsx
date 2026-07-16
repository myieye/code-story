import type { ReviewFile } from '@code-story/core';
import { useEffect, useState } from 'react';
import { type BookResponse, type OrderResponse, fetchBook, fetchOrder, fetchReview } from './api.js';
import { BookPage } from './BookPage.js';

type State =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; data: BookResponse; review: ReviewFile; order: OrderResponse };

export function App() {
  const [state, setState] = useState<State>({ phase: 'loading' });

  useEffect(() => {
    Promise.all([fetchBook(), fetchReview(), fetchOrder()])
      .then(([data, review, order]) => setState({ phase: 'ready', data, review, order }))
      .catch((e: unknown) => setState({ phase: 'error', message: e instanceof Error ? e.message : String(e) }));
  }, []);

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
          <code>code-story &lt;base&gt;..&lt;head&gt;</code> with the range you meant.
        </p>
      </main>
    );
  }
  return <BookPage data={state.data} initialReview={state.review} initialOrder={state.order} />;
}
