// Weather pack: the elements touch you for real. They use the silhouette
// found by the AI, so the rain runs off you and the snow settles on you.
//   Pluie magique     rain that splashes on you; an open hand is an umbrella
//   Neige qui tombe   snow that settles on your head and shoulders
//   Corps électrifié  electric arcs crawling over your outline
import { Particles, drawGlow, rand, TAU, clamp, makeBolt, strokeBolts } from './util.js';

// Is the point (canvas pixels) on you? Uses the person mask.
function onBody(e, x, y) {
  const s = e.seg;
  if (!s?.present || !s.alpha) return false;
  const mx = (x / s.kx) | 0;
  const my = (y / s.ky) | 0;
  if (mx < 0 || my < 0 || mx >= s.mw || my >= s.mh) return false;
  return s.alpha[my * s.mw + mx] > 0.5;
}

const live = (hands) => hands.filter((h) => h.presence > 0.5);

// ---------- Pluie magique ----------
export function rainEffect() {
  const COLORS = [
    { name: 'Pluie', rgb: [170, 200, 255] },
    { name: 'Pluie néon', rgb: [80, 255, 220] },
    { name: 'Pluie dorée', rgb: [255, 210, 110] },
  ];
  let rgb = COLORS[0].rgb;
  let drops = [];
  const splash = new Particles(500);
  let flash = 0;

  return {
    id: 'rain',
    name: 'Pluie magique',
    hint: 'La pluie tombe et rebondit sur toi. Lève une main ouverte au-dessus de ta tête : elle te protège comme un parapluie. Ferme le poing pour un coup de tonnerre.',
    colors: COLORS,
    needs: { seg: true },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      drops = [];
      splash.clear();
    },
    update(dt, hands, e) {
      splash.update(dt);
      flash = Math.max(0, flash - dt * 3);
      const want = Math.round(260 * clamp(e.W / 900, 0.5, 1.5));
      while (drops.length < want) drops.push({ x: rand(-0.1, 1.1) * e.W, y: rand(-e.H, 0), v: rand(0.9, 1.3) });
      const L = live(hands);
      const umbrellas = L.filter((h) => h.open).map((h) => ({ x: h.palm.x, y: h.palm.y - h.size * 0.6, r: h.size * 2.2 }));
      if (L.some((h) => h.events.fist)) {
        flash = 1;
        e.flash([200, 220, 255], 0.6, 4);
        e.shake(12);
        e.audio.play('thunder', 0.8);
      }
      const speed = 1500 * e.unit;
      for (const d of drops) {
        const px = d.x;
        const py = d.y;
        d.y += speed * d.v * dt;
        d.x += speed * 0.12 * d.v * dt;
        let hit = d.y > e.H;
        // Umbrella: the drops slide off the top of the open hand.
        for (const u of umbrellas)
          if (Math.hypot(d.x - u.x, d.y - u.y) < u.r && d.y < u.y) {
            hit = true;
            break;
          }
        if (!hit && d.y > 0 && onBody(e, d.x, d.y)) hit = true;
        if (hit) {
          for (let i = 0; i < 3; i++)
            splash.add({
              x: px,
              y: py,
              vx: rand(-160, 160) * e.unit,
              vy: -rand(80, 260) * e.unit,
              g: 1200 * e.unit,
              life: rand(0.2, 0.4),
              size: rand(1.5, 3) * e.unit,
              rgb,
              core: 0.6,
            });
          d.x = rand(-0.1, 1.1) * e.W;
          d.y = rand(-0.3, 0) * e.H;
        }
      }
      e.audio.loop('wind', 0.25);
    },
    draw(ctx, e) {
      // Darker, wet sky.
      ctx.fillStyle = `rgba(10,20,40,${0.18 + flash * 0.1})`;
      ctx.fillRect(0, 0, e.W, e.H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${rgb.join(',')},0.55)`;
      ctx.lineWidth = 1.6 * e.unit;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const len = 26 * e.unit;
      for (const d of drops) {
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - len * 0.12 * d.v, d.y - len * d.v);
      }
      ctx.stroke();
      splash.draw(ctx);
      // The magic umbrella over each open hand.
      for (const h of live(e.hands))
        if (h.open) {
          const r = h.size * 2.2;
          const y = h.palm.y - h.size * 0.6;
          ctx.strokeStyle = `rgba(${rgb.join(',')},0.7)`;
          ctx.lineWidth = 3 * e.unit;
          ctx.beginPath();
          ctx.arc(h.palm.x, y, r, Math.PI * 1.1, Math.PI * 1.9);
          ctx.stroke();
          drawGlow(ctx, rgb, h.palm.x, y - r * 0.5, r, 0.15, 0.1);
        }
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

// ---------- Neige qui tombe ----------
export function snowfallEffect() {
  const COLORS = [
    { name: 'Neige', rgb: [240, 248, 255] },
    { name: 'Neige rose', rgb: [255, 200, 230] },
  ];
  let rgb = COLORS[0].rgb;
  let flakes = [];
  let stuck = [];

  return {
    id: 'snowfall',
    name: 'Neige qui tombe',
    hint: 'Reste immobile : la neige se pose sur ta tête et tes épaules. Secoue-toi (bouge vite) pour la faire tomber. Main ouverte : elle tourbillonne autour.',
    colors: COLORS,
    needs: { seg: true },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      flakes = [];
      stuck = [];
    },
    update(dt, hands, e) {
      const want = Math.round(220 * clamp(e.W / 900, 0.5, 1.5));
      while (flakes.length < want) flakes.push({ x: rand(e.W), y: rand(-e.H, 0), s: rand(2, 5), ph: rand(TAU) });
      const L = live(hands);
      for (const f of flakes) {
        f.y += (40 + f.s * 18) * e.unit * dt;
        f.x += Math.sin(e.t * 1.3 + f.ph) * 30 * e.unit * dt;
        for (const h of L)
          if (h.open) {
            // Whirl around the open hand.
            const dx = f.x - h.palm.x;
            const dy = f.y - h.palm.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d < h.size * 4) {
              f.x += (-dy / d) * 220 * e.unit * dt;
              f.y += (dx / d) * 220 * e.unit * dt;
            }
          }
        let land = f.y > e.H;
        if (!land && onBody(e, f.x, f.y) && !onBody(e, f.x, f.y - 6 * e.unit)) land = true;
        if (land) {
          if (f.y < e.H && stuck.length < 600) stuck.push({ x: f.x, y: f.y, s: f.s, life: 1 });
          f.x = rand(e.W);
          f.y = rand(-0.2, 0) * e.H;
        }
      }
      // Moving fast shakes the snow off; snow that is no longer on you falls.
      const shaking = (e.seg?.motion ?? 0) > 0.6 || L.some((h) => h.speed > Math.max(e.W, e.H) * 1.5);
      for (const p of stuck) {
        if (p.fall || shaking || !onBody(e, p.x, p.y + 3 * e.unit)) p.fall = (p.fall || 0) + dt;
        if (p.fall) {
          p.y += (p.fall * 900 + 60) * e.unit * dt;
          p.life -= dt * 1.2;
        }
      }
      stuck = stuck.filter((p) => p.life > 0 && p.y < e.H + 10);
    },
    draw(ctx, e) {
      ctx.fillStyle = `rgb(${rgb.join(',')})`;
      for (const f of flakes) {
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.s * e.unit * 0.6, 0, TAU);
        ctx.fill();
      }
      // Settled snow: little white clumps.
      for (const p of stuck) {
        ctx.globalAlpha = clamp(p.life);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.s * e.unit * 0.9, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  };
}

// ---------- Corps électrifié ----------
export function electroEffect() {
  const COLORS = [
    { name: 'Bleu', rgb: [110, 190, 255] },
    { name: 'Violet', rgb: [190, 110, 255] },
    { name: 'Jaune', rgb: [255, 230, 90] },
  ];
  let rgb = COLORS[0].rgb;
  let bolts = [];
  let timer = 0;
  let power = 0;
  // makeBolt gives the main bolt and its branches.
  const add = (x1, y1, x2, y2, opts, life, thin = false) => {
    for (const b of makeBolt(x1, y1, x2, y2, opts)) bolts.push({ pts: b.pts, thin: thin || b.thin, life });
  };

  return {
    id: 'electro',
    name: 'Corps électrifié',
    hint: 'Des arcs électriques courent sur ton corps. Serre les poings pour charger : plus d’éclairs. Ouvre les mains d’un coup pour tout relâcher.',
    colors: COLORS,
    needs: { seg: true },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      bolts = [];
      power = 0;
    },
    update(dt, hands, e) {
      const L = live(hands);
      const fists = L.filter((h) => h.fist).length;
      power = clamp(power + (fists ? dt * 0.8 * fists : -dt * 0.5), 0, 1);
      if (L.some((h) => h.events.release) && power > 0.3) {
        // Release: big bolts from the hands to the edges.
        for (const h of L)
          for (let i = 0; i < 4; i++) {
            const a = rand(TAU);
            add(h.palm.x, h.palm.y, h.palm.x + Math.cos(a) * e.W, h.palm.y + Math.sin(a) * e.H, { depth: 6 }, 0.25);
          }
        e.flash(rgb, 0.5, 4);
        e.shake(20);
        e.audio.play('thunder', 0.9);
        power = 0;
      }
      timer -= dt;
      const edges = e.seg?.present ? e.seg.edges : [];
      if (timer <= 0 && edges.length > 4) {
        timer = 0.05;
        const n = 2 + Math.round(power * 6);
        for (let i = 0; i < n; i++) {
          const a = edges[(Math.random() * edges.length) | 0];
          // Jump to another point of the outline not too far away.
          let b = null;
          for (let k = 0; k < 8 && !b; k++) {
            const c = edges[(Math.random() * edges.length) | 0];
            const d = Math.hypot(c.x - a.x, c.y - a.y);
            if (d > e.H * 0.05 && d < e.H * (0.18 + power * 0.25)) b = c;
          }
          if (b) add(a.x, a.y, b.x, b.y, { depth: 5, jag: 0.3, branch: 0.1 }, 0.12);
        }
        for (const h of L)
          if (h.fist || power > 0.5) {
            const tip = h.tips[(Math.random() * 5) | 0];
            const a = rand(TAU);
            const r = h.size * (1 + power * 2);
            add(tip.x, tip.y, tip.x + Math.cos(a) * r, tip.y + Math.sin(a) * r, { depth: 4, branch: 0 }, 0.1, true);
          }
      }
      for (const b of bolts) b.life -= dt;
      bolts = bolts.filter((b) => b.life > 0);
      e.audio.loop('buzz', 0.12 + power * 0.25);
      if (e.seg?.present) e.light(e.seg.centroid.x, e.seg.centroid.y, e.H * 0.6, rgb, 0.08 + power * 0.15);
    },
    draw(ctx, e) {
      if (bolts.length) strokeBolts(ctx, bolts, rgb, 2 * e.unit, 1);
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}
