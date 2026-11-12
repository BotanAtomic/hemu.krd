#!/usr/bin/env bash
set -euo pipefail

origin=${1:?Usage: bash scripts/smoke.sh <origin>}
origin=${origin%/}
tmp=$(mktemp -d)
trap 'result=$?; if (( result )); then echo "FAIL: $origin${route:-/}" >&2; fi; rm -rf "$tmp"' EXIT
request() {
  route=$1
  http_status=$(curl --silent --show-error --max-time 15 --dump-header "$tmp/headers" --output "$tmp/body" --write-out '%{http_code}' "$origin$route")
  [[ $http_status == "${2:-200}" ]] || exit 1
  grep -Eiq "^content-type: ${3:-text/html}([;[:space:]]|$)" "$tmp/headers"
}

for route in /.well-known/apple-app-site-association /.well-known/assetlinks.json; do
  request "$route" 200 application/json
  node -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))' "$tmp/body"
  for app in krd.hemu.app krd.hemu.app.staging; do grep -Fq "$app\"" "$tmp/body"; done
done
echo 'PASS associations: JSON and both app IDs'
for route in /listing/x /u/x /signup /signup/verify /seller.one /seller_one /__hemu_route_smoke_missing__; do
  request "$route"
  grep -Fq 'class="hero-grid' "$tmp/body"
done
echo 'PASS share links: landing shell'
for route in /privacy /terms /data-deletion /support /auth/captcha /auth/callback; do
  request "$route"
  ! grep -Fq 'class="hero-grid' "$tmp/body" || exit 1
done
echo 'PASS site pages: own HTML'
request /auth/captcha
robots='x-robots-tag: noindex, nofollow'
if [[ $origin =~ ^https://hemu-fd2f4--[a-z0-9-]+\.web\.app$ ]]; then
  # Firebase Hosting preview channels replace X-Robots-Tag with noindex.
  robots='x-robots-tag: noindex'
fi
for header in 'referrer-policy: no-referrer' 'cache-control: no-store' "$robots"; do
  grep -Fiqx "$header" < <(tr -d '\r' < "$tmp/headers")
done
node --input-type=module - "$tmp/headers" <<'NODE'
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const policies = readFileSync(process.argv[2], "utf8")
  .split(/\r?\n/u)
  .filter((line) => /^content-security-policy:/iu.test(line));
assert.equal(policies.length, 1, "one CAPTCHA CSP header");
const directives = new Map();
for (const part of policies[0].slice(policies[0].indexOf(":") + 1).split(";")) {
  const [name, ...sources] = part.trim().split(/\s+/u);
  if (!name) continue;
  assert(!directives.has(name), `duplicate CSP directive: ${name}`);
  assert(!sources.some((source) => /unsafe-inline|unsafe-eval|\*/u.test(source)), `unsafe CSP source: ${name}`);
  directives.set(name, sources);
}
for (const [name, sources] of Object.entries({
  "script-src": ["'self'", "https://challenges.cloudflare.com"],
  "frame-src": ["https://challenges.cloudflare.com"],
  "frame-ancestors": ["'none'"],
  "object-src": ["'none'"],
  "base-uri": ["'none'"],
  "form-action": ["'none'"],
})) assert.deepEqual(directives.get(name), sources, `CAPTCHA ${name}`);
NODE
echo 'PASS captcha: exact Cloudflare CSP and no-referrer/no-store/noindex headers'
request /auth/captcha/sitekeys.json 200 application/json
node --input-type=module - "$tmp/body" <<'NODE'
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const config = JSON.parse(readFileSync(process.argv[2], "utf8"));
assert.deepEqual(Object.keys(config).sort(), ["production", "staging"]);
for (const environment of ["production", "staging"])
  assert.match(config[environment], /^0x[A-Za-z0-9_-]{20,100}$/u, `${environment} real public sitekey`);
assert.notEqual(config.production, config.staging, "production and staging sitekeys differ");
NODE
echo 'PASS captcha sitekeys: distinct production and staging real keys, no test keys'
request /a/b/c 404
echo 'PASS unknown deep path: 404'
request /
for header in 'x-content-type-options: nosniff' 'x-frame-options: DENY' 'referrer-policy: strict-origin-when-cross-origin' 'permissions-policy: camera=(), microphone=(), geolocation=()'; do
  grep -Fiqx "$header" < <(tr -d '\r' < "$tmp/headers")
done
grep -Ei "^content-security-policy:.*default-src 'self'" "$tmp/headers" > "$tmp/csp"
! grep -Eq 'unsafe-eval|\*' "$tmp/csp" || exit 1
echo 'PASS security: four headers and CSP'
