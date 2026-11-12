import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
  assert.equal(text("featureTitle"), t.feature.title);
  assert.equal(text("featureBody"), t.feature.body);
  assert.equal(text("madeFor"), t.madeFor);
  assert.equal(text("languageLabel"), t.languageLabel);
  assert.equal(text("contact"), t.contact);
  assert(html.includes(`<title>hemû — ${t.headline}</title>`));
  for (const [lang, meta] of Object.entries(LANGS))
    assert(html.includes(`<option value="${lang}"${lang === "ckb" ? " selected" : ""}>${meta.name}</option>`), lang);
  for (const screen of ["home", "listing", "profile"])
    assert(html.includes(`src="/src/assets/screens/${screen}-ckb.webp"`), screen);
});

test("the page paints without React: language script first, hero and screenshots in the HTML", async () => {
  const html = await read("index.html");
  const head = html.slice(0, html.indexOf("</head>"));
  assert.match(head, /<script src="\/lang\.js"><\/script>/u);
  assert(!/\bdefer\b|\basync\b|type="module"/u.test(head.match(/<script src="\/lang\.js"><\/script>/u)[0]));
  assert(html.includes('<div id="top"') || html.includes('id="top"'));
  assert(!html.includes('id="root"'));
  assert.match(html, /<source media="\(max-width: 560px\)" srcset="\/src\/assets\/showcase\/hero-portrait\.webp"/u);
  assert.match(html, /class="hero-landscape" src="\/src\/assets\/showcase\/hero-landscape\.webp"/u);
  // The portrait source must follow the 560px phone breakpoint in the CSS.
  assert.match(await read("src/styles.css"), /@media \(max-width: 560px\) \{\n  \.content-wide/u);
  const pkg = JSON.parse(await read("package.json"));
  assert(!pkg.dependencies, "no runtime dependencies");
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
