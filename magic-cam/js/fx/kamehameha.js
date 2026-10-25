// Energy wave: bring both hands together (palms facing, like holding a ball)
// to charge a glowing orb between them, then push the hands forward or pull
// them apart quickly to fire a huge beam. With one hand, an open palm charges
// a small orb that a quick push throws.
import { Particles, drawGlow, rand, TAU, noise1, clamp, dist, rayToEdge, drawBeam, makeBolt, strokeBolts } from './util.js';

const COLORS = [
  { name: 'Ki bleu', rgb: [80, 170, 255] },
  { name: 'Ki violet', rgb: [190, 90, 255] },
  { name: 'Ki doré', rgb: [255, 200, 60] },
  { name: 'Ki rouge', rgb: [255, 70, 60] },
];

export function kamehamehaEffect() {
  const inflow = new Particles(500);
  const sparks = new Particles(700);
  let rgb = COLORS[0].rgb;
  let charge = 0;
  let orb = null; // { x, y, r }
  let beam = null; // { x, y, dx, dy, w, t, life }
  let shots = [];
  let bolts = [];
  let lastDist = 0;
  let boltTimer = 0;

  const fire = (e, o, dx, dy, w) => {
    beam = { x: o.x, y: o.y, dx, dy, w, t: 0, life: 1.6 };
    e.flash(rgb, 0.55, 2);
    e.shake(26);
    e.audio.play('boom', 1);
    e.audio.play('thunder', 0.6);
    charge = 0;
  };

  return {
    id: 'kamehameha',
    name: 'Kamehameha',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      inflow.clear();
      sparks.clear();
      charge = 0;
      orb = null;
      beam = null;
      shots = [];
    },
    update(dt, hands, e) {
      const live = hands.filter((h) => h.presence > 0.5 && h.visible);
      inflow.update(dt, (p) => {
        if (!orb) return;
        // Spiral towards the orb centre.
        const dx = orb.x - p.x;
        const dy = orb.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        p.vx = (dx / d) * p.speed - (dy / d) * p.speed * 0.6;
        p.vy = (dy / d) * p.speed + (dx / d) * p.speed * 0.6;
        if (d < orb.r * 0.5) p.age = p.life;
      });
      sparks.update(dt);
      let pair = null;
      if (live.length >= 2) {
        const [a, b] = live;
        const d = dist(a.palm, b.palm);
        if (d < (a.size + b.size) * 1.6) pair = { a, b, d };
      }

      let target = null;
      if (!beam) {
        if (pair) {
          const { a, b, d } = pair;
          const up = { x: (a.up.x + b.up.x) / 2, y: (a.up.y + b.up.y) / 2 };
          target = {
            x: (a.palm.x + b.palm.x) / 2 + up.x * a.size * 0.4,
            y: (a.palm.y + b.palm.y) / 2 + up.y * a.size * 0.4,
            s: (a.size + b.size) / 2,
          };
          charge = Math.min(1, charge + dt / 1.6);
          const apart = (d - lastDist) / dt;
          const push = { x: (a.vel.x + b.vel.x) / 2, y: (a.vel.y + b.vel.y) / 2 };
          const speed = Math.hypot(push.x, push.y);
          lastDist = d;
          // Fire: hands thrust together in one direction, or pulled apart fast.
          if (charge > 0.45 && (speed > Math.min(e.W, e.H) * 1.6 || apart > Math.min(e.W, e.H) * 2)) {
            let dx = speed > 1 ? push.x / speed : up.x;
            let dy = speed > 1 ? push.y / speed : up.y;
            if (apart > Math.min(e.W, e.H) * 2 && speed < Math.min(e.W, e.H)) {
              dx = up.x;
              dy = up.y;
            }
            const l = Math.hypot(dx, dy) || 1;
            fire(e, target, dx / l, dy / l, target.s * (0.45 + charge * 0.6));
          }
        } else if (live.length === 1 && (live[0].open || live[0].gesture === 'relaxed')) {
          const h = live[0];
          target = { x: h.palm.x + h.up.x * h.size * 0.3, y: h.palm.y + h.up.y * h.size * 0.3 - h.size * 0.2, s: h.size * 0.55 };
          charge = Math.min(0.7, charge + dt / 1.6);
          if (charge > 0.4 && h.speed > Math.min(e.W, e.H) * 2) {
            shots.push({ x: target.x, y: target.y, vx: h.vel.x * 1.4, vy: h.vel.y * 1.4, r: target.s * charge, life: 1.2 });
            e.audio.play('whoosh', 0.9);
            charge = 0;
          }
        } else charge = Math.max(0, charge - dt * 0.8);
      }

      if (target && charge > 0.02) {
        const r = target.s * (0.15 + charge * 0.45);
        orb = orb
          ? { x: orb.x + (target.x - orb.x) * 0.5, y: orb.y + (target.y - orb.y) * 0.5, r: orb.r + (r - orb.r) * 0.3 }
          : { ...target, r };
        // Energy gathering from all around.
        for (let i = 0; i < 4; i++) {
          const a = rand(TAU);
          const R = orb.r * rand(2.5, 4.5);
          inflow.add({
            x: orb.x + Math.cos(a) * R,
            y: orb.y + Math.sin(a) * R,
            speed: R * 2.4,
            life: 0.8,
            size: rand(2, 5) * e.unit,
            rgb,
            core: 0.5,
            fadeIn: 0.3,
          });
        }
        boltTimer -= dt;
        if (boltTimer <= 0) {
          boltTimer = 0.06;
          bolts = [];
          for (let k = 0; k < 2 + charge * 3; k++) {
            const a = rand(TAU);
            bolts.push(
              ...makeBolt(orb.x, orb.y, orb.x + Math.cos(a) * orb.r * rand(1, 1.8), orb.y + Math.sin(a) * orb.r * rand(1, 1.8), {
                jag: 0.35,
                depth: 4,
                branches: false,
              }),
            );
          }
        }
        e.light(orb.x, orb.y, orb.r * 7, rgb, 0.12 * charge + 0.05);
        e.audio.loop('hum', 0.3 + charge * 0.6);
        if (charge > 0.8) e.shake(2);
      } else {
        if (!beam) orb = null;
        bolts = [];
        e.audio.loop('hum', beam ? 0.8 : 0);
      }

      if (beam) {
        beam.t += dt;
        const k = beam.t / beam.life;
        beam.len = rayToEdge(beam.x, beam.y, beam.dx, beam.dy, e.W, e.H) * Math.min(1, beam.t * 6);
        for (let i = 0; i < 10; i++) {
          const s = Math.random() * beam.len;
          const v = rand(400, 1200) * e.unit;
          const side = rand(-1, 1) * beam.w * 0.6;
          sparks.add({
            x: beam.x + beam.dx * s - beam.dy * side,
            y: beam.y + beam.dy * s + beam.dx * side,
            vx: beam.dx * v + rand(-150, 150),
            vy: beam.dy * v + rand(-150, 150),
            drag: 2,
            life: rand(0.2, 0.5),
            size: rand(3, 8) * e.unit,
            rgb,
            core: 0.4,
          });
        }
        e.light(beam.x + beam.dx * beam.len * 0.5, beam.y + beam.dy * beam.len * 0.5, Math.max(e.W, e.H) * 0.6, rgb, 0.15 * (1 - k));
        e.shake(6 * (1 - k));
        if (beam.t >= beam.life) {
          beam = null;
          orb = null;
        }
      }

      for (const s of shots) {
        s.life -= dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        for (let i = 0; i < 3; i++)
          sparks.add({
            x: s.x,
            y: s.y,
            vx: -s.vx * 0.1 + rand(-60, 60),
            vy: -s.vy * 0.1 + rand(-60, 60),
            drag: 3,
            life: rand(0.2, 0.4),
            size: s.r * rand(0.3, 0.6),
            rgb,
            core: 0.3,
          });
        if (s.life <= 0 || s.x < 0 || s.y < 0 || s.x > e.W || s.y > e.H) {
          s.dead = true;
          e.flash(rgb, 0.3, 3);
          e.shake(12);
          e.audio.play('boom', 0.7);
          for (let i = 0; i < 60; i++) {
            const a = rand(TAU);
            const v = rand(200, 900) * e.unit;
            sparks.add({
              x: clamp(s.x, 0, e.W),
              y: clamp(s.y, 0, e.H),
              vx: Math.cos(a) * v,
              vy: Math.sin(a) * v,
              drag: 3,
              life: rand(0.3, 0.8),
              size: rand(4, 10) * e.unit,
              rgb,
              core: 0.4,
            });
          }
        }
      }
      shots = shots.filter((s) => !s.dead);
    },
    draw(ctx, e) {
      inflow.draw(ctx);
      if (beam) {
        const k = beam.t / beam.life;
        const fade = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
        const w = beam.w * (0.6 + 0.4 * Math.min(1, beam.t * 5)) * (0.9 + 0.1 * noise1(e.t * 25));
        const [r, g, b] = rgb;
        drawBeam(ctx, beam.x, beam.y, beam.x + beam.dx * beam.len, beam.y + beam.dy * beam.len, w, rgb, fade, e.t, [
          [1.9, `rgba(${r},${g},${b},${0.1 * fade})`, 0.3],
          [1.25, `rgba(${r},${g},${b},${0.28 * fade})`, 0.22],
          [0.8, `rgba(${(r + 255) >> 1},${(g + 255) >> 1},${(b + 255) >> 1},${0.6 * fade})`, 0.1],
          [0.4, `rgba(255,255,255,${0.95 * fade})`, 0.04],
        ]);
      }
      ctx.globalCompositeOperation = 'lighter';
      if (orb) {
        const f = 0.9 + 0.1 * noise1(e.t * 18);
        drawGlow(ctx, rgb, orb.x, orb.y, orb.r * 2.4 * f, 0.3, 0.05);
        drawGlow(ctx, rgb, orb.x, orb.y, orb.r * 1.25 * f, 0.75, 0.3);
        drawGlow(ctx, [255, 255, 255], orb.x, orb.y, orb.r * 0.55 * f, 0.95, 0.5);
        // Swirling rings around the orb.
        ctx.lineWidth = 2 * e.unit;
        for (let i = 0; i < 3; i++) {
          ctx.strokeStyle = `rgba(${rgb.map((v) => (v + 255) >> 1).join(',')},${0.5 - i * 0.12})`;
          ctx.beginPath();
          ctx.ellipse(orb.x, orb.y, orb.r * (1.2 + i * 0.25), orb.r * (0.45 + i * 0.1), e.t * (2 + i) + i, 0, TAU);
          ctx.stroke();
        }
      }
      for (const s of shots) {
        drawGlow(ctx, rgb, s.x, s.y, s.r * 3, 0.7, 0.1);
        drawGlow(ctx, [255, 255, 255], s.x, s.y, s.r, 1, 0.5);
      }
      ctx.globalCompositeOperation = 'source-over';
      strokeBolts(ctx, bolts, rgb, 1.5 * e.unit, 0.9);
      sparks.draw(ctx);
    },
  };
}
