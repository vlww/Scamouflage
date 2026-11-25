import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Builds the side panel (which bundles the Firebase SDK locally — MV3 forbids remote code).
// manifest.json, background.js and content.js live in /public and are copied as-is.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome139',
    rollupOptions: {
      input: { sidepanel: resolve(import.meta.dirname, 'sidepanel.html') },
    },
  },
});
