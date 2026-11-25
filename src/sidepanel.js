import { hydrateIcons, icon, FLAG_ICONS } from './icons.js';
import { getSettings, saveSettings } from './settings.js';
import { initConfig, cfg } from './config.js';
import {
  scanEmail, scanImage, secondOpinion, deviceAvailability, prepareDeviceModel, warmUp, startDebrief, streamReply,
} from './ai.js';
import { reconVerdict } from './core/recon.js';
import { emailKey } from './core/key.js';
import { DEMO_SAMPLES, toEmail } from './samples.js';
import { showVerdict, getCached, setCached } from './badge.js';

const $ = (id) => document.getElementById(id);
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat().filter((k) => k != null && k !== false));
  return el;
};

/* =========================================================================
   Copy. Plain words first; the military voice stays in small labels.
   ========================================================================= */

const VERDICT_UI = {
  scam: { word: 'Scam', icon: 'ShieldX', action: 'Don’t click, reply, or pay. Delete it.' },
  suspicious: { word: 'Be careful', icon: 'ShieldAlert', action: 'Check another way: use the official app, website or phone number you already know. Not the links here.' },
  safe: { word: 'Looks safe', icon: 'ShieldCheck', action: 'No signs of a scam. As always, never share passwords or codes.' },
};

// Why each warning sign matters, in one line (shown when a sign has no other evidence).
const TIPS = {
  impersonation: 'Scammers pretend to be companies you trust.',
  link_mismatch: 'The link text says one place but takes you somewhere else.',
  lookalike_domain: 'The address is made to look like a real company’s.',
  suspicious_link: 'This link hides where it really goes.',
  risky_domain: 'Throwaway web addresses are common in scams.',
  urgency: 'Rushing you so you don’t stop to think.',
  payment_request: 'Real companies don’t ask for gift cards, crypto or wire transfers.',
  credential_request: 'Real companies never ask for your password or codes by email.',
  secrecy: 'Asking you to keep it secret is a classic scam move.',
  call_now: 'Scammers push you to call so they can talk you into paying.',
  too_good_to_be_true: 'Prizes you didn’t enter for are almost always scams.',
  attachment: 'This kind of attachment can install harmful software.',
  other: 'Something here doesn’t add up.',
};
const HIGH = new Set(['link_mismatch', 'lookalike_domain', 'credential_request', 'payment_request', 'impersonation']);

const QUICK_REPLIES = [
  'Is this real?',
  'I already clicked the link',
  'I already paid or sent money',
  'I shared my password or a code',
  'How do I report it?',
];

/* =========================================================================
   State
   ========================================================================= */

const state = {
  settings: null,
  view: 'check',
  mode: 'gmail', // 'gmail' | 'paste' | 'image'
  gmail: { tabId: null, email: null, key: null },
  current: null, // { email, key, tabId, recon, result, source, redactedCount, timings, note, image }
  scanId: 0,
  chat: null,
  image: null, // { base64, mimeType, url }
  sampleLinks: null,
  deviceStatus: 'unavailable',
};

/* =========================================================================
   Views & navigation
   ========================================================================= */

const VIEWS = { onboarding: 'viewOnboarding', check: 'viewCheck', family: 'viewFamily', settings: 'viewSettings' };

function showView(name) {
  state.view = name;
  for (const [k, id] of Object.entries(VIEWS)) $(id).hidden = k !== name;
  for (const btn of document.querySelectorAll('.topnav [data-view]')) {
    if (btn.dataset.view === name) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  }
  // During onboarding only the large-text button stays: that's when it's needed most.
  for (const btn of document.querySelectorAll('.topnav [data-view]')) btn.hidden = name === 'onboarding';
  if (name === 'settings') renderSettings();
  if (name === 'family') renderFamily();
}
for (const btn of document.querySelectorAll('.topnav [data-view]')) {
  btn.addEventListener('click', () => showView(btn.dataset.view));
}

/* ---------- Segmented tabs (with arrow-key support) ---------- */

const TABS = [
  ['gmail', 'tabGmail', 'paneGmail'],
  ['paste', 'tabPaste', 'panePaste'],
  ['image', 'tabImage', 'paneImage'],
];
function setMode(mode, { focus = false } = {}) {
  if (state.mode !== mode) clearResult();
  state.mode = mode;
  for (const [m, tab, pane] of TABS) {
    const on = m === mode;
    $(tab).setAttribute('aria-selected', on);
    $(tab).tabIndex = on ? 0 : -1;
    $(pane).hidden = !on;
    if (on && focus) $(tab).focus();
  }
  updateScanButton();
  if (mode === 'gmail') refreshGmail();
}
for (const [m, tab] of TABS) {
  $(tab).addEventListener('click', () => setMode(m));
  $(tab).addEventListener('keydown', (e) => {
    const i = TABS.findIndex(([x]) => x === m);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0];
      setMode(next, { focus: true });
    }
  });
}

/* =========================================================================
   Gmail
   ========================================================================= */

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function setEmailCard(email, fallback) {
  const card = $('emailCard');
  card.classList.toggle('empty', !email);
  $('emailSubject').textContent = email ? email.subject || '(no subject)' : fallback.title;
  $('emailFrom').textContent = email
    ? [email.fromName, email.fromEmail && `<${email.fromEmail}>`].filter(Boolean).join(' ') || 'Unknown sender'
    : fallback.sub;
}

