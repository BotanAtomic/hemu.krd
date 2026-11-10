# Mobile sign-in security check

`/auth/captcha` transports a Turnstile challenge result to the Hemû app for
Supabase Auth. `public/auth/captcha/sitekeys.json` contains real public keys
for production and staging; provider secrets belong in the matching Auth
project. Missing or invalid keys show an unavailable state. Website configuration
alone does not establish that server CAPTCHA policy or mobile sign-in is enabled.

The English-only page explains that Hemû runs a quick security check, provided
by Cloudflare, each time someone requests a sign-in code. It usually finishes
by itself; sometimes Cloudflare asks the person to confirm. This wording applies
to both the hidden WebView and older browser-sheet transport. The Cloudflare
Turnstile notice and privacy-policy link remain visible on the page.

## Fixed protocol

Input is `environment=production|staging`, a fresh UUIDv4 `state`, and an
optional `transport=webview`. Unknown or repeated parameters and any other
transport value are rejected. Omitting transport keeps the browser redirect.
The page removes the query from browser history before loading the widget.
The only callbacks are `hemu://auth/captcha` and `hemu-staging://auth/captcha`.
Their fragment carries the same state and either `captcha_token` (1–2048
printable non-space ASCII characters) or `error=cancelled`. No custom return
URL or account information is accepted. The page makes no Auth call and uses
no analytics or persistent token storage; Auth validates the one-use token.

### WebView transport v1

The app loads `/auth/captcha?environment=<env>&state=<UUIDv4>&transport=webview`
in a hidden `react-native-webview`. This transport requires
`window.ReactNativeWebView.postMessage` to be a function; otherwise the page
asks the visitor to open the check from Hemû and renders no widget. It never
navigates to an app scheme. Every message is JSON passed to that bridge with
`v: 1`, `type`, and the request's `state`:

| Type               | Additional fields                                                  | Trigger                                                                                                      |
| ------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `token`            | `token`: 1–2048 printable non-space ASCII characters               | Successful check; sent once, then the widget is removed.                                                     |
| `interactive`      | None                                                               | Turnstile's `before-interactive-callback`; the app shows its sheet.                                          |
| `interactive-done` | None                                                               | Turnstile's `after-interactive-callback`.                                                                    |
| `error`            | `reason`: `config`, `load`, `expired`, `timeout`, or `unsupported` | Invalid/missing configuration in a reachable sitekeys.json, configuration fetch or script/widget loading failure, expiry, timeout, or unsupported browser, respectively. |
| `cancelled`        | None                                                               | Visitor taps Return to Hemû; the widget is removed.                                                          |

Errors offer Try again; a later successful check can still send its one token.
Success and cancellation end the attempt. The widget keeps action `mobile-auth`
and uses `appearance: "interaction-only"` in WebView mode.

### Test environments

WebView requests may use `test-pass` (Cloudflare's invisible always-pass key
`1x00000000000000000000BB`) or `test-interactive` (forced-interaction key
`3x00000000000000000000FF`) only on `localhost`, `127.0.0.1`, or a Firebase
preview host matching `^hemu-fd2f4--[a-z0-9-]+\.web\.app$`. These environments
are rejected on the live domain and Firebase's default hosts, and cannot use
the redirect transport. The test keys are constants in `protocol.mjs`, never
entries in `sitekeys.json`. Dummy tokens validate only with Cloudflare's dummy
secrets; production and staging still require real `0x…` public keys.

## Hosting and rollout

`firebase.json` allows Turnstile scripts and frames only on the CAPTCHA route,
with no-store, no-referrer and noindex headers. `scripts/smoke.sh` checks
`/auth/captcha` for the exact `script-src` (`'self'` and
`https://challenges.cloudflare.com`) and `frame-src`
(`https://challenges.cloudflare.com`) source lists; `frame-ancestors`,
`object-src`, `base-uri` and `form-action` must each be `'none'`. It rejects
`unsafe-inline`, `unsafe-eval` and wildcard sources, and requires
`Referrer-Policy: no-referrer`, `Cache-Control: no-store` and
`X-Robots-Tag: noindex, nofollow`. It also fetches
`/auth/captcha/sitekeys.json` and requires real production and staging keys,
with no test-key entries. Test keys remain host-gated constants in
`protocol.mjs`.

Keep `connect-src 'self'` unless a local Firebase Hosting emulator probe records
a `connect-src` violation naming `https://challenges.cloudflare.com`. Only that
evidence justifies adding the Cloudflare origin to `connect-src`.

AASA excludes `/auth/captcha`,
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
headers or routes. For deterministic WebView tests, use the host-gated test
environments above with an injected native bridge; keep real keys in
`sitekeys.json`.

To verify the actual Hosting headers locally, run `npm run build`, then
`npx --yes firebase-tools@15.24.0 emulators:start --only hosting --project hemu-fd2f4`
and `bash scripts/smoke.sh http://127.0.0.1:5000` (use the port printed by the
emulator). The CAPTCHA header and sitekey assertions run before the unknown-path
404 check. Probe both test environments in Chromium with a scratch native bridge
and a `securitypolicyviolation` listener; keep that instrumentation out of the
shipped page. Starting the emulator does not deploy the site.
