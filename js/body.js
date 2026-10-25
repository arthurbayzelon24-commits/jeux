// Body tracking (MediaPipe pose, 33 points): smoothed in canvas pixels,
// predicted between camera frames like the hands, and drawn as a dense
// glowing body mesh (limbs, torso grid, head ring) so the whole body visibly
// follows the camera.
import { drawGlow, clamp } from './fx/util.js';

const MIN_VISIBILITY = 0.5;
// Limbs: chains of pose points with their relative widths.
const LIMBS = [
  { ids: [11, 13, 15], w: 0.22 },
  { ids: [12, 14, 16], w: 0.22 },
  { ids: [23, 25, 27, 31], w: 0.3 },
  { ids: [24, 26, 28, 32], w: 0.3 },
];
const SAMPLES = 5; // points along each bone
const TORSO = 5; // torso grid size (TORSO x TORSO)

export class BodyTracker {
  constructor() {
    this.points = null;
    this.presence = 0;
    this.vel = null;
    this.ahead = 0;
  }

  reset() {
    this.points = null;
    this.presence = 0;
    this.vel = null;
  }

  // landmarks: normalised pose points, or null when no body was found.
  update(landmarks, { width: W, height: H, mirror, dt }) {
    if (!landmarks) {
      this.presence = Math.max(0, this.presence - dt * 3);
      if (!this.presence) this.points = null;
      return;
    }
    this.presence = Math.min(1, this.presence + dt * 5);
    const next = landmarks.map((p) => ({ x: (mirror ? 1 - p.x : p.x) * W, y: p.y * H, v: p.visibility ?? 1 }));
    const now = performance.now();
    const gap = this.lastAt ? Math.max(1 / 240, (now - this.lastAt) / 1000) : dt;
    this.lastAt = now;
    if (!this.points || !this.raw) {
      this.points = next;
      this.vel = next.map(() => ({ x: 0, y: 0 }));
    } else {
      // Velocity from detected positions; snappy smoothing that follows fast moves.
      this.vel = next.map((p, i) => {
        const v = this.vel[i];
        return { x: v.x + ((p.x - this.raw[i].x) / gap - v.x) * 0.5, y: v.y + ((p.y - this.raw[i].y) / gap - v.y) * 0.5 };
      });
      this.points = next.map((p, i) => {
        const o = this.points[i];
        const k = clamp(0.45 + Math.hypot(p.x - o.x, p.y - o.y) / (W * 0.04), 0.45, 0.95);
        return { x: o.x + (p.x - o.x) * k, y: o.y + (p.y - o.y) * k, v: o.v + (p.v - o.v) * 0.5 };
      });
    }
    this.raw = next;
    this.ahead = 0;
  }

  // Between body detections: glide each point along its own motion.
  advance(dt) {
    if (!this.points || !this.vel) return;
    this.ahead += dt;
    const k = this.ahead < 0.07 ? 1 : this.ahead < 0.12 ? 0.5 : 0;
    if (!k) return;
    this.points.forEach((p, i) => {
      p.x += this.vel[i].x * dt * k;
      p.y += this.vel[i].y * dt * k;
    });
  }

