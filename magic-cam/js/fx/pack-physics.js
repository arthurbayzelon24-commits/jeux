// Physics pack: powers that act on the filmed world itself.
//   Télékinésie réelle  point at a real object, it is lifted out of the image
//   Onde de choc        push the hand: the image ripples like a shock wave
//   Magnétisme          iron filings follow the field between your hands
//   Arrêt du temps      snap (or fist -> open): the world freezes, not you
//   Gravité             balls that fall, bounce on your hands, gravity flips
import { Particles, drawGlow, rand, TAU, clamp, makeCanvas, dist, noise1 } from './util.js';

// The camera image as it is on screen (mirrored like the preview).
function drawCamera(ctx, e, sx = 0, sy = 0, sw = e.W, sh = e.H, dx = 0, dy = 0, dw = e.W, dh = e.H) {
  if (e.segActive && e.layers?.frame) return ctx.drawImage(e.layers.frame, sx, sy, sw, sh, dx, dy, dw, dh);
  const src = e.src?.source;
  if (!src) return;
  // Full frame into a scratch canvas, then the part we want.
  const c = (drawCamera.tmp ||= makeCanvas(2, 2));
  if (c.width !== e.W || c.height !== e.H) {
    c.width = e.W;
    c.height = e.H;
  }
  const g = c.getContext('2d');
  g.save();
  if (e.src.mirror) {
    g.translate(e.W, 0);
    g.scale(-1, 1);
  }
  g.drawImage(src, 0, 0, e.W, e.H);
  g.restore();
  ctx.drawImage(c, sx, sy, sw, sh, dx, dy, dw, dh);
}

const live = (hands) => hands.filter((h) => h.presence > 0.5 && h.visible !== false);
const biggest = (hands) => live(hands).sort((a, b) => b.size - a.size)[0];

