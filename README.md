# hemu.krd

Landing page for **hemû** — buy and sell across Kurdistan. Live at [hemu.krd](https://hemu.krd).

## Hosting and app links

Firebase Hosting serves the public custom domain, and `Dockerfile` provides the
equivalent Vite build for Coolify on port `8080`. Both hosting paths serve the
Apple and Android association documents with `Content-Type: application/json`:

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
