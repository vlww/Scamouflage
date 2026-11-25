// Background service worker.
//  - Opens the side panel from the toolbar icon or the in-Gmail badge.
//  - When an email opens in Gmail: answers instantly from the session cache, or runs local
//    recon (≈1 ms, no AI, no network) so the badge shows something even with the panel closed.
//    The AI check itself runs in the side panel, where Gemini Nano stays warm.

import { runRecon, reconVerdict } from './core/recon.js';
import { showVerdict, getCached } from './badge.js';

const panelOnClick = () => chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
chrome.runtime.onInstalled.addListener(panelOnClick);
chrome.runtime.onStartup.addListener(panelOnClick);

chrome.runtime.onMessage.addListener((msg, sender) => {
  const tabId = sender.tab?.id;
  if (msg?.type === 'SCAMO_OPEN_PANEL' && tabId != null) {
    // Must run synchronously inside the click's user gesture.
    chrome.sidePanel.open({ tabId }).catch(() => {});
    return;
  }
  if (msg?.type === 'SCAMO_EMAIL_OPENED' && tabId != null) {
    (async () => {
      const cached = await getCached(msg.key);
      if (cached) {
        showVerdict(tabId, msg.key, 3, { phase: 'done', verdict: cached.result.verdict, source: cached.source });
        return;
      }
      const recon = runRecon(msg.email);
      const { verdict } = reconVerdict(recon);
      showVerdict(tabId, msg.key, 1, { phase: 'recon', verdict, warnings: recon.length });
    })();
    return;
  }
  if (msg?.type === 'SCAMO_EMAIL_CLOSED' && tabId != null) {
    chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
    chrome.action.setTitle({ tabId, title: 'Open Scamouflage' }).catch(() => {});
  }
});
