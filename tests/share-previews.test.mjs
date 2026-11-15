import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import {
  BACKENDS,
  CACHE,
  RESERVED_USERNAMES,
  SECURITY_HEADERS,
  UNAVAILABLE_PAGE,
  API_TIMEOUT_MS,
  applyCard,
  compactUuid,
  createHandler,
  createIndexSource,
  formatPrice,
  parseBackends,
  publicImageUrl,
  routeFor,
  truncate,
  uuidFromPublicId,
} from "../functions/preview.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const INDEX = await read("index.html");
const envText = await read("functions/.env");
const backend = BACKENDS.staging;
const API = backend.apiUrl;
const PROD_API = BACKENDS.production.apiUrl;
const PROD_STORAGE = "https://spfwebddkaxvqslyxvln.supabase.co/storage/v1/render/image/public";
const STORAGE = "https://vtuvotfgjhpkygrzxlom.supabase.co/storage/v1/render/image/public";
const LRI = String.fromCodePoint(0x2066);
const PDI = String.fromCodePoint(0x2069);
const RLO = String.fromCodePoint(0x202e);
const ltr = (value) => `${LRI}${value}${PDI}`;

const LISTING_ID = "11b9df38-f307-42d7-9000-47b7d6a9ba4f";
const SELLER_ID = "339eca51-9761-47b7-a790-41dba72b280a";
const LISTING_PATH = `/listing/${compactUuid(LISTING_ID)}`;

const listing = (overrides = {}) => ({
  id: LISTING_ID,
  title: "Toyota Corolla 2022, one owner",
  status: "active",
  price: 18500,
  currency: "USD",
  condition: "good",
  description: "45,000 km.\n\nOne owner, full service history,   no accidents. Call or message for details.",
  location: {
    id: "205", kind: "neighborhood", name: "Italian Village 1",
    names: { english: "Italian Village 1" },
    parentCity: { id: "1", name: "Hewlêr", names: { english: "Hewlêr", sorani: "هەولێر" } },
  },
  images: [
    { id: "b", sortIndex: 1, isCover: false, width: 540, height: 720, fullUrl: `${STORAGE}/listing-media/b/full.jpg?width=720&height=720&quality=82&resize=contain`, cardUrl: "" },
    { id: "a", sortIndex: 0, isCover: true, width: 1080, height: 1440, fullUrl: `${STORAGE}/listing-media/a/full.jpg?width=720&height=720&quality=82&resize=contain`, cardUrl: "" },
  ],
  ...overrides,
});

const profile = (overrides = {}) => ({
  id: SELLER_ID,
  name: "Rêbaz Hewramî",
  username: "rebaz.hewrami",
  stats: { active: 19, sold: 2, followers: 1, following: 2 },
  location: { id: "1", kind: "city", name: "Hewlêr", names: { english: "Hewlêr" } },
  avatarUrl: `${STORAGE}/avatars/${SELLER_ID}/x/full.jpg?width=512&height=512&quality=80&resize=cover`,
  official: false, joinedAt: "2026-10-25T00:52:24Z", blockedByMe: false, blockedMe: false, isFollowed: false,
  ...overrides,
});

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Fake backends: `routes` answer staging, `prodRoutes` production; every call is recorded. */
function fakeFetch(routes, prodRoutes = {}) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url) === "https://hemu.krd/index.html") return new Response(INDEX, { status: 200 });
    const prod = String(url).startsWith(PROD_API);
    const route = (prod ? prodRoutes : routes)[String(url).slice((prod ? PROD_API : API).length)];
    if (!route) return json(404, { code: "NOT_FOUND" });
    return typeof route === "function" ? route(init) : route.clone();
  };
  impl.calls = calls;
  return impl;
}

async function request(fetchImpl, path, { method = "GET", host = "hemu.krd", backends = [backend], log = () => {} } = {}) {
  const handler = createHandler({ backends, fetchImpl, log });
  const res = {
    statusCode: 0, headers: {}, body: undefined, headersSent: false,
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
    end(body) { this.body = body === undefined ? "" : Buffer.from(body).toString("utf8"); this.headersSent = true; },
  };
  await handler({ method, url: path, headers: { "x-forwarded-host": host } }, res);
  return res;
}

const head = (html) => html.slice(0, html.indexOf("</head>"));
const tag = (html, key) => {
  const match = new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)" />`, "u").exec(head(html));
  return match ? match[1] : null;
};
const title = (html) => /<title>([^<]*)<\/title>/u.exec(html)[1];
const PREVIEW = /[ \t]*(?:<title>[^<]*<\/title>|<meta\s+(?:name="(?:description|twitter:[a-z:_]+)"|property="og:[a-z:_]+")\s[^>]*>)[ \t]*\n?/gu;

