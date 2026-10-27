// Spiral sphere: a sphere of wind spinning at high speed above the open palm,
// with streaks wrapping around it. A quick push throws it; it bursts on impact.
import { Particles, drawGlow, rand, TAU, noise1, clamp } from './util.js';

const COLORS = [
  { name: 'Vent bleu', rgb: [90, 180, 255] },
  { name: 'Vent blanc', rgb: [200, 230, 255] },
  { name: 'Vent rouge', rgb: [255, 80, 70] },
  { name: 'Vent violet', rgb: [180, 100, 255] },
];

function drawSphere(ctx, x, y, R, rgb, t, unit) {
  if (R < 2) return;
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, rgb, x, y, R * 2.4, 0.35, 0.05);
  const grad = ctx.createRadialGradient(x, y, R * 0.1, x, y, R);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.45, `rgba(${rgb.join(',')},0.45)`);
  grad.addColorStop(1, `rgba(${rgb.join(',')},0.15)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, TAU);
  ctx.fill();
  // Wind streaks: arcs on tilted great circles spinning very fast.
  ctx.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const tilt = (i / 16) * Math.PI;
    const spin = t * (9 + (i % 3) * 3) + i;
    const ry = R * (0.25 + 0.7 * Math.abs(Math.sin(i * 1.7)));
    ctx.strokeStyle = `rgba(${i % 2 ? '255,255,255' : rgb.map((v) => (v + 255) >> 1).join(',')},${0.55})`;
    ctx.lineWidth = Math.max(1, (1.2 + (i % 3)) * unit);
    ctx.beginPath();
    ctx.ellipse(x, y, R * 0.98, ry, tilt, spin, spin + 1.6 + (i % 4) * 0.4);
    ctx.stroke();
  }
  // Outer swirl ring.
  ctx.strokeStyle = `rgba(${rgb.join(',')},0.5)`;
  ctx.lineWidth = 3 * unit;
  for (let k = 0; k < 3; k++) {
    const s = t * 12 + k * 2.1;
    ctx.beginPath();
    ctx.arc(x, y, R * (1.15 + k * 0.08), s, s + 1.2);
    ctx.stroke();
  }
  drawGlow(ctx, [255, 255, 255], x, y, R * 0.5, 0.9, 0.4);
  ctx.globalCompositeOperation = 'source-over';
}

export function rasenganEffect() {
  const wind = new Particles(500);
  const state = new Map();
  let shots = [];
  let rgb = COLORS[0].rgb;

  return {
    id: 'rasengan',
    name: 'Sphère spirale',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      wind.clear();
      state.clear();
      shots = [];
    },
    update(dt, hands, e) {
      wind.update(dt);
      let level = 0;
      for (const h of hands) {
        const st = state.get(h.id) || { r: 0 };
        state.set(h.id, st);
        const open = (h.open || h.gesture === 'relaxed') && h.presence > 0.5;
        st.r = clamp(st.r + (open ? dt * 1.5 : -dt * 3));
        st.x = h.palm.x + h.up.x * h.size * 0.2;
        st.y = h.palm.y + h.up.y * h.size * 0.2 - h.size * 0.55;
        const R = h.size * 0.7 * st.r;
        if (st.r > 0.8 && h.speed > Math.min(e.W, e.H) * 2.2 && h.visible) {
          shots.push({ x: st.x, y: st.y, vx: h.vel.x * 1.3, vy: h.vel.y * 1.3, R, life: 1 });
          st.r = 0;
          e.audio.play('whoosh', 1);
        }
        if (R > 3) {
          for (let i = 0; i < 3; i++) {
            const a = rand(TAU);
            const rr = R * rand(1.2, 1.8);
            wind.add({
              x: st.x + Math.cos(a) * rr,
              y: st.y + Math.sin(a) * rr,
              vx: -Math.sin(a) * 600 * e.unit,
              vy: Math.cos(a) * 600 * e.unit,
              drag: 3,
              life: rand(0.15, 0.35),
              size: rand(2, 4) * e.unit,
              rgb: [230, 245, 255],
              core: 0.5,
            });
          }
          e.light(st.x, st.y, R * 6, rgb, 0.2 * st.r);
          level = Math.max(level, st.r);
        }
      }
      for (const s of shots) {
        s.life -= dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.life <= 0 || s.x < 0 || s.y < 0 || s.x > e.W || s.y > e.H) {
          s.dead = true;
          for (let i = 0; i < 120; i++) {
            const a = rand(TAU);
            const v = rand(300, 1400) * e.unit;
            wind.add({
              x: clamp(s.x, 0, e.W),
              y: clamp(s.y, 0, e.H),
              vx: Math.cos(a) * v,
              vy: Math.sin(a) * v,
              drag: 3,
              life: rand(0.3, 0.8),
              size: rand(3, 7) * e.unit,
              rgb,
              core: 0.4,
            });
          }
          e.flash(rgb, 0.35, 3);
          e.shake(20);
          e.audio.play('boom', 0.9);
        }
      }
      shots = shots.filter((s) => !s.dead);
      e.audio.loop('hum', level * 0.5);
    },
    draw(ctx, e) {
      wind.draw(ctx);
      for (const [id, st] of state) {
        const h = e.hands.find((x) => x.id === id);
        if (h && st.r > 0.02) drawSphere(ctx, st.x, st.y, h.size * 0.7 * st.r * (1 + 0.04 * noise1(e.t * 20)), rgb, e.t, e.unit);
      }
      for (const s of shots) drawSphere(ctx, s.x, s.y, s.R, rgb, e.t, e.unit);
    },
  };
}
