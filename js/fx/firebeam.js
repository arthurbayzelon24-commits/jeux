// Fire beam: point with the index finger and a jet of flame shoots from the
// fingertip in the direction the finger points. Other gestures keep a small
// pilot flame dancing on the fingertip.
import { Particles, drawGlow, rand, TAU, noise1, clamp, rayToEdge, drawBeam } from './util.js';

const COLORS = [
  { name: 'Feu', rgb: [255, 120, 30], hot: [255, 220, 120] },
  { name: 'Feu bleu', rgb: [60, 140, 255], hot: [170, 220, 255] },
  { name: 'Feu vert', rgb: [60, 255, 120], hot: [190, 255, 200] },
  { name: 'Feu violet', rgb: [190, 70, 255], hot: [230, 190, 255] },
];

export function fireBeamEffect() {
  const fire = new Particles(900);
  const states = new Map();
  let scheme = COLORS[0];

  const flame = (x, y, vx, vy, size, life) =>
    fire.add({
      x,
      y,
      vx,
      vy,
      drag: 1.2,
      g: -200,
      life,
      size,
      grow: 1.8,
      rgb: scheme.rgb,
      alpha: 0.28,
      core: 0.2,
      fire: scheme === COLORS[0],
    });

  return {
    id: 'firebeam',
    name: 'Rayon de feu',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      scheme = COLORS[i];
    },
    start() {
      fire.clear();
      states.clear();
    },
    update(dt, hands, e) {
      fire.update(dt, (p, d) => (p.vx += noise1(p.y * 0.02 + e.t * 4) * 260 * d));
      let level = 0;
      for (const h of hands) {
        const st = states.get(h.id) || { on: 0, dx: 0, dy: -1 };
        states.set(h.id, st);
        const tip = h.lm[8];
        // Finger direction (middle joint -> tip), smoothed so the beam glides.
        let dx = tip.x - h.lm[6].x;
        let dy = tip.y - h.lm[6].y;
        const l = Math.hypot(dx, dy) || 1;
        dx /= l;
        dy /= l;
        st.dx += (dx - st.dx) * Math.min(1, dt * 18);
        st.dy += (dy - st.dy) * Math.min(1, dt * 18);
        const n = Math.hypot(st.dx, st.dy) || 1;
        st.dx /= n;
        st.dy /= n;
        const pointing = (h.point || (h.fingers.index && !h.fingers.middle && !h.fingers.ring)) && h.presence > 0.5;
        const was = st.on;
        st.on = clamp(st.on + (pointing ? dt * 6 : -dt * 5));
        if (st.on > 0 && was === 0) e.audio.play('whoosh', 0.8);
        st.tip = tip;
        if (st.on > 0.02) {
          const reach = rayToEdge(tip.x, tip.y, st.dx, st.dy, e.W, e.H);
          st.len = reach * st.on;
          const w = h.size * 0.2;
          // Flames streaming along the jet.
          const k = Math.round(6 * st.on);
          for (let i = 0; i < k; i++) {
            const s = Math.random() * st.len;
            const spread = rand(-1, 1) * w * (0.3 + s / Math.max(1, reach));
            const v = rand(900, 1500) * e.unit;
            flame(
              tip.x + st.dx * s - st.dy * spread,
              tip.y + st.dy * s + st.dx * spread,
              st.dx * v,
              st.dy * v,
              w * rand(0.45, 0.85),
              rand(0.15, 0.35),
            );
          }
          // Impact where the jet hits the edge of the image.
          if (st.on > 0.95) {
            const ix = tip.x + st.dx * st.len;
            const iy = tip.y + st.dy * st.len;
            for (let i = 0; i < 4; i++) {
              const a = rand(TAU);
              const v = rand(200, 600) * e.unit;
              flame(ix, iy, Math.cos(a) * v - st.dx * 300, Math.sin(a) * v - st.dy * 300, w * rand(0.8, 1.6), rand(0.2, 0.5));
            }
            st.impact = { x: ix, y: iy };
          } else st.impact = null;
          e.light(tip.x + st.dx * st.len * 0.3, tip.y + st.dy * st.len * 0.3, h.size * 6, scheme.rgb, 0.12 * st.on);
          level = Math.max(level, st.on);
        } else if (h.presence > 0.3 && Math.random() < 0.7) {
          // Pilot flame on the fingertip.
          flame(tip.x + rand(-3, 3), tip.y, rand(-20, 20), -rand(60, 140) * e.unit, h.size * rand(0.12, 0.2), rand(0.25, 0.45));
        }
      }
      for (const id of states.keys()) if (!hands.some((h) => h.id === id)) states.delete(id);
      e.audio.loop('fire', Math.max(level, 0.15 * hands.length));
      if (level > 0.9) e.shake(1.5);
    },
    draw(ctx, e) {
      fire.draw(ctx);
      for (const [id, st] of states) {
        const h = e.hands.find((x) => x.id === id);
        if (!h || st.on < 0.02 || !st.tip) continue;
        const { x, y } = st.tip;
        const w = h.size * 0.2 * st.on;
        drawBeam(ctx, x, y, x + st.dx * st.len, y + st.dy * st.len, w, scheme.rgb, st.on, e.t, [
          [2.4, `rgba(${scheme.rgb.join(',')},${0.08 * st.on})`, 0.4],
          [1.5, `rgba(${scheme.rgb.join(',')},${0.25 * st.on})`, 0.3],
          [0.9, `rgba(${scheme.hot.join(',')},${0.7 * st.on})`, 0.15],
          [0.35, `rgba(255,255,255,${0.95 * st.on})`, 0.05],
        ]);
        ctx.globalCompositeOperation = 'lighter';
        const f = 0.85 + 0.15 * noise1(e.t * 20 + id);
        drawGlow(ctx, scheme.hot, x, y, h.size * 0.5 * f * st.on, 0.6);
        if (st.impact) drawGlow(ctx, scheme.rgb, st.impact.x, st.impact.y, h.size * 1.4 * f, 0.4, 0.1);
        ctx.globalCompositeOperation = 'source-over';
      }
    },
  };
}
