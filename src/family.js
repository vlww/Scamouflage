// "Tell my family": share a REDACTED summary of a flagged message with someone you trust.
//
// Model: a "family circle" doc whose ID is a random, unguessable code. The owner creates it;
// a family member joins by entering the code in their own Scamouflage (Firestore rules only let
// them add themselves). Members can read the circle's reports. Reports never contain the email
// body: only the verdict, the one-line reason, warning-sign labels, a redacted subject and the
// sender's domain.
//
// Lazy-loaded: Auth + Firestore are only downloaded when someone opens Family or shares.
// Uses firebase/auth/web-extension because MV3 extensions can't load remote code.

import { getAuth, signInAnonymously } from 'firebase/auth/web-extension';
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, addDoc, query, orderBy,
  limit, getDocs, serverTimestamp, deleteDoc,
} from 'firebase/firestore/lite';
import { app } from './firebase.js';
import { redact } from './core/redact.js';
import { icon } from './icons.js';

const auth = getAuth(app);
const db = getFirestore(app);
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'; // no 0/O, 1/I/L, U

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

async function user() {
  if (auth.currentUser) return auth.currentUser;
  await auth.authStateReady();
  return auth.currentUser || (await signInAnonymously(auth)).user;
}

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}
const pretty = (code) => `${code.slice(0, 5)}-${code.slice(5)}`;
const normalize = (input) => input.toUpperCase().replace(/[^A-Z0-9]/g, '');

async function getCircles() {
  const { familyCircles = [] } = await chrome.storage.local.get('familyCircles');
  return familyCircles; // [{ code, role: 'owner'|'member', name }]
}
async function saveCircles(list) {
  await chrome.storage.local.set({ familyCircles: list });
}

/* ---------------- Data ---------------- */

export function buildReport(cur, authorName) {
  const r = cur.result;
  const domain = (cur.email?.fromEmail || '').split('@')[1] || '';
  return {
    verdict: r.verdict,
    confidence: r.confidence,
    why: redact(r.why).text.slice(0, 200),
    flags: r.flags.slice(0, 3).map((f) => redact(f.text).text.slice(0, 120)),
    subject: cur.image ? 'A screenshot' : redact(cur.email?.subject || '(no subject)').text.slice(0, 140),
    fromDomain: domain.slice(0, 100),
    source: cur.image ? 'image' : cur.source === 'on_device' ? 'on_device' : 'in_cloud',
    authorName: (authorName || 'Your family member').slice(0, 40),
  };
}

export function reportText(report) {
  const word = { scam: 'a SCAM', suspicious: 'SUSPICIOUS', safe: 'safe' }[report.verdict];
  return [
    `Scamouflage flagged a message as ${word} (${report.confidence}% sure).`,
    `“${report.subject}”${report.fromDomain ? ` from ${report.fromDomain}` : ''}`,
    report.why,
    report.flags.length ? `Warning signs: ${report.flags.join('; ')}.` : '',
    'I haven’t clicked anything. Can you take a look with me?',
  ]
    .filter(Boolean)
    .join('\n');
}

async function createCircle(name) {
  const u = await user();
  const code = newCode();
  await setDoc(doc(db, 'circles', code), {
    ownerUid: u.uid,
    members: [u.uid],
    names: { [u.uid]: (name || 'Me').slice(0, 40) },
    createdAt: serverTimestamp(),
  });
  await saveCircles([...(await getCircles()), { code, role: 'owner' }]);
  return code;
}

async function joinCircle(rawCode, name) {
  const code = normalize(rawCode);
  if (code.length !== 10) throw new Error('Family codes have 10 letters and numbers.');
  const u = await user();
  await updateDoc(doc(db, 'circles', code), {
    members: arrayUnion(u.uid),
    [`names.${u.uid}`]: (name || 'Family member').slice(0, 40),
  });
  const list = (await getCircles()).filter((c) => c.code !== code);
  await saveCircles([...list, { code, role: 'member' }]);
  return code;
}

