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
  grep -Fq '<div id="root"></div>' "$tmp/body"
done
echo 'PASS share links: SPA shell'
for route in /privacy /terms /data-deletion /support /auth/captcha /auth/callback; do
  request "$route"
  ! grep -Fq '<div id="root"></div>' "$tmp/body" || exit 1
done
echo 'PASS site pages: own HTML'
request /a/b/c 404
echo 'PASS unknown deep path: 404'
request /
for header in 'x-content-type-options: nosniff' 'x-frame-options: DENY' 'referrer-policy: strict-origin-when-cross-origin' 'permissions-policy: camera=(), microphone=(), geolocation=()'; do
  grep -Fiqx "$header" < <(tr -d '\r' < "$tmp/headers")
done
grep -Ei "^content-security-policy:.*default-src 'self'" "$tmp/headers" > "$tmp/csp"
! grep -Eq 'unsafe-eval|\*' "$tmp/csp" || exit 1
echo 'PASS security: four headers and CSP'
