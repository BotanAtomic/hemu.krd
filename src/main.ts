import './styles.css';
import { LANGS, T, pageLang } from './translations';
import type { Lang } from './translations';

type Screen = 'home' | 'listing' | 'profile';

// Hashed URLs of every language's screenshots; the Sorani ones are also named
// directly in index.html so the browser can fetch them before this module runs.
const screenUrls = import.meta.glob<string>('./assets/screens/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});
// The screens come from the "hemû - app" design, which has no Kurmanji or Persian
// set: those languages show the English and Sorani screens.
const SCREEN_LANG: Partial<Record<Lang, Lang>> = { ku: 'en', fa: 'ckb' };
const screenUrl = (screen: Screen, lang: Lang) =>
  screenUrls[`./assets/screens/${screen}-${SCREEN_LANG[lang] ?? lang}.webp`];

const ALT: Record<Screen, string> = {
  home: 'marketplace home screen',
  listing: 'listing screen',
  profile: 'seller profile screen',
};

const root = document.documentElement;
const select = document.querySelector<HTMLSelectElement>('#language')!;
const track = document.querySelector<HTMLElement>('#mobile-track')!;
const dots = Array.from(document.querySelectorAll<HTMLButtonElement>('#mobile-pagination button'));
const slides = Array.from(track.querySelectorAll<HTMLElement>('.mobile-slide'));

function setActiveScreen(index: number) {
  dots.forEach((dot, i) => {
    dot.classList.toggle('is-active', i === index);
    dot.setAttribute('aria-selected', String(i === index));
  });
  slides.forEach((slide, i) => slide.setAttribute('aria-hidden', String(i !== index)));
}

function render(lang: Lang) {
  const t = T[lang];
  const meta = LANGS[lang];
  const text: Record<string, string> = {
    madeFor: t.madeFor,
    languageLabel: t.languageLabel,
    comingSoon: t.comingSoon,
    headline: t.headline,
    subheadline: t.subheadline,
    downloadHint: t.downloadHint,
    featureTitle: t.feature.title,
    featureBody: t.feature.body,
    contact: t.contact,
  };
  for (const node of document.querySelectorAll<HTMLElement>('[data-t]')) {
    node.textContent = text[node.dataset.t!];
  }
  root.lang = meta.tag;
  root.dir = meta.dir;
  root.dataset.lang = lang;
  document.title = `hemû — ${t.headline}`;
  select.value = lang;
  select.setAttribute('aria-label', t.languageLabel);
  for (const store of document.querySelectorAll<HTMLElement>('[data-store]')) {
    store.setAttribute('aria-label', `${store.dataset.store} — ${t.comingSoon}`);
  }
  for (const img of document.querySelectorAll<HTMLImageElement>('img[data-screen]')) {
    const screen = img.dataset.screen as Screen;
    img.src = screenUrl(screen, lang);
    img.alt = `hemû ${ALT[screen]} — ${meta.name}`;
  }
}

function showLang(lang: Lang) {
  render(lang);
  root.classList.remove('lang-pending');
  setActiveScreen(0);
  track.scrollTo({ left: 0 });
}

select.addEventListener('change', () => {
  const lang = select.value as Lang;
  try {
    localStorage.setItem('hemu-lang', lang);
  } catch {
    // Private mode: the choice just will not be remembered.
  }
  showLang(lang);
});

track.addEventListener('scroll', () => {
  if (!track.clientWidth) return;
  const index = Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / track.clientWidth)));
  setActiveScreen(index);
});

dots.forEach((dot, index) =>
  dot.addEventListener('click', () => {
    setActiveScreen(index);
    track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' });
  }),
);

showLang(pageLang());