/** Reads the open Gmail message (if any) and auto-checks it. */
async function refreshGmail({ email: pushed, key: pushedKey, tabId: pushedTab } = {}) {
  if (state.mode !== 'gmail') return;
  let tab;
  let email = pushed;
  let key = pushedKey;
  try {
    tab = pushedTab != null ? { id: pushedTab, url: 'https://mail.google.com/' } : await activeTab();
    if (!tab?.url?.startsWith('https://mail.google.com/')) {
      setGmail(null, null, null, { title: 'Open Gmail to check an email', sub: 'Or use Paste or Screenshot above.' });
      return;
    }
    if (!email) {
      const res = await chrome.tabs.sendMessage(tab.id, { type: 'SCAMO_GET_EMAIL' }).catch(() => undefined);
      if (res === undefined) {
        setGmail(null, null, tab.id, { title: 'Reload Gmail once', sub: 'Scamouflage was just installed or updated. Refresh the Gmail tab.' });
        return;
      }
      email = res?.email;
      key = res?.key;
    }
  } catch {
    return;
  }
  if (!email) {
    setGmail(null, null, tab.id, { title: 'Open an email in Gmail', sub: 'We’ll check it automatically.' });
    return;
  }
  key ||= emailKey(email);
  if (state.gmail.key === key && state.current?.key === key) return; // already showing it
  setGmail(email, key, tab.id);

  const cached = await getCached(key);
  if (cached) {
    state.current = { ...cached, email, key, tabId: tab.id, fromCache: true };
    renderFinal();
    showVerdict(tab.id, key, 3, { phase: 'done', verdict: cached.result.verdict, source: cached.source });
    return;
  }
  if (state.settings.autoScan && cfg('feature_auto_scan')) runScan({ auto: true });
}

function setGmail(email, key, tabId, fallback) {
  const changed = state.gmail.key !== key;
  state.gmail = { email, key, tabId };
  setEmailCard(email, fallback);
  if (changed) clearResult();
  updateScanButton();
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === 'SCAMO_EMAIL_OPENED' && sender.tab) {
    activeTab().then((tab) => {
      if (tab?.id === sender.tab.id) refreshGmail({ email: msg.email, key: msg.key, tabId: sender.tab.id });
    });
  }
  if (msg?.type === 'SCAMO_EMAIL_CLOSED' && sender.tab && sender.tab.id === state.gmail.tabId) {
    setGmail(null, null, sender.tab.id, { title: 'Open an email in Gmail', sub: 'We’ll check it automatically.' });
  }
});
chrome.tabs.onActivated.addListener(() => refreshGmail());
chrome.tabs.onUpdated.addListener((_id, info, tab) => {
  if (tab.active && info.status === 'complete') refreshGmail();
});

/* =========================================================================
   Paste & samples
   ========================================================================= */

for (const s of DEMO_SAMPLES) {
  $('sampleChips').append(
    h('button', {
      class: 'chip',
      type: 'button',
      text: s.title,
      onclick: () => {
        $('pasteFrom').value = s.from;
        $('pasteSubject').value = s.subject;
        $('pasteBody').value = s.body;
        $('pasteFrom').closest('details').open = false;
        state.sampleLinks = s.links ? { body: s.body, links: s.links } : null;
        clearResult();
        updateScanButton();
        $('scanBtn').focus();
      },
    })
  );
}
for (const id of ['pasteBody', 'pasteFrom', 'pasteSubject']) $(id).addEventListener('input', () => {
  if (state.current && state.mode === 'paste') clearResult();
  updateScanButton();
});

function pastedEmail() {
  const body = $('pasteBody').value.trim();
  if (!body) return null;
  const email = toEmail({
    from: $('pasteFrom').value,
    subject: $('pasteSubject').value,
    body,
    links: state.sampleLinks?.body.trim() === body ? state.sampleLinks.links : undefined,
  });
  return email;
}

/* =========================================================================
   Screenshot
   ========================================================================= */

const dz = $('dropZone');
dz.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    $('imageInput').click();
  }
});
dz.addEventListener('dragover', (e) => {
  e.preventDefault();
  dz.classList.add('over');
});
dz.addEventListener('dragleave', () => dz.classList.remove('over'));
dz.addEventListener('drop', (e) => {
  e.preventDefault();
  dz.classList.remove('over');
  const file = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith('image/'));
  if (file) loadImage(file);
});
$('imageInput').addEventListener('change', (e) => e.target.files[0] && loadImage(e.target.files[0]));
document.addEventListener('paste', (e) => {
  const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
  if (!file) return;
  e.preventDefault();
  if (state.view !== 'check') showView('check');
  setMode('image');
  loadImage(file);
});
$('imageClear').addEventListener('click', () => {
  state.image = null;
  $('imagePreview').hidden = true;
  dz.hidden = false;
  clearResult();
  updateScanButton();
});

