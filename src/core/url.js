// URL helpers shared by recon, cleanup and redaction. Pure functions, no browser APIs.

// Second-level public suffixes we see in practice (co.uk, com.au…). Not a full PSL, but enough
// to compare "is this the same organisation's domain?" sensibly.
const MULTI_PART_SUFFIX = /\.(co|com|org|net|gov|ac|edu)\.[a-z]{2}$/;

/** Unwrap Gmail/Google and common tracker redirect links so we judge the real destination. */
export function realUrl(href = '') {
  try {
    const u = new URL(href);
    if (/(^|\.)google\.[a-z.]+$/.test(u.hostname) && u.pathname === '/url') {
      return u.searchParams.get('q') || u.searchParams.get('url') || href;
    }
    return href;
  } catch {
    return href;
  }
}

export function hostOf(url = '') {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/** Registrable domain: last two labels, or last three for co.uk-style suffixes. */
export function baseDomain(host = '') {
  const h = host.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  const parts = h.split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  return (MULTI_PART_SUFFIX.test(h) ? parts.slice(-3) : parts.slice(-2)).join('.');
}

/** scheme://host/path only: query strings and fragments often carry tracking IDs or tokens. */
export function stripQuery(url = '') {
  return url.replace(/[?#].*$/, '');
}
