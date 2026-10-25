// Cosmic powers: planet, crystal ball, aurora, shooting stars, comet
// fingertips, rainbow.
import { Particles, drawGlow, rand, TAU, noise1, clamp, dist, makeCanvas } from './util.js';

const mainHand = (hands) => hands.filter((h) => h.presence > 0.4).sort((a, b) => b.size - a.size)[0];

// ---------- Planet: a rotating world with rings and a moon on the palm ----------
function planetTexture(kind) {
  const c = makeCanvas(512, 256);
  const g = c.getContext('2d');
  const pal = {
    earth: ['#1d4f9c', '#2f8a3a', '#e8e2c9'],
    mars: ['#a6452a', '#d77a3d', '#f2c9a0'],
    ice: ['#5aa7d8', '#d9f2ff', '#ffffff'],
  }[kind];
  g.fillStyle = pal[0];
  g.fillRect(0, 0, 512, 256);
  // Continents: blobs wrapped horizontally so the texture tiles.
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * 512;
    const y = 30 + Math.random() * 196;
    const r = 12 + Math.random() * 40;
    g.fillStyle = pal[1];
    for (const dx of [-512, 0, 512]) {
      g.beginPath();
      for (let k = 0; k <= 12; k++) {
        const a = (k / 12) * TAU;
        const rr = r * (0.6 + Math.random() * 0.5);
        if (k) g.lineTo(x + dx + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7);
        else g.moveTo(x + dx + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7);
      }
      g.fill();
    }
  }
  g.fillStyle = pal[2];
  g.fillRect(0, 0, 512, 16);
  g.fillRect(0, 240, 512, 16);
  // Clouds.
  g.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 512, Math.random() * 256, 20 + Math.random() * 60, 3 + Math.random() * 4);
  return c;
}

