// Black hole: an open palm opens a black hole with a blazing accretion disk
// above it; stars and dust spiral in and vanish. The longer you hold, the
// bigger and hungrier it gets.
import { drawGlow, rand, TAU, palmPoint, clamp } from './util.js';

const COLORS = [
  { name: 'Interstellaire', rgb: [255, 170, 80] },
  { name: 'Quasar', rgb: [120, 180, 255] },
  { name: 'Nébuleuse', rgb: [255, 90, 200] },
];

export function blackholeEffect() {
  let rgb = COLORS[0].rgb;
  let infall = [];
  const disk = Array.from({ length: 420 }, () => ({
    a: rand(TAU),
    r: 1.15 + Math.random() ** 2 * 1.4,
    s: rand(0.6, 2),
    w: rand(0.7, 1.3),
  }));
  const state = new Map();

  return {
    id: 'blackhole',
    name: 'Trou noir',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      infall = [];
      state.clear();
    },
    update(dt, hands, e) {
      for (const d of disk) d.a += dt * (2.4 / d.r) * d.w;
      let main = null;
      for (const h of hands) {
        const st = state.get(h.id) || { g: 0 };
        state.set(h.id, st);
        st.g = clamp(st.g + ((h.open || h.gesture === 'relaxed') && h.presence > 0.5 ? dt * 0.8 : -dt * 2));
        const c = palmPoint(h, 0, 0.3);
        st.x = c.x;
        st.y = c.y - h.size * 0.8;
        st.R = h.size * 0.45 * st.g;
        if (st.g > 0.1 && (!main || st.R > main.R)) main = st;
      }
      // Dust and stars from the whole frame spiralling in.
      if (main) {
        for (let i = 0; i < 6; i++) {
          const a = rand(TAU);
          const d = Math.max(e.W, e.H) * rand(0.3, 0.7);
          infall.push({ x: main.x + Math.cos(a) * d, y: main.y + Math.sin(a) * d, life: 0, s: rand(1.5, 3.5) * e.unit });
        }
        e.light(main.x, main.y, main.R * 8, rgb, 0.15);
        e.audio.loop('hum', 0.4 * main.g);
      } else e.audio.loop('hum', 0);
      for (const p of infall) {
        p.life += dt;
        if (!main) continue;
        const dx = main.x - p.x;
        const dy = main.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        const pull = (Math.max(e.W, e.H) * 900) / (d + 60);
        p.x += ((dx / d) * pull * 0.6 - (dy / d) * pull) * dt * 0.6;
        p.y += ((dy / d) * pull * 0.6 + (dx / d) * pull) * dt * 0.6;
        if (d < main.R * 1.05) p.dead = true;
      }
      infall = infall.filter((p) => !p.dead && p.life < 4);
      this.main = main;
    },
    draw(ctx, e) {
      const m = this.main;
      ctx.globalCompositeOperation = 'lighter';
      for (const p of infall) {
        ctx.fillStyle = `rgba(${rgb.map((v) => (v + 255) >> 1).join(',')},${Math.min(1, p.life * 2) * 0.8})`;
        ctx.fillRect(p.x, p.y, p.s, p.s);
      }
      ctx.globalCompositeOperation = 'source-over';
      if (!m || m.R < 1) return;
      const { x, y, R } = m;
      const tilt = 0.32;
      // Back half of the disk, then the hole, then the front half.
      const drawDisk = (front) => {
        ctx.globalCompositeOperation = 'lighter';
        for (const d of disk) {
          const sin = Math.sin(d.a);
          if (front !== sin > 0) continue;
          const px = x + Math.cos(d.a) * d.r * R * 1.6;
          const py = y + sin * d.r * R * 1.6 * tilt;
          const hot = 1 - (d.r - 1.15) / 1.4;
          const c = hot > 0.6 ? [255, 245, 220] : rgb;
          ctx.fillStyle = `rgba(${c.join(',')},${0.35 + hot * 0.6})`;
          const s = d.s * e.unit * (1 + hot);
          ctx.fillRect(px - s / 2, py - s / 2, s * 2.2, s);
        }
        ctx.globalCompositeOperation = 'source-over';
      };
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, rgb, x, y, R * 4.5, 0.35, 0.05);
      ctx.globalCompositeOperation = 'source-over';
      drawDisk(false);
      // Photon ring and the black disc.
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,240,210,0.9)`;
      ctx.lineWidth = 3 * e.unit;
      ctx.beginPath();
      ctx.arc(x, y, R * 1.08, 0, TAU);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(x, y, R, 0, TAU);
      ctx.fill();
      drawDisk(true);
    },
  };
}
