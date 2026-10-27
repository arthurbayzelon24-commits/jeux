// Renders the power cards, the header and the app icon with the real effects
// on a golden wireframe hand. Run with: node magic-cam/tools/render-art.cjs
import { EFFECTS } from '../js/effects.js';
import { Engine } from '../js/engine.js';
import { makeCanvas, hexToRgb } from '../js/fx/util.js';

// Open right hand, palm towards the camera. Units: wrist -> middle knuckle = 1.
const OPEN = [
  [0, 0],
  [-0.35, -0.15],
  [-0.62, -0.38],
  [-0.82, -0.58],
  [-0.98, -0.78],
  [-0.3, -0.95],
  [-0.38, -1.35],
  [-0.42, -1.6],
  [-0.45, -1.82],
  [-0.05, -1],
  [-0.06, -1.45],
  [-0.07, -1.72],
  [-0.08, -1.95],
  [0.18, -0.95],
  [0.24, -1.36],
  [0.28, -1.6],
  [0.31, -1.8],
  [0.38, -0.82],
  [0.5, -1.1],
  [0.57, -1.28],
  [0.63, -1.45],
];
const F = { index: [5, 6, 7, 8], middle: [9, 10, 11, 12], ring: [13, 14, 15, 16], pinky: [17, 18, 19, 20] };
function curl(p, [m, a, b, c]) {
  const M = p[m];
  p[a] = [M[0] + 0.02, M[1] - 0.28];
  p[b] = [M[0] + 0.05, M[1] - 0.12];
  p[c] = [M[0] + 0.05, M[1] + 0.05];
}
function shape(g) {
  const p = OPEN.map((q) => [...q]);
  if (g === 'point' || g === 'fist') ['middle', 'ring', 'pinky'].forEach((f) => curl(p, F[f]));
  if (g === 'fist') {
    curl(p, F.index);
    p[3] = [-0.32, -0.62];
    p[4] = [-0.12, -0.72];
  }
  if (g === 'point') {
    p[3] = [-0.32, -0.62];
    p[4] = [-0.1, -0.75];
  }
  if (g === 'pinch') {
    p[4] = [-0.5, -1.3];
    p[8] = [-0.47, -1.33];
    p[7] = [-0.45, -1.42];
    p[3] = [-0.75, -0.95];
  }
  return p;
}
// Builds MediaPipe-like landmarks (normalised) for a hand.
function hand(g, cx, cy, len, W, H, { roll = 0, tilt = 0.25, flip = false } = {}) {
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  const landmarks = [];
  const world = [];
  for (const [x0, y0] of shape(g)) {
    const xx = flip ? -x0 : x0;
    const x = xx * c - y0 * s;
    const y = xx * s + y0 * c;
    landmarks.push({ x: (cx + x * len) / W, y: (cy + y * len * Math.cos(tilt)) / H, z: 0 });
    world.push({ x: x * 0.09, y: y * 0.09 * Math.cos(tilt), z: -y * 0.09 * Math.sin(tilt) });
  }
  return { landmarks, world, handedness: 'Right' };
}

