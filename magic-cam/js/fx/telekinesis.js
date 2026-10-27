// Telekinesis: physical 3D objects that rest on the floor until the hand
// lifts them with the mind. Open hand: levitate. Pinch: grab one and throw it.
// Point: orbit the fingertip. Fist then open: blast them away.
import { Particles, MESHES, rockMesh, drawMesh, drawGlow, rand, TAU, rotMatrix, clamp, dist, noise1 } from './util.js';

const COLORS = [
  { name: 'Psy bleu', rgb: [90, 190, 255] },
  { name: 'Psy rose', rgb: [255, 90, 200] },
  { name: 'Psy vert', rgb: [100, 255, 160] },
  { name: 'Psy rouge', rgb: [255, 80, 60] },
];

const ITEMS = [
  { mesh: () => rockMesh(), rgb: [120, 110, 100], size: 1 },
  { mesh: () => MESHES.cube, rgb: [190, 140, 80], size: 0.75 },
  { mesh: () => MESHES.octa, rgb: [120, 200, 255], size: 0.8 },
  { mesh: () => rockMesh(), rgb: [95, 90, 85], size: 0.7 },
  { mesh: () => MESHES.ico, rgb: [230, 230, 240], size: 0.65 },
  { mesh: () => MESHES.tetra, rgb: [220, 80, 90], size: 0.7 },
];

