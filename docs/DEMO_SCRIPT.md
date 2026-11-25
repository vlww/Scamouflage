# Demo video script (≤ 3:00)

**Setup before recording**
- Chrome with Scamouflage loaded (from `dist/`), Gemini Nano downloaded (Settings shows "On-device AI: Ready"), side panel open.
- A test Gmail inbox with two invented emails sent to it from a second account: the **Bank lock** sample (send as HTML so the link text says `www.harborviewbank.com/secure-login` but points elsewhere) and the **Store receipt** sample. Copy them from `src/samples.js`.
- `docs/demo/sample-text-message.png` on the desktop for the screenshot check.
- Large-text mode **on** (it reads better on video). Hide bookmarks and other extensions.
- Branding: the samples use invented brands only. Gmail's own UI will be on screen; keep its logo out of frame (crop to the message area) to stay within the contest's no-third-party-logos rule, or record the badge on `scripts/mail-mock.html` instead.

| Time | Screen | Voice-over |
|---|---|---|
| **0:00–0:15** Hook | Close-up of the bank-lock email in the inbox. | "Last year Americans over sixty reported seven point seven billion dollars lost to online fraud, more than anyone else, according to the FBI. And it often starts with an email like this one." |
| **0:15–0:35** Badge appears | Open the email. The shield badge appears next to the subject: *Checking…* then **Scam 🔒**. | "I just opened it, and Scamouflage has already checked it, right here on my computer, with Gemini Nano built into Chrome. Nothing was uploaded." |
| **0:35–1:00** Verdict | Side panel: the red **Scam** hero, the one-line reason, "Don't click, reply, or pay. Delete it." Tap the link warning sign: *Says harborviewbank.com · Really goes to harborview-verify.top*, and the link lights up in the email. | "One verdict, one reason, one thing to do. And the proof: the link *says* my bank but really goes somewhere else." |
| **1:00–1:15** Speed + safe mail | Open the receipt email: **Looks safe** almost instantly. Go back to the scam email: instant (cached). | "Real mail gets a calm 'Looks safe'. The verdict shows up in under a second, because we stream it as the on-device model writes it." |
| **1:15–1:45** Hybrid fallback | Tap the **🔒 On-device** chip to show the explanation. Then show `chrome://flags/#optimization-guide-on-device-model` → Disabled (pre-recorded restart), and check the same email again from Paste: **☁️ Cloud · 4 hidden**. Open Details: "Hidden first: 4 personal details". | "This is Firebase AI Logic hybrid inference. When the on-device model is there, the email never leaves the computer. When it isn't, Scamouflage strips names, emails, phone and account numbers *first*, then asks Gemini in the cloud. Same answer, still private, and the chip always tells you which one ran." |
| **1:45–2:15** Debrief | Back on-device. Tap **What if I already clicked?** Debrief streams numbered steps: call the bank using the number on your card, change your password, turn on 2-step verification, report to ReportFraud.ftc.gov. Show the quick-reply chips. | "Mistakes happen. The Debrief gives clear next steps, in order, and never blames you." |
| **2:15–2:30** Screenshot | Drag the text-message PNG into **Screenshot**: **Scam**, on-device. | "Scams aren't only email. Drop in a screenshot of a text and Nano reads it, still on-device." |
| **2:30–2:45** Tell my family | Tap **Tell my family** → **Send to Sam**. Cut to a second Chrome profile: the Family tab shows *"Scam: Your account has been locked · harborview-alerts.com"*. | "And with one tap, the person who looks out for you sees it too. Only a short summary is shared, never the email." |
| **2:45–3:00** Close | Logo + "Scams hide. We spot them." Text on screen: *On-device first · Redacted cloud only when needed · Built with Firebase AI Logic*. | "Scamouflage. Private by default, plain words, and help when you need it." |

**Shot list / checklist**
- [ ] Badge transition captured in one take (open the email *after* the panel is open, so it auto-checks).
- [ ] Evidence highlight in the email visible.
- [ ] Route chip popover readable.
- [ ] Cloud run shows "N hidden".
- [ ] Family view on a second profile (needs Anonymous Auth + Firestore enabled; see README).
- [ ] Total ≤ 3:00; captions on.