test("compact ids round-trip like the app, and malformed ids are refused", () => {
  const compact = compactUuid(LISTING_ID);
  assert.equal(compact.length, 22);
  assert.equal(uuidFromPublicId(compact), LISTING_ID);
  assert.equal(uuidFromPublicId(LISTING_ID.toUpperCase()), LISTING_ID);
  for (const bad of ["", "x", `${compact}A`, compact.slice(0, 21), `${compact.slice(0, 21)}B`, "11b9df38-f307-02d7-9000-47b7d6a9ba4f", "../../etc/passwd", "%2e%2e"]) {
    assert.equal(uuidFromPublicId(bad), null, bad);
  }
});

test("routes: listing and /u ids canonicalize to the compact link; usernames follow the backend rule", () => {
  assert.deepEqual(routeFor(`/listing/${LISTING_ID}`), { kind: "listing", id: LISTING_ID, url: `https://hemu.krd${LISTING_PATH}` });
  assert.equal(routeFor(`/u/${compactUuid(SELLER_ID)}`).url, `https://hemu.krd/u/${compactUuid(SELLER_ID)}`);
  assert.deepEqual(routeFor("/Seller.One"), { kind: "username", username: "seller.one", url: "https://hemu.krd/seller.one" });
  for (const ok of ["abc", "a_b", "a.b.c", "x".repeat(20), "007", "seller_one"]) assert.equal(routeFor(`/${ok}`)?.username, ok, ok);
  for (const bad of ["ab", "x".repeat(21), ".abc", "abc.", "_abc", "abc_", "a..b", "a._b", "a-b", "a b", "ab%63", "abç", "اسم"]) {
    assert.equal(routeFor(`/${bad}`), null, bad);
  }
  for (const reserved of ["privacy", "terms", "support", "signup", "admin", "listing", "index.html", "404.html", "lang.js", "og.jpg", "favicon.png", "legal.css"]) {
    assert.equal(routeFor(`/${reserved}`), null, reserved);
  }
  for (const other of ["/", "/listing/x", "/listing/a/b", "/u/x", "/a/b/c", "/auth/captcha", `/listing/${LISTING_ID}/x`]) assert.equal(routeFor(other), null, other);
});

test("prices read like the app's English formatPrice, in the listing's own currency", () => {
  const cases = [
    [{ price: 13448, currency: "USD" }, ltr("$13,448")],
    [{ price: 0, currency: "USD" }, "Free"],
    [{ price: null, currency: "USD" }, ""],
    [{ price: null, priceLabel: "See pay", currency: "USD" }, "See pay"],
    [{ price: 250000, currency: "IQD" }, ltr("IQD 250,000")],
    [{ price: 34715000, currency: "IQD" }, ltr("IQD 34,715,000")],
    [{ price: 1234, currency: "TRY" }, ltr("₺1,234")],
    [{ price: 1234, currency: "SYP" }, ltr("1,234 SP")],
    [{ price: 1234, currency: "IRR" }, ltr("1,234 تومان")],
    [{ price: 600, currency: "USD", priceUnit: "month" }, `${ltr("$600")} / month`],
    [{ price: 50, currency: "USD", priceUnit: "from" }, `From ${ltr("$50")}`],
    [{ price: 12.5, currency: "USD" }, ltr("$12.5")],
    [{ price: 5, currency: "EUR" }, ""],
    [{ price: -1, currency: "USD" }, ""],
    [{ price: Number.NaN, currency: "USD" }, ""],
  ];
  for (const [input, expected] of cases) assert.equal(formatPrice(input), expected, JSON.stringify(input));
});

test("descriptions collapse whitespace and cut near 150 characters at a word boundary", () => {
  assert.equal(truncate("  short\n\ttext  ", 150), "short text");
  const long = `${"word ".repeat(40)}end`;
  const cut = truncate(long, 150);
  assert(cut.endsWith("word…"), cut);
  assert(Array.from(cut).length <= 150);
  assert.equal(truncate("x".repeat(200), 150), `${"x".repeat(149)}…`);
  // Graphemes are never split: a family emoji stays whole.
  const family = "👨‍👩‍👧";
  assert.equal(truncate(family.repeat(10), 5), `${family.repeat(4)}…`);
});