export function telekinesisEffect() {
  const sparks = new Particles(300);
  let objs = [];
  let rgb = COLORS[0].rgb;
  let grabbed = null;
  let blastCooldown = 0;
  let waves = [];

  const init = (e) => {
    const base = 46 * e.unit;
    objs = ITEMS.map((it, i) => ({
      mesh: it.mesh(),
      rgb: it.rgb,
      size: base * it.size,
      x: e.W * (0.15 + (i / (ITEMS.length - 1)) * 0.7),
      y: e.H - base * it.size,
      vx: 0,
      vy: 0,
      ax: rand(TAU),
      ay: rand(TAU),
      az: rand(TAU),
      wx: 0,
      wy: 0,
      wz: 0,
      lift: 0,
    }));
  };

  return {
    id: 'telekinesis',
    name: 'Télékinésie',
    hint: 'Main ouverte : les objets se soulèvent et suivent votre main. Pincez (pouce + index) pour en attraper un et lancez-le. Poing puis main ouverte : onde de choc !',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start(e) {
      sparks.clear();
      objs = [];
      grabbed = null;
      if (e?.W) init(e);
    },
    update(dt, hands, e) {
      if (!objs.length || objs[0].scaleW !== e.W) {
        init(e);
        objs.forEach((o) => (o.scaleW = e.W));
      }
      sparks.update(dt);
      waves = waves.filter((w) => (w.t += dt) < 0.6);
      blastCooldown -= dt;
      const hand = hands.filter((h) => h.presence > 0.5 && h.visible).sort((a, b) => b.size - a.size)[0];
      const g = 2200 * e.unit;

      if (hand?.events.release && blastCooldown <= 0) {
        for (const o of objs) {
          const dx = o.x - hand.palm.x;
          const dy = o.y - hand.palm.y;
          const d = Math.hypot(dx, dy) || 1;
          const v = 2200 * e.unit * clamp(1.5 - d / (e.W * 0.8), 0.4, 1.5);
          o.vx = (dx / d) * v;
          o.vy = (dy / d) * v - 300 * e.unit;
          o.wx = rand(-15, 15);
          o.wy = rand(-15, 15);
          o.lift = 0;
        }
        blastCooldown = 1.2;
        waves.push({ x: hand.palm.x, y: hand.palm.y, t: 0 });
        e.flash(rgb, 0.35, 3);
        e.shake(18);
        e.audio.play('boom', 0.8);
        grabbed = null;
      }
      if (hand?.events.pinchStart) {
        let best = null;
        let bd = hand.size * 4;
        for (const o of objs) {
          const d = dist(o, hand.pinchPoint);
          if (d < bd) {
            bd = d;
            best = o;
          }
        }
        grabbed = best;
        if (best) e.audio.play('grab', 0.6);
      }
      if (!hand || !hand.pinch) {
        if (grabbed && hand) {
          grabbed.vx = hand.vel.x * 1.4;
          grabbed.vy = hand.vel.y * 1.4;
          if (hand.speed > e.W) e.audio.play('whoosh', 0.7);
        }
        grabbed = null;
      }

      const active = hand && blastCooldown < 0.6;
      let level = 0;
      objs.forEach((o, i) => {
        let tx = null;
        let ty = null;
        let k = 60;
        if (active && grabbed === o) {
          tx = hand.pinchPoint.x;
          ty = hand.pinchPoint.y;
          k = 260;
        } else if (active && hand.fist) {
          const a = e.t * 4 + (i / objs.length) * TAU;
          tx = hand.palm.x + Math.cos(a) * hand.size * 1.1;
          ty = hand.palm.y + Math.sin(a) * hand.size * 0.7;
          k = 140;
        } else if (active && hand.point) {
          const a = e.t * 2.5 + (i / objs.length) * TAU;
          const tip = hand.lm[8];
          tx = tip.x + Math.cos(a) * hand.size * 1.8;
          ty = tip.y + Math.sin(a) * hand.size * 0.6;
          k = 80;
        } else if (active && (hand.open || hand.gesture === 'relaxed' || hand.gesture === 'peace')) {
          // Arc formation above the hand, swaying gently.
          const n = objs.length;
          const spread = (i - (n - 1) / 2) / ((n - 1) / 2);
          const perp = { x: -hand.up.y, y: hand.up.x };
          const r = hand.size * 2.6;
          tx = hand.palm.x + hand.up.x * r * (1.1 - Math.abs(spread) * 0.35) + perp.x * spread * r * 1.15;
          ty = hand.palm.y + hand.up.y * r * (1.1 - Math.abs(spread) * 0.35) + perp.y * spread * r * 1.15;
          tx += noise1(e.t + i * 3) * hand.size * 0.25;
          ty += noise1(e.t * 1.3 + i * 5) * hand.size * 0.25;
        }
        if (tx !== null) {
          o.lift = Math.min(1, o.lift + dt * 2.5);
          const kk = k * o.lift;
          const c = 2 * Math.sqrt(kk) * 0.75;
          o.vx += ((tx - o.x) * kk - o.vx * c) * dt;
          o.vy += ((ty - o.y) * kk - o.vy * c) * dt;
          o.wx += (rand(-1, 1) - o.wx * 0.5) * dt * 2;
          o.wy += (1.2 - o.wy * 0.5) * dt;
          level += o.lift;
          if (Math.random() < 0.15)
            sparks.add({
              x: o.x + rand(-o.size, o.size),
              y: o.y + rand(-o.size, o.size),
              vx: rand(-30, 30),
              vy: rand(-80, -20),
              life: rand(0.4, 0.9),
              size: rand(2, 5) * e.unit,
              rgb,
              core: 0.5,
            });
        } else {
          o.lift = Math.max(0, o.lift - dt * 1.5);
          o.vy += g * dt;
          o.wx *= 0.995;
          o.wy *= 0.995;
        }
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        o.ax += o.wx * dt;
        o.ay += o.wy * dt;
        o.az += o.wz * dt;
        // Floor and walls.
        const floor = e.H - o.size * 0.9;
        if (o.y > floor) {
          if (o.vy > 400 * e.unit) e.audio.play('thud', Math.min(1, o.vy / (2000 * e.unit)));
          o.y = floor;
          o.vy *= -0.35;
          o.vx *= 0.8;
          o.wx *= 0.7;
          o.wy *= 0.7;
          if (Math.abs(o.vy) < 60) o.vy = 0;
        }
        if (o.x < o.size) {
          o.x = o.size;
          o.vx = Math.abs(o.vx) * 0.6;
        }
        if (o.x > e.W - o.size) {
          o.x = e.W - o.size;
          o.vx = -Math.abs(o.vx) * 0.6;
        }
        if (o.y < o.size) {
          o.y = o.size;
          o.vy = Math.abs(o.vy) * 0.5;
        }
      });
      e.audio.loop('hum', clamp(level / objs.length) * 0.5);
      if (hand && level > 0.5) e.light(hand.palm.x, hand.palm.y, hand.size * 5, rgb, 0.18);
    },
    draw(ctx, e) {
      const hand = e.hands.filter((h) => h.presence > 0.3).sort((a, b) => b.size - a.size)[0];
      // Floor shadows.
      for (const o of objs) {
        const h = clamp((e.H - o.y) / (e.H * 0.6));
        ctx.globalAlpha = 0.35 * (1 - h);
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(o.x, e.H - o.size * 0.15, o.size * (1.1 - h * 0.5), o.size * 0.18, 0, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Psychic tendrils from the fingertips to lifted objects.
      if (hand) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (const [i, o] of objs.entries()) {
          if (o.lift < 0.1) continue;
          const tip = hand.tips[1 + (i % 4)];
          const mx = (tip.x + o.x) / 2 + noise1(e.t * 3 + i) * hand.size;
          const my = (tip.y + o.y) / 2 + noise1(e.t * 3 + i + 50) * hand.size;
          for (const [w, a] of [
            [8, 0.08],
            [3, 0.25],
            [1.2, 0.6],
          ]) {
            ctx.strokeStyle = `rgba(${rgb.join(',')},${a * o.lift * hand.presence})`;
            ctx.lineWidth = w * e.unit;
            ctx.beginPath();
            ctx.moveTo(tip.x, tip.y);
            ctx.quadraticCurveTo(mx, my, o.x, o.y);
            ctx.stroke();
          }
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      for (const o of objs) {
        if (o.lift > 0.05) {
          ctx.globalCompositeOperation = 'lighter';
          drawGlow(ctx, rgb, o.x, o.y, o.size * 2.4, 0.55 * o.lift, 0.05);
          ctx.globalCompositeOperation = 'source-over';
        }
        drawMesh(ctx, o.mesh, {
          x: o.x,
          y: o.y,
          size: o.size,
          rot: rotMatrix(o.ax, o.ay, o.az),
          rgb: o.rgb,
          edge: o.lift > 0.05 ? rgb : null,
          emissive: 0.25,
        });
      }
      sparks.draw(ctx);
      for (const w of waves) {
        const t = w.t / 0.6;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(${rgb.join(',')},${0.8 * (1 - t)})`;
        ctx.lineWidth = 12 * (1 - t) * e.unit + 1;
        ctx.beginPath();
        ctx.arc(w.x, w.y, t * Math.max(e.W, e.H) * 0.6, 0, TAU);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
    },
  };
}
