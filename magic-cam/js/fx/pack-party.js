// Party pack: colourful lights for dance and music videos.
//   Disco          coloured spotlights sweeping the room and a mirror ball;
//                  raise a hand to drop the beat (flash), fist = black light
//   Contour néon   your outline glows in moving rainbow colours
import { Particles, drawGlow, rand, TAU, clamp } from './util.js';

const PARTY = [
  [255, 60, 120],
  [255, 170, 40],
  [60, 220, 255],
  [170, 80, 255],
  [80, 255, 140],
];

// ---------- Disco ----------
export function discoEffect() {
  let spots = [];
  let dots = [];
  let beat = 0;
  let cool = 0;
  let dark = 0;

  return {
    id: 'disco',
    name: 'Disco',
    hint: 'Les projecteurs balaient la pièce et la boule à facettes tourne. Lève une main vite pour faire tomber le beat (flash). Poing : lumière noire. Mets une musique (bouton ♪) : tout pulse au rythme.',
    needs: { seg: false },
    start() {
      spots = PARTY.map((rgb, i) => ({ rgb, ph: (i / PARTY.length) * TAU, sp: rand(0.6, 1.1) }));
      dots = Array.from({ length: 70 }, () => ({
        a: rand(TAU),
        r: rand(0.15, 0.75),
        rgb: PARTY[(Math.random() * PARTY.length) | 0],
        s: rand(2, 5),
      }));
    },
    update(dt, hands, e) {
      if (!spots.length) this.start();
      cool -= dt;
      beat = Math.max(0, beat - dt * 3);
      const live = hands.filter((h) => h.presence > 0.5);
      if (cool <= 0 && live.some((h) => h.vel.y < -Math.min(e.W, e.H) * 1.6)) {
        beat = 1;
        cool = 0.35;
        e.punch?.(0.03);
        e.audio.play('boom', 0.5);
      }
      dark += ((live.some((h) => h.fist) ? 1 : 0) - dark) * Math.min(1, dt * 4);
    },
    // A pulse on each drum hit of the background music.
    onBeat(e, strength) {
      beat = Math.max(beat, 0.6 * strength);
    },
    draw(ctx, e) {
      const { W, H, t } = e;
      ctx.save();
      // Room darkened so the lights stand out (more with black light).
      ctx.fillStyle = `rgba(5,0,20,${0.35 + dark * 0.35})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      // Spotlights from the ceiling, sweeping.
      for (const s of spots) {
        const x = W * (0.5 + 0.45 * Math.sin(t * s.sp + s.ph));
        const ang = Math.sin(t * s.sp * 1.3 + s.ph) * 0.5;
        const len = H * 1.3;
        const tx = x + Math.sin(ang) * len;
        const ty = Math.cos(ang) * len;
        const g = ctx.createLinearGradient(x, 0, tx, ty);
        const a = (0.22 + beat * 0.3) * (1 - dark * 0.6);
        g.addColorStop(0, `rgba(${s.rgb.join(',')},${a})`);
        g.addColorStop(1, `rgba(${s.rgb.join(',')},0)`);
        ctx.fillStyle = g;
        const w = W * 0.12;
        ctx.beginPath();
        ctx.moveTo(x - 6, 0);
        ctx.lineTo(x + 6, 0);
        ctx.lineTo(tx + Math.cos(ang) * w, ty - Math.sin(ang) * w);
        ctx.lineTo(tx - Math.cos(ang) * w, ty + Math.sin(ang) * w);
        ctx.closePath();
        ctx.fill();
      }
      // Mirror ball at the top and its dots of light turning over everything.
      const bx = W / 2;
      const by = H * 0.08;
      const br = Math.min(W, H) * 0.06;
      const ball = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.3, 1, bx, by, br);
      ball.addColorStop(0, '#ffffff');
      ball.addColorStop(1, '#6a6a80');
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = ball;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      for (const d of dots) {
        const a = d.a + t * 0.4;
        const x = W / 2 + Math.cos(a) * W * d.r;
        const y = H * 0.5 + Math.sin(a * 1.3) * H * d.r * 0.6;
        drawGlow(ctx, d.rgb, x, y, d.s * e.unit * (2 + beat * 2), 0.7, 0.5);
      }
      drawGlow(ctx, [255, 255, 255], bx, by, br * (2 + beat * 2), 0.5 + beat * 0.4, 0.2);
      if (beat > 0.05) {
        ctx.fillStyle = `rgba(255,255,255,${beat * 0.12})`;
        ctx.fillRect(0, 0, W, H);
      }
      // Black light: whites glow violet.
      if (dark > 0.05) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = `rgba(120,40,255,${dark * 0.6})`;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
    },
  };
}

// ---------- Contour néon ----------
export function neonOutlineEffect() {
  const COLORS = [
    { name: 'Arc-en-ciel', rgb: null },
    { name: 'Rose', rgb: [255, 60, 160] },
    { name: 'Cyan', rgb: [60, 230, 255] },
  ];
  let scheme = COLORS[0];
  let pulse = 0;

  return {
    id: 'neonline',
    name: 'Contour néon',
    hint: 'Ton contour brille en néon, les couleurs défilent sur toi. Claque des doigts ou serre puis ouvre la main : flash de néon.',
    colors: COLORS,
    needs: { seg: true },
    setColor(i) {
      scheme = COLORS[i];
    },
    update(dt, hands, e) {
      pulse = Math.max(0, pulse - dt * 2);
      if (hands.some((h) => h.presence > 0.5 && (h.events.snap || h.events.release))) {
        pulse = 1;
        e.audio.play('chime', 0.5);
      }
    },
    draw(ctx, e) {
      const edges = e.seg?.present ? e.seg.edges : null;
      if (!edges?.length) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const r = (4.5 + pulse * 3) * e.unit;
      // Edge points grouped in colour bands by height, moving down over
      // time (one path per band: fast).
      const bands = 6;
      const groups = Array.from({ length: bands }, () => []);
      for (const p of edges) groups[(((p.y / e.H) * bands + e.t * 1.5) | 0) % bands].push(p);
      groups.forEach((pts, b) => {
        const rgb = scheme.rgb || hsl((b * 360) / bands);
        for (const [w, a] of [
          [r * 2.6, 0.14],
          [r, 0.9],
        ]) {
          ctx.fillStyle = `rgba(${rgb.join(',')},${clamp(a + pulse * 0.2)})`;
          ctx.beginPath();
          for (const p of pts) {
            ctx.moveTo(p.x + w, p.y);
            ctx.arc(p.x, p.y, w, 0, TAU);
          }
          ctx.fill();
        }
      });
      ctx.restore();
    },
  };
}

function hsl(h) {
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

// ---------- Écran brisé ----------
// Punch towards the camera (a fist that comes closer fast) or a fast punch:
// the screen cracks like glass where you hit, then the cracks fade.
export function glassEffect() {
  let cracks = [];
  const sizes = new Map();
  let cool = 0;

  const crack = (e, x, y) => {
    const R = Math.max(e.W, e.H) * rand(0.35, 0.6);
    const rays = [];
    const n = 9 + ((Math.random() * 5) | 0);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.2, 0.2);
      const pts = [[x, y]];
      let r = 0;
      let ang = a;
      while (r < R) {
        r += rand(0.06, 0.14) * R;
        ang += rand(-0.35, 0.35);
        const off = rand(-0.04, 0.04) * r;
        pts.push([x + Math.cos(a) * r - Math.sin(a) * off, y + Math.sin(a) * r + Math.cos(a) * off]);
      }
      rays.push(pts);
    }
    // Short broken links between neighbouring rays (not full rings), more
    // of them near the impact, like real cracked glass.
    const links = [];
    for (let i = 0; i < rays.length; i++) {
      const a = rays[i];
      const b = rays[(i + 1) % rays.length];
      const count = 1 + ((Math.random() * 3) | 0);
      for (let k = 0; k < count; k++) {
        const ja = Math.min(a.length - 1, 1 + ((Math.random() ** 2 * (a.length - 1)) | 0));
        const jb = Math.min(b.length - 1, Math.max(1, ja + ((Math.random() * 3) | 0) - 1));
        const mid = [(a[ja][0] + b[jb][0]) / 2 + rand(-8, 8), (a[ja][1] + b[jb][1]) / 2 + rand(-8, 8)];
        links.push([a[ja], mid, b[jb]]);
      }
    }
    cracks.push({ x, y, rays, links, t: 0 });
    if (cracks.length > 4) cracks.shift();
    e.flash([255, 255, 255], 0.35, 6);
    e.shake(18);
    e.audio.play('crack', 1);
    e.audio.play('boom', 0.4);
  };

  return {
    id: 'glass',
    name: 'Écran brisé',
    hint: 'Donne un coup de poing vers la caméra : l’écran se fissure comme du verre, là où tu frappes. Les fissures disparaissent au bout de quelques secondes.',
    needs: { seg: false },
    start() {
      cracks = [];
    },
    trigger(e) {
      crack(e, e.W / 2, e.H / 2);
    },
    update(dt, hands, e) {
      cool -= dt;
      for (const c of cracks) c.t += dt;
      cracks = cracks.filter((c) => c.t < 5);
      for (const h of hands) {
        if (h.presence < 0.5) continue;
        const prev = sizes.get(h.id) ?? h.size;
        sizes.set(h.id, h.size);
        const towards = (h.size - prev) / dt > h.size * 1.6;
        const fast = h.speed > Math.min(e.W, e.H) * 2.2;
        if (h.fist && (towards || fast) && cool <= 0) {
          cool = 0.5;
          crack(e, h.palm.x, h.palm.y);
        }
      }
    },
    drawOver(ctx, e) {
      for (const c of cracks) {
        const a = c.t < 4 ? 1 : 1 - (c.t - 4);
        ctx.save();
        ctx.lineJoin = 'round';
        // Dark edge then bright line: looks like a real crack in glass.
        for (const [w, col] of [
          [3.2, `rgba(0,0,0,${0.35 * a})`],
          [1.3, `rgba(255,255,255,${0.9 * a})`],
        ]) {
          ctx.strokeStyle = col;
          ctx.lineWidth = w * e.unit;
          ctx.beginPath();
          for (const p of c.rays) {
            ctx.moveTo(p[0][0], p[0][1]);
            for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
          }
          for (const [p, m, q] of c.links) {
            ctx.moveTo(p[0], p[1]);
            ctx.lineTo(m[0], m[1]);
            ctx.lineTo(q[0], q[1]);
          }
          ctx.stroke();
        }
        // Crushed glass at the impact.
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, [220, 240, 255], c.x, c.y, Math.min(e.W, e.H) * 0.08, 0.6 * a, 0.3);
        ctx.restore();
      }
    },
  };
}

// ---------- Attrape-étoiles ----------
// Golden stars fall slowly; touch one with an open hand and it bursts into
// sparkles with a little chime.
export function starCatchEffect() {
  let stars = [];
  const burst = new Particles(600);

  return {
    id: 'starcatch',
    name: 'Attrape-étoiles',
    hint: 'Des étoiles tombent doucement : attrape-les avec la main ouverte, elles éclatent en paillettes.',
    needs: { seg: false },
    start() {
      stars = [];
      burst.clear();
    },
    update(dt, hands, e) {
      burst.update(dt);
      while (stars.length < 7)
        stars.push({
          x: rand(0.08, 0.92) * e.W,
          y: -rand(0, e.H * 0.6),
          v: rand(60, 140) * e.unit,
          r: rand(14, 22) * e.unit,
          spin: rand(TAU),
          rgb: PARTY[(Math.random() * PARTY.length) | 0],
        });
      const L = hands.filter((h) => h.presence > 0.5 && (h.open || h.gesture === 'relaxed'));
      for (const s of stars) {
        s.y += s.v * dt;
        s.x += Math.sin(e.t + s.spin) * 20 * e.unit * dt;
        s.spin += dt * 1.5;
        const caught = L.some((h) => Math.hypot(h.palm.x - s.x, h.palm.y - s.y) < h.size * 1.1 + s.r);
        if (caught) {
          for (let i = 0; i < 40; i++) {
            const a = rand(TAU);
            const v = rand(100, 500) * e.unit;
            burst.add({
              x: s.x,
              y: s.y,
              vx: Math.cos(a) * v,
              vy: Math.sin(a) * v,
              drag: 2,
              g: 300 * e.unit,
              life: rand(0.4, 0.9),
              size: rand(2, 5) * e.unit,
              rgb: s.rgb,
              core: 0.6,
            });
          }
          e.audio.play('chime', 0.5);
          s.y = e.H + 999;
        }
      }
      stars = stars.filter((s) => s.y < e.H + s.r);
    },
    draw(ctx, e) {
      burst.draw(ctx);
      ctx.save();
      for (const s of stars) {
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, s.rgb, s.x, s.y, s.r * 2.6, 0.5, 0.2);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#fff6c8';
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = s.spin + (k * Math.PI) / 5 - Math.PI / 2;
          const rr = k % 2 ? s.r * 0.45 : s.r;
          ctx.lineTo(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    },
  };
}

// ---------- Projecteur ----------
// The room goes dark and a stage spotlight follows you (your face, or your
// body), with dust shining in its beam. Raise a hand: the light turns pink.
export function spotlightEffect() {
  let x = null;
  let y = 0;
  let pink = 0;
  const dust = new Particles(120);

  return {
    id: 'spotlight',
    name: 'Projecteur',
    hint: 'La pièce s’assombrit et un projecteur de scène te suit. Lève une main pour qu’il devienne rose.',
    needs: { seg: false, pose: true },
    start() {
      x = null;
      dust.clear();
    },
    update(dt, hands, e) {
      dust.update(dt);
      const b = e.body?.points;
      let tx = e.W / 2;
      let ty = e.H * 0.45;
      if (b && e.body.presence > 0.3 && b[0].v > 0.5) {
        tx = b[0].x;
        ty = b[0].y + e.H * 0.12;
      }
      if (x === null) {
        x = tx;
        y = ty;
      }
      x += (tx - x) * Math.min(1, dt * 4);
      y += (ty - y) * Math.min(1, dt * 4);
      const up = hands.some((h) => h.presence > 0.5 && h.palm.y < e.H * 0.3);
      pink += ((up ? 1 : 0) - pink) * Math.min(1, dt * 3);
      if (Math.random() < 0.5)
        dust.add({
          x: x + rand(-1, 1) * e.W * 0.15,
          y: rand(0, e.H),
          vx: rand(-8, 8),
          vy: rand(-12, 12),
          life: rand(1.5, 3),
          size: rand(1, 2.5) * e.unit,
          rgb: [255, 245, 220],
          core: 0.6,
          alpha: 0.6,
          fadeIn: 0.3,
        });
    },
    draw(ctx, e) {
      if (x === null) return;
      const R = Math.min(e.W, e.H) * 0.42;
      ctx.save();
      // Darkness everywhere except a soft circle around you.
      const g = ctx.createRadialGradient(x, y, R * 0.55, x, y, R * 1.35);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.82)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, e.W, e.H);
      // The beam from above.
      const col = [255, Math.round(240 - pink * 120), Math.round(210 - pink * 30)];
      ctx.globalCompositeOperation = 'lighter';
      const beam = ctx.createLinearGradient(0, 0, 0, e.H);
      beam.addColorStop(0, `rgba(${col.join(',')},0.22)`);
      beam.addColorStop(0.6, `rgba(${col.join(',')},0.08)`);
      beam.addColorStop(1, `rgba(${col.join(',')},0)`);
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(x - e.W * 0.04, 0);
      ctx.lineTo(x + e.W * 0.04, 0);
      ctx.lineTo(x + R * 1.3, e.H);
      ctx.lineTo(x - R * 1.3, e.H);
      ctx.closePath();
      ctx.fill();
      dust.draw(ctx);
      ctx.restore();
    },
  };
}