test("listing card: first photo, title with price, city · condition · description", async () => {
  const fetchImpl = fakeFetch({ [`/listings/${LISTING_ID}`]: json(200, listing()) });
  const res = await request(fetchImpl, LISTING_PATH);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["cache-control"], CACHE.found);
  assert.equal(title(res.body), `Toyota Corolla 2022, one owner · ${ltr("$18,500")}`);
  assert.equal(tag(res.body, "og:title"), title(res.body));
  assert.equal(tag(res.body, "og:type"), "website");
  assert.equal(tag(res.body, "og:url"), `https://hemu.krd${LISTING_PATH}`);
  assert.equal(tag(res.body, "og:site_name"), "hemû");
  const description = "Hewlêr · Good · 45,000 km. One owner, full service history, no accidents. Call or message for details.";
  assert.equal(tag(res.body, "og:description"), description);
  assert.equal(tag(res.body, "description"), description);
  assert.equal(tag(res.body, "og:image"), `${STORAGE}/listing-media/a/full.jpg?width=720&amp;height=720&amp;quality=82&amp;resize=contain`);
  assert.equal(tag(res.body, "og:image:width"), "540");
  assert.equal(tag(res.body, "og:image:height"), "720");
  assert.equal(tag(res.body, "og:image:type"), null);
  assert.equal(tag(res.body, "og:image:alt"), "Toyota Corolla 2022, one owner");
  assert.equal(tag(res.body, "twitter:card"), "summary_large_image");
  // One backend call, pinned to the database region, no credentials.
  const api = fetchImpl.calls.filter(({ url }) => url.startsWith(API));
  assert.equal(api.length, 1);
  assert.equal(api[0].url, `${API}/listings/${LISTING_ID}`);
  assert.equal(api[0].init.headers["x-region"], "eu-west-1");
  assert(!("Authorization" in api[0].init.headers) && !("apikey" in api[0].init.headers));
  assert.equal(api[0].init.redirect, "error");
  assert.equal(res.headers["set-cookie"], undefined);
});

test("listing parts that are missing are left out, and an unknown photo size gives no dimensions", async () => {
  const body = listing({ price: null, condition: "mystery", description: "", location: null, images: [{ ...listing().images[0], width: 200, height: 100 }] });
  const res = await request(fakeFetch({ [`/listings/${LISTING_ID}`]: json(200, body) }), LISTING_PATH);
  assert.equal(title(res.body), "Toyota Corolla 2022, one owner");
  assert.equal(tag(res.body, "og:description"), null);
  assert.equal(tag(res.body, "description"), null);
  assert.equal(tag(res.body, "og:image:width"), null);
  const noPhoto = await request(fakeFetch({ [`/listings/${LISTING_ID}`]: json(200, listing({ images: [] })) }), LISTING_PATH);
  assert.equal(tag(noPhoto.body, "og:image"), "https://hemu.krd/og.jpg");
  assert.equal(tag(noPhoto.body, "og:image:width"), "1200");
});

test("hostile listing text is escaped, cleaned and capped; Kurdish, Arabic and emoji stay intact", async () => {
  const hostile = `"><script>alert('x')</script>\n<b>&amp;${RLO}evil`;
  const res = await request(
    fakeFetch({ [`/listings/${LISTING_ID}`]: json(200, listing({ title: hostile, description: "کوردی 🚗 عربي\n\nسەیارە" })) }),
    LISTING_PATH,
  );
  const h = head(res.body);
  assert(!h.includes("<script>alert"), "no markup injected");
  assert(!h.includes(RLO), "bidi override removed");
  assert.equal(tag(res.body, "og:title"), `&quot;&gt;&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; &lt;b&gt;&amp;amp;evil · ${ltr("$18,500")}`);
  assert(title(res.body).startsWith("&quot;&gt;&lt;script&gt;"));
  assert.equal(tag(res.body, "og:description"), "Hewlêr · Good · کوردی 🚗 عربي سەیارە");
  const longTitle = await request(fakeFetch({ [`/listings/${LISTING_ID}`]: json(200, listing({ title: "ب".repeat(500) })) }), LISTING_PATH);
  assert(Array.from(tag(longTitle.body, "og:title")).length < 130);
});

test("a listing image that is not the backend's own public storage is never used", () => {
  for (const bad of [
    "https://evil.example/storage/v1/render/image/public/a.jpg",
    "http://vtuvotfgjhpkygrzxlom.supabase.co/storage/v1/render/image/public/a.jpg",
    "https://vtuvotfgjhpkygrzxlom.supabase.co/storage/v1/object/sign/listing-media/a.jpg?token=x",
    "https://vtuvotfgjhpkygrzxlom.supabase.co/storage/v1/render/image/public/a.jpg?token=x",
    "https://user:pw@vtuvotfgjhpkygrzxlom.supabase.co/storage/v1/render/image/public/a.jpg",
    "javascript:alert(1)",
    "",
    null,
  ]) assert.equal(publicImageUrl(bad, API), null, String(bad));
  assert.equal(publicImageUrl(`${STORAGE}/a.jpg?width=720`, API), `${STORAGE}/a.jpg?width=720`);
});

