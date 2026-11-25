import { describe, it, expect } from 'vitest';
import { parsePartialJson, parseFinalJson } from '../src/core/partial-json.js';

const full = '{"verdict":"scam","confidence":92,"why":"Fake delivery fee to steal your card.","flags":[{"type":"urgency","text":"24-hour deadline"},{"type":"payment_request","text":"Asks for gift cards"}]}';

describe('parsePartialJson', () => {
  it('returns null until an object starts', () => {
    expect(parsePartialJson('')).toBeNull();
    expect(parsePartialJson('  ')).toBeNull();
  });

  it('parses every prefix of a real response without throwing, and is monotonic on verdict', () => {
    let sawVerdict = false;
    for (let i = 1; i <= full.length; i++) {
      const out = parsePartialJson(full.slice(0, i));
      if (sawVerdict) expect(out?.verdict).toBe('scam');
      if (out?.verdict === 'scam') sawVerdict = true;
      // Mid-stream the verdict may be a prefix ("s", "sca"); consumers only accept full enum values.
      if (out?.verdict) expect('scam'.startsWith(out.verdict)).toBe(true);
    }
    expect(sawVerdict).toBe(true);
  });

  it('exposes the verdict as soon as its string closes', () => {
    expect(parsePartialJson('{"verdict":"sca')).toEqual({ verdict: 'sca' });
    expect(parsePartialJson('{"verdict":"scam",')).toEqual({ verdict: 'scam' });
  });

  it('drops numbers that may still be growing', () => {
    expect(parsePartialJson('{"verdict":"scam","confidence":9')).toEqual({ verdict: 'scam' });
    expect(parsePartialJson('{"verdict":"scam","confidence":92,')).toEqual({ verdict: 'scam', confidence: 92 });
  });

  it('streams strings in as they arrive', () => {
    expect(parsePartialJson('{"verdict":"safe","confidence":80,"why":"Looks like a nor')).toMatchObject({ why: 'Looks like a nor' });
  });

  it('drops dangling keys', () => {
    expect(parsePartialJson('{"verdict":"safe","conf')).toEqual({ verdict: 'safe' });
    expect(parsePartialJson('{"verdict":"safe","confidence"')).toEqual({ verdict: 'safe' });
    expect(parsePartialJson('{"verdict":"safe","confidence":')).toEqual({ verdict: 'safe' });
  });

  it('handles nested arrays/objects mid-stream', () => {
    const p = parsePartialJson('{"verdict":"scam","flags":[{"type":"urgency","text":"Act no');
    expect(p.flags[0]).toEqual({ type: 'urgency', text: 'Act no' });
    expect(parsePartialJson('{"flags":["a","b')).toEqual({ flags: ['a', 'b'] });
  });

  it('handles escapes, including a trailing backslash', () => {
    expect(parsePartialJson('{"why":"He said \\"pay\\" now')).toEqual({ why: 'He said "pay" now' });
    expect(parsePartialJson('{"why":"abc\\')).toEqual({ why: 'abc' });
  });

  it('strips markdown fences', () => {
    expect(parsePartialJson('```json\n{"verdict":"safe"}\n```')).toEqual({ verdict: 'safe' });
  });
});

describe('parseFinalJson', () => {
  it('parses clean JSON', () => {
    expect(parseFinalJson(full).confidence).toBe(92);
  });
  it('recovers from chatter around the JSON', () => {
    expect(parseFinalJson('Sure! Here you go:\n{"verdict":"safe","confidence":70}\nHope that helps')).toEqual({ verdict: 'safe', confidence: 70 });
  });
  it('recovers a truncated answer if the verdict made it', () => {
    expect(parseFinalJson('{"verdict":"scam","confidence":90,"why":"Fake fee').verdict).toBe('scam');
  });
  it('throws on garbage', () => {
    expect(() => parseFinalJson('I cannot help with that.')).toThrow();
  });
});
