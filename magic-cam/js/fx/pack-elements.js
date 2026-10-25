// Elemental powers: fire dragon, tornado, meteor shower, lava orb, mini sun,
// sonic clap.
import { Particles, drawGlow, rand, TAU, noise1, clamp, dist, fireSprite, MESHES, rockMesh, drawMesh, rotMatrix } from './util.js';

const mainHand = (hands) => hands.filter((h) => h.presence > 0.4).sort((a, b) => b.size - a.size)[0];

// ---------- Fire dragon: a serpent of flames that follows your index finger ----------
export function dragonEffect() {
  const COLORS = [
    { name: 'Dragon de feu', rgb: [255, 120, 30], fire: true },
    { name: 'Dragon de glace', rgb: [90, 190, 255] },
    { name: 'Dragon de jade', rgb: [70, 255, 140] },
    { name: 'Dragon d’ombre', rgb: [170, 70, 255] },
  ];
  let scheme = COLORS[0];
  const fire = new Particles(600);
  let body = [];
  const N = 30;
  return {
    id: 'dragon',
    name: 'Dragon de feu',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      scheme = COLORS[i];
    },
    start() {
      body = [];
      fire.clear();
    },
    update(dt, hands, e) {
      fire.update(dt);
      const h = mainHand(hands);
      const tgt = h ? h.lm[8] : { x: e.W * (0.5 + 0.35 * Math.cos(e.t * 0.7)), y: e.H * (0.4 + 0.2 * Math.sin(e.t * 1.3)) };
      const gap = (h ? h.size : 80 * e.unit) * 0.28;
      if (!body.length) body = Array.from({ length: N }, () => ({ x: tgt.x, y: tgt.y }));
      // The head chases the target with a slithering wave; each segment follows.
      const head = body[0];
      const wob = Math.sin(e.t * 6) * gap * 0.8;
      head.x += (tgt.x + wob - head.x) * Math.min(1, dt * 9);
      head.y += (tgt.y - head.y) * Math.min(1, dt * 9);
      for (let i = 1; i < N; i++) {
        const a = body[i - 1];
        const b = body[i];
        const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        if (d > gap) {
          b.x = a.x + ((b.x - a.x) / d) * gap;
          b.y = a.y + ((b.y - a.y) / d) * gap;
        }
      }
      for (let i = 0; i < N; i += 3) {
        const p = body[i];
        fire.add({
          x: p.x + rand(-4, 4),
          y: p.y + rand(-4, 4),
          vx: rand(-30, 30),
          vy: -rand(40, 120) * e.unit,
          g: -100,
          life: rand(0.25, 0.5),
          size: gap * (1.3 - i / N) * rand(0.8, 1.2),
          grow: 0.3,
          fire: !!scheme.fire,
          rgb: scheme.rgb,
          alpha: 0.5,
          core: 0.2,
        });
      }
      // Breath of fire when the head moves fast.
      const sp = Math.hypot(head.x - body[2].x, head.y - body[2].y) / gap;
      if (sp > 1.5 || (h && h.open)) {
        const dx = head.x - body[1].x;
        const dy = head.y - body[1].y;
        const l = Math.hypot(dx, dy) || 1;
        for (let k = 0; k < 6; k++)
          fire.add({
            x: head.x,
            y: head.y,
            vx: (dx / l) * rand(500, 900) * e.unit + rand(-80, 80),
            vy: (dy / l) * rand(500, 900) * e.unit + rand(-80, 80),
            drag: 2,
            life: rand(0.3, 0.6),
            size: gap * rand(1, 1.8),
            grow: 1.8,
            fire: !!scheme.fire,
            rgb: scheme.rgb,
            alpha: 0.45,
            core: 0.2,
          });
      }
      e.light(head.x, head.y, gap * 10, scheme.rgb, 0.18);
      e.audio.loop('fire', 0.5);
    },
    draw(ctx, e) {
      fire.draw(ctx);
      if (!body.length) return;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = N - 1; i >= 0; i--) {
        const p = body[i];
        const r = (1 - i / N) * 0.9 + 0.25;
        drawGlow(ctx, scheme.rgb, p.x, p.y, 34 * e.unit * r, 0.55, 0.25);
        if (i % 3 === 0) drawGlow(ctx, [255, 255, 255], p.x, p.y, 10 * e.unit * r, 0.6);
      }
      // Head: glowing eyes and horns.
      const h0 = body[0];
      const h1 = body[2];
      const a = Math.atan2(h0.y - h1.y, h0.x - h1.x);
      const s = 24 * e.unit;
      ctx.save();
      ctx.translate(h0.x, h0.y);
      ctx.rotate(a);
      ctx.strokeStyle = `rgba(${scheme.rgb.join(',')},0.9)`;
      ctx.lineWidth = 3 * e.unit;
      ctx.beginPath();
      ctx.moveTo(-s * 0.4, -s * 0.5);
      ctx.quadraticCurveTo(-s * 1.2, -s * 1.3, -s * 1.6, -s * 1.1);
      ctx.moveTo(-s * 0.4, s * 0.5);
      ctx.quadraticCurveTo(-s * 1.2, s * 1.3, -s * 1.6, s * 1.1);
      ctx.stroke();
      drawGlow(ctx, [255, 255, 200], s * 0.3, -s * 0.35, s * 0.35, 1);
      drawGlow(ctx, [255, 255, 200], s * 0.3, s * 0.35, s * 0.35, 1);
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

// ---------- Tornado: a spinning funnel of wind and debris above the palm ----------
export function tornadoEffect() {
  const COLORS = [
    { name: 'Tempête', rgb: [200, 215, 230] },
    { name: 'Tornade de feu', rgb: [255, 140, 50] },
    { name: 'Cyclone bleu', rgb: [90, 180, 255] },
  ];
  let rgb = COLORS[0].rgb;
  const bits = Array.from({ length: 260 }, () => ({ h: Math.random(), a: rand(TAU), s: rand(0.6, 1.4), k: Math.random() < 0.15 }));
  const rocks = Array.from({ length: 4 }, (_, i) => ({ mesh: rockMesh(), a: (i / 4) * TAU, h: rand(0.3, 0.9) }));
  let g = 0;
  return {
    id: 'tornado',
    name: 'Tornade',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      g = 0;
    },
    update(dt, hands, e) {
      const h = mainHand(hands);
      this.h = h;
      g = clamp(g + (h && (h.open || h.gesture === 'relaxed') ? dt * 1.2 : -dt * 2));
      const spin = 5 + g * 4;
      for (const b of bits) {
        b.a += dt * spin * (1.4 - b.h * 0.6) * b.s;
        b.h += dt * 0.25 * b.s;
        if (b.h > 1) b.h = 0;
      }
      for (const r of rocks) r.a += dt * spin * 0.5;
      e.audio.loop('hum', g * 0.4);
      if (h && g > 0.2) e.light(h.palm.x, h.palm.y - h.size * 2, h.size * 5, rgb, 0.1 * g);
    },
    draw(ctx, e) {
      const h = this.h;
      if (!h || g < 0.02) return;
      const base = { x: h.palm.x, y: h.palm.y - h.size * 0.4 };
      const H = h.size * 4.2 * g;
      const r0 = h.size * 0.2;
      const r1 = h.size * 1.8 * g;
      const at = (b) => {
        const rad = r0 + (r1 - r0) * b.h * b.h;
        const sway = noise1(e.t * 2 + b.h * 3) * h.size * 0.4 * b.h;
        return { x: base.x + Math.cos(b.a) * rad + sway, y: base.y - b.h * H + Math.sin(b.a) * rad * 0.25, z: Math.sin(b.a) };
      };
      // Funnel shells.
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 10; k++) {
        const v = k / 9;
        const rad = r0 + (r1 - r0) * v * v;
        ctx.strokeStyle = `rgba(${rgb.join(',')},${0.12 + 0.08 * Math.sin(e.t * 8 + k)})`;
        ctx.lineWidth = 3 * e.unit;
        ctx.beginPath();
        ctx.ellipse(base.x + noise1(e.t * 2 + v * 3) * h.size * 0.4 * v, base.y - v * H, rad, rad * 0.25, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const b of bits) {
        const p = at(b);
        const a = 0.35 + 0.5 * (p.z > 0 ? 1 : 0.5);
        if (b.k) {
          ctx.fillStyle = `rgba(60,50,45,${a})`;
          ctx.fillRect(p.x, p.y, 5 * e.unit, 3 * e.unit);
        } else {
          ctx.strokeStyle = `rgba(${rgb.join(',')},${a * 0.6})`;
          ctx.lineWidth = 1.5 * e.unit;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - Math.sin(b.a) * 14 * e.unit, p.y + Math.cos(b.a) * 3 * e.unit);
          ctx.stroke();
        }
      }
      for (const r of rocks) {
        const p = at({ h: r.h, a: r.a, s: 1 });
        drawMesh(ctx, r.mesh, {
          x: p.x,
          y: p.y,
          size: h.size * 0.18 * g,
          rot: rotMatrix(e.t * 3 + r.a, e.t * 2, 0),
          rgb: [110, 100, 95],
          emissive: 0.3,
        });
      }
    },
  };
}

