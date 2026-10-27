// Energy pack 2.
//   Fils d'énergie    glowing strings between the fingertips of your two hands;
//                     pull them apart to stretch, close a fist to snap them
//   Tornade de feu    a spiral of flames turning around your body; raise your
//                     arms (or shout) to make it grow
import { Particles, drawGlow, rand, TAU, clamp, noise1 } from './util.js';

const live = (hands) => hands.filter((h) => h.presence > 0.5);

// ---------- Fils d'énergie ----------
export function stringsEffect() {
  const COLORS = [
    { name: 'Arc-en-ciel', rgb: null },
    { name: 'Cyan', rgb: [80, 220, 255] },
    { name: 'Feu', rgb: [255, 140, 50] },
  ];
  const RAINBOW = [
    [255, 80, 80],
    [255, 180, 60],
    [120, 255, 120],
    [80, 200, 255],
    [190, 110, 255],
  ];
  let scheme = COLORS[0];
  const sparks = new Particles(400);
  let snapped = 0;

  return {
    id: 'strings',
    name: 'Fils d’énergie',
    hint: 'Montre tes deux mains ouvertes, face à face : des fils d’énergie relient tes doigts. Écarte-les pour les tendre. Ferme un poing pour les casser d’un coup.',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      scheme = COLORS[i];
    },
    start() {
      sparks.clear();
      snapped = 0;
    },
    update(dt, hands, e) {
      sparks.update(dt);
      snapped = Math.max(0, snapped - dt);
      const L = live(hands);
      if (L.length < 2) return;
      const [a, b] = L;
      if ((a.events.fist || b.events.fist) && snapped <= 0) {
        // The strings break: sparks fly from every one of them.
        for (let f = 0; f < 5; f++) {
          const p = a.tips[f];
          const q = b.tips[f];
          for (let i = 0; i < 20; i++) {
            const t = Math.random();
            const ang = rand(TAU);
            const v = rand(150, 600) * e.unit;
            sparks.add({
              x: p.x + (q.x - p.x) * t,
              y: p.y + (q.y - p.y) * t,
              vx: Math.cos(ang) * v,
              vy: Math.sin(ang) * v,
              drag: 2,
              life: rand(0.3, 0.8),
              size: rand(2, 5) * e.unit,
              rgb: scheme.rgb || RAINBOW[f],
              core: 0.5,
            });
          }
        }
        snapped = 1;
        e.shake(10);
        e.audio.play('zap', 0.8);
      }
      const d = Math.hypot(a.palm.x - b.palm.x, a.palm.y - b.palm.y);
      e.audio.loop('buzz', snapped > 0 ? 0 : clamp(d / e.W) * 0.3);
    },
    draw(ctx, e) {
      sparks.draw(ctx);
      const L = live(e.hands);
      if (L.length < 2 || snapped > 0 || L[0].fist || L[1].fist) return;
      const [a, b] = L;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      const d = Math.hypot(a.palm.x - b.palm.x, a.palm.y - b.palm.y);
      // Further apart: thinner and shakier strings.
      const tension = clamp(d / (e.W * 0.8));
      for (let f = 0; f < 5; f++) {
        const p = a.tips[f];
        const q = b.tips[f];
        const rgb = scheme.rgb || RAINBOW[f];
        const sag = (1 - tension) * e.H * 0.06;
        const wob = noise1(e.t * 8 + f) * 10 * e.unit * (0.3 + tension);
        const mx = (p.x + q.x) / 2 + wob;
        const my = (p.y + q.y) / 2 + sag;
        for (const [w, al] of [
          [10, 0.12],
          [4, 0.4],
          [1.6, 1],
        ]) {
          ctx.strokeStyle = al === 1 ? `rgba(255,255,255,0.9)` : `rgba(${rgb.join(',')},${al})`;
          ctx.lineWidth = w * e.unit * (1.2 - tension * 0.6);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.quadraticCurveTo(mx, my, q.x, q.y);
          ctx.stroke();
        }
        drawGlow(ctx, rgb, p.x, p.y, 14 * e.unit, 0.8, 0.4);
        drawGlow(ctx, rgb, q.x, q.y, 14 * e.unit, 0.8, 0.4);
      }
      ctx.restore();
    },
  };
}

