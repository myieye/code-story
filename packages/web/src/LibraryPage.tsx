import { explainConfig, type StoryConfig, type StorySummary } from '@code-story/core';
import { useEffect, useState } from 'react';
import { createStory, fetchChangelog, fetchStories, openStory } from './api.js';
import { chipTooltip, costGlyph, formatCreatedAt, isActiveStory, statsLabel, versionBadge } from './library-logic.js';
import { DIRECTION_OPTIONS, TEST_PLACEMENT_OPTIONS } from './order-options-logic.js';

type ListState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; stories: StorySummary[]; activeRange: string | null };

type FormState = { phase: 'idle' } | { phase: 'busy' } | { phase: 'error'; message: string };

/** After starting or opening a story, the reader needs a full reload against the switched range. */
function goToReader(): void {
  location.hash = '#/';
  location.reload();
}

function NewReviewForm({ onStarted }: { onStarted: () => void }) {
  const [range, setRange] = useState('');
  const [direction, setDirection] = useState<StoryConfig['direction']>('consumer-first');
  const [testPlacement, setTestPlacement] = useState<StoryConfig['testPlacement']>('before');
  const [aiOrder, setAiOrder] = useState(true);
  const [form, setForm] = useState<FormState>({ phase: 'idle' });

  const busy = form.phase === 'busy';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!range.trim()) return;
    setForm({ phase: 'busy' });
    try {
      await createStory({ range: range.trim(), config: { direction, testPlacement }, aiOrder });
      onStarted();
    } catch (err) {
      setForm({ phase: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <form className="new-review-form" onSubmit={(e) => void onSubmit(e)}>
      <h2>New review</h2>
      <div className="new-review-fields">
        <input
          type="text"
          placeholder="main..HEAD"
          value={range}
          disabled={busy}
          onChange={(e) => setRange(e.currentTarget.value)}
          aria-label="Range to review"
        />
        <label>
          Reading order
          <select value={direction} disabled={busy} onChange={(e) => setDirection(e.currentTarget.value as StoryConfig['direction'])}>
            {DIRECTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tests
          <select
            value={testPlacement}
            disabled={busy}
            onChange={(e) => setTestPlacement(e.currentTarget.value as StoryConfig['testPlacement'])}
          >
            {TEST_PLACEMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="ai-order-check">
          <input type="checkbox" checked={aiOrder} disabled={busy} onChange={(e) => setAiOrder(e.currentTarget.checked)} />
          AI ordering
        </label>
        <button className="bar-button" type="submit" disabled={busy || !range.trim()}>
          {busy ? 'Compiling…' : 'Start'}
        </button>
      </div>
      {form.phase === 'error' && <p className="form-error">{form.message}</p>}
    </form>
  );
}

function StoryCard({ story, active }: { story: StorySummary; active: boolean }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stats = statsLabel(story.stats);

  async function onOpen() {
    // Already the active range — just go to the reader, no need to re-switch the daemon.
    if (active) {
      goToReader();
      return;
    }
    setOpening(true);
    setError(null);
    try {
      await openStory(story.id);
      goToReader();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setOpening(false);
    }
  }

  return (
    <article className={`story-card${active ? ' active' : ''}`}>
      <div className="story-card-head">
        <h3>{story.title}</h3>
        <span className="version-badge">{versionBadge(story.toolVersion)}</span>
      </div>
      <p className="story-card-range">{story.range.label}</p>
      <p className="story-card-meta">
        {formatCreatedAt(story.createdAt)}
        {stats && ` · ${stats}`}
      </p>
      <div className="config-chips">
        {explainConfig(story.config, story.mode).map((option) => (
          <span
            key={option.key}
            className={`config-chip ${option.cost === 'regenerates' ? 'cost-regenerates' : 'cost-free'}`}
            title={chipTooltip(option)}
          >
            {option.value} {costGlyph(option.cost)}
          </span>
        ))}
      </div>
      <div className="story-card-actions">
        <button className="bar-button" onClick={() => void onOpen()} disabled={opening}>
          {active ? 'Reading now →' : opening ? 'Opening…' : 'Open'}
        </button>
        {error && <span className="form-error">{error}</span>}
      </div>
    </article>
  );
}

/** R-061: the launcher — start a new review or reopen a past one, without touching a CLI. */
export function LibraryPage() {
  const [state, setState] = useState<ListState>({ phase: 'loading' });
  const [version, setVersion] = useState<string | null>(null);

  function load() {
    Promise.all([fetchStories(), fetchChangelog()])
      .then(([stories, changelog]) => {
        setState({ phase: 'ready', stories: stories.stories, activeRange: stories.activeRange });
        setVersion(changelog.version);
      })
      .catch((e: unknown) => setState({ phase: 'error', message: e instanceof Error ? e.message : String(e) }));
  }

  useEffect(load, []);

  return (
    <div className="app">
      <header className="top-bar">
        <h1>code-story</h1>
        <span className="spacer" />
        <a className="bar-button" href="#/changelog">
          {version ? versionBadge(version) : 'Changelog'}
        </a>
        <a className="bar-button" href="#/">
          Open reader
        </a>
      </header>
      <main className="library">
        <NewReviewForm onStarted={goToReader} />
        {state.phase === 'loading' && <p className="notice">Loading your stories…</p>}
        {state.phase === 'error' && <p className="notice">Could not load the library: {state.message}</p>}
        {state.phase === 'ready' && state.stories.length === 0 && (
          <p className="notice">No stories yet — start a review above to generate your first one.</p>
        )}
        {state.phase === 'ready' && state.stories.length > 0 && (
          <div className="story-list">
            {state.stories.map((story) => (
              <StoryCard key={story.id} story={story} active={isActiveStory(story, state.activeRange)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
