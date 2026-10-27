// Hands pack: powers drawn right on your hand.
//   Doigts de feu      a flame burning on each fingertip, like candles
//   Gant aux 6 pierres a golden gauntlet over your hand with six glowing
//                      stones; snap your fingers for a blinding flash
import { Particles, drawGlow, rand, TAU, noise1 } from './util.js';

const live = (hands) => hands.filter((h) => h.presence > 0.5);

// ---------- Doigts de feu ----------
export function fireFingersEffect() {
  const COLORS = [
    { name: 'Feu', rgb: null },
    { name: 'Feu bleu', rgb: [90, 170, 255] },
    { name: 'Feu vert', rgb: [100, 255, 130] },
    { name: 'Feu violet', rgb: [200, 100, 255] },
  ];
  let scheme = COLORS[0];
  const fire = new Particles(800);

  return {
    id: 'firefingers',
    name: 'Doigts de feu',
    hint: 'Ouvre la main : une flamme brûle au bout de chaque doigt. Ferme un doigt pour l’éteindre, bouge vite pour faire des traînées de feu.',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      scheme = COLORS[i];
    },
    start() {
      fire.clear();
    },
    update(dt, hands, e) {
      fire.update(dt, (p, dt2) => {
        p.vx += noise1(p.y * 0.03 + e.t * 4) * 200 * dt2;
      });
      const names = ['thumb', 'index', 'middle', 'ring', 'pinky'];
      for (const h of live(hands))
        h.tips.forEach((tip, i) => {
          if (!h.fingers[names[i]]) return;
          const r = h.size * 0.16;
          for (let k = 0; k < 3; k++)
            fire.add({
              x: tip.x + rand(-r, r) * 0.4,
              y: tip.y - r * 0.3,
              vx: h.vel.x * 0.2 + rand(-20, 20),
              vy: h.vel.y * 0.2 - rand(80, 180) * e.unit,
              drag: 1.5,
              g: -200 * e.unit,
              life: rand(0.25, 0.5),
              size: r * rand(0.7, 1.1),
              grow: 0.3,
              fire: !scheme.rgb,
              rgb: scheme.rgb,
              core: 0.35,
              alpha: 0.75,
            });
          e.light(tip.x, tip.y, h.size * 1.2, scheme.rgb || [255, 140, 40], 0.06);
        });
      e.audio.loop('fire', live(hands).length ? 0.25 : 0);
    },
    draw(ctx) {
      fire.draw(ctx);
    },
  };
}

// ---------- Gant aux 6 pierres ----------
export function gauntletEffect() {
  const STONES = [
    [255, 220, 60], // yellow
    [255, 60, 60], // red
    [80, 140, 255], // blue
    [200, 90, 255], // purple
    [80, 230, 120], // green
    [255, 150, 40], // orange
  ];
  let flash = 0;
  const sparks = new Particles(400);

  // Gold plate along a finger, from joint a to joint b.
  const plate = (ctx, a, b, w) => {
    const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    g.addColorStop(0, '#f7d56b');
    g.addColorStop(0.5, '#c8922b');
    g.addColorStop(1, '#f1c24f');
    ctx.strokeStyle = g;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };

  return {
    id: 'gauntlet',
    name: 'Gant aux 6 pierres',
    hint: 'Montre ta main : un gant doré à six pierres la recouvre. Claque des doigts (ou serre puis ouvre la main) : les pierres s’allument et tout l’écran éclate de lumière.',
    needs: { seg: false },
    start() {
      flash = 0;
      sparks.clear();
    },
    update(dt, hands, e) {
      sparks.update(dt);
      flash = Math.max(0, flash - dt * 0.8);
      for (const h of live(hands))
        if ((h.events.snap || h.events.release) && flash < 0.3) {
          flash = 1;
          e.flash([255, 240, 200], 0.9, 1.5);
          e.shake(25);
          e.punch?.(0.06);
          e.audio.play('thunder', 0.8);
          e.audio.play('boom', 0.6);
          e.emit?.('ultimate', { x: h.palm.x, y: h.palm.y });
          for (let i = 0; i < 160; i++) {
            const a = rand(TAU);
            const v = rand(300, 1400) * e.unit;
            sparks.add({
              x: h.palm.x,
              y: h.palm.y,
              vx: Math.cos(a) * v,
              vy: Math.sin(a) * v,
              drag: 2,
              life: rand(0.5, 1.2),
              size: rand(3, 7) * e.unit,
              rgb: STONES[i % 6],
              core: 0.5,
            });
          }
        }
    },
    drawOver(ctx, e) {
      sparks.draw(ctx);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const h of live(e.hands)) {
        const lm = h.lm;
        const w = h.size * 0.16;
        // Back of the hand: a gold plate between the wrist and the knuckles.
        ctx.fillStyle = '#c8922b';
        ctx.strokeStyle = '#7a5410';
        ctx.lineWidth = 2 * e.unit;
        ctx.beginPath();
        for (const i of [0, 1, 5, 9, 13, 17]) ctx.lineTo(lm[i].x, lm[i].y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Fingers.
        for (const [a, b, c, d] of [
          [1, 2, 3, 4],
          [5, 6, 7, 8],
          [9, 10, 11, 12],
          [13, 14, 15, 16],
          [17, 18, 19, 20],
        ]) {
          plate(ctx, lm[a], lm[b], w * 1.1);
          plate(ctx, lm[b], lm[c], w);
          plate(ctx, lm[c], lm[d], w * 0.9);
        }
        // Six stones: five on the knuckles of the fingers, one in the palm.
        const spots = [lm[3], lm[6], lm[10], lm[14], lm[18], { x: (lm[0].x + lm[9].x) / 2, y: (lm[0].y + lm[9].y) / 2 }];
        ctx.globalCompositeOperation = 'lighter';
        spots.forEach((p, i) => {
          const glow = 0.5 + 0.2 * noise1(e.t * 3 + i) + flash * 0.8;
          drawGlow(ctx, STONES[i], p.x, p.y, w * (i === 5 ? 2.6 : 2) * (1 + flash), glow, 0.55);
        });
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();
    },
  };
}
