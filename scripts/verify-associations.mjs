import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const EXPECTED_APP_IDS = new Set([
  'H4AD8Y6PQ2.krd.hemu.app',
  'H4AD8Y6PQ2.krd.hemu.app.staging',
]);
const EXPECTED_PATHS = new Set(['/listing/*', '/u/*', '/signup*']);
const EXPECTED_ANDROID_PACKAGE = 'krd.hemu.app';
const EXPECTED_ANDROID_SHA256 = new Set([
  'CE:E1:F0:3B:70:02:50:9C:69:C1:D9:12:1E:D2:03:A5:0E:56:82:FC:2D:E2:D0:D8:B5:49:13:DD:05:CC:B0:E9',
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

  const paths = rule.components.map((component, index) => {
    const entry = asObject(component, `AASA component ${index}`);
    assert.deepEqual(Object.keys(entry), ['/'], `AASA component ${index} must contain only a path matcher`);
    assert(typeof entry['/'] === 'string', `AASA component ${index} path must be a string`);
    return entry['/'];
  });
  assertExactSet(paths, EXPECTED_PATHS, 'AASA paths');
}

function validateAssetLinks(document) {
  assert(Array.isArray(document), 'assetlinks.json must be an array');
  assert.equal(document.length, 1, 'assetlinks.json must have one Android app rule');

  const rule = asObject(document[0], 'Android app-link rule');
  assert.deepEqual(
    Object.keys(rule).sort(),
    ['relation', 'target'],
    'Android app-link rule must contain only relation and target',
  );
  assertExactSet(
    asStringArray(rule.relation, 'Android app-link relations'),
    EXPECTED_ANDROID_RELATIONS,
    'Android app-link relations',
  );

  const target = asObject(rule.target, 'Android app-link target');
  assert.deepEqual(
    Object.keys(target).sort(),
    ['namespace', 'package_name', 'sha256_cert_fingerprints'],
    'Android app-link target contains unexpected fields',
  );
  assert.equal(target.namespace, 'android_app', 'Android app-link namespace must be android_app');
  assert.equal(target.package_name, EXPECTED_ANDROID_PACKAGE, 'Android app-link package does not match');
  assertExactSet(
    asStringArray(target.sha256_cert_fingerprints, 'Android signer fingerprints'),
    EXPECTED_ANDROID_SHA256,
    'Android signer fingerprints',
  );
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