// Golden wireframe hand, like a hologram, painted under the effects.
function paintHand(g, raw, W, H, len) {
  const P = raw.landmarks.map((p) => ({ x: p.x * W, y: p.y * H }));
  const chains = [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20],
  ];
  const widths = [0.24, 0.21, 0.22, 0.2, 0.17].map((k) => k * len);
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // Skin body with a warm gradient.
  const grad = g.createLinearGradient(0, P[12].y, 0, P[0].y + len * 0.4);
  grad.addColorStop(0, '#f6c9a8');
  grad.addColorStop(1, '#c98b6a');
  g.fillStyle = grad;
  g.strokeStyle = grad;
  g.beginPath();
  [0, 1, 5, 9, 13, 17].forEach((i, k) => (k ? g.lineTo(P[i].x, P[i].y) : g.moveTo(P[i].x, P[i].y)));
  g.closePath();
  g.lineWidth = len * 0.3;
  g.fill();
  g.stroke();
  // Wrist / forearm.
  g.lineWidth = len * 0.55;
  g.beginPath();
  g.moveTo(P[0].x, P[0].y);
  g.lineTo(P[0].x + (P[0].x - P[9].x) * 0.9, P[0].y + (P[0].y - P[9].y) * 0.9);
  g.stroke();
  chains.forEach((ch, i) => {
    g.lineWidth = widths[i];
    g.beginPath();
    ch.forEach((j, k) => (k ? g.lineTo(P[j].x, P[j].y) : g.moveTo(P[j].x, P[j].y)));
    g.stroke();
  });
  // Golden mesh: rails along each finger, rungs across, grid on the palm.
  g.globalCompositeOperation = 'lighter';
  const gold = (a) => `rgba(255,205,130,${a})`;
  for (const [w, a] of [
    [len * 0.03, 0.18],
    [Math.max(1, len * 0.01), 0.85],
  ]) {
    g.lineWidth = w;
    g.strokeStyle = gold(a);
    chains.forEach((ch, i) => {
      const half = widths[i] * 0.42;
      for (let k = 1; k < ch.length; k++) {
        const A = P[ch[k - 1]];
        const B = P[ch[k]];
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const l = Math.hypot(dx, dy) || 1;
        const nx = (-dy / l) * half;
        const ny = (dx / l) * half;
        g.beginPath();
        for (const s of [-1, 0, 1]) {
          g.moveTo(A.x + nx * s, A.y + ny * s);
          g.lineTo(B.x + nx * s, B.y + ny * s);
        }
        const steps = Math.max(2, Math.round(l / (half * 0.9)));
        for (let t = 0; t <= steps; t++) {
          const x = A.x + (dx * t) / steps;
          const y = A.y + (dy * t) / steps;
          g.moveTo(x - nx, y - ny);
          g.quadraticCurveTo(x + (dx / l) * half * 0.3, y + (dy / l) * half * 0.3, x + nx, y + ny);
        }
        g.stroke();
      }
    });
    // Palm grid between the wrist and the knuckles.
    const knuckles = [5, 9, 13, 17];
    g.beginPath();
    for (let r = 0; r <= 5; r++) {
      const t = r / 5;
      knuckles.forEach((k, i) => {
        const x = P[0].x + (P[k].x - P[0].x) * t + (i - 1.5) * len * 0.03 * (1 - t);
        const y = P[0].y + (P[k].y - P[0].y) * t;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      });
    }
    for (const k of [1, ...knuckles]) {
      g.moveTo(P[0].x, P[0].y);
      g.lineTo(P[k].x, P[k].y);
    }
    g.stroke();
  }
  // Glowing joints.
  for (const p of P) {
    const r = len * 0.05;
    const gg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    gg.addColorStop(0, 'rgba(255,240,200,0.9)');
    gg.addColorStop(1, 'rgba(255,190,90,0)');
    g.fillStyle = gg;
    g.fillRect(p.x - r, p.y - r, r * 2, r * 2);
  }
  g.restore();
}

