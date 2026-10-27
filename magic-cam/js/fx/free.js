// Free mode: whatever you do, it makes a power. The gesture picks the power
// on the fly:
//   hand open towards the camera -> magic circle
//   both hands together, a ball  -> black hole
//   waving a hand                -> lightning
//   both hands up to the sky     -> thunder from the sky
//   index pointed                -> fire beam
//   closed fist                  -> laser sword
//   pinch                        -> neon drawing
//   V sign                       -> fireworks
//   both fists closed            -> shadow magic
//   one big sweep of the hand    -> a fireball thrown that way
//   both hands open, apart       -> energy strings between the fingers
import { magicCircleEffect } from './magiccircle.js';
import { blackholeEffect } from './blackhole.js';
import { lightningEffect } from './lightning.js';
import { thunderEffect } from './thunder.js';
import { fireBeamEffect } from './firebeam.js';
import { saberEffect } from './saber.js';
import { neonEffect } from './pack-tech.js';
import { fireworksEffect } from './fireworks.js';
import { shadowEffect } from './shadow.js';
import { fireballEffect } from './fireball.js';
import { stringsEffect } from './pack-energy2.js';
import { Particles, rand, TAU, drawGlow } from './util.js';

export const FREE_MOVES = [
  ['circle', 'Main ouverte devant toi', 'Cercle magique'],
  ['blackhole', 'Les deux mains en boule', 'Trou noir'],
  ['lightning', 'Agite la main', 'Éclairs'],
  ['thunder', 'Les deux mains vers le ciel', 'Foudre'],
  ['firebeam', 'Pointe l’index', 'Rayon de feu'],
  ['saber', 'Ferme le poing', 'Sabre laser'],
  ['neon', 'Pince les doigts', 'Dessin néon'],
  ['fireworks', 'Signe V', 'Feu d’artifice'],
  ['shadow', 'Les deux poings fermés', 'Magie des ombres'],
  ['strings', 'Deux mains ouvertes, écartées', 'Fils d’énergie'],
  ['fireball', 'Un grand geste de la main', 'Boule de feu lancée'],
];

