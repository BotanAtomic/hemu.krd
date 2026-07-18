import { useEffect, useRef, useState } from 'react';

import landscape from './assets/showcase/kurdistan-spring-v2.webp';
import homeAr from './assets/screens/home-ar.webp';
import homeCkb from './assets/screens/home-ckb.webp';
import homeEn from './assets/screens/home-en.webp';
import homeFa from './assets/screens/home-fa.webp';
import homeKu from './assets/screens/home-ku.webp';
import homeTr from './assets/screens/home-tr.webp';
import onboardingAr from './assets/screens/onboarding-ar.webp';
import onboardingCkb from './assets/screens/onboarding-ckb.webp';
import onboardingEn from './assets/screens/onboarding-en.webp';
import onboardingFa from './assets/screens/onboarding-fa.webp';
import onboardingKu from './assets/screens/onboarding-ku.webp';
import onboardingTr from './assets/screens/onboarding-tr.webp';
import accountAr from './assets/screens/account-ar.webp';
import accountCkb from './assets/screens/account-ckb.webp';
import accountEn from './assets/screens/account-en.webp';
import accountFa from './assets/screens/account-fa.webp';
import accountKu from './assets/screens/account-ku.webp';
import accountTr from './assets/screens/account-tr.webp';
import { detectLang, LANGS, T } from './translations';
import type { Lang } from './translations';
import { Wordmark } from './Wordmark';

const SCREENS: Record<Lang, { home: string; onboarding: string; account: string }> = {
  en: { home: homeEn, onboarding: onboardingEn, account: accountEn },
  ckb: { home: homeCkb, onboarding: onboardingCkb, account: accountCkb },
  ku: { home: homeKu, onboarding: onboardingKu, account: accountKu },
  ar: { home: homeAr, onboarding: onboardingAr, account: accountAr },
  tr: { home: homeTr, onboarding: onboardingTr, account: accountTr },
  fa: { home: homeFa, onboarding: onboardingFa, account: accountFa },
};

const AppleIcon = () => (
  <svg width="25" height="25" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.05 12.54c-.03-2.36 1.93-3.49 2.02-3.55-1.1-1.61-2.81-1.83-3.42-1.85-1.45-.15-2.84.86-3.57.86-.74 0-1.88-.84-3.09-.82-1.59.02-3.06.93-3.88 2.35-1.65 2.87-.42 7.12 1.19 9.45.79 1.14 1.73 2.42 2.96 2.38 1.19-.05 1.64-.77 3.08-.77s1.84.77 3.1.74c1.28-.02 2.09-1.16 2.87-2.31.9-1.32 1.28-2.6 1.3-2.67-.03-.01-2.5-.96-2.56-3.81zM14.7 5.6c.66-.8 1.1-1.9.98-3-.94.04-2.09.63-2.77 1.42-.61.7-1.14 1.83-1 2.9 1.06.08 2.13-.53 2.79-1.32z" />
  </svg>
);

const PlayIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4.3 2.5a1.6 1.6 0 0 0-.8 1.4v16.2a1.6 1.6 0 0 0 .8 1.4l9-9.5-9-9.5Z" fill="#00D3FF" />
    <path d="m16.7 9.9-3.4 3.6 3.4 3.6 3.9-2.2c1.1-.63 1.1-2.17 0-2.8l-3.9-2.2Z" fill="#FFC400" />
    <path d="M4.3 2.5 13.3 12l3.4-3.6-10.5-6a1.63 1.63 0 0 0-1.9.1Z" fill="#00E58F" />
    <path d="m4.3 21.5 9-9.5 3.4 3.6-10.5 6a1.63 1.63 0 0 1-1.9-.1Z" fill="#FF4D67" />
  </svg>
);

const GlobeIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.3 2.5 3.5 5.5 3.5 9S14.3 18.5 12 21M12 3C9.7 5.5 8.5 8.5 8.5 12s1.2 6.5 3.5 9" />
  </svg>
);

const SunIcon = () => (
  <svg className="sun-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="3.7" fill="currentColor" />
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M12 2.2v2.2M12 19.6v2.2M2.2 12h2.2M19.6 12h2.2M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M18.9 5.1l-1.6 1.6M6.7 17.3l-1.6 1.6" />
    </g>
  </svg>
);

const ArrowIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M5 12h14m-5-5 5 5-5 5" />
  </svg>
);

function StoreButton({ store, icon, comingSoon }: { store: string; icon: React.ReactNode; comingSoon: string }) {
  return (
    <div className="store-button" aria-label={`${store} — ${comingSoon}`}>
      {icon}
      <span>
        <small>{comingSoon}</small>
        <strong dir="ltr">{store}</strong>
      </span>
    </div>
  );
}

function Device({ screen, className, label, eager = false }: { screen: string; className: string; label: string; eager?: boolean }) {
  return (
    <div className={`device ${className}`}>
      <div className="device-speaker" />
      <img src={screen} alt={label} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'} />
    </div>
  );
}

