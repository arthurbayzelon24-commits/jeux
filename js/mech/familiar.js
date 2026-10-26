// Familiar: a little creature that follows your hand with every power and
// grows with your level (wisp from level 2, dragon from 5, phoenix from 10).
// It cheers on final blasts and, in the arena, flies off to hit targets.
import { Particles, drawGlow, rand, TAU, clamp } from '../fx/util.js';

export const FORMS = [
  { level: 2, id: 'wisp', name: 'Feu follet' },
  { level: 5, id: 'dragon', name: 'Petit dragon' },
  { level: 10, id: 'phoenix', name: 'Phénix' },
];
export const formFor = (level) => [...FORMS].reverse().find((f) => level >= f.level) || null;

export class Familiar {
  constructor() {
    this.fx = new Particles(400);
    this.pos = null;
    this.vel = { x: 0, y: 0 };
    this.trail = [];
    this.form = null;
    this.mood = 0; // > 0: happy spin
    this.attackT = 2;
    this.target = null;
    this.subscribed = false;
  }

  setLevel(level) {
    this.form = formFor(level);
  }

  #listen(e) {
    if (this.subscribed) return;
    this.subscribed = true;
    e.on('ultimate', () => (this.mood = 1.5));
    e.on('spell', (s) => s.main && (this.mood = Math.max(this.mood, 0.8)));
  }

  update(dt, hands, e) {
    if (!this.form) return;
    this.#listen(e);
    this.fx.update(dt);
    this.mood = Math.max(0, this.mood - dt);
    const s = 24 * e.unit;
    const h = hands.filter((x) => x.presence > 0.4).sort((a, b) => b.size - a.size)[0];
    // Where it wants to be: hovering beside the hand, or drifting around.
    let goal = h
      ? { x: h.palm.x + h.size * 1.6 * (h.palm.x > e.W / 2 ? -1 : 1), y: h.palm.y - h.size * 1.4 + Math.sin(e.t * 2) * s }
      : { x: e.W * (0.5 + 0.3 * Math.cos(e.t * 0.4)), y: e.H * (0.35 + 0.1 * Math.sin(e.t * 0.7)) };
    // Arena helper: every few seconds it dives at the nearest target.
    const arena = e.mechanics.find((m) => m.hitNear && m.state === 'play');
    this.attackT -= dt;
    if (arena && this.attackT <= 0 && !this.target && this.pos) {
      const t = arena.nearestTarget(this.pos.x, this.pos.y);
      if (t) this.target = t;
      this.attackT = this.form.id === 'phoenix' ? 2 : this.form.id === 'dragon' ? 3 : 4;
    }
    if (this.target) {
      if (this.target.dead) this.target = null;
      else {
        goal = { x: this.target.x, y: this.target.y };
        if (this.pos && Math.hypot(goal.x - this.pos.x, goal.y - this.pos.y) < this.target.r) {
          arena?.hitNear(this.target.x, this.target.y, this.target.r * 1.5);
          this.#burst(e, this.pos, 25);
          this.target = null;
        }
      }
    }
    if (!this.pos) this.pos = { ...goal };
    // Spring towards the goal (faster when attacking).
    const k = this.target ? 60 : 18;
    this.vel.x += ((goal.x - this.pos.x) * k - this.vel.x * (this.target ? 8 : 6)) * dt;
    this.vel.y += ((goal.y - this.pos.y) * k - this.vel.y * (this.target ? 8 : 6)) * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.trail.unshift({ x: this.pos.x, y: this.pos.y });
    if (this.trail.length > 18) this.trail.pop();
    const rgb = this.#rgb();
    if (Math.random() < (this.form.id === 'phoenix' ? 0.9 : 0.4))
      this.fx.add({
        x: this.pos.x + rand(-4, 4),
        y: this.pos.y + rand(-4, 4),
        vx: rand(-30, 30),
        vy: rand(-10, 40),
        life: rand(0.3, 0.7),
        size: rand(2, 5) * e.unit * (this.form.id === 'phoenix' ? 2.5 : 1),
        rgb,
        core: 0.5,
        fire: this.form.id === 'phoenix',
        alpha: this.form.id === 'phoenix' ? 0.5 : 1,
      });
    if (this.mood > 1.2 && Math.random() < 0.5) this.#burst(e, this.pos, 4);
  }

  #rgb() {
    return { wisp: [120, 220, 255], dragon: [160, 110, 255], phoenix: [255, 150, 50] }[this.form.id];
  }

  #burst(e, p, n) {
    const rgb = this.#rgb();
    for (let i = 0; i < n; i++) {
      const a = rand(TAU);
      const v = rand(100, 400) * e.unit;
      this.fx.add({
        x: p.x,
        y: p.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        drag: 3,
        life: rand(0.3, 0.6),
        size: rand(2, 4) * e.unit,
        rgb,
        core: 0.6,
      });
    }
  }

  draw(ctx, e) {
    if (!this.form || !this.pos) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const s = 24 * e.unit;
    const rgb = this.#rgb();
    const { x, y } = this.pos;
    // Tail.
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 1; i < this.trail.length; i++) {
      const t = i / this.trail.length;
      ctx.strokeStyle = `rgba(${rgb.join(',')},${0.5 * (1 - t)})`;
      ctx.lineWidth = s * 0.6 * (1 - t) + 1;
      ctx.beginPath();
      ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
      ctx.lineTo(this.trail[i].x, this.trail[i].y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    this.fx.draw(ctx);
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, rgb, x, y, s * 2.4, 0.5, 0.2);
    ctx.globalCompositeOperation = 'source-over';
    const spin = this.mood > 0.8 ? (this.mood - 0.8) * 12 : 0;
    const facing = this.vel.x < -20 ? -1 : 1;
    ctx.translate(x, y);
    ctx.rotate(spin + clamp(this.vel.x / 2000, -0.4, 0.4));
    ctx.scale(facing, 1);
    if (this.form.id === 'wisp') {
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, [255, 255, 255], 0, 0, s * 0.8, 1, 0.6);
    } else {
      // Wings: flapping arcs.
      const flap = Math.sin(e.t * (this.form.id === 'phoenix' ? 14 : 10)) * 0.6;
      const wing = this.form.id === 'phoenix' ? [255, 200, 80] : [200, 170, 255];
      ctx.fillStyle = `rgba(${wing.join(',')},0.85)`;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.1);
        ctx.quadraticCurveTo(side * s * 1.2, -s * (1 + flap), side * s * 1.6, -s * (0.2 + flap));
        ctx.quadraticCurveTo(side * s * 0.9, -s * 0.1, 0, s * 0.2);
        ctx.fill();
      }
      // Body and head.
      ctx.fillStyle = `rgb(${rgb.join(',')})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.55, s * 0.42, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(s * 0.55, -s * 0.35, s * 0.32, 0, TAU);
      ctx.fill();
      if (this.form.id === 'dragon') {
        // Little horns.
        ctx.strokeStyle = '#efe6ff';
        ctx.lineWidth = s * 0.08;
        ctx.beginPath();
        ctx.moveTo(s * 0.5, -s * 0.6);
        ctx.lineTo(s * 0.4, -s * 0.85);
        ctx.moveTo(s * 0.68, -s * 0.6);
        ctx.lineTo(s * 0.72, -s * 0.85);
        ctx.stroke();
      } else {
        // Phoenix crest.
        ctx.fillStyle = '#ffe08a';
        ctx.beginPath();
        ctx.moveTo(s * 0.45, -s * 0.6);
        ctx.quadraticCurveTo(s * 0.3, -s * 1.1, s * 0.15, -s * 0.9);
        ctx.quadraticCurveTo(s * 0.35, -s * 0.75, s * 0.45, -s * 0.6);
        ctx.fill();
      }
      // Eye.
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s * 0.65, -s * 0.4, s * 0.1, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(s * 0.68, -s * 0.4, s * 0.05, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}
