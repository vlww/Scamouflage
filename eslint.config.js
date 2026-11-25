import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'dist-web/**', 'node_modules/**', '*.zip', '.firebase/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'public/**/*.js', 'scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.webextensions, LanguageModel: 'readonly', Highlight: 'readonly', __APP_VERSION__: 'readonly' },
    },
  },
  { files: ['public/content.js', 'scripts/preview-shim.js'], languageOptions: { sourceType: 'script' } },
  {
    files: ['test/**/*.js', 'eval/**/*.mjs', 'scripts/**/*.mjs', '*.config.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node } },
  },
  { files: ['eval/ondevice.js'], languageOptions: { sourceType: 'script', globals: { ...globals.browser, LanguageModel: 'readonly' } } },
  { files: ['eval/run.mjs'], languageOptions: { globals: { self: 'writable' } } },
  { rules: { 'no-empty': ['error', { allowEmptyCatch: true }], 'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }] } },
];
