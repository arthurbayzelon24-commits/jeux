import { EFFECTS, CATEGORIES, getEffect } from './effects.js';
import { Engine } from './engine.js';
import { Tracker } from './tracker.js';
import { SoundFx } from './audio.js';
import { CanvasRecorder, extensionFor, cropRect } from './recorder.js';
import { gallery, videoThumbnail } from './gallery.js';
import { quality } from './fx/util.js';
import { MESH_POINTS } from './handmesh.js';
import { Secrets } from './mech/secrets.js';
import { FREE_MOVES } from './fx/free.js';
import { Progress } from './progress.js';
import { Music, TRACKS } from './music.js';
import { makeDual } from './dual.js';
import { SPELLS } from './fx/runes.js';

// ---------- Interface icons ----------
const ICONS = {
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.6"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  flip: '<path d="M4 9a8 8 0 0 1 14-3l2 2M20 15a8 8 0 0 1-14 3l-2-2"/><path d="M20 4v4h-4M4 20v-4h4"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  video: '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  share:
    '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  points:
    '<circle cx="6" cy="18" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="18" cy="14" r="2"/><path d="M7.2 16.4 10.8 7.7M13.6 7.3l3.4 5.2"/>',
  sparkle:
    '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 2l.6 1.4L7 4l-1.4.6L5 6l-.6-1.4L3 4l1.4-.6z"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M10 10.5v5l4-2.5z"/>',
  slow: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
  boomerang: '<path d="M4 12a5 5 0 0 1 8-4l4 3a5 5 0 1 1 0 2l-4 3a5 5 0 0 1-8-4z"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/>',
  hands: '<path d="M7 20v-6l-2-3 1-1 3 2V5.5a1 1 0 0 1 2 0V11M17 20v-6l2-3-1-1-3 2V5.5a1 1 0 0 0-2 0V11"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
};
const svg = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
const paintIcons = (root = document) => root.querySelectorAll('[data-icon]').forEach((el) => (el.innerHTML = svg(el.dataset.icon)));
paintIcons();

const $ = (id) => document.getElementById(id);

// ---------- Settings ----------
const SETTINGS_KEY = 'magic-cam-settings-v6';
const MOBILE = window.matchMedia?.('(pointer: coarse)').matches;
const DEFAULTS = {
  // smooth: the camera's highest frame rate first; sharp: its highest resolution.
  priority: 'smooth',
  frameBlend: false,
  quality: '32k',
  fpsTarget: '250',
  fxQuality: MOBILE ? 'high' : 'ultra',
  bloom: true,
  fps: false,
  maxDuration: '60',
  countdown: '3',
  mirror: true,
  cinema: true,
  autosave: true,
  mic: true,
  sound: true,
  points: true,
  look: 'normal',
  haptics: true,
  handsFree: true,
  transition: true,
  music: 'off',
  format: 'auto',
  // Two extra full-screen passes per frame: off by default on phones.
  motionBlur: !MOBILE,
  pointsAsked: false,
  eco: false,
};
const settings = (() => {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
    // Keep the earlier answers, but switch to the new smooth default.
    const old = JSON.parse(
      localStorage.getItem('magic-cam-settings-v5') ||
        localStorage.getItem('magic-cam-settings-v4') ||
        localStorage.getItem('magic-cam-settings-v3') ||
        localStorage.getItem('magic-cam-settings-v2') ||
        '{}',
    );
    delete old.priority;
    // The frame blend could double the image when moving: off for everyone.
    delete old.frameBlend;
    // Phones: Ultra was too heavy (lag, stutter); High looks almost the same.
    if (MOBILE && (old.fxQuality || 'ultra') === 'ultra') old.fxQuality = 'high';
    if (old.eco) old.fxQuality = 'eco';
    delete old.eco;
    return { ...DEFAULTS, ...old };
  } catch {
    return { ...DEFAULTS };
  }
})();
const saveSettings = () => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* private mode: settings only last for this visit */
  }
};
// "smooth": image as sharp as the screen shows it, camera at up to 120 i/s.
const screenSide = () => Math.round(Math.max(screen.width, screen.height) * Math.min(2, window.devicePixelRatio || 1));
// Longest side requested from the camera for each quality. The camera gives
// the best it has up to that; the image is then drawn at that resolution
// (within the browser's canvas limits and the adaptive resolution).
const SIDES = { 720: 1280, 1080: 1920, 2160: 3840, 4320: 7680, '16k': 15360, '32k': 30720 };
// Smooth mode: 720p on phones (like phone video apps), up to 1080p on computers.
const maxSideFor = (q) => SIDES[q] || (MOBILE ? 1280 : Math.min(1920, Math.max(1280, screenSide())));
const cameraFps = () => Number(settings.fpsTarget) || 250;
const PARTICLES = { ultra: 1.6, high: 1, eco: 0.5 };

// ---------- Core objects ----------
const video = $('cam');
const stage = $('stage');
const audio = new SoundFx();
audio.setEnabled(settings.sound);
const renderSide = () => (settings.priority === 'sharp' ? maxSideFor(settings.quality) : maxSideFor('smooth'));
const engine = new Engine(stage, { audio, settings, maxSide: renderSide() });
engine.look = settings.look || 'normal';
$('btn-look').classList.toggle('on', engine.look !== 'normal');
const recorder = new CanvasRecorder(stage);
const tracker = new Tracker();
// Handle for debugging from the browser console.
window.magicCam = { engine, tracker };
let trackerReady = null;
let studioOpen = false;
let stream = null;
let facing = 'user';
let loopId = 0;
let lastVideoTime = -1;
let camFrameNo = 0;
let lastCamFrame = 0;
let camInterval = 0;
const colorIndex = {};
let currentEffect = (() => {
  try {
    return localStorage.getItem('magic-cam-effect') || EFFECTS[0].id;
  } catch {
    return EFFECTS[0].id;
  }
})();

// Detection models load in the background as soon as the site opens, so
// entering a power is instant.
function loadModels() {
  if (!trackerReady) {
    trackerReady = tracker.load((p) => ($('loading-bar').style.width = `${Math.round(p * 100)}%`));
    trackerReady.catch(() => (trackerReady = null));
  }
  return trackerReady;
}

