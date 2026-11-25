// Best-effort parser for a JSON object that is still streaming in.
// '{"verdict":"scam","confidence":9' → { verdict: 'scam' }  (incomplete trailing values are dropped,
// except strings, which are returned as far as they've arrived so text can type in live).

function stripFences(text) {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
}

/** Closes open strings/arrays/objects so JSON.parse can read what has arrived so far. */
function complete(src) {
  const stack = [];
  let inStr = false;
  let esc = false;
  let lastSafe = -1; // index after which cutting leaves valid-ish JSON
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') stack.push(c === '{' ? '}' : ']');
    else if (c === '}' || c === ']') stack.pop();
    if (!inStr && (c === ',' || c === '{' || c === '[')) lastSafe = i;
  }

  let out = src;
  if (inStr) {
    // Drop a dangling escape, then close the string.
    out = out.replace(/\\(u[0-9a-fA-F]{0,3})?$/, '') + '"';
  }
  // Remove trailing junk that can't be completed: `"key":` / `"key"` / `,` / partial literals.
  if (!inStr) {
    // A number at the very end may still be growing (9 → 92): drop it with its key.
    out = out.replace(/(,?\s*"(?:[^"\\]|\\.)*"\s*:\s*|,\s*)?-?\d[\d.eE+-]*$/, '');
  }
  out = out
    .replace(/,\s*$/, '')
    .replace(/,?\s*"[^"]*"\s*:\s*$/, '')
    .replace(/([:[,]\s*)(t|tr|tru|f|fa|fal|fals|n|nu|nul|-)\s*$/, '$1null');
  // In an object, a trailing string after `{` or `,` is a key with no value yet: drop it.
  if (stack[stack.length - 1] === '}') {
    out = out.replace(/([{,])\s*"(?:[^"\\]|\\.)*"\s*$/, (m, p) => (p === '{' ? '{' : ''));
  }
  const closers = stack.slice().reverse().join('');
  try {
    return JSON.parse(out + closers);
  } catch {
    // Fall back to the last structurally safe cut point.
    if (lastSafe > 0 && lastSafe < src.length - 1) return complete(src.slice(0, lastSafe));
    return null;
  }
}

/** Returns the parsed object (possibly partial), or null if nothing usable has arrived yet. */
export function parsePartialJson(text = '') {
  const src = stripFences(text);
  const start = src.indexOf('{');
  if (start < 0) return null;
  const body = src.slice(start);
  try {
    return JSON.parse(body);
  } catch {
    return complete(body);
  }
}

/** Strict-ish parse for a finished response, with recovery for fences / trailing chatter. */
export function parseFinalJson(text = '') {
  const src = stripFences(text);
  try {
    return JSON.parse(src);
  } catch {
    const start = src.indexOf('{');
    const end = src.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(src.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    const partial = parsePartialJson(src);
    if (partial?.verdict) return partial;
    throw new Error('The model returned an unreadable answer.');
  }
}
