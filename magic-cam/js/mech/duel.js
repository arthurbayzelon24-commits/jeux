// Elemental duel: two players (one hand each, left and right of the screen)
// or one player against the computer. On "3, 2, 1, MAGIE !" each shows a
// gesture: fist = Fire, open hand = Water, V sign = Lightning.
// Water beats Fire, Lightning beats Water, Fire beats Lightning.
// First to 3 wins; the winner's spell flies across at the loser.
import { Particles, drawGlow, rand, TAU, clamp, makeBolt, strokeBolts } from '../fx/util.js';

const ELEMENTS = {
  fire: { name: 'Feu', icon: '🔥', rgb: [255, 120, 40], beats: 'lightning' },
  water: { name: 'Eau', icon: '💧', rgb: [60, 160, 255], beats: 'fire' },
  lightning: { name: 'Foudre', icon: '⚡', rgb: [200, 220, 255], beats: 'water' },
};
const KEYS = Object.keys(ELEMENTS);
const fromGesture = (h) => (!h ? null : h.fist ? 'fire' : h.gesture === 'peace' ? 'lightning' : h.open ? 'water' : null);
const WIN = 3;

export class Duel {
  constructor() {
    this.state = 'off';
    this.fx = new Particles(900);
    this.onEnd = null;
  }

  get active() {
    return this.state !== 'off';
  }

  start(e) {
    this.state = 'count';
    this.timer = 3.6;
    this.score = [0, 0];
    this.round = 0;
    this.result = null;
    this.shot = null;
    this.lastN = 5;
    this.fx.clear();
    this.solo = true;
    this.you = 0;
    e.audio.play('tick', 0.6);
  }

  stop() {
    this.state = 'off';
  }
  quit() {
    this.stop();
  }

