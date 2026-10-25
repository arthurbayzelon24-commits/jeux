import { EFFECTS, getEffect } from './effects.js';
import { Engine } from './engine.js';
import { Tracker } from './tracker.js';
import { SoundFx } from './audio.js';
import { CanvasRecorder, extensionFor } from './recorder.js';
import { gallery, videoThumbnail } from './gallery.js';
import { renderPreview } from './preview.js';
import { quality } from './fx/util.js';

// ---------- Icons ----------
const ICONS = {
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.6"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 1-1 1.7v.5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
  flip: '<path d="M4 9a8 8 0 0 1 14-3l2 2M20 15a8 8 0 0 1-14 3l-2-2"/><path d="M20 4v4h-4M4 20v-4h4"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  hand: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V5.5a1.5 1.5 0 0 1 3 0V13M17 9.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.6-2.8L3.2 16a1.6 1.6 0 0 1 2.5-2L8 16"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
  video: '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  sparkle:
    '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 2l.6 1.4L7 4l-1.4.6L5 6l-.6-1.4L3 4l1.4-.6z"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  share:
    '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
};
const svg = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
const paintIcons = (root = document) => root.querySelectorAll('[data-icon]').forEach((el) => (el.innerHTML = svg(el.dataset.icon)));
paintIcons();

const $ = (id) => document.getElementById(id);

// ---------- Settings ----------
const DEFAULTS = {
  quality: '720',
  maxDuration: '60',
  countdown: '0',
  mirror: true,
  cinema: true,
  autosave: true,
  mic: true,
  sound: true,
  skeleton: false,
  eco: false,
};
const settings = (() => {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('magic-cam-settings') || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
})();
const saveSettings = () => {
  try {
    localStorage.setItem('magic-cam-settings', JSON.stringify(settings));
  } catch {
    /* private mode: settings only last for this visit */
  }
};
const maxSideFor = (q) => ({ 480: 854, 720: 1280, 1080: 1920 })[q] || 1280;

// ---------- Toast ----------
let toastTimer;
function toast(msg, ms = 2600) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ---------- Navigation ----------
let currentView = 'home';
function showView(name) {
  currentView = name;
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
  window.scrollTo(0, 0);
  if (name === 'gallery') renderGallery();
}
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));
document.querySelectorAll('[data-start]').forEach((b) => b.addEventListener('click', () => openStudio(currentEffect)));

// ---------- Effect cards with rendered previews ----------
const previews = new Map();
let currentEffect = (() => {
  try {
    return localStorage.getItem('magic-cam-effect') || EFFECTS[0].id;
  } catch {
    return EFFECTS[0].id;
  }
})();

function buildCards() {
  const grid = $('effects-grid');
  const carousel = $('carousel');
  for (const def of EFFECTS) {
    const fx = getEffect(def.id);
    const card = document.createElement('button');
    card.className = 'card';
    card.dataset.id = def.id;
    card.innerHTML = `<div class="card-media"></div><span class="card-tag">${def.tag}</span><span class="card-name">${fx.name}</span>`;
    card.addEventListener('click', () => openStudio(def.id));
    grid.append(card);

    const chip = document.createElement('button');
    chip.className = 'fx-chip';
    chip.dataset.id = def.id;
    chip.setAttribute('role', 'option');
    chip.innerHTML = `<div class="thumb"></div><span>${fx.name}</span>`;
    chip.addEventListener('click', () => selectEffect(def.id, true));
    carousel.append(chip);
  }
  // Render previews one by one without blocking the page.
  const queue = [...EFFECTS];
  const next = () => {
    const def = queue.shift();
    if (!def) return;
    try {
      const url = renderPreview(def);
      previews.set(def.id, url);
      document.querySelectorAll(`[data-id="${def.id}"] .card-media, [data-id="${def.id}"] .thumb`).forEach((el) => {
        el.innerHTML = '';
        const img = new Image();
        img.alt = '';
        img.src = url;
        el.append(img);
      });
    } catch (err) {
      console.warn('Aperçu impossible', def.id, err);
    }
    if (window.requestIdleCallback) requestIdleCallback(next, { timeout: 300 });
    else setTimeout(next, 30);
  };
  setTimeout(next, 50);
}

