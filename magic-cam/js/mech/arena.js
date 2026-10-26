// Arena: a game over any power, in three modes (classic 60 s, survival with
// 3 lives, zen without bombs nor timer). Targets appear on screen; your
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
  // Ghosts flee from your hands: hit them with the power from a distance.
  ghost: { pts: 40, hp: 1, r: 0.045, rgb: [220, 235, 255], life: 7, weight: 0.9, ghost: true },
  // Halfway through the round: a boss with a health bar.
  boss: { pts: 500, hp: 12, r: 0.11, rgb: [255, 90, 200], life: 20, weight: 0, boss: true },
  // Power-ups: points x2 for 8 s, or everything frozen for 5 s.
  double: { pts: 0, hp: 1, r: 0.04, rgb: [90, 255, 255], life: 4, weight: 0.35, bonus: 'double' },
  freeze: { pts: 0, hp: 1, r: 0.04, rgb: [190, 230, 255], life: 4, weight: 0.35, bonus: 'freeze' },
  // Survival: an extra life instead of the clocks.
  heart: { pts: 0, hp: 1, r: 0.04, rgb: [255, 90, 120], life: 4, weight: 0, heart: true },
};
export const MODES = {
  classic: { name: 'Classique', text: '60 secondes, boss à mi-manche' },
  survival: { name: 'Survie', text: '3 vies, de plus en plus vite' },
  zen: { name: 'Zen', text: 'Sans bombes ni chrono' },
  duel: { name: 'Duel élémentaire', text: 'Feu, Eau, Foudre : à deux ou contre l’ordi', game: true },
};
const BEST_KEY = 'magic-cam-arena-best';
const bestKey = (mode) => (mode === 'classic' ? BEST_KEY : `${BEST_KEY}-${mode}`);
// Targets that do not break the combo when they vanish.
const harmless = (T) => T.bomb || T.clock || T.bonus || T.heart;

