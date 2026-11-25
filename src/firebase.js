import { initializeApp } from 'firebase/app';
import { initializeAppCheck, CustomProvider, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAI, GoogleAIBackend } from 'firebase/ai';
import { firebaseConfig } from './firebase-config.js';
import { IS_WEB } from './env.js';

// App Check is required by Firebase AI Logic.
//  - Extension: reCAPTCHA can't run on chrome-extension:// pages, so it uses an App Check
//    *debug token* (accepted for hackathon submissions). It lives in .env.local (gitignored)
//    and is baked in at build time.
//  - Web demo: real attestation with reCAPTCHA v3. The debug token is never included in the
//    web build (vite.web.config.js blanks it, and the deploy script checks the output).
let provider;
if (IS_WEB) {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  provider = siteKey
    ? new ReCaptchaV3Provider(siteKey)
    : new CustomProvider({ getToken: () => Promise.reject(new Error('App Check: no reCAPTCHA site key configured')) });
} else {
  const debugToken = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
  if (debugToken) self.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
  else console.warn('[Scamouflage] No VITE_APPCHECK_DEBUG_TOKEN set. Cloud requests will fail App Check. See README.');
  // In debug mode App Check exchanges the debug token and never calls this provider.
  provider = new CustomProvider({
    getToken: () => Promise.reject(new Error('No production attestation provider for extensions; use a debug token.')),
  });
}

export const app = initializeApp(firebaseConfig);
initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
export const ai = getAI(app, { backend: new GoogleAIBackend() });