// ---------- Hero sky (golden dust) ----------
function heroSky() {
  const c = $('hero-sky');
  const g = c.getContext('2d');
  let w;
  let h;
  const dots = Array.from({ length: 120 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() * 1.6 + 0.3,
    s: Math.random() * 0.02 + 0.005,
    p: Math.random() * 6,
  }));
  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = c.clientWidth;
    h = c.clientHeight;
    c.width = w * dpr;
    c.height = h * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);
  const tick = (t) => {
    if (currentView === 'home' && !studioOpen) {
      g.clearRect(0, 0, w, h);
      for (const d of dots) {
        d.y -= d.s * 0.05;
        if (d.y < 0) d.y = 1;
        const a = 0.4 + 0.6 * Math.sin(t / 700 + d.p);
        g.fillStyle = `rgba(255,${200 + d.r * 20},${120 + d.r * 40},${a * 0.8})`;
        g.beginPath();
        g.arc(d.x * w, d.y * h, d.r, 0, Math.PI * 2);
        g.fill();
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------- Studio ----------
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
let noHandSince = 0;
let hintTimer;
const colorIndex = {};

function setStatus(text) {
  $('status-chip').textContent = text;
}

function selectEffect(id, fromUser = false) {
  currentEffect = id;
  try {
    localStorage.setItem('magic-cam-effect', id);
  } catch {
    /* ignore */
  }
  const fx = getEffect(id);
  engine.setEffect(fx);
  if (fx.colors && colorIndex[id] !== undefined) fx.setColor(colorIndex[id]);
  updateSwatch();
  document.querySelectorAll('.fx-chip').forEach((c) => {
    const on = c.dataset.id === id;
    c.classList.toggle('active', on);
    c.setAttribute('aria-selected', on);
    if (on) c.scrollIntoView({ inline: 'center', block: 'nearest', behavior: fromUser ? 'smooth' : 'auto' });
  });
  const action = $('btn-action');
  action.hidden = !fx.action;
  if (fx.action) action.textContent = fx.action.label;
  if (fx.needs?.seg && tracker.hands && !tracker.hasSegmentation)
    toast('La détection du corps n’a pas pu être chargée : cet effet sera limité.');
  showHint(fx);
}

function showHint(fx) {
  const el = $('hint');
  el.textContent = fx.hint;
  el.hidden = false;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => (el.hidden = true), 6000);
}

function updateSwatch() {
  const fx = getEffect(currentEffect);
  const i = colorIndex[currentEffect] ?? 0;
  const c = fx.colors?.[i];
  const rgb = c?.rgb || c?.glow || c?.hue || [255, 150, 60];
  $('swatch').style.background = c?.rgb === null ? 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' : `rgb(${rgb.join(',')})`;
  $('btn-color').hidden = !fx.colors?.length;
}

async function startCamera() {
  stopCamera();
  const portrait = window.innerHeight > window.innerWidth;
  const long = maxSideFor(settings.quality);
  const short = Math.round((long * 9) / 16);
  const videoC = {
    facingMode: facing,
    width: { ideal: portrait ? short : long },
    height: { ideal: portrait ? long : short },
    frameRate: { ideal: 30 },
  };
  if (!window.isSecureContext) throw Object.assign(new Error('insecure'), { name: 'InsecureContext' });
  if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('unsupported'), { name: 'Unsupported' });
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: videoC,
      audio: settings.mic ? { echoCancellation: true, noiseSuppression: true } : false,
    });
  } catch (err) {
    if (!settings.mic) throw err;
    // Microphone refused or missing: try again with the camera only.
    stream = await navigator.mediaDevices.getUserMedia({ video: videoC, audio: false });
    toast('Micro indisponible : les vidéos seront enregistrées avec les sons des effets seulement.');
  }
  video.srcObject = stream;
  await video.play().catch(() => {});
  if (!video.videoWidth) await new Promise((r) => video.addEventListener('loadedmetadata', r, { once: true }));
  audio.attachMic(stream);
  $('btn-flip').hidden = false;
}

function stopCamera() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  video.srcObject = null;
}