test("sold listings say so: from the LISTING_SOLD notice, and from a sold payload with its title", async () => {
  const notice = await request(fakeFetch({ [`/listings/${LISTING_ID}`]: json(404, { code: "LISTING_SOLD", status: 404 }) }), LISTING_PATH);
  assert.equal(title(notice.body), "Sold on hemû");
  assert.equal(tag(notice.body, "og:description"), "This listing is no longer available. See more on hemû.");
  assert.equal(tag(notice.body, "og:image"), "https://hemu.krd/og.jpg");
  assert.equal(tag(notice.body, "og:url"), `https://hemu.krd${LISTING_PATH}`);
  const payload = await request(fakeFetch({ [`/listings/${LISTING_ID}`]: json(200, listing({ status: "sold" })) }), LISTING_PATH);
  assert.equal(title(payload.body), "Sold · Toyota Corolla 2022, one owner");
  assert.equal(tag(payload.body, "og:image"), "https://hemu.krd/og.jpg");
});

test("profile card by username and by id, with and without a username, avatar or listings", async () => {
  const byName = await request(fakeFetch({ "/users/by-username/rebaz.hewrami": json(200, profile()) }), "/Rebaz.Hewrami");
  assert.equal(title(byName.body), "Rêbaz Hewramî on hemû");
  assert.equal(tag(byName.body, "og:description"), "@rebaz.hewrami · 19 listings · Hewlêr");
  assert.equal(tag(byName.body, "og:type"), "profile");
  assert.equal(tag(byName.body, "og:url"), "https://hemu.krd/rebaz.hewrami");
  assert.equal(tag(byName.body, "og:image"), profile().avatarUrl.replace(/&/gu, "&amp;"));
  assert.equal(tag(byName.body, "og:image:alt"), "Rêbaz Hewramî");
  assert.equal(tag(byName.body, "twitter:card"), "summary");

  const path = `/u/${compactUuid(SELLER_ID)}`;
  const byId = await request(
    fakeFetch({ [`/users/${SELLER_ID}`]: json(200, profile({ username: null, avatarUrl: undefined, stats: { active: 1 }, location: undefined })) }),
    path,
  );
  assert.equal(tag(byId.body, "og:description"), "1 listing");
  assert.equal(tag(byId.body, "og:url"), `https://hemu.krd${path}`);
  assert.equal(tag(byId.body, "og:image"), "https://hemu.krd/og.jpg");
  assert.equal(tag(byId.body, "og:image:width"), "1200");

  // A lookup that answers with someone else's handle or id is not trusted.
  const mismatch = await request(fakeFetch({ "/users/by-username/rebaz.hewrami": json(200, profile({ username: "other" })) }), "/rebaz.hewrami");
  assert.equal(mismatch.body, INDEX);
});

test("anything not found, hidden or failing serves the page unchanged with HTTP 200", async () => {
  const cases = [
    ["not found", json(404, { code: "NOT_FOUND" }), CACHE.notFound],
    ["blocked/hidden payload", json(200, listing({ status: "hidden" })), CACHE.notFound],
    ["wrong id", json(200, listing({ id: SELLER_ID })), CACHE.notFound],
    ["server error", json(500, { code: "INTERNAL_ERROR" }), CACHE.error],
    ["rate limited", json(429, { code: "RATE_LIMITED" }), CACHE.error],
    ["bad request", json(400, { code: "VALIDATION_ERROR" }), CACHE.notFound],
    ["not JSON", new Response("<html>", { status: 200 }), CACHE.error],
    ["too large", new Response("x".repeat(300 * 1024), { status: 200 }), CACHE.error],
    ["network failure", () => Promise.reject(new TypeError("fetch failed")), CACHE.error],
    // A backend that never answers. AbortSignal.timeout does not keep Node alive, so this test does.
    ["timeout", (init) => new Promise((_, reject) => {
      const keepAlive = setTimeout(() => {}, 10_000);
      init.signal.addEventListener("abort", () => { clearTimeout(keepAlive); reject(init.signal.reason); });
    }), CACHE.error],
  ];
  for (const [name, response, cache] of cases) {
    const started = Date.now();
    const res = await request(fakeFetch({ [`/listings/${LISTING_ID}`]: response }), LISTING_PATH);
    assert.equal(res.statusCode, 200, name);
    assert.equal(res.body, INDEX, name);
    assert.equal(res.headers["cache-control"], cache, name);
    assert(Date.now() - started < 4000, `${name} is bounded by the timeout`);
  }
});

