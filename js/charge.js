// Power charge: the longer a power is held, the stronger it gets (effects
// grow with it), until it releases an "ultimate": a huge blast of light,
// shockwaves, rays and lightning in the power's colour.
import { Particles, drawGlow, rand, TAU, makeBolt, strokeBolts, clamp } from './fx/util.js';

const CHARGE_TIME = 6; // seconds of holding to reach full power
const COOLDOWN = 2.5;

export class PowerCharge {
  constructor() {
    this.power = 0;
    this.cooldown = 0;
    this.blast = null;
    this.sparks = new Particles(700);
    this.tint = [255, 190, 90];
  }

  reset() {
    this.power = 0;
    this.cooldown = 0;
    this.blast = null;
    this.sparks.clear();
  }

  // Effects can say what "holding the power" means; default: a hand in view.
  update(dt, e, effect, hands) {
    const main = hands.filter((h) => h.visible && h.presence > 0.6).sort((a, b) => b.size - a.size)[0];
    const holding = effect?.holding ? effect.holding(hands, e) : !!main;
    this.anchor = main ? { x: main.palm.x, y: main.palm.y, r: main.size } : null;
    if (this.cooldown > 0) {
      this.cooldown -= dt;
      this.power = Math.max(0, this.power - dt * 2);
    } else if (holding) this.power = Math.min(1, this.power + dt / (effect?.chargeTime || CHARGE_TIME));
    else this.power = Math.max(0, this.power - dt * 0.5);

    if (this.power >= 1) this.#release(e, effect);

    const p = this.power;
    if (this.anchor && p > 0.05) {
      // Energy gathering around the hand, denser as the charge grows.
      const n = Math.round(p * p * 6);
      for (let i = 0; i < n; i++) {
        const a = rand(TAU);
        const R = this.anchor.r * rand(1.6, 3);
        const x = this.anchor.x + Math.cos(a) * R;
        const y = this.anchor.y + Math.sin(a) * R;
        this.sparks.add({
          x,
          y,
          vx: (this.anchor.x - x) * 2.2,
          vy: (this.anchor.y - y) * 2.2,
          life: 0.45,
          size: rand(2, 4.5) * e.unit,
          rgb: this.tint,
          core: 0.5,
          fadeIn: 0.3,
        });
      }
      if (p > 0.75) e.shake((p - 0.75) * 8);
    }
    e.audio.charge?.(p);

    this.sparks.update(dt);
    if (this.blast) {
      const b = this.blast;
      b.t += dt;
      if (b.t < 0.7 && (b.boltT -= dt) <= 0) {
        b.boltT = 0.05;
        b.bolts = [];
        const L = Math.hypot(e.W, e.H);
        for (let i = 0; i < 7; i++) {
          const a = rand(TAU);
          b.bolts.push(...makeBolt(b.x, b.y, b.x + Math.cos(a) * L, b.y + Math.sin(a) * L, { jag: 0.15, depth: 7, branch: 0.25 }));
        }
      }
      if (b.t > 0.7) b.bolts = [];
      if (b.t > 2) this.blast = null;
    }
  }

  // Effects grow with the charge (1 at rest, up to 1.7 at full power).
  get scale() {
    return 1 + 0.7 * this.power * this.power;
  }

