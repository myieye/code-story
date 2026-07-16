import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // Dev loop: run the daemon with `--port <n>`, then `CODE_STORY_PORT=<n> pnpm dev`.
    proxy: {
      '/api': `http://127.0.0.1:${process.env['CODE_STORY_PORT'] ?? '7357'}`,
    },
  },
});
