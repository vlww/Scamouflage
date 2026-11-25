// The scan engine: Firebase AI Logic hybrid inference with privacy-aware routing.
//
// Routing rules (the heart of Scamouflage):
//   1. On-device model ready      → ONLY_ON_DEVICE with the full email. It cannot leave the machine.
//   2. Not ready, cloud allowed   → redact FIRST, then PREFER_ON_DEVICE (in practice: cloud).
//                                   Whichever way the SDK routes, only redacted text is sent.
//   3. Cloud not allowed          → ONLY_ON_DEVICE, or a recon-only answer if Nano isn't there.
//   4. On-device slow / fails     → if cloud is allowed: redacted cloud retry, clearly labelled.
//   5. Second opinion / Debrief   → ONLY_IN_CLOUD, always redacted, only when the user asks
//                                   (or opts into automatic second opinions).

import { getGenerativeModel, InferenceMode, InferenceSource } from 'firebase/ai';
import { ai } from './firebase.js';
import { cfg } from './config.js';
import { prepareEmail } from './core/clean.js';
import { runRecon } from './core/recon.js';
import { redact, redactEmail } from './core/redact.js';
import { VERDICT_SCHEMA, scanPrompt, imagePrompt, formatEmail, normalizeResult } from './core/prompt.js';
import { parsePartialJson, parseFinalJson } from './core/partial-json.js';
import { timer, logTimings } from './perf.js';

const TEXT_IO = [{ type: 'text', languages: ['en'] }];
// Text-only sessions: no image encoder needed, and availability doesn't depend on the
// multimodal flag. (The SDK's default declares image input for every session.)
const TEXT_CREATE = { expectedInputs: TEXT_IO, expectedOutputs: TEXT_IO };
const IMAGE_CREATE = { expectedInputs: [...TEXT_IO, { type: 'image' }], expectedOutputs: TEXT_IO };
const VERDICTS = ['scam', 'suspicious', 'safe'];

const models = new Map();
function model(kind, mode) {
  const cloudModel = cfg('cloud_model');
  const key = `${kind}|${mode}|${cloudModel}`;
  if (!models.has(key)) {
    models.set(
      key,
      getGenerativeModel(ai, {
        mode,
        onDeviceParams: {
          createOptions: kind === 'image' ? IMAGE_CREATE : TEXT_CREATE,
          promptOptions: { responseConstraint: VERDICT_SCHEMA },
        },
        inCloudParams: {
          model: cloudModel,
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: VERDICT_SCHEMA,
            temperature: 0.1,
            maxOutputTokens: 300,
          },
        },
      })
    );
  }
  return models.get(key);
}

/* ---------------- On-device model lifecycle ---------------- */

/** 'available' | 'downloadable' | 'downloading' | 'unavailable' */
export async function deviceAvailability(kind = 'text') {
  if (!('LanguageModel' in self)) return 'unavailable';
  try {
    return await self.LanguageModel.availability(kind === 'image' ? IMAGE_CREATE : TEXT_CREATE);
  } catch {
    return 'unavailable';
  }
}

/** Downloads Gemini Nano via the SDK. Must be called from a user gesture (click). */
export function prepareDeviceModel(onProgress) {
  return model('text', InferenceMode.PREFER_ON_DEVICE).initializeDeviceModel(onProgress);
}

let warmSession = null;
/**
 * Loads Nano into memory once per panel session so the first scan doesn't pay the cold start.
 * The SDK creates a fresh session per request; holding one session keeps the model resident.
 */
export async function warmUp() {
  if (warmSession || (await deviceAvailability()) !== 'available') return null;
  const t0 = performance.now();
  try {
    warmSession = await self.LanguageModel.create(TEXT_CREATE);
    const ms = Math.round(performance.now() - t0);
    logTimings('warm-up (session create, cold)', { ms });
    return ms;
  } catch {
    return null;
  }
}

/* ---------------- Streaming core ---------------- */

class TimeoutError extends Error {
  constructor(ms) {
    super(`On-device check took longer than ${Math.round(ms / 1000)}s`);
    this.name = 'TimeoutError';
  }
}