test("paths that name nothing previewable never reach the backend", async () => {
  for (const path of ["/listing/x", "/u/%2e%2e%2fadmin", "/privacy", "/a..b", `/listing/${LISTING_ID}?x=<script>`.replace("?", "%3F")]) {
    const fetchImpl = fakeFetch({});
    const res = await request(fetchImpl, path);
    assert.equal(res.body, INDEX, path);
    assert.equal(fetchImpl.calls.filter(({ url }) => url.startsWith(API)).length, 0, path);
  }
  // The query string is ignored, never reflected.
  const res = await request(fakeFetch({ [`/listings/${LISTING_ID}`]: json(200, listing()) }), `${LISTING_PATH}?utm="><script>`);
  assert(!res.body.includes("utm"));
  assert.equal(tag(res.body, "og:url"), `https://hemu.krd${LISTING_PATH}`);
});

test("only the preview tags change: the rest of index.html is byte-identical", async () => {
  const res = await request(fakeFetch({ [`/listings/${LISTING_ID}`]: json(200, listing()) }), LISTING_PATH);
  assert.notEqual(res.body, INDEX);
  assert.equal(res.body.replace(PREVIEW, ""), INDEX.replace(PREVIEW, ""));
  assert.equal(res.body.slice(res.body.indexOf("</head>")), INDEX.slice(INDEX.indexOf("</head>")));
  // The tags sit where the old ones were, in the same order of kinds.
  assert(head(res.body).indexOf("<title>") > head(res.body).indexOf('<script src="/lang.js">'));
  assert.equal(applyCard("<html><body></body></html>", { title: "x" }), null);
});

test("HEAD answers headers only; other methods are refused; security headers match firebase.json", async () => {
  const fetchImpl = fakeFetch({ [`/listings/${LISTING_ID}`]: json(200, listing()) });
  const get = await request(fetchImpl, LISTING_PATH);
  const headRes = await request(fetchImpl, LISTING_PATH, { method: "HEAD" });
  assert.equal(headRes.statusCode, 200);
  assert.equal(headRes.body, "");
  assert.equal(headRes.headers["content-length"], get.headers["content-length"]);
  const post = await request(fetchImpl, LISTING_PATH, { method: "POST" });
  assert.equal(post.statusCode, 405);
  assert.equal(post.headers.allow, "GET, HEAD");

  const config = JSON.parse(await read("firebase.json"));
  const site = config.hosting.headers.find((rule) => rule.source === "**").headers;
  for (const { key, value } of site) {
    if (key === "Cache-Control") continue;
    assert.equal(SECURITY_HEADERS[key], value, key);
    assert.equal(get.headers[key.toLowerCase()], value, key);
  }
  assert.equal(get.headers["content-type"], "text/html; charset=utf-8");
});

test("index.html comes from this site's own Hosting only, and a failed read degrades without a 5xx", async () => {
  const urls = [];
  let fail = false;
  let now = 0;
  const source = createIndexSource(async (url) => {
    urls.push(url);
    if (fail) throw new Error("down");
    return new Response(INDEX, { status: 200 });
  }, () => now);
  assert.equal(await source("evil.example"), INDEX);
  assert.equal(await source("hemu-fd2f4--pr-44-abc123.web.app"), INDEX);
  assert.equal(await source("hemu.krd"), INDEX);
  assert.deepEqual(urls, ["https://hemu.krd/index.html", "https://hemu-fd2f4--pr-44-abc123.web.app/index.html"]);
  fail = true;
  now = 10 * 60_000;
  assert.equal(await source("hemu.krd"), INDEX, "stale copy when Hosting cannot be read");

  const handler = createHandler({ backends: [backend], fetchImpl: fakeFetch({}), indexSource: async () => null, log: () => {} });
  const res = { headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(b) { this.body = String(b ?? ""); } };
  await handler({ method: "GET", url: "/seller.one", headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, UNAVAILABLE_PAGE);
  assert.equal(res.headers["cache-control"], "no-store");
  assert.throws(() => createHandler({ backends: [] }));
  assert.throws(() => createHandler({ backends: [{ name: "evil", apiUrl: "https://evil.example", region: "x" }] }));
});

test("logs carry the outcome and an id only", async () => {
  const lines = [];
  const handler = createHandler({ backends: [backend], fetchImpl: fakeFetch({ "/users/by-username/rebaz.hewrami": json(200, profile()) }), log: (line) => lines.push(line) });
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end() {} };
  await handler({ method: "GET", url: "/rebaz.hewrami", headers: {} }, res);
  await handler({ method: "GET", url: "/nobody.here", headers: {} }, res);
  assert.deepEqual(lines.map((line) => JSON.parse(line)), [
    { preview: "username", outcome: "found", id: SELLER_ID, backend: "staging" },
    { preview: "username", outcome: "notFound", id: null, backend: null },
  ]);
  assert(!lines.join("").includes("rebaz") && !lines.join("").includes("nobody"));
});

