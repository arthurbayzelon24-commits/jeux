// Anime-inspired powers: Chidori, Spirit Bomb, Getsuga crescent, Hollow
// Purple, Sharingan, Super Saiyan aura, Water Breathing, Fire Fist, Conqueror's
// Haki and Domain Expansion.
import { Particles, drawGlow, rand, TAU, noise1, clamp, dist, makeBolt, strokeBolts, drawBeam, rayToEdge } from './util.js';

const live = (hands) => hands.filter((h) => h.presence > 0.4);
const mainHand = (hands) => live(hands).sort((a, b) => b.size - a.size)[0];

// ---------- Chidori: a screeching ball of lightning held in the hand ----------
export function chidoriEffect() {
  const COLORS = [
    { name: 'Chidori', rgb: [120, 200, 255] },
    { name: 'Chidori noir', rgb: [170, 120, 255] },
    { name: 'Raikiri', rgb: [230, 245, 255] },
  ];
  let rgb = COLORS[0].rgb;
  const sparks = new Particles(400);
  let bolts = [];
  let timer = 0;
  let g = 0;
  return {
    id: 'chidori',
    name: 'Chidori',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      g = 0;
      bolts = [];
      sparks.clear();
    },
    update(dt, hands, e) {
      sparks.update(dt);
      const h = mainHand(hands);
      this.h = h;
      g = clamp(g + (h && (h.open || h.gesture === 'relaxed' || h.fist) ? dt * 2 : -dt * 3));
      timer -= dt;
      if (h && g > 0.05 && timer <= 0) {
        timer = 0.04;
        const k = e.charge?.scale || 1;
        const R = h.size * 0.55 * k;
        bolts = [];
        // Short arcs hugging the ball, plus long ones lashing out.
        for (let i = 0; i < 7; i++) {
          const a = rand(TAU);
          const L = R * rand(0.8, 1.8) * (i < 2 ? 3 : 1);
          bolts.push(
            ...makeBolt(h.palm.x, h.palm.y, h.palm.x + Math.cos(a) * L, h.palm.y + Math.sin(a) * L, { jag: 0.4, depth: 5, branch: 0.4 }),
          );
        }
        // Dragged behind a moving hand, like a charging run.
        if (h.speed > e.H * 0.8) {
          const l = h.speed || 1;
          bolts.push(
            ...makeBolt(h.palm.x, h.palm.y, h.palm.x - (h.vel.x / l) * R * 5, h.palm.y - (h.vel.y / l) * R * 5, { jag: 0.3, depth: 6 }),
          );
        }
        for (let i = 0; i < 4; i++) {
          const a = rand(TAU);
          const v = rand(200, 600) * e.unit;
          sparks.add({
            x: h.palm.x,
            y: h.palm.y,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v,
            drag: 3,
            life: rand(0.15, 0.35),
            size: rand(2, 4) * e.unit,
            rgb: [255, 255, 255],
            core: 0.6,
          });
        }
        if (Math.random() < 0.5) e.audio.play('zap', 0.35);
      }
      if (!h || g < 0.05) bolts = [];
      e.audio.loop('buzz', g * 0.8);
      if (h) e.light(h.palm.x, h.palm.y, h.size * 5, rgb, 0.14 * g);
    },
    draw(ctx, e) {
      sparks.draw(ctx);
      const h = this.h;
      if (!h || g < 0.05) return;
      const R = h.size * 0.55 * (e.charge?.scale || 1) * g;
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, rgb, h.palm.x, h.palm.y, R * 2.2, 0.45, 0.1);
      strokeBolts(ctx, bolts, rgb, 2.2 * e.unit, 0.95 * g);
      drawGlow(ctx, [255, 255, 255], h.palm.x, h.palm.y, R * 0.9 * (0.85 + 0.15 * Math.random()), 1, 0.5);
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

// ---------- Spirit Bomb: raise a hand, a giant sphere gathers energy ----------
export function spiritBombEffect() {
  const inflow = new Particles(500);
  const trail = new Particles(400);
  let size = 0;
  let ball = null;
  let thrown = null;
  return {
    id: 'genkidama',
    name: 'Genkidama',
    needs: { seg: false },
    start() {
      size = 0;
      ball = null;
      thrown = null;
      inflow.clear();
      trail.clear();
    },
    update(dt, hands, e) {
      inflow.update(dt, (p, d) => {
        // Energy streams pulled into the sphere.
        if (!ball) return;
        p.vx += (ball.x - p.x) * d * 6;
        p.vy += (ball.y - p.y) * d * 6;
        if (Math.hypot(ball.x - p.x, ball.y - p.y) < ball.r * 0.6) p.age = p.life;
      });
      trail.update(dt);
      const h = mainHand(hands);
      const raised = h && h.palm.y < e.H * 0.6 && (h.open || h.gesture === 'relaxed');
      if (thrown) {
        thrown.x += thrown.vx * dt;
        thrown.y += thrown.vy * dt;
        thrown.t += dt;
        for (let k = 0; k < 6; k++)
          trail.add({
            x: thrown.x + rand(-1, 1) * thrown.r * 0.6,
            y: thrown.y + rand(-1, 1) * thrown.r * 0.6,
            life: rand(0.3, 0.6),
            size: thrown.r * 0.4,
            rgb: [140, 200, 255],
            core: 0.2,
            alpha: 0.5,
          });
        const out = thrown.x < -thrown.r || thrown.x > e.W + thrown.r || thrown.y > e.H + thrown.r || thrown.y < -thrown.r * 2;
        if (out || thrown.t > 2.5) {
          e.flash([200, 230, 255], 0.9, 1.2);
          e.shake(40);
          e.punch(0.1);
          e.audio.play('boom', 1);
          e.audio.play('thunder', 0.8);
          thrown = null;
        }
      }
      if (raised && !thrown) {
        size = Math.min(1, size + dt * 0.25 * (e.charge?.scale || 1));
        const r = Math.min(e.W, e.H) * (0.08 + 0.32 * size);
        ball = { x: h.palm.x, y: h.palm.y - h.size * 0.6 - r, r };
        // Streams of light from every edge of the screen.
        for (let k = 0; k < 4; k++) {
          const side = (Math.random() * 4) | 0;
          const x = side === 0 ? 0 : side === 1 ? e.W : rand(e.W);
          const y = side === 2 ? 0 : side === 3 ? e.H : rand(e.H);
          inflow.add({ x, y, vx: 0, vy: 0, drag: 1.5, life: 1.6, size: rand(2, 5) * e.unit, rgb: [170, 220, 255], core: 0.6 });
        }
        e.audio.loop('hum', 0.3 + size * 0.6);
        e.light(ball.x, ball.y, ball.r * 4, [150, 210, 255], 0.3);
      } else if (ball && h && !thrown && h.vel.y > e.H * 1.2) {
        // Throw: a fast downward motion launches it.
        const l = h.speed || 1;
        thrown = { x: ball.x, y: ball.y, r: ball.r, vx: (h.vel.x / l) * e.H * 1.4, vy: Math.max(0.4, h.vel.y / l) * e.H * 1.4, t: 0 };
        ball = null;
        size = 0;
        e.audio.play('whoosh', 1);
      } else if (!raised) {
        size = Math.max(0, size - dt * 0.15);
        if (ball && size <= 0) ball = null;
        e.audio.loop('hum', size * 0.4);
      }
    },
    trigger(e) {
      if (!ball) return;
      thrown = { x: ball.x, y: ball.y, r: ball.r, vx: 0, vy: e.H * 1.2, t: 0 };
      ball = null;
      size = 0;
    },
    draw(ctx, e) {
      inflow.draw(ctx);
      trail.draw(ctx);
      const b = thrown || ball;
      if (!b) return;
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, [120, 190, 255], b.x, b.y, b.r * 1.8, 0.55, 0.15);
      drawGlow(ctx, [200, 235, 255], b.x, b.y, b.r * 1.05, 0.9, 0.55);
      // Swirling energy on the surface.
      ctx.lineWidth = Math.max(1, b.r * 0.03);
      for (let k = 0; k < 6; k++) {
        const a = e.t * (1.5 + k * 0.3) + k;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.r * (0.5 + k * 0.08), b.r * (0.2 + k * 0.1), a, 0, TAU * 0.6);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

// ---------- Getsuga Tensho: swing a closed fist, a crescent slash flies ----------
export function getsugaEffect() {
  const COLORS = [
    { name: 'Noir et rouge', rgb: [255, 40, 40], core: [20, 0, 0] },
    { name: 'Bleu', rgb: [80, 170, 255], core: [230, 245, 255] },
    { name: 'Blanc', rgb: [220, 230, 255], core: [255, 255, 255] },
  ];
  let scheme = COLORS[0];
  let slashes = [];
  const dust = new Particles(500);
  const cool = new Map();
  const fire = (e, x, y, dx, dy, big) => {
    slashes.push({ x, y, dx, dy, t: 0, r: (big ? 2.4 : 1) * Math.min(e.W, e.H) * 0.22 });
    e.audio.play('swing', 1);
    e.audio.play('whoosh', 0.8);
    e.shake(big ? 30 : 12);
  };
  return {
    id: 'getsuga',
    name: 'Getsuga Tenshō',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      scheme = COLORS[i];
    },
    start() {
      slashes = [];
      dust.clear();
    },
    update(dt, hands, e) {
      dust.update(dt);
      for (const h of live(hands)) {
        const c = (cool.get(h.id) || 0) - dt;
        cool.set(h.id, c);
        if (c <= 0 && (h.fist || h.point) && h.speed > Math.min(e.W, e.H) * 1.6) {
          fire(e, h.palm.x, h.palm.y, h.vel.x / h.speed, h.vel.y / h.speed, false);
          cool.set(h.id, 0.5);
        }
      }
      for (const s of slashes) {
        s.t += dt;
        const v = Math.max(e.W, e.H) * 1.6;
        s.x += s.dx * v * dt;
        s.y += s.dy * v * dt;
        for (let k = 0; k < 6; k++) {
          const a = Math.atan2(s.dy, s.dx) + Math.PI / 2 + rand(-1, 1) * 1.2;
          dust.add({
            x: s.x + Math.cos(a) * s.r * rand(0.6, 1),
            y: s.y + Math.sin(a) * s.r * rand(0.6, 1),
            vx: -s.dx * 200,
            vy: -s.dy * 200,
            drag: 2,
            life: rand(0.2, 0.5),
            size: rand(3, 8) * e.unit,
            rgb: scheme.rgb,
            core: 0.3,
          });
        }
      }
      slashes = slashes.filter((s) => s.t < 1.4);
    },
    ultimate(e, a) {
      for (let k = -1; k <= 1; k++) fire(e, a.x, a.y, Math.sin(k * 0.3), -Math.cos(k * 0.3), true);
    },
    draw(ctx, e) {
      dust.draw(ctx);
      for (const s of slashes) {
        const fade = clamp(1.4 - s.t);
        const ang = Math.atan2(s.dy, s.dx);
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(ang);
        // A crescent: an outer arc minus an inner, offset arc.
        const crescent = (r, w) => {
          ctx.beginPath();
          ctx.arc(0, 0, r, -1.25, 1.25);
          ctx.arc(-w, 0, r * 0.95, 1.2, -1.2, true);
          ctx.closePath();
        };
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(${scheme.rgb.join(',')},${0.55 * fade})`;
        crescent(s.r * 1.08, s.r * 0.35);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(${scheme.core.join(',')},${0.9 * fade})`;
        crescent(s.r, s.r * 0.22);
        ctx.fill();
        ctx.restore();
      }
    },
  };
}

// ---------- Hollow Purple: blue in one hand, red in the other, merge them ----------
export function hollowPurpleEffect() {
  const BLUE = [70, 140, 255];
  const RED = [255, 50, 60];
  const PURPLE = [190, 80, 255];
  const dust = new Particles(500);
  let shot = null;
  let merge = 0;
  return {
    id: 'hollowpurple',
    name: 'Violet creux',
    needs: { seg: false },
    start() {
      shot = null;
      merge = 0;
      dust.clear();
    },
    update(dt, hands, e) {
      dust.update(dt, (p, d) => {
        if (p.pull) {
          p.vx += (p.pull.x - p.x) * d * 4;
          p.vy += (p.pull.y - p.y) * d * 4;
        }
      });
      const hs = live(hands).sort((a, b) => a.palm.x - b.palm.x);
      this.orbs = hs.slice(0, 2).map((h, i) => ({
        x: h.palm.x,
        y: h.palm.y - h.size * 0.7,
        r: h.size * 0.35 * (e.charge?.scale || 1),
        rgb: hs.length === 1 ? BLUE : i === 0 ? BLUE : RED,
      }));
      // Blue pulls things in, red pushes them away.
      for (const o of this.orbs)
        if (Math.random() < 0.6) {
          const a = rand(TAU);
          const R = o.r * rand(2.5, 4);
          const blue = o.rgb === BLUE;
          dust.add({
            x: o.x + Math.cos(a) * (blue ? R : o.r),
            y: o.y + Math.sin(a) * (blue ? R : o.r),
            vx: blue ? 0 : Math.cos(a) * 300,
            vy: blue ? 0 : Math.sin(a) * 300,
            pull: blue ? o : null,
            life: 0.6,
            size: rand(2, 4) * e.unit,
            rgb: o.rgb,
            core: 0.5,
          });
        }
      if (this.orbs.length === 2) {
        const d = dist(this.orbs[0], this.orbs[1]);
        merge = clamp(1 - (d - this.orbs[0].r * 2) / (Math.min(e.W, e.H) * 0.35));
        if (merge > 0.95 && !shot) {
          const c = { x: (this.orbs[0].x + this.orbs[1].x) / 2, y: (this.orbs[0].y + this.orbs[1].y) / 2 };
          // Fired away from the centre of the body (towards the top of the screen).
          shot = { x: c.x, y: c.y, dx: 0, dy: -1, t: 0, r: this.orbs[0].r * 3 };
          e.flash(PURPLE, 0.7, 1.5);
          e.shake(35);
          e.punch(0.08);
          e.audio.play('boom', 1);
          e.audio.play('teleport', 0.8);
        }
      } else merge = 0;
      if (shot) {
        shot.t += dt;
        if (shot.t > 1.6) shot = null;
      }
      e.audio.loop('hum', 0.2 + merge * 0.6);
    },
    trigger(e) {
      shot = { x: e.W / 2, y: e.H * 0.6, dx: 0, dy: -1, t: 0, r: Math.min(e.W, e.H) * 0.12 };
      e.flash(PURPLE, 0.7, 1.5);
      e.audio.play('boom', 1);
    },
    draw(ctx, e) {
      dust.draw(ctx);
      ctx.globalCompositeOperation = 'lighter';
      for (const o of this.orbs || []) {
        const rgb = merge > 0.4 ? PURPLE.map((v, i) => Math.round(o.rgb[i] + (v - o.rgb[i]) * merge)) : o.rgb;
        drawGlow(ctx, rgb, o.x, o.y, o.r * 3, 0.7, 0.1);
        drawGlow(ctx, [255, 255, 255], o.x, o.y, o.r, 0.9, 0.5);
      }
      if (shot) {
        const t = shot.t;
        const L = rayToEdge(shot.x, shot.y, shot.dx, shot.dy, e.W, e.H) + shot.r;
        const head = Math.min(L, t * Math.max(e.W, e.H) * 2.5);
        const fade = clamp(1.6 - t);
        drawBeam(ctx, shot.x, shot.y, shot.x + shot.dx * head, shot.y + shot.dy * head, shot.r * 2.2 * fade, PURPLE, fade, e.t);
        drawGlow(ctx, [230, 180, 255], shot.x + shot.dx * head, shot.y + shot.dy * head, shot.r * 3, fade, 0.3);
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

// ---------- Sharingan: red eyes with spinning tomoe (body points) ----------
export function sharinganEffect() {
  const KINDS = [
    { name: 'Sharingan', mangekyo: false },
    { name: 'Mangekyō', mangekyo: true },
  ];
  let kind = KINDS[0];
  let spin = 0;
  let open = 0;
  return {
    id: 'sharingan',
    name: 'Sharingan',
    colors: KINDS,
    needs: { seg: false, pose: true },
    setColor(i) {
      kind = KINDS[i];
    },
    start() {
      open = 0;
    },
    update(dt, hands, e) {
      const b = e.body.points;
      this.eyes = null;
      if (!b || e.body.presence < 0.3 || b[2].v < 0.5 || b[5].v < 0.5) {
        open = Math.max(0, open - dt * 3);
        return;
      }
      open = Math.min(1, open + dt * 2);
      spin += dt * (2 + (hands.some((h) => h.presence > 0.5) ? 4 : 0));
      const d = Math.hypot(b[2].x - b[5].x, b[2].y - b[5].y);
      this.eyes = [b[2], b[5]].map((p) => ({ x: p.x, y: p.y, r: d * 0.24 }));
      e.light(this.eyes[0].x, this.eyes[0].y, d * 2, [255, 0, 0], 0.15 * open);
    },
    draw(ctx, e) {
      if (!this.eyes) return;
      for (const [i, ey] of this.eyes.entries()) {
        const r = ey.r * open;
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, [255, 30, 30], ey.x, ey.y, r * 2.4, 0.5);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#c4000c';
        ctx.beginPath();
        ctx.arc(ey.x, ey.y, r, 0, TAU);
        ctx.fill();
        ctx.save();
        ctx.translate(ey.x, ey.y);
        ctx.rotate(spin * (i ? -1 : 1));
        ctx.fillStyle = '#100';
        ctx.strokeStyle = '#100';
        if (kind.mangekyo) {
          // Pinwheel pattern.
          for (let k = 0; k < 3; k++) {
            ctx.rotate(TAU / 3);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(r * 0.9, -r * 0.2, r * 0.75, r * 0.6);
            ctx.quadraticCurveTo(r * 0.3, r * 0.2, 0, 0);
            ctx.fill();
          }
        } else {
          ctx.lineWidth = Math.max(1, r * 0.08);
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.6, 0, TAU);
          ctx.stroke();
          for (let k = 0; k < 3; k++) {
            ctx.rotate(TAU / 3);
            ctx.beginPath();
            ctx.arc(r * 0.6, 0, r * 0.16, 0, TAU);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(r * 0.6 + r * 0.16, 0);
            ctx.quadraticCurveTo(r * 0.7, r * 0.3, r * 0.45, r * 0.32);
            ctx.lineTo(r * 0.6, 0);
            ctx.fill();
          }
        }
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.2, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    },
  };
}

// ---------- Super Saiyan: a golden spiky aura and sparks around the body ----------
export function superSaiyanEffect() {
  const COLORS = [
    { name: 'Super Saiyan', rgb: [255, 210, 60] },
    { name: 'Dieu (bleu)', rgb: [70, 190, 255] },
    { name: 'Ultra (argent)', rgb: [220, 225, 255] },
    { name: 'Rosé', rgb: [255, 110, 180] },
  ];
  let rgb = COLORS[0].rgb;
  const flames = new Particles(700);
  let bolts = [];
  let boltT = 0;
  let power = 0;
  return {
    id: 'supersaiyan',
    name: 'Super Saiyan',
    colors: COLORS,
    needs: { seg: true },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      flames.clear();
      power = 0;
    },
    update(dt, hands, e) {
      flames.update(dt);
      const s = e.seg;
      // Clenched fists power up, like shouting a transformation.
      const fists = hands.some((h) => h.presence > 0.5 && h.fist);
      power += ((fists ? 1.3 : 0.8) * (e.charge?.scale || 1) - power) * Math.min(1, dt * 2);
      e.audio.loop('wind', 0.3 * power);
      if (!e.segActive || !s?.present || !s.edges.length) return;
      const n = Math.round(18 * power);
      for (let i = 0; i < n; i++) {
        const p = s.edges[(Math.random() * s.edges.length) | 0];
        // Flames shoot straight up, in sharp spikes.
        flames.add({
          x: p.x,
          y: p.y,
          vx: (p.x - s.centroid.x) * 0.3,
          vy: -rand(300, 700) * e.unit * power,
          drag: 1,
          life: rand(0.25, 0.55),
          size: rand(8, 20) * e.unit,
          rgb,
          core: 0.2,
          alpha: 0.6,
          spike: true,
        });
      }
      boltT -= dt;
      if (boltT <= 0 && power > 1.05) {
        boltT = rand(0.06, 0.2);
        bolts = [];
        for (let k = 0; k < 2; k++) {
          const a = s.edges[(Math.random() * s.edges.length) | 0];
          bolts.push(...makeBolt(a.x, a.y, a.x + rand(-80, 80) * e.unit, a.y + rand(-120, 60) * e.unit, { jag: 0.45, depth: 4 }));
        }
        e.audio.play('zap', 0.2);
      } else if (boltT < 0.03) bolts = [];
      e.light(s.centroid.x, s.centroid.y, Math.max(e.W, e.H) * 0.6, rgb, 0.18 * power);
    },
    drawBehind(ctx, e) {
      // Spiky flames: stretched, pointed glows going up.
      ctx.globalCompositeOperation = 'lighter';
      for (const p of flames.list) {
        const t = p.age / p.life;
        const s = p.size * (1 - t * 0.5);
        const a = p.alpha * (1 - t);
        ctx.fillStyle = `rgba(${rgb.join(',')},${a})`;
        ctx.beginPath();
        ctx.moveTo(p.x - s * 0.5, p.y);
        ctx.quadraticCurveTo(p.x, p.y - s * 3.5, p.x + p.vx * 0.02, p.y - s * 4.2);
        ctx.quadraticCurveTo(p.x, p.y - s * 3.5, p.x + s * 0.5, p.y);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    },
    draw(ctx, e) {
      strokeBolts(ctx, bolts, [200, 230, 255], 1.6 * e.unit, 0.9);
      for (const h of e.hands)
        if (h.presence > 0.3) {
          ctx.globalCompositeOperation = 'lighter';
          drawGlow(ctx, rgb, h.palm.x, h.palm.y, h.size * 1.4, 0.4 * power);
          ctx.globalCompositeOperation = 'source-over';
        }
    },
  };
}

// ---------- Water Breathing: a flowing wave follows your hand like a sword ----------
export function waterBreathingEffect() {
  let path = [];
  const foam = new Particles(500);
  return {
    id: 'waterbreath',
    name: 'Souffle de l’eau',
    needs: { seg: false },
    start() {
      path = [];
      foam.clear();
    },
    update(dt, hands, e) {
      foam.update(dt);
      const h = mainHand(hands);
      for (const p of path) p.age += dt;
      if (h) {
        const tip = h.fist ? h.palm : h.lm[8];
        path.unshift({ x: tip.x, y: tip.y, age: 0, w: (h.size * 0.35 + Math.min(h.speed, e.H * 3) * 0.03) * (e.charge?.scale || 1) });
        if (h.speed > e.H * 1.2) {
          for (let k = 0; k < 3; k++)
            foam.add({
              x: tip.x,
              y: tip.y,
              vx: rand(-150, 150),
              vy: rand(-150, 150),
              drag: 2,
              life: rand(0.3, 0.8),
              size: rand(2, 5) * e.unit,
              rgb: [230, 245, 255],
              core: 0.6,
            });
          if (Math.random() < dt * 4) e.audio.play('whoosh', 0.5);
        }
      }
      path = path.filter((p) => p.age < 0.7).slice(0, 60);
    },
    draw(ctx, e) {
      if (path.length > 2) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // Deep blue body, lighter band, and white crest curls.
        for (const [k, col] of [
          [1, 'rgba(20,80,190,0.55)'],
          [0.6, 'rgba(60,150,255,0.6)'],
          [0.18, 'rgba(235,248,255,0.9)'],
        ]) {
          for (let i = 1; i < path.length; i++) {
            const a = path[i - 1];
            const b = path[i];
            const fade = 1 - b.age / 0.7;
            ctx.strokeStyle = col;
            ctx.globalAlpha = fade;
            ctx.lineWidth = b.w * k * fade + 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
        // Ukiyo-e curls along the wave.
        ctx.strokeStyle = 'rgba(240,250,255,0.85)';
        ctx.lineWidth = 2 * e.unit;
        for (let i = 4; i < path.length; i += 6) {
          const p = path[i];
          const r = p.w * 0.35 * (1 - p.age / 0.7);
          if (r < 2) continue;
          ctx.beginPath();
          ctx.arc(p.x, p.y - p.w * 0.3, r, Math.PI, Math.PI + 4.2 + noise1(i + e.t) * 0.5);
          ctx.stroke();
        }
      }
      foam.draw(ctx);
    },
  };
}

// ---------- Fire Fist: a burning fist, punch to launch a giant fire fist ----------
export function fireFistEffect() {
  const fire = new Particles(900);
  let blasts = [];
  const cool = new Map();
  return {
    id: 'firefist',
    name: 'Poing ardent',
    needs: { seg: false },
    start() {
      fire.clear();
      blasts = [];
    },
    update(dt, hands, e) {
      fire.update(dt);
      for (const h of live(hands)) {
        const c = (cool.get(h.id) || 0) - dt;
        cool.set(h.id, c);
        if (!h.fist) continue;
        const s = e.charge?.scale || 1;
        for (let k = 0; k < 3; k++)
          fire.add({
            x: h.palm.x + rand(-1, 1) * h.size * 0.4,
            y: h.palm.y + rand(-1, 1) * h.size * 0.3,
            vx: rand(-30, 30),
            vy: -rand(80, 220) * e.unit,
            g: -150,
            life: rand(0.3, 0.6),
            size: h.size * 0.35 * s * rand(0.7, 1.2),
            grow: 0.2,
            fire: true,
            alpha: 0.6,
          });
        if (c <= 0 && h.speed > Math.min(e.W, e.H) * 1.5) {
          blasts.push({ x: h.palm.x, y: h.palm.y, dx: h.vel.x / h.speed, dy: h.vel.y / h.speed, t: 0, r: h.size * 1.1 * s });
          cool.set(h.id, 0.6);
          e.audio.play('roar', 0.8);
          e.audio.play('whoosh', 0.8);
          e.shake(18);
        }
      }
      for (const b of blasts) {
        b.t += dt;
        const v = Math.max(e.W, e.H) * 1.5;
        b.x += b.dx * v * dt;
        b.y += b.dy * v * dt;
        b.r *= 1 + dt * 1.2;
        for (let k = 0; k < 5; k++)
          fire.add({
            x: b.x + rand(-1, 1) * b.r * 0.7,
            y: b.y + rand(-1, 1) * b.r * 0.7,
            vx: -b.dx * 300 + rand(-60, 60),
            vy: -b.dy * 300 + rand(-60, 60),
            life: rand(0.3, 0.6),
            size: b.r * rand(0.35, 0.65),
            grow: 0.5,
            fire: true,
            alpha: 0.3,
          });
        e.light(b.x, b.y, b.r * 5, [255, 140, 40], 0.18);
      }
      blasts = blasts.filter((b) => b.t < 1.2);
      e.audio.loop('fire', hands.some((h) => h.fist && h.presence > 0.4) ? 0.5 : 0.1);
    },
    ultimate(e, a) {
      for (let k = 0; k < 5; k++)
        blasts.push({
          x: a.x,
          y: a.y,
          dx: Math.cos(-Math.PI / 2 + (k - 2) * 0.35),
          dy: Math.sin(-Math.PI / 2 + (k - 2) * 0.35),
          t: 0,
          r: Math.min(e.W, e.H) * 0.1,
        });
    },
    draw(ctx) {
      fire.draw(ctx);
    },
  };
}

// ---------- Conqueror's Haki: clench your fist, red-black lightning everywhere ----------
export function hakiEffect() {
  let bolts = [];
  let timer = 0;
  let level = 0;
  let waves = [];
  return {
    id: 'haki',
    name: 'Haki des rois',
    needs: { seg: false },
    start() {
      bolts = [];
      waves = [];
      level = 0;
    },
    update(dt, hands, e) {
      const h = live(hands).find((x) => x.fist);
      const was = level;
      level = clamp(level + (h ? dt * 1.5 : -dt * 2));
      if (h && was < 0.05 && level >= 0.05) {
        waves.push({ x: h.palm.x, y: h.palm.y, t: 0 });
        e.audio.play('boom', 0.7);
        e.shake(20);
      }
      waves = waves.filter((w) => (w.t += dt) < 1.2);
      timer -= dt;
      if (level > 0.1 && timer <= 0) {
        timer = rand(0.05, 0.15);
        bolts = [];
        const o = h ? h.palm : { x: e.W / 2, y: e.H / 2 };
        const n = Math.round(3 + level * 5 * (e.charge?.scale || 1));
        for (let i = 0; i < n; i++) {
          const a = rand(TAU);
          const L = Math.max(e.W, e.H) * rand(0.3, 0.8) * level;
          bolts.push(...makeBolt(o.x, o.y, o.x + Math.cos(a) * L, o.y + Math.sin(a) * L, { jag: 0.35, depth: 6, branch: 0.4 }));
        }
        if (Math.random() < 0.4) e.audio.play('crack', 0.5);
      }
      if (level <= 0.1) bolts = [];
      e.audio.loop('hum', level * 0.6);
    },
    ultimate(e, a) {
      for (let k = 0; k < 3; k++) waves.push({ x: a.x, y: a.y, t: -k * 0.15 });
    },
    draw(ctx, e) {
      if (level > 0.01) {
        // The world darkens under the pressure.
        ctx.fillStyle = `rgba(20,0,10,${0.35 * level})`;
        ctx.fillRect(-e.W, -e.H, e.W * 3, e.H * 3);
      }
      strokeBolts(ctx, bolts, [20, 0, 0], 6 * e.unit, 0.7 * level);
      ctx.globalCompositeOperation = 'lighter';
      strokeBolts(ctx, bolts, [255, 30, 50], 2 * e.unit, level);
      for (const w of waves) {
        if (w.t < 0) continue;
        const R = w.t * Math.max(e.W, e.H);
        ctx.strokeStyle = `rgba(255,40,60,${0.6 * (1 - w.t / 1.2)})`;
        ctx.lineWidth = 14 * e.unit * (1 - w.t / 1.2) + 1;
        ctx.beginPath();
        ctx.arc(w.x, w.y, R, 0, TAU);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

// ---------- Domain Expansion: make the peace sign, the world becomes a void ----------
export function domainEffect() {
  const KINDS = [
    { name: 'Vide infini', bg: [5, 5, 20], line: [180, 220, 255] },
    { name: 'Sanctuaire', bg: [30, 0, 0], line: [255, 60, 60] },
  ];
  let kind = KINDS[0];
  let stars = [];
  let open = 0;
  let hold = 0;
  let timer = 0;
  const fx = {
    id: 'domain',
    name: 'Extension du territoire',
    colors: KINDS,
    needs: { seg: true },
    setColor(i) {
      kind = KINDS[i];
    },
    start() {
      open = 0;
      timer = 0;
    },
    trigger(e) {
      timer = 6;
      e.flash(kind.line, 0.8, 1.2);
      e.audio.play('teleport', 1);
      e.audio.play('boom', 0.6);
    },
    update(dt, hands, e) {
      if (!stars.length) stars = Array.from({ length: 220 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random() }));
      const sign = live(hands).some((h) => h.gesture === 'peace' || h.point);
      hold = sign ? hold + dt : 0;
      if (hold > 0.8 && timer <= 0) this.trigger(e);
      timer -= dt;
      open = clamp(open + (timer > 0 ? dt * 2 : -dt * 1.5));
      for (const s of stars) {
        s.z -= dt * 0.15;
        if (s.z <= 0.02) {
          s.z = 1;
          s.x = Math.random();
          s.y = Math.random();
        }
      }
      e.audio.loop('hum', open * 0.5);
    },
    // The void replaces the background; you stay in it (body cut-out).
    drawBehind(ctx, e) {
      if (open < 0.01) return;
      const cx = e.W / 2;
      const cy = e.H / 2;
      const R = Math.hypot(e.W, e.H) * 0.6 * open;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.clip();
      ctx.fillStyle = `rgb(${kind.bg.join(',')})`;
      ctx.fillRect(0, 0, e.W, e.H);
      ctx.globalCompositeOperation = 'lighter';
      for (const s of stars) {
        const k = 0.5 / s.z;
        const x = cx + (s.x - 0.5) * e.W * k;
        const y = cy + (s.y - 0.5) * e.H * k;
        if (x < 0 || x > e.W || y < 0 || y > e.H) continue;
        drawGlow(ctx, kind.line, x, y, (1.5 / s.z) * e.unit, 0.8);
      }
      // Rings rushing outward.
      ctx.lineWidth = 1.5 * e.unit;
      for (let k = 0; k < 6; k++) {
        const r = (((e.t * 0.3 + k / 6) % 1) * Math.hypot(e.W, e.H)) / 2;
        ctx.strokeStyle = `rgba(${kind.line.join(',')},${0.35 * (1 - r / Math.hypot(e.W, e.H))})`;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    },
    draw(ctx, e) {
      if (open < 0.01) return;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${kind.line.join(',')},${0.8 * (1 - open) + 0.2})`;
      ctx.lineWidth = 4 * e.unit;
      ctx.beginPath();
      ctx.arc(e.W / 2, e.H / 2, Math.hypot(e.W, e.H) * 0.6 * open, 0, TAU);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    },
  };
  fx.action = { label: 'Territoire', run: (e) => fx.trigger(e) };
  return fx;
}