// ---------- Télékinésie réelle ----------
// Point your index at something in the room and hold still: the object is cut
// out of the image and floats to your hand. Move it around, throw it with a
// quick swipe (it falls and bounces), or close your fist to crush it.
export function mindGrabEffect() {
  const COLORS = [
    { name: 'Psy violet', rgb: [190, 120, 255] },
    { name: 'Psy bleu', rgb: [90, 190, 255] },
    { name: 'Psy rouge', rgb: [255, 80, 80] },
  ];
  let rgb = COLORS[0].rgb;
  const sparks = new Particles(400);
  let objs = []; // { img, hole, ox, oy, x, y, vx, vy, r, rot, w, held, holeA, shards }
  let aim = null; // { x, y, t }
  let shards = [];

  // Cuts a soft-edged disc of the image, and makes the patch that hides
  // where the object was (blurred surroundings).
  const cut = (e, x, y, r) => {
    const s = Math.ceil(r * 2);
    const img = makeCanvas(s, s);
    const g = img.getContext('2d');
    drawCamera(g, e, x - r, y - r, s, s, 0, 0, s, s);
    const m = g.createRadialGradient(r, r, r * 0.55, r, r, r);
    m.addColorStop(0, 'rgba(0,0,0,1)');
    m.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = m;
    g.fillRect(0, 0, s, s);
    // The hole: a ring of what is around, shrunk to a few pixels and blown up.
    const tiny = makeCanvas(6, 6);
    drawCamera(tiny.getContext('2d'), e, x - r * 1.6, y - r * 1.6, r * 3.2, r * 3.2, 0, 0, 6, 6);
    const hole = makeCanvas(s, s);
    const h = hole.getContext('2d');
    h.imageSmoothingQuality = 'high';
    h.drawImage(tiny, 1, 1, 4, 4, 0, 0, s, s);
    h.globalCompositeOperation = 'destination-in';
    h.fillStyle = m;
    h.fillRect(0, 0, s, s);
    return { img, hole };
  };

  const crush = (e, o) => {
    const n = 4;
    const s = o.img.width / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const a = Math.atan2(j - n / 2 + 0.5, i - n / 2 + 0.5) + rand(-0.4, 0.4);
        const v = rand(300, 900) * e.unit;
        shards.push({
          img: o.img,
          sx: i * s,
          sy: j * s,
          s,
          x: o.x - o.r + (i + 0.5) * s,
          y: o.y - o.r + (j + 0.5) * s,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - 300 * e.unit,
          rot: 0,
          w: rand(-12, 12),
          life: 1.6,
        });
      }
    for (let i = 0; i < 60; i++) {
      const a = rand(TAU);
      sparks.add({
        x: o.x,
        y: o.y,
        vx: Math.cos(a) * rand(200, 700),
        vy: Math.sin(a) * rand(200, 700),
        drag: 2,
        life: rand(0.3, 0.8),
        size: rand(3, 7) * e.unit,
        rgb,
        core: 0.5,
      });
    }
    e.flash(rgb, 0.3, 4);
    e.shake(14);
    e.audio.play('boom', 0.8);
  };

  return {
    id: 'mindgrab',
    name: 'Télékinésie réelle',
    hint: 'Pointe l’index vers un objet et reste immobile : il s’envole vers ta main. Bouge-le, lance-le d’un geste rapide ou serre le poing pour l’écraser.',
    colors: COLORS,
    needs: { seg: true },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      objs = [];
      shards = [];
      aim = null;
      sparks.clear();
    },
    update(dt, hands, e) {
      sparks.update(dt);
      const h = biggest(hands);
      const R = Math.min(e.W, e.H) * 0.11;
      const held = objs.find((o) => o.held);
      // Aiming: the point just beyond the fingertip, held still to grab.
      if (h?.point && !held) {
        const tip = h.lm[8];
        const k = h.lm[7];
        const len = Math.hypot(tip.x - k.x, tip.y - k.y) || 1;
        const p = { x: tip.x + ((tip.x - k.x) / len) * h.size * 0.9, y: tip.y + ((tip.y - k.y) / len) * h.size * 0.9 };
        if (!aim || dist(aim, p) > R * 0.6) aim = { x: p.x, y: p.y, t: 0 };
        else {
          aim.x += (p.x - aim.x) * 0.3;
          aim.y += (p.y - aim.y) * 0.3;
          aim.t += dt;
        }
        if (aim.t > 0.8) {
          const x = clamp(aim.x, R, e.W - R);
          const y = clamp(aim.y, R, e.H - R);
          const { img, hole } = cut(e, x, y, R);
          if (objs.length >= 3) objs.shift();
          objs.push({ img, hole, ox: x, oy: y, x, y, vx: 0, vy: -200 * e.unit, r: R, rot: 0, w: 0, held: true, holeA: 1, lift: 0 });
          aim = null;
          e.audio.play('grab', 0.8);
          e.audio.play('whoosh', 0.5);
        }
      } else aim = null;

      const g = 2000 * e.unit;
      for (const o of objs) {
        o.lift = Math.min(1, o.lift + dt * 2);
        if (o.held && h) {
          // Floats above the hand, on a soft spring.
          const tx = h.palm.x + noise1(e.t * 1.3) * h.size * 0.3;
          const ty = h.palm.y - h.size * 1.8 + noise1(e.t + 9) * h.size * 0.3;
          const k = 90;
          o.vx += ((tx - o.x) * k - o.vx * 2 * Math.sqrt(k) * 0.8) * dt;
          o.vy += ((ty - o.y) * k - o.vy * 2 * Math.sqrt(k) * 0.8) * dt;
          o.w += (noise1(e.t * 0.7) * 0.6 - o.w) * dt;
          if (Math.random() < 0.4)
            sparks.add({
              x: o.x + rand(-o.r, o.r),
              y: o.y + rand(-o.r, o.r),
              vx: rand(-30, 30),
              vy: rand(-90, -30),
              life: rand(0.4, 0.9),
              size: rand(2, 5) * e.unit,
              rgb,
              core: 0.5,
            });
          if (h.fist) {
            crush(e, o);
            o.dead = true;
            continue;
          }
          if (h.speed > Math.min(e.W, e.H) * 1.8 && h.open) {
            o.held = false;
            o.vx = h.vel.x * 1.5;
            o.vy = h.vel.y * 1.5;
            o.w = clamp(h.vel.x / (e.W * 0.15), -14, 14);
            e.audio.play('whoosh', 1);
          }
        } else {
          if (o.held && !h) o.held = false;
          o.vy += g * dt;
          o.vx *= Math.exp(-dt * 0.3);
        }
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        o.rot += o.w * dt;
        // Bounces on the floor and the edges of the image.
        if (o.y > e.H - o.r * 0.8) {
          if (o.vy > 300 * e.unit) e.audio.play('thud', clamp(o.vy / (2500 * e.unit)));
          o.y = e.H - o.r * 0.8;
          o.vy = -Math.abs(o.vy) * 0.45;
          o.vx *= 0.8;
          o.w *= 0.7;
          if (Math.abs(o.vy) < 80 * e.unit) o.vy = 0;
        }
        if (o.x < o.r * 0.8 || o.x > e.W - o.r * 0.8) {
          o.x = clamp(o.x, o.r * 0.8, e.W - o.r * 0.8);
          o.vx *= -0.6;
        }
        // On the floor, point at it again to pick it back up.
        if (!o.held && h?.point && Math.abs(o.vy) < 1 && dist(h.lm[8], o) < o.r * 1.3) {
          o.held = true;
          e.audio.play('grab', 0.6);
        }
      }
      objs = objs.filter((o) => !o.dead);
      for (const s of shards) {
        s.life -= dt;
        s.vy += g * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.rot += s.w * dt;
      }
      shards = shards.filter((s) => s.life > 0 && s.y < e.H + s.s);
      e.audio.loop('hum', held ? 0.35 : 0);
    },
    // The holes left in the room, drawn behind you (you can walk in front).
    drawBehind(ctx) {
      for (const o of objs) {
        ctx.globalAlpha = o.holeA;
        ctx.drawImage(o.hole, o.ox - o.r, o.oy - o.r);
      }
      ctx.globalAlpha = 1;
      return false;
    },
    draw(ctx, e) {
      const h = biggest(e.hands);
      if (aim) {
        const t = clamp(aim.t / 0.8);
        const R = Math.min(e.W, e.H) * 0.11;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(${rgb.join(',')},0.9)`;
        ctx.lineWidth = 3 * e.unit;
        ctx.setLineDash([8 * e.unit, 6 * e.unit]);
        ctx.beginPath();
        ctx.arc(aim.x, aim.y, R * (1.3 - t * 0.3), e.t * 2, e.t * 2 + TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 5 * e.unit;
        ctx.beginPath();
        ctx.arc(aim.x, aim.y, R * 1.05, -Math.PI / 2, -Math.PI / 2 + TAU * t);
        ctx.stroke();
        drawGlow(ctx, rgb, aim.x, aim.y, R * 1.4, 0.25 * t, 0.1);
        ctx.globalCompositeOperation = 'source-over';
      }
      for (const o of objs) {
        // Psychic aura and shadow, then the object itself.
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, rgb, o.x, o.y, o.r * 1.9, (o.held ? 0.6 : 0.25) * o.lift, 0.2);
        ctx.globalCompositeOperation = 'source-over';
        if (o.held && h) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(${rgb.join(',')},0.35)`;
          ctx.lineWidth = 3 * e.unit;
          for (const i of [1, 2, 3]) {
            const tip = h.tips[i];
            ctx.beginPath();
            ctx.moveTo(tip.x, tip.y);
            ctx.quadraticCurveTo((tip.x + o.x) / 2 + noise1(e.t * 3 + i) * h.size, (tip.y + o.y) / 2, o.x, o.y);
            ctx.stroke();
          }
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(o.rot);
        const s = 1 + 0.05 * Math.sin(e.t * 3);
        ctx.drawImage(o.img, -o.r * s, -o.r * s, o.r * 2 * s, o.r * 2 * s);
        ctx.restore();
      }
      for (const sh of shards) {
        ctx.save();
        ctx.globalAlpha = clamp(sh.life);
        ctx.translate(sh.x, sh.y);
        ctx.rotate(sh.rot);
        ctx.drawImage(sh.img, sh.sx, sh.sy, sh.s, sh.s, -sh.s / 2, -sh.s / 2, sh.s, sh.s);
        ctx.restore();
      }
      sparks.draw(ctx);
    },
  };
}