// Short notice, only used outside the camera view (sharing).
let noteTimer;
function note(msg) {
  let el = $('note');
  if (!el) {
    el = document.createElement('div');
    el.id = 'note';
    el.className = 'toast';
    document.body.append(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ---------- Powers screen ----------
// Card art is rendered from the real effects by tools/art.js.
const art = (id) => `assets/powers/${id}.jpg`;

// Favourite powers (★ on the cards), kept in this browser.
const FAVS_KEY = 'magic-cam-favs';
let favs = new Set();
try {
  favs = new Set(JSON.parse(localStorage.getItem(FAVS_KEY) || '[]'));
} catch {
  /* private mode: favourites last for this visit only */
}
let category = 'all';

function buildPowers() {
  const grid = $('powers');
  const carousel = $('carousel');
  for (const def of EFFECTS) {
    const fx = getEffect(def.id);
    const wrap = document.createElement('div');
    wrap.className = 'power-wrap';
    wrap.dataset.id = def.id;
    wrap.dataset.cat = def.cat;
    const card = document.createElement('button');
    card.className = 'power';
    card.dataset.id = def.id;
    card.style.setProperty('--tint', def.tint);
    card.innerHTML = `<span class="power-art"><img src="${art(def.id)}" alt="" loading="lazy" decoding="async"></span><span class="power-name">${fx.name}</span><span class="power-gesture">${def.gesture}</span>`;
    card.addEventListener('click', () => openStudio(def.id));
    const star = document.createElement('button');
    star.className = 'fav-btn';
    star.setAttribute('aria-label', `Favori : ${fx.name}`);
    star.textContent = '★';
    star.addEventListener('click', () => toggleFav(def.id));
    wrap.append(card, star);
    grid.append(wrap);

    const chip = document.createElement('button');
    chip.className = 'fx-chip';
    chip.dataset.id = def.id;
    chip.setAttribute('role', 'option');
    chip.setAttribute('aria-label', fx.name);
    chip.style.setProperty('--tint', def.tint);
    chip.innerHTML = `<div class="thumb"><img src="${art(def.id)}" alt="" loading="lazy"></div>`;
    chip.addEventListener('click', () => selectEffect(def.id, true));
    carousel.append(chip);
  }
  const cats = $('cats');
  for (const c of [{ id: 'all', name: 'Tous' }, { id: 'fav', name: '★ Favoris' }, ...CATEGORIES]) {
    const b = document.createElement('button');
    b.className = 'cat';
    b.dataset.cat = c.id;
    b.textContent = c.name;
    b.addEventListener('click', () => {
      category = c.id;
      filterPowers();
      b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      // Back to the top of the list when the user had scrolled past it.
      if (window.scrollY > cats.offsetTop) window.scrollTo({ top: cats.offsetTop, behavior: 'smooth' });
    });
    cats.append(b);
  }
  filterPowers();
}

function toggleFav(id) {
  if (favs.has(id)) favs.delete(id);
  else favs.add(id);
  try {
    localStorage.setItem(FAVS_KEY, JSON.stringify([...favs]));
  } catch {
    /* not saved */
  }
  filterPowers();
}

// Shows the chosen category; favourites come first, in the cards and the studio carousel.
function filterPowers() {
  if (category === 'fav' && !favs.size) category = 'all';
  document.querySelectorAll('.cat').forEach((b) => b.classList.toggle('active', b.dataset.cat === category));
  for (const parent of [$('powers'), $('carousel')]) {
    const items = [...parent.children];
    items.sort(
      (a, b) =>
        favs.has(b.dataset.id) - favs.has(a.dataset.id) ||
        EFFECTS.findIndex((d) => d.id === a.dataset.id) - EFFECTS.findIndex((d) => d.id === b.dataset.id),
    );
    parent.append(...items);
  }
  for (const w of $('powers').children) {
    const id = w.dataset.id;
    w.classList.toggle('fav', favs.has(id));
    w.hidden = !(category === 'all' || (category === 'fav' ? favs.has(id) : w.dataset.cat === category));
  }
  $('cats').querySelector('[data-cat="fav"]').hidden = !favs.size;
}

// ---------- Pages over the app ----------
let pageFrom = 'home';
async function showPage(name) {
  pageFrom = studioOpen ? 'studio' : 'home';
  if (studioOpen) await closeStudio();
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  if (name === 'gallery') renderGallery();
  if (name === 'progress') renderShop();
}
function closePage() {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x.dataset.tab === 'home'));
  if (pageFrom === 'studio') openStudio(currentEffect);
}
document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', closePage));
// Bottom tab bar on the powers screen.
document.querySelectorAll('.tab').forEach((t) =>
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
    if (t.dataset.tab === 'home') closePage();
    else showPage(t.dataset.tab);
  }),
);

// ---------- First launch: tracking points? ----------
function askPoints() {
  if (settings.pointsAsked) return;
  $('ask-visual').innerHTML = '<img src="assets/icon-192.png" alt="">';
  $('points-ask').hidden = false;
}
function answerPoints(yes) {
  settings.points = yes;
  settings.pointsAsked = true;
  saveSettings();
  syncForm();
  updateToggles();
  $('points-ask').hidden = true;
  showNews();
}
$('ask-yes').addEventListener('click', () => answerPoints(true));
$('ask-no').addEventListener('click', () => answerPoints(false));

// ---------- Camera view ----------
function selectEffect(id, fromUser = false) {
  currentEffect = id;
  try {
    localStorage.setItem('magic-cam-effect', id);
  } catch {
    /* ignore */
  }
  const def = EFFECTS.find((d) => d.id === id) || EFFECTS[0];
  // Double power: picking a power while choosing the second one.
  if (dualPicking && id !== dualMain) {
    dualPicking = false;
    dualSecond = id;
    id = dualMain;
    currentEffect = id;
    showChip(`Main gauche : ${getEffect(dualSecond).name}`);
  }
  const fx = getEffect(id);
  audio.stopLoops(); // the previous power's continuous sounds
  const tint = (x) => {
    const h = (EFFECTS.find((d) => d.id === x)?.tint || '#ffffff').slice(1);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  engine.setEffect(dualSecond && dualSecond !== id ? makeDual(fx, getEffect(dualSecond), [tint(id), tint(dualSecond)]) : fx);
  $('btn-dual').classList.toggle('on', !!dualSecond || dualPicking);
  if (fx.colors && colorIndex[id] !== undefined) fx.setColor(colorIndex[id]);
  updateSwatch();
  $('power-pill').innerHTML =
    `<img class="pill-icon" src="${art(def.id)}" alt="">${dualSecond ? `${fx.name} + ${getEffect(dualSecond).name}` : fx.name}`;
  $('power-pill').style.setProperty('--tint', def.tint);
  document.querySelectorAll('.fx-chip').forEach((c) => {
    const on = c.dataset.id === id;
    c.classList.toggle('active', on);
    c.setAttribute('aria-selected', on);
    if (on) c.scrollIntoView({ inline: 'center', block: 'nearest', behavior: fromUser ? 'smooth' : 'auto' });
  });
  const action = $('btn-action');
  action.hidden = !fx.action;
  if (fx.action) action.textContent = fx.action.label;
}

function updateSwatch() {
  const fx = getEffect(currentEffect);
  const c = fx.colors?.[colorIndex[currentEffect] ?? 0];
  const rgb = c?.rgb || c?.glow || c?.hue || [255, 150, 60];
  $('swatch').style.background = c?.rgb === null ? 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' : `rgb(${rgb.join(',')})`;
  $('btn-color').hidden = !fx.colors?.length;
}

function updateToggles() {
  $('btn-sound').classList.toggle('off', !settings.sound);
  $('btn-sound').querySelector('[data-icon]').innerHTML = svg(settings.sound ? 'sound' : 'mute');
  $('btn-points').classList.toggle('on', settings.points);
  $('btn-music').classList.toggle('on', settings.music !== 'off');
  $('vignette').hidden = !settings.cinema;
  $('fps').hidden = !settings.fps;
}

async function startCamera() {
  stopCamera();
  if (!window.isSecureContext) throw Object.assign(new Error('insecure'), { name: 'InsecureContext' });
  if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('unsupported'), { name: 'Unsupported' });
  const portrait = window.innerHeight > window.innerWidth;
  const smooth = settings.priority !== 'sharp';
  const long = smooth || settings.quality === 'smooth' ? (MOBILE ? 1280 : 1920) : maxSideFor(settings.quality);
  const short = Math.round((long * 9) / 16);
  // "ideal" values: the camera gives its best resolution up to the chosen one.
  const videoC = {
    facingMode: facing,
    width: { ideal: portrait ? short : long },
    height: { ideal: portrait ? long : short },
    frameRate: { ideal: cameraFps() },
  };
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: videoC,
      audio: settings.mic ? { echoCancellation: true, noiseSuppression: true } : false,
    });
  } catch (err) {
    if (!settings.mic) throw err;
    // Microphone refused or missing: continue with the camera only.
    stream = await navigator.mediaDevices.getUserMedia({ video: videoC, audio: false });
  }
  // Fluidity first: push the camera to its highest frame rate (60, 120, 240 i/s),
  // lowering the resolution a step if that is what it takes.
  if (smooth) await boostFrameRate(stream.getVideoTracks()[0], portrait);
  video.srcObject = stream;
  await video.play().catch(() => {});
  if (!video.videoWidth) await new Promise((r) => video.addEventListener('loadedmetadata', r, { once: true }));
  audio.attachMic(stream);
  setupZoom(stream.getVideoTracks()[0]);
}

