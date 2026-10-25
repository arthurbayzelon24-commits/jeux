// Floating objects: crystals and stones levitating in a 3D orbit around the
// palm. Objects passing behind the hand or the body are hidden by them
// (segmentation), which sells the depth.
import { Particles, MESHES, rockMesh, drawMesh, drawGlow, rand, TAU, rotMatrix, palmPoint, palmRing, noise1 } from './util.js';

const SETS = [
  {
    name: 'Cristaux',
    items: [
      ['octa', [140, 200, 255]],
      ['octa', [200, 140, 255]],
      ['ico', [120, 255, 220]],
      ['octa', [255, 160, 220]],
      ['tetra', [160, 220, 255]],
    ],
    glow: [140, 200, 255],
  },
  {
    name: 'Pierres',
    items: [
      ['rock', [130, 120, 110]],
      ['rock', [105, 100, 95]],
      ['rock', [150, 135, 120]],
      ['rock', [120, 115, 105]],
      ['rock', [90, 85, 80]],
    ],
    glow: [255, 180, 90],
  },
  {
    name: 'Or',
    items: [
      ['cube', [250, 200, 90]],
      ['ico', [255, 215, 120]],
      ['octa', [240, 190, 80]],
      ['cube', [255, 225, 140]],
      ['tetra', [235, 180, 70]],
    ],
    glow: [255, 200, 90],
  },
];

export function floatingEffect() {
  const dust = new Particles(260);
  let set = SETS[0];
  let items = [];
  const build = () => {
    items = set.items.map(([kind, rgb], i) => ({
      mesh: kind === 'rock' ? rockMesh() : MESHES[kind],
      rgb,
      phase: (i / set.items.length) * TAU,
      height: rand(0.6, 1.6),
      radius: rand(1.4, 2.0),
      spin: [rand(-1.5, 1.5), rand(-2, 2), rand(-1, 1)],
      size: rand(0.28, 0.42),
      pos: null,
    }));
  };
  build();
  let orbitT = 0;

  // Computes every object's screen position for this frame.
  const place = (e) => {
    const hand = e.hands.filter((h) => h.presence > 0.2).sort((a, b) => b.size - a.size)[0];
    for (const [i, it] of items.entries()) {
      let target;
      if (hand) {
        const a = it.phase + orbitT;
        const bob = Math.sin(e.t * 2 + i) * 0.15;
        // Orbit in the palm plane, lifted along the palm normal (pointing up on
        // screen): palm up, objects circle above it and pass behind the hand.
        const c = liftedCentre(hand, 1.1 + it.height * 0.6 + bob);
        target = palmPoint(hand, Math.cos(a) * it.radius, Math.sin(a) * it.radius, 0, c);
        target.size = hand.size * it.size;
        target.presence = hand.presence;
      } else {
        // No hand: drift in mid-air across the frame.
        const a = it.phase + e.t * 0.3;
        target = {
          x: e.W * (0.5 + Math.cos(a) * 0.32),
          y: e.H * (0.42 + Math.sin(a * 1.3) * 0.12 + noise1(e.t * 0.5 + i) * 0.05),
          z: Math.sin(a) * 200 * e.unit,
          size: 40 * e.unit,
          presence: 1,
        };
      }
      if (!it.pos) it.pos = { ...target };
      const k = hand ? 0.22 : 0.05;
      for (const key of ['x', 'y', 'z', 'size']) it.pos[key] += (target[key] - it.pos[key]) * k;
      it.rot = rotMatrix(e.t * it.spin[0] + i, e.t * it.spin[1] + i * 2, e.t * it.spin[2]);
    }
    return hand;
  };

  const drawItem = (ctx, e, it) => {
    const p = it.pos;
    const persp = 1500 / (1500 + p.z);
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, set.glow, p.x, p.y, p.size * 2.2 * persp, 0.45, 0.05);
    ctx.globalCompositeOperation = 'source-over';
    drawMesh(ctx, it.mesh, { x: p.x, y: p.y, size: p.size * persp, rot: it.rot, rgb: it.rgb, edge: set.glow, emissive: 0.3, alpha: 0.95 });
  };

  return {
    id: 'floating',
    name: 'Objets flottants',
    hint: 'Ouvrez la main paume vers le haut : les objets lévitent et tournent autour d’elle, en passant devant et derrière vous. Tournez la main pour incliner l’orbite.',
    colors: SETS,
    needs: { seg: true },
    setColor(i) {
      set = SETS[i];
      build();
    },
    start() {
      dust.clear();
      items.forEach((it) => (it.pos = null));
    },
    update(dt, hands, e) {
      orbitT += dt * 1.4;
      dust.update(dt);
      this.hand = place(e);
      const hand = this.hand;
      if (hand) {
        if (Math.random() < 0.6) {
          const p = palmPoint(hand, rand(-1.8, 1.8), rand(-1.8, 1.8), 0, liftedCentre(hand, rand(0.4, 2)));
          dust.add({
            x: p.x,
            y: p.y,
            vx: rand(-20, 20),
            vy: -rand(20, 70),
            life: rand(0.6, 1.4),
            size: rand(2, 5) * e.unit,
            rgb: set.glow,
            core: 0.5,
            fadeIn: 0.3,
          });
        }
        e.light(hand.palm.x, hand.palm.y, hand.size * 4, set.glow, 0.15 * hand.presence);
      }
      e.audio.loop('hum', hand ? 0.2 : 0);
    },
    // Objects behind the palm plane are drawn before the body cut-out.
    drawBehind(ctx, e) {
      const back = items.filter((it) => it.pos && it.pos.z > 0).sort((a, b) => b.pos.z - a.pos.z);
      for (const it of back) drawItem(ctx, e, it);
    },
    draw(ctx, e) {
      const hand = this.hand;
      if (hand) {
        // A faint rune ring under the orbit.
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(${set.glow.join(',')},${0.35 * hand.presence})`;
        ctx.lineWidth = 2 * e.unit;
        palmRing(ctx, hand, 1.9, 72, 0, liftedCentre(hand, 0.9));
        ctx.stroke();
        drawGlow(ctx, set.glow, hand.palm.x, hand.palm.y, hand.size * 1.2, 0.35 * hand.presence);
        ctx.globalCompositeOperation = 'source-over';
      }
      dust.draw(ctx);
      const front = items.filter((it) => it.pos && it.pos.z <= 0).sort((a, b) => b.pos.z - a.pos.z);
      for (const it of front) drawItem(ctx, e, it);
    },
  };
}

// Palm centre moved along the palm normal, oriented to point up on screen.
function liftedCentre(hand, h) {
  const n = hand.basis.n;
  const k = n.y > 0 ? -1 : 1;
  return { x: hand.palm.x + n.x * k * h * hand.size, y: hand.palm.y + n.y * k * h * hand.size - hand.size * 0.3 };
}