function pickType(elapsed, clocks, mode) {
  const weights = { ...Object.fromEntries(Object.entries(TYPES).map(([k, t]) => [k, t.weight])) };
  if (elapsed < 8) weights.bomb = weights.clock = weights.double = weights.freeze = 0;
  if (elapsed < 15) weights.ghost = 0;
  if (clocks >= 3) weights.clock = 0;
  if (mode === 'zen') weights.bomb = weights.clock = weights.freeze = 0;
  if (mode === 'survival') {
    weights.heart = clocks < 4 ? 0.5 : 0;
    weights.clock = 0;
  }
  const entries = Object.entries(TYPES).map(([k, t]) => [k, { ...t, weight: weights[k] }]);
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
    this.mode = 'classic';
    this.best = this.bestOf('classic');
  }

  bestOf(mode) {
    try {
      return Number(localStorage.getItem(bestKey(mode))) || 0;
    } catch {
      return 0;
    }
  }

  get active() {
    return this.state !== 'off';
  }

  start(e, mode = this.mode) {
    this.mode = MODES[mode] ? mode : 'classic';
    this.best = this.bestOf(this.mode);
    this.lives = 3;
    this.doubleT = 0;
    this.freezeT = 0;
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
    this.bossDone = false;
    this.clocks = 0;
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

  // For helpers (the familiar): the closest target worth hitting.
  nearestTarget(x, y) {
    let best = null;
    let bd = Infinity;
    for (const t of this.targets || []) {
      const T = TYPES[t.kind];
      if (t.dead || T.bomb || t.age < 0.3) continue;
      const d = Math.hypot(t.x - x, t.y - y);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  }
  hitNear(x, y, r) {
    for (const t of this.targets || []) if (!t.dead && !TYPES[t.kind].bomb && Math.hypot(t.x - x, t.y - y) < r + t.r) t.heat += 1;
  }

  // Leaving: a zen session is scored, an unfinished timed round is not.
  quit(e) {
    if (this.state === 'play' && this.mode === 'zen') this.#finish(e);
    else this.stop();
  }

  stop() {
    this.state = 'off';
    this.targets = [];
    this.unsub?.();
    this.unsub = null;
  }

  get multiplier() {
    return Math.min(5, 1 + Math.floor(this.combo / 5)) * (this.doubleT > 0 ? 2 : 1);
  }

  #spawn(e) {
    const kind = pickType(this.elapsed, this.clocks, this.mode);
    if (kind === 'clock' || kind === 'heart') this.clocks++;
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
      if (this.mode === 'survival') this.#loseLife(e);
      return;
    }
    if (T.heart) {
      this.lives = Math.min(5, this.lives + 1);
      this.#explode(e, t, T.rgb);
      this.#pop('+1 ♥', t.x, t.y, T.rgb, true);
      e.audio.play('chime', 0.8);
      return;
    }
    if (T.bonus) {
      if (T.bonus === 'double') this.doubleT = 8;
      else this.freezeT = 5;
      this.#explode(e, t, T.rgb);
      this.#pop(T.bonus === 'double' ? 'POINTS x2' : 'GEL !', t.x, t.y, T.rgb, true);
      e.audio.play(T.bonus === 'double' ? 'coin' : 'crack', 0.9);
      if (T.bonus === 'freeze') e.flash([200, 240, 255], 0.3, 2);
      return;
    }
    if (T.clock) {
      this.time += 3;
      this.#explode(e, t, T.rgb);
      this.#pop('+3 s', t.x, t.y, T.rgb, true);
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
    if (T.boss) {
      e.flash([255, 200, 240], 0.7, 1.5);
      e.shake(40);
      e.punch(0.08);
      e.audio.play('boom', 1);
      this.#pop('BOSS VAINCU !', e.W / 2, e.H * 0.35, [255, 120, 220], true);
      for (let i = 0; i < 3; i++) this.#explode(e, t, T.rgb);
    }
    e.audio.play(t.kind === 'gold' ? 'coin' : 'pop', 0.7);
    e.buzz?.(t.kind === 'gold' ? 30 : 15);
    e.emit('hit', { kind: t.kind, combo: this.combo });
  }

  #loseLife(e) {
    this.lives--;
    this.#pop(this.lives > 0 ? `♥ ${this.lives}` : 'PERDU', e.W / 2, e.H * 0.36, [255, 90, 120], true);
    e.flash([255, 30, 60], 0.3, 3);
    if (this.lives <= 0) this.#finish(e);
  }

  #clearAll(e, spell) {
    if (this.state !== 'play') return;
    for (const t of this.targets) {
      if (t.dead || TYPES[t.kind].bomb) continue;
      if (TYPES[t.kind].boss) {
        t.heat += 4;
        continue;
      }
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
    this.doubleT = Math.max(0, this.doubleT - dt);
    this.freezeT = Math.max(0, this.freezeT - dt);
    // Zen and survival have no clock; the boss comes in classic only.
    if (this.mode !== 'classic') this.time = Infinity;
    // Golden rain: a wave of gold stars late in a classic round, and every
    // 40 s in survival.
    const rainAt = this.mode === 'classic' ? [45] : this.mode === 'survival' ? [40, 80, 120, 160] : [];
    if (rainAt.some((t) => this.elapsed >= t && this.elapsed - dt < t)) {
      this.#pop('PLUIE D’OR !', e.W / 2, e.H * 0.3, [255, 215, 90], true);
      e.audio.play('chime', 1);
      e.flash([255, 220, 120], 0.25, 2);
      for (let k = 0; k < 6; k++) {
        const R = TYPES.gold.r * Math.min(e.W, e.H) * (e.W < e.H ? 1.4 : 1);
        this.targets.push({
          kind: 'gold',
          x: rand(0.12, 0.88) * e.W,
          y: rand(0.22, 0.7) * e.H,
          r: R,
          hp: 1,
          heat: 0,
          age: 0,
          life: 4,
          cool: 0,
          vx: rand(-1, 1) * e.W * 0.15,
          vy: rand(-1, 1) * e.H * 0.1,
          ph: rand(TAU),
        });
      }
    }
    if (!this.bossDone && this.mode === 'classic' && this.elapsed > 28) {
      this.bossDone = true;
      const R = TYPES.boss.r * Math.min(e.W, e.H) * (e.W < e.H ? 1.4 : 1);
      this.targets.push({
        kind: 'boss',
        x: e.W / 2,
        y: e.H * 0.42,
        r: R,
        hp: TYPES.boss.hp,
        heat: 0,
        age: 0,
        life: TYPES.boss.life,
        cool: 0,
        vx: e.W * 0.12,
        vy: e.H * 0.05,
        ph: 0,
      });
      this.#pop('BOSS !', e.W / 2, e.H * 0.28, [255, 90, 200], true);
      e.audio.play('thunder', 0.8);
      e.shake(20);
    }
    if (this.time <= 0) return this.#finish(e);
    // Faster and faster.
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.targets.length < 8) {
      this.#spawn(e);
      const ramp = this.mode === 'survival' ? 0.018 : this.mode === 'zen' ? 0.004 : 0.012;
      this.spawnT = Math.max(this.mode === 'survival' ? 0.25 : 0.35, 1.1 - this.elapsed * ramp);
    }
    const strike = Math.min(e.W, e.H) * 0.6;
    // Frozen: targets neither move nor age (power-ups and hearts still do).
    const frozen = this.freezeT > 0;
    for (const t of this.targets) {
      const still = frozen && !TYPES[t.kind].bonus && !TYPES[t.kind].heart;
      if (TYPES[t.kind].ghost && !still) {
        // Flee from the nearest hand, then drift calmly again.
        for (const h of hands) {
          const dx = t.x - h.palm.x;
          const dy = t.y - h.palm.y;
          const d = Math.hypot(dx, dy) || 1;
          if (h.presence > 0.4 && d < h.size * 3) {
            t.vx += (dx / d) * e.W * 3 * dt;
            t.vy += (dy / d) * e.H * 3 * dt;
          }
        }
        const sp = Math.hypot(t.vx, t.vy);
        const max = Math.max(e.W, e.H) * 0.6;
        if (sp > max) {
          t.vx *= max / sp;
          t.vy *= max / sp;
        }
        t.vx *= Math.exp(-dt * 1.5);
        t.vy *= Math.exp(-dt * 1.5);
      }
      t.age += still ? 0 : dt;
      t.cool -= dt;
      t.x = clamp(t.x + (still ? 0 : t.vx * dt), t.r, e.W - t.r);
      t.y = clamp(t.y + (still ? 0 : t.vy * dt), t.r, e.H - t.r);
      if (t.x <= t.r || t.x >= e.W - t.r) t.vx *= -1;
      if (t.y <= t.r || t.y >= e.H - t.r) t.vy *= -1;
      // The power touching it.
      const heat = e.heatAt(t.x, t.y);
      if (heat > 0.3) t.heat += dt * 3 * heat * (t.kind === 'boss' ? 0.6 : 1);
      // A fast hand strike through it.
      if (t.cool <= 0 && !TYPES[t.kind].ghost)
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
        // Missing a target breaks the combo, and costs a life in survival.
        if (!harmless(TYPES[t.kind])) {
          this.combo = 0;
          if (this.mode === 'survival' && this.state === 'play') this.#loseLife(e);
        }
      }
    }
    this.targets = this.targets.filter((t) => !t.dead);
    // Last 5 seconds: a tick each second.
    const n = Math.ceil(this.time);
    if (n <= 5 && n < this.lastTick) e.audio.play('tick', 0.5);
    this.lastTick = n;
  }

  #finish(e) {
    if (this.state === 'end') return;
    this.state = 'end';
    this.timer = 6;
    this.targets = [];
    this.record = this.score > this.best;
    if (this.record) {
      this.best = this.score;
      try {
        localStorage.setItem(bestKey(this.mode), String(this.best));
      } catch {
        /* not saved */
      }
    }
    e.audio.play(this.record ? 'teleport' : 'chime', 1);
    if (this.record) e.flash([255, 220, 120], 0.5, 1.5);
    this.onEnd?.({ mode: this.mode, score: this.score, best: this.best, record: this.record, maxCombo: this.maxCombo, hits: this.hits });
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
      text(`ARÈNE · ${MODES[this.mode].name.toUpperCase()}`, cx, e.H / 2 - 110 * u, 30, '#fff');
    } else if (this.state === 'play') {
      text(String(this.score), cx, top, 44, '#ffe7a8');
      const low = this.time < 10;
      if (this.mode === 'classic') text(`${Math.ceil(this.time)} s`, cx, top + 40 * u, 22, low ? '#ff6b6b' : '#fff');
      else if (this.mode === 'survival') text('♥'.repeat(Math.max(0, this.lives)), cx, top + 40 * u, 24, '#ff5a78');
      else text('ZEN', cx, top + 40 * u, 18, '#9ff5d0');
      const buffs = [this.doubleT > 0 && `x2 ${Math.ceil(this.doubleT)} s`, this.freezeT > 0 && `GEL ${Math.ceil(this.freezeT)} s`]
        .filter(Boolean)
        .join('  ·  ');
      if (buffs) text(buffs, cx, top + 86 * u, 17, '#9ff');
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
    if (t.kind === 'ghost') {
      // A little ghost: round head, wavy bottom, two eyes.
      ctx.fillStyle = 'rgba(235,245,255,0.85)';
      ctx.beginPath();
      ctx.arc(t.x, t.y - r * 0.2, r, Math.PI, 0);
      ctx.lineTo(t.x + r, t.y + r * 0.8);
      for (let k = 0; k < 4; k++) {
        const x0 = t.x + r - (k + 0.5) * (r / 2);
        ctx.quadraticCurveTo(x0, t.y + r * (0.5 + 0.3 * Math.sin(e.t * 8 + k)), t.x + r - (k + 1) * (r / 2), t.y + r * 0.8);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1a1a2e';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(t.x + side * r * 0.35, t.y - r * 0.25, r * 0.14, r * 0.2, 0, 0, TAU);
        ctx.fill();
      }
    } else if (t.kind === 'boss') {
      // A big spiky core with its health bar.
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(e.t * 0.6);
      ctx.fillStyle = `rgba(${T.rgb.join(',')},0.85)`;
      ctx.beginPath();
      for (let k = 0; k <= 16; k++) {
        const a = (k / 16) * TAU;
        const rr = r * (k % 2 ? 0.7 : 1.05);
        if (k) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.35, 0, TAU);
      ctx.fill();
      ctx.restore();
      const bw = r * 2.4;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(t.x - bw / 2, t.y - r * 1.6, bw, 8 * e.unit);
      ctx.fillStyle = `rgb(${T.rgb.join(',')})`;
      ctx.fillRect(t.x - bw / 2, t.y - r * 1.6, (bw * t.hp) / T.hp, 8 * e.unit);
    } else if (t.kind === 'crystal') {
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
      } else if (T.clock) ctx.fillText('+3', t.x, t.y);
      else if (T.heart) ctx.fillText('♥', t.x, t.y);
      else if (T.bonus === 'double') ctx.fillText('x2', t.x, t.y);
      else if (T.bonus === 'freeze') ctx.fillText('❄', t.x, t.y);
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