// --- Production first, staging as fallback -----------------------------------

const BOTH = [BACKENDS.production, BACKENDS.staging];
const prodCalls = (fetchImpl) => fetchImpl.calls.filter(({ url }) => url.startsWith(PROD_API));
const stagingCalls = (fetchImpl) => fetchImpl.calls.filter(({ url }) => url.startsWith(API));
const never = (init) => new Promise((_, reject) => {
  const keepAlive = setTimeout(() => {}, 10_000);
  init.signal.addEventListener("abort", () => { clearTimeout(keepAlive); reject(init.signal.reason); });
});
const lookupPath = `/listings/${LISTING_ID}`;
const prodListing = listing({ title: "From production", images: [{ ...listing().images[1], fullUrl: `${PROD_STORAGE}/listing-media/p/full.jpg?width=720&height=720&resize=contain` }] });

test("found in production: staging is never called, long cache, backend logged", async () => {
  const lines = [];
  const fetchImpl = fakeFetch({ [lookupPath]: json(200, listing()) }, { [lookupPath]: json(200, prodListing) });
  const res = await request(fetchImpl, LISTING_PATH, { backends: BOTH, log: (line) => lines.push(line) });
  assert.equal(title(res.body), `From production · ${ltr("$18,500")}`);
  assert.equal(res.headers["cache-control"], CACHE.found);
  assert.equal(prodCalls(fetchImpl).length, 1);
  assert.equal(prodCalls(fetchImpl)[0].init.headers["x-region"], "eu-central-1");
  assert.equal(stagingCalls(fetchImpl).length, 0);
  assert.deepEqual(JSON.parse(lines[0]), { preview: "listing", outcome: "found", id: LISTING_ID, backend: "production" });
  // The image comes from production's own storage.
  assert(tag(res.body, "og:image").startsWith(PROD_STORAGE));
});

test("clean not-found in production falls back to staging with the long cache", async () => {
  for (const missing of [json(404, { code: "NOT_FOUND" }), json(200, listing({ status: "hidden" }))]) {
    const lines = [];
    const fetchImpl = fakeFetch({ [lookupPath]: json(200, listing()) }, { [lookupPath]: missing });
    const res = await request(fetchImpl, LISTING_PATH, { backends: BOTH, log: (line) => lines.push(line) });
    assert.equal(title(res.body), `Toyota Corolla 2022, one owner · ${ltr("$18,500")}`);
    assert.equal(res.headers["cache-control"], CACHE.found);
    assert.equal(prodCalls(fetchImpl).length, 1);
    assert.equal(stagingCalls(fetchImpl).length, 1);
    assert.equal(JSON.parse(lines[0]).backend, "staging");
    assert(tag(res.body, "og:image").startsWith(STORAGE));
  }
});

test("a production error or timeout still tries staging, and any answer then carries the short cache", async () => {
  const failures = [
    json(500, { code: "INTERNAL_ERROR" }),
    json(429, { code: "RATE_LIMITED" }),
    new Response("<html>", { status: 200 }),
    new Response("x".repeat(300 * 1024), { status: 200 }),
    () => Promise.reject(new TypeError("fetch failed")),
    never,
  ];
  for (const failure of failures) {
    const found = await request(fakeFetch({ [lookupPath]: json(200, listing()) }, { [lookupPath]: failure }), LISTING_PATH, { backends: BOTH });
    assert.equal(title(found.body), `Toyota Corolla 2022, one owner · ${ltr("$18,500")}`);
    assert.equal(found.headers["cache-control"], CACHE.error);
    // Nothing anywhere after an error: generic page, short cache.
    const nowhere = await request(fakeFetch({}, { [lookupPath]: failure }), LISTING_PATH, { backends: BOTH });
    assert.equal(nowhere.body, INDEX);
    assert.equal(nowhere.headers["cache-control"], CACHE.error);
  }
  // Staging failing after a clean production miss is also an error.
  const stagingDown = await request(fakeFetch({ [lookupPath]: json(500, {}) }), LISTING_PATH, { backends: BOTH });
  assert.equal(stagingDown.headers["cache-control"], CACHE.error);
});

