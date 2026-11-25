// "Recon": fast, deterministic checks that run locally before any AI.
// Findings are shown to the user and handed to the model as hints.

const BRANDS = [
  'paypal', 'amazon', 'apple', 'icloud', 'microsoft', 'outlook', 'office365', 'netflix', 'google',
  'facebook', 'instagram', 'whatsapp', 'chase', 'wells fargo', 'bank of america', 'citibank',
  'irs', 'social security', 'medicare', 'usps', 'fedex', 'ups', 'dhl', 'geek squad', 'norton',
  'mcafee', 'coinbase', 'venmo', 'zelle', 'cash app', 'walmart', 'costco', 'docusign',
];
const FREE_MAIL = /@(gmail|yahoo|outlook|hotmail|aol|icloud|proton(mail)?|gmx|mail|yandex)\.[a-z.]+$/i;
const URGENCY =
  /\b(urgent|immediately|within 24 hours|final notice|account (will be )?(suspended|locked|closed)|act now|verify (your )?(account|identity)|unusual (sign-?in|activity)|last chance)\b/i;
const PAYMENT =
  /\b(gift ?cards?|wire transfer|bitcoin|crypto(currency)?|btc|usdt|western union|moneygram|zelle|cash app|refund (of|for)|overpaid|invoice attached)\b/i;
const SECRECY = /\b(don'?t tell|keep (this|it) (between us|confidential|secret)|do not share this)\b/i;

/** Unwrap Gmail/Google redirect links so we judge the real destination. */
export function realUrl(href) {
  try {
    const u = new URL(href);
    if (/(^|\.)google\.[a-z.]+$/.test(u.hostname) && u.pathname === '/url') {
      return u.searchParams.get('q') || u.searchParams.get('url') || href;
    }
    return href;
  } catch {
    return href;
  }
}

/** Rough registrable domain: last two labels (last three for co.uk-style). */
export function baseDomain(host = '') {
  const parts = host.toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const sld = parts[parts.length - 2];
  return (sld.length <= 3 ? parts.slice(-3) : parts.slice(-2)).join('.');
}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function runRecon(email) {
  const findings = [];
  const add = (type, detail) => findings.push({ type, detail });

  const senderDomain = (email.fromEmail.split('@')[1] || '').toLowerCase();
  const nameAndSubject = `${email.fromName} ${email.subject}`.toLowerCase();
  const text = `${email.subject}\n${email.body}`;

  // Brand impersonation: display name / subject mentions a brand the sender domain doesn't match.
  const brand = BRANDS.find((b) => nameAndSubject.includes(b));
  if (brand && senderDomain && !senderDomain.replace(/[^a-z]/g, '').includes(brand.replace(/[^a-z]/g, ''))) {
    add(
      'impersonation',
      FREE_MAIL.test(email.fromEmail)
        ? `Claims to be ${brand} but was sent from a free email account (${senderDomain}).`
        : `Mentions ${brand} but was sent from ${senderDomain}.`
    );
  }
  if (senderDomain.includes('xn--')) add('lookalike_domain', `Sender domain uses look-alike characters (${senderDomain}).`);

  // Links
  const seen = new Set();
  for (const link of email.links || []) {
    const dest = realUrl(link.href);
    const host = hostOf(dest);
    if (!host || seen.has(host)) continue;
    seen.add(host);

    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) add('suspicious_link', `A link goes to a bare IP address (${host}).`);
    if (host.includes('xn--')) add('lookalike_domain', `A link uses look-alike characters (${host}).`);

    const shownHost = link.text.match(/\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b/i)?.[1];
    if (shownHost && baseDomain(shownHost) !== baseDomain(host)) {
      add('link_mismatch', `Link text says "${shownHost}" but actually goes to ${host}.`);
    }
  }

  if (URGENCY.test(text)) add('urgency', `Pressure language: "${text.match(URGENCY)[0]}".`);
  if (PAYMENT.test(text)) add('payment_request', `Asks about unusual payment: "${text.match(PAYMENT)[0]}".`);
  if (SECRECY.test(text)) add('secrecy', 'Asks you to keep it secret.');

  return findings.slice(0, 8);
}
