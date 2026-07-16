import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { CORE_VERSION } from '@code-story/core';
import { Hono } from 'hono';

const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));

export interface RunningServer {
  port: number;
  url: string;
  close: () => void;
}

export function startServer(requestedPort = 0): Promise<RunningServer> {
  const app = new Hono();

  app.get('/api/health', (c) => c.json({ ok: true, name: 'code-story', core: CORE_VERSION }));

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
