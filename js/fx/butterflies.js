// Glowing butterflies flutter around you; hold a hand still and they come to
// land on your fingertips, move fast and they scatter.
import { Particles, drawGlow, rand, TAU, noise1, clamp } from './util.js';

const COLORS = [
  { name: 'Morpho', rgb: [80, 170, 255], rgb2: [150, 240, 255] },
  { name: 'Monarque', rgb: [255, 140, 30], rgb2: [255, 220, 120] },
  { name: 'Féérique', rgb: [255, 110, 220], rgb2: [190, 140, 255] },
];

export function butterfliesEffect() {
  const dust = new Particles(300);
  let flies = [];
  let scheme = COLORS[0];

  const spawn = (e) => {
    flies = Array.from({ length: 12 }, (_, i) => ({
      x: rand(e.W),
      y: rand(e.H * 0.8),
      vx: 0,
      vy: 0,
      flap: rand(TAU),
      size: rand(16, 26) * e.unit,
      seed: i * 7.3,
      landed: 0,
      heading: 0,
    }));
  };

  return {
    id: 'butterflies',
    name: 'Papillons',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      scheme = COLORS[i];
    },
    start() {
      flies = [];
      dust.clear();
    },
    update(dt, hands, e) {
      if (!flies.length) spawn(e);
      dust.update(dt);
      const hand = hands.filter((h) => h.presence > 0.5).sort((a, b) => b.size - a.size)[0];
      const calm = hand && hand.speed < Math.min(e.W, e.H) * 0.6;
      const scared = hand && hand.speed > Math.min(e.W, e.H) * 1.8;
      flies.forEach((f, i) => {
        let tx;
        let ty;
        if (hand && calm && i < 5) {
          // Land on a fingertip.
          const tip = hand.tips[i];
          tx = tip.x;
          ty = tip.y - f.size * 0.3;
        } else if (hand && !scared) {
          const a = e.t * 0.8 + f.seed;
          tx = hand.palm.x + Math.cos(a) * hand.size * (2 + (i % 3));
          ty = hand.palm.y + Math.sin(a * 1.3) * hand.size * 2 - hand.size;
        } else {
          tx = e.W * (0.5 + 0.45 * noise1(e.t * 0.2 + f.seed));
          ty = e.H * (0.45 + 0.4 * noise1(e.t * 0.25 + f.seed + 50));
        }
        if (scared && Math.hypot(f.x - hand.palm.x, f.y - hand.palm.y) < hand.size * 5) {
          f.vx += (f.x - hand.palm.x) * 8 * dt;
          f.vy += (f.y - hand.palm.y) * 8 * dt;
        }
        const dx = tx - f.x;
        const dy = ty - f.y;
        const d = Math.hypot(dx, dy);
        f.landed = clamp(f.landed + (d < f.size * 0.8 && calm ? dt * 3 : -dt * 4));
        const k = f.landed > 0.5 ? 12 : 3;
        f.vx += (dx * k - f.vx * 2.2) * dt + noise1(e.t * 3 + f.seed) * 300 * dt * (1 - f.landed);
        f.vy += (dy * k - f.vy * 2.2) * dt + noise1(e.t * 3 + f.seed + 9) * 300 * dt * (1 - f.landed);
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.flap += dt * (f.landed > 0.5 ? 3 : 16);
        if (Math.hypot(f.vx, f.vy) > 20) f.heading += (Math.atan2(f.vy, f.vx) + Math.PI / 2 - f.heading) * Math.min(1, dt * 4);
        if (Math.random() < 0.3)
          dust.add({
            x: f.x,
            y: f.y,
            vx: rand(-15, 15),
            vy: rand(10, 40),
            life: rand(0.5, 1.2),
            size: rand(1.5, 3) * e.unit,
            rgb: scheme.rgb2,
            core: 0.6,
          });
      });
    },
    draw(ctx, e) {
      dust.draw(ctx);
      for (const f of flies) {
        const open = 0.25 + 0.75 * Math.abs(Math.sin(f.flap));
        const s = f.size;
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(Math.max(-0.6, Math.min(0.6, Math.sin(f.heading) * 0.6)));
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, scheme.rgb, 0, 0, s * 2.2, 0.35);
        ctx.globalCompositeOperation = 'source-over';
        for (const side of [-1, 1]) {
          ctx.save();
          ctx.scale(side * open, 1);
          const grad = ctx.createLinearGradient(0, -s, s, s);
          grad.addColorStop(0, `rgba(${scheme.rgb2.join(',')},0.95)`);
          grad.addColorStop(1, `rgba(${scheme.rgb.join(',')},0.85)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(0, -s * 0.1);
          ctx.bezierCurveTo(s * 0.6, -s * 1.1, s * 1.25, -s * 0.6, s * 0.9, -s * 0.05);
          ctx.bezierCurveTo(s * 1.05, s * 0.5, s * 0.5, s * 0.95, 0, s * 0.2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(20,20,40,0.6)';
          ctx.lineWidth = Math.max(1, s * 0.06);
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.beginPath();
          ctx.arc(s * 0.65, -s * 0.45, s * 0.1, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = '#1b1525';
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.08, s * 0.45, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    },
  };
}
