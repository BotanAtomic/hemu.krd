import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Served at the domain root (hemu.krd) by Firebase Hosting.
export default defineConfig({
  base: '/',
  plugins: [react()],
});
