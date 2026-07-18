// Landing-page strings. headline / subheadline / categories / tab & UI labels
// are copied verbatim from the app's locale bundles (mobile/locales/*/common.json)
// so the site and the app always say the same thing.

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
  categoriesTitle: string;
  categories: { jobs: string; vehicles: string; property: string; electronics: string; home: string; fashion: string };
  features: { title: string; body: string }[];
  searchPlaceholder: string;
  tabs: { home: string; favorites: string; sell: string; inbox: string; account: string };
  cities: [string, string, string, string];
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
    categoriesTitle: 'Browse categories',
    categories: {
      jobs: 'Jobs',
      vehicles: 'Vehicles',
      property: 'Real estate',
      electronics: 'Electronics',
      home: 'Furniture',
      fashion: 'Fashion',
    },
    features: [
      {
        title: 'Everything in one place',
        body: 'Cars, phones, homes, jobs — find it all, posted by people near you.',
      },
      {
        title: 'Deal directly',
        body: 'Chat with the seller, agree on a price, meet up. No middlemen.',
      },
      {
        title: 'Post in a minute',
        body: 'Snap a few photos, set your price, and you are live across Kurdistan.',
      },
    ],
    searchPlaceholder: 'What are you looking for today?',
    tabs: { home: 'Home', favorites: 'Favorites', sell: 'Sell', inbox: 'Inbox', account: 'Account' },
    cities: ['Hewlêr', 'Silêmanî', 'Duhok', 'Kerkûk'],
    languageLabel: 'Language',
    contact: 'Contact',
    madeFor: 'Made for Kurdistan',
  },
  ckb: {
    headline: 'هەموو شتێک، لە نزیکتەوە',
    subheadline: 'کڕین و فرۆشتن لە سەرتاسەری کوردستان — لە هەولێرەوە بۆ ئامەد.',
    comingSoon: 'بەم زووانە',
    downloadHint: 'ئەپی hemû بەم زووانە بۆ iPhone و Android دێت.',
    categoriesTitle: 'گەڕان بە پۆلەکاندا',
    categories: {
      jobs: 'هەلی کار',
      vehicles: 'ئۆتۆمبێل',
      property: 'خانووبەرە',
      electronics: 'ئەلیکترۆنیات',
      home: 'کەلوپەلی ماڵ',
      fashion: 'جلوبەرگ',
    },
    features: [
      {
        title: 'هەموو شتێک لە یەک شوێن',
        body: 'ئۆتۆمبێل، مۆبایل، خانوو، هەلی کار — هەمووی بدۆزەرەوە، بڵاوکراوە لەلایەن خەڵکی دەوروبەرتەوە.',
      },
      {
        title: 'ڕاستەوخۆ مامەڵە بکە',
        body: 'لەگەڵ فرۆشیار گفتوگۆ بکە، لەسەر نرخ ڕێک بکەون و یەکتر ببینن. بەبێ ناوبژیوان.',
      },
      {
        title: 'لە یەک خولەکدا بڵاوی بکەرەوە',
        body: 'چەند وێنەیەک بگرە، نرخەکەت دابنێ، ئیتر ئیعلانەکەت لە سەرتاسەری کوردستان دەبینرێت.',
      },
    ],
    searchPlaceholder: 'ئەمڕۆ بەدوای چیدا دەگەڕێیت؟',
    tabs: { home: 'سەرەکی', favorites: 'دڵخوازەکان', sell: 'فرۆشتن', inbox: 'پەیامەکان', account: 'هەژمار' },
    cities: ['هەولێر', 'سلێمانی', 'دهۆک', 'کەرکووک'],
    languageLabel: 'زمان',
    contact: 'پەیوەندی',
    madeFor: 'بۆ کوردستان دروستکراوە',
  },
  ku: {
    headline: 'Her tişt, li nêzîkî te',
    subheadline: 'Li seranserê Kurdistanê bikire û bifiroşe — ji Hewlêrê heta Amedê.',
    comingSoon: 'Di demeke nêz de',
    downloadHint: 'Sepana hemû di demeke nêz de ji bo iPhone û Androidê tê.',
    categoriesTitle: 'Li kategoriyan bigere',
    categories: {
      jobs: 'Kar',
      vehicles: 'Wesayît',
      property: 'Xanî û erd',
      electronics: 'Elektronîk',
      home: 'Mobîlya',
      fashion: 'Cil û berg',
    },
    features: [
      {
        title: 'Her tişt li yek cihî',
        body: 'Otomobîl, telefon, xanî, kar — hemûyan bibîne, ji aliyê mirovên li derdora te ve hatine weşandin.',
      },
      {
        title: 'Rasterast danûstandinê bike',
        body: 'Bi firoşkar re biaxive, li ser bihayê li hev bikin û hev bibînin. Bê navbeynkar.',
      },
      {
        title: 'Di deqeyekê de biweşîne',
        body: 'Çend wêneyan bikişîne, bihayê xwe deyne û êdî îlana te li seranserê Kurdistanê tê dîtin.',
      },
    ],
    searchPlaceholder: 'Îro li çi digerî?',
    tabs: { home: 'Destpêk', favorites: 'Bijarte', sell: 'Bifiroşe', inbox: 'Peyam', account: 'Hesab' },
    cities: ['Hewlêr', 'Silêmanî', 'Duhok', 'Kerkûk'],
    languageLabel: 'Ziman',
    contact: 'Têkilî',
    madeFor: 'Ji bo Kurdistanê hatiye çêkirin',
  },
  ar: {
    headline: 'كل شيء، بالقرب منك',
    subheadline: 'بع واشترِ في كل كردستان — من هولێر إلى آمد.',
    comingSoon: 'قريبًا',
    downloadHint: 'تطبيق hemû قادم قريبًا إلى iPhone وAndroid.',
    categoriesTitle: 'تصفّح الأقسام',
    categories: {
      jobs: 'وظائف',
      vehicles: 'سيارات',
      property: 'عقارات',
      electronics: 'إلكترونيات',
      home: 'أثاث',
      fashion: 'أزياء',
    },
    features: [
      {
        title: 'كل شيء في مكان واحد',
        body: 'سيارات، هواتف، منازل، وظائف — اعثر على كل شيء، منشور من أشخاص بالقرب منك.',
      },
      {
        title: 'تعامل مباشرة',
        body: 'راسل البائع، اتفق معه على السعر، وقابله. بدون وسطاء.',
      },
      {
        title: 'انشر في دقيقة',
        body: 'التقط بعض الصور، حدّد سعرك، وسيصل إعلانك إلى كل كردستان.',
      },
    ],
    searchPlaceholder: 'عمّ تبحث اليوم؟',
    tabs: { home: 'الرئيسية', favorites: 'المفضلة', sell: 'بيع', inbox: 'الرسائل', account: 'الحساب' },
    cities: ['أربيل', 'السليمانية', 'دهوك', 'كركوك'],
    languageLabel: 'اللغة',
    contact: 'تواصل معنا',
    madeFor: 'صُنع لكردستان',
  },
  tr: {
    headline: 'Her şey, yanı başında',
    subheadline: "Kürdistan'ın her yerinde al, sat — Hewlêr'den Amed'e.",
    comingSoon: 'Çok yakında',
    downloadHint: "hemû uygulaması çok yakında iPhone ve Android'de.",
    categoriesTitle: 'Kategorilere göz at',
    categories: {
      jobs: 'İş ilanları',
      vehicles: 'Vasıta',
      property: 'Emlak',
      electronics: 'Elektronik',
      home: 'Mobilya',
      fashion: 'Moda',
    },
    features: [
      {
        title: 'Her şey tek bir yerde',
        body: 'Araba, telefon, ev, iş — hepsini yakınındaki insanların ilanlarında bul.',
      },
      {
        title: 'Doğrudan anlaş',
        body: 'Satıcıyla mesajlaş, fiyatta anlaş, buluş. Aracı yok.',
      },
      {
        title: 'Bir dakikada ilan ver',
        body: "Birkaç fotoğraf çek, fiyatını belirle — ilanın tüm Kürdistan'da yayında.",
      },
    ],
    searchPlaceholder: 'Bugün ne arıyorsun?',
    tabs: { home: 'Ana sayfa', favorites: 'Favoriler', sell: 'Sat', inbox: 'Gelen kutusu', account: 'Hesap' },
    cities: ['Hewlêr', 'Silêmanî', 'Duhok', 'Kerkûk'],
    languageLabel: 'Dil',
    contact: 'İletişim',
    madeFor: 'Kürdistan için yapıldı',
  },
  fa: {
    headline: 'همه‌چیز، نزدیک تو',
    subheadline: 'خرید و فروش در سراسر کردستان — از هولێر تا آمد.',
    comingSoon: 'به‌زودی',
    downloadHint: 'اپلیکیشن hemû به‌زودی برای iPhone و Android عرضه می‌شود.',
    categoriesTitle: 'مرور دسته‌بندی‌ها',
    categories: {
      jobs: 'مشاغل',
      vehicles: 'وسایل نقلیه',
      property: 'املاک',
      electronics: 'لوازم الکترونیکی',
      home: 'مبلمان',
      fashion: 'مد و پوشاک',
    },
    features: [
      {
        title: 'همه‌چیز در یک‌جا',
        body: 'خودرو، موبایل، خانه، شغل — همه را در آگهی‌های مردم اطرافت پیدا کن.',
      },
      {
        title: 'مستقیم معامله کن',
        body: 'با فروشنده گفتگو کن، سر قیمت توافق کنید و همدیگر را ببینید. بدون واسطه.',
      },
      {
        title: 'در یک دقیقه آگهی بگذار',
        body: 'چند عکس بگیر، قیمتت را تعیین کن و آگهی‌ات در سراسر کردستان دیده می‌شود.',
      },
    ],
    searchPlaceholder: 'امروز دنبال چه می‌گردی؟',
    tabs: { home: 'خانه', favorites: 'علاقه‌مندی‌ها', sell: 'فروش', inbox: 'پیام‌ها', account: 'حساب' },
    cities: ['اربیل', 'سلیمانیه', 'دهوک', 'کرکوک'],
    languageLabel: 'زبان',
    contact: 'تماس',
    madeFor: 'ساخته‌شده برای کردستان',
  },
};

/** Pick the best initial language: saved choice, then browser locale, then Sorani. */
export function detectLang(): Lang {
  const saved = localStorage.getItem('hemu-lang');
  if (saved && saved in LANGS) return saved as Lang;
  for (const loc of navigator.languages ?? []) {
    const base = loc.toLowerCase().split('-')[0];
    if (base === 'ckb') return 'ckb';
    if (base === 'ku') return 'ku';
    if (base === 'en') return 'en';
    if (base === 'ar') return 'ar';
    if (base === 'tr') return 'tr';
    if (base === 'fa') return 'fa';
  }
  return 'ckb';
}
