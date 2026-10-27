// Ice: open hand breathes freezing mist and grows ice crystals on the
// fingertips; a closed fist makes frost creep in from the edges of the image
// (the longer you hold, the more everything freezes). Snow falls gently.
import { Particles, MESHES, drawMesh, drawGlow, rand, TAU, rotMatrix, makeCanvas, clamp } from './util.js';

const COLORS = [
  { name: 'Glace', rgb: [150, 220, 255] },
  { name: 'Givre bleu', rgb: [80, 160, 255] },
  { name: 'Cristal violet', rgb: [190, 160, 255] },
];

// Frost texture: branching crystal lines growing from the frame edges.
function frostTexture(W, H) {
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.lineCap = 'round';
  const branch = (x, y, a, len, w, depth) => {
    if (depth <= 0 || len < 3) return;
    const x2 = x + Math.cos(a) * len;
    const y2 = y + Math.sin(a) * len;
    g.strokeStyle = `rgba(230,245,255,${0.25 + depth * 0.08})`;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x2, y2);
    g.stroke();
    branch(x2, y2, a + rand(-0.3, 0.3), len * 0.8, w * 0.8, depth - 1);
    if (Math.random() < 0.7) branch(x2, y2, a + rand(0.6, 1.1), len * 0.55, w * 0.6, depth - 2);
    if (Math.random() < 0.7) branch(x2, y2, a - rand(0.6, 1.1), len * 0.55, w * 0.6, depth - 2);
  };
  const s = Math.min(W, H) / 720;
  for (let i = 0; i < 70; i++) {
    const side = i % 4;
    const t = Math.random();
    const [x, y, a] =
      side === 0 ? [t * W, 0, Math.PI / 2] : side === 1 ? [t * W, H, -Math.PI / 2] : side === 2 ? [0, t * H, 0] : [W, t * H, Math.PI];
    branch(x, y, a + rand(-0.5, 0.5), rand(30, 70) * s, 3 * s, 7);
  }
  // Frosted haze along the edges.
  const grad = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.55);
  grad.addColorStop(0, 'rgba(200,235,255,0)');
  grad.addColorStop(1, 'rgba(200,235,255,0.55)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  return c;
}

export function iceEffect() {
  const mist = new Particles(500);
  const snow = new Particles(250);
  let rgb = COLORS[0].rgb;
  let frost = 0;
  let tex = null;
  const crystals = new Map();

  return {
    id: 'ice',
    name: 'Pouvoir de glace',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      mist.clear();
      snow.clear();
      frost = 0;
      crystals.clear();
    },
    update(dt, hands, e) {
      mist.update(dt);
      snow.update(dt, (p, d) => (p.vx += Math.sin(e.t + p.y * 0.01) * 20 * d));
      if (Math.random() < dt * 25)
        snow.add({
          x: rand(e.W),
          y: -10,
          vx: rand(-20, 20),
          vy: rand(40, 90) * e.unit,
          life: 12,
          size: rand(2, 5) * e.unit,
          rgb: [240, 250, 255],
          core: 0.6,
          alpha: 0.8,
        });
      const fist = hands.some((h) => h.fist && h.presence > 0.5);
      frost = clamp(frost + (fist ? dt * 0.35 : -dt * 0.25));
      for (const h of hands) {
        const c = crystals.get(h.id) || { g: 0 };
        crystals.set(h.id, c);
        const open = h.open && h.presence > 0.5;
        c.g = clamp(c.g + (open ? dt * 1.2 : -dt * 2));
        if (open) {
          for (let i = 0; i < 4; i++) {
            const tip = h.tips[(Math.random() * 5) | 0];
            mist.add({
              x: tip.x,
              y: tip.y,
              vx: h.up.x * rand(40, 160) * e.unit + rand(-30, 30),
              vy: h.up.y * rand(40, 160) * e.unit - rand(10, 40),
              drag: 0.8,
              life: rand(0.8, 1.6),
              size: h.size * rand(0.2, 0.45),
              grow: 2.2,
              rgb,
              core: 0.05,
              alpha: 0.22,
            });
          }
          e.light(h.palm.x, h.palm.y, h.size * 5, rgb, 0.15);
        }
      }
      if (frost > 0.05 && Math.random() < frost * 0.05) e.audio.play('crack', 0.3);
      e.audio.loop('hum', frost * 0.3);
    },
    draw(ctx, e) {
      snow.draw(ctx);
      mist.draw(ctx);
      for (const [id, c] of crystals) {
        const h = e.hands.find((x) => x.id === id);
        if (!h || c.g < 0.02) continue;
        h.tips.forEach((tip, i) => {
          const dx = tip.x - h.lm[[3, 7, 11, 15, 19][i]].x;
          const dy = tip.y - h.lm[[3, 7, 11, 15, 19][i]].y;
          const a = Math.atan2(dy, dx);
          const s = h.size * 0.22 * c.g;
          ctx.globalCompositeOperation = 'lighter';
          drawGlow(ctx, rgb, tip.x, tip.y, s * 2.5, 0.5 * c.g);
          ctx.globalCompositeOperation = 'source-over';
          drawMesh(ctx, MESHES.octa, {
            x: tip.x + Math.cos(a) * s * 0.8,
            y: tip.y + Math.sin(a) * s * 0.8,
            size: s,
            rot: rotMatrix(0.3, e.t * 0.8 + i, -a + Math.PI / 2),
            rgb: [190, 230, 255],
            edge: [230, 250, 255],
            emissive: 0.45,
            alpha: 0.85,
          });
        });
      }
      if (frost > 0.01) {
        if (!tex || tex.width !== e.W || tex.height !== e.H) tex = frostTexture(e.W, e.H);
        ctx.globalAlpha = frost;
        ctx.drawImage(tex, 0, 0);
        ctx.globalAlpha = 1;
      }
    },
    ultimate(e) {
      frost = 1;
      for (let i = 0; i < 200; i++) {
        const a = rand(TAU);
        const v = rand(200, 1200) * e.unit;
        mist.add({
          x: e.W / 2,
          y: e.H / 2,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          drag: 2,
          life: rand(0.8, 1.6),
          size: rand(10, 40) * e.unit,
          grow: 2,
          rgb,
          core: 0.05,
          alpha: 0.3,
        });
      }
    },
  };
}
