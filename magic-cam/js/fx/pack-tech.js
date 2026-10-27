// Tech & hero powers: energy shield, neon drawing, code rain, web shooter,
// laser eyes, angel halo.
import { Particles, drawGlow, rand, TAU, noise1, clamp, palmPoint, rayToEdge, drawBeam, pick, makeCanvas } from './util.js';

const mainHand = (hands) => hands.filter((h) => h.presence > 0.4).sort((a, b) => b.size - a.size)[0];

// ---------- Energy shield: a hexagonal force field in front of the palm ----------
export function shieldEffect() {
  const COLORS = [
    { name: 'Bouclier bleu', rgb: [80, 190, 255] },
    { name: 'Bouclier doré', rgb: [255, 200, 80] },
    { name: 'Bouclier vert', rgb: [90, 255, 150] },
    { name: 'Bouclier rouge', rgb: [255, 80, 80] },
  ];
  let rgb = COLORS[0].rgb;
  let g = 0;
  let hit = 0;
  const cells = [];
  for (let q = -4; q <= 4; q++)
    for (let r = -4; r <= 4; r++) {
      const x = (q + r / 2) * 0.48;
      const y = r * 0.416;
      if (Math.hypot(x, y) < 2) cells.push({ x, y, ph: rand(TAU) });
    }
  return {
    id: 'shield',
    name: 'Bouclier d’énergie',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      g = 0;
    },
    update(dt, hands, e) {
      const h = mainHand(hands);
      this.h = h;
      g = clamp(g + (h && (h.open || h.gesture === 'relaxed') ? dt * 2.5 : -dt * 3));
      hit = Math.max(0, hit - dt * 2);
      this.dome = Math.max(0, (this.dome || 0) - dt / 4);
      if (h && h.speed > Math.min(e.W, e.H) * 1.5 && g > 0.5 && hit < 0.3) {
        hit = 1;
        e.audio.play('ring', 0.6);
      }
      if (h && g > 0.1) e.light(h.palm.x, h.palm.y, h.size * 5, rgb, 0.15 * g);
      e.audio.loop('hum', g * 0.3);
    },
    ultimate() {
      this.dome = 1;
      hit = 1;
      g = 1;
    },
    draw(ctx, e) {
      const h = this.h;
      if (!h || g < 0.02) return;
      ctx.globalCompositeOperation = 'lighter';
      // Bigger with the charge; after the final blast, a dome around you for 4 s.
      const s = g * (e.charge?.scale || 1) * (1 + 3 * Math.min(1, (this.dome || 0) * 3));
      // Each hexagon is projected in the palm plane, so the shield tilts with the hand.
      for (const c of cells) {
        const d = Math.hypot(c.x, c.y);
        const wave = hit > 0 ? Math.max(0, 1 - Math.abs(d - (1 - hit) * 2.2) * 2) : 0;
        const a = (0.18 + 0.12 * Math.sin(e.t * 3 + c.ph) + wave * 0.6) * s * (1 - d / 2.2);
        ctx.beginPath();
        for (let k = 0; k <= 6; k++) {
          const ang = (k / 6) * TAU + Math.PI / 6;
          const p = palmPoint(h, (c.x + Math.cos(ang) * 0.22) * s, (c.y + Math.sin(ang) * 0.22) * s + 0.4);
          if (k) ctx.lineTo(p.x, p.y);
          else ctx.moveTo(p.x, p.y);
        }
        ctx.fillStyle = `rgba(${rgb.join(',')},${a * 0.5 * (1 - 0.8 * Math.min(1, (this.dome || 0) * 3))})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(${rgb.map((v) => (v + 255) >> 1).join(',')},${a + 0.15 * s})`;
        ctx.lineWidth = 1.5 * e.unit;
        ctx.stroke();
      }
      ctx.beginPath();
      for (let k = 0; k <= 64; k++) {
        const ang = (k / 64) * TAU;
        const p = palmPoint(h, Math.cos(ang) * 2.1 * s, Math.sin(ang) * 2.1 * s + 0.4);
        if (k) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
      }
      ctx.strokeStyle = `rgba(${rgb.join(',')},${0.8 * s})`;
      ctx.lineWidth = 3 * e.unit;
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

// ---------- Neon drawing: pinch to draw glowing lines in the air ----------
export function neonEffect() {
  const PAL = [
    [255, 60, 200],
    [60, 230, 255],
    [255, 230, 60],
    [120, 255, 120],
    [190, 110, 255],
  ];
  let strokes = [];
  let current = new Map();
  let colorI = 0;
  const sparks = new Particles(300);
  return {
    id: 'neon',
    name: 'Dessin néon',
    needs: { seg: false },
    start() {
      strokes = [];
      current = new Map();
      sparks.clear();
    },
    update(dt, hands, e) {
      sparks.update(dt);
      let buzzing = false;
      for (const h of hands) {
        const drawing = h.presence > 0.4 && (h.pinch || h.pinchAmount > 0.8);
        let s = current.get(h.id);
        if (drawing) {
          if (!s) {
            s = { pts: [], rgb: PAL[colorI++ % PAL.length] };
            current.set(h.id, s);
            strokes.push(s);
            e.audio.play('tick', 0.3);
          }
          buzzing = true;
          const p = h.pinchPoint;
          const last = s.pts[s.pts.length - 1];
          if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 3) s.pts.push({ x: p.x, y: p.y });
          if (Math.random() < 0.5)
            sparks.add({ x: p.x, y: p.y, vx: rand(-60, 60), vy: rand(-60, 60), life: 0.4, size: 2.5 * e.unit, rgb: s.rgb, core: 0.6 });
        } else current.delete(h.id);
        // A fast swipe with an open hand wipes the drawing away.
        if (h.open && h.speed > Math.min(e.W, e.H) * 2.5 && strokes.length) {
          for (const st of strokes)
            for (const p of st.pts.filter((_, i) => i % 4 === 0))
              sparks.add({
                x: p.x,
                y: p.y,
                vx: h.vel.x * 0.4 + rand(-100, 100),
                vy: h.vel.y * 0.4 + rand(-100, 100),
                drag: 2,
                life: rand(0.4, 0.8),
                size: 3 * e.unit,
                rgb: st.rgb,
                core: 0.5,
              });
          strokes = [];
          current = new Map();
          e.audio.play('whoosh', 0.7);
        }
      }
      e.audio.loop('buzz', buzzing ? 1 : 0);
      if (strokes.length > 40) strokes.shift();
    },
    draw(ctx, e) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const flick = 0.9 + 0.1 * noise1(e.t * 15);
      for (const s of strokes) {
        if (s.pts.length < 2) continue;
        for (const [w, a] of [
          [16, 0.12],
          [7, 0.4],
          [2.5, 1],
        ]) {
          ctx.strokeStyle = a === 1 ? `rgba(255,255,255,${0.9 * flick})` : `rgba(${s.rgb.join(',')},${a * flick})`;
          ctx.lineWidth = w * e.unit;
          ctx.beginPath();
          s.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      sparks.draw(ctx);
    },
  };
}

// ---------- Code rain: falling green code, pushed aside by your hands ----------
export function matrixEffect() {
  const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF<>=+*'.split('');
  const COLORS = [
    { name: 'Code vert', rgb: [80, 255, 120] },
    { name: 'Code bleu', rgb: [80, 200, 255] },
    { name: 'Code rouge', rgb: [255, 80, 80] },
  ];
  let rgb = COLORS[0].rgb;
  let cols = [];
  let atlas = null;
  // Every glyph pre-drawn once (row 0 in colour, row 1 white for the heads):
  // drawing images is much cheaper than fillText for a thousand characters a frame.
  const glyphAtlas = (cell, col) => {
    const canvas = makeCanvas(cell * GLYPHS.length, cell * 2);
    const g = canvas.getContext('2d');
    g.font = `${cell}px ui-monospace, Menlo, monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    GLYPHS.forEach((ch, i) => {
      g.fillStyle = `rgb(${col.join(',')})`;
      g.fillText(ch, i * cell + cell / 2, cell * 0.85);
      g.fillStyle = '#eaffea';
      g.fillText(ch, i * cell + cell / 2, cell * 1.85);
    });
    return { canvas, cell, rgb: col };
  };
  return {
    id: 'matrix',
    name: 'Pluie de code',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      cols = [];
    },
    update(dt, hands, e) {
      const size = 18 * e.unit;
      const n = Math.ceil(e.W / size);
      if (cols.length !== n)
        cols = Array.from({ length: n }, (_, i) => ({
          x: i * size,
          y: rand(-e.H, 0),
          v: rand(120, 320) * e.unit,
          chars: Array.from({ length: 16 }, () => pick(GLYPHS)),
          off: 0,
        }));
      for (const c of cols) {
        c.y += c.v * dt;
        if (c.y - 16 * size > e.H) c.y = rand(-e.H * 0.5, 0);
        if (Math.random() < dt * 8) c.chars[(Math.random() * 16) | 0] = pick(GLYPHS);
        // Hands part the code like water.
        let push = 0;
        for (const h of hands) {
          if (h.presence < 0.4) continue;
          const dx = c.x - h.palm.x;
          if (Math.abs(dx) < h.size * 2.5 && Math.abs(c.y - 8 * size - h.palm.y) < e.H * 0.5)
            push += Math.sign(dx || 1) * (h.size * 2.5 - Math.abs(dx)) * 0.6;
        }
        c.off += (push - c.off) * Math.min(1, dt * 8);
      }
    },
    draw(ctx, e) {
      const size = 18 * e.unit;
      ctx.fillStyle = 'rgba(0,10,0,0.25)';
      ctx.fillRect(0, 0, e.W, e.H);
      const cell = Math.round(size);
      if (!atlas || atlas.cell !== cell || atlas.rgb !== rgb) atlas = glyphAtlas(cell, rgb);
      for (const c of cols) {
        for (let k = 0; k < 16; k++) {
          const y = c.y - k * size;
          if (y < -size || y > e.H + size) continue;
          const gi = GLYPHS.indexOf(c.chars[k]);
          ctx.globalAlpha = k === 0 ? 1 : (1 - k / 16) * 0.85;
          ctx.drawImage(atlas.canvas, gi * cell, k === 0 ? cell : 0, cell, cell, c.x + c.off, y - cell * 0.85, cell, cell);
        }
      }
      ctx.globalAlpha = 1;
    },
  };
}

// ---------- Web shooter: point and fire sticky web strands ----------
export function webEffect() {
  let webs = [];
  const cool = new Map();
  return {
    id: 'web',
    name: 'Lance-toile',
    needs: { seg: false },
    start() {
      webs = [];
    },
    update(dt, hands, e) {
      for (const h of hands) {
        if (h.presence < 0.5) continue;
        const c = (cool.get(h.id) || 0) - dt;
        cool.set(h.id, c);
        const shooting = h.point || (h.fingers.index && h.fingers.pinky && !h.fingers.middle && !h.fingers.ring);
        if (shooting && c <= 0) {
          const from = h.lm[0];
          const tip = h.lm[8];
          let dx = tip.x - h.lm[5].x;
          let dy = tip.y - h.lm[5].y;
          const l = Math.hypot(dx, dy) || 1;
          dx /= l;
          dy /= l;
          const L = rayToEdge(tip.x, tip.y, dx, dy, e.W, e.H);
          webs.push({ ax: from.x, ay: from.y, bx: tip.x + dx * L, by: tip.y + dy * L, t: 0, life: 6, hand: h.id });
          cool.set(h.id, 0.45);
          e.audio.play('thwip', 0.8);
        }
      }
      for (const w of webs) {
        w.t += dt;
        // The strand stays attached to the wrist that fired it.
        const h = hands.find((x) => x.id === w.hand && x.presence > 0.3);
        if (h && w.t < 1.5) {
          w.ax = h.lm[0].x;
          w.ay = h.lm[0].y;
        }
      }
      webs = webs.filter((w) => w.t < w.life);
      if (webs.length > 14) webs.shift();
    },
    draw(ctx, e) {
      ctx.lineCap = 'round';
      for (const w of webs) {
        const grow = clamp(w.t * 6);
        const fade = clamp((w.life - w.t) / 1);
        const bx = w.ax + (w.bx - w.ax) * grow;
        const by = w.ay + (w.by - w.ay) * grow;
        const sag = Math.hypot(bx - w.ax, by - w.ay) * 0.06 * clamp(w.t * 2);
        const mx = (w.ax + bx) / 2;
        const my = (w.ay + by) / 2 + sag;
        for (const [lw, col] of [
          [4, `rgba(0,0,0,${0.25 * fade})`],
          [1.6, `rgba(250,250,255,${0.95 * fade})`],
        ]) {
          ctx.strokeStyle = col;
          ctx.lineWidth = lw * e.unit;
          ctx.beginPath();
          ctx.moveTo(w.ax, w.ay);
          ctx.quadraticCurveTo(mx, my, bx, by);
          ctx.stroke();
        }
        // Splat where it sticks.
        if (grow >= 1) {
          ctx.strokeStyle = `rgba(250,250,255,${0.8 * fade})`;
          ctx.lineWidth = 1.2 * e.unit;
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * TAU;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + Math.cos(a) * 26 * e.unit, by + Math.sin(a) * 26 * e.unit);
            ctx.stroke();
          }
          for (const r of [10, 18]) {
            ctx.beginPath();
            for (let k = 0; k <= 8; k++) {
              const a = (k / 8) * TAU;
              const rr = r * e.unit * (k % 2 ? 0.85 : 1);
              if (k) ctx.lineTo(bx + Math.cos(a) * rr, by + Math.sin(a) * rr);
              else ctx.moveTo(bx + Math.cos(a) * rr, by + Math.sin(a) * rr);
            }
            ctx.stroke();
          }
        }
      }
    },
  };
}

// ---------- Laser eyes: beams from your eyes (body points) ----------
export function laserEyesEffect() {
  const COLORS = [
    { name: 'Laser rouge', rgb: [255, 40, 40] },
    { name: 'Laser bleu', rgb: [60, 160, 255] },
    { name: 'Laser vert', rgb: [70, 255, 90] },
  ];
  let rgb = COLORS[0].rgb;
  const sparks = new Particles(400);
  return {
    id: 'lasereyes',
    name: 'Yeux laser',
    colors: COLORS,
    needs: { seg: false, pose: true },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      sparks.clear();
    },
    update(dt, hands, e) {
      sparks.update(dt);
      const b = e.body.points;
      this.eyes = null;
      e.audio.loop('laser', 0);
      if (!b || e.body.presence < 0.3 || b[2].v < 0.5 || b[5].v < 0.5) return;
      const eyes = [b[2], b[5]];
      // Beams aim at your index finger when it is up, otherwise where you look.
      const h = mainHand(hands);
      let tx;
      let ty;
      if (h && h.visible) {
        tx = h.lm[8].x;
        ty = h.lm[8].y;
      } else {
        const earMid = b[7].v > 0.4 && b[8].v > 0.4 ? (b[7].x + b[8].x) / 2 : b[0].x;
        const yaw = (b[0].x - earMid) * 6;
        tx = b[0].x + yaw;
        ty = e.H;
      }
      this.eyes = eyes.map((p) => {
        const dx = tx - p.x;
        const dy = ty - p.y;
        const l = Math.hypot(dx, dy) || 1;
        const L = rayToEdge(p.x, p.y, dx / l, dy / l, e.W, e.H);
        const hitL = h && h.visible ? Math.min(L, l) : L;
        return { x: p.x, y: p.y, ex: p.x + (dx / l) * hitL, ey: p.y + (dy / l) * hitL };
      });
      for (const ey of this.eyes)
        for (let k = 0; k < 3; k++)
          sparks.add({
            x: ey.ex,
            y: ey.ey,
            vx: rand(-400, 400) * e.unit,
            vy: rand(-500, 100) * e.unit,
            g: 1200 * e.unit,
            drag: 1,
            life: rand(0.2, 0.5),
            size: rand(2, 4) * e.unit,
            rgb: [255, 220, 160],
            core: 0.5,
          });
      e.audio.loop('laser', 1);
      e.light(this.eyes[0].x, this.eyes[0].y, 120 * e.unit, rgb, 0.3);
    },
    draw(ctx, e) {
      sparks.draw(ctx);
      if (!this.eyes) return;
      const eyeD = Math.hypot(this.eyes[0].x - this.eyes[1].x, this.eyes[0].y - this.eyes[1].y);
      for (const ey of this.eyes) {
        drawBeam(ctx, ey.x, ey.y, ey.ex, ey.ey, eyeD * 0.28, rgb, 1, e.t);
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, rgb, ey.x, ey.y, eyeD * 0.5, 0.9, 0.3);
        drawGlow(ctx, [255, 255, 255], ey.x, ey.y, eyeD * 0.18, 1);
        drawGlow(ctx, [255, 230, 180], ey.ex, ey.ey, eyeD * 0.6, 0.8);
        ctx.globalCompositeOperation = 'source-over';
      }
    },
  };
}

// A light ray: a thin triangle fading away from its tip (cached per colour).
const RAYS = new Map();
function haloRay(rgb) {
  const key = String(rgb);
  if (!RAYS.has(key)) {
    const c = makeCanvas(256, 32);
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0, `rgba(${key},0.18)`);
    grad.addColorStop(1, `rgba(${key},0)`);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, 16);
    g.lineTo(256, 0);
    g.lineTo(256, 32);
    g.closePath();
    g.fill();
    RAYS.set(key, c);
  }
  return RAYS.get(key);
}

// ---------- Angel halo: a glowing halo above your head, light rays behind ----------
export function haloEffect() {
  const COLORS = [
    { name: 'Halo doré', rgb: [255, 215, 110] },
    { name: 'Halo céleste', rgb: [150, 210, 255] },
    { name: 'Halo démoniaque', rgb: [255, 60, 60] },
  ];
  let rgb = COLORS[0].rgb;
  const motes = new Particles(150);
  return {
    id: 'halo',
    name: 'Auréole d’ange',
    colors: COLORS,
    needs: { seg: false, pose: true },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      motes.clear();
    },
    update(dt, hands, e) {
      motes.update(dt);
      const b = e.body.points;
      this.head = null;
      if (!b || e.body.presence < 0.3 || b[0].v < 0.5) return;
      const w = b[7].v > 0.4 && b[8].v > 0.4 ? Math.hypot(b[7].x - b[8].x, b[7].y - b[8].y) : 80 * e.unit;
      const tilt = b[7].v > 0.4 && b[8].v > 0.4 ? Math.atan2(b[7].y - b[8].y, b[7].x - b[8].x) : 0;
      this.head = { x: b[0].x, y: b[0].y - w * 1.25, w, tilt };
      if (Math.random() < 0.5)
        motes.add({
          x: this.head.x + rand(-w, w),
          y: this.head.y + rand(-w * 0.2, w * 0.2),
          vx: rand(-10, 10),
          vy: rand(20, 60),
          life: rand(1, 2),
          size: rand(1.5, 3.5) * e.unit,
          rgb,
          core: 0.6,
        });
      e.light(this.head.x, this.head.y, w * 3, rgb, 0.15);
    },
    draw(ctx, e) {
      motes.draw(ctx);
      if (!this.head) return;
      const { x, y, w, tilt } = this.head;
      ctx.globalCompositeOperation = 'lighter';
      // Soft rays.
      for (let k = 0; k < 12; k++) {
        const a = -Math.PI / 2 + (k - 5.5) * 0.22 + Math.sin(e.t * 0.5) * 0.05;
        const L = w * (3 + noise1(e.t + k) * 0.6);
        ctx.save();
        ctx.translate(x, y + w);
        ctx.rotate(a);
        ctx.drawImage(haloRay(rgb), 0, -L * 0.06, L, L * 0.12);
        ctx.restore();
      }
      ctx.save();
      ctx.translate(x, y + Math.sin(e.t * 2) * w * 0.04);
      ctx.rotate(tilt);
      for (const [lw, a] of [
        [w * 0.25, 0.15],
        [w * 0.1, 0.5],
        [w * 0.035, 1],
      ]) {
        ctx.strokeStyle = a === 1 ? 'rgba(255,255,240,0.95)' : `rgba(${rgb.join(',')},${a})`;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.ellipse(0, 0, w * 0.75, w * 0.2, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}