// ---------- Onde de choc ----------
// Fist then open hand, or a quick push towards the camera: a shock wave
// leaves your palm and bends the image as it passes.
export function shockwaveEffect() {
  const COLORS = [
    { name: 'Blanc', rgb: [220, 235, 255] },
    { name: 'Bleu', rgb: [90, 170, 255] },
    { name: 'Or', rgb: [255, 200, 90] },
  ];
  let rgb = COLORS[0].rgb;
  let waves = [];
  const dust = new Particles(500);
  const sizes = new Map();
  let cool = 0;

  const blast = (e, x, y, power) => {
    waves.push({ x, y, t: 0, power });
    cool = 0.5;
    e.shake(16 * power);
    e.punch?.(0.04 * power);
    e.flash(rgb, 0.25 * power, 5);
    e.audio.play('boom', 0.8 * power);
    e.audio.play('whoosh', 0.7);
    for (let i = 0; i < 80 * power; i++) {
      const a = rand(TAU);
      const v = rand(400, 1400) * e.unit;
      dust.add({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        drag: 2.5,
        life: rand(0.4, 0.9),
        size: rand(2, 5) * e.unit,
        rgb,
        core: 0.4,
      });
    }
  };

  return {
    id: 'shockwave',
    name: 'Onde de choc',
    hint: 'Ferme le poing puis ouvre la main d’un coup, ou pousse la main vers la caméra : l’image tremble sous l’onde. Les deux mains = onde géante.',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      waves = [];
      dust.clear();
    },
    trigger(e) {
      const h = biggest(e.hands);
      blast(e, h?.palm.x ?? e.W / 2, h?.palm.y ?? e.H / 2, 1);
    },
    update(dt, hands, e) {
      dust.update(dt);
      cool -= dt;
      const L = live(hands);
      for (const w of waves) w.t += dt;
      waves = waves.filter((w) => w.t < 0.9);
      // Charge glow in a closed fist.
      for (const h of L) {
        const prev = sizes.get(h.id) ?? h.size;
        sizes.set(h.id, h.size);
        const push = (h.size - prev) / dt > h.size * 2.5 && h.open;
        if (cool <= 0 && (h.events.release || push)) {
          const both = L.length >= 2 && L.every((x) => x.open);
          blast(e, h.palm.x, h.palm.y, both ? 1.6 : 1);
        }
        if (h.fist) e.light(h.palm.x, h.palm.y, h.size * 3, rgb, 0.2);
      }
    },
    draw(ctx, e) {
      const M = Math.max(e.W, e.H);
      for (const w of waves) {
        const t = w.t / 0.9;
        const r = t * M * 0.9 * w.power;
        const band = M * 0.06;
        const a = 1 - t;
        // The image inside the ring, slightly magnified: it bends like glass.
        ctx.save();
        ctx.beginPath();
        ctx.arc(w.x, w.y, r + band, 0, TAU);
        ctx.arc(w.x, w.y, Math.max(0, r - band), 0, TAU, true);
        ctx.clip();
        const k = 1 + 0.07 * a * w.power;
        ctx.translate(w.x, w.y);
        ctx.scale(k, k);
        ctx.translate(-w.x, -w.y);
        drawCamera(ctx, e);
        ctx.restore();
        ctx.globalCompositeOperation = 'lighter';
        for (const [lw, al] of [
          [band * 0.6, 0.12],
          [8, 0.5],
          [2.5, 0.9],
        ]) {
          ctx.strokeStyle = `rgba(${rgb.join(',')},${al * a})`;
          ctx.lineWidth = lw * (lw > 10 ? 1 : e.unit);
          ctx.beginPath();
          ctx.arc(w.x, w.y, r, 0, TAU);
          ctx.stroke();
        }
        if (t < 0.3) drawGlow(ctx, rgb, w.x, w.y, M * 0.25 * (1 - t / 0.3), 0.6 * (1 - t / 0.3), 0.2);
        ctx.globalCompositeOperation = 'source-over';
      }
      dust.draw(ctx);
    },
  };
}

