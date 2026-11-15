// Link previews for shared hemû links (/listing/<id>, /u/<id>, /<username>).
//
// Chat apps read a page's preview tags without running its JavaScript. This
// module serves the site's own index.html with only those tags filled from the
// backend's public, unauthenticated API. Everything else in the page stays
// byte-identical, so a person opening the link gets the same page as before.
//
// No dependencies: firebase.json routes the requests here through
// functions/index.mjs, and the repository's tests import this file directly.

/** Backends the function may call. Fixed; never derived from a request. */
export const BACKENDS = Object.freeze({
  staging: Object.freeze({
    apiUrl: "https://vtuvotfgjhpkygrzxlom.supabase.co/functions/v1/api",
    region: "eu-west-1",
  }),
  production: Object.freeze({
    apiUrl: "https://spfwebddkaxvqslyxvln.supabase.co/functions/v1/api",
    region: "eu-central-1",
  }),
});

export const SITE_ORIGIN = "https://hemu.krd";
export const GENERIC_IMAGE = Object.freeze({
  url: `${SITE_ORIGIN}/og.jpg`,
  type: "image/jpeg",
  width: 1200,
  height: 630,
});

/** Hosts whose own /index.html may be fetched: the live site and this project's Hosting channels. */
const SITE_HOST = /^(?:hemu\.krd|hemu-fd2f4\.web\.app|hemu-fd2f4\.firebaseapp\.com|hemu-fd2f4--[a-z0-9-]{1,63}\.web\.app)$/u;

/** Same values as the `**` rule in firebase.json (a test keeps them equal). */
export const SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy":
    "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
});

/**
 * CDN caching. A found item is cached long enough that repeated crawls of a
 * busy link stay off the backend; a definite "nothing to show" is cached
 * briefly so a newly visible item soon gets its card; a backend error or
 * timeout is cached for seconds only, enough to absorb a burst of crawlers.
 */
export const CACHE = Object.freeze({
  found: "public, max-age=300, s-maxage=600",
  notFound: "public, max-age=60, s-maxage=120",
  error: "public, max-age=0, s-maxage=30",
  unavailable: "no-store",
});

export const API_TIMEOUT_MS = 2500;
const INDEX_TIMEOUT_MS = 2000;
const INDEX_TTL_MS = 300_000;
const MAX_API_BYTES = 256 * 1024;
const MAX_INDEX_BYTES = 512 * 1024;

/** Card wording. English only for now: crawlers send no useful locale. Add a language as another entry. */
export const LABELS = Object.freeze({
  en: Object.freeze({
    siteName: "hemû",
    soldPrefix: "Sold",
    soldUntitled: "Sold on hemû",
    soldDescription: "This listing is no longer available. See more on hemû.",
    profileTitle: (name) => `${name} on hemû`,
    listings: (count, formatted) => `${formatted} ${count === 1 ? "listing" : "listings"}`,
    free: "Free",
    priceUnits: {
      hour: (p) => `${p} / hour`,
      day: (p) => `${p} / day`,
      month: (p) => `${p} / month`,
      year: (p) => `${p} / year`,
      project: (p) => `${p} / project`,
      from: (p) => `From ${p}`,
    },
    conditions: {
      new: "New",
      like_new: "Like new",
      good: "Good",
      fair: "Fair",
      for_parts: "For parts / not working",
      new_with_tags: "New with tags",
      new_without_tags: "New without tags",
    },
    numberLocale: "en-US",
  }),
});

// ---------------------------------------------------------------------------
// Ids and usernames

const UUID = /^([0-9a-f]{8})-([0-9a-f]{4})-([1-8][0-9a-f]{3})-([89ab][0-9a-f]{3})-([0-9a-f]{12})$/iu;
const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** The app's compact share id (src/lib/compactUuid.ts): 22 base64url characters for 16 bytes. */
export function compactUuid(uuid) {
  if (!UUID.test(uuid)) return null;
  const bytes = uuid.replace(/-/gu, "").match(/.{2}/gu).map((pair) => Number.parseInt(pair, 16));
  let output = "";
  let accumulator = 0;
  let bits = 0;
  for (const byte of bytes) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      output += BASE64URL.charAt((accumulator >> bits) & 63);
      accumulator &= (1 << bits) - 1;
    }
  }
  return output + BASE64URL.charAt((accumulator << (6 - bits)) & 63);
}