  #release(e, effect) {
    const a = this.anchor || { x: e.W / 2, y: e.H / 2, r: Math.min(e.W, e.H) * 0.15 };
    this.power = 0;
    this.cooldown = COOLDOWN;
    this.blast = { x: a.x, y: a.y, t: 0, boltT: 0, bolts: [], rot: rand(TAU) };
    for (let i = 0; i < 320; i++) {
      const ang = rand(TAU);
      const v = rand(300, 2200) * e.unit;
      this.sparks.add({
        x: a.x,
        y: a.y,
        vx: Math.cos(ang) * v,
        vy: Math.sin(ang) * v,
        drag: 1.6,
        life: rand(0.6, 1.6),
        size: rand(3, 10) * e.unit,
        rgb: Math.random() < 0.3 ? [255, 255, 255] : this.tint,
        core: 0.4,
      });
    }
    e.flash([255, 255, 255], 0.95, 1.6);
    e.flash(this.tint, 0.6, 0.8);
    e.shake(45);
    e.punch(0.12);
    e.audio.play('boom', 1);
    e.audio.play('thunder', 1);
    e.audio.play('whoosh', 1);
    effect?.ultimate?.(e, a);
  }

  draw(ctx, e) {
    const p = this.power;
    // Charge ring around the hand: fills up clockwise, pulses near the end.
    if (this.anchor && p > 0.02 && this.cooldown <= 0) {
      const { x, y, r } = this.anchor;
      const R = r * (1.7 + 0.15 * Math.sin(e.t * (4 + p * 12)) * p);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(${this.tint.join(',')},0.18)`;
      ctx.lineWidth = 10 * e.unit;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, TAU);
      ctx.stroke();
      for (const [w, a] of [
        [14, 0.25],
        [5, 0.9],
      ]) {
        ctx.strokeStyle = `rgba(${this.tint.map((v) => Math.min(255, v + 60)).join(',')},${a})`;
        ctx.lineWidth = w * e.unit;
        ctx.beginPath();
        ctx.arc(x, y, R, -Math.PI / 2, -Math.PI / 2 + TAU * p);
        ctx.stroke();
      }
      const tip = -Math.PI / 2 + TAU * p;
      drawGlow(ctx, [255, 255, 255], x + Math.cos(tip) * R, y + Math.sin(tip) * R, 16 * e.unit, 0.9);
      // The whole frame glows at the edges as power builds.
      if (p > 0.3) {
        const g = ctx.createRadialGradient(e.W / 2, e.H / 2, Math.min(e.W, e.H) * 0.35, e.W / 2, e.H / 2, Math.hypot(e.W, e.H) * 0.6);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, `rgba(${this.tint.join(',')},${clamp((p - 0.3) * 0.5, 0, 0.35)})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, e.W, e.H);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (this.blast) {
      const b = this.blast;
      const L = Math.hypot(e.W, e.H);
      ctx.globalCompositeOperation = 'lighter';
      // Light rays spinning out of the centre.
      const fade = clamp(1 - b.t / 1.4);
      if (fade > 0) {
        for (let i = 0; i < 18; i++) {
          const a = b.rot + (i / 18) * TAU + b.t * 0.6;
          const w = 0.05;
          const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, L);
          grad.addColorStop(0, `rgba(255,255,255,${0.5 * fade})`);
          grad.addColorStop(0.3, `rgba(${this.tint.join(',')},${0.25 * fade})`);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(b.x, b.y);
          ctx.lineTo(b.x + Math.cos(a - w) * L, b.y + Math.sin(a - w) * L);
          ctx.lineTo(b.x + Math.cos(a + w) * L, b.y + Math.sin(a + w) * L);
          ctx.closePath();
          ctx.fill();
        }
      }
      // Three shockwaves.
      for (let k = 0; k < 3; k++) {
        const t = (b.t - k * 0.15) / 1.1;
        if (t <= 0 || t >= 1) continue;
        const R = t * L * 0.75;
        for (const [w, a] of [
          [40, 0.15],
          [12, 0.5],
          [3, 1],
        ]) {
          ctx.strokeStyle = `rgba(${k === 1 ? '255,255,255' : this.tint.join(',')},${a * (1 - t)})`;
          ctx.lineWidth = w * e.unit * (1 - t * 0.5);
          ctx.beginPath();
          ctx.arc(b.x, b.y, R, 0, TAU);
          ctx.stroke();
        }
      }
      if (b.t < 0.5) drawGlow(ctx, [255, 255, 255], b.x, b.y, L * 0.35 * (1 - b.t * 2) + 1, 0.9, 0.2);
      ctx.globalCompositeOperation = 'source-over';
      strokeBolts(ctx, b.bolts, this.tint, 2.5 * e.unit, 1);
    }
    this.sparks.draw(ctx);
  }
}
