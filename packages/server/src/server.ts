import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import {
  type Book,
  type Chunk,
  CORE_VERSION,
  compileBook,
  exportBookMarkdown,
  type FileContents,
  type FileDiff,
} from '@code-story/core';
import { Hono } from 'hono';
import { computeChunks } from './chunks.js';
import { diffRange, type ResolvedRange } from './git.js';

const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));

export interface ServerOptions {
  repo: string;
  range: ResolvedRange;
}

export interface RunningServer {
  port: number;
  url: string;
  close: () => void;
}

export function startServer(options: ServerOptions, requestedPort = 0): Promise<RunningServer> {
  const app = new Hono();
  let diffCache: Promise<FileDiff[]> | undefined;
  let bookCache: Promise<{ book: Book; chunks: Chunk[]; contents: Map<string, FileContents> }> | undefined;

  const getDiff = () => (diffCache ??= diffRange(options.repo, options.range));
  const getBook = () =>
    (bookCache ??= (async () => {
      const files = await getDiff();
      const { chunks, contents } = await computeChunks(options.repo, options.range, files);
      const compiled = compileBook({ files, chunks, headSha: options.range.head });
      return { ...compiled, contents };
    })());

  app.get('/api/health', (c) => c.json({ ok: true, name: 'code-story', core: CORE_VERSION }));

  app.get('/api/diff', async (c) => {
    return c.json({ ...options.range, files: await getDiff() });
  });

  app.get('/api/book', async (c) => {
    const { book, chunks } = await getBook();
    return c.json({ ...options.range, book, chunks });
  });

  app.get('/api/export.md', async (c) => {
    const { book, chunks, contents } = await getBook();
    const title = `${options.range.base.slice(0, 8)}..${options.range.head.slice(0, 8)}`;
    return c.text(exportBookMarkdown({ book, chunks, contents, title }));
  });

  if (existsSync(webDist)) {
    // serveStatic resolves root relative to cwd, which is the reviewed repo — not our install
    app.use('*', serveStatic({ root: path.relative(process.cwd(), webDist) }));
  } else {
    app.get('/', (c) => c.text('code-story: web app not built (run pnpm build)', 503));
  }

  return new Promise((resolve) => {
    const server = serve({ fetch: app.fetch, port: requestedPort, hostname: '127.0.0.1' }, (info) => {
      const url = `http://127.0.0.1:${info.port}`;
      resolve({ port: info.port, url, close: () => server.close() });
    });
  });
}
