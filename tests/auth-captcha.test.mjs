import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import {
  callbackUrl,
  parseRequest,
  publicSitekey,
} from "../public/auth/captcha/protocol.mjs";

const state = "11111111-1111-4111-8111-111111111111";
const search = `?environment=production&state=${state}`;
const key = `0x${"a".repeat(22)}`;

test("only fixed environment/state requests and callbacks are accepted", () => {
  const request = parseRequest(search);
  assert.deepEqual(request, { environment: "production", state });
  assert.equal(
    callbackUrl(request, "opaque-token"),
    `hemu://auth/captcha#state=${state}&captcha_token=opaque-token`,
  );
  assert.equal(
    callbackUrl({ ...request, environment: "staging" }, null),
    `hemu-staging://auth/captcha#state=${state}&error=cancelled`,
  );
  for (const value of [
    "",
    `${search}&return_to=https://attacker.example`,
    `${search}&state=${state}`,
    search.replace("production", "other"),
    search.replace(state, "invalid"),
  ])
    assert.equal(parseRequest(value), null);
  for (const request of [
    null,
    { environment: "https://attacker.example", state },
    { environment: "production", state: "invalid" },
  ])
    assert.throws(() => callbackUrl(request, "token"));
  for (const token of ["", "a".repeat(2049), "x\ny", undefined])
    assert.throws(() => callbackUrl(request, token));
  assert.match(callbackUrl(request, "&token"), /captcha_token=%26token/u);
});
test("missing and Cloudflare dummy sitekeys cannot enable live verification", () => {
  for (const value of [
    null,
    {},
    { production: null },
    { production: "1x00000000000000000000AA" },
    { production: "2x00000000000000000000AB" },
    { production: "secret" },
  ])
    assert.equal(publicSitekey(value, "production"), null);
  assert.equal(publicSitekey({ production: key }, "production"), key);
});

const source = (
  await readFile(
    new URL("../public/auth/captcha/page.mjs", import.meta.url),
    "utf8",
  )
).replace(/^import[^\n]+\n/u, "");
async function page({
  query = search,
  config = { production: key },
  fetchError,
  widget = true,
} = {}) {
  const elements = new Map(
    ["status", "retry", "cancel", "challenge"].map((id) => [
      id,
      {
        textContent: "",
        hidden: true,
        disabled: false,
        addEventListener(name, fn) {
          this[name] = fn;
        },
      },
    ]),
  );
  const redirects = [],
    scripts = [],
    removed = [],
    history = [],
    timers = [];
  let options;
  const context = {
    parseRequest,
    publicSitekey,
    callbackUrl,
    URLSearchParams,
    location: {
      search: query,
      pathname: "/auth/captcha",
      replace: (url) => redirects.push(url),
    },
    history: { replaceState: (...args) => history.push(args) },
    document: {
      getElementById: (id) => elements.get(id),
      createElement: () => ({ remove() {} }),
      head: { append: (script) => scripts.push(script) },
    },
    window: {
      turnstile: widget
        ? {
            render: (target, value) => {
              options = value;
              return "widget";
            },
            remove: (id) => removed.push(id),
          }
        : undefined,
    },
    fetch: async () => {
      if (fetchError) throw new Error("private network error");
      return { ok: true, json: async () => config };
    },
    setTimeout: (fn) => {
      timers.push(fn);
      return timers.length;
    },
    clearTimeout() {},
  };
  vm.runInNewContext(source, context);
  await new Promise((resolve) => setImmediate(resolve));
  return {
    elements,
    redirects,
    scripts,
    removed,
    history,
    timers,
    options: () => options,
  };
}
test("invalid/missing sitekeys fail closed; invalid requests cannot redirect", async () => {
  const disabled = await page({ config: { production: null } });
  assert.match(
    disabled.elements.get("status").textContent,
    /temporarily unavailable/u,
  );
  assert.equal(disabled.options(), undefined);
  const invalid = await page({
    query: `${search}&return_to=https://attacker.example`,
  });
  assert.match(
    invalid.elements.get("status").textContent,
    /from the Hemû app/u,
  );
  assert.equal(invalid.elements.get("cancel").hidden, true);
  assert.deepEqual(invalid.redirects, []);
});
test("one-use success removes widget and sends only a fragment to the fixed app", async () => {
  const view = await page();
  assert.deepEqual(view.history[0], [null, "", "/auth/captcha"]);
  view.options().callback("one-use-token");
  view.options().callback("second-token");
  view.options()["error-callback"]();
  assert.deepEqual(view.redirects, [
    `hemu://auth/captcha#state=${state}&captcha_token=one-use-token`,
  ]);
  assert.deepEqual(view.removed, ["widget"]);
  assert.match(view.elements.get("status").textContent, /Check complete/u);
});
test("cancel returns no token; widget errors offer retry without automatic Auth calls", async () => {
  const cancelled = await page();
  cancelled.elements.get("cancel").onclick();
  cancelled.options().callback("late-token");
  assert.deepEqual(cancelled.redirects, [
    `hemu://auth/captcha#state=${state}&error=cancelled`,
  ]);
  const failed = await page();
  failed.options()["error-callback"]();
  assert.equal(failed.elements.get("retry").hidden, false);
  assert.deepEqual(failed.redirects, []);
  const network = await page({ fetchError: true });
  assert.match(
    network.elements.get("status").textContent,
    /Check your connection/u,
  );
  assert.doesNotMatch(
    network.elements.get("status").textContent,
    /private network error/u,
  );
});
test("loads only official widget script and handles script timeout without leaking state", async () => {
  const loading = await page({ widget: false });
  assert.equal(
    loading.scripts[0].src,
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
  );
  loading.scripts[0].onerror();
  assert.equal(loading.elements.get("retry").hidden, false);
  loading.timers[0]();
  assert.match(loading.elements.get("status").textContent, /taking too long/u);
  assert.doesNotMatch(
    loading.elements.get("status").textContent,
    new RegExp(state),
  );
});
test("hosting applies a narrow Cloudflare CSP and no-store/no-referrer to challenge paths", async () => {
  const config = JSON.parse(
    await readFile(new URL("../firebase.json", import.meta.url), "utf8"),
  );
  const captcha = config.hosting.headers.find(
    (rule) => rule.source === "/auth/captcha{,/**}",
  );
  const headers = Object.fromEntries(
    captcha.headers.map(({ key, value }) => [key.toLowerCase(), value]),
  );
  assert.equal(headers["referrer-policy"], "no-referrer");
  assert.equal(headers["cache-control"], "no-store");
  assert.match(
    headers["content-security-policy"],
    /script-src 'self' https:\/\/challenges.cloudflare.com;/u,
  );
  assert.match(
    headers["content-security-policy"],
    /frame-src https:\/\/challenges.cloudflare.com;/u,
  );
  assert.doesNotMatch(
    headers["content-security-policy"],
    /unsafe-inline|unsafe-eval|\*/u,
  );
  const defaults = config.hosting.headers.find(
    (rule) => rule.source === "**",
  ).headers;
  assert.doesNotMatch(
    defaults.find(({ key }) => key === "Content-Security-Policy").value,
    /cloudflare/u,
  );
});

