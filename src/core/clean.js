// Shrinks an email to the part that matters before it goes to a model.
// Fewer input tokens is the single biggest speed lever for Gemini Nano, and it also means
// less personal data in any (redacted) cloud request.

import { realUrl, baseDomain, hostOf } from './url.js';

export const DEFAULT_MAX_BODY = 1800;
export const DEFAULT_MAX_LINKS = 8;

// Lines that start a quoted reply / forwarded history. Everything from here down is old mail.
const HISTORY_START = [
  /^on .{3,120}(wrote|écrit|schrieb):?\s*$/i, // "On Mon, Mar 3, 2026 at 9:12 AM Pat <pat@x.com> wrote:"
  /^-{2,}\s*(original message|forwarded message)\s*-{2,}/i,
  /^_{5,}\s*$/, // Outlook separator
  /^from:\s.+\n?(sent|date):\s/im,
  /^begin forwarded message:?/i,
];

// Signature / legal footer starts. Cut from the first match that appears in the lower part of the body.
const FOOTER_START = [
  /^--\s*$/, // RFC 3676 signature delimiter
  /^sent from my (iphone|ipad|android|phone|mobile)/i,
  /^(this (e-?mail|message) (and any attachments )?(is|may be) (confidential|intended))/i,
  /^(confidentiality|disclaimer) notice/i,
  /^you (are )?receiv(ed|ing) this (e-?mail|message|because)/i,
  /^(to )?unsubscribe\b/i,
  /^(view|open) (this|it) in (your|a) browser/i,
];

// Junk that's pure noise for a scam check.
const NOISE = [
  /\[image:[^\]]*\]/gi, // Gmail image placeholders
  /\u200b|\u200c|\u200d|\u2060|\ufeff|\u00ad/g, // zero-width chars (also used to hide words)
  /\u034f/g, // combining grapheme joiner (used as invisible preheader padding)
];

function cutAt(lines, patterns, fromIndex = 0) {
  for (let i = fromIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    // Two-line patterns ("From: x\nSent: y") need the next line too.
    const pair = `${line}\n${(lines[i + 1] || '').trim()}`;
    if (patterns.some((re) => re.test(line) || (re.flags.includes('m') && re.test(pair)))) return i;
  }
  return lines.length;
}

/**
 * Cleans an email body: strips quoted history, signatures and footers, invisible characters and
 * extra whitespace, then caps length (keeping the start, where scams put their ask).
 * Returns { text, removed } where removed is the number of characters dropped.
 */
export function cleanBody(body = '', maxChars = DEFAULT_MAX_BODY) {
  const original = body.length;
  let text = body.replace(/\r\n?/g, '\n');
  for (const re of NOISE) text = text.replace(re, '');

  let lines = text.split('\n');
  // Drop ">"-quoted lines anywhere.
  lines = lines.filter((l) => !/^\s*>/.test(l));
  lines = lines.slice(0, cutAt(lines, HISTORY_START));
  // Only treat footer markers as footers if they're past the first third (avoid cutting short emails).
  const footerAt = cutAt(lines, FOOTER_START, Math.floor(lines.length / 3));
  if (footerAt > 0) lines = lines.slice(0, footerAt);

  text = lines
    .map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (text.length > maxChars) {
    // Cut on a word boundary and mark it, so the model knows it's partial.
    const cut = text.lastIndexOf(' ', maxChars);
    text = `${text.slice(0, cut > maxChars * 0.8 ? cut : maxChars)} […]`;
  }
  return { text, removed: Math.max(0, original - text.length) };
}

/**
 * Unwraps redirects and keeps one link per destination domain (max `max`).
 * Mismatched links (shown text ≠ destination) are kept first since they're the strongest evidence.
 */
export function dedupeLinks(links = [], max = DEFAULT_MAX_LINKS) {
  const byDomain = new Map();
  for (const l of links) {
    const href = realUrl(l.href);
    const host = hostOf(href);
    if (!host) continue;
    const domain = baseDomain(host);
    const text = (l.text || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const shown = text.match(/\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b/i)?.[1];
    const mismatch = !!shown && baseDomain(shown) !== domain;
    const prev = byDomain.get(domain);
    if (!prev || (mismatch && !prev.mismatch)) byDomain.set(domain, { text, href, host, mismatch });
  }
  return [...byDomain.values()].sort((a, b) => b.mismatch - a.mismatch).slice(0, max);
}

/** Full prep: cleaned body + deduped links. Doesn't mutate the input. */
export function prepareEmail(email, { maxBody = DEFAULT_MAX_BODY, maxLinks = DEFAULT_MAX_LINKS } = {}) {
  const { text, removed } = cleanBody(email.body || '', maxBody);
  return {
    ...email,
    subject: (email.subject || '').replace(/\s+/g, ' ').trim().slice(0, 200),
    body: text,
    links: dedupeLinks(email.links || [], maxLinks),
    trimmedChars: removed,
  };
}