function showError(err) {
  const map = {
    NotAllowedError: [
      'Autorisation refusée',
      'Magic Cam a besoin de la caméra pour fonctionner. Touchez l’icône de cadenas ou de caméra dans la barre d’adresse, autorisez la caméra pour ce site, puis réessayez. Sur iPhone : Réglages › Safari › Caméra › Autoriser.',
    ],
    NotFoundError: ['Aucune caméra trouvée', 'Branchez une webcam ou utilisez un appareil équipé d’une caméra.'],
    NotReadableError: ['Caméra occupée', 'Une autre application utilise déjà la caméra. Fermez-la (visio, autre onglet…) puis réessayez.'],
    OverconstrainedError: ['Caméra incompatible', 'Essayez une qualité plus basse dans les paramètres.'],
    InsecureContext: [
      'Connexion non sécurisée',
      'Les navigateurs n’autorisent la caméra que sur une adresse en https:// (ou localhost). Ouvrez Magic Cam depuis son adresse sécurisée.',
    ],
    Unsupported: [
      'Navigateur non compatible',
      'Ce navigateur ne permet pas d’utiliser la caméra. Utilisez une version récente de Chrome, Edge, Safari ou Firefox.',
    ],
    ModelError: [
      'Chargement impossible',
      'Les modèles de détection n’ont pas pu être téléchargés. Vérifiez votre connexion Internet puis réessayez.',
    ],
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
  $('tabbar').hidden = true;
  document.body.style.overflow = 'hidden';
  $('error').hidden = true;
  $('loading').hidden = false;
  $('loading-text').textContent = 'Accès à la caméra…';
  $('loading-sub').textContent = 'Autorisez la caméra quand votre navigateur le demande.';
  audio.init();
  updateToggles();
  selectEffect(id || currentEffect);
  refreshMiniThumb();
  try {
    await startCamera();
    if (!trackerReady) {
      $('loading-text').textContent = 'Préparation de la magie…';
      $('loading-sub').textContent = 'Téléchargement des modèles de détection (une seule fois)';
      trackerReady = tracker.load((p) => {
        $('loading-bar').style.width = `${Math.round(p * 100)}%`;
        $('loading-text').textContent = `Préparation de la magie… ${Math.round(p * 100)} %`;
      });
      trackerReady.catch(() => (trackerReady = null));
    }
    await trackerReady.catch((err) => {
      console.error(err);
      throw Object.assign(new Error('model'), { name: 'ModelError' });
    });
  } catch (err) {
    if (!studioOpen) return;
    showError(err);
    return;
  }
  if (!studioOpen) return;
  $('loading').hidden = true;
  if (getEffect(currentEffect).needs?.seg && !tracker.hasSegmentation)
    toast('La détection du corps n’a pas pu être chargée : cet effet sera limité.');
  engine.tracker.reset();
  noHandSince = performance.now();
  cancelAnimationFrame(loopId);
  loopId = requestAnimationFrame(loop);
}

async function closeStudio() {
  if (recorder.recording) await stopRecording();
  studioOpen = false;
  cancelAnimationFrame(loopId);
  stopCamera();
  audio.stopLoops();
  $('view-studio').hidden = true;
  $('tabbar').hidden = false;
  document.body.style.overflow = '';
  $('hint').hidden = true;
}

function loop(now) {
  if (!studioOpen) return;
  loopId = requestAnimationFrame(loop);
  if (video.readyState < 2 || !video.videoWidth) return;
  const fx = engine.effect;
  let det = { raw: null, mask: tracker.mask, maskFresh: false };
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    try {
      det = tracker.detect(video, !!fx?.needs?.seg);
    } catch (err) {
      console.warn(err);
    }
  }
  const mirror = settings.mirror && facing === 'user';
  engine.frame({
    source: video,
    sw: video.videoWidth,
    sh: video.videoHeight,
    mirror,
    raw: det.raw,
    mask: fx?.needs?.seg ? det.mask : null,
    maskFresh: det.maskFresh,
    now,
  });

  // Status chip: guide the user when no hand is seen.
  const seen = engine.hands.some((h) => h.visible);
  if (seen) noHandSince = now;
  if (fx?.needs?.seg && fx.id !== 'floating') setStatus(engine.seg?.present ? '' : 'Reculez pour être visible');
  else if (fx?.id === 'sakura') setStatus('');
  else setStatus(now - noHandSince > 1500 ? '🖐 Montrez votre main' : '');
}