// Pushes the camera to 100+ frames per second when it can: first at the
// sharpest size that reaches 100 i/s, then, if none does, the fastest size
// at 50+ i/s. Browsers without getCapabilities (Firefox) just get the ideal.
async function boostFrameRate(track, portrait) {
  if (!track) return;
  const caps = track.getCapabilities?.() || {};
  const max = Math.min(Number(settings.fpsTarget) || 250, caps.frameRate?.max || 0);
  // Only when the camera says it can go faster: forcing a frame rate it does
  // not have made some phones stall, blur or flicker.
  if (!max || max <= (track.getSettings().frameRate || 0) + 5) return;
  const before = { ...track.getSettings() };
  for (const long of MOBILE ? [1280] : [1920, 1280]) {
    const short = Math.round((long * 9) / 16);
    try {
      await track.applyConstraints({
        width: { ideal: portrait ? short : long },
        height: { ideal: portrait ? long : short },
        frameRate: { ideal: max },
      });
      if ((track.getSettings().frameRate || 0) >= Math.min(max, 100) * 0.9) return;
    } catch {
      /* not possible at this size */
    }
  }
  // No gain: back to the original settings.
  try {
    await track.applyConstraints({
      width: { ideal: before.width },
      height: { ideal: before.height },
      frameRate: { ideal: before.frameRate || 30 },
    });
  } catch {
    /* keep what we have */
  }
}

function stopCamera() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  video.srcObject = null;
}

function showError(err) {
  const map = {
    NotAllowedError: [
      'Autorisez la caméra',
      'Touchez l’icône de cadenas ou de caméra dans la barre d’adresse et autorisez la caméra pour ce site. Sur iPhone : Réglages › Safari › Caméra › Autoriser.',
    ],
    NotFoundError: ['Aucune caméra trouvée', 'Branchez une webcam ou utilisez un appareil équipé d’une caméra.'],
    NotReadableError: ['Caméra occupée', 'Une autre application utilise la caméra. Fermez-la puis réessayez.'],
    OverconstrainedError: ['Caméra incompatible', 'Choisissez une qualité plus basse dans les Paramètres.'],
    InsecureContext: ['Adresse non sécurisée', 'La caméra ne fonctionne que sur une adresse en https://.'],
    Unsupported: ['Navigateur non compatible', 'Utilisez une version récente de Chrome, Edge, Safari ou Firefox.'],
    ModelError: ['Connexion nécessaire', 'Les modèles de détection n’ont pas pu être téléchargés. Vérifiez votre connexion Internet.'],
  };
  const [title, text] = map[err?.name] || ['Une erreur est survenue', err?.message || String(err)];
  $('error-title').textContent = title;
  $('error-text').textContent = text;
  $('error').hidden = false;
  $('loading').hidden = true;
}

async function openStudio(id) {
  if (id && !progress.owns(id)) return askBuy(id);
  studioOpen = true;
  $('view-studio').hidden = false;
  document.body.classList.add('in-studio');
  $('error').hidden = true;
  // The loading screen only shows the first time, while the models download.
  $('loading').hidden = tracker.ready;
  audio.init();
  music.play(settings.music);
  updateToggles();
  selectEffect(id || currentEffect);
  refreshMiniThumb();
  try {
    await startCamera();
    await loadModels().catch((err) => {
      console.error(err);
      throw Object.assign(new Error('model'), { name: 'ModelError' });
    });
  } catch (err) {
    if (studioOpen) showError(err);
    return;
  }
  if (!studioOpen) return;
  $('loading').hidden = true;
  engine.tracker.reset();
  engine.body.reset();
  tracker.reset();
  frameTimes.length = 0;
  lastFrame = 0;
  lastCamFrame = 0;
  camInterval = 0;
  cancelAnimationFrame(loopId);
  loopId = requestAnimationFrame(loop);
}

async function closeStudio() {
  cancelCountdown();
  if (recorder.recording) await stopRecording(false);
  studioOpen = false;
  cancelAnimationFrame(loopId);
  stopCamera();
  audio.stopLoops();
  music.stop();
  $('view-studio').hidden = true;
  document.body.classList.remove('in-studio');
  renderHub();
  flushUnlocks();
}

function loop(now) {
  if (!studioOpen) return;
  loopId = requestAnimationFrame(loop);
  if (video.readyState < 2 || !video.videoWidth) return;
  const fx = engine.effect;
  // The body point cloud needs the silhouette too.
  // A body power needs the silhouette every frame; the point cloud alone
  // only every third camera frame (the segmentation is the heaviest model).
  const needSeg = !!fx?.needs?.seg;
  const wantSeg = needSeg || settings.points;
  // Each new camera frame goes to the detection worker; rendering never waits
  // for it, and the engine predicts the hands' motion in between.
  let newFrame = false;
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    newFrame = true;
    if (lastCamFrame) camInterval = camInterval ? camInterval * 0.9 + (now - lastCamFrame) * 0.1 : now - lastCamFrame;
    lastCamFrame = now;
    camFrameNo++;
    coverTransition(now);
    tracker.request(video, needSeg || (settings.points && camFrameNo % 3 === 0), settings.points || !!fx?.needs?.pose);
  }
  const det = tracker.take(wantSeg);
  adaptResolution(now);
  // Never let one bad frame stop the loop.
  try {
    // The image size changed (resolution, camera): keep the chosen zoom.
    if (stage.width !== zoomSize.w || stage.height !== zoomSize.h) {
      zoomSize.w = stage.width;
      zoomSize.h = stage.height;
      applyZoom();
    }
    engine.frame({
      source: video,
      sw: video.videoWidth,
      sh: video.videoHeight,
      mirror: settings.mirror && facing === 'user',
      raw: det.raw,
      mask: det.mask,
      maskFresh: det.maskFresh,
      pose: det.pose,
      newFrame,
      frameAge: now - lastCamFrame,
      camInterval,
      now,
    });
    recorder.frame(now);
    handsFree(engine.dt);
    // Experience for time spent doing magic (someone in view).
  } catch (err) {
    console.error(err);
  }
}