export default function App() {
  const [lang, setLang] = useState<Lang>(() => detectLang());
  const [activeMobileScreen, setActiveMobileScreen] = useState(0);
  const mobileTrackRef = useRef<HTMLDivElement>(null);
  const t = T[lang];
  const meta = LANGS[lang];
  const screens = SCREENS[lang];
  const mobileScreens = [
    { key: 'home', screen: screens.home, label: `hemû marketplace home screen — ${meta.name}` },
    { key: 'onboarding', screen: screens.onboarding, label: `hemû onboarding screen — ${meta.name}` },
    { key: 'account', screen: screens.account, label: `hemû account screen — ${meta.name}` },
  ];

  useEffect(() => {
    document.documentElement.lang = meta.tag;
    document.documentElement.dir = meta.dir;
    document.title = `hemû — ${t.headline}`;
    localStorage.setItem('hemu-lang', lang);
    setActiveMobileScreen(0);
    mobileTrackRef.current?.scrollTo({ left: 0 });
  }, [lang, meta, t]);

  const showMobileScreen = (index: number) => {
    const track = mobileTrackRef.current;
    if (!track) return;
    setActiveMobileScreen(index);
    track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' });
  };

  const updateMobileScreen = () => {
    const track = mobileTrackRef.current;
    if (!track || !track.clientWidth) return;
    const index = Math.max(0, Math.min(mobileScreens.length - 1, Math.round(track.scrollLeft / track.clientWidth)));
    setActiveMobileScreen(index);
  };

  return (
    <div className="page">
      <main>
        <section className="hero">
          <img className="hero-landscape" src={landscape} alt="" aria-hidden="true" fetchPriority="high" />
          <div className="hero-wash" />

          <header className="nav content-wide">
            <a className="brand" href="#top" aria-label="hemû">
              <Wordmark size={29} ink="#fff" accent="var(--accent)" />
            </a>
            <div className="nav-note">
              <SunIcon />
              {t.madeFor}
            </div>
            <label className="language-control">
              <GlobeIcon />
              <span className="sr-only">{t.languageLabel}</span>
              <select value={lang} aria-label={t.languageLabel} onChange={(event) => setLang(event.target.value as Lang)}>
                {(Object.keys(LANGS) as Lang[]).map((key) => (
                  <option key={key} value={key}>{LANGS[key].name}</option>
                ))}
              </select>
            </label>
          </header>

          <div className="hero-grid content-wide" id="top">
            <div className="hero-copy">
              <div className="launch-pill"><span />{t.comingSoon}</div>
              <h1>{t.headline}</h1>
              <p className="hero-subtitle">{t.subheadline}</p>
              <div className="desktop-downloads">
                <div className="store-buttons">
                  <StoreButton store="App Store" icon={<AppleIcon />} comingSoon={t.comingSoon} />
                  <StoreButton store="Google Play" icon={<PlayIcon />} comingSoon={t.comingSoon} />
                </div>
                <p className="availability">{t.downloadHint}</p>
              </div>
            </div>

            <div className="product-stage" aria-label="hemû app preview">
              <div className="stage-halo" />
              <Device screen={screens.onboarding} className="device-back device-welcome" label={`hemû onboarding screen — ${meta.name}`} />
              <Device screen={screens.account} className="device-back device-post" label={`hemû account screen — ${meta.name}`} />
              <Device screen={screens.home} className="device-main" label={`hemû marketplace home screen — ${meta.name}`} eager />
              <div className="floating-card">
                <span className="floating-icon"><ArrowIcon /></span>
                <span><small>{t.features[2].title}</small><strong>{t.features[2].body}</strong></span>
              </div>
            </div>

            <div className="mobile-showcase" aria-label="hemû app preview">
              <div ref={mobileTrackRef} className="mobile-track" onScroll={updateMobileScreen}>
                {mobileScreens.map((item, index) => (
                  <div className="mobile-slide" key={item.key} aria-hidden={activeMobileScreen !== index}>
                    <Device screen={item.screen} className="mobile-device" label={item.label} eager={index === 0} />
                  </div>
                ))}
              </div>
              <div className="mobile-pagination" role="tablist" aria-label="App screens">
                {mobileScreens.map((item, index) => (
                  <button
                    type="button"
                    role="tab"
                    key={item.key}
                    className={activeMobileScreen === index ? 'is-active' : ''}
                    aria-selected={activeMobileScreen === index}
                    aria-label={`${item.key} screen`}
                    onClick={() => showMobileScreen(index)}
                  />
                ))}
              </div>
            </div>

            <div className="mobile-downloads">
              <div className="store-buttons">
                <StoreButton store="App Store" icon={<AppleIcon />} comingSoon={t.comingSoon} />
                <StoreButton store="Google Play" icon={<PlayIcon />} comingSoon={t.comingSoon} />
              </div>
            </div>
          </div>

          <footer className="hero-footer">
            <div className="content-wide footer-inner">
              <Wordmark size={20} ink="#fff" />
              <div><a href="mailto:hello@hemu.krd">{t.contact}</a><span>© 2026 hemû</span></div>
            </div>
          </footer>
        </section>

      </main>
    </div>
  );
}
