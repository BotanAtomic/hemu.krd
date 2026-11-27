import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const IOS = "https://apps.apple.com/app/id6805621903";
const ANDROID = "https://play.google.com/store/apps/details?id=krd.hemu.app";

// Runs the two head scripts of /app in order, as the browser does, and returns where the page was sent.
async function visit({ userAgent, platform = "", maxTouchPoints = 0 }) {
  const attrs = {};
  const root = { className: "", setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: (k) => attrs[k] ?? null };
  let target = null;
  const context = {
    document: { documentElement: root },
    location: { replace: (url) => { target = url; } },
    localStorage: { getItem: () => null },
    Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: "Europe/Paris" }) }) },
    navigator: { userAgent, platform, maxTouchPoints, languages: ["en-US"], language: "en-US" },
  };
  for (const file of ["public/lang.js", "public/store-redirect.js"]) vm.runInNewContext(await read(file), context);
  return target;
}

test("/app sends iPhone, iPad (also as a touch Mac) to the App Store and Android to Google Play", async () => {
  const cases = [
    [{ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 350.0" }, IOS],
    [{ userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15" }, IOS],
    [{ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15", platform: "MacIntel", maxTouchPoints: 5 }, IOS],
    [{ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36 TikTok" }, ANDROID],
    [{ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15", platform: "MacIntel" }, null],
    [{ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36", platform: "Win32" }, null],
    [{ userAgent: "" }, null],
  ];
  for (const [device, url] of cases) assert.equal(await visit(device), url, device.userAgent);
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
