// Double power: one power in each hand. The hand on the right of the screen
// drives the main power, the one on the left the second power. Built as a
// single effect that forwards every hook to both. Bringing both palms
// together makes a Fusion: a blast in the colours of both powers.
import { Particles, drawGlow, rand, TAU, clamp } from './fx/util.js';

const HOOKS = ['drawBackground', 'drawBehind', 'draw', 'drawOver'];

export function makeDual(
  main,
  second,
  tints = [
    [255, 200, 90],
    [120, 200, 255],
  ],
) {
  const fusion = new Particles(600);
  let cool = 0;
  let wave = null;
  const fuse = (e, x, y) => {
    for (let i = 0; i < 180; i++) {
      const a = rand(TAU);
      const v = rand(200, 1400) * e.unit;
      fusion.add({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        drag: 2,
        life: rand(0.5, 1.2),
        size: rand(3, 9) * e.unit,
        rgb: tints[i % 2],
        core: 0.4,
      });
    }
    wave = { x, y, t: 0 };
    e.flash(tints[0], 0.4, 2);
    e.flash(tints[1], 0.3, 2);
    e.shake(35);
    e.punch(0.07);
    e.audio.play('boom', 1);
    e.audio.play('teleport', 0.7);
    e.emit('spell', { kind: 'fusion', x, y, radius: Math.max(e.W, e.H) * 0.35 });
    e.emit('fusion', { main: main.id, second: second.id });
  };
  const split = (hands, e) => {
    if (hands.length >= 2) {
      const sorted = [...hands].sort((a, b) => b.palm.x - a.palm.x);
      return [[sorted[0]], sorted.slice(1)];
    }
    // One hand: it belongs to the side of the screen it is on.
    return hands[0] && hands[0].palm.x < e.W / 2 ? [[], hands] : [hands, []];
  };
  const dual = {
    id: `${main.id}+${second.id}`,
    name: `${main.name} + ${second.name}`,
    dual: [main, second],
    colors: main.colors,
    needs: {
      seg: !!(main.needs?.seg || second.needs?.seg),
      pose: !!(main.needs?.pose || second.needs?.pose),
      plate: !!(main.needs?.plate || second.needs?.plate),
    },
    occlude: main.occlude || second.occlude,
    noBlur: main.noBlur && second.noBlur,
    chargeMode: main.chargeMode,
    action: main.action || second.action,
    setColor(i) {
      main.setColor?.(i);
    },
    start(e) {
      main.start?.(e);
      second.start?.(e);
    },
    stop(e) {
      main.stop?.(e);
      second.stop?.(e);
    },
    update(dt, hands, e) {
      const [a, b] = split(hands, e);
      main.update?.(dt, a, e);
      second.update?.(dt, b, e);
      fusion.update(dt);
      cool -= dt;
      if (wave && (wave.t += dt) > 1) wave = null;
      const p = a[0];
      const q = b[0];
      if (
        p &&
        q &&
        cool <= 0 &&
        p.presence > 0.5 &&
        q.presence > 0.5 &&
        Math.hypot(p.palm.x - q.palm.x, p.palm.y - q.palm.y) < (p.size + q.size) * 0.7
      ) {
        cool = 2.5;
        fuse(e, (p.palm.x + q.palm.x) / 2, (p.palm.y + q.palm.y) / 2);
      }
    },
    trigger(e) {
      main.trigger?.(e);
      second.trigger?.(e);
    },
    ultimate(e, a) {
      main.ultimate?.(e, a);
      second.ultimate?.(e, a);
    },
  };
  for (const name of HOOKS)
    if (main[name] || second[name])
      dual[name] = (ctx, e) => {
        // Each power draws with its own hands in e.hands (some read it there).
        const all = e.hands;
        const [a, b] = split(all, e);
        let handled = false;
        try {
          e.hands = b;
          if (second[name]) handled = second[name](ctx, e) || handled;
          e.hands = a;
          if (main[name]) handled = main[name](ctx, e) || handled;
        } finally {
          e.hands = all;
        }
        return handled;
      };
  // The fusion is drawn after both powers.
  const drawPowers = dual.draw;
  dual.draw = (ctx, e) => {
    drawPowers?.(ctx, e);
    fusion.draw(ctx);
    if (wave) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 2; i++) {
        const k = clamp(wave.t * 1.4 - i * 0.15);
        ctx.strokeStyle = `rgba(${tints[i].join(',')},${(1 - k) * 0.8})`;
        ctx.lineWidth = 16 * e.unit * (1 - k) + 1;
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, k * Math.max(e.W, e.H) * 0.6, 0, TAU);
        ctx.stroke();
      }
      drawGlow(ctx, [255, 255, 255], wave.x, wave.y, 120 * e.unit * (1 - wave.t), 1 - wave.t);
      ctx.globalCompositeOperation = 'source-over';
    }
  };
  return dual;
}
