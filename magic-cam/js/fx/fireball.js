// Fireball: a living flame ball in the open hand that can be thrown with a
// quick swipe and explodes; a closed fist bursts into flames.
import { Particles, drawGlow, rand, TAU, noise1, fireSprite, clamp, dist } from './util.js';

const COLORS = [
  { name: 'Feu', hue: null },
  { name: 'Flamme bleue', hue: [80, 160, 255] },
  { name: 'Feu vert', hue: [80, 255, 120] },
  { name: 'Feu violet', hue: [200, 90, 255] },
];

export function fireballEffect() {
  const fire = new Particles(700);
  const smoke = new Particles(120);
  const projectiles = [];
  const charge = new Map();
  let tint = null;
  let shockwaves = [];

  const flame = (x, y, r, vx = 0, vy = 0, life = rand(0.35, 0.7)) =>
    fire.add({
      x: x + rand(-r, r) * 0.6,
      y: y + rand(-r, r) * 0.6,
      vx: vx + rand(-40, 40),
      vy: vy - rand(60, 180),
      drag: 1.5,
      g: -260,
      life,
      size: r * rand(0.35, 0.6),
      grow: 0.2,
      fire: !tint,
      rgb: tint,
      core: 0.3,
      alpha: 0.4,
    });

  const explode = (e, x, y, r) => {
    for (let i = 0; i < 140; i++) {
      const a = rand(TAU);
      const v = rand(150, 900) * e.unit;
      fire.add({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        drag: 3,
        g: -120,
        life: rand(0.4, 1),
        size: r * rand(0.3, 0.8),
        grow: 0.6,
        fire: !tint,
        rgb: tint,
        core: 0.3,
      });
    }
    for (let i = 0; i < 25; i++)
      smoke.add({
        x,
        y,
        vx: rand(-200, 200),
        vy: rand(-250, 50),
        drag: 1.5,
        g: -60,
        life: rand(1, 2),
        size: r * rand(0.8, 1.6),
        rot: rand(TAU),
      });
    shockwaves.push({ x, y, r: r * 0.5, life: 0.5 });
    e.flash(tint || [255, 140, 40], 0.5, 2.5);
    e.shake(22);
    e.audio.play('boom', 1);
  };

  return {
    id: 'fireball',
    name: 'Boule de feu',
    hint: 'Main ouverte : une boule de feu apparaît. Lancez-la d’un geste rapide. Serrez le poing pour l’enflammer, rapprochez les mains pour une boule géante.',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      tint = COLORS[i].hue;
    },
    start() {
      fire.clear();
      smoke.clear();
      projectiles.length = 0;
      shockwaves = [];
    },
    update(dt, hands, e) {
      fire.update(dt, (p, dt2) => {
        p.vx += noise1(p.y * 0.02 + e.t * 3) * 300 * dt2;
      });
      smoke.update(dt);
      shockwaves = shockwaves.filter((s) => (s.life -= dt) > 0);
      let level = 0;

      const live = hands.filter((h) => h.presence > 0.2);
      // Two hands close together share one giant fireball.
      let merged = null;
      if (live.length >= 2 && dist(live[0].palm, live[1].palm) < (live[0].size + live[1].size) * 2.2) {
        const [a, b] = live;
        merged = { x: (a.palm.x + b.palm.x) / 2, y: (a.palm.y + b.palm.y) / 2, r: (a.size + b.size) * 0.75 };
      }

      for (const h of live) {
        const c = Math.min(1, (charge.get(h.id) ?? 0) + dt * 2);
        charge.set(h.id, c);
        const r = h.size * 0.38 * c * h.presence;
        if (h.fist) {
          // Burning fist.
          for (let i = 0; i < 4; i++) {
            const k = [5, 9, 13, 17, 0][(Math.random() * 5) | 0];
            flame(h.lm[k].x, h.lm[k].y, h.size * 0.3, h.vel.x * 0.3, h.vel.y * 0.3);
          }
          level = Math.max(level, 0.6);
          continue;
        }
        if (merged || !(h.open || h.gesture === 'relaxed')) continue;
        const ball = holdPoint(h);
        // Throw: a fast swipe launches the charged ball.
        const throwSpeed = Math.min(e.W, e.H) * 2.2;
        if (c > 0.8 && h.speed > throwSpeed && h.visible) {
          const v = { x: h.vel.x * 1.3, y: h.vel.y * 1.3 };
          projectiles.push({ x: ball.x, y: ball.y, vx: v.x, vy: v.y, r: r * 1.2, life: 1.1 });
          charge.set(h.id, 0);
          e.audio.play('whoosh', 1);
          continue;
        }
        const n = Math.round(4 * c);
        for (let i = 0; i < n; i++) flame(ball.x, ball.y, r, h.vel.x * 0.15, h.vel.y * 0.15);
        level = Math.max(level, c);
        const flick = 0.75 + 0.25 * noise1(e.t * 14 + h.id);
        e.light(ball.x, ball.y, r * 8, tint || [255, 130, 30], 0.18 * flick * c);
      }
      if (merged) {
        for (let i = 0; i < 12; i++) flame(merged.x, merged.y, merged.r);
        e.light(merged.x, merged.y, merged.r * 9, tint || [255, 130, 30], 0.45);
        level = 1.3;
        this.merged = merged;
      } else this.merged = null;

      for (const p of projectiles) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.r *= 1 + dt * 0.8;
        for (let i = 0; i < 8; i++) flame(p.x, p.y, p.r, -p.vx * 0.2, -p.vy * 0.2, rand(0.25, 0.5));
        e.light(p.x, p.y, p.r * 8, tint || [255, 130, 30], 0.35);
        const out = p.x < -p.r || p.y < -p.r || p.x > e.W + p.r || p.y > e.H + p.r;
        if (p.life <= 0 || out) {
          explode(e, clamp(p.x, 0, e.W), clamp(p.y, 0, e.H), p.r * 1.5);
          p.dead = true;
        }
      }
      for (let i = projectiles.length - 1; i >= 0; i--) if (projectiles[i].dead) projectiles.splice(i, 1);
      e.audio.loop('fire', Math.min(1, level + projectiles.length * 0.5));
    },
    draw(ctx, e) {
      // Smoke under the flames.
      ctx.globalCompositeOperation = 'source-over';
      for (const p of smoke.list) {
        const t = p.age / p.life;
        ctx.globalAlpha = 0.18 * (1 - t);
        ctx.fillStyle = '#2a2622';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + t), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Bright cores of held and thrown balls.
      ctx.globalCompositeOperation = 'lighter';
      const cores = [];
      for (const h of e.hands) {
        if (h.presence < 0.2 || h.fist || this.merged || !(h.open || h.gesture === 'relaxed')) continue;
        const c = charge.get(h.id) ?? 0;
        const b = holdPoint(h);
        cores.push([b.x, b.y, h.size * 0.38 * c * h.presence]);
      }
      if (this.merged) cores.push([this.merged.x, this.merged.y, this.merged.r]);
      for (const p of projectiles) cores.push([p.x, p.y, p.r]);
      for (const [x, y, r] of cores) {
        if (r < 1) continue;
        const pulse = 1 + 0.08 * noise1(e.t * 12 + x * 0.01);
        ctx.globalAlpha = 0.45;
        ctx.drawImage(fireSprite(0.55), x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
        ctx.globalAlpha = 0.8;
        if (tint) drawGlow(ctx, tint, x, y, r * 1.6 * pulse, 0.6);
        else ctx.drawImage(fireSprite(0.3), x - r * 1.3 * pulse, y - r * 1.3 * pulse, r * 2.6 * pulse, r * 2.6 * pulse);
        ctx.globalAlpha = 0.9;
        ctx.drawImage(fireSprite(0.05), x - r * 0.6 * pulse, y - r * 0.6 * pulse, r * 1.2 * pulse, r * 1.2 * pulse);
        ctx.globalAlpha = 1;
      }
      ctx.globalCompositeOperation = 'source-over';
      fire.draw(ctx);
      for (const s of shockwaves) {
        const t = 1 - s.life / 0.5;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,${tint ? 220 : 170},${tint ? 255 : 80},${(1 - t) * 0.8})`;
        ctx.lineWidth = 10 * (1 - t) * e.unit + 1;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r + t * Math.min(e.W, e.H) * 0.45, 0, TAU);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
    },
  };
}

// The ball floats just in front of the palm, slightly towards the fingers.
function holdPoint(h) {
  return { x: h.palm.x + h.up.x * h.size * 0.35, y: h.palm.y + h.up.y * h.size * 0.35 - h.size * 0.15 };
}
