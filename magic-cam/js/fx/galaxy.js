// Spiral galaxy: thousands of stars spinning in a spiral that lies in the
// plane of the palm, with a bright core.
import { drawGlow, rand, TAU, palmPoint, noise1 } from './util.js';

const COLORS = [
  {
    name: 'Voie lactée',
    rgb: [255, 190, 230],
    arms: [
      [255, 200, 240],
      [180, 160, 255],
      [255, 230, 190],
    ],
  },
  {
    name: 'Nébuleuse',
    rgb: [120, 200, 255],
    arms: [
      [120, 200, 255],
      [200, 120, 255],
      [150, 255, 230],
    ],
  },
  {
    name: 'Supernova',
    rgb: [255, 170, 80],
    arms: [
      [255, 170, 80],
      [255, 90, 60],
      [255, 240, 180],
    ],
  },
];

export function galaxyEffect() {
  let scheme = COLORS[0];
  const stars = Array.from({ length: 900 }, () => {
    const arm = (Math.random() * 3) | 0;
    const r = Math.random() ** 1.6;
    return {
      arm,
      r,
      a: (arm / 3) * TAU + r * 5.5 + rand(-0.35, 0.35) * (1 - r * 0.5),
      z: rand(-0.06, 0.06),
      size: rand(0.6, 2.2),
      tw: rand(TAU),
    };
  });
  let spin = 0;
  const grow = new Map();

  return {
    id: 'galaxy',
    name: 'Galaxie spirale',
    hint: 'Ouvrez la main : une galaxie tourne dans votre paume et s’incline avec elle. Écartez les doigts pour l’agrandir, fermez le poing pour l’effondrer.',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      scheme = COLORS[i];
    },
    start() {
      grow.clear();
    },
    update(dt, hands, e) {
      spin += dt * 0.9;
      for (const h of hands) {
        const g = grow.get(h.id) ?? 0;
        const want = (h.fist ? 0.05 : 0.4 + h.openness * 0.9) * h.presence;
        grow.set(h.id, g + (want - g) * Math.min(1, dt * 3));
        e.light(h.palm.x, h.palm.y, h.size * 5, scheme.rgb, 0.1 * g);
      }
      e.audio.loop('hum', 0.15 * Math.max(0, ...grow.values()));
    },
    draw(ctx, e) {
      ctx.globalCompositeOperation = 'lighter';
      for (const h of e.hands) {
        const g = grow.get(h.id) ?? 0;
        if (g < 0.03) continue;
        const R = 1.8 * g;
        const o = palmPoint(h, 0, 0.3);
        drawGlow(ctx, scheme.rgb, o.x, o.y, h.size * R * 1.1, 0.18, 0.05);
        for (const s of stars) {
          const a = s.a + spin * (1.6 - s.r);
          const p = palmPoint(h, Math.cos(a) * s.r * R, Math.sin(a) * s.r * R, s.z * R, o);
          const c = scheme.arms[s.arm];
          const tw = 0.6 + 0.4 * Math.sin(e.t * 4 + s.tw);
          const size = s.size * e.unit * (1.6 - s.r) * 1.8;
          ctx.fillStyle = `rgba(${c.join(',')},${0.9 * tw * h.presence})`;
          ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
        }
        // Dust lanes glow along the arms.
        for (let arm = 0; arm < 3; arm++)
          for (let k = 1; k < 7; k++) {
            const r = k / 7;
            const a = (arm / 3) * TAU + r * 5.5 + spin * (1.6 - r);
            const p = palmPoint(h, Math.cos(a) * r * R, Math.sin(a) * r * R, 0, o);
            drawGlow(ctx, scheme.arms[arm], p.x, p.y, h.size * 0.4 * g * (1.2 - r), 0.16, 0.05);
          }
        const f = 0.9 + 0.1 * noise1(e.t * 3);
        drawGlow(ctx, [255, 245, 220], o.x, o.y, h.size * 0.4 * g * f, 0.75);
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}
