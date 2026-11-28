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
import { runRecon, runTrust } from './core/recon.js';
import { calibrate, calibratePartial } from './core/calibrate.js';
import { redact, redactEmail } from './core/redact.js';
import { VERDICT_SCHEMA, scanPrompt, imagePrompt, formatEmail, normalizeResult, DEFAULT_PROMPT_VERSION } from './core/prompt.js';
import { parsePartialJson, parseFinalJson } from './core/partial-json.js';
import { timer, logTimings } from './perf.js';

const TEXT_IO = [{ type: 'text', languages: ['en'] }];
// Text-only sessions: no image encoder needed, and availability doesn't depend on the
// multimodal flag. (The SDK's default declares image input for every session.)
const TEXT_CREATE = { expectedInputs: TEXT_IO, expectedOutputs: TEXT_IO };
const IMAGE_CREATE = { expectedInputs: [...TEXT_IO, { type: 'image' }], expectedOutputs: TEXT_IO };
const VERDICTS = ['scam', 'suspicious', 'safe'];
// If Gemini Nano hasn't finished loading yet (it can take 20+ s after Chrome starts), a
// user-requested check races redacted cloud help almost at once instead of waiting hedge_ms.
const COLD_HEDGE_MS = 300;

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
let warming = null;
let warmed = false; // true once a prompt has finished, i.e. the weights are in memory
let imageWarm = null;
/**
 * Loads Gemini Nano into memory so the first real check doesn't pay the cold start.
 * Creating a session alone doesn't load the weights; a one-word prompt does. We keep that
 * session alive so the model stays resident while the panel is open. Called when the panel
 * opens (so a first-time user's model warms up while they read onboarding) and after the
 * model finishes downloading.
 */
export function warmUp() {
  // One attempt at a time: if Chrome's model service is stuck, don't pile up pending creates.
  warming ??= (async () => {
    if (warmSession || (await deviceAvailability()) !== 'available') return null;
    const t0 = performance.now();
    try {
      warmSession = await self.LanguageModel.create(TEXT_CREATE);
      const created = Math.round(performance.now() - t0);
      await warmSession.prompt('Reply with one word: ready');
      warmed = true;
      logTimings('warm-up', { createMs: created, firstPromptMs: Math.round(performance.now() - t0) - created });
      return Math.round(performance.now() - t0);
    } catch {
      warmSession = null;
      return null;
    } finally {
      warming = null;
    }
  })();
  return warming;
}

/** True once Gemini Nano is loaded and answering (the first check will be fast). */
export const isWarm = () => warmed;

/**
 * Screenshot checks use a multimodal session, which loads the image encoder on first use.
 * Called when the Screenshot tab opens so a dropped image doesn't pay that cost.
 */
export function warmUpImage() {
  imageWarm ??= (async () => {
    if ((await deviceAvailability('image')) !== 'available') return (imageWarm = null);
    try {
      const s = await self.LanguageModel.create(IMAGE_CREATE);
      await s.prompt('Reply with one word: ready');
      return s;
    } catch {
      return (imageWarm = null);
    }
  })();
  return imageWarm;
}

/** One quiet retry for a dropped connection (not for real errors like App Check or quota). */
async function retryNet(fn, signal) {
  try {
    return await fn();
  } catch (e) {
    const msg = String(e?.message || e);
    if (signal?.aborted || navigator.onLine === false || !/failed to fetch|network ?error|load failed/i.test(msg)) throw e;
    await new Promise((r) => setTimeout(r, 400));
    return fn();
  }
}

/* ---------------- Streaming core ---------------- */

class TimeoutError extends Error {
  constructor(stage, ms) {
    super(`On-device check: no ${stage === 'start' ? 'answer started' : 'progress'} for ${Math.round(ms / 1000)}s`);
    this.name = 'TimeoutError';
    this.stage = stage;
  }
}

/**
 * Streams a structured answer. Timeouts are activity-based, not a flat total:
 *  - firstTokenMs: how long to wait for the model to start (a cold Gemini Nano can take a while
 *    to load after Chrome starts);
 *  - idleMs: once it's writing, how long it may go quiet before we call it stalled.
 * If the verdict already streamed in, a stall keeps the partial answer instead of failing.
 */
