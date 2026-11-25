import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

// Web demo build (scamouflage.xyz): the landing page + the real side panel running in a page.
//   npm run build:web   →  dist-web/
// SECURITY: the App Check debug token must never ship on a public website, so it's blanked
// here (and scripts/check-web-build.mjs fails the build if it ever appears in dist-web/).
const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8'));

export default defineConfig({
  base: '/',
  define: {
    'import.meta.env.VITE_APPCHECK_DEBUG_TOKEN': JSON.stringify(''),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist-web',
    emptyOutDir: true,
    target: 'es2022',
    modulePreload: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        app: resolve(import.meta.dirname, 'sidepanel.html'),
        privacy: resolve(import.meta.dirname, 'privacy.html'),
      },
    },
  },
});
