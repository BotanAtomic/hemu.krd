# Mobile sign-in security check

`/auth/captcha` transports a Turnstile challenge result to the Hemû app for
Supabase Auth. `public/auth/captcha/sitekeys.json` contains real public keys
for production and staging; provider secrets belong in the matching Auth
project. Missing or invalid keys show an unavailable state. Website configuration
alone does not establish that server CAPTCHA policy or mobile sign-in is enabled.

## Fixed protocol

Input is exactly `environment=production|staging` and a fresh UUIDv4 `state`.
The page removes the query from browser history before loading the widget.
The only callbacks are `hemu://auth/captcha` and `hemu-staging://auth/captcha`.
Their fragment carries the same state and either `captcha_token` (1–2048
printable non-space ASCII characters) or `error=cancelled`. No custom return
URL or account information is accepted. The page makes no Auth call and uses
no analytics or persistent token storage; Auth validates the one-use token.

## Hosting and rollout

`firebase.json` allows Turnstile scripts and frames only on the CAPTCHA route,
with no-store, no-referrer and noindex headers. AASA excludes `/auth/captcha`,
`/auth/callback` and their child paths before the username catch-all so iOS
keeps them in the browser. Android share-link prefixes exclude these routes.
Follow [CAPTCHA bootstrap order](https://github.com/BotanAtomic/hemu-supabase/blob/main/docs/production/READINESS.md#captcha-bootstrap-order)
for coordinated provider, backend and mobile rollout and device verification.

`/auth/callback` is a recovery page: it strips query and fragment, makes no
Auth/API call, and offers the fixed `hemu://` link to restart sign-in. It never
forwards codes or tokens or resumes a native PKCE attempt. Its CSP forbids
connections; no-store, no-referrer and noindex headers also apply.

## Local preview

Run `npm run build && npm run preview`, then open
`/auth/captcha/index.html?environment=staging&state=<fresh-UUIDv4>`. Firebase
rewrites `/auth/captcha` to that artifact; Vite preview does not verify Hosting
headers or routes. Keep real keys; do not substitute provider test keys.