// ---------- Smoothness: frame rate and adaptive resolution ----------
// The loop runs at the screen's refresh rate (60, 90, 120, 144 Hz…). If the
// device cannot keep up, the image resolution is lowered a little until it
// does, then raised again when there is room. Never while recording.
const frameTimes = [];
let lastFrame = 0;
let lastAdapt = 0;
let fpsShown = 0;
function adaptResolution(now) {
  if (lastFrame) {
    frameTimes.push(now - lastFrame);
    if (frameTimes.length > 120) frameTimes.shift();
  }
  lastFrame = now;
  if (settings.fps && now - fpsShown > 500 && frameTimes.length > 10) {
    fpsShown = now;
    const recent = frameTimes.slice(-30);
    const fps = 1000 / (recent.reduce((s, x) => s + x, 0) / recent.length);
    const cam = Math.round(stream?.getVideoTracks()[0]?.getSettings().frameRate || 0);
    $('fps').textContent =
      `écran ${Math.round(fps)} i/s · caméra ${cam} i/s · détection ${Math.round(tracker.detectFps)} i/s · ${MESH_POINTS} points/main${engine.cloudCount ? ` · ${engine.cloudCount.toLocaleString('fr-FR')} points sur le corps` : ''}`;
  }
  if (now - lastAdapt < 1500 || frameTimes.length < 60 || recorder.recording) return;
  lastAdapt = now;
  // Share of dropped frames: intervals much longer than the usual one.
  const sorted = [...frameTimes].sort((a, b) => a - b);
  const usual = sorted[Math.floor(sorted.length * 0.25)];
  const dropped = frameTimes.filter((t) => t > usual * 1.6).length / frameTimes.length;
  if (dropped > 0.2 && engine.renderScale > 0.45) engine.renderScale = Math.max(0.45, engine.renderScale * 0.85);
  else if (dropped < 0.04 && engine.renderScale < 1) engine.renderScale = Math.min(1, engine.renderScale * 1.1);
}

// ---------- Recording: tap -> 3, 2, 1 -> record ----------
let recTimer = 0;
let lastResult = null;
let countdownRun = 0;

function cancelCountdown() {
  countdownRun++;
  $('countdown').hidden = true;
  $('btn-record').classList.remove('arming');
}

async function countdown() {
  const run = ++countdownRun;
  const n = Number(settings.countdown) || 0;
  const el = $('countdown');
  for (let i = n; i > 0; i--) {
    el.hidden = false;
    el.innerHTML = `<span class="cd-ring"></span><span class="cd-num">${i}</span>`;
    audio.play('tick', 0.6);
    await new Promise((r) => setTimeout(r, 1000));
    if (run !== countdownRun || !studioOpen) return false;
  }
  el.hidden = true;
  if (n) audio.play('go', 0.6);
  return true;
}

// ---------- Video format: auto, 9:16, 1:1, 16:9 ----------
const FORMATS = { auto: null, '9:16': 9 / 16, '1:1': 1, '16:9': 16 / 9 };
const formatAspect = () => {
  const a = FORMATS[settings.format];
  // Already that shape: nothing to crop.
  return a && Math.abs(stage.width / stage.height - a) > 0.02 ? a : null;
};
// Frame on screen around what will be recorded; outside it is dimmed.
function updateFormatGuide() {
  const g = $('format-guide');
  const a = formatAspect();
  if (!a || !stage.width) return (g.hidden = true);
  const W = window.innerWidth;
  const H = window.innerHeight;
  const contain = Math.min(W / stage.width, H / stage.height);
  const scale = contain * (parseFloat(/scale\(([\d.]+)\)/.exec(stage.style.transform)?.[1]) || 1);
  const r = cropRect(stage.width, stage.height, a);
  g.hidden = false;
  g.style.width = `${r.w * scale}px`;
  g.style.height = `${r.h * scale}px`;
  g.style.left = `${W / 2 - (stage.width / 2 - r.x) * scale}px`;
  g.style.top = `${H / 2 - (stage.height / 2 - r.y) * scale}px`;
}

// ---------- Background music (studio button ♪) ----------
const music = new Music(audio);
// Powers pulse on the beat: a tiny zoom on each kick drum.
music.onBeat = (strength) => studioOpen && engine.punch(0.012 * strength);
$('btn-music').addEventListener('click', () => {
  audio.init();
  const keys = Object.keys(TRACKS);
  settings.music = keys[(keys.indexOf(settings.music) + 1) % keys.length];
  saveSettings();
  music.play(settings.music);
  $('btn-music').classList.toggle('on', settings.music !== 'off');
  showChip(`♪ ${TRACKS[settings.music].name}`);
});

// ---------- Magic transition: cover the camera, uncover -> new power ----------
// Like the TikTok transitions: the image goes dark (hand on the lens), then
// comes back within 3 s with another power, a flash and a whoosh.
const lumCanvas = document.createElement('canvas');
lumCanvas.width = 16;
lumCanvas.height = 9;
const lumCtx = lumCanvas.getContext('2d', { willReadFrequently: true });
let lumAvg = 0;
let coveredAt = 0;
function coverTransition(now) {
  if (!settings.transition) return;
  lumCtx.drawImage(video, 0, 0, 16, 9);
  const d = lumCtx.getImageData(0, 0, 16, 9).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
  const lum = sum / (d.length / 4);
  if (!coveredAt) {
    // Sudden darkness compared with the usual brightness.
    if (lumAvg > 40 && lum < lumAvg * 0.25) coveredAt = now;
    else lumAvg = lumAvg ? lumAvg * 0.95 + lum * 0.05 : lum;
  } else if (now - coveredAt > 3000) {
    coveredAt = 0;
    lumAvg = lum;
  } else if (lum > lumAvg * 0.6 && now - coveredAt > 200) {
    coveredAt = 0;
    magicSwitch();
  }
}
function magicSwitch() {
  // Next favourite, or another power you own (not the free mode).
  const owned = EFFECTS.filter((d) => progress.owns(d.id) && d.id !== 'free' && d.id !== currentEffect);
  const favList = owned.filter((d) => favs.has(d.id));
  const pool = favList.length ? favList : owned;
  if (!pool.length) return;
  const next = pool[(Math.random() * pool.length) | 0].id;
  selectEffect(next);
  engine.flash([255, 255, 255], 0.9, 2.5);
  engine.punch(0.08);
  audio.play('teleport', 0.9);
}

// ---------- Hands-free: show both palms, still, to start or stop ----------
// Handy when the phone is propped up a few metres away.
let handsFreeT = 0;
let recStartedAt = 0;
function handsFree(dt) {
  const btn = $('btn-record');
  if (!settings.handsFree) return;
  const m = Math.min(engine.W, engine.H);
  const hs = engine.hands.filter((h) => h.presence > 0.6 && h.open);
  const still = hs.length >= 2 && hs.every((h) => h.speed < m * 0.18) && Math.abs(hs[0].palm.x - hs[1].palm.x) > m * 0.25;
  const busy = btn.classList.contains('arming') || (recorder.recording && performance.now() - recStartedAt < 3000);
  handsFreeT = still && !busy ? handsFreeT + dt : Math.min(0, handsFreeT + dt);
  // The record button fills up while the palms are held.
  btn.style.setProperty('--hf', handsFreeT > 0 ? String(Math.min(1, handsFreeT / 1.5)) : '0');
  if (handsFreeT < 1.5) return;
  handsFreeT = -2;
  btn.style.setProperty('--hf', '0');
  if (recorder.recording) stopRecording();
  else startRecording();
}

