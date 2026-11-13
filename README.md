# hemu.krd

Public website for **Hemû**, the marketplace for Kurdistan: landing page,
policies, support, mobile app links and browser authentication pages.
[hemu.krd](https://hemu.krd) uses Firebase Hosting in project `hemu-fd2f4`,
target `public-site`. This hosts the public website independently of the
mobile app's backend environment.
See the [cross-repo system map](https://github.com/BotanAtomic/hemu-supabase/blob/main/docs/SYSTEM-ARCHITECTURE.md).

## Commands

Use Node 22 and install dependencies with `npm ci`.

| Command | Job |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Type-check and build into `dist/`. |
| `npm run preview` | Preview the built site locally. |
| `npm test` | Test the CAPTCHA protocol and page, landing language and cache headers. |
| `npm run smoke -- https://hemu.krd` | Check hosted routes, app links and headers. |
| `npm run deploy` | Build and deploy the Firebase Hosting target. |

The pre-PR gate is `npm test && npm run build`, also run by CI's `build` job.

## Routes and app links

`firebase.json` owns Hosting routes and response headers. `/listing/<id>`,
`/u/<id>`, `/signup` and root usernames such as `/seller.one` serve the static landing page (`index.html`).
`/privacy`, `/terms`, `/data-deletion`, `/support`, `/auth/captcha` and
`/auth/callback` serve their own pages. Keep explicit rewrites ahead of `/*`,
which must stay last; unknown deeper paths return HTTP 404.

Apple and Android association files live in `public/.well-known/` and name
both `krd.hemu.app` and `krd.hemu.app.staging`. Keep the AASA exclusions for
site pages, authentication pages and static assets before its username catch-all.
Replace `assetlinks.json` when Android signing certificates change, retaining
the fingerprints needed by distributed builds. See [CAPTCHA](docs/auth-captcha.md)
for the browser challenge protocol and authentication recovery page.

The `security.txt` file lives in `public/.well-known/`; renew and re-check its
`Expires` date and `Contact` before the expiry date in the file.

## Deploy and rollback

Manual `npm run deploy` uses the local service-account credential file at
`$HOME/.config/hemu/firebase/release-service-account.json` when present.
Set `GOOGLE_APPLICATION_CREDENTIALS` to use another credential file. The command
isolates Firebase's saved login and ignores `FIREBASE_TOKEN` when using this file;
without one, it uses the existing Firebase CLI login. Credentials are passed only
to Firebase, never to the site build. This Mac uses keyless service-account
impersonation. Keep the private credential file outside the repository with mode
`600`. The account needs Firebase Hosting Admin, API Keys Viewer and Service Usage
Consumer on `hemu-fd2f4`.

CI deploys pushes to `main` and manual runs on `main` using Google OIDC and
the `firebase-hosting-live` environment. Same-repository PRs get a Firebase
preview channel and smoke check. Live deployment runs the same smoke command
against `https://hemu.krd`; local preview does not exercise Hosting configuration.
For rollback, restore a known-good release from the Firebase console's Hosting
release history, then run `npm run smoke -- https://hemu.krd`.
Before rolling back, confirm that the release's AASA and `assetlinks.json` still match the current iOS Team ID / app IDs and Android signing fingerprints; otherwise app links break.