async function runStream(m, request, { onPartial, t, timeoutMs, signal }) {
  let timer;
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(() => rej(new TimeoutError(timeoutMs)), timeoutMs);
  });
  let text = '';
  let source;
  let hasVerdict = false;
  const work = (async () => {
    const { stream } = await m.generateContentStream(request, signal ? { signal } : undefined);
    for await (const chunk of stream) {
      t.mark('firstToken');
      source ??= chunk.inferenceSource;
      try {
        text += chunk.text();
      } catch {
        /* empty/blocked chunk */
      }
      const partial = parsePartialJson(text);
      if (partial && VERDICTS.includes(partial.verdict)) {
        hasVerdict = true;
        t.mark('verdict');
        onPartial?.(partial, source);
      }
    }
    return { text, source };
  })();
  try {
    return await Promise.race([work, timeout]);
  } catch (e) {
    // Stalled after the verdict arrived: keep what we have rather than failing the check.
    if (e.name === 'TimeoutError' && hasVerdict) {
      t.mark('stalled');
      return { text, source, partial: true };
    }
    throw e;
  } finally {
    clearTimeout(timer);
    work.catch(() => {}); // a timed-out stream may still reject later
  }
}

/* ---------------- Public API ---------------- */

/**
 * Scans an email.
 * opts: { allowCloud, onRecon, onPartial, onRoute, signal }
 * Returns { result, source, redactedCount, recon, timings, note } where source is
 * 'on_device' | 'in_cloud' | 'recon_only'.
 */
export async function scanEmail(email, opts = {}) {
  const { allowCloud = true, onRecon, onPartial, onRoute, signal } = opts;
  const t = timer();

  // 1. Recon on the full email (instant first answer).
  const recon = runRecon(email);
  t.mark('recon');
  onRecon?.(recon);

  // 2. Shrink the input.
  const prepared = prepareEmail(email, { maxBody: cfg('max_body_chars'), maxLinks: cfg('max_links') });
  t.mark('prep');

  const avail = await deviceAvailability('text');
  t.mark('availability');
  const version = cfg('prompt_version');
  const timeoutMs = cfg('ondevice_timeout_ms');
  const stats = { inChars: 0, trimmedChars: prepared.trimmedChars, availability: avail };

  const finish = (text, source, redactedCount, note) => {
    t.mark('total');
    const result = normalizeResult(parseFinalJson(text));
    const timings = { ...t.marks, ...stats, outChars: text.length, source };
    logTimings(`scan (${source})`, timings);
    return { result, source, redactedCount, recon, timings, note };
  };

  const cloudCall = async (note) => {
    const { email: safe, count } = redactEmail(prepared);
    const prompt = scanPrompt(safe, recon.map((f) => ({ ...f, detail: redact(f.detail).text })), version);
    stats.inChars = prompt.length;
    onRoute?.({ source: InferenceSource.IN_CLOUD, redactedCount: count, note });
    // PREFER_ON_DEVICE on purpose: the text is already redacted, so either route is private.
    const m = avail === 'available' ? model('text', InferenceMode.ONLY_IN_CLOUD) : model('text', InferenceMode.PREFER_ON_DEVICE);
    const { text, source } = await runStream(m, prompt, { onPartial, t, timeoutMs: 30000, signal });
    return finish(text, source ?? InferenceSource.IN_CLOUD, count, note);
  };

  if (avail === 'available') {
    const prompt = scanPrompt(prepared, recon, version);
    stats.inChars = prompt.length;
    onRoute?.({ source: InferenceSource.ON_DEVICE, redactedCount: 0 });
    try {
      const { text } = await runStream(model('text', InferenceMode.ONLY_ON_DEVICE), prompt, { onPartial, t, timeoutMs, signal });
      return finish(text, InferenceSource.ON_DEVICE, 0);
    } catch (e) {
      if (signal?.aborted) throw e;
      if (!allowCloud) throw e;
      console.warn('[Scamouflage] On-device scan failed, retrying in the cloud (redacted):', e.message);
      return cloudCall(e.name === 'TimeoutError' ? 'slow' : 'failed');
    }
  }

  if (!allowCloud) {
    // Privacy-max mode without Nano: be honest and give the recon answer only.
    t.mark('total');
    return { result: null, source: 'recon_only', redactedCount: 0, recon, timings: { ...t.marks, ...stats } };
  }
  return cloudCall(avail === 'unavailable' ? 'no_device' : 'downloading');
}