// ---------- Tornade de feu ----------
export function fireTornadoEffect() {
  const COLORS = [
    { name: 'Feu', rgb: null },
    { name: 'Feu bleu', rgb: [80, 160, 255] },
    { name: 'Feu vert', rgb: [90, 255, 130] },
  ];
  let scheme = COLORS[0];
  const fire = new Particles(900);
  // Flames split into back and front, in arrays kept from frame to frame.
  const back = [];
  const front = [];
  let power = 0.4;

  return {
    id: 'firetornado',
    name: 'Tornade de feu',
    hint: 'Une tornade de flammes tourne autour de toi. Lève les bras (ou crie) pour qu’elle grandisse, baisse-les pour la calmer.',
    colors: COLORS,
    needs: { seg: true, pose: true },
    setColor(i) {
      scheme = COLORS[i];
    },
    start() {
      fire.clear();
      power = 0.4;
    },
    update(dt, hands, e) {
      const s = e.seg;
      const L = live(hands);
      // Hands up high (or a shout) feed the tornado.
      const up = L.some((h) => h.palm.y < e.H * 0.35) || (e.voice || 0) > 0.4;
      power = clamp(power + (up ? dt * 0.6 : -dt * 0.25), 0.3, 1);
      fire.update(dt, (p, dt2) => {
        p.a += p.w * dt2;
        p.y -= p.rise * dt2;
        p.x = p.cx + Math.cos(p.a) * p.r;
        p.depth = Math.sin(p.a);
      });
      if (!s?.present) return;
      const cx = s.centroid.x;
      const top = s.top;
      const width = Math.max(e.W * 0.15, (e.H - top) * 0.35) * (0.8 + power * 0.5);
      const n = Math.round(22 * power);
      for (let i = 0; i < n; i++) {
        const y = rand(top - e.H * 0.1 * power, e.H);
        // Wider at the top, like a tornado.
        const k = 1 - (y - top) / Math.max(1, e.H - top);
        fire.add({
          cx,
          a: rand(TAU),
          w: rand(3, 5),
          r: width * (0.55 + 0.6 * clamp(k)),
          x: cx,
          y,
          rise: rand(60, 200) * e.unit,
          life: rand(0.5, 1),
          size: rand(28, 55) * e.unit * (0.7 + power * 0.5),
          fire: !scheme.rgb,
          rgb: scheme.rgb,
          core: 0.3,
          alpha: 0.7,
          grow: 1.3,
        });
      }
      e.light(cx, (top + e.H) / 2, e.H * 0.6, scheme.rgb || [255, 130, 40], 0.12 + power * 0.15);
      e.audio.loop('fire', 0.2 + power * 0.3);
    },
    // Flames behind you (the far side of the spiral).
    drawBehind(ctx) {
      back.length = 0;
      front.length = 0;
      for (const p of fire.list) (p.depth < 0 ? back : front).push(p);
      const all = fire.list;
      fire.list = back;
      fire.draw(ctx);
      fire.list = all;
      return false;
    },
    // Flames in front of you.
    draw(ctx) {
      const all = fire.list;
      fire.list = front;
      fire.draw(ctx);
      fire.list = all;
    },
  };
}

