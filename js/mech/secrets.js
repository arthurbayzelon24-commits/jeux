// Secret moves: hidden gestures that work with every power. Found ones are
// listed on the Succès page; the others only show a hint.
//   Double clap        -> golden confetti burst
//   Both hands up 1 s  -> rays of light from the sky
//   Fist/open x3 fast  -> Overload: the power's final blast right away
//   Full turn of hand  -> Vortex of sparks
//   Hand still 3 s     -> Meditation: calm floating lights
import { Particles, rand, TAU, clamp, dist } from '../fx/util.js';

export const SECRETS = [
  { id: 'clap', name: 'Bravo !', hint: 'Applaudis deux fois' },
  { id: 'victory', name: 'Lumière céleste', hint: 'Les deux mains vers le ciel' },
  { id: 'overload', name: 'Surcharge', hint: 'Poing, main ouverte… trois fois, vite' },
  { id: 'vortex', name: 'Vortex', hint: 'Fais faire un tour complet à ta main' },
  { id: 'zen', name: 'Méditation', hint: 'Reste immobile, main ouverte' },
];

export class Secrets {
  constructor() {
    this.fx = new Particles(900);
    this.onFound = null;
    this.reset();
  }

  reset() {
    this.claps = [];
    this.near = false;
    this.upFor = 0;
    this.releases = [];
    this.turn = new Map();
    this.still = 0;
    this.cool = {};
    this.rays = 0;
    this.zen = 0;
    this.label = null;
  }

