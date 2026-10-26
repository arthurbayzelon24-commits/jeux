// Arena: a 60-second game over any power. Targets appear on screen; your
// power destroys them wherever it touches them (beams, fireballs, lightning:
// read from the effects layer), and so do fast hand strikes. Combos multiply
// the score, bombs must be avoided, green clocks give time, and a power's
// final blast or a rune clears the screen.
import { Particles, drawGlow, rand, TAU, clamp } from '../fx/util.js';

const ROUND = 60;
const TYPES = {
  orb: { pts: 10, hp: 1, r: 0.05, rgb: [90, 200, 255], life: 6, weight: 6 },
  gold: { pts: 50, hp: 1, r: 0.035, rgb: [255, 210, 70], life: 3.5, weight: 1.2, moves: true },
  crystal: { pts: 30, hp: 3, r: 0.065, rgb: [190, 120, 255], life: 8, weight: 1.6 },
  bomb: { pts: -40, hp: 1, r: 0.05, rgb: [255, 50, 50], life: 5, weight: 1.3, bomb: true },
  clock: { pts: 0, hp: 1, r: 0.04, rgb: [80, 255, 140], life: 4, weight: 0.5, clock: true },
};
const BEST_KEY = 'magic-cam-arena-best';

function pickType(elapsed) {
  const entries = Object.entries(TYPES).filter(([k]) => elapsed > 8 || (k !== 'bomb' && k !== 'clock'));
  let n = Math.random() * entries.reduce((a, [, t]) => a + t.weight, 0);
  for (const [k, t] of entries) if ((n -= t.weight) <= 0) return k;
  return 'orb';
}

export class Arena {
  constructor() {
    this.state = 'off';
    this.burst = new Particles(900);
    this.popups = [];
    this.onEnd = null;
    try {
      this.best = Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {
      this.best = 0;
    }
  }

  get active() {
    return this.state !== 'off';
  }

  start(e) {
    this.state = 'countdown';
    this.timer = 3;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.lastHit = -10;
    this.targets = [];
    this.spawnT = 0;
    this.elapsed = 0;
    this.hits = 0;
    this.time = ROUND;
    this.popups = [];
    this.burst.clear();
    this.lastTick = 4;
    e.audio.play('tick', 0.6);
    if (!this.unsub) {
      // A power's final blast or a rune clears every target it reaches.
      const off1 = e.on('ultimate', () => this.#clearAll(e, null));
      const off2 = e.on('spell', (s) => this.#clearAll(e, s));
      this.unsub = () => (off1(), off2());
    }
  }

  stop() {
    this.state = 'off';
    this.targets = [];
    this.unsub?.();
    this.unsub = null;
  }

  get multiplier() {
    return Math.min(5, 1 + Math.floor(this.combo / 5));
  }

  #spawn(e) {
    const kind = pickType(this.elapsed);
    const T = TYPES[kind];
    const R = T.r * Math.min(e.W, e.H) * (e.W < e.H ? 1.4 : 1);
    // Away from the edges, the top bar and the bottom controls.
    for (let tries = 0; tries < 8; tries++) {
      const x = rand(0.1, 0.9) * e.W;
      const y = rand(0.2, 0.72) * e.H;
      if (this.targets.some((t) => Math.hypot(t.x - x, t.y - y) < (t.r + R) * 1.3)) continue;
      this.targets.push({
        kind,
        x,
        y,
        r: R,
        hp: T.hp,
        heat: 0,
        age: 0,
        life: T.life,
        cool: 0,
        vx: T.moves ? rand(-1, 1) * e.W * 0.15 : 0,
        vy: T.moves ? rand(-1, 1) * e.H * 0.1 : 0,
        ph: rand(TAU),
      });
      return;
    }
  }

  #pop(text, x, y, rgb, big = false) {
    this.popups.push({ text, x, y, rgb, t: 0, big });
  }

  #explode(e, t, rgb) {
    for (let i = 0; i < 40; i++) {
      const a = rand(TAU);
      const v = rand(150, 700) * e.unit;
      this.burst.add({
        x: t.x,
        y: t.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        drag: 2.5,
        life: rand(0.3, 0.8),
        size: rand(3, 8) * e.unit,
        rgb,
        core: 0.4,
      });
    }
  }