// ---------- Magnétisme ----------
// Iron filings everywhere: they line up along the magnetic field between your
// hands (each hand is a pole). Open hand pulls them in, fist pushes them away.
export function magnetEffect() {
  const COLORS = [
    { name: 'Acier', rgb: [200, 215, 235] },
    { name: 'Électrique', rgb: [90, 200, 255] },
    { name: 'Rouge', rgb: [255, 90, 80] },
  ];
  let rgb = COLORS[0].rgb;
  let bits = [];
  let W = 0;

  const field = (x, y, poles) => {
    let fx = 0;
    let fy = 0;
    for (const p of poles) {
      const dx = x - p.x;
      const dy = y - p.y;
      const d2 = dx * dx + dy * dy + p.r * p.r;
      const k = p.q / (d2 * Math.sqrt(d2));
      fx += dx * k;
      fy += dy * k;
    }
    return [fx, fy];
  };

  return {
    id: 'magnet',
    name: 'Magnétisme',
    hint: 'Chaque main est un aimant : la limaille de fer dessine le champ entre tes mains. Main ouverte = elle est attirée, poing = elle est repoussée.',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      bits = [];
    },
    update(dt, hands, e) {
      if (W !== e.W || !bits.length) {
        W = e.W;
        bits = Array.from({ length: 700 }, () => ({ x: rand(e.W), y: rand(e.H), vx: 0, vy: 0, a: rand(TAU), l: rand(0.6, 1.3) }));
      }
      const L = live(hands);
      // The first hand is north, the second south.
      const poles = L.map((h, i) => ({ x: h.palm.x, y: h.palm.y, q: i ? -1 : 1, r: h.size * 0.8, h }));
      let level = 0;
      for (const b of bits) {
        if (poles.length) {
          const [fx, fy] = field(b.x, b.y, poles);
          const target = Math.atan2(fy, fx);
          let da = target - b.a;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          // Filings are lines: the closest of the two directions.
          if (da > Math.PI / 2) da -= Math.PI;
          if (da < -Math.PI / 2) da += Math.PI;
          b.a += da * Math.min(1, dt * 10);
          for (const p of poles) {
            const dx = p.x - b.x;
            const dy = p.y - b.y;
            const d = Math.hypot(dx, dy) || 1;
            const reach = p.h.size * 7;
            if (d > reach) continue;
            const pull = (p.h.fist ? -1.6 : p.h.open ? 1 : 0.3) * (1 - d / reach) * 1600 * e.unit;
            b.vx += (dx / d) * pull * dt;
            b.vy += (dy / d) * pull * dt;
            level = Math.max(level, 1 - d / reach);
            // Stick around the palm instead of all piling up in the centre.
            if (d < p.h.size * 0.9 && !p.h.fist) {
              b.vx -= (dx / d) * 2200 * e.unit * dt;
              b.vy -= (dy / d) * 2200 * e.unit * dt;
            }
          }
        }
        b.vx *= Math.exp(-dt * 4);
        b.vy *= Math.exp(-dt * 4);
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < 0 || b.x > e.W || b.y < 0 || b.y > e.H) {
          b.x = rand(e.W);
          b.y = rand(e.H);
          b.vx = b.vy = 0;
        }
      }
      e.audio.loop('buzz', level * 0.25);
      for (const p of poles) e.light(p.x, p.y, p.h.size * 4, rgb, 0.12);
    },
    draw(ctx, e) {
      const len = 7 * e.unit;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(20,22,28,0.75)';
      ctx.lineWidth = 2.6 * e.unit;
      ctx.beginPath();
      for (const b of bits) {
        const c = Math.cos(b.a) * len * b.l;
        const s = Math.sin(b.a) * len * b.l;
        ctx.moveTo(b.x - c, b.y - s);
        ctx.lineTo(b.x + c, b.y + s);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${rgb.join(',')},0.75)`;
      ctx.lineWidth = 1.2 * e.unit;
      ctx.stroke();
      for (const h of live(e.hands)) {
        const f = 0.8 + 0.2 * noise1(e.t * 10 + h.id);
        drawGlow(ctx, rgb, h.palm.x, h.palm.y, h.size * 1.6, 0.35 * f, 0.15);
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

// ---------- Arrêt du temps ----------
// Snap your fingers (or fist then open): everything behind you freezes in a
// cold blue light, while you keep moving. Again to let time flow.
export function chronoEffect() {
  const COLORS = [
    { name: 'Bleu temps', rgb: [120, 200, 255] },
    { name: 'Vert', rgb: [100, 255, 170] },
    { name: 'Or', rgb: [255, 210, 110] },
  ];
  let rgb = COLORS[0].rgb;
  let frozen = null;
  let since = 0;
  let wave = -1;
  let cool = 0;
  let waveAt = null;
  const motes = new Particles(160);

  const toggle = (e, at) => {
    if (cool > 0) return;
    cool = 0.8;
    wave = 0;
    if (frozen) {
      frozen = null;
      e.audio.play('whoosh', 0.9);
    } else {
      frozen = makeCanvas(e.W, e.H);
      const g = frozen.getContext('2d');
      g.drawImage(e.layers.frame, 0, 0);
      // Cold, washed-out colours for the stopped world.
      g.globalCompositeOperation = 'saturation';
      g.fillStyle = 'hsl(0,0%,50%)';
      g.globalAlpha = 0.8;
      g.fillRect(0, 0, e.W, e.H);
      g.globalCompositeOperation = 'soft-light';
      g.fillStyle = `rgb(${rgb.join(',')})`;
      g.globalAlpha = 0.55;
      g.fillRect(0, 0, e.W, e.H);
      since = 0;
      e.audio.play('ring', 0.9);
      e.audio.play('teleport', 0.5);
    }
    e.flash(rgb, 0.3, 4);
    waveAt = at;
  };

  return {
    id: 'chrono',
    name: 'Arrêt du temps',
    hint: 'Claque des doigts (ou poing puis main ouverte) : le monde derrière toi se fige, toi tu bouges encore. Recommence pour relancer le temps.',
    colors: COLORS,
    needs: { seg: true },
    action: { label: 'Figer', run: (e) => e.segActive && toggle(e, { x: e.W / 2, y: e.H / 2 }) },
    trigger(e) {
      if (e.segActive) toggle(e, { x: e.W / 2, y: e.H / 2 });
    },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      frozen = null;
      wave = -1;
      motes.clear();
    },
    update(dt, hands, e) {
      cool -= dt;
      if (wave >= 0) wave += dt;
      if (wave > 0.8) wave = -1;
      for (const h of live(hands)) if ((h.events.snap || h.events.release) && e.segActive) toggle(e, h.palm);
      if (frozen) {
        since += dt;
        // Motes of dust hang still in the air.
        if (motes.list.length < 120)
          motes.add({ x: rand(e.W), y: rand(e.H), life: 1e9, size: rand(2, 5) * e.unit, rgb, core: 0.5, alpha: 0.7, fadeIn: 0 });
        e.audio.loop('hum', 0.25);
        // Time flows again by itself after a while.
        if (since > 12) toggle(e, { x: e.W / 2, y: e.H / 2 });
      } else {
        motes.clear();
        e.audio.loop('hum', 0);
      }
    },
    drawBackground(ctx, e) {
      if (!frozen || !e.segActive) return false;
      ctx.drawImage(frozen, 0, 0, e.W, e.H);
      ctx.drawImage(e.layers.person, 0, 0);
      return true;
    },
    draw(ctx, e) {
      if (frozen) {
        ctx.globalCompositeOperation = 'lighter';
        for (const p of motes.list) drawGlow(ctx, p.rgb, p.x, p.y, p.size, 0.5 + 0.3 * Math.sin(e.t * 2 + p.x), 0.5);
        // A clock face ticking at the top.
        const cx = e.W / 2;
        const cy = e.H * 0.12;
        const R = Math.min(e.W, e.H) * 0.06;
        ctx.strokeStyle = `rgba(${rgb.join(',')},0.7)`;
        ctx.lineWidth = 2 * e.unit;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, TAU);
        ctx.stroke();
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8);
          ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
          ctx.stroke();
        }
        const hand = -Math.PI / 2 + Math.floor(since * 2) * 0.05;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(hand) * R * 0.9, cy + Math.sin(hand) * R * 0.9);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
      if (wave >= 0 && waveAt) {
        const t = wave / 0.8;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(${rgb.join(',')},${0.8 * (1 - t)})`;
        ctx.lineWidth = 10 * (1 - t) * e.unit + 1;
        ctx.beginPath();
        ctx.arc(waveAt.x, waveAt.y, t * Math.max(e.W, e.H), 0, TAU);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
    },
  };
}

