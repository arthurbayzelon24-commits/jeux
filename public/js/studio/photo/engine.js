import { loadImageMedia } from '../media.js';
import { drawText, drawShape } from '../engine/compositor.js';
import { sharpen, denoise } from '../../lib/imageOps.js';

/**
 * Non-destructive photo rendering. Image layers keep their source untouched;
 * adjustments are applied to a cached, processed copy whenever they change.
 */
export const ADJUSTMENTS = [
  { key: 'exposure', label: 'Exposition', min: -100, max: 100 },
  { key: 'contrast', label: 'Contraste', min: -100, max: 100 },
  { key: 'highlights', label: 'Hautes lumières', min: -100, max: 100 },
  { key: 'shadows', label: 'Ombres', min: -100, max: 100 },
  { key: 'whites', label: 'Blancs', min: -100, max: 100 },
  { key: 'blacks', label: 'Noirs', min: -100, max: 100 },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100 },
  { key: 'vibrance', label: 'Vibrance', min: -100, max: 100 },
  { key: 'temperature', label: 'Température', min: -100, max: 100 },
  { key: 'tint', label: 'Teinte', min: -100, max: 100 },
  { key: 'hue', label: 'Rotation de teinte', min: -180, max: 180 },
  { key: 'sharpness', label: 'Netteté', min: 0, max: 100 },
  { key: 'noise', label: 'Réduction du bruit', min: 0, max: 100 },
  { key: 'vignette', label: 'Vignettage', min: 0, max: 100 },
];

export const FILTER_PRESETS = {
  aucun: { label: 'Original', adjust: {} },
  vivid: { label: 'Éclatant', adjust: { contrast: 15, saturation: 25, vibrance: 20 } },
  cinema: { label: 'Cinéma', adjust: { contrast: 20, shadows: 10, highlights: -15, saturation: -10, temperature: -15, vignette: 35 } },
  warm: { label: 'Doré', adjust: { exposure: 5, temperature: 35, tint: 5, saturation: 10 } },
  cold: { label: 'Glacé', adjust: { temperature: -35, contrast: 10, saturation: -5 } },
  fade: { label: 'Délavé', adjust: { contrast: -25, blacks: 30, saturation: -25 } },
  mono: { label: 'Noir et blanc', adjust: { saturation: -100, contrast: 20 } },
  noir: { label: 'Noir dramatique', adjust: { saturation: -100, contrast: 45, blacks: -20, vignette: 50 } },
  neon: { label: 'Néon SOLVEX', adjust: { contrast: 25, saturation: 35, temperature: -20, tint: 20, vignette: 25 } },
  matte: { label: 'Mat', adjust: { contrast: -10, blacks: 25, highlights: -10 } },
};

export const SOCIAL_SIZES = [
  ['Publication Instagram', 1080, 1080],
  ['Portrait Instagram', 1080, 1350],
  ['Story / Reel', 1080, 1920],
  ['Miniature YouTube', 1280, 720],
  ['Couverture Facebook', 1640, 624],
  ['Publication X', 1600, 900],
  ['Bannière LinkedIn', 1584, 396],
  ['Full HD', 1920, 1080],
];

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** 256-entry tone LUT from exposure/contrast/highlights/shadows/whites/blacks + optional curve points. */
export function toneLut(a, curve) {
  const lut = new Float32Array(256);
  const exp = 2 ** ((a.exposure || 0) / 50);
  const k = 1 + (a.contrast || 0) / 100;
  for (let i = 0; i < 256; i += 1) {
    let x = i / 255;
    x *= exp;
    x = (x - 0.5) * k + 0.5;
    const hl = (a.highlights || 0) / 100;
    const sh = (a.shadows || 0) / 100;
    x += hl * 0.35 * Math.max(0, x - 0.5) * 2 * (1 - Math.max(0, x - 0.5) * 2 * 0.5);
    x += sh * 0.35 * Math.max(0, 0.5 - x) * 2;
    const wh = (a.whites || 0) / 100;
    const bl = (a.blacks || 0) / 100;
    x = bl * 0.15 + x * (1 + wh * 0.15 - bl * 0.15);
    x = Math.min(1, Math.max(0, x));
    if (curve?.length >= 2) x = evalCurve(curve, x);
    lut[i] = x * 255;
  }
  return lut;
}

/** Monotone piecewise-linear curve through sorted [x, y] points in [0,1]. */
export function evalCurve(points, x) {
  const pts = [...points].sort((p, q) => p[0] - q[0]);
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / Math.max(1e-6, x1 - x0);
  }
  return pts.at(-1)[1];
}

/** Parses an Adobe/Resolve .cube 3D LUT. */
export function parseCube(text) {
  let size = 0;
  const data = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('LUT_3D_SIZE')) size = Number(trimmed.split(/\s+/)[1]);
    else if (/^[\d.+-]/.test(trimmed)) {
      const [r, g, b] = trimmed.split(/\s+/).map(Number);
      if ([r, g, b].every(Number.isFinite)) data.push(r, g, b);
    }
  }
  if (!size || data.length !== size * size * size * 3) throw new Error('Fichier .cube invalide ou non pris en charge (LUT 3D attendue).');
  return { size, data };
}

function applyLut3d(d, lut) {
  const n = lut.size;
  const max = n - 1;
  const t = lut.data;
  for (let i = 0; i < d.length; i += 4) {
    // nearest-neighbour lookup (red varies fastest in .cube files)
    const r = Math.round((d[i] / 255) * max);
    const g = Math.round((d[i + 1] / 255) * max);
    const b = Math.round((d[i + 2] / 255) * max);
    const idx = (r + g * n + b * n * n) * 3;
    d[i] = t[idx] * 255;
    d[i + 1] = t[idx + 1] * 255;
    d[i + 2] = t[idx + 2] * 255;
  }
}

