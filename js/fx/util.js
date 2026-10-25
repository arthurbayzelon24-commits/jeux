// Shared drawing helpers for every effect: math, glow sprites, particles,
// lightning bolts and a tiny flat-shaded 3D mesh renderer.

export const TAU = Math.PI * 2;
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const pick = (list) => list[(Math.random() * list.length) | 0];

// Global quality multiplier for particle counts (set from the settings).
export const quality = { particles: 1 };

// Smooth pseudo-random noise in [-1, 1] (value noise with cosine interpolation).
const NOISE = Array.from({ length: 512 }, () => Math.random() * 2 - 1);
export function noise1(t) {
  const i = Math.floor(t);
  const f = t - i;
  const a = NOISE[i & 511];
  const b = NOISE[(i + 1) & 511];
  const u = (1 - Math.cos(f * Math.PI)) / 2;
  return a + (b - a) * u;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ---------- Glow sprites ----------
const spriteCache = new Map();

// A soft radial glow: white-hot centre fading into the colour, then to transparent.
export function glowSprite(rgb, core = 0.25) {
  const key = rgb.join(',') + '|' + core;
  let c = spriteCache.get(key);
  if (c) return c;
  c = makeCanvas(64, 64);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  const [r, gg, b] = rgb;
  const mix = (t) => `rgba(${Math.round(lerp(255, r, t))},${Math.round(lerp(255, gg, t))},${Math.round(lerp(255, b, t))}`;
  grad.addColorStop(0, mix(0) + ',1)');
  grad.addColorStop(core, mix(0.55) + ',0.85)');
  grad.addColorStop(0.5, `rgba(${r},${gg},${b},0.35)`);
  grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  spriteCache.set(key, c);
  return c;
}

export function drawGlow(ctx, rgb, x, y, radius, alpha = 1, core) {
  if (radius <= 0 || alpha <= 0) return;
  ctx.globalAlpha = clamp(alpha);
  ctx.drawImage(glowSprite(rgb, core), x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = 1;
}

// Fire colour ramp: white -> yellow -> orange -> red -> dark.
const FIRE_STOPS = [
  [0, [255, 255, 235]],
  [0.15, [255, 236, 140]],
  [0.35, [255, 170, 40]],
  [0.6, [240, 80, 10]],
  [0.85, [150, 25, 5]],
  [1, [60, 10, 5]],
];
export function rampColor(stops, t) {
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const k = (t - t0) / (t1 - t0);
      return [0, 1, 2].map((j) => Math.round(lerp(c0[j], c1[j], k)));
    }
  }
  return stops[stops.length - 1][1];
}
export const FIRE_SPRITES = [];
export function fireSprite(t) {
  if (!FIRE_SPRITES.length) for (let i = 0; i < 24; i++) FIRE_SPRITES.push(glowSprite(rampColor(FIRE_STOPS, i / 23), 0.15));
  return FIRE_SPRITES[Math.min(23, Math.max(0, Math.round(t * 23)))];
}

// ---------- Particles ----------
// Particles are plain objects; each system updates them with simple physics
// and draws them with additive blending.
export class Particles {
  constructor(max = 600) {
    this.max = max;
    this.list = [];
  }
  add(p) {
    if (this.list.length >= this.max * quality.particles) return null;
    p.age = 0;
    p.vx ??= 0;
    p.vy ??= 0;
    p.drag ??= 0;
    p.g ??= 0;
    p.size ??= 10;
    p.alpha ??= 1;
    this.list.push(p);
    return p;
  }
  update(dt, extra) {
    const list = this.list;
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      const d = p.drag ? Math.exp(-p.drag * dt) : 1;
      p.vx *= d;
      p.vy = p.vy * d + p.g * dt;
      if (extra) extra(p, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.spin) p.rot = (p.rot || 0) + p.spin * dt;
      list[w++] = p;
    }
    list.length = w;
  }
  // Default draw: coloured glow sprites that shrink and fade over their life.
  draw(ctx, custom) {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.list) {
      const t = p.age / p.life;
      if (custom) {
        custom(ctx, p, t);
        continue;
      }
      const s = p.size * (p.grow ? lerp(1, p.grow, t) : 1 - t * 0.6);
      const a = p.alpha * (p.fadeIn ? Math.min(1, t / p.fadeIn) : 1) * (1 - t) ** (p.fadePow || 1);
      if (p.fire) {
        ctx.globalAlpha = clamp(a);
        ctx.drawImage(fireSprite(t), p.x - s, p.y - s, s * 2, s * 2);
      } else drawGlow(ctx, p.rgb, p.x, p.y, s, a, p.core);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  clear() {
    this.list.length = 0;
  }
}

