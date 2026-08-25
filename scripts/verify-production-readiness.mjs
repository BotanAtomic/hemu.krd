import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const supportSource = await readFile('src/support.ts', 'utf8');
const supportMatch = /SUPPORT_EMAIL\s*=\s*'([^']+)'/u.exec(supportSource);
assert(supportMatch, 'src/support.ts must declare SUPPORT_EMAIL');
const supportEmail = supportMatch[1];

const legalPages = [
  'public/privacy/index.html',
  'public/terms/index.html',
  'public/data-deletion/index.html',
];
for (const path of legalPages) {
  const html = await readFile(path, 'utf8');
  assert.match(html, new RegExp(`mailto:${supportEmail.replace(/[.+?^${}()|[\]\\]/gu, '\\$&')}`, 'u'), `${path} must use SUPPORT_EMAIL`);
  assert.doesNotMatch(html, /mailto:contact@botan\.dev/u, `${path} must not use a stale support address`);
}

const privacy = await readFile('public/privacy/index.html', 'utf8');
const amplitudeDisclosureRequirements = [
  ['Amplitude disclosure marker', /data-analytics-disclosure="amplitude"/u],
  ['complete Amplitude event allowlist', /only two event types:\s*<code>app_open<\/code>[\s\S]*<code>auth_signed_in<\/code>/u],
  ['auth event field boundary', /only the sign-in method and whether the sign-in created a new account/u],
  ['random SDK device identifier', /randomly generated Amplitude SDK device identifier/u],
  ['analytics data-use classification', /product-interaction and device-ID data used for analytics/u],
  ['no Amplitude account identity', /do not set an Amplitude account or user ID/u],
  ['no automatic capture or session replay', /Automatic event capture and session replay are not enabled/u],
  ['no account, content, contact, location, advertising, or platform identifiers', /not to receive account identifiers;[\s\S]*listing, message, media, or search content;[\s\S]*contact data;[\s\S]*location data;[\s\S]*advertising identifiers;[\s\S]*platform identifiers/u],
  ['no cross-app tracking', /do not use Amplitude for cross-app tracking/u],
  ['Amplitude US data region', /currently configured Amplitude project uses its US data region/u],
  ['Crashlytics diagnostics boundary', /data-diagnostics-disclosure="crashlytics"[\s\S]*Crashlytics remains the destination for error diagnostics[\s\S]*not sent to Amplitude/u],
];
for (const [label, pattern] of amplitudeDisclosureRequirements) {
  assert.match(privacy, pattern, `privacy policy must disclose ${label}`);
}

const app = await readFile('src/App.tsx', 'utf8');
assert.match(app, /import\s*\{\s*SUPPORT_EMAIL\s*\}\s*from\s*'\.\/support'/u, 'landing page must use SUPPORT_EMAIL');

const firebase = JSON.parse(await readFile('firebase.json', 'utf8'));
assert(Array.isArray(firebase.hosting?.headers), 'firebase.json must configure security headers');
const globalHeaders = firebase.hosting.headers.find((entry) => entry.source === '**');
assert(globalHeaders, 'firebase.json must apply headers to every response');
const headerNames = new Set(globalHeaders.headers.map((header) => header.key.toLowerCase()));
for (const expected of ['content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy']) {
  assert(headerNames.has(expected), `missing ${expected} in Firebase headers`);
}
const csp = globalHeaders.headers.find((header) => header.key.toLowerCase() === 'content-security-policy')?.value;
assert(typeof csp === 'string' && !csp.includes('unsafe-eval') && !csp.includes('*'), 'CSP must not use unsafe-eval or wildcards');

console.log(`Production-readiness configuration is valid for ${supportEmail}.`);
