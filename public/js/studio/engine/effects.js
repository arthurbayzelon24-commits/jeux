/**
 * Visual effects. Every effect listed here is really rendered by the
 * compositor; effects that need a capability we do not have are listed in
 * UNAVAILABLE_EFFECTS with the reason, and never offered as working.
 *
 * Effect shapes:
 *   filter(p)                 -> CSS canvas filter fragment applied while drawing the clip
 *   jitter(p, t)              -> { dx, dy, rot, scale } transform offset (normalized)
 *   post(ctx, w, h, p, t, s)  -> pixel/overlay pass on the clip layer (s = shared scratch)
 */

const rand = (seed) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

let noiseCanvas = null;
function noise() {
  if (noiseCanvas) return noiseCanvas;
  noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = noiseCanvas.height = 256;
  const ctx = noiseCanvas.getContext('2d');
  const img = ctx.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return noiseCanvas;
}

function scratch(s, w, h, key = 'a') {
  const c = (s[key] ??= document.createElement('canvas'));
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  return c;
}

/** Draws `source` channels shifted horizontally: red left, blue right. */
function rgbSplit(ctx, w, h, amount, s) {
  if (amount <= 0) return;
  const copy = scratch(s, w, h, 'rgb');
  const cctx = copy.getContext('2d');
  cctx.clearRect(0, 0, w, h);
  cctx.drawImage(ctx.canvas, 0, 0);
  const tint = scratch(s, w, h, 'rgbTint');
  const tctx = tint.getContext('2d');
  const channel = (color, dx) => {
    tctx.globalCompositeOperation = 'source-over';
    tctx.clearRect(0, 0, w, h);
    tctx.drawImage(copy, dx, 0);
    tctx.globalCompositeOperation = 'multiply';
    tctx.fillStyle = color;
    tctx.fillRect(0, 0, w, h);
    tctx.globalCompositeOperation = 'destination-in';
    tctx.drawImage(copy, dx, 0);
    ctx.drawImage(tint, 0, 0);
  };
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'lighter';
  channel('#ff0000', -amount);
  channel('#00ff00', 0);
  channel('#0000ff', amount);
  ctx.restore();
}

