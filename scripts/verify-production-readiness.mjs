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
