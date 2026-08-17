import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const EXAMPLE_ID = '123e4567-e89b-42d3-a456-426614174000';
const EXPECTED_REWRITES = new Map([
  ['/listing/**', '/index.html'],
  ['/u/**', '/index.html'],
  ['/signup', '/index.html'],
  ['/signup/**', '/index.html'],
  // hemu.krd/<username>. A single `*` matches one path segment, where `**`
  // would take the whole site. Last, so the routes above still match first,
  // and static files are served ahead of any rewrite regardless.
  ['/*', '/index.html'],
]);
const SHARED_PATHS = [
  `/listing/${EXAMPLE_ID}`,
  `/u/${EXAMPLE_ID}`,
  '/signup',
  '/signup/verify',
  // A username may contain dots and underscores, and must not be mistaken for
  // a static asset.
  '/seller.one',
  '/seller_one',
];
// Serving usernames from the root means a single unknown segment can no longer
// 404 — static hosting cannot know whether a username exists, so it answers
// with the landing page, exactly as an unknown listing id already does. Only a
// deeper path is still a genuine miss.
const LANDING_FALLBACK_PATH = '/__hemu_route_smoke_missing__';
const MISSING_PATH = '/__hemu_route_smoke_missing__/nested';
// The site's own pages must keep winning over the username namespace.
const SITE_OWNED_PATHS = ['/privacy', '/terms', '/data-deletion'];

function asObject(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  return value;
}

async function verifyFirebaseRewrites() {
  const config = JSON.parse(await readFile('firebase.json', 'utf8'));
  const hosting = asObject(config.hosting, 'firebase.json hosting');
  assert(Array.isArray(hosting.rewrites), 'firebase.json hosting.rewrites must be an array');

  const actual = new Map(
    hosting.rewrites.map((value, index) => {
      const rewrite = asObject(value, `firebase.json rewrite ${index}`);
      assert.deepEqual(
        Object.keys(rewrite).sort(),
        ['destination', 'source'],
        `firebase.json rewrite ${index} contains unexpected fields`,
      );
      assert(typeof rewrite.source === 'string', `firebase.json rewrite ${index} source must be a string`);
      assert(
        typeof rewrite.destination === 'string',
        `firebase.json rewrite ${index} destination must be a string`,
      );
      return [rewrite.source, rewrite.destination];
    }),
  );

  assert.deepEqual(actual, EXPECTED_REWRITES, 'Firebase shared-link rewrites do not match the supported routes');
  console.log('Valid Firebase shared-link rewrites');
}

async function fetchWithoutRedirect(origin, pathname) {
  const url = new URL(pathname, origin);
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000) });
  return { response, url };
}

function assertHtml(response, url) {
  assert.equal(
    response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase(),
    'text/html',
    `${url} must return Content-Type: text/html`,
  );
}

async function verifySharedPath(origin, pathname) {
  const { response, url } = await fetchWithoutRedirect(origin, pathname);
  assert.equal(response.status, 200, `${url} must return HTTP 200 without a redirect`);
  assertHtml(response, url);

  const body = await response.text();
  assert.match(body, /<div id="root"><\/div>/u, `${url} must serve the hemû landing page`);
  console.log(`Valid shared-link fallback: ${url}`);
}

async function verifyUnknownPathStaysMissing(origin) {
  const { response, url } = await fetchWithoutRedirect(origin, MISSING_PATH);
  assert.equal(response.status, 404, `${url} must remain an HTTP 404`);
  assertHtml(response, url);
  console.log(`Valid unknown-route 404: ${url}`);
}

async function verifySiteOwnedPath(origin, pathname) {
  // Redirects are followed here, unlike the share-link checks: nginx resolves a
  // directory page by adding the trailing slash while Firebase Hosting is
  // configured not to, and this same script runs against both. What matters is
  // that the page still arrives, rather than the app shell having swallowed it.
  const url = new URL(pathname, origin);
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  assert.equal(response.status, 200, `${url} must still be served by the site`);
  assertHtml(response, url);
  const body = await response.text();
  assert.doesNotMatch(
    body,
    /<div id="root"><\/div>/u,
    `${url} must serve its own page, not the app shell — the username rewrite has swallowed it`,
  );
  console.log(`Valid site-owned page: ${url}`);
}

await verifyFirebaseRewrites();

const origin = process.argv[2];
if (origin) {
  for (const pathname of SHARED_PATHS) {
    await verifySharedPath(origin, pathname);
  }
  // An unknown single segment is indistinguishable from an unclaimed username,
  // so it lands on the same fallback a shared link uses.
  await verifySharedPath(origin, LANDING_FALLBACK_PATH);
  for (const pathname of SITE_OWNED_PATHS) {
    await verifySiteOwnedPath(origin, pathname);
  }
  await verifyUnknownPathStaysMissing(origin);
}
