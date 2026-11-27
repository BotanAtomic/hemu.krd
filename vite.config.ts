import { defineConfig } from 'vite';

// Served at the domain root (hemu.krd) by Firebase Hosting. Two pages: the landing page and /app (app/index.html).
export default defineConfig({
  base: '/',
  build: {
    rollupOptions: {
      input: { main: 'index.html', app: 'app/index.html' },
    },
  },
});
