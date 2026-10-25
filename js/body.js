// Body tracking points (MediaPipe pose, 33 points): smoothed in canvas pixels
// and drawn as a glowing skeleton so the user sees what the camera follows.
import { drawGlow, clamp } from './fx/util.js';

// Pose connections without the hand points (hands have their own 21-point tracking).
const EDGES = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [27, 29],
  [29, 31],
  [27, 31],
  [24, 26],
  [26, 28],
  [28, 30],
  [30, 32],
  [28, 32],
  [0, 2],
  [2, 7],
  [0, 5],
  [5, 8],
  [9, 10],
];
const POINTS = [0, 2, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
const MIN_VISIBILITY = 0.5;

export class BodyTracker {
  constructor() {
    this.points = null;
    this.presence = 0;
  }

  reset() {
    this.points = null;
    this.presence = 0;
  }

  // landmarks: normalised pose points, or null when no body was found.
  update(landmarks, { width: W, height: H, mirror, dt }) {
    if (!landmarks) {
      this.presence = Math.max(0, this.presence - dt * 4);
      if (!this.presence) this.points = null;
      return;
    }
    this.presence = Math.min(1, this.presence + dt * 5);
    const next = landmarks.map((p) => ({ x: (mirror ? 1 - p.x : p.x) * W, y: p.y * H, v: p.visibility ?? 1 }));
    if (!this.points) this.points = next;
    else
      this.points = next.map((p, i) => {
        const o = this.points[i];
        // Follow fast moves, stay steady when still.
        const k = clamp(0.35 + Math.hypot(p.x - o.x, p.y - o.y) / (W * 0.05), 0.35, 0.9);
        return { x: o.x + (p.x - o.x) * k, y: o.y + (p.y - o.y) * k, v: o.v + (p.v - o.v) * 0.5 };
      });
  }

  draw(ctx, unit) {
    const pts = this.points;
    if (!pts || this.presence <= 0.01) return;
    const a = this.presence;
    ctx.save();
    ctx.lineCap = 'round';
    for (const [w, color] of [
      [5 * unit, `rgba(0,0,0,${0.35 * a})`],
      [2.4 * unit, `rgba(90,220,255,${0.9 * a})`],
    ]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      for (const [i, j] of EDGES) {
        if (pts[i].v < MIN_VISIBILITY || pts[j].v < MIN_VISIBILITY) continue;
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[j].x, pts[j].y);
      }
      ctx.stroke();
    }
    for (const i of POINTS) {
      const p = pts[i];
      if (p.v < MIN_VISIBILITY) continue;
      const r = (i >= 11 ? 5 : 3.2) * unit;
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, [90, 220, 255], p.x, p.y, r * 3, 0.4 * a);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.strokeStyle = `rgba(0,110,150,${0.9 * a})`;
      ctx.lineWidth = 1.5 * unit;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}
