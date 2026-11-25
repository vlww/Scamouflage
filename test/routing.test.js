// Routing/race tests for scanEmail with a fake Firebase AI SDK and a fake Chrome LanguageModel.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls = [];
const behaviour = { on_device: null, in_cloud: null };
const config = { hedge_ms: 60, ondevice_timeout_ms: 2000, max_body_chars: 1800, max_links: 8, prompt_version: 'v2', cloud_model: 'test' };

vi.mock('../src/firebase.js', () => ({ ai: {} }));
vi.mock('../src/config.js', () => ({ cfg: (k) => config[k] }));
vi.mock('firebase/ai', () => {
  const InferenceMode = { ONLY_ON_DEVICE: 'only_on_device', ONLY_IN_CLOUD: 'only_in_cloud', PREFER_ON_DEVICE: 'prefer_on_device' };
  const sleep = (ms, signal) =>
    new Promise((res, rej) => {
      const t = setTimeout(res, ms);
      signal?.addEventListener('abort', () => {
        clearTimeout(t);
        rej(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      });
    });
  return {
    InferenceMode,
    InferenceSource: { ON_DEVICE: 'on_device', IN_CLOUD: 'in_cloud' },
    getGenerativeModel: (_ai, { mode }) => ({
      async generateContentStream(request, opts) {
        const source = mode === InferenceMode.ONLY_ON_DEVICE ? 'on_device' : 'in_cloud';
        const b = behaviour[source];
        calls.push({ source, request, signal: opts?.signal });
        if (b.failOnce) {
          const msg = b.failOnce;
          b.failOnce = null;
          await sleep(5);
          throw new Error(msg);
        }
        if (b.fail) {
          await sleep(b.fail);
          throw new Error(`${source} broke`);
        }
        await sleep(b.start, opts?.signal);
        const json = JSON.stringify({ verdict: b.verdict || 'scam', confidence: 90, why: `from ${source}`, flags: [] });
        async function* stream() {
          for (const part of [json.slice(0, 20), json.slice(20)]) {
            await sleep(5, opts?.signal);
            yield { text: () => part, inferenceSource: source };
          }
        }
        return { stream: stream() };
      },
    }),
  };
});

globalThis.self ??= globalThis;
globalThis.LanguageModel = { availability: async () => 'available' };

const { scanEmail } = await import('../src/ai.js');
const email = { fromName: 'X', fromEmail: 'pat.lee@example-mail.top', subject: 'Pay now', body: 'Call 555-010-2231 and pay the fee.', links: [] };

beforeEach(() => {
  calls.length = 0;
});

describe('scanEmail routing', () => {
  // Runs first, while the module has never seen Nano answer (cold).
  it('model still loading: the cloud backup starts at once, not after hedge_ms', async () => {
    config.hedge_ms = 2000;
    behaviour.on_device = { start: 600 };
    behaviour.in_cloud = { start: 10 };
    try {
      const out = await scanEmail(email, { allowCloud: true });
      expect(out.source).toBe('in_cloud');
      expect(out.note).toBe('warming');
    } finally {
      config.hedge_ms = 60;
    }
  });

  it('fast on-device answer: no cloud request at all', async () => {
    behaviour.on_device = { start: 10 };
    behaviour.in_cloud = { start: 10 };
    const out = await scanEmail(email, { allowCloud: true });
    expect(out.source).toBe('on_device');
    expect(calls.map((c) => c.source)).toEqual(['on_device']);
  });

  it('slow (cold) on-device + cloud help on: redacted cloud backup answers first', async () => {
    behaviour.on_device = { start: 400 };
    behaviour.in_cloud = { start: 10, verdict: 'suspicious' };
    const onSlow = vi.fn();
    const routes = [];
    const out = await scanEmail(email, { allowCloud: true, onSlow, onRoute: (r) => routes.push(r.source) });
    expect(out.source).toBe('in_cloud');
    expect(out.note).toBe('warming');
    expect(out.result.verdict).toBe('suspicious');
    expect(onSlow).toHaveBeenCalledWith({ hedging: true });
    expect(routes.at(-1)).toBe('in_cloud');
    const cloudPrompt = calls.find((c) => c.source === 'in_cloud').request;
    expect(cloudPrompt).not.toMatch(/pat\.lee|2231/); // only redacted text goes to the cloud
  });

  it('slow on-device + cloud not allowed (automatic check): waits for the device, explains the wait', async () => {
    behaviour.on_device = { start: 200 };
    const onSlow = vi.fn();
    const out = await scanEmail(email, { allowCloud: false, onSlow });
    expect(out.source).toBe('on_device');
    expect(onSlow).toHaveBeenCalledWith({ hedging: false });
    expect(calls.every((c) => c.source === 'on_device')).toBe(true);
  });

  it('device wins after the backup started: backup is aborted and device result is used', async () => {
    behaviour.on_device = { start: 90 };
    behaviour.in_cloud = { start: 500 };
    const out = await scanEmail(email, { allowCloud: true });
    expect(out.source).toBe('on_device');
    const cloud = calls.find((c) => c.source === 'in_cloud');
    expect(cloud.signal.aborted).toBe(true);
  });

  it('device breaks before the backup: falls back to redacted cloud', async () => {
    behaviour.on_device = { fail: 5 };
    behaviour.in_cloud = { start: 10 };
    const out = await scanEmail(email, { allowCloud: true });
    expect(out.source).toBe('in_cloud');
    expect(out.note).toBe('failed');
  });

  it('device breaks while the backup is running: uses the backup', async () => {
    behaviour.on_device = { fail: 100 };
    behaviour.in_cloud = { start: 150 };
    const out = await scanEmail(email, { allowCloud: true });
    expect(out.source).toBe('in_cloud');
    expect(out.note).toBe('warming');
  });

  it('backup fails but device answers: device result is used', async () => {
    behaviour.on_device = { start: 200 };
    behaviour.in_cloud = { fail: 5 };
    const out = await scanEmail(email, { allowCloud: true });
    expect(out.source).toBe('on_device');
  });

  it('cloud not allowed and device breaks: the error surfaces (UI shows the quick-check answer)', async () => {
    behaviour.on_device = { fail: 5 };
    await expect(scanEmail(email, { allowCloud: false })).rejects.toThrow('on_device broke');
  });

  it('once Nano has answered, a slower start waits the normal hedge_ms', async () => {
    behaviour.on_device = { start: 10 };
    await scanEmail(email, { allowCloud: true }); // warm
    config.hedge_ms = 400;
    behaviour.on_device = { start: 250 };
    behaviour.in_cloud = { start: 10 };
    calls.length = 0;
    try {
      const out = await scanEmail(email, { allowCloud: true });
      expect(out.source).toBe('on_device');
      expect(calls.map((c) => c.source)).toEqual(['on_device']);
    } finally {
      config.hedge_ms = 60;
    }
  });

  it('a dropped cloud connection is retried once', async () => {
    globalThis.LanguageModel.availability = async () => 'unavailable';
    behaviour.in_cloud = { start: 10, failOnce: 'Failed to fetch' };
    try {
      const out = await scanEmail(email, { allowCloud: true });
      expect(out.source).toBe('in_cloud');
      expect(calls.filter((c) => c.source === 'in_cloud')).toHaveLength(2);
    } finally {
      globalThis.LanguageModel.availability = async () => 'available';
    }
  });
});
