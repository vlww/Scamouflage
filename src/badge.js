// Verdict indicators outside the panel (in-Gmail shield badge + toolbar badge), and the
// per-session result cache. Used by both the background worker and the side panel.
//
// Ranks stop a slow, weaker signal from overwriting a stronger one:
//   1 = recon (instant, heuristic) · 2 = AI checking · 3 = final verdict

const TOOLBAR = {
  scam: { text: '!', color: '#A3211A', title: 'Scamouflage: Scam' },
  suspicious: { text: '?', color: '#8A5A00', title: 'Scamouflage: Be careful' },
  safe: { text: '✓', color: '#2B6A29', title: 'Scamouflage: Looks safe' },
  checking: { text: '…', color: '#485A2C', title: 'Scamouflage: Checking…' },
};

/**
 * state: { phase: 'recon' | 'checking' | 'done' | 'clear', verdict?, source?, warnings? }
 */
export async function showVerdict(tabId, key, rank, state) {
  if (tabId == null || tabId < 0) return;
  chrome.tabs.sendMessage(tabId, { type: 'SCAMO_BADGE', key, rank, state }).catch(() => {});

  let t = null;
  if (state.phase === 'done') t = TOOLBAR[state.verdict];
  else if (state.phase === 'checking') t = TOOLBAR.checking;
  // Recon is a heuristic first look: never put it on the toolbar as if it were a verdict.
  try {
    await chrome.action.setBadgeText({ tabId, text: t ? t.text : '' });
    if (t) {
      await chrome.action.setBadgeBackgroundColor({ tabId, color: t.color });
      await chrome.action.setBadgeTextColor?.({ tabId, color: '#FFFFFF' });
    }
    await chrome.action.setTitle({ tabId, title: t ? t.title : 'Open Scamouflage' });
  } catch {
    /* tab closed */
  }
}

const PREFIX = 'r:';
const MAX_ENTRIES = 200;

export async function getCached(key) {
  if (!key) return null;
  try {
    const got = await chrome.storage.session.get(PREFIX + key);
    return got[PREFIX + key] || null;
  } catch {
    return null;
  }
}

export async function setCached(key, entry) {
  if (!key) return;
  try {
    await chrome.storage.session.set({ [PREFIX + key]: { ...entry, at: Date.now() } });
    // Keep the cache bounded.
    const all = await chrome.storage.session.get(null);
    const keys = Object.keys(all).filter((k) => k.startsWith(PREFIX));
    if (keys.length > MAX_ENTRIES) {
      keys.sort((a, b) => all[a].at - all[b].at);
      await chrome.storage.session.remove(keys.slice(0, keys.length - MAX_ENTRIES));
    }
  } catch {
    /* storage unavailable */
  }
}
