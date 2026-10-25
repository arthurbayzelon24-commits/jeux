// Shadow magic: dark smoke pours from your hands with violet embers, and a
// closed fist gathers a void orb crackling with dark energy.
import { Particles, drawGlow, rand, TAU, makeBolt, strokeBolts, clamp } from './util.js';

const COLORS = [
  { name: 'Ombre violette', rgb: [150, 60, 255] },
  { name: 'Ombre rouge', rgb: [255, 40, 60] },
  { name: 'Ombre verte', rgb: [60, 255, 120] },
];

export function shadowEffect() {
  const smoke = new Particles(220);
  const embers = new Particles(300);
  const orbs = new Map();
  let bolts = [];
  let rgb = COLORS[0].rgb;

  return {
    id: 'shadow',
    name: 'Magie des ombres',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      smoke.clear();
      embers.clear();
      orbs.clear();
    },
    update(dt, hands, e) {
      smoke.update(dt, (p, d) => (p.vx += Math.sin(e.t * 2 + p.seed) * 60 * d));
      embers.update(dt);
      bolts = [];
      for (const h of hands) {
        if (h.presence < 0.3) continue;
        for (let i = 0; i < 3; i++) {
          const k = [0, 4, 8, 12, 16, 20, 5, 9][(Math.random() * 8) | 0];
          smoke.add({
            x: h.lm[k].x,
            y: h.lm[k].y,
            vx: rand(-30, 30) + h.vel.x * 0.2,
            vy: -rand(40, 120) * e.unit + h.vel.y * 0.2,
            drag: 0.6,
            life: rand(1, 2),
            size: h.size * rand(0.25, 0.5),
            seed: rand(TAU),
          });
        }
        if (Math.random() < 0.5)
          embers.add({
            x: h.palm.x + rand(-h.size, h.size),
            y: h.palm.y + rand(-h.size, h.size * 0.3),
            vx: rand(-40, 40),
            vy: -rand(60, 160) * e.unit,
            life: rand(0.6, 1.3),
            size: rand(2, 4) * e.unit,
            rgb,
            core: 0.5,
          });
        const o = orbs.get(h.id) || { g: 0 };
        orbs.set(h.id, o);
        o.g = clamp(o.g + (h.fist && h.presence > 0.5 ? dt * 1.2 : -dt * 2));
        o.x = h.palm.x;
        o.y = h.palm.y - h.size * 0.9;
        o.r = h.size * 0.5 * o.g;
        if (o.g > 0.3) {
          for (let k = 0; k < 3; k++) {
            const a = rand(TAU);
            bolts.push(
              ...makeBolt(o.x, o.y, o.x + Math.cos(a) * o.r * 2.2, o.y + Math.sin(a) * o.r * 2.2, { jag: 0.4, depth: 4, branches: false }),
            );
          }
        }
      }
      e.audio.loop('hum', Math.max(0, ...[...orbs.values()].map((o) => o.g)) * 0.5);
    },
    draw(ctx, e) {
      // Smoke is drawn normally (dark), not added as light.
      for (const p of smoke.list) {
        const t = p.age / p.life;
        const s = p.size * (1 + t * 1.8);
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
        grad.addColorStop(0, `rgba(12,6,20,${0.4 * (1 - t)})`);
        grad.addColorStop(0.6, `rgba(${rgb[0] * 0.25},${rgb[1] * 0.1},${rgb[2] * 0.25},${0.2 * (1 - t)})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(p.x - s, p.y - s, s * 2, s * 2);
      }
      embers.draw(ctx);
      for (const o of orbs.values()) {
        if (o.g < 0.02) continue;
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, rgb, o.x, o.y, o.r * 3, 0.5, 0.05);
        ctx.globalCompositeOperation = 'source-over';
        const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(0.8, 'rgba(5,0,10,0.95)');
        grad.addColorStop(1, `rgba(${rgb.join(',')},0.9)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, TAU);
        ctx.fill();
      }
      strokeBolts(ctx, bolts, rgb, 1.4 * e.unit, 0.9);
    },
  };
}
