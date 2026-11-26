// Renders docs/banners/stats.webp (animated) and docs/banners/architecture.png.
//   node scripts/banners/render-visuals.mjs   (needs img2webp from the `webp` package)
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const HERE = import.meta.dirname;
const OUT = resolve(HERE, '../../docs/banners');
const prof = mkdtempSync(join(tmpdir(), 'visuals-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [`--user-data-dir=${prof}`, '--remote-debugging-port=9336', '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let tabs;
for (let i = 0; i < 50; i++) { try { tabs = await (await fetch('http://127.0.0.1:9336/json')).json(); break; } catch { await sleep(200); } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
const shot = async (clip, scale = 1) => Buffer.from((await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale } })).result.data, 'base64');

// 1. Animated stats card → WebP
{
  await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 470, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `file://${join(HERE, 'stats.html')}` });
  await sleep(800);
  const loop = await ev('window.LOOP');
  const FPS = 15;
  const n = Math.round(loop * FPS);
  const tmp = join(tmpdir(), 'stats-frames');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp);
  const files = [];
  for (let f = 0; f < n; f++) {
    await ev(`frame(${f / FPS})`);
    const file = join(tmp, `f${String(f).padStart(4, '0')}.png`);
    writeFileSync(file, await shot({ x: 0, y: 0, width: 1200, height: 470 }));
    files.push(file);
  }
  const out = join(OUT, 'stats.webp');
  // Hold the finished state longer: frame 70 (t≈4.7 s) is shown for 2.5 s.
  const args = ['-loop', '0', '-lossy', '-q', '72', '-m', '4'];
  files.forEach((file, i) => args.push('-d', String(i === 70 ? 2500 : Math.round(1000 / FPS)), file));
  execFileSync('img2webp', [...args, '-o', out], { stdio: 'ignore' });
  rmSync(tmp, { recursive: true, force: true });
  console.log(`stats.webp  ${n} frames  ${Math.round(readFileSync(out).length / 1024)} KB`);
}

// 2. Architecture diagram → PNG (2× for sharpness)
{
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 2, mobile: false });
  await send('Page.navigate', { url: `file://${join(HERE, 'architecture.html')}` });
  for (let i = 0; i < 60 && (await ev('document.body.dataset.ready')) !== '1'; i++) await sleep(250);
  const h = await ev('Math.ceil(document.body.getBoundingClientRect().height)');
  const out = join(OUT, 'architecture.png');
  writeFileSync(out, await shot({ x: 0, y: 0, width: 1600, height: h }, 1));
  console.log(`architecture.png  1600×${h} @2x  ${Math.round(readFileSync(out).length / 1024)} KB`);
}
chrome.kill();
process.exit(0);
