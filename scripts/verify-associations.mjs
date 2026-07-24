import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const EXPECTED_APP_IDS = new Set([
  'H4AD8Y6PQ2.krd.hemu.app',
  'H4AD8Y6PQ2.krd.hemu.app.staging',
]);
const EXPECTED_PATHS = new Set(['/listing/*', '/u/*', '/signup*']);

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

async function loadLocalAasa() {
  const path = resolve('public/.well-known/apple-app-site-association');
  const contents = await readFile(path, 'utf8');
  validateAasa(JSON.parse(contents));
  console.log(`Valid AASA: ${path}`);
}

async function verifyRemote(origin) {
  const url = new URL('/.well-known/apple-app-site-association', origin);
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000) });

  assert.equal(response.status, 200, `${url} must return HTTP 200 without a redirect`);
  assert.equal(
    response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase(),
    'application/json',
    `${url} must return Content-Type: application/json`,
  );
  validateAasa(await response.json());
  console.log(`Valid live AASA: ${url}`);
}

await loadLocalAasa();

const origin = process.argv[2];
if (origin) await verifyRemote(origin);
