import assert from 'node:assert/strict';

const origin = process.argv[2];
assert(origin, 'Usage: node scripts/verify-security-headers.mjs <origin>');

const response = await fetch(new URL('/', origin), { redirect: 'manual', signal: AbortSignal.timeout(15_000) });
assert.equal(response.status, 200, 'landing page must return HTTP 200');

const expected = new Map([
  ['x-content-type-options', /^nosniff$/iu],
  ['x-frame-options', /^DENY$/iu],
  ['referrer-policy', /^strict-origin-when-cross-origin$/iu],
  ['permissions-policy', /camera=\(\), microphone=\(\), geolocation=\(\)/iu],
]);
for (const [name, pattern] of expected) {
  const value = response.headers.get(name);
  assert(value && pattern.test(value), `missing or invalid ${name}: ${value ?? '(none)'}`);
}

const csp = response.headers.get('content-security-policy');
assert(csp, 'missing content-security-policy');
assert.match(csp, /default-src 'self'/u, 'CSP must default to self');
assert.doesNotMatch(csp, /unsafe-eval|\*/u, 'CSP must not use unsafe-eval or wildcards');
console.log(`Valid security headers: ${new URL('/', origin)}`);