// ---------- Recording ----------
let recTimer = 0;
let lastResult = null;

async function countdown() {
  const n = Number(settings.countdown) || 0;
  const el = $('countdown');
  for (let i = n; i > 0; i--) {
    el.hidden = false;
    el.innerHTML = `<span>${i}</span>`;
    audio.play('chime', 0.4);
    await new Promise((r) => setTimeout(r, 1000));
    if (!studioOpen) break;
  }
  el.hidden = true;
}

async function startRecording() {
  if (!window.MediaRecorder || !stage.captureStream) {
    toast('L’enregistrement vidéo n’est pas pris en charge par ce navigateur. Utilisez la photo ou un navigateur récent.', 4000);
    return;
  }
  const btn = $('btn-record');
  btn.disabled = true;
  await countdown();
  btn.disabled = false;
  if (!studioOpen) return;
  try {
    recorder.start({ audioTracks: audio.recordTracks.slice(0, 1) });
  } catch (err) {
    toast(err.message, 4000);
    return;
  }
  btn.classList.add('recording');
  btn.setAttribute('aria-label', 'Arrêter l’enregistrement');
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

async function stopRecording() {
  cancelAnimationFrame(recTimer);
  const btn = $('btn-record');
  btn.classList.remove('recording');
  btn.setAttribute('aria-label', 'Enregistrer');
  $('rec-chip').hidden = true;
  $('rec-progress').style.strokeDashoffset = '289';
  const res = await recorder.stop();
  if (!res || !res.blob.size) {
    toast('L’enregistrement est vide, réessayez.');
    return;
  }
  const thumb = await videoThumbnail(res.blob);
  showResult({ kind: 'video', blob: res.blob, type: res.type, duration: res.duration, thumb, effect: currentEffect });
}

async function takePhoto() {
  const flash = $('shutter-flash');
  flash.classList.remove('go');
  void flash.offsetWidth;
  flash.classList.add('go');
  audio.play('shutter', 0.8);
  const blob = await new Promise((r) => stage.toBlob(r, 'image/jpeg', 0.92));
  if (!blob) return toast('Photo impossible.');
  const c = document.createElement('canvas');
  const k = 320 / Math.max(stage.width, stage.height);
  c.width = stage.width * k;
  c.height = stage.height * k;
  c.getContext('2d').drawImage(stage, 0, 0, c.width, c.height);
  showResult({ kind: 'photo', blob, type: 'image/jpeg', thumb: c.toDataURL('image/jpeg', 0.75), effect: currentEffect });
}

const fileName = (item) => {
  const d = new Date(item.created || Date.now());
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
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
  const size = (item.blob.size / 1024 / 1024).toFixed(1);
  const fx = getEffect(item.effect);
  $('result-info').textContent =
    `${fx?.name || ''} · ${item.kind === 'photo' ? 'Photo' : `${Math.round(item.duration || 0)} s`} · ${size} Mo · ${item.kind === 'photo' ? 'JPG' : extensionFor(item.type).toUpperCase()}${item.saved ? ' · enregistrée dans Mes vidéos' : ''}`;
  $('res-save').hidden = !!item.saved;
  $('result').hidden = false;
}

function closeResult() {
  const v = $('result-media').querySelector('video');
  v?.pause();
  if (lastResult?.url) URL.revokeObjectURL(lastResult.url);
  $('result').hidden = true;
  if (currentView === 'gallery') renderGallery();
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
  const data = { files: [file], title: 'Magic Cam', text: 'Fait avec Magic Cam ✨ #magiccam #magie' };
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share(data);
    } catch (err) {
      if (err.name !== 'AbortError') toast('Partage impossible : la vidéo a été téléchargée à la place.'), download(item);
    }
  } else {
    download(item);
    toast('Le partage direct n’est pas disponible ici : la vidéo a été téléchargée, vous pouvez la publier depuis vos fichiers.', 4500);
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
  toast('Enregistrée dans Mes vidéos');
});
$('res-delete').addEventListener('click', async () => {
  if (lastResult?.saved && lastResult.id) await gallery.remove(lastResult.id);
  refreshMiniThumb();
  closeResult();
  toast('Supprimée');
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
  toast('Toutes vos vidéos ont été supprimées.');
  refreshMiniThumb();
});

