# Link previews

Chat apps build a link card from a page's `<title>`, description, Open Graph
and Twitter tags, without running its JavaScript. The function `sharepreview`
(`functions/`) gives shared listing and profile links their own card. It serves
the site's `index.html` with only those tags replaced. Visitors get the same
page, and app links behave as before. The association files are unchanged.

## Routes

`firebase.json` sends exactly three shapes to Cloud Run service `sharepreview`
in `europe-west1`:

| Path | Shape |
| --- | --- |
| `/listing/<id>` | 22-character compact id (mobile `src/lib/compactUuid.ts`) or canonical UUID |
| `/u/<id>` | same |
| `/<username>` | `^/[A-Za-z0-9][A-Za-z0-9._]{1,18}[A-Za-z0-9]$` |

Hosting serves exact static files before rewrites, so `/privacy`, `/terms`,
`/data-deletion`, `/support`, `/auth/*`, `/.well-known/*`, `/og.jpg`,
`/lang.js`, `/404.html` and `/assets/*` never reach the function. `/signup` is
rewritten to `index.html` before the username rule. Any other path, such as
`/listing/x` or `/listing/a/b`, keeps the old rewrites. The function applies the
backend's full username rule: 3–20 characters, no `..`, `._` or `__`. It also
refuses the backend's reserved names and the site's own file names. Those paths
never cause a backend call.

## Cards

| Link | Title | Description | Image |
| --- | --- | --- | --- |
| Active listing | `<title> · <price>` | `<city> · <condition> · <start of description>` | Cover photo, `fullUrl` (720 px box), with size when known |
| Sold listing | `Sold · <title>`, or `Sold on hemû` when the API gives no title | `This listing is no longer available. See more on hemû.` | `og.jpg` |
| Profile | `<name> on hemû` | `@<username> · <N> listings · <city>` | Avatar, else `og.jpg` |

Missing parts are omitted. Prices follow the app's English `formatPrice`: the
listing's own currency, grouped digits, `$`/`₺` before the amount, `IQD` before
it, `SP` and `تومان` after it, `Free` for zero, and the amount in an LTR isolate.
The description is collapsed and cut near 150 characters at a word boundary.
Cards are English; add a language as another entry in `LABELS` in
`functions/preview.mjs`.

An anonymous `GET /listings/{id}` returns `LISTING_SOLD` (404) for a sold
listing. That error body has no title or photo, so a sold card names neither.
Deleted, hidden, paused, expired and blocked items, and unknown ids, get
`NOT_FOUND`. So do backend errors, timeouts and malformed ids. In each case the
function serves `index.html` byte for byte, with HTTP 200 and the generic card.

## Behaviour and safety

- Reads only the path, the method and `X-Forwarded-Host`. It never reflects
  the query string. Ids and usernames are validated before any call, and path
  segments are encoded.
- Calls only the public API configured in `functions/.env`. It sends no key or
  token, uses one GET with a 2.5 s timeout, no retries and no redirects, and
  reads at most 256 KB. It pins `x-region` to the database region.
- Uses an image only when it comes from that backend's public storage path.
  Signed URLs and other hosts are refused.
- Every value is HTML-escaped (`& < > " '`) after control characters and bidi
  overrides are removed and whitespace is collapsed. Lengths are capped.
- Answers only GET and HEAD (405 otherwise) and sets no cookies. It sets the
  site's security headers itself. It logs `{preview, outcome, id}` with ids
  only, never a username, name or text.
- Fetches `index.html` from the requesting Hosting host, so a release's own page
  is used and a Hosting-only deploy can never leave the function serving stale
  asset names. Only `hemu.krd`, `hemu-fd2f4.web.app`,
  `hemu-fd2f4.firebaseapp.com` and `hemu-fd2f4--*.web.app` are allowed;
  anything else uses `hemu.krd`. Each instance keeps a copy for 5 minutes,
  and a stale copy when Hosting cannot be read. A cold instance that cannot
  read the page serves a minimal generic page, uncached.