/** Applies all pixel adjustments to a canvas in place. */
export async function processPixels(canvas, adjust = {}, { curve, lut } = {}) {
  const a = adjust;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const tone = toneLut(a, curve);
  const sat = 1 + (a.saturation || 0) / 100;
  const vib = (a.vibrance || 0) / 100;
  const temp = (a.temperature || 0) * 0.35;
  const tint = (a.tint || 0) * 0.25;
  const hue = ((a.hue || 0) * Math.PI) / 180;
  const cosH = Math.cos(hue);
  const sinH = Math.sin(hue);
  for (let i = 0; i < d.length; i += 4) {
    let r = tone[d[i]];
    let g = tone[d[i + 1]];
    let b = tone[d[i + 2]];
    r += temp;
    b -= temp;
    g -= tint;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const s = sat + vib * (1 - (mx - mn) / 255);
    r = lum + (r - lum) * s;
    g = lum + (g - lum) * s;
    b = lum + (b - lum) * s;
    if (hue) {
      // rotate chroma in YIQ space
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      const iq = 0.596 * r - 0.274 * g - 0.322 * b;
      const q = 0.211 * r - 0.523 * g + 0.312 * b;
      const i2 = iq * cosH - q * sinH;
      const q2 = iq * sinH + q * cosH;
      r = y + 0.956 * i2 + 0.621 * q2;
      g = y - 0.272 * i2 - 0.647 * q2;
      b = y - 1.106 * i2 + 1.703 * q2;
    }
    d[i] = clamp(r);
    d[i + 1] = clamp(g);
    d[i + 2] = clamp(b);
  }
  if (lut) applyLut3d(d, lut);
  ctx.putImageData(img, 0, 0);
  if (a.noise) await denoise(canvas, a.noise / 100);
  if (a.sharpness) await sharpen(canvas, (a.sharpness / 100) * 1.2);
  if (a.vignette) {
    const g2 = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      Math.min(canvas.width, canvas.height) * 0.3,
      canvas.width / 2,
      canvas.height / 2,
      Math.hypot(canvas.width, canvas.height) / 2,
    );
    g2.addColorStop(0, 'rgba(0,0,0,0)');
    g2.addColorStop(1, `rgba(0,0,0,${a.vignette / 100})`);
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
  return canvas;
}

/**
 * Renderer with a per-layer cache of processed bitmaps. `luts` maps lutId to
 * parsed LUT data.
 */
export class PhotoRenderer {
  constructor() {
    this.cache = new Map();
    this.luts = new Map();
  }

  async layerBitmap(layer, maxEdge, { original = false } = {}) {
    const img = await loadImageMedia(layer.mediaId);
    const crop = { x: 0, y: 0, w: 1, h: 1, ...layer.crop };
    const sw = img.naturalWidth * crop.w;
    const sh = img.naturalHeight * crop.h;
    const scale = Math.min(1, maxEdge / Math.max(sw, sh));
    const key = JSON.stringify([
      layer.mediaId,
      crop,
      original ? null : layer.adjust,
      original ? null : layer.curve,
      original ? null : layer.lutId,
      Math.round(sw * scale),
    ]);
    const cached = this.cache.get(layer.id);
    if (cached?.key === key) return cached.canvas;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));
    canvas
      .getContext('2d')
      .drawImage(img, img.naturalWidth * crop.x, img.naturalHeight * crop.y, sw, sh, 0, 0, canvas.width, canvas.height);
    const hasAdjust = !original && (Object.values(layer.adjust || {}).some((v) => v) || layer.curve || layer.lutId);
    if (hasAdjust) await processPixels(canvas, layer.adjust, { curve: layer.curve, lut: layer.lutId ? this.luts.get(layer.lutId) : null });
    this.cache.set(layer.id, { key, canvas });
    return canvas;
  }

  /** Renders the whole project onto ctx (canvas sized to the output). */
  async render(ctx, project, { original = false, hideIds = [] } = {}) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const bg = project.background || { type: 'color', color: '#000' };
    if (bg.type === 'gradient') {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, bg.colors[0]);
      g.addColorStop(1, bg.colors[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    } else if (bg.type === 'color') {
      ctx.fillStyle = bg.color;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
    for (const layer of project.layers) {
      if (layer.hidden || hideIds.includes(layer.id)) continue;
      ctx.save();
      ctx.globalAlpha = layer.opacity ?? 1;
      ctx.globalCompositeOperation = layer.blend || 'source-over';
      ctx.translate(W * layer.x, H * layer.y);
      ctx.rotate(((layer.rotation || 0) * Math.PI) / 180);
      ctx.scale((layer.scale || 1) * (layer.flipH ? -1 : 1), (layer.scale || 1) * (layer.flipV ? -1 : 1));
      if (layer.kind === 'image') {
        const bmp = await this.layerBitmap(layer, Math.max(project.settings.width, project.settings.height), { original });
        // Image layers are sized to fit the canvas at scale 1 (like the video editor).
        const fit = layer.fit === 'cover' ? Math.max(W / bmp.width, H / bmp.height) : Math.min(W / bmp.width, H / bmp.height);
        ctx.drawImage(bmp, (-bmp.width * fit) / 2, (-bmp.height * fit) / 2, bmp.width * fit, bmp.height * fit);
      } else if (layer.kind === 'text') {
        drawText(ctx, { ...layer.text, animIn: 'none', animOut: 'none', loop: 'none' }, 1, 2, H / 1080);
      } else if (layer.kind === 'shape') {
        drawShape(ctx, layer.shape, W, H);
      } else if (layer.kind === 'sticker') {
        ctx.font = `${200 * (H / 1080)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(layer.emoji, 0, 0);
      }
      ctx.restore();
    }
  }
}