// ---------- Studio controls ----------
function updateToggles() {
  $('btn-sound').classList.toggle('off', !settings.sound);
  $('btn-sound').querySelector('[data-icon]').innerHTML = svg(settings.sound ? 'sound' : 'mute');
  $('btn-skeleton').classList.toggle('on', settings.skeleton);
  $('timer-label').textContent = Number(settings.countdown) ? `${settings.countdown}` : '';
  $('btn-timer').classList.toggle('on', Number(settings.countdown) > 0);
}

$('btn-back').addEventListener('click', closeStudio);
$('error-back').addEventListener('click', closeStudio);
$('error-retry').addEventListener('click', () => openStudio(currentEffect));
$('btn-record').addEventListener('click', () => (recorder.recording ? stopRecording() : startRecording()));
$('btn-photo').addEventListener('click', takePhoto);
$('btn-gallery').addEventListener('click', async () => {
  await closeStudio();
  showView('gallery');
});
$('btn-help').addEventListener('click', () => {
  const fx = getEffect(currentEffect);
  $('help-title').textContent = fx.name;
  $('help-text').textContent = fx.hint;
  $('help').hidden = false;
});
$('btn-flip').addEventListener('click', async () => {
  if (recorder.recording) return toast('Arrêtez l’enregistrement pour changer de caméra.');
  facing = facing === 'user' ? 'environment' : 'user';
  try {
    await startCamera();
    engine.tracker.reset();
  } catch {
    facing = facing === 'user' ? 'environment' : 'user';
    toast('Impossible de changer de caméra sur cet appareil.');
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
  toast(fx.colors[i].name, 1200);
});
$('btn-sound').addEventListener('click', () => {
  settings.sound = !settings.sound;
  audio.setEnabled(settings.sound);
  saveSettings();
  syncForm();
  updateToggles();
});
$('btn-skeleton').addEventListener('click', () => {
  settings.skeleton = !settings.skeleton;
  saveSettings();
  syncForm();
  updateToggles();
});
$('btn-timer').addEventListener('click', () => {
  const steps = ['0', '3', '5', '10'];
  settings.countdown = steps[(steps.indexOf(String(settings.countdown)) + 1) % steps.length];
  saveSettings();
  syncForm();
  updateToggles();
  toast(Number(settings.countdown) ? `Compte à rebours : ${settings.countdown} s` : 'Compte à rebours désactivé', 1200);
});
$('btn-action').addEventListener('click', () => engine.effect?.action?.run(engine));
// Double tap on the image also triggers the effect action (e.g. teleport).
let lastTap = 0;
stage.addEventListener('pointerup', () => {
  const now = performance.now();
  if (now - lastTap < 320) engine.effect?.action?.run(engine);
  lastTap = now;
});
document.querySelectorAll('.modal').forEach((m) =>
  m.addEventListener('click', (e) => {
    if (e.target === m || e.target.closest('[data-close]')) m.id === 'result' ? closeResult() : (m.hidden = true);
  }),
);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!$('result').hidden) closeResult();
    else if (!$('help').hidden) $('help').hidden = true;
    else if (studioOpen) closeStudio();
  }
  if (!studioOpen || e.target.closest('input, select')) return;
  if (e.key === ' ') {
    e.preventDefault();
    $('btn-record').click();
  }
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    const i = EFFECTS.findIndex((d) => d.id === currentEffect);
    const next = EFFECTS[(i + (e.key === 'ArrowRight' ? 1 : EFFECTS.length - 1)) % EFFECTS.length];
    selectEffect(next.id, true);
  }
  if (e.key.toLowerCase() === 't') engine.effect?.action?.run(engine);
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
  saveSettings();
  audio.setEnabled(settings.sound);
  quality.particles = settings.eco ? 0.5 : 1;
  engine.maxSide = maxSideFor(settings.quality);
});
syncForm();
quality.particles = settings.eco ? 0.5 : 1;

// ---------- Boot ----------
buildCards();
heroSky();
refreshMiniThumb();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
