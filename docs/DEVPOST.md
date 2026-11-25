# Scamouflage: Devpost draft

**Links:** [Chrome Web Store](https://chromewebstore.google.com/detail/scamouflage/bcebmomgjaikeclnakgkkbdjmihdejgm) · [Live demo](https://scamouflage-37a72.web.app) · [Source](https://github.com/vlww/Scamouflage)

**Tagline:** Scams hide. We spot them. A private, on-device scam checker for the people scammers target most.

## Inspiration

In 2025, Americans over 60 reported **$7.75 billion** in losses to the FBI's Internet Crime Complaint Center, up 59% in a year and more than any other age group, at an average of **$38,500** each ([FBI IC3 2025 report](https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf), pp. 6 and 44). Phishing was the most-reported crime of all. Many of us have a parent or grandparent who has forwarded us a "is this real?" email, or who didn't ask in time.

The tools that could help usually want you to upload your inbox to their servers. We wanted the opposite: a checker that runs **on your own computer**, explains itself in plain words, and only reaches for the cloud when it has to, with your personal details removed first.

## What it does

Scamouflage is a Chrome extension (side panel + a small badge inside Gmail).

- **Open an email in Gmail** and a shield appears next to the subject: *Checking… → Scam / Be careful / Looks safe*. The verdict is usually on screen in **under a second** on-device.
- The panel shows **one verdict, one line of why, one action**: "Scam. Asks for a fake delivery fee. Don't click, reply, or pay. Delete it."
- **Tap a warning sign to see the proof**: "Says mybank.com · Really goes to mybank-verify.top". The disguised link is highlighted in the email itself.
- **Paste** any message, or **drop a screenshot** of a text or DM. Scams aren't only email.
- **Debrief**: "I already clicked / paid / shared my password, what now?" returns concrete recovery steps in order.
- **Tell my family**: send a redacted summary to a trusted person who joined with a family code, or copy a ready-to-send text.
- Adjustable text size, dark mode, keyboard and screen-reader support, WCAG AA contrast everywhere.

## How we built it: Firebase AI Logic hybrid inference

Hybrid inference isn't decoration in Scamouflage; **the routing is the product**:

| Request | Route | Why |
|---|---|---|
| Scan, Gemini Nano ready | `InferenceMode.ONLY_ON_DEVICE`, structured output via `onDeviceParams.promptOptions.responseConstraint` | The full email never leaves the computer, and the SDK *can't* route it to the cloud. |
| Scan, Nano not ready | **Redact first**, then `PREFER_ON_DEVICE` with `inCloudParams.generationConfig.responseJsonSchema` | Works on any Chrome. Whichever way the SDK routes, only redacted text goes out. |
| Automatic check on email open | On-device only | Opening an email never sends data anywhere by itself. |
| On-device unsure | One-tap **second opinion**, `ONLY_IN_CLOUD`, redacted | The cloud helps exactly when it adds value. |
| Screenshot | On-device multimodal (`expectedInputs: [text, image]`, `inlineData`) | Images can't be redacted, so they stay local unless the user allows cloud help. |
| Debrief | Cloud chat (`startChat` + `sendMessageStream`), redacted | Multi-turn isn't available on-device. |

A route chip on every result reports the SDK's `inferenceSource` honestly: **🔒 On-device** or **☁️ Cloud · 4 hidden**.

**Making Nano fast.** We measured first. The original prototype took 7.9–9.2 s on-device. Session creation was about 1 ms; output tokens were the cost. So we cut the schema to `{ verdict, confidence, why, flags≤3 }` with the verdict first, stripped quoted replies, signatures and footers, capped the body, deduped links, used **text-only sessions** (the SDK's default asks for image input on every session), and **streamed** the response through a partial-JSON parser. Result: **verdict on screen in about 0.7–0.8 s, full result in about 2.7 s**. Local "recon" rules give an instant first answer at about 1 ms, results are cached per session, and Nano is warmed once per panel.

**Other Firebase products**
- **App Check** with a debug token (reCAPTCHA can't run on `chrome-extension://`).
- **Remote Config**: cloud model name, body cap, escalation threshold, timeout, prompt version and feature flags, all tunable without republishing.
- **Authentication** (anonymous, via `firebase/auth/web-extension` for MV3) and **Cloud Firestore Lite** for family circles, with security rules that only let members read reports, only let people add *themselves* to a circle, and validate every field of a report.

## Privacy

On-device by default. Before any cloud request we redact emails, phone numbers, card numbers (Luhn-checked), bank/IBAN/account numbers, SSNs, codes, greeting names, street addresses and URL tracking tokens, keeping only the evidence (domains, amounts, wording). Family sharing stores a summary, never the email. Nothing is sold.

## Accuracy

On an 18-message invented eval set (11 scam types, a deliberately ambiguous alert, 7 legitimate messages):

- **On-device Gemini Nano:** 16/18 exact, 17/18 scam-vs-safe, **0 missed scams**, verdict in 0.71 s (median)
- **Cloud (redacted):** 17/18 exact, 18/18 scam-vs-safe, 0 missed scams

The eval drove a prompt fix that halved on-device false alarms on genuine security notices.

## Challenges

- Chrome's on-device model occasionally stalls on session creation. Every on-device call runs under a timeout. A verdict that already streamed is kept, and otherwise we fall back to the redacted cloud (manual checks) or the recon answer (automatic checks).
- Gmail's DOM changes often: selectors have fallbacks, the badge lives in a Shadow DOM, and a mutation observer re-attaches it when Gmail re-renders.
- Writing for a frightened reader: we cut every sentence that didn't help someone decide what to do next.

## What's next

Chrome Web Store release, Outlook and Yahoo web support, a weekly "what we caught" digest for family members, and a localized UI.

## Built with

Firebase AI Logic (hybrid inference: Gemini Nano + Gemini 3.5 Flash-Lite) · App Check · Remote Config · Firebase Auth · Cloud Firestore · Chrome Prompt API · Chrome Extensions MV3 (side panel, content scripts) · Vite · Vitest · Lucide icons
