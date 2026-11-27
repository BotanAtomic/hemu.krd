import { T, pageLang } from './translations';

// /lang.js has already chosen the language. The store buttons carry the Sorani wording; translate it for the others.
const t = T[pageLang()];
for (const node of document.querySelectorAll<HTMLElement>('[data-t="availableNow"]')) node.textContent = t.availableNow;
for (const store of document.querySelectorAll<HTMLElement>('[data-store]')) {
  store.setAttribute('aria-label', `${store.dataset.store} — ${t.availableNow}`);
}
document.documentElement.classList.remove('lang-pending');
