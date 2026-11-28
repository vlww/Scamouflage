# Demo video script (target 2:55, hard limit 3:00)

The video follows a normal morning of email: a few scams, a few genuine messages. Every feature shows up because the situation calls for it, so it plays like a product, not a feature list. Each technical claim is shown happening on screen, not just stated.

## What each judging criterion sees

| Criterion | Where the video proves it |
|---|---|
| **Technological implementation** | 1:05–1:45: the architecture diagram, `ONLY_ON_DEVICE` named on screen, Wi-Fi off and it still works, then Nano switched off and the redacted cloud route with "N hidden". The route chip shows the SDK's real `inferenceSource`. |
| **Design** | 0:25–1:05 and 1:45–2:35: badge → panel → proof → inbox labels → recovery help → screenshot → family. One coherent flow, large text, plain words. |
| **Potential impact** | 0:00–0:13 hook with sourced numbers. A specific audience (older adults and their families) and a specific moment (opening the email). Family sharing for the adult child. "Free on the Chrome Web Store today." |
| **Quality of the idea** | 1:05–1:20: "where each check runs *is* the privacy feature". Automatic checks never leave the computer, and the cloud only sees redacted text. |

---

## 1. Demo inbox setup

Use a **dedicated test Gmail account**, never your own, so no real names or addresses appear. Name the account **Margaret Ellis**; that's the name Gmail shows on screen.

Send the emails from a **second Gmail account**. To give each email its own sender name, add plus-addresses as aliases in the sender account: **Settings → Accounts → Send mail as → Add another email address**, for example `yourname+harborview@gmail.com`, named "Harborview Bank Security". Verification goes to the same inbox.

Send them in this order (oldest first), so they appear in the inbox top to bottom: 5, 4, 3, 2, 1.

**1. Bank lock (the hero scam)**. From: *Harborview Bank Security*. Subject: `Your account has been locked`
> Dear Margaret Ellis,
>
> We detected unusual sign-in activity on your Harborview Bank online account (margaret.ellis.demo@gmail.com). For your protection, your account has been temporarily locked.
>
> To restore access, verify your identity and confirm your card details within 24 hours:
>
> www.harborviewbank.com/secure-login
>
> If you cannot complete this online, call our fraud team at (555) 014-2290.
>
> Failure to verify will result in permanent account closure.
>
> Harborview Bank Fraud Prevention

**The link must be disguised.** In Gmail compose, type `www.harborviewbank.com/secure-login`, select it, click **Insert link** and set the web address to `https://harborview-verify.top/login?session=a81f`. Replace `margaret.ellis.demo@gmail.com` with the test account's real address. The name, email address and phone number are what the cloud route will visibly hide.

