import { describe, it, expect } from 'vitest';
import { runRecon, runTrust } from '../src/core/recon.js';
import { calibrate, calibratePartial } from '../src/core/calibrate.js';
import { scanPrompt, tidyAddress } from '../src/core/prompt.js';
import { SAMPLES, toEmail } from '../src/samples.js';

const email = (o) => ({ fromName: '', fromEmail: '', subject: '', body: '', links: [], ...o });
const trustOf = (e) => runTrust(e, runRecon(e));

// An automated notice in the shape of the one that was misjudged (invented company).
const keyNotice = email({
  fromName: 'Lumenworks',
  fromEmail: 'no-reply-AP3ihr4GOFs_26uTAyRX3w@mail.lumenworks.dev',
  subject: 'Action required: your API key expires soon',
  body: 'Your API key expires in 7 days. Create a new key in the console.',
  links: [
    { text: 'Open the console', href: 'https://console.lumenworks.dev/settings/keys' },
    { text: 'Docs', href: 'https://docs.lumenworks.dev/keys' },
    { text: 'Follow us', href: 'https://x.com/lumenworks' },
  ],
});

describe('runTrust (reassuring signs)', () => {
  it('trusts a company notice whose links stay on its own domain, judging the domain not the address', () => {
    const t = trustOf(keyNotice);
    expect(t.trusted).toBe(true);
    expect(t.senderBase).toBe('lumenworks.dev');
    expect(t.nameMatch).toBe(true);
    expect(t.reasons.join(' ')).toMatch(/lumenworks\.dev/);
  });

  it('does not treat mail.<company> as a free-mail account', () => {
    expect(trustOf(keyNotice).trusted).toBe(true); // "mail." prefix used to match the free-mail rule
  });

  it('never trusts personal free-mail senders, even with no warning signs', () => {
    expect(trustOf(email({ fromName: 'Sam', fromEmail: 'sam@gmail.com', body: 'Dinner at 5?' })).trusted).toBe(false);
  });

  it('does not trust when a link leaves the sender’s domain', () => {
    const e = { ...keyNotice, links: [{ text: 'Renew', href: 'https://lumenworks-renew.top/login' }] };
    expect(trustOf(e).trusted).toBe(false);
  });

  it('does not trust a link whose text names a different site', () => {
    const e = { ...keyNotice, links: [{ text: 'www.lumenworks.dev/login', href: 'https://evil.example/login' }] };
    expect(trustOf(e).trusted).toBe(false);
  });

  it('does not trust brand-plus-service-word domains, even when self-consistent', () => {
    const e = email({
      fromName: 'Pinecrest Utilities', fromEmail: 'billing@pinecrest-utilities-billing.com',
      body: 'Update your payment method immediately: https://pinecrest-utilities-billing.com/pay',
      links: [{ text: 'Pay', href: 'https://pinecrest-utilities-billing.com/pay' }],
    });
    expect(trustOf(e).trusted).toBe(false);
  });

  it('does not trust requests for gift cards or a phone call, whatever the sender', () => {
    const gift = { ...keyNotice, body: 'Please buy gift cards and send me the codes.' };
    expect(trustOf(gift).trusted).toBe(false);
  });

  it('only accepts a request for a password when the links go to the sender’s own site', () => {
    const noLinks = { ...keyNotice, body: 'Reply and confirm your password to keep access.', links: [] };
    expect(trustOf(noLinks).trusted).toBe(false);
  });

  it('separates every scam from every genuine company email in the sample set', () => {
    for (const s of SAMPLES) {
      const t = trustOf(toEmail(s));
      if (s.label !== 'safe') expect(t.trusted, s.id).toBe(false);
    }
    for (const id of ['api-key-expiry', 'renewal-notice', 'password-reset-real', 'receipt', 'real-security-alert']) {
      expect(trustOf(toEmail(SAMPLES.find((s) => s.id === id))).trusted, id).toBe(true);
    }
  });
});

describe('calibrate', () => {
  const trust = trustOf(keyNotice);
  const scam = { verdict: 'scam', confidence: 90, why: 'Urgent request about your key.', flags: [{ type: 'urgency', text: 'Says act now' }, { type: 'credential_request', text: 'Mentions API key' }] };

  it('corrects a "scam" built only on soft reasons when the sender checks out', () => {
    const r = calibrate(scam, trust);
    expect(r.verdict).toBe('safe');
    expect(r.adjusted).toEqual({ from: 'scam' });
    expect(r.why).toMatch(/lumenworks\.dev/);
    expect(r.flags).toEqual([]);
  });

  it('only softens to "Be careful?" when the model names a concrete ask (payment, secrecy, call…)', () => {
    const r = calibrate({ ...scam, flags: [{ type: 'payment_request', text: 'Asks you to pay' }] }, trust);
    expect(r.verdict).toBe('suspicious');
  });

  it('ignores a concrete reason the email gives no evidence for (Nano sometimes invents one)', () => {
    const invented = { ...scam, flags: [{ type: 'payment_request', text: 'Implies you must create a new key' }] };
    expect(calibrate(invented, trust, keyNotice).verdict).toBe('safe');
    const priced = { ...keyNotice, body: 'Your plan renews for $59.99 on December 3.' };
    expect(calibrate(invented, trust, priced).verdict).toBe('suspicious');
  });

  it('leaves results alone when the sender is not trusted, or the verdict is already safe', () => {
    expect(calibrate(scam, { trusted: false })).toBe(scam);
    const safe = { verdict: 'safe', confidence: 95, why: 'Normal mail', flags: [] };
    expect(calibrate(safe, trust)).toBe(safe);
  });

  it('corrects the streamed verdict too, so "Scam" never flashes first', () => {
    expect(calibratePartial({ verdict: 'scam' }, trust).verdict).toBe('safe');
    expect(calibratePartial({ verdict: 'scam' }, { trusted: false }).verdict).toBe('scam');
  });
});

describe('prompt', () => {
  it('shows long automated addresses tidily, but keeps personal ones', () => {
    expect(tidyAddress('no-reply-AP3ihr4GOFs_26uTAyRX3w@mail.lumenworks.dev')).toBe('no-reply-…@mail.lumenworks.dev');
    expect(tidyAddress('JohnSmith1985Official@gmail.com')).toBe('JohnSmith1985Official@gmail.com');
  });

  it('tells the model the sender’s domain and the reassuring signs', () => {
    const p = scanPrompt(keyNotice, runRecon(keyNotice), undefined, trustOf(keyNotice));
    expect(p).toMatch(/Sender domain: lumenworks\.dev/);
    expect(p).toMatch(/Reassuring signs/);
    expect(p).not.toMatch(/AP3ihr4GOFs/);
  });
});
