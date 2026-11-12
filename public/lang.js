// Chooses the landing page language before first paint. Classic, render-blocking
// script (the CSP forbids inline scripts) so <html lang dir> is right when the
// static Sorani markup in index.html is first drawn. This is the only language
// detector: src/translations.ts reads the result from <html data-lang>.
(function () {
  var rtl = { ckb: 1, ar: 1, fa: 1 };
  var known = { ckb: 1, ku: 1, en: 1, ar: 1, tr: 1, fa: 1 };
  var byLocale = { ckb: 'ckb', ku: 'ku', en: 'en', ar: 'ckb', tr: 'tr', fa: 'fa' };
  var lang = 'ckb';
  try {
    var saved = localStorage.getItem('hemu-lang');
    var zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (saved && known[saved] === 1) {
      lang = saved;
    } else if (zone === 'Asia/Baghdad' || zone === 'Asia/Tehran') {
      lang = 'ckb';
    } else {
      var locales = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
      for (var i = 0; i < locales.length; i++) {
        var base = String(locales[i]).toLowerCase().split('-')[0];
        if (Object.prototype.hasOwnProperty.call(byLocale, base)) {
          lang = byLocale[base];
          break;
        }
      }
    }
  } catch (e) {}
  var root = document.documentElement;
  root.lang = lang;
  root.dir = rtl[lang] ? 'rtl' : 'ltr';
  root.setAttribute('data-lang', lang);
  // index.html is drawn in Sorani; hide its text until src/main.ts has
  // translated it, so nobody sees the wrong language flash.
  if (lang !== 'ckb') root.className += ' lang-pending';
})();
