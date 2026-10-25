// Sorcerer portal: draw a circle in the air with your index finger, leaving a
// trail of sparks. When the loop closes, a spark-ringed portal to another
// world opens there. Draw a new circle to move it.
import { Particles, drawGlow, rand, TAU, noise1, makeCanvas } from './util.js';

const COLORS = [
  { name: 'Étincelles', rgb: [255, 150, 40], world: 'dusk' },
  { name: 'Émeraude', rgb: [80, 255, 140], world: 'aurora' },
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
    needs: { seg: false },
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
      const h = hands.find((x) => x.presence > 0.5 && x.visible && x.fingers.index);
      if (h) {
        const tip = h.lm[8];
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
        // Loop closed? The tip comes back near where it was a moment ago.
        if (trail.length > 20) {
          let length = 0;
          for (let i = 1; i < trail.length; i++) length += Math.hypot(trail[i].x - trail[i - 1].x, trail[i].y - trail[i - 1].y);
          for (let i = 0; i < trail.length - 12; i++) {
            const p = trail[i];
            if (now - p.t < 0.4) break;
            if (Math.hypot(p.x - tip.x, p.y - tip.y) < h.size * 0.6 && length > h.size * 5) {
              const loop = trail.slice(i);
              const cx = loop.reduce((s, q) => s + q.x, 0) / loop.length;
              const cy = loop.reduce((s, q) => s + q.y, 0) / loop.length;
              const r = loop.reduce((s, q) => s + Math.hypot(q.x - cx, q.y - cy), 0) / loop.length;
              if (r > h.size * 0.8) {
                portal = { x: cx, y: cy, r: Math.max(r, h.size * 1.4), open: 0, spin: 0 };
                e.audio.play('teleport', 0.9);
                e.flash(scheme.rgb, 0.25, 3);
                trail = [];
              }
              break;
            }
          }
        }
      }
      trail = trail.filter((p) => now - p.t < 2.6);

      if (portal) {
        portal.open = Math.min(1, portal.open + dt * 1.8);
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
        if (!world) world = paintWorld(scheme.world, 512);
        ctx.save();
        ctx.beginPath();
        ctx.arc(portal.x, portal.y, R, 0, TAU);
        ctx.clip();
        const s = R * 2.4;
        ctx.drawImage(world, portal.x - s / 2 + Math.sin(e.t * 0.3) * R * 0.05, portal.y - s / 2, s, s);
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