function backdrop(W, H, tint, person) {
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const [r, gg, b] = tint;
  g.fillStyle = '#07060a';
  g.fillRect(0, 0, W, H);
  const neb = g.createRadialGradient(W * 0.5, H * 0.38, 0, W * 0.5, H * 0.45, W * 0.85);
  neb.addColorStop(0, `rgba(${r},${gg},${b},0.32)`);
  neb.addColorStop(0.5, `rgba(${r >> 1},${gg >> 1},${b >> 1},0.14)`);
  neb.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = neb;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 140; i++) {
    g.fillStyle = `rgba(255,${200 + Math.random() * 55},${170 + Math.random() * 85},${Math.random() * 0.7})`;
    const s = Math.random() * 2 + 0.5;
    g.fillRect(Math.random() * W, Math.random() * H, s, s);
  }
  if (person) {
    const pg = g.createLinearGradient(0, H * 0.2, 0, H);
    pg.addColorStop(0, '#4a3f4f');
    pg.addColorStop(1, '#241d28');
    g.fillStyle = pg;
    personShape(g, W, H);
    g.fill();
  }
  return c;
}
function personShape(g, W, H) {
  g.beginPath();
  g.ellipse(W * 0.5, H * 0.34, W * 0.1, H * 0.13, 0, 0, Math.PI * 2);
  g.moveTo(W * 0.16, H);
  g.bezierCurveTo(W * 0.18, H * 0.6, W * 0.33, H * 0.53, W * 0.5, H * 0.52);
  g.bezierCurveTo(W * 0.67, H * 0.53, W * 0.82, H * 0.6, W * 0.84, H);
  g.closePath();
}
function mask(W, H) {
  const mw = 128;
  const c = makeCanvas(mw, mw);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  personShape(g, mw, mw);
  g.fill();
  const d = g.getImageData(0, 0, mw, mw).data;
  const data = new Float32Array(mw * mw);
  for (let i = 0; i < data.length; i++) data[i] = d[i * 4 + 3] / 255;
  return { width: mw, height: mw, data };
}
// Pose with shoulders/arms for the wings card.
function pose(W, H) {
  const pts = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  const set = (i, x, y) => (pts[i] = { x, y, visibility: 0.99 });
  set(11, 0.66, 0.58);
  set(12, 0.34, 0.58);
  set(15, 0.86, 0.3);
  set(16, 0.14, 0.3);
  set(13, 0.8, 0.45);
  set(14, 0.2, 0.45);
  // Face: nose, eyes, ears (on the head of the person shape).
  set(0, 0.5, 0.37);
  set(2, 0.465, 0.32);
  set(5, 0.535, 0.32);
  set(7, 0.41, 0.33);
  set(8, 0.59, 0.33);
  return pts;
}

