const STATE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CALLBACKS = {
  production: "hemu://auth/captcha",
  staging: "hemu-staging://auth/captcha",
};

export function parseRequest(search) {
  const params = new URLSearchParams(search);
  const environment = params.get("environment");
  const state = params.get("state");
  if (
    [...params.keys()].sort().join(",") !== "environment,state" ||
    !Object.hasOwn(CALLBACKS, environment) ||
    !STATE.test(state ?? "")
  )
    return null;
  return { environment, state };
}

export function callbackUrl(request, token) {
  if (
    !request ||
    !Object.hasOwn(CALLBACKS, request.environment) ||
    !STATE.test(request.state)
  )
    throw new Error("Invalid challenge request");
  const params = new URLSearchParams({ state: request.state });
  if (token === null) params.set("error", "cancelled");
  else if (typeof token === "string" && /^[\x21-\x7e]{1,2048}$/u.test(token))
    params.set("captcha_token", token);
  else throw new Error("Invalid challenge response");
  return `${CALLBACKS[request.environment]}#${params}`;
}

export function publicSitekey(config, environment) {
  const key = config?.[environment];
  // Cloudflare's documented dummy keys must never enable the live auth page.
  return typeof key === "string" && /^0x[A-Za-z0-9_-]{20,100}$/u.test(key)
    ? key
    : null;
}
