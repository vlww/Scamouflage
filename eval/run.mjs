// Eval: runs the invented sample set (src/samples.js) through the real scan prompt and prints accuracy.
//
//   npm run eval                    cloud model via Firebase AI Logic (redacted, like the product)
//   npm run eval -- --recon         recon-only baseline (no AI)
//   npm run eval -- --export f.json write the exact on-device prompts (for eval/ondevice.js in Chrome)
//   npm run eval -- --version v2-cautious   try another prompt version
//
// Needs VITE_APPCHECK_DEBUG_TOKEN in .env.local for the cloud run.
import fs from 'node:fs';
import { SAMPLES, toEmail } from '../src/samples.js';
import { runRecon, reconVerdict } from '../src/core/recon.js';
import { prepareEmail } from '../src/core/clean.js';
import { redactEmail } from '../src/core/redact.js';
import { scanPrompt, VERDICT_SCHEMA, normalizeResult, DEFAULT_PROMPT_VERSION } from '../src/core/prompt.js';
import { parseFinalJson } from '../src/core/partial-json.js';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const version = opt('--version') || DEFAULT_PROMPT_VERSION;
const modelName = opt('--model') || 'gemini-3.5-flash-lite';

function build(s, { redacted }) {
  const email = toEmail(s);
  const recon = runRecon(email);
  let prepared = prepareEmail(email);
  if (redacted) prepared = redactEmail(prepared).email;
  return { email, recon, prompt: scanPrompt(prepared, recon, version) };
}

if (opt('--export')) {
  const out = SAMPLES.map((s) => ({ id: s.id, label: s.label, prompt: build(s, { redacted: false }).prompt }));
  fs.writeFileSync(opt('--export'), JSON.stringify({ schema: VERDICT_SCHEMA, items: out }));
  console.log(`Wrote ${out.length} prompts to ${opt('--export')}`);
  process.exit(0);
}

let classify;
if (flag('--recon')) {
  classify = async (s) => ({ verdict: reconVerdict(build(s, { redacted: false }).recon).verdict, ms: 0 });
} else {
  const env = Object.fromEntries(
    (fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '').split('\n').filter((l) => l.includes('=')).map((l) => l.split('=').map((x) => x.trim()))
  );
  globalThis.self ??= globalThis;
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = env.VITE_APPCHECK_DEBUG_TOKEN;
  const { initializeApp } = await import('firebase/app');
  const { initializeAppCheck, CustomProvider } = await import('firebase/app-check');
  const { getAI, getGenerativeModel, GoogleAIBackend } = await import('firebase/ai');
  const { firebaseConfig } = await import('../src/firebase-config.js');
  const app = initializeApp(firebaseConfig);
  initializeAppCheck(app, { provider: new CustomProvider({ getToken: () => Promise.reject(new Error('debug only')) }) });
  const model = getGenerativeModel(getAI(app, { backend: new GoogleAIBackend() }), {
    model: modelName,
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: VERDICT_SCHEMA, temperature: 0.1, maxOutputTokens: 300 },
  });
  classify = async (s) => {
    const t0 = performance.now();
    const res = await model.generateContent(build(s, { redacted: true }).prompt);
    const r = normalizeResult(parseFinalJson(res.response.text()));
    return { ...r, ms: Math.round(performance.now() - t0) };
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = [];
const paceMs = flag('--recon') ? 0 : +(opt('--pace') || 4500); // free tier: 15 requests/min
for (const s of SAMPLES) {
  for (let attempt = 0; ; attempt++) {
    try {
      rows.push({ id: s.id, label: s.label, ...(await classify(s)) });
      break;
    } catch (e) {
      if (/429/.test(e.message) && attempt < 3) {
        await sleep(15000);
        continue;
      }
      rows.push({ id: s.id, label: s.label, verdict: 'ERROR', error: e.message.slice(0, 120), ms: 0 });
      break;
    }
  }
  await sleep(paceMs);
}
report(rows, flag('--recon') ? 'recon-only' : `cloud ${modelName} (${version})`);

export function report(rows, title) {
  const risky = (v) => v === 'scam' || v === 'suspicious';
  let exact = 0;
  let binary = 0;
  let missedScams = 0;
  let falseAlarms = 0;
  console.log(`\n${title}\n${'id'.padEnd(22)}${'truth'.padEnd(12)}${'got'.padEnd(12)}ms`);
  for (const r of rows) {
    const ok = r.verdict === r.label;
    const okBin = r.verdict !== 'ERROR' && risky(r.verdict) === risky(r.label);
    exact += ok;
    binary += okBin;
    if (r.label === 'scam' && !risky(r.verdict)) missedScams++;
    if (r.label === 'safe' && risky(r.verdict)) falseAlarms++;
    console.log(`${(okBin ? (ok ? '✓ ' : '~ ') : '✗ ') + r.id.padEnd(20)}${r.label.padEnd(12)}${String(r.verdict).padEnd(12)}${r.ms ?? ''}${r.error ? `  ${r.error}` : ''}`);
  }
  const n = rows.length;
  const avg = Math.round(rows.reduce((a, r) => a + (r.ms || 0), 0) / n);
  console.log(`\nExact: ${exact}/${n} (${Math.round((100 * exact) / n)}%) · Risky-vs-safe: ${binary}/${n} (${Math.round((100 * binary) / n)}%) · Missed scams: ${missedScams} · False alarms: ${falseAlarms} · Avg ${avg} ms`);
}
