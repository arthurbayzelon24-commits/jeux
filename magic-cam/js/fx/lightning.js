// Lightning in the hands: arcs between fingertips, bolts lashing out, an
// arc between both hands and a discharge when the fist opens.
import { makeBolt, strokeBolts, drawGlow, rand, Particles, dist, noise1 } from './util.js';

const COLORS = [
  { name: 'Électrique', rgb: [120, 190, 255] },
  { name: 'Violet', rgb: [190, 120, 255] },
  { name: 'Rouge Sith', rgb: [255, 70, 70] },
  { name: 'Or', rgb: [255, 210, 90] },
  { name: 'Vert', rgb: [90, 255, 150] },
];

export function lightningEffect() {
  const sparks = new Particles(400);
  let bolts = [];
  let timer = 0;
  let strikes = [];
  let color = COLORS[0].rgb;

  const spark = (x, y, k = 1) =>
    sparks.add({
      x,
      y,
      vx: rand(-400, 400) * k,
      vy: rand(-400, 300) * k,
      g: 900,
      drag: 2,
      life: rand(0.2, 0.5),
      size: rand(3, 7),
      rgb: color,
      core: 0.4,
    });

  return {
    id: 'lightning',
    name: 'Éclairs',
    hint: 'Ouvrez la main : des éclairs jaillissent. Rapprochez les deux mains pour créer un arc. Serrez le poing puis ouvrez-le d’un coup pour foudroyer.',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      color = COLORS[i].rgb;
    },
    start() {
      sparks.clear();
      bolts = [];
      strikes = [];
    },
    update(dt, hands, e) {
      sparks.update(dt);
      timer -= dt;
      strikes = strikes.filter((s) => (s.life -= dt) > 0);
      for (const h of hands) {
        if (h.events.release && h.visible) {
          // Big discharge in the pointing direction.
          const dir = { x: h.up.x, y: h.up.y };
          const len = Math.max(e.W, e.H);
          for (let i = 0; i < 3; i++) {
            const ang = Math.atan2(dir.y, dir.x) + rand(-0.35, 0.35);
            strikes.push({
              bolts: makeBolt(h.palm.x, h.palm.y, h.palm.x + Math.cos(ang) * len, h.palm.y + Math.sin(ang) * len, {
                jag: 0.18,
                depth: 7,
                branch: 0.3,
              }),
              life: 0.35,
              max: 0.35,
            });
          }
          e.flash(color, 0.55, 3);
          e.shake(16);
          e.audio.play('thunder', 1);
          for (let i = 0; i < 40; i++) spark(h.palm.x, h.palm.y, 2);
        }
      }
      let level = 0;
      if (timer <= 0) {
        timer = 0.05;
        bolts = [];
        for (const h of hands) {
          if (h.presence < 0.3) continue;
          const s = h.size;
          const power = h.fist ? 0.4 : 0.6 + h.openness * 0.6;
          level = Math.max(level, power * h.presence);
          const tips = h.tips;
          // Arcs from the palm to every extended fingertip.
          const ext = [h.fingers.thumb, h.fingers.index, h.fingers.middle, h.fingers.ring, h.fingers.pinky];
          tips.forEach((tip, i) => {
            if (ext[i] || Math.random() < 0.25)
              bolts.push(
                ...makeBolt(h.palm.x, h.palm.y, tip.x, tip.y, { jag: 0.25, depth: 4, branches: false }).map((b) => ((b.w = 0.8), b)),
              );
          });
          // Arcs jumping between neighbouring fingertips.
          for (let i = 0; i < 4; i++)
            if (Math.random() < 0.5)
              bolts.push(...makeBolt(tips[i].x, tips[i].y, tips[i + 1].x, tips[i + 1].y, { jag: 0.4, depth: 4, branches: false }));
          // Tendrils lashing out from the fingertips.
          const n = h.fist ? 2 : 2 + Math.round(h.openness * 3);
          for (let k = 0; k < n; k++) {
            const tip = h.fist ? h.palm : tips[1 + ((Math.random() * 4) | 0)];
            const ang = h.angle + rand(-1.3, 1.3);
            const len = s * rand(0.8, 2.6) * power;
            const x2 = tip.x + Math.cos(ang) * len;
            const y2 = tip.y + Math.sin(ang) * len;
            bolts.push(...makeBolt(tip.x, tip.y, x2, y2, { jag: 0.3, depth: 5, branch: 0.25 }));
            if (Math.random() < 0.3) spark(x2, y2);
          }
        }
        // Arc between two hands, stronger when they are close.
        if (hands.length >= 2) {
          const [a, b] = hands;
          const d = dist(a.palm, b.palm);
          const reach = (a.size + b.size) * 4;
          if (d < reach && a.presence > 0.5 && b.presence > 0.5) {
            const k = 1 + Math.round((1 - d / reach) * 3);
            for (let i = 0; i < k; i++)
              bolts.push(
                ...makeBolt(a.palm.x, a.palm.y, b.palm.x, b.palm.y, { jag: 0.22, depth: 6, branch: 0.2 }).map((x) => ((x.big = true), x)),
              );
            level = 1.3;
            if (Math.random() < 0.3) spark((a.palm.x + b.palm.x) / 2, (a.palm.y + b.palm.y) / 2, 1.5);
          }
        }
        if (bolts.length && Math.random() < 0.25) e.audio.play('zap', 0.25 + Math.random() * 0.3);
      }
      e.audio.loop('hum', level * 0.6);
      for (const h of hands) {
        const flicker = 0.6 + 0.4 * noise1(e.t * 20 + h.id * 7);
        e.light(h.palm.x, h.palm.y, h.size * 5, color, 0.12 * flicker * h.presence);
      }
    },
    draw(ctx, e) {
      for (const h of hands(e)) {
        const flicker = 0.7 + 0.3 * noise1(e.t * 30 + h.id);
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, color, h.palm.x, h.palm.y, h.size * 0.9 * flicker, 0.3 * h.presence, 0.08);
        drawGlow(ctx, [255, 255, 255], h.palm.x, h.palm.y, h.size * 0.18 * flicker, 0.6 * h.presence);
        for (const tip of h.tips) drawGlow(ctx, color, tip.x, tip.y, h.size * 0.22 * flicker, 0.4 * h.presence, 0.1);
        ctx.globalCompositeOperation = 'source-over';
      }
      const w = 2 * e.unit;
      strokeBolts(ctx, bolts, color, w, 0.95);
      for (const s of strikes) strokeBolts(ctx, s.bolts, color, w * 2.2, s.life / s.max);
      sparks.draw(ctx);
    },
  };
}

const hands = (e) => e.hands.filter((h) => h.presence > 0.05);
