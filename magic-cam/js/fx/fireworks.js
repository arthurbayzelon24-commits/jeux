// Fireworks: point your index finger and rockets shoot from the fingertip in
// the direction it points, bursting into colourful sparkling spheres. Flick
// the hand upward for a big one.
import { Particles, drawGlow, rand, TAU, pick } from './util.js';

const SETS = [
  {
    name: 'Festival',
    colors: [
      [255, 80, 80],
      [255, 200, 60],
      [80, 200, 255],
      [190, 100, 255],
      [90, 255, 140],
    ],
  },
  {
    name: 'Or et argent',
    colors: [
      [255, 210, 120],
      [255, 255, 255],
      [255, 180, 60],
    ],
  },
  {
    name: 'Néon',
    colors: [
      [255, 60, 200],
      [60, 240, 255],
      [180, 255, 60],
    ],
  },
];

export function fireworksEffect() {
  const sparks = new Particles(1400);
  let rockets = [];
  const timers = new Map();
  let set = SETS[0];

  const launch = (e, x, y, dx, dy, big = false) => {
    const v = rand(900, 1300) * e.unit * (big ? 1.2 : 1);
    rockets.push({ x, y, vx: dx * v + rand(-60, 60), vy: dy * v, fuse: rand(0.45, 0.8), big, rgb: pick(set.colors) });
    e.audio.play('whoosh', 0.4);
  };

  const explode = (e, r) => {
    const n = r.big ? 260 : 160;
    const speed = (r.big ? 620 : 420) * e.unit;
    const second = Math.random() < 0.4 ? pick(set.colors) : null;
    for (let i = 0; i < n; i++) {
      const a = rand(TAU);
      const v = speed * (0.75 + Math.random() * 0.35);
      sparks.add({
        x: r.x,
        y: r.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        drag: 1.4,
        g: 260 * e.unit,
        life: rand(1, 1.8),
        size: rand(3.5, 6.5) * e.unit,
        rgb: second && i % 2 ? second : r.rgb,
        core: 0.5,
        twinkle: Math.random() < 0.5,
      });
    }
    e.flash(r.rgb, r.big ? 0.25 : 0.1, 3);
    e.light(r.x, r.y, speed * 1.2, r.rgb, 0.35);
    e.audio.play('boom', r.big ? 0.7 : 0.35);
  };

  return {
    id: 'fireworks',
    name: 'Feu d’artifice',
    colors: SETS,
    needs: { seg: false },
    setColor(i) {
      set = SETS[i];
    },
    start() {
      sparks.clear();
      rockets = [];
    },
    update(dt, hands, e) {
      sparks.update(dt, (p) => {
        if (p.twinkle) p.alpha = Math.random() < 0.3 ? 0.3 : 1;
      });
      for (const h of hands) {
        if (h.presence < 0.5) continue;
        const tip = h.lm[8];
        let dx = tip.x - h.lm[6].x;
        let dy = tip.y - h.lm[6].y;
        const l = Math.hypot(dx, dy) || 1;
        dx /= l;
        dy /= l;
        const t = (timers.get(h.id) ?? 0) - dt;
        timers.set(h.id, t);
        if ((h.point || (h.fingers.index && !h.fingers.middle)) && t <= 0) {
          launch(e, tip.x, tip.y, dx, dy);
          timers.set(h.id, 0.45);
        }
        if (h.vel.y < -Math.min(e.W, e.H) * 2 && t <= 0) {
          launch(e, h.palm.x, h.palm.y, 0, -1, true);
          timers.set(h.id, 0.6);
        }
      }
      for (const r of rockets) {
        r.fuse -= dt;
        r.vy += 500 * e.unit * dt;
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        sparks.add({
          x: r.x,
          y: r.y,
          vx: rand(-40, 40),
          vy: rand(20, 80),
          life: rand(0.2, 0.45),
          size: rand(2, 4) * e.unit,
          rgb: [255, 210, 150],
          core: 0.5,
        });
        if (r.fuse <= 0 || r.y < e.H * 0.12) {
          explode(e, r);
          r.dead = true;
        }
      }
      rockets = rockets.filter((r) => !r.dead);
    },
    draw(ctx, e) {
      ctx.globalCompositeOperation = 'lighter';
      for (const r of rockets) drawGlow(ctx, [255, 230, 180], r.x, r.y, 10 * e.unit, 1);
      ctx.globalCompositeOperation = 'source-over';
      sparks.draw(ctx);
    },
    ultimate(e) {
      for (let i = 0; i < 6; i++) explode(e, { x: rand(0.15, 0.85) * e.W, y: rand(0.15, 0.5) * e.H, big: true, rgb: pick(set.colors) });
    },
  };
}