test("not found in every backend serves the generic page with the not-found cache", async () => {
  const lines = [];
  const fetchImpl = fakeFetch({}, {});
  const res = await request(fetchImpl, LISTING_PATH, { backends: BOTH, log: (line) => lines.push(line) });
  assert.equal(res.body, INDEX);
  assert.equal(res.headers["cache-control"], CACHE.notFound);
  assert.equal(prodCalls(fetchImpl).length + stagingCalls(fetchImpl).length, 2);
  assert.deepEqual(JSON.parse(lines[0]), { preview: "listing", outcome: "notFound", id: LISTING_ID, backend: null });
});

test("sold in production is final: sold card, long cache, staging not called", async () => {
  const fetchImpl = fakeFetch({ [lookupPath]: json(200, listing()) }, { [lookupPath]: json(404, { code: "LISTING_SOLD" }) });
  const res = await request(fetchImpl, LISTING_PATH, { backends: BOTH });
  assert.equal(title(res.body), "Sold on hemû");
  assert.equal(res.headers["cache-control"], CACHE.found);
  assert.equal(stagingCalls(fetchImpl).length, 0);
  // Sold only in staging, after a clean production miss, is a sold card too.
  const later = await request(fakeFetch({ [lookupPath]: json(404, { code: "LISTING_SOLD" }) }), LISTING_PATH, { backends: BOTH });
  assert.equal(title(later.body), "Sold on hemû");
  assert.equal(later.headers["cache-control"], CACHE.found);
});

test("profiles and usernames: production first, the same username in both gives production", async () => {
  const both = fakeFetch(
    { "/users/by-username/rebaz.hewrami": json(200, profile({ name: "Staging Rebaz" })) },
    { "/users/by-username/rebaz.hewrami": json(200, profile({ name: "Production Rebaz" })) },
  );
  const res = await request(both, "/rebaz.hewrami", { backends: BOTH });
  assert.equal(title(res.body), "Production Rebaz on hemû");
  assert.equal(stagingCalls(both).length, 0);
  const onlyStaging = await request(fakeFetch({ "/users/by-username/rebaz.hewrami": json(200, profile()) }), "/rebaz.hewrami", { backends: BOTH });
  assert.equal(title(onlyStaging.body), "Rêbaz Hewramî on hemû");
  assert.equal(onlyStaging.headers["cache-control"], CACHE.found);
  const byId = await request(fakeFetch({ [`/users/${SELLER_ID}`]: json(200, profile()) }), `/u/${compactUuid(SELLER_ID)}`, { backends: BOTH });
  assert.equal(title(byId.body), "Rêbaz Hewramî on hemû");
});

test("each backend only accepts images from its own public storage", () => {
  const stagingImage = `${STORAGE}/a.jpg?width=720`;
  const prodImage = `${PROD_STORAGE}/a.jpg?width=720`;
  assert.equal(publicImageUrl(prodImage, PROD_API), prodImage);
  assert.equal(publicImageUrl(stagingImage, API), stagingImage);
  assert.equal(publicImageUrl(stagingImage, PROD_API), null);
  assert.equal(publicImageUrl(prodImage, API), null);
});

test("a production payload cannot carry a staging image into its card", async () => {
  const fetchImpl = fakeFetch({}, { [lookupPath]: json(200, listing()) });
  const res = await request(fetchImpl, LISTING_PATH, { backends: BOTH });
  assert.equal(tag(res.body, "og:image"), "https://hemu.krd/og.jpg");
});

test("HEMU_BACKENDS: ordered list, a single name, and startup failures", () => {
  assert.deepEqual(parseBackends("production,staging"), [BACKENDS.production, BACKENDS.staging]);
  assert.deepEqual(parseBackends(" staging , production "), [BACKENDS.staging, BACKENDS.production]);
  assert.deepEqual(parseBackends("production"), [BACKENDS.production]);
  assert.deepEqual(parseBackends(undefined), [BACKENDS.production, BACKENDS.staging]);
  for (const bad of ["", " ", "prod", "production,", ",staging", "production,production", "production,old", "https://evil.example", "toString", "__proto__"]) {
    assert.throws(() => parseBackends(bad), Error, JSON.stringify(bad));
  }
  assert.match(envText, /^HEMU_BACKENDS=production,staging$/mu);
});

