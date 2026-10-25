// Turns raw MediaPipe hand landmarks into stable, smoothed "hands" in canvas
// pixels, with a 3D palm basis, gestures and gesture events.
import { v3, clamp, drawGlow } from './fx/util.js';

// One Euro filter: low jitter when still, low lag when moving fast.
class OneEuro {
  constructor(minCutoff = 1.2, beta = 0.02) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.x = null;
    this.dx = 0;
  }
  filter(x, dt) {
    if (this.x === null) {
      this.x = x;
      return x;
    }
    const alpha = (cutoff) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
    const dx = (x - this.x) / dt;
    this.dx += alpha(1) * (dx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += alpha(cutoff) * (x - this.x);
    return this.x;
  }
}

const FINGERS = {
  thumb: [1, 2, 3, 4],
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
};
export const TIPS = [4, 8, 12, 16, 20];
export const HAND_EDGES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

let nextId = 1;

export class HandTracker {
  constructor() {
    this.tracks = [];
  }

  reset() {
    this.tracks = [];
  }

  // raw: [{ landmarks, world, handedness }] with normalised coordinates.
  update(raw, { width: W, height: H, mirror, dt, now }) {
    dt = clamp(dt, 1 / 240, 0.1);
    const inputs = raw.map((r) => {
      const lm = r.landmarks.map((p) => ({ x: (mirror ? 1 - p.x : p.x) * W, y: p.y * H, z: p.z * W }));
      const world = (r.world || r.landmarks).map((p) => ({ x: mirror ? -p.x : p.x, y: p.y, z: p.z }));
      return { lm, world, label: r.handedness };
    });

    // Match detections to existing tracks by wrist distance (labels can swap).
    const free = new Set(this.tracks);
    for (const input of inputs) {
      let best = null;
      let bestD = Infinity;
      for (const t of free) {
        const d = Math.hypot(t.lm[0].x - input.lm[0].x, t.lm[0].y - input.lm[0].y);
        if (d < bestD) {
          bestD = d;
          best = t;
        }
      }
      if (best && bestD < Math.max(W, H) * 0.35) {
        free.delete(best);
        this.#apply(best, input, dt, now);
      } else {
        const t = this.#create(input);
        this.#apply(t, input, dt, now);
        this.tracks.push(t);
      }
    }
    // Lost tracks fade out instead of popping.
    for (const t of free) {
      t.visible = false;
      t.presence -= dt * 5;
      t.vel.x *= 0.8;
      t.vel.y *= 0.8;
      t.speed = Math.hypot(t.vel.x, t.vel.y);
      t.events = {};
    }
    this.tracks = this.tracks.filter((t) => t.presence > 0);
    return this.tracks;
  }

