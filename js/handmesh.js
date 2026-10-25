// Dense hand mesh: from the 21 joints detected by the model, builds a
// surface of more than 150 points (finger edges, phalanges, palm grid) that
// moves with every finger, drawn like a golden hologram.

// Finger chains (joint indices) and their relative widths.
const CHAINS = [
  { ids: [1, 2, 3, 4], w: 0.24 },
  { ids: [5, 6, 7, 8], w: 0.2 },
  { ids: [9, 10, 11, 12], w: 0.21 },
  { ids: [13, 14, 15, 16], w: 0.19 },
  { ids: [17, 18, 19, 20], w: 0.16 },
];
const ROWS_PER_BONE = 4; // samples along each phalanx
const ACROSS = 3; // points across a finger: edge, centre, edge
const PALM_ROWS = 5;
const PALM_COLS = 5;

// Number of points per hand (constant for a given layout).
export const MESH_POINTS = CHAINS.reduce((n, c) => n + ((c.ids.length - 1) * ROWS_PER_BONE + 1) * ACROSS, 0) + PALM_ROWS * PALM_COLS;

const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

// Returns { fingers: [rows[[p,p,p]]], palm: rows[[p…]] } in canvas pixels.
export function buildHandMesh(hand) {
  const lm = hand.lm;
  const size = hand.size;
  const fingers = CHAINS.map(({ ids, w }) => {
    const rows = [];
    for (let b = 0; b < ids.length - 1; b++) {
      const A = lm[ids[b]];
      const B = lm[ids[b + 1]];
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l;
      const ny = dx / l;
      const last = b === ids.length - 2;
      for (let r = 0; r < ROWS_PER_BONE + (last ? 1 : 0); r++) {
        const t = r / ROWS_PER_BONE;
        const c = lerp(A, B, t);
        // Fingers taper towards the tip; the tip itself is rounded.
        const along = (b + t) / (ids.length - 1);
        let half = size * w * 0.5 * (1 - along * 0.3);
        if (last && r === ROWS_PER_BONE) half *= 0.45;
        const row = [];
        for (let k = 0; k < ACROSS; k++) {
          const s = (k / (ACROSS - 1)) * 2 - 1;
          row.push({ x: c.x + nx * half * s, y: c.y + ny * half * s });
        }
        rows.push(row);
      }
    }
    return rows;
  });
  // Palm: grid between the wrist line and the knuckle line.
  const across = { x: lm[17].x - lm[5].x, y: lm[17].y - lm[5].y };
  const wristL = { x: lm[1].x, y: lm[1].y };
  const wristR = { x: lm[0].x + across.x * 0.45, y: lm[0].y + across.y * 0.45 };
  const top = [lm[5], lm[9], lm[13], lm[17]];
  const topAt = (t) => {
    const f = t * (top.length - 1);
    const i = Math.min(top.length - 2, Math.floor(f));
    return lerp(top[i], top[i + 1], f - i);
  };
  const palm = [];
  for (let r = 0; r < PALM_ROWS; r++) {
    const v = r / (PALM_ROWS - 1);
    const row = [];
    for (let c = 0; c < PALM_COLS; c++) {
      const u = c / (PALM_COLS - 1);
      row.push(lerp(lerp(wristL, wristR, u), topAt(u), v));
    }
    palm.push(row);
  }
  return { fingers, palm };
}

export function drawHandMesh(ctx, hand) {
  const a = hand.presence;
  if (a <= 0.01) return;
  const { fingers, palm } = buildHandMesh(hand);
  const s = Math.max(1, hand.size * 0.012);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Mesh lines: rails along the fingers, rungs across, palm grid.
  const path = () => {
    ctx.beginPath();
    for (const rows of [...fingers, palm]) {
      for (const row of rows) {
        ctx.moveTo(row[0].x, row[0].y);
        for (let k = 1; k < row.length; k++) ctx.lineTo(row[k].x, row[k].y);
      }
      for (let k = 0; k < rows[0].length; k++) {
        ctx.moveTo(rows[0][k].x, rows[0][k].y);
        for (let r = 1; r < rows.length; r++) ctx.lineTo(rows[r][k].x, rows[r][k].y);
      }
    }
    // Fingers join the palm at the knuckles.
    fingers.forEach((rows, i) => {
      const base = rows[0][1];
      const j = [0, 1, 2, 3, 4][i];
      const p = i === 0 ? palm[0][0] : palm[PALM_ROWS - 1][Math.min(PALM_COLS - 1, Math.round(((j - 1) / 3) * (PALM_COLS - 1)))];
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(p.x, p.y);
    });
  };
  path();
  // Dark outline under gold lines: readable on bright and dark scenes alike.
  ctx.strokeStyle = `rgba(20,10,0,${0.45 * a})`;
  ctx.lineWidth = s * 2.4;
  ctx.stroke();
  ctx.strokeStyle = `rgba(255,205,120,${0.95 * a})`;
  ctx.lineWidth = s;
  ctx.stroke();
  // Points.
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(255,250,235,${a})`;
  ctx.beginPath();
  const dot = (p, r) => {
    ctx.moveTo(p.x + r, p.y);
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  };
  for (const rows of [...fingers, palm]) for (const row of rows) for (const p of row) dot(p, s * 1.25);
  ctx.fill();
  // Real detected joints stand out, fingertips get a ring.
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.strokeStyle = `rgba(150,80,10,${0.9 * a})`;
  ctx.lineWidth = Math.max(1, s * 0.8);
  ctx.beginPath();
  for (const p of hand.lm) dot(p, s * 2.2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = `rgba(255,220,150,${0.95 * a})`;
  ctx.lineWidth = Math.max(1, s * 1.1);
  ctx.beginPath();
  for (const i of [4, 8, 12, 16, 20]) {
    const p = hand.lm[i];
    ctx.moveTo(p.x + s * 5, p.y);
    ctx.arc(p.x, p.y, s * 5, 0, Math.PI * 2);
  }
  ctx.stroke();
  ctx.restore();
}
