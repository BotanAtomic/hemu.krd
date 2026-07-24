# hemu.krd

Landing page for **hemû** — buy and sell across Kurdistan. Live at [hemu.krd](https://hemu.krd).

## Hosting and app links

`Dockerfile` is the production hosting path for Coolify. It serves the Vite
build on port `8080` and makes the extensionless Apple association endpoint
available with `Content-Type: application/json`:

```text
https://hemu.krd/.well-known/apple-app-site-association
```

GitHub Pages remains useful for previewing the landing page, but it serves
extensionless files as `application/octet-stream` and cannot set a custom
response header. Do not use the GitHub Pages origin for iOS universal links.

After deploying the container and pointing the apex domain at Coolify, verify
the public response with:

```bash
npm run verify:associations:live
```

Android Digital Asset Links are intentionally absent until a release APK has
been built and its signing certificate has been verified. Publish the
generated `assetlinks.json` only after that signer check; never use the debug
keystore fingerprint.