async function startRecording() {
  if (!window.MediaRecorder || !stage.captureStream) return;
  const btn = $('btn-record');
  btn.classList.add('arming');
  const go = await countdown();
  btn.classList.remove('arming');
  if (!go || !studioOpen) return;
  recStartedAt = performance.now();
  // The size of the video cannot change while recording: if frames were
  // being dropped, step the resolution down once before starting.
  const recent = frameTimes.slice(-60);
  if (recent.length > 30) {
    const sorted = [...recent].sort((a, b) => a - b);
    const usual = sorted[Math.floor(sorted.length * 0.25)];
    const dropped = recent.filter((t) => t > usual * 1.6).length / recent.length;
    if (dropped > 0.1 && engine.renderScale > 0.5) {
      engine.renderScale = Math.max(0.5, engine.renderScale * 0.8);
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  try {
    recorder.start({ audioTracks: audio.recordTracks.slice(0, 1), aspect: formatAspect() });
  } catch (err) {
    console.warn(err);
    return;
  }
  btn.classList.add('recording');
  btn.setAttribute('aria-label', 'Arrêter');
  $('rec-chip').hidden = false;
  const max = Number(settings.maxDuration) || 60;
  const ring = $('rec-progress');
  const t0 = performance.now();
  const tick = () => {
    const s = (performance.now() - t0) / 1000;
    $('rec-time').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    ring.style.strokeDashoffset = String(289 * (1 - Math.min(1, s / max)));
    if (s >= max) stopRecording();
    else recTimer = requestAnimationFrame(tick);
  };
  tick();
}

async function stopRecording(show = true) {
  cancelAnimationFrame(recTimer);
  const btn = $('btn-record');
  btn.classList.remove('recording');
  btn.setAttribute('aria-label', 'Enregistrer');
  $('rec-chip').hidden = true;
  $('rec-progress').style.strokeDashoffset = '289';
  const res = await recorder.stop();
  if (!res || !res.blob.size) return;
  const thumb = await videoThumbnail(res.blob);
  const item = { kind: 'video', blob: res.blob, type: res.type, duration: res.duration, thumb, effect: currentEffect };
  progress.recorded(currentEffect, res.duration, !!dualSecond);
  if (show) showResult(item);
  else if (settings.autosave) await gallery.add(item);
}

// The score screen of a game, kept as a photo in "Mes vidéos" (to share it).
function saveScoreShot() {
  if (!settings.autosave) return;
  // Once the end screen is drawn.
  setTimeout(async () => {
    if (!studioOpen) return;
    const blob = await new Promise((r) => stage.toBlob(r, 'image/jpeg', 0.9));
    if (!blob) return;
    const c = document.createElement('canvas');
    const k = 320 / Math.max(stage.width, stage.height);
    c.width = stage.width * k;
    c.height = stage.height * k;
    c.getContext('2d').drawImage(stage, 0, 0, c.width, c.height);
    try {
      await gallery.add({ kind: 'photo', blob, type: 'image/jpeg', thumb: c.toDataURL('image/jpeg', 0.75), effect: currentEffect });
      refreshMiniThumb();
    } catch (err) {
      console.warn(err);
    }
  }, 900);
}

async function takePhoto() {
  const flash = $('shutter-flash');
  flash.classList.remove('go');
  void flash.offsetWidth;
  flash.classList.add('go');
  audio.play('shutter', 0.8);
  // Photo in the chosen format too.
  let shot = stage;
  const aspect = formatAspect();
  if (aspect) {
    const r = cropRect(stage.width, stage.height, aspect);
    shot = document.createElement('canvas');
    shot.width = r.w;
    shot.height = r.h;
    shot.getContext('2d').drawImage(stage, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  }
  const blob = await new Promise((r) => shot.toBlob(r, 'image/jpeg', 0.92));
  if (!blob) return;
  const c = document.createElement('canvas');
  const k = 320 / Math.max(stage.width, stage.height);
  c.width = stage.width * k;
  c.height = stage.height * k;
  c.getContext('2d').drawImage(stage, 0, 0, c.width, c.height);
  progress.photo(currentEffect);
  showResult({ kind: 'photo', blob, type: 'image/jpeg', thumb: c.toDataURL('image/jpeg', 0.75), effect: currentEffect });
}

const fileName = (item) => {
  const d = new Date(item.created || Date.now());
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  return `magic-cam-${item.effect || 'video'}-${stamp}.${item.kind === 'photo' ? 'jpg' : extensionFor(item.type)}`;
};

async function showResult(item, fromGallery = false) {
  if (!fromGallery && settings.autosave) {
    try {
      item = await gallery.add(item);
      item.saved = true;
      refreshMiniThumb();
    } catch (err) {
      console.warn(err);
    }
  }
  lastResult = item;
  const media = $('result-media');
  media.innerHTML = '';
  const url = URL.createObjectURL(item.blob);
  item.url = url;
  if (item.kind === 'photo') {
    const img = new Image();
    img.src = url;
    img.alt = 'Photo Magic Cam';
    media.append(img);
  } else {
    const v = document.createElement('video');
    v.src = url;
    v.controls = true;
    v.autoplay = true;
    v.loop = true;
    v.playsInline = true;
    media.append(v);
  }
  $('res-save').hidden = !!item.saved;
  $('res-slow').hidden = $('res-boom').hidden = item.kind === 'photo';
  $('result').hidden = false;
}

// Slow motion / boomerang made from the video shown in the result screen.
let remixing = false;
async function remixResult(mode) {
  const src = lastResult;
  if (remixing || !src || src.kind === 'photo') return;
  remixing = true;
  const btn = $(mode === 'slow' ? 'res-slow' : 'res-boom');
  const lbl = btn.querySelector('.lbl');
  const label = lbl.textContent;
  $('res-slow').disabled = $('res-boom').disabled = true;
  try {
    const { remix } = await import('./remix.js');
    const res = await remix(src.blob, mode, src.duration || 0, (p) => (lbl.textContent = `${Math.round(p * 100)} %`));
    if (!res?.blob.size) throw new Error('empty');
    const thumb = await videoThumbnail(res.blob);
    $('result-media').querySelector('video')?.pause();
    if (src.url) URL.revokeObjectURL(src.url);
    await showResult({ kind: 'video', blob: res.blob, type: res.type, duration: res.duration, thumb, effect: src.effect });
  } catch (err) {
    console.warn(err);
    lbl.textContent = 'Impossible';
    await new Promise((r) => setTimeout(r, 1500));
  } finally {
    lbl.textContent = label;
    $('res-slow').disabled = $('res-boom').disabled = false;
    remixing = false;
  }
}
$('res-slow').addEventListener('click', () => remixResult('slow'));
$('res-boom').addEventListener('click', () => remixResult('boomerang'));

function closeResult() {
  $('result-media').querySelector('video')?.pause();
  if (lastResult?.url) URL.revokeObjectURL(lastResult.url);
  $('result').hidden = true;
  if ($('view-gallery').classList.contains('active')) renderGallery();
}

function download(item) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(item.blob);
  a.download = fileName(item);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function share(item) {
  const file = new File([item.blob], fileName(item), { type: item.blob.type || item.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Magic Cam', text: 'Fait avec Magic Cam ✨ #magiccam #magie' });
    } catch (err) {
      if (err.name !== 'AbortError') download(item);
    }
  } else {
    download(item);
    note('Vidéo téléchargée : publiez-la depuis vos fichiers.');
  }
}

$('res-download').addEventListener('click', () => lastResult && download(lastResult));
$('res-share').addEventListener('click', () => lastResult && share(lastResult));
$('res-save').addEventListener('click', async () => {
  if (!lastResult || lastResult.saved) return;
  const { url, ...item } = lastResult;
  const saved = await gallery.add(item);
  lastResult = { ...saved, url, saved: true };
  $('res-save').hidden = true;
  refreshMiniThumb();
});
$('res-delete').addEventListener('click', async () => {
  if (lastResult?.saved && lastResult.id) await gallery.remove(lastResult.id);
  refreshMiniThumb();
  closeResult();
});

// ---------- Gallery ----------
// Gallery: filter (all / videos / photos), sort, and a selection mode to
// delete several items at once.
const galleryView = { kind: 'all', sort: 'new', selecting: false, selected: new Set() };
const fmtDuration = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const fmtSize = (b) => (b > 1e9 ? `${(b / 1e9).toFixed(1)} Go` : `${Math.max(0.1, b / 1e6).toFixed(1)} Mo`);

async function renderGallery() {
  const all = await gallery.list();
  const grid = $('gallery-grid');
  grid.innerHTML = '';
  let items = all.filter((it) => galleryView.kind === 'all' || (galleryView.kind === 'photo') === (it.kind === 'photo'));
  const sorts = {
    new: (a, b) => b.created - a.created,
    old: (a, b) => a.created - b.created,
    long: (a, b) => (b.duration || 0) - (a.duration || 0),
    power: (a, b) => (getEffect(a.effect)?.name || '').localeCompare(getEffect(b.effect)?.name || '', 'fr') || b.created - a.created,
  };
  items = items.sort(sorts[galleryView.sort]);
  $('gallery-empty').hidden = items.length > 0;
  const bytes = all.reduce((n, it) => n + (it.blob?.size || 0), 0);
  $('gallery-usage').textContent = all.length ? `${all.length} élément${all.length > 1 ? 's' : ''} · ${fmtSize(bytes)}` : '';
  for (const item of items) {
    const el = document.createElement('button');
    el.className = 'media-item';
    el.classList.toggle('selected', galleryView.selected.has(item.id));
    const fx = getEffect(item.effect);
    const date = new Date(item.created).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const dur = item.kind === 'photo' ? '' : `<span class="dur">${fmtDuration(item.duration || 0)}</span>`;
    el.innerHTML = `${item.thumb ? `<img alt="" src="${item.thumb}">` : ''}<span class="kind" data-icon="${item.kind === 'photo' ? 'image' : 'video'}"></span>${dur}<span class="check"></span><div class="meta"><strong>${fx?.name || ''}</strong><br>${date}</div>`;
    el.addEventListener('click', () => {
      if (!galleryView.selecting) return showResult({ ...item, saved: true }, true);
      if (galleryView.selected.has(item.id)) galleryView.selected.delete(item.id);
      else galleryView.selected.add(item.id);
      el.classList.toggle('selected');
      updateSelectBar();
    });
    grid.append(el);
  }
  grid.classList.toggle('selecting', galleryView.selecting);
  updateSelectBar();
  paintIcons(grid);
}

function updateSelectBar() {
  const n = galleryView.selected.size;
  $('select-bar').hidden = !galleryView.selecting;
  $('select-count').textContent = `${n} sélectionné${n > 1 ? 's' : ''}`;
  $('select-delete').disabled = !n;
  $('gallery-select').textContent = galleryView.selecting ? 'Terminé' : 'Sélectionner';
}

$('gallery-kind').addEventListener('click', (ev) => {
  const b = ev.target.closest('button');
  if (!b) return;
  galleryView.kind = b.dataset.kind;
  $('gallery-kind')
    .querySelectorAll('button')
    .forEach((x) => x.classList.toggle('active', x === b));
  renderGallery();
});
$('gallery-sort').addEventListener('change', (ev) => {
  galleryView.sort = ev.target.value;
  renderGallery();
});
$('gallery-select').addEventListener('click', () => {
  galleryView.selecting = !galleryView.selecting;
  galleryView.selected.clear();
  renderGallery();
});
$('select-all').addEventListener('click', async () => {
  const items = (await gallery.list()).filter(
    (it) => galleryView.kind === 'all' || (galleryView.kind === 'photo') === (it.kind === 'photo'),
  );
  const all = items.every((it) => galleryView.selected.has(it.id));
  galleryView.selected = new Set(all ? [] : items.map((it) => it.id));
  renderGallery();
});
$('select-delete').addEventListener('click', async () => {
  const n = galleryView.selected.size;
  if (!n || !confirm(`Supprimer ${n} élément${n > 1 ? 's' : ''} ?`)) return;
  for (const id of galleryView.selected) await gallery.remove(id);
  galleryView.selected.clear();
  galleryView.selecting = false;
  renderGallery();
  refreshMiniThumb();
});

async function refreshMiniThumb() {
  const [last] = await gallery.list();
  const b = $('btn-gallery');
  b.classList.toggle('has-img', !!last?.thumb);
  b.style.backgroundImage = last?.thumb ? `url(${last.thumb})` : '';
}

$('clear-gallery').addEventListener('click', async () => {
  if (!confirm('Supprimer toutes les vidéos et photos enregistrées dans ce navigateur ?')) return;
  for (const item of await gallery.list()) await gallery.remove(item.id);
  refreshMiniThumb();
});

// ---------- Camera controls ----------
$('btn-back').addEventListener('click', closeStudio);
$('error-back').addEventListener('click', closeStudio);
$('error-retry').addEventListener('click', () => openStudio(currentEffect));
$('btn-record').addEventListener('click', () => {
  if (recorder.recording) stopRecording();
  else if ($('btn-record').classList.contains('arming')) cancelCountdown();
  else startRecording();
});
$('btn-photo').addEventListener('click', takePhoto);
$('btn-gallery').addEventListener('click', () => showPage('gallery'));
$('btn-flip').addEventListener('click', async () => {
  if (recorder.recording) return;
  facing = facing === 'user' ? 'environment' : 'user';
  try {
    await startCamera();
    engine.tracker.reset();
  } catch {
    facing = facing === 'user' ? 'environment' : 'user';
    startCamera().catch(showError);
  }
});
$('btn-color').addEventListener('click', () => {
  const fx = getEffect(currentEffect);
  if (!fx.colors) return;
  const i = ((colorIndex[currentEffect] ?? 0) + 1) % fx.colors.length;
  colorIndex[currentEffect] = i;
  fx.setColor(i);
  updateSwatch();
});
// Image looks (colour grade of the scene, the powers keep their colours).
const LOOKS = [
  ['normal', 'Normal'],
  ['cinema', 'Cinéma'],
  ['neon', 'Néon'],
  ['vintage', 'Vintage'],
  ['noir', 'Noir et blanc'],
];
let lookTimer = 0;
$('btn-look').addEventListener('click', () => {
  const i = (LOOKS.findIndex(([id]) => id === settings.look) + 1) % LOOKS.length;
  settings.look = LOOKS[i][0];
  engine.look = settings.look;
  saveSettings();
  $('btn-look').classList.toggle('on', settings.look !== 'normal');
  const chip = $('look-chip');
  chip.textContent = LOOKS[i][1];
  chip.hidden = false;
  clearTimeout(lookTimer);
  lookTimer = setTimeout(() => (chip.hidden = true), 900);
});
$('btn-sound').addEventListener('click', () => {
  settings.sound = !settings.sound;
  audio.setEnabled(settings.sound);
  saveSettings();
  syncForm();
  updateToggles();
});
$('btn-points').addEventListener('click', () => {
  settings.points = !settings.points;
  settings.pointsAsked = true;
  if (!settings.points) engine.body.reset();
  saveSettings();
  syncForm();
  updateToggles();
});
$('btn-action').addEventListener('click', () => engine.effect?.action?.run(engine));
// Double tap on the image also triggers the power's action (teleport).
let lastTap = 0;
stage.addEventListener('pointerup', () => {
  const now = performance.now();
  if (now - lastTap < 320) engine.effect?.action?.run(engine);
  lastTap = now;
});
$('result').addEventListener('click', (e) => {
  if (e.target.id === 'result' || e.target.closest('[data-close]')) closeResult();
});
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select')) return;
  if (e.key === 'Escape') {
    if (!$('result').hidden) closeResult();
    else if (document.querySelector('.view.active')) closePage();
    else if (studioOpen) closeStudio();
  }
  if (!studioOpen) return;
  if (e.key === ' ') {
    e.preventDefault();
    $('btn-record').click();
  }
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    const i = EFFECTS.findIndex((d) => d.id === currentEffect);
    selectEffect(EFFECTS[(i + (e.key === 'ArrowRight' ? 1 : EFFECTS.length - 1)) % EFFECTS.length].id, true);
  }
});
// Pause the camera when the tab is hidden (saves battery), resume after.
document.addEventListener('visibilitychange', () => {
  if (!studioOpen) return;
  if (document.hidden && !recorder.recording) stopCamera();
  else if (!document.hidden && !stream) startCamera().catch(showError);
});

