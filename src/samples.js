// Demo + evaluation messages. Every brand, person, domain and number here is INVENTED
// (phone numbers use the reserved 555-01xx range). Used by the "Try a sample" chips and by
// eval/run.mjs. `label` is the ground truth; `demo` marks the ones offered in the UI.

export const SAMPLES = [
  {
    id: 'delivery-fee',
    title: 'Delivery fee',
    demo: true,
    label: 'scam',
    from: 'ParcelPost Delivery <notice@parcelpost-redelivery.top>',
    subject: 'FINAL NOTICE: Your package is on hold – action required within 24 hours',
    body: `Dear Customer,

We attempted to deliver your package (tracking #PP-40921-US) but could not complete delivery because of an unpaid customs fee of $1.99.

Your package will be returned to sender within 24 hours unless you confirm your address and pay the fee here:

https://parcelpost-redelivery.top/confirm?id=88213

If you prefer, you can pay with a gift card. Reply to this email with the card code.

Thank you,
ParcelPost Customer Service Team`,
  },
  {
    id: 'bank-lock',
    title: 'Bank lock',
    demo: true,
    label: 'scam',
    from: 'Harborview Bank Security <security@harborview-alerts.com>',
    subject: 'Your account has been locked',
    body: `Dear Valued Customer,

We detected unusual sign-in activity on your Harborview Bank online account. For your protection, your account has been temporarily locked.

To restore access, verify your identity and confirm your card details within 24 hours:

www.harborviewbank.com/secure-login

Failure to verify will result in permanent account closure.

Harborview Bank Fraud Prevention`,
    links: [{ text: 'www.harborviewbank.com/secure-login', href: 'https://harborview-verify.top/login?session=a81f' }],
  },
  {
    id: 'boss-giftcards',
    title: 'Boss gift cards',
    demo: true,
    label: 'scam',
    from: 'Linda Ortiz <linda.ortiz.ceo.office@gmail.com>',
    subject: 'Quick favor',
    body: `Hi, are you at your desk? I'm in a board meeting and can't talk on the phone.

I need you to pick up 5 gift cards ($200 each) for a client appreciation surprise today. Scratch the backs and send me photos of the codes as soon as you have them. I'll reimburse you this afternoon.

Please keep this between us for now, it's a surprise.

Linda
Sent from my iPhone`,
  },
  {
    id: 'tech-support',
    title: 'Tech support',
    demo: true,
    label: 'scam',
    from: 'SecureShield Billing <billing@secureshield-renewals.online>',
    subject: 'Order Confirmation: SecureShield Total Protection renewed ($399.99)',
    body: `Thank you for your purchase!

Your SecureShield Total Protection subscription has been automatically renewed.

Amount charged: $399.99
Payment method: card on file

If you did not authorize this charge, call our toll-free cancellation line immediately at (888) 555-0142 to receive a full refund. Our technician will help you connect to your computer to process the refund.

Refunds are only available within 24 hours.

SecureShield Customer Care`,
  },
  {
    id: 'romance-crypto',
    title: 'Crypto romance',
    label: 'scam',
    from: 'Daniel Brooks <daniel.brooks.offshore@outlook.com>',
    subject: 'Thinking of you, my dear',
    body: `My dear,

Every day on this oil rig I think about our talks. You are the only one who understands me.

I want to share something special with you. My uncle showed me a crypto trading platform with guaranteed returns: I doubled my investment in two weeks. I can help you open an account at https://goldenmint-trade.xyz and we can build our future together.

Start with just $500 in bitcoin. Please don't tell your family yet, they would not understand us.

With all my love,
Daniel`,
  },
  {
    id: 'invoice-wire',
    title: 'Invoice change',
    label: 'scam',
    from: 'Accounts Receivable <ar@brightline-supp1y.com>',
    subject: 'URGENT: Overdue invoice INV-20931 – updated bank details',
    body: `Hello,

Please note our banking details have changed due to an audit. Kindly process payment for overdue invoice INV-20931 ($8,420.00) by wire transfer to our new account today to avoid late penalties.

The invoice is attached as INV-20931.html. Do not use the old account on file.

Regards,
Accounts Receivable
Brightline Supply Co.`,
  },
  {
    id: 'prize',
    title: 'Lottery prize',
    label: 'scam',
    from: 'International Prize Board <claims@global-prize-board.info>',
    subject: 'Congratulations! You have won $850,000',
    body: `Congratulations!

Your email address was selected in our annual international lottery draw. You have won $850,000.00 USD.

To claim your prize, pay the processing and transfer fee of $250 via Western Union and reply with your full name, address, date of birth and bank account number.

Claim reference: GPB-7781. Keep this notification confidential until your prize is released.`,
  },
  {
    id: 'password-expiry',
    title: 'Password expiry',
    label: 'scam',
    from: 'Mail Administrator <admin@mailbox-quota-center.site>',
    subject: 'Your password expires today',
    body: `Your email password expires today. To keep using your mailbox, confirm your password now:

http://203.0.113.45/mail/keep-password

If you do not act now, incoming messages will be deleted.

Mail Admin Team`,
  },
  {
    id: 'grandparent',
    title: 'Grandkid in trouble (text)',
    demo: true,
    label: 'scam',
    from: '',
    subject: '',
    body: `Grandma it's me, I'm in trouble. I was in a car accident and I'm at the police station. My phone broke so this is a lawyer's number. I need $2,000 for bail right away. Please don't tell Mom and Dad, they'll be so upset. Can you get gift cards or send it by Zelle? Please hurry.`,
  },
  {
    id: 'utility-billing',
    title: 'Utility payment',
    label: 'scam',
    from: 'Pinecrest Utilities <billing@pinecrest-utilities-billing.com>',
    subject: 'Payment failed: service disconnection scheduled',
    body: `Your last payment could not be processed. Your electric service is scheduled for disconnection today at 5:00 PM.

To avoid disconnection, update your payment method immediately:
https://pinecrest-utilities-billing.com/pay-now

Pinecrest Utilities Customer Service`,
  },
  {
    id: 'signin-generic',
    title: 'Sign-in alert',
    label: 'suspicious',
    from: 'Account Team <no-reply@acct-notify-center.com>',
    subject: 'New sign-in to your account',
    body: `We noticed a new sign-in to your account from a Windows device in Lagos.

If this wasn't you, review your activity here:
https://acct-notify-center.com/review

Thanks,
The Account Team`,
  },
  {
    id: 'newsletter',
    title: 'Club newsletter',
    label: 'safe',
    from: 'Maple Grove Garden Club <news@maplegrovegardens.org>',
    subject: 'Spring meeting + seed swap this Thursday',
    body: `Hi gardeners!

Our spring meeting is this Thursday at 6:30 PM at the Maple Grove library. Bring seedlings to swap, and don't forget the potluck sign-up sheet at the front desk.

Photos from the winter workshop are on our website: https://maplegrovegardens.org/gallery

See you there,
Dana Whitfield, Club Secretary

You are receiving this because you joined the Maple Grove Garden Club mailing list. Unsubscribe: https://maplegrovegardens.org/unsubscribe`,
  },
  {
    id: 'receipt',
    title: 'Store receipt',
    demo: true,
    label: 'safe',
    from: 'Copperleaf Outfitters <orders@copperleafoutfitters.com>',
    subject: 'Your order #CL-48213 has shipped',
    body: `Thanks for shopping with Copperleaf Outfitters!

Your order #CL-48213 has shipped and should arrive Tuesday.

1 × Wool hiking socks (2-pack) — $18.00
1 × Trail water bottle — $24.00
Total: $42.00

Track your package: https://copperleafoutfitters.com/orders/CL-48213

Questions? Reply to this email or visit https://copperleafoutfitters.com/help`,
  },
  {
    id: 'family-dinner',
    title: 'Family dinner',
    label: 'safe',
    from: 'Sam Rivera <sam.rivera.home@gmail.com>',
    subject: "Sunday dinner at Mom's",
    body: `Hi Mom,

Just confirming Sunday dinner at 5. I'll bring the lasagna and the kids are making a cake for Grandpa's birthday. Can you pick up candles?

Love you,
Sam`,
  },
  {
    id: 'pharmacy',
    title: 'Pharmacy pickup',
    label: 'safe',
    from: 'Fernway Pharmacy <reminders@fernwaypharmacy.com>',
    subject: 'Your prescription is ready for pickup',
    body: `Your prescription is ready for pickup at Fernway Pharmacy, Oak Street location.

Pickup hours: Mon–Sat, 9 AM – 8 PM.

Manage your prescriptions in the Fernway app or at https://fernwaypharmacy.com/account`,
  },
  {
    id: 'bank-statement',
    title: 'Bank statement',
    label: 'safe',
    from: 'Harborview Bank <statements@harborviewbank.com>',
    subject: 'Your monthly statement is ready',
    body: `Your October statement is now available.

To view it, sign in through the Harborview Bank app or by typing harborviewbank.com into your browser.

Remember: Harborview Bank will never ask for your password, PIN or one-time codes by email, text or phone.`,
  },
  {
    id: 'appointment',
    title: 'Doctor reminder',
    label: 'safe',
    from: "Dr. Patel's Office <frontdesk@lakesidefamilymed.com>",
    subject: 'Appointment reminder: Thursday 10:30 AM',
    body: `This is a reminder of your appointment with Dr. Anita Patel on Thursday at 10:30 AM.

Please arrive 10 minutes early and bring your insurance card. To reschedule, call the office at (555) 010-4477.

Lakeside Family Medicine`,
  },
  {
    id: 'real-security-alert',
    title: 'Real security alert',
    label: 'safe',
    from: 'Lumen Cloud <no-reply@lumencloud.com>',
    subject: 'New sign-in on Chrome for Mac',
    body: `Hi,

Your Lumen Cloud account was just signed in to from Chrome on a Mac near Springfield.

If this was you, you don't need to do anything. If not, open the Lumen Cloud app and go to Settings › Security to review your devices.

– The Lumen Cloud team
https://lumencloud.com/security`,
  },
  // Genuine account notices that read like phishing: the sender's own domain is the tell.
  {
    id: 'api-key-expiry',
    title: 'API key expiring',
    label: 'safe',
    from: 'Lumenworks <no-reply-Xk29Qp7LmR3zT_8vWb2Ycq@mail.lumenworks.dev>',
    subject: 'Action required: your API key expires in 7 days',
    body: `Hi there,

The API key "production-server" on your Lumenworks account expires in 7 days. After that, requests using this key will fail.

To keep your integration working, create a new key and update your app before it expires:
https://console.lumenworks.dev/settings/keys

Read more about key rotation: https://docs.lumenworks.dev/keys

– The Lumenworks team
Lumenworks, 400 Harbor St, Springfield`,
  },
  {
    id: 'renewal-notice',
    title: 'Subscription renewal',
    label: 'safe',
    from: 'Brightpath Streaming <billing@brightpath.tv>',
    subject: 'Your annual plan renews on December 3',
    body: `Your Brightpath Premium annual plan renews on December 3 for $59.99, charged to the card ending in 4421.

No action is needed. To change or cancel your plan, visit https://brightpath.tv/account/plan

Questions? https://help.brightpath.tv`,
  },
  {
    id: 'password-reset-real',
    title: 'Password reset (requested)',
    label: 'safe',
    from: 'Tidewater Notes <accounts-noreply@tidewater.app>',
    subject: 'Reset your password',
    body: `Someone (hopefully you) asked to reset the password for your Tidewater Notes account.

To choose a new password, use this link within 1 hour:
https://accounts.tidewater.app/reset?token=sample

If you didn't ask for this, you can ignore this email. Your password won't change.

Follow us: https://x.com/tidewaternotes`,
  },
  // …and the phishing versions of the same notices.
  {
    id: 'api-key-phish',
    title: 'API key phish',
    label: 'scam',
    from: 'Lumenworks Security <alerts@lumenworks-security.top>',
    subject: 'URGENT: your API key will be revoked in 24 hours',
    body: `We detected unusual activity on your Lumenworks account. Your API key will be revoked in 24 hours.

Verify your account and re-enter your billing details to keep access:
https://lumenworks-verify.top/login

Lumenworks Security Team`,
  },
  {
    id: 'renewal-phish',
    title: 'Fake renewal failure',
    label: 'scam',
    from: 'Brightpath Billing <brightpath.billing.team@gmail.com>',
    subject: 'Payment declined: your account will be suspended',
    body: `We were unable to process your payment. Your Brightpath account will be suspended today.

Update your payment method immediately to avoid losing access: https://bit.ly/brightpath-pay

Brightpath Billing`,
  },
];

export const DEMO_SAMPLES = SAMPLES.filter((s) => s.demo);

/** Parses a "Name <addr>" string and the body's URLs into the email shape the scanner uses. */
export function toEmail(s) {
  const from = (s.from || '').trim();
  const m = from.match(/^(.*?)\s*<([^>]+)>$/);
  const bodyLinks = [...(s.body || '').matchAll(/(?:https?:\/\/|www\.)[^\s<>"')]+/g)].map((x) => ({
    text: x[0],
    href: x[0].startsWith('www.') ? `https://${x[0]}` : x[0],
  }));
  // Explicit links (e.g. HTML links whose text differs from the destination) replace body text links.
  const explicit = s.links || [];
  const links = [...explicit, ...bodyLinks.filter((b) => !explicit.some((e) => e.text === b.text))];
  return {
    source: 'paste',
    fromName: m ? m[1].replace(/"/g, '') : from.includes('@') ? '' : from,
    fromEmail: m ? m[2] : from.includes('@') ? from : '',
    subject: s.subject || '',
    body: s.body || '',
    links,
  };
}