/** Accept the compact share id and the legacy canonical UUID, as the app does. Lowercase UUID or null. */
export function uuidFromPublicId(value) {
  if (typeof value !== "string") return null;
  if (UUID.test(value)) return value.toLowerCase();
  if (value.length !== 22) return null;
  let accumulator = 0;
  let bits = 0;
  const bytes = [];
  for (const character of value) {
    const digit = BASE64URL.indexOf(character);
    if (digit < 0) return null;
    accumulator = (accumulator << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((accumulator >> bits) & 255);
      accumulator &= (1 << bits) - 1;
    }
  }
  if (bytes.length !== 16 || bits !== 4 || accumulator !== 0) return null;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return UUID.test(uuid) ? uuid : null;
}

/** The backend's username rule (app.profiles / app.reserved_usernames checks; mobile src/lib/username.ts). */
const USERNAME = /^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$/u;

/**
 * Words the backend reserves as usernames plus every name the site serves
 * itself. Hosting serves static files before any rewrite, so this is a second
 * line: these never cause a backend call.
 */
export const RESERVED_USERNAMES = new Set([
  // app.reserved_usernames (backend baseline reference data).
  "about", "account", "accounts", "admin", "administrator", "api", "app", "auth", "bot", "chat",
  "contact", "favicon.png", "favorites", "help", "hemu", "legal.css", "listing", "listings", "login",
  "me", "moderator", "null", "official", "og.png", "onboarding", "privacy", "robots.txt", "root",
  "search", "security", "sell", "seller", "settings", "signup", "sitemap.xml", "staff", "support",
  "system", "terms", "undefined", "user", "username", "www",
  // The website's own pages and files.
  "index.html", "404.html", "lang.js", "og.jpg", "assets", "data-deletion", "well-known",
]);

/** Lowercased username when it has the backend's shape and is not reserved, else null. */
export function shareableUsername(value) {
  if (typeof value !== "string") return null;
  const username = value.toLowerCase();
  if (!USERNAME.test(username) || /[._]{2}/u.test(username)) return null;
  return RESERVED_USERNAMES.has(username) ? null : username;
}