/** Normalises any image to PNG/JPEG ≤1280px (the on-device model accepts JPEG/PNG only). */
async function loadImage(file) {
  if (!cfg('feature_image_check')) return notice('Screenshot checks are turned off right now.', 'info');
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const mimeType = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
    const blob = await canvas.convertToBlob({ type: mimeType, quality: 0.9 });
    const base64 = await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1]);
      r.readAsDataURL(blob);
    });
    state.image = { base64, mimeType, url: URL.createObjectURL(blob) };
    $('imagePreviewImg').src = state.image.url;
    $('imagePreview').hidden = false;
    dz.hidden = true;
    clearResult();
    updateScanButton();
    $('scanBtn').focus();
  } catch {
    notice('We couldn’t open that image. Try a PNG or JPEG screenshot.', 'error');
  }
}

/* =========================================================================
   Scanning
   ========================================================================= */

function updateScanButton() {
  const btn = $('scanBtn');
  const ready =
    (state.mode === 'gmail' && state.gmail.email) ||
    (state.mode === 'paste' && $('pasteBody').value.trim()) ||
    (state.mode === 'image' && state.image);
  const showing = state.current && !state.current.pending && state.current.result;
  const busy = !!state.current?.pending;
  btn.hidden = busy || !!showing || (state.mode === 'gmail' && !state.gmail.email);
  btn.disabled = !ready;
  $('trySample').hidden = !(state.mode === 'gmail' && !state.gmail.email);
  btn.querySelector('.label').textContent = showing ? 'Check again' : 'Check for scams';
}
$('trySample').addEventListener('click', () => {
  setMode('paste', { focus: true });
  $('sampleChips').firstElementChild?.click();
});
$('scanBtn').addEventListener('click', () => {
  warmUp(); // first user gesture: make sure Nano is resident for this and later scans
  runScan({ auto: false });
});

function clearResult() {
  state.scanId++;
  state.current = null;
  state.chat = null;
  $('result').hidden = true;
  $('loading').hidden = true;
  $('debrief').hidden = true;
  $('chatLog').replaceChildren();
  $('notice').hidden = true;
  closePopover();
}

function setStep(step) {
  const order = ['stepRecon', 'stepAnalyze', 'stepDone'];
  const idx = order.indexOf(step);
  order.forEach((id, i) => {
    $(id).className = i < idx ? 'done' : i === idx ? 'active' : '';
  });
}

async function runScan({ auto }) {
  const id = ++state.scanId;
  const live = () => id === state.scanId;
  const mode = state.mode;
  let email = null;
  if (mode === 'gmail') email = state.gmail.email;
  if (mode === 'paste') email = pastedEmail();
  if (mode !== 'image' && !email) return;

  const key = mode === 'gmail' ? state.gmail.key : email ? emailKey(email) : null;
  const tabId = mode === 'gmail' ? state.gmail.tabId : null;
  // Auto-checks never send anything to the cloud: on-device or recon only.
  const allowCloud = !auto && state.settings.cloudHelp;

  state.current = { email, key, tabId, pending: true, image: mode === 'image' };
  state.chat = null;
  $('notice').hidden = true;
  $('debrief').hidden = true;
  $('chatLog').replaceChildren();
  $('result').hidden = true;
  $('loading').hidden = false;
  $('prelim').hidden = true;
  setStep('stepRecon');
  updateScanButton();
  if (!auto) $('loading').scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  if (tabId != null) showVerdict(tabId, key, 2, { phase: 'checking' });

  const onPartial = (p, source) => {
    if (!live()) return;
    Object.assign(state.current, { partial: p, source: source || state.current.source });
    renderStreaming();
  };
  const onRoute = (r) => live() && Object.assign(state.current, { source: r.source, redactedCount: r.redactedCount, note: r.note });

  try {
    let out;
    if (mode === 'image') {
      setStep('stepAnalyze');
      out = await scanImage(state.image.base64, state.image.mimeType, { allowCloud: state.settings.cloudHelp, onPartial, onRoute });
    } else {
      out = await scanEmail(email, {
        allowCloud,
        onRoute,
        onPartial,
        onRecon: (recon) => {
          if (!live()) return;
          state.current.recon = recon;
          setStep('stepAnalyze');
          renderPrelim(recon);
          if (tabId != null) showVerdict(tabId, key, 2, { phase: 'checking' });
        },
      });
    }
    if (!live()) return;
    Object.assign(state.current, out, { pending: false });

    if (out.source === 'recon_only') {
      renderReconOnly(auto);
      return;
    }
    setStep('stepDone');
    renderFinal();
    const entry = { result: out.result, source: out.source, redactedCount: out.redactedCount, recon: out.recon, timings: out.timings, note: out.note };
    if (key) setCached(key, entry);
    if (tabId != null) showVerdict(tabId, key, 3, { phase: 'done', verdict: out.result.verdict, source: out.source });

    const unsure = out.result.verdict === 'suspicious' || out.result.confidence < cfg('escalation_threshold');
    if (unsure && out.source === 'on_device' && state.settings.autoSecondOpinion && state.settings.cloudHelp && mode !== 'image') {
      runSecondOpinion();
    }
  } catch (e) {
    if (!live()) return;
    console.error('[Scamouflage]', e);
    state.current.pending = false;
    $('loading').hidden = true;
    if (state.current.recon?.length) renderReconOnly(auto, e);
    else notice(friendlyError(e), 'error', retryAction(e));
    if (tabId != null && state.current.recon) {
      const rv = reconVerdict(state.current.recon);
      showVerdict(tabId, key, 1, { phase: 'recon', verdict: rv.verdict, warnings: state.current.recon.length });
    }
  } finally {
    if (live()) updateScanButton();
  }
}

