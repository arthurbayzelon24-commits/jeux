// Magic circle: sorcerer-style rotating rune shields that lie in the plane of
// each palm (true 3D tilt) and shed sparks.
import { Particles, drawGlow, rand, TAU, palmPoint, noise1 } from './util.js';

const COLORS = [
  { name: 'Sorcier', rgb: [255, 150, 40] },
  { name: 'Émeraude', rgb: [60, 255, 140] },
  { name: 'Arcane', rgb: [120, 140, 255] },
  { name: 'Écarlate', rgb: [255, 60, 80] },
];

// Random rune strokes, generated once, in unit coordinates.
const RUNES = Array.from({ length: 24 }, () =>
  Array.from({ length: 2 + ((Math.random() * 3) | 0) }, () => [rand(-1, 1), rand(-1, 1), rand(-1, 1), rand(-1, 1)]),
);

export function magicCircleEffect() {
  const sparks = new Particles(500);
  let rgb = COLORS[0].rgb;
  const grow = new Map();

  const path = (ctx, hand, pts, origin) => {
    ctx.beginPath();
    pts.forEach(([a, b], i) => {
      const p = palmPoint(hand, a, b, 0, origin);
      if (i) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
    });
  };
  const circle = (r, n = 72) => Array.from({ length: n + 1 }, (_, i) => [Math.cos((i / n) * TAU) * r, Math.sin((i / n) * TAU) * r]);
  const polygon = (r, n, rot) =>
    Array.from({ length: n + 1 }, (_, i) => [Math.cos(rot + (i / n) * TAU) * r, Math.sin(rot + (i / n) * TAU) * r]);
  const star = (r, n, step, rot) =>
    Array.from({ length: n + 1 }, (_, i) => [Math.cos(rot + ((i * step) / n) * TAU) * r, Math.sin(rot + ((i * step) / n) * TAU) * r]);

  return {
    id: 'circle',
    name: 'Cercle magique',
    hint: 'Montrez la paume : un bouclier de runes se déploie et suit l’inclinaison de votre main. Faites des cercles avec la main pour l’accélérer.',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      sparks.clear();
      grow.clear();
    },
    update(dt, hands, e) {
      sparks.update(dt);
      let level = 0;
      for (const h of hands) {
        const st = grow.get(h.id) || { g: 0, rot: 0 };
        const want = h.open || h.gesture === 'relaxed' ? 1 : 0.15;
        st.g += (want * h.presence - st.g) * Math.min(1, dt * 4);
        st.rot += dt * (1.2 + Math.min(4, h.speed / (e.W * 0.4)));
        grow.set(h.id, st);
        level = Math.max(level, st.g);
        if (st.g > 0.4) {
          const R = 1.45 * st.g;
          for (let i = 0; i < 4; i++) {
            const a = rand(TAU);
            const p = palmPoint(h, Math.cos(a) * R, Math.sin(a) * R);
            const t = palmPoint(h, Math.cos(a + 0.2) * R, Math.sin(a + 0.2) * R);
            const vx = (t.x - p.x) * 18 + rand(-30, 30);
            const vy = (t.y - p.y) * 18 + rand(-30, 30);
            sparks.add({
              x: p.x,
              y: p.y,
              vx,
              vy,
              g: 400,
              drag: 1.2,
              life: rand(0.3, 0.8),
              size: rand(2, 5) * e.unit,
              rgb: [255, 220, 150],
              core: 0.5,
            });
          }
          e.light(h.palm.x, h.palm.y, h.size * 5, rgb, 0.12 * st.g);
        }
      }
      e.audio.loop('hum', level * 0.3);
      if (level > 0.6 && Math.random() < 0.02) e.audio.play('chime', 0.3);
    },
    draw(ctx, e) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const h of e.hands) {
        const st = grow.get(h.id);
        if (!st || st.g < 0.03) continue;
        const g = st.g;
        const o = palmPoint(h, 0, 0.15);
        const flick = 0.85 + 0.15 * noise1(e.t * 10 + h.id);
        const stroke = (w, a) => {
          ctx.lineWidth = w * e.unit;
          ctx.strokeStyle = `rgba(${rgb.join(',')},${a * g * flick})`;
          ctx.stroke();
          ctx.lineWidth = w * e.unit * 0.35;
          ctx.strokeStyle = `rgba(255,240,210,${a * g})`;
          ctx.stroke();
        };
        drawGlow(ctx, rgb, o.x, o.y, h.size * 2.4 * g, 0.15 * flick);
        // Outer double ring.
        for (const r of [1.45, 1.34]) {
          path(ctx, h, circle(r * g), o);
          stroke(4, 0.9);
        }
        // Rune band between the rings, turning.
        RUNES.forEach((rune, i) => {
          const a = st.rot * 0.6 + (i / RUNES.length) * TAU;
          const cx = Math.cos(a) * 1.39 * g;
          const cy = Math.sin(a) * 1.39 * g;
          const s = 0.05 * g;
          for (const [x1, y1, x2, y2] of rune) {
            path(
              ctx,
              h,
              [
                [cx + x1 * s, cy + y1 * s],
                [cx + x2 * s, cy + y2 * s],
              ],
              o,
            );
            stroke(2, 0.8);
          }
        });
        // Inner geometry spinning the other way.
        path(ctx, h, polygon(1.12 * g, 4, -st.rot), o);
        stroke(3, 0.8);
        path(ctx, h, polygon(1.12 * g, 4, -st.rot + Math.PI / 4), o);
        stroke(3, 0.8);
        path(ctx, h, circle(0.8 * g), o);
        stroke(2.5, 0.7);
        path(ctx, h, star(0.76 * g, 5, 2, st.rot * 1.5), o);
        stroke(2.5, 0.7);
        path(ctx, h, circle(0.33 * g), o);
        stroke(3, 0.9);
        drawGlow(ctx, [255, 230, 180], o.x, o.y, h.size * 0.5 * g, 0.6);
      }
      ctx.globalCompositeOperation = 'source-over';
      sparks.draw(ctx);
    },
  };
}
