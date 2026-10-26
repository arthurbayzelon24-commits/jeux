// Magic runes: draw a shape in the air with a pinch (or the index finger
// held up) and release to cast the spell of that shape.
//   circle -> Shield wave      triangle -> Explosion     square -> Ice prison
//   zigzag -> Lightning strike  line     -> Blade slash   V      -> Meteor
// Each spell also reaches the arena's targets (event 'spell').
import { Particles, drawGlow, rand, TAU, clamp, makeBolt, strokeBolts, drawBeam, rayToEdge } from './util.js';

export const SPELLS = {
  circle: { name: 'Bouclier', rgb: [90, 200, 255] },
  triangle: { name: 'Explosion', rgb: [255, 130, 40] },
  square: { name: 'Prison de glace', rgb: [170, 230, 255] },
  zigzag: { name: 'Foudre', rgb: [200, 220, 255] },
  line: { name: 'Lame', rgb: [255, 80, 200] },
  v: { name: 'Météore', rgb: [255, 200, 90] },
};

// ---------- Shape recognition ----------
function resample(pts, n = 48) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  const step = len / (n - 1);
  const out = [{ ...pts[0] }];
  let acc = 0;
  const p = pts.map((q) => ({ ...q }));
  for (let i = 1; i < p.length && out.length < n; i++) {
    const d = Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
    if (acc + d >= step && d > 0) {
      const t = (step - acc) / d;
      const q = { x: p[i - 1].x + (p[i].x - p[i - 1].x) * t, y: p[i - 1].y + (p[i].y - p[i - 1].y) * t };
      out.push(q);
      p.splice(i, 0, q);
      acc = 0;
    } else acc += d;
  }
  while (out.length < n) out.push({ ...p[p.length - 1] });
  return { pts: out, len };
}

// Returns { kind, ... } or null when the stroke is too small or unclear.
export function recognize(raw, minSize) {
  if (raw.length < 6) return null;
  const r0 = resample(raw).pts;
  // Light smoothing: tracking jitter must not look like corners.
  const pts = r0.map((p, i) => {
    let x = 0;
    let y = 0;
    let n = 0;
    for (let k = Math.max(0, i - 2); k <= Math.min(r0.length - 1, i + 2); k++, n++) {
      x += r0[k].x;
      y += r0[k].y;
    }
    return i === 0 || i === r0.length - 1 ? r0[i] : { x: x / n, y: y / n };
  });
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  const size = Math.max(w, h);
  if (size < minSize) return null;
  const c = { x: xs.reduce((a, b) => a + b) / xs.length, y: ys.reduce((a, b) => a + b) / ys.length };
  const first = pts[0];
  const last = pts[pts.length - 1];
  const gap = Math.hypot(last.x - first.x, last.y - first.y);
  // Straight stroke: nearly as long end to end as along the path.
  if (gap > len * 0.85 || (Math.min(w, h) < size * 0.22 && gap > size * 0.8)) return { kind: 'line', c, a: first, b: last };
  // Corners: sharp changes of direction along the stroke.
  const dir = (i) => Math.atan2(pts[Math.min(i + 3, 47)].y - pts[i].y, pts[Math.min(i + 3, 47)].x - pts[i].x);
  const corners = [];
  for (let i = 3; i < 44; i++) {
    let d = Math.abs(dir(i) - dir(i - 3));
    if (d > Math.PI) d = TAU - d;
    if (d > 0.95 && !corners.some((k) => Math.abs(k - i) < 5)) corners.push(i);
  }
  const closed = gap < size * 0.35;
  if (closed) {
    const rs = pts.map((p) => Math.hypot(p.x - c.x, p.y - c.y));
    const mean = rs.reduce((a, b) => a + b) / rs.length;
    const sd = Math.sqrt(rs.reduce((a, r) => a + (r - mean) ** 2, 0) / rs.length);
    if (sd / mean < 0.16 && corners.length <= 1) return { kind: 'circle', c, r: mean };
    if (corners.length <= 2) return { kind: 'triangle', c, r: mean };
    if (corners.length <= 4) return { kind: 'square', c, r: mean };
    return { kind: 'circle', c, r: mean };
  }
  if (corners.length === 1) return { kind: 'v', c, tip: pts[corners[0] + 1] };
  if (corners.length >= 2) return { kind: 'zigzag', c, pts };
  return len > size * 2.5 ? { kind: 'circle', c, r: size / 2 } : { kind: 'line', c, a: first, b: last };
}