async function runStream(m, request, { onPartial, t, firstTokenMs = 60000, idleMs = 15000, signal }) {
  let timer;
  let fail;
  const timeout = new Promise((_, rej) => {
    fail = rej;
  });
  const arm = (stage, ms) => {
    clearTimeout(timer);
    timer = setTimeout(() => fail(new TimeoutError(stage, ms)), ms);
  };
  arm('start', firstTokenMs);
  let text = '';
  let source;
  let hasVerdict = false;
  const work = (async () => {
    const { stream } = await m.generateContentStream(request, signal ? { signal } : undefined);
    for await (const chunk of stream) {
      t.mark('firstToken');
      arm('stall', idleMs);
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

/** Remote Config still says "v2" for older installs; 1.2+ treats the old default as "current default",
 *  so a stale server value can't switch the sender-aware rubric off. Other values (v2-cautious…) pass through. */
function promptVersion() {
  const v = cfg('prompt_version');
  return !v || v === 'v2' ? DEFAULT_PROMPT_VERSION : v;
}

/**
 * Scans an email.
 * opts: { allowCloud, onRecon, onPartial, onRoute, onRetry, onSlow, signal }
 * Returns { result, source, redactedCount, recon, timings, note } where source is
 * 'on_device' | 'in_cloud' | 'recon_only'.
 */
export async function scanEmail(email, opts = {}) {
  const { allowCloud = true, onRecon, onRoute, onRetry, onSlow, signal } = opts;
  const t = timer();

  // 1. Recon on the full email (instant first answer), plus reassuring signs about the sender.
  const recon = runRecon(email);
  const trust = runTrust(email, recon);
  t.mark('recon');
  onRecon?.(recon);
  // What streams to the screen is calibrated the same way as the final answer, so a trusted
  // sender's notice never flashes "Scam" first.
  const onPartial = opts.onPartial && ((p, src) => opts.onPartial(calibratePartial(p, trust, email), src));

  // 2. Shrink the input.
  const prepared = prepareEmail(email, { maxBody: cfg('max_body_chars'), maxLinks: cfg('max_links') });
  t.mark('prep');

  const avail = await deviceAvailability('text');
  t.mark('availability');
  const version = promptVersion();
  const firstTokenMs = cfg('ondevice_timeout_ms');
  const stats = { inChars: 0, trimmedChars: prepared.trimmedChars, availability: avail };

  const finish = (text, source, redactedCount, note) => {
    t.mark('total');
    const raw = normalizeResult(parseFinalJson(text));
    const result = calibrate(raw, trust, email);
    const timings = { ...t.marks, ...stats, outChars: text.length, source };
    logTimings(`scan (${source})`, timings);
    if (result.adjusted) console.info(`[Scamouflage] Calibrated ${result.adjusted.from} → ${result.verdict}: ${trust.reasons.join('; ')}`);
    return { result, source, redactedCount, recon, trust, timings, note };
  };

  const cloudCall = async (note, { partial = onPartial, route = onRoute, abort = signal } = {}) => {
    const { email: safe, count } = redactEmail(prepared);
    const prompt = scanPrompt(safe, recon.map((f) => ({ ...f, detail: redact(f.detail).text })), version, trust);
    stats.inChars ||= prompt.length;
    route?.({ source: InferenceSource.IN_CLOUD, redactedCount: count, note });
    // PREFER_ON_DEVICE on purpose: the text is already redacted, so either route is private.
    const m = avail === 'available' ? model('text', InferenceMode.ONLY_IN_CLOUD) : model('text', InferenceMode.PREFER_ON_DEVICE);
    const { text, source } = await retryNet(() => runStream(m, prompt, { onPartial: partial, t, firstTokenMs: 30000, signal: abort }), abort);
    return finish(text, source ?? InferenceSource.IN_CLOUD, count, note);
  };

  if (avail === 'available') {
    const prompt = scanPrompt(prepared, recon, version, trust);
    stats.inChars = prompt.length;
    onRoute?.({ source: InferenceSource.ON_DEVICE, redactedCount: 0 });

    // The first route to stream a verdict "owns" the screen; the other one's output is ignored.
    let winner = null;
    let onClaim;
    const claimed = new Promise((res) => (onClaim = res));
    let cloudRoute = null;
    const hedgeAbort = new AbortController();
    signal?.addEventListener('abort', () => hedgeAbort.abort());
    const claim = (who) => (p, src) => {
      if (!winner) {
        winner = who;
        if (who === 'cloud') onRoute?.(cloudRoute);
        else hedgeAbort.abort(); // on-device won: stop the backup cloud request
        onClaim(who);
      }
      if (winner === who) onPartial?.(p, src);
    };

    let hedge = null;
    const run = () => runStream(model('text', InferenceMode.ONLY_ON_DEVICE), prompt, { onPartial: claim('device'), t, firstTokenMs, signal });
    const device = (async () => {
      try {
        return await run();
      } catch (e) {
        // One quiet retry (cold start / stuck session), unless cloud help is already covering.
        if (e.name !== 'TimeoutError' || signal?.aborted || hedge) throw e;
        console.warn('[Scamouflage] On-device check timed out; retrying once:', e.message);
        onRetry?.();
        return run();
      }
    })();

    // Slow start (usually a cold model right after Chrome launches). For a check the user
    // asked for, with cloud help on, race a redacted cloud request so they aren't left waiting.
    // Automatic checks stay on-device and just explain the wait.
    let startHedge;
    const hedgeStarted = new Promise((res) => (startHedge = res));
    const slowTimer = setTimeout(() => {
      if (winner || t.marks.firstToken != null) return;
      onSlow?.({ hedging: allowCloud });
      if (!allowCloud) return;
      t.mark('hedge');
      hedge = cloudCall('warming', {
        abort: hedgeAbort.signal,
        partial: claim('cloud'),
        route: (r) => {
          cloudRoute = r;
        },
      });
      hedge.catch(() => {}); // an aborted/failed backup is fine; the race handles outcomes
      startHedge();
    }, warmed ? cfg('hedge_ms') : Math.min(cfg('hedge_ms'), COLD_HEDGE_MS));

    try {
      const out = await (async () => {
        const never = new Promise(() => {});
        const deviceDone = device.then((o) => ({ who: 'device', o }), (e) => ({ who: 'device', e }));
        let cloudDone = null;
        let cloudFailed = false;
        for (;;) {
          const ev = await Promise.race([
            claimed.then((who) => ({ claim: who })),
            deviceDone,
            cloudDone || (cloudFailed ? never : hedgeStarted.then(() => ({ hedge: true }))),
          ]);
          if (ev.hedge) {
            cloudDone = hedge.then((o) => ({ who: 'cloud', o }), (e) => ({ who: 'cloud', e }));
            continue;
          }
          if (ev.claim === 'device') return { who: 'device', o: await device };
          if (ev.claim === 'cloud') return { who: 'cloud', o: await hedge };
          if (ev.o) return ev; // finished before streaming a verdict (rare)
          if (ev.who === 'device') {
            if (cloudDone) {
              const c = await cloudDone;
              if (c.o) return c;
            }
            throw ev.e;
          }
          // The cloud race failed before claiming: ignore it and keep waiting for the device.
          cloudDone = null;
          cloudFailed = true;
        }
      })();
      if (out.who === 'cloud') return out.o; // already finished (redacted, labelled 'warming')
      warmed = true;
      return finish(out.o.text, InferenceSource.ON_DEVICE, 0);
    } catch (e) {
      if (signal?.aborted || hedge) throw e;
      if (!allowCloud) throw e;
      console.warn('[Scamouflage] On-device scan failed, retrying in the cloud (redacted):', e.message);
      return cloudCall(e.name === 'TimeoutError' ? 'slow' : 'failed');
    } finally {
      clearTimeout(slowTimer);
    }
  }

  if (!allowCloud) {
    // Privacy-max mode without Nano: be honest and give the recon answer only.
    t.mark('total');
    return { result: null, source: 'recon_only', redactedCount: 0, recon, trust, timings: { ...t.marks, ...stats } };
  }
  return cloudCall(avail === 'unavailable' ? 'no_device' : 'downloading');
}

/** Cloud second opinion on a redacted copy (used for low-confidence / suspicious verdicts). */
export async function secondOpinion(email, recon, { onPartial } = {}) {
  const t = timer();
  const prepared = prepareEmail(email, { maxBody: cfg('max_body_chars') * 2, maxLinks: cfg('max_links') });
  const { email: safe, count } = redactEmail(prepared);
  const prompt = scanPrompt(safe, recon, 'v2-cautious', runTrust(email, recon));
  const { text } = await runStream(model('text', InferenceMode.ONLY_IN_CLOUD), prompt, { onPartial, t, firstTokenMs: 30000 });
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
  const request = [imagePrompt(promptVersion()), { inlineData: { data: base64, mimeType } }];
  const { text, source } = await runStream(m, request, { onPartial, t, firstTokenMs: onDevice ? 60000 : 30000 });
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
  const ask = (question) =>
    `${context}\n\n${verdictLine}\n\nThe reader says: "${question}"\nAnswer them directly: one sentence on whether this is a scam, then numbered steps for exactly their situation, most urgent first.`;
  return { chat, opening, ask, redactedCount: count };
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
