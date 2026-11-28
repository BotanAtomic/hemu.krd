// /app: opens hemû on a phone that has it and sends a phone without it to its store, before the page is drawn. /lang.js
// runs first and names the device in <html data-os>; anything else (desktop, unknown, no script) keeps the page with both
// store buttons. Classic, render-blocking script (the CSP forbids inline scripts). Nothing from this page's own URL is used.
//
// Android: Chrome, Samsung Internet and Custom Tabs follow an intent URL to the installed app (its "hemu" scheme, home
// screen) and go to the fallback URL, Google Play, when the app is missing or the browser will not leave (a typed URL).
// A browser that ignores intent URLs stays here, so a timer goes to Google Play unless the page was hidden or left first.
// An app's own web view (Instagram, Facebook, TikTok: "; wv)" in the user agent) usually turns an intent URL into an
// error page, so it goes straight to Google Play, whose page offers "Open" when the app is installed.
// iPhone and iPad: the App Store. Only a tap on a link can open an app there (universal links); a script cannot, and
// the App Store page offers "Open" when the app is installed.
(function () {
  var stores = {
    ios: 'https://apps.apple.com/app/id6805621903',
    android: 'https://play.google.com/store/apps/details?id=krd.hemu.app',
  };
  var os = document.documentElement.getAttribute('data-os');
  if (!os || !Object.prototype.hasOwnProperty.call(stores, os)) return;
  var store = stores[os];
  if (os !== 'android' || /; wv\)/.test(navigator.userAgent)) {
    location.replace(store);
    return;
  }
  var timer = setTimeout(function () {
    if (document.visibilityState !== 'hidden') location.replace(store);
  }, 2500);
  var stop = function () {
    clearTimeout(timer);
  };
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') stop();
  });
  addEventListener('pagehide', stop);
  location.replace(
    'intent://#Intent;scheme=hemu;package=krd.hemu.app;S.browser_fallback_url=' + encodeURIComponent(store) + ';end',
  );
})();
