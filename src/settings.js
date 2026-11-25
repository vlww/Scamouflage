// User settings, persisted in chrome.storage.local (shared by the panel and the background worker).
import { IS_WEB } from './env.js';

// Demo mode (sample messages) is on for the web demo and for the judging build (npm run zip:judge).
const DEMO_DEFAULT = IS_WEB || import.meta.env.VITE_DEMO_DEFAULT === '1';

export const DEFAULT_SETTINGS = {
  onboarded: IS_WEB, // the web demo skips onboarding: visitors want to try it right away
  autoScan: true, // check Gmail emails as they're opened (on-device only)
  inboxBadges: true, // show full-check verdicts next to already-opened emails in the inbox list
  cloudHelp: true, // allow redacted cloud requests; off = privacy-max, on-device only
  autoSecondOpinion: false, // automatically ask the cloud when on-device is unsure
  textSize: 1, // index into TEXT_SIZES
  theme: 'auto', // 'auto' | 'light' | 'dark'
  demoMode: DEMO_DEFAULT, // show built-in sample messages
  myName: '', // your first name, shown to family on shared warnings
};

export const TEXT_SIZES = [
  { label: 'Small', px: 14 },
  { label: 'Default', px: 15 },
  { label: 'Large', px: 17 },
  { label: 'Larger', px: 19 },
  { label: 'Largest', px: 21 },
];

export async function getSettings() {
  try {
    const { settings } = await chrome.storage.local.get('settings');
    const s = { ...DEFAULT_SETTINGS, ...(settings || {}) };
    // Migrate the old on/off large-text switch.
    if (settings && 'bigText' in settings && !('textSize' in settings)) s.textSize = settings.bigText ? 3 : 1;
    delete s.bigText;
    delete s.contactName;
    return s;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}
