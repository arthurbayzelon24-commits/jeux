// Sorcerer portal, Doctor Strange style: turn your hand in circles in the air
// (index or whole hand), leaving a trail of sparks. When the loop closes, a
// spark-ringed portal opens there, showing your own landscape seen from
// elsewhere (without you in it). Keep circling on it to make it bigger; a
// circle somewhere else moves it.
import { Particles, drawGlow, rand, TAU, noise1, makeCanvas } from './util.js';

const COLORS = [
  { name: 'Étincelles', rgb: [255, 150, 40], world: 'land' },
  { name: 'Émeraude', rgb: [80, 255, 140], world: 'land' },
  { name: 'Crépuscule', rgb: [255, 110, 70], world: 'dusk' },
  { name: 'Cosmos', rgb: [140, 150, 255], world: 'space' },
];

// Painted "other world" seen through the portal.
function paintWorld(kind, size) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, size);
  if (kind === 'dusk') {
    sky.addColorStop(0, '#1b1036');
    sky.addColorStop(0.55, '#c24a3a');
    sky.addColorStop(1, '#f6b24a');
  } else if (kind === 'aurora') {
    sky.addColorStop(0, '#02101c');
    sky.addColorStop(0.6, '#0a3a4a');
    sky.addColorStop(1, '#1d6b5a');
  } else {
    sky.addColorStop(0, '#03020a');
    sky.addColorStop(1, '#1a1040');
  }
  g.fillStyle = sky;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 160; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * (kind === 'dusk' ? 0.4 : 0.9)})`;
    g.fillRect(Math.random() * size, Math.random() * size * (kind === 'space' ? 1 : 0.55), 1.5, 1.5);
  }
  if (kind === 'aurora') {
    for (let i = 0; i < 3; i++) {
      const a = g.createLinearGradient(0, size * 0.1, 0, size * 0.55);
      a.addColorStop(0, 'rgba(80,255,170,0)');
      a.addColorStop(0.5, 'rgba(80,255,170,0.35)');
      a.addColorStop(1, 'rgba(120,80,255,0)');
      g.fillStyle = a;
      g.beginPath();
      g.moveTo(0, size * (0.2 + i * 0.08));
      for (let x = 0; x <= size; x += size / 10) g.lineTo(x, size * (0.25 + i * 0.08) + Math.sin((x / size) * 6 + i) * size * 0.06);
      g.lineTo(size, size * 0.6);
      g.lineTo(0, size * 0.6);
      g.fill();
    }
  }
  if (kind === 'space') {
    const p = g.createRadialGradient(size * 0.65, size * 0.4, 2, size * 0.65, size * 0.4, size * 0.22);
    p.addColorStop(0, '#ffd9a0');
    p.addColorStop(0.7, '#c4552a');
    p.addColorStop(1, 'rgba(60,20,10,0)');
    g.fillStyle = p;
    g.beginPath();
    g.arc(size * 0.65, size * 0.4, size * 0.22, 0, TAU);
    g.fill();
  } else {
    // Sun and mountain ranges.
    g.fillStyle = kind === 'dusk' ? 'rgba(255,230,160,0.9)' : 'rgba(220,240,255,0.8)';
    g.beginPath();
    g.arc(size * 0.62, size * 0.55, size * 0.08, 0, TAU);
    g.fill();
    const ranges = kind === 'dusk' ? ['#5a2440', '#3a1630', '#1e0b1c'] : ['#0e3340', '#09232e', '#041419'];
    ranges.forEach((col, i) => {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, size);
      for (let x = 0; x <= size; x += size / 14)
        g.lineTo(x, size * (0.6 + i * 0.1) - Math.abs(Math.sin(x * 0.02 + i * 2)) * size * 0.12 - Math.random() * size * 0.02);
      g.lineTo(size, size);
      g.fill();
    });
  }
  return c;
}

export function portalEffect() {
  const sparks = new Particles(1200);
  let scheme = COLORS[0];
  let world = null;
  let trail = [];
  let portal = null; // { x, y, r, open }

  return {
    id: 'portal',
    name: 'Portail magique',
    colors: COLORS,
    hint: 'Fais des cercles avec la main, comme Doctor Strange : un portail s’ouvre sur ton paysage. Continue de tourner dessus pour l’agrandir.',
    needs: { seg: true, plate: true },
    setColor(i) {
      scheme = COLORS[i];
      world = null;
    },
    start() {
      sparks.clear();
      trail = [];
      portal = null;
    },
    update(dt, hands, e) {
      sparks.update(dt);
      const now = e.t;
      // A hand that blurs for a moment keeps drawing (it coasts on its motion).
      const h = hands.filter((x) => x.presence > 0.3).sort((a, b) => b.size - a.size)[0];
      if (h) {
        // The index tip when it points, else the middle of the hand.
        const tip = h.fingers.index || h.point ? h.lm[8] : h.lm[9];
        const prev = trail[trail.length - 1];
        trail.push({ x: tip.x, y: tip.y, t: now });
        // Sparks thrown off the moving fingertip.
        const v = prev ? Math.hypot(tip.x - prev.x, tip.y - prev.y) / dt : 0;
        const n = Math.min(8, 1 + v / (e.W * 0.3));
        for (let i = 0; i < n; i++)
          sparks.add({
            x: tip.x,
            y: tip.y,
            vx: rand(-260, 260) * e.unit,
            vy: rand(-260, 120) * e.unit,
            g: 700 * e.unit,
            drag: 1.5,
            life: rand(0.3, 0.8),
            size: rand(2, 4.5) * e.unit,
            rgb: scheme.rgb,
            core: 0.6,
          });
        const loop = closedLoop(trail, h.size, now);
        if (loop) {
          const max = Math.min(e.W, e.H) * 0.48;
          if (portal && Math.hypot(loop.x - portal.x, loop.y - portal.y) < portal.r * 1.2) {
            // Circling again on the portal makes it grow.
            portal.target = Math.min(max, portal.target * 1.35);
            e.audio.play('whoosh', 0.6);
          } else {
            const r = Math.min(max, Math.max(loop.r, h.size * 1.4));
            portal = { x: loop.x, y: loop.y, r: r * 0.6, target: r, open: 0, spin: 0 };
            world = null;
            e.audio.play('teleport', 0.9);
            e.flash(scheme.rgb, 0.25, 3);
          }
          trail = [];
        }
      }
      trail = trail.filter((p) => now - p.t < 2.6);

      if (portal) {
        portal.open = Math.min(1, portal.open + dt * 1.8);
        portal.r += (portal.target - portal.r) * (1 - Math.exp(-dt * 4));
        portal.spin += dt * 2.2;
        const R = portal.r * easeOut(portal.open);
        // The rim sheds sparks tangentially, like a spinning grinder.
        const count = Math.round(40 * portal.open);
        for (let i = 0; i < count; i++) {
          const a = rand(TAU);
          const v = rand(250, 650) * e.unit;
          const rr = R * rand(0.97, 1.05);
          sparks.add({
            x: portal.x + Math.cos(a) * rr,
            y: portal.y + Math.sin(a) * rr,
            vx: -Math.sin(a) * v,
            vy: Math.cos(a) * v,
            g: 500 * e.unit,
            drag: 1.2,
            life: rand(0.25, 0.7),
            size: rand(1.5, 4) * e.unit,
            rgb: scheme.rgb,
            core: 0.6,
          });
        }
        e.light(portal.x, portal.y, R * 2.2, scheme.rgb, 0.25 * portal.open);
        e.audio.loop('fire', 0.35 * portal.open);
      } else e.audio.loop('fire', 0);
    },
    draw(ctx, e) {
      if (portal) {
        const R = portal.r * easeOut(portal.open);
        if (!world) world = scheme.world === 'land' ? landscape(e, portal) : paintWorld(scheme.world, 512);
        ctx.save();
        ctx.beginPath();
        ctx.arc(portal.x, portal.y, R, 0, TAU);
        ctx.clip();
        const s = R * 2.4;
        const sw = world.width >= world.height ? s * (world.width / world.height) : s;
        const sh = world.width >= world.height ? s : s * (world.height / world.width);
        ctx.drawImage(world, portal.x - sw / 2 + Math.sin(e.t * 0.3) * R * 0.05, portal.y - sh / 2, sw, sh);
        // Edge shading for depth.
        const shade = ctx.createRadialGradient(portal.x, portal.y, R * 0.6, portal.x, portal.y, R);
        shade.addColorStop(0, 'rgba(0,0,0,0)');
        shade.addColorStop(1, 'rgba(0,0,0,0.55)');
        ctx.fillStyle = shade;
        ctx.fillRect(portal.x - R, portal.y - R, R * 2, R * 2);
        ctx.restore();
        // Glowing rim.
        ctx.globalCompositeOperation = 'lighter';
        const f = 0.85 + 0.15 * noise1(e.t * 12);
        for (const [w, a] of [
          [14, 0.15],
          [6, 0.45],
          [2.2, 1],
        ]) {
          ctx.strokeStyle = `rgba(${scheme.rgb.map((v) => Math.min(255, v + (a > 0.9 ? 100 : 0))).join(',')},${a * f})`;
          ctx.lineWidth = w * e.unit;
          ctx.beginPath();
          ctx.arc(portal.x, portal.y, R, 0, TAU);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      // The glowing path drawn by the finger.
      if (trail.length > 1) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const [w, a] of [
          [10, 0.12],
          [3, 0.8],
        ]) {
          ctx.strokeStyle = `rgba(${scheme.rgb.join(',')},${a})`;
          ctx.lineWidth = w * e.unit;
          ctx.beginPath();
          trail.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.stroke();
        }
        const tip = trail[trail.length - 1];
        drawGlow(ctx, scheme.rgb, tip.x, tip.y, 26 * e.unit, 0.9);
        ctx.globalCompositeOperation = 'source-over';
      }
      sparks.draw(ctx);
    },
  };
}

const easeOut = (t) => 1 - (1 - t) ** 3;

// Your own landscape, printed in the portal the moment it opens: the learned
// background (you are not in it), seen from elsewhere: the other side of the
// room, flipped, a little closer, with a touch of the portal's colour.
function landscape(e, portal) {
  const src = e.plate?.learned > 0.3 ? e.backgroundPlate() : e.segActive ? e.layers.frame : null;
  const w = 640;
  const h = Math.round((w * e.H) / e.W);
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const zoom = 1.5;
  // Look at the half of the scene away from the portal.
  const fx = portal.x < e.W / 2 ? 0.68 : 0.32;
  const sw = e.W / zoom;
  const sh = e.H / zoom;
  const sx = Math.max(0, Math.min(e.W - sw, fx * e.W - sw / 2));
  const sy = (e.H - sh) / 2;
  g.translate(w, 0);
  g.scale(-1, 1);
  if (src) g.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
  else if (e.src?.source) g.drawImage(e.src.source, 0, 0, w, h);
  g.setTransform(1, 0, 0, 1, 0, 0);
  // Slight depth haze, like looking far away.
  const haze = g.createLinearGradient(0, 0, 0, h);
  haze.addColorStop(0, 'rgba(255,240,220,0.18)');
  haze.addColorStop(1, 'rgba(0,0,0,0.1)');
  g.fillStyle = haze;
  g.fillRect(0, 0, w, h);
  return c;
}

// A circle is recognised either when the fingertip comes back close to its
// path (even between two sparse points of a fast move), or when the path has
// turned almost all the way around its centre. Rough circles are fine.
function closedLoop(trail, size, now) {
  if (trail.length < 8) return null;
  const tip = trail[trail.length - 1];
  const fit = (pts) => {
    const x = pts.reduce((s, q) => s + q.x, 0) / pts.length;
    const y = pts.reduce((s, q) => s + q.y, 0) / pts.length;
    const r = pts.reduce((s, q) => s + Math.hypot(q.x - x, q.y - y), 0) / pts.length;
    return { x, y, r };
  };
  // 1) The tip crosses back over an older part of the path.
  let length = 0;
  for (let i = 1; i < trail.length; i++) length += Math.hypot(trail[i].x - trail[i - 1].x, trail[i].y - trail[i - 1].y);
  if (length > size * 3.5) {
    for (let i = 1; i < trail.length - 4; i++) {
      const a = trail[i - 1];
      const b = trail[i];
      if (now - b.t < 0.25) break;
      if (segDist(tip, a, b) < size * 0.9) {
        const c = fit(trail.slice(i));
        if (c.r > size * 0.6) return c;
        break;
      }
    }
  }
  // 2) The path winds ~300° around its centre.
  const c = fit(trail);
  if (c.r < size * 0.6) return null;
  let turn = 0;
  for (let i = 1; i < trail.length; i++) {
    let d = Math.atan2(trail[i].y - c.y, trail[i].x - c.x) - Math.atan2(trail[i - 1].y - c.y, trail[i - 1].x - c.x);
    d = Math.atan2(Math.sin(d), Math.cos(d));
    turn += d;
  }
  return Math.abs(turn) > 5.2 ? c : null;
}

function segDist(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}