  // Players: [left of the screen, right of the screen].
  #players(hands, e) {
    const live = hands.filter((h) => h.presence > 0.5).sort((a, b) => a.palm.x - b.palm.x);
    if (live.length >= 2) return [live[0], live[live.length - 1]];
    // One hand: you are on the side where your hand is, the computer on the other.
    if (live[0]) return live[0].palm.x < e.W / 2 ? [live[0], null] : [null, live[0]];
    return [null, null];
  }

  update(dt, hands, e) {
    this.fx.update(dt);
    if (this.state === 'off') return;
    const [L, R] = this.#players(hands, e);
    this.solo = !(L && R);
    // Solo: you are the side where your hand is.
    if (this.solo && (L || R)) this.you = L ? 0 : 1;
    this.timer -= dt;
    if (this.state === 'count') {
      const n = Math.ceil(this.timer - 0.6);
      if (n < this.lastN && n >= 1) e.audio.play('tick', 0.6);
      this.lastN = n;
      if (this.timer <= 0) this.#reveal(e, L, R);
    } else if (this.state === 'reveal') {
      if (this.shot) this.shot.t += dt;
      if (this.shot && !this.shot.hit && this.shot.t > 0.5) this.#impact(e);
      if (this.timer <= 0) {
        if (Math.max(...this.score) >= WIN) {
          this.state = 'end';
          this.timer = 5;
          const w = this.score[0] > this.score[1] ? 0 : 1;
          e.audio.play('teleport', 1);
          e.flash([255, 230, 150], 0.5, 1.5);
          this.onEnd?.({ winner: w, score: [...this.score], solo: this.solo, won: !this.solo || w === this.you });
        } else {
          this.state = 'count';
          this.timer = 3.6;
          this.lastN = 5;
        }
      }
    } else if (this.state === 'end' && this.timer <= 0) this.stop();
  }

  #reveal(e, L, R) {
    this.round++;
    // A missing player plays a random element (the computer).
    const pick = (h) => fromGesture(h) || (h ? null : KEYS[(Math.random() * 3) | 0]);
    const a = pick(L);
    const b = pick(R);
    let winner = null;
    if (a && b && a !== b) winner = ELEMENTS[a].beats === b ? 0 : 1;
    else if (a && !b) winner = 0;
    else if (b && !a) winner = 1;
    this.result = { a, b, winner, pos: [L?.palm || { x: e.W * 0.2, y: e.H * 0.5 }, R?.palm || { x: e.W * 0.8, y: e.H * 0.5 }] };
    this.state = 'reveal';
    this.timer = 2.6;
    if (winner === null) {
      e.audio.play('drop', 0.7);
      this.shot = null;
      return;
    }
    this.score[winner]++;
    const from = this.result.pos[winner];
    const to = this.result.pos[1 - winner];
    this.shot = { el: winner === 0 ? a : b, from: { ...from }, to: { ...to }, t: 0, hit: false, bolts: [] };
    e.audio.play('whoosh', 1);
  }

  #impact(e) {
    const s = this.shot;
    s.hit = true;
    const El = ELEMENTS[s.el];
    for (let i = 0; i < 120; i++) {
      const a = rand(TAU);
      const v = rand(150, 900) * e.unit;
      this.fx.add({
        x: s.to.x,
        y: s.to.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        drag: 2,
        life: rand(0.4, 1),
        size: rand(s.el === 'fire' ? 12 : 3, s.el === 'fire' ? 30 : 8) * e.unit,
        rgb: El.rgb,
        fire: s.el === 'fire',
        alpha: s.el === 'fire' ? 0.5 : 1,
        core: 0.4,
      });
    }
    e.shake(28);
    e.flash(El.rgb, 0.35, 2.5);
    e.audio.play(s.el === 'lightning' ? 'thunder' : s.el === 'water' ? 'whoosh' : 'boom', 1);
  }

  draw(ctx, e) {
    if (this.state === 'off') return;
    const u = e.unit;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const text = (s, x, y, size, color = '#fff') => {
      ctx.font = `900 ${Math.round(size * u)}px system-ui, sans-serif`;
      ctx.lineWidth = 6 * u;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeText(s, x, y);
      ctx.fillStyle = color;
      ctx.fillText(s, x, y);
    };
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Scoreboard and the side line.
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.setLineDash([10 * u, 10 * u]);
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.moveTo(e.W / 2, e.H * 0.18);
    ctx.lineTo(e.W / 2, e.H * 0.8);
    ctx.stroke();
    ctx.setLineDash([]);
    const top = e.H * 0.1;
    text(`${this.score[0]}  –  ${this.score[1]}`, e.W / 2, top, 40, '#ffe7a8');
    const label = (i) => (this.solo ? (i === this.you ? 'TOI' : 'ORDI') : `JOUEUR ${i + 1}`);
    text(label(0), e.W * 0.25, top, 18, '#9fd3ff');
    text(label(1), e.W * 0.75, top, 18, '#ffb0c8');
    if (this.state === 'count') {
      const n = Math.ceil(this.timer - 0.6);
      const k = this.timer - Math.floor(this.timer);
      text(n >= 1 ? String(n) : 'MAGIE !', e.W / 2, e.H * 0.45, n >= 1 ? 90 + 40 * k : 64, '#ffd77a');
      text('🔥 poing   💧 main ouverte   ⚡ signe V', e.W / 2, e.H * 0.6, 17, '#eee');
    }
    if (this.state === 'reveal' && this.result) {
      const { a, b, winner, pos } = this.result;
      [a, b].forEach((el, i) => {
        const p = pos[i];
        if (!el) return text('?', p.x, p.y - 80 * u, 50, '#aaa');
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, ELEMENTS[el].rgb, p.x, p.y - 80 * u, 70 * u, 0.6);
        ctx.globalCompositeOperation = 'source-over';
        text(ELEMENTS[el].icon, p.x, p.y - 80 * u, 54);
        text(ELEMENTS[el].name, p.x, p.y - 30 * u, 20, `rgb(${ELEMENTS[el].rgb.join(',')})`);
      });
      const msg =
        winner === null
          ? 'ÉGALITÉ'
          : this.solo
            ? winner === this.you
              ? 'POINT POUR TOI'
              : 'POINT POUR L’ORDI'
            : `POINT JOUEUR ${winner + 1}`;
      text(msg, e.W / 2, e.H * 0.3, 30, winner === null ? '#ddd' : '#7dffb0');
      const s = this.shot;
      if (s && !s.hit) {
        const k = clamp(s.t / 0.5);
        const x = s.from.x + (s.to.x - s.from.x) * k;
        const y = s.from.y + (s.to.y - s.from.y) * k - Math.sin(k * Math.PI) * e.H * 0.15;
        const El = ELEMENTS[s.el];
        ctx.globalCompositeOperation = 'lighter';
        if (s.el === 'lightning') {
          s.bolts = makeBolt(s.from.x, s.from.y, x, y, { jag: 0.3, depth: 6 });
          strokeBolts(ctx, s.bolts, El.rgb, 3 * u, 1);
        }
        drawGlow(ctx, El.rgb, x, y, 50 * u, 0.9, 0.4);
        ctx.globalCompositeOperation = 'source-over';
        if (Math.random() < 0.8)
          this.fx.add({
            x,
            y,
            vx: rand(-60, 60),
            vy: rand(-60, 60),
            life: 0.5,
            size: (s.el === 'fire' ? 18 : 5) * u,
            rgb: El.rgb,
            fire: s.el === 'fire',
            alpha: 0.6,
            core: 0.4,
          });
      }
    }
    this.fx.draw(ctx);
    if (this.state === 'end') {
      ctx.fillStyle = 'rgba(5,4,10,0.5)';
      ctx.fillRect(0, 0, e.W, e.H);
      const w = this.score[0] > this.score[1] ? 0 : 1;
      text(this.solo ? (w === this.you ? 'TU GAGNES !' : 'L’ORDI GAGNE…') : `JOUEUR ${w + 1} GAGNE !`, e.W / 2, e.H * 0.42, 44, '#ffd77a');
      text(`${this.score[0]} – ${this.score[1]}`, e.W / 2, e.H * 0.53, 30, '#fff');
    }
    ctx.restore();
  }
}
