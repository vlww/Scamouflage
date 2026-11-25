// "Recon": fast, deterministic checks that run locally before any AI (≈1 ms).
// They give the user an instant first answer and are handed to the model as hints.

import { realUrl, baseDomain, hostOf } from './url.js';

export { realUrl, baseDomain, hostOf };

// Organisations scammers commonly impersonate. Used only to *detect* impersonation in incoming
// mail; nothing here is shown as branding in the UI.
const BRANDS = [
  'paypal', 'amazon', 'apple', 'icloud', 'microsoft', 'outlook', 'office365', 'netflix', 'google',
  'facebook', 'instagram', 'whatsapp', 'chase', 'wells fargo', 'bank of america', 'citibank',
  'irs', 'social security', 'medicare', 'usps', 'fedex', 'ups', 'dhl', 'geek squad', 'norton',
  'mcafee', 'coinbase', 'venmo', 'zelle', 'cash app', 'walmart', 'costco', 'docusign', 'dropbox',
  'linkedin', 'att', 'verizon', 'comcast', 'xfinity', 'spectrum', 'binance', 'metamask',
];
// Brands too short / too common as words to match safely in the subject alone.
const WORDY = new Set(['apple', 'ups', 'att', 'chase', 'spectrum']);

const FREE_MAIL = /^(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|msn|aol|icloud|me|proton(mail)?|pm|gmx|mail|yandex|zoho)\.[a-z.]+$/i;
// TLDs heavily abused for throwaway phishing domains.
const RISKY_TLD = /\.(top|xyz|zip|mov|click|link|live|online|site|website|shop|store|buzz|rest|icu|cfd|sbs|lol|quest|cam|support|help|info|cyou|monster|work|gq|tk|ml|cf|ga)$/i;
const SHORTENER = /^(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|rb\.gy|cutt\.ly|shorturl\.at|t\.ly|s\.id|tiny\.cc)$/i;

const URGENCY =
  /\b(urgent(ly)?|immediately|within (24|48|72) hours|final (notice|warning)|account (will be |has been |is )?(suspended|locked|closed|disabled|restricted)|act now|verify (your )?(account|identity)|unusual (sign-?in|activity|login)|last chance|expires? today|action required|avoid (suspension|penalt))/i;
const PAYMENT =
  /\b(gift ?cards?|itunes card|google play card|steam card|wire (the )?(money|funds|transfer)|bitcoin|crypto(currency)?|btc|usdt|western union|moneygram|send (me )?(the )?(codes?|money)|bitcoin atm|pay (a |the )?(small |customs |redelivery |shipping )?fee|overpaid|refund (of|for) \$)/i;
const CREDENTIALS =
  /\b(confirm|verify|update|re-?enter|validate) (your )?(password|login|credentials|card details|billing (info|information|details)|payment (method|details)|banking details|ssn|social security number)|(one[- ]time|verification|security) code\b/i;
