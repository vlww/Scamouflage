# 🪖 Scamouflage

**Scams hide. We spot them.** Scamouflage is a Chrome extension that checks the email you have open in Gmail, or any message you paste in, for scam and phishing signs. It does the check **privately on your own computer** with Gemini Nano. The cloud is used only when it's actually needed, and only after personal details are stripped out.

Built for **#BuildHybridAI 2026** (Web/Chrome track) with **Firebase AI Logic hybrid inference**.

## Why

Phishing and impersonation scams cost people billions every year, and older adults lose the most per incident. Most scam checkers make you upload your email to someone's server, which is a privacy problem of its own. Scamouflage keeps the email on your device by default.

## How it uses hybrid inference

| Step | Where it runs | Why |
|---|---|---|
| **Recon**: deterministic checks (mismatched link text, impersonated brands, look-alike/punycode domains, bare-IP links, urgency, gift-card/crypto requests) | Locally, plain JS | Instant, no AI needed; results are passed to the model as hints |
| **Scan**: verdict `safe` / `suspicious` / `scam`, confidence, red flags, advice as **structured JSON** | `InferenceMode.PREFER_ON_DEVICE`: Gemini Nano in Chrome, cloud fallback if the on-device model isn't available | Private and free when on-device; still works on any Chrome |
| **Debrief**: multi-turn "what should I do / what if I already clicked?" chat | Cloud (`gemini-3.5-flash-lite`) | On-device doesn't support multi-turn chat; longer, richer explanations |

**Privacy rule:** whenever a request will go to the cloud (scan fallback or debrief), email addresses, phone numbers, card/account numbers, SSNs and long numbers are **redacted first** (`src/redact.js`). Every result shows a badge: **🪖 Scanned on your device** or **☁️ Scanned in the cloud (N details redacted)**, based on the SDK's `response.inferenceSource`.

Key code:
- `src/ai.js`: hybrid model setup (`getGenerativeModel` with `mode`, `onDeviceParams.promptOptions.responseConstraint` for on-device JSON, `inCloudParams.generationConfig.responseJsonSchema` for cloud JSON), `initializeDeviceModel`, debrief chat
- `src/firebase.js`: Firebase app, App Check (debug provider), AI Logic backend
- `src/recon.js`: local heuristics · `src/redact.js`: PII redaction
- `public/content.js`: reads the open Gmail message (no AI and no network calls in the page)

## Run it locally

Requirements: Chrome desktop 139+, Node 20+.

1. Turn on `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` and restart Chrome. (Optional; without it Scamouflage falls back to the cloud.)
2. Clone and install:
   ```bash
   git clone https://github.com/vlww/Scamouflage.git
   cd Scamouflage
   npm install
   cp .env.example .env.local   # then paste your App Check debug token
   npm run build                # or: npm run dev (rebuilds on save)
   ```
3. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and choose the `dist/` folder.
4. Pin Scamouflage, open an email in Gmail, click the icon, and press **Scan for scams**. Gmail tabs that were open before you installed need one reload. No Gmail? Use **Paste text → Load a sample scam**.
5. If the panel says the on-device model isn't downloaded yet, click **Deploy on-device model** once.

### Using your own Firebase project
Replace `src/firebase-config.js` with your web app config, enable **Firebase AI Logic** (Gemini Developer API), and add an App Check **debug token** (App Check → Apps → ⋮ → Manage debug tokens). reCAPTCHA can't run on `chrome-extension://` pages, so the extension uses App Check's debug provider; the hackathon rules allow debug tokens.

> The debug token is compiled into `dist/`. Never commit `.env.local`, and revoke the token in the Firebase console after judging.

## Testing for judges
A pre-built extension zip with a working debug token is linked from the Devpost submission. Unzip it and load the folder in `chrome://extensions` as described above.

## License
[Apache 2.0](LICENSE)
