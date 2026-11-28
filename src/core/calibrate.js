// Calibration: a deterministic check on the model's verdict, using the local reassuring signs.
//
// Gemini Nano is small and tends to call any "action required" notice a scam (an expiring API
// key, a password reset you asked for, a renewal reminder) because those read like phishing. But
// phishing has to send you somewhere else, or ask for money, codes or a call, to work. When the
// local checks find the sender's own domain, links that stay on it and no hard warning signs
// (see runTrust), a "scam" based only on soft reasons is corrected. Pure module, shared by the
// extension and the eval.

// Concrete asks the model may spot that the regex checks can miss. If the model names one of
// these, a trusted sender is capped at "Be careful?" rather than cleared.
const CONCRETE = new Set(['payment_request', 'secrecy', 'call_now', 'too_good_to_be_true', 'attachment']);
// Nano sometimes invents a concrete reason ("payment request: implies you must create a new key").
// A concrete flag only counts if the email itself contains something that could back it up.
const EVIDENCE = {
  payment_request: /[$€£]\s?\d|\b(pay|payment|paid|fee|invoice|wire|transfer|gift ?cards?|bitcoin|crypto|card number|bank account|zelle|venmo|cash app|western union|money|refund)\b/i,
  call_now: /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}|\bcall\b/i,
  secrecy: /\b(secret|confidential|between us|don'?t tell|do not tell|keep (this|it) (quiet|private))\b/i,
  too_good_to_be_true: /\b(won|winner|prize|reward|lottery|inheritance|guaranteed|bonus|selected|free gift)\b/i,
  attachment: /\b(attach(ed|ment)s?|download)\b|\.(zip|html?|exe|iso|scr|js|lnk)\b/i,
};
function concreteFlag(flags = [], email) {
  const text = email ? `${email.subject || ''}\n${email.body || ''}` : null;
  return flags.some((f) => CONCRETE.has(f?.type) && (text == null || EVIDENCE[f.type].test(text)));
}

function trustWhy(trust) {
  return `Sent from the real ${trust.senderBase}, and its links stay there.`;
}

/** Final result → calibrated result (adds `adjusted: { from }` when it changed anything). */
export function calibrate(result, trust, email) {
  if (!result || !trust?.trusted || result.verdict === 'safe') return result;
  const concrete = concreteFlag(result.flags, email);
  if (concrete) {
    if (result.verdict !== 'scam') return result;
    return { ...result, verdict: 'suspicious', confidence: Math.min(result.confidence, 60), adjusted: { from: 'scam' } };
  }
  return {
    verdict: 'safe',
    confidence: 75, // the model disagreed, so not "very sure"; still well above the second-opinion bar
    why: trustWhy(trust),
    flags: [],
    adjusted: { from: result.verdict },
  };
}

/** Streaming partial → what to show while the answer is still coming in (verdict streams first). */
export function calibratePartial(partial, trust, email) {
  if (!partial?.verdict || !trust?.trusted || partial.verdict === 'safe') return partial;
  // Flags stream last; until a concrete one appears, show the trusted reading.
  const concrete = concreteFlag(partial.flags, email);
  if (concrete) return partial.verdict === 'scam' ? { ...partial, verdict: 'suspicious' } : partial;
  return { ...partial, verdict: 'safe', why: trustWhy(trust), flags: [] };
}
