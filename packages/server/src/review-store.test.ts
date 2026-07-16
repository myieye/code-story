import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { applyReviewPatch, emptyReview } from '@code-story/core';
import { afterAll, describe, expect, it } from 'vitest';
import { loadReview, repoIdFrom, reviewFilePath, saveReview } from './review-store.js';

const range = { base: 'a'.repeat(40), head: 'b'.repeat(40) };
const dir = await mkdtemp(path.join(tmpdir(), 'code-story-review-'));
afterAll(() => rm(dir, { recursive: true, force: true }));

describe('review store', () => {
  it('round-trips a review through save and load', async () => {
    const file = reviewFilePath(dir, repoIdFrom('D:/code/my repo', 'c'.repeat(40)), range);
    expect(file).toContain(path.join('my-repo-cccccccccccc', 'reviews'));
    expect(file).toContain(`${'a'.repeat(12)}..${'b'.repeat(12)}.json`);

    const review = emptyReview(range.base, range.head);
    applyReviewPatch(review, {
      set: [
        { chunkId: 'x', state: 'reviewed', markedUnseen: true },
        { chunkId: 'y', state: 'seen' },
      ],
      cursor: 'y',
    });
    await saveReview(file, review);

    const loaded = await loadReview(file, range);
    expect(loaded).toEqual(review);
    expect(loaded.chunks['x']).toEqual({ state: 'reviewed', markedUnseen: true });
  });

  it('starts fresh on missing, corrupt, or wrong-range files', async () => {
    const missing = await loadReview(path.join(dir, 'nope.json'), range);
    expect(missing).toEqual(emptyReview(range.base, range.head));

    const corrupt = path.join(dir, 'corrupt.json');
    await writeFile(corrupt, '{ not json');
    expect(await loadReview(corrupt, range)).toEqual(emptyReview(range.base, range.head));

    const stale = path.join(dir, 'stale.json');
    await saveReview(stale, emptyReview('other-base', range.head));
    expect((await loadReview(stale, range)).chunks).toEqual({});
  });

  it('applyReviewPatch keeps markedUnseen and drops malformed entries', async () => {
    const review = emptyReview(range.base, range.head);
    applyReviewPatch(review, { set: [{ chunkId: 'x', state: 'reviewed', markedUnseen: true }] });
    applyReviewPatch(review, { set: [{ chunkId: 'x', state: 'seen' }] });
    expect(review.chunks['x']).toEqual({ state: 'seen', markedUnseen: true });

    applyReviewPatch(review, { set: [{ chunkId: 'z', state: 'bogus' as never }] });
    expect(review.chunks['z']).toBeUndefined();
  });

  it('saves atomically (no temp file left behind)', async () => {
    const file = path.join(dir, 'atomic.json');
    await saveReview(file, emptyReview(range.base, range.head));
    await expect(readFile(`${file}.tmp`)).rejects.toThrow();
  });
});
