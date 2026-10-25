// Koi pond: a school of colourful koi swims in circles around your open hand;
// moving fingers leave ripples like on water, and fast moves scatter the fish.
import { rand, TAU, noise1, clamp } from './util.js';

const PALETTES = [
  {
    name: 'Koï',
    fish: [
      [255, 120, 30],
      [255, 255, 255],
      [230, 40, 30],
      [255, 200, 60],
      [40, 40, 40],
    ],
  },
  {
    name: 'Arc-en-ciel',
    fish: [
      [255, 60, 60],
      [255, 170, 40],
      [250, 230, 60],
      [80, 220, 120],
      [60, 170, 255],
      [170, 90, 255],
    ],
  },
  {
    name: 'Or',
    fish: [
      [255, 210, 90],
      [255, 180, 50],
      [255, 240, 180],
    ],
  },
];

export function koiEffect() {
  let fish = [];
  let ripples = [];
  let palette = PALETTES[0];
  const lastTips = new Map();

  const spawn = (e) => {
    fish = Array.from({ length: 22 }, (_, i) => {
      const c = palette.fish[i % palette.fish.length];
      const c2 = palette.fish[(i * 3 + 1) % palette.fish.length];
      return {
        x: rand(e.W),
        y: rand(e.H),
        a: rand(TAU),
        v: 0,
        len: rand(26, 46) * e.unit,
        c,
        c2,
        phase: rand(TAU),
        orbit: rand(1.6, 3.4),
        dir: Math.random() < 0.7 ? 1 : -1,
      };
    });
  };

  return {
    id: 'koi',
    name: 'Bassin de koïs',
    colors: PALETTES,
    needs: { seg: false },
    setColor(i) {
      palette = PALETTES[i];
      fish.forEach((f, k) => {
        f.c = palette.fish[k % palette.fish.length];
        f.c2 = palette.fish[(k * 3 + 1) % palette.fish.length];
      });
    },
    start() {
      fish = [];
      ripples = [];
    },
    update(dt, hands, e) {
      if (!fish.length) spawn(e);
      const hand = hands.filter((h) => h.presence > 0.4).sort((a, b) => b.size - a.size)[0];
      for (const f of fish) {
        let tx;
        let ty;
        f.phase += dt * 0.8 * f.dir;
        if (hand) {
          const R = hand.size * f.orbit;
          tx = hand.palm.x + Math.cos(f.phase) * R;
          ty = hand.palm.y + Math.sin(f.phase) * R * 0.8;
          // Fast hand: the school scatters.
          if (hand.speed > Math.min(e.W, e.H) * 1.5 && Math.hypot(f.x - hand.palm.x, f.y - hand.palm.y) < hand.size * 4) {
            tx = f.x + (f.x - hand.palm.x) * 2;
            ty = f.y + (f.y - hand.palm.y) * 2;
          }
        } else {
          tx = e.W / 2 + Math.cos(f.phase * 0.6) * e.W * 0.35 + noise1(f.phase) * 60;
          ty = e.H / 2 + Math.sin(f.phase * 0.9) * e.H * 0.35;
        }
        const want = Math.atan2(ty - f.y, tx - f.x);
        let d = want - f.a;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        f.a += clamp(d, -4 * dt, 4 * dt);
        const speed = Math.min(380, Math.hypot(tx - f.x, ty - f.y) * 2.2 + 60) * e.unit;
        f.v += (speed - f.v) * dt * 2;
        f.x += Math.cos(f.a) * f.v * dt;
        f.y += Math.sin(f.a) * f.v * dt;
        f.wig = (f.wig || 0) + dt * (6 + f.v / (40 * e.unit));
      }
      // Ripples from moving fingertips.
      for (const h of hands) {
        if (h.presence < 0.5) continue;
        const prev = lastTips.get(h.id) || 0;
        if (e.t - prev > 0.18) {
          lastTips.set(h.id, e.t);
          const tip = h.tips[1 + ((Math.random() * 4) | 0)];
          ripples.push({ x: tip.x, y: tip.y, t: 0, r: h.size * 1.4 });
          if (Math.random() < 0.3) e.audio.play('drop', 0.25);
        }
      }
      ripples = ripples.filter((r) => (r.t += dt) < 1.4);
    },
    draw(ctx, e) {
      // A faint water tint.
      ctx.fillStyle = 'rgba(20,80,110,0.12)';
      ctx.fillRect(0, 0, e.W, e.H);
      for (const r of ripples) {
        const t = r.t / 1.4;
        for (let k = 0; k < 2; k++) {
          const R = r.r * (t + k * 0.25);
          ctx.strokeStyle = `rgba(220,245,255,${0.45 * (1 - t)})`;
          ctx.lineWidth = 2 * e.unit;
          ctx.beginPath();
          ctx.ellipse(r.x, r.y, R, R * 0.6, 0, 0, TAU);
          ctx.stroke();
        }
      }
      for (const f of fish) {
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.a);
        const L = f.len;
        const w = Math.sin(f.wig) * 0.35;
        // Shadow under the fish.
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(-L * 0.1 + 6, 8, L * 0.55, L * 0.2, 0, 0, TAU);
        ctx.fill();
        // Tail.
        ctx.fillStyle = `rgba(${f.c.join(',')},0.85)`;
        ctx.beginPath();
        ctx.moveTo(-L * 0.45, 0);
        ctx.quadraticCurveTo(-L * 0.8, -L * 0.3 + w * L * 0.3, -L * 1.0, -L * 0.25 + w * L * 0.5);
        ctx.quadraticCurveTo(-L * 0.75, w * L * 0.3, -L * 1.0, L * 0.25 + w * L * 0.5);
        ctx.quadraticCurveTo(-L * 0.8, L * 0.3 + w * L * 0.3, -L * 0.45, 0);
        ctx.fill();
        // Fins.
        ctx.fillStyle = `rgba(${f.c.join(',')},0.6)`;
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(L * 0.12, s * L * 0.2, L * 0.16, L * 0.07, s * (0.8 + w * 0.5), 0, TAU);
          ctx.fill();
        }
        // Body with a patch of the second colour.
        const grad = ctx.createLinearGradient(-L * 0.5, 0, L * 0.5, 0);
        grad.addColorStop(0, `rgb(${f.c.join(',')})`);
        grad.addColorStop(0.55, `rgb(${f.c2.join(',')})`);
        grad.addColorStop(1, `rgb(${f.c.join(',')})`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 0, L * 0.5, L * 0.17, w * 0.15, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.ellipse(L * 0.1, -L * 0.05, L * 0.25, L * 0.05, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    },
  };
}
