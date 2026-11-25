import { describe, it, expect } from 'vitest';
import { cleanBody, dedupeLinks, prepareEmail } from '../src/core/clean.js';

describe('cleanBody', () => {
  it('strips Gmail-style quoted reply history', () => {
    const body = 'Sounds good, see you then.\n\nOn Mon, Mar 3, 2026 at 9:12 AM Pat Lee <pat@example.com> wrote:\n> Are we still on?\n> Thanks';
    expect(cleanBody(body).text).toBe('Sounds good, see you then.');
  });

  it('strips forwarded / Outlook history', () => {
    expect(cleanBody('FYI below\n\n---------- Forwarded message ---------\nFrom: x').text).toBe('FYI below');
    expect(cleanBody('Hi\n\n-----Original Message-----\nFrom: x').text).toBe('Hi');
    expect(cleanBody('Hi\n\nFrom: Bob\nSent: Monday\nTo: me').text).toBe('Hi');
  });

  it('strips signatures and legal footers in the lower part of the email', () => {
    const body = 'Line one\nLine two\nLine three\nLine four\n--\nDana\n(555) 010-2231';
    expect(cleanBody(body).text).toBe('Line one\nLine two\nLine three\nLine four');
    const nl = 'Big sale this week\nEverything 20% off\nShop now\nSee you\nYou are receiving this because you subscribed.\nUnsubscribe';
    expect(cleanBody(nl).text).toBe('Big sale this week\nEverything 20% off\nShop now\nSee you');
  });

  it('does not cut a short email at an early footer-looking line', () => {
    expect(cleanBody('Unsubscribe me from this list please.').text).toBe('Unsubscribe me from this list please.');
  });

  it('removes zero-width characters and collapses whitespace', () => {
    expect(cleanBody('Pay\u200bPal   account\n\n\n\nlocked').text).toBe('PayPal account\n\nlocked');
    expect(cleanBody('[image: logo] Hello').text).toBe('Hello');
  });

  it('caps length on a word boundary and marks truncation', () => {
    const { text, removed } = cleanBody('word '.repeat(1000), 100);
    expect(text.length).toBeLessThanOrEqual(104);
    expect(text.endsWith('[…]')).toBe(true);
    expect(removed).toBeGreaterThan(4000);
  });
});

describe('dedupeLinks', () => {
  it('keeps one link per domain, prefers mismatched ones, unwraps redirects, caps count', () => {
    const links = [
      { text: 'Home', href: 'https://shop.example.com/a' },
      { text: 'Help', href: 'https://www.example.com/help' },
      { text: 'www.mybank.com', href: 'https://www.google.com/url?q=https://mybank.verify-login.top/x' },
      ...Array.from({ length: 20 }, (_, i) => ({ text: '', href: `https://site${i}.org/` })),
    ];
    const out = dedupeLinks(links, 8);
    expect(out).toHaveLength(8);
    expect(out[0]).toMatchObject({ host: 'mybank.verify-login.top', mismatch: true });
    expect(out.filter((l) => l.host.endsWith('example.com'))).toHaveLength(1);
  });

  it('ignores unparseable links', () => {
    expect(dedupeLinks([{ text: 'x', href: 'javascript:void(0)' }, { text: 'y', href: 'not a url' }])).toEqual([]);
  });
});

describe('prepareEmail', () => {
  it('does not mutate input and reports trimmed chars', () => {
    const email = { subject: '  Hi   there ', body: 'a\n\n\n\nb', links: [] };
    const out = prepareEmail(email);
    expect(out.subject).toBe('Hi there');
    expect(out.body).toBe('a\n\nb');
    expect(email.body).toBe('a\n\n\n\nb');
  });
});