// ---------- Gravité ----------
// Pinch to make a ball appear: it falls, bounces on the floor, on the edges
// and on your hands (bat it, juggle it, hold it on your open palm). Fist then
// open hand: gravity flips for a few seconds.
export function gravityEffect() {
  const COLORS = [
    { name: 'Arc-en-ciel', rgb: null },
    { name: 'Néon', rgb: [80, 255, 200] },
    { name: 'Feu', rgb: [255, 130, 50] },
  ];
  const PALETTE = [
    [255, 90, 90],
    [255, 200, 70],
    [90, 220, 120],
    [80, 170, 255],
    [200, 110, 255],
  ];
  let scheme = COLORS[0];
  let balls = [];
  let flip = 0;
  let cool = 0;
  const trail = new Particles(300);
  const lastPalm = new Map();

  return {
    id: 'gravity',
    name: 'Gravité',
    hint: 'Pince les doigts : une balle apparaît et tombe. Fais-la rebondir sur tes mains, garde-la sur ta paume. Poing puis main ouverte : la gravité s’inverse !',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      scheme = COLORS[i];
    },
    start() {
      balls = [];
      flip = 0;
      trail.clear();
    },
    update(dt, hands, e) {
      trail.update(dt);
      cool -= dt;
      flip = Math.max(0, flip - dt);
      const L = live(hands);
      for (const h of L) {
        if (h.events.pinchStart && cool <= 0) {
          if (balls.length >= 10) balls.shift();
          const r = Math.min(e.W, e.H) * rand(0.035, 0.05);
          balls.push({
            x: h.pinchPoint.x,
            y: h.pinchPoint.y,
            vx: h.vel.x * 0.5,
            vy: h.vel.y * 0.5,
            r,
            rgb: scheme.rgb || PALETTE[balls.length % PALETTE.length],
            spin: 0,
          });
          cool = 0.25;
          e.audio.play('pop', 0.7);
        }
        if (h.events.release) {
          flip = 4;
          e.flash([200, 200, 255], 0.25, 4);
          e.audio.play('teleport', 0.7);
        }
      }
      const g = 1800 * e.unit * (flip > 0 ? -1 : 1);
      const steps = 2;
      const h2 = dt / steps;
      for (let s = 0; s < steps; s++)
        for (const b of balls) {
          b.vy += g * h2;
          b.x += b.vx * h2;
          b.y += b.vy * h2;
          b.spin += (b.vx / b.r) * h2;
          // Floor, ceiling, walls.
          if (b.y > e.H - b.r) {
            if (b.vy > 250 * e.unit) e.audio.play('thud', clamp(b.vy / (2500 * e.unit)) * 0.6);
            b.y = e.H - b.r;
            b.vy = -Math.abs(b.vy) * 0.72;
            b.vx *= 0.92;
          }
          if (b.y < b.r) {
            b.y = b.r;
            b.vy = Math.abs(b.vy) * 0.72;
          }
          if (b.x < b.r || b.x > e.W - b.r) {
            b.x = clamp(b.x, b.r, e.W - b.r);
            b.vx *= -0.8;
          }
          // Hands are round paddles that carry their own speed.
          for (const h of L) {
            const pr = h.size * (h.fist ? 0.7 : 1);
            const dx = b.x - h.palm.x;
            const dy = b.y - h.palm.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d < pr + b.r) {
              const nx = dx / d;
              const ny = dy / d;
              b.x = h.palm.x + nx * (pr + b.r);
              b.y = h.palm.y + ny * (pr + b.r);
              const rvx = b.vx - h.vel.x;
              const rvy = b.vy - h.vel.y;
              const vn = rvx * nx + rvy * ny;
              if (vn < 0) {
                b.vx -= 1.7 * vn * nx;
                b.vy -= 1.7 * vn * ny;
                if (-vn > 300 * e.unit) e.audio.play('pop', clamp(-vn / (3000 * e.unit)) * 0.6);
              }
            }
          }
          // Balls bump into each other.
          for (const o of balls) {
            if (o === b) continue;
            const dx = o.x - b.x;
            const dy = o.y - b.y;
            const d = Math.hypot(dx, dy) || 1;
            const min = o.r + b.r;
            if (d >= min) continue;
            const nx = dx / d;
            const ny = dy / d;
            const push = (min - d) / 2;
            b.x -= nx * push;
            b.y -= ny * push;
            o.x += nx * push;
            o.y += ny * push;
            const vn = (o.vx - b.vx) * nx + (o.vy - b.vy) * ny;
            if (vn < 0) {
              b.vx += vn * nx * 0.9;
              b.vy += vn * ny * 0.9;
              o.vx -= vn * nx * 0.9;
              o.vy -= vn * ny * 0.9;
            }
          }
        }
      for (const b of balls)
        if (Math.hypot(b.vx, b.vy) > 900 * e.unit)
          trail.add({ x: b.x, y: b.y, life: 0.3, size: b.r * 0.9, rgb: b.rgb, core: 0.3, alpha: 0.4 });
      for (const h of L) lastPalm.set(h.id, { ...h.palm });
    },
    draw(ctx, e) {
      trail.draw(ctx);
      for (const b of balls) {
        // Shadow on the floor.
        const hgt = clamp((e.H - b.y) / (e.H * 0.7));
        ctx.globalAlpha = 0.3 * (1 - hgt);
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(b.x, e.H - 2, b.r * (1.2 - hgt * 0.6), b.r * 0.2, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        const [r, g, bl] = b.rgb;
        const grad = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.1, b.x, b.y, b.r);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.25, `rgb(${r},${g},${bl})`);
        grad.addColorStop(1, `rgb(${r * 0.35},${g * 0.35},${bl * 0.35})`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, TAU);
        ctx.fill();
        // A stripe that shows it rolling.
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = b.r * 0.18;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 0.65, b.spin, b.spin + 1.2);
        ctx.stroke();
      }
      if (flip > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(120,120,255,${0.08 * clamp(flip)})`;
        ctx.fillRect(0, 0, e.W, e.H);
        ctx.globalCompositeOperation = 'source-over';
      }
    },
  };
}

// ---------- Ondes d'eau ----------
// The image is the surface of water: your fingertip touches it and rings of
// waves spread out, bending the picture as they pass.
export function ripplesEffect() {
  const COLORS = [
    { name: 'Eau', rgb: [170, 220, 255] },
    { name: 'Lagon', rgb: [90, 255, 210] },
  ];
  let rgb = COLORS[0].rgb;
  let waves = [];
  const last = new Map();

  return {
    id: 'ripples',
    name: 'Ondes d’eau',
    hint: 'Pointe l’index et touche l’image : des vagues partent de ton doigt comme sur l’eau. Main ouverte qui frappe vite : grosse vague.',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      waves = [];
    },
    update(dt, hands, e) {
      for (const w of waves) w.t += dt;
      waves = waves.filter((w) => w.t < 1.6);
      for (const h of live(hands)) {
        const tip = h.point ? h.lm[8] : h.palm;
        const prev = last.get(h.id);
        last.set(h.id, { x: tip.x, y: tip.y, t: e.t });
        // A new ring each time the finger has moved a little (or every 0.4 s).
        const moved = !prev || Math.hypot(tip.x - prev.x, tip.y - prev.y) > h.size * 0.6;
        const slam = h.open && h.speed > Math.min(e.W, e.H) * 1.8;
        if ((h.point && (moved || waves.every((w) => w.t > 0.4))) || slam) {
          if (waves.length >= 6) waves.shift();
          waves.push({ x: tip.x, y: tip.y, t: 0, big: slam ? 1.8 : 1 });
          if (slam) e.audio.play('drop', 0.8);
          else if (Math.random() < 0.3) e.audio.play('drop', 0.25);
        } else last.set(h.id, prev || { x: tip.x, y: tip.y });
      }
    },
    draw(ctx, e) {
      const M = Math.min(e.W, e.H);
      for (const w of waves) {
        const t = w.t / 1.6;
        const r = t * M * 0.55 * w.big;
        const band = M * 0.03 * w.big;
        const a = 1 - t;
        // Refraction band: the picture slightly magnified inside the ring.
        ctx.save();
        ctx.beginPath();
        ctx.arc(w.x, w.y, r + band, 0, TAU);
        ctx.arc(w.x, w.y, Math.max(0, r - band), 0, TAU, true);
        ctx.clip();
        const k = 1 + 0.035 * a * w.big;
        ctx.translate(w.x, w.y);
        ctx.scale(k, k);
        ctx.translate(-w.x, -w.y);
        drawCamera(ctx, e);
        ctx.restore();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(${rgb.join(',')},${0.45 * a})`;
        ctx.lineWidth = 2 * e.unit;
        ctx.beginPath();
        ctx.arc(w.x, w.y, r + band * 0.6, 0, TAU);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
    },
  };
}
