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
//   one big sweep of the hand    -> sakura petals
import { magicCircleEffect } from './magiccircle.js';
import { blackholeEffect } from './blackhole.js';
import { lightningEffect } from './lightning.js';
import { thunderEffect } from './thunder.js';
import { fireBeamEffect } from './firebeam.js';
import { saberEffect } from './saber.js';
import { neonEffect } from './pack-tech.js';
import { fireworksEffect } from './fireworks.js';
import { shadowEffect } from './shadow.js';
import { sakuraEffect } from './sakura.js';

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
  ['sakura', 'Un grand geste de la main', 'Pétales de sakura'],
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
    sakura: sakuraEffect,
  };
  const fx = {};
  let current = null;
  let candidate = null;
  let since = 0;
  let idle = 0;
  const waves = new Map();
  let waveUntil = -1;
  let sweepUntil = -1;

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
    // A big fast sweep (no back-and-forth): petals follow it for a moment.
    if (live.some((h) => h.speed > Math.max(e.W, e.H) * 1.6 && h.open)) sweepUntil = e.t + 1.2;
    if (e.t < sweepUntil) return 'sakura';
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
      const quick = want === 'lightning' || want === 'blackhole' || want === 'thunder' || want === 'sakura';
      if (want && want !== current && (since > 0.25 || quick)) {
        e.audio.stopLoops?.();
        current = want;
        e.emit?.('freePower', current);
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
      if (current) get(current).update?.(dt, feed, e);
    },
  };
  for (const hook of ['drawBackground', 'drawBehind', 'draw', 'drawOver'])
    effect[hook] = (ctx, e) => (current ? get(current)[hook]?.(ctx, e) : undefined);
  effect.ultimate = (e, a) => current && get(current).ultimate?.(e, a);
  return effect;
}
