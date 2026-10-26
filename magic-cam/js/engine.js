// Render engine: composes the camera frame, the body cut-out (segmentation),
// a learned background plate and the active effect on one canvas.
import { HandTracker, drawHandSkeleton } from './hands.js';
import { BodyTracker } from './body.js';
import { PowerCharge } from './charge.js';
import { makeCanvas, clamp, smoothstep, drawGlow } from './fx/util.js';

const NOOP_AUDIO = { play() {}, loop() {} };

export class Engine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    // desynchronized: lower latency between drawing and the screen.
    // Not 'desynchronized': that low-latency mode can freeze or tear the
    // frames captured for the recording on some phones.
    this.ctx = canvas.getContext('2d', { alpha: false });
    // Adaptive resolution factor (lowered when the device cannot keep up).
    this.renderScale = 1;
    this.tracker = new HandTracker();
    this.body = new BodyTracker();
    this.effect = null;
    this.hands = [];
    this.audio = options.audio || NOOP_AUDIO;
    this.settings = options.settings || { points: false, cinema: true };
    this.maxSide = options.maxSide || 1280;
    this.W = canvas.width;
    this.H = canvas.height;
    this.t = 0;
    this.last = 0;
    this.shakeAmp = 0;
    this.zoom = 1;
    this.charge = new PowerCharge();
    this.flashes = [];
    this.lights = [];
    this.mechanics = [];
    this.userZoom = 1;
    // Magic slow motion: the powers move slower (you do not). 1 = normal.
    this.timeScale = 1;
    this.slowTarget = 1;
    // Loudness of your voice (0..1): shouting makes the powers bigger.
    this.voice = 0;
    // Fade to black (start / end of a recording): current and target opacity.
    this.fadeAlpha = 0;
    this.fadeTarget = 0;
    this.fadeSpeed = 2;
    this.seg = null;
    this.maskInverted = 0;
  }

  // Runs an effect step; a bug in one power never freezes the app.
  #safe(name, ...args) {
    const fn = this.effect?.[name];
    if (!fn) return undefined;
    try {
      return fn.apply(this.effect, args);
    } catch (err) {
      const key = `${this.effect.id}:${name}`;
      if (!this.reported?.has(key)) {
        (this.reported ||= new Set()).add(key);
        console.error(`Effet « ${this.effect.id} » (${name}) :`, err);
      }
      return undefined;
    }
  }

  setEffect(effect) {
    this.reported = null;
    this.effect?.stop?.(this);
    this.effect = effect;
    this.plate = null;
    this.charge.reset();
    effect?.start?.(this);
  }

  // Game mechanics (arena, runes, quests...) layered over any power. Each one
  // may have update(dt, hands, engine), draw(ctx, engine) and reset().
  addMechanic(m) {
    if (!this.mechanics.includes(m)) this.mechanics.push(m);
  }
  removeMechanic(m) {
    this.mechanics = this.mechanics.filter((x) => x !== m);
  }
  #runMechanics(name, ...args) {
    for (const m of this.mechanics) {
      try {
        m[name]?.(...args);
      } catch (err) {
        console.error(`Mécanique (${name}) :`, err);
      }
    }
  }

  // Tiny event bus: 'ultimate', 'spell', 'hit'... listened to by mechanics
  // and by the progression system.
  on(name, fn) {
    ((this.listeners ||= {})[name] ||= []).push(fn);
    return () => (this.listeners[name] = this.listeners[name].filter((f) => f !== fn));
  }
  emit(name, data) {
    for (const fn of this.listeners?.[name] || []) {
      try {
        fn(data, this);
      } catch (err) {
        console.error(err);
      }
    }
  }

  // Where the power is on screen: a small brightness map of the effects
  // layer (1/8 size), refreshed at most every 80 ms. Lets the arena know
  // that a beam, a fireball or lightning touches a target, whatever the power.
  heatAt(x, y) {
    const lv = this.fx?.levels?.[1];
    if (!lv || this.settings.bloom === false) return 0;
    const now = this.t;
    if (!this.heat || now - this.heat.t > 0.08) {
      try {
        const { width, height } = lv.canvas;
        this.heat = { t: now, w: width, h: height, data: lv.ctx.getImageData(0, 0, width, height).data };
      } catch {
        return 0;
      }
    }
    const { w, h, data } = this.heat;
    const px = Math.floor((x / this.W) * w);
    const py = Math.floor((y / this.H) * h);
    if (px < 0 || py < 0 || px >= w || py >= h) return 0;
    const i = (py * w + px) * 4;
    // Brightness weighted by coverage.
    return ((data[i] + data[i + 1] + data[i + 2]) / 765) * (data[i + 3] / 255);
  }

  // Fade the picture to black (1) or back (0) over `seconds`.
  fade(to, seconds = 0.5) {
    this.fadeTarget = to;
    this.fadeSpeed = 1 / Math.max(0.05, seconds);
  }

  // Effects call these to make the scene react.
  // A quick zoom "punch" (decays back to 1).
  punch(amount) {
    this.zoom = Math.max(this.zoom, 1 + amount);
  }
  shake(amount) {
    this.shakeAmp = Math.max(this.shakeAmp, amount * this.unit);
    // Big impacts are felt too (phones that can vibrate).
    if (amount >= 15) this.buzz(Math.min(90, amount * 2));
  }
  buzz(ms) {
    if (this.settings.haptics === false || !navigator.vibrate) return;
    const now = performance.now();
    if (now - (this.lastBuzz || 0) < 120) return;
    this.lastBuzz = now;
    try {
      navigator.vibrate(ms);
    } catch {
      /* not allowed */
    }
  }
  flash(rgb, alpha = 0.6, decay = 4) {
    this.flashes.push({ rgb, alpha, decay });
  }
  light(x, y, radius, rgb, alpha = 0.3) {
    this.lights.push({ x, y, radius, rgb, alpha });
  }

  #resize(sw, sh) {
    let k = Math.min(1, this.maxSide / Math.max(sw, sh)) * this.renderScale;
    // Browsers cap canvas sizes (iPhone/iPad far lower than computers).
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const maxArea = ios ? 16e6 : 2.6e8;
    if (sw * k * sh * k > maxArea) k = Math.sqrt(maxArea / (sw * sh));
    k = Math.min(k, 32767 / Math.max(sw, sh));
    const W = Math.round(sw * k);
    const H = Math.round(sh * k);
    if (W !== this.canvas.width || H !== this.canvas.height) {
      this.canvas.width = W;
      this.canvas.height = H;
      this.layers = null;
      this.plate = null;
    }
    this.W = W;
    this.H = H;
    this.unit = Math.min(W, H) / 720;
  }

  // Draws the real hands (camera pixels inside the hand outlines) over
  // whatever was drawn, so fingers pass in front of holograms.
  occludeHands(ctx) {
    const hands = this.hands.filter((h) => h.presence > 0.3);
    if (!hands.length || !this.src) return;
    const { W, H } = this;
    if (!this.occl || this.occl.width !== W || this.occl.height !== H) this.occl = makeCanvas(W, H);
    const g = this.occl.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#fff';
    g.strokeStyle = '#fff';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const h of hands) {
      const P = h.lm;
      g.beginPath();
      [0, 1, 2, 5, 9, 13, 17].forEach((i, k) => (k ? g.lineTo(P[i].x, P[i].y) : g.moveTo(P[i].x, P[i].y)));
      g.closePath();
      g.lineWidth = h.size * 0.3;
      g.fill();
      g.stroke();
      for (const [ids, w] of [
        [[1, 2, 3, 4], 0.24],
        [[5, 6, 7, 8], 0.2],
        [[9, 10, 11, 12], 0.21],
        [[13, 14, 15, 16], 0.19],
        [[17, 18, 19, 20], 0.16],
      ]) {
        g.lineWidth = h.size * w;
        g.beginPath();
        ids.forEach((i, k) => (k ? g.lineTo(P[i].x, P[i].y) : g.moveTo(P[i].x, P[i].y)));
        g.stroke();
      }
    }
    g.globalCompositeOperation = 'source-in';
    if (this.src.mirror) g.setTransform(-1, 0, 0, 1, W, 0);
    g.drawImage(this.src.source, 0, 0, W, H);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.occl, 0, 0);
  }

  #frameBlend(input) {
    if (this.settings.frameBlend === false || !input.camInterval) return null;
    // Only useful when the screen refreshes clearly faster than the camera.
    if (input.camInterval < this.dt * 1000 * 1.4) return null;
    // Half resolution is plenty for a fading ghost, and 4x cheaper.
    const bw = Math.round(this.W / 2);
    const bh = Math.round(this.H / 2);
    if (!this.blend || this.blend.cur.width !== bw || this.blend.cur.height !== bh)
      this.blend = { cur: makeCanvas(bw, bh), prev: makeCanvas(bw, bh), ok: false };
    const b = this.blend;
    if (input.newFrame) {
      [b.cur, b.prev] = [b.prev, b.cur];
      b.cur.getContext('2d').drawImage(input.source, 0, 0, bw, bh);
      b.ok = b.hasPrev;
      b.hasPrev = true;
    }
    if (!b.ok) return null;
    const t = clamp(input.frameAge / input.camInterval);
    const alpha = 0.5 * (1 - t);
    return alpha > 0.02 ? { canvas: b.prev, alpha } : null;
  }

  #fxLayer() {
    const { W, H } = this;
    if (this.fx?.canvas.width === W && this.fx.canvas.height === H) return this.fx;
    const layer = (w, h) => {
      const canvas = makeCanvas(w, h);
      return { canvas, ctx: canvas.getContext('2d') };
    };
    const base = layer(W, H);
    this.fx = { ...base, trail: layer(W, H), levels: [4, 8, 16].map((d) => layer(W / d, H / d)) };
    return this.fx;
  }

  #ensureLayers() {
    // Full-size copies are only needed for body effects (segmentation).
    if (this.layers) return this.layers;
    const { W, H } = this;
    this.layers = { frame: makeCanvas(W, H), person: makeCanvas(W, H) };
    return this.layers;
  }

  // Builds the mirrored person mask and its statistics from a confidence mask.
  #processMask(mask, mirror, withBackground) {
    const { width: mw, height: mh, data } = mask;
    if (!this.seg || this.seg.mw !== mw || this.seg.mh !== mh) {
      const canvas = makeCanvas(mw, mh);
      const bgCanvas = makeCanvas(mw, mh);
      this.seg = {
        mw,
        mh,
        canvas,
        bgCanvas,
        cctx: canvas.getContext('2d'),
        bctx: bgCanvas.getContext('2d'),
        img: new ImageData(mw, mh),
        bgImg: new ImageData(mw, mh),
        alpha: new Float32Array(mw * mh),
        tmp: new Float32Array(mw * mh),
        edges: [],
      };
    }
    const s = this.seg;

    // Some models output background confidence: detect it from the frame
    // corners (almost always background) versus the centre.
    let corner = 0;
    let centre = 0;
    const cs = Math.max(2, (mw * 0.1) | 0);
    for (let y = 0; y < cs; y++) for (let x = 0; x < cs; x++) corner += data[y * mw + x] + data[y * mw + (mw - 1 - x)];
    corner /= cs * cs * 2;
    for (let y = (mh * 0.4) | 0; y < mh * 0.6; y++) centre += data[y * mw + (mw >> 1)];
    centre /= Math.max(1, (mh * 0.2) | 0);
    if (Math.abs(corner - centre) > 0.4) this.maskInverted = clamp(this.maskInverted + (corner > centre ? 0.1 : -0.1), -1, 1);
    const invert = this.maskInverted > 0.3;

    const A = s.alpha;
    let sx = 0;
    let sy = 0;
    let n = 0;
    let minY = mh;
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        let v = data[y * mw + x];
        if (invert) v = 1 - v;
        const dx = mirror ? mw - 1 - x : x;
        const i = y * mw + dx;
        A[i] = v;
        const a = smoothstep(0.3, 0.7, v);
        s.img.data[i * 4] = 255;
        s.img.data[i * 4 + 1] = 255;
        s.img.data[i * 4 + 2] = 255;
        s.img.data[i * 4 + 3] = a * 255;
        if (v > 0.5) {
          sx += dx;
          sy += y;
          n++;
          if (y < minY) minY = y;
        }
      }
    }
    s.cctx.putImageData(s.img, 0, 0);

    // Dilated person mask -> where the background is safely visible.
    if (withBackground) this.#backgroundMask(s);

    // Silhouette outline points (in canvas pixels) for aura flames etc.
    const kx = this.W / mw;
    const ky = this.H / mh;
    s.edges.length = 0;
    for (let y = 1; y < mh - 1; y += 2)
      for (let x = 1; x < mw - 1; x += 2) {
        const i = y * mw + x;
        if (A[i] > 0.5 && (A[i - 1] < 0.5 || A[i + 1] < 0.5 || A[i - mw] < 0.5 || A[i + mw] < 0.5)) s.edges.push({ x: x * kx, y: y * ky });
      }
    s.area = n / (mw * mh);
    s.present = s.area > 0.02;
    s.centroid = n ? { x: (sx / n) * kx, y: (sy / n) * ky } : { x: this.W / 2, y: this.H / 2 };
    s.top = minY * ky;
    s.kx = kx;
    s.ky = ky;
  }

  #backgroundMask(s) {
    const { mw, mh, alpha: A, tmp: T } = s;
    const R = 3;
    for (let y = 0; y < mh; y++)
      for (let x = 0; x < mw; x++) {
        let m = 0;
        for (let k = -R; k <= R; k++) {
          const xx = x + k;
          if (xx >= 0 && xx < mw && A[y * mw + xx] > m) m = A[y * mw + xx];
        }
        T[y * mw + x] = m;
      }
    for (let x = 0; x < mw; x++)
      for (let y = 0; y < mh; y++) {
        let m = 0;
        for (let k = -R; k <= R; k++) {
          const yy = y + k;
          if (yy >= 0 && yy < mh && T[yy * mw + x] > m) m = T[yy * mw + x];
        }
        s.bgImg.data[(y * mw + x) * 4 + 3] = (1 - smoothstep(0.15, 0.5, m)) * 255;
      }
    s.bctx.putImageData(s.bgImg, 0, 0);
  }

  // Person confidence at a canvas pixel (0 when no segmentation).
  personAt(x, y) {
    const s = this.seg;
    if (!s || !this.segActive) return 0;
    const mx = Math.min(s.mw - 1, Math.max(0, (x / s.kx) | 0));
    const my = Math.min(s.mh - 1, Math.max(0, (y / s.ky) | 0));
    return s.alpha[my * s.mw + mx];
  }

  #updatePlate() {
    const { W, H } = this;
    const pw = Math.round(W / 2);
    const ph = Math.round(H / 2);
    if (!this.plate) {
      this.plate = {
        canvas: makeCanvas(pw, ph),
        bg: makeCanvas(pw, ph),
        fill: makeCanvas(pw, ph),
        levels: [16, 32, 64].map((d) => makeCanvas(W / d, H / d)),
        tiny: makeCanvas(W / 96, H / 96),
      };
      this.plate.learned = 0;
    }
    const p = this.plate;
    const b = p.bg.getContext('2d');
    b.globalCompositeOperation = 'copy';
    b.drawImage(this.layers.frame, 0, 0, pw, ph);
    b.globalCompositeOperation = 'destination-in';
    b.drawImage(this.seg.bgCanvas, 0, 0, pw, ph);
    b.globalCompositeOperation = 'source-over';
    // Seen background replaces the plate; hidden areas keep what was learned.
    p.canvas.getContext('2d').drawImage(p.bg, 0, 0);
    p.learned = Math.min(1, p.learned + 0.02);
  }

  // Learned background with never-seen holes filled from blurred surroundings.
  backgroundPlate() {
    const p = this.plate;
    if (!p) return this.layers.frame;
    let prev = p.canvas;
    for (const level of p.levels) {
      const g = level.getContext('2d');
      g.clearRect(0, 0, level.width, level.height);
      g.drawImage(prev, 0, 0, level.width, level.height);
      prev = level;
    }
    const f = p.fill.getContext('2d');
    // Base for areas never seen at all: a very blurred frame (no visible person).
    const t = p.tiny.getContext('2d');
    t.drawImage(this.layers.frame, 0, 0, p.tiny.width, p.tiny.height);
    f.globalCompositeOperation = 'copy';
    f.drawImage(p.tiny, 0, 0, p.fill.width, p.fill.height);
    f.globalCompositeOperation = 'source-over';
    // Coarsest first; each finer level is drawn on top, so holes show the blur.
    for (let i = p.levels.length - 1; i >= 0; i--)
      for (let k = 0; k < 4 - i; k++) f.drawImage(p.levels[i], 0, 0, p.fill.width, p.fill.height);
    f.drawImage(p.canvas, 0, 0);
    return p.fill;
  }

  // One frame. input: { source, sw, sh, mirror, raw, mask, now }
  frame(input) {
    const now = input.now;
    const dt = this.last ? clamp((now - this.last) / 1000, 1 / 240, 0.1) : 1 / 60;
    this.last = now;
    this.timeScale += (this.slowTarget - this.timeScale) * (1 - Math.exp(-dt * 6));
    // The powers live in their own time (slowed in magic slow motion).
    const fdt = dt * this.timeScale;
    this.voice = input.voice || 0;
    this.t += fdt;
    this.dt = fdt;
    this.#resize(input.sw, input.sh);
    const { ctx, W, H } = this;
    const effect = this.effect;
    this.src = { source: input.source, mirror: input.mirror };
    if (input.raw) this.hands = this.tracker.update(input.raw, { width: W, height: H, mirror: input.mirror, dt, now });
    // Gesture events only last for the frame of the detection that produced them.
    else {
      for (const h of this.hands) h.events = {};
      // Between camera frames, glide the hands along their motion so the
      // effects move at the screen's refresh rate, not the camera's.
      this.tracker.advance(dt);
    }
    // A finger snap heard by the microphone counts for a hand that was just
    // holding the snap pose (thumb on the middle finger).
    if (input.micSnap) for (const h of this.hands) if (h.snapPrime && now - h.snapPrime < 700) h.events = { ...h.events, snap: true };
    if (input.pose !== undefined) this.body.update(input.pose, { width: W, height: H, mirror: input.mirror, dt });
    else this.body.advance(dt);

    this.segActive = !!(effect?.needs?.seg && input.mask);
    // Points mode without a body power: the silhouette is still needed for
    // the point cloud.
    if (!this.segActive && this.settings.points && input.mask && input.maskFresh !== false)
      this.#processMask(input.mask, input.mirror, false);
    if (this.segActive) {
      const L = this.#ensureLayers();
      // Mirrored camera frame.
      const f = L.frame.getContext('2d');
      f.setTransform(input.mirror ? -1 : 1, 0, 0, 1, input.mirror ? W : 0, 0);
      f.drawImage(input.source, 0, 0, W, H);
      f.setTransform(1, 0, 0, 1, 0, 0);
      if (input.maskFresh !== false || !this.seg) this.#processMask(input.mask, input.mirror, !!effect?.needs?.plate);
      const p = L.person.getContext('2d');
      p.globalCompositeOperation = 'copy';
      p.drawImage(L.frame, 0, 0);
      p.globalCompositeOperation = 'destination-in';
      p.drawImage(this.seg.canvas, 0, 0, W, H);
      p.globalCompositeOperation = 'source-over';
      if (effect?.needs?.plate) this.#updatePlate();
    }

    this.lights.length = 0;
    // Charging makes the power bigger: effects see the hands scaled up.
    const realHands = this.hands;
    this.charge.update(fdt, this, effect, realHands);
    // Charge, your voice and the chosen power size (Paramètres) make the
    // powers bigger.
    const k = this.charge.scale * (Number(this.settings.powerSize) || 1) * (1 + 0.6 * this.voice);
    this.hands = Math.abs(k - 1) > 0.01 ? realHands.map((h) => Object.create(h, { size: { value: h.size * k } })) : realHands;
    this.#safe('update', fdt, this.hands, this);
    this.#runMechanics('update', fdt, realHands, this);
    if (this.voice > 0.75) this.shakeAmp = Math.max(this.shakeAmp, 4 * this.voice);
    // Shouting: the hands glow with power.
    if (this.voice > 0.25)
      for (const h of realHands)
        if (h.presence > 0.5) this.light(h.palm.x, h.palm.y, h.size * (3 + 4 * this.voice), [255, 150, 60], 0.35 * this.voice);

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    // Camera shake and zoom punch, around the centre.
    // userZoom: the zoom you choose (pinch / wheel); zoom: the effects' punch.
    const z = this.zoom * this.userZoom * (this.shakeAmp > 0.3 ? 1.02 : 1);
    const a = this.shakeAmp > 0.3 ? this.shakeAmp : 0;
    const m = [z, 0, 0, z, (W * (1 - z)) / 2 + (Math.random() * 2 - 1) * a, (H * (1 - z)) / 2 + (Math.random() * 2 - 1) * a];
    // Zoomed out further than the camera sees: the image gets smaller in the
    // middle, and the edges are filled with a soft blur of it (like the
    // blurred bars of video apps), so the whole frame stays filled.
    if (z < 0.999) {
      const b = (this.zoomFill ||= makeCanvas(32, 18));
      const bg = b.getContext('2d');
      bg.save();
      if (input.mirror) bg.setTransform(-1, 0, 0, 1, b.width, 0);
      bg.drawImage(input.source, 0, 0, b.width, b.height);
      bg.restore();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingQuality = 'low';
      ctx.drawImage(b, -W * 0.1, -H * 0.1, W * 1.2, H * 1.2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.setTransform(...m);
    this.shakeAmp *= Math.exp(-dt * 8);
    this.zoom = 1 + (this.zoom - 1) * Math.exp(-dt * 5);

    const handled = this.#safe('drawBackground', ctx, this);
    if (!handled && this.segActive) ctx.drawImage(this.layers.frame, 0, 0);
    else if (!handled) {
      // No body effect: draw the camera straight in, without a copy.
      ctx.save();
      if (input.mirror) {
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(input.source, 0, 0, W, H);
      // Camera slower than the screen: the previous camera frame fades out
      // over the new one, so your own motion glides instead of jumping.
      const blend = this.#frameBlend(input);
      if (blend) {
        ctx.globalAlpha = blend.alpha;
        ctx.drawImage(blend.canvas, 0, 0, W, H);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
    if (effect?.drawBehind && this.segActive) {
      this.#safe('drawBehind', ctx, this);
      if (!handled) ctx.drawImage(this.layers.person, 0, 0);
    } else this.#safe('drawBehind', ctx, this);
    this.#grade(ctx, W, H);

    // Effect light spilling onto the scene.
    if (this.lights.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (const l of this.lights) drawGlow(ctx, l.rgb, l.x, l.y, l.radius, l.alpha, 0.05);
      ctx.globalCompositeOperation = 'source-over';
    }

    // Effects are drawn on their own layer, then composited with a bloom
    // (soft glow around everything bright), like in films and games.
    if (this.settings.bloom !== false) {
      const fx = this.#fxLayer();
      fx.ctx.setTransform(1, 0, 0, 1, 0, 0);
      fx.ctx.clearRect(0, 0, W, H);
      fx.ctx.setTransform(...m);
      this.#safe('draw', fx.ctx, this);
      this.charge.draw(fx.ctx, this);
      fx.ctx.setTransform(1, 0, 0, 1, 0, 0);
      // Motion blur: the previous frames fade out behind the new one, so fast
      // effects leave a short streak like a real camera.
      let out = fx.canvas;
      if (this.settings.motionBlur !== false && !effect?.noBlur) {
        const tr = fx.trail.ctx;
        tr.globalCompositeOperation = 'destination-out';
        tr.fillStyle = 'rgba(0,0,0,0.62)';
        tr.fillRect(0, 0, W, H);
        tr.globalCompositeOperation = 'source-over';
        tr.drawImage(fx.canvas, 0, 0);
        out = fx.trail.canvas;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.drawImage(out, 0, 0);
      // Downsample chain: each smaller copy, scaled back up, is a wider blur.
      let prev = out;
      for (const level of fx.levels) {
        level.ctx.clearRect(0, 0, level.canvas.width, level.canvas.height);
        level.ctx.drawImage(prev, 0, 0, level.canvas.width, level.canvas.height);
        prev = level.canvas;
      }
      ctx.globalCompositeOperation = 'lighter';
      fx.levels.forEach((level, i) => {
        ctx.globalAlpha = [0.4, 0.35, 0.3][i];
        ctx.drawImage(level.canvas, 0, 0, W, H);
      });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.setTransform(...m);
    } else {
      this.#safe('draw', ctx, this);
      this.charge.draw(ctx, this);
    }
    this.hands = realHands;
    // Holograms sit behind the real fingers: redraw the hands on top.
    if (effect?.occlude) this.occludeHands(ctx);
    this.#safe('drawOver', ctx, this);

    // Tracking points: body first, hands (more detailed) on top.
    if (this.settings.points) {
      this.#pointCloud(ctx);
      this.body.draw(ctx, this.unit);
      for (const h of this.hands) drawHandSkeleton(ctx, h);
    }
    this.#runMechanics('draw', ctx, this);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const fl of this.flashes) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(${fl.rgb[0]},${fl.rgb[1]},${fl.rgb[2]},${clamp(fl.alpha)})`;
      ctx.fillRect(0, 0, W, H);
      fl.alpha -= fl.decay * dt;
    }
    this.flashes = this.flashes.filter((fl) => fl.alpha > 0.01);
    ctx.globalCompositeOperation = 'source-over';
    this.#lookOverlay(ctx, W, H);
    if (this.fadeAlpha !== this.fadeTarget) {
      const step = this.fadeSpeed * dt;
      this.fadeAlpha =
        this.fadeAlpha < this.fadeTarget
          ? Math.min(this.fadeTarget, this.fadeAlpha + step)
          : Math.max(this.fadeTarget, this.fadeAlpha - step);
    }
    if (this.fadeAlpha > 0.003) {
      ctx.fillStyle = `rgba(0,0,0,${this.fadeAlpha})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // Body point cloud: a dense grid of points over the whole silhouette (from
  // the segmentation), spaced so that a person in frame carries more than
  // 100 000 points, with a scan line sweeping down the body.
  #pointCloud(ctx) {
    const s = this.seg;
    if (!s?.present || !s.canvas) {
      this.cloudCount = 0;
      return;
    }
    const { W, H } = this;
    const body = s.area * W * H;
    // As many points as the image can show, up to 1 million: at most one
    // point every other pixel (a checkerboard), finer than that the points
    // would merge into a flat colour. The count shown is the real one.
    const step = Math.max(1, Math.min(4, Math.floor(Math.sqrt(body / 1e6))));
    const checker = step === 1;
    const perPx = checker ? 0.5 : 1 / (step * step);
    this.cloudCount = Math.round(body * perPx);
    const key = checker ? 'c' : step;
    if (!this.cloud || this.cloud.canvas.width !== W || this.cloud.canvas.height !== H || this.cloud.key !== key) {
      // Tile of points, repeated over the screen (one fill, whatever the count).
      const n = checker ? 2 : step * 4;
      const t = makeCanvas(n, n);
      const tg = t.getContext('2d');
      tg.fillStyle = '#fff';
      if (checker) {
        tg.fillRect(0, 0, 1, 1);
        tg.fillRect(1, 1, 1, 1);
      } else for (let y = 0; y < n; y += step) for (let x = 0; x < n; x += step) tg.fillRect(x, y, 1, 1);
      const canvas = makeCanvas(W, H);
      const c = canvas.getContext('2d');
      this.cloud = { canvas, c, key, pattern: c.createPattern(t, 'repeat') };
    }
    const { c, canvas, pattern } = this.cloud;
    c.globalCompositeOperation = 'copy';
    c.fillStyle = pattern;
    c.fillRect(0, 0, W, H);
    // Scan line: a brighter band moving down the body.
    c.globalCompositeOperation = 'source-atop';
    const y = ((this.t * 0.35) % 1.2) * H - H * 0.1;
    const g = c.createLinearGradient(0, y - H * 0.08, 0, y + H * 0.08);
    g.addColorStop(0, 'rgba(120,230,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(120,230,255,0)');
    c.fillStyle = 'rgba(80,200,255,1)';
    c.fillRect(0, 0, W, H);
    c.fillStyle = g;
    c.fillRect(0, y - H * 0.08, W, H * 0.16);
    // Keep only the points on the body.
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(s.canvas, 0, 0, W, H);
    c.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = this.cloud.key === 'c' ? 0.42 : 0.55;
    ctx.drawImage(canvas, 0, 0);
    ctx.restore();
  }

  // Image look (studio filter button): colour grade of the filmed scene,
  // under the effects so the powers keep their own colours. Blend-mode fills
  // only, which are cheap and work in every browser (ctx.filter does not).
  #grade(ctx, W, H) {
    const look = this.look;
    if (!look || look === 'normal') return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const fill = (op, color, alpha = 1) => {
      ctx.globalCompositeOperation = op;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, W, H);
    };
    if (look === 'cinema') {
      fill('soft-light', 'rgb(0,90,110)', 0.55);
      fill('soft-light', 'rgb(255,150,60)', 0.25);
    } else if (look === 'neon') {
      fill('saturation', 'rgb(255,0,0)', 0.55);
      fill('multiply', 'rgb(120,60,170)', 0.45);
      fill('screen', 'rgb(40,0,60)', 0.5);
    } else if (look === 'vintage') {
      fill('color', 'rgb(160,120,70)', 0.55);
      fill('screen', 'rgb(60,40,20)', 0.35);
      fill('multiply', 'rgb(255,235,200)', 0.6);
    } else if (look === 'noir') {
      fill('saturation', '#000');
      fill('soft-light', '#000', 0.5);
    } else if (look === 'pop') {
      // Vivid colours, like a music video.
      fill('saturation', 'rgb(255,0,0)', 0.35);
      fill('soft-light', 'rgb(255,255,255)', 0.25);
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, 'rgb(255,80,140)');
      g.addColorStop(1, 'rgb(60,140,255)');
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    } else if (look === 'sunset') {
      // Golden hour: warm orange below, pink and violet above.
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgb(150,70,220)');
      g.addColorStop(0.5, 'rgb(255,90,120)');
      g.addColorStop(1, 'rgb(255,170,60)');
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      fill('screen', 'rgb(60,20,10)', 0.3);
    }
    ctx.restore();
  }

  #lookOverlay(ctx, W, H) {
    const look = this.look;
    if (look === 'cinema') {
      // Wide-screen 2.39:1 bars.
      const bar = Math.max(0, (H - W / 2.39) / 2);
      if (bar > 0) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, bar);
        ctx.fillRect(0, H - bar, W, bar);
      }
    } else if (look === 'vintage' || look === 'noir') {
      // Film grain: a small noise tile, moved every frame.
      if (!this.grain) {
        const c = makeCanvas(128, 128);
        const g = c.getContext('2d');
        const img = g.createImageData(128, 128);
        for (let i = 0; i < img.data.length; i += 4) {
          const v = Math.random() * 255;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
          img.data[i + 3] = 255;
        }
        g.putImageData(img, 0, 0);
        this.grain = ctx.createPattern(c, 'repeat');
      }
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = look === 'noir' ? 0.16 : 0.12;
      ctx.translate((Math.random() * 128) | 0, (Math.random() * 128) | 0);
      ctx.fillStyle = this.grain;
      ctx.fillRect(-128, -128, W + 128, H + 128);
      ctx.restore();
    }
  }
}
