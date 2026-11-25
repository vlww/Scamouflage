// Scamouflage content script for Gmail.
// Its only job is to read the currently open email out of the page and hand it to the
// side panel. No AI runs here, and nothing is sent anywhere from this script.

(() => {
  const MAX_LINKS = 40;

  function visible(el) {
    return !!el && el.offsetParent !== null;
  }

  function extractEmail() {
    const subject = [...document.querySelectorAll('h2.hP')].find(visible)?.innerText.trim() || '';

    // A thread can hold several messages; the last expanded one is what the user is reading.
    const messages = [...document.querySelectorAll('div.adn.ads')].filter(visible);
    const msg = messages[messages.length - 1];
    if (!msg) return null;

    const senderEl = msg.querySelector('span.gD');
    const bodyEl = msg.querySelector('div.a3s');
    if (!bodyEl) return null;

    const links = [...bodyEl.querySelectorAll('a[href]')]
      .slice(0, MAX_LINKS)
      .map((a) => ({ text: a.innerText.trim().slice(0, 160), href: a.href }))
      .filter((l) => /^https?:/i.test(l.href));

    return {
      source: 'gmail',
      subject,
      fromName: senderEl?.getAttribute('name') || senderEl?.innerText.trim() || '',
      fromEmail: senderEl?.getAttribute('email') || '',
      body: bodyEl.innerText.trim(),
      links,
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'SCAMO_GET_EMAIL') {
      sendResponse({ email: extractEmail() });
    }
  });

  // Gmail is a single-page app: tell the panel when the user opens a different email.
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      chrome.runtime.sendMessage({ type: 'SCAMO_EMAIL_CHANGED' }).catch(() => {});
    }
  }, 800);
})();
