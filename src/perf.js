// Lightweight timing instrumentation. Logged in development builds (npm run dev) or when
// localStorage 'scamouflage.debug' = '1'; always returned with every scan result.

export const DEBUG = (() => {
  if (import.meta.env.MODE === 'development') return true;
  try {
    return localStorage.getItem('scamouflage.debug') === '1';
  } catch {
    return false;
  }
})();

export function timer() {
  const t0 = performance.now();
  const marks = {};
  return {
    mark(name) {
      if (!(name in marks)) marks[name] = Math.round(performance.now() - t0);
      return marks[name];
    },
    get marks() {
      return { ...marks };
    },
  };
}

export function logTimings(label, data) {
  if (!DEBUG) return;
  console.info(`[Scamouflage] ⏱ ${label}`, JSON.stringify(data));
  (globalThis.__scamoTimings ||= []).push({ label, ...data });
}
