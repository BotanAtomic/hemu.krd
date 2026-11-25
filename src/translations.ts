// Landing-page strings. Only the strings the page shows are kept: it ships to
// cold, slow phones.
// These mirror the app's wording, and the app is canonical: headline
// (onboarding.headline), subheadline (onboarding.subheadline), languageLabel
// (onboarding.language) and each LANGS name (onboarding.langX in that
// language's own bundle). The step titles are the store-screenshot headlines and
// the step bodies and the alert are lines of the store description, word for word.
// availableNow, downloadHint and contact are site-only.
// The Sorani strings of the first screen are also written into index.html (the
// static first paint); tests/landing.test.mjs keeps the two in sync.

export type Lang = 'ckb' | 'ku' | 'en' | 'ar' | 'tr' | 'fa';

export interface LangMeta {
  /** BCP-47 tag for <html lang> */
  tag: string;
  /** Own-language display name; mirrors onboarding.langX in that language's own app bundle */
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
  availableNow: string;
  downloadHint: string;
  languageLabel: string;
  contact: string;
  /** The seven screens after Home, in order: Sell, Filters, Offers, Listing, Alerts, Follow, Cities. */
  steps: { title: string; body: string }[];
  /** The saved-search alert that lands on the phone at the Alerts step. */
  alert: { title: string; body: string; time: string };
}