function retryAction(e) {
  if (e?.code === 'needs_cloud' || /ONLY_ON_DEVICE|on-device model is not available/i.test(e?.message)) {
    return { label: 'Turn on cloud help', run: async () => { await setSetting('cloudHelp', true); runScan({ auto: false }); } };
  }
  return { label: 'Try again', run: () => runScan({ auto: false }) };
}

function renderPrelim(recon) {
  const p = $('prelim');
  p.replaceChildren();
  if (!recon.length) {
    p.append('Quick check: no obvious red flags. Confirming…');
  } else {
    p.append('Quick check: ', h('b', { text: `${recon.length} warning sign${recon.length > 1 ? 's' : ''}` }), ` — ${recon[0].detail}. Confirming…`);
  }
  p.hidden = false;
}

/** Shows the verdict as soon as it streams in, then fills in the rest. */
function renderStreaming() {
  const cur = state.current;
  const p = cur.partial;
  if (!p?.verdict) return;
  const first = $('result').hidden;
  $('loading').hidden = true;
  $('result').hidden = false;
  if (first) $('hero').scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  renderHero({ verdict: p.verdict, confidence: p.confidence, why: p.why || '' }, { streaming: true });
  $('flags').replaceChildren();
  $('actionBox').hidden = true;
  document.querySelector('.more-actions').hidden = true;
  $('detailsBox').hidden = true;
}

function renderFinal() {
  const cur = state.current;
  const r = cur.result;
  $('loading').hidden = true;
  $('result').hidden = false;
  renderHero(r, {});
  renderAction(r);
  renderFlags(r);
  renderDetails();
  document.querySelector('.more-actions').hidden = false;
  $('detailsBox').hidden = false;
  $('secondBtn').hidden = !(cur.source === 'on_device' && !cur.image && !cur.second && state.settings.cloudHelp && (r.verdict !== 'safe' || r.confidence < cfg('escalation_threshold')));
  $('familyBtn').hidden = r.verdict === 'safe' || !cfg('feature_family');
  $('debriefBtn').lastChild.textContent = r.verdict === 'safe' ? 'Ask a question' : 'What should I do?';
  updateScanButton();
}

function renderHero(r, { streaming, prelim }) {
  const ui = VERDICT_UI[r.verdict] || VERDICT_UI.suspicious;
  $('hero').className = `hero ${r.verdict}${prelim ? ' prelim-state' : ''}`;
  $('heroIcon').replaceChildren(icon(ui.icon));
  $('heroWord').textContent = prelim ? `${ui.word}?` : ui.word;
  $('heroWhy').textContent = r.why || (streaming ? '…' : '');
  const conf = Number.isFinite(r.confidence) ? r.confidence : null;
  $('sureWrap').hidden = conf == null || prelim;
  if (conf != null) {
    $('sureFill').style.width = `${conf}%`;
    $('sureText').textContent = `${conf}% sure`;
  }
  renderRouteChip(prelim ? 'recon_only' : state.current.source, state.current.redactedCount);
}

function renderRouteChip(source, redacted = 0) {
  const chip = $('routeChip');
  const cloud = source === 'in_cloud';
  chip.className = `route-chip${cloud ? ' cloud' : ''}`;
  chip.replaceChildren(
    icon(cloud ? 'Cloud' : source === 'recon_only' ? 'Radar' : 'Lock'),
    cloud ? `Cloud${redacted ? ` · ${redacted} hidden` : ''}` : source === 'recon_only' ? 'Quick check' : 'On-device',
    h('span', { class: 'info' }, icon('Info'))
  );
  chip.setAttribute('aria-label', `${chip.textContent}. Where this check ran`);
}

function renderAction(r) {
  const ui = VERDICT_UI[r.verdict];
  $('actionBox').hidden = false;
  $('actionText').textContent = ui.action;
  const btn = $('actionBtn');
  btn.hidden = false;
  if (r.verdict === 'scam') {
    // Ask about the thing this scam actually wanted the reader to do.
    const types = new Set([...r.flags.map((f) => f.type), ...(state.current.recon || []).map((f) => f.type)]);
    const [label, question] = types.has('payment_request')
      ? ['What if I already paid?', 'I already paid or sent money']
      : types.has('credential_request')
        ? ['What if I shared my password?', 'I shared my password or a code']
        : types.has('call_now')
          ? ['What if I already called them?', 'I already called the number']
          : ['What if I already clicked?', 'I already clicked the link'];
    btn.textContent = label;
    btn.onclick = () => openDebrief(question);
  } else if (r.verdict === 'suspicious') {
    const canSecond = state.current.source === 'on_device' && !state.current.second && state.settings.cloudHelp && !state.current.image;
    btn.textContent = canSecond ? 'Get a second opinion' : 'How do I check safely?';
    btn.onclick = canSecond ? runSecondOpinion : () => openDebrief('How can I check if this is real, safely?');
  } else {
    btn.hidden = true;
  }
}

