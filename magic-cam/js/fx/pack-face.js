// Face pack: things that sit on your head and follow it (body tracking: the
// ears and the eyes give the size and the tilt of the head).
//   Couronne royale   a golden crown with gems and sparkles
//   Masque de héros   a superhero mask over the eyes
//   Casque d'astronaute  a glass bubble helmet around the head
import { Particles, drawGlow, rand, TAU } from './util.js';

// Head position, size and tilt from the body points, smoothed so it does
// not shake. Returns null when the face is not seen.
function headTracker() {
  let h = null;
  return (e) => {
    const b = e.body?.points;
    if (!b || e.body.presence < 0.3 || b[0].v < 0.5) {
      h = null;
      return null;
    }
    const ears = b[7].v > 0.4 && b[8].v > 0.4;
    const w = ears ? Math.hypot(b[7].x - b[8].x, b[7].y - b[8].y) : 80 * e.unit;
    // Tilt from the eyes (more stable than the ears), else the ears.
    const eyes = b[2].v > 0.5 && b[5].v > 0.5;
    const tilt = eyes ? Math.atan2(b[2].y - b[5].y, b[2].x - b[5].x) : ears ? Math.atan2(b[7].y - b[8].y, b[7].x - b[8].x) : 0;
    const eyeY = eyes ? (b[2].y + b[5].y) / 2 : b[0].y - w * 0.15;
    const eyeX = eyes ? (b[2].x + b[5].x) / 2 : b[0].x;
    const next = { x: eyeX, y: eyeY, w, tilt: tilt > Math.PI / 2 ? tilt - Math.PI : tilt < -Math.PI / 2 ? tilt + Math.PI : tilt };
    if (!h) h = next;
    else for (const k of ['x', 'y', 'w', 'tilt']) h[k] += (next[k] - h[k]) * 0.35;
    return h;
  };
}

// ---------- Couronne royale ----------
export function crownEffect() {
  const COLORS = [
    { name: 'Or', metal: ['#fff2b0', '#f2c14e', '#a86b12'], gem: [255, 40, 80] },
    { name: 'Argent', metal: ['#ffffff', '#c9d2e0', '#6d7891'], gem: [80, 160, 255] },
    { name: 'Glace', metal: ['#e8fbff', '#8fe3ff', '#2a86b8'], gem: [160, 255, 240] },
  ];
  let scheme = COLORS[0];
  const head = headTracker();
  const sparks = new Particles(200);
  let hd = null;

  return {
    id: 'crown',
    name: 'Couronne royale',
    hint: 'Regarde la caméra, la tête bien visible : une couronne se pose sur toi et suit ta tête. Penche-la, elle suit.',
    colors: COLORS,
    needs: { seg: false, pose: true },
    setColor(i) {
      scheme = COLORS[i];
    },
    start() {
      sparks.clear();
    },
    update(dt, hands, e) {
      sparks.update(dt);
      hd = head(e);
      if (hd && Math.random() < 0.5) {
        const a = rand(-0.9, 0.9);
        sparks.add({
          x: hd.x + Math.cos(hd.tilt) * a * hd.w + Math.sin(hd.tilt) * hd.w * 0.9,
          y: hd.y + Math.sin(hd.tilt) * a * hd.w - Math.cos(hd.tilt) * hd.w * 0.9,
          vx: rand(-20, 20),
          vy: rand(-40, -10),
          life: rand(0.4, 1),
          size: rand(1.5, 3.5) * e.unit,
          rgb: [255, 240, 190],
          core: 0.7,
        });
      }
    },
    draw(ctx, e) {
      sparks.draw(ctx);
      if (!hd) return;
      const { x, y, w, tilt } = hd;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tilt);
      // Sits on top of the head: about 0.8 head-widths above the eyes.
      ctx.translate(0, -w * 0.82);
      const cw = w * 1.15;
      const ch = w * 0.55;
      const metal = ctx.createLinearGradient(0, -ch, 0, ch * 0.3);
      metal.addColorStop(0, scheme.metal[0]);
      metal.addColorStop(0.5, scheme.metal[1]);
      metal.addColorStop(1, scheme.metal[2]);
      ctx.fillStyle = metal;
      ctx.strokeStyle = scheme.metal[2];
      ctx.lineWidth = 2 * e.unit;
      ctx.beginPath();
      ctx.moveTo(-cw / 2, ch * 0.3);
      ctx.lineTo(-cw / 2, -ch * 0.35);
      // Five points.
      for (let k = 0; k < 5; k++) {
        const px = -cw / 2 + (cw * (k + 0.5)) / 5;
        ctx.lineTo(px - cw * 0.06, -ch * 0.3);
        ctx.lineTo(px, -ch * (k === 2 ? 1 : 0.8));
        ctx.lineTo(px + cw * 0.06, -ch * 0.3);
      }
      ctx.lineTo(cw / 2, -ch * 0.35);
      ctx.lineTo(cw / 2, ch * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Band and gems.
      ctx.fillStyle = scheme.metal[2];
      ctx.fillRect(-cw / 2, ch * 0.05, cw, ch * 0.12);
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 5; k++) {
        const px = -cw / 2 + (cw * (k + 0.5)) / 5;
        drawGlow(ctx, scheme.gem, px, -ch * (k === 2 ? 1 : 0.8), w * 0.09, 0.9, 0.5);
        drawGlow(ctx, scheme.gem, px, ch * 0.11, w * 0.06, 0.8, 0.5);
      }
      // A shine that slides across the metal.
      const sx = ((e.t * 0.5) % 1.6) - 0.3;
      drawGlow(ctx, [255, 255, 255], -cw / 2 + cw * sx, -ch * 0.2, w * 0.18, 0.5, 0.2);
      ctx.restore();
    },
  };
}

