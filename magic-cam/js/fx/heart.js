// Lover: make a finger heart (pinch thumb and index) and a glowing heart grows
// above the fingers; let go and it flies up and bursts into little hearts.
// Small hearts float up from the hands all the time.
import { Particles, drawGlow, rand, TAU, noise1 } from './util.js';

const COLORS = [
  { name: 'Amour', rgb: [255, 50, 90] },
  { name: 'Rose', rgb: [255, 120, 200] },
  { name: 'Violet', rgb: [190, 90, 255] },
  { name: 'Or', rgb: [255, 190, 70] },
];

export function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 1.1, y - s * 0.35, x - s * 0.55, y - s * 1.05, x, y - s * 0.5);
  ctx.bezierCurveTo(x + s * 0.55, y - s * 1.05, x + s * 1.1, y - s * 0.35, x, y + s * 0.35);
  ctx.closePath();
}

function drawHeart(ctx, x, y, s, rgb, alpha, glow = true) {
  if (s < 1) return;
  const [r, g, b] = rgb;
  if (glow) {
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, rgb, x, y - s * 0.25, s * 2.6, 0.45 * alpha, 0.05);
    ctx.globalCompositeOperation = 'source-over';
  }
  const grad = ctx.createLinearGradient(x, y - s, x, y + s * 0.4);
  grad.addColorStop(0, `rgba(${Math.min(255, r + 70)},${Math.min(255, g + 70)},${Math.min(255, b + 70)},${alpha})`);
  grad.addColorStop(1, `rgba(${(r * 0.55) | 0},${(g * 0.4) | 0},${(b * 0.45) | 0},${alpha})`);
  ctx.fillStyle = grad;
  heartPath(ctx, x, y, s);
  ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(255,255,255,${0.85 * alpha})`;
  ctx.lineWidth = Math.max(1, s * 0.07);
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  // Shine.
  ctx.fillStyle = `rgba(255,255,255,${0.35 * alpha})`;
  ctx.beginPath();
  ctx.ellipse(x - s * 0.4, y - s * 0.55, s * 0.16, s * 0.09, -0.6, 0, TAU);
  ctx.fill();
}

export function heartEffect() {
  const sparks = new Particles(400);
  let floaters = [];
  let flying = [];
  const growing = new Map();
  let rgb = COLORS[0].rgb;

  const burst = (e, x, y, s) => {
    for (let i = 0; i < 26; i++) {
      const a = rand(TAU);
      const v = rand(150, 600) * e.unit;
      floaters.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 100,
        s: s * rand(0.12, 0.3),
        life: rand(1.2, 2.4),
        age: 0,
        spin: rand(-2, 2),
        rot: 0,
      });
    }
    for (let i = 0; i < 80; i++) {
      const a = rand(TAU);
      const v = rand(200, 900) * e.unit;
      sparks.add({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        drag: 2,
        life: rand(0.4, 1),
        size: rand(2, 5) * e.unit,
        rgb,
        core: 0.5,
      });
    }
    e.flash(rgb, 0.25, 3);
    e.audio.play('chime', 0.6);
    e.audio.play('boom', 0.3);
  };

  return {
    id: 'heart',
    name: 'Cœur d’amour',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      sparks.clear();
      floaters = [];
      flying = [];
      growing.clear();
    },
    update(dt, hands, e) {
      sparks.update(dt);
      for (const h of hands) {
        if (h.presence < 0.4) continue;
        const g = growing.get(h.id) || { s: 0 };
        growing.set(h.id, g);
        const pinching = h.pinch || h.pinchAmount > 0.7;
        if (pinching) {
          g.s = Math.min(h.size * 1.4, g.s + dt * h.size * 0.9);
          g.x = h.pinchPoint.x;
          g.y = h.pinchPoint.y - h.size * 0.9 - g.s * 0.3;
          if (Math.random() < 0.4)
            sparks.add({
              x: g.x + rand(-g.s, g.s),
              y: g.y + rand(-g.s, g.s * 0.3),
              vx: rand(-30, 30),
              vy: -rand(40, 120),
              life: rand(0.5, 1),
              size: rand(2, 4) * e.unit,
              rgb,
              core: 0.5,
            });
          e.light(g.x, g.y, g.s * 5, rgb, 0.15);
        } else if (g.s > h.size * 0.25) {
          flying.push({ x: g.x, y: g.y, s: g.s, vy: -420 * e.unit, t: 0 });
          e.audio.play('whoosh', 0.5);
          g.s = 0;
        } else g.s = 0;
        // Little hearts drifting up from the fingertips.
        if (Math.random() < dt * 3) {
          const tip = h.tips[1 + ((Math.random() * 4) | 0)];
          floaters.push({
            x: tip.x,
            y: tip.y,
            vx: rand(-30, 30),
            vy: -rand(60, 140) * e.unit,
            s: h.size * rand(0.1, 0.2),
            life: rand(1.5, 3),
            age: 0,
            spin: rand(-1, 1),
            rot: 0,
          });
        }
      }
      for (const f of flying) {
        f.t += dt;
        f.y += f.vy * dt;
        f.s *= 1 + dt * 0.4;
        if (f.t > 0.7) {
          burst(e, f.x, f.y, f.s * 2);
          f.dead = true;
        }
      }
      flying = flying.filter((f) => !f.dead);
      for (const f of floaters) {
        f.age += dt;
        f.vx *= Math.exp(-dt * 1.5);
        f.vy = f.vy * Math.exp(-dt * 1.5) - 40 * dt;
        f.x += (f.vx + noise1(f.age + f.s) * 30) * dt;
        f.y += f.vy * dt;
        f.rot += f.spin * dt;
      }
      floaters = floaters.filter((f) => f.age < f.life);
      if (floaters.length > 120) floaters.splice(0, floaters.length - 120);
    },
    draw(ctx) {
      for (const f of floaters) {
        const a = Math.min(1, f.age * 4) * (1 - f.age / f.life);
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(Math.sin(f.rot) * 0.4);
        drawHeart(ctx, 0, 0, f.s, rgb, a * 0.9, false);
        ctx.restore();
      }
      for (const g of growing.values()) if (g.s > 1) drawHeart(ctx, g.x, g.y + Math.sin(performance.now() / 150) * g.s * 0.03, g.s, rgb, 1);
      for (const f of flying) drawHeart(ctx, f.x, f.y, f.s, rgb, 1);
      sparks.draw(ctx);
    },
    ultimate(e, a) {
      burst(e, a.x, a.y, Math.min(e.W, e.H) * 0.4);
    },
  };
}