/** Merges AI flags with recon findings (which carry evidence), most important first. */
function mergedFlags(r) {
  const recon = state.current.recon || [];
  const used = new Set();
  const out = r.flags.map((f) => {
    const match = recon.find((x, i) => !used.has(i) && x.type === f.type && used.add(i));
    return { type: f.type, text: f.text, evidence: match?.evidence, detail: match?.detail };
  });
  for (const [i, x] of recon.entries()) {
    if (out.length >= 4) break;
    if (used.has(i) || x.weight < 2 || out.some((o) => o.type === x.type)) continue;
    out.push({ type: x.type, text: x.detail, evidence: x.evidence, detail: x.detail });
  }
  return out;
}

function renderFlags(r) {
  const list = $('flags');
  list.replaceChildren();
  if (r.verdict === 'safe') return;
  const flags = mergedFlags(r);
  flags.forEach((f, i) => {
    const evId = `ev-${i}`;
    const btn = h(
      'button',
      { class: `flag ${HIGH.has(f.type) ? 'high' : 'med'}`, type: 'button', 'aria-expanded': 'false', 'aria-controls': evId },
      h('span', { class: 'flag-icon' }, icon(FLAG_ICONS[f.type] || 'TriangleAlert')),
      h('span', { class: 'flag-text', text: f.text }),
      h('span', { class: 'chev' }, icon('ChevronRight'))
    );
    const ev = h('div', { class: 'evidence', id: evId, hidden: true });
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', open);
      ev.hidden = !open;
      if (open) {
        fillEvidence(ev, f);
        highlightInGmail(f);
      }
    });
    list.append(h('li', {}, btn, ev));
  });
}

function fillEvidence(el, f) {
  el.replaceChildren();
  const email = state.current.email;
  const e = f.evidence;
  if (e?.kind === 'link') {
    const link = (email?.links || []).find((l) => {
      try {
        return new URL(l.href).hostname.toLowerCase() === e.host || l.href.includes(e.host);
      } catch {
        return false;
      }
    });
    if (link?.text && link.text !== link.href) el.append('Says: ', h('code', { text: link.text.slice(0, 80) }), h('br'));
    el.append('Really goes to: ', h('mark', {}, h('code', { text: e.host })));
  } else if (e?.kind === 'sender' && email?.fromEmail) {
    el.append('Sent from: ', h('mark', {}, h('code', { text: email.fromEmail })));
  } else if (e?.kind === 'text' && e.match && email?.body) {
    const text = `${email.subject}\n${email.body}`;
    const at = text.toLowerCase().indexOf(e.match.toLowerCase());
    if (at >= 0) {
      const start = Math.max(0, at - 50);
      const end = Math.min(text.length, at + e.match.length + 50);
      el.append(start > 0 ? '…' : '', text.slice(start, at), h('mark', { text: text.slice(at, at + e.match.length) }), text.slice(at + e.match.length, end), end < text.length ? '…' : '');
    } else el.append(TIPS[f.type] || TIPS.other);
  } else {
    el.append(TIPS[f.type] || TIPS.other);
    return;
  }
  el.append(h('br'), h('span', { class: 'muted', text: TIPS[f.type] || '' }));
}

function highlightInGmail(f) {
  const cur = state.current;
  if (cur.tabId == null || !f.evidence) return;
  chrome.tabs.sendMessage(cur.tabId, { type: 'SCAMO_HIGHLIGHT', evidence: f.evidence }).catch(() => {});
}

function renderDetails() {
  const cur = state.current;
  const body = $('detailsBody');
  body.replaceChildren();
  const t = cur.timings || {};
  const where = {
    on_device: 'This computer (Gemini Nano)',
    in_cloud: `Cloud (Gemini ${cfg('cloud_model')} via Firebase AI Logic)`,
  }[cur.source] || 'Quick check';
  const rows = [
    ['Checked', where],
    cur.source === 'in_cloud' && ['Hidden first', `${cur.redactedCount || 0} personal detail${cur.redactedCount === 1 ? '' : 's'}`],
    cur.note && ['Why cloud', NOTE_TEXT[cur.note] || cur.note],
    t.verdict != null && ['Verdict in', `${(t.verdict / 1000).toFixed(1)}s`],
    t.total != null && ['Total time', `${(t.total / 1000).toFixed(1)}s`],
    cur.fromCache && ['Result', 'Saved from earlier'],
  ].filter(Boolean);
  body.append(h('dl', { class: 'kv' }, rows.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })])));
  const recon = cur.recon || [];
  if (recon.length) {
    body.append(h('div', { class: 'muted', text: 'Quick checks that fired:' }));
    body.append(h('ul', {}, recon.map((f) => h('li', { text: f.detail }))));
  }
}
const NOTE_TEXT = {
  no_device: 'This Chrome doesn’t have the built-in AI model.',
  downloading: 'The built-in AI model is still downloading.',
  slow: 'The built-in AI model was too slow this time.',
  failed: 'The built-in AI model had a problem this time.',
};

