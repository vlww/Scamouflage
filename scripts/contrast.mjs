// Verifies every text/background pair the UI uses meets WCAG AA, in light AND dark themes.
// Reads the real tokens from src/styles.css. Exit code 1 on any failure.  Usage: npm run contrast
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const block = (re) => Object.fromEntries([...(css.match(re)?.[1] || '').matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const light = block(/:root \{([\s\S]*?)\n\}/);
const dark = { ...light, ...block(/:root\[data-theme='dark'\] \{([\s\S]*?)\n\}/) };

const resolve = (t, v) => {
  for (let i = 0; i < 5 && v?.startsWith('var('); i++) v = t[v.slice(6, -1)];
  return v;
};
const rgb = (hex) => {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) / 255);
};
const lum = (hex) => {
  const [r, g, b] = rgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

// [foreground, background, minimum ratio, where it's used]. Literal hex allowed.
const PAIRS = [
  ['text', 'bg', 4.5, 'body text'],
  ['text', 'surface', 4.5, 'cards'],
  ['text', 'surface-2', 4.5, 'segmented/evidence'],
  ['text-muted', 'bg', 4.5, 'muted text on page'],
  ['text-muted', 'surface', 4.5, 'muted text on cards'],
  ['text-muted', 'surface-2', 4.5, 'inactive tabs'],
  ['placeholder', 'surface', 4.5, 'input placeholders'],
  ['on-brand', 'brand', 4.5, 'primary buttons'],
  ['on-brand', 'brand-hover', 4.5, 'primary hover'],
  ['brand', 'bg', 4.5, 'link buttons'],
  ['brand', 'surface', 3, 'switch track / focus-ish UI'],
  ['scam-ink', 'scam-bg', 3, 'verdict word "Scam" (large)'],
  ['warn-ink', 'warn-bg', 3, 'verdict word "Be careful" (large)'],
  ['safe-ink', 'safe-bg', 3, 'verdict word "Looks safe" (large)'],
  ['text', 'scam-bg', 4.5, 'reason text on scam hero'],
  ['text', 'warn-bg', 4.5, 'reason text on suspicious hero'],
  ['text', 'safe-bg', 4.5, 'reason text on safe hero'],
  ['text-muted', 'scam-bg', 4.5, '“% sure” label'],
  ['text-muted', 'warn-bg', 4.5, '“% sure” label'],
  ['text-muted', 'safe-bg', 4.5, '“% sure” label'],
  ['scam-ink', 'scam-bg', 4.5, 'error notices'],
  ['warn-ink', 'warn-bg', 4.5, 'warning notices / evidence marks'],
  ['scam', 'scam-bg', 3, 'high-risk flag icons'],
  ['warn', 'warn-bg', 3, 'medium flag icons'],
  ['device-ink', 'device-bg', 4.5, '“On-device” chip'],
  ['cloud', 'cloud-bg', 4.5, '“Cloud” chip'],
  ['cloud', 'surface', 4.5, 'cloud chip on cards'],
  ['focus', 'bg', 3, 'focus ring'],
  ['focus', 'surface', 3, 'focus ring on cards'],
];
const FIXED = [
  // Masthead text sits on the camo + a dark scrim (worst case: lightest blob olive-600 under 45% scrim ≈ #2f3a1e).
  ['#f6f1dc', '#2f3a1e', 4.5, 'header wordmark (worst camo blob)'],
  ['#f6f1dc', '#3a3621', 4.5, 'header wordmark over khaki blob at lightest scrim'],
  ['#ffffff', 'scam', 3, 'hero icon glyph on scam (light)'],
  ['#ffffff', 'warn', 3, 'hero icon glyph on warn (light)'],
  ['#ffffff', 'safe', 3, 'hero icon glyph on safe (light)'],
  ['olive-900', 'khaki-200', 4.5, 'secondary (khaki) buttons, light'],
  ['olive-900', 'khaki-400', 4.5, 'secondary hover, light'],
  ['#f6f1dc', 'olive-900', 4.5, 'toast'],
  ['#ffffff', 'scam', 4.5, 'danger button'],
  // Gmail badge (content.js) on its own fixed colours
  ['#a3211a', '#fbeae7', 4.5, 'Gmail badge: Scam'],
  ['#6b4500', '#fff3d1', 4.5, 'Gmail badge: Be careful'],
  ['#1d5b1c', '#e4f1df', 4.5, 'Gmail badge: Looks safe'],
  ['#34421f', '#eef0e6', 4.5, 'Gmail badge: Checking'],
];
const DARK_FIXED = [['olive-950', 'scam', 3, 'hero glyph (dark)'], ['olive-950', 'warn', 3, 'hero glyph (dark)'], ['olive-950', 'safe', 3, 'hero glyph (dark)']];

let failed = 0;
for (const [name, t, extra] of [['light', light, FIXED], ['dark', dark, [...FIXED.filter((p) => !/light|danger/.test(p[3])), ...DARK_FIXED]]]) {
  console.log(`\n${name.toUpperCase()}`);
  for (const [fg, bg, min, where] of [...PAIRS, ...extra]) {
    const a = fg.startsWith('#') ? fg : resolve(t, t[fg]);
    const b = bg.startsWith('#') ? bg : resolve(t, t[bg]);
    const r = ratio(a, b);
    const ok = r >= min;
    if (!ok) failed++;
    console.log(`${ok ? '  ✓' : '  ✗'} ${r.toFixed(2).padStart(5)} ≥ ${min}  ${where}  (${fg} ${a} on ${bg} ${b})`);
  }
}
console.log(failed ? `\n${failed} pair(s) below WCAG AA` : '\nAll pairs meet WCAG AA.');
process.exit(failed ? 1 : 0);
