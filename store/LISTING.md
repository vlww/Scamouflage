# Chrome Web Store listing: copy-paste text

Upload `store/out/scamouflage-store.zip` (built with `npm run zip`, demo mode off). Images are in `store/out/` (re-render with `store/render.sh`).

## Package → Store listing

**Description** (the summary under the name comes from manifest.json):

```
Scamouflage tells you in plain words whether an email or message is a scam, and what to do next. It checks privately on your own computer with Chrome's built-in AI (Gemini Nano).

OPEN AN EMAIL, GET AN ANSWER
Open an email in Gmail and a small shield appears next to the subject: Scam, Be careful or Looks safe. Usually in under a second, and automatic checks never leave your computer.

ONE VERDICT, ONE REASON, ONE THING TO DO
No jargon. "Scam. Asks for a fake delivery fee. Don't click, reply, or pay. Delete it." Tap a warning sign to see the proof, like a link that says your bank but really goes somewhere else. The link is highlighted in the email itself.

TEXTS AND SCREENSHOTS TOO
Paste any message, or drop in a screenshot of a text or DM.

"I ALREADY CLICKED"
Get calm, step-by-step help if you already clicked, paid or shared a password.

TELL YOUR FAMILY
Share a warning with someone you trust in one tap. Only a short summary is shared, never the message.

PRIVATE BY DEFAULT
• Checks run on your computer whenever Chrome's built-in AI is available.
• If cloud help is needed, names, email addresses, phone, card and account numbers are removed first. You always see which one ran.
• Turn cloud help off and Scamouflage works on your computer only.
• No ads, no tracking, nothing sold.

EASY TO READ
Adjustable text size, dark mode, keyboard and screen-reader support, and high-contrast colors throughout.

Built with Firebase AI Logic hybrid inference. Open source (Apache-2.0): https://github.com/vlww/Scamouflage
```

- **Category:** Productivity (or "Privacy & Security" / "Tools" if listed)
- **Language:** English
- **Store icon:** `public/icons/icon128.png`
- **Screenshots (1280×800):** `store/out/screenshot-1.png` … `screenshot-4.png`, in order
- **Small promo tile (440×280):** `store/out/promo-small.png`
- **Marquee promo tile (1400×560):** `store/out/promo-marquee.png`
- **Official URL:** leave empty (needs Search Console verification), or set later
- **Homepage URL:** https://scamouflage-37a72.web.app (switch to https://scamouflage.xyz once it's connected)
- **Support URL:** https://github.com/vlww/Scamouflage/issues
- **Mature content:** No

## Privacy practices

**Single purpose:**
```
Scamouflage checks emails and messages for scams and phishing, and explains in plain words what to do next.
```

**Permission justifications:**

- **sidePanel**
  ```
  Scamouflage's interface (scam verdicts, explanations, settings and family sharing) is shown in Chrome's side panel next to the email being read.
  ```
- **storage**
  ```
  Saves the user's settings (text size, theme, cloud help on/off) and caches the results of recent checks for the current browser session, so an email that was already checked isn't checked again.
  ```
- **Host permission (https://mail.google.com/*)**
  ```
  Needed to read the email the user opens in Gmail (sender, subject, text and links) so it can be checked for scams, and to show the verdict badge next to that email. The extension runs on Gmail only.
  ```
- **Remote code:** No, I am not using remote code. (All code is bundled in the package. Network requests are API calls to Firebase and Google's Gemini API, not code.)

**Data usage: check these:**
- [x] Personal communications (the email or message being checked)
- [x] Website content (the Gmail page content being checked)
- [x] Personally identifiable information (the first name a user types in for family sharing)
- Leave all other categories unchecked (no health, financial, authentication, location, web history or user activity tracking).

**Certify all three:**
- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://scamouflage-37a72.web.app/privacy

## Distribution

- **Payments:** Free
- **Visibility:** Unlisted (switch to Public after judging; no new review needed)
- **Regions:** All regions

## Notes for the reviewer (Test instructions tab, if shown)

```
No account or login is needed. Open any email in Gmail and click the Scamouflage toolbar icon to open the side panel; the email is checked automatically. To test without a Gmail account, use the Paste tab in the side panel and paste any message. On-device checks need Chrome's built-in AI (Gemini Nano); without it, checks use Google's Gemini API through Firebase after personal details are removed.
```