// ---------- Masque de héros ----------
export function heroMaskEffect() {
  const COLORS = [
    { name: 'Rouge', fill: '#c4161c', edge: '#5a0508', glow: [255, 70, 70] },
    { name: 'Noir', fill: '#111116', edge: '#000', glow: [120, 160, 255] },
    { name: 'Bleu', fill: '#1d4fd6', edge: '#0a1f5c', glow: [90, 200, 255] },
    { name: 'Vert', fill: '#1c9b4b', edge: '#08401d', glow: [100, 255, 150] },
  ];
  let scheme = COLORS[0];
  const head = headTracker();
  let hd = null;

  return {
    id: 'heromask',
    name: 'Masque de héros',
    hint: 'Regarde la caméra : un masque de super-héros se pose sur tes yeux et suit ta tête. Change sa couleur avec le bouton couleur.',
    colors: COLORS,
    needs: { seg: false, pose: true },
    setColor(i) {
      scheme = COLORS[i];
    },
    update(dt, hands, e) {
      hd = head(e);
    },
    drawOver(ctx, e) {
      if (!hd) return;
      const { x, y, w, tilt } = hd;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tilt);
      const mw = w * 0.62;
      const mh = w * 0.22;
      ctx.beginPath();
      // Mask band with pointed ends.
      ctx.moveTo(-mw, -mh * 0.2);
      ctx.quadraticCurveTo(-mw * 0.6, -mh * 1.3, 0, -mh * 0.7);
      ctx.quadraticCurveTo(mw * 0.6, -mh * 1.3, mw, -mh * 0.2);
      ctx.lineTo(mw * 1.15, mh * 0.2);
      ctx.quadraticCurveTo(mw * 0.6, mh * 1.4, mw * 0.08, mh * 0.6);
      ctx.lineTo(-mw * 0.08, mh * 0.6);
      ctx.quadraticCurveTo(-mw * 0.6, mh * 1.4, -mw * 1.15, mh * 0.2);
      ctx.closePath();
      // Eye holes (cut out with even-odd filling).
      for (const s of [-1, 1]) {
        ctx.moveTo(s * mw * 0.48 + mw * 0.22, 0);
        ctx.ellipse(s * mw * 0.48, 0, mw * 0.22, mh * 0.42, 0, 0, TAU);
      }
      ctx.fillStyle = scheme.fill;
      ctx.strokeStyle = scheme.edge;
      ctx.lineWidth = 3 * e.unit;
      ctx.fill('evenodd');
      ctx.stroke();
      // Glowing outline of the eye holes.
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${scheme.glow.join(',')},0.6)`;
      ctx.lineWidth = 2 * e.unit;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(s * mw * 0.48, 0, mw * 0.22, mh * 0.42, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    },
  };
}

// ---------- Casque d'astronaute ----------
// A glass bubble helmet around your head, with reflections, a metal collar
// and little lights; bubbles of air rise inside it.
export function helmetEffect() {
  const head = headTracker();
  let hd = null;
  const bubbles = new Particles(60);

  return {
    id: 'helmet',
    name: 'Casque d’astronaute',
    hint: 'Regarde la caméra : un casque de verre se pose sur ta tête, avec ses reflets et ses petites lumières.',
    needs: { seg: false, pose: true },
    start() {
      bubbles.clear();
    },
    update(dt, hands, e) {
      bubbles.update(dt);
      hd = head(e);
      if (hd && Math.random() < 0.15)
        bubbles.add({
          x: hd.x + rand(-0.5, 0.5) * hd.w,
          y: hd.y + hd.w * 0.6,
          vx: rand(-10, 10),
          vy: -rand(30, 70) * e.unit,
          life: rand(1, 2),
          size: rand(2, 5) * e.unit,
          rgb: [200, 240, 255],
          core: 0.2,
          alpha: 0.5,
        });
    },
    drawOver(ctx, e) {
      if (!hd) return;
      const { x, y, w, tilt } = hd;
      const R = w * 1.05;
      const cy = y - w * 0.15;
      ctx.save();
      // Glass: a light tint, brighter on the rim.
      const glass = ctx.createRadialGradient(x - R * 0.3, cy - R * 0.35, R * 0.1, x, cy, R);
      glass.addColorStop(0, 'rgba(255,255,255,0.12)');
      glass.addColorStop(0.7, 'rgba(170,220,255,0.06)');
      glass.addColorStop(1, 'rgba(170,220,255,0.35)');
      ctx.fillStyle = glass;
      ctx.beginPath();
      ctx.arc(x, cy, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(220,240,255,0.7)';
      ctx.lineWidth = 3 * e.unit;
      ctx.stroke();
      // Reflections.
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = R * 0.06;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(x, cy, R * 0.82, Math.PI * 1.1, Math.PI * 1.4);
      ctx.stroke();
      ctx.lineWidth = R * 0.03;
      ctx.beginPath();
      ctx.arc(x, cy, R * 0.82, Math.PI * 1.5, Math.PI * 1.58);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      // Metal collar under the chin, tilted with the head.
      ctx.translate(x, cy);
      ctx.rotate(tilt);
      const collar = ctx.createLinearGradient(0, R * 0.8, 0, R * 1.15);
      collar.addColorStop(0, '#e9eef5');
      collar.addColorStop(1, '#7d8696');
      ctx.fillStyle = collar;
      ctx.beginPath();
      ctx.ellipse(0, R * 0.95, R * 0.95, R * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Little lights on the collar.
      ctx.globalCompositeOperation = 'lighter';
      for (const [dx, col] of [
        [-0.5, [255, 60, 60]],
        [0, [80, 255, 140]],
        [0.5, [80, 180, 255]],
      ])
        drawGlow(ctx, col, R * dx, R * 0.95, R * 0.08, 0.6 + 0.4 * Math.sin(e.t * 4 + dx * 5), 0.5);
      ctx.restore();
      bubbles.draw(ctx);
    },
  };
}
