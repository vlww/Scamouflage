// Stable content key for caching results (FNV-1a). Mirrors the copy in public/content.js.
export function emailKey(e) {
  const s = `${e.fromEmail || ''}|${e.subject || ''}|${(e.body || '').slice(0, 4000)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
