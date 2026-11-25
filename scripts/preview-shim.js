// DEV ONLY (not shipped): a tiny chrome.* stand-in so the built side panel can be opened as a
// normal localhost page for screenshots and on-device timing runs. Query params:
//   ?gmail=<sample id>  pretend that sample is open in Gmail     ?onboarded=0  show onboarding
//   ?theme=dark|light    ?size=0..4 text size    ?demo=1 demo mode (sample chips)
(() => {
  const q = new URLSearchParams(location.search);
  const mem = { local: {}, session: {} };
  try { Object.assign(mem.local, JSON.parse(localStorage.getItem('shim.local') || '{}')); } catch {}
  mem.local.settings = {
    ...(mem.local.settings || {}),
    onboarded: q.get('onboarded') !== '0',
    ...(q.get('theme') ? { theme: q.get('theme') } : {}),
    ...(q.get('size') ? { textSize: +q.get('size') } : {}),
    ...(q.get('demo') ? { demoMode: q.get('demo') === '1' } : {}),
  };
  const area = (name) => ({
    async get(keys) {
      const src = mem[name];
      if (keys == null) return { ...src };
      const list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
      return Object.fromEntries(list.filter((k) => k in src).map((k) => [k, src[k]]));
    },
    async set(obj) { Object.assign(mem[name], obj); if (name === 'local') localStorage.setItem('shim.local', JSON.stringify(mem.local)); },
    async remove(keys) { for (const k of [].concat(keys)) delete mem[name][k]; },
  });
  // ?seed=1: replay real Gemini Nano outputs recorded earlier for the Gmail samples (README screenshots).
  if (q.get('seed')) {
    const key = (e) => {
      const str = `${e.fromEmail || ''}|${e.subject || ''}|${(e.body || '').slice(0, 4000)}`;
      let h = 0x811c9dc5;
      for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
      return (h >>> 0).toString(36);
    };
    const RECORDED = {
      'delivery-fee': { verdict: 'scam', confidence: 95, why: 'This email asks for money and uses a suspicious website.', flags: [
        { type: 'impersonation', text: 'ParcelPost Delivery impersonates a real company' },
        { type: 'lookalike_domain', text: 'Website address is not the official ParcelPost site' },
        { type: 'payment_request', text: 'Requests payment via suspicious link' }] },
      receipt: { verdict: 'safe', confidence: 95, why: 'This email seems legitimate from a known company.', flags: [] },
    };
    window.__seed = async () => {
      const { SAMPLES, toEmail } = await import(window.__samplesUrl);
      const s = SAMPLES.find((x) => x.id === gmailId);
      if (s && RECORDED[s.id]) mem.session['r:' + key({ ...toEmail(s), source: 'gmail' })] = { result: RECORDED[s.id], source: 'on_device', redactedCount: 0, recon: [], timings: { verdict: 770, total: 2700 }, at: Date.now() };
    };
  }
  const listeners = [];
  const gmailId = q.get('gmail');
  window.__shim = { listeners, mem };
  if (q.get('view')) addEventListener('load', () => setTimeout(() => document.querySelector(`[data-view="${q.get('view')}"]`)?.click(), 300));
  if (q.get('measure')) addEventListener('load', () => setTimeout(() => {
    const wide = [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > innerWidth + 1 && el.offsetParent !== null).slice(0, 8).map((el) => `${el.tagName}.${el.className}#${el.id}:${Math.round(el.getBoundingClientRect().right)}`);
    document.title = `vw=${innerWidth} sw=${document.documentElement.scrollWidth} ${wide.join(' | ')}`;
  }, 800));
  if (q.get('still') || q.get('seed')) {
    const st = document.createElement('style');
    st.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
    document.documentElement.append(st);
  }
  if (q.get('w')) {
    const st = document.createElement('style');
    st.textContent = `html{max-width:${+q.get('w')}px;margin:0 auto;box-shadow:0 0 0 1px #8885;min-height:100vh}`;
    document.documentElement.append(st);
  }
  window.chrome = {
    runtime: {
      id: 'preview',
      getManifest: () => ({ version: '1.0.0' }),
      onMessage: { addListener: (fn) => listeners.push(fn) },
      sendMessage: async () => undefined,
    },
    storage: { local: area('local'), session: area('session') },
    tabs: {
      query: async () => { await window.__seed?.(); return [{ id: 1, url: gmailId ? 'https://mail.google.com/mail/u/0/' : 'https://example.com/' }]; },
      sendMessage: async (_id, msg) => {
        if (msg.type !== 'SCAMO_GET_EMAIL') return undefined;
        const { SAMPLES, toEmail } = await import(window.__samplesUrl);
        const s = SAMPLES.find((x) => x.id === gmailId);
        return s ? { email: { ...toEmail(s), source: 'gmail' }, key: null } : { email: null };
      },
      onActivated: { addListener() {} },
      onUpdated: { addListener() {} },
    },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {}, setBadgeTextColor: async () => {}, setTitle: async () => {} },
  };
})();