/** Which preview a request path asks for, or null when it names nothing previewable. */
export function routeFor(path) {
  if (typeof path !== "string" || path.length > 64) return null;
  const listing = /^\/listing\/([^/]+)$/u.exec(path);
  if (listing) {
    const id = uuidFromPublicId(listing[1]);
    return id ? { kind: "listing", id, url: `${SITE_ORIGIN}/listing/${compactUuid(id)}` } : null;
  }
  const user = /^\/u\/([^/]+)$/u.exec(path);
  if (user) {
    const id = uuidFromPublicId(user[1]);
    return id ? { kind: "profile", id, url: `${SITE_ORIGIN}/u/${compactUuid(id)}` } : null;
  }
  const single = /^\/([^/]+)$/u.exec(path);
  if (single) {
    const username = shareableUsername(single[1]);
    return username ? { kind: "username", username, url: `${SITE_ORIGIN}/${username}` } : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Text

const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

/**
 * User text made safe to place in a single-line tag: control characters
 * become spaces, explicit bidi embeddings/overrides/isolates and BOMs are
 * removed (an unbalanced one would reorder the rest of the card), whitespace
 * collapses. Joiners and directional marks stay: Kurdish and Persian need them.
 */
export function cleanText(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/gu, " ")
    .replace(/[\u202a-\u202e\u2066-\u2069\ufeff]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

/** At most `max` graphemes; longer text is cut at a word boundary when one is near and ends with "…". */
export function truncate(value, max) {
  const text = cleanText(value);
  const graphemes = Array.from(segmenter.segment(text), ({ segment }) => segment);
  if (graphemes.length <= max) return text;
  let cut = graphemes.slice(0, max - 1).join("");
  const space = cut.lastIndexOf(" ");
  if (space >= cut.length * 0.6) cut = cut.slice(0, space);
  return `${cut.replace(/[\s.,;:!?·—–-]+$/u, "")}…`;
}

/** HTML attribute/text escaping for every dynamic value. */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

const CURRENCY_SYMBOLS = { USD: "$", IQD: "IQD", TRY: "₺", SYP: "SP", IRR: "تومان" };
const PREFIX = new Set(["USD", "TRY"]);
const PREFIX_CODE = new Set(["IQD"]);

/**
 * The app's formatPrice (mobile src/ui/formatPrice.ts) in its English, LTR
 * form: label overrides, no price shows nothing, zero is Free, otherwise the
 * grouped amount with the listing's own currency marker and optional cadence,
 * the amount kept in one left-to-right isolate as in the app.
 */
export function formatPrice(listing, labels = LABELS.en) {
  if (typeof listing.priceLabel === "string" && cleanText(listing.priceLabel)) return truncate(listing.priceLabel, 40);
  const price = listing.price;
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0) return "";
  if (price === 0) return labels.free;
  const symbol = CURRENCY_SYMBOLS[listing.currency];
  if (!symbol) return "";
  const amount = new Intl.NumberFormat(labels.numberLocale).format(price);
  const marked = PREFIX.has(listing.currency)
    ? `${symbol}${amount}`
    : PREFIX_CODE.has(listing.currency)
      ? `${symbol} ${amount}`
      : `${amount} ${symbol}`;
  const formatted = `\u2066${marked}\u2069`;
  const unit = labels.priceUnits[listing.priceUnit];
  return unit ? unit(formatted) : formatted;
}

/** English place name; for a neighbourhood, its city. */
function cityName(location) {
  if (!location || typeof location !== "object") return "";
  const place = location.kind !== "city" && location.parentCity && typeof location.parentCity === "object"
    ? location.parentCity
    : location;
  return truncate(place.names?.english ?? place.name, 60);
}

/**
 * Only images the backend serves publicly from its own storage, never another
 * host and never a signed URL.
 */
export function publicImageUrl(value, apiUrl) {
  if (typeof value !== "string" || value.length > 2048) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.host !== new URL(apiUrl).host || url.username || url.password) return null;
  if (!/^\/storage\/v1\/(?:render\/image|object)\/public\//u.test(url.pathname)) return null;
  if (url.searchParams.has("token")) return null;
  return url.href;
}

/** Pixel size of a `resize=contain` transform when it only shrinks, else null. */
function containedSize(url, width, height) {
  const params = new URL(url).searchParams;
  const boxW = Number(params.get("width"));
  const boxH = Number(params.get("height"));
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return null;
  if (params.get("resize") !== "contain" || !(boxW > 0) || !(boxH > 0)) return null;
  const scale = Math.min(boxW / width, boxH / height);
  if (scale > 1) return null;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

// ---------------------------------------------------------------------------
// Cards

/** Card for an active (or still-readable sold) listing payload; null when it has nothing to show. */
export function listingCard(listing, route, apiUrl, labels = LABELS.en) {
  if (!listing || typeof listing !== "object" || listing.id !== route.id) return null;
  const title = truncate(listing.title, 100);
  if (!title) return null;
  if (listing.status === "sold") return soldCard(route, labels, title);
  if (listing.status !== "active") return null;
  const price = formatPrice(listing, labels);
  const description = [
    cityName(listing.location),
    labels.conditions[listing.condition] ?? "",
    truncate(listing.description, 150),
  ].filter(Boolean).join(" · ");
  const images = Array.isArray(listing.images) ? [...listing.images] : [];
  images.sort((a, b) => (b?.isCover === true) - (a?.isCover === true) || (a?.sortIndex ?? 0) - (b?.sortIndex ?? 0));
  const first = images[0];
  const imageUrl = publicImageUrl(first?.fullUrl, apiUrl) ?? publicImageUrl(first?.cardUrl, apiUrl);
  const image = imageUrl
    ? { url: imageUrl, ...containedSize(imageUrl, first.width, first.height), alt: title }
    : { ...GENERIC_IMAGE, alt: labels.siteName };
  return {
    type: "website",
    url: route.url,
    title: price ? `${title} · ${price}` : title,
    description,
    image,
    twitterCard: "summary_large_image",
  };
}

export function soldCard(route, labels = LABELS.en, title = "") {
  return {
    type: "website",
    url: route.url,
    title: title ? `${labels.soldPrefix} · ${title}` : labels.soldUntitled,
    description: labels.soldDescription,
    image: { ...GENERIC_IMAGE, alt: labels.siteName },
    twitterCard: "summary_large_image",
  };
}

/** Card for a public profile payload; null when it has nothing to show. */
export function profileCard(profile, route, apiUrl, labels = LABELS.en) {
  if (!profile || typeof profile !== "object" || typeof profile.id !== "string" || !UUID.test(profile.id)) return null;
  if (route.kind === "profile" && profile.id.toLowerCase() !== route.id) return null;
  const username = typeof profile.username === "string" ? shareableUsername(profile.username) ?? "" : "";
  if (route.kind === "username" && username !== route.username) return null;
  const name = truncate(profile.name, 60) || (username ? `@${username}` : "");
  if (!name) return null;
  const active = profile.stats?.active;
  const count = Number.isInteger(active) && active >= 0
    ? labels.listings(active, new Intl.NumberFormat(labels.numberLocale).format(active))
    : "";
  const avatar = publicImageUrl(profile.avatarUrl, apiUrl);
  return {
    type: "profile",
    url: route.url,
    title: labels.profileTitle(name),
    description: [username ? `@${username}` : "", count, cityName(profile.location)].filter(Boolean).join(" · "),
    image: avatar ? { url: avatar, alt: name } : { ...GENERIC_IMAGE, alt: labels.siteName },
    twitterCard: "summary",
  };
}

// ---------------------------------------------------------------------------
// The page

/** Tags this module owns in the head: title, description, Open Graph and Twitter. */
const PREVIEW_TAG = /[ \t]*(?:<title>[^<]*<\/title>|<meta\s+(?:name="(?:description|twitter:[a-z:_]+)"|property="og:[a-z:_]+")\s[^>]*>)[ \t]*\r?\n?/gu;

export function renderTags(card, labels = LABELS.en, indent = "    ") {
  const meta = (attr, key, value) => `${indent}<meta ${attr}="${key}" content="${escapeHtml(value)}" />\n`;
  const { image } = card;
  let tags = `${indent}<title>${escapeHtml(card.title)}</title>\n`;
  if (card.description) tags += meta("name", "description", card.description);
  tags += meta("property", "og:type", card.type);
  tags += meta("property", "og:url", card.url);
  tags += meta("property", "og:site_name", labels.siteName);
  tags += meta("property", "og:title", card.title);
  if (card.description) tags += meta("property", "og:description", card.description);
  tags += meta("property", "og:image", image.url);
  if (image.type) tags += meta("property", "og:image:type", image.type);
  if (image.width && image.height) {
    tags += meta("property", "og:image:width", String(image.width));
    tags += meta("property", "og:image:height", String(image.height));
  }
  if (image.alt) tags += meta("property", "og:image:alt", image.alt);
  tags += meta("name", "twitter:card", card.twitterCard);
  return tags;
}

/** index.html with its preview tags replaced by the card's, everything else untouched; null if the shape is unexpected. */
export function applyCard(html, card, labels = LABELS.en) {
  const headEnd = html.indexOf("</head>");
  if (headEnd < 0) return null;
  const head = html.slice(0, headEnd);
  let first = -1;
  const stripped = head.replace(PREVIEW_TAG, (match, offset) => {
    if (first < 0) first = offset;
    return "";
  });
  if (first < 0) return null;
  const indent = /^[ \t]*/u.exec(head.slice(first))[0];
  // Everything before the first preview tag is unchanged, so `first` is still valid in `stripped`.
  return stripped.slice(0, first) + renderTags(card, labels, indent) + stripped.slice(first) + html.slice(headEnd);
}

/** Minimal page when the site's own index.html cannot be read: generic card, link home. */
export const UNAVAILABLE_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>hemû — Everything, near you</title>
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://hemu.krd/" />
    <meta property="og:site_name" content="hemû" />
    <meta property="og:title" content="hemû — Everything, near you" />
    <meta property="og:image" content="https://hemu.krd/og.jpg" />
    <meta name="twitter:card" content="summary_large_image" />
  </head>
  <body><p><a href="/">hemû</a></p></body>
</html>
`;

// ---------------------------------------------------------------------------
// I/O

async function readCapped(response, maxBytes) {
  const declared = Number(response.headers.get("content-length"));
  if (declared > maxBytes) throw new Error("too large");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      // Not awaited: cancelling must not wait on the sender.
      reader.cancel().catch(() => {});
      throw new Error("too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * One GET to the public API with a short timeout and no retries.
 * Result: {status:"ok", body} | {status:"notFound", code} | {status:"error"}.
 */
export async function fetchPublic(backend, path, fetchImpl = fetch, timeoutMs = API_TIMEOUT_MS) {
  try {
    const response = await fetchImpl(`${backend.apiUrl}${path}`, {
      method: "GET",
      headers: { Accept: "application/json", "Accept-Language": "en", "x-region": backend.region },
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await readCapped(response, MAX_API_BYTES);
    if (response.status === 200) return { status: "ok", body: JSON.parse(text) };
    if (response.status === 404) {
      let code = "NOT_FOUND";
      try {
        const problem = JSON.parse(text);
        if (problem?.code === "LISTING_SOLD") code = "LISTING_SOLD";
      } catch {
        // A 404 without a problem body is still "nothing to show".
      }
      return { status: "notFound", code };
    }
    return { status: response.status >= 400 && response.status < 500 ? "notFound" : "error", code: "HTTP" };
  } catch {
    return { status: "error" };
  }
}

/** The site's own index.html, fetched from Hosting and kept per host for a few minutes. */
export function createIndexSource(fetchImpl = fetch, now = Date.now) {
  const cache = new Map();
  return async function indexHtml(host) {
    const key = SITE_HOST.test(host) ? host : "hemu.krd";
    const entry = cache.get(key);
    if (entry && now() - entry.at < INDEX_TTL_MS) return entry.html;
    try {
      const response = await fetchImpl(`https://${key}/index.html`, {
        headers: { Accept: "text/html" },
        redirect: "error",
        signal: AbortSignal.timeout(INDEX_TIMEOUT_MS),
      });
      const html = await readCapped(response, MAX_INDEX_BYTES);
      if (response.status !== 200 || !html.includes("</head>") || !html.includes('property="og:title"')) {
        throw new Error("unexpected index");
      }
      if (cache.size >= 8 && !cache.has(key)) cache.delete(cache.keys().next().value);
      cache.set(key, { html, at: now() });
      return html;
    } catch {
      // A stale copy beats none; it is refreshed on the next request.
      return entry?.html ?? null;
    }
  };
}

