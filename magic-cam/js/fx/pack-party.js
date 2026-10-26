// Party pack: colourful lights for dance and music videos.
//   Disco          coloured spotlights sweeping the room and a mirror ball;
//                  raise a hand to drop the beat (flash), fist = black light
//   Contour néon   your outline glows in moving rainbow colours
import { drawGlow, rand, TAU, clamp } from './util.js';

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