  #create(input) {
    return {
      id: nextId++,
      label: input.label,
      filters: input.lm.map(() => [new OneEuro(), new OneEuro(), new OneEuro(0.8, 0.01)]),
      wfilters: input.world.map(() => [new OneEuro(1.5), new OneEuro(1.5), new OneEuro(1.5)]),
      lm: input.lm,
      world: input.world,
      presence: 0,
      visible: true,
      vel: { x: 0, y: 0 },
      speed: 0,
      size: 0,
      gesture: 'none',
      gestureFrames: 0,
      pendingGesture: 'none',
      lastFist: -10,
      lastPinch: false,
      events: {},
      basis: null,
    };
  }

  #apply(t, input, dt, now) {
    t.visible = true;
    t.label = input.label;
    t.presence = Math.min(1, t.presence + dt * 6);
    t.lm = input.lm.map((p, i) => ({
      x: t.filters[i][0].filter(p.x, dt),
      y: t.filters[i][1].filter(p.y, dt),
      z: t.filters[i][2].filter(p.z, dt),
    }));
    t.world = input.world.map((p, i) => ({
      x: t.wfilters[i][0].filter(p.x, dt),
      y: t.wfilters[i][1].filter(p.y, dt),
      z: t.wfilters[i][2].filter(p.z, dt),
    }));
    const lm = t.lm;
    const w = t.world;

    const prevPalm = t.palm;
    const ids = [0, 5, 9, 13, 17];
    t.palm = {
      x: ids.reduce((s, i) => s + lm[i].x, 0) / 5,
      y: ids.reduce((s, i) => s + lm[i].y, 0) / 5,
    };
    if (prevPalm) {
      const vx = (t.palm.x - prevPalm.x) / dt;
      const vy = (t.palm.y - prevPalm.y) / dt;
      t.vel.x += (vx - t.vel.x) * 0.5;
      t.vel.y += (vy - t.vel.y) * 0.5;
      t.speed = Math.hypot(t.vel.x, t.vel.y);
    }

    // Pixels per metre from the 3D skeleton, so the size does not collapse
    // when the hand turns sideways.
    const d2 = (a, b) => Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y);
    const d3 = (a, b) => v3.len(v3.sub(w[a], w[b])) || 1e-3;
    const pxPerM = Math.max(d2(0, 9) / d3(0, 9), d2(5, 17) / d3(5, 17), d2(0, 5) / d3(0, 5));
    const size = pxPerM * 0.09;
    t.size = t.size ? t.size + (size - t.size) * 0.3 : size;
    t.pxPerM = pxPerM;

    // Palm basis: v = up (towards the fingers), u = across the palm, n = normal.
    const up = v3.norm(v3.sub(w[9], w[0]));
    let across = v3.sub(w[17], w[5]);
    across = v3.norm(v3.sub(across, v3.scale(up, v3.dot(across, up))));
    const n = v3.norm(v3.cross(across, up));
    t.basis = { u: across, v: up, n };
    t.up = { x: up.x, y: up.y };
    t.angle = Math.atan2(up.y, up.x);

    // Finger states, rotation invariant (3D distances from the wrist).
    const ext = {};
    for (const [name, [mcp, pip, , tip]] of Object.entries(FINGERS)) {
      if (name === 'thumb') ext.thumb = v3.len(v3.sub(w[4], w[17])) > v3.len(v3.sub(w[3], w[17])) * 1.08 && d3(4, 5) > d3(3, 5) * 1.1;
      else ext[name] = d3(tip, 0) > d3(pip, 0) * 1.12 && d3(tip, 0) > d3(mcp, 0) * 1.3;
    }
    t.fingers = ext;
    const count = ['index', 'middle', 'ring', 'pinky'].filter((f) => ext[f]).length;
    const pinchD = d3(4, 8);
    t.pinchAmount = clamp(1 - (pinchD - 0.02) / 0.05);
    const pinch = pinchD < (t.gesture === 'pinch' ? 0.045 : 0.03);
    t.pinchPoint = { x: (lm[4].x + lm[8].x) / 2, y: (lm[4].y + lm[8].y) / 2 };
    t.openness = count / 4;

    let g = 'relaxed';
    if (pinch) g = 'pinch';
    else if (count === 0) g = 'fist';
    else if (count >= 4) g = 'open';
    else if (ext.index && !ext.middle && !ext.ring && !ext.pinky) g = 'point';
    else if (ext.index && ext.middle && !ext.ring && !ext.pinky) g = 'peace';

    // Debounce: a gesture must hold for 2 frames before it counts.
    if (g === t.pendingGesture) t.gestureFrames++;
    else {
      t.pendingGesture = g;
      t.gestureFrames = 1;
    }
    const events = {};
    if (t.gestureFrames >= 2 && g !== t.gesture) {
      const prev = t.gesture;
      t.gesture = g;
      if (prev === 'fist') t.lastFist = now;
      if (g === 'open' && now - t.lastFist < 700) events.release = true;
      if (g === 'fist') events.fist = true;
      if (g === 'pinch') events.pinchStart = true;
      if (prev === 'pinch') events.pinchEnd = true;
      if (g === 'open') events.open = true;
    }
    t.events = events;
    t.open = t.gesture === 'open';
    t.fist = t.gesture === 'fist';
    t.pinch = t.gesture === 'pinch';
    t.point = t.gesture === 'point';
    t.tips = TIPS.map((i) => lm[i]);
  }
}

// Draws the tracking points of a hand: golden bones, a glowing dot on every
// joint and a ring on each fingertip, so finger movements are visible.
export function drawHandSkeleton(ctx, hand) {
  const lm = hand.lm;
  const a = hand.presence;
  ctx.save();
  ctx.lineCap = 'round';
  const s = Math.max(1.2, hand.size * 0.028);
  // Dark under-stroke keeps the bones readable on bright scenes.
  for (const [w, color] of [
    [s * 2.2, `rgba(0,0,0,${0.35 * a})`],
    [s, `rgba(255,205,120,${0.95 * a})`],
  ]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    for (const [i, j] of HAND_EDGES) {
      ctx.moveTo(lm[i].x, lm[i].y);
      ctx.lineTo(lm[j].x, lm[j].y);
    }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const p of lm) drawGlow(ctx, [255, 170, 60], p.x, p.y, s * 4, 0.35 * a);
  ctx.globalCompositeOperation = 'source-over';
  lm.forEach((p, i) => {
    const tip = TIPS.includes(i);
    const r = s * (tip ? 1.9 : 1.3);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.strokeStyle = `rgba(150,80,10,${0.9 * a})`;
    ctx.lineWidth = Math.max(1, s * 0.45);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (tip) {
      ctx.strokeStyle = `rgba(255,220,150,${0.95 * a})`;
      ctx.lineWidth = Math.max(1, s * 0.55);
      ctx.beginPath();
      ctx.arc(p.x, p.y, s * 3.4, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  ctx.restore();
}
