// Storm god: a storm darkens the sky with rain; raise a hand high and
// lightning strikes from the top of the image straight into your hand,
// which keeps crackling with electricity.
import { Particles, drawGlow, rand, makeBolt, strokeBolts, clamp } from './util.js';

const COLORS = [
  { name: 'Orage', rgb: [170, 200, 255] },
  { name: 'Foudre violette', rgb: [200, 130, 255] },
  { name: 'Foudre dorée', rgb: [255, 220, 120] },
];

export function thunderEffect() {
  const sparks = new Particles(400);
  let rain = [];
  let strike = null;
  let arcs = [];
  let timer = 0;
  let charged = 0;
  let rgb = COLORS[0].rgb;

  return {
    id: 'thunder',
    name: 'Foudre du ciel',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      sparks.clear();
      rain = [];
      strike = null;
    },
    update(dt, hands, e) {
      sparks.update(dt);
      // Rain streaks.
      while (rain.length < 160)
        rain.push({ x: rand(-0.1, 1.1) * e.W, y: rand(-e.H, 0), v: rand(1400, 2000) * e.unit, l: rand(14, 30) * e.unit });
      for (const r of rain) {
        r.y += r.v * dt;
        r.x -= r.v * 0.15 * dt;
        if (r.y > e.H) {
          r.y = rand(-60, 0);
          r.x = rand(-0.1, 1.1) * e.W;
        }
      }
      timer -= dt;
      const up = hands.filter((h) => h.presence > 0.5 && h.visible && h.palm.y < e.H * 0.45).sort((a, b) => a.palm.y - b.palm.y)[0];
      if (up && timer <= 0) {
        timer = rand(0.7, 1.3);
        const x0 = up.palm.x + rand(-0.25, 0.25) * e.W;
        strike = {
          bolts: makeBolt(x0, -20, up.palm.x, up.palm.y, { jag: 0.18, depth: 7, branch: 0.35 }),
          t: 0,
          x: up.palm.x,
          y: up.palm.y,
        };
        charged = 1;
        e.flash([220, 230, 255], 0.55, 3);
        e.shake(18);
        e.audio.play('thunder', 1);
        for (let i = 0; i < 50; i++)
          sparks.add({
            x: up.palm.x,
            y: up.palm.y,
            vx: rand(-700, 700) * e.unit,
            vy: rand(-700, 400) * e.unit,
            g: 1200 * e.unit,
            drag: 1,
            life: rand(0.3, 0.8),
            size: rand(2, 5) * e.unit,
            rgb,
            core: 0.5,
          });
      } else if (!up && timer <= 0 && Math.random() < dt * 0.25) {
        // Distant lightning flicker.
        e.flash([200, 210, 255], 0.15, 4);
        e.audio.play('thunder', 0.25);
        timer = 2;
      }
      if (strike && (strike.t += dt) > 0.35) strike = null;
      charged = Math.max(0, charged - dt * 0.4);
      arcs = [];
      for (const h of hands) {
        if (h.presence < 0.5 || charged < 0.05) continue;
        for (let k = 0; k < 3; k++) {
          const a = rand(-Math.PI, Math.PI);
          const tip = h.tips[(Math.random() * 5) | 0];
          arcs.push(
            ...makeBolt(tip.x, tip.y, tip.x + Math.cos(a) * h.size * 1.2, tip.y + Math.sin(a) * h.size * 1.2, {
              jag: 0.35,
              depth: 4,
              branches: false,
            }),
          );
        }
        e.light(h.palm.x, h.palm.y, h.size * 5, rgb, 0.2 * charged);
      }
      e.audio.loop('hum', charged * 0.5);
    },
    draw(ctx, e) {
      // Storm sky: darker at the top.
      const g = ctx.createLinearGradient(0, 0, 0, e.H);
      g.addColorStop(0, 'rgba(10,14,30,0.55)');
      g.addColorStop(0.5, 'rgba(10,14,30,0.2)');
      g.addColorStop(1, 'rgba(10,14,30,0.1)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, e.W, e.H);
      ctx.strokeStyle = 'rgba(200,215,255,0.35)';
      ctx.lineWidth = 1.2 * e.unit;
      ctx.beginPath();
      for (const r of rain) {
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x - r.l * 0.15, r.y + r.l);
      }
      ctx.stroke();
      if (strike) {
        const a = clamp(1 - strike.t / 0.35);
        strokeBolts(ctx, strike.bolts, rgb, 4 * e.unit, a);
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, rgb, strike.x, strike.y, 160 * e.unit, a);
        ctx.globalCompositeOperation = 'source-over';
      }
      strokeBolts(ctx, arcs, rgb, 1.4 * e.unit, charged);
      sparks.draw(ctx);
    },
  };
}