// ---------- Settings form ----------
const form = $('settings-form');
function syncForm() {
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') el.checked = !!settings[el.name];
    else el.value = String(settings[el.name]);
  }
}
form.addEventListener('change', (e) => {
  const el = e.target;
  settings[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  if (el.name === 'points') settings.pointsAsked = true;
  if (el.name === 'format') updateFormatGuide();
  saveSettings();
  audio.setEnabled(settings.sound);
  quality.particles = PARTICLES[settings.fxQuality] || 1;
  engine.maxSide = renderSide();
  updateToggles();
});
syncForm();
quality.particles = PARTICLES[settings.fxQuality] || 1;

// ---------- Zoom: pinch with two fingers, mouse wheel, or the 1× button ----------
// Zooming out first uses the camera's own zoom when it can go wider than 1×
// (wide-angle lens), then shows the parts of the image the screen crops.
// Zooming in uses the camera's zoom, then a digital zoom that the videos keep.
let zoomZ = 1;
let zoomTrack = null;
let zoomCaps = null;
let zoomHw = 1;
let zoomPending = null;
const zoomSize = { w: 0, h: 0 };
const clampZ = (v, a, b) => Math.min(b, Math.max(a, v));
function setupZoom(track) {
  zoomTrack = track || null;
  const z = track?.getCapabilities?.().zoom;
  zoomCaps = z && z.max > z.min ? { min: z.min, max: z.max } : null;
  zoomHw = track?.getSettings?.().zoom || 1;
  applyZoom();
}
// How much bigger "fill the screen" is than "show the whole image".
function coverRatio() {
  const cw = stage.width;
  const ch = stage.height;
  if (!cw || !ch) return 1;
  const a = window.innerWidth / cw;
  const b = window.innerHeight / ch;
  return Math.max(a, b) / Math.min(a, b);
}
function zoomRange() {
  const hwMin = Math.min(zoomCaps?.min ?? 1, 1);
  return [Math.max(0.25, hwMin / coverRatio()), 5];
}
function applyZoom() {
  const [lo, hi] = zoomRange();
  zoomZ = clampZ(zoomZ, lo, hi);
  const hw = zoomCaps ? clampZ(zoomZ, zoomCaps.min, zoomCaps.max) : 1;
  if (zoomCaps && Math.abs(hw - zoomHw) > 0.01) {
    // Camera zoom changes are sent at most every 120 ms.
    if (!zoomPending)
      zoomPending = setTimeout(() => {
        zoomPending = null;
        const target = zoomCaps ? clampZ(zoomZ, zoomCaps.min, zoomCaps.max) : 1;
        zoomTrack?.applyConstraints({ advanced: [{ zoom: target }] }).then(
          () => (zoomHw = target),
          () => (zoomCaps = null),
        );
      }, 120);
  }
  const rest = zoomZ / (zoomCaps ? hw : 1);
  // In: digital zoom drawn by the engine (so it is in the videos too).
  engine.userZoom = Math.max(1, rest);
  // Out: less of the image is cropped by the screen (down to all of it).
  const k = coverRatio();
  stage.style.objectFit = 'contain';
  stage.style.transform = `scale(${rest >= 1 ? k * 1.04 : Math.max(1, k * 1.04 * rest)})`;
  $('btn-zoom').textContent = `${String(Math.round(zoomZ * 10) / 10).replace('.', ',')}×`;
  $('btn-zoom').classList.toggle('on', Math.abs(zoomZ - 1) > 0.02);
  updateFormatGuide();
}
// Two-finger pinch anywhere on the camera image.
let pinch0 = null;
const touchDist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
$('view-studio').addEventListener(
  'touchstart',
  (ev) => {
    if (ev.touches.length === 2) pinch0 = { d: touchDist(ev.touches), z: zoomZ };
  },
  { passive: true },
);
$('view-studio').addEventListener(
  'touchmove',
  (ev) => {
    if (!pinch0 || ev.touches.length !== 2) return;
    ev.preventDefault();
    zoomZ = pinch0.z * (touchDist(ev.touches) / pinch0.d);
    applyZoom();
  },
  { passive: false },
);
$('view-studio').addEventListener('touchend', (ev) => {
  if (ev.touches.length < 2) pinch0 = null;
});
// Mouse wheel / trackpad on a computer.
$('view-studio').addEventListener(
  'wheel',
  (ev) => {
    if (ev.target.closest('.carousel')) return;
    ev.preventDefault();
    zoomZ *= Math.exp(-ev.deltaY * 0.0015);
    applyZoom();
  },
  { passive: false },
);
// The button: widest -> 1× -> 2× -> widest...
$('btn-zoom').addEventListener('click', () => {
  const [lo] = zoomRange();
  zoomZ = zoomZ > 1.5 ? lo : zoomZ < 0.99 ? 1 : 2;
  applyZoom();
});
window.addEventListener('resize', () => studioOpen && applyZoom());

// ---------- Double power ----------
let dualMain = null;
let dualSecond = null;
let dualPicking = false;
$('btn-dual').addEventListener('click', () => {
  if (dualSecond || dualPicking) {
    dualSecond = null;
    dualPicking = false;
    selectEffect(currentEffect);
    return;
  }
  dualPicking = true;
  dualMain = currentEffect;
  $('btn-dual').classList.add('on');
  showChip('Choisis le pouvoir de la main gauche', 1800);
});
// Short label in the middle of the studio (same chip as the image looks).
function showChip(text, ms = 1100) {
  const chip = $('look-chip');
  chip.textContent = text;
  chip.hidden = false;
  clearTimeout(lookTimer);
  lookTimer = setTimeout(() => (chip.hidden = true), ms);
}

// ---------- Crystals: daily challenges and the power shop ----------
const progress = new Progress(EFFECTS);
progress.effectName = (id) => getEffect(id)?.name;
engine.on('ultimate', () => progress.ultimate(currentEffect));
engine.on('freePower', (id) => progress.freePower(id));
// Secret moves work with every power.
const secrets = new Secrets();
secrets.onFound = () => progress.secret();
engine.addMechanic(secrets);

function challengeRows(list) {
  return list
    .map(
      (c) =>
        `<div class="challenge${c.done ? ' done' : ''}" data-power="${c.power || ''}"><span class="ch-check">${c.done ? '✓' : '○'}</span><span class="ch-text">${c.text}${c.goal > 1 && !c.done && c.progress.length ? ` (${c.progress.length}/${c.goal})` : ''}</span><b>💎 ${c.reward}</b></div>`,
    )
    .join('');
}
// Locked powers on the cards and in the studio row.
function renderLocks() {
  for (const w of $('powers').children) {
    const id = w.dataset.id;
    const locked = !progress.owns(id);
    w.classList.toggle('locked', locked);
    let tag = w.querySelector('.price');
    if (!tag) {
      tag = document.createElement('span');
      tag.className = 'price';
      w.querySelector('.power-art').append(tag);
    }
    tag.textContent = `🔒 💎 ${progress.price(id)}`;
    tag.hidden = !locked;
  }
  document.querySelectorAll('.fx-chip').forEach((c) => (c.hidden = !progress.owns(c.dataset.id)));
}
function renderHub() {
  renderLocks();
  $('wallet-num').textContent = progress.s.crystals;
  $('wallet-streak').textContent = progress.streak > 1 ? `🔥 ${progress.streak} jours` : '';
  const list = progress.challenges;
  $('hub-challenges').innerHTML = challengeRows(list);
  $('hub-done').textContent = `${list.filter((c) => c.done).length}/3`;
}
$('hub-challenges').addEventListener('click', (ev) => {
  const row = ev.target.closest('.challenge');
  if (row && !row.classList.contains('done'))
    openStudio(row.dataset.power || (row.textContent.includes('Mode libre') ? 'free' : currentEffect));
});
$('wallet-card').addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x.dataset.tab === 'progress'));
  showPage('progress');
});

