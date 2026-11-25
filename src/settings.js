// User settings, persisted in chrome.storage.local (shared by the panel and the background worker).

export const DEFAULT_SETTINGS = {
  onboarded: false,
  autoScan: true, // check Gmail emails as they're opened (on-device only)
  cloudHelp: true, // allow redacted cloud requests; off = privacy-max, on-device only
  autoSecondOpinion: false, // automatically ask the cloud when on-device is unsure
  bigText: false,
  theme: 'auto', // 'auto' | 'light' | 'dark'
  contactName: '',
};

export async function getSettings() {
  try {
    const { settings } = await chrome.storage.local.get('settings');
    return { ...DEFAULT_SETTINGS, ...(settings || {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}