export function planetEffect() {
  const KINDS = [
    { name: 'Terre', kind: 'earth', glow: [120, 190, 255] },
    { name: 'Mars', kind: 'mars', glow: [255, 140, 90] },
    { name: 'Planète de glace', kind: 'ice', glow: [190, 230, 255] },
  ];
  let scheme = KINDS[0];
  let tex = null;
  let g = 0;
  return {
    id: 'planet',
    name: 'Planète',
    colors: KINDS,
    needs: { seg: false },
    setColor(i) {
      scheme = KINDS[i];
      tex = null;
    },
    start() {
      g = 0;
    },
    update(dt, hands, e) {
      const h = mainHand(hands);
      g = clamp(g + (h && (h.open || h.gesture === 'relaxed') ? dt * 1.3 : -dt * 2));
      if (h) this.c = { x: h.palm.x, y: h.palm.y - h.size * 1.05, R: h.size * 0.62 * g, tilt: Math.atan2(h.up.y, h.up.x) + Math.PI / 2 };
      if (this.c && g > 0.1) e.light(this.c.x, this.c.y, this.c.R * 5, scheme.glow, 0.12 * g);
    },
    draw(ctx, e) {
      if (!this.c || g < 0.02) return;
      if (!tex) tex = planetTexture(scheme.kind);
      const { x, y, R } = this.c;
      const tilt = -0.35 + (this.c.tilt || 0) * 0.2;
      const ring = (front) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(tilt);
        ctx.lineWidth = R * 0.12;
        for (let k = 0; k < 3; k++) {
          ctx.strokeStyle = `rgba(230,210,170,${0.5 - k * 0.12})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, R * (1.6 + k * 0.18), R * (0.32 + k * 0.04), 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
          ctx.stroke();
        }
        ctx.restore();
      };
      ring(false);
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, scheme.glow, x, y, R * 1.6, 0.4, 0.5);
      ctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, R, 0, TAU);
      ctx.clip();
      // Rotation: the texture slides sideways.
      const off = ((e.t * 40) % 512) / 512;
      const w = R * 4;
      ctx.drawImage(tex, x - R - off * w, y - R, w, R * 2);
      ctx.drawImage(tex, x - R - off * w + w, y - R, w, R * 2);
      const shade = ctx.createRadialGradient(x - R * 0.4, y - R * 0.4, R * 0.1, x, y, R);
      shade.addColorStop(0, 'rgba(255,255,255,0.15)');
      shade.addColorStop(0.6, 'rgba(0,0,0,0)');
      shade.addColorStop(1, 'rgba(0,0,10,0.75)');
      ctx.fillStyle = shade;
      ctx.fillRect(x - R, y - R, R * 2, R * 2);
      ctx.restore();
      ring(true);
      // Moon.
      const ma = e.t * 1.2;
      const mz = Math.sin(ma);
      const mx = x + Math.cos(ma) * R * 2.2;
      const my = y + Math.sin(ma) * R * 0.5;
      if (mz > -2) {
        ctx.fillStyle = '#cfcfd6';
        ctx.beginPath();
        ctx.arc(mx, my, R * 0.16 * (1 + mz * 0.15), 0, TAU);
        ctx.fill();
      }
    },
  };
}

// ---------- Crystal ball: a glass orb with swirling visions ----------
export function crystalBallEffect() {
  const COLORS = [
    { name: 'Voyance', rgb: [170, 110, 255] },
    { name: 'Turquoise', rgb: [60, 230, 220] },
    { name: 'Rose', rgb: [255, 110, 190] },
  ];
  let rgb = COLORS[0].rgb;
  const sparks = new Particles(150);
  let g = 0;
  return {
    id: 'crystalball',
    name: 'Boule de cristal',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      g = 0;
      sparks.clear();
    },
    update(dt, hands, e) {
      sparks.update(dt);
      const h = mainHand(hands);
      g = clamp(g + (h && (h.open || h.gesture === 'relaxed') ? dt * 1.3 : -dt * 2));
      if (h) this.c = { x: h.palm.x, y: h.palm.y - h.size * 0.95, R: h.size * 0.65 * g };
      if (this.c && g > 0.2) {
        if (Math.random() < 0.4) {
          const a = rand(TAU);
          sparks.add({
            x: this.c.x + Math.cos(a) * this.c.R * 1.1,
            y: this.c.y + Math.sin(a) * this.c.R * 1.1,
            vx: rand(-20, 20),
            vy: -rand(20, 60),
            life: rand(0.6, 1.2),
            size: rand(1.5, 3.5) * e.unit,
            rgb,
            core: 0.6,
          });
        }
        e.light(this.c.x, this.c.y, this.c.R * 5, rgb, 0.15 * g);
      }
    },
    draw(ctx, e) {
      sparks.draw(ctx);
      if (!this.c || g < 0.02) return;
      const { x, y, R } = this.c;
      // Inner swirling mist.
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, R, 0, TAU);
      ctx.clip();
      ctx.fillStyle = 'rgba(15,5,30,0.55)';
      ctx.fillRect(x - R, y - R, R * 2, R * 2);
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 7; k++) {
        const a = e.t * (0.8 + k * 0.15) + k;
        ctx.strokeStyle = `rgba(${rgb.join(',')},0.35)`;
        ctx.lineWidth = R * 0.1;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * R * 0.25, y + Math.sin(a * 1.3) * R * 0.2, R * (0.3 + k * 0.08), a, a + 2.2);
        ctx.stroke();
      }
      drawGlow(ctx, rgb, x, y, R * 0.6, 0.6, 0.2);
      ctx.restore();
      // Glass: rim, reflection, highlight.
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(220,230,255,0.55)';
      ctx.lineWidth = 2 * e.unit;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.ellipse(x - R * 0.38, y - R * 0.42, R * 0.22, R * 0.11, -0.7, 0, TAU);
      ctx.fill();
      drawGlow(ctx, rgb, x, y, R * 1.8, 0.25, 0.05);
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

// ---------- Aurora: northern lights across the sky, steered by your hands ----------
export function auroraEffect() {
  const SETS = [
    {
      name: 'Boréale',
      cols: [
        [80, 255, 160],
        [90, 180, 255],
        [190, 100, 255],
      ],
    },
    {
      name: 'Australe',
      cols: [
        [255, 90, 160],
        [255, 180, 90],
        [140, 120, 255],
      ],
    },
    {
      name: 'Glacier',
      cols: [
        [150, 230, 255],
        [255, 255, 255],
        [100, 160, 255],
      ],
    },
  ];
  let set = SETS[0];
  let shift = 0;
  let bright = 0.6;
  return {
    id: 'aurora',
    name: 'Aurore boréale',
    colors: SETS,
    needs: { seg: false },
    setColor(i) {
      set = SETS[i];
    },
    update(dt, hands, e) {
      const h = mainHand(hands);
      const want = h ? (h.palm.x / e.W - 0.5) * 0.6 : 0;
      shift += (want - shift) * Math.min(1, dt * 2);
      const raised = h && h.palm.y < e.H * 0.5;
      bright += ((raised ? 1 : 0.6) - bright) * Math.min(1, dt * 2);
    },
    draw(ctx, e) {
      ctx.globalCompositeOperation = 'lighter';
      const bands = 3;
      for (let b = 0; b < bands; b++) {
        const col = set.cols[b % set.cols.length];
        const baseY = e.H * (0.12 + b * 0.08);
        const steps = 60;
        for (let i = 0; i < steps; i++) {
          const u = i / steps;
          const x = e.W * (u * 1.2 - 0.1 + shift * (0.5 + b * 0.2));
          const y = baseY + noise1(u * 4 + e.t * 0.4 + b * 10) * e.H * 0.08;
          const h = e.H * (0.18 + 0.12 * Math.abs(noise1(u * 6 + e.t * 0.6 + b)));
          const a = (0.07 + 0.06 * Math.abs(noise1(u * 9 + e.t + b * 3))) * bright;
          const grad = ctx.createLinearGradient(0, y, 0, y + h);
          grad.addColorStop(0, `rgba(${col.join(',')},0)`);
          grad.addColorStop(0.25, `rgba(${col.join(',')},${a})`);
          grad.addColorStop(1, `rgba(${col.join(',')},0)`);
          ctx.fillStyle = grad;
          ctx.fillRect(x, y, (e.W * 1.2) / steps + 2, h);
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

// ---------- Shooting stars: point at the sky to launch one ----------
export function starsEffect() {
  const COLORS = [
    { name: 'Étoiles', rgb: [255, 240, 200] },
    { name: 'Étoiles bleues', rgb: [150, 200, 255] },
    { name: 'Étoiles roses', rgb: [255, 160, 220] },
  ];
  let rgb = COLORS[0].rgb;
  const dust = new Particles(500);
  let stars = [];
  let timer = 0;
  const cool = new Map();
  const launch = (e, x, y, dx, dy, big) => {
    const v = rand(900, 1500) * e.unit;
    stars.push({ x, y, vx: dx * v, vy: dy * v, life: big ? 1.6 : 1.1, big, trail: [] });
  };
  return {
    id: 'stars',
    name: 'Étoiles filantes',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      stars = [];
      dust.clear();
    },
    update(dt, hands, e) {
      dust.update(dt);
      timer -= dt;
      if (timer <= 0) {
        timer = rand(0.8, 2);
        launch(e, rand(0.2, 1.1) * e.W, rand(-0.05, 0.25) * e.H, -0.85, 0.5, false);
      }
      for (const h of hands) {
        if (h.presence < 0.5) continue;
        const c = (cool.get(h.id) || 0) - dt;
        cool.set(h.id, c);
        if ((h.point || (h.fingers.index && !h.fingers.middle)) && c <= 0) {
          const tip = h.lm[8];
          const dx = tip.x - h.lm[6].x;
          const dy = tip.y - h.lm[6].y;
          const l = Math.hypot(dx, dy) || 1;
          launch(e, tip.x, tip.y, dx / l, dy / l, true);
          cool.set(h.id, 0.5);
          e.audio.play('chime', 0.4);
        }
      }
      for (const s of stars) {
        s.life -= dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.trail.unshift({ x: s.x, y: s.y });
        if (s.trail.length > 26) s.trail.pop();
        if (Math.random() < 0.6)
          dust.add({
            x: s.x,
            y: s.y,
            vx: rand(-30, 30),
            vy: rand(-30, 30),
            life: rand(0.4, 0.9),
            size: rand(1.5, 3) * e.unit,
            rgb,
            core: 0.6,
          });
      }
      stars = stars.filter((s) => s.life > 0);
    },
    draw(ctx, e) {
      dust.draw(ctx);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const s of stars) {
        const a = clamp(s.life * 2);
        for (let i = 1; i < s.trail.length; i++) {
          const t = i / s.trail.length;
          ctx.strokeStyle = `rgba(${rgb.join(',')},${(1 - t) * 0.8 * a})`;
          ctx.lineWidth = (s.big ? 6 : 3.5) * (1 - t) * e.unit + 0.5;
          ctx.beginPath();
          ctx.moveTo(s.trail[i - 1].x, s.trail[i - 1].y);
          ctx.lineTo(s.trail[i].x, s.trail[i].y);
          ctx.stroke();
        }
        drawGlow(ctx, [255, 255, 255], s.x, s.y, (s.big ? 22 : 14) * e.unit, a);
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

// ---------- Comet fingers: every fingertip leaves a glowing comet tail ----------
export function cometEffect() {
  const SETS = [
    {
      name: 'Arc-en-ciel',
      cols: [
        [255, 80, 80],
        [255, 200, 60],
        [90, 255, 140],
        [80, 180, 255],
        [200, 110, 255],
      ],
    },
    { name: 'Or', cols: [[255, 210, 110]] },
    { name: 'Glace', cols: [[150, 220, 255]] },
  ];
  let set = SETS[0];
  const trails = new Map();
  const dust = new Particles(500);
  return {
    id: 'comet',
    name: 'Doigts comètes',
    colors: SETS,
    needs: { seg: false },
    setColor(i) {
      set = SETS[i];
    },
    start() {
      trails.clear();
      dust.clear();
    },
    update(dt, hands, e) {
      dust.update(dt);
      for (const h of hands) {
        if (h.presence < 0.3) continue;
        h.tips.forEach((tip, i) => {
          const key = `${h.id}-${i}`;
          const tr = trails.get(key) || [];
          trails.set(key, tr);
          tr.unshift({ x: tip.x, y: tip.y });
          if (tr.length > 22) tr.pop();
          if (Math.random() < 0.25)
            dust.add({
              x: tip.x,
              y: tip.y,
              vx: rand(-40, 40),
              vy: rand(-40, 40),
              life: rand(0.4, 0.8),
              size: rand(1.5, 3) * e.unit,
              rgb: set.cols[i % set.cols.length],
              core: 0.6,
            });
        });
      }
      for (const [k, tr] of trails)
        if (!hands.some((h) => k.startsWith(`${h.id}-`))) {
          tr.pop();
          if (!tr.length) trails.delete(k);
        }
    },
    draw(ctx, e) {
      dust.draw(ctx);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const [k, tr] of trails) {
        const i = Number(k.split('-')[1]);
        const col = set.cols[i % set.cols.length];
        for (let j = 1; j < tr.length; j++) {
          const t = j / tr.length;
          ctx.strokeStyle = `rgba(${col.join(',')},${0.7 * (1 - t)})`;
          ctx.lineWidth = 10 * (1 - t) * e.unit + 1;
          ctx.beginPath();
          ctx.moveTo(tr[j - 1].x, tr[j - 1].y);
          ctx.lineTo(tr[j].x, tr[j].y);
          ctx.stroke();
        }
        if (tr[0]) drawGlow(ctx, col, tr[0].x, tr[0].y, 16 * e.unit, 0.9);
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

// ---------- Rainbow: an arc between your two hands, or a ribbon from one ----------
export function rainbowEffect() {
  const BANDS = [
    [255, 60, 60],
    [255, 150, 40],
    [255, 230, 60],
    [80, 220, 90],
    [60, 160, 255],
    [90, 90, 230],
    [170, 80, 230],
  ];
  const sparks = new Particles(300);
  let trail = [];
  return {
    id: 'rainbow',
    name: 'Arc-en-ciel',
    needs: { seg: false },
    start() {
      trail = [];
      sparks.clear();
    },
    update(dt, hands, e) {
      sparks.update(dt);
      const live = hands.filter((h) => h.presence > 0.4);
      this.pair = live.length >= 2 ? [live[0].palm, live[1].palm] : null;
      if (!this.pair && live[0]) {
        trail.unshift({ x: live[0].lm[8].x, y: live[0].lm[8].y });
        if (trail.length > 40) trail.pop();
      } else if (trail.length) trail.pop();
      if (this.pair && Math.random() < 0.5) {
        const [a, b] = this.pair;
        const t = Math.random();
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        const R = dist(a, b) / 2;
        const ang = Math.PI + t * Math.PI;
        sparks.add({
          x: cx + Math.cos(ang) * R,
          y: cy + Math.sin(ang) * R,
          vx: rand(-20, 20),
          vy: rand(10, 50),
          life: rand(0.5, 1),
          size: rand(2, 4) * e.unit,
          rgb: [255, 255, 255],
          core: 0.6,
        });
      }
    },
    draw(ctx, e) {
      ctx.globalCompositeOperation = 'lighter';
      const bw = 7 * e.unit;
      if (this.pair) {
        const [a, b] = this.pair;
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        const R = dist(a, b) / 2;
        const rot = Math.atan2(b.y - a.y, b.x - a.x);
        BANDS.forEach((c, i) => {
          ctx.strokeStyle = `rgba(${c.join(',')},0.55)`;
          ctx.lineWidth = bw;
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(1, R - (i - 3) * bw), Math.PI + rot, TAU + rot);
          ctx.stroke();
        });
      }
      ctx.lineCap = 'round';
      BANDS.forEach((c, i) => {
        if (trail.length < 2) return;
        ctx.strokeStyle = `rgba(${c.join(',')},0.5)`;
        ctx.lineWidth = bw;
        ctx.beginPath();
        trail.forEach((p, j) => {
          const off = (i - 3) * bw * (1 - j / trail.length);
          if (j) ctx.lineTo(p.x, p.y + off);
          else ctx.moveTo(p.x, p.y + off);
        });
        ctx.stroke();
      });
      ctx.globalCompositeOperation = 'source-over';
      sparks.draw(ctx);
    },
  };
}