**2. Delivery fee (payment scam)**. From: *ParcelPost Delivery*. Subject: `FINAL NOTICE: Your package is on hold – action required within 24 hours`
> Dear Margaret,
>
> We attempted to deliver your package (tracking #PP-40921-US) but could not complete delivery because of an unpaid customs fee of $1.99.
>
> Your package will be returned to sender within 24 hours unless you confirm your address and pay the fee here:
>
> https://parcelpost-redelivery.top/confirm?id=88213
>
> If you prefer, you can pay with a gift card. Reply to this email with the card code.
>
> ParcelPost Customer Service Team

**3. Gift-card "boss" (the offline scam)**. From: *Linda Ortiz*. Subject: `Quick favor`
> Hi, are you at your desk? I'm in a meeting and can't talk on the phone.
>
> I need you to pick up 5 gift cards ($200 each) for a client surprise today. Scratch the backs and send me photos of the codes as soon as you have them. I'll pay you back this afternoon.
>
> Please keep this between us for now, it's a surprise.
>
> Linda

**4. Family note (safe)**. From: *Sam Rivera*. Subject: `Sunday dinner at Mom's`
> Hi Mom,
>
> Just confirming Sunday dinner at 5. I'll bring the lasagna and the kids are making a cake for Grandpa's birthday. Can you pick up candles?
>
> Love you,
> Sam

**5. Garden club (safe)**. From: *Maple Grove Garden Club*. Subject: `Spring meeting + seed swap this Thursday`
> Hi everyone,
>
> Our spring meeting is this Thursday at 6:30 PM at the library. Bring any extra seeds for the swap. Coffee and cookies provided.
>
> See you there,
> Maple Grove Garden Club

Also have [`docs/demo/sample-text-message.png`](demo/sample-text-message.png) (the "grandkid in trouble" text) on the desktop.

---

## 2. Recording setup

- **Screen:** 1920×1080, one Chrome window maximized, zoom 110–125% so text reads on YouTube. Hide the bookmarks bar and pin only the Scamouflage icon.
- **Extension:** installed from the Chrome Web Store (version 1.1.0 once approved, or Load unpacked from `dist/`). **Demo mode off.** **Text size: Large.** Light theme for Gmail scenes.
- **Gemini Nano warm:** open the side panel and check any email once before recording, so the first on-camera check is fast.
- **Family:** in the panel, **Family → Create a family code** before recording. For the family member's side, open the **web app** in a private window, join with the code, and keep it ready in a second window.
- **Branding:** keep the Gmail and Google logos out of frame (crop below the Gmail header, or blur the top-left logo in the edit). Never show the Chrome Web Store page itself; show our landing page instead.
- **Privacy:** check every frame for the sender account's real address before exporting.

---

## 3. The script

About 380 words. Read it calmly, at about 140 words per minute, with a short pause between scenes. "On screen" is what the viewer sees; "Say" is the voice-over; "Caption" is optional text to overlay.

**1. Hook (0:00–0:13)**
- On screen: the animated stats card (`docs/banners/stats.webp`).
- Say: "Last year, Americans over sixty reported seven point seven five billion dollars lost to online fraud, more than any other age group. And phishing was the most-reported crime of all."
- Caption: Source: FBI IC3 2025 report

**2. Introducing Scamouflage (0:13–0:25)**
- On screen: the inbox with five unread emails. Click the Scamouflage icon and the side panel opens.
- Say: "Introducing Scamouflage. It's a Chrome extension that checks your email for scams right inside Gmail, using Gemini Nano, the AI that's built into Chrome."
- Caption: Scamouflage · Chrome extension

**3. A scam, caught (0:25–0:52)**
- On screen: open email 1 (bank lock). The badge changes from Checking to Scam. The panel shows the reason and what to do. Tap the link warning sign, and the link lights up in the email.
- Say: "Here's an email that looks like it's from a bank. As soon as it's opened, Scamouflage checks it, and in under a second, it's marked as a scam. That check happened right on this computer. The panel gives one clear reason and one thing to do. And here's the proof: the link says Harborview Bank, but it actually leads somewhere else."
- Caption: Verdict in under 1 second · on-device

**4. Genuine email (0:52–1:05)**
- On screen: open email 4 (from Sam). The badge says Looks safe. Go back to the inbox, where both opened emails keep their labels.
- Say: "When an email is genuine, like this one from family, Scamouflage says it looks safe. And back in the inbox, every opened email keeps its label, so you can tell at a glance."

**5. Why it's private (1:05–1:20)**
- On screen: the architecture diagram (`docs/banners/architecture.png`), with the "On your computer" box highlighted. Then tap the On-device chip in the panel to show its explanation.
- Say: "Under the hood, this runs on Firebase AI Logic hybrid inference, and where each check runs is what keeps your email private. When Gemini Nano is available, the full email is checked in on-device-only mode, so it can never reach the cloud."
- Caption: `InferenceMode.ONLY_ON_DEVICE`

**6. Proof: no internet (1:20–1:30)**
- On screen: turn Wi-Fi off (show the menu-bar icon). Open email 3 (gift cards). The badge says Scam.
- Say: "To prove it, I'll turn off Wi-Fi and open another email. The scam is still caught."
- Caption: Wi-Fi off

**7. The cloud, with details removed (1:30–1:47)**
- On screen: jump cut to `chrome://flags` with the on-device model set to Disabled (the restart is cut out). Open email 1 again. The panel shows the quick "Be careful?" answer and a Check with cloud help button. Tap it. The chip says Cloud · 3 hidden. Open Details to show "Hidden first: 3 personal details".
- Say: "On a computer that can't run Nano, nothing is sent until you ask. Then Scamouflage removes personal details like your name, email and phone number, and asks Gemini in the cloud. The label always shows which one was used."
- Caption: Personal details removed before the cloud

**8. If you already paid (1:47–2:05)**
- On screen: Wi-Fi and Nano back on. Open email 2 (delivery fee), marked Scam. Tap What if I already paid? and the steps stream in.
- Say: "And if someone already paid? One tap brings up calm, step-by-step help: call the bank using the number on your card, change your password, and report it."

**9. Text messages too (2:05–2:15)**
- On screen: the Screenshot tab. Drag in `sample-text-message.png`. It's marked Scam, on-device.
- Say: "Scams don't only come by email. You can drop in a screenshot of a text message, and Nano checks that on your computer too."

**10. Family (2:15–2:33)**
- On screen: back on email 2, tap Tell my family, then Send to my family. Cut to the second window (the family member's view in the web app). Tap Check for new warnings, and the warning appears.
- Say: "With one more tap, you can warn a family member. They see a short summary on their own screen, never the email itself. This uses Firebase Authentication and Cloud Firestore, with rules that only let family members read it."
- Caption: Only a summary is shared

**11. Built to last (2:33–2:50)**
- On screen: a quick montage, 3–4 seconds each: Settings (text size, the cloud help switch), the landing page with the live demo, and the tests passing in a terminal.
- Say: "App Check protects every AI request, Remote Config lets the settings be tuned without a new release, and Firebase Hosting runs a web version of the same app. Along the way, the first answer got ten times faster, from about nine seconds to under one."
- Caption: App Check · Remote Config · Auth · Firestore · Hosting

**12. Close (2:50–2:58)**
- On screen: the thumbnail logo (`store/gallery/thumbnail.png`), then the links.
- Say: "Scamouflage is free on the Chrome Web Store today. Spot the scams that are trying to blend in."
- Caption: Add to Chrome · scamouflage.xyz

---

## 4. Footage to capture (screen only, no voice)

Record each shot as a separate clip, with 2 seconds of stillness before and after each action, so cuts land cleanly.

1. Inbox with 5 unread emails → click the toolbar icon → panel opens.
2. Open email 1 → the badge goes from Checking to Scam → panel result → tap the link warning sign → highlight in the email.
3. Open email 4 → Looks safe → back to the inbox showing both labels.
4. Tap the On-device chip → its explanation.
5. Wi-Fi off (menu bar) → open email 3 → Scam.
6. `chrome://flags/#optimization-guide-on-device-model` → Disabled → Relaunch. Open email 1 → "Be careful?" → **Check with cloud help** → ☁️ Cloud · N hidden → Details. Then set the flag back to Default and relaunch.
7. Open email 2 → **What if I already paid?** → Debrief streaming until it finishes.
8. Screenshot tab → drop the PNG → result.
9. **Tell my family → Send to my family** → the second window → **Check for new warnings** → the warning appears.
10. Montage: Settings scroll, the landing page, `npm test` passing in a terminal.

Stills already made: `docs/banners/stats.webp` (hook), `docs/banners/architecture.png` (diagram), `store/gallery/thumbnail.png` (close).

---

## 5. Captions and export

- Upload to YouTube as **Public**, 1080p. Title: *Scamouflage: a private scam checker for Gmail (Firebase AI Logic hybrid inference)*.
- Add **English captions**: upload an `.srt` made from the voice-over above (the rules accept English audio, but captions help judges watching muted).
- Check the length is **under 3:00**. Anything after 3:00 isn't evaluated.
- Put the YouTube link in the Devpost video field and the README. Published: https://youtu.be/DbJltFqxIac

## 6. Before you record

- [ ] Nano shows "On-device AI: Ready" in Settings and has been warmed up.
- [ ] Demo mode off, text size Large, cloud help on.
- [ ] The family code is created, and the private window has joined it.
- [ ] Email 1's link is disguised (hover it in Gmail to confirm the real address).
- [ ] No real names, addresses or the Gmail logo are in frame.
- [ ] Wi-Fi and the Nano flag are back to normal after their shots.
