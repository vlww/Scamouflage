// Prompt + schema for the scan. Pure module: shared by the extension and the eval script.
//
// Speed notes (Gemini Nano): output tokens dominate latency, so the schema is tiny and the
// verdict comes first (it streams out first and the UI can show it immediately). Instructions
// live in the prompt text because on-device inference ignores systemInstruction.

import { stripQuery } from './url.js';

export const FLAG_TYPES = [
  'impersonation', 'link_mismatch', 'lookalike_domain', 'suspicious_link', 'urgency',
  'payment_request', 'credential_request', 'secrecy', 'call_now', 'too_good_to_be_true',
  'attachment', 'other',
];

export const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['scam', 'suspicious', 'safe'] },
    confidence: { type: 'integer', minimum: 0, maximum: 100 },
    why: { type: 'string' },
    flags: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: FLAG_TYPES },
          text: { type: 'string' },
        },
        required: ['type', 'text'],
      },
    },
  },
  required: ['verdict', 'confidence', 'why', 'flags'],
};

const RUBRIC = {
  // Default.
  v2: `verdict: "scam" = phishing, fraud, impersonation, or asks for money, gift cards, crypto, passwords or codes. "suspicious" = warning signs but could be real. "safe" = ordinary mail (newsletters, receipts, reminders, personal notes) with no real warning signs. A notice from a company's own domain that only points you to its official app or website, and asks for no money, passwords or codes, is safe.`,
  // Leans cautious: anything asking for money/credentials from an unverified sender is a scam.
  'v2-cautious': `verdict: "scam" = phishing, fraud, impersonation, or ANY request for money, gift cards, crypto, passwords, codes or remote access from a sender you cannot verify. "suspicious" = warning signs but could be real. "safe" = ordinary mail with no warning signs; a matching sender domain alone does not make a request for money safe.`,
};
export const PROMPT_VERSIONS = Object.keys(RUBRIC);
export const DEFAULT_PROMPT_VERSION = 'v2';

const FORMAT = `confidence: 0-100, how sure you are that your verdict is right (an obviously normal email is "safe" with high confidence).
why: one plain sentence for a worried non-technical reader, at most 12 words.
flags: up to 3 warning signs, each {type, text} with text at most 10 words. Use [] when safe.
Reply with JSON only.`;

function hintLines(recon = []) {
  return recon.length ? recon.slice(0, 5).map((f) => `- ${f.detail}`).join('\n') : '- none';
}

/** Compact text form of a (cleaned) email. Links are shown as `text → host/path`. */
export function formatEmail(email) {
  const links = (email.links || [])
    .map((l) => {
      const dest = stripQuery(l.href || '').replace(/^https?:\/\//, '').slice(0, 70);
      const text = (l.text || '').slice(0, 50);
      return `- ${text && text !== dest ? `"${text}" → ` : ''}${dest}`;
    })
    .join('\n');
  const from = [email.fromName, email.fromEmail && `<${email.fromEmail}>`].filter(Boolean).join(' ');
  return [
    `From: ${from || '(unknown)'}`,
    `Subject: ${email.subject || '(none)'}`,
    links && `Links:\n${links}`,
    `Body:\n${email.body || ''}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function scanPrompt(email, recon, version = DEFAULT_PROMPT_VERSION) {
  return `You check messages for scams.
${RUBRIC[version] || RUBRIC[DEFAULT_PROMPT_VERSION]}
${FORMAT}
Quick local checks found (may be wrong):
${hintLines(recon)}

<message>
${formatEmail(email)}
</message>`;
}

export function imagePrompt(version = DEFAULT_PROMPT_VERSION) {
  return `You check messages for scams. The image is a screenshot of a text message, chat, social media DM, email or web page.
${RUBRIC[version] || RUBRIC[DEFAULT_PROMPT_VERSION]}
${FORMAT}`;
}

/** Normalises a model result so the UI never has to defend against odd values. */
export function normalizeResult(r = {}) {
  const verdict = ['scam', 'suspicious', 'safe'].includes(r.verdict) ? r.verdict : 'suspicious';
  const conf = Number.isFinite(+r.confidence) ? +r.confidence : 60;
  // Some models answer 0-1 instead of 0-100.
  const confidence = Math.max(0, Math.min(100, Math.round(conf <= 1 && conf > 0 ? conf * 100 : conf)));
  const flags = (Array.isArray(r.flags) ? r.flags : [])
    .filter((f) => f && typeof f.text === 'string' && f.text.trim())
    .slice(0, 3)
    .map((f) => ({ type: FLAG_TYPES.includes(f.type) ? f.type : 'other', text: f.text.trim().replace(/\.$/, '') }));
  return { verdict, confidence, why: typeof r.why === 'string' ? r.why.trim() : '', flags };
}
