// Magic aura: a flickering energy aura that hugs the silhouette (body
// segmentation), rising flames from the outline and glowing hands.
import { Particles, drawGlow, rand, pick, makeCanvas, noise1, makeBolt, strokeBolts } from './util.js';

const COLORS = [
  { name: 'Mystique', rgb: [90, 170, 255] },
  { name: 'Super or', rgb: [255, 200, 60] },
  { name: 'Ombre violette', rgb: [180, 80, 255] },
  { name: 'Nature', rgb: [70, 255, 140] },
  { name: 'Rage', rgb: [255, 60, 50] },
  { name: 'Arc-en-ciel', rgb: null },
];

export function auraEffect() {
  const back = new Particles(500);
  const front = new Particles(160);
  let color = COLORS[0].rgb;
  let rainbow = false;
  let small = null;
  let bolts = [];
  let boltTimer = 0;

  const currentColor = (t) => {
    if (!rainbow) return color;
    const h = (t * 60) % 360;
    const f = (n) => {
      const k = (n + h / 30) % 12;
      return Math.round(255 * (0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return [f(0), f(8), f(4)];
  };

  return {
    id: 'aura',
    name: 'Aura magique',
    hint: 'Placez-vous en entier dans l’image : une aura épouse votre silhouette. Levez les mains pour la faire monter en puissance.',
    colors: COLORS,
    needs: { seg: true },
    setColor(i) {
      rainbow = !COLORS[i].rgb;
      color = COLORS[i].rgb || color;
    },
    start() {
      back.clear();
      front.clear();
      small = null;
    },
    update(dt, hands, e) {
      const rgb = currentColor(e.t);
      back.update(dt, (p, d) => (p.vx += noise1(p.y * 0.03 + e.t * 2) * 200 * d));
      front.update(dt);
      const s = e.seg;
      // Raised hands power the aura up.
      const raised = hands.some((h) => h.presence > 0.5 && h.palm.y < (s?.centroid.y ?? e.H / 2) - h.size * 1.5);
      this.power = (this.power ?? 0.6) + ((raised ? 1.25 : 0.75) - (this.power ?? 0.6)) * Math.min(1, dt * 3);
      e.audio.loop('hum', 0.25 * this.power);
      if (!e.segActive || !s?.present || !s.edges.length) return;
      const n = Math.round(14 * this.power);
      for (let i = 0; i < n; i++) {
        const p = pick(s.edges);
        back.add({
          x: p.x,
          y: p.y,
          vx: rand(-30, 30),
          vy: -rand(80, 260) * e.unit * this.power,
          drag: 0.8,
          life: rand(0.4, 1.0),
          size: rand(10, 26) * e.unit,
          rgb,
          core: 0.1,
          alpha: 0.55,
        });
      }
      if (Math.random() < 0.5 * this.power) {
        const p = pick(s.edges);
        front.add({
          x: p.x,
          y: p.y,
          vx: rand(-20, 20),
          vy: -rand(150, 400) * e.unit,
          life: rand(0.3, 0.8),
          size: rand(2, 5) * e.unit,
          rgb: [255, 255, 255],
          core: 0.5,
          alpha: 0.9,
        });
      }
      boltTimer -= dt;
      if (this.power > 1 && boltTimer <= 0) {
        boltTimer = rand(0.08, 0.3);
        bolts = [];
        for (let k = 0; k < 2; k++) {
          const a = pick(s.edges);
          const b = { x: a.x + rand(-60, 60) * e.unit, y: a.y - rand(30, 120) * e.unit };
          bolts.push(...makeBolt(a.x, a.y, b.x, b.y, { jag: 0.35, depth: 4, branches: false }));
        }
        e.audio.play('zap', 0.15);
      } else if (boltTimer < 0.05) bolts = [];
      e.light(s.centroid.x, s.centroid.y, Math.max(e.W, e.H) * 0.55, rgb, 0.12 * this.power);
    },
    drawBehind(ctx, e) {
      const s = e.seg;
      if (!e.segActive || !s?.present) return;
      const rgb = currentColor(e.t);
      const sw = Math.round(e.W / 6);
      const sh = Math.round(e.H / 6);
      if (!small || small.width !== sw || small.height !== sh) small = makeCanvas(sw, sh);
      const g = small.getContext('2d');
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, sw, sh);
      const cx = (s.centroid.x / e.W) * sw;
      const cy = (s.centroid.y / e.H) * sh;
      // Several enlarged, rising, wobbling copies of the silhouette.
      for (let i = 0; i < 4; i++) {
        const k = 1 + (0.05 + i * 0.045) * this.power;
        const wob = noise1(e.t * 3 + i * 10) * sw * 0.012;
        g.globalAlpha = 0.55 - i * 0.1;
        g.setTransform(k, 0, 0, k + i * 0.02, cx * (1 - k) + wob, cy * (1 - k) - i * sh * 0.012 * this.power);
        g.drawImage(s.canvas, 0, 0, sw, sh);
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-in';
      const grad = g.createLinearGradient(0, 0, 0, sh);
      grad.addColorStop(0, `rgb(${rgb.map((c) => Math.min(255, c + 90)).join(',')})`);
      grad.addColorStop(1, `rgb(${rgb.join(',')})`);
      g.fillStyle = grad;
      g.fillRect(0, 0, sw, sh);
      g.globalCompositeOperation = 'source-over';

      ctx.globalCompositeOperation = 'lighter';
      const flick = 0.85 + 0.15 * noise1(e.t * 9);
      ctx.globalAlpha = Math.min(1, 0.95 * flick * this.power);
      ctx.drawImage(small, 0, 0, e.W, e.H);
      // A second, wider and softer halo.
      ctx.globalAlpha = 0.45 * this.power;
      const k = 1.06;
      ctx.drawImage(small, (e.W * (1 - k)) / 2 + (s.centroid.x - e.W / 2) * (1 - k), -e.H * 0.05, e.W * k, e.H * k);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      back.draw(ctx);
    },
    draw(ctx, e) {
      const rgb = currentColor(e.t);
      // Rim light on the silhouette edge, drawn over the person.
      if (e.segActive && e.seg?.present && small) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.18 * this.power;
        ctx.drawImage(small, 0, 0, e.W, e.H);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      strokeBolts(ctx, bolts, rgb, 1.6 * e.unit, 0.9);
      front.draw(ctx);
      for (const h of e.hands) {
        if (h.presence < 0.05) continue;
        ctx.globalCompositeOperation = 'lighter';
        const f = 0.8 + 0.2 * noise1(e.t * 8 + h.id);
        drawGlow(ctx, rgb, h.palm.x, h.palm.y, h.size * 1.6 * f, 0.5 * h.presence);
        for (const tip of h.tips) drawGlow(ctx, rgb, tip.x, tip.y, h.size * 0.3, 0.5 * h.presence);
        ctx.globalCompositeOperation = 'source-over';
      }
    },
  };
}
