// Fails if the App Check debug token (or anything that looks like it) ended up in the public web build.
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(import.meta.dirname, '..', 'dist-web');
const env = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
const token = env.match(/^VITE_APPCHECK_DEBUG_TOKEN=(.+)$/m)?.[1]?.trim();
const files = fs.readdirSync(dir, { recursive: true }).map((f) => path.join(dir, f)).filter((f) => fs.statSync(f).isFile());
let bad = 0;
for (const f of files) {
  const text = fs.readFileSync(f, 'latin1');
  if ((token && text.includes(token)) || /FIREBASE_APPCHECK_DEBUG_TOKEN\s*=\s*["'][0-9A-F-]{20,}/i.test(text)) {
    console.error(`✗ debug token found in ${path.relative(dir, f)}`);
    bad++;
  }
}
if (bad) process.exit(1);
console.log(`✓ No App Check debug token in ${files.length} web build files.`);
