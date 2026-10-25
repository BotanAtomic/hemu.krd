# Mobile sign-in security check

`/auth/captcha` is the browser transport for Hemu's Supabase Auth Turnstile
challenge. This source change does not enable CAPTCHA or deploy the site.
The checked-in `public/auth/captcha/sitekeys.json` deliberately contains null
keys, so the page displays an unavailable message and never loads a widget.

## Configuration and rollout

1. Create a real Cloudflare Turnstile widget restricted to `hemu.krd`. Use the
   managed widget mode and leave pre-clearance disabled. The native app opens
   the canonical HTTPS origin in the system browser; do not allow arbitrary
   hostnames or custom return URLs.
2. Put only its **public sitekey** in the matching `production` or `staging`
   field in `public/auth/captcha/sitekeys.json`. Configure the corresponding
   **secret** directly in the matching Supabase Auth project. Never commit the
   secret or place it in the website, EAS public environment, or native app.
   Production is Frankfurt project `spfwebddkaxvqslyxvln`; staging is
   `vtuvotfgjhpkygrzxlom`. Do not target a retired project.
3. Review the route-specific Firebase Hosting and portable Nginx CSP. Only
   this page allows scripts and frames from `https://challenges.cloudflare.com`.
   Keep no-store, no-referrer and noindex headers. Validate actual response
   headers after deployment; a local Vite preview does not exercise Hosting.
   Keep the ordered Apple association exclusions for `/auth/captcha` and
   `/auth/captcha/*` ahead of the username catch-all, so iOS leaves the
   challenge and its static files in the browser. Android's claimed share-link
   prefixes do not include this route.
4. Run `npm run test:captcha`, `npm run build`, and the existing website
   production gates. Deploy only through the approved Hosting process.
5. First rehearse with a real **staging** widget, its matching staging Auth
   secret and controlled server policy, and a staging mobile candidate with
   `EXPO_PUBLIC_AUTH_CAPTCHA_REQUIRED=true`. Verify initial email/phone OTP,
   resend, cancellation/retry, app background/foreground, expired challenge and
   linked email/phone account-deletion reauthentication on iOS and Android.
   Inspect callback transition frames, including Android browser close/abort/
   retry. Confirm a valid token is accepted once, used/missing tokens are
   rejected, and social sign-in/refresh still work. Never capture tokens in
   logs or screenshots. Undefined/false leaves staging unchanged and never
   disables mandatory production CAPTCHA.
6. Record the backend client-readiness ACK from that successful staging proof,
   then perform Frankfurt's first deployment, pass the live production API
   readiness gate and build the production candidate. Repeat the same iOS and
   Android checks with the real production widget/Auth pair before launch.
   Do not require an uploaded production candidate before the first backend
   deployment. This source change does not enable either hosted server policy.

If sign-in fails, preserve production protection, show the clear unavailable
state, and diagnose widget hostname/key pairing, CSP and token handling. Never
fall back to an OTP request without CAPTCHA. Coordinate rollback of website,
mobile and server policy; a page rollback alone cannot make protected OTP work.

## Fixed protocol

Input is exactly `environment=production|staging` plus a fresh random UUIDv4
`state`. No email, phone, account ID, token, or return URL is accepted. The
page removes the query from browser history before loading the widget.

The only callbacks are `hemu://auth/captcha` and
`hemu-staging://auth/captcha`. The result is a fragment containing the same
state and either `captcha_token` (max 2048 printable ASCII characters) or
`error=cancelled`. Mobile validates the exact callback and state before passing
that one-use token immediately as `signInWithOtp(...options.captchaToken)`.
The page makes no Auth call and initializes no analytics or persistent storage.
Supabase verifies the token server-side; receiving a browser result alone is
not proof of successful sign-in.

## Local preview

Vite copies the static page to `dist/auth/captcha/index.html`. For an exact
artifact preview use `/auth/captcha/index.html?environment=production&state=`
followed by a fresh UUIDv4. Firebase's explicit rewrite serves the canonical
`/auth/captcha` URL. Missing keys intentionally show the unavailable state;
never replace production keys with Cloudflare test keys to pass a release gate.

## Canonical browser auth return

`https://hemu.krd/auth/callback` is an allowed production Auth return URL,
but no browser sign-in product or browser session exchange is implemented.
It serves a recovery page rather than a 404: the page strips the query and
fragment from browser history, makes no Auth/API call, and lets the user open
the fixed `hemu://` app link to restart sign-in. It never forwards a provider
code or token. Route-specific no-store, no-referrer, noindex and a
`connect-src 'none'` CSP apply to the page and its script.

Native sign-in uses `hemu://auth/callback` (or the staging scheme) with a
live in-memory attempt and its corresponding PKCE verifier. A cold app cannot
resume that attempt. Do not replace this recovery page with a token/code relay
or claim that it implements web authentication. iOS association exclusions
keep this browser recovery page ahead of the username catch-all as well.

Primary references: [Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha),
[Turnstile mobile](https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/),
[Turnstile CSP](https://developers.cloudflare.com/turnstile/reference/content-security-policy/),
[Expo SDK 58 WebBrowser](https://docs.expo.dev/versions/v58.0.0/sdk/webbrowser/).