/** Cloud second opinion on a redacted copy (used for low-confidence / suspicious verdicts). */
export async function secondOpinion(email, recon, { onPartial } = {}) {
  const t = timer();
  const prepared = prepareEmail(email, { maxBody: cfg('max_body_chars') * 2, maxLinks: cfg('max_links') });
  const { email: safe, count } = redactEmail(prepared);
  const prompt = scanPrompt(safe, recon, 'v2-cautious');
  const { text } = await runStream(model('text', InferenceMode.ONLY_IN_CLOUD), prompt, { onPartial, t, timeoutMs: 30000 });
  t.mark('total');
  logTimings('second opinion (in_cloud)', t.marks);
  return { result: normalizeResult(parseFinalJson(text)), source: InferenceSource.IN_CLOUD, redactedCount: count };
}

/**
 * Scans a screenshot (JPEG/PNG) of a text message, DM, etc. Multimodal on-device when
 * available. Images can't be redacted, so cloud is used only if the user allows it.
 */
export async function scanImage(base64, mimeType, opts = {}) {
  const { allowCloud = true, onPartial, onRoute } = opts;
  const t = timer();
  const avail = await deviceAvailability('image');
  const onDevice = avail === 'available';
  if (!onDevice && !allowCloud) {
    const err = new Error('Screenshot checks need the on-device model or cloud help turned on.');
    err.code = 'needs_cloud';
    throw err;
  }
  onRoute?.({ source: onDevice ? InferenceSource.ON_DEVICE : InferenceSource.IN_CLOUD, redactedCount: 0, image: true });
  const m = model('image', onDevice ? InferenceMode.ONLY_ON_DEVICE : InferenceMode.ONLY_IN_CLOUD);
  const request = [imagePrompt(cfg('prompt_version')), { inlineData: { data: base64, mimeType } }];
  const { text, source } = await runStream(m, request, { onPartial, t, timeoutMs: onDevice ? 45000 : 30000 });
  t.mark('total');
  logTimings(`image scan (${source})`, t.marks);
  return { result: normalizeResult(parseFinalJson(text)), source: source ?? (onDevice ? 'on_device' : 'in_cloud'), redactedCount: 0, recon: [] };
}

/* ---------------- Debrief (cloud chat) ---------------- */

let debriefModel;
function getDebriefModel() {
  debriefModel ??= getGenerativeModel(ai, {
    model: cfg('cloud_model'),
    systemInstruction:
      'You are Scamouflage Debrief, a calm, kind scam-safety coach. Readers may be older or ' +
      'non-technical and may be scared or embarrassed: never blame them. Use short sentences, ' +
      'no jargon, and numbered concrete steps. Personal details were replaced with placeholders ' +
      'like [email] or [phone]; never ask for them. Never tell the reader to click links or call ' +
      'numbers from a suspicious message; point them to the official website, app, or the number ' +
      'on the back of their card instead. If they already paid, clicked, or shared a password or ' +
      'code, give recovery steps in priority order (bank/card issuer first, change passwords, ' +
      'turn on 2-step verification, report to the FTC at ReportFraud.ftc.gov and the FBI at ic3.gov). ' +
      'Keep answers under 110 words unless asked for more.',
  });
  return debriefModel;
}

/** Starts a cloud debrief chat about a (redacted) email and its verdict. */
export function startDebrief(email, verdict) {
  const prepared = email.image ? null : prepareEmail(email, { maxBody: cfg('max_body_chars') * 2, maxLinks: cfg('max_links') });
  const { email: safe, count } = prepared ? redactEmail(prepared) : { email: null, count: 0 };
  const chat = getDebriefModel().startChat();
  const context = safe
    ? `Here is a message the reader received (personal details redacted):\n\n${formatEmail(safe)}`
    : 'The reader checked a screenshot of a message (not shared here).';
  const verdictLine = `Scanner verdict: ${verdict.verdict} (${verdict.confidence}% sure). ${verdict.why}`;
  const opening = `${context}\n\n${verdictLine}\n\nIn 3 short parts: 1) is it real or a scam, in one sentence; 2) how the trick works; 3) what to do now, as 2-3 numbered steps.`;
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