// Scene per power: hands (as a function of time), frames, extras.
function scene(id, W, H) {
  const L = H * 0.2;
  const one = (g, x, y, o) => () => [hand(g, W * x, H * y, L, W, H, o)];
  const S = {
    kamehameha: {
      hands: (t) => {
        // Charge, then a short upward push fires the wave into the sky.
        const up = Math.min(0.12, Math.max(0, t - 1.7) * 3.2);
        return [
          hand('open', W * 0.42, H * (0.92 - up), L * 0.9, W, H, { roll: -1.1 }),
          hand('open', W * 0.58, H * (0.92 - up), L * 0.9, W, H, { roll: 1.1, flip: true }),
        ];
      },
      frames: 60,
    },
    firebeam: { hands: one('point', 0.3, 0.92, { roll: 0.55 }), frames: 50 },
    hud: { hands: (t) => [hand('point', W * (0.5 + Math.sin(t * 2) * 0.15), H * 0.86, L * 0.85, W, H, { roll: -0.2 })], frames: 70 },
    saber: { hands: one('fist', 0.45, 0.85, { roll: 0.5 }), frames: 40 },
    portal: {
      hands: (t) => [hand('point', W * (0.6 + Math.cos(t * 4.5) * 0.2), H * (0.82 + Math.sin(t * 4.5) * 0.2), L * 0.8, W, H)],
      frames: 110,
    },
    fireworks: { hands: one('point', 0.5, 0.98, { roll: 0.1 }), frames: 62 },
    heart: { hands: one('pinch', 0.55, 0.95), frames: 45 },
    thunder: { hands: one('open', 0.5, 0.5), frames: 12 },
    water: { hands: (t) => [hand('point', W * (0.3 + t * 0.25), H * (0.8 + Math.sin(t * 6) * 0.1), L, W, H, { roll: 0.3 })], frames: 45 },
    floating: { hands: one('open', 0.5, 1.0, { tilt: 1.1 }), frames: 50 },
    telekinesis: { hands: one('open', 0.5, 0.95), frames: 70 },
    mindgrab: { hands: one('point', 0.35, 0.9, { roll: 0.5 }), frames: 70 },
    shockwave: { hands: one('open', 0.5, 0.9), frames: 14, trigger: 4 },
    magnet: {
      hands: () => [
        hand('open', W * 0.3, H * 0.85, L, W, H, { roll: -0.3 }),
        hand('open', W * 0.7, H * 0.85, L, W, H, { roll: 0.3, flip: true }),
      ],
      frames: 60,
    },
    chrono: { hands: one('open', 0.8, 0.62, { roll: 0.2 }), frames: 30, person: true, trigger: 20 },
    gravity: {
      hands: (t) => [hand(Math.floor(t * 5) % 2 ? 'pinch' : 'open', W * (0.3 + ((t * 0.9) % 0.4)), H * 0.55, L * 0.8, W, H)],
      frames: 70,
    },
    butterflies: { hands: one('open', 0.5, 0.9), frames: 120 },
    koi: { hands: one('open', 0.55, 0.85), frames: 120 },
    sakura: { hands: one('open', 0.62, 0.95, { roll: 0.3 }), frames: 150 },
    aura: { hands: one('open', 0.8, 0.62, { roll: 0.2 }), frames: 50, person: true },
    teleport: { hands: one('open', 0.8, 0.62, { roll: 0.2 }), frames: 50, person: true, trigger: 38 },
    crown: { hands: () => [], frames: 30, person: true, pose: true },
    heromask: { hands: () => [], frames: 10, person: true, pose: true },
    speed: { hands: () => [], frames: 30, person: true, trigger: 2 },
    hologram: { hands: () => [], frames: 20, person: true },
    dust: { hands: () => [], frames: 45, person: true, trigger: 5 },
    livingshadow: { hands: () => [], frames: 40, person: true },
    clones: { hands: () => [], frames: 40, person: true, trigger: 5 },
    whip: {
      hands: (t) => [hand('fist', W * (0.3 + Math.sin(t * 5) * 0.15), H * (0.45 + Math.cos(t * 5) * 0.1), L * 0.9, W, H)],
      frames: 50,
    },
    strings: {
      hands: () => [
        hand('open', W * 0.28, H * 0.8, L, W, H, { roll: -0.9 }),
        hand('open', W * 0.72, H * 0.8, L, W, H, { roll: 0.9, flip: true }),
      ],
      frames: 30,
    },
    firetornado: { hands: () => [], frames: 60, person: true },
    ripples: { hands: (t) => [hand('point', W * (0.35 + t * 0.4), H * 0.8, L * 0.8, W, H, { roll: 0.3 })], frames: 40 },
    starcatch: { hands: one('open', 0.6, 0.8), frames: 70 },
    spotlight: { hands: () => [], frames: 20, person: true, pose: true },
    glass: { hands: one('fist', 0.5, 0.85), frames: 12, trigger: 3 },
    disco: { hands: one('open', 0.7, 0.6), frames: 40 },
    neonline: { hands: () => [], frames: 20, person: true },
    frost: { hands: () => [hand('fist', W * 0.75, H * 0.62, L, W, H, { roll: 0.2 })], frames: 50, person: true },
    rain: { hands: one('open', 0.62, 0.5, { roll: 0.2 }), frames: 50, person: true },
    snowfall: { hands: () => [], frames: 160, person: true },
    electro: { hands: () => [hand('fist', W * 0.75, H * 0.62, L, W, H, { roll: 0.2 })], frames: 40, person: true },
    invisible: { hands: () => [], frames: 40, person: true, trigger: 20 },
    size: { hands: () => [], frames: 50, person: true, trigger: 5 },
    wings: { hands: () => [], frames: 40, person: true, pose: true },
    galaxy: { hands: one('open', 0.52, 0.92, { tilt: 0.9, roll: -0.2 }), frames: 50 },
    blackhole: { hands: one('open', 0.5, 0.98), frames: 70 },
    shadow: {
      hands: (t) => [
        hand('open', W * 0.35, H * 0.95, L, W, H, { roll: -0.3 }),
        hand('fist', W * 0.68, H * 0.9, L, W, H, { roll: 0.3, flip: true }),
      ],
      frames: 60,
    },
    ice: { hands: one('open', 0.5, 0.95), frames: 55 },
    dragon: {
      hands: (t) => [hand('point', W * (0.5 + Math.cos(t * 3) * 0.25), H * (0.75 + Math.sin(t * 6) * 0.1), L * 0.8, W, H)],
      frames: 70,
    },
    tornado: { hands: one('open', 0.5, 1.02), frames: 60 },
    meteor: { hands: one('open', 0.3, 0.55), frames: 90 },
    lava: { hands: one('open', 0.5, 1.0), frames: 60 },
    sun: { hands: one('open', 0.5, 1.0), frames: 50 },
    sonic: {
      hands: (t) => {
        const d = Math.max(0.12, 0.3 - t * 0.6);
        return [
          hand('open', W * (0.5 - d), H * 0.8, L * 0.9, W, H, { roll: -1.2 }),
          hand('open', W * (0.5 + d), H * 0.8, L * 0.9, W, H, { roll: 1.2, flip: true }),
        ];
      },
      frames: 32,
      trigger: 22,
    },
    shield: { hands: one('open', 0.5, 0.85), frames: 40 },
    lasereyes: { hands: () => [], frames: 30, person: true, pose: true },
    halo: { hands: () => [], frames: 40, person: true, pose: true },
    web: { hands: (t) => [hand('point', W * 0.3, H * 0.95, L, W, H, { roll: 0.5 + (t > 0.5 ? 0.5 : 0) })], frames: 40 },
    neon: {
      hands: (t) => [hand('pinch', W * (0.5 + Math.cos(t * 3) * 0.25), H * (0.85 + Math.sin(t * 6) * 0.12), L * 0.8, W, H)],
      frames: 70,
    },
    matrix: { hands: one('open', 0.5, 0.9), frames: 60 },
    planet: { hands: one('open', 0.5, 1.0), frames: 40 },
    crystalball: { hands: one('open', 0.5, 1.0), frames: 50 },
    aurora: { hands: one('open', 0.6, 0.8), frames: 50 },
    stars: { hands: one('point', 0.35, 0.95, { roll: 0.4 }), frames: 50 },
    comet: { hands: (t) => [hand('open', W * (0.3 + t * 0.25), H * (0.85 - Math.sin(t * 3) * 0.1), L, W, H, { roll: 0.2 })], frames: 45 },
    rainbow: {
      hands: () => [
        hand('open', W * 0.18, H * 0.9, L * 0.8, W, H, { roll: -0.3 }),
        hand('open', W * 0.82, H * 0.9, L * 0.8, W, H, { roll: 0.3, flip: true }),
      ],
      frames: 40,
    },
    bubbles: { hands: one('open', 0.5, 0.95), frames: 120 },
    confetti: { hands: (t) => [hand(t < 0.6 ? 'fist' : 'open', W * 0.5, H * 0.95, L, W, H)], frames: 40 },
    coins: { hands: one('pinch', 0.55, 0.65), frames: 70 },
    snow: { hands: one('open', 0.5, 0.95), frames: 120 },
    fireflies: { hands: one('open', 0.5, 0.95), frames: 120 },
    wisps: { hands: one('open', 0.5, 0.95), frames: 60 },
    free: { hands: () => [hand('open', W * 0.5, H * 0.95, L, W, H)], frames: 110 },
    runes: {
      hands: (t) => [hand('pinch', W * (0.5 + Math.cos(t * 5) * 0.22), H * (0.62 + Math.sin(t * 5) * 0.2), L * 0.75, W, H)],
      frames: 38,
    },
    chidori: { hands: one('open', 0.5, 0.85, { roll: 0.2 }), frames: 30 },
    genkidama: { hands: one('open', 0.5, 0.72), frames: 120 },
    getsuga: {
      hands: (t) => [hand('fist', W * (0.85 - Math.min(1, t * 3) * 0.6), H * (0.95 - Math.min(1, t * 3) * 0.3), L, W, H, { roll: -0.8 })],
      frames: 9,
    },
    hollowpurple: {
      hands: (t) => {
        const d = Math.max(0.1, 0.32 - t * 0.3);
        return [
          hand('open', W * (0.5 - d), H * 0.95, L * 0.8, W, H, { roll: -0.3 }),
          hand('open', W * (0.5 + d), H * 0.95, L * 0.8, W, H, { roll: 0.3, flip: true }),
        ];
      },
      frames: 40,
    },
    sharingan: { hands: () => [], frames: 20, person: true, pose: true },
    supersaiyan: { hands: () => [], frames: 30, person: true },
    waterbreath: {
      hands: (t) => [hand('point', W * (0.15 + t * 0.7), H * (0.85 - Math.sin(t * 4) * 0.25), L * 0.8, W, H, { roll: 0.6 })],
      frames: 32,
    },
    firefist: {
      hands: (t) => [hand('fist', W * (0.3 + Math.min(0.2, t * 1.5)), H * (1.05 - Math.min(0.3, t * 2.2)), L, W, H)],
      frames: 20,
    },
    haki: { hands: one('fist', 0.5, 0.95), frames: 25 },
    domain: { hands: () => [], frames: 30, person: true, trigger: 5 },
  };
  return S[id] || { hands: one('open', 0.5, 0.92), frames: 50 };
}