// Shop page: the challenges, then every power still to buy.
function renderShop() {
  $('shop-crystals').textContent = progress.s.crystals;
  $('shop-challenges').innerHTML = challengeRows(progress.challenges);
  $('free-moves').innerHTML = FREE_MOVES.map(
    ([id, how, what]) =>
      `<div class="ach on"><img class="move-img" src="${art(id)}" alt=""><span><strong>${what}</strong><small>${how}</small></span></div>`,
  ).join('');
  const locked = EFFECTS.filter((d) => !progress.owns(d.id));
  $('shop-list').innerHTML = locked.length
    ? locked
        .map((d) => {
          const p = progress.price(d.id);
          return `<button class="shop-item" data-id="${d.id}"><img src="${art(d.id)}" alt=""><span><strong>${getEffect(d.id).name}</strong><small>${d.gesture}</small></span><b class="${progress.s.crystals >= p ? '' : 'short'}">💎 ${p}</b></button>`;
        })
        .join('')
    : '<p class="muted">Tu as tous les pouvoirs !</p>';
}
$('shop-list').addEventListener('click', (ev) => {
  const b = ev.target.closest('.shop-item');
  if (b) askBuy(b.dataset.id);
});

// Buying a power.
let buying = null;
function askBuy(id) {
  buying = id;
  const p = progress.price(id);
  const enough = progress.s.crystals >= p;
  $('buy-img').src = art(id);
  $('buy-name').textContent = getEffect(id).name;
  $('buy-text').textContent = enough
    ? `Débloquer ce pouvoir pour 💎 ${p} ? Il te restera ${progress.s.crystals - p} cristaux.`
    : `Il te manque ${p - progress.s.crystals} cristaux. Réussis les défis du jour pour en gagner !`;
  $('buy-ok').hidden = !enough;
  $('buy').hidden = false;
}
$('buy-ok').addEventListener('click', () => {
  if (buying && progress.buy(buying)) {
    audio.init();
    audio.play('coin', 1);
    $('buy').hidden = true;
    renderHub();
    renderShop();
    openStudio(buying);
  }
});
$('buy-cancel').addEventListener('click', () => ($('buy').hidden = true));
progress.onChange(() => {
  if (!studioOpen) renderHub();
});