// ---------- Meteor shower: raise a hand and meteors rain down ----------
export function meteorEffect() {
  const COLORS = [
    { name: 'Météorites', rgb: [255, 140, 50] },
    { name: 'Comètes bleues', rgb: [100, 180, 255] },
    { name: 'Pluie verte', rgb: [90, 255, 120] },
  ];
  let rgb = COLORS[0].rgb;
  const trail = new Particles(900);
  let rocks = [];
  let timer = 0;
  return {
    id: 'meteor',
    name: 'Pluie de météorites',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      trail.clear();
      rocks = [];
    },
    update(dt, hands, e) {
      trail.update(dt);
      timer -= dt;
      const h = mainHand(hands);
      const raised = h && h.palm.y < e.H * 0.55;
      if (timer <= 0) {
        timer = raised ? rand(0.12, 0.3) : rand(0.8, 1.6);
        const tx = h ? h.palm.x + rand(-0.3, 0.3) * e.W : rand(0.1, 0.9) * e.W;
        const x0 = tx + e.W * rand(0.3, 0.6);
        const ty = e.H * rand(0.75, 0.95);
        const time = rand(0.7, 1.1);
        rocks.push({
          x: x0,
          y: -40,
          vx: (tx - x0) / time,
          vy: (ty + 40) / time,
          ty,
          s: rand(12, 26) * e.unit,
          mesh: rockMesh(),
          rot: rand(TAU),
        });
      }
      for (const r of rocks) {
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.rot += dt * 4;
        for (let k = 0; k < 3; k++)
          trail.add({
            x: r.x + rand(-r.s, r.s) * 0.4,
            y: r.y + rand(-r.s, r.s) * 0.4,
            vx: -r.vx * 0.1,
            vy: -r.vy * 0.1,
            life: rand(0.3, 0.6),
            size: r.s * rand(0.8, 1.4),
            grow: 0.2,
            fire: rgb[0] > 200 && rgb[1] < 200,
            rgb,
            alpha: 0.6,
            core: 0.2,
          });
        if (r.y >= r.ty) {
          r.dead = true;
          for (let k = 0; k < 40; k++) {
            const a = rand(Math.PI, TAU);
            const v = rand(200, 700) * e.unit;
            trail.add({
              x: r.x,
              y: r.y,
              vx: Math.cos(a) * v,
              vy: Math.sin(a) * v,
              g: 900 * e.unit,
              drag: 1,
              life: rand(0.4, 0.9),
              size: rand(3, 8) * e.unit,
              rgb,
              core: 0.4,
            });
          }
          e.shake(10);
          e.flash(rgb, 0.12, 4);
          e.audio.play('boom', 0.5);
        }
      }
      rocks = rocks.filter((r) => !r.dead);
    },
    draw(ctx, e) {
      trail.draw(ctx);
      for (const r of rocks) {
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, rgb, r.x, r.y, r.s * 3, 0.6);
        ctx.globalCompositeOperation = 'source-over';
        drawMesh(ctx, r.mesh, {
          x: r.x,
          y: r.y,
          size: r.s,
          rot: rotMatrix(r.rot, r.rot * 0.7, 0),
          rgb: [90, 70, 60],
          edge: rgb,
          emissive: 0.4,
        });
      }
    },
  };
}

