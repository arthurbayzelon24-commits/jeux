import { EFFECTS, getEffect } from './effects.js';
import { Engine } from './engine.js';
import { Tracker } from './tracker.js';
import { SoundFx } from './audio.js';
import { CanvasRecorder, extensionFor } from './recorder.js';
import { gallery, videoThumbnail } from './gallery.js';
import { quality } from './fx/util.js';
import { MESH_POINTS } from './handmesh.js';

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
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
};
const svg = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
const paintIcons = (root = document) => root.querySelectorAll('[data-icon]').forEach((el) => (el.innerHTML = svg(el.dataset.icon)));
paintIcons();

const $ = (id) => document.getElementById(id);

// ---------- Settings ----------
const SETTINGS_KEY = 'magic-cam-settings-v4';
const DEFAULTS = {
  quality: '32k',
  fpsTarget: '250',
  fxQuality: 'ultra',
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
  pointsAsked: false,
  eco: false,
};
const settings = (() => {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
    // Keep the earlier answers, but switch to the new smooth default.
    const old = JSON.parse(localStorage.getItem('magic-cam-settings-v3') || localStorage.getItem('magic-cam-settings-v2') || '{}');
    delete old.quality;
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
const maxSideFor = (q) => SIDES[q] || Math.min(1920, Math.max(1280, screenSide()));
const cameraFps = () => Number(settings.fpsTarget) || 250;
const PARTICLES = { ultra: 1.6, high: 1, eco: 0.5 };

// ---------- Core objects ----------
const video = $('cam');
const stage = $('stage');
const audio = new SoundFx();
audio.setEnabled(settings.sound);
const engine = new Engine(stage, { audio, settings, maxSide: maxSideFor(settings.quality) });
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

function buildPowers() {
  const grid = $('powers');
  const carousel = $('carousel');
  for (const def of EFFECTS) {
    const fx = getEffect(def.id);
    const card = document.createElement('button');
    card.className = 'power';
    card.dataset.id = def.id;
    card.style.setProperty('--tint', def.tint);
    card.innerHTML = `<span class="power-art"><img src="${art(def.id)}" alt="" loading="lazy" decoding="async"></span><span class="power-name">${fx.name}</span><span class="power-gesture">${def.gesture}</span>`;
    card.addEventListener('click', () => openStudio(def.id));
    grid.append(card);

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
}

// ---------- Pages over the app ----------
let pageFrom = 'home';
async function showPage(name) {
  pageFrom = studioOpen ? 'studio' : 'home';
  if (studioOpen) await closeStudio();
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  if (name === 'gallery') renderGallery();
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
  const fx = getEffect(id);
  engine.setEffect(fx);
  if (fx.colors && colorIndex[id] !== undefined) fx.setColor(colorIndex[id]);
  updateSwatch();
  $('power-pill').innerHTML = `<img class="pill-icon" src="${art(def.id)}" alt="">${fx.name}`;
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
  $('vignette').hidden = !settings.cinema;
  $('fps').hidden = !settings.fps;
}

async function startCamera() {
  stopCamera();
  if (!window.isSecureContext) throw Object.assign(new Error('insecure'), { name: 'InsecureContext' });
  if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('unsupported'), { name: 'Unsupported' });
  const portrait = window.innerHeight > window.innerWidth;
  const long = settings.quality === 'smooth' ? 1920 : maxSideFor(settings.quality);
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
  video.srcObject = stream;
  await video.play().catch(() => {});
  if (!video.videoWidth) await new Promise((r) => video.addEventListener('loadedmetadata', r, { once: true }));
  audio.attachMic(stream);
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
  studioOpen = true;
  $('view-studio').hidden = false;
  document.body.classList.add('in-studio');
  $('error').hidden = true;
  // The loading screen only shows the first time, while the models download.
  $('loading').hidden = tracker.ready;
  audio.init();
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
  $('view-studio').hidden = true;
  document.body.classList.remove('in-studio');
}

function loop(now) {
  if (!studioOpen) return;
  loopId = requestAnimationFrame(loop);
  if (video.readyState < 2 || !video.videoWidth) return;
  const fx = engine.effect;
  const wantSeg = !!fx?.needs?.seg;
  // Each new camera frame goes to the detection worker; rendering never waits
  // for it, and the engine predicts the hands' motion in between.
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    tracker.request(video, wantSeg, settings.points || !!fx?.needs?.pose);
  }
  const det = tracker.take(wantSeg);
  adaptResolution(now);
  // Never let one bad frame stop the loop.
  try {
    engine.frame({
      source: video,
      sw: video.videoWidth,
      sh: video.videoHeight,
      mirror: settings.mirror && facing === 'user',
      raw: det.raw,
      mask: det.mask,
      maskFresh: det.maskFresh,
      pose: det.pose,
      now,
    });
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
    $('fps').textContent = `${Math.round(fps)} i/s · détection ${Math.round(tracker.detectFps)} i/s · ${MESH_POINTS} points/main`;
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

async function startRecording() {
  if (!window.MediaRecorder || !stage.captureStream) return;
  const btn = $('btn-record');
  btn.classList.add('arming');
  const go = await countdown();
  btn.classList.remove('arming');
  if (!go || !studioOpen) return;
  try {
    recorder.start({ audioTracks: audio.recordTracks.slice(0, 1) });
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
  if (show) showResult(item);
  else if (settings.autosave) await gallery.add(item);
}

async function takePhoto() {
  const flash = $('shutter-flash');
  flash.classList.remove('go');
  void flash.offsetWidth;
  flash.classList.add('go');
  audio.play('shutter', 0.8);
  const blob = await new Promise((r) => stage.toBlob(r, 'image/jpeg', 0.92));
  if (!blob) return;
  const c = document.createElement('canvas');
  const k = 320 / Math.max(stage.width, stage.height);
  c.width = stage.width * k;
  c.height = stage.height * k;
  c.getContext('2d').drawImage(stage, 0, 0, c.width, c.height);
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
  $('result').hidden = false;
}

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
async function renderGallery() {
  const items = await gallery.list();
  const grid = $('gallery-grid');
  grid.innerHTML = '';
  $('gallery-empty').hidden = items.length > 0;
  for (const item of items) {
    const el = document.createElement('button');
    el.className = 'media-item';
    const fx = getEffect(item.effect);
    const date = new Date(item.created).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    el.innerHTML = `${item.thumb ? `<img alt="" src="${item.thumb}">` : ''}<span class="kind" data-icon="${item.kind === 'photo' ? 'image' : 'video'}"></span><div class="meta"><strong>${fx?.name || ''}</strong><br>${date}${item.kind === 'photo' ? '' : ` · ${Math.round(item.duration || 0)} s`}</div>`;
    el.addEventListener('click', () => showResult({ ...item, saved: true }, true));
    grid.append(el);
  }
  paintIcons(grid);
}

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
  saveSettings();
  audio.setEnabled(settings.sound);
  quality.particles = PARTICLES[settings.fxQuality] || 1;
  engine.maxSide = maxSideFor(settings.quality);
  updateToggles();
});
syncForm();
quality.particles = PARTICLES[settings.fxQuality] || 1;

// ---------- Boot ----------
buildPowers();
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