// ---------- Fouet d'énergie ----------
// A rope of light hangs from your fist and follows it with real physics
// (a chain of points). Whip it fast: the tip cracks with a bang and sparks.
export function whipEffect() {
  const COLORS = [
    { name: 'Électrique', rgb: [110, 200, 255] },
    { name: 'Feu', rgb: [255, 130, 40] },
    { name: 'Rose', rgb: [255, 80, 200] },
  ];
  let rgb = COLORS[0].rgb;
  const N = 26;
  let chain = null; // [{ x, y, px, py }]
  const sparks = new Particles(300);
  let cool = 0;

  return {
    id: 'whip',
    name: 'Fouet d’énergie',
    hint: 'Ferme le poing (ou pointe l’index) : une corde de lumière pend de ta main. Fouette d’un coup sec : le bout claque avec des étincelles.',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      chain = null;
      sparks.clear();
    },
    update(dt, hands, e) {
      sparks.update(dt);
      cool -= dt;
      const h = live(hands).sort((a, b) => b.size - a.size)[0];
      if (!h) return;
      const anchor = h.point ? h.lm[8] : h.palm;
      const seg = Math.min(e.W, e.H) * 0.03;
      if (!chain)
        chain = Array.from({ length: N }, (_, i) => ({ x: anchor.x, y: anchor.y + i * seg, px: anchor.x, py: anchor.y + i * seg }));
      // Verlet: each point keeps its speed, falls, and the links pull together.
      const g = 1500 * e.unit * dt * dt;
      for (let i = 1; i < N; i++) {
        const p = chain[i];
        const vx = (p.x - p.px) * 0.985;
        const vy = (p.y - p.py) * 0.985;
        p.px = p.x;
        p.py = p.y;
        p.x += vx;
        p.y += vy + g;
      }
      chain[0].x = anchor.x;
      chain[0].y = anchor.y;
      for (let k = 0; k < 6; k++)
        for (let i = 1; i < N; i++) {
          const a = chain[i - 1];
          const b = chain[i];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 1;
          const diff = (d - seg) / d;
          if (i === 1) {
            b.x -= dx * diff;
            b.y -= dy * diff;
          } else {
            a.x += dx * diff * 0.5;
            a.y += dy * diff * 0.5;
            b.x -= dx * diff * 0.5;
            b.y -= dy * diff * 0.5;
          }
        }
      // The crack: the tip moving very fast.
      const tip = chain[N - 1];
      const v = Math.hypot(tip.x - tip.px, tip.y - tip.py) / dt;
      if (v > Math.max(e.W, e.H) * 4 && cool <= 0) {
        cool = 0.3;
        for (let i = 0; i < 40; i++) {
          const a = rand(TAU);
          const s = rand(200, 800) * e.unit;
          sparks.add({
            x: tip.x,
            y: tip.y,
            vx: Math.cos(a) * s,
            vy: Math.sin(a) * s,
            drag: 3,
            life: rand(0.2, 0.5),
            size: rand(2, 5) * e.unit,
            rgb,
            core: 0.6,
          });
        }
        e.flash(rgb, 0.15, 6);
        e.shake(6);
        e.audio.play('crack', 0.9);
      }
    },
    draw(ctx, e) {
      sparks.draw(ctx);
      if (!chain || !live(e.hands).length) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const [w, a] of [
        [16, 0.12],
        [6, 0.45],
        [2, 1],
      ]) {
        ctx.strokeStyle = a === 1 ? 'rgba(255,255,255,0.95)' : `rgba(${rgb.join(',')},${a})`;
        ctx.lineWidth = w * e.unit;
        ctx.beginPath();
        ctx.moveTo(chain[0].x, chain[0].y);
        for (let i = 1; i < N - 1; i++) {
          const mx = (chain[i].x + chain[i + 1].x) / 2;
          const my = (chain[i].y + chain[i + 1].y) / 2;
          ctx.quadraticCurveTo(chain[i].x, chain[i].y, mx, my);
        }
        ctx.lineTo(chain[N - 1].x, chain[N - 1].y);
        ctx.stroke();
      }
      const tip = chain[N - 1];
      drawGlow(ctx, rgb, tip.x, tip.y, 16 * e.unit, 0.9, 0.5);
      ctx.restore();
    },
  };
}
