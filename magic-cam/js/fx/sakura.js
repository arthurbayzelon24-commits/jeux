// Sakura petals: petals drift down through the frame, swirl in the wind of
// your hand movements and bloom out of an open palm.
import { rand, TAU, clamp, noise1, drawGlow } from './util.js';

const COLORS = [
  { name: 'Sakura', rgb: [255, 170, 200] },
  { name: 'Blanc', rgb: [255, 240, 245] },
  { name: 'Automne', rgb: [255, 140, 50] },
  { name: 'Lavande', rgb: [190, 150, 255] },
];

export function sakuraEffect() {
  let petals = [];
  let rgb = COLORS[0].rgb;

  const spawn = (e, x, y, vx = 0, vy = 0) => {
    if (petals.length > 260) return;
    petals.push({
      x,
      y,
      vx: vx + rand(-30, 30),
      vy: vy + rand(20, 60),
      size: rand(9, 17) * e.unit,
      rot: rand(TAU),
      spin: rand(-3, 3),
      flip: rand(TAU),
      flipSpeed: rand(2, 5),
      shade: rand(-25, 25),
      life: rand(5, 9),
      age: 0,
    });
  };

  return {
    id: 'sakura',
    name: 'Pétales de sakura',
    hint: 'Des pétales tombent autour de vous : balayez l’air avec la main pour créer du vent. Ouvrez la main pour faire éclore des pétales.',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      petals = [];
      this.prefill = true;
    },
    update(dt, hands, e) {
      // Start with petals already in the air rather than an empty sky.
      if (this.prefill) {
        this.prefill = false;
        for (let i = 0; i < 70; i++) {
          spawn(e, rand(e.W), rand(e.H));
          petals[petals.length - 1].age = rand(1, 3);
        }
      }
      if (Math.random() < dt * 14) spawn(e, rand(-0.1, 1.1) * e.W, -20);
      for (const h of hands) {
        if (h.presence < 0.5) continue;
        if (h.open && Math.random() < dt * 25) {
          const a = h.angle + rand(-0.8, 0.8);
          spawn(e, h.palm.x, h.palm.y, Math.cos(a) * 160 * e.unit, Math.sin(a) * 160 * e.unit - 60);
        }
      }
      for (const p of petals) {
        p.age += dt;
        // Wind from the hands: petals near a moving hand are dragged along and swirl.
        for (const h of hands) {
          const dx = p.x - h.palm.x;
          const dy = p.y - h.palm.y;
          const d = Math.hypot(dx, dy);
          const R = h.size * 4;
          if (d < R && h.presence > 0.3) {
            const k = (1 - d / R) * h.presence;
            p.vx += (h.vel.x * 2.5 - p.vx) * k * dt * 3 + (-dy / (d || 1)) * 300 * k * dt;
            p.vy += (h.vel.y * 2.5 - p.vy) * k * dt * 3 + (dx / (d || 1)) * 300 * k * dt;
            p.spin += k * dt * 8;
          }
        }
        p.vx += noise1(p.y * 0.01 + e.t * 0.5 + p.flip) * 60 * dt;
        p.vy += (70 * e.unit - p.vy) * dt * 0.8;
        p.vx *= Math.exp(-dt * 0.6);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
        p.flip += p.flipSpeed * dt;
      }
      petals = petals.filter((p) => p.age < p.life && p.y < e.H + 40 && p.x > -80 && p.x < e.W + 80);
    },
    draw(ctx, e) {
      for (const h of e.hands) {
        if (h.presence < 0.3 || !h.open) continue;
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, rgb, h.palm.x, h.palm.y, h.size * 1.6, 0.3 * h.presence);
        ctx.globalCompositeOperation = 'source-over';
      }
      for (const p of petals) {
        const fade = clamp(Math.min(p.age * 2, (p.life - p.age) * 1.5));
        const sx = Math.cos(p.flip);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(0.35 + 0.65 * Math.abs(sx), 1);
        const s = p.size;
        const shade = (sx < 0 ? -30 : 0) + p.shade;
        const c = rgb.map((v) => clamp(v + shade, 0, 255) | 0);
        const grad = ctx.createLinearGradient(0, -s, 0, s);
        grad.addColorStop(0, `rgba(${c.map((v) => Math.min(255, v + 50)).join(',')},${0.95 * fade})`);
        grad.addColorStop(1, `rgba(${c.join(',')},${0.95 * fade})`);
        ctx.fillStyle = grad;
        // Petal with the characteristic notch at the tip.
        ctx.beginPath();
        ctx.moveTo(0, s);
        ctx.bezierCurveTo(s * 0.9, s * 0.4, s * 0.7, -s * 0.7, s * 0.18, -s);
        ctx.lineTo(0, -s * 0.78);
        ctx.lineTo(-s * 0.18, -s);
        ctx.bezierCurveTo(-s * 0.7, -s * 0.7, -s * 0.9, s * 0.4, 0, s);
        ctx.fill();
        ctx.restore();
      }
    },
  };
}