  #fire(id, e, at) {
    if ((this.cool[id] || 0) > e.t) return;
    // Calm effects must not come back too often while filming.
    this.cool[id] = e.t + ({ zen: 30, victory: 10 }[id] || 3);
    const s = SECRETS.find((x) => x.id === id);
    this.label = { text: s.name, t: 0 };
    this.onFound?.(id);
    const fx = this.fx;
    if (id === 'clap') {
      const cols = [
        [255, 215, 110],
        [255, 120, 160],
        [120, 220, 255],
        [255, 255, 255],
      ];
      for (let i = 0; i < 160; i++) {
        const a = rand(TAU);
        const v = rand(300, 1300) * e.unit;
        fx.add({
          x: at.x,
          y: at.y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - 300,
          g: 900 * e.unit,
          drag: 1.5,
          life: rand(0.8, 1.6),
          size: rand(3, 7) * e.unit,
          rgb: cols[i % 4],
          core: 0.5,
        });
      }
      e.audio.play('chime', 1);
      e.audio.play('boom', 0.4);
    } else if (id === 'victory') {
      this.rays = 2.5;
      e.flash([255, 240, 200], 0.5, 1.2);
      e.audio.play('teleport', 0.8);
    } else if (id === 'overload') {
      // Straight to the current power's final blast.
      e.charge.power = 1.3;
      e.audio.play('thunder', 0.8);
    } else if (id === 'vortex') {
      for (let i = 0; i < 140; i++) {
        const a = rand(TAU);
        const r = rand(20, 220) * e.unit;
        fx.add({
          x: at.x + Math.cos(a) * r,
          y: at.y + Math.sin(a) * r,
          vx: -Math.sin(a) * 600 * e.unit,
          vy: Math.cos(a) * 600 * e.unit,
          drag: 1.2,
          life: rand(0.6, 1.2),
          size: rand(2, 5) * e.unit,
          rgb: [170, 120, 255],
          core: 0.6,
        });
      }
      e.audio.play('whoosh', 1);
    } else if (id === 'zen') {
      this.zen = 4;
      e.audio.play('chime', 0.6);
    }
  }

  update(dt, hands, e) {
    this.fx.update(dt);
    if (this.label) this.label.t += dt;
    this.rays = Math.max(0, this.rays - dt);
    this.zen = Math.max(0, this.zen - dt);
    const live = hands.filter((h) => h.presence > 0.5);

    // Double clap: hands meet twice within 1.2 s.
    if (live.length >= 2) {
      const [a, b] = live;
      const d = dist(a.palm, b.palm);
      const touch = d < (a.size + b.size) * 0.6;
      if (touch && !this.near) {
        this.claps = this.claps.filter((t) => e.t - t < 1.2);
        this.claps.push(e.t);
        if (this.claps.length >= 2) {
          this.claps = [];
          this.#fire('clap', e, { x: (a.palm.x + b.palm.x) / 2, y: (a.palm.y + b.palm.y) / 2 });
        }
      }
      if (d > (a.size + b.size) * 1.1) this.near = false;
      else if (touch) this.near = true;
      // Both open hands high up.
      const up = a.palm.y < e.H * 0.32 && b.palm.y < e.H * 0.32 && a.openness > 0.7 && b.openness > 0.7;
      this.upFor = up ? this.upFor + dt : 0;
      if (this.upFor > 1) {
        this.upFor = -2;
        this.#fire('victory', e);
      }
    } else this.upFor = 0;

    for (const h of live) {
      // Overload: three fist -> open releases within 2.5 s.
      if (h.events.release) {
        this.releases = this.releases.filter((t) => e.t - t < 2.5);
        this.releases.push(e.t);
        if (this.releases.length >= 3) {
          this.releases = [];
          this.#fire('overload', e, h.palm);
        }
      }
      // Vortex: the hand's angle turns a full circle within 1.5 s.
      let tr = this.turn.get(h.id);
      if (!tr) this.turn.set(h.id, (tr = { last: h.angle, sum: 0, t: e.t }));
      let da = h.angle - tr.last;
      if (da > Math.PI) da -= TAU;
      if (da < -Math.PI) da += TAU;
      tr.last = h.angle;
      if (Math.sign(da) !== Math.sign(tr.sum) || e.t - tr.t > 1.5) {
        tr.sum = 0;
        tr.t = e.t;
      }
      tr.sum += da;
      if (Math.abs(tr.sum) > TAU * 0.95) {
        tr.sum = 0;
        this.#fire('vortex', e, h.palm);
      }
    }
    // Meditation: one open hand, perfectly still, for 3 s.
    const calm = live.length >= 1 && live.every((h) => h.speed < Math.min(e.W, e.H) * 0.08 && h.openness > 0.7);
    this.still = calm ? this.still + dt : 0;
    if (this.still > 3) {
      this.still = -4;
      this.#fire('zen', e, live[0].palm);
    }
    if (this.zen > 0 && Math.random() < 0.6)
      this.fx.add({
        x: rand(e.W),
        y: e.H + 10,
        vx: rand(-15, 15),
        vy: -rand(40, 110) * e.unit,
        life: rand(2, 4),
        size: rand(3, 7) * e.unit,
        rgb: [160, 255, 210],
        core: 0.5,
        fadeIn: 0.3,
      });
  }

  draw(ctx, e) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.rays > 0) {
      // God rays from the top of the screen.
      ctx.globalCompositeOperation = 'lighter';
      const a = clamp(this.rays) * 0.5;
      for (let k = 0; k < 9; k++) {
        const x = e.W * (0.1 + k * 0.1) + Math.sin(e.t + k) * 20;
        const g = ctx.createLinearGradient(x, 0, x, e.H);
        g.addColorStop(0, `rgba(255,240,200,${a})`);
        g.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - 10, 0);
        ctx.lineTo(x + 10, 0);
        ctx.lineTo(x + 90, e.H);
        ctx.lineTo(x - 90, e.H);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (this.zen > 0) {
      ctx.fillStyle = `rgba(20,60,50,${0.18 * clamp(this.zen)})`;
      ctx.fillRect(0, 0, e.W, e.H);
    }
    this.fx.draw(ctx);
    // No label over a game's score (arena, duel).
    const game = e.mechanics.some((m) => m !== this && m.active);
    if (this.label && this.label.t < 1.6 && !game) {
      const l = this.label;
      ctx.globalAlpha = clamp(1.6 - l.t) * clamp(l.t * 6);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `900 ${Math.round(34 * e.unit)}px system-ui, sans-serif`;
      ctx.lineWidth = 6 * e.unit;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.strokeText(`✦ ${l.text} ✦`, e.W / 2, e.H * 0.3);
      ctx.fillStyle = '#ffe9b0';
      ctx.fillText(`✦ ${l.text} ✦`, e.W / 2, e.H * 0.3);
    }
    ctx.restore();
  }
}