  #destroy(e, t) {
    const T = TYPES[t.kind];
    t.dead = true;
    if (T.bomb) {
      this.score = Math.max(0, this.score + T.pts);
      this.combo = 0;
      this.#explode(e, t, [255, 80, 40]);
      this.#pop(`${T.pts}`, t.x, t.y, [255, 80, 80], true);
      e.shake(25);
      e.flash([255, 40, 40], 0.35, 3);
      e.audio.play('boom', 0.8);
      return;
    }
    if (T.clock) {
      this.time += 5;
      this.#explode(e, t, T.rgb);
      this.#pop('+5 s', t.x, t.y, T.rgb, true);
      e.audio.play('chime', 0.8);
      return;
    }
    this.combo = this.elapsed - this.lastHit < 2 ? this.combo + 1 : 1;
    this.lastHit = this.elapsed;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.hits++;
    const pts = T.pts * this.multiplier;
    this.score += pts;
    this.#explode(e, t, T.rgb);
    this.#pop(`+${pts}`, t.x, t.y, T.rgb, t.kind === 'gold');
    if (this.combo > 0 && this.combo % 5 === 0) this.#pop(`COMBO x${this.multiplier}`, e.W / 2, e.H * 0.3, [255, 230, 120], true);
    e.audio.play(t.kind === 'gold' ? 'coin' : 'pop', 0.7);
    e.emit('hit', { kind: t.kind, combo: this.combo });
  }

  #clearAll(e, spell) {
    if (this.state !== 'play') return;
    for (const t of this.targets) {
      if (t.dead || TYPES[t.kind].bomb) continue;
      if (spell?.line) {
        // A blade: everything close to the (extended) line.
        const [p, q] = spell.line;
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const l = Math.hypot(dx, dy) || 1;
        if (Math.abs((t.x - p.x) * dy - (t.y - p.y) * dx) / l > t.r + Math.min(e.W, e.H) * 0.06) continue;
      } else if (spell && Math.hypot(t.x - spell.x, t.y - spell.y) > (spell.radius || Math.max(e.W, e.H))) continue;
      this.#destroy(e, t);
    }
  }

  update(dt, hands, e) {
    this.burst.update(dt);
    for (const p of this.popups) {
      p.t += dt;
      p.y -= dt * 60 * e.unit;
    }
    this.popups = this.popups.filter((p) => p.t < 1.1);
    if (this.state === 'countdown') {
      this.timer -= dt;
      const n = Math.ceil(this.timer);
      if (n < this.lastTick && n > 0) e.audio.play('tick', 0.6);
      this.lastTick = n;
      if (this.timer <= 0) {
        this.state = 'play';
        e.audio.play('go', 0.8);
      }
      return;
    }
    if (this.state === 'end') {
      this.timer -= dt;
      if (this.timer <= 0) this.stop();
      return;
    }
    if (this.state !== 'play') return;
    this.elapsed += dt;
    this.time -= dt;
    if (this.time <= 0) return this.#finish(e);
    // Faster and faster.
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.targets.length < 8) {
      this.#spawn(e);
      this.spawnT = Math.max(0.35, 1.1 - this.elapsed * 0.012);
    }
    const strike = Math.min(e.W, e.H) * 0.6;
    for (const t of this.targets) {
      t.age += dt;
      t.cool -= dt;
      t.x = clamp(t.x + t.vx * dt, t.r, e.W - t.r);
      t.y = clamp(t.y + t.vy * dt, t.r, e.H - t.r);
      if (t.x <= t.r || t.x >= e.W - t.r) t.vx *= -1;
      if (t.y <= t.r || t.y >= e.H - t.r) t.vy *= -1;
      // The power touching it.
      const heat = e.heatAt(t.x, t.y);
      if (heat > 0.3) t.heat += dt * 3 * heat;
      // A fast hand strike through it.
      if (t.cool <= 0)
        for (const h of hands) {
          if (h.presence < 0.5 || h.speed < strike) continue;
          const pts = [h.palm, ...h.tips];
          if (pts.some((p) => Math.hypot(p.x - t.x, p.y - t.y) < t.r * 1.2)) {
            t.heat += 1;
            t.cool = 0.25;
            break;
          }
        }
      while (t.heat >= 1 && !t.dead) {
        t.heat -= 1;
        t.hp--;
        if (t.hp <= 0) this.#destroy(e, t);
        else {
          this.#explode(e, { x: t.x, y: t.y }, [255, 255, 255]);
          e.audio.play('crack', 0.5);
        }
      }
      if (!t.dead && t.age > t.life) {
        t.dead = true;
        // Missing a target breaks the combo (bombs and clocks don't count).
        if (!TYPES[t.kind].bomb && !TYPES[t.kind].clock) this.combo = 0;
      }
    }
    this.targets = this.targets.filter((t) => !t.dead);
    // Last 5 seconds: a tick each second.
    const n = Math.ceil(this.time);
    if (n <= 5 && n < this.lastTick) e.audio.play('tick', 0.5);
    this.lastTick = n;
  }

  #finish(e) {
    this.state = 'end';
    this.timer = 6;
    this.targets = [];
    this.record = this.score > this.best;
    if (this.record) {
      this.best = this.score;
      try {
        localStorage.setItem(BEST_KEY, String(this.best));
      } catch {
        /* not saved */
      }
    }
    e.audio.play(this.record ? 'teleport' : 'chime', 1);
    if (this.record) e.flash([255, 220, 120], 0.5, 1.5);
    this.onEnd?.({ score: this.score, best: this.best, record: this.record, maxCombo: this.maxCombo, hits: this.hits });
  }

  draw(ctx, e) {
    if (this.state === 'off') return;
    const u = e.unit;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const t of this.targets) this.#drawTarget(ctx, e, t);
    this.burst.draw(ctx);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of this.popups) {
      ctx.globalAlpha = clamp(1.1 - p.t);
      ctx.font = `900 ${Math.round((p.big ? 34 : 24) * u)}px system-ui, sans-serif`;
      ctx.lineWidth = 5 * u;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = `rgb(${p.rgb.join(',')})`;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    const cx = e.W / 2;
    const top = e.H * 0.1;
    const text = (s, x, y, size, color = '#fff') => {
      ctx.font = `900 ${Math.round(size * u)}px system-ui, sans-serif`;
      ctx.lineWidth = 6 * u;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeText(s, x, y);
      ctx.fillStyle = color;
      ctx.fillText(s, x, y);
    };
    if (this.state === 'countdown') {
      const n = Math.ceil(this.timer);
      const k = this.timer - Math.floor(this.timer);
      ctx.globalAlpha = 0.3 + 0.7 * k;
      text(String(n), cx, e.H / 2, 120 + 60 * k, '#ffd77a');
      ctx.globalAlpha = 1;
      text('ARÈNE', cx, e.H / 2 - 110 * u, 30, '#fff');
    } else if (this.state === 'play') {
      text(String(this.score), cx, top, 44, '#ffe7a8');
      const low = this.time < 10;
      text(`${Math.ceil(this.time)} s`, cx, top + 40 * u, 22, low ? '#ff6b6b' : '#fff');
      if (this.multiplier > 1) text(`x${this.multiplier}`, cx + 90 * u, top, 26, '#7df9ff');
      // Combo bar: time left to keep the combo.
      const left = clamp(1 - (this.elapsed - this.lastHit) / 2);
      if (this.combo > 1 && left > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(cx - 60 * u, top + 62 * u, 120 * u, 6 * u);
        ctx.fillStyle = '#7df9ff';
        ctx.fillRect(cx - 60 * u, top + 62 * u, 120 * u * left, 6 * u);
      }
    } else if (this.state === 'end') {
      ctx.fillStyle = 'rgba(5,4,10,0.55)';
      ctx.fillRect(0, 0, e.W, e.H);
      text('FIN DE LA MANCHE', cx, e.H * 0.32, 28, '#fff');
      text(String(this.score), cx, e.H * 0.45, 90, '#ffd77a');
      text(this.record ? 'NOUVEAU RECORD !' : `Record : ${this.best}`, cx, e.H * 0.57, 26, this.record ? '#7dffb0' : '#ddd');
      text(`Combo max x${this.maxCombo} · ${this.hits} cibles`, cx, e.H * 0.64, 20, '#ccc');
    }
    ctx.restore();
  }

  #drawTarget(ctx, e, t) {
    const T = TYPES[t.kind];
    const appear = clamp(t.age * 4);
    const r = t.r * appear * (1 + 0.05 * Math.sin(e.t * 4 + t.ph));
    const fade = clamp((t.life - t.age) * 2);
    ctx.globalAlpha = fade;
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, T.rgb, t.x, t.y, r * 2.2, 0.5, 0.1);
    ctx.globalCompositeOperation = 'source-over';
    if (t.kind === 'crystal') {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(e.t * 0.8 + t.ph);
      ctx.fillStyle = `rgba(${T.rgb.join(',')},0.75)`;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 * e.unit;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.7, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      // Hit points left.
      for (let i = 0; i < t.hp; i++) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(t.x + (i - (t.hp - 1) / 2) * r * 0.4, t.y + r * 1.35, r * 0.1, 0, TAU);
        ctx.fill();
      }
    } else {
      const g = ctx.createRadialGradient(t.x - r * 0.35, t.y - r * 0.35, r * 0.1, t.x, t.y, r);
      g.addColorStop(0, '#fff');
      g.addColorStop(0.35, `rgb(${T.rgb.join(',')})`);
      g.addColorStop(1, `rgb(${T.rgb.map((v) => Math.round(v * 0.35)).join(',')})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, TAU);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.font = `900 ${Math.round(r * 0.9)}px system-ui, sans-serif`;
      if (T.bomb) {
        // Spikes and a warning sign.
        ctx.strokeStyle = `rgb(${T.rgb.join(',')})`;
        ctx.lineWidth = r * 0.12;
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * TAU + e.t;
          ctx.beginPath();
          ctx.moveTo(t.x + Math.cos(a) * r, t.y + Math.sin(a) * r);
          ctx.lineTo(t.x + Math.cos(a) * r * 1.3, t.y + Math.sin(a) * r * 1.3);
          ctx.stroke();
        }
        ctx.fillText('!', t.x, t.y);
      } else if (T.clock) ctx.fillText('+5', t.x, t.y);
      else if (t.kind === 'gold') ctx.fillText('★', t.x, t.y);
    }
    // Ring showing the time left before it vanishes.
    ctx.strokeStyle = `rgba(255,255,255,${0.6 * fade})`;
    ctx.lineWidth = 2.5 * e.unit;
    ctx.beginPath();
    ctx.arc(t.x, t.y, r * 1.25, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - t.age / t.life));
    ctx.stroke();
    // Damage being dealt by the power.
    if (t.heat > 0.05) {
      ctx.strokeStyle = 'rgba(255,240,180,0.9)';
      ctx.lineWidth = 4 * e.unit;
      ctx.beginPath();
      ctx.arc(t.x, t.y, r * 1.45, -Math.PI / 2, -Math.PI / 2 + TAU * t.heat);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
