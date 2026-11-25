import { initializeApp } from 'firebase/app';
import { initializeAppCheck, CustomProvider } from 'firebase/app-check';
import { getAI, GoogleAIBackend } from 'firebase/ai';
import { firebaseConfig } from './firebase-config.js';

// App Check is required by Firebase AI Logic. reCAPTCHA can't run on chrome-extension://
// pages, so the extension uses an App Check *debug token* (accepted for hackathon submissions).
// The token lives in .env.local (gitignored) and is baked in at build time.
const debugToken = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
if (debugToken) {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
} else {
  console.warn(
    '[Scamouflage] No VITE_APPCHECK_DEBUG_TOKEN set. Cloud requests will fail App Check. See README.'
  );
}

export const app = initializeApp(firebaseConfig);

// In debug mode App Check exchanges the debug token and never calls this provider.
initializeAppCheck(app, {
  provider: new CustomProvider({
    getToken: () =>
      Promise.reject(new Error('No production attestation provider for extensions; use a debug token.')),
  }),
  isTokenAutoRefreshEnabled: true,
});

export const ai = getAI(app, { backend: new GoogleAIBackend() });
