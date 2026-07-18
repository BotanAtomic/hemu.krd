# hemu.krd

Landing page for **hemû** — buy and sell across Kurdistan. Live at [hemu.krd](https://hemu.krd).

React + Vite + TypeScript, deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`.

## Develop

```sh
npm install
npm run dev      # local dev server
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build locally
```

## Content

- **Languages** — Sorani (default), Kurmancî, English, Arabic, Turkish, Farsi. Strings in `src/translations.ts`; headline / categories / UI labels are copied from the app's locale bundles (`mobile/locales/*/common.json` in the main repo) so site and app stay consistent.
- **Brand** — colors and type in `src/styles.css` mirror the app design tokens; the wordmark (`src/Wordmark.tsx`) uses the same committed glyph outlines as the app, no webfont needed.
- **Store buttons** — placeholders ("coming soon"). When the apps ship, turn them into real links and switch to the official Apple/Google badge artwork (usable only once the apps are live).

## Domain / DNS (Namecheap)

GitHub Pages serves the site; the custom domain is configured in the repo's Pages settings. DNS at Namecheap:

| Type  | Host | Value                  |
| ----- | ---- | ---------------------- |
| A     | @    | 185.199.108.153        |
| A     | @    | 185.199.109.153        |
| A     | @    | 185.199.110.153        |
| A     | @    | 185.199.111.153        |
| CNAME | www  | botanatomic.github.io. |

Keep the email-forwarding TXT (SPF) record. Remove the parking-page CNAME and the URL Redirect record — the redirect conflicts with the apex A records.

## Deep links

`public/.well-known/apple-app-site-association` declares `/listing/*` and `/signup` for iOS universal links (team `SYYHV8RW83`, bundle `krd.hemu.app`). Android's `assetlinks.json` still needs the release-key SHA-256 fingerprint — add `public/.well-known/assetlinks.json` once the Android signing key exists.
