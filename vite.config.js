import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Builds the side panel and the background service worker (both bundle their code locally:
// MV3 forbids remote code). manifest.json and content.js live in /public and are copied as-is.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome139',
    modulePreload: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        sidepanel: resolve(import.meta.dirname, 'sidepanel.html'),
        background: resolve(import.meta.dirname, 'src/background.js'),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
  test: {
    include: ['test/**/*.test.js'],
  },
});
