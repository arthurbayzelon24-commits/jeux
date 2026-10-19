import { resolveClip } from './keyframes.js';
import { EFFECT_MAP } from './effects.js';
import { transitionState } from './transitions.js';

export const VISUAL_KINDS = new Set(['video', 'image', 'text', 'sticker', 'shape', 'placeholder']);

export function canvasFiltersSupported() {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!('filter' in ctx)) return false;
  ctx.filter = 'blur(2px)';
  return ctx.filter === 'blur(2px)';
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hexToRgb = (hex) => {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0'), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Visual clips to draw at time t, bottom layer first, with crossfade ghosts. */
export function visibleItems(project, t) {
  const items = [];
  const tracks = project.tracks.filter((track) => track.kind !== 'audio' && !track.hidden);
  for (const track of [...tracks].reverse()) {
    const onTrack = project.clips.filter((c) => c.trackId === track.id && VISUAL_KINDS.has(c.kind));
    for (const clip of onTrack) {
      if (t < clip.start || t >= clip.start + clip.duration) continue;
      const local = t - clip.start;
      const tin = clip.transitionIn;
      if (tin?.type === 'crossfade' && local < tin.duration) {
        const prev = onTrack.find((c) => c !== clip && Math.abs(c.start + c.duration - clip.start) < 0.05);
        if (prev) items.push({ clip: prev, local: prev.duration - 1 / 60, ghost: true, ghostAlpha: 1 });
      }
      items.push({ clip, local });
    }
  }
  return items;
}

export class Compositor {
  constructor() {
    this.layers = new Map();
    this.scratch = new Map();
    this.maskCanvas = document.createElement('canvas');
    this.filters = canvasFiltersSupported();
  }

  layer(key, w, h) {
    let canvas = this.layers.get(key);
    if (!canvas) {
      canvas = document.createElement('canvas');
      this.layers.set(key, canvas);
    }
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return canvas;
  }

  /** Free layers of clips that no longer exist. */
  prune(project) {
    const ids = new Set(project.clips.map((c) => c.id));
    for (const key of this.layers.keys()) if (!ids.has(key.replace(/:g$/, ''))) this.layers.delete(key);
    for (const key of this.scratch.keys()) if (!ids.has(key)) this.scratch.delete(key);
  }

  /**
   * Draws the frame at time t onto ctx. `getSource(clip)` returns a drawable
   * (HTMLVideoElement / HTMLImageElement) or null when not ready.
   */
  render(ctx, project, t, getSource, { showPlaceholders = true } = {}) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const unit = H / 1080;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.fillStyle = project.settings.background || '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    for (const item of visibleItems(project, t)) {
      if (item.clip.kind === 'placeholder' && !showPlaceholders) continue;
      this.drawItem(ctx, project, item, getSource, W, H, unit, t);
    }
    this.drawSubtitles(ctx, project, t, W, H, unit);
  }

  drawItem(ctx, project, item, getSource, W, H, unit, globalT) {
    const clip = resolveClip(item.clip, item.local);
    const local = item.local;
    const layer = this.layer(item.ghost ? `${clip.id}:g` : clip.id, W, H);
    const l = layer.getContext('2d', { willReadFrequently: Boolean(clip.chroma?.enabled) });
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalCompositeOperation = 'source-over';
    l.globalAlpha = 1;
    l.clearRect(0, 0, W, H);

    const effects = (clip.effects || []).filter((e) => EFFECT_MAP[e.type] && e.enabled !== false);
    let jitter = { dx: 0, dy: 0, rot: 0, scale: 1 };
    for (const e of effects) {
      const j = EFFECT_MAP[e.type].jitter?.(e.params, local);
      if (j) jitter = { dx: jitter.dx + j.dx, dy: jitter.dy + j.dy, rot: jitter.rot + j.rot, scale: jitter.scale * j.scale };
    }
    const filterParts = [this.colorFilter(clip.color), ...effects.map((e) => EFFECT_MAP[e.type].filter?.(e.params)).filter(Boolean)].filter(
      Boolean,
    );
    if (this.filters && filterParts.length) l.filter = filterParts.join(' ');

    const tr = clip.transform;
    l.save();
    l.translate(W * (tr.x + jitter.dx), H * (tr.y + jitter.dy));
    l.rotate(((tr.rotation + jitter.rot) * Math.PI) / 180);
    l.scale(tr.scale * jitter.scale * (clip.flipH ? -1 : 1), tr.scale * jitter.scale * (clip.flipV ? -1 : 1));
    let drew = true;
    if (clip.kind === 'video' || clip.kind === 'image') {
      const source = getSource(item.clip);
      const sw = source?.videoWidth || source?.naturalWidth || source?.width;
      const sh = source?.videoHeight || source?.naturalHeight || source?.height;
      if (source && sw && sh && (source.readyState === undefined || source.readyState >= 2)) {
        const fit = clip.fit === 'cover' ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh);
        const crop = { x: 0, y: 0, w: 1, h: 1, ...clip.crop };
        const dw = sw * crop.w * fit;
        const dh = sh * crop.h * fit;
        l.drawImage(source, sw * crop.x, sh * crop.y, sw * crop.w, sh * crop.h, -dw / 2, -dh / 2, dw, dh);
      } else drew = false;
    } else if (clip.kind === 'text') {
      drawText(l, clip.text, local, clip.duration, unit);
    } else if (clip.kind === 'sticker') {
      l.font = `${200 * unit}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      l.textAlign = 'center';
      l.textBaseline = 'middle';
      l.fillText(clip.sticker?.emoji || '⭐', 0, 0);
    } else if (clip.kind === 'shape') {
      drawShape(l, clip.shape || {}, W, H);
    } else if (clip.kind === 'placeholder') {
      l.filter = 'none';
      l.strokeStyle = 'rgba(130,148,255,0.7)';
      l.setLineDash([24 * unit, 16 * unit]);
      l.lineWidth = 4 * unit;
      l.strokeRect(-W * 0.45, -H * 0.42, W * 0.9, H * 0.84);
      l.fillStyle = 'rgba(66,99,255,0.12)';
      l.fillRect(-W * 0.45, -H * 0.42, W * 0.9, H * 0.84);
      l.fillStyle = 'rgba(245,247,255,0.85)';
      l.font = `600 ${44 * unit}px Inter, system-ui, sans-serif`;
      l.textAlign = 'center';
      l.textBaseline = 'middle';
      l.fillText(`${clip.name || 'Emplacement'} — déposez un média ici`, 0, 0);
    }
    l.restore();
    l.filter = 'none';
    if (!drew) return;

    const scratch = this.scratch.get(clip.id) || {};
    this.scratch.set(clip.id, scratch);
    if (clip.chroma?.enabled && (clip.kind === 'video' || clip.kind === 'image')) applyChroma(l, W, H, clip.chroma);
    this.colorPost(l, W, H, clip.color);
    for (const e of effects) EFFECT_MAP[e.type].post?.(l, W, H, e.params, local, scratch);
    if (clip.mask && clip.mask.type !== 'none') this.applyMask(l, W, H, clip.mask);

    // ---- composite with transition
    const state = (item.ghost ? null : transitionState(clip, local)) || {};
    if (state.dissolve !== undefined) applyDissolve(l, W, H, state.dissolve);
    // Ghosts (crossfade) stay fully visible underneath; the incoming clip fades in on top.
    const alpha = clamp(tr.opacity, 0, 1) * (item.ghost ? 1 : (state.alpha ?? 1));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = item.ghost ? 'source-over' : clip.blend || 'source-over';
    const filter = [];
    if (state.blur) filter.push(`blur(${state.blur * unit}px)`);
    if (state.brightness) filter.push(`brightness(${state.brightness})`);
    if (this.filters && filter.length) ctx.filter = filter.join(' ');
    if (state.shape) clipShape(ctx, state.shape, W, H);
    if (state.wipe) {
      const { p, d } = state.wipe;
      ctx.beginPath();
      if (d === 'left') ctx.rect(W * (1 - p), 0, W * p, H);
      else if (d === 'right') ctx.rect(0, 0, W * p, H);
      else if (d === 'up') ctx.rect(0, H * (1 - p), W, H * p);
      else ctx.rect(0, 0, W, H * p);
      ctx.clip();
    }
    ctx.translate(W / 2 + (state.dx || 0) * W, H / 2 + (state.dy || 0) * H);
    if (state.rotation) ctx.rotate((state.rotation * Math.PI) / 180);
    ctx.scale((state.scale ?? 1) * (state.scaleX ?? 1), state.scale ?? 1);
    if (state.glitch > 0.02) {
      const slices = 6;
      for (let i = 0; i < slices; i += 1) {
        const y = (H / slices) * i;
        const off = Math.sin(globalT * 90 + i * 7) * W * 0.06 * state.glitch;
        ctx.drawImage(layer, 0, y, W, H / slices, -W / 2 + off, y - H / 2, W, H / slices);
      }
    } else {
      ctx.drawImage(layer, -W / 2, -H / 2);
    }
    ctx.restore();
    if (state.overlay && state.overlay.alpha > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(state.overlay.alpha, 0, 1);
      ctx.fillStyle = state.overlay.color;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  colorFilter(color) {
    if (!color) return '';
    const parts = [];
    if (color.exposure) parts.push(`brightness(${1 + color.exposure / 100})`);
    if (color.contrast) parts.push(`contrast(${1 + color.contrast / 100})`);
    if (color.saturation) parts.push(`saturate(${1 + color.saturation / 100})`);
    if (color.hue) parts.push(`hue-rotate(${color.hue}deg)`);
    return parts.join(' ');
  }

  colorPost(l, W, H, color) {
    if (!color) return;
    l.save();
    l.globalCompositeOperation = 'source-atop';
    if (color.temperature) {
      l.globalAlpha = (Math.abs(color.temperature) / 100) * 0.3;
      l.fillStyle = color.temperature > 0 ? '#ff8a2a' : '#2a7dff';
      l.fillRect(0, 0, W, H);
    }
    if (color.tint) {
      l.globalAlpha = (Math.abs(color.tint) / 100) * 0.25;
      l.fillStyle = color.tint > 0 ? '#ff2ad4' : '#2aff6a';
      l.fillRect(0, 0, W, H);
    }
    if (color.vignette) {
      const g = l.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) / 2);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${color.vignette / 100})`);
      l.globalAlpha = 1;
      l.fillStyle = g;
      l.fillRect(0, 0, W, H);
    }
    l.restore();
  }

  applyMask(l, W, H, mask) {
    const m = this.maskCanvas;
    if (m.width !== W || m.height !== H) {
      m.width = W;
      m.height = H;
    }
    const c = m.getContext('2d');
    c.clearRect(0, 0, W, H);
    c.filter = this.filters && mask.feather > 0 ? `blur(${mask.feather * Math.min(W, H) * 0.5}px)` : 'none';
    c.fillStyle = '#fff';
    c.beginPath();
    if (mask.type === 'rect') c.rect(W * (mask.x - mask.w / 2), H * (mask.y - mask.h / 2), W * mask.w, H * mask.h);
    else if (mask.type === 'ellipse') c.ellipse(W * mask.x, H * mask.y, (W * mask.w) / 2, (H * mask.h) / 2, 0, 0, Math.PI * 2);
    else if (mask.type === 'polygon' && mask.points?.length > 2) {
      c.moveTo(mask.points[0][0] * W, mask.points[0][1] * H);
      for (const [x, y] of mask.points.slice(1)) c.lineTo(x * W, y * H);
      c.closePath();
    }
    c.fill();
    c.filter = 'none';
    l.save();
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalCompositeOperation = mask.invert ? 'destination-out' : 'destination-in';
    l.drawImage(m, 0, 0);
    l.restore();
  }

  drawSubtitles(ctx, project, t, W, H, unit) {
    const sub = project.subtitles?.find((s) => t >= s.start && t < s.end);
    if (!sub || !sub.text.trim()) return;
    const style = project.subtitleStyle || {};
    const size = (style.size || 48) * unit;
    ctx.save();
    ctx.font = `600 ${size}px Inter, "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const lines = sub.text.split('\n');
    const lineH = size * 1.3;
    const y0 = H * (style.position ?? 0.88) - ((lines.length - 1) * lineH) / 2;
    lines.forEach((line, i) => {
      // *mot* = highlighted word
      const parts = line.split(/(\*[^*]+\*)/).filter(Boolean);
      const plain = parts.map((p) => p.replace(/^\*|\*$/g, ''));
      const width = ctx.measureText(plain.join('')).width;
      const y = y0 + i * lineH;
      if (style.background) {
        ctx.fillStyle = style.background;
        roundRect(ctx, W / 2 - width / 2 - size * 0.4, y - lineH / 2, width + size * 0.8, lineH, size * 0.25);
        ctx.fill();
      }
      let x = W / 2 - width / 2;
      parts.forEach((part, j) => {
        ctx.fillStyle = part.startsWith('*') ? style.highlight || '#45E5F5' : style.color || '#fff';
        ctx.fillText(plain[j], x, y);
        x += ctx.measureText(plain[j]).width;
      });
    });
    ctx.restore();
  }
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  if (c.roundRect) c.roundRect(x, y, w, h, r);
  else c.rect(x, y, w, h);
}

const TEXT_ANIMS = ['none', 'fade', 'slide-up', 'slide-left', 'zoom', 'pop', 'blur', 'typewriter'];
export const TEXT_ANIM_LABELS = {
  none: 'Aucune',
  fade: 'Fondu',
  'slide-up': 'Glisser vers le haut',
  'slide-left': 'Glisser depuis la droite',
  zoom: 'Zoom',
  pop: 'Rebond',
  blur: 'Flou',
  typewriter: 'Machine à écrire',
};
export const TEXT_LOOPS = { none: 'Aucune', pulse: 'Pulsation', float: 'Flottement', wave: 'Vague' };
export { TEXT_ANIMS };

export function drawText(c, tx, local, duration, unit) {
  const d = Math.max(0.05, tx.animDuration ?? 0.5);
  const pin = tx.animIn && tx.animIn !== 'none' ? clamp(local / d, 0, 1) : 1;
  const pout = tx.animOut && tx.animOut !== 'none' ? clamp((duration - local) / d, 0, 1) : 1;
  const ease = (x) => 1 - (1 - x) ** 3;
  const size = tx.size * unit;
  let alpha = 1;
  let dx = 0;
  let dy = 0;
  let scale = 1;
  let blur = 0;
  let chars = Infinity;
  const total = tx.content.length;
  const applyAnim = (type, p) => {
    const e = ease(p);
    if (type === 'fade') alpha *= e;
    if (type === 'slide-up') ((dy += (1 - e) * size), (alpha *= e));
    if (type === 'slide-left') ((dx += (1 - e) * size * 3), (alpha *= e));
    if (type === 'zoom') ((scale *= 0.5 + 0.5 * e), (alpha *= e));
    if (type === 'pop') scale *= Math.max(0.01, e + Math.sin(p * Math.PI) * 0.2); // overshoots then settles at 1
    if (type === 'blur') ((blur += (1 - e) * 20), (alpha *= e));
    if (type === 'typewriter') chars = Math.min(chars, Math.floor(total * p));
  };
  applyAnim(tx.animIn, pin);
  applyAnim(tx.animOut, pout);
  if (tx.loop === 'pulse') scale *= 1 + 0.05 * Math.sin(local * 4);
  if (tx.loop === 'float') dy += Math.sin(local * 2) * size * 0.15;
  c.save();
  c.globalAlpha *= alpha;
  c.translate(dx, dy);
  c.scale(scale, scale);
  if (blur) c.filter = `${c.filter && c.filter !== 'none' ? c.filter : ''} blur(${blur * unit}px)`;
  c.font = `${tx.italic ? 'italic ' : ''}${tx.weight} ${size}px ${tx.font}`;
  if ('letterSpacing' in c) c.letterSpacing = `${(tx.letterSpacing || 0) * unit}px`;
  c.textAlign = tx.align || 'center';
  c.textBaseline = 'middle';
  let remaining = chars;
  const lines = tx.content.split('\n').map((line) => {
    const visible = line.slice(0, Math.max(0, remaining));
    remaining -= line.length + 1;
    return visible;
  });
  const fullLines = tx.content.split('\n');
  const lineH = size * (tx.lineHeight || 1.15);
  const widths = fullLines.map((line) => c.measureText(line).width);
  const maxW = Math.max(...widths, 1);
  const top = -((lines.length - 1) * lineH) / 2;
  const anchorX = tx.align === 'left' ? -maxW / 2 : tx.align === 'right' ? maxW / 2 : 0;
  if (tx.background) {
    c.fillStyle = tx.background;
    roundRect(c, -maxW / 2 - size * 0.35, top - lineH / 2 - size * 0.1, maxW + size * 0.7, lineH * lines.length + size * 0.2, size * 0.2);
    c.fill();
  }
  if (tx.gradient?.length === 2) {
    const g = c.createLinearGradient(-maxW / 2, 0, maxW / 2, 0);
    g.addColorStop(0, tx.gradient[0]);
    g.addColorStop(1, tx.gradient[1]);
    c.fillStyle = g;
  } else c.fillStyle = tx.color;
  if (tx.shadow) {
    c.shadowColor = `rgba(0,0,0,${clamp(tx.shadow, 0, 1)})`;
    c.shadowBlur = 24 * unit * tx.shadow;
    c.shadowOffsetY = 6 * unit * tx.shadow;
  }
  lines.forEach((line, i) => {
    const y = top + i * lineH;
    let x = anchorX;
    if (tx.loop === 'wave') {
      // per-letter wave
      const start =
        anchorX -
        (tx.align === 'center' ? c.measureText(fullLines[i]).width / 2 : tx.align === 'right' ? c.measureText(fullLines[i]).width : 0);
      c.textAlign = 'left';
      x = start;
      [...line].forEach((ch, k) => {
        const yy = y + Math.sin(local * 5 + k * 0.5) * size * 0.08;
        if (tx.strokeWidth) {
          c.lineWidth = tx.strokeWidth * unit;
          c.strokeStyle = tx.stroke;
          c.strokeText(ch, x, yy);
        }
        c.fillText(ch, x, yy);
        x += c.measureText(ch).width;
      });
      return;
    }
    if (tx.strokeWidth) {
      c.lineWidth = tx.strokeWidth * unit;
      c.lineJoin = 'round';
      c.strokeStyle = tx.stroke;
      c.strokeText(line, x, y);
    }
    c.fillText(line, x, y);
  });
  c.restore();
}

export function drawShape(c, s, W, H) {
  const w = (s.w ?? 0.3) * W;
  const h = (s.h ?? 0.2) * H;
  c.fillStyle = s.fill || '#4263FF';
  c.strokeStyle = s.stroke || '#F5F7FF';
  c.lineWidth = (s.strokeWidth ?? 0) * (H / 1080);
  c.beginPath();
  if (s.shape === 'ellipse') c.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (s.shape === 'arrow') {
    c.moveTo(-w / 2, -h * 0.15);
    c.lineTo(w * 0.15, -h * 0.15);
    c.lineTo(w * 0.15, -h / 2);
    c.lineTo(w / 2, 0);
    c.lineTo(w * 0.15, h / 2);
    c.lineTo(w * 0.15, h * 0.15);
    c.lineTo(-w / 2, h * 0.15);
    c.closePath();
  } else if (s.shape === 'line') {
    c.rect(-w / 2, -Math.max(2, h * 0.04) / 2, w, Math.max(2, h * 0.04));
  } else if (s.shape === 'frame') {
    c.rect(-w / 2, -h / 2, w, h);
    c.rect(-w / 2 + h * 0.06, -h / 2 + h * 0.06, w - h * 0.12, h - h * 0.12);
    c.fill('evenodd');
    return;
  } else roundRect(c, -w / 2, -h / 2, w, h, (s.radius ?? 0) * Math.min(w, h));
  if (s.fill !== 'transparent') c.fill();
  if (s.strokeWidth) c.stroke();
}

function clipShape(ctx, shape, W, H) {
  const p = clamp(shape.p, 0, 1);
  ctx.beginPath();
  if (shape.type === 'circle') ctx.arc(W / 2, H / 2, (Math.hypot(W, H) / 2) * p, 0, Math.PI * 2);
  else if (shape.type === 'diamond') {
    const r = Math.max(W, H) * p;
    ctx.moveTo(W / 2, H / 2 - r);
    ctx.lineTo(W / 2 + r, H / 2);
    ctx.lineTo(W / 2, H / 2 + r);
    ctx.lineTo(W / 2 - r, H / 2);
    ctx.closePath();
  } else if (shape.type === 'bars') {
    const half = (H / 2) * p;
    ctx.rect(0, H / 2 - half, W, half * 2);
  }
  ctx.clip();
}

const dissolveCache = { canvas: null, order: null };
function applyDissolve(l, W, H, p) {
  const cols = 32;
  const rows = 18;
  if (!dissolveCache.order) {
    dissolveCache.order = Array.from({ length: cols * rows }, (_, i) => i).sort(() => Math.random() - 0.5);
  }
  const count = Math.floor(p * cols * rows);
  l.save();
  l.setTransform(1, 0, 0, 1, 0, 0);
  l.globalCompositeOperation = 'destination-in';
  l.beginPath();
  const cw = W / cols;
  const ch = H / rows;
  for (let i = 0; i < count; i += 1) {
    const cell = dissolveCache.order[i];
    l.rect((cell % cols) * cw - 0.5, Math.floor(cell / cols) * ch - 0.5, cw + 1, ch + 1);
  }
  l.fillStyle = '#000';
  l.fill();
  l.restore();
}

/** Chroma key in YCbCr space with soft edge and spill suppression. */
export function applyChroma(l, W, H, chroma) {
  const img = l.getImageData(0, 0, W, H);
  const d = img.data;
  const [kr, kg, kb] = hexToRgb(chroma.color);
  const kcb = -0.168736 * kr - 0.331264 * kg + 0.5 * kb;
  const kcr = 0.5 * kr - 0.418688 * kg - 0.081312 * kb;
  const tol = chroma.tolerance * 120;
  const soft = Math.max(1, chroma.softness * 120);
  const dominant = kg >= kr && kg >= kb ? 1 : kb >= kr ? 2 : 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const cb = -0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 0.5 * r - 0.418688 * g - 0.081312 * b;
    const dist = Math.hypot(cb - kcb, cr - kcr);
    if (dist < tol) d[i + 3] = 0;
    else if (dist < tol + soft) d[i + 3] = d[i + 3] * ((dist - tol) / soft);
    if (chroma.spill > 0 && d[i + 3] > 0) {
      const ch = d[i + dominant];
      const other = Math.max(d[i + ((dominant + 1) % 3)], d[i + ((dominant + 2) % 3)]);
      if (ch > other) d[i + dominant] = ch - (ch - other) * chroma.spill;
    }
  }
  l.putImageData(img, 0, 0);
}
