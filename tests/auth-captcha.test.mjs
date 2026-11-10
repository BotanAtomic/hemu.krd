import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import {
  callbackUrl,
  parseRequest,
  publicSitekey,
  webviewMessage,
} from "../public/auth/captcha/protocol.mjs";

const state = "11111111-1111-4111-8111-111111111111";
const search = `?environment=production&state=${state}`;
const webviewSearch = `${search}&transport=webview`;
const key = `0x${"a".repeat(22)}`;
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("requests default to redirect and accept only the explicit webview transport", () => {
  assert.deepEqual(parseRequest(search), {
    environment: "production",
    state,
    transport: "redirect",
  });
  assert.deepEqual(parseRequest(webviewSearch, "hemu.krd"), {
    environment: "production",
    state,
    transport: "webview",
  });
  assert.deepEqual(
    parseRequest(webviewSearch.replace("production", "staging")),
    { environment: "staging", state, transport: "webview" },
  );
  for (const value of [
    "",
    `${search}&return_to=https://attacker.example`,
    `${search}&state=${state}`,
    `${search}&environment=production`,
    `${search}&transport=redirect`,
    `${search}&transport=`,
    `${search}&transport=other`,
    `${webviewSearch}&transport=webview`,
    `${webviewSearch}&unknown=value`,
    search.replace("production", "other"),
    search.replace(state, "invalid"),
    search.replace("-4111-", "-1111-"),
    search.replace("-8111-", "-7111-"),
  ])
    assert.equal(parseRequest(value, "localhost"), null, value);
});

test("test environments require webview on local or exact Firebase preview hosts", () => {
  for (const environment of ["test-pass", "test-interactive"]) {
    const query = `?environment=${environment}&state=${state}&transport=webview`;
    for (const hostname of [
      "localhost",
      "127.0.0.1",
      "hemu-fd2f4--cap-1.web.app",
      "hemu-fd2f4--preview-123-abc.web.app",
    ])
      assert.deepEqual(parseRequest(query, hostname), {
        environment,
        state,
        transport: "webview",
      });
    for (const hostname of [
      undefined,
      "",
      "hemu.krd",
      "www.hemu.krd",
      "hemu-fd2f4.web.app",
      "hemu-fd2f4.firebaseapp.com",
      "other--cap-1.web.app",
      "hemu-fd2f4--.web.app",
      "hemu-fd2f4--CAP-1.web.app",
      "hemu-fd2f4--cap_1.web.app",
      "hemu-fd2f4--cap-1.web.app.attacker.example",
      "attacker.hemu-fd2f4--cap-1.web.app",
      "localhost.attacker.example",
      "127.0.0.2",
      "127.0.0.1:8080",
    ])
      assert.equal(parseRequest(query, hostname), null, String(hostname));
    assert.equal(
      parseRequest(query.replace("&transport=webview", ""), "localhost"),
      null,
    );
  }
});

test("redirect callbacks retain fixed schemes, fragment-only tokens and strict validation", () => {
  const request = parseRequest(search);
  assert.equal(
    callbackUrl(request, "opaque-token"),
    `hemu://auth/captcha#state=${state}&captcha_token=opaque-token`,
  );
  assert.equal(
    callbackUrl({ ...request, environment: "staging" }, null),
    `hemu-staging://auth/captcha#state=${state}&error=cancelled`,
  );
  for (const invalid of [
    null,
    { environment: "https://attacker.example", state },
    { environment: "production", state: "invalid" },
    { environment: "test-pass", state, transport: "redirect" },
    parseRequest(webviewSearch),
  ])
    assert.throws(() => callbackUrl(invalid, "token"));
  for (const token of ["", "a".repeat(2049), "x\ny", "x y", undefined])
    assert.throws(() => callbackUrl(request, token));
  assert.match(callbackUrl(request, "&token"), /captcha_token=%26token/u);
});

