import { callbackUrl, parseRequest, publicSitekey } from "./protocol.mjs";

const request = parseRequest(location.search);
// Keep the random correlation value out of browser history and referrers.
history.replaceState(null, "", location.pathname);
const status = document.getElementById("status");
const retry = document.getElementById("retry");
const cancel = document.getElementById("cancel");
let widget;
let script;
let complete = false;
let timeout;
let generation = 0;

function fail(message) {
  if (complete) return;
  clearTimeout(timeout);
  status.textContent = message;
  retry.hidden = !request;
  retry.disabled = false;
}
function finish(token) {
  if (complete) return;
  let callback;
  try {
    callback = callbackUrl(request, token);
  } catch {
    fail("The check could not be completed. Please try again.");
    return;
  }
  complete = true;
  generation += 1;
  clearTimeout(timeout);
  // Disable the widget before dispatch so expired/error callbacks cannot send
  // another token. The one-use token lives only in this app callback fragment.
  if (widget !== undefined) window.turnstile?.remove(widget);
  status.textContent =
    token === null
      ? "Returning to Hemû…"
      : "Check complete. Returning to Hemû…";
  retry.hidden = true;
  cancel.hidden = false;
  cancel.textContent = "Open Hemû";
  const openApp = () => {
    try {
      location.replace(callback);
    } catch {
      status.textContent =
        "Your check is complete. Tap Open Hemû to return to the app.";
    }
  };
  cancel.onclick = openApp;
  openApp();
}
async function start() {
  if (!request || complete) return;
  const attempt = ++generation;
  const current = () => attempt === generation && !complete;
  retry.disabled = true;
  retry.hidden = true;
  status.textContent = "Preparing your check…";
  if (widget !== undefined) {
    window.turnstile?.remove(widget);
    widget = undefined;
  }
  script?.remove();
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    if (current())
      fail(
        "The security check is taking too long. Check your connection and try again.",
      );
  }, 30_000);
  try {
    const response = await fetch("/auth/captcha/sitekeys.json", {
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
    });
    if (!current()) return;
    if (!response.ok) throw new Error("Unavailable configuration");
    const config = await response.json();
    if (!current()) return;
    const sitekey = publicSitekey(config, request.environment);
    if (!sitekey) {
      clearTimeout(timeout);
      status.textContent =
        "Sign-in verification is temporarily unavailable. Please return to Hemû and try later.";
      return;
    }
    const render = () => {
      if (!current()) return;
      clearTimeout(timeout);
      status.textContent = "Complete the security check to continue.";
      widget = window.turnstile.render("#challenge", {
        sitekey,
        theme: "light",
        size: "flexible",
        action: "mobile-auth",
        "response-field": false,
        callback: (token) => {
          if (current()) finish(token);
        },
        "error-callback": () => {
          if (current())
            fail(
              "The check could not load. Check your connection and try again.",
            );
          return true;
        },
        "expired-callback": () => {
          if (current()) fail("The check expired. Please try again.");
        },
        "timeout-callback": () => {
          if (current()) fail("The check timed out. Please try again.");
        },
      });
      retry.disabled = false;
    };
    if (window.turnstile) render();
    else {
      script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = render;
      script.onerror = () => {
        if (current())
          fail(
            "The check could not load. Check your connection and try again.",
          );
      };
      document.head.append(script);
    }
  } catch {
    if (current())
      fail(
        "The security check is unavailable. Check your connection and try again.",
      );
  }
}
retry.addEventListener("click", start);
if (request) {
  cancel.hidden = false;
  cancel.onclick = () => finish(null);
  start();
} else {
  status.textContent =
    "Open this security check from the Hemû app. You can close this page and return to sign-in.";
}
// No analytics, account information, persistent token storage or Auth API call.
