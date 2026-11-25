// On-device eval: run in Chrome (localhost page) with Gemini Nano available, after
// `node eval/run.mjs --export evalset.json` and serving that file next to the page:
//   await runOnDeviceEval('evalset.json')
// Mirrors the extension's on-device path: a text-only session per request, the same JSON
// responseConstraint, and the same 20 s timeout. Progress is visible in window.__evalRows.
window.runOnDeviceEval = async function (url = 'evalset.json', { timeoutMs = 20000 } = {}) {
  const { schema, items } = await (await fetch(url)).json();
  const io = [{ type: 'text', languages: ['en'] }];
  const rows = (window.__evalRows = []);
  for (const it of items) {
    const t0 = performance.now();
    const s = await LanguageModel.create({ expectedInputs: io, expectedOutputs: io });
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    let tVerdict = null;
    let text = '';
    let verdict = 'ERROR';
    try {
      for await (const c of s.promptStreaming(it.prompt, { responseConstraint: schema, signal: ac.signal })) {
        text += c;
        if (tVerdict === null && /"verdict"\s*:\s*"(scam|suspicious|safe)"/.test(text)) tVerdict = Math.round(performance.now() - t0);
      }
      verdict = JSON.parse(text).verdict;
    } catch {
      // Same rule as the extension: a streamed verdict survives a timeout.
      verdict = text.match(/"verdict"\s*:\s*"(scam|suspicious|safe)"/)?.[1] || 'ERROR';
    } finally {
      clearTimeout(timer);
      s.destroy();
    }
    rows.push({ id: it.id, label: it.label, verdict, msVerdict: tVerdict, ms: Math.round(performance.now() - t0), outChars: text.length, timedOut: ac.signal.aborted });
  }
  return rows;
};
