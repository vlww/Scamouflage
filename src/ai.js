import { getGenerativeModel, InferenceMode, InferenceSource } from 'firebase/ai';
import { ai } from './firebase.js';
import { realUrl } from './recon.js';
import { redactEmail } from './redact.js';

const CLOUD_MODEL = 'gemini-3.5-flash-lite';
const MAX_BODY_CHARS = 5000; // keeps on-device prompts well inside Gemini Nano's context window

export const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['safe', 'suspicious', 'scam'] },
    confidence: { type: 'integer', description: '0-100: how sure you are of the verdict' },
    summary: { type: 'string', description: 'One plain-language sentence for a non-technical reader.' },
    red_flags: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'impersonation', 'link_mismatch', 'suspicious_link', 'lookalike_domain', 'urgency',
              'payment_request', 'credential_request', 'too_good_to_be_true', 'secrecy',
              'attachment', 'grammar', 'other',
            ],
          },
          detail: { type: 'string' },
        },
        required: ['type', 'detail'],
      },
    },
    advice: { type: 'string', description: 'What the reader should do next, in one or two short sentences.' },
  },
  required: ['verdict', 'confidence', 'summary', 'red_flags', 'advice'],
};

// Scanner: hybrid. Gemini Nano on-device when available, cloud fallback otherwise.
// On-device structured output uses Chrome's responseConstraint; cloud uses responseJsonSchema.
const scanModel = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_ON_DEVICE,
  onDeviceParams: { promptOptions: { responseConstraint: VERDICT_SCHEMA } },
  inCloudParams: {
    model: CLOUD_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: VERDICT_SCHEMA,
      temperature: 0.2,
    },
  },
});

// Debrief: multi-turn chat isn't supported on-device, so it always runs in the cloud,
// and only ever sees a redacted copy of the email.
const debriefModel = getGenerativeModel(ai, {
  model: CLOUD_MODEL,
  systemInstruction:
    'You are Scamouflage Debrief, a calm, friendly scam-safety coach. Readers may be older or ' +
    'non-technical: use short sentences, no jargon, and concrete steps. Personal details in the ' +
    'email were replaced with placeholders like [email] or [phone]; never ask for them. Never tell ' +
    'the reader to click links or call numbers from a suspicious email; point them to the official ' +
    'website or app they already use instead. Keep answers under 120 words unless asked for more.',
});

/** 'available' | 'downloadable' | 'downloading' | 'unavailable' */
export async function deviceAvailability() {
  if (!('LanguageModel' in self)) return 'unavailable';
  try {
    return await self.LanguageModel.availability();
  } catch {
    return 'unavailable';
  }
}

/** Must be called from a user gesture (click). */
export function prepareDeviceModel(onProgress) {
  return scanModel.initializeDeviceModel(onProgress);
}

function formatEmail(email) {
  const links = (email.links || [])
    .slice(0, 15)
    .map((l) => `- "${l.text || '(no text)'}" -> ${realUrl(l.href)}`)
    .join('\n');
  return [
    `From: ${email.fromName} <${email.fromEmail}>`,
    `Subject: ${email.subject}`,
    `Links:\n${links || '(none)'}`,
    `Body:\n${email.body.slice(0, MAX_BODY_CHARS)}`,
  ].join('\n');
}

function scanPrompt(email, recon) {
  const hints = recon.length ? recon.map((f) => `- [${f.type}] ${f.detail}`).join('\n') : '- none';
  // On-device ignores systemInstruction, so the instructions live in the prompt itself.
  return `You are Scamouflage, an expert at spotting scam and phishing emails.
Decide whether the email below is "safe", "suspicious", or "scam".
- "scam": clear signs of phishing, fraud, impersonation, or requests for money, gift cards, crypto, passwords, or codes.
- "suspicious": some warning signs, but could be legitimate.
- "safe": ordinary email with no meaningful warning signs. Normal newsletters and receipts from matching domains are safe.
Automated pre-scan findings (may include false positives; confirm or ignore them):
${hints}
Write the summary and advice for a non-technical reader. List at most 5 red flags; use an empty list if there are none.
Respond only with JSON matching the schema.

=== EMAIL START ===
${formatEmail(email)}
=== EMAIL END ===`;
}

function parseJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  return JSON.parse(cleaned);
}

/**
 * Scans an email. If on-device inference isn't ready, the email is redacted *before* the
 * request so personal details never reach the cloud.
 * Returns { result, source: 'on_device' | 'in_cloud', redactedCount }.
 */
export async function scanEmail(email, recon) {
  const onDevice = (await deviceAvailability()) === 'available';
  let toSend = email;
  let redactedCount = 0;
  if (!onDevice) {
    ({ email: toSend, count: redactedCount } = redactEmail(email));
  }

  const response = (await scanModel.generateContent(scanPrompt(toSend, recon))).response;
  const source = response.inferenceSource ?? (onDevice ? InferenceSource.ON_DEVICE : InferenceSource.IN_CLOUD);
  const result = parseJson(response.text());
  result.red_flags = (result.red_flags || []).slice(0, 5);
  result.confidence = Math.max(0, Math.min(100, Math.round(result.confidence ?? 50)));
  return { result, source, redactedCount };
}

/** Starts a cloud debrief chat about a (redacted) email and its verdict. */
export function startDebrief(email, verdict) {
  const { email: safeEmail, count } = redactEmail(email);
  const chat = debriefModel.startChat();
  const opening =
    `Here is an email the reader received (personal details redacted) and the scanner's verdict.\n\n` +
    `${formatEmail(safeEmail)}\n\nVerdict: ${JSON.stringify(verdict)}\n\n` +
    `Explain in plain language why this verdict makes sense (or say if you disagree), how the trick ` +
    `works if it is a scam, and give 2-3 concrete steps for what to do now.`;
  return { chat, opening, redactedCount: count };
}

/** Streams a chat reply; calls onText with the accumulated text. */
export async function streamReply(chat, message, onText) {
  const { stream } = await chat.sendMessageStream(message);
  let text = '';
  for await (const chunk of stream) {
    text += chunk.text();
    onText(text);
  }
  return text;
}