- CDN caching: found and sold `public, max-age=300, s-maxage=600`; not found
  `public, max-age=60, s-maxage=120`; backend error `public, max-age=0,
  s-maxage=30`. A chat app keeps its own copy of a card, often for hours, so
  an edited listing can show its old card there.

## Configuration

`functions/.env` sets `HEMU_BACKEND=staging`, which is the staging API
`vtuvotfgjhpkygrzxlom`. Before this function, the website called no backend.
Both the staging and production apps share `https://hemu.krd/...` links, but
only one backend fills the cards. While the app is in staging testing, that is
staging; production has no listings yet. At public launch, set
`HEMU_BACKEND=production` (project `spfwebddkaxvqslyxvln`, `eu-central-1`) and
redeploy the function. From then on, staging links show the generic card. The
allowed backends are constants in `functions/preview.mjs`.

## Local testing

`npm test` covers rendering, escaping, prices, fallbacks and routing. To check
real staging data, run the handler under plain Node. Before running, build the
site with `npm run build`; no credentials are needed:

```js
// /tmp/serve.mjs
import http from "node:http";
import { readFile } from "node:fs/promises";
import { BACKENDS, createHandler } from "<repo>/functions/preview.mjs";
const page = await readFile("<repo>/dist/index.html", "utf8");
http.createServer(createHandler({ backend: BACKENDS.staging, indexSource: async () => page }))
  .listen(5099, "127.0.0.1");
```

Then `curl -s http://127.0.0.1:5099/listing/<compact id>`. `firebase emulators`
does not emulate `run` rewrites, so it cannot replace this check.

## Deploy

Cloud Functions requires the Blaze (pay-as-you-go) plan on `hemu-fd2f4`. The
owner must do the following, in this order:

1. Upgrade `hemu-fd2f4` to Blaze in the Firebase console (Usage and billing).
   Optionally set a budget alert in Cloud Billing.
2. Deploy the function from a clean checkout. The first deploy enables the
   Cloud Functions, Cloud Build, Artifact Registry, Cloud Run and Eventarc
   APIs, and sets a container cleanup policy:

   ```bash
   (cd functions && npm ci)
   npx --yes firebase-tools@15.24.0 deploy --only functions:sharepreview \
     --project hemu-fd2f4 --force
   ```

   `--force` only accepts the Artifact Registry cleanup policy. The deployer
   needs Cloud Functions Admin, Service Account User on the runtime service
   account, and Artifact Registry/Cloud Build access (Owner or Editor covers
   all of these).
3. Only then merge the Hosting change, or run `npm run deploy`. A Hosting
   release with these rewrites must not go live before the service exists.
   CI keeps deploying Hosting only and needs no new permissions.
4. Check: `npm run smoke -- https://hemu.krd` and
   `curl -s https://hemu.krd/<username> | grep og:`. Then paste a link into the
   [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/),
   which also refreshes its cached card.

Redeploy the function only when `functions/` changes. Hosting releases do not
need it. To roll back, remove the three `run` rewrites and deploy Hosting. The
function can stay deployed or be deleted with `firebase functions:delete
sharepreview --region europe-west1`.

## Cost and latency

Cloud Functions has no Spark (free plan) tier. On Blaze, the
[Firebase pricing page](https://firebase.google.com/pricing) (read 2026-11-15)
lists these no-cost allowances per month:

- 2M invocations, then $0.40 per million
- 400K GB-seconds and 200K CPU-seconds
- 5 GB outbound networking, then $0.12/GB

Container images in Artifact Registry are billed separately; the cleanup
policy keeps them small. Each crawl is one short request, and the CDN absorbs
repeats, so expected cost at tester scale is $0. `maxInstances: 5` bounds the
cost of a flood.

`minInstances` is 0, so nothing is billed while idle. The trade-off is a cold
start: the first crawl after a quiet period waits for the instance to start
(typically about 1–3 s) plus the API call, and the API has its own cold
isolate. Crawlers wait several seconds, and the timeouts keep the total under
about 5 s.
