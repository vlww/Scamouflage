import { deviceAvailability, prepareDeviceModel, scanEmail, startDebrief, streamReply } from './ai.js';
import { runRecon } from './recon.js';
import { SAMPLE_SCAM } from './sample.js';

const $ = (id) => document.getElementById(id);
const VERDICTS = {
  safe: { icon: '✅', label: 'All clear', sub: 'No signs of a scam.' },
  suspicious: { icon: '⚠️', label: 'Proceed with caution', sub: 'Some warning signs. Double-check first.' },
  scam: { icon: '🚨', label: 'Enemy spotted', sub: 'This looks like a scam. Do not respond.' },
};

const state = { mode: 'gmail', email: null, verdict: null, chat: null };

/* ---------- On-device model status ---------- */

async function refreshDeviceStatus() {
  const status = await deviceAvailability();
  const label = {
    available: '🪖 On-device model ready: emails are scanned privately on this computer.',
    downloadable: '⬇️ On-device model not downloaded yet. Until then, scans use the cloud (redacted).',
    downloading: '⏳ On-device model downloading… scans use the cloud (redacted) meanwhile.',
    unavailable: '☁️ On-device AI isn’t available in this Chrome. Scans use the cloud (redacted).',
  }[status];
  $('deviceStatus').textContent = label;
  $('deployBtn').hidden = !(status === 'downloadable' || status === 'downloading');
  return status;
}

$('deployBtn').addEventListener('click', async () => {
  $('deployBtn').disabled = true;
  $('deployProgress').hidden = false;
  try {
    await prepareDeviceModel((p) => ($('deployProgress').value = Math.round(p * 100)));
  } catch (e) {
    showError(`Couldn't download the on-device model: ${e.message}`);
  }
  $('deployProgress').hidden = true;
  $('deployBtn').disabled = false;
  refreshDeviceStatus();
});

/* ---------- Getting the email ---------- */

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function fetchGmailEmail() {
  const tab = await activeTab();
  if (!tab?.url?.startsWith('https://mail.google.com/')) {
    throw new Error('Open Gmail in this window, or use the “Paste text” tab.');
  }
  let res;
  try {
    res = await chrome.tabs.sendMessage(tab.id, { type: 'SCAMO_GET_EMAIL' });
  } catch {
    throw new Error('Reload your Gmail tab once so Scamouflage can read it.');
  }
  if (!res?.email) throw new Error('Open an email in Gmail first (not the inbox list).');
  return res.email;
}