test("missing and Cloudflare dummy sitekeys cannot enable production or staging", () => {
  for (const environment of ["production", "staging"]) {
    for (const value of [
      null,
      {},
      { [environment]: null },
      { [environment]: "1x00000000000000000000AA" },
      { [environment]: "2x00000000000000000000AB" },
      { [environment]: "1x00000000000000000000BB" },
      { [environment]: "3x00000000000000000000FF" },
      { [environment]: "secret" },
    ])
      assert.equal(publicSitekey(value, environment), null);
    assert.equal(publicSitekey({ [environment]: key }, environment), key);
  }
  assert.equal(publicSitekey(null, "test-pass"), "1x00000000000000000000BB");
  assert.equal(
    publicSitekey(null, "test-interactive"),
    "3x00000000000000000000FF",
  );
});

test("webview messages use exactly the v1 shapes and allowed error codes", () => {
  const request = parseRequest(webviewSearch);
  for (const type of ["interactive", "interactive-done", "cancelled"])
    assert.deepEqual(webviewMessage(request, type), { v: 1, type, state });
  assert.deepEqual(
    webviewMessage(request, "token", { token: "opaque-token" }),
    {
      v: 1,
      type: "token",
      state,
      token: "opaque-token",
    },
  );
  for (const reason of ["config", "load", "expired", "timeout", "unsupported"])
    assert.deepEqual(webviewMessage(request, "error", { reason }), {
      v: 1,
      type: "error",
      state,
      reason,
    });
  for (const [type, extra] of [
    ["other", {}],
    ["interactive", { token: "token" }],
    ["interactive-done", { reason: "load" }],
    ["cancelled", { v: 2 }],
    ["token", {}],
    ["token", { token: "token", state: "other" }],
    ["error", {}],
    ["error", { reason: "cancelled" }],
    ["error", { reason: "load", token: "token" }],
    ["interactive", null],
    ["interactive", []],
  ])
    assert.throws(() => webviewMessage(request, type, extra));
  for (const invalid of [
    null,
    parseRequest(search),
    { environment: "other", state, transport: "webview" },
    { environment: "production", state: "invalid", transport: "webview" },
  ])
    assert.throws(() => webviewMessage(invalid, "interactive"));
});

test("webview tokens share the redirect printable-ASCII 1-2048 limit", () => {
  const request = parseRequest(webviewSearch);
  const redirect = parseRequest(search);
  for (const token of ["!", "~", "a".repeat(2048), "&=/#?%"])
    assert.equal(webviewMessage(request, "token", { token }).token, token);
  for (const token of [
    "",
    "a".repeat(2049),
    " ",
    "x y",
    "x\ny",
    "x\ty",
    "\u0000",
    "\u007f",
    "é",
    null,
    undefined,
    1,
  ]) {
    assert.throws(() => webviewMessage(request, "token", { token }));
    if (token !== null) assert.throws(() => callbackUrl(redirect, token));
  }
});

