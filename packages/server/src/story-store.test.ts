import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { StorySnapshot } from '@code-story/core';
import { afterAll, describe, expect, test } from 'vitest';
import { listStories, loadStory, saveStory, storiesDir } from './story-store.js';
import { syncStories } from './story-sync.js';

const repo = await mkdtemp(path.join(tmpdir(), 'cs-story-repo-'));
afterAll(() => rm(repo, { recursive: true, force: true }));

const git = (...a: string[]) => execFileSync('git', a, { cwd: repo }).toString().trim();
git('init', '-q');
git('config', 'user.email', 'test@example.com');
git('config', 'user.name', 'test');

function snap(id: string): StorySnapshot {
  return {
    id,
    createdAt: '2026-07-21T00:00:00.000Z',
    title: id,
    range: { base: 'a', head: 'b', baseSha: 'aa', headSha: 'bb', label: 'a..b' },
    config: { direction: 'consumer-first', testPlacement: 'before' },
    mode: 'chapter',
    aiOrder: true,
    toolVersion: '1.0.0',
    coreVersion: '0.0.6',
    models: { order: 'opus' },
    orderOverlay: { version: 1 } as never,
    narration: {},
  };
}

describe('story-store', () => {
  test('save/load round-trips and list omits overlays, newest first', async () => {
    await saveStory(repo, snap('20260721T000000000-alpha'));
    await saveStory(repo, snap('20260721T000000001-beta'));

    const loaded = await loadStory(repo, '20260721T000000000-alpha');
    expect(loaded?.orderOverlay).toBeDefined();

    const list = await listStories(repo);
    expect(list.map((s) => s.id)).toEqual(['20260721T000000001-beta', '20260721T000000000-alpha']);
    expect('orderOverlay' in list[0]!).toBe(false);
  });

  test('loadStory returns null for a missing id', async () => {
    expect(await loadStory(repo, 'nope')).toBeNull();
  });

  test('listStories is empty when the dir does not exist', async () => {
    const empty = await mkdtemp(path.join(tmpdir(), 'cs-story-empty-'));
    expect(await listStories(empty)).toEqual([]);
    await rm(empty, { recursive: true, force: true });
  });
});

describe('story-sync', () => {
  test('disabled is a no-op', async () => {
    expect(await syncStories(repo, { enabled: false })).toEqual({ synced: false, reason: 'disabled' });
  });

  test('commits only the stories path (no push in test)', async () => {
    // Stories were written above; committing them should stage under .code-story/stories only.
    const result = await syncStories(repo, { enabled: true, push: false });
    expect(result.synced).toBe(true);
    const files = git('show', '--name-only', '--pretty=format:', 'HEAD').split('\n').filter(Boolean);
    expect(files.every((f) => f.startsWith('.code-story/stories/'))).toBe(true);
    // A second sync with no new stories is a clean no-op.
    expect(await syncStories(repo, { enabled: true, push: false })).toEqual({ synced: false, reason: 'no changes' });
  });

  test('non-git directory fails open', async () => {
    const notRepo = await mkdtemp(path.join(tmpdir(), 'cs-notrepo-'));
    const result = await syncStories(notRepo, { enabled: true, push: false });
    expect(result.synced).toBe(false);
    await rm(notRepo, { recursive: true, force: true });
  });
});

describe('storiesDir', () => {
  test('is inside the reviewed repo', () => {
    expect(storiesDir('/x/y')).toBe(path.join('/x/y', '.code-story', 'stories'));
  });
  test('files land under it and are readable back', async () => {
    const raw = await readFile(path.join(storiesDir(repo), '20260721T000000000-alpha.json'), 'utf8');
    expect(JSON.parse(raw).id).toBe('20260721T000000000-alpha');
  });
});
