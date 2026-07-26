import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const EXAMPLE_ID = '123e4567-e89b-42d3-a456-426614174000';
const EXPECTED_REWRITES = new Map([
  ['/listing/**', '/index.html'],
  ['/u/**', '/index.html'],
  ['/signup', '/index.html'],
  ['/signup/**', '/index.html'],
]);
const SHARED_PATHS = [
  `/listing/${EXAMPLE_ID}`,
  `/u/${EXAMPLE_ID}`,
  '/signup',
  '/signup/verify',
];
const MISSING_PATH = '/__hemu_route_smoke_missing__';

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

await verifyFirebaseRewrites();

const origin = process.argv[2];
if (origin) {
  for (const pathname of SHARED_PATHS) {
    await verifySharedPath(origin, pathname);
  }
  await verifyUnknownPathStaysMissing(origin);
}