  // Dense mesh: rows of points across every limb, a torso grid and a head ring.
  mesh() {
    const P = this.points;
    if (!P) return null;
    const ok = (i) => P[i].v >= MIN_VISIBILITY;
    const sw = ok(11) && ok(12) ? Math.hypot(P[11].x - P[12].x, P[11].y - P[12].y) : 0;
    if (!sw) return null;
    const limbs = [];
    for (const { ids, w } of LIMBS) {
      const rows = [];
      for (let b = 0; b < ids.length - 1; b++) {
        const A = P[ids[b]];
        const B = P[ids[b + 1]];
        if (!ok(ids[b]) || !ok(ids[b + 1])) break;
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const l = Math.hypot(dx, dy) || 1;
        const nx = -dy / l;
        const ny = dx / l;
        for (let r = 0; r < SAMPLES; r++) {
          const t = r / SAMPLES;
          const half = sw * w * 0.5 * (1 - ((b + t) / (ids.length - 1)) * 0.4);
          const cx = A.x + dx * t;
          const cy = A.y + dy * t;
          rows.push([-1, 0, 1].map((s) => ({ x: cx + nx * half * s, y: cy + ny * half * s })));
        }
      }
      if (rows.length) limbs.push(rows);
    }
    let torso = null;
    if (ok(23) && ok(24)) {
      torso = [];
      for (let r = 0; r < TORSO; r++) {
        const v = r / (TORSO - 1);
        const L = { x: P[11].x + (P[23].x - P[11].x) * v, y: P[11].y + (P[23].y - P[11].y) * v };
        const R = { x: P[12].x + (P[24].x - P[12].x) * v, y: P[12].y + (P[24].y - P[12].y) * v };
        const row = [];
        for (let c = 0; c < TORSO; c++) {
          const u = c / (TORSO - 1);
          row.push({ x: L.x + (R.x - L.x) * u, y: L.y + (R.y - L.y) * u });
        }
        torso.push(row);
      }
    }
    let head = null;
    if (ok(0)) {
      const r = ok(7) && ok(8) ? Math.hypot(P[7].x - P[8].x, P[7].y - P[8].y) * 0.62 : sw * 0.32;
      head = Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return { x: P[0].x + Math.cos(a) * r, y: P[0].y - r * 0.2 + Math.sin(a) * r * 1.2 };
      });
    }
    return { limbs, torso, head, sw };
  }

  draw(ctx, unit) {
    if (this.presence <= 0.01) return;
    const m = this.mesh();
    if (!m) return;
    const a = this.presence;
    const P = this.points;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (const rows of m.limbs) {
      for (const row of rows) {
        ctx.moveTo(row[0].x, row[0].y);
        ctx.lineTo(row[1].x, row[1].y);
        ctx.lineTo(row[2].x, row[2].y);
      }
      for (let k = 0; k < 3; k++) {
        ctx.moveTo(rows[0][k].x, rows[0][k].y);
        for (const row of rows) ctx.lineTo(row[k].x, row[k].y);
      }
    }
    if (m.torso) {
      for (const row of m.torso) {
        ctx.moveTo(row[0].x, row[0].y);
        for (const p of row) ctx.lineTo(p.x, p.y);
      }
      for (let c = 0; c < TORSO; c++) {
        ctx.moveTo(m.torso[0][c].x, m.torso[0][c].y);
        for (const row of m.torso) ctx.lineTo(row[c].x, row[c].y);
      }
    }
    if (m.head) {
      ctx.moveTo(m.head[0].x, m.head[0].y);
      for (const p of m.head) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.moveTo(P[0].x, P[0].y);
      ctx.lineTo((P[11].x + P[12].x) / 2, (P[11].y + P[12].y) / 2);
    }
    ctx.strokeStyle = `rgba(0,20,30,${0.4 * a})`;
    ctx.lineWidth = 3.2 * unit;
    ctx.stroke();
    ctx.strokeStyle = `rgba(90,220,255,${0.85 * a})`;
    ctx.lineWidth = 1.4 * unit;
    ctx.stroke();
    // Mesh points, then the real detected joints.
    ctx.fillStyle = `rgba(230,250,255,${a})`;
    ctx.beginPath();
    const dot = (p, r) => {
      ctx.moveTo(p.x + r, p.y);
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    };
    for (const rows of m.limbs) for (const row of rows) for (const p of row) dot(p, 1.8 * unit);
    if (m.torso) for (const row of m.torso) for (const p of row) dot(p, 1.8 * unit);
    if (m.head) for (const p of m.head) dot(p, 1.6 * unit);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    for (const i of [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28])
      if (P[i].v >= MIN_VISIBILITY) drawGlow(ctx, [90, 220, 255], P[i].x, P[i].y, 14 * unit, 0.5 * a);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.strokeStyle = `rgba(0,110,150,${0.9 * a})`;
    ctx.lineWidth = 1.5 * unit;
    ctx.beginPath();
    for (const i of [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) if (P[i].v >= MIN_VISIBILITY) dot(P[i], 4.5 * unit);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