/** Recon-only answer: on-device unavailable during an auto-check, or the AI failed. */
function renderReconOnly(auto, err) {
  const cur = state.current;
  const recon = cur.recon || [];
  const rv = reconVerdict(recon);
  $('loading').hidden = true;
  $('result').hidden = false;
  cur.result = null;
  renderHero({ verdict: rv.verdict === 'safe' ? 'suspicious' : rv.verdict, why: recon.length ? recon[0].detail : 'No obvious red flags in a quick check.' }, { prelim: true });
  if (rv.verdict === 'safe') {
    $('hero').className = 'hero prelim-state';
    $('heroIcon').replaceChildren(icon('ShieldQuestion'));
    $('heroWord').textContent = 'Not checked yet';
  }
  $('flags').replaceChildren();
  renderFlags({ verdict: 'scam', flags: [] });
  $('actionBox').hidden = false;
  $('actionText').textContent = err
    ? friendlyError(err)
    : state.settings.cloudHelp
      ? 'For a full check, use cloud help. Personal details are hidden first.'
      : 'Private mode is on and this computer’s AI model isn’t ready.';
  const btn = $('actionBtn');
  btn.hidden = false;
  if (state.settings.cloudHelp) {
    btn.textContent = 'Check with cloud help';
    btn.onclick = () => runScan({ auto: false });
  } else {
    btn.textContent = 'Set up private checking';
    btn.onclick = () => showView('settings');
  }
  document.querySelector('.more-actions').hidden = true;
  $('detailsBox').hidden = true;
  if (cur.tabId != null) showVerdict(cur.tabId, cur.key, 1, { phase: 'recon', verdict: rv.verdict, warnings: recon.length });
  updateScanButton();
}

async function runSecondOpinion() {
  const cur = state.current;
  if (!cur?.email || cur.second) return;
  const id = state.scanId;
  $('secondBtn').disabled = true;
  $('actionBtn').disabled = true;
  toast('Asking the cloud for a second opinion…');
  try {
    const out = await secondOpinion(cur.email, cur.recon || []);
    if (id !== state.scanId) return;
    const first = cur.result;
    Object.assign(cur, { result: out.result, source: out.source, redactedCount: out.redactedCount, second: first, note: null });
    renderFinal();
    toast(out.result.verdict === first.verdict ? 'Second opinion agrees.' : 'Second opinion updated the result.');
    if (cur.key) setCached(cur.key, { result: out.result, source: out.source, redactedCount: out.redactedCount, recon: cur.recon, timings: cur.timings });
    if (cur.tabId != null) showVerdict(cur.tabId, cur.key, 3, { phase: 'done', verdict: out.result.verdict, source: out.source });
  } catch (e) {
    notice(friendlyError(e), 'error');
  } finally {
    $('secondBtn').disabled = false;
    $('actionBtn').disabled = false;
  }
}
$('secondBtn').addEventListener('click', runSecondOpinion);

/* ---------- Route popover ---------- */

function openPopover() {
  const cur = state.current;
  const pop = $('routePop');
  const t = cur?.timings || {};
  const secs = t.total != null ? ` It took ${(t.total / 1000).toFixed(1)} seconds.` : '';
  let title;
  let lines;
  if (cur?.source === 'on_device') {
    title = 'Checked on this computer';
    lines = [`Chrome’s built-in AI (Gemini Nano) ran this check. The message never left your computer.${secs}`];
  } else if (cur?.source === 'in_cloud') {
    title = 'Checked with cloud help';
    lines = [
      cur.image
        ? 'A cloud model checked this screenshot because this computer’s AI wasn’t available.'
        : `We hid ${cur.redactedCount || 0} personal details first (names, emails, phone and account numbers). Then a cloud model checked the rest.${secs}`,
      NOTE_TEXT[cur.note] ? `Why cloud: ${NOTE_TEXT[cur.note]}` : '',
      'You can turn cloud help off in Settings.',
    ].filter(Boolean);
  } else {
    title = 'Quick check';
    lines = ['Simple built-in rules looked for common scam signs. No AI ran yet, and nothing left your computer.'];
  }
  pop.replaceChildren(h('h3', { text: title }), ...lines.map((l) => h('p', { text: l })));
  pop.hidden = false;
  $('routeChip').setAttribute('aria-expanded', 'true');
}
function closePopover() {
  $('routePop').hidden = true;
  $('routeChip').setAttribute('aria-expanded', 'false');
}
$('routeChip').addEventListener('click', (e) => {
  e.stopPropagation();
  if ($('routePop').hidden) openPopover();
  else closePopover();
});
document.addEventListener('click', (e) => {
  if (!$('routePop').hidden && !$('routePop').contains(e.target)) closePopover();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('routePop').hidden) {
    closePopover();
    $('routeChip').focus();
  }
});

/* =========================================================================
   Debrief (cloud chat)
   ========================================================================= */

function addMsg(role, text = '') {
  const div = h('div', { class: `msg ${role}`, text });
  $('chatLog').append(div);
  div.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  return div;
}

async function send(message, shown) {
  if (shown) addMsg('user', shown);
  const bubble = addMsg('bot typing', '');
  $('chatInput').disabled = true;
  try {
    await streamReply(state.chat, message, (t) => {
      bubble.textContent = t;
    });
  } catch (e) {
    bubble.remove();
    notice(friendlyError(e), 'error');
  } finally {
    bubble.classList.remove('typing');
    $('chatInput').disabled = false;
  }
}