export const EFFECTS = [
  // ---- blur & sharpness
  {
    id: 'blur',
    label: 'Flou',
    category: 'Flou et netteté',
    params: [{ key: 'radius', label: 'Rayon', min: 0, max: 40, step: 0.5, default: 6 }],
    filter: (p) => `blur(${p.radius}px)`,
  },
  {
    id: 'sharpen',
    label: 'Netteté',
    category: 'Flou et netteté',
    heavy: true,
    params: [{ key: 'amount', label: 'Intensité', min: 0, max: 2, step: 0.05, default: 0.6 }],
    post(ctx, w, h, p) {
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      const src = new Uint8ClampedArray(d);
      const row = w * 4;
      const k = p.amount;
      for (let y = 1; y < h - 1; y += 1) {
        for (let x = 1; x < w - 1; x += 1) {
          const i = y * row + x * 4;
          for (let c = 0; c < 3; c += 1) {
            const blur = (src[i + c - 4] + src[i + c + 4] + src[i + c - row] + src[i + c + row]) / 4;
            d[i + c] = src[i + c] + k * (src[i + c] - blur);
          }
        }
      }
      ctx.putImageData(img, 0, 0);
    },
  },
  {
    id: 'trail',
    label: 'Traînée de mouvement',
    category: 'Flou et netteté',
    params: [{ key: 'amount', label: 'Persistance', min: 0, max: 0.95, step: 0.05, default: 0.6 }],
    post(ctx, w, h, p, t, s) {
      const prev = scratch(s, w, h, 'trail');
      const pctx = prev.getContext('2d');
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.globalAlpha = p.amount;
      ctx.drawImage(prev, 0, 0);
      ctx.restore();
      pctx.clearRect(0, 0, w, h);
      pctx.drawImage(ctx.canvas, 0, 0);
    },
  },
  // ---- light
  {
    id: 'glow',
    label: 'Lueur',
    category: 'Lumière',
    params: [
      { key: 'radius', label: 'Diffusion', min: 2, max: 60, step: 1, default: 18 },
      { key: 'strength', label: 'Intensité', min: 0, max: 1, step: 0.05, default: 0.6 },
    ],
    post(ctx, w, h, p, t, s) {
      const copy = scratch(s, w, h, 'glow');
      const c = copy.getContext('2d');
      c.clearRect(0, 0, w, h);
      c.filter = `blur(${p.radius}px) brightness(1.4)`;
      c.drawImage(ctx.canvas, 0, 0);
      c.filter = 'none';
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = p.strength;
      ctx.drawImage(copy, 0, 0);
      ctx.restore();
    },
  },
  {
    id: 'light-leak',
    label: 'Fuite de lumière',
    category: 'Lumière',
    params: [
      { key: 'strength', label: 'Intensité', min: 0, max: 1, step: 0.05, default: 0.45 },
      { key: 'speed', label: 'Vitesse', min: 0, max: 2, step: 0.05, default: 0.4 },
    ],
    post(ctx, w, h, p, t) {
      const x = w * (0.5 + 0.45 * Math.sin(t * p.speed));
      const g = ctx.createRadialGradient(x, h * 0.2, 0, x, h * 0.2, Math.max(w, h) * 0.8);
      g.addColorStop(0, 'rgba(255,160,90,0.9)');
      g.addColorStop(0.4, 'rgba(255,80,160,0.4)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = p.strength;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
  },
  {
    id: 'particles',
    label: 'Particules lumineuses',
    category: 'Lumière',
    params: [
      { key: 'count', label: 'Nombre', min: 10, max: 300, step: 10, default: 80 },
      { key: 'size', label: 'Taille', min: 0.5, max: 6, step: 0.5, default: 2 },
    ],
    post(ctx, w, h, p, t) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < p.count; i += 1) {
        const x = (rand(i + 1) * w + t * 20 * (rand(i + 7) - 0.5)) % w;
        const y = (((rand(i + 3) * h - t * 30 * (0.3 + rand(i + 5))) % h) + h) % h;
        const a = 0.3 + 0.7 * Math.abs(Math.sin(t * 2 + i));
        ctx.fillStyle = i % 3 ? `rgba(69,229,245,${a})` : `rgba(139,92,246,${a})`;
        ctx.beginPath();
        ctx.arc((x + w) % w, y, p.size * (0.5 + rand(i)), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
  },
  {
    id: 'vignette',
    label: 'Vignettage',
    category: 'Lumière',
    params: [{ key: 'amount', label: 'Intensité', min: 0, max: 1, step: 0.05, default: 0.5 }],
    post(ctx, w, h, p) {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) / 2);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${p.amount})`);
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
  },
  // ---- stylize / retro
  {
    id: 'grain',
    label: 'Grain de film',
    category: 'Rétro et cinéma',
    params: [{ key: 'amount', label: 'Intensité', min: 0, max: 0.6, step: 0.02, default: 0.18 }],
    post(ctx, w, h, p, t) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = p.amount;
      const pattern = ctx.createPattern(noise(), 'repeat');
      ctx.translate((rand(Math.floor(t * 24)) * 256) | 0, (rand(Math.floor(t * 24) + 9) * 256) | 0);
      ctx.fillStyle = pattern;
      ctx.fillRect(-256, -256, w + 512, h + 512);
      ctx.restore();
    },
  },
  {
    id: 'vhs',
    label: 'VHS',
    category: 'Rétro et cinéma',
    params: [{ key: 'amount', label: 'Intensité', min: 0, max: 1, step: 0.05, default: 0.6 }],
    filter: (p) => `saturate(${1 + p.amount * 0.3}) contrast(${1 + p.amount * 0.15})`,
    post(ctx, w, h, p, t, s) {
      rgbSplit(ctx, w, h, Math.round(2 + p.amount * 5), s);
      ctx.save();
      ctx.globalAlpha = 0.18 * p.amount;
      ctx.fillStyle = '#000';
      for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1.5);
      const band = ((t * 0.25) % 1) * h;
      ctx.globalAlpha = 0.12 * p.amount;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, band, w, h * 0.04);
      ctx.restore();
    },
  },
  {
    id: 'glitch',
    label: 'Glitch numérique',
    category: 'Numérique',
    params: [
      { key: 'amount', label: 'Intensité', min: 0, max: 1, step: 0.05, default: 0.5 },
      { key: 'rate', label: 'Fréquence', min: 1, max: 30, step: 1, default: 12 },
    ],
    post(ctx, w, h, p, t, s) {
      const step = Math.floor(t * p.rate);
      if (rand(step) > 0.35 + (1 - p.amount) * 0.5) return;
      const copy = scratch(s, w, h, 'glitch');
      const c = copy.getContext('2d');
      c.clearRect(0, 0, w, h);
      c.drawImage(ctx.canvas, 0, 0);
      const slices = 3 + Math.floor(rand(step + 1) * 8);
      for (let i = 0; i < slices; i += 1) {
        const y = rand(step * 13 + i) * h;
        const sh = rand(step * 7 + i) * h * 0.08 + 2;
        const dx = (rand(step * 3 + i) - 0.5) * w * 0.12 * p.amount;
        ctx.clearRect(0, y, w, sh);
        ctx.drawImage(copy, 0, y, w, sh, dx, y, w, sh);
      }
      rgbSplit(ctx, w, h, Math.round(4 + 10 * p.amount * rand(step + 5)), s);
    },
  },
  {
    id: 'rgb-split',
    label: 'Aberration chromatique',
    category: 'Numérique',
    params: [{ key: 'amount', label: 'Décalage (px)', min: 0, max: 30, step: 1, default: 6 }],
    post: (ctx, w, h, p, t, s) => rgbSplit(ctx, w, h, p.amount, s),
  },
  {
    id: 'pixelate',
    label: 'Pixelisation',
    category: 'Numérique',
    params: [{ key: 'size', label: 'Taille des pixels', min: 2, max: 80, step: 1, default: 16 }],
    post(ctx, w, h, p, t, s) {
      const small = scratch(s, Math.max(1, Math.round(w / p.size)), Math.max(1, Math.round(h / p.size)), 'pix');
      const c = small.getContext('2d');
      c.clearRect(0, 0, small.width, small.height);
      c.drawImage(ctx.canvas, 0, 0, small.width, small.height);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(small, 0, 0, w, h);
      ctx.restore();
    },
  },
  {
    id: 'scanlines',
    label: 'Écran cathodique',
    category: 'Rétro et cinéma',
    params: [{ key: 'amount', label: 'Intensité', min: 0, max: 1, step: 0.05, default: 0.4 }],
    post(ctx, w, h, p) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = p.amount * 0.5;
      ctx.fillStyle = '#000';
      for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
      ctx.restore();
    },
  },
  {
    id: 'sepia',
    label: 'Sépia',
    category: 'Rétro et cinéma',
    params: [{ key: 'amount', label: 'Intensité', min: 0, max: 1, step: 0.05, default: 0.8 }],
    filter: (p) => `sepia(${p.amount})`,
  },
  {
    id: 'noir',
    label: 'Noir et blanc',
    category: 'Rétro et cinéma',
    params: [{ key: 'contrast', label: 'Contraste', min: 0.5, max: 2, step: 0.05, default: 1.2 }],
    filter: (p) => `grayscale(1) contrast(${p.contrast})`,
  },
  {
    id: 'cinematic',
    label: 'Bandes cinéma',
    category: 'Rétro et cinéma',
    params: [{ key: 'size', label: 'Hauteur', min: 0, max: 0.25, step: 0.01, default: 0.12 }],
    post(ctx, w, h, p) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h * p.size);
      ctx.fillRect(0, h * (1 - p.size), w, h * p.size);
      ctx.restore();
    },
  },
  {
    id: 'invert',
    label: 'Négatif',
    category: 'Couleur',
    params: [{ key: 'amount', label: 'Intensité', min: 0, max: 1, step: 0.05, default: 1 }],
    filter: (p) => `invert(${p.amount})`,
  },
  {
    id: 'duotone',
    label: 'Duotone SOLVEX',
    category: 'Couleur',
    params: [{ key: 'amount', label: 'Intensité', min: 0, max: 1, step: 0.05, default: 0.7 }],
    filter: () => 'grayscale(1)',
    post(ctx, w, h, p) {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#4263FF');
      g.addColorStop(1, '#8B5CF6');
      // Tint the (already grayscale) layer while keeping its transparency.
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = p.amount * 0.65;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
  },
  // ---- camera
  {
    id: 'shake',
    label: 'Caméra tremblante',
    category: 'Caméra',
    params: [
      { key: 'amount', label: 'Amplitude', min: 0, max: 0.05, step: 0.001, default: 0.012 },
      { key: 'speed', label: 'Vitesse', min: 1, max: 30, step: 1, default: 12 },
    ],
    jitter: (p, t) => ({
      dx: (rand(Math.floor(t * p.speed)) - 0.5) * p.amount * 2,
      dy: (rand(Math.floor(t * p.speed) + 3) - 0.5) * p.amount * 2,
      rot: (rand(Math.floor(t * p.speed) + 5) - 0.5) * p.amount * 40,
      scale: 1 + p.amount,
    }),
  },
  {
    id: 'pulse',
    label: 'Zoom rythmé',
    category: 'Caméra',
    params: [
      { key: 'amount', label: 'Amplitude', min: 0, max: 0.3, step: 0.01, default: 0.06 },
      { key: 'bpm', label: 'Tempo (BPM)', min: 40, max: 200, step: 1, default: 120 },
    ],
    jitter: (p, t) => {
      const phase = (t * p.bpm) / 60;
      const beat = Math.exp(-((phase % 1) * 6));
      return { dx: 0, dy: 0, rot: 0, scale: 1 + p.amount * beat };
    },
  },
  {
    id: 'mirror',
    label: 'Miroir',
    category: 'Caméra',
    params: [{ key: 'axis', label: 'Axe (0 = vertical, 1 = horizontal)', min: 0, max: 1, step: 1, default: 0 }],
    post(ctx, w, h, p, t, s) {
      const copy = scratch(s, w, h, 'mirror');
      const c = copy.getContext('2d');
      c.clearRect(0, 0, w, h);
      c.drawImage(ctx.canvas, 0, 0);
      ctx.save();
      if (p.axis < 0.5) {
        ctx.clearRect(w / 2, 0, w / 2, h);
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(copy, 0, 0, w / 2, h, 0, 0, w / 2, h);
      } else {
        ctx.clearRect(0, h / 2, w, h / 2);
        ctx.translate(0, h);
        ctx.scale(1, -1);
        ctx.drawImage(copy, 0, 0, w, h / 2, 0, 0, w, h / 2);
      }
      ctx.restore();
    },
  },
];

export const EFFECT_MAP = Object.fromEntries(EFFECTS.map((e) => [e.id, e]));

export function defaultParams(effectId) {
  return Object.fromEntries((EFFECT_MAP[effectId]?.params || []).map((p) => [p.key, p.default]));
}

/** Requested by the brief but not implemented: listed honestly in the UI. */
export const UNAVAILABLE_EFFECTS = [
  { label: 'Correction fisheye / distorsion d’objectif', reason: 'Nécessite un remappage de pixels (WebGL) non encore implémenté.' },
  { label: 'Lumière volumétrique', reason: 'Nécessite une estimation de profondeur.' },
  { label: 'Effets de profondeur (bokeh réel)', reason: 'Nécessite une carte de profondeur (modèle IA non connecté).' },
  { label: 'Stabilisation', reason: 'Nécessite une estimation du mouvement image par image (non implémentée).' },
  { label: 'Réduction du scintillement', reason: 'Analyse temporelle non implémentée.' },
];