/** Resolve a route to {card, cache, outcome, id}. Never throws. */
export async function resolveCard(route, backend, fetchImpl = fetch, labels = LABELS.en) {
  if (!route) return { card: null, cache: CACHE.notFound, outcome: "invalid" };
  const path = route.kind === "listing"
    ? `/listings/${encodeURIComponent(route.id)}`
    : route.kind === "profile"
      ? `/users/${encodeURIComponent(route.id)}`
      : `/users/by-username/${encodeURIComponent(route.username)}`;
  const result = await fetchPublic(backend, path, fetchImpl);
  const logId = route.id ?? null;
  if (result.status === "error") return { card: null, cache: CACHE.error, outcome: "error", id: logId };
  if (result.status === "notFound") {
    if (route.kind === "listing" && result.code === "LISTING_SOLD") {
      return { card: soldCard(route, labels), cache: CACHE.found, outcome: "sold", id: logId };
    }
    return { card: null, cache: CACHE.notFound, outcome: "notFound", id: logId };
  }
  const card = route.kind === "listing"
    ? listingCard(result.body, route, backend.apiUrl, labels)
    : profileCard(result.body, route, backend.apiUrl, labels);
  if (!card) return { card: null, cache: CACHE.notFound, outcome: "hidden", id: logId };
  const id = route.kind === "username" ? String(result.body.id).toLowerCase() : logId;
  const outcome = route.kind === "listing" && result.body.status === "sold" ? "sold" : "found";
  return { card, cache: CACHE.found, outcome, id };
}