test("two timing-out backends stay inside the time budget", async () => {
  const started = Date.now();
  const res = await request(fakeFetch({ [lookupPath]: never }, { [lookupPath]: never }), LISTING_PATH, { backends: BOTH });
  const elapsed = Date.now() - started;
  assert.equal(res.body, INDEX);
  assert.equal(res.headers["cache-control"], CACHE.error);
  assert(elapsed >= API_TIMEOUT_MS * 2 - 100 && elapsed < 5500, `${elapsed} ms`);
});

// --- Hosting routing -------------------------------------------------------

/** Firebase Hosting's order: exact static file first, then the first matching rewrite. */
function hostingTarget(config, files, path) {
  if (files.has(path) || files.has(`${path}/index.html`)) return "static";
  for (const rule of config.hosting.rewrites) {
    const matches = rule.regex
      ? new RegExp(rule.regex, "u").test(path)
      : new RegExp(`^${rule.source.replace(/[.+?^${}()|[\]\\]/gu, "\\$&").replace(/\*\*/gu, "\u0000").replace(/\*/gu, "[^/]*").replace(/\u0000/gu, ".*")}$`, "u").test(path);
    if (matches) return rule.run ? `run:${rule.run.serviceId}@${rule.run.region}` : rule.destination;
  }
  return 404;
}

async function publicFiles() {
  const files = new Set(["/index.html", "/assets/index-abc.js"]);
  const walk = async (dir, prefix) => {
    for (const entry of await readdir(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })) {
      const path = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) await walk(`${dir}/${entry.name}`, path);
      else files.add(path);
    }
  };
  await walk("public", "");
  return files;
}

test("firebase.json sends only previewable link shapes to the function; site pages stay static", async () => {
  const config = JSON.parse(await read("firebase.json"));
  const files = await publicFiles();
  const fn = "run:sharepreview@europe-west1";
  const expected = {
    [LISTING_PATH]: fn,
    [`/listing/${LISTING_ID}`]: fn,
    [`/u/${compactUuid(SELLER_ID)}`]: fn,
    "/seller.one": fn,
    "/seller_one": fn,
    "/Botan": fn,
    "/listing/x": "/index.html",
    "/listing/a/b": "/index.html",
    "/u/x": "/index.html",
    "/signup": "/index.html",
    "/signup/verify": "/index.html",
    "/ab": "/index.html",
    "/__hemu_route_smoke_missing__": "/index.html",
    "/a/b/c": 404,
    "/": "/index.html",
  };
  for (const [path, target] of Object.entries(expected)) assert.equal(hostingTarget(config, files, path), target, path);
  for (const path of ["/privacy", "/terms", "/data-deletion", "/support", "/404.html", "/og.jpg", "/favicon.png", "/lang.js", "/legal.css", "/index.html", "/.well-known/apple-app-site-association", "/.well-known/assetlinks.json", "/assets/index-abc.js", "/auth/captcha/sitekeys.json", "/auth/captcha", "/auth/callback"]) {
    assert.equal(hostingTarget(config, files, path), "static", path);
  }
  // Every rewrite to the function is a tight regex, and the catch-all stays last.
  const runs = config.hosting.rewrites.filter((rule) => rule.run);
  assert.equal(runs.length, 3);
  for (const rule of runs) assert(rule.regex?.startsWith("^/") && rule.regex.endsWith("$"), rule.regex);
  assert.deepEqual(config.hosting.rewrites.at(-1), { source: "/*", destination: "/index.html" });
  assert.equal(config.functions[0].source, "functions");
  assert.equal(config.functions[0].runtime, "nodejs22");
});

test("every top-level site name that looks like a username is reserved in the function too", async () => {
  const shape = /^[A-Za-z0-9][A-Za-z0-9._]{1,18}[A-Za-z0-9]$/u;
  const names = (await readdir(new URL("../public", import.meta.url))).concat(["index.html", "assets", "signup"]);
  for (const name of names) if (shape.test(name)) assert(RESERVED_USERNAMES.has(name.toLowerCase()), name);
  const config = JSON.parse(await read("firebase.json"));
  assert.equal(config.hosting.rewrites.find((rule) => rule.run && !rule.regex.includes("listing") && !rule.regex.includes("/u/")).regex, shape.source.replace(/^\^/u, "^/"));
});

test("association files are untouched by the preview routes", async () => {
  const aasa = JSON.parse(await read("public/.well-known/apple-app-site-association"));
  const ids = aasa.applinks.details[0].appIDs;
  assert.deepEqual(ids, ["H4AD8Y6PQ2.krd.hemu.app", "H4AD8Y6PQ2.krd.hemu.app.staging"]);
  const links = JSON.parse(await read("public/.well-known/assetlinks.json"));
  assert(links.some((entry) => entry.target?.package_name === "krd.hemu.app"));
});