const SECRECY = /\b(don'?t tell (anyone|anybody|your)|keep (this|it) (between us|confidential|secret|private)|do not (share|discuss) this)\b/i;
const CALL_NOW = /\b(call (us|now|immediately|our (support|helpline|toll[- ]free))|contact (our )?(support|technician)|toll[- ]free)\b[^\n]{0,40}\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/i;
const TOO_GOOD = /\b(you('ve| have)? (won|been selected)|claim your (prize|reward)|lottery|inheritance|guaranteed (returns?|profit)|double your (money|investment)|risk[- ]free investment)\b/i;
const ATTACH_BAIT = /\.(html?|zip|iso|exe|scr|js|vbs|lnk|img)\b.{0,20}(attached|attachment)|(attached|attachment).{0,40}\.(html?|zip|iso|exe|scr|js|vbs|lnk|img)\b/i;

// Points per finding type. ≥5 → scam, ≥2 → suspicious. Tuned on the eval set (eval/).
const WEIGHTS = {
  link_mismatch: 4, lookalike_domain: 4, impersonation: 3, credential_request: 3, payment_request: 3,
  suspicious_link: 2, secrecy: 2, call_now: 2, too_good_to_be_true: 2, attachment: 2, urgency: 1, risky_domain: 1,
};

/** Characters swapped in to fake a brand: paypa1, rnicrosoft, amaz0n… */
function deLeet(s) {
  return s.replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/0/g, 'o').replace(/1/g, 'l').replace(/3/g, 'e').replace(/5/g, 's').replace(/[^a-z]/g, '');
}
function compact(s = '') {
  return s.toLowerCase().replace(/[^a-z]/g, '');
}

/** Does this domain look like it's pretending to be `brand` (without being it)? */
function lookalikeOf(domain) {
  const label = domain.split('.')[0];
  const clean = deLeet(label);
  for (const b of BRANDS) {
    const bc = compact(b);
    if (bc.length < 5) continue;
    if (label === bc) return null; // the real thing (or at least not a look-alike)
    // Digit/letter swaps (paypa1) or brand-plus-words (paypal-secure-login).
    if (clean.includes(bc) && (clean !== compact(label) || label.includes('-'))) return b;
  }
  return null;
}

function title(s) {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/**
 * Returns findings: [{ type, detail, weight, evidence? }]
 * `detail` is short (chip-sized). `evidence` lets the UI highlight what triggered it.
 */
export function runRecon(email) {
  const findings = [];
  const add = (type, detail, evidence) => {
    if (!findings.some((f) => f.type === type && f.detail === detail)) {
      findings.push({ type, detail, weight: WEIGHTS[type] ?? 1, ...(evidence ? { evidence } : {}) });
    }
  };

  const fromEmail = (email.fromEmail || '').toLowerCase();
  const senderDomain = fromEmail.split('@')[1] || '';
  const senderBase = baseDomain(senderDomain);
  const nameAndSubject = `${email.fromName || ''} ${email.subject || ''}`.toLowerCase();
  const fromName = (email.fromName || '').toLowerCase();
  const text = `${email.subject || ''}\n${email.body || ''}`;

  // Brand impersonation: display name (or subject) names a brand the sender's domain doesn't match.
  const brand = BRANDS.find((b) => {
    const re = new RegExp(`\\b${b.replace(/ /g, '\\s?')}\\b`, 'i');
    return WORDY.has(b) ? re.test(fromName) : re.test(nameAndSubject);
  });
  if (brand && senderDomain && !compact(senderDomain).includes(compact(brand))) {
    add(
      'impersonation',
      FREE_MAIL.test(senderDomain)
        ? `Says "${title(brand)}" but sent from a personal ${senderDomain} account`
        : `Says "${title(brand)}" but sent from ${senderBase}`,
      { kind: 'sender' }
    );
  }
  if (senderDomain.includes('xn--')) add('lookalike_domain', `Sender uses disguised letters (${senderDomain})`, { kind: 'sender' });
  const senderLook = senderBase && lookalikeOf(senderBase);
  if (senderLook) add('lookalike_domain', `Sender domain imitates ${title(senderLook)} (${senderBase})`, { kind: 'sender' });
  if (senderBase && RISKY_TLD.test(senderBase) && !senderLook) {
    add('risky_domain', `Sender uses a throwaway-style domain (${senderBase})`, { kind: 'sender' });
  }

  // Links
  const seen = new Set();
  for (const link of email.links || []) {
    const dest = realUrl(link.href);
    const host = hostOf(dest);
    if (!host || seen.has(host)) continue;
    seen.add(host);
    const base = baseDomain(host);
    const ev = { kind: 'link', host };

    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) add('suspicious_link', `Link goes to a bare number address (${host})`, ev);
    if (host.includes('xn--')) add('lookalike_domain', `Link uses disguised letters (${host})`, ev);
    const look = lookalikeOf(base);
    if (look) add('lookalike_domain', `Link imitates ${title(look)} (${base})`, ev);
    if (SHORTENER.test(host)) add('suspicious_link', `Link hides its destination (${host})`, ev);

    const shown = (link.text || '').match(/\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b/i)?.[1];
    if (shown && /[a-z]/i.test(shown.split('.').pop()) && baseDomain(shown) !== base) {
      add('link_mismatch', `Link says ${baseDomain(shown)} but goes to ${base}`, ev);
    } else if (RISKY_TLD.test(base) && !look && base !== senderBase) {
      add('risky_domain', `Link to a throwaway-style domain (${base})`, ev);
    }
  }

  const quote = (re) => text.match(re)?.[0].trim().slice(0, 40);
  if (URGENCY.test(text)) add('urgency', `Pressure: "${quote(URGENCY)}"`, { kind: 'text', match: quote(URGENCY) });
  if (PAYMENT.test(text)) add('payment_request', `Unusual payment: "${quote(PAYMENT)}"`, { kind: 'text', match: quote(PAYMENT) });
  if (CREDENTIALS.test(text)) add('credential_request', `Asks for login or card details`, { kind: 'text', match: quote(CREDENTIALS) });
  if (SECRECY.test(text)) add('secrecy', 'Asks you to keep it secret', { kind: 'text', match: quote(SECRECY) });
  if (CALL_NOW.test(text)) add('call_now', 'Pushes you to call a phone number', { kind: 'text', match: quote(CALL_NOW) });
  if (TOO_GOOD.test(text)) add('too_good_to_be_true', `Too good to be true: "${quote(TOO_GOOD)}"`, { kind: 'text', match: quote(TOO_GOOD) });
  if (ATTACH_BAIT.test(text)) add('attachment', 'Risky attachment type', { kind: 'text', match: quote(ATTACH_BAIT) });

  return findings.sort((a, b) => b.weight - a.weight).slice(0, 8);
}

/** Instant, AI-free first answer from recon findings. */
export function reconVerdict(findings) {
  const score = findings.reduce((s, f) => s + (f.weight || 1), 0);
  if (score >= 5) return { verdict: 'scam', score };
  if (score >= 2) return { verdict: 'suspicious', score };
  return { verdict: 'safe', score };
}
