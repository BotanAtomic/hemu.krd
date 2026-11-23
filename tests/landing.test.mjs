import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { LANGS, T } from "../src/translations.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const decode = (value) => value.replace(/&amp;/gu, "&");

function detect({ saved, zone = "Europe/Paris", languages = ["en-US"], throws = false }) {
  const root = { className: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  const context = {
    document: { documentElement: root },
    localStorage: { getItem: () => { if (throws) throw new Error("blocked"); return saved ?? null; } },
    Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: zone }) }) },
    navigator: { languages, language: languages[0] },
  };
  return readFile(new URL("../public/lang.js", import.meta.url), "utf8").then((script) => {
    vm.runInNewContext(script, context);
    return root;
  });
}

test("lang.js picks the same language as before: saved, Sorani time zone, locale, Sorani", async () => {
  const cases = [
    [{ saved: "tr" }, "tr"],
    [{ saved: "bogus", languages: ["ar-IQ"] }, "ckb"],
    [{ saved: "toString", languages: ["fa"] }, "fa"],
    [{ zone: "Asia/Baghdad", languages: ["en-US"] }, "ckb"],
    [{ languages: ["en-GB"] }, "en"],
    [{ languages: ["de-DE", "ku-TR"] }, "ku"],
    [{ languages: ["ar-EG"] }, "ckb"],
    [{ languages: ["fr-FR"] }, "ckb"],
    [{ languages: ["constructor"] }, "ckb"],
    [{ throws: true }, "ckb"],
  ];
  for (const [input, lang] of cases) {
    const root = await detect(input);
    assert.equal(root.lang, lang, JSON.stringify(input));
    assert.equal(root.attrs["data-lang"], lang);
    assert.equal(root.dir, LANGS[lang].dir);
    assert.equal(root.lang, LANGS[lang].tag);
    assert.equal(/lang-pending/u.test(root.className), lang !== "ckb");
  }
});

test("the static first paint is the Sorani page, so index.html and the strings agree", async () => {
  const html = await read("index.html");
  assert.match(html, /<html lang="ckb" dir="rtl" data-lang="ckb">/u);
  const t = T.ckb;
  const text = (key) =>
    decode(html.match(new RegExp(`data-t="${key}">([^<]*)<`, "u"))?.[1] ?? "");
  assert.equal(text("headline"), t.headline);
  assert.equal(text("subheadline"), t.subheadline);
  assert.equal(text("comingSoon"), t.comingSoon);
  assert.equal(text("downloadHint"), t.downloadHint);
  assert.equal(text("availableNow"), t.availableNow);
  assert.equal(text("languageLabel"), t.languageLabel);
  assert.equal(text("contact"), t.contact);
  assert(html.includes(`<title>hemû — ${t.headline}</title>`));
  for (const [lang, meta] of Object.entries(LANGS))
    assert(html.includes(`<option value="${lang}"${lang === "ckb" ? " selected" : ""}>${meta.name}</option>`), lang);
  assert(html.includes('src="/src/assets/screens/01-home-ckb.webp"'));
});

test("every language has its seven step captions, the tour's eight screens and the pieces that lift off them", async () => {
  const { PIECES } = await import("../src/pieces.ts");
  const screens = ["01-home", "08-cities", "03-filters", "09-results", "05-listing", "10-chat", "11-seller", "02-sell"];
  for (const lang of Object.keys(LANGS)) {
    assert.equal(T[lang].steps.length, 7, lang);
    for (const step of T[lang].steps) assert(step.title && step.body, lang);
    assert(T[lang].alert.title && T[lang].alert.body && T[lang].alert.time, lang);
    assert.deepEqual(Object.keys(PIECES[lang]), screens, lang);
    for (const screen of screens) {
      const { size } = await stat(new URL(`../src/assets/screens/${screen}-${lang}.webp`, import.meta.url));
      assert(size > 10_000 && size < 260_000, `${screen}-${lang}.webp is ${size} bytes`);
    }
  }
  // A listing is «ڕیکلام» in Sorani and "reklam" in Kurmanci, never the Arabic loanword.
  assert(!/ئیعلان/u.test(JSON.stringify(T.ckb)));
  assert(/reklam/u.test(JSON.stringify(T.ku)));
});

