import { describe, it, expect } from 'vitest';
import { runRecon, reconVerdict, baseDomain } from '../src/core/recon.js';

const types = (e) => runRecon({ fromName: '', fromEmail: '', subject: '', body: '', links: [], ...e }).map((f) => f.type);

describe('recon', () => {
  it('flags brand impersonation from a free-mail account', () => {
    expect(types({ fromName: 'PayPal Support', fromEmail: 'paypal.help.desk@gmail.com' })).toContain('impersonation');
  });
  it('does not flag a brand sending from its own domain', () => {
    expect(types({ fromName: 'PayPal', fromEmail: 'service@paypal.com', subject: 'Your receipt' })).toEqual([]);
  });
  it('flags look-alike domains (digit swaps and brand-plus-words)', () => {
    expect(types({ links: [{ text: 'Log in', href: 'https://paypa1.com/login' }] })).toContain('lookalike_domain');
    expect(types({ fromEmail: 'alerts@amazon-account-verify.com' })).toContain('lookalike_domain');
    expect(types({ links: [{ text: 'x', href: 'https://xn--pple-43d.com/' }] })).toContain('lookalike_domain');
  });
  it('flags link text that names a different domain', () => {
    const f = runRecon({ fromEmail: 'a@b.com', links: [{ text: 'www.mybank.com/secure', href: 'https://mybank-secure.top/x' }] });
    expect(f[0].type).toBe('link_mismatch');
    expect(f[0].evidence).toEqual({ kind: 'link', host: 'mybank-secure.top' });
  });
  it('unwraps Google redirect links before judging', () => {
    expect(types({ links: [{ text: 'site.com', href: 'https://www.google.com/url?q=https://other.top/' }] })).toContain('link_mismatch');
  });
  it('flags bare IPs and shorteners', () => {
    expect(types({ links: [{ text: 'x', href: 'http://192.168.4.20/pay' }] })).toContain('suspicious_link');
    expect(types({ links: [{ text: 'x', href: 'https://bit.ly/abc' }] })).toContain('suspicious_link');
  });
  it('flags gift cards, credentials, secrecy, tech-support phone pressure', () => {
    const t = types({ body: "Buy 3 gift cards and send the codes. Don't tell anyone. Verify your password here. Call our support at (555) 010-2231." });
    expect(t).toEqual(expect.arrayContaining(['payment_request', 'secrecy', 'credential_request', 'call_now']));
  });
  it('does not flag ordinary mail', () => {
    expect(types({ fromName: 'Dana', fromEmail: 'dana@maplegrovegardens.org', subject: 'Seed swap Thursday', body: 'Bring seedlings! Potluck sign-up at the desk.' })).toEqual([]);
  });
  it('turns findings into an instant preliminary verdict', () => {
    expect(reconVerdict([]).verdict).toBe('safe');
    expect(reconVerdict([{ weight: 1 }, { weight: 1 }]).verdict).toBe('suspicious');
    expect(reconVerdict([{ weight: 4 }, { weight: 3 }]).verdict).toBe('scam');
  });
  it('baseDomain handles multi-part suffixes', () => {
    expect(baseDomain('www.mail.example.co.uk')).toBe('example.co.uk');
    expect(baseDomain('a.b.example.com')).toBe('example.com');
  });
});