async function leaveCircle(code) {
  const u = await user();
  const list = await getCircles();
  const mine = list.find((c) => c.code === code);
  try {
    if (mine?.role === 'owner') await deleteDoc(doc(db, 'circles', code));
    else await updateDoc(doc(db, 'circles', code), { members: arrayRemove(u.uid) });
  } catch {
    /* already gone */
  }
  await saveCircles(list.filter((c) => c.code !== code));
}

async function shareToCircles(report) {
  const u = await user();
  const circles = await getCircles();
  if (!circles.length) throw new Error('no_circle');
  await Promise.all(
    circles.map((c) => addDoc(collection(db, 'circles', c.code, 'reports'), { ...report, authorUid: u.uid, createdAt: serverTimestamp() }))
  );
  return circles.length;
}

async function loadReports(code) {
  await user();
  const snap = await getDocs(query(collection(db, 'circles', code, 'reports'), orderBy('createdAt', 'desc'), limit(20)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function circleInfo(code) {
  await user();
  const snap = await getDoc(doc(db, 'circles', code));
  return snap.exists() ? snap.data() : null;
}

function friendly(e) {
  const msg = String(e?.code || e?.message || e);
  if (/permission-denied|not-found|NOT_FOUND/i.test(msg)) return 'That code didn’t work. Check it and try again.';
  if (/admin-restricted|operation-not-allowed|configuration-not-found/i.test(msg)) return 'Family sharing isn’t switched on for this copy of Scamouflage yet.';
  if (/network|unavailable|offline/i.test(msg)) return 'You’re offline. Try again when you’re connected.';
  return e?.message && !/firebase/i.test(e.message) ? e.message : 'Something went wrong. Please try again.';
}

/* ---------------- UI: share sheet ---------------- */

export async function openShareSheet({ report, settings, toast, notice, goFamily }) {
  const text = reportText(report);
  const box = document.getElementById('notice');
  const circles = await getCircles();
  const copyBtn = h('button', {
    class: 'btn small secondary',
    type: 'button',
    onclick: async () => {
      await navigator.clipboard.writeText(text);
      toast('Copied. Paste it into a text or email.');
    },
  }, icon('Copy'), 'Copy a message');
  const sendBtn = h('button', {
    class: 'btn small primary',
    type: 'button',
    onclick: async () => {
      sendBtn.disabled = true;
      try {
        const n = await shareToCircles(report);
        box.hidden = true;
        toast(`Sent to your family${n > 1 ? ` (${n} circles)` : ''}.`);
      } catch (e) {
        sendBtn.disabled = false;
        if (e.message === 'no_circle') goFamily();
        else notice(friendly(e), 'error');
      }
    },
  }, icon('Share2'), circles.length ? `Send to ${settings.contactName || 'family'}` : 'Set up family sharing');
  box.className = 'notice info';
  box.replaceChildren(
    h('span', {}, icon('Users')),
    h('div', { class: 'notice-body' },
      h('b', { text: 'Tell my family' }),
      h('span', { class: 'muted', text: 'Only a short summary is shared. The message itself and your personal details are not.' }),
      h('div', { class: 'row' }, sendBtn, copyBtn)
    )
  );
  box.hidden = false;
  box.scrollIntoView({ block: 'nearest' });
}

/* ---------------- UI: Family view ---------------- */

export async function renderFamilyView(root, { settings, toast }) {
  root.replaceChildren(h('p', { class: 'muted', text: 'Loading…' }));
  let circles;
  try {
    circles = await getCircles();
  } catch {
    circles = [];
  }
  const parts = [];

  if (!circles.length) {
    const nameInput = h('input', { placeholder: 'Your first name', maxlength: '40', value: settings.contactName ? '' : '' });
    const codeInput = h('input', { placeholder: 'ABCDE-12345', maxlength: '11', autocomplete: 'off', 'aria-label': 'Family code' });
    const err = h('p', { class: 'notice error', hidden: true, role: 'alert' });
    const run = async (btn, fn) => {
      btn.disabled = true;
      err.hidden = true;
      try {
        await fn();
        renderFamilyView(root, { settings, toast });
      } catch (e) {
        err.textContent = friendly(e);
        err.hidden = false;
        btn.disabled = false;
      }
    };
    const createBtn = h('button', { class: 'btn primary', type: 'button', text: 'Create a family code' });
    createBtn.onclick = () => run(createBtn, () => createCircle(nameInput.value.trim()));
    const joinBtn = h('button', { class: 'btn secondary', type: 'button', text: 'Join' });
    joinBtn.onclick = () => run(joinBtn, () => joinCircle(codeInput.value, nameInput.value.trim()));

    parts.push(
      h('div', { class: 'card' },
        h('h2', { text: 'Protect someone' }),
        h('p', { class: 'muted', text: 'Create a code and give it to a family member. When you tap “Tell my family”, they’ll see the warning in their Scamouflage.' }),
        h('label', { class: 'field' }, h('span', { class: 'field-label', text: 'Your name' }), nameInput),
        createBtn
      ),
      h('div', { class: 'card' },
        h('h2', { text: 'Got a code?' }),
        h('p', { class: 'muted', text: 'Enter the code a family member gave you to see the warnings they share.' }),
        h('div', { class: 'row' }, codeInput, joinBtn)
      ),
      err
    );
    root.replaceChildren(...parts);
    return;
  }

  for (const c of circles) {
    let info = null;
    let reports = [];
    let failed = null;
    try {
      [info, reports] = await Promise.all([circleInfo(c.code), loadReports(c.code)]);
    } catch (e) {
      failed = friendly(e);
    }
    const names = info ? Object.values(info.names || {}) : [];
    const card = h('div', { class: 'card' },
      h('h2', { text: c.role === 'owner' ? 'Your family code' : 'Family you’re watching over' }),
      c.role === 'owner' &&
        h('div', { class: 'code-box' },
          h('span', { text: pretty(c.code) }),
          h('button', { class: 'icon-btn small', type: 'button', 'aria-label': 'Copy code', onclick: async () => { await navigator.clipboard.writeText(pretty(c.code)); toast('Code copied.'); } }, icon('Copy'))
        ),
      h('p', { class: 'muted', text: names.length ? `Members: ${names.join(', ')}` : c.role === 'owner' ? 'Share this code with someone you trust.' : '' }),
      failed && h('p', { class: 'notice error', text: failed })
    );
    parts.push(card);

    if (reports.length) {
      parts.push(h('h2', { class: 'view-title', style: 'font-size: var(--fs-lg)', text: 'Shared warnings' }));
      for (const r of reports) {
        const when = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';
        parts.push(
          h('div', { class: `report ${r.verdict}` },
            h('span', { class: 'tone', 'aria-hidden': 'true' }),
            h('div', {},
              h('div', { class: 'report-title', text: `${{ scam: 'Scam', suspicious: 'Be careful', safe: 'Looks safe' }[r.verdict]}: ${r.subject}` }),
              h('div', { text: r.why }),
              h('div', { class: 'report-meta', text: [r.authorName, r.fromDomain, when].filter(Boolean).join(' · ') })
            )
          )
        );
      }
    } else if (!failed) {
      parts.push(h('div', { class: 'empty-state' }, icon('ShieldCheck'), h('b', { text: 'No shared warnings yet' }), h('span', { text: 'Warnings shared with “Tell my family” show up here.' })));
    }
    parts.push(
      h('button', {
        class: 'link-btn',
        type: 'button',
        text: c.role === 'owner' ? 'Delete this family code' : 'Leave this family',
        onclick: async () => {
          await leaveCircle(c.code);
          renderFamilyView(root, { settings, toast });
        },
      })
    );
  }
  root.replaceChildren(...parts);
}