export function renderPower(def, size = 512) {
  const W = size;
  const H = size;
  const canvas = makeCanvas(W, H);
  const engine = new Engine(canvas, { settings: { points: false, cinema: false }, maxSide: size });
  engine.charge.update = () => {};
  engine.charge.draw = () => {};
  const effect = def.make();
  const sc = scene(def.id, W, H);
  const tint = hexToRgb(def.tint);
  engine.setEffect(effect);
  const m = sc.person ? mask(W, H) : null;
  const base = backdrop(W, H, tint, sc.person);
  let now = 1000;
  for (let i = 0; i < sc.frames; i++) {
    now += 33;
    const t = i / 30;
    const raw = sc.hands(t);
    const src = makeCanvas(W, H);
    const g = src.getContext('2d');
    g.drawImage(base, 0, 0);
    for (const r of raw) paintHand(g, r, W, H, L(raw, H));
    if (sc.trigger === i) effect.trigger?.(engine);
    engine.frame({ source: src, sw: W, sh: H, mirror: false, raw, mask: m, maskFresh: true, pose: sc.pose ? pose(W, H) : undefined, now });
  }
  return canvas.toDataURL('image/jpeg', 0.88);
}
const L = (raw, H) => H * 0.2 * (raw.length === 2 ? 0.9 : 1);