const source = (
  await readFile(
    new URL("../public/auth/captcha/page.mjs", import.meta.url),
    "utf8",
  )
).replace(/^import[\s\S]*?from "\.\/protocol\.mjs";\s*/u, "");
async function page({
  query = search,
  hostname = "hemu.krd",
  config = { production: key },
  fetchError = false,
  responseOk = true,
  widget = true,
  bridge = false,
  renderError = false,
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
    timers = [],
    messages = [],
    rawMessages = [],
    renders = [],
    fetches = [],
    pendingTimers = new Map();
  const turnstile = {
    render: (target, options) => {
      if (renderError) throw new Error("private widget error");
      renders.push({ target, options });
      return renders.length === 1 ? "widget" : `widget-${renders.length}`;
    },
    remove: (id) => removed.push(id),
  };
  const context = {
    parseRequest,
    publicSitekey,
    callbackUrl,
    webviewMessage,
    URLSearchParams,
    location: {
      search: query,
      hostname,
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
      turnstile: widget ? turnstile : undefined,
      ReactNativeWebView:
        bridge === true
          ? {
              postMessage: (message) => {
                rawMessages.push(message);
                messages.push(JSON.parse(message));
              },
            }
          : bridge || undefined,
    },
    fetch: async (...args) => {
      fetches.push(args);
      if (fetchError) throw new Error("private network error");
      return { ok: responseOk, json: async () => config };
    },
    setTimeout: (fn, delay) => {
      const id = timers.length + 1;
      timers.push(() => {
        pendingTimers.delete(id);
        fn();
      });
      pendingTimers.set(id, delay);
      return id;
    },
    clearTimeout: (id) => pendingTimers.delete(id),
  };
  vm.runInNewContext(source, context);
  await flush();
  return {
    elements,
    redirects,
    scripts,
    removed,
    history,
    timers,
    messages,
    rawMessages,
    renders,
    fetches,
    pendingTimers,
    options: () => renders.at(-1)?.options,
    setConfig: (value) => {
      config = value;
    },
    setRenderError: (value) => {
      renderError = value;
    },
    loadScript: async () => {
      context.window.turnstile = turnstile;
      scripts.at(-1).onload();
      await flush();
    },
    retry: async () => {
      elements.get("retry").click();
      await flush();
    },
  };
}
const webviewPage = (options = {}) =>
  page({
    query: webviewSearch,
    bridge: true,
    ...options,
  });

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

test("one-use redirect success removes widget and retains current widget options", async () => {
  const view = await page();
  assert.deepEqual(view.history[0], [null, "", "/auth/captcha"]);
  assert.equal(view.options().size, "flexible");
  assert.equal(view.options().action, "mobile-auth");
  assert.equal(view.options()["response-field"], false);
  assert.equal(view.options().appearance, undefined);
  assert.equal(typeof view.options()["unsupported-callback"], "function");
  view.options().callback("one-use-token");
  view.options().callback("second-token");
  view.options()["error-callback"]();
  assert.deepEqual(view.redirects, [
    `hemu://auth/captcha#state=${state}&captcha_token=one-use-token`,
  ]);
  assert.deepEqual(view.removed, ["widget"]);
  assert.match(view.elements.get("status").textContent, /Check complete/u);
});

test("redirect cancel returns no token and errors retain retry without leaking details", async () => {
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

test("loads only official widget script and handles script errors and timeout", async () => {
  const loading = await page({ widget: false });
  assert.equal(
    loading.scripts[0].src,
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
  );
  loading.scripts[0].onerror();
  assert.equal(loading.elements.get("retry").hidden, false);
  const timeout = await page({ widget: false });
  timeout.timers[0]();
  assert.match(timeout.elements.get("status").textContent, /taking too long/u);
  assert.doesNotMatch(
    timeout.elements.get("status").textContent,
    new RegExp(state),
  );
});

test("webview refuses missing/non-function bridges and live-host test environments", async () => {
  for (const bridge of [false, {}, { postMessage: "not a function" }]) {
    const view = await webviewPage({ bridge });
    assert.match(view.elements.get("status").textContent, /from the Hemû app/u);
    assert.equal(view.elements.get("cancel").hidden, true);
    assert.equal(view.options(), undefined);
    assert.deepEqual(view.fetches, []);
    assert.deepEqual(view.scripts, []);
    assert.deepEqual(view.redirects, []);
  }
  const rejected = await webviewPage({
    query: webviewSearch.replace("production", "test-pass"),
  });
  assert.match(
    rejected.elements.get("status").textContent,
    /from the Hemû app/u,
  );
  assert.equal(rejected.options(), undefined);
  assert.deepEqual(rejected.messages, []);
});

test("webview interactions and one-use token use the bridge without redirects", async () => {
  const view = await webviewPage();
  const options = view.options();
  assert.equal(options.appearance, "interaction-only");
  assert.equal(options.action, "mobile-auth");
  assert.equal(options["response-field"], false);
  options["before-interactive-callback"]();
  options["after-interactive-callback"]();
  options.callback("one-use-token");
  options.callback("second-token");
  options["error-callback"]();
  options["before-interactive-callback"]();
  options["after-interactive-callback"]();
  view.elements.get("cancel").onclick?.();
  assert.deepEqual(view.messages, [
    { v: 1, type: "interactive", state },
    { v: 1, type: "interactive-done", state },
    { v: 1, type: "token", state, token: "one-use-token" },
  ]);
  assert(view.rawMessages.every((message) => typeof message === "string"));
  assert.deepEqual(view.removed, ["widget"]);
  assert.deepEqual(view.redirects, []);
});

test("webview cancel is terminal and removes the widget", async () => {
  const view = await webviewPage();
  view.elements.get("cancel").onclick();
  view.elements.get("cancel").onclick?.();
  view.options().callback("late-token");
  view.options()["expired-callback"]();
  assert.deepEqual(view.messages, [{ v: 1, type: "cancelled", state }]);
  assert.deepEqual(view.removed, ["widget"]);
  assert.deepEqual(view.redirects, []);
});

test("every webview widget failure has the required reason and allows a fresh success", async () => {
  for (const [callback, reason] of [
    ["error-callback", "load"],
    ["expired-callback", "expired"],
    ["timeout-callback", "timeout"],
    ["unsupported-callback", "unsupported"],
  ]) {
    const view = await webviewPage();
    const stale = view.options();
    stale[callback]();
    assert.deepEqual(view.messages, [{ v: 1, type: "error", state, reason }]);
    assert.equal(view.elements.get("retry").hidden, false);
    assert.equal(view.elements.get("retry").disabled, false);
    await view.retry();
    stale.callback("stale-token");
    stale["before-interactive-callback"]();
    stale["error-callback"]();
    view.options().callback("fresh-token");
    view.options().callback("duplicate-token");
    assert.deepEqual(view.messages, [
      { v: 1, type: "error", state, reason },
      { v: 1, type: "token", state, token: "fresh-token" },
    ]);
    assert.deepEqual(view.redirects, []);
  }
});

test("malformed widget tokens report load and allow a later valid token", async () => {
  for (const token of [null, "", "invalid token", "x\ny", "a".repeat(2049)]) {
    for (const makePage of [page, webviewPage]) {
      const view = await makePage();
      view.options().callback(token);
      assert.equal(view.elements.get("retry").hidden, false);
      assert.deepEqual(view.redirects, []);
      assert.deepEqual(view.removed, []);
      if (makePage === webviewPage)
        assert.deepEqual(view.messages, [
          { v: 1, type: "error", state, reason: "load" },
        ]);
      view.options().callback("valid-token");
      view.options().callback("duplicate-token");
      if (makePage === webviewPage) {
        assert.deepEqual(view.messages, [
          { v: 1, type: "error", state, reason: "load" },
          { v: 1, type: "token", state, token: "valid-token" },
        ]);
        assert.deepEqual(view.redirects, []);
      } else {
        assert.deepEqual(view.redirects, [
          `hemu://auth/captcha#state=${state}&captcha_token=valid-token`,
        ]);
      }
    }
  }
});

test("webview deadline covers a stalled widget but ends before human interaction", async () => {
  const view = await webviewPage();
  assert.deepEqual([...view.pendingTimers.values()], [30_000]);
  view.timers[0]();
  assert.deepEqual(view.messages, [
    { v: 1, type: "error", state, reason: "timeout" },
  ]);
  assert.equal(view.elements.get("retry").hidden, false);
  await view.retry();
  assert.deepEqual([...view.pendingTimers.values()], [30_000]);
  view.options()["before-interactive-callback"]();
  assert.equal(view.pendingTimers.size, 0);
  assert.deepEqual(view.messages.at(-1), { v: 1, type: "interactive", state });
});

test("webview config failures report config and retry can fetch a valid key", async () => {
  for (const config of [null, {}, { production: "1x00000000000000000000BB" }]) {
    const view = await webviewPage({ config });
    assert.deepEqual(view.messages, [
      { v: 1, type: "error", state, reason: "config" },
    ]);
    assert.equal(view.options(), undefined);
    assert.equal(view.elements.get("retry").hidden, false);
    view.setConfig({ production: key });
    await view.retry();
    view.options().callback("retry-token");
    assert.deepEqual(view.messages.at(-1), {
      v: 1,
      type: "token",
      state,
      token: "retry-token",
    });
  }
});

test("webview script failures, render failures and the 30-second deadline are recoverable", async () => {
  const script = await webviewPage({ widget: false });
  script.scripts[0].onerror();
  assert.deepEqual(script.messages, [
    { v: 1, type: "error", state, reason: "load" },
  ]);
  await script.retry();
  await script.loadScript();
  script.options().callback("loaded-token");
  assert.equal(script.messages.at(-1).type, "token");

  const render = await webviewPage({ renderError: true });
  assert.deepEqual(render.messages, [
    { v: 1, type: "error", state, reason: "load" },
  ]);
  assert.doesNotMatch(
    render.elements.get("status").textContent,
    /private widget error/u,
  );
  render.setRenderError(false);
  await render.retry();
  render.options().callback("rendered-token");
  assert.equal(render.messages.at(-1).type, "token");

  const timeout = await webviewPage({ widget: false });
  timeout.timers[0]();
  assert.deepEqual(timeout.messages, [
    { v: 1, type: "error", state, reason: "timeout" },
  ]);
  await timeout.retry();
  timeout.timers[0]();
  await timeout.loadScript();
  timeout.options().callback("after-timeout-token");
  assert.deepEqual(timeout.messages, [
    { v: 1, type: "error", state, reason: "timeout" },
    { v: 1, type: "token", state, token: "after-timeout-token" },
  ]);
});

test("local webview test environments use only their fixed keys", async () => {
  for (const [environment, sitekey] of [
    ["test-pass", "1x00000000000000000000BB"],
    ["test-interactive", "3x00000000000000000000FF"],
  ]) {
    const view = await webviewPage({
      query: webviewSearch.replace("production", environment),
      hostname: "127.0.0.1",
      config: {},
    });
    assert.equal(view.options().sitekey, sitekey);
    assert.equal(view.options().appearance, "interaction-only");
  }
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
  assert.match(headers["content-security-policy"], /frame-ancestors 'none'/u);
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

test("iOS keeps all site-owned pages and static assets in the browser before the username catch-all", async () => {
  const association = JSON.parse(
    await readFile(
      new URL(
        "../public/.well-known/apple-app-site-association",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const components = association.applinks.details[0].components;
  // Apple components use a greedy * that also spans slash characters; first
  // match wins. A root username wildcard would otherwise claim site-owned paths.
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
    "/privacy",
    "/privacy/",
    "/terms",
    "/terms/",
    "/data-deletion",
    "/data-deletion/",
    "/auth/captcha",
    "/auth/captcha/",
    "/auth/captcha/index.html",
    "/auth/captcha/page.mjs",
    "/auth/captcha/sitekeys.json",
    "/auth/callback",
    "/auth/callback/clear-url.js",
    "/support",
    "/support/",
    "/.well-known/assetlinks.json",
    "/og.png",
    "/favicon.png",
    "/legal.css",
    "/robots.txt",
    "/sitemap.xml",
    "/404.html",
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
      get() {
        throw new Error(`must not read ${name}`);
      },
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
  assert.doesNotMatch(
    html,
    /https?:\/\/[^"\s]+|access_token|refresh_token|code=/u,
  );
  assert(
    html.indexOf('name="referrer" content="no-referrer"') <
      html.indexOf("<script"),
  );
  assert(html.indexOf("<script") < html.indexOf("<link"));
  const config = JSON.parse(
    await readFile(new URL("../firebase.json", import.meta.url), "utf8"),
  );
  const headers = Object.fromEntries(
    config.hosting.headers
      .find((rule) => rule.source === "/auth/callback{,/**}")
      .headers.map(({ key, value }) => [key.toLowerCase(), value]),
  );
  assert.equal(headers["referrer-policy"], "no-referrer");
  assert.equal(headers["cache-control"], "no-store");
  assert.equal(headers["x-robots-tag"], "noindex, nofollow");
  assert.match(headers["content-security-policy"], /connect-src 'none'/u);
  assert.doesNotMatch(
    headers["content-security-policy"],
    /cloudflare|unsafe-inline|unsafe-eval/u,
  );
});