// ---------- Lightning ----------
// Midpoint displacement bolt with optional branches. Returns polylines.
export function makeBolt(x1, y1, x2, y2, opts = {}) {
  const { jag = 0.22, depth = 6, branch = 0.18, out = [] } = opts;
  const len = Math.hypot(x2 - x1, y2 - y1);
  let pts = [x1, y1, x2, y2];
  let off = len * jag;
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (let i = 0; i < pts.length - 2; i += 2) {
      const ax = pts[i];
      const ay = pts[i + 1];
      const bx = pts[i + 2];
      const by = pts[i + 3];
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      const nx = -(by - ay);
      const ny = bx - ax;
      const nl = Math.hypot(nx, ny) || 1;
      const o = (Math.random() * 2 - 1) * off;
      const px = mx + (nx / nl) * o;
      const py = my + (ny / nl) * o;
      next.push(ax, ay, px, py);
      if (opts.branches !== false && d < depth - 2 && Math.random() < branch && len > 40) {
        const ang = Math.atan2(by - ay, bx - ax) + rand(-0.9, 0.9);
        const bl = Math.hypot(bx - ax, by - ay) * rand(0.8, 1.6);
        makeBolt(px, py, px + Math.cos(ang) * bl, py + Math.sin(ang) * bl, {
          jag,
          depth: Math.max(2, depth - d - 2),
          branch: branch * 0.5,
          out,
          branches: true,
          thin: true,
        });
      }
    }
    next.push(pts[pts.length - 2], pts[pts.length - 1]);
    pts = next;
    off *= 0.5;
  }
  out.push({ pts, thin: !!opts.thin });
  return out;
}

export function strokeBolts(ctx, bolts, rgb, width = 2, alpha = 1) {
  const [r, g, b] = rgb;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const passes = [
    [width * 7, `rgba(${r},${g},${b},${0.08 * alpha})`],
    [width * 3, `rgba(${r},${g},${b},${0.35 * alpha})`],
    [width * 1.4, `rgba(${(r + 255) >> 1},${(g + 255) >> 1},${(b + 255) >> 1},${0.8 * alpha})`],
    [width * 0.6, `rgba(255,255,255,${alpha})`],
  ];
  for (const [w, color] of passes) {
    ctx.strokeStyle = color;
    for (const bolt of bolts) {
      const p = bolt.pts;
      ctx.lineWidth = bolt.thin ? w * 0.5 : w;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

// ---------- 3D ----------
export const v3 = {
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
  scale: (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s }),
  dot: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
  cross: (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }),
  len: (a) => Math.hypot(a.x, a.y, a.z),
  norm: (a) => {
    const l = Math.hypot(a.x, a.y, a.z) || 1;
    return { x: a.x / l, y: a.y / l, z: a.z / l };
  },
};

// Rotation matrix from Euler angles (row-major 3x3).
export function rotMatrix(ax, ay, az) {
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(ax), Math.sin(ax), Math.cos(ay), Math.sin(ay), Math.cos(az), Math.sin(az)];
  return [
    cy * cz,
    sx * sy * cz - cx * sz,
    cx * sy * cz + sx * sz,
    cy * sz,
    sx * sy * sz + cx * cz,
    cx * sy * sz - sx * cz,
    -sy,
    sx * cy,
    cx * cy,
  ];
}
const mul = (m, p) => ({
  x: m[0] * p.x + m[1] * p.y + m[2] * p.z,
  y: m[3] * p.x + m[4] * p.y + m[5] * p.z,
  z: m[6] * p.x + m[7] * p.y + m[8] * p.z,
});

function buildMesh(verts, faces) {
  return { verts: verts.map(([x, y, z]) => v3.norm({ x, y, z })), faces };
}
const PHI = (1 + Math.sqrt(5)) / 2;
export const MESHES = {
  cube: buildMesh(
    [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z]))),
    [
      [0, 1, 3, 2],
      [4, 6, 7, 5],
      [0, 4, 5, 1],
      [2, 3, 7, 6],
      [0, 2, 6, 4],
      [1, 5, 7, 3],
    ],
  ),
  octa: buildMesh(
    [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1.5, 0],
      [0, -1.5, 0],
      [0, 0, 1],
      [0, 0, -1],
    ],
    [
      [0, 2, 4],
      [4, 2, 1],
      [1, 2, 5],
      [5, 2, 0],
      [4, 3, 0],
      [1, 3, 4],
      [5, 3, 1],
      [0, 3, 5],
    ],
  ),
  ico: buildMesh(
    [
      [-1, PHI, 0],
      [1, PHI, 0],
      [-1, -PHI, 0],
      [1, -PHI, 0],
      [0, -1, PHI],
      [0, 1, PHI],
      [0, -1, -PHI],
      [0, 1, -PHI],
      [PHI, 0, -1],
      [PHI, 0, 1],
      [-PHI, 0, -1],
      [-PHI, 0, 1],
    ],
    [
      [0, 11, 5],
      [0, 5, 1],
      [0, 1, 7],
      [0, 7, 10],
      [0, 10, 11],
      [1, 5, 9],
      [5, 11, 4],
      [11, 10, 2],
      [10, 7, 6],
      [7, 1, 8],
      [3, 9, 4],
      [3, 4, 2],
      [3, 2, 6],
      [3, 6, 8],
      [3, 8, 9],
      [4, 9, 5],
      [2, 4, 11],
      [6, 2, 10],
      [8, 6, 7],
      [9, 8, 1],
    ],
  ),
  tetra: buildMesh(
    [
      [1, 1, 1],
      [-1, -1, 1],
      [-1, 1, -1],
      [1, -1, -1],
    ],
    [
      [0, 1, 2],
      [0, 3, 1],
      [0, 2, 3],
      [1, 3, 2],
    ],
  ),
};
// A lumpy rock: an icosahedron with jittered vertices.
export function rockMesh() {
  const base = MESHES.ico;
  return { verts: base.verts.map((v) => v3.scale(v, rand(0.75, 1.15))), faces: base.faces };
}