/**
 * The request handler (Node http / Express-compatible). Only GET and HEAD;
 * reads nothing from the request but the method, the path and the forwarded
 * host (matched against this site's own hosts), sets no cookies, and never
 * answers 5xx.
 */
export function createHandler({ backend, fetchImpl = fetch, indexSource = createIndexSource(fetchImpl), log = console.log } = {}) {
  if (!backend || !Object.values(BACKENDS).includes(backend)) throw new Error("unknown backend");
  return async function handle(req, res) {
    const send = (status, cacheControl, body, extra = {}) => {
      res.statusCode = status;
      for (const [key, value] of Object.entries({ ...SECURITY_HEADERS, ...extra })) res.setHeader(key, value);
      res.setHeader("Cache-Control", cacheControl);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      const bytes = Buffer.from(body, "utf8");
      res.setHeader("Content-Length", String(bytes.byteLength));
      res.end(req.method === "HEAD" ? undefined : bytes);
    };
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        send(405, "no-store", "", { Allow: "GET, HEAD" });
        return;
      }
      let path = "/";
      try {
        path = new URL(req.originalUrl ?? req.url ?? "/", "https://hemu.krd").pathname;
      } catch {
        // Unparseable: no route.
      }
      const forwarded = String(req.headers?.["x-forwarded-host"] ?? "").split(",")[0].trim().toLowerCase();
      const route = routeFor(path);
      const [html, resolved] = await Promise.all([indexSource(forwarded), resolveCard(route, backend, fetchImpl)]);
      log(JSON.stringify({ preview: route?.kind ?? "none", outcome: resolved.outcome, id: resolved.id ?? null }));
      if (html === null) {
        send(200, CACHE.unavailable, UNAVAILABLE_PAGE);
        return;
      }
      // No card, or an index.html without the expected tags: the page exactly as Hosting serves it.
      const page = resolved.card ? applyCard(html, resolved.card) : null;
      send(200, page ? resolved.cache : resolved.card ? CACHE.notFound : resolved.cache, page ?? html);
    } catch {
      if (!res.headersSent) send(200, CACHE.unavailable, UNAVAILABLE_PAGE);
      else res.end();
    }
  };
}
