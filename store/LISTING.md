# Chrome Web Store listing: copy-paste text

Upload `store/out/scamouflage-store.zip` (built with `npm run zip`, demo mode off). Images are in `store/out/` (re-render with `store/render.sh`).

## Package → Store listing

**Description** (the summary under the name comes from manifest.json):

```
Scamouflage is a free Chrome extension that checks your emails for scams, right inside Gmail. Open an email and it tells you in plain words whether it's a scam and what to do next. Checks run privately on your own computer with Chrome's built-in AI (Gemini Nano), usually in under a second.

FEATURES
- A small shield next to the email subject in Gmail: Scam, Be careful or Looks safe
- One verdict, one reason and one next step, with no jargon
- Tap a warning sign to see the proof, such as a link that says it's your bank but really goes somewhere else
- The suspicious link is highlighted in the email itself
- Emails you've opened keep their result in your inbox list
- Paste any text message or DM, or drop in a screenshot to check it
- Step-by-step help if you already clicked a link, paid or shared a password
- A second opinion from a stronger cloud model when the on-device answer isn't sure
- Share a warning with a family member in one tap (they see a short summary, never the email)
- Every result shows whether it was checked on your computer or with cloud help
- Adjustable text size, dark mode, keyboard and screen-reader support, and high-contrast colors
- Works on any desktop Chrome, with no account needed

HOW TO USE
1. Add Scamouflage to Chrome and click its icon in the toolbar to open the side panel.
2. Follow the short setup. It downloads Chrome's on-device AI model if your computer supports it.
3. Open Gmail and open any email. The shield appears next to the subject, and the side panel explains the result.
4. To check a text or DM, use the Paste or Screenshot tab in the side panel.

PRIVACY
Your emails are checked on your own computer whenever Chrome's built-in AI is available, and automatic checks never leave your computer. If cloud help is needed, names, email addresses, phone, card and account numbers are removed before anything is sent, and you can turn cloud help off entirely in Settings. There are no ads, no tracking and no analytics, and nothing is sold. Full policy: https://scamouflage.xyz/privacy

PERMISSIONS
- Read Gmail pages: to check the email you open and show the shield next to it. Scamouflage runs on Gmail only.
- Side panel: to show results and explanations next to your email.
- Storage: to save your settings and remember emails already checked during your browser session.

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
