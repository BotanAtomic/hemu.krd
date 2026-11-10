const STATE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const TOKEN = /^[\x21-\x7e]{1,2048}$/u;
const CALLBACKS = {
  production: "hemu://auth/captcha",
  staging: "hemu-staging://auth/captcha",
};
// Dummy tokens only validate against Cloudflare's dummy secrets. Gate these
// environments by hostname in parseRequest so the live host never issues them.
const TEST_SITEKEYS = {
  "test-pass": "1x00000000000000000000BB",
  "test-interactive": "3x00000000000000000000FF",
};
const ERROR_REASONS = ["config", "load", "expired", "timeout", "unsupported"];

export function parseRequest(search, hostname) {
  const params = new URLSearchParams(search);
  const environment = params.get("environment");
  const state = params.get("state");
  const transport = params.has("transport")
    ? params.get("transport")
    : "redirect";
  const keys = [...params.keys()].sort().join(",");
  const testEnvironment =
    Object.hasOwn(TEST_SITEKEYS, environment) &&
    transport === "webview" &&
    typeof hostname === "string" &&
    (hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      /^hemu-fd2f4--[a-z0-9-]+\.web\.app$/u.test(hostname));
  if (
    (keys !== "environment,state" && keys !== "environment,state,transport") ||
    (params.has("transport") && transport !== "webview") ||
    (!Object.hasOwn(CALLBACKS, environment) && !testEnvironment) ||
    !STATE.test(state ?? "")
  )
    return null;
  return { environment, state, transport };
}

export function callbackUrl(request, token) {
  if (
    !request ||
    request.transport === "webview" ||
    !Object.hasOwn(CALLBACKS, request.environment) ||
    !STATE.test(request.state)
  )
    throw new Error("Invalid challenge request");
  const params = new URLSearchParams({ state: request.state });
  if (token === null) params.set("error", "cancelled");
  else if (typeof token === "string" && TOKEN.test(token))
    params.set("captcha_token", token);
  else throw new Error("Invalid challenge response");
  return `${CALLBACKS[request.environment]}#${params}`;
}

export function webviewMessage(request, type, extra = {}) {
  if (
    !request ||
    request.transport !== "webview" ||
    (!Object.hasOwn(CALLBACKS, request.environment) &&
      !Object.hasOwn(TEST_SITEKEYS, request.environment)) ||
    !STATE.test(request.state)
  )
    throw new Error("Invalid challenge request");
  if (!extra || typeof extra !== "object" || Array.isArray(extra))
    throw new Error("Invalid challenge response");
  const keys = Object.keys(extra).sort().join(",");
  const message = { v: 1, type, state: request.state };
  if (type === "token" && keys === "token") {
    if (typeof extra.token === "string" && TOKEN.test(extra.token))
      return { ...message, token: extra.token };
  } else if (type === "error" && keys === "reason") {
    if (ERROR_REASONS.includes(extra.reason))
      return { ...message, reason: extra.reason };
  } else if (
    ["interactive", "interactive-done", "cancelled"].includes(type) &&
    keys === ""
  )
    return message;
  throw new Error("Invalid challenge response");
}

export function publicSitekey(config, environment) {
  if (Object.hasOwn(TEST_SITEKEYS, environment))
    return TEST_SITEKEYS[environment];
  const key = config?.[environment];
  // Cloudflare's documented dummy keys must never enable production or staging.
  return typeof key === "string" && /^0x[A-Za-z0-9_-]{20,100}$/u.test(key)
    ? key
    : null;
}
