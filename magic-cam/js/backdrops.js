// Magic backdrops (like a green screen): the silhouette found by the AI stays,
// everything behind you is replaced by an animated scene drawn here.
import { makeCanvas, rand, TAU, drawGlow } from './fx/util.js';

export const BACKDROPS = {
  off: { name: 'Sans décor' },
  space: { name: 'Espace' },
  volcano: { name: 'Volcan' },
  forest: { name: 'Forêt enchantée' },
  temple: { name: 'Temple au coucher du soleil' },
};

// The still part of each scene, drawn once per size.
function paintStatic(kind, W, H) {
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, H);
  const ground = (color, base, amp, freq, seed) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += W / 60)
      g.lineTo(x, H * base - Math.abs(Math.sin(x * freq + seed) + Math.sin(x * freq * 2.3 + seed * 2) * 0.5) * H * amp);
    g.lineTo(W, H);
    g.fill();
  };
  if (kind === 'space') {
    sky.addColorStop(0, '#02010a');
    sky.addColorStop(1, '#0b0620');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    for (const [x, y, r, col] of [
      [0.25, 0.3, 0.45, [120, 60, 220]],
      [0.75, 0.55, 0.4, [40, 120, 230]],
      [0.55, 0.2, 0.25, [230, 80, 160]],
    ])
      drawGlow(g, col, W * x, H * y, Math.max(W, H) * r, 0.35, 0.05);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = `rgba(255,255,255,${rand(0.2, 0.9)})`;
      const s = rand(0.5, 2);
      g.fillRect(rand(W), rand(H), s, s);
    }
    // A planet on the horizon.
    const R = Math.max(W, H) * 0.35;
    const pg = g.createRadialGradient(W * 0.8 - R * 0.3, H * 1.05 - R * 0.3, R * 0.1, W * 0.8, H * 1.05, R);
    pg.addColorStop(0, '#6aa8ff');
    pg.addColorStop(0.7, '#1b3b8a');
    pg.addColorStop(1, '#081436');
    g.fillStyle = pg;
    g.beginPath();
    g.arc(W * 0.8, H * 1.05, R, 0, TAU);
    g.fill();
  } else if (kind === 'volcano') {
    sky.addColorStop(0, '#1a0505');
    sky.addColorStop(0.6, '#5a1408');
    sky.addColorStop(1, '#c2410c');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    drawGlow(g, [255, 120, 30], W * 0.5, H * 0.55, Math.max(W, H) * 0.5, 0.5, 0.05);
    // Volcano with its glowing crater.
    g.fillStyle = '#140606';
    g.beginPath();
    g.moveTo(W * 0.1, H);
    g.lineTo(W * 0.42, H * 0.45);
    g.lineTo(W * 0.58, H * 0.45);
    g.lineTo(W * 0.9, H);
    g.fill();
    drawGlow(g, [255, 160, 40], W * 0.5, H * 0.45, W * 0.12, 0.9, 0.3);
    ground('#0a0303', 0.95, 0.08, 0.01, 1);
  } else if (kind === 'forest') {
    sky.addColorStop(0, '#04111a');
    sky.addColorStop(1, '#0d2b22');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    drawGlow(g, [200, 230, 255], W * 0.7, H * 0.2, Math.max(W, H) * 0.12, 0.8, 0.4);
    // Layers of pine trees, lighter far away.
    for (const [shade, base, n] of [
      ['#123a35', 0.75, 14],
      ['#0b2622', 0.85, 10],
      ['#051512', 1.0, 7],
    ]) {
      g.fillStyle = shade;
      for (let i = 0; i < n; i++) {
        const x = ((i + rand(-0.3, 0.3)) / (n - 1)) * W;
        const h = H * rand(0.35, 0.55);
        const w = h * 0.35;
        g.beginPath();
        g.moveTo(x, H * base - h);
        g.lineTo(x + w / 2, H * base);
        g.lineTo(x - w / 2, H * base);
        g.fill();
      }
      g.fillRect(0, H * base - 2, W, H);
    }
  } else if (kind === 'temple') {
    sky.addColorStop(0, '#2b1748');
    sky.addColorStop(0.5, '#c2477a');
    sky.addColorStop(1, '#ffb36b');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    drawGlow(g, [255, 220, 150], W * 0.5, H * 0.72, Math.max(W, H) * 0.3, 0.7, 0.2);
    ground('#3a1b3a', 0.82, 0.12, 0.006, 2);
    // Pagoda silhouette.
    g.fillStyle = '#1c0d1f';
    const cx = W * 0.25;
    const base = H * 0.85;
    const s = H * 0.09;
    for (let i = 0; i < 4; i++) {
      const y = base - i * s * 1.25;
      const w = s * (3 - i * 0.5);
      g.fillRect(cx - w * 0.35, y - s, w * 0.7, s);
      g.beginPath();
      g.moveTo(cx - w * 0.75, y - s);
      g.quadraticCurveTo(cx, y - s * 1.6, cx + w * 0.75, y - s);
      g.lineTo(cx + w * 0.5, y - s * 1.3);
      g.lineTo(cx - w * 0.5, y - s * 1.3);
      g.fill();
    }
    g.fillRect(0, base, W, H - base);
  }
  return c;
}