// Wide header: two golden hands reaching up into golden dust.
export function renderHeader(W = 1400, H = 560) {
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const bg = g.createRadialGradient(W / 2, H * 0.1, 0, W / 2, H * 0.3, W * 0.7);
  bg.addColorStop(0, '#3a2a14');
  bg.addColorStop(0.5, '#140f10');
  bg.addColorStop(1, '#0b0a0f');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 700; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const s = Math.random() * 2.2 + 0.3;
    g.fillStyle = `rgba(255,${190 + Math.random() * 60},${110 + Math.random() * 80},${Math.random() * 0.8})`;
    g.fillRect(x, y, s, s);
  }
  const len = H * 0.36;
  const left = hand('open', W * 0.13, H * 1.02, len, W, H, { roll: 0.45, flip: true, tilt: 0.5 });
  const right = hand('open', W * 0.87, H * 1.02, len, W, H, { roll: -0.45, tilt: 0.5 });
  for (const r of [left, right]) {
    g.globalAlpha = 0.95;
    paintHand(g, r, W, H, len);
    g.globalAlpha = 1;
    const tip = r.landmarks[8];
    const thumb = r.landmarks[4];
    for (const p of [tip, thumb, r.landmarks[12]]) {
      const x = p.x * W;
      const y = p.y * H;
      const gg = g.createRadialGradient(x, y, 0, x, y, len * 0.5);
      gg.addColorStop(0, 'rgba(255,245,210,0.9)');
      gg.addColorStop(0.2, 'rgba(255,200,110,0.45)');
      gg.addColorStop(1, 'rgba(255,170,60,0)');
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = gg;
      g.fillRect(x - len * 0.5, y - len * 0.5, len, len);
      g.globalCompositeOperation = 'source-over';
    }
  }
  const fade = g.createLinearGradient(0, H * 0.6, 0, H);
  fade.addColorStop(0, 'rgba(11,10,15,0)');
  fade.addColorStop(1, 'rgba(11,10,15,1)');
  g.fillStyle = fade;
  g.fillRect(0, 0, W, H);
  return c.toDataURL('image/jpeg', 0.88);
}