let unlockBusy = false;
function flushUnlocks() {
  if (unlockBusy || studioOpen || !$('news').hidden) return;
  const next = progress.takeQueue();
  if (!next.length) return;
  unlockBusy = true;
  const show = (i) => {
    if (i >= next.length || studioOpen) {
      $('unlock').hidden = true;
      unlockBusy = false;
      // Anything left goes back to the queue.
      progress.queue.unshift(...next.slice(i));
      return;
    }
    const u = next[i];
    $('unlock-icon').textContent = u.icon;
    $('unlock-title').textContent = u.title;
    $('unlock-text').textContent = u.text;
    $('unlock').hidden = false;
    $('unlock').classList.remove('pop');
    void $('unlock').offsetWidth;
    $('unlock').classList.add('pop');
    audio.play('chime', 0.6);
    setTimeout(() => show(i + 1), 2600);
  };
  show(0);
}

// "What's new" once per big update (after the first-launch question).
const NEWS_KEY = 'magic-cam-news-3';
function showNews() {
  try {
    if (localStorage.getItem(NEWS_KEY) || !settings.pointsAsked) return;
  } catch {
    return;
  }
  $('news').hidden = false;
}
$('news-ok').addEventListener('click', () => {
  $('news').hidden = true;
  try {
    localStorage.setItem(NEWS_KEY, '1');
  } catch {
    /* shown again next time */
  }
  flushUnlocks();
});

// ---------- Boot ----------
buildPowers();
progress.checkIn();
renderHub();
setTimeout(flushUnlocks, 1500);
setTimeout(showNews, 600);
updateToggles();
refreshMiniThumb();
askPoints();
document.addEventListener('pointerdown', () => audio.init(), { passive: true });
loadModels();

// ---------- Install & automatic updates ----------
let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  $('install-btn').hidden = false;
  $('install-settings').hidden = false;
});
async function install() {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice.catch(() => {});
  installEvent = null;
  $('install-btn').hidden = true;
  $('install-settings').hidden = true;
}
$('install-btn').addEventListener('click', install);
$('install-settings').addEventListener('click', install);
window.addEventListener('appinstalled', () => ($('install-btn').hidden = true));

// The installed app updates itself: the service worker checks for a new
// version at each launch and when the app comes back to the screen; the new
// version takes over and the page reloads (never in the middle of filming).
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  let reloadPending = false;
  const reloadWhenIdle = () => {
    if (studioOpen) reloadPending = true;
    else location.reload();
  };
  navigator.serviceWorker
    .register('sw.js', { updateViaCache: 'none' })
    .then((reg) => {
      const check = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => !document.hidden && check());
      setInterval(check, 30 * 60 * 1000);
    })
    .catch(() => {});
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => hadController && reloadWhenIdle());
  $('btn-back').addEventListener('click', () => reloadPending && location.reload());
}