async function openDebrief(question) {
  const cur = state.current;
  if (!cur?.result) return;
  if (!state.settings.cloudHelp) {
    return notice('Debrief uses cloud help, which is turned off. Turn it on in Settings to ask questions.', 'info', {
      label: 'Turn on cloud help',
      run: async () => {
        await setSetting('cloudHelp', true);
        openDebrief(question);
      },
    });
  }
  $('debrief').hidden = false;
  if (!state.chat) {
    const { chat, opening, ask } = startDebrief(cur.image ? { image: true } : cur.email, cur.result);
    state.chat = chat;
    $('chatLog').replaceChildren();
    renderQuickReplies();
    await send(question ? ask(question) : opening, question);
  } else if (question) {
    await send(question, question);
  }
  $('chatInput').focus();
}

function renderQuickReplies() {
  $('quickReplies').replaceChildren(
    ...QUICK_REPLIES.map((q) => h('button', { class: 'chip', type: 'button', text: q, onclick: () => openDebrief(q) }))
  );
}

$('debriefBtn').addEventListener('click', () => openDebrief());
$('chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('chatInput').value.trim();
  if (!q) return;
  $('chatInput').value = '';
  if (!state.chat) openDebrief(q);
  else send(q, q);
});

/* =========================================================================
   Family
   ========================================================================= */

let familyMod;
async function family() {
  familyMod ??= await import('./family.js');
  return familyMod;
}

$('familyBtn').addEventListener('click', async () => {
  const cur = state.current;
  if (!cur?.result) return;
  const f = await family();
  f.openShareSheet({ report: f.buildReport(cur, state.settings.contactName), settings: state.settings, toast, notice, goFamily: () => showView('family') });
});

async function renderFamily() {
  const body = $('familyBody');
  if (!cfg('feature_family')) {
    body.replaceChildren(h('p', { class: 'muted', text: 'Family sharing is turned off right now.' }));
    return;
  }
  const f = await family();
  f.renderFamilyView(body, { settings: state.settings, toast, notice });
}

/* =========================================================================
   Settings
   ========================================================================= */

const TOGGLES = [
  ['autoScan', 'Check emails as I open them', 'Private: automatic checks only run on this computer.'],
  ['cloudHelp', 'Cloud help', 'When this computer can’t check, or you ask questions. Personal details are hidden first.'],
  ['autoSecondOpinion', 'Automatic second opinion', 'If an on-device check is unsure, ask the cloud too.'],
  ['bigText', 'Large text', 'Bigger, easier-to-read text.'],
];

async function setSetting(key, value) {
  state.settings = await saveSettings({ [key]: value });
  applySettings();
  return state.settings;
}

function applySettings() {
  const s = state.settings;
  document.documentElement.classList.toggle('big-text', s.bigText);
  $('bigTextBtn').setAttribute('aria-pressed', s.bigText);
  if (s.theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = s.theme;
}

$('bigTextBtn').addEventListener('click', () => setSetting('bigText', !state.settings.bigText).then(() => state.view === 'settings' && renderSettings()));

function renderSettings() {
  const box = $('toggles');
  box.replaceChildren(
    ...TOGGLES.map(([key, title, sub]) => {
      const input = h('input', { type: 'checkbox', role: 'switch', id: `t-${key}`, 'aria-describedby': `t-${key}-sub` });
      input.checked = !!state.settings[key];
      input.addEventListener('change', () => setSetting(key, input.checked));
      return h(
        'label',
        { class: 'toggle-row', for: `t-${key}` },
        h('span', { class: 'toggle-text' }, h('span', { class: 'toggle-title', text: title }), h('span', { class: 'toggle-sub', id: `t-${key}-sub`, text: sub })),
        h('span', { class: 'switch' }, input, h('span', { class: 'track', 'aria-hidden': 'true' }))
      );
    }),
    themeRow()
  );
  $('setContact').value = state.settings.contactName;
  renderModelStatus();
  $('aboutLine').textContent = `Scamouflage ${chrome.runtime.getManifest().version} · Firebase AI Logic hybrid inference`;
}

function themeRow() {
  const opts = [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']];
  const group = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Theme', style: 'margin: 10px 0' });
  for (const [v, label] of opts) {
    const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(state.settings.theme === v), 'aria-selected': String(state.settings.theme === v), text: label });
    b.addEventListener('click', async () => {
      await setSetting('theme', v);
      renderSettings();
    });
    group.append(b);
  }
  return h('div', { class: 'toggle-row', style: 'display:block; cursor:default' }, h('span', { class: 'toggle-title', text: 'Theme' }), group);
}

$('setContact').addEventListener('change', (e) => setSetting('contactName', e.target.value.trim()));

const MODEL_TEXT = {
  available: ['Ready', 'Checks run privately on this computer.'],
  downloadable: ['Not set up yet', 'Until then, checks use cloud help with personal details hidden.'],
  downloading: ['Downloading…', 'Checks use cloud help until it’s ready.'],
  unavailable: ['Not available in this Chrome', 'Checks use cloud help with personal details hidden.'],
};

