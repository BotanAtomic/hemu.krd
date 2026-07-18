import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Served at the domain root (hemu.krd) via GitHub Pages custom domain.
export default defineConfig({
  base: '/',
  plugins: [react()],
});