// Direction towards the light: up, left and in front of the scene.
const LIGHT = v3.norm({ x: -0.4, y: -0.7, z: -0.6 });
// Flat-shaded mesh with additive edge glow. `rgb` is the surface colour,
// `edge` the glowing edge colour (or null). Faces facing away are culled.
export function drawMesh(ctx, mesh, o) {
  const { x, y, size, rot, rgb, edge = null, alpha = 1, focal = 1500, z = 0, emissive = 0.15 } = o;
  const persp = focal / (focal + z);
  const pts = mesh.verts.map((v) => {
    const p = mul(rot, v);
    return { x: x + p.x * size * persp, y: y + p.y * size * persp, z: p.z };
  });
  const faces = [];
  for (const f of mesh.faces) {
    const a = mul(rot, mesh.verts[f[0]]);
    const b = mul(rot, mesh.verts[f[1]]);
    const c = mul(rot, mesh.verts[f[2]]);
    let n = v3.norm(v3.cross(v3.sub(b, a), v3.sub(c, a)));
    // Meshes are convex and centred: orient every normal outwards.
    if (v3.dot(n, v3.add(v3.add(a, b), c)) < 0) n = v3.scale(n, -1);
    // The camera looks along +z, so faces pointing to +z are hidden.
    if (n.z > 0.02) continue;
    const depth = f.reduce((s, i) => s + pts[i].z, 0) / f.length;
    faces.push({ f, n, depth });
  }
  faces.sort((p, q) => q.depth - p.depth);
  ctx.globalAlpha = alpha;
  ctx.lineJoin = 'round';
  for (const { f, n } of faces) {
    const lit = clamp(emissive + Math.max(0, v3.dot(n, LIGHT)) * 0.95, 0, 1.3);
    const spec = Math.max(0, v3.dot(n, LIGHT)) ** 12 * 120;
    ctx.fillStyle = `rgb(${Math.min(255, rgb[0] * lit + spec)},${Math.min(255, rgb[1] * lit + spec)},${Math.min(255, rgb[2] * lit + spec)})`;
    ctx.beginPath();
    ctx.moveTo(pts[f[0]].x, pts[f[0]].y);
    for (let i = 1; i < f.length; i++) ctx.lineTo(pts[f[i]].x, pts[f[i]].y);
    ctx.closePath();
    ctx.fill();
  }
  if (edge) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(${edge[0]},${edge[1]},${edge[2]},${0.7 * alpha})`;
    ctx.lineWidth = Math.max(1, size * 0.05);
    for (const { f } of faces) {
      ctx.beginPath();
      ctx.moveTo(pts[f[0]].x, pts[f[0]].y);
      for (let i = 1; i < f.length; i++) ctx.lineTo(pts[f[i]].x, pts[f[i]].y);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
}

// Project a point given in a hand's local 3D basis (units: hand sizes) to the screen.
export function palmPoint(hand, a, b, c = 0, origin = hand.palm) {
  const { u, v, n } = hand.basis;
  const s = hand.size;
  return {
    x: origin.x + (u.x * a + v.x * b + n.x * c) * s,
    y: origin.y + (u.y * a + v.y * b + n.y * c) * s,
    z: (u.z * a + v.z * b + n.z * c) * s,
  };
}

// Strokes a ring lying in the palm plane (centre offset by `lift` along the palm normal).
export function palmRing(ctx, hand, radius, segments = 64, lift = 0, origin) {
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * TAU;
    const p = palmPoint(hand, Math.cos(a) * radius, Math.sin(a) * radius, lift, origin);
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  }
}