export class Backdrop {
  constructor() {
    this.kind = 'off';
    this.cache = null;
    this.bits = [];
  }

  set(kind) {
    this.kind = BACKDROPS[kind] ? kind : 'off';
    this.cache = null;
    this.bits = [];
  }

  get on() {
    return this.kind !== 'off';
  }

  // Draws the scene (still part + moving bits) over the whole canvas.
  draw(ctx, W, H, t, dt, unit) {
    if (!this.cache || this.cache.width !== W || this.cache.height !== H) this.cache = paintStatic(this.kind, W, H);
    ctx.drawImage(this.cache, 0, 0);
    // Moving bits: twinkling stars, embers, fireflies, falling petals.
    const k = this.kind;
    const want = k === 'space' ? 40 : 60;
    while (this.bits.length < want)
      this.bits.push({
        x: rand(W),
        y: k === 'volcano' ? H + rand(H * 0.3) : k === 'temple' ? -rand(H) : rand(H),
        s: rand(1, 3),
        ph: rand(TAU),
        v: rand(0.5, 1.5),
      });
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.bits) {
      if (k === 'space') {
        const a = 0.4 + 0.6 * Math.abs(Math.sin(t * b.v * 2 + b.ph));
        drawGlow(ctx, [200, 220, 255], b.x, b.y, b.s * 3 * unit, a, 0.5);
      } else if (k === 'volcano') {
        b.y -= dt * 60 * b.v * unit;
        b.x += Math.sin(t + b.ph) * dt * 20;
        if (b.y < -10) b.y = H + 10;
        drawGlow(ctx, [255, 140, 40], b.x, b.y, b.s * 3 * unit, 0.8, 0.5);
      } else if (k === 'forest') {
        b.x += Math.sin(t * 0.7 + b.ph) * dt * 30;
        b.y += Math.cos(t * 0.5 + b.ph) * dt * 20;
        const a = Math.max(0, Math.sin(t * 2 * b.v + b.ph));
        drawGlow(ctx, [200, 255, 120], b.x, b.y, b.s * 4 * unit, a, 0.4);
      } else if (k === 'temple') {
        ctx.globalCompositeOperation = 'source-over';
        b.y += dt * 40 * b.v * unit;
        b.x += Math.sin(t + b.ph) * dt * 40 * unit;
        if (b.y > H + 10) {
          b.y = -10;
          b.x = rand(W);
        }
        ctx.fillStyle = 'rgba(255,190,215,0.85)';
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.s * 2.5 * unit, b.s * 1.4 * unit, t + b.ph, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