// ---------- Lava orb: a molten ball that drips glowing lava ----------
export function lavaEffect() {
  const COLORS = [
    { name: 'Lave', rgb: [255, 90, 20] },
    { name: 'Magma bleu', rgb: [60, 140, 255] },
    { name: 'Acide', rgb: [140, 255, 40] },
  ];
  let rgb = COLORS[0].rgb;
  const drips = new Particles(300);
  const smoke = new Particles(80);
  let g = 0;
  return {
    id: 'lava',
    name: 'Orbe de lave',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      drips.clear();
      smoke.clear();
      g = 0;
    },
    update(dt, hands, e) {
      drips.update(dt, (p) => {
        if (p.y > e.H * 0.97 && !p.splash) {
          p.splash = true;
          p.vy = -Math.abs(p.vy) * 0.2;
          p.vx *= 0.3;
        }
      });
      smoke.update(dt);
      const h = mainHand(hands);
      this.h = h;
      g = clamp(g + (h && (h.open || h.gesture === 'relaxed') ? dt * 1.5 : -dt * 2));
      if (h && g > 0.1) {
        const R = h.size * 0.55 * g;
        this.c = { x: h.palm.x, y: h.palm.y - h.size * 0.8, R };
        if (Math.random() < 0.25)
          drips.add({
            x: this.c.x + rand(-R, R) * 0.7,
            y: this.c.y + R * 0.8,
            vx: h.vel.x * 0.2,
            vy: 60,
            g: 1300 * e.unit,
            life: 2,
            size: rand(4, 9) * e.unit,
            rgb,
            core: 0.35,
            alpha: 0.9,
          });
        if (Math.random() < 0.2)
          smoke.add({
            x: this.c.x + rand(-R, R),
            y: this.c.y - R,
            vx: rand(-20, 20),
            vy: -rand(40, 90),
            life: rand(1, 2),
            size: R * rand(0.4, 0.8),
            rot: rand(TAU),
          });
        e.light(this.c.x, this.c.y, R * 7, rgb, 0.22 * g);
        e.audio.loop('fire', 0.4 * g);
      } else e.audio.loop('fire', 0);
    },
    draw(ctx, e) {
      for (const p of smoke.list) {
        const t = p.age / p.life;
        ctx.fillStyle = `rgba(40,30,28,${0.25 * (1 - t)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + t), 0, TAU);
        ctx.fill();
      }
      drips.draw(ctx);
      if (!this.h || g < 0.1 || !this.c) return;
      const { x, y, R } = this.c;
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, rgb, x, y, R * 2.6, 0.5, 0.05);
      ctx.globalCompositeOperation = 'source-over';
      const grad = ctx.createRadialGradient(x - R * 0.3, y - R * 0.3, R * 0.1, x, y, R);
      grad.addColorStop(0, `rgb(${Math.min(255, rgb[0] + 60)},${Math.min(255, rgb[1] + 120)},${Math.min(255, rgb[2] + 60)})`);
      grad.addColorStop(0.5, `rgb(${rgb.join(',')})`);
      grad.addColorStop(1, `rgb(${rgb.map((v) => (v * 0.35) | 0).join(',')})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, TAU);
      ctx.fill();
      // Cooling crust: dark plates drifting over the molten core.
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, R, 0, TAU);
      ctx.clip();
      ctx.fillStyle = 'rgba(35,12,6,0.6)';
      for (let k = 0; k < 9; k++) {
        const a = k * 2.4 + e.t * 0.25;
        const d = R * (0.35 + 0.5 * ((k * 0.37) % 1));
        const px = x + Math.cos(a) * d;
        const py = y + Math.sin(a) * d * 0.9;
        const pr = R * (0.18 + 0.1 * ((k * 0.61) % 1));
        ctx.beginPath();
        for (let v = 0; v < 7; v++) {
          const b = (v / 7) * TAU;
          const rr = pr * (0.7 + 0.3 * noise1(k * 7 + v * 1.7 + e.t * 0.2));
          if (v) ctx.lineTo(px + Math.cos(b) * rr, py + Math.sin(b) * rr);
          else ctx.moveTo(px + Math.cos(b) * rr, py + Math.sin(b) * rr);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    },
  };
}

