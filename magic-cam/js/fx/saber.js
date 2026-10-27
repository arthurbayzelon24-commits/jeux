// Energy saber: close your fist as if holding a hilt and a blade ignites
// along the knuckles, with a motion trail when you swing it. Open the hand to
// switch it off. Works with both hands (double saber).
import { Particles, drawGlow, rand, noise1, clamp } from './util.js';

const COLORS = [
  { name: 'Bleu', rgb: [60, 150, 255] },
  { name: 'Rouge', rgb: [255, 40, 40] },
  { name: 'Vert', rgb: [70, 255, 90] },
  { name: 'Violet', rgb: [190, 70, 255] },
  { name: 'Or', rgb: [255, 190, 50] },
];

export function saberEffect() {
  const sparks = new Particles(300);
  const states = new Map();
  let rgb = COLORS[0].rgb;

  return {
    id: 'saber',
    name: 'Sabre laser',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      sparks.clear();
      states.clear();
    },
    update(dt, hands, e) {
      sparks.update(dt);
      let level = 0;
      for (const h of hands) {
        const st = states.get(h.id) || { on: 0, trail: [] };
        states.set(h.id, st);
        const holding = (h.fist || h.gesture === 'relaxed' || h.pinch) && h.presence > 0.5;
        const was = st.on;
        st.on = clamp(st.on + (holding ? dt * 4 : -dt * 4));
        if (was === 0 && st.on > 0) e.audio.play('saberOn', 0.9);
        if (was > 0 && st.on === 0) e.audio.play('saberOff', 0.6);
        // Blade axis: from the little-finger knuckle towards the index knuckle.
        let dx = h.lm[5].x - h.lm[17].x;
        let dy = h.lm[5].y - h.lm[17].y;
        const l = Math.hypot(dx, dy) || 1;
        dx /= l;
        dy /= l;
        st.dx = st.dx === undefined ? dx : st.dx + (dx - st.dx) * Math.min(1, dt * 25);
        st.dy = st.dy === undefined ? dy : st.dy + (dy - st.dy) * Math.min(1, dt * 25);
        const n = Math.hypot(st.dx, st.dy) || 1;
        st.dx /= n;
        st.dy /= n;
        const base = { x: (h.lm[5].x + h.lm[9].x) / 2 + st.dx * h.size * 0.1, y: (h.lm[5].y + h.lm[9].y) / 2 + st.dy * h.size * 0.1 };
        const len = h.size * 5.2 * st.on;
        const tip = { x: base.x + st.dx * len, y: base.y + st.dy * len };
        st.base = base;
        st.tip = tip;
        st.butt = { x: (h.lm[13].x + h.lm[17].x) / 2 - st.dx * h.size * 0.35, y: (h.lm[13].y + h.lm[17].y) / 2 - st.dy * h.size * 0.35 };
        st.w = h.size * 0.16;
        if (st.on === 0) st.trail.length = 0;
        else st.trail.unshift({ bx: base.x, by: base.y, tx: tip.x, ty: tip.y });
        if (st.trail.length > 7) st.trail.length = 7;
        if (st.on > 0.5) {
          const tipSpeed = Math.hypot(st.trail[0].tx - (st.trail[1]?.tx ?? tip.x), st.trail[0].ty - (st.trail[1]?.ty ?? tip.y)) / dt;
          if (tipSpeed > Math.min(e.W, e.H) * 3) e.audio.play('swing', Math.min(1, tipSpeed / (Math.min(e.W, e.H) * 8)));
          if (tip.x < 0 || tip.y < 0 || tip.x > e.W || tip.y > e.H)
            for (let i = 0; i < 3; i++)
              sparks.add({
                x: Math.max(0, Math.min(e.W, tip.x)),
                y: Math.max(0, Math.min(e.H, tip.y)),
                vx: rand(-500, 500),
                vy: rand(-500, 200),
                g: 1200,
                drag: 1,
                life: rand(0.2, 0.5),
                size: rand(2, 5) * e.unit,
                rgb: [255, 220, 160],
                core: 0.5,
              });
          e.light((base.x + tip.x) / 2, (base.y + tip.y) / 2, len * 0.9, rgb, 0.22 * st.on);
          level = Math.max(level, st.on);
        }
      }
      for (const id of states.keys()) if (!hands.some((h) => h.id === id)) states.delete(id);
      e.audio.loop('saber', level);
    },
    draw(ctx, e) {
      for (const st of states.values()) {
        if (!st.base) continue;
        // Hilt held in the fist.
        if (st.on > 0.01) {
          const hw = st.w * 1.3;
          ctx.lineCap = 'butt';
          ctx.strokeStyle = 'rgba(40,40,46,0.95)';
          ctx.lineWidth = hw * 2;
          ctx.beginPath();
          ctx.moveTo(st.butt.x, st.butt.y);
          ctx.lineTo(st.base.x, st.base.y);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(190,195,205,0.9)';
          ctx.lineWidth = hw * 0.7;
          ctx.stroke();
        }
        if (st.on < 0.01) continue;
        ctx.globalCompositeOperation = 'lighter';
        // Swing trail: translucent quads between successive blade positions.
        for (let i = 1; i < st.trail.length; i++) {
          const a = st.trail[i - 1];
          const b = st.trail[i];
          ctx.fillStyle = `rgba(${rgb.join(',')},${0.16 * (1 - i / st.trail.length) * st.on})`;
          ctx.beginPath();
          ctx.moveTo(a.bx, a.by);
          ctx.lineTo(a.tx, a.ty);
          ctx.lineTo(b.tx, b.ty);
          ctx.lineTo(b.bx, b.by);
          ctx.closePath();
          ctx.fill();
        }
        const f = 0.92 + 0.08 * noise1(e.t * 30);
        ctx.lineCap = 'round';
        for (const [k, color] of [
          [5, `rgba(${rgb.join(',')},0.1)`],
          [2.8, `rgba(${rgb.join(',')},0.3)`],
          [1.6, `rgba(${rgb.map((v) => (v + 255) >> 1).join(',')},0.75)`],
          [0.7, 'rgba(255,255,255,1)'],
        ]) {
          ctx.strokeStyle = color;
          ctx.lineWidth = st.w * k * f;
          ctx.beginPath();
          ctx.moveTo(st.base.x, st.base.y);
          ctx.lineTo(st.tip.x, st.tip.y);
          ctx.stroke();
        }
        drawGlow(ctx, rgb, st.base.x, st.base.y, st.w * 4, 0.6);
        ctx.globalCompositeOperation = 'source-over';
      }
      sparks.draw(ctx);
    },
  };
}
