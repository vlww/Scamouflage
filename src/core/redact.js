import { realUrl, stripQuery, hostOf } from './url.js';

// Strips personal details before anything is sent to the cloud.
// The on-device path never needs this: the email never leaves the machine.
//
// Design: be aggressive about anything that identifies the reader (numbers, addresses, names
// in greetings, tokens in URLs) but keep the *evidence* a scam checker needs: sender domain,
// link domains, amounts of money, dates, and the wording of the ask.

function luhn(digits) {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = +digits[i];
    if (dbl) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

// Order matters: specific patterns first, generic number catch-all last.
const RULES = [
  // URLs: keep scheme+host+path (evidence), drop query/fragment (tracking IDs, tokens, emails).
  [/\bhttps?:\/\/[^\s<>"')\]]+/gi, (m) => {
    const clean = stripQuery(m);
    return { text: clean, hit: clean !== m };
  }],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, () => '[email]'],
  [/\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?\b/g, () => '[bank-account]'], // IBAN
  [/\b\d{3}[- ]\d{2}[- ]\d{4}\b/g, () => '[ssn]'],
  // 13–19 digit runs (optionally spaced/dashed in groups): card if Luhn-valid, else account number.
  [/\b\d(?:[ -]?\d){12,18}\b/g, (m) => (luhn(m.replace(/\D/g, '')) ? '[card]' : '[account-number]')],
  // Phones: +1 (555) 010-2231, 555.010.2231, +44 20 7946 0958 …
  [/(?:\+\d{1,3}[\s.-]?)?\(?\b\d{2,4}\)?[\s.-]\d{3,4}[\s.-]\d{3,4}\b/g, (m) => {
    const digits = m.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 13 ? '[phone]' : null;
  }],
  [/\b(?:acct|account|member|policy|customer|routing|aba)\s*(?:no\.?|number|#|id)?[:\s#]*[A-Z0-9-]{4,}\b/gi, (m) => m.replace(/[A-Z0-9-]{4,}$/i, '[account-number]')],
  // Street addresses: "12 Elm St", "4400 North Oak Avenue Apt 3"
  [/\b\d{1,6}\s+(?:[NSEW]\.?\s+|(?:North|South|East|West)\s+)?(?:[A-Z][a-z]+\s){1,3}(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Ln|Lane|Dr|Drive|Ct|Court|Way|Pl|Place|Terrace|Ter)\b\.?(?:,?\s*(?:Apt|Unit|Suite|#)\s*\w+)?/g, () => '[address]'],
  // Names in greetings: "Dear Margaret Smith," "Hi Pat," (not "Dear Customer").
  [/\b(Dear|Hi|Hello|Hey|Attn:?)\s+((?:Mr\.?|Mrs\.?|Ms\.?|Dr\.?)\s+)?([A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+){0,2})(?=\s*[,!\n])/g, (m, greet, hon, name) =>
    /^(Customer|Client|User|Member|Sir|Madam|Friend|Valued|Account|Team|All|There|Everyone)\b/i.test(name) ? null : `${greet} [name]`],
  // Long digit runs that are not money, years or dates: verification codes, order/ref numbers.
  [/(?<![$£€\d.,:/-])\b\d{6,12}\b(?![.,]\d)/g, () => '[number]'],
];

/** Returns { text, count } with personal details replaced by placeholders. */
export function redact(input = '') {
  let count = 0;
  let text = input;
  for (const [re, fn] of RULES) {
    text = text.replace(re, (...args) => {
      const out = fn(...args);
      if (out == null) return args[0];
      if (typeof out === 'object') {
        if (out.hit) count++;
        return out.text;
      }
      count++;
      return out;
    });
  }
  return { text, count };
}

/**
 * Redacts an email object for a cloud request. Keeps the sender's *domain* (useful evidence)
 * but never the mailbox name; link destinations are reduced to host + path.
 */
export function redactEmail(email) {
  let total = 0;
  const r = (s = '') => {
    const { text, count } = redact(s);
    total += count;
    return text;
  };
  const domain = (email.fromEmail || '').split('@')[1] || '';
  if (email.fromEmail) total++;
  return {
    email: {
      ...email,
      fromName: r(email.fromName),
      fromEmail: domain ? `[sender]@${domain}` : '',
      subject: r(email.subject),
      body: r(email.body),
      links: (email.links || []).map((l) => {
        const href = stripQuery(realUrl(l.href));
        return { ...l, text: r(l.text), href, host: l.host || hostOf(href) };
      }),
    },
    count: total,
  };
}
