# Demo video script (target 2:55, hard limit 3:00)

The story follows one person, a grandmother called **Margaret**, through a morning of email. Every feature appears because she needs it, so the video reads as a product, not a feature tour. The technical claims are shown happening on screen, not just stated.

## What each judging criterion sees

| Criterion | Where the video proves it |
|---|---|
| **Technological implementation** | 1:05–1:45: the architecture diagram, `ONLY_ON_DEVICE` named on screen, Wi-Fi off and it still works, then Nano switched off and the redacted cloud route with "N hidden". The route chip shows the SDK's real `inferenceSource`. |
| **Design** | 0:25–1:05 and 1:45–2:35: badge → panel → proof → inbox labels → recovery help → screenshot → family. One coherent flow, large text, plain words. |
| **Potential impact** | 0:00–0:13 hook with sourced numbers. A specific person (Margaret) and a specific moment (opening the email). Family sharing for the adult child. "Free on the Chrome Web Store today." |
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

Voice-over: about 370 words, read calmly at about 140 words per minute, with short pauses at scene changes. **Bold on-screen text** goes in as captions or overlays.

| Time | Screen | Voice-over | On-screen text |
|---|---|---|---|
| **0:00–0:13** Hook | Animated stats card (`docs/banners/stats.webp`) over camo. | "Last year, Americans over sixty reported seven point seven five billion dollars lost to online fraud. More than any other age group. And phishing was the most-reported crime of all." | **Source: FBI IC3 2025 report** |
| **0:13–0:25** Meet Scamouflage | Margaret's inbox, five unread emails. Click the Scamouflage icon; the side panel slides open. | "Meet Margaret. And meet Scamouflage: a Chrome extension that checks her email for scams, right inside Gmail, using Gemini Nano, the AI built into Chrome." | **Scamouflage · Chrome extension** |
| **0:25–0:52** A scam, caught | Open email 1 (bank lock). Badge: **Checking… → Scam 🔒**. Panel: red Scam verdict, one-line reason, "Don't click…". Tap the link warning sign; the link highlights in the email: *Says harborviewbank.com · Really goes to harborview-verify.top*. | "This one looks like her bank. The moment she opens it, a shield appears. Checking… Scam. In under a second, on her own computer. One verdict, one reason, and one thing to do. And the proof: the link says Harborview Bank, but it really goes somewhere else." | **Verdict in under 1 second · on-device** |
| **0:52–1:05** Real mail stays calm | Open email 4 (Sam). Badge: **Looks safe**. Back to the inbox: both opened emails keep their labels. | "Real mail gets a calm 'Looks safe'. And back in her inbox, every email she's opened keeps its label, so she can tell at a glance." | |
| **1:05–1:20** Why it's private | Architecture diagram (`docs/banners/architecture.png`), with the 🔒 ON YOUR COMPUTER box highlighted. Then tap the 🔒 On-device chip in the panel to show its explanation. | "Under the hood, this is Firebase AI Logic hybrid inference, and *where* each check runs is the privacy feature. When Gemini Nano is ready, the full email runs in ONLY_ON_DEVICE mode. It can't reach the cloud, by design." | **`InferenceMode.ONLY_ON_DEVICE`** |
| **1:20–1:30** Proof: offline | Turn Wi-Fi off (show the menu-bar icon). Open email 3 (gift cards). Badge: **Scam 🔒**. | "Watch: I turn off Wi-Fi, open another email, and it's still caught." | **Wi-Fi off** |
| **1:30–1:47** The cloud, redacted | *Jump cut.* Show `chrome://flags` with the on-device model **Disabled** (pre-recorded restart). Open email 1 again. The panel shows the quick "Be careful?" answer and **Check with cloud help**; tap it. Chip: **☁️ Cloud · 3 hidden**. Open **Details**: "Hidden first: 3 personal details". | "On a computer without Nano, nothing is sent until she asks. Then Scamouflage removes her name, email and phone number first, and asks Gemini in the cloud. The chip always shows which one ran." | **Personal details removed before the cloud** |
| **1:47–2:05** "I already paid" | Wi-Fi back on, Nano back on. Open email 2 (delivery fee): **Scam**. Tap **What if I already paid?** The Debrief streams numbered steps. | "And if she already paid? One tap, and she gets calm, numbered steps: call the bank using the number on her card, change her password, report it. No blame. Just what to do now." | |
| **2:05–2:15** Texts too | **Screenshot** tab. Drag in `sample-text-message.png`. **Scam**, on-device. | "Scams aren't only email. She can drop in a screenshot of a text, and Nano reads that too, still on her computer." | |
| **2:15–2:33** Family in the loop | Back on email 2, tap **Tell my family → Send to my family**. Cut to the second window (Sam's view, web app): tap **Check for new warnings**; the warning appears. | "And with one tap, she can tell her family. Her son sees the warning on his own screen: just a short summary, never the email. That's Firebase Authentication and Cloud Firestore, with rules that only let family read it." | **Only a summary is shared** |
| **2:33–2:50** Built to last | Quick montage, 3–4 s each: Settings (text size, cloud help switch) · the landing page with the live demo · the speed table or test run in a terminal. | "App Check protects every AI call. Remote Config tunes the engine without a new release. And Firebase Hosting serves a web app running the same panel. Along the way, the first answer got ten times faster: from nine seconds to under one." | **App Check · Remote Config · Auth · Firestore · Hosting** |
| **2:50–2:58** Close | Thumbnail lockup (`store/gallery/thumbnail.png`), then the links. | "Scamouflage. Free on the Chrome Web Store today. Spot the scams that are trying to blend in." | **Add to Chrome · scamouflage.xyz** |

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
- Put the YouTube link in the Devpost video field and the README.

## 6. Before you record

- [ ] Nano shows "On-device AI: Ready" in Settings and has been warmed up.
- [ ] Demo mode off, text size Large, cloud help on.
- [ ] The family code is created, and the private window has joined it.
- [ ] Email 1's link is disguised (hover it in Gmail to confirm the real address).
- [ ] No real names, addresses or the Gmail logo are in frame.
- [ ] Wi-Fi and the Nano flag are back to normal after their shots.