export function runesEffect() {
  const fx = new Particles(1200);
  let stroke = [];
  let drawing = false;
  let casts = [];
  let label = null;
  return {
    id: 'runes',
    name: 'Runes magiques',
    needs: { seg: false },
    start() {
      stroke = [];
      casts = [];
      fx.clear();
    },
    update(dt, hands, e) {
      fx.update(dt);
      const h = hands.filter((x) => x.presence > 0.5).sort((a, b) => b.size - a.size)[0];
      const pen = h && (h.pinch || h.pinchAmount > 0.8 || h.point);
      if (pen) {
        const p = h.pinch || h.pinchAmount > 0.8 ? h.pinchPoint : h.lm[8];
        const lastP = stroke[stroke.length - 1];
        if (!lastP || Math.hypot(p.x - lastP.x, p.y - lastP.y) > 2) stroke.push({ x: p.x, y: p.y });
        if (!drawing) e.audio.play('tick', 0.3);
        drawing = true;
        if (Math.random() < 0.6)
          fx.add({ x: p.x, y: p.y, vx: rand(-40, 40), vy: rand(-40, 40), life: 0.5, size: 3 * e.unit, rgb: [255, 230, 160], core: 0.6 });
      } else if (drawing) {
        drawing = false;
        const r = recognize(stroke, Math.min(e.W, e.H) * 0.12);
        if (r) this.cast(e, r);
        else e.audio.play('drop', 0.4);
        // The stroke fades out where it was drawn.
        for (const p of stroke.filter((_, i) => i % 3 === 0))
          fx.add({
            x: p.x,
            y: p.y,
            vx: rand(-30, 30),
            vy: -rand(20, 80),
            life: rand(0.4, 0.8),
            size: 4 * e.unit,
            rgb: r ? SPELLS[r.kind].rgb : [150, 150, 150],
            core: 0.5,
          });
        stroke = [];
      }
      if (stroke.length > 400) stroke.shift();
      for (const c of casts) c.t += dt;
      casts = casts.filter((c) => c.t < (c.dur || 1.5));
      if (label) label.t += dt;
    },
    cast(e, r) {
      const S = SPELLS[r.kind];
      const big = Math.max(e.W, e.H);
      label = { text: S.name, rgb: S.rgb, t: 0 };
      e.emit('spell', { main: true, kind: r.kind, x: r.c.x, y: r.c.y, radius: big * 0.3, line: r.kind === 'line' ? [r.a, r.b] : null });
      if (r.kind === 'circle') {
        casts.push({ kind: 'circle', x: r.c.x, y: r.c.y, t: 0 });
        e.audio.play('teleport', 0.8);
        e.flash(S.rgb, 0.25, 3);
      } else if (r.kind === 'triangle') {
        for (let i = 0; i < 160; i++) {
          const a = rand(TAU);
          const v = rand(200, 1100) * e.unit;
          fx.add({
            x: r.c.x,
            y: r.c.y,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v,
            drag: 2.2,
            life: rand(0.5, 1.1),
            size: rand(15, 40) * e.unit,
            grow: 1.5,
            fire: true,
            alpha: 0.5,
          });
        }
        e.audio.play('boom', 1);
        e.shake(35);
        e.flash([255, 160, 60], 0.5, 2);
        e.punch(0.06);
      } else if (r.kind === 'square') {
        casts.push({ kind: 'square', x: r.c.x, y: r.c.y, s: r.r * 1.6, t: 0, dur: 2.5 });
        for (let i = 0; i < 80; i++) {
          const a = rand(TAU);
          const v = rand(100, 600) * e.unit;
          fx.add({
            x: r.c.x,
            y: r.c.y,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v,
            drag: 3,
            life: rand(0.6, 1.4),
            size: rand(3, 7) * e.unit,
            rgb: S.rgb,
            core: 0.6,
          });
        }
        e.audio.play('crack', 1);
        e.flash([200, 240, 255], 0.3, 2);
      } else if (r.kind === 'zigzag') {
        const spots = [r.pts[8], r.pts[24], r.pts[40]];
        casts.push({ kind: 'zigzag', spots, t: 0, dur: 0.8, bolts: [] });
        for (const s of spots) e.emit('spell', { kind: 'zigzag', x: s.x, y: s.y, radius: big * 0.15 });
        e.audio.play('thunder', 1);
        e.flash([220, 230, 255], 0.6, 3);
        e.shake(25);
      } else if (r.kind === 'line') {
        const dx = r.b.x - r.a.x;
        const dy = r.b.y - r.a.y;
        const l = Math.hypot(dx, dy) || 1;
        const ux = dx / l;
        const uy = dy / l;
        const back = rayToEdge(r.a.x, r.a.y, -ux, -uy, e.W, e.H);
        const fwd = rayToEdge(r.a.x, r.a.y, ux, uy, e.W, e.H);
        casts.push({
          kind: 'line',
          x1: r.a.x - ux * back,
          y1: r.a.y - uy * back,
          x2: r.a.x + ux * fwd,
          y2: r.a.y + uy * fwd,
          t: 0,
          dur: 0.7,
        });
        e.audio.play('swing', 1);
        e.audio.play('saberOn', 0.5);
        e.shake(15);
      } else if (r.kind === 'v') {
        casts.push({ kind: 'v', x: r.tip.x, y: r.tip.y, t: 0, dur: 1.6 });
        e.audio.play('whoosh', 1);
      }
    },
    draw(ctx, e) {
      // The rune being drawn.
      if (stroke.length > 1) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const [w, col] of [
          [14, 'rgba(255,190,90,0.18)'],
          [6, 'rgba(255,215,140,0.5)'],
          [2.2, 'rgba(255,255,240,0.95)'],
        ]) {
          ctx.strokeStyle = col;
          ctx.lineWidth = w * e.unit;
          ctx.beginPath();
          stroke.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      fx.draw(ctx);
      ctx.globalCompositeOperation = 'lighter';
      for (const c of casts) {
        const S = SPELLS[c.kind];
        const k = c.t / (c.dur || 1.5);
        if (c.kind === 'circle') {
          for (let i = 0; i < 3; i++) {
            const kk = clamp(k * 1.5 - i * 0.12);
            const R = kk * Math.max(e.W, e.H) * 0.5;
            ctx.strokeStyle = `rgba(${S.rgb.join(',')},${(1 - kk) * 0.8})`;
            ctx.lineWidth = (18 - i * 5) * e.unit * (1 - kk) + 1;
            ctx.beginPath();
            ctx.arc(c.x, c.y, R, 0, TAU);
            ctx.stroke();
          }
        } else if (c.kind === 'square') {
          // A cube of ice: glowing frame with frost.
          const a = Math.min(1, c.t * 4) * (1 - clamp((k - 0.7) / 0.3));
          ctx.strokeStyle = `rgba(${S.rgb.join(',')},${0.9 * a})`;
          ctx.fillStyle = `rgba(${S.rgb.join(',')},${0.15 * a})`;
          ctx.lineWidth = 4 * e.unit;
          ctx.beginPath();
          ctx.rect(c.x - c.s / 2, c.y - c.s / 2, c.s, c.s);
          ctx.fill();
          ctx.stroke();
          ctx.lineWidth = 1.5 * e.unit;
          for (let i = 0; i < 6; i++) {
            const ang = i + 0.5;
            ctx.beginPath();
            ctx.moveTo(c.x, c.y);
            ctx.lineTo(c.x + Math.cos(ang) * c.s * 0.5, c.y + Math.sin(ang) * c.s * 0.5);
            ctx.stroke();
          }
        } else if (c.kind === 'zigzag') {
          if (!c.bolts.length || Math.random() < 0.4) {
            c.bolts = [];
            for (const s of c.spots) c.bolts.push(...makeBolt(s.x + rand(-40, 40), 0, s.x, s.y, { jag: 0.25, depth: 7, branch: 0.35 }));
          }
          strokeBolts(ctx, c.bolts, S.rgb, 3 * e.unit, 1 - k);
          for (const s of c.spots) drawGlow(ctx, S.rgb, s.x, s.y, 80 * e.unit, 1 - k);
        } else if (c.kind === 'line') {
          drawBeam(ctx, c.x1, c.y1, c.x2, c.y2, 22 * e.unit * (1 - k), S.rgb, 1 - k, e.t);
        } else if (c.kind === 'v') {
          // A meteor falls on the tip of the V.
          const fall = clamp(c.t / 0.6);
          const mx = c.x + (1 - fall) * e.W * 0.4;
          const my = c.y - (1 - fall) * e.H;
          if (fall < 1) {
            drawGlow(ctx, S.rgb, mx, my, 60 * e.unit, 0.9, 0.3);
            drawBeam(ctx, mx + e.W * 0.15, my - e.H * 0.35, mx, my, 18 * e.unit, S.rgb, 0.6, e.t);
          } else {
            if (!c.hit) {
              c.hit = true;
              e.emit('spell', { kind: 'v', x: c.x, y: c.y, radius: Math.max(e.W, e.H) * 0.2 });
              e.audio.play('boom', 1);
              e.shake(30);
              e.flash(S.rgb, 0.4, 2);
              for (let i = 0; i < 100; i++) {
                const a = rand(Math.PI, TAU);
                const v = rand(200, 900) * e.unit;
                fx.add({
                  x: c.x,
                  y: c.y,
                  vx: Math.cos(a) * v,
                  vy: Math.sin(a) * v,
                  g: 900 * e.unit,
                  drag: 1,
                  life: rand(0.5, 1),
                  size: rand(10, 26) * e.unit,
                  grow: 1.2,
                  fire: true,
                  alpha: 0.5,
                });
              }
            }
            drawGlow(ctx, S.rgb, c.x, c.y, 160 * e.unit * (1 - k), 0.8 * (1 - k));
          }
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    },
    drawOver(ctx, e) {
      if (!label || label.t > 1.4) return;
      const a = clamp(1.4 - label.t) * clamp(label.t * 6);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `900 ${Math.round(40 * e.unit * (1 + 0.15 * clamp(1 - label.t * 4)))}px system-ui, sans-serif`;
      ctx.lineWidth = 6 * e.unit;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeText(label.text, e.W / 2, e.H * 0.22);
      ctx.fillStyle = `rgb(${label.rgb.join(',')})`;
      ctx.fillText(label.text, e.W / 2, e.H * 0.22);
      ctx.restore();
    },
  };
}
