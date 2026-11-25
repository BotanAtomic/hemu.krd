import './styles.css';
import { PIECES } from './pieces';
import { LANGS, T, pageLang } from './translations';
import type { Lang } from './translations';

// Hashed URLs of every language's screens; the Sorani Home screen is also named
// directly in index.html so the browser can fetch it before this module runs.
const screenUrls = import.meta.glob<string>('./assets/screens/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});
const screenUrl = (name: string, lang: Lang) => screenUrls[`./assets/screens/${name}-${lang}.webp`];

// How a screen arrives: pushed from the side, rising as a sheet or as the camera, or at once, as a tab does.
type Kind = 'modal' | 'sheet' | 'push' | 'tab';
type Tone = 'canvas' | 'orange' | 'tint' | 'night';
interface Step {
  /** the app screen: src/assets/screens/<name>-<language>.webp, with its lifting parts in src/pieces.ts */
  name: string;
  /** its caption: the store headline it shares, T[lang].steps[at - 1] in src/translations.ts (0: the page's headline) */
  at: number;
  tone: Tone;
  kind?: Kind;
  /** the step whose screen this one is shown over, as the app would */
  over?: number;
  /** Where the part that moves begins, in % of the screen height: under the status bar, or the top of the sheet. A
   *  screen that covers everything (the camera) moves whole. */
  cut?: number;
}
// The tour is one visit to the app, so that every screen arrives the way it would on a phone: the city sheet rises
// over Home (its picture is drawn over Home), then the filter sheet; applying it opens the search results, with the
// alert for that saved search; the grey Audi there opens, then the chat with its seller, then his profile, and the
// camera covers everything.
const STEPS: Step[] = [
  { name: '01-home', at: 0, tone: 'canvas' },
  { name: '08-cities', at: 7, kind: 'sheet', over: 0, tone: 'canvas', cut: 7.7 },
  { name: '03-filters', at: 2, kind: 'sheet', over: 0, tone: 'canvas', cut: 7.5 },
  { name: '09-results', at: 5, kind: 'tab', tone: 'canvas', cut: 5.9 },
  { name: '05-listing', at: 4, kind: 'push', over: 3, tone: 'canvas', cut: 5.9 },
  { name: '10-chat', at: 3, kind: 'push', over: 4, tone: 'canvas', cut: 5.9 },
  { name: '11-seller', at: 6, kind: 'push', over: 5, tone: 'canvas', cut: 5.9 },
  { name: '02-sell', at: 1, kind: 'modal', over: 6, tone: 'canvas' },
];
// The English city sheet starts lower than the others.
const cutFor = (step: Step, lang: Lang) => (step.name === '08-cities' && lang === 'en' ? 11.7 : step.cut);
// the screens on the phone at step i, from the bottom up: those it is shown over, then its own
const stackOf = (i: number): number[] => (i < 0 ? [] : [...stackOf(STEPS[i].over ?? -1), i]);
const N = STEPS.length;
const stacks = STEPS.map((_, i) => stackOf(i));
// Without resting places (a wheel or a trackpad), a scroll left to itself runs on for this many seconds' worth of its
// speed before it stops: momentum loses 0.2 % of its speed every millisecond. The speed read in frame() runs a little
// late, which leaves a small margin.
const COAST = 0.5;
// The ground of each tone, as numbers so that two of them can be mixed. The first is --canvas in the style sheet,
// which paints the page before this script runs; the second is --orange.
const GROUND: Record<Tone, number[]> = {
  canvas: [245, 244, 241],
  orange: [243, 124, 32],
  tint: [253, 238, 224],
  night: [20, 19, 18],
};

// The phone's pose at rest in each step: [tilt back, turn, roll (degrees), drop (% of its height), scale].
// It stays turned the same way and moves little, so the eye stays on the screen. On a phone it waits low and facing
// front under the first screen's words, its top showing, and rises when the tour starts.
type Pose = [number, number, number, number, number];
const KEY = [0, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8];
const NARROW: Pose[] = [[6, 0, 0, 62, 1], [10, -10, 2, 0, 1], [8, -7, 1, 0, 1], [11, -11, 2, 0, 1], [8, -8, 1, 0, 1], [10, -10, 2, 0, 1], [8, -7, 1, 0, 1], [10, -10, 2, 0, 1], [8, -6, 1, 0, 1]];
const WIDE: Pose[] = [[10, -16, 2, 0, 1], [8, -12, -1, 0, 1], [11, -15, 2, 0, 1], [7, -11, -1, 0, 1], [10, -15, 2, 0, 1], [9, -12, -1, 0, 1], [8, -15, 2, 0, 1], [10, -12, -1, 0, 1], [8, -10, 0, 0, 1]];
const STILL: Pose = [8, -14, 2, 0, 1];
// Frame colour (titanium) and how strongly it catches the light.
const METAL = [196, 189, 178];
const SPEC = 0.5;

const root = document.documentElement;
const $ = <E extends Element = HTMLElement>(selector: string) => document.querySelector<E>(selector)!;
const backdrop = $('#backdrop');
const wash = $('#wash');
const tour = $('#tour');
const stage = $('.stage');
const area = $('#area');
const rig = $('#rig');
const phone = $('#phone');
const above = $('#above');
const gloss = $('#gloss');
const sheen = $('#sheen');
const rimA = $('#rimA');
const rimB = $('#rimB');
const outro = $('#get');
const veil = $('#veil');
const edge = $('#edge');
const screen = $('#screen');
const floor = $('#floor');
const piecesEl = $('#pieces');
const captions = $('#captions');
const select = $<HTMLSelectElement>('#language');

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wideMq = window.matchMedia('(min-width:860px), (orientation:landscape) and (min-width:600px)');
// a touch screen: the page rests on each step (see rests and styles.css)
const resting = window.matchMedia('(pointer:coarse)');
// Chromium chooses the resolution of each surface in a 3D scene by rounding how large it currently looks. Two surfaces
// side by side can therefore come out at different sharpness, and one can snap sharper or softer while the phone turns
// (seen as a flicker on small detailed things like the camera thumbnails). Building the phone twice as large and scaling
// it back down makes every surface come out at the same, full resolution, and supersamples it as a bonus. It costs four
// times the picture memory, so it is used where that is plentiful and the softness shows most: Chromium with a mouse.
const chromium = 'chrome' in window || /\bChrom(e|ium)\//.test(navigator.userAgent);
const SS = chromium && window.matchMedia('(hover:hover) and (pointer:fine)').matches ? 2 : 1;
rig.style.setProperty('--ss', String(SS));

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ----- the parts that only exist while scrolling: captions and screens 2 to 8 -----
const caps = [$('.cap')];
const shots = [$('.s')];
STEPS.forEach((step, i) => {
  if (i === 0) return;
  const cap = document.createElement('section');
  cap.className = 'cap';
  cap.dataset.tone = step.tone;
  cap.setAttribute('aria-hidden', 'true');
  cap.innerHTML = '<h2></h2><p class="body"></p>';
  captions.appendChild(cap);
  caps.push(cap);
  const shot = document.createElement('div');
  shot.className = 's';
  shot.dataset.kind = step.kind;
  shot.innerHTML =
    '<img class="st" width="780" height="1692" alt="" decoding="async"><img class="bd" width="780" height="1692" alt="" decoding="async">';
  screen.appendChild(shot);
  shots.push(shot);
});

// ----- where the page comes to rest (touch screens) -----
// One resting place per step (placed in measure()), and the end of the page. The browser always brings the page to rest
// on one of them and never passes one by: a swipe moves exactly one step, which then plays out in full. No swipe that
// only half-moves, no steps skipped by a fling.
const rests = STEPS.map(() => {
  const rest = document.createElement('i');
  rest.className = 'rest';
  tour.appendChild(rest);
  return rest;
});

// ----- the phone body: a frame with thickness, built from flat faces around the rounded outline -----
interface Face {
  light: HTMLElement;
  nx: number;
  ny: number;
  shown: number;
}
const faces: Face[] = [];
let pw = 230;
let ph = 480;
function buildBody() {
  const W = phone.offsetWidth;
  const H = phone.offsetHeight;
  // Phones fire resize whenever the address bar slides away: rebuild only when the phone really changed size.
  if (!W || !H || (W === pw && H === ph && faces.length)) return;
  pw = W;
  ph = H;
  const R = W * 0.162;
  const thick = Math.max(10, Math.round(W * 0.078));
  rig.style.setProperty('--pw', `${W}px`);
  rig.style.setProperty('--pt', `${thick}px`);
  piecesEl.style.setProperty('--sw', `${(W * 0.938).toFixed(1)}px`);
  rig.style.perspective = `${Math.round(W * 4.7)}px`;
  edge.textContent = '';
  faces.length = 0;
  const add = (px: number, py: number, phi: number, len: number, height: number, button = false) => {
    const el = document.createElement('i');
    const rad = (phi * Math.PI) / 180;
    const nx = Math.cos(rad);
    const ny = Math.sin(rad);
    // how much this face looks at the light (top, a little left)
    const lit = Math.pow(0.5 + 0.5 * (nx * -0.34 + ny * -0.94), 1.25);
    const q = (button ? 0.62 : 0.42) + 0.58 * lit;
    const out = button ? 1.4 * SS : 0;
    el.style.cssText =
      `width:${len.toFixed(2)}px;height:${height}px;margin:${-height / 2}px 0 0 ${(-len / 2).toFixed(2)}px;` +
      `background:linear-gradient(to top,rgba(255,255,255,${(0.1 + 0.24 * lit).toFixed(2)}),rgba(255,255,255,0) 22%,rgba(0,0,0,0) 74%,rgba(0,0,0,.42)),rgb(${METAL.map((v) => Math.round(v * q)).join(',')});` +
      (button ? `border-radius:${2 * SS}px;` : '') +
      `transform:translate3d(${(px + nx * out).toFixed(2)}px,${(py + ny * out).toFixed(2)}px,${-thick / 2}px) rotateZ(${(phi + 90).toFixed(2)}deg) rotateX(90deg)`;
    const light = document.createElement('u');
    el.appendChild(light);
    faces.push({ light, nx, ny, shown: -1 });
    edge.appendChild(el);
  };
  add(W / 2, 0, -90, W - 2 * R + 1, thick);
  add(W, H / 2, 0, H - 2 * R + 1, thick);
  add(W / 2, H, 90, W - 2 * R + 1, thick);
  add(0, H / 2, 180, H - 2 * R + 1, thick);
  const n = 6;
  const turn = 90 / n;
  const len = 2 * R * Math.tan(((turn / 2) * Math.PI) / 180) * 1.08;
  const corners = [[W - R, R, -90], [W - R, H - R, 0], [R, H - R, 90], [R, R, 180]];
  for (const [cx, cy, from] of corners) {
    for (let i = 0; i < n; i++) {
      const phi = from + (i + 0.5) * turn;
      const r = (phi * Math.PI) / 180;
      add(cx + R * Math.cos(r), cy + R * Math.sin(r), phi, len, thick);
    }
  }
  const bh = Math.round(thick * 0.44);
  add(W, H * 0.335, 0, H * 0.1, bh, true); // side button
  add(0, H * 0.215, 180, H * 0.034, bh, true); // action button
  add(0, H * 0.305, 180, H * 0.066, bh, true); // volume up
  add(0, H * 0.39, 180, H * 0.066, bh, true); // volume down
}

// ----- the pieces that lift -----
interface Item {
  lift: number;
  hole: HTMLElement;
  shade: HTMLElement;
  top: HTMLElement;
}
interface Group {
  el: HTMLElement;
  items: Item[];
  last: number;
  armed: boolean;
  armedAt: number;
  readyAt: number;
}
let groups: Group[] = [];
let shown = -1; // the step on show: its screen, caption and ground
let keep: number[] = []; // the screens that stay drawn (see show())
let ended = false;
let tidy = 0;
let side = 1;
let lang: Lang = pageLang();

// ----- screens, downloaded in the order they are needed -----
// The language's first screen comes first and alone, then each next one when the one before it has arrived: the first
// screen does not share the connection with seven others, and the next one is in before the first swipe. A step put on
// show before its turn jumps the queue. ready[i] settles once screen i is downloaded and decoded.
let ready: Promise<void>[] = [];
const settle: (() => void)[] = [];
let asked: boolean[] = [];
function ask(i: number) {
  if (i < 0 || i >= N || asked[i]) return;
  asked[i] = true;
  const src = screenUrl(STEPS[i].name, lang);
  const imgs = [...shots[i].querySelectorAll('img')];
  for (const img of imgs) {
    img.setAttribute('fetchpriority', i === Math.max(0, shown) ? 'high' : 'low');
    if (img.getAttribute('src') !== src) img.src = src;
  }
  const done = settle[i];
  const next = () => {
    done();
    // unless a change of language has started a queue of its own since
    if (settle[i] === done) ask(asked.indexOf(false));
  };
  imgs[imgs.length - 1].decode().then(next, next);
}
function loadScreens() {
  ready = shots.map((_, i) => new Promise<void>((resolve) => (settle[i] = resolve)));
  asked = shots.map(() => false);
  ask(Math.max(0, shown));
}

function buildPieces() {
  piecesEl.textContent = '';
  groups = STEPS.map((at, step) => {
    const list = PIECES[lang][at.name] ?? [];
    const el = document.createElement('div');
    el.className = 'grp';
    const url = screenUrl(at.name, lang);
    const part = (v: number) => `calc(var(--sw) * ${(v / 100).toFixed(5)})`;
    const items = list.map(([x, y, w, h, r, lift, colour, margin, feather, down]) => {
      const pc = document.createElement('div');
      pc.className = 'pc';
      pc.style.cssText = `left:${x}%;top:${y}%;width:${w}%;height:${h}%;--r:${(r / 100).toFixed(4)}`;
      const hole = document.createElement('b');
      const shade = document.createElement('b');
      const top = document.createElement('b');
      hole.className = 'hole';
      shade.className = 'shade';
      top.className = 'lift';
      hole.style.cssText =
        `inset:${part(-margin)};border-radius:${part(r + margin)};background:${colour}` +
        (feather ? `;box-shadow:0 0 ${part(feather)} ${part(feather / 2)} ${colour},0 ${part(down * 0.55)} ${part(down * 0.5)} 0 ${colour}` : '');
      top.style.backgroundImage = `url(${url})`;
      top.style.backgroundSize = `${(10000 / w).toFixed(2)}% ${(10000 / h).toFixed(2)}%`;
      top.style.backgroundPosition = `${((x / (100 - w)) * 100).toFixed(3)}% ${((y / (100 - h)) * 100).toFixed(3)}%`;
      pc.append(hole, shade, top);
      el.appendChild(pc);
      return { lift, hole, shade, top };
    });
    piecesEl.appendChild(el);
    const group: Group = { el, items, last: -1, armed: false, armedAt: 0, readyAt: list.length ? -1 : 0 };
    if (list.length) {
      // the copies draw the same picture as the screen: they wait until it is downloaded and decoded
      ready[step].then(() => {
        group.readyAt = performance.now();
        kick();
      });
    }
    return group;
  });
  if (shown > -1) groups[shown].el.classList.add('on');
}

// ----- language -----
// A price inside right-to-left text keeps its "$" on the left.
const isolate = (text: string) => text.replace(/\$[\d,]+/g, '⁦$&⁩');
function applyLang() {
  const t = T[lang];
  const meta = LANGS[lang];
  root.lang = meta.tag;
  root.dir = meta.dir;
  root.dataset.lang = lang;
  side = meta.dir === 'rtl' ? -1 : 1;
  document.title = `hemû — ${t.headline}`;
  const text: Record<string, string> = {
    headline: t.headline,
    subheadline: t.subheadline,
    availableNow: t.availableNow,
    downloadHint: t.downloadHint,
    languageLabel: t.languageLabel,
    contact: t.contact,
  };
  for (const node of document.querySelectorAll<HTMLElement>('[data-t]')) node.textContent = text[node.dataset.t!];
  caps.forEach((cap, i) => {
    if (i === 0) return;
    cap.children[0].textContent = t.steps[STEPS[i].at - 1].title;
    cap.children[1].textContent = t.steps[STEPS[i].at - 1].body;
  });
  $('#alertTitle').textContent = isolate(t.alert.title);
  $('#alertBody').textContent = t.alert.body;
  $('#alertTime').textContent = t.alert.time;
  select.value = lang;
  $('#languageName').textContent = meta.name;
  select.setAttribute('aria-label', t.languageLabel);
  for (const store of document.querySelectorAll<HTMLElement>('[data-store]')) {
    store.setAttribute('aria-label', `${store.dataset.store} — ${t.availableNow}`);
  }
  shots.forEach((shot, i) => {
    const cut = cutFor(STEPS[i], lang);
    if (cut) shot.style.setProperty('--cutn', String(cut));
    shot.querySelector<HTMLImageElement>('.bd')!.alt = `hemû — ${i ? t.steps[STEPS[i].at - 1].title : t.headline}`;
  });
  loadScreens();
  buildPieces();
  root.classList.remove('lang-pending');
}
select.addEventListener('change', () => {
  lang = select.value as Lang;
  try {
    localStorage.setItem('hemu-lang', lang);
  } catch {
    // Private mode: the choice just will not be remembered.
  }
  applyLang();
  measure();
  kick();
});

// ----- the ground -----
// It takes the new colour at once, under a second sheet that holds what was on screen and fades away. Only that
// opacity moves, and the browser fades it without repainting anything.
let tone: Tone = 'canvas';
let held = GROUND.canvas; // the colour that is fading away
function setTone(next: Tone, fade: boolean) {
  if (next === tone) return;
  if (fade) {
    // what is on screen at this instant: the ground, with whatever is left of the one before still over it
    const left = parseFloat(getComputedStyle(wash).opacity) || 0;
    held = GROUND[tone].map((v, k) => Math.round(v + (held[k] - v) * left));
    wash.style.transition = 'none';
    wash.style.backgroundColor = `rgb(${held})`;
    wash.style.opacity = '1';
  }
  tone = next;
  stage.dataset.tone = next;
  backdrop.style.backgroundColor = `rgb(${GROUND[next]})`;
  if (fade) {
    void getComputedStyle(wash).opacity; // the fade starts from here
    wash.style.transition = '';
    wash.style.opacity = '0';
  }
}

// ----- scroll -> step, pose, lift -----
let start = 0;
let range = 1;
let cover = 1;
let raf = 0;
let last = 0;
let lastY = 0;
let speed = 0; // how fast the page is scrolling, in steps per second (down is positive)
let eager = 0; // until when a click on the phone lets the next step come on show at any speed
let stepAt = -1e6;
let intro = !reduced;
let mx = 0;
let my = 0;
let room: number[] = [];
let sheetRadius = -1;
let moved = false;
// where the phone comes from: on a phone it rises from below the first screen, elsewhere it swings in
const cur: Pose = reduced ? [...STILL] : wideMq.matches ? [30, -62, 9, 9, 0.84] : [8, 0, 0, 110, 1];
// while the opening card is up (index.html .splash) the phone waits where it comes from
let holding = root.classList.contains('splashing');
const vel = [0, 0, 0, 0, 0];
// Where the page rests on step i: the top for the first, then the middle of each step, where the phone has turned to
// face the caption.
const restAt = (i: number) => Math.round(start + ((i ? i + 0.5 : 0) / N) * range);
function measure() {
  const stick = parseFloat(getComputedStyle(stage).top) || 0;
  const top = tour.getBoundingClientRect().top + window.scrollY;
  start = top - stick;
  // how far the closing card slides over the stage, and the scrolling left for the eight steps
  cover = Math.max(1, top + tour.offsetHeight - (outro.getBoundingClientRect().top + window.scrollY));
  range = Math.max(1, tour.offsetHeight - stage.offsetHeight - cover);
  rests.forEach((rest, i) => {
    rest.style.top = `${restAt(i) - top}px`;
  });
  // room each caption leaves above the phone: the phone grows into it
  const boxHeight = captions.offsetHeight;
  const beside = wideMq.matches;
  room = caps.map((cap) => {
    const lastLine = cap.lastElementChild as HTMLElement;
    return beside ? 0 : clamp(boxHeight - lastLine.offsetTop - lastLine.offsetHeight - 16, 0, 60);
  });
}
function goTo(i: number) {
  window.scrollTo({ top: restAt(i), behavior: reduced ? 'auto' : 'smooth' });
}
// Puts step i on show: its caption, its screen, its lifting pieces (the ground follows in frame()).
function show(i: number, now: number) {
  const from = shown;
  shown = i;
  // this screen now, and the next one before it is needed (not on the first frame: the first screen comes alone)
  ask(i);
  if (from > -1) ask(i + 1);
  stepAt = now;
  eager = 0;
  if (from > -1) groups[from].el.classList.remove('on');
  groups[i].el.classList.add('on');
  groups[i].last = -1;
  groups[i].armed = false;
  caps.forEach((cap, k) => {
    cap.classList.toggle('is-active', k === i);
    cap.classList.toggle('is-before', k < i);
    cap.classList.toggle('near', Math.abs(k - i) < 2);
    if (k === i) cap.removeAttribute('aria-hidden');
    else cap.setAttribute('aria-hidden', 'true');
  });
  // The phone shows this step's stack of screens. Of those that change, the top one arriving and the top one leaving
  // move, as the app would move them (a sheet closes as the next screen opens); any other comes or goes at once, unseen
  // under them, and so does a tab. The one leaving stays on top until it is gone: the sheet that closes as the search
  // results open goes down over them. On the first frame nothing moves.
  const stack = stacks[i];
  const changing = shots.map((shot, k) => stack.includes(k) !== shot.classList.contains('is-in'));
  const arriving = from < 0 ? -1 : Math.max(-1, ...stack.filter((k) => changing[k]));
  const leaving = from < 0 ? -1 : Math.max(-1, ...shots.map((_, k) => (changing[k] && !stack.includes(k) ? k : -1)));
  const beneath = STEPS[i].over ?? -1;
  // a sheet or the camera closing as a screen is pushed or another sheet opens: that one waits a moment, so it reads
  // as one after the other
  const closing = leaving > -1 && (STEPS[leaving].kind === 'sheet' || STEPS[leaving].kind === 'modal');
  const late = closing && arriving > -1 && (STEPS[arriving].kind === 'push' || STEPS[arriving].kind === 'sheet');
  // one sheet giving way to another over the same screen: the shade over that screen stays as it is
  const swap = late && STEPS[arriving].kind === 'sheet' && STEPS[leaving].kind === 'sheet';
  keep = [...new Set([i, beneath, from, i - 1, STEPS[i - 1]?.over ?? -1, i + 1, STEPS[i + 1]?.over ?? -1])].filter((k) => k > -1 && k < N);
  shots.forEach((shot, k) => {
    // Home and a tab never move: they are there or not
    const moves = !!STEPS[k].kind && STEPS[k].kind !== 'tab';
    shot.classList.toggle('now', changing[k] && (!moves || (k !== arriving && k !== leaving)));
    shot.classList.toggle('late', late && k === arriving);
    shot.classList.toggle('out', moves && k === leaving);
    shot.classList.toggle('swap', swap && (k === arriving || k === leaving));
    shot.classList.toggle('is-in', stack.includes(k));
    // the screen right under a pushed one gives way a little
    shot.classList.toggle('under', k === beneath && STEPS[i].kind === 'push');
    shot.classList.toggle('near', keep.includes(k));
  });
  // Screens covered by the one on show are not drawn at all once it has arrived. Drawn stay this one, the one it is
  // shown over, the one just left, and the screens of the steps before and after, ready to move.
  for (const k of keep) shots[k].classList.remove('off');
  clearTimeout(tidy);
  tidy = window.setTimeout(() => shots.forEach((shot, k) => shot.classList.toggle('off', !keep.includes(k))), 800);
  stage.dataset.step = String(i);
  stage.dataset.screen = STEPS[i].name;
}
function poseAt(p: number): Pose {
  const set = wideMq.matches ? WIDE : NARROW;
  let j = 0;
  while (j < KEY.length - 2 && p > KEY[j + 1]) j++;
  const t = smooth(KEY[j], KEY[j + 1], p);
  return set[j].map((v, k) => v + (set[j + 1][k] - v) * t) as Pose;
}
// how far the pieces of step k are lifted at scroll position p (0 … 1): up in the middle of the step, flat at both ends
const liftAt = (k: number, p: number) =>
  k === 0 ? 1 - smooth(0.22, 0.7, p) : smooth(k + 0.1, k + 0.42, p) * (1 - smooth(k + 0.6, k + 0.9, p));

function frame(now: number) {
  raf = 0;
  const first = shown < 0;
  const y = window.scrollY - start;
  if (!last) speed = 0; // the page was at rest
  if (first) lastY = y;
  const dt = Math.min(64, last ? now - last : 16);
  last = now;
  const p = clamp(y / range, 0, 1) * N;
  const c = clamp((y - range) / cover, 0, 1); // 0 … 1 while the closing card slides over the stage
  // scroll speed over about the last sixteenth of a second. One frame cannot count for more than eight steps per
  // second, so a jump straight to another place in the page does not pass for a long fast scroll.
  speed += (clamp(((y - lastY) / dt / (range / N)) * 1000, -8, 8) - speed) * (1 - Math.exp(-dt / 60));
  lastY = y;
  // On a touch screen the page rests on steps, so a swipe crosses one step, half-way through its move: it comes on
  // show at once. Elsewhere a step comes on show once the scroll is in it and is going to stop in it: a page flung
  // through several steps shows the one it lands on, in a single change, and nothing of what it passed on the way.
  const step = Math.min(N - 1, Math.floor(p + 1e-4));
  const landing = clamp(Math.floor(p + speed * COAST + 1e-4), 0, N - 1);
  if (step !== shown && (first || resting.matches || landing === step || now < eager)) show(step, now);
  const waiting = step !== shown;
  // when the closing card is nearly up, what is left of the stage joins it
  setTone(c > 0.9 ? 'orange' : STEPS[shown].tone, !reduced && !first);
  // past the end of the page, pulling shows the page's own background: orange under the closing card
  const end = c > 0.5;
  if (end !== ended) {
    ended = end;
    root.style.backgroundColor = end ? `rgb(${GROUND.orange})` : '';
  }
  const scrolled = window.scrollY > 24;
  if (scrolled !== moved) {
    moved = scrolled;
    if (scrolled) root.dataset.moved = '1';
    else delete root.dataset.moved;
  }

  // pose: a spring, slightly under-damped, so the phone arrives at each pose with a little life. Once arrived, nothing
  // moves and nothing is drawn again until the next scroll.
  const tgt: Pose = reduced ? [...STILL] : poseAt(p);
  tgt[1] *= side;
  tgt[2] *= side;
  if (!reduced) {
    tgt[1] += mx * 10; // the phone leans toward the pointer
    tgt[0] -= my * 7;
    tgt[0] += 15 * c; // and sinks back as the card covers it
    tgt[3] += 4 * c;
    tgt[4] *= 1 - 0.1 * c;
  }
  const grow = room[shown] || 0;
  tgt[4] *= 1 + (grow * SS) / ph;
  tgt[3] -= ((grow * SS) / 2 / ph) * 100;
  const stiff = intro ? 45 : 260;
  const damp = intro ? 13 : 30;
  const h = dt / 2000;
  let d = 0;
  for (let i = 0; i < 5; i++) {
    if (reduced) {
      cur[i] = tgt[i];
      continue;
    }
    if (holding) continue;
    for (let n = 0; n < 2; n++) {
      vel[i] += (stiff * (tgt[i] - cur[i]) - damp * vel[i]) * h;
      cur[i] += vel[i] * h;
    }
    d += (Math.abs(tgt[i] - cur[i]) + Math.abs(vel[i]) * 0.06) * (i === 4 ? 100 : 1);
  }
  if (intro && !holding && d < 0.8) intro = false;
  const transform = `translate3d(0,${((cur[3] / 100) * ph).toFixed(1)}px,0) rotateX(${cur[0].toFixed(2)}deg) rotateY(${cur[1].toFixed(2)}deg) rotateZ(${cur[2].toFixed(2)}deg) scale(${cur[4].toFixed(4)})`;
  phone.style.transform = transform;
  above.style.transform = transform;
  gloss.style.transform = transform;

  // light: from the upper left, in front. Each frame face brightens as it turns toward it or toward the viewer.
  const ra = cur[0] * 0.01745;
  const rb = cur[1] * 0.01745;
  const rc = cur[2] * 0.01745;
  const ca = Math.cos(ra);
  const sa = Math.sin(ra);
  const cb = Math.cos(rb);
  const sb = Math.sin(rb);
  const cc = Math.cos(rc);
  const sc = Math.sin(rc);
  for (const face of faces) {
    const x1 = face.nx * cc - face.ny * sc;
    const y1 = face.nx * sc + face.ny * cc;
    const x2 = x1 * cb;
    const z2 = -x1 * sb;
    const y3 = y1 * ca - z2 * sa;
    const z3 = Math.max(0, y1 * sa + z2 * ca);
    const diffuse = Math.max(0, x2 * -0.4 + y3 * -0.72 + z3 * 0.57);
    const shown = Math.round(clamp((0.04 + 0.42 * diffuse + 1.5 * z3 * z3 + 0.5 * z3) * SPEC, 0, 0.92) * 50) / 50;
    if (shown !== face.shown) {
      face.shown = shown;
      face.light.style.opacity = String(shown);
    }
  }
  rimA.style.opacity = clamp(0.5 - cur[1] / 44, 0, 1).toFixed(2);
  rimB.style.opacity = clamp(0.22 + cur[1] / 44, 0, 1).toFixed(2);
  // the band moves as a band three screens wide did before, in units of its own size, and keeps its 14° tilt
  sheen.style.transform = `translate3d(${((-cur[1] * 1.7 - cur[2]) * 2.2377).toFixed(2)}%,${(cur[0] * 0.65625).toFixed(2)}%,0) rotate(14deg)`;
  veil.style.opacity = (c * 0.34).toFixed(3);
  const radius = Math.round(28 * (1 - smooth(0.8, 1, c)));
  if (radius !== sheetRadius) {
    sheetRadius = radius;
    outro.style.setProperty('--sheet-r', `${radius}px`);
  }
  floor.style.transform = `translate3d(${(-cur[1] * 0.9 * SS).toFixed(1)}px,0,0) scale(${(1 - Math.abs(cur[1]) / 150).toFixed(3)},${(1 - cur[0] / 90).toFixed(3)})`;

  // lift. A copy of each element lies exactly over it, drawn from the start at an opacity nobody can see, so its
  // picture is ready. The move then has three parts, in this order (and in reverse on the way back):
  //   1. the copy fades in, still lying flat on the element;  2. under the opaque copy the element is erased;
  //   3. the copy rises. The element is on screen and in one piece at every moment, so nothing dims, doubles or blinks.
  const group = groups[shown];
  const since = now - stepAt;
  const armed = !reduced && !intro && since >= 600 && group.readyAt >= 0 && now - group.readyAt >= 150;
  if (armed && !group.armed) group.armedAt = now;
  const lifted = armed ? liftAt(shown, p) * smooth(120, 500, now - group.armedAt) : 0;
  if (armed !== group.armed || Math.abs(lifted - group.last) > 0.002) {
    group.armed = armed;
    group.last = lifted;
    for (const item of group.items) {
      const z = item.lift * pw * clamp((lifted - 0.1) / 0.9, 0, 1);
      item.top.style.opacity = Math.max(0.004, smooth(0, 0.05, lifted)).toFixed(3);
      item.hole.style.opacity = smooth(0.05, 0.1, lifted).toFixed(3);
      item.top.style.transform = `translateZ(${(0.35 + z).toFixed(2)}px)`;
      item.shade.style.transform = `translate3d(0,${(z * 0.3).toFixed(1)}px,.2px)`;
      item.shade.style.opacity = smooth(0.12, 0.6, lifted).toFixed(3);
    }
  }
  if (document.hidden) {
    last = 0;
    return;
  }
  const settling = (armed && now - group.armedAt < 550) || (!armed && group.readyAt >= 0 && now - group.readyAt < 200);
  if (!holding && (intro || d > 0.03 || since < 650 || settling || waiting)) kick();
  else last = 0;
}
function kick() {
  if (!raf) raf = requestAnimationFrame(frame);
}

// A press you can feel. A finger also lands on the phone just to scroll the page: on a touch screen only a tap presses.
const press = () => {
  vel[4] -= 0.55;
  vel[0] += 26;
  kick();
};
phone.addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'touch') press();
});
phone.addEventListener('pointerup', (event) => {
  if (event.pointerType === 'touch') press();
});
phone.addEventListener('click', () => {
  if (shown < N - 1) {
    eager = performance.now() + 1500;
    goTo(shown + 1);
  } else outro.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
});
window.addEventListener('scroll', kick, { passive: true });
if (!reduced && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
  stage.addEventListener(
    'pointermove',
    (event) => {
      const box = stage.getBoundingClientRect();
      mx = (event.clientX - box.left) / box.width - 0.5;
      my = (event.clientY - box.top) / box.height - 0.5;
      kick();
    },
    { passive: true },
  );
  stage.addEventListener('pointerleave', () => {
    mx = my = 0;
    kick();
  });
}
const refit = () => {
  measure();
  buildBody();
  if (shown > -1) groups[shown].last = -1;
  kick();
};
window.addEventListener('resize', refit);
window.addEventListener('load', refit);
new ResizeObserver(refit).observe(area);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) kick();
});

