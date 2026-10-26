// Teleportation: the body dissolves into particles and a glitch, the learned
// background shows through, then the body reappears somewhere else.
import { Particles, drawGlow, rand, TAU, makeCanvas, clamp, lerp } from './util.js';

const SPOTS = [0, -0.28, 0.28];
const COLORS = [
  { name: 'Cyan', rgb: [80, 220, 255] },
  { name: 'Violet', rgb: [190, 110, 255] },
  { name: 'Or', rgb: [255, 200, 80] },
];

export function teleportEffect() {
  const dust = new Particles(1400);
  let rgb = COLORS[0].rgb;
  let state = 'idle'; // idle | out | gone | in
  let timer = 0;
  let offset = 0;
  let target = 0;
  let spot = 0;
  let sample = null;
  let ring = null;
  // The learned background is rebuilt a few times a second, not every frame.
  let plate = null;
  let plateAge = 1;

  // Samples the person's pixels at low resolution to spawn coloured dust.
  const burst = (e, into) => {
    const s = e.seg;
    if (!s?.present) return;
    const sw = Math.round(e.W / 10);
    const sh = Math.round(e.H / 10);
    if (!sample || sample.width !== sw) sample = makeCanvas(sw, sh);
    const g = sample.getContext('2d', { willReadFrequently: true });
    g.clearRect(0, 0, sw, sh);
    g.drawImage(e.layers.person, 0, 0, sw, sh);
    const data = g.getImageData(0, 0, sw, sh).data;
    const dx = offset * e.W;
    const cx = s.centroid.x + dx;
    const cy = s.centroid.y;
    for (let y = 0; y < sh; y++)
      for (let x = 0; x < sw; x++) {
        const i = (y * sw + x) * 4;
        if (data[i + 3] < 140 || Math.random() > 0.55) continue;
        const px = (x / sw) * e.W + dx;
        const py = (y / sh) * e.H;
        const col = [data[i], data[i + 1], data[i + 2]];
        const a = Math.atan2(py - cy, px - cx) + rand(-0.6, 0.6);
        const v = rand(100, 500) * e.unit;
        const p = {
          x: px,
          y: py,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - rand(50, 250) * e.unit,
          drag: 1.4,
          life: rand(0.5, 1.1),
          size: rand(3, 7) * e.unit,
          col,
        };
        if (into) {
          // Reverse: start scattered and converge to the body.
          const t = p.life;
          p.tx = px;
          p.ty = py;
          p.x = px + Math.cos(a) * v * 0.6 * t;
          p.y = py + Math.sin(a) * v * 0.6 * t;
          p.vx = -Math.cos(a) * v * 0.6;
          p.vy = -Math.sin(a) * v * 0.6;
          p.drag = 0;
          p.into = true;
        }
        dust.add(p);
      }
  };

  const go = (e) => {
    if (state !== 'idle' || !e.seg?.present) return;
    state = 'out';
    timer = 0;
    spot = (spot + 1) % SPOTS.length;
    target = SPOTS[spot];
    burst(e, false);
    ring = { x: e.seg.centroid.x + offset * e.W, y: e.seg.centroid.y, t: 0 };
    e.flash(rgb, 0.35, 3);
    e.shake(8);
    e.audio.play('teleport', 1);
  };

  return {
    id: 'teleport',
    name: 'Téléportation',
    hint: 'Restez en entier dans l’image quelques secondes pour que le décor soit mémorisé, puis claquez des doigts comme Thanos (ou serrez le poing et ouvrez-le d’un coup).',
    colors: COLORS,
    needs: { seg: true, plate: true },
    action: { label: 'Téléporter', run: (e) => go(e) },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      dust.clear();
      state = 'idle';
      offset = 0;
      spot = 0;
    },
    trigger(e) {
      go(e);
    },
    update(dt, hands, e) {
      dust.update(dt);
      if (ring) ring.t += dt;
      if (hands.some((h) => h.events.snap || h.events.release)) go(e);
      timer += dt;
      if (state === 'out' && timer > 0.45) {
        state = 'gone';
        timer = 0;
      } else if (state === 'gone' && timer > 0.55) {
        state = 'in';
        timer = 0;
        offset = target;
        burst(e, true);
        ring = { x: (e.seg?.centroid.x ?? e.W / 2) + offset * e.W, y: e.seg?.centroid.y ?? e.H / 2, t: 0 };
        e.flash(rgb, 0.5, 2.5);
        e.shake(10);
        e.audio.play('teleport', 0.8);
      } else if (state === 'in' && timer > 0.5) state = 'idle';
    },
    drawBackground(ctx, e) {
      if (!e.segActive) return false;
      const visible = state === 'idle' ? 1 : state === 'out' ? 1 - clamp(timer / 0.35) : state === 'gone' ? 0 : clamp(timer / 0.45);
      if (visible >= 1 && offset === 0) {
        ctx.drawImage(e.layers.frame, 0, 0);
        return true;
      }
      plateAge += e.dt;
      if (!plate || plateAge > (state === 'idle' ? 0.4 : 0.15)) {
        plate = e.backgroundPlate();
        plateAge = 0;
      }
      ctx.drawImage(plate, 0, 0, e.W, e.H);
      if (visible <= 0) return true;
      const dx = offset * e.W;
      const glitch = visible < 1;
      if (!glitch) {
        ctx.drawImage(e.layers.person, dx, 0);
        return true;
      }
      // Glitchy slices with a chromatic split while (de)materialising.
      const slices = 14;
      const h = e.H / slices;
      for (let i = 0; i < slices; i++) {
        const shift = (Math.random() < 0.4 ? rand(-40, 40) : 0) * e.unit * (1 - visible);
        ctx.globalAlpha = visible * (Math.random() < 0.15 ? 0.4 : 1);
        ctx.drawImage(e.layers.person, 0, i * h, e.W, h, dx + shift, i * h, e.W, h);
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 * (1 - visible);
      ctx.drawImage(e.layers.person, dx - 8 * e.unit, 0);
      ctx.drawImage(e.layers.person, dx + 8 * e.unit, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      return true;
    },
    draw(ctx, e) {
      dust.draw(ctx, (c, p, t) => {
        const a = p.into ? Math.min(1, t * 3) * (1 - t * 0.3) : 1 - t;
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = clamp(a);
        c.fillStyle = `rgb(${p.col[0]},${p.col[1]},${p.col[2]})`;
        c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        if (p.glow === undefined) p.glow = Math.random() < 0.35;
        if (!p.glow) return;
        c.globalCompositeOperation = 'lighter';
        drawGlow(c, rgb, p.x, p.y, p.size * 2.2, a * 0.6);
      });
      ctx.globalAlpha = 1;
      if (ring && ring.t < 0.9) {
        const t = ring.t / 0.9;
        ctx.globalCompositeOperation = 'lighter';
        const R = lerp(0.05, 0.6, t) * e.H;
        for (let i = 0; i < 3; i++) {
          ctx.strokeStyle = `rgba(${rgb.join(',')},${(1 - t) * (0.8 - i * 0.2)})`;
          ctx.lineWidth = (14 - i * 4) * e.unit * (1 - t) + 1;
          ctx.beginPath();
          ctx.ellipse(ring.x, ring.y, R * (1 + i * 0.12), R * 0.35 * (1 + i * 0.12), 0, 0, TAU);
          ctx.stroke();
        }
        drawGlow(ctx, rgb, ring.x, ring.y, e.H * 0.5 * (1 - t), 0.6 * (1 - t), 0.1);
        // Vertical beam.
        const bw = e.W * 0.08 * (1 - t);
        const grad = ctx.createLinearGradient(ring.x - bw, 0, ring.x + bw, 0);
        grad.addColorStop(0, `rgba(${rgb.join(',')},0)`);
        grad.addColorStop(0.5, `rgba(255,255,255,${0.7 * (1 - t)})`);
        grad.addColorStop(1, `rgba(${rgb.join(',')},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(ring.x - bw, 0, bw * 2, e.H);
        ctx.globalCompositeOperation = 'source-over';
      }
      for (const h of e.hands) {
        if (h.presence < 0.1 || !h.fist) continue;
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, rgb, h.palm.x + offset * e.W, h.palm.y, h.size * 1.4, 0.6 * h.presence);
        ctx.globalCompositeOperation = 'source-over';
      }
    },
  };
}