export const T: Record<Lang, Strings> = {
  en: {
    headline: 'Everything, near you',
    subheadline: 'Buy and sell across Kurdistan — from Hewlêr to Amed.',
    availableNow: 'Available now',
    downloadHint: 'hemû is available now on iPhone and Android.',
    languageLabel: 'Language',
    contact: 'Contact',
    steps: [
      { title: 'Sell in a minute from your camera', body: 'Take photos with your camera or choose them from your gallery.' },
      { title: 'Find exactly what you want', body: 'Search, use filters and sort by price.' },
      { title: 'Agree on a price right in the chat', body: 'Make an offer; the other person can accept it or send a counter-offer.' },
      { title: 'Every detail before you meet', body: 'Message the seller straight from the listing.' },
      { title: 'Get alerts for saved searches', body: 'Save a search and get an alert when a new listing matches.' },
      { title: 'Follow sellers you like', body: 'Follow the sellers you like and see their new listings on Home.' },
      { title: 'Your city, or all of Kurdistan', body: 'Choose your city, several locations, or all of Kurdistan.' },
    ],
    alert: { title: 'Audi under $30,000', body: '3 new listings in Hewlêr and Silêmanî', time: 'now' },
  },
  ckb: {
    headline: 'هەموو شتێک، لە نزیکەوە',
    subheadline: 'بکڕە و بفرۆشە لە سەرانسەری کوردستان — لە هەولێر تا ئامەد.',
    availableNow: 'ئێستا بەردەستە',
    downloadHint: 'ئەپی hemû ئێستا بۆ iPhone و Android بەردەستە.',
    languageLabel: 'زمان',
    contact: 'پەیوەندی',
    steps: [
      { title: 'بە کامێراکەت زوو بیفرۆشە', body: 'بە کامێراکەت وێنە بگرە یان لە گەلەرییەوە هەڵیانبژێرە.' },
      { title: 'ئەوەی دەتەوێت ڕێک بیدۆزەرەوە', body: 'بگەڕێ، فلتەر دابنێ و بەپێی نرخ ڕیزیان بکە.' },
      { title: 'لەسەر نرخ لە چاتدا ڕێک بکەون', body: 'پێشنیارێک بکە؛ لایەنەکەی تر دەتوانێت قبوڵی بکات یان پێشنیاری بەرامبەر بنێرێت.' },
      { title: 'هەموو وردەکارییەک پێش ئەوەی یەک ببینن', body: 'ڕاستەوخۆ لە ڕیکلامەکەوە پەیام بۆ فرۆشیار بنێرە.' },
      { title: 'ئاگادارکردنەوە بۆ گەڕانەکانت', body: 'گەڕانەکەت پاشەکەوت بکە و کاتێک ڕیکلامێکی نوێی گونجاو بڵاو دەبێتەوە، ئاگادارکردنەوە وەربگرە.' },
      { title: 'شوێن فرۆشیارە دڵخوازەکانت بکەوە', body: 'شوێنی ئەو فرۆشیارانە بکەوە کە حەزت لێیانە و ڕیکلامە نوێیەکانیان لە پەڕەی سەرەکی ببینە.' },
      { title: 'شارەکەت، یان هەموو کوردستان', body: 'شارەکەت، چەند شوێنێک یان هەموو کوردستان هەڵبژێرە.' },
    ],
    alert: { title: 'ئاودی کەمتر لە $30,000', body: '٣ ڕیکلامی نوێ لە هەولێر و سلێمانی', time: 'ئێستا' },
  },
  ku: {
    headline: 'Her tişt, li nêzîkî te',
    subheadline: 'Li seranserê Kurdistanê bikire û bifiroşe — ji Hewlêrê heta Amedê.',
    availableNow: 'Niha berdest e',
    downloadHint: 'Sepana hemû niha ji bo iPhone û Androidê berdest e.',
    languageLabel: 'Ziman',
    contact: 'Têkilî',
    steps: [
      { title: 'Bi kameraya xwe di deqeyekê de bifiroşe', body: 'Bi kameraya xwe wêneyan bikişîne an ji galeriyê hilbijêre.' },
      { title: 'Tam tiştê ku dixwazî bibîne', body: 'Bigere, fîlteran bi kar bîne û li gorî bihayê rêz bike.' },
      { title: 'Di axaftinê de li ser bihayê li hev bikin', body: 'Pêşniyarekê bike; aliyê din dikare wê bipejirîne an pêşniyareke berevajî bişîne.' },
      { title: 'Hemû hûrgilî berî ku hûn hev bibînin', body: 'Ji reklamê rasterast ji firoşkar re binivîse.' },
      { title: 'Ji bo lêgerînên tomarkirî agahdariyan bistîne', body: 'Lêgerînê tomar bike; dema reklameke nû ya lê dikeve tê weşandin, agahdariyê bistîne.' },
      { title: 'Firoşkarên ku hez dikî bişopîne', body: 'Firoşkarên ku hez dikî bişopîne û reklamên wan ên nû li Destpêkê bibîne.' },
      { title: 'Bajarê te, an jî hemû Kurdistan', body: 'Bajarê xwe, çend cihan an hemû Kurdistanê hilbijêre.' },
    ],
    alert: { title: 'Audi di bin $30,000 de', body: '3 reklamên nû li Hewlêr û Silêmaniyê', time: 'niha' },
  },
  ar: {
    headline: 'كل شيء، بالقرب منك',
    subheadline: 'بع واشترِ في كل كردستان — من Hewlêr إلى Amed.',
    availableNow: 'متوفر الآن',
    downloadHint: 'تطبيق hemû متوفر الآن على iPhone وAndroid.',
    languageLabel: 'اللغة',
    contact: 'تواصل معنا',
    steps: [
      { title: 'بِع خلال دقيقة من كاميرتك', body: 'التقط الصور بكاميرتك أو اخترها من المعرض.' },
      { title: 'اعثر على ما تريده بالضبط', body: 'ابحث واستخدم الفلاتر ورتّب النتائج حسب السعر.' },
      { title: 'اتفقا على السعر داخل المحادثة', body: 'قدّم عرضًا، ويمكن للطرف الآخر قبوله أو إرسال عرض مقابل.' },
      { title: 'كل التفاصيل قبل أن تلتقيا', body: 'راسل البائع مباشرة من الإعلان.' },
      { title: 'تنبيهات لعمليات بحثك المحفوظة', body: 'احفظ البحث لتصلك التنبيهات عند نشر إعلان جديد يطابقه.' },
      { title: 'تابع البائعين الذين تحبهم', body: 'تابع البائعين الذين تحبهم وشاهد إعلاناتهم الجديدة في الرئيسية.' },
      { title: 'مدينتك، أو كل كردستان', body: 'اختر مدينتك أو عدة مواقع أو كل كردستان.' },
    ],
    alert: { title: 'أودي بأقل من $30,000', body: '٣ إعلانات جديدة في أربيل والسليمانية', time: 'الآن' },
  },
  tr: {
    headline: 'Her şey, yanı başında',
    subheadline: "Kürdistan'ın her yerinde al, sat — Hewlêr'den Amed'e.",
    availableNow: 'Şimdi yayında',
    downloadHint: "hemû uygulaması artık iPhone ve Android'de.",
    languageLabel: 'Dil',
    contact: 'İletişim',
    steps: [
      { title: 'Kameranla bir dakikada sat', body: 'Fotoğrafları kameranla çek ya da galeriden seç.' },
      { title: 'Aradığını hemen bul', body: 'Ara, filtrele, fiyata göre sırala.' },
      { title: 'Fiyatta sohbet içinde anlaşın', body: 'Teklif ver; karşı taraf kabul edebilir ya da karşı teklif gönderebilir.' },
      { title: 'Buluşmadan önce tüm detaylar', body: 'İlandan doğrudan satıcıya mesaj at.' },
      { title: 'Kayıtlı aramalar için bildirim al', body: 'Aramayı kaydet, yeni bir ilan eşleştiğinde bildirim al.' },
      { title: 'Satıcıları takip et', body: 'Beğendiğin satıcıları takip et, yeni ilanlarını ana sayfada gör.' },
      { title: 'Şehrin ya da tüm Kürdistan', body: "Şehrini, birkaç konumu ya da tüm Kürdistan'ı seç." },
    ],
    alert: { title: '$30,000 altı Audi', body: 'Erbil ve Süleymaniye’de 3 yeni ilan', time: 'şimdi' },
  },
  fa: {
    headline: 'همه‌چیز، نزدیک تو',
    subheadline: 'خرید و فروش در سراسر کردستان — از Hewlêr تا Amed.',
    availableNow: 'اکنون در دسترس',
    downloadHint: 'اپلیکیشن hemû اکنون برای iPhone و Android در دسترس است.',
    languageLabel: 'زبان',
    contact: 'تماس',
    steps: [
      { title: 'با دوربینت در یک دقیقه بفروش', body: 'با دوربین عکس بگیر یا از گالری انتخاب کن.' },
      { title: 'همان چیزی را که می‌خواهی دقیقاً پیدا کن', body: 'جست‌وجو کن، فیلتر بزن و بر اساس قیمت مرتب کن.' },
      { title: 'در همان گفتگو روی قیمت توافق کنید', body: 'پیشنهاد بده؛ طرف مقابل می‌تواند آن را بپذیرد یا پیشنهاد متقابل بدهد.' },
      { title: 'همهٔ جزئیات پیش از دیدار', body: 'مستقیم از صفحهٔ آگهی به فروشنده پیام بده.' },
      { title: 'برای جستجوهای ذخیره‌شده هشدار بگیر', body: 'جست‌وجو را ذخیره کن تا با آمدن آگهی جدیدِ مطابق، هشدار بگیری.' },
      { title: 'فروشنده‌های مورد علاقه‌ات را دنبال کن', body: 'فروشنده‌های مورد علاقه‌ات را دنبال کن و آگهی‌های تازه‌شان را در صفحهٔ خانه ببین.' },
      { title: 'شهر خودت، یا همهٔ کردستان', body: 'شهر خودت، چند موقعیت یا همهٔ کردستان را انتخاب کن.' },
    ],
    alert: { title: 'آئودی زیر $30,000', body: '۳ آگهی تازه در اربیل و سلیمانیه', time: 'اکنون' },
  },
};

const DEFAULT_LANG: Lang = 'ckb';

/**
 * The language /lang.js picked before first paint (saved choice, Sorani-region
 * time zone, browser locale, then Sorani). /lang.js is the only detector.
 */
export function pageLang(): Lang {
  const lang = document.documentElement.dataset.lang;
  return lang && lang in LANGS ? (lang as Lang) : DEFAULT_LANG;
}
