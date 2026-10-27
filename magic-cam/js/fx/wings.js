// Angel wings: large feathered wings attached to your shoulders (body points),
// drawn behind your body. Raise your arms to spread and flap them.
import { Particles, drawGlow, rand, TAU, clamp } from './util.js';

const COLORS = [
  { name: 'Ange', rgb: [255, 255, 255], glow: [255, 220, 150] },
  { name: 'Démon', rgb: [40, 20, 30], glow: [255, 50, 50] },
  { name: 'Phénix', rgb: [255, 140, 40], glow: [255, 200, 60] },
  { name: 'Cristal', rgb: [170, 220, 255], glow: [120, 200, 255] },
];

function feather(ctx, x, y, ang, len, w, fill, edge) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -w, len, 0);
  ctx.quadraticCurveTo(len * 0.5, w * 0.7, 0, 0);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = Math.max(1, w * 0.12);
  ctx.stroke();
  ctx.restore();
}

export function wingsEffect() {
  const feathers = new Particles(80);
  let scheme = COLORS[0];
  let spread = 0.5;
  let flap = 0;

  // One wing: three rows of feathers fanning out from the shoulder.
  const wing = (ctx, sx, sy, side, size, open, t) => {
    const [r, g, b] = scheme.rgb;
    const rows = [
      { n: 9, len: 1.0, w: 0.09, shade: 0.85 },
      { n: 8, len: 0.7, w: 0.08, shade: 0.95 },
      { n: 7, len: 0.42, w: 0.07, shade: 1 },
    ];
    // Wing arm: rises from the shoulder up and outwards (wider when open).
    const armLen = size * 0.55;
    const armA = -Math.PI / 2 + side * (0.4 + open * 0.45);
    const ex = sx + Math.cos(armA) * armLen;
    const ey = sy + Math.sin(armA) * armLen;
    for (const row of rows) {
      for (let i = 0; i < row.n; i++) {
        const k = i / (row.n - 1);
        const px = sx + (ex - sx) * k;
        const py = sy + (ey - sy) * k;
        // Feathers fan out: downwards near the shoulder, outwards at the tip.
        const ang = armA + side * (1.7 - k * 1.1) + Math.sin(t * 6 + i) * 0.02;
        const len = size * row.len * (0.55 + k * 0.55);
        const sh = row.shade;
        feather(
          ctx,
          px,
          py,
          ang,
          len,
          size * row.w,
          `rgba(${(r * sh) | 0},${(g * sh) | 0},${(b * sh) | 0},0.96)`,
          `rgba(${scheme.glow.join(',')},0.55)`,
        );
      }
    }
  };

  return {
    id: 'wings',
    name: 'Ailes d’ange',
    colors: COLORS,
    needs: { seg: true, pose: true },
    setColor(i) {
      scheme = COLORS[i];
    },
    start() {
      feathers.clear();
    },
    update(dt, hands, e) {
      feathers.update(dt, (p, d) => {
        p.rot += d * p.spin;
        p.vx += Math.sin(e.t * 2 + p.seed) * 30 * d;
      });
      const b = e.body.points;
      if (!b || e.body.presence < 0.3 || b[11].v < 0.4 || b[12].v < 0.4) return;
      // Arms raised -> wings spread; moving arms -> flap.
      const shoulderY = (b[11].y + b[12].y) / 2;
      const wristY = Math.min(b[15].v > 0.4 ? b[15].y : shoulderY, b[16].v > 0.4 ? b[16].y : shoulderY);
      const raised = clamp((shoulderY - wristY) / (Math.abs(b[11].x - b[12].x) || 1) + 0.3);
      spread += (raised - spread) * Math.min(1, dt * 4);
      flap += dt * (2 + raised * 4);
      if (Math.random() < dt * 2)
        feathers.add({
          x: (b[11].x + b[12].x) / 2 + rand(-200, 200) * e.unit,
          y: shoulderY,
          vx: rand(-40, 40),
          vy: rand(40, 90) * e.unit,
          life: rand(3, 5),
          size: rand(10, 18) * e.unit,
          rot: rand(TAU),
          spin: rand(-2, 2),
          seed: rand(TAU),
        });
    },
    drawBehind(ctx, e) {
      const b = e.body.points;
      if (!b || e.body.presence < 0.3 || b[11].v < 0.4 || b[12].v < 0.4) return;
      const sw = Math.hypot(b[11].x - b[12].x, b[11].y - b[12].y);
      const size = sw * 2.4;
      const open = spread * 0.8 + Math.sin(flap) * 0.12;
      const left = b[11].x < b[12].x ? b[11] : b[12];
      const right = left === b[11] ? b[12] : b[11];
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, scheme.glow, (left.x + right.x) / 2, left.y - sw * 0.4, size * 1.3, 0.25 * e.body.presence, 0.05);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = e.body.presence;
      wing(ctx, left.x + sw * 0.1, left.y + sw * 0.05, -1, size, open, e.t);
      wing(ctx, right.x - sw * 0.1, right.y + sw * 0.05, 1, size, open, e.t);
      ctx.globalAlpha = 1;
    },
    draw(ctx) {
      for (const p of feathers.list) {
        const t = p.age / p.life;
        ctx.globalAlpha = 1 - t;
        feather(ctx, p.x, p.y, p.rot, p.size, p.size * 0.3, `rgb(${scheme.rgb.join(',')})`, `rgba(${scheme.glow.join(',')},0.6)`);
      }
      ctx.globalAlpha = 1;
    },
  };
}