async function renderModelStatus() {
  state.deviceStatus = await deviceAvailability();
  const [title, sub] = MODEL_TEXT[state.deviceStatus];
  $('msTitle').textContent = `On-device AI: ${title}`;
  $('msSub').textContent = sub;
  $('msSetup').hidden = !['downloadable', 'downloading'].includes(state.deviceStatus);
}

async function setupModel(btn, wrap, bar, onDone) {
  btn.disabled = true;
  wrap.hidden = false;
  try {
    await prepareDeviceModel((p) => {
      const pct = Math.round(p * 100);
      bar.style.width = `${pct}%`;
      bar.setAttribute('aria-valuenow', pct);
    });
    // The SDK starts the download; poll until Chrome reports it's ready.
    for (let i = 0; i < 600 && (await deviceAvailability()) !== 'available'; i++) await new Promise((r) => setTimeout(r, 1000));
    toast('Private checking is ready.');
    warmUp();
  } catch (e) {
    notice(`Couldn’t set up the on-device model: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
    wrap.hidden = true;
    onDone?.();
  }
}
$('msSetup').addEventListener('click', () => setupModel($('msSetup'), $('msProgressWrap'), $('msProgress'), renderModelStatus));

/* =========================================================================
   Onboarding
   ========================================================================= */

let obStep = 0;
function renderOnboarding() {
  document.querySelectorAll('.ob-step').forEach((el) => (el.hidden = +el.dataset.step !== obStep));
  document.querySelectorAll('.dots span').forEach((d, i) => d.classList.toggle('on', i === obStep));
  $('obNext').textContent = obStep === 2 ? 'Start' : 'Next';
  if (obStep === 2) obModel();
  document.querySelector(`.ob-step[data-step="${obStep}"] .ob-title`)?.focus?.();
}
async function obModel() {
  const status = await deviceAvailability();
  $('obModelText').textContent = {
    available: 'All set. Your computer can check messages privately.',
    downloadable: 'Your computer can check privately after a one-time download.',
    downloading: 'Downloading… you can start now; we’ll use cloud help until it’s ready.',
    unavailable: 'This Chrome can’t run AI on-device, so checks will use cloud help with personal details hidden.',
  }[status];
  $('obSetupBtn').hidden = !['downloadable', 'downloading'].includes(status);
}
$('obSetupBtn').addEventListener('click', () => setupModel($('obSetupBtn'), $('obProgressWrap'), $('obProgress'), obModel));
$('obNext').addEventListener('click', async () => {
  if (obStep < 2) {
    obStep++;
    renderOnboarding();
    return;
  }
  await saveSettings({ onboarded: true, contactName: $('obContact').value.trim() || state.settings.contactName });
  state.settings = await getSettings();
  showView('check');
  refreshGmail();
});

/* =========================================================================
   Notices, toast, errors
   ========================================================================= */

function notice(text, kind = 'warn', action) {
  const n = $('notice');
  n.className = `notice ${kind === 'warn' ? '' : kind}`;
  const body = h('div', { class: 'notice-body' }, h('span', { text }));
  if (action) body.append(h('button', { class: 'btn small secondary', type: 'button', text: action.label, onclick: () => { n.hidden = true; action.run(); } }));
  n.replaceChildren(h('span', {}, icon(kind === 'error' ? 'TriangleAlert' : kind === 'offline' ? 'WifiOff' : 'Info')), body);
  n.hidden = false;
}

let toastTimer;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}

function friendlyError(e) {
  const msg = String(e?.message || e);
  if (e?.code === 'needs_cloud') return msg;
  if (/app.?check|attestation|appCheck|403/i.test(msg)) return 'Cloud help isn’t set up for this copy of Scamouflage. Private on-device checks still work.';
  if (!navigator.onLine || /failed to fetch|network|offline/i.test(msg)) return 'You’re offline. Cloud help will be back when you reconnect.';
  if (/quota|429|resource.?exhausted/i.test(msg)) return 'Cloud help is busy right now. Please try again in a minute.';
  if (/ONLY_ON_DEVICE|on-device model is not available/i.test(msg)) return 'This computer’s AI model isn’t ready, and cloud help is off.';
  if (/unreadable answer/i.test(msg)) return 'The check got a garbled answer. Please try again.';
  if (/longer than/i.test(msg)) return 'The check took too long. Please try again.';
  return 'Something went wrong with the check. Please try again.';
}

addEventListener('offline', () => notice('You’re offline. Private on-device checks still work.', 'offline'));
addEventListener('online', () => {
  if ($('notice').classList.contains('offline')) $('notice').hidden = true;
});

/* =========================================================================
   Boot
   ========================================================================= */

(async function init() {
  hydrateIcons();
  state.settings = await getSettings();
  applySettings();
  initConfig(); // background fetch; defaults apply immediately
  if (!state.settings.onboarded) {
    showView('onboarding');
    renderOnboarding();
  } else {
    showView('check');
  }
  setMode('gmail');
  // Load Nano into memory now (no gesture needed once downloaded) so the first check is fast.
  warmUp();
  if (!navigator.onLine) notice('You’re offline. Private on-device checks still work.', 'offline');
})();
