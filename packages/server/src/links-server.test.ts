import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { BookResponse } from '@code-story/core';
import { afterAll, describe, expect, test } from 'vitest';
import type { ResolvedRange } from './git.js';
import { buildLinks, filesChangedUrl } from './links.js';
import { startServer } from './server.js';

describe('filesChangedUrl', () => {
  test('derives the Files-changed tab from a GitHub PR url', () => {
    expect(filesChangedUrl('https://github.com/o/r/pull/42')).toBe('https://github.com/o/r/pull/42/files');
  });

  test('trims a trailing slash first', () => {
    expect(filesChangedUrl('https://github.com/o/r/pull/42/')).toBe('https://github.com/o/r/pull/42/files');
  });

  test('is unset for a non-PR url', () => {
    expect(filesChangedUrl('https://github.com/o/r')).toBeUndefined();
    expect(filesChangedUrl('https://example.com/pull/x')).toBeUndefined();
  });
});

describe('buildLinks', () => {
  test('assembles pr + derived filesChanged + app', () => {
    expect(buildLinks({ prUrl: 'https://github.com/o/r/pull/7', appUrl: 'http://localhost:3000', appLabel: 'Try it' })).toEqual({
      pr: 'https://github.com/o/r/pull/7',
      filesChanged: 'https://github.com/o/r/pull/7/files',
      app: { url: 'http://localhost:3000', label: 'Try it' },
    });
  });

  test('undefined when nothing supplied', () => {
    expect(buildLinks({})).toBeUndefined();
  });
});

const dataHome = await mkdtemp(path.join(tmpdir(), 'cs-links-home-'));
const repo = await mkdtemp(path.join(tmpdir(), 'cs-links-repo-'));
afterAll(() => Promise.all([rm(dataHome, { recursive: true, force: true }), rm(repo, { recursive: true, force: true })]));

const git = (...a: string[]) => execFileSync('git', a, { cwd: repo }).toString().trim();
await writeFile(path.join(repo, 'a.ts'), 'export const x = 0;\n');
git('init', '-q');
git('config', 'user.email', 'test@example.com');
git('config', 'user.name', 'test');
git('add', '.');
git('commit', '-q', '-m', 'base');
await writeFile(path.join(repo, 'a.ts'), 'export const x = 1;\n');
git('commit', '-qam', 'head');
const range: ResolvedRange = { base: git('rev-parse', 'HEAD~1'), head: git('rev-parse', 'HEAD') };

const getBook = async (url: string): Promise<BookResponse> => (await (await fetch(`${url}/api/book`)).json()) as BookResponse;

describe('/api/book links metadata', () => {
  test('carries links when configured', async () => {
    const links = { pr: 'https://github.com/o/r/pull/7', filesChanged: 'https://github.com/o/r/pull/7/files', app: { url: 'http://localhost:3000' } };
    const server = await startServer({ repo, range, dataHome, autoOrder: false, links }, 0);
    try {
      expect((await getBook(server.url)).links).toEqual(links);
    } finally {
      server.close();
    }
  });

  test('omits links when not configured', async () => {
    const server = await startServer({ repo, range, dataHome, autoOrder: false }, 0);
    try {
      expect((await getBook(server.url)).links).toBeUndefined();
    } finally {
      server.close();
    }
  });
});
