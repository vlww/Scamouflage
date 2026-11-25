// Web demo only: a small stand-in for the chrome.* APIs the side panel uses, so the exact same
// panel code runs on scamouflage.xyz. There's no Gmail here, only Paste and Screenshot.
// Storage is the browser's own (localStorage / sessionStorage); nothing is sent anywhere.

const changeListeners = [];
function area(store, key, emits) {
  const read = () => {
    try {
      return JSON.parse(store.getItem(key) || '{}');
    } catch {
      return {};
    }
  };
  const write = (obj) => {
    try {
      store.setItem(key, JSON.stringify(obj));
    } catch {
      /* storage blocked: fall back to nothing persisted */
    }
  };
  return {
    async get(keys) {
      const all = read();
      if (keys == null) return all;
      const list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
      return Object.fromEntries(list.filter((k) => k in all).map((k) => [k, all[k]]));
    },
    async set(obj) {
      const all = read();
      const changes = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, { oldValue: all[k], newValue: v }]));
      write({ ...all, ...obj });
      if (emits) changeListeners.forEach((f) => f(changes, 'local'));
    },
    async remove(keys) {
      const all = read();
      for (const k of [].concat(keys)) delete all[k];
      write(all);
    },
  };
}

const noopEvent = { addListener() {}, removeListener() {} };
const shim = {
  runtime: {
    id: 'web',
    getManifest: () => ({ version: __APP_VERSION__ }),
    onMessage: noopEvent,
    sendMessage: async () => undefined,
  },
  storage: {
    local: area(localStorage, 'scamouflage.local', true),
    session: area(sessionStorage, 'scamouflage.session', false),
    onChanged: { addListener: (f) => changeListeners.push(f), removeListener() {} },
  },
  tabs: {
    query: async () => [],
    sendMessage: async () => {
      throw new Error('No tabs on the web');
    },
    onActivated: noopEvent,
    onUpdated: noopEvent,
  },
  action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {}, setBadgeTextColor: async () => {}, setTitle: async () => {} },
};

/** Installs the stand-in. Chrome defines window.chrome on normal pages, so replace it explicitly. */
export function installShim() {
  Object.defineProperty(globalThis, 'chrome', { value: shim, writable: true, configurable: true });
}