// ---------- Mini sun: a blazing star with flares and a lens flare ----------
export function sunEffect() {
  const COLORS = [
    { name: 'Soleil', rgb: [255, 200, 80] },
    { name: 'Étoile bleue', rgb: [120, 180, 255] },
    { name: 'Géante rouge', rgb: [255, 90, 50] },
  ];
  let rgb = COLORS[0].rgb;
  let g = 0;
  return {
    id: 'sun',
    name: 'Mini soleil',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      g = 0;
    },
    update(dt, hands, e) {
      const h = mainHand(hands);
      this.h = h;
      g = clamp(g + (h && (h.open || h.gesture === 'relaxed') ? dt * 1.2 : -dt * 2));
      if (h) {
        this.c = { x: h.palm.x, y: h.palm.y - h.size * 1.0, R: h.size * 0.5 * g };
        e.light(this.c.x, this.c.y, Math.max(e.W, e.H) * 0.6, rgb, 0.18 * g);
      }
      e.audio.loop('fire', 0.3 * g);
    },
    draw(ctx, e) {
      if (!this.c || g < 0.02) return;
      const { x, y, R } = this.c;
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, rgb, x, y, R * 5, 0.4, 0.05);
      // Rotating rays.
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * TAU + e.t * 0.3;
        const L = R * (2.2 + 0.6 * noise1(e.t * 2 + k));
        const grad = ctx.createLinearGradient(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L);
        grad.addColorStop(0, `rgba(${rgb.join(',')},0.5)`);
        grad.addColorStop(1, `rgba(${rgb.join(',')},0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = R * 0.18;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L);
        ctx.stroke();
      }
      // Solar flares: arcs looping off the surface.
      ctx.lineWidth = 3 * e.unit;
      for (let k = 0; k < 5; k++) {
        const a = k * 1.3 + e.t * 0.5;
        const h2 = R * (0.5 + 0.4 * Math.abs(noise1(e.t + k * 4)));
        ctx.strokeStyle = `rgba(255,${(rgb[1] * 0.8) | 0},60,0.6)`;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * R, y + Math.sin(a) * R);
        ctx.quadraticCurveTo(
          x + Math.cos(a + 0.25) * (R + h2 * 2),
          y + Math.sin(a + 0.25) * (R + h2 * 2),
          x + Math.cos(a + 0.5) * R,
          y + Math.sin(a + 0.5) * R,
        );
        ctx.stroke();
      }
      drawGlow(ctx, rgb, x, y, R * 1.5, 0.9, 0.4);
      drawGlow(ctx, [255, 255, 240], x, y, R, 1, 0.6);
      // Lens flare ghosts along the line through the centre of the image.
      const cx = e.W / 2;
      const cy = e.H / 2;
      [0.5, 0.9, 1.3, 1.7].forEach((f, i) => {
        const gx = x + (cx - x) * f * 2;
        const gy = y + (cy - y) * f * 2;
        drawGlow(ctx, i % 2 ? [120, 200, 255] : rgb, gx, gy, R * (0.3 + i * 0.25), 0.12 * g, 0.6);
      });
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

// ---------- Sonic clap: clap your hands for a shockwave ----------
export function sonicEffect() {
  const COLORS = [
    { name: 'Onde blanche', rgb: [220, 235, 255] },
    { name: 'Onde dorée', rgb: [255, 200, 90] },
    { name: 'Onde violette', rgb: [190, 120, 255] },
  ];
  let rgb = COLORS[0].rgb;
  const dust = new Particles(500);
  let waves = [];
  let lastD = Infinity;
  let cool = 0;
  const blast = (e, x, y, big) => {
    waves.push({ x, y, t: 0, big });
    for (let k = 0; k < (big ? 120 : 50); k++) {
      const a = rand(TAU);
      const v = rand(400, 1400) * e.unit * (big ? 1 : 0.6);
      dust.add({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        drag: 2.5,
        life: rand(0.3, 0.8),
        size: rand(2, 5) * e.unit,
        rgb,
        core: 0.5,
      });
    }
    e.shake(big ? 26 : 10);
    e.flash(rgb, big ? 0.3 : 0.1, 4);
    e.punch(big ? 0.06 : 0.02);
    e.audio.play('boom', big ? 1 : 0.5);
  };
  return {
    id: 'sonic',
    name: 'Clap sonique',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      dust.clear();
      waves = [];
    },
    update(dt, hands, e) {
      dust.update(dt);
      waves = waves.filter((w) => (w.t += dt) < 1);
      cool -= dt;
      const live = hands.filter((h) => h.presence > 0.5 && h.visible);
      if (live.length >= 2) {
        const [a, b] = live;
        const d = dist(a.palm, b.palm);
        const closing = (lastD - d) / dt;
        if (cool <= 0 && d < (a.size + b.size) * 1.1 && closing > Math.min(e.W, e.H) * 1.2) {
          blast(e, (a.palm.x + b.palm.x) / 2, (a.palm.y + b.palm.y) / 2, true);
          cool = 0.5;
        }
        lastD = d;
      } else lastD = Infinity;
      // A fast punch with one hand makes a smaller wave.
      for (const h of live)
        if (cool <= 0 && h.fist && h.speed > Math.min(e.W, e.H) * 2.5) {
          blast(e, h.palm.x, h.palm.y, false);
          cool = 0.4;
        }
    },
    trigger(e) {
      blast(e, e.W / 2, e.H / 2, true);
    },
    draw(ctx, e) {
      ctx.globalCompositeOperation = 'lighter';
      for (const w of waves) {
        for (let k = 0; k < 3; k++) {
          const t = clamp(w.t - k * 0.08);
          if (t <= 0) continue;
          const R = t * Math.max(e.W, e.H) * (w.big ? 0.8 : 0.4);
          ctx.strokeStyle = `rgba(${rgb.join(',')},${(1 - t) * (0.7 - k * 0.2)})`;
          ctx.lineWidth = (20 - k * 6) * (1 - t) * e.unit + 1;
          ctx.beginPath();
          ctx.ellipse(w.x, w.y, R, R * 0.85, 0, 0, TAU);
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      dust.draw(ctx);
    },
  };
}