// App icon: a glowing magic circle (runes in fire orange and pink) around a
// big white "play" sign, on a deep night violet. Bold and readable small.
export function renderIcon(size = 1024) {
  const S = size;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const u = S / 1024;
  const cx = S / 2;
  const cy = S / 2;
  const bg = g.createRadialGradient(cx, cy, 0, cx, cy, S * 0.75);
  bg.addColorStop(0, '#3a0f6e');
  bg.addColorStop(0.6, '#1a0638');
  bg.addColorStop(1, '#0a0216');
  g.fillStyle = bg;
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.5})`;
    g.beginPath();
    g.arc(Math.random() * S, Math.random() * S, (0.8 + Math.random() * 2) * u, 0, Math.PI * 2);
    g.fill();
  }
  // Glow behind the circle.
  const glow = g.createRadialGradient(cx, cy, S * 0.2, cx, cy, S * 0.5);
  glow.addColorStop(0, 'rgba(255,110,60,0.45)');
  glow.addColorStop(1, 'rgba(255,60,140,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'lighter';
  const ring = (r, w, col, blur) => {
    g.save();
    g.shadowColor = col;
    g.shadowBlur = blur * u;
    g.strokeStyle = col;
    g.lineWidth = w * u;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  };
  const grad = g.createLinearGradient(0, 0, S, S);
  grad.addColorStop(0, '#ffb238');
  grad.addColorStop(0.5, '#ff5a3d');
  grad.addColorStop(1, '#ff3d8b');
  ring(S * 0.4, 18, '#ff8a3d', 40);
  ring(S * 0.34, 8, '#ff3d8b', 30);
  // Runes between the two rings: ticks and small diamonds.
  g.save();
  g.translate(cx, cy);
  g.strokeStyle = '#ffd27a';
  g.fillStyle = '#ffd27a';
  g.lineWidth = 6 * u;
  for (let k = 0; k < 24; k++) {
    g.save();
    g.rotate((k / 24) * Math.PI * 2);
    if (k % 3 === 0) {
      g.beginPath();
      g.moveTo(0, -S * 0.385);
      g.lineTo(S * 0.012, -S * 0.37);
      g.lineTo(0, -S * 0.355);
      g.lineTo(-S * 0.012, -S * 0.37);
      g.closePath();
      g.fill();
    } else {
      g.beginPath();
      g.moveTo(0, -S * 0.38);
      g.lineTo(0, -S * 0.36);
      g.stroke();
    }
    g.restore();
  }
  // Two squares turned 45° (an eight-point star) inside, like a spell circle.
  g.strokeStyle = 'rgba(255,170,90,0.85)';
  g.lineWidth = 6 * u;
  for (const off of [0, Math.PI / 4]) {
    g.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = off - Math.PI / 2 + (k * Math.PI) / 2;
      const x = Math.cos(a) * S * 0.32;
      const y = Math.sin(a) * S * 0.32;
      k ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
    g.stroke();
  }
  g.restore();
  g.globalCompositeOperation = 'source-over';
  // Big white play sign in the middle, with a soft shadow.
  g.save();
  g.shadowColor = 'rgba(255,80,120,0.9)';
  g.shadowBlur = 50 * u;
  g.fillStyle = '#ffffff';
  const r = S * 0.17;
  g.beginPath();
  g.moveTo(cx - r * 0.6, cy - r);
  g.lineTo(cx + r * 1.05, cy);
  g.lineTo(cx - r * 0.6, cy + r);
  g.closePath();
  g.lineJoin = 'round';
  g.lineWidth = 40 * u;
  g.strokeStyle = '#ffffff';
  g.stroke();
  g.fill();
  g.restore();
  // Recording dot.
  g.fillStyle = '#ff1e4d';
  g.beginPath();
  g.arc(S * 0.83, S * 0.17, S * 0.05, 0, Math.PI * 2);
  g.fill();
  return c.toDataURL('image/png');
}

window.renderAll = () => ({
  powers: Object.fromEntries(EFFECTS.map((d) => [d.id, renderPower(d)])),
  header: renderHeader(),
  icon: renderIcon(),
});
