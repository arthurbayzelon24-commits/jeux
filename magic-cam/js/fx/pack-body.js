// Body pack: powers that change you yourself, using the silhouette found by
// the AI and the learned background behind you.
//   Multiclonage   hand seals (ninja techniques): copies of you appear on
//                  both sides, a little late; a snap dispels them
//   Invisibilité   snap (or fist -> open): you vanish, only a shimmer is left
//   Taille         snap (or fist -> open): mini you, giant you, back to normal
//   Désintégration snap: you crumble into dust, snap again to come back
import { Particles, rand, TAU, clamp, makeCanvas, noise1, drawGlow } from './util.js';

const live = (hands) => hands.filter((h) => h.presence > 0.5);
const toggled = (hands) => live(hands).some((h) => h.events.snap || h.events.release);

// A two-hand technique: returns true once when test(a, b, e) has held for
// `hold` seconds; the hands must let go before it can fire again.
function technique(hold = 0.5) {
  let t = 0;
  let spent = false;
  return (hands, e, dt, test) => {
    const L = live(hands);
    const ok = L.length >= 2 && test(L[0], L[1], e);
    if (!ok) {
      t = 0;
      spent = false;
      return false;
    }
    t += dt;
    if (t >= hold && !spent) {
      spent = true;
      return true;
    }
    return false;
  };
}
const gap = (a, b) => Math.hypot(a.palm.x - b.palm.x, a.palm.y - b.palm.y);

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
        if (count >= 4) e.emit?.('clones');
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
  const seal = technique(0.6);
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
    hint: 'Reste d’abord quelques secondes en entier dans l’image (le décor est mémorisé). Puis joins les paumes devant toi une demi-seconde (ou claque des doigts) : tu deviens invisible. Pareil pour réapparaître.',
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
      // Technique: palms joined in front of you (or a snap).
      if (toggled(hands) || seal(hands, e, dt, (a, b) => a.open && b.open && gap(a, b) < (a.size + b.size) * 0.9)) toggle(e);
      k = clamp(k + (on ? dt : -dt) * 1.5);
    },
    drawBackground(ctx, e) {
      if (k <= 0 || !e.segActive) return false;
      plateAge += e.dt;
      if (!plate || plateAge > 0.4) {
        plate = e.backgroundPlate();
        plateAge = 0;
      }
      // You fade into the room behind you (no need for the camera image
      // under the room once you are fully gone).
      if (k < 1) ctx.drawImage(e.layers.frame, 0, 0);
      ctx.globalAlpha = k;
      ctx.drawImage(plate, 0, 0, e.W, e.H);
      ctx.globalAlpha = 1;
      // A heat-haze shimmer where you are: the room, shifted, only on you.
      // Made at half size (it is blurry anyway): half the work.
      const w = Math.round(e.W / 2);
      const h = Math.round(e.H / 2);
      if (!tmp || tmp.width !== w || tmp.height !== h) tmp = makeCanvas(w, h);
      const g = tmp.getContext('2d');
      g.globalCompositeOperation = 'copy';
      const sx = noise1(e.t * 3) * 3 * e.unit;
      const sy = noise1(e.t * 3 + 7) * 3 * e.unit;
      g.drawImage(plate, sx, sy, w, h);
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(e.layers.person, 0, 0, w, h);
      ctx.globalAlpha = 0.55 * k * (0.7 + 0.3 * noise1(e.t * 5));
      ctx.drawImage(tmp, 0, 0, e.W, e.H);
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

  const wide = technique(0.4);
  const tiny = technique(0.4);
  const normal = technique(0.5);
  const next = (e) => go(e, (step + 1) % STEPS.length);
  const go = (e, to) => {
    if (cool > 0 || to === step) return;
    cool = 0.8;
    step = to;
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
    hint: 'Reste quelques secondes en entier dans l’image, puis ouvre grand les bras (géant), pince avec les deux mains rapprochées (minuscule) ou serre les deux poings (normal). Un claquement de doigts passe à la taille suivante.',
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
      // Techniques: arms wide open = giant, both hands pinching close
      // together = tiny, both fists = back to normal (a snap: next size).
      if (toggled(hands)) next(e);
      else if (wide(hands, e, dt, (a, b, e2) => a.open && b.open && gap(a, b) > e2.W * 0.55)) go(e, 2);
      else if (tiny(hands, e, dt, (a, b) => a.pinch && b.pinch && gap(a, b) < (a.size + b.size) * 1.5)) go(e, 1);
      else if (normal(hands, e, dt, (a, b) => a.fist && b.fist)) go(e, 0);
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

// ---------- Ombre vivante ----------
// Your shadow on the wall behind you, a little late and to the side, with two
// glowing eyes. Close a fist: the shadow comes out of the wall (bigger).
export function livingShadowEffect() {
  const COLORS = [
    { name: 'Ombre', eye: [255, 60, 60] },
    { name: 'Spectre', eye: [80, 220, 255] },
  ];
  let scheme = COLORS[0];
  const history = [];
  let lastShot = 0;
  let grow = 0;

  return {
    id: 'livingshadow',
    name: 'Ombre vivante',
    hint: 'Ton ombre apparaît sur le mur derrière toi et te suit avec un temps de retard. Serre le poing : elle grandit et sort du mur.',
    colors: COLORS,
    needs: { seg: true },
    setColor(i) {
      scheme = COLORS[i];
    },
    start() {
      history.length = 0;
      grow = 0;
    },
    update(dt, hands, e) {
      grow += ((hands.some((h) => h.presence > 0.5 && h.fist) ? 1 : 0) - grow) * Math.min(1, dt * 3);
      if (e.segActive && e.seg?.present && e.t - lastShot > 0.05) {
        lastShot = e.t;
        const old = history.length && e.t - history[0].t > 0.8 ? history.shift() : null;
        const w = Math.round(e.W / 2);
        const h = Math.round(e.H / 2);
        const c = old?.c.width === w && old.c.height === h ? old.c : makeCanvas(w, h);
        const g = c.getContext('2d');
        g.globalCompositeOperation = 'copy';
        g.drawImage(e.layers.person, 0, 0, w, h);
        // Pure shadow: the shape only, very dark.
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = 'rgba(8,4,16,0.88)';
        g.fillRect(0, 0, w, h);
        history.push({ t: e.t, c, top: e.seg.top, cx: e.seg.centroid.x });
      }
    },
    drawBehind(ctx, e) {
      if (!history.length) return false;
      const want = e.t - 0.6;
      let s = history[0];
      for (const h of history) if (h.t <= want) s = h;
      const k = 1.05 + grow * 0.35;
      const dx = e.W * 0.12;
      ctx.save();
      ctx.translate(s.cx + dx, e.H);
      ctx.scale(k, k);
      ctx.translate(-s.cx, -e.H);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(s.c, 0, 0, e.W, e.H);
      ctx.restore();
      // Two glowing eyes near the top of the head.
      const ex = s.cx + dx;
      const ey = e.H - (e.H - s.top) * k + (e.H - s.top) * k * 0.09;
      const gap = e.W * 0.025 * k;
      ctx.globalCompositeOperation = 'lighter';
      for (const sx of [-1, 1]) drawGlow(ctx, scheme.eye, ex + sx * gap, ey, 10 * e.unit * k, 0.9, 0.5);
      ctx.globalCompositeOperation = 'source-over';
      return false;
    },
  };
}

// ---------- Désintégration ----------
// Snap your fingers: you crumble into dust that the wind carries away, from
// the top of your head down. Snap again: the dust flies back and you are
// whole again. (Fist then open hand works too.)
export function dustEffect() {
  const COLORS = [
    { name: 'Cendres', tint: null },
    { name: 'Poussière dorée', tint: [255, 200, 90] },
    { name: 'Particules bleues', tint: [90, 200, 255] },
  ];
  let scheme = COLORS[0];
  let state = 'whole'; // whole | going | gone | coming
  let t = 0;
  let cool = 0;
  let dust = [];
  let plate = null;
  let plateAge = 1;
  let sample = null;
  let top = 0;
  let bottom = 1;
  const mask = { c: null };

  // Grains taken from your own colours, each with the moment it leaves
  // (higher on the body = earlier).
  const grains = (e) => {
    const sw = Math.round(e.W / 11);
    const sh = Math.round(e.H / 11);
    if (!sample || sample.width !== sw) sample = makeCanvas(sw, sh);
    const g = sample.getContext('2d', { willReadFrequently: true });
    g.clearRect(0, 0, sw, sh);
    g.drawImage(e.layers.person, 0, 0, sw, sh);
    const d = g.getImageData(0, 0, sw, sh).data;
    const out = [];
    top = e.H;
    bottom = 0;
    for (let y = 0; y < sh; y++)
      for (let x = 0; x < sw; x++) {
        const i = (y * sw + x) * 4;
        if (d[i + 3] < 150) continue;
        const px = (x / sw) * e.W;
        const py = (y / sh) * e.H;
        top = Math.min(top, py);
        bottom = Math.max(bottom, py);
        const col = scheme.tint ? scheme.tint : [d[i], d[i + 1], d[i + 2]];
        out.push({
          hx: px,
          hy: py,
          x: px,
          y: py,
          col,
          fill: `rgb(${col[0]},${col[1]},${col[2]})`,
          s: rand(3, 6) * e.unit,
          vx: 0,
          vy: 0,
          ph: rand(TAU),
        });
      }
    for (const p of out) p.delay = ((p.hy - top) / Math.max(1, bottom - top)) * 1.2 + rand(0, 0.3);
    return out;
  };

  const go = (e) => {
    if (cool > 0 || !e.seg?.present) return;
    cool = 0.8;
    if (state === 'whole') {
      dust = grains(e);
      state = 'going';
      t = 0;
      e.audio.play('sizzle', 0.5);
      e.audio.play('whoosh', 0.6);
    } else if (state === 'gone') {
      state = 'coming';
      t = 0;
      e.audio.play('teleport', 0.7);
    }
  };

  return {
    id: 'dust',
    name: 'Désintégration',
    hint: 'Reste quelques secondes en entier dans l’image, puis claque des doigts : tu pars en poussière, de la tête aux pieds. Claque encore pour revenir.',
    colors: COLORS,
    needs: { seg: true, plate: true },
    action: { label: 'Clac !', run: (e) => go(e) },
    trigger(e) {
      go(e);
    },
    setColor(i) {
      scheme = COLORS[i];
    },
    start() {
      state = 'whole';
      dust = [];
    },
    update(dt, hands, e) {
      cool -= dt;
      t += dt;
      if (live(hands).some((h) => h.events.snap || h.events.release)) go(e);
      const wind = 260 * e.unit;
      for (const p of dust) {
        if (state === 'going' && t > p.delay) {
          // Carried away to the side and up, swirling a little.
          p.vx += (wind + Math.sin(e.t * 2 + p.ph) * 80 * e.unit - p.vx * 0.5) * dt;
          p.vy += (-120 * e.unit + Math.cos(e.t * 3 + p.ph) * 60 * e.unit - p.vy * 0.5) * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        } else if (state === 'coming') {
          // Back home, the last ones first.
          const k = clamp((t - (1.5 - p.delay)) / 0.6);
          p.x += (p.hx - p.x) * Math.min(1, k * dt * 8);
          p.y += (p.hy - p.y) * Math.min(1, k * dt * 8);
        }
      }
      if (state === 'going' && t > 3) state = 'gone';
      if (state === 'coming' && t > 2.1) {
        state = 'whole';
        dust = [];
      }
    },
    drawBackground(ctx, e) {
      if (state === 'whole' || !e.segActive) return false;
      plateAge += e.dt;
      if (!plate || plateAge > 0.4) {
        plate = e.backgroundPlate();
        plateAge = 0;
      }
      ctx.drawImage(plate, 0, 0, e.W, e.H);
      // What is left of you: the part below the line that eats you away.
      let line = null;
      if (state === 'going') line = top + (bottom - top + e.H * 0.1) * clamp(t / 1.5) - e.H * 0.05;
      if (state === 'coming') line = bottom - (bottom - top + e.H * 0.1) * clamp((t - 0.8) / 1.2);
      if (line !== null && state !== 'gone') {
        if (!mask.c || mask.c.width !== e.W || mask.c.height !== e.H) mask.c = makeCanvas(e.W, e.H);
        const g = mask.c.getContext('2d');
        g.globalCompositeOperation = 'copy';
        g.drawImage(e.layers.person, 0, 0);
        g.globalCompositeOperation = 'destination-in';
        const grad = g.createLinearGradient(0, line - e.H * 0.04, 0, line + e.H * 0.04);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,1)');
        g.fillStyle = grad;
        g.fillRect(0, 0, e.W, e.H);
        ctx.drawImage(mask.c, 0, 0);
      }
      return true;
    },
    draw(ctx, e) {
      if (!dust.length) return;
      ctx.save();
      for (const p of dust) {
        const away = state === 'going' ? clamp((t - p.delay) / 1.6) : state === 'coming' ? 1 - clamp((t - (1.5 - p.delay)) / 0.8) : 1;
        if (state === 'going' && t < p.delay) continue;
        ctx.globalAlpha = state === 'gone' ? 0 : 1 - away * 0.85;
        ctx.fillStyle = p.fill;
        ctx.fillRect(p.x, p.y, p.s, p.s);
      }
      ctx.restore();
    },
  };
}

// ---------- Super vitesse ----------
// When you move, coloured after-images of you trail behind (like a speedster);
// lightning sparks around the moving body. Stand still: they catch up.
export function speedEffect() {
  const COLORS = [
    { name: 'Éclair rouge', tint: [255, 60, 40], spark: [255, 210, 80] },
    { name: 'Éclair jaune', tint: [255, 200, 40], spark: [255, 250, 180] },
    { name: 'Bleu', tint: [60, 140, 255], spark: [160, 220, 255] },
  ];
  let scheme = COLORS[0];
  const ghosts = []; // { t, c, x }
  let lastShot = 0;
  let lastX = null;
  let speed = 0;
  let demo = 0;
  const sparks = new Particles(300);

  return {
    id: 'speed',
    name: 'Super vitesse',
    hint: 'Bouge vite de gauche à droite : des images de toi restent derrière, en couleur, avec des éclairs. Arrête-toi et elles te rattrapent.',
    colors: COLORS,
    needs: { seg: true },
    setColor(i) {
      scheme = COLORS[i];
    },
    start() {
      ghosts.length = 0;
      sparks.clear();
      lastX = null;
    },
    // Demo (power card): the after-images spread out as if you were running.
    trigger() {
      demo = 3;
    },
    update(dt, hands, e) {
      sparks.update(dt);
      const s = e.seg;
      if (!e.segActive || !s?.present) return;
      const x = s.centroid.x;
      if (lastX !== null) speed += (Math.abs(x - lastX) / dt / e.W - speed) * Math.min(1, dt * 6);
      lastX = x;
      // Hands moving fast count too.
      const handSpeed = Math.max(0, ...hands.map((h) => (h.presence > 0.5 ? h.speed / e.W : 0)));
      demo = Math.max(0, demo - dt);
      const fast = Math.max(speed, handSpeed * 0.5, demo > 0 ? 1 : 0);
      if (e.t - lastShot > 0.06) {
        lastShot = e.t;
        const old = ghosts.length >= 5 ? ghosts.shift() : null;
        const w = Math.round(e.W / 2);
        const h = Math.round(e.H / 2);
        const c = old?.c.width === w && old.c.height === h ? old.c : makeCanvas(w, h);
        const g = c.getContext('2d');
        g.globalCompositeOperation = 'copy';
        g.drawImage(e.layers.person, 0, 0, w, h);
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = `rgba(${scheme.tint.join(',')},0.65)`;
        g.fillRect(0, 0, w, h);
        ghosts.push({ t: e.t, c, fast });
      }
      if (fast > 0.25 && s.edges.length)
        for (let i = 0; i < 4; i++) {
          const p = s.edges[(Math.random() * s.edges.length) | 0];
          sparks.add({
            x: p.x,
            y: p.y,
            vx: rand(-200, 200) * e.unit,
            vy: rand(-200, 200) * e.unit,
            drag: 3,
            life: rand(0.15, 0.35),
            size: rand(2, 4) * e.unit,
            rgb: scheme.spark,
            core: 0.7,
          });
        }
      if (fast > 0.6) e.audio.loop('wind', Math.min(0.4, fast * 0.3));
      else e.audio.loop('wind', 0);
    },
    drawBehind(ctx, e) {
      // Oldest first, more transparent; only the ones taken while moving.
      ghosts.forEach((g, i) => {
        const a = ((i + 1) / ghosts.length) * 0.55 * Math.min(1, g.fast * 2.5);
        if (a < 0.03) return;
        ctx.globalAlpha = a;
        ctx.globalCompositeOperation = 'lighter';
        const dx = demo > 0 ? -(ghosts.length - i) * e.W * 0.06 : 0;
        ctx.drawImage(g.c, dx, 0, e.W, e.H);
      });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      return false;
    },
    draw(ctx) {
      sparks.draw(ctx);
    },
  };
}

// ---------- Hologramme ----------
// You become a blue hologram: see-through, with scan lines, a flicker and the
// odd glitch, standing on a glowing projector at the bottom.
export function hologramEffect() {
  const COLORS = [
    { name: 'Bleu', rgb: [80, 200, 255] },
    { name: 'Vert', rgb: [90, 255, 150] },
    { name: 'Rose', rgb: [255, 90, 200] },
  ];
  let rgb = COLORS[0].rgb;
  let tmp = null;
  let plate = null;
  let plateAge = 1;
  let glitch = 0;

  return {
    id: 'hologram',
    name: 'Hologramme',
    hint: 'Reste quelques secondes en entier dans l’image : tu deviens un hologramme transparent, avec des lignes et des parasites. Claque des doigts pour un gros bug.',
    colors: COLORS,
    needs: { seg: true, plate: true },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    trigger() {
      glitch = 0.6;
    },
    update(dt, hands, e) {
      glitch = Math.max(0, glitch - dt);
      if (live(hands).some((h) => h.events.snap || h.events.release)) {
        glitch = 0.6;
        e.audio.play('zap', 0.6);
      }
      if (Math.random() < dt * 0.6) glitch = Math.max(glitch, 0.12);
    },
    drawBackground(ctx, e) {
      if (!e.segActive) return false;
      plateAge += e.dt;
      if (!plate || plateAge > 0.4) {
        plate = e.backgroundPlate();
        plateAge = 0;
      }
      ctx.drawImage(plate, 0, 0, e.W, e.H);
      if (!tmp || tmp.width !== e.W || tmp.height !== e.H) tmp = makeCanvas(e.W, e.H);
      const g = tmp.getContext('2d');
      g.globalCompositeOperation = 'copy';
      g.drawImage(e.layers.person, 0, 0);
      // Tinted, with scan lines.
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = `rgba(${rgb.join(',')},0.55)`;
      g.fillRect(0, 0, e.W, e.H);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      const step = Math.max(3, Math.round(4 * e.unit));
      const off = (e.t * 40) % step;
      for (let y = off; y < e.H; y += step) g.fillRect(0, y, e.W, step / 2);
      const flick = 0.55 + 0.15 * noise1(e.t * 20);
      ctx.globalCompositeOperation = 'lighter';
      if (glitch > 0) {
        // Glitch: the picture slides in slices.
        const n = 10;
        const hh = e.H / n;
        for (let i = 0; i < n; i++) {
          const dx = (Math.random() < 0.5 ? rand(-30, 30) : 0) * e.unit;
          ctx.globalAlpha = flick;
          ctx.drawImage(tmp, 0, i * hh, e.W, hh, dx, i * hh, e.W, hh);
        }
      } else {
        ctx.globalAlpha = flick;
        ctx.drawImage(tmp, 0, 0);
      }
      ctx.globalAlpha = 1;
      // The projector light at your feet.
      const cx = e.seg?.centroid.x ?? e.W / 2;
      drawGlow(ctx, rgb, cx, e.H, e.W * 0.3, 0.5, 0.1);
      ctx.globalCompositeOperation = 'source-over';
      return true;
    },
  };
}