function parsePasted() {
  const from = $('pasteFrom').value.trim();
  const m = from.match(/^(.*?)\s*<([^>]+)>$/);
  const body = $('pasteBody').value.trim();
  if (!body) throw new Error('Paste the email text first.');
  const links = [...body.matchAll(/https?:\/\/[^\s<>"')]+/g)].map((x) => ({ text: x[0], href: x[0] }));
  return {
    source: 'paste',
    fromName: m ? m[1].replace(/"/g, '') : from.includes('@') ? '' : from,
    fromEmail: m ? m[2] : from.includes('@') ? from : '',
    subject: $('pasteSubject').value.trim(),
    body,
    links,
  };
}

async function previewGmail() {
  if (state.mode !== 'gmail') return;
  try {
    const email = await fetchGmailEmail();
    $('emailPreview').className = 'email-card';
    $('emailPreview').innerHTML = '';
    const b = document.createElement('b');
    b.textContent = email.subject || '(no subject)';
    const s = document.createElement('span');
    s.textContent = `From: ${email.fromName} ${email.fromEmail ? `<${email.fromEmail}>` : ''}`;
    $('emailPreview').append(b, s);
  } catch (e) {
    $('emailPreview').className = 'muted';
    $('emailPreview').textContent = e.message;
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'SCAMO_EMAIL_CHANGED') previewGmail();
});
chrome.tabs.onActivated.addListener(previewGmail);

/* ---------- Tabs ---------- */

function setMode(mode) {
  state.mode = mode;
  $('tabGmail').classList.toggle('active', mode === 'gmail');
  $('tabPaste').classList.toggle('active', mode === 'paste');
  $('tabGmail').setAttribute('aria-selected', mode === 'gmail');
  $('tabPaste').setAttribute('aria-selected', mode === 'paste');
  $('gmailPane').hidden = mode !== 'gmail';
  $('pastePane').hidden = mode !== 'paste';
  if (mode === 'gmail') previewGmail();
}
$('tabGmail').addEventListener('click', () => setMode('gmail'));
$('tabPaste').addEventListener('click', () => setMode('paste'));
$('sampleBtn').addEventListener('click', () => {
  $('pasteFrom').value = SAMPLE_SCAM.from;
  $('pasteSubject').value = SAMPLE_SCAM.subject;
  $('pasteBody').value = SAMPLE_SCAM.body;
});

/* ---------- Scan ---------- */

$('scanBtn').addEventListener('click', async () => {
  hideError();
  $('result').hidden = true;
  $('debrief').hidden = true;
  $('chatLog').innerHTML = '';
  state.chat = null;

  const btn = $('scanBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Scanning…';
  try {
    const email = state.mode === 'gmail' ? await fetchGmailEmail() : parsePasted();
    const recon = runRecon(email);
    const { result, source, redactedCount } = await scanEmail(email, recon);
    state.email = email;
    state.verdict = result;
    renderResult(result, recon, source, redactedCount);
  } catch (e) {
    console.error(e);
    showError(friendlyError(e));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Scan for scams';
  }
});

function renderResult(r, recon, source, redactedCount) {
  const v = VERDICTS[r.verdict] || VERDICTS.suspicious;
  $('verdictBanner').className = `verdict ${r.verdict}`;
  $('verdictIcon').textContent = v.icon;
  $('verdictLabel').textContent = v.label;
  $('verdictSub').textContent = `${v.sub} (${r.confidence}% sure)`;
  $('meterFill').style.width = `${r.confidence}%`;

  const badge = $('sourceBadge');
  if (source === 'on_device') {
    badge.textContent = '🪖 Scanned on your device: nothing left this computer';
    badge.className = 'badge';
  } else {
    badge.textContent = `☁️ Scanned in the cloud${redactedCount ? ` (${redactedCount} personal details redacted)` : ' (redacted)'}`;
    badge.className = 'badge cloud';
  }

  $('summary').textContent = r.summary;
  $('advice').textContent = r.advice;

  const list = $('flags');
  list.innerHTML = '';
  const items = [
    ...r.red_flags.map((f) => ({ ...f, cls: '' })),
    // Show recon findings the model didn't already mention.
    ...recon
      .filter((f) => !r.red_flags.some((m) => m.type === f.type))
      .map((f) => ({ ...f, cls: 'recon', type: `recon · ${f.type}` })),
  ];
  if (!items.length) {
    const li = document.createElement('li');
    li.className = 'recon';
    li.textContent = 'No red flags found.';
    list.append(li);
  }
  for (const f of items) {
    const li = document.createElement('li');
    li.className = f.cls;
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = f.type.replace(/_/g, ' ');
    li.append(tag, document.createTextNode(f.detail));
    list.append(li);
  }

  $('debriefBtn').textContent = r.verdict === 'safe' ? 'Ask a question (cloud)' : 'Request cloud debrief';
  $('result').hidden = false;
}

/* ---------- Cloud debrief ---------- */

function addMsg(role, text = '') {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = text;
  $('chatLog').append(div);
  div.scrollIntoView({ block: 'end', behavior: 'smooth' });
  return div;
}

async function send(message, shownText) {
  if (shownText) addMsg('user', shownText);
  const bubble = addMsg('bot', '…');
  try {
    await streamReply(state.chat, message, (t) => (bubble.textContent = t));
  } catch (e) {
    bubble.remove();
    showError(friendlyError(e));
  }
}

$('debriefBtn').addEventListener('click', async () => {
  if (!state.email) return;
  hideError();
  $('debrief').hidden = false;
  const { chat, opening } = startDebrief(state.email, state.verdict);
  state.chat = chat;
  $('chatLog').innerHTML = '';
  await send(opening);
});

$('chatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = $('chatInput').value.trim();
  if (!q || !state.chat) return;
  $('chatInput').value = '';
  await send(q, q);
});

/* ---------- Misc ---------- */

$('bigTextBtn').addEventListener('click', async () => {
  const on = document.body.classList.toggle('big-text');
  $('bigTextBtn').setAttribute('aria-pressed', on);
  await chrome.storage.local.set({ bigText: on });
});

function friendlyError(e) {
  const msg = String(e?.message || e);
  if (/app.?check|attestation|403/i.test(msg)) return 'Cloud check was blocked by App Check. Make sure the debug token is set up (see README).';
  if (/fetch|network|offline/i.test(msg)) return 'No internet connection for the cloud. On-device scanning still works once the model is downloaded.';
  return msg;
}
function showError(m) {
  $('error').textContent = m;
  $('error').hidden = false;
}
function hideError() {
  $('error').hidden = true;
}

(async function init() {
  const { bigText } = await chrome.storage.local.get('bigText');
  if (bigText) {
    document.body.classList.add('big-text');
    $('bigTextBtn').setAttribute('aria-pressed', 'true');
  }
  refreshDeviceStatus();
  previewGmail();
})();
