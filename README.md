# hemu.krd

Landing page for **hemû** — buy and sell across Kurdistan. Live at [hemu.krd](https://hemu.krd).

For the cross-repository system map, active environment matrix, and retired
infrastructure list, read
`../hemu-supabase/docs/SYSTEM-ARCHITECTURE.md` from the parent workspace.

## Hosting and app links

Store support and policy URLs are `/support`, `/privacy`, `/terms`, and
`/data-deletion` on `https://hemu.krd`. These remain browser pages even when
the app is installed.

Firebase Hosting serves the public custom domain. It currently deploys from
Firebase project `hemu-fd2f4` with the Hosting target for the public site. This
is public web hosting only; it does not make the mobile app use the staging
backend or staging Auth. Moving the public site to Firebase project
`hemu-prod` is a future explicit decision, not a prerequisite for production
mobile work.

The portable `Dockerfile` is kept for local production-build verification
only. Firebase serves the Apple and Android association documents with
`Content-Type: application/json`:

```text
https://hemu.krd/.well-known/apple-app-site-association
https://hemu.krd/.well-known/assetlinks.json
```

The native apps share these canonical public URLs:

```text
https://hemu.krd/listing/<listing-id>
https://hemu.krd/u/<user-id>
https://hemu.krd/signup
```

Supported share paths fall back to the landing page when the app is not
installed. Unknown website paths intentionally remain real HTTP 404 responses.

After deploying, verify both association metadata and share-route fallbacks:

```bash
npm run verify:associations:live
npm run verify:share-links:live
```

## Mobile authentication challenge

The browser security check at `/auth/captcha` uses fixed app callbacks and
real per-environment Turnstile sitekeys. See [configuration, deployment gates
and verification](docs/auth-captcha.md). Missing keys fail closed; this source
change alone does not enable CAPTCHA.
