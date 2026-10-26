// Body pack: powers that change you yourself, using the silhouette found by
// the AI and the learned background behind you.
//   Multiclonage   hand seals (ninja techniques): copies of you appear on
//                  both sides, a little late; a snap dispels them
//   Invisibilité   snap (or fist -> open): you vanish, only a shimmer is left
//   Taille         snap (or fist -> open): mini you, giant you, back to normal
import { Particles, rand, TAU, clamp, makeCanvas, noise1, drawGlow } from './util.js';

const live = (hands) => hands.filter((h) => h.presence > 0.5);
const toggled = (hands) => live(hands).some((h) => h.events.snap || h.events.release);

// Puff of smoke where something appears or disappears.
function puff(fx, e, x, y, rgb, n = 40) {
  for (let i = 0; i < n; i++) {
    const a = rand(TAU);
    const v = rand(80, 400) * e.unit;
    fx.add({
      x: x + rand(-40, 40) * e.unit,
      y: y + rand(-120, 120) * e.unit,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 60,
      drag: 2.5,
      life: rand(0.5, 1),
      size: rand(20, 50) * e.unit,
      rgb,
      core: 0.05,
      alpha: 0.5,
    });
  }
}

// ---------- Multiclonage ----------
export function clonesEffect() {
  const COLORS = [
    { name: 'Naturel', tint: null },
    { name: 'Ombre', tint: [40, 60, 120] },
    { name: 'Hologramme', tint: [80, 220, 255] },
  ];
  let scheme = COLORS[0];
  const history = []; // { t, c } copies of you, half size
  let count = 0;
  let shown = 0;
  let lastShot = 0;
  let cool = 0;
  const smoke = new Particles(300);
  let sealKind = null;
  let sealT = 0;
  let seal = null;
  // Each clone: side offset (fraction of the width), delay in seconds, scale.
  const SLOTS = [
    [-0.27, 0.25, 0.92],
    [0.27, 0.35, 0.92],
    [-0.47, 0.5, 0.84],
    [0.47, 0.6, 0.84],
  ];

  const set = (e, n) => {
    count = n;
    cool = 0.6;
    for (const [dx] of SLOTS.slice(0, Math.max(n, shown)))
      puff(smoke, e, (e.seg?.centroid.x ?? e.W / 2) + dx * e.W, e.H * 0.55, [230, 230, 240]);
    e.audio.play('pop', 0.9);
    e.audio.play('whoosh', 0.6);
  };

  return {
    id: 'clones',
    name: 'Multiclonage',
    hint: 'Technique des clones : joins les deux mains, index levés comme un ninja, et tiens une demi-seconde (deux poings joints = clones d’ombre, paumes jointes = clones hologrammes). Recommence pour en avoir quatre. Claque des doigts pour les faire disparaître.',
    colors: COLORS,
    needs: { seg: true },
    action: { label: 'Clones', run: (e) => set(e, count >= 4 ? 0 : count + 2) },
    trigger(e) {
      set(e, count >= 4 ? 0 : count + 2);
    },
    setColor(i) {
      scheme = COLORS[i];
    },
    start() {
      history.length = 0;
      count = 0;
      shown = 0;
      smoke.clear();
    },
    update(dt, hands, e) {
      smoke.update(dt);
      cool -= dt;
      // Techniques: a hand seal made with both hands together, held a moment.
      //   fingers up (crossed, like a ninja)  -> clones
      //   both fists pressed together         -> shadow clones
      //   palms joined                        -> hologram clones
      //   a snap                              -> they all vanish (release)
      const L = live(hands);
      let kind = null;
      if (L.length >= 2) {
        const [a, b] = L;
        const near = Math.hypot(a.palm.x - b.palm.x, a.palm.y - b.palm.y) < (a.size + b.size) * 1.1;
        const up = (h) => h.point || h.gesture === 'peace' || (h.fingers.index && h.fingers.middle && !h.fingers.ring);
        if (near && up(a) && up(b)) kind = 0;
        else if (near && a.fist && b.fist) kind = 1;
        else if (near && a.open && b.open) kind = 2;
        if (kind !== null) seal = { x: (a.palm.x + b.palm.x) / 2, y: (a.palm.y + b.palm.y) / 2, r: (a.size + b.size) * 0.9 };
      }
      if (kind !== sealKind) {
        sealKind = kind;
        sealT = 0;
      } else if (kind !== null && sealT >= 0) sealT += dt;
      if (kind === null) seal = null;
      if (kind !== null && sealT > 0.45 && cool <= 0) {
        sealT = -1; // once per seal: separate the hands to do it again
        scheme = COLORS[kind];
        set(e, Math.min(4, count + 2));
        e.flash([255, 255, 255], 0.25, 4);
        e.shake(8);
      }
      if (cool <= 0 && count > 0 && L.some((h) => h.events.snap)) set(e, 0);
      shown += clamp(count - shown, -dt * 6, dt * 6);
      // Keep a copy of you every 1/20 s, for 0.7 s.
      // Copies are only kept while clones are out or a seal is being made.
      if ((count > 0 || shown > 0.01 || seal) && e.segActive && e.seg?.present && e.t - lastShot > 0.05) {
        lastShot = e.t;
        const old = history.length && e.t - history[0].t > 0.7 ? history.shift() : null;
        const w = Math.round(e.W / 2);
        const h = Math.round(e.H / 2);
        const c = old?.c.width === w && old.c.height === h ? old.c : makeCanvas(w, h);
        const g = c.getContext('2d');
        g.clearRect(0, 0, w, h);
        g.drawImage(e.layers.person, 0, 0, w, h);
        if (scheme.tint) {
          g.globalCompositeOperation = 'source-atop';
          g.fillStyle = `rgba(${scheme.tint.join(',')},0.55)`;
          g.fillRect(0, 0, w, h);
          g.globalCompositeOperation = 'source-over';
        }
        history.push({ t: e.t, c });
      }
    },
    drawBehind(ctx, e) {
      if (shown <= 0.01 || !history.length) return false;
      const cx = e.seg?.centroid.x ?? e.W / 2;
      for (let i = SLOTS.length - 1; i >= 0; i--) {
        const a = clamp(shown - i);
        if (a <= 0) continue;
        const [dx, delay, k] = SLOTS[i];
        const want = e.t - delay;
        let snap = history[0];
        for (const s of history) if (s.t <= want) snap = s;
        ctx.save();
        ctx.globalAlpha = a * (scheme.tint ? 0.85 : 1);
        // Scaled from your feet, a little smaller: further back.
        ctx.translate(cx + dx * e.W, e.H);
        ctx.scale(k, k);
        ctx.translate(-cx, -e.H);
        ctx.drawImage(snap.c, 0, 0, e.W, e.H);
        ctx.restore();
      }
      return false;
    },
    draw(ctx, e) {
      smoke.draw(ctx);
      // The seal charging: chakra swirling around the joined hands.
      if (seal && sealT > 0) {
        const k = clamp(sealT / 0.45);
        const col = [
          [120, 200, 255],
          [150, 90, 255],
          [80, 240, 255],
        ][sealKind];
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(${col.join(',')},0.9)`;
        ctx.lineWidth = 4 * e.unit;
        ctx.beginPath();
        ctx.arc(seal.x, seal.y, seal.r, -Math.PI / 2, -Math.PI / 2 + TAU * k);
        ctx.stroke();
        for (let i = 0; i < 3; i++) {
          const a = e.t * 6 + (i * TAU) / 3;
          drawGlow(ctx, col, seal.x + Math.cos(a) * seal.r * 0.8, seal.y + Math.sin(a) * seal.r * 0.8, seal.r * 0.25, 0.7 * k, 0.4);
        }
        drawGlow(ctx, col, seal.x, seal.y, seal.r * 1.3 * k, 0.4 * k, 0.1);
        ctx.globalCompositeOperation = 'source-over';
      }
    },
  };
}

// ---------- Invisibilité ----------
export function invisibleEffect() {
  const COLORS = [
    { name: 'Camouflage', rgb: [200, 230, 255] },
    { name: 'Fantôme', rgb: [150, 255, 200] },
  ];
  let rgb = COLORS[0].rgb;
  let on = false;
  let k = 0;
  let plate = null;
  let plateAge = 1;
  let tmp = null;
  let cool = 0;
  const sparks = new Particles(300);

  const toggle = (e) => {
    if (cool > 0) return;
    cool = 0.8;
    on = !on;
    e.audio.play(on ? 'teleport' : 'chime', 0.7);
    const s = e.seg;
    if (s?.present)
      for (let i = 0; i < 70; i++)
        sparks.add({
          x: s.centroid.x + rand(-0.15, 0.15) * e.W,
          y: rand(e.H * 0.2, e.H),
          vx: rand(-60, 60),
          vy: rand(-200, -40),
          drag: 1,
          life: rand(0.5, 1.2),
          size: rand(2, 5) * e.unit,
          rgb,
          core: 0.5,
        });
  };

  return {
    id: 'invisible',
    name: 'Invisibilité',
    hint: 'Reste d’abord quelques secondes en entier dans l’image (le décor est mémorisé). Puis claque des doigts, ou poing puis main ouverte : tu deviens invisible. Pareil pour réapparaître.',
    colors: COLORS,
    needs: { seg: true, plate: true },
    action: { label: 'Invisible', run: (e) => toggle(e) },
    trigger(e) {
      toggle(e);
    },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      on = false;
      k = 0;
      sparks.clear();
    },
    update(dt, hands, e) {
      sparks.update(dt);
      cool -= dt;
      if (toggled(hands)) toggle(e);
      k = clamp(k + (on ? dt : -dt) * 1.5);
    },
    drawBackground(ctx, e) {
      if (k <= 0 || !e.segActive) return false;
      plateAge += e.dt;
      if (!plate || plateAge > 0.4) {
        plate = e.backgroundPlate();
        plateAge = 0;
      }
      ctx.drawImage(e.layers.frame, 0, 0);
      // You fade into the room behind you.
      ctx.globalAlpha = k;
      ctx.drawImage(plate, 0, 0, e.W, e.H);
      ctx.globalAlpha = 1;
      // A heat-haze shimmer where you are: the room, shifted, only on you.
      if (!tmp || tmp.width !== e.W || tmp.height !== e.H) tmp = makeCanvas(e.W, e.H);
      const g = tmp.getContext('2d');
      g.globalCompositeOperation = 'copy';
      const sx = noise1(e.t * 3) * 6 * e.unit;
      const sy = noise1(e.t * 3 + 7) * 6 * e.unit;
      g.drawImage(plate, sx, sy, e.W, e.H);
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(e.layers.person, 0, 0);
      ctx.globalAlpha = 0.55 * k * (0.7 + 0.3 * noise1(e.t * 5));
      ctx.drawImage(tmp, 0, 0);
      ctx.globalAlpha = 1;
      // While fading, a ghost of you that gets lighter.
      if (k < 1) {
        ctx.globalAlpha = 1 - k;
        ctx.drawImage(e.layers.person, 0, 0);
        ctx.globalAlpha = 1;
      }
      return true;
    },
    draw(ctx) {
      sparks.draw(ctx);
    },
  };
}

// ---------- Taille (Ant-Man) ----------
export function sizeEffect() {
  const COLORS = [
    { name: 'Rouge', rgb: [255, 70, 70] },
    { name: 'Bleu', rgb: [70, 160, 255] },
  ];
  const STEPS = [1, 0.45, 1.6];
  let rgb = COLORS[0].rgb;
  let step = 0;
  let k = 1;
  let plate = null;
  let plateAge = 1;
  let cool = 0;
  const sparks = new Particles(300);

  const next = (e) => {
    if (cool > 0) return;
    cool = 0.8;
    step = (step + 1) % STEPS.length;
    const giant = STEPS[step] > 1;
    e.audio.play(giant ? 'roar' : 'whoosh', 0.8);
    if (giant) e.shake(20);
    const s = e.seg;
    const x = s?.centroid.x ?? e.W / 2;
    for (let i = 0; i < 80; i++) {
      const a = rand(TAU);
      const v = rand(100, 600) * e.unit;
      sparks.add({
        x,
        y: e.H * rand(0.4, 1),
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        drag: 2,
        life: rand(0.4, 0.9),
        size: rand(2, 5) * e.unit,
        rgb,
        core: 0.5,
      });
    }
  };

  return {
    id: 'size',
    name: 'Taille (Ant-Man)',
    hint: 'Reste quelques secondes en entier dans l’image, puis claque des doigts (ou poing puis main ouverte) : tu deviens minuscule, puis géant, puis normal.',
    colors: COLORS,
    needs: { seg: true, plate: true },
    action: { label: 'Taille', run: (e) => next(e) },
    trigger(e) {
      next(e);
    },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      step = 0;
      k = 1;
      sparks.clear();
    },
    update(dt, hands, e) {
      sparks.update(dt);
      cool -= dt;
      if (toggled(hands)) next(e);
      // Springy change of size.
      k += (STEPS[step] - k) * (1 - Math.exp(-dt * 5));
      if (k > 1.05 && Math.abs(STEPS[step] - k) > 0.05) e.shake(3);
    },
    drawBackground(ctx, e) {
      if (Math.abs(k - 1) < 0.01 || !e.segActive) return false;
      plateAge += e.dt;
      if (!plate || plateAge > 0.4) {
        plate = e.backgroundPlate();
        plateAge = 0;
      }
      ctx.drawImage(plate, 0, 0, e.W, e.H);
      // You, scaled from your feet (bottom of the image).
      const cx = e.seg?.centroid.x ?? e.W / 2;
      ctx.save();
      ctx.translate(cx, e.H);
      ctx.scale(k, k);
      ctx.translate(-cx, -e.H);
      ctx.drawImage(e.layers.person, 0, 0);
      ctx.restore();
      // A small shadow under mini you.
      if (k < 0.9) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(cx, e.H - 4, e.W * 0.12 * k, e.H * 0.015, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      return true;
    },
    draw(ctx) {
      sparks.draw(ctx);
    },
  };
}
