import { realUrl } from './recon.js';

// Strips personal details before anything is sent to the cloud.
// The on-device path never needs this: the email never leaves the machine.

const RULES = [
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]'],
  [/\b(?:\d[ -]?){13,19}\b/g, '[card-or-account-number]'],
  [/\b\d{3}-\d{2}-\d{4}\b/g, '[ssn]'],
  [/(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, '[phone]'],
  [/\b\d{6,}\b/g, '[number]'],
];

/** Returns { text, count } with personal details replaced by placeholders. */
export function redact(input = '') {
  let count = 0;
  let text = input;
  for (const [re, label] of RULES) {
    text = text.replace(re, () => {
      count++;
      return label;
    });
  }
  return { text, count };
}

/** Redacts an email object. Keeps the sender's domain (useful evidence) but not the mailbox name. */
export function redactEmail(email) {
  let total = 0;
  const r = (s) => {
    const { text, count } = redact(s);
    total += count;
    return text;
  };
  const domain = email.fromEmail.split('@')[1] || '';
  return {
    email: {
      ...email,
      fromName: r(email.fromName),
      fromEmail: domain ? `[sender]@${domain}` : '',
      subject: r(email.subject),
      body: r(email.body),
      // Unwrap redirects first, then drop query strings/fragments (they often carry tracking IDs).
      links: (email.links || []).map((l) => ({ text: r(l.text), href: realUrl(l.href).replace(/[?#].*$/, '') })),
    },
    count: total,
  };
}
