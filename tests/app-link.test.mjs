import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const IOS = "https://apps.apple.com/app/id6805621903";
const ANDROID = "https://play.google.com/store/apps/details?id=krd.hemu.app";

const INTENT = `intent://#Intent;scheme=hemu;package=krd.hemu.app;S.browser_fallback_url=${encodeURIComponent(ANDROID)};end`;
const CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const INSTAGRAM = "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 Instagram 350.0.0.0";

// Runs the two head scripts of /app in order, as the browser does. Returns every location.replace() in order, the
// pending timers, and a way to fire the page's own events.
async function load({ userAgent, platform = "", maxTouchPoints = 0 }) {
  const attrs = {};
  const root = { className: "", setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: (k) => attrs[k] ?? null };
  const visits = [];
  const timers = new Map();
  const listeners = [];
  let nextTimer = 1;
  const document = {
    documentElement: root,
    visibilityState: "visible",
    addEventListener: (type, fn) => listeners.push([type, fn]),
  };
  const context = {
    document,
    location: { replace: (url) => { visits.push(url); } },
    localStorage: { getItem: () => null },
    Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: "Europe/Paris" }) }) },
    navigator: { userAgent, platform, maxTouchPoints, languages: ["en-US"], language: "en-US" },
    setTimeout: (fn, ms) => { timers.set(nextTimer, { fn, ms }); return nextTimer++; },
    clearTimeout: (id) => { timers.delete(id); },
    addEventListener: (type, fn) => listeners.push([type, fn]),
  };
  for (const file of ["public/lang.js", "public/store-redirect.js"]) vm.runInNewContext(await read(file), context);
  const fire = (type) => { for (const [t, fn] of listeners) if (t === type) fn(); };
  const runTimers = () => { for (const [id, { fn }] of [...timers]) { timers.delete(id); fn(); } };
  return { visits, timers, document, fire, runTimers };
}

// Where the page sends the visitor once everything, timers included, has run with the page still visible.
async function visit(device) {
  const page = await load(device);
  page.runTimers();
  return page.visits.at(-1) ?? null;
}

test("/app sends iPhone, iPad (also as a touch Mac) to the App Store and Android, in the end, to Google Play", async () => {
  const cases = [
    [{ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 350.0" }, IOS],
    [{ userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15" }, IOS],
    [{ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15", platform: "MacIntel", maxTouchPoints: 5 }, IOS],
    [{ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36 TikTok" }, ANDROID],
    [{ userAgent: CHROME }, ANDROID],
    [{ userAgent: INSTAGRAM }, ANDROID],
    [{ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15", platform: "MacIntel" }, null],
    [{ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36", platform: "Win32" }, null],
    [{ userAgent: "" }, null],
  ];
  for (const [device, url] of cases) assert.equal(await visit(device), url, device.userAgent);
});

test("/app on an iPhone goes to the App Store at once, with no app attempt and no timer", async () => {
  const page = await load({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148" });
  assert.deepEqual(page.visits, [IOS]);
  assert.equal(page.timers.size, 0);
});

test("/app in an Android browser first asks for the installed app, with Google Play as the browser's fallback", async () => {
  const page = await load({ userAgent: CHROME });
  assert.deepEqual(page.visits, [INTENT]);
  const fallback = INTENT.match(/;S\.browser_fallback_url=([^;]*);/u)[1];
  assert.equal(decodeURIComponent(fallback), ANDROID);
  assert.match(INTENT, /^intent:\/\/#Intent;(?:[^;]+;)*end$/u);
});

test("/app in an Android browser that ignores the intent goes to Google Play after a short wait", async () => {
  const page = await load({ userAgent: CHROME });
  assert.equal(page.timers.size, 1);
  const [{ ms }] = page.timers.values();
  assert(ms >= 1500 && ms <= 4000, `wait ${ms} ms`);
  page.runTimers();
  assert.deepEqual(page.visits, [INTENT, ANDROID]);
});

test("/app stays put once the app opened (page hidden) or the browser left for the fallback (pagehide)", async () => {
  const hidden = await load({ userAgent: CHROME });
  hidden.document.visibilityState = "hidden";
  hidden.fire("visibilitychange");
  hidden.runTimers();
  assert.deepEqual(hidden.visits, [INTENT]);

  const left = await load({ userAgent: CHROME });
  left.fire("pagehide");
  left.runTimers();
  assert.deepEqual(left.visits, [INTENT]);

  const stillHidden = await load({ userAgent: CHROME });
  stillHidden.document.visibilityState = "hidden";
  stillHidden.runTimers();
  assert.deepEqual(stillHidden.visits, [INTENT]);
});

test("/app inside an app's web view (Instagram) skips the intent, which a web view shows as an error page", async () => {
  const page = await load({ userAgent: INSTAGRAM });
  assert.deepEqual(page.visits, [ANDROID]);
  assert.equal(page.timers.size, 0);
});

test("/app has the language script, then the redirect script, first in the head, and both store buttons", async () => {
  const html = await read("app/index.html");
  const head = html.slice(0, html.indexOf("</head>"));
  const scripts = [...head.matchAll(/<script\b[^>]*>/gu)].map((m) => m[0]);
  assert.deepEqual(scripts.slice(0, 2), ['<script src="/lang.js">', '<script src="/store-redirect.js">']);
  assert(!/<script(?![^>]*\bsrc=)[^>]*>/u.test(html), "no inline script: the CSP forbids it");
  assert(!/noindex/u.test(html));
  assert(html.includes('<meta property="og:image" content="https://hemu.krd/og.jpg" />'));
  assert(html.includes('<meta property="og:url" content="https://hemu.krd/app" />'));
  assert(html.includes(`href="${IOS}"`) && html.includes(`href="${ANDROID}"`));
  const index = await read("index.html");
  const symbol = (page) => page.match(/<symbol id="wordmark".*?<\/symbol>/su)[0];
  assert.equal(symbol(html), symbol(index));
});

test("/download is a permanent alias of /app and /app is served before the username catch-all", async () => {
  const { hosting } = JSON.parse(await read("firebase.json"));
  assert.deepEqual(hosting.redirects, [{ source: "/download", destination: "/app", type: 301 }]);
  const sources = hosting.rewrites.map((rule) => rule.source ?? rule.regex);
  const app = sources.indexOf("/app");
  assert(app >= 0 && app < sources.findIndex((s) => s?.startsWith("^/[A-Za-z0-9]")));
  assert.equal(hosting.rewrites[app].destination, "/app/index.html");
});
