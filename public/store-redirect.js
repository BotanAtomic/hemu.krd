// /app: sends an iPhone, iPad or Android phone straight to its store before the page is drawn. /lang.js runs first and
// names the device in <html data-os>; anything else (desktop, unknown, no script) keeps the page with both store buttons.
// Classic, render-blocking script (the CSP forbids inline scripts). The store URLs carry nothing from this page's own URL.
(function () {
  var stores = {
    ios: 'https://apps.apple.com/app/id6805621903',
    android: 'https://play.google.com/store/apps/details?id=krd.hemu.app',
  };
  var os = document.documentElement.getAttribute('data-os');
  if (os && Object.prototype.hasOwnProperty.call(stores, os)) location.replace(stores[os]);
})();
