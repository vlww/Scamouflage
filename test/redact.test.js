import { describe, it, expect } from 'vitest';
import { redact, redactEmail } from '../src/core/redact.js';

const r = (s) => redact(s).text;

describe('redact: removes personal details', () => {
  it.each([
    ['Card 4111 1111 1111 1111 on file', '[card]'],
    ['card 4111-1111-1111-1111', '[card]'],
    ['card 4111111111111111', '[card]'],
    ['Amex 3782 822463 10005', '[card]'],
  ])('cards: %s', (input, label) => {
    expect(r(input)).toContain(label);
    expect(r(input)).not.toMatch(/\d{4}/);
  });

  it('non-Luhn long digit runs become account numbers', () => {
    expect(r('Account 1234567890123 is frozen')).toContain('[account-number]');
  });

  it.each([
    'SSN 123-45-6789',
    'ssn: 123 45 6789',
  ])('SSNs: %s', (input) => {
    expect(r(input)).toContain('[ssn]');
    expect(r(input)).not.toMatch(/6789/);
  });

  it.each([
    'Call (555) 010-2231 now',
    'Call 555-010-2231 now',
    'Call 555.010.2231 now',
    'Call +1 555 010 2231 now',
    'Call +44 20 7946 0958 now',
  ])('phones: %s', (input) => {
    expect(r(input)).toContain('[phone]');
    expect(r(input)).not.toMatch(/2231|0958/);
  });

  it.each([
    'Reply to margaret.smith@example.com',
    'from pat+news@mail.example.co.uk today',
  ])('emails: %s', (input) => {
    expect(r(input)).toContain('[email]');
    expect(r(input)).not.toMatch(/@/);
  });

  it.each([
    ['Account number: 88213004', '[account-number]'],
    ['acct # A77-12345', '[account-number]'],
    ['Member ID 9X88213', '[account-number]'],
    ['routing number 021000021', '[account-number]'],
    ['IBAN GB82 WEST 1234 5698 7654 32', '[bank-account]'],
  ])('account numbers: %s', (input, label) => {
    expect(r(input)).toContain(label);
  });

  it('verification codes and long reference numbers', () => {
    expect(r('Your code is 482913')).toBe('Your code is [number]');
  });

  it('names in greetings', () => {
    expect(r('Dear Margaret Smith,\nYour account')).toBe('Dear [name],\nYour account');
    expect(r('Hi Pat!')).toBe('Hi [name]!');
  });

  it('street addresses', () => {
    expect(r('Ship to 4400 North Oak Avenue Apt 3 today')).toBe('Ship to [address] today');
    expect(r('We are at 12 Elm St.')).toContain('[address]');
  });

  it('strips query strings (tracking IDs, tokens) from URLs but keeps the domain', () => {
    const out = r('Go to https://evil.example.top/login?user=pat@example.com&t=abc123#x now');
    expect(out).toBe('Go to https://evil.example.top/login now');
  });

  it('counts replacements', () => {
    expect(redact('a@b.com and 555-010-2231').count).toBe(2);
  });
});

describe('redact: keeps evidence (false-positive guards)', () => {
  it.each([
    'Pay the $1.99 customs fee',
    'Total: $1,299.99',
    'Meeting on 2026-03-03 at 10:30 AM',
    'Back in 2025 we said',
    'Valid until 03/15/2026',
    'Order of 3 items, 24 hours left',
    'Dear Customer, your package',
    'Hello there, friend',
    'Visit https://parcelpost-redelivery.top/confirm',
    'Version 13.4.0 is out',
  ])('leaves untouched: %s', (input) => {
    expect(r(input)).toBe(input);
  });

  it('keeps link domains as evidence', () => {
    expect(r('http://192.168.10.5/pay')).toBe('http://192.168.10.5/pay');
  });
});

describe('redactEmail', () => {
  it('keeps sender domain but hides the mailbox and redacts all fields', () => {
    const { email, count } = redactEmail({
      fromName: 'Support 555-010-2231',
      fromEmail: 'margaret.smith@bank-alerts.top',
      subject: 'Card 4111 1111 1111 1111 locked',
      body: 'Dear Margaret Smith, call (555) 010-2231.',
      links: [{ text: 'Log in', href: 'https://www.google.com/url?q=https://bank-alerts.top/x?id=pat@example.com' }],
    });
    expect(email.fromEmail).toBe('[sender]@bank-alerts.top');
    expect(email.fromName).toBe('Support [phone]');
    expect(email.subject).toBe('Card [card] locked');
    expect(email.body).toBe('Dear [name], call [phone].');
    expect(email.links[0].href).toBe('https://bank-alerts.top/x');
    expect(email.links[0].host).toBe('bank-alerts.top');
    expect(count).toBeGreaterThanOrEqual(5);
    expect(JSON.stringify(email)).not.toMatch(/margaret|smith|2231|4111|pat@/i);
  });
});