// The phone shows the outline of the Home screen (index.html, .screen.wait) until the visitor's own Home screen is
// downloaded and decoded; in another language than Soranî that is not the one index.html names, so nothing is swapped.
applyLang();
measure();
root.classList.add('steps');
buildBody();
cur[1] *= side;
cur[2] *= side;
frame(performance.now());
ready[shown].then(() => screen.classList.remove('wait'));

// ----- the opening (index.html .splash, put up by /lang.js) -----
// The wordmark fills in while the first screen and, for left-to-right text, the headline's font arrive: at most four
// seconds, and at least 0.7 s from the start so that the fill is seen. Then it fills up, the card fades away, and the
// first screen comes in under it: the words rise, the listings settle and the phone comes up.
if (holding) {
  root.classList.add('entering');
  const after = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  const font = root.dir === 'ltr' && document.fonts ? document.fonts.load('700 1em Unbounded').catch(() => []) : [];
  Promise.race([Promise.all([ready[shown], font]), after(4000)])
    .then(() => after(reduced ? 0 : Math.max(0, 700 - performance.now())))
    .then(() => {
      const fill = document.getElementById('spFill');
      if (!fill || reduced) return undefined;
      // from wherever the fill has got to
      fill.style.clipPath = getComputedStyle(fill).clipPath;
      fill.style.animation = 'none';
      void fill.getBoundingClientRect();
      fill.style.transition = 'clip-path .28s ease-out';
      fill.style.clipPath = 'inset(0 0 0 0)';
      return after(330);
    })
    .then(() => {
      root.classList.remove('splashing', 'entering');
      holding = false;
      kick();
    });
}