test("the headline and subheadline say exactly what the app says (mobile onboarding.*)", () => {
  // Copied from mobile/locales/*/common.json; the app wording is canonical.
  const app = {
    en: ["Everything, near you", "Buy and sell across Kurdistan — from Hewlêr to Amed."],
    ckb: ["هەموو شتێک، لە نزیکەوە", "بکڕە و بفرۆشە لە سەرانسەری کوردستان — لە هەولێر تا ئامەد."],
    ku: ["Her tişt, li nêzîkî te", "Li seranserê Kurdistanê bikire û bifiroşe — ji Hewlêrê heta Amedê."],
    ar: ["كل شيء، بالقرب منك", "بع واشترِ في كل كردستان — من Hewlêr إلى Amed."],
    tr: ["Her şey, yanı başında", "Kürdistan'ın her yerinde al, sat — Hewlêr'den Amed'e."],
    fa: ["همه\u200cچیز، نزدیک تو", "خرید و فروش در سراسر کردستان — از Hewlêr تا Amed."],
  };
  assert.deepEqual(Object.keys(app).sort(), Object.keys(T).sort());
  for (const [lang, [headline, subheadline]] of Object.entries(app)) {
    assert.equal(T[lang].headline, headline, lang);
    assert.equal(T[lang].subheadline, subheadline, lang);
  }
});

test("the page paints without a framework: language script first, headline and Home screen in the HTML", async () => {
  const html = await read("index.html");
  const head = html.slice(0, html.indexOf("</head>"));
  assert.match(head, /<script src="\/lang\.js"><\/script>/u);
  assert(!/\bdefer\b|\basync\b|type="module"/u.test(head.match(/<script src="\/lang\.js"><\/script>/u)[0]));
  assert(!html.includes('id="root"'));
  assert.match(html, /<h1 data-t="headline">[^<]+<\/h1>/u);
  // The first screen is in the markup with its size, so the phone is drawn before the script runs.
  assert.match(html, /<img class="bd" src="\/src\/assets\/screens\/01-home-ckb\.webp" width="780" height="1692"/u);
  // No web fonts and nothing from another origin: the content security policy allows only this site.
  assert(!/https?:\/\/(?!hemu\.krd)[^"']+\.(css|js|woff2?)/u.test(html));
  assert(!/@import|url\(\s*["']?https?:/u.test(await read("src/styles.css")));
  const pkg = JSON.parse(await read("package.json"));
  assert(!pkg.dependencies, "no runtime dependencies");
});

test("the link preview image is a small 1200×630 JPEG (messengers skip large og:image files)", async () => {
  const html = await read("index.html");
  assert(html.includes('<meta property="og:image" content="https://hemu.krd/og.jpg" />'));
  assert(html.includes('<meta property="og:image:type" content="image/jpeg" />'));
  assert(html.includes('<meta property="og:image:width" content="1200" />'));
  assert(html.includes('<meta property="og:image:height" content="630" />'));
  const { size } = await stat(new URL("../public/og.jpg", import.meta.url));
  assert(size < 200_000, `og.jpg is ${size} bytes`);
});

test("only content-hashed assets are immutable; HTML and the CAPTCHA page stay short-cached", async () => {
  const config = JSON.parse(await read("firebase.json"));
  const cache = (rule) =>
    rule.headers.find(({ key }) => key === "Cache-Control")?.value;
  const rules = config.hosting.headers;
  const immutable = rules.filter((rule) => /immutable/u.test(cache(rule) ?? ""));
  assert.deepEqual(immutable.map((rule) => rule.source), ["/assets/**"]);
  assert.equal(cache(immutable[0]), "public, max-age=31536000, immutable");
  // Later rules win for the same header, so the long cache comes last.
  assert.equal(rules.at(-1), immutable[0]);
  assert.equal(cache(rules.find((rule) => rule.source === "**")), "public, max-age=300");
  assert.equal(cache(rules.find((rule) => rule.source === "/auth/captcha{,/**}")), "no-store");
});

const PLAY = "https://play.google.com/store/apps/details?id=krd.hemu.app";

test("Google Play is a real link in both store blocks and the Android pill; App Store stays a non-link", async () => {
  const html = await read("index.html");
  const blocks = html.match(/<div class="stores">[\s\S]*?<\/a>/gu);
  assert.equal(blocks.length, 2);
  for (const block of blocks) {
    assert(block.includes(`<a class="store" data-store="Google Play" href="${PLAY}" rel="noopener" aria-label="Google Play — ${T.ckb.availableNow}">`));
    assert(block.includes(`<div class="store" data-store="App Store" aria-label="App Store — ${T.ckb.comingSoon}">`));
  }
  assert.equal(html.match(/href="https:\/\/play\.google\.com[^"]*"/gu).length, 3);
  assert(html.includes(`<a class="get-android" data-store="Google Play" href="${PLAY}"`));
  assert(html.includes('<span class="get-ios" aria-hidden="true">'));
  assert(!/<a [^>]*data-store="App Store"/u.test(html));
  assert(!/<span class="get"[^>]*aria-hidden/u.test(html));
});

test("every language says the Play badge is available now", () => {
  for (const lang of Object.keys(LANGS)) {
    assert(T[lang].availableNow, lang);
    assert.notEqual(T[lang].availableNow, T[lang].comingSoon, lang);
    assert(/Android/u.test(T[lang].downloadHint), lang);
  }
});
