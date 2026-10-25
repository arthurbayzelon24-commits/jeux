// Render engine: composes the camera frame, the body cut-out (segmentation),
// a learned background plate and the active effect on one canvas.
import { HandTracker, drawHandSkeleton } from './hands.js';
import { BodyTracker } from './body.js';
import { makeCanvas, clamp, smoothstep, drawGlow } from './fx/util.js';

const NOOP_AUDIO = { play() {}, loop() {} };

export class Engine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
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
    this.flashes = [];
    this.lights = [];
    this.seg = null;
    this.maskInverted = 0;
  }

  setEffect(effect) {
    this.effect?.stop?.(this);
    this.effect = effect;
    this.plate = null;
    effect?.start?.(this);
  }

  // Effects call these to make the scene react.
  shake(amount) {
    this.shakeAmp = Math.max(this.shakeAmp, amount * this.unit);
  }
  flash(rgb, alpha = 0.6, decay = 4) {
    this.flashes.push({ rgb, alpha, decay });
  }
  light(x, y, radius, rgb, alpha = 0.3) {
    this.lights.push({ x, y, radius, rgb, alpha });
  }

  #resize(sw, sh) {
    const k = Math.min(1, this.maxSide / Math.max(sw, sh));
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
    this.t += dt;
    this.dt = dt;
    this.#resize(input.sw, input.sh);
    const { ctx, W, H } = this;
    const effect = this.effect;
    if (input.raw) this.hands = this.tracker.update(input.raw, { width: W, height: H, mirror: input.mirror, dt, now });
    // Gesture events only last for the frame of the detection that produced them.
    else {
      for (const h of this.hands) h.events = {};
      // Between camera frames, glide the hands along their motion so the
      // effects move at the screen's refresh rate, not the camera's.
      this.tracker.advance(dt);
    }
    if (input.pose !== undefined) this.body.update(input.pose, { width: W, height: H, mirror: input.mirror, dt });

    this.segActive = !!(effect?.needs?.seg && input.mask);
    if (this.segActive) {
      const L = this.#ensureLayers();
      // Mirrored camera frame.
      const f = L.frame.getContext('2d');
      f.setTransform(input.mirror ? -1 : 1, 0, 0, 1, input.mirror ? W : 0, 0);
      f.drawImage(input.source, 0, 0, W, H);
      f.setTransform(1, 0, 0, 1, 0, 0);
      if (input.maskFresh !== false || !this.seg) this.#processMask(input.mask, input.mirror, !!effect.needs.plate);
      const p = L.person.getContext('2d');
      p.globalCompositeOperation = 'copy';
      p.drawImage(L.frame, 0, 0);
      p.globalCompositeOperation = 'destination-in';
      p.drawImage(this.seg.canvas, 0, 0, W, H);
      p.globalCompositeOperation = 'source-over';
      if (effect.needs.plate) this.#updatePlate();
    }

    this.lights.length = 0;
    effect?.update?.(dt, this.hands, this);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    if (this.shakeAmp > 0.3) {
      const a = this.shakeAmp;
      ctx.setTransform(1.02, 0, 0, 1.02, -W * 0.01 + (Math.random() * 2 - 1) * a, -H * 0.01 + (Math.random() * 2 - 1) * a);
    }
    this.shakeAmp *= Math.exp(-dt * 8);

    const handled = effect?.drawBackground?.(ctx, this);
    if (!handled && this.segActive) ctx.drawImage(this.layers.frame, 0, 0);
    else if (!handled) {
      // No body effect: draw the camera straight in, without a copy.
      ctx.save();
      if (input.mirror) {
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(input.source, 0, 0, W, H);
      ctx.restore();
    }
    if (effect?.drawBehind && this.segActive) {
      effect.drawBehind(ctx, this);
      if (!handled) ctx.drawImage(this.layers.person, 0, 0);
    } else effect?.drawBehind?.(ctx, this);

    // Effect light spilling onto the scene.
    if (this.lights.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (const l of this.lights) drawGlow(ctx, l.rgb, l.x, l.y, l.radius, l.alpha, 0.05);
      ctx.globalCompositeOperation = 'source-over';
    }

    effect?.draw?.(ctx, this);

    // Tracking points: body first, hands (more detailed) on top.
    if (this.settings.points) {
      this.body.draw(ctx, this.unit);
      for (const h of this.hands) drawHandSkeleton(ctx, h);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const fl of this.flashes) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(${fl.rgb[0]},${fl.rgb[1]},${fl.rgb[2]},${clamp(fl.alpha)})`;
      ctx.fillRect(0, 0, W, H);
      fl.alpha -= fl.decay * dt;
    }
    this.flashes = this.flashes.filter((fl) => fl.alpha > 0.01);
    ctx.globalCompositeOperation = 'source-over';
  }
}
