// Scamouflage content script for Gmail.
// Reads the open email, shows a small verdict badge next to its subject, and highlights
// evidence on request. No AI runs here and nothing is sent anywhere from this script: it only
// talks to the extension itself (chrome.runtime).

(() => {
  if (window.__scamouflage) return;
  window.__scamouflage = true;

  const MAX_LINKS = 40;
  const alive = () => !!chrome.runtime?.id; // false after the extension is reloaded/updated

  /* ---------------- Reading the open email (defensive: Gmail's DOM changes) ---------------- */

  const SEL = {
    subject: ['h2.hP', 'h2[data-thread-perm-id]', '[role="main"] h2[tabindex]'],
    message: ['div.adn.ads', 'div[data-message-id]', '[role="listitem"] [data-legacy-message-id]'],
    sender: ['span.gD', '[email][name]', 'span[email]'],
    body: ['div.a3s', '.ii.gt div[dir]', '.ii.gt'],
  };
  const first = (root, list) => {
    for (const s of list) {
      const el = root.querySelector(s);
      if (el) return el;
    }
    return null;
  };
  const visible = (el) => !!el && el.offsetParent !== null;

  function currentParts() {
    const subjectEl = SEL.subject.flatMap((s) => [...document.querySelectorAll(s)]).find(visible);
    let messages = [];
    for (const s of SEL.message) {
      messages = [...document.querySelectorAll(s)].filter(visible);
      if (messages.length) break;
    }
    // A thread can hold several messages; the last expanded one is what the user is reading.
    const msg = messages[messages.length - 1];
    if (!msg) return null;
    const bodyEl = first(msg, SEL.body);
    if (!bodyEl) return null;
    return { subjectEl, msg, bodyEl, senderEl: first(msg, SEL.sender) };
  }

  function extractEmail() {
    const p = currentParts();
    if (!p) return null;
    const links = [...p.bodyEl.querySelectorAll('a[href]')]
      .slice(0, MAX_LINKS)
      .map((a) => ({ text: (a.innerText || '').trim().slice(0, 160), href: a.href }))
      .filter((l) => /^https?:/i.test(l.href));
    return {
      source: 'gmail',
      subject: p.subjectEl?.innerText.trim() || '',
      fromName: p.senderEl?.getAttribute('name') || p.senderEl?.innerText.trim() || '',
      fromEmail: p.senderEl?.getAttribute('email') || '',
      body: (p.bodyEl.innerText || '').trim().slice(0, 20000),
      links,
      threadIds: threadIdsOf(p.subjectEl),
    };
  }

  /** Gmail thread IDs on an element (legacy hex id and/or "thread-f:<n>"), normalised. */
  function threadIdsOf(el) {
    if (!el) return [];
    const ids = [el.getAttribute('data-legacy-thread-id'), el.getAttribute('data-thread-perm-id'), el.getAttribute('data-thread-id')]
      .filter(Boolean)
      .map((id) => id.replace(/^#?thread-[a-z]:/i, ''));
    return [...new Set(ids)];
  }

  /* ---------------- Inbox rows ---------------- */

  const ROW_SEL = ['tr.zA', '[role="main"] tr[role="row"]'];
  function inboxRows() {
    let rows = [];
    for (const sel of ROW_SEL) {
      rows = [...document.querySelectorAll(sel)].filter(visible);
      if (rows.length) break;
    }
    return rows.slice(0, 50).map((tr) => {
      const subjEl = tr.querySelector('span.bog') || tr.querySelector('[data-thread-id] span, .y6 span');
      const idEl = tr.querySelector('[data-legacy-thread-id]') || tr.querySelector('[data-thread-id]');
      const senderEl = tr.querySelector('span.zF[email], span.yP[email]') || tr.querySelector('[email]');
      const snippet = (tr.querySelector('span.y2')?.innerText || '').replace(/^\s*[-–]\s*/, '').trim().slice(0, 300);
      const row = {
        subject: (subjEl?.innerText || '').trim().slice(0, 200),
        fromName: senderEl?.getAttribute('name') || senderEl?.innerText.trim() || '',
        fromEmail: senderEl?.getAttribute('email') || '',
        snippet,
        threadIds: threadIdsOf(idEl),
      };
      row.rowKey = emailKey({ fromEmail: row.fromEmail, subject: row.subject, body: snippet });
      return { el: tr, anchor: subjEl, row };
    }).filter((r) => r.anchor && (r.row.subject || r.row.snippet));
  }

  // Same as src/core/key.js (FNV-1a over sender|subject|body).
  function emailKey(e) {
    const s = `${e.fromEmail || ''}|${e.subject || ''}|${(e.body || '').slice(0, 4000)}`;
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
  }

  /* ---------------- Badge (Shadow DOM so Gmail's CSS can't touch it) ---------------- */

  const GLYPH = {
    scam: '<path d="m9.5 9.5 5 5m0-5-5 5"/>',
    suspicious: '<path d="M12 8v4m0 3.5v.01"/>',
    safe: '<path d="m9 12 2 2 4-4"/>',
    neutral: '',
  };
  const LOOK = {
    scam: { label: 'Scam', fg: '#a3211a', bg: '#fbeae7', bd: '#e8b4ae' },
    suspicious: { label: 'Be careful', fg: '#6b4500', bg: '#fff3d1', bd: '#e9cf86' },
    safe: { label: 'Looks safe', fg: '#1d5b1c', bg: '#e4f1df', bd: '#b5d6ad' },
    checking: { label: 'Checking…', fg: '#34421f', bg: '#eef0e6', bd: '#cfd5bd' },
    neutral: { label: 'Check', fg: '#34421f', bg: '#eef0e6', bd: '#cfd5bd' },
  };
  const BADGE_CSS = `
    :host { all: initial; display: inline-flex; vertical-align: middle; margin-left: 10px; }
    button { all: unset; box-sizing: border-box; display: inline-flex; align-items: center; gap: 5px;
      height: 26px; padding: 0 10px 0 6px; border-radius: 999px; cursor: pointer;
      font: 600 13px/1 'Google Sans', Roboto, system-ui, sans-serif; letter-spacing: .1px;
      color: var(--fg); background: var(--bg); border: 1px solid var(--bd);
      box-shadow: 0 1px 2px rgba(0,0,0,.08); transition: transform .15s, box-shadow .15s;
      animation: in .25s cubic-bezier(.2,.8,.2,1); }
    button:hover { box-shadow: 0 2px 6px rgba(0,0,0,.15); }
    button:focus-visible { outline: 3px solid #1f5fbf; outline-offset: 2px; }
    svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
    .camo { fill: #485a2c; stroke: #34421f; }
    .glyph { stroke: #fff; stroke-width: 2.6; }
    .scam .camo { fill: #a3211a; stroke: #7d1610; }
    .suspicious .camo { fill: #8a5a00; stroke: #5c3c00; }
    .safe .camo { fill: #2b6a29; stroke: #1d4d1c; }
    .spin { width: 12px; height: 12px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .8s linear infinite; margin: 0 2px; }
    .lock { width: 12px; height: 12px; opacity: .8; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes in { from { opacity: 0; transform: scale(.9); } }
    @media (prefers-reduced-motion: reduce) { button, .spin { animation: none; } }
  `;

  let host = null;
  let shadow = null;
  let current = { key: null, rank: 0, state: null };

  function ensureHost() {
    const p = currentParts();
    const anchor = p?.subjectEl;
    if (!anchor) return null;
    if (host && host.isConnected && host.previousElementSibling === anchor) return host;
    host?.remove();
    host = document.createElement('span');
    host.id = 'scamouflage-badge';
    shadow = host.attachShadow({ mode: 'closed' });
    anchor.insertAdjacentElement('afterend', host);
    // Keep the subject and badge on one line where Gmail allows it.
    if (getComputedStyle(anchor).display === 'block') anchor.style.display = 'inline';
    return host;
  }

  function renderBadge() {
    const st = current.state;
    if (!st || st.phase === 'clear') {
      host?.remove();
      host = null;
      return;
    }
    if (!ensureHost()) return;
    let look;
    let tone;
    let title;
    if (st.phase === 'done') {
      tone = st.verdict;
      look = LOOK[tone];
      title = `Scamouflage: ${look.label}. ${st.source === 'on_device' ? 'Checked privately on this computer.' : 'Checked with cloud help (personal details hidden).'} Click for details.`;
    } else if (st.phase === 'checking') {
      tone = 'neutral';
      look = LOOK.checking;
      title = 'Scamouflage is checking this email…';
    } else {
      // Recon only (instant heuristics, panel closed).
      // Heuristic only: never shown in "Scam" red, so a good email can't look like a scam.
      tone = st.verdict === 'safe' ? 'neutral' : 'suspicious';
      look = st.verdict === 'safe' ? LOOK.neutral : { ...LOOK.suspicious, label: `${st.warnings} warning sign${st.warnings === 1 ? '' : 's'}` };
      title = st.verdict === 'safe' ? 'Click to check this email with Scamouflage.' : 'Scamouflage quick check found warning signs. Click for a full check.';
    }
    const glyph = GLYPH[tone] ?? '';
    const lock = st.phase === 'done' && st.source === 'on_device'
      ? '<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'
      : '';
    shadow.innerHTML = `<style>${BADGE_CSS}</style>
      <button type="button" class="${tone}" style="--fg:${look.fg};--bg:${look.bg};--bd:${look.bd}" title="${title}" aria-label="${title}">
        ${st.phase === 'checking' ? '<span class="spin" aria-hidden="true"></span>' : `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="camo" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>${glyph.replace('<path', '<path class="glyph"')}</svg>`}
        <span>${look.label}</span>${lock}
      </button>`;
    shadow.querySelector('button').addEventListener('click', () => {
      if (alive()) chrome.runtime.sendMessage({ type: 'SCAMO_OPEN_PANEL' }).catch(() => {});
    });
  }

  /* ---------------- Evidence highlighting ---------------- */

  let hlStyle = null;
  function highlight(ev) {
    const p = currentParts();
    if (!p || !ev) return;
    let target = null;
    if (ev.kind === 'link') {
      target = [...p.bodyEl.querySelectorAll('a[href]')].find((a) => {
        try {
          let u = new URL(a.href);
          if (/(^|\.)google\.[a-z.]+$/.test(u.hostname) && u.pathname === '/url') u = new URL(u.searchParams.get('q') || a.href);
          return u.hostname.toLowerCase() === ev.host;
        } catch {
          return false;
        }
      });
    } else if (ev.kind === 'sender') {
      target = p.senderEl;
    } else if (ev.kind === 'text' && ev.match && 'highlights' in CSS) {
      const needle = ev.match.toLowerCase();
      const walker = document.createTreeWalker(p.bodyEl, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const i = n.data.toLowerCase().indexOf(needle);
        if (i < 0) continue;
        const range = new Range();
        range.setStart(n, i);
        range.setEnd(n, i + needle.length);
        if (!hlStyle) {
          hlStyle = document.createElement('style');
          hlStyle.textContent = '::highlight(scamouflage){background:#ffd54f;color:#000}';
          document.head.append(hlStyle);
        }
        CSS.highlights.set('scamouflage', new Highlight(range));
        n.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setTimeout(() => CSS.highlights.delete('scamouflage'), 6000);
        return;
      }
    }
    if (!target) return;
    const prev = target.getAttribute('style') || '';
    target.style.outline = '3px solid #d93025';
    target.style.outlineOffset = '2px';
    target.style.background = 'rgba(255, 213, 79, 0.45)';
    target.style.borderRadius = '3px';
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setTimeout(() => target.setAttribute('style', prev), 6000);
  }

  /* ---------------- Inbox row badges ---------------- */

  const ROW_CSS = `
    :host { all: initial; display: inline-flex; vertical-align: middle; margin-right: 6px; }
    span.pill { box-sizing: border-box; display: inline-flex; align-items: center; gap: 3px; height: 20px; padding: 0 7px 0 4px;
      border-radius: 999px; font: 600 12px/1 'Google Sans', Roboto, system-ui, sans-serif; color: var(--fg); background: var(--bg); border: 1px solid var(--bd); }
    span.icon-only { padding: 0 2px; background: transparent; border-color: transparent; }
    svg { width: 15px; height: 15px; fill: none; stroke-linecap: round; stroke-linejoin: round; }
    .camo { fill: var(--sh); stroke: var(--sh); stroke-width: 1.5; }
    .glyph { stroke: #fff; stroke-width: 2.8; }
  `;
  const ROW_LOOK = {
    scam: { label: 'Scam', fg: '#a3211a', bg: '#fbeae7', bd: '#e8b4ae', sh: '#a3211a' },
    suspicious: { label: 'Careful', fg: '#6b4500', bg: '#fff3d1', bd: '#e9cf86', sh: '#8a5a00' },
    safe: { label: '', fg: '#1d5b1c', bg: 'transparent', bd: 'transparent', sh: '#2b6a29' },
  };
  const rowStates = new Map(); // rowKey -> { rank, state }
  let rowsSent = '';
  let inboxEnabled = true;
  chrome.storage?.local.get('settings').then(({ settings }) => {
    inboxEnabled = settings?.inboxBadges !== false;
  }).catch(() => {});
  chrome.storage?.onChanged.addListener((changes) => {
    if (!changes.settings) return;
    inboxEnabled = changes.settings.newValue?.inboxBadges !== false;
    if (!inboxEnabled) document.querySelectorAll('.scamouflage-row').forEach((n) => n.remove());
    rowsSent = '';
  });

  function renderRow(entry, st) {
    let hostEl = entry.el.querySelector(':scope .scamouflage-row');
    // Only full checks of opened emails are ever shown on a row.
    if (!st || !st.full || !inboxEnabled) {
      hostEl?.remove();
      return;
    }
    const look = ROW_LOOK[st.verdict];
    if (!look) return;
    const sig = `${st.verdict}|${st.full ? 1 : 0}`;
    if (hostEl && hostEl.dataset.sig === sig && hostEl.nextElementSibling === entry.anchor) return;
    hostEl?.remove();
    hostEl = document.createElement('span');
    hostEl.className = 'scamouflage-row';
    hostEl.dataset.sig = sig;
    const root = hostEl.attachShadow({ mode: 'closed' });
    const word = { scam: 'Scam', suspicious: 'Be careful', safe: 'Looks safe' }[st.verdict];
    const how = 'Checked when you opened it.';
    const glyph = { scam: 'm9.5 9.5 5 5m0-5-5 5', suspicious: 'M12 8v4m0 3.5v.01', safe: 'm9 12 2 2 4-4' }[st.verdict];
    root.innerHTML = `<style>${ROW_CSS}</style><span class="pill${look.label ? '' : ' icon-only'}" role="img" aria-label="Scamouflage: ${word}. ${how}" title="Scamouflage: ${word}. ${how}"
      style="--fg:${look.fg};--bg:${look.bg};--bd:${look.bd};--sh:${look.sh}"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="camo" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path class="glyph" d="${glyph}"/></svg>${look.label}</span>`;
    entry.anchor.parentElement.insertBefore(hostEl, entry.anchor);
  }

  function syncInbox() {
    if (!inboxEnabled) return;
    const entries = inboxRows();
    for (const e of entries) renderRow(e, rowStates.get(e.row.rowKey)?.state);
    const sig = entries.map((e) => e.row.rowKey).join(',');
    if (sig && sig !== rowsSent) {
      rowsSent = sig;
      chrome.runtime.sendMessage({ type: 'SCAMO_INBOX', rows: entries.map((e) => e.row) }).catch(() => {});
    }
  }

  /* ---------------- Messaging ---------------- */

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'SCAMO_GET_EMAIL') {
      const email = extractEmail();
      sendResponse({ email, key: email ? emailKey(email) : null });
    } else if (message?.type === 'SCAMO_BADGE') {
      if (message.key && message.key !== lastKey) return;
      if (message.key === current.key && message.rank < current.rank) return;
      current = { key: message.key, rank: message.rank, state: message.state };
      renderBadge();
    } else if (message?.type === 'SCAMO_HIGHLIGHT') {
      highlight(message.evidence);
    } else if (message?.type === 'SCAMO_RESYNC') {
      rowsSent = '';
      if (!lastKey) syncInbox();
    } else if (message?.type === 'SCAMO_ROW_BADGES') {
      for (const it of message.items || []) {
        if (!it.state?.full) continue;
        // Latest full check wins (e.g. a second opinion that changed the verdict).
        rowStates.set(it.rowKey, { rank: it.rank, state: it.state });
      }
      for (const e of inboxRows()) renderRow(e, rowStates.get(e.row.rowKey)?.state);
    }
  });

  /* ---------------- Watch for the open email changing (Gmail is a single-page app) ---------------- */

  let lastKey = null;
  function check() {
    if (!alive()) {
      observer.disconnect();
      return;
    }
    const email = extractEmail();
    const key = email ? emailKey(email) : null;
    if (key !== lastKey) {
      lastKey = key;
      current = { key, rank: 0, state: null };
      host?.remove();
      host = null;
      chrome.runtime.sendMessage(email ? { type: 'SCAMO_EMAIL_OPENED', email, key } : { type: 'SCAMO_EMAIL_CLOSED' }).catch(() => {});
    } else if (current.state && !(host && host.isConnected)) {
      renderBadge(); // Gmail re-rendered the header; put the badge back.
    }
    if (!email) syncInbox();
    else rowsSent = ''; // re-announce the list when the user goes back to it
  }

  // Debounced: wait for Gmail to settle, but never more than ~1s after the first change.
  let timer = null;
  let firstChange = 0;
  const observer = new MutationObserver(() => {
    const now = Date.now();
    if (!timer) firstChange = now;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      check();
    }, now - firstChange > 900 ? 0 : 350);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  check();
})();