export function freeModeEffect() {
  const make = {
    circle: magicCircleEffect,
    blackhole: blackholeEffect,
    lightning: lightningEffect,
    thunder: thunderEffect,
    firebeam: fireBeamEffect,
    saber: saberEffect,
    neon: neonEffect,
    fireworks: fireworksEffect,
    shadow: shadowEffect,
    fireball: fireballEffect,
    strings: stringsEffect,
  };
  const fx = {};
  let current = null;
  let candidate = null;
  let since = 0;
  let idle = 0;
  const waves = new Map();
  let waveUntil = -1;
  let sweepUntil = -1;
  let throwBall = null;
  // Combo: three different powers within 4 s set off a burst of every colour.
  let recent = [];
  let comboWave = null;
  const burst = new Particles(500);
  const COMBO_COLS = [
    [255, 120, 60],
    [120, 200, 255],
    [200, 120, 255],
    [255, 230, 120],
  ];
  const combo = (e) => {
    recent = [];
    const h = e.hands.find((x) => x.presence > 0.5);
    const x = h?.palm.x ?? e.W / 2;
    const y = h?.palm.y ?? e.H / 2;
    comboWave = { x, y, t: 0 };
    for (let i = 0; i < 220; i++) {
      const a = rand(TAU);
      const v = rand(300, 1500) * e.unit;
      burst.add({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        drag: 2.2,
        life: rand(0.5, 1.3),
        size: rand(3, 8) * e.unit,
        rgb: COMBO_COLS[i % 4],
        core: 0.4,
      });
    }
    e.flash([255, 255, 255], 0.45, 3);
    e.shake(30);
    e.punch?.(0.06);
    e.audio.play('combo', 1);
    e.audio.play('boom', 0.8);
    e.emit?.('ultimate', { id: 'free', combo: true });
    e.emit?.('combo');
  };

  const pick = (hands, e) => {
    const live = hands.filter((h) => h.presence > 0.5);
    if (!live.length) return null;
    // Two hands: a ball (close together) or both raised.
    if (live.length >= 2) {
      const [a, b] = live;
      const d = Math.hypot(a.palm.x - b.palm.x, a.palm.y - b.palm.y);
      if (d < (a.size + b.size) * 1.3 && !a.fist && !b.fist) return 'blackhole';
      if (a.palm.y < e.H * 0.35 && b.palm.y < e.H * 0.35 && a.openness > 0.6 && b.openness > 0.6) return 'thunder';
      if (a.fist && b.fist) return 'shadow';
      if (a.open && b.open) return 'strings';
    }
    // Waving: the hand changes direction sideways several times, fast.
    for (const h of live) {
      let w = waves.get(h.id);
      if (!w) waves.set(h.id, (w = { dir: 0, flips: [] }));
      if (Math.abs(h.vel.x) > e.W * 0.6) {
        const dir = Math.sign(h.vel.x);
        if (w.dir && dir !== w.dir) w.flips.push(e.t);
        w.dir = dir;
      }
      w.flips = w.flips.filter((t) => e.t - t < 1);
      if (w.flips.length >= 3) waveUntil = e.t + 0.8;
    }
    if (e.t < waveUntil) return 'lightning';
    // A big fast sweep (no back-and-forth): a fireball flies that way.
    const thrower = live.find((h) => h.speed > Math.max(e.W, e.H) * 1.4 && (h.open || h.gesture === 'relaxed'));
    if (thrower && e.t > sweepUntil) {
      sweepUntil = e.t + 1.2;
      throwBall = thrower;
    }
    if (e.t < sweepUntil) return 'fireball';
    const h = live.sort((a, b) => b.size - a.size)[0];
    if (h.fist) return 'saber';
    if (h.point) return 'firebeam';
    if (h.pinch) return 'neon';
    if (h.gesture === 'peace') return 'fireworks';
    if (h.open) return 'circle';
    return null;
  };

  const get = (id) => (fx[id] ||= make[id]());

  const effect = {
    id: 'free',
    name: 'Mode libre',
    needs: { seg: false },
    get current() {
      return current;
    },
    start() {
      current = null;
      candidate = null;
    },
    update(dt, hands, e) {
      const want = pick(hands, e);
      if (want !== candidate) {
        candidate = want;
        since = 0;
      } else since += dt;
      // A new gesture must hold a moment; waving and the ball switch at once.
      const quick = want === 'lightning' || want === 'blackhole' || want === 'thunder' || want === 'fireball';
      if (want && want !== current && (since > 0.25 || quick)) {
        e.audio.stopLoops?.();
        current = want;
        e.emit?.('freePower', current);
        recent = recent.filter((r) => e.t - r.t < 4 && r.id !== current);
        recent.push({ id: current, t: e.t });
        if (recent.length >= 3) combo(e);
        get(current).start?.(e);
        idle = 0;
      }
      // No gesture for a while: the power fades out.
      if (!want) idle += dt;
      else idle = 0;
      if (current && idle > 1.2) {
        e.audio.stopLoops?.();
        current = null;
      }
      // The ball: one black hole between both hands, not one per hand.
      let feed = hands;
      const live = hands.filter((h) => h.presence > 0.5);
      if (current === 'blackhole' && live.length >= 2) {
        const [a, b] = live;
        const palm = { x: (a.palm.x + b.palm.x) / 2, y: (a.palm.y + b.palm.y) / 2 };
        feed = [
          Object.create(a, {
            palm: { value: palm },
            size: { value: (a.size + b.size) * 0.75 },
            open: { value: true },
            gesture: { value: 'open' },
          }),
        ];
      }
      if (throwBall && current === 'fireball') {
        const h = throwBall;
        get('fireball').launch(e, h.palm.x, h.palm.y, h.vel.x * 1.3, h.vel.y * 1.3, h.size * 0.6);
        throwBall = null;
      }
      if (current) get(current).update?.(dt, feed, e);
      burst.update(dt);
      if (comboWave && (comboWave.t += dt) > 0.8) comboWave = null;
    },
  };
  for (const hook of ['drawBackground', 'drawBehind', 'draw', 'drawOver'])
    effect[hook] = (ctx, e) => (current ? get(current)[hook]?.(ctx, e) : undefined);
  // The combo burst goes over whatever power is on.
  const drawPower = effect.draw;
  effect.draw = (ctx, e) => {
    const r = drawPower(ctx, e);
    burst.draw(ctx);
    if (comboWave) {
      const t = comboWave.t / 0.8;
      ctx.globalCompositeOperation = 'lighter';
      COMBO_COLS.forEach((c, i) => {
        ctx.strokeStyle = `rgba(${c.join(',')},${0.7 * (1 - t)})`;
        ctx.lineWidth = (10 - i * 2) * e.unit * (1 - t) + 1;
        ctx.beginPath();
        ctx.arc(comboWave.x, comboWave.y, t * Math.max(e.W, e.H) * (0.5 + i * 0.12), 0, TAU);
        ctx.stroke();
      });
      drawGlow(ctx, [255, 255, 255], comboWave.x, comboWave.y, Math.max(e.W, e.H) * 0.3 * (1 - t), 0.6 * (1 - t), 0.2);
      ctx.globalCompositeOperation = 'source-over';
    }
    return r;
  };
  effect.ultimate = (e, a) => current && get(current).ultimate?.(e, a);
  return effect;
}
