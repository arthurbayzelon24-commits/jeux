// Waterbending: a ribbon of water follows your index fingertip through the
// air, splashing droplets when you move fast; an open hand holds a swirling
// water orb above the palm.
import { Particles, drawGlow, rand, TAU, noise1, clamp } from './util.js';

const COLORS = [
  { name: 'Océan', rgb: [60, 160, 255], hi: [200, 240, 255] },
  { name: 'Lagon', rgb: [40, 220, 200], hi: [210, 255, 245] },
  { name: 'Eau sombre', rgb: [40, 90, 200], hi: [160, 200, 255] },
];

export function waterEffect() {
  const drops = new Particles(500);
  const trails = new Map();
  const orbs = new Map();
  let scheme = COLORS[0];

  const ribbon = (ctx, pts, width, e) => {
    if (pts.length < 3) return;
    const [r, g, b] = scheme.rgb;
    // Several passes from wide translucent to thin highlight.
    for (const [k, color] of [
      [1.6, `rgba(${r},${g},${b},0.18)`],
      [1, `rgba(${r},${g},${b},0.55)`],
      [0.45, `rgba(${scheme.hi.join(',')},0.75)`],
      [0.12, 'rgba(255,255,255,0.9)'],
    ]) {
      for (let i = 1; i < pts.length; i++) {
        const t = i / pts.length;
        ctx.strokeStyle = color;
        ctx.lineWidth = width * k * t * (0.8 + 0.2 * noise1(i * 0.5 + e.t * 6));
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
    }
  };

  return {
    id: 'water',
    name: 'Maîtrise de l’eau',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      scheme = COLORS[i];
    },
    start() {
      drops.clear();
      trails.clear();
      orbs.clear();
    },
    update(dt, hands, e) {
      drops.update(dt);
      for (const h of hands) {
        if (h.presence < 0.3) continue;
        const tip = h.lm[8];
        const tr = trails.get(h.id) || [];
        trails.set(h.id, tr);
        const last = tr[tr.length - 1];
        // Smooth trailing: each point eases towards the next.
        tr.push({ x: tip.x, y: tip.y, t: e.t });
        for (let i = tr.length - 2; i >= 0; i--) {
          tr[i].x += (tr[i + 1].x - tr[i].x) * 0.15;
          tr[i].y += (tr[i + 1].y - tr[i].y) * 0.15;
        }
        while (tr.length > 28) tr.shift();
        const speed = last ? Math.hypot(tip.x - last.x, tip.y - last.y) / dt : 0;
        if (speed > e.W * 0.8)
          for (let i = 0; i < 3; i++)
            drops.add({
              x: tip.x,
              y: tip.y,
              vx: ((tip.x - last.x) / dt) * 0.4 + rand(-80, 80),
              vy: ((tip.y - last.y) / dt) * 0.4 + rand(-80, 40),
              g: 1400 * e.unit,
              life: rand(0.5, 0.9),
              size: rand(2, 5) * e.unit,
              rgb: scheme.hi,
              core: 0.6,
            });
        if (speed > e.W * 1.5 && Math.random() < 0.1) e.audio.play('drop', 0.4);
        const o = orbs.get(h.id) || { g: 0 };
        orbs.set(h.id, o);
        o.g = clamp(o.g + ((h.open || h.gesture === 'relaxed') && h.presence > 0.5 ? dt * 1.5 : -dt * 3));
        o.x = h.palm.x;
        o.y = h.palm.y - h.size * 1.1;
        o.r = h.size * 0.6 * o.g;
      }
      for (const id of trails.keys()) if (!hands.some((h) => h.id === id)) trails.delete(id);
    },
    draw(ctx, e) {
      ctx.globalCompositeOperation = 'source-over';
      for (const [id, tr] of trails) {
        const h = e.hands.find((x) => x.id === id);
        if (h) ribbon(ctx, tr, h.size * 0.5, e);
      }
      for (const o of orbs.values()) {
        if (o.g < 0.02) continue;
        const R = o.r;
        const grad = ctx.createRadialGradient(o.x - R * 0.3, o.y - R * 0.3, R * 0.1, o.x, o.y, R);
        grad.addColorStop(0, `rgba(${scheme.hi.join(',')},0.85)`);
        grad.addColorStop(0.6, `rgba(${scheme.rgb.join(',')},0.55)`);
        grad.addColorStop(1, `rgba(${scheme.rgb.join(',')},0.75)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        // Wobbly water surface.
        for (let i = 0; i <= 40; i++) {
          const a = (i / 40) * TAU;
          const rr = R * (1 + 0.06 * noise1(a * 3 + e.t * 4));
          const x = o.x + Math.cos(a) * rr;
          const y = o.y + Math.sin(a) * rr;
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2 * e.unit;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.ellipse(o.x, o.y, R * 0.8, R * (0.2 + k * 0.15), e.t * (1.5 + k) + k, 0.3, 2.4);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, scheme.rgb, o.x, o.y, R * 2, 0.25);
        ctx.globalCompositeOperation = 'source-over';
      }
      drops.draw(ctx);
    },
  };
}
