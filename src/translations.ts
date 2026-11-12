// Landing-page strings, copied verbatim from the app's locale bundles
// (mobile/locales/*/common.json) so the site and the app say the same thing.
// Only the strings the page shows are kept: it ships to cold, slow phones.
// The Sorani strings are also written into index.html (the static first
// paint); tests/landing.test.mjs keeps the two in sync.

export type Lang = 'ckb' | 'ku' | 'en' | 'ar' | 'tr' | 'fa';

export interface LangMeta {
  /** BCP-47 tag for <html lang> */
  tag: string;
  /** Own-language display name (app: onboarding.langX) */
  name: string;
  dir: 'ltr' | 'rtl';
}

export const LANGS: Record<Lang, LangMeta> = {
  ckb: { tag: 'ckb', name: 'کوردی — سۆرانی', dir: 'rtl' },
  ku: { tag: 'ku', name: 'Kurdî — Kurmancî', dir: 'ltr' },
  en: { tag: 'en', name: 'English', dir: 'ltr' },
  ar: { tag: 'ar', name: 'العربية', dir: 'rtl' },
  tr: { tag: 'tr', name: 'Türkçe', dir: 'ltr' },
  fa: { tag: 'fa', name: 'فارسی', dir: 'rtl' },
};

export interface Strings {
  headline: string;
  subheadline: string;
  comingSoon: string;
  downloadHint: string;
  /** The callout on the floating card beside the desktop phones. */
  feature: { title: string; body: string };
  languageLabel: string;
  contact: string;
  madeFor: string;
}

export const T: Record<Lang, Strings> = {
  en: {
    headline: 'Everything, near you',
    subheadline: 'Buy and sell across Kurdistan — from Hewlêr to Amed.',
    comingSoon: 'Coming soon',
    downloadHint: 'The hemû app is on its way to iPhone and Android.',
    feature: { title: 'Post in a minute', body: 'Snap a few photos, set your price, and you are live across Kurdistan.' },
    languageLabel: 'Language',
    contact: 'Contact',
    madeFor: 'Made for Kurdistan',
  },
  ckb: {
    headline: 'هەموو شتێک، لە نزیکتەوە',
    subheadline: 'کڕین و فرۆشتن لە سەرتاسەری کوردستان — لە هەولێرەوە بۆ ئامەد.',
    comingSoon: 'بەم زووانە',
    downloadHint: 'ئەپی hemû بەم زووانە بۆ iPhone و Android دێت.',
    feature: { title: 'لە یەک خولەکدا بڵاوی بکەرەوە', body: 'چەند وێنەیەک بگرە، نرخەکەت دابنێ، ئیتر ئیعلانەکەت لە سەرتاسەری کوردستان دەبینرێت.' },
    languageLabel: 'زمان',
    contact: 'پەیوەندی',
    madeFor: 'بۆ کوردستان دروستکراوە',
  },
  ku: {
    headline: 'Her tişt, li nêzîkî te',
    subheadline: 'Li seranserê Kurdistanê bikire û bifiroşe — ji Hewlêrê heta Amedê.',
    comingSoon: 'Di demeke nêz de',
    downloadHint: 'Sepana hemû di demeke nêz de ji bo iPhone û Androidê tê.',
    feature: { title: 'Di deqeyekê de biweşîne', body: 'Çend wêneyan bikişîne, bihayê xwe deyne û êdî îlana te li seranserê Kurdistanê tê dîtin.' },
    languageLabel: 'Ziman',
    contact: 'Têkilî',
    madeFor: 'Ji bo Kurdistanê hatiye çêkirin',
  },
  ar: {
    headline: 'كل شيء، بالقرب منك',
    subheadline: 'بع واشترِ في كل كردستان — من هولێر إلى آمد.',
    comingSoon: 'قريبًا',
    downloadHint: 'تطبيق hemû قادم قريبًا إلى iPhone وAndroid.',
    feature: { title: 'انشر في دقيقة', body: 'التقط بعض الصور، حدّد سعرك، وسيصل إعلانك إلى كل كردستان.' },
    languageLabel: 'اللغة',
    contact: 'تواصل معنا',
    madeFor: 'صُنع لكردستان',
  },
  tr: {
    headline: 'Her şey, yanı başında',
    subheadline: "Kürdistan'ın her yerinde al, sat — Hewlêr'den Amed'e.",
    comingSoon: 'Çok yakında',
    downloadHint: "hemû uygulaması çok yakında iPhone ve Android'de.",
    feature: { title: 'Bir dakikada ilan ver', body: "Birkaç fotoğraf çek, fiyatını belirle — ilanın tüm Kürdistan'da yayında." },
    languageLabel: 'Dil',
    contact: 'İletişim',
    madeFor: 'Kürdistan için yapıldı',
  },
  fa: {
    headline: 'همه‌چیز، نزدیک تو',
    subheadline: 'خرید و فروش در سراسر کردستان — از هولێر تا آمد.',
    comingSoon: 'به‌زودی',
    downloadHint: 'اپلیکیشن hemû به‌زودی برای iPhone و Android عرضه می‌شود.',
    feature: { title: 'در یک دقیقه آگهی بگذار', body: 'چند عکس بگیر، قیمتت را تعیین کن و آگهی‌ات در سراسر کردستان دیده می‌شود.' },
    languageLabel: 'زبان',
    contact: 'تماس',
    madeFor: 'ساخته‌شده برای کردستان',
  },
};

export const DEFAULT_LANG: Lang = 'ckb';

/**
 * The language /lang.js picked before first paint (saved choice, Sorani-region
 * time zone, browser locale, then Sorani). /lang.js is the only detector.
 */
export function pageLang(): Lang {
  const lang = document.documentElement.dataset.lang;
  return lang && lang in LANGS ? (lang as Lang) : DEFAULT_LANG;
}
