// Remote Config: tune the scanner without republishing the extension.
// Strategy (per Firebase guidance): use cached/default values immediately, fetch in the
// background, and apply the new values as soon as they arrive. Never block a scan on it.

import { getRemoteConfig, fetchAndActivate, getAll } from 'firebase/remote-config';
import { app } from './firebase.js';
import { DEFAULT_MAX_BODY, DEFAULT_MAX_LINKS } from './core/clean.js';
import { DEFAULT_PROMPT_VERSION } from './core/prompt.js';

export const DEFAULTS = {
  cloud_model: 'gemini-3.5-flash-lite',
  max_body_chars: DEFAULT_MAX_BODY,
  max_links: DEFAULT_MAX_LINKS,
  // Below this on-device confidence (or on "suspicious") we offer a cloud second opinion.
  escalation_threshold: 70,
  ondevice_timeout_ms: 20000,
  prompt_version: DEFAULT_PROMPT_VERSION,
  feature_image_check: true,
  feature_auto_scan: true,
  feature_family: true,
};

let values = { ...DEFAULTS };
let rc;

function coerce(key, raw) {
  const def = DEFAULTS[key];
  if (typeof def === 'number') return Number.isFinite(+raw) && raw !== '' ? +raw : def;
  if (typeof def === 'boolean') return raw === 'true' ? true : raw === 'false' ? false : def;
  return raw || def;
}

function load() {
  const all = getAll(rc);
  for (const key of Object.keys(DEFAULTS)) {
    if (all[key]) values[key] = coerce(key, all[key].asString());
  }
}

/** Starts a background fetch; resolves when done (callers needn't await). */
export function initConfig() {
  try {
    rc = getRemoteConfig(app);
    rc.settings.minimumFetchIntervalMillis = import.meta.env.MODE === 'development' ? 60_000 : 3_600_000;
    rc.settings.fetchTimeoutMillis = 5_000;
    rc.defaultConfig = Object.fromEntries(Object.entries(DEFAULTS).map(([k, v]) => [k, String(v)]));
    load();
    return fetchAndActivate(rc)
      .then(load)
      .catch((e) => {
        if (import.meta.env.MODE === 'development') console.info('[Scamouflage] Remote Config fetch skipped:', e.code || e.message);
      });
  } catch (e) {
    if (import.meta.env.MODE === 'development') console.info('[Scamouflage] Remote Config unavailable:', e.message);
    return Promise.resolve();
  }
}

export function cfg(key) {
  return values[key];
}
export function allConfig() {
  return { ...values };
}
