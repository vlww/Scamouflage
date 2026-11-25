// Renders docs/banners/devpost-*.svg into looping GIFs (Devpost can't show animated SVG).
// Steps the SVG's CSS animation frame by frame in headless Chrome, then encodes with ffmpeg.
//   node scripts/banners/render-gifs.mjs [name ...]
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const DIR = resolve(import.meta.dirname, '../../docs/banners');
const meta = JSON.parse(readFileSync(join(DIR, 'banners.json'), 'utf8'));
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(meta).filter((n) => n.startsWith('devpost-'));
const FPS = 10;
const SPEEDUP = 2.5; // the GIF scrolls faster so one loop is shorter (fewer frames)
const OUT_W = 900;

const prof = mkdtempSync(join(tmpdir(), 'banner-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [`--user-data-dir=${prof}`, '--remote-debugging-port=9335', '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let tabs;
for (let i = 0; i < 50; i++) { try { tabs = await (await fetch('http://127.0.0.1:9335/json')).json(); break; } catch { await sleep(200); } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = (expression) => send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });

for (const name of names) {
  const { height, loop } = meta[name];
  await send('Emulation.setDeviceMetricsOverride', { width: 1200, height, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `file://${join(DIR, name + '.svg')}` });
  await sleep(700);
  const frames = Math.round((loop / SPEEDUP) * FPS);
  const tmp = join(tmpdir(), `frames-${name}`);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp);
  for (let f = 0; f < frames; f++) {
    const t = (f / frames) * loop * 1000;
    await ev(`document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ${t}; })`);
    const { result } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1200, height, scale: 1 } });
    writeFileSync(join(tmp, `f${String(f).padStart(4, '0')}.png`), Buffer.from(result.data, 'base64'));
  }
  const out = join(DIR, name + '.gif');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(tmp, 'f%04d.png'),
    '-vf', `scale=${OUT_W}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=40:stats_mode=full[p];[b][p]paletteuse=dither=none`,
    '-loop', '0', out]);
  rmSync(tmp, { recursive: true, force: true });
  const kb = Math.round(readFileSync(out).length / 1024);
  console.log(`${name}.gif  ${frames} frames  ${kb} KB`);
}
chrome.kill();
process.exit(0);
