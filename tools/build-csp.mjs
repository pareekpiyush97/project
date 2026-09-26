/* Regenerates the Content-Security-Policy meta on every page.
   Run it after editing ANY inline <script> or <style>, or the hash stops
   matching and the browser silently refuses to run that block:
       node tools/build-csp.mjs

   Why hashes and not 'unsafe-inline': the redirect guard has to run before
   first paint or a phone shows a frame of the desktop build before it leaves,
   so it cannot move to an external file. A hash pins that exact source and
   nothing else. Every style="" attribute was moved to a utility class for the
   same reason, so style-src needs no escape hatch at all.

   frame-ancestors is deliberately absent: it is ignored in a meta policy and
   GitHub Pages cannot send real headers, so clickjacking cannot be closed
   from inside the document. Nothing here is click-hijackable — no forms, no
   session, no state-changing controls — but that is a property of the site,
   not a protection. */
import fs from 'node:fs';
import crypto from 'node:crypto';

// The HTML parser normalises CRLF and lone CR to LF before the document is
// tokenised, so the browser hashes LF-only text. On a Windows checkout the
// file on disk is CRLF, and hashing those bytes yields a digest that never
// matches — the policy then silently refuses to run the block. Built from
// char codes to keep this line free of escape sequences.
const CR = String.fromCharCode(13), LF = String.fromCharCode(10);
const normalise = s => s.split(CR + LF).join(LF).split(CR).join(LF);
const sha = s => "'sha256-" + crypto.createHash('sha256').update(normalise(s), 'utf8').digest('base64') + "'";
const blocks = (html, tag) =>
  // built by concatenation, not a template literal: \s inside a template
  // literal is just 's', which silently turns this into a regex that matches
  // almost nothing and hashes zero blocks.
  // Backslash-free on purpose: every escaping layer between here and disk
  // has mangled \s at least once. [^] is JS for 'any character'.
  [...html.matchAll(new RegExp('<' + tag + '(?![^>]*src=)[^>]*>([^]*?)</' + tag + '>', 'g'))].map(m => m[1]);

const POLICY = (scriptSrc, styleSrc) => [
  "default-src 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  "form-action 'none'",
  `script-src ${scriptSrc}`,
  `style-src ${styleSrc}`,
  "img-src 'self' data:",
  "media-src 'self'",
  "font-src 'self'",
  "connect-src 'none'",
  'upgrade-insecure-requests'
].join('; ');

const META_RE = /\n?<meta http-equiv="Content-Security-Policy"[\s\S]*?>\n?|\n?<meta name="referrer"[^>]*>\n?/g;

for (const f of process.argv.slice(2)) {
  let html = fs.readFileSync(f, 'utf8');
  html = html.replace(META_RE, '\n');                       // idempotent: drop old ones first

  const scripts = blocks(html, 'script').filter(s => s.trim());
  const styles  = blocks(html, 'style').filter(s => s.trim());

  const scriptSrc = scripts.length ? `'self' ${scripts.map(sha).join(' ')}` : "'self'";
  const styleSrc  = styles.length  ? `'self' ${styles.map(sha).join(' ')}`  : "'self'";

  const meta =
    `<meta http-equiv="Content-Security-Policy" content="${POLICY(scriptSrc, styleSrc)}" />\n` +
    `<meta name="referrer" content="strict-origin-when-cross-origin" />`;

  // must sit before the inline guard, or the hash governs nothing
  html = html.replace(/(<meta charset="[^"]*"\s*\/?>)/i, `$1\n${meta}`);
  fs.writeFileSync(f, html);
  console.log(`  ${f.padEnd(13)} ${scripts.length} script hash, ${styles.length} style hash`);
}
