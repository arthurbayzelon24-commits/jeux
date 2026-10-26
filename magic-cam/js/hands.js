// Turns raw MediaPipe hand landmarks into stable, smoothed "hands" in canvas
// pixels, with a 3D palm basis, gestures and gesture events.
import { v3, clamp } from './fx/util.js';

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
    this.lastNow = 0;
  }

  // Predicts hand positions between detections from the palm velocity
  // (at most a few frames ahead, so a wrong guess never shows).
  // Every joint moves along its own velocity (fingers move on their own),
  // fading out after a few frames so a wrong guess never shows.
  advance(dt) {
    for (const t of this.tracks) {
      if (!t.palm || !t.lmVel) continue;
      t.ahead = (t.ahead || 0) + dt;
      // Visible: a couple of frames ahead. Lost: coast a bit longer, slowing.
      const k = t.visible ? (t.ahead < 0.05 ? 1 : t.ahead < 0.09 ? 0.5 : 0) : t.ahead < 0.2 ? Math.exp(-t.ahead * 8) : 0;
      if (!k) continue;
      t.lm.forEach((p, i) => {
        p.x += t.lmVel[i].x * dt * k;
        p.y += t.lmVel[i].y * dt * k;
      });
      t.palm.x += t.vel.x * dt * k;
      t.palm.y += t.vel.y * dt * k;
      if (!t.visible) t.speed = Math.hypot(t.vel.x, t.vel.y) * k;
      t.pinchPoint.x = (t.lm[4].x + t.lm[8].x) / 2;
      t.pinchPoint.y = (t.lm[4].y + t.lm[8].y) / 2;
    }
  }

  // raw: [{ landmarks, world, handedness }] with normalised coordinates.
  update(raw, { width: W, height: H, mirror, dt, now }) {
    // Time between detections (not between rendered frames): filters and
    // velocities must follow the camera's rhythm.
    if (this.lastNow) dt = (now - this.lastNow) / 1000;
    this.lastNow = now;
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
      // Generous radius: a hand moving fast can travel far between frames.
      if (best && bestD < Math.max(W, H) * 0.5) {
        free.delete(best);
        this.#apply(best, input, dt, now);
      } else {
        const t = this.#create(input);
        this.#apply(t, input, dt, now);
        this.tracks.push(t);
      }
    }
    // Lost tracks (often a fast, blurred hand) keep gliding along their
    // motion for a moment and fade slowly, so effects never drop out.
    for (const t of free) {
      t.visible = false;
      t.lost = (t.lost || 0) + dt;
      t.presence -= dt * 2.5;
      t.events = {};
    }
    this.tracks = this.tracks.filter((t) => t.presence > 0);
    return this.tracks;
  }

  #create(input) {
    return {
      id: nextId++,
      label: input.label,
      // Responsive filters: little lag on fast moves, steady when still.
      filters: input.lm.map(() => [new OneEuro(1.8, 0.05), new OneEuro(1.8, 0.05), new OneEuro(0.8, 0.01)]),
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
    t.ahead = 0;
    // Back after a loss: jump straight to the new position (no smoothing lag).
    if (t.lost > 0.06) {
      for (const f of t.filters) for (const k of f) k.x = null;
      t.rawLm = null;
      t.rawPalm = null;
    }
    t.lost = 0;
    t.label = input.label;
    t.presence = Math.min(1, t.presence + dt * 6);
    t.lm = input.lm.map((p, i) => ({
      x: t.filters[i][0].filter(p.x, dt),
      y: t.filters[i][1].filter(p.y, dt),
      z: t.filters[i][2].filter(p.z, dt),
    }));
    // Per-joint velocity from detected (not predicted) positions.
    const prevRaw = t.rawLm;
    t.rawLm = t.lm.map((p) => ({ x: p.x, y: p.y }));
    if (prevRaw) {
      t.lmVel = t.rawLm.map((p, i) => {
        const v = t.lmVel?.[i] || { x: 0, y: 0 };
        return { x: v.x + ((p.x - prevRaw[i].x) / dt - v.x) * 0.6, y: v.y + ((p.y - prevRaw[i].y) / dt - v.y) * 0.6 };
      });
    }
    t.world = input.world.map((p, i) => ({
      x: t.wfilters[i][0].filter(p.x, dt),
      y: t.wfilters[i][1].filter(p.y, dt),
      z: t.wfilters[i][2].filter(p.z, dt),
    }));
    const lm = t.lm;
    const w = t.world;

    // Velocity from detected positions only (the predicted ones would skew it).
    const prevPalm = t.rawPalm;
    const ids = [0, 5, 9, 13, 17];
    t.palm = {
      x: ids.reduce((s, i) => s + lm[i].x, 0) / 5,
      y: ids.reduce((s, i) => s + lm[i].y, 0) / 5,
    };
    t.rawPalm = { ...t.palm };
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

    // In a closed fist the thumb rests on the curled index, close enough to
    // look like a pinch: a fist (index tip folded back near its knuckle) wins.
    const folded = count === 0 && d3(8, 0) < d3(5, 0) * 1.25;
    let g = 'relaxed';
    if (folded) g = 'fist';
    else if (pinch) g = 'pinch';
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
    // Thanos snap: thumb and middle fingertip pressed together, then the middle
    // finger snaps down onto the palm while the thumb springs away.
    const snapD = d3(4, 12);
    if (snapD < 0.032 && !ext.ring) t.snapReady = now;
    else if (t.snapReady && now - t.snapReady < 400 && snapD > 0.055 && d3(12, 0) < d3(9, 0) * 1.75) {
      events.snap = true;
      t.snapReady = 0;
    } else if (t.snapReady && now - t.snapReady >= 400) t.snapReady = 0;
    t.events = events;
    t.open = t.gesture === 'open';
    t.fist = t.gesture === 'fist';
    t.pinch = t.gesture === 'pinch';
    t.point = t.gesture === 'point';
    t.tips = TIPS.map((i) => lm[i]);
  }
}

// Draws the tracking points of a hand as a dense mesh (see handmesh.js).
export { drawHandMesh as drawHandSkeleton } from './handmesh.js';
