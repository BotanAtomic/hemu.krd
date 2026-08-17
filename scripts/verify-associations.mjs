import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const EXPECTED_APP_IDS = new Set([
  'H4AD8Y6PQ2.krd.hemu.app',
  'H4AD8Y6PQ2.krd.hemu.app.staging',
]);
// Ordered, because iOS stops at the first component that matches. Everything
// the site serves itself is excluded before `/*`, which exists so a
// hemu.krd/<username> share link opens the app. Usernames may contain a dot, so
// the asset names cannot be excluded by extension and are listed one by one.
const EXPECTED_COMPONENTS = [
  { path: '/listing/*', exclude: false },
  { path: '/u/*', exclude: false },
  { path: '/signup*', exclude: false },
  { path: '/privacy*', exclude: true },
  { path: '/terms*', exclude: true },
  { path: '/data-deletion*', exclude: true },
  { path: '/.well-known/*', exclude: true },
  { path: '/og.png', exclude: true },
  { path: '/favicon.png', exclude: true },
  { path: '/legal.css', exclude: true },
  { path: '/robots.txt', exclude: true },
  { path: '/sitemap.xml', exclude: true },
  { path: '/404.html', exclude: true },
  { path: '/*', exclude: false },
];
const EXPECTED_PRODUCTION_ANDROID_SHA256 = new Set([
  'CE:E1:F0:3B:70:02:50:9C:69:C1:D9:12:1E:D2:03:A5:0E:56:82:FC:2D:E2:D0:D8:B5:49:13:DD:05:CC:B0:E9',
]);
const EXPECTED_STAGING_ANDROID_SHA256 = new Set([
  'AA:CE:BB:72:42:98:7A:FD:93:39:D2:EE:61:3B:91:BF:85:FA:F9:AA:40:01:4F:23:6A:5B:DE:64:1A:0C:B4:3E',
]);
const EXPECTED_ANDROID_APPS = new Map([
  ['krd.hemu.app', EXPECTED_PRODUCTION_ANDROID_SHA256],
  ['krd.hemu.app.staging', EXPECTED_STAGING_ANDROID_SHA256],
]);
const EXPECTED_ANDROID_RELATIONS = new Set(['delegate_permission/common.handle_all_urls']);

function asObject(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  return value;
}

function asStringArray(value, label) {
  assert(Array.isArray(value), `${label} must be an array`);
  assert(value.every((entry) => typeof entry === 'string'), `${label} must contain only strings`);
  return value;
}

function assertExactSet(actual, expected, label) {
  assert.deepEqual(new Set(actual), expected, `${label} does not match the expected values`);
}

function validateAasa(document) {
  const root = asObject(document, 'AASA');
  const applinks = asObject(root.applinks, 'AASA.applinks');
  assert(Array.isArray(applinks.details), 'AASA.applinks.details must be an array');
  assert.equal(applinks.details.length, 1, 'AASA must have one shared app-link rule');

  const rule = asObject(applinks.details[0], 'AASA rule');
  assertExactSet(asStringArray(rule.appIDs, 'AASA appIDs'), EXPECTED_APP_IDS, 'AASA appIDs');
  assert(Array.isArray(rule.components), 'AASA components must be an array');

  // Order is load-bearing now: iOS takes the first matching component, so the
  // paths the site serves itself have to be excluded before the username
  // catch-all. A set comparison cannot see that, so compare the sequence.
  const components = rule.components.map((component, index) => {
    const entry = asObject(component, `AASA component ${index}`);
    assert.deepEqual(
      Object.keys(entry).filter((key) => key !== 'comment').sort(),
      entry.exclude === undefined ? ['/'] : ['/', 'exclude'],
      `AASA component ${index} must contain only a path matcher and an optional exclude`,
    );
    assert(typeof entry['/'] === 'string', `AASA component ${index} path must be a string`);
    if (entry.exclude !== undefined) {
      assert.equal(entry.exclude, true, `AASA component ${index} exclude must be true when present`);
    }
    return { path: entry['/'], exclude: entry.exclude === true };
  });
  assert.deepEqual(components, EXPECTED_COMPONENTS, 'AASA components do not match the expected ordered rules');

  // The catch-all is what makes hemu.krd/<username> open the app, and it is
  // also what would swallow the site's own pages if it ever drifted upwards.
  const catchAll = components.findIndex((component) => component.path === '/*' && !component.exclude);
  assert(catchAll !== -1, 'AASA must end with a username catch-all');
  const trailingExclude = components.findIndex(
    (component, index) => index > catchAll && component.exclude,
  );
  assert.equal(
    trailingExclude,
    -1,
    'AASA excludes must precede the username catch-all, or iOS will hijack the site pages after it',
  );
}

function validateAssetLinks(document) {
  assert(Array.isArray(document), 'assetlinks.json must be an array');
  assert.equal(
    document.length,
    EXPECTED_ANDROID_APPS.size,
    'assetlinks.json must have one rule for each Android app',
  );

  const packages = new Set();
  for (const [index, value] of document.entries()) {
    const label = `Android app-link rule ${index}`;
    const rule = asObject(value, label);
    assert.deepEqual(
      Object.keys(rule).sort(),
      ['relation', 'target'],
      `${label} must contain only relation and target`,
    );
    assertExactSet(
      asStringArray(rule.relation, `${label} relations`),
      EXPECTED_ANDROID_RELATIONS,
      `${label} relations`,
    );

    const target = asObject(rule.target, `${label} target`);
    assert.deepEqual(
      Object.keys(target).sort(),
      ['namespace', 'package_name', 'sha256_cert_fingerprints'],
      `${label} target contains unexpected fields`,
    );
    assert.equal(target.namespace, 'android_app', `${label} namespace must be android_app`);
    assert(typeof target.package_name === 'string', `${label} package_name must be a string`);
    assert(!packages.has(target.package_name), `${label} duplicates package ${target.package_name}`);
    packages.add(target.package_name);

    const expectedFingerprints = EXPECTED_ANDROID_APPS.get(target.package_name);
    assert(expectedFingerprints, `${label} has unexpected package ${target.package_name}`);
    assert(
      expectedFingerprints.size > 0,
      `Configure the exact signer fingerprint for ${target.package_name} before publishing it`,
    );
    assertExactSet(
      asStringArray(target.sha256_cert_fingerprints, `${label} signer fingerprints`),
      expectedFingerprints,
      `${label} signer fingerprints`,
    );
  }

  assertExactSet(packages, new Set(EXPECTED_ANDROID_APPS.keys()), 'Android app-link packages');
}

async function loadLocal(pathname, validate, label) {
  const path = resolve(`public${pathname}`);
  const contents = await readFile(path, 'utf8');
  validate(JSON.parse(contents));
  console.log(`Valid ${label}: ${path}`);
}

async function verifyRemoteDocument(origin, pathname, validate, label) {
  const url = new URL(pathname, origin);
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000) });

  assert.equal(response.status, 200, `${url} must return HTTP 200 without a redirect`);
  assert.equal(
    response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase(),
    'application/json',
    `${url} must return Content-Type: application/json`,
  );
  validate(await response.json());
  console.log(`Valid live ${label}: ${url}`);
}

await loadLocal('/.well-known/apple-app-site-association', validateAasa, 'AASA');
await loadLocal('/.well-known/assetlinks.json', validateAssetLinks, 'assetlinks.json');

const origin = process.argv[2];
if (origin) {
  await verifyRemoteDocument(origin, '/.well-known/apple-app-site-association', validateAasa, 'AASA');
  await verifyRemoteDocument(origin, '/.well-known/assetlinks.json', validateAssetLinks, 'assetlinks.json');
}
