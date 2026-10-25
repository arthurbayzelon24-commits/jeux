// Plasma orb: an electric sphere with atomic orbits and inner lightning,
// floating above the palm. Pinch to shrink it into a compact charge.
import { Particles, drawGlow, rand, TAU, makeBolt, strokeBolts, noise1, palmPoint } from './util.js';

const COLORS = [
  { name: 'Plasma', rgb: [230, 80, 255] },
  { name: 'Cyan', rgb: [70, 220, 255] },
  { name: 'Toxique', rgb: [120, 255, 70] },
  { name: 'Solaire', rgb: [255, 170, 40] },
];

export function plasmaEffect() {
  const sparks = new Particles(300);
  let rgb = COLORS[0].rgb;
  let inner = [];
  let timer = 0;
  const state = new Map();

  const centreOf = (h) => {
    const p = palmPoint(h, 0, 0.6, 0);
    return { x: p.x, y: p.y - h.size * 0.5 };
  };

  return {
    id: 'plasma',
    name: 'Orbe de plasma',
    hint: 'Main ouverte : un orbe de plasma crépite au-dessus de la paume. Pincez pour le compresser, rouvrez la main pour le faire grossir.',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      sparks.clear();
      state.clear();
    },
    update(dt, hands, e) {
      sparks.update(dt);
      timer -= dt;
      let level = 0;
      const regen = timer <= 0;
      if (regen) {
        timer = 0.06;
        inner = [];
      }
      for (const h of hands) {
        const st = state.get(h.id) || { r: 0 };
        const want = (h.pinch ? 0.45 : h.fist ? 0.2 : 1.1) * h.presence;
        st.r += (want - st.r) * Math.min(1, dt * 5);
        state.set(h.id, st);
        level = Math.max(level, st.r);
        const c = centreOf(h);
        const R = h.size * 0.62 * st.r;
        if (regen && R > 4) {
          for (let k = 0; k < 4; k++) {
            const a = rand(TAU);
            inner.push(
              ...makeBolt(c.x, c.y, c.x + Math.cos(a) * R * 0.95, c.y + Math.sin(a) * R * 0.95, { jag: 0.35, depth: 4, branch: 0.2 }),
            );
          }
          // Arcs reaching down to the fingertips.
          if (Math.random() < 0.6) {
            const tip = h.tips[(Math.random() * 5) | 0];
            inner.push(...makeBolt(c.x, c.y + R * 0.5, tip.x, tip.y, { jag: 0.3, depth: 4, branches: false }));
          }
        }
        if (Math.random() < 0.3 * st.r) {
          const a = rand(TAU);
          sparks.add({
            x: c.x + Math.cos(a) * R,
            y: c.y + Math.sin(a) * R,
            vx: Math.cos(a) * 200,
            vy: Math.sin(a) * 200,
            drag: 3,
            life: rand(0.2, 0.5),
            size: rand(2, 4) * e.unit,
            rgb,
            core: 0.5,
          });
        }
        e.light(c.x, c.y, R * 6, rgb, 0.14 * st.r);
      }
      if (regen && inner.length && Math.random() < 0.2) e.audio.play('zap', 0.15);
      e.audio.loop('hum', level * 0.5);
    },
    draw(ctx, e) {
      ctx.globalCompositeOperation = 'lighter';
      for (const h of e.hands) {
        const st = state.get(h.id);
        if (!st || st.r < 0.02) continue;
        const c = centreOf(h);
        const R = h.size * 0.62 * st.r;
        const f = 0.85 + 0.15 * noise1(e.t * 15 + h.id);
        drawGlow(ctx, rgb, c.x, c.y, R * 2.4 * f, 0.3, 0.05);
        // Sphere body.
        const grad = ctx.createRadialGradient(c.x, c.y, R * 0.1, c.x, c.y, R);
        grad.addColorStop(0, 'rgba(255,255,255,0.6)');
        grad.addColorStop(0.35, `rgba(${rgb.join(',')},0.15)`);
        grad.addColorStop(0.85, `rgba(${rgb.join(',')},0.1)`);
        grad.addColorStop(1, `rgba(${rgb.join(',')},0.55)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(c.x, c.y, R, 0, TAU);
        ctx.fill();
        // Three tilted atomic orbits.
        ctx.lineWidth = 2.5 * e.unit;
        for (let i = 0; i < 3; i++) {
          const rot = (i * Math.PI) / 3 + e.t * 0.8;
          const tilt = 0.3 + 0.15 * Math.sin(e.t * 1.7 + i);
          ctx.strokeStyle = `rgba(${rgb.map((v) => (v + 255) >> 1).join(',')},0.75)`;
          ctx.beginPath();
          ctx.ellipse(c.x, c.y, R * 0.92, R * 0.92 * tilt, rot, 0, TAU);
          ctx.stroke();
          const a = e.t * (3 + i) + i;
          const ex = Math.cos(a) * R * 0.92;
          const ey = Math.sin(a) * R * 0.92 * tilt;
          drawGlow(
            ctx,
            [255, 255, 255],
            c.x + ex * Math.cos(rot) - ey * Math.sin(rot),
            c.y + ex * Math.sin(rot) + ey * Math.cos(rot),
            R * 0.12,
            1,
          );
        }
        drawGlow(ctx, [255, 255, 255], c.x, c.y, R * 0.35 * f, 0.7);
      }
      ctx.globalCompositeOperation = 'source-over';
      strokeBolts(ctx, inner, rgb, 1.3 * e.unit, 0.9);
      sparks.draw(ctx);
    },
  };
}
