import type { ChunkReviewState } from '@code-story/core';
import { useMemo, useState } from 'react';
import type { BookResponse } from './api.js';
import { chunkTitle, type FlatBook } from './rows.js';

export function OutlineSidebar({
  data,
  flat,
  stateOf,
  sectionStats,
  currentSection,
  cursorChunkId,
  onJump,
}: {
  data: BookResponse;
  flat: FlatBook;
  stateOf: (chunkId: string) => ChunkReviewState;
  sectionStats: Map<string, { done: number; total: number }>;
  currentSection: string | undefined;
  cursorChunkId: string | undefined;
  onJump: (cursorIndex: number) => void;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const byId = useMemo(() => new Map(data.chunks.map((c) => [c.id, c])), [data]);

  return (
    <nav className="outline">
      {data.book.sections.map((section) => {
        const stats = sectionStats.get(section.id);
        const isOpen = expanded.has(section.id);
        return (
          <div key={section.id}>
            <div className={section.title === currentSection ? 'outline-item current' : 'outline-item'}>
              <button
                className="outline-disclosure"
                aria-label={isOpen ? 'Collapse section' : 'Expand section'}
                onClick={() =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (!next.delete(section.id)) next.add(section.id);
                    return next;
                  })
                }
              >
                {isOpen ? '▾' : '▸'}
              </button>
              <button
                className="outline-row"
                title={section.title}
                onClick={() => {
                  const first = section.occurrences[0] && flat.chunkIndexById.get(section.occurrences[0].chunkId);
                  if (first !== undefined) onJump(first);
                }}
              >
                <span className="outline-path">{shortPath(section.title)}</span>
                <span className="outline-count">
                  {stats ? `${stats.done}/${stats.total}` : section.occurrences.length}
                </span>
              </button>
            </div>
            {isOpen &&
              section.occurrences.map((occurrence) => {
                const chunk = byId.get(occurrence.chunkId);
                const index = flat.chunkIndexById.get(occurrence.chunkId);
                if (!chunk || index === undefined) return null;
                return (
                  <button
                    key={occurrence.chunkId}
                    className={occurrence.chunkId === cursorChunkId ? 'outline-chunk current' : 'outline-chunk'}
                    title={chunkTitle(chunk)}
                    onClick={() => onJump(index)}
                  >
                    <span className={`state-dot ${stateOf(chunk.id)}`} />
                    <span className="outline-path">{chunkTitle(chunk)}</span>
                  </button>
                );
              })}
          </div>
        );
      })}
    </nav>
  );
}

function shortPath(path: string): string {
  const parts = path.split('/');
  return parts.length <= 2 ? path : `…/${parts.slice(-2).join('/')}`;
}