test("iOS keeps the challenge and support pages in the browser before the username catch-all", async () => {
  const association = JSON.parse(
    await readFile(
      new URL("../public/.well-known/apple-app-site-association", import.meta.url),
      "utf8",
    ),
  );
  const components = association.applinks.details[0].components;
  // Apple components use a greedy * that also spans slash characters; first
  // match wins. A root username wildcard would otherwise claim the challenge.
  const firstMatch = (path) =>
    components.find((component) =>
      new RegExp(
        `^${component["/"]
          .split("*")
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
          .join(".*")}$`,
        "u",
      ).test(path),
    );
  for (const path of [
    "/auth/captcha",
    "/auth/captcha/",
    "/auth/captcha/index.html",
    "/auth/captcha/page.mjs",
    "/auth/captcha/sitekeys.json",
    "/auth/callback",
    "/auth/callback/clear-url.js",
    "/support",
    "/support/",
  ]) {
    assert.equal(firstMatch(path)?.exclude, true, path);
  }
  for (const path of ["/seller.one", "/listing/123", "/u/123", "/signup"]) {
    assert.notEqual(firstMatch(path)?.exclude, true, path);
  }
});

test("the browser auth return discards credentials and offers only a fixed manual app link", async () => {
  const script = await readFile(
    new URL("../public/auth/callback/clear-url.js", import.meta.url),
    "utf8",
  );
  const history = [];
  const location = { pathname: "/auth/callback" };
  for (const name of ["search", "hash", "href"]) {
    Object.defineProperty(location, name, {
      get() { throw new Error(`must not read ${name}`); },
    });
  }
  vm.runInNewContext(script, {
    location,
    history: { replaceState: (...args) => history.push(args) },
  });
  assert.equal(history.length, 1);
  assert.deepEqual(Array.from(history[0]), [null, "", "/auth/callback"]);
  const html = await readFile(
    new URL("../public/auth/callback/index.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /<a href="hemu:\/\/">Open Hemû<\/a>/u);
  assert.match(html, /start signing in again/u);
  assert.doesNotMatch(html, /https?:\/\/[^"\s]+|access_token|refresh_token|code=/u);
  assert(html.indexOf('name="referrer" content="no-referrer"') < html.indexOf('<script'));
  assert(html.indexOf('<script') < html.indexOf('<link'));
  const config = JSON.parse(await readFile(new URL("../firebase.json", import.meta.url), "utf8"));
  const headers = Object.fromEntries(config.hosting.headers.find(
    (rule) => rule.source === "/auth/callback{,/**}",
  ).headers.map(({ key, value }) => [key.toLowerCase(), value]));
  assert.equal(headers["referrer-policy"], "no-referrer");
  assert.equal(headers["cache-control"], "no-store");
  assert.equal(headers["x-robots-tag"], "noindex, nofollow");
  assert.match(headers["content-security-policy"], /connect-src 'none'/u);
  assert.doesNotMatch(headers["content-security-policy"], /cloudflare|unsafe-inline|unsafe-eval/u);
});
