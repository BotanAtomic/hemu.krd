import {
  callbackUrl,
  parseRequest,
  publicSitekey,
  webviewMessage,
} from "./protocol.mjs";

const request = parseRequest(location.search, location.hostname);
const webview = request?.transport === "webview";
const supported =
  !webview || typeof window.ReactNativeWebView?.postMessage === "function";
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

function post(type, extra) {
  window.ReactNativeWebView.postMessage(
    JSON.stringify(webviewMessage(request, type, extra)),
  );
}
function fail(reason, message) {
  if (complete) return;
  clearTimeout(timeout);
  status.textContent = message;
  retry.hidden = !request;
  retry.disabled = false;
  if (webview) post("error", { reason });
}
function finish(token) {
  if (complete) return;
  let result;
  try {
    result = webview
      ? webviewMessage(
          request,
          token === null ? "cancelled" : "token",
          token === null ? {} : { token },
        )
      : callbackUrl(request, token);
  } catch {
    fail("load", "The check could not be completed. Please try again.");
    return;
  }
  complete = true;
  generation += 1;
  clearTimeout(timeout);
  retry.hidden = true;
  status.textContent =
    token === null
      ? "Returning to Hemû…"
      : "Check complete. Returning to Hemû…";
  if (webview) {
    window.ReactNativeWebView.postMessage(JSON.stringify(result));
    // Dispatch once before removing the widget; removal may invoke callbacks.
    if (widget !== undefined) window.turnstile?.remove(widget);
    widget = undefined;
    cancel.hidden = true;
    return;
  }
  // Disable the widget before redirect so expired/error callbacks cannot send
  // another token. The one-use token lives only in this app callback fragment.
  if (widget !== undefined) window.turnstile?.remove(widget);
  widget = undefined;
  cancel.hidden = false;
  cancel.textContent = "Open Hemû";
  const openApp = () => {
    try {
      location.replace(result);
    } catch {
      status.textContent =
        "Your check is complete. Tap Open Hemû to return to the app.";
    }
  };
  cancel.onclick = openApp;
  openApp();
}
async function start() {
  if (!request || !supported || complete) return;
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
        "timeout",
        "The security check is taking too long. Check your connection and try again.",
      );
  }, 30_000);
  let sitekey;
  let configErrorReason = "load";
  try {
    const response = await fetch("/auth/captcha/sitekeys.json", {
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
    });
    if (!current()) return;
    if (!response.ok) throw new Error("Unavailable configuration");
    configErrorReason = "config";
    const config = await response.json();
    if (!current()) return;
    sitekey = publicSitekey(config, request.environment);
    if (!sitekey) {
      if (!webview) {
        clearTimeout(timeout);
        status.textContent =
          "Sign-in verification is temporarily unavailable. Please return to Hemû and try later.";
        return;
      }
      throw new Error("Invalid configuration");
    }
  } catch {
    if (current())
      fail(
        configErrorReason,
        webview
          ? "Sign-in verification is temporarily unavailable. Check your connection and try again."
          : "The security check is unavailable. Check your connection and try again.",
      );
    return;
  }
  const render = () => {
    if (!current()) return;
    try {
      // A hidden WebView must also time out if the rendered iframe stalls.
      if (!webview) clearTimeout(timeout);
      status.textContent = webview
        ? ""
        : "Complete the security check to continue.";
      widget = window.turnstile.render("#challenge", {
        sitekey,
        theme: "light",
        size: "flexible",
        action: "mobile-auth",
        "response-field": false,
        ...(webview
          ? {
              appearance: "interaction-only",
              "before-interactive-callback": () => {
                if (current()) {
                  clearTimeout(timeout);
                  post("interactive");
                }
              },
              "after-interactive-callback": () => {
                if (current()) post("interactive-done");
              },
            }
          : {}),
        callback: (token) => {
          if (!current()) return;
          if (token === null)
            fail("load", "The check could not be completed. Please try again.");
          else finish(token);
        },
        "error-callback": () => {
          if (current())
            fail(
              "load",
              "The check could not load. Check your connection and try again.",
            );
          return true;
        },
        "expired-callback": () => {
          if (current())
            fail("expired", "The check expired. Please try again.");
        },
        "timeout-callback": () => {
          if (current())
            fail("timeout", "The check timed out. Please try again.");
        },
        "unsupported-callback": () => {
          if (current())
            fail("unsupported", "This browser cannot run the security check.");
        },
      });
      retry.disabled = false;
    } catch {
      if (current())
        fail(
          "load",
          "The check could not load. Check your connection and try again.",
        );
    }
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
          "load",
          "The check could not load. Check your connection and try again.",
        );
    };
    document.head.append(script);
  }
}
retry.addEventListener("click", start);
if (request && supported) {
  cancel.hidden = false;
  cancel.onclick = () => finish(null);
  start();
} else {
  status.textContent =
    "Open this security check from the Hemû app. You can close this page and return to sign-in.";
}
// No analytics, account information, persistent token storage or Auth API call.
