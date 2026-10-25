// Playful powers: soap bubbles, confetti, gold coins, magic snow, fireflies,
// will-o'-the-wisps.
import { Particles, drawGlow, rand, TAU, noise1, clamp, dist, pick, palmPoint } from './util.js';

const mainHand = (hands) => hands.filter((h) => h.presence > 0.4).sort((a, b) => b.size - a.size)[0];

// ---------- Soap bubbles: blown from the palm, popped by your fingertips ----------
export function bubblesEffect() {
  let bubbles = [];
  const pops = new Particles(300);
  return {
    id: 'bubbles',
    name: 'Bulles de savon',
    needs: { seg: false },
    start() {
      bubbles = [];
      pops.clear();
    },
    update(dt, hands, e) {
      pops.update(dt);
      const h = mainHand(hands);
      if (h && (h.open || h.gesture === 'relaxed') && Math.random() < dt * 4 && bubbles.length < 40)
        bubbles.push({
          x: h.palm.x + rand(-h.size, h.size) * 0.4,
          y: h.palm.y - h.size * 2.4,
          r: h.size * rand(0.2, 0.55),
          vx: rand(-40, 40) + h.vel.x * 0.2,
          vy: -rand(50, 120) * e.unit,
          ph: rand(TAU),
          age: 0,
        });
      if (Math.random() < dt * 0.8 && bubbles.length < 40)
        bubbles.push({
          x: rand(e.W),
          y: e.H + 30,
          r: rand(14, 40) * e.unit,
          vx: rand(-20, 20),
          vy: -rand(40, 90) * e.unit,
          ph: rand(TAU),
          age: 0,
        });
      for (const b of bubbles) {
        b.age += dt;
        b.x += (b.vx + noise1(b.ph + e.t) * 30) * dt;
        b.y += b.vy * dt;
        for (const hh of hands)
          for (const tip of hh.tips)
            if (!b.dead && b.age > 0.7 && hh.presence > 0.5 && Math.hypot(tip.x - b.x, tip.y - b.y) < b.r) {
              b.dead = true;
              for (let k = 0; k < 18; k++) {
                const a = (k / 18) * TAU;
                pops.add({
                  x: b.x + Math.cos(a) * b.r,
                  y: b.y + Math.sin(a) * b.r,
                  vx: Math.cos(a) * 160,
                  vy: Math.sin(a) * 160,
                  drag: 4,
                  life: 0.3,
                  size: 2.5 * e.unit,
                  rgb: [200, 230, 255],
                  core: 0.6,
                });
              }
              e.audio.play('drop', 0.5);
            }
        if (b.y < -b.r * 2 || b.age > 12) b.dead = true;
      }
      bubbles = bubbles.filter((b) => !b.dead);
    },
    draw(ctx, e) {
      for (const b of bubbles) {
        // Thin film: soft iridescent rim and a highlight.
        const hue = (b.ph * 60 + e.t * 40) % 360;
        const grad = ctx.createRadialGradient(b.x, b.y, b.r * 0.7, b.x, b.y, b.r);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.8, `hsla(${hue},90%,70%,0.25)`);
        grad.addColorStop(1, `hsla(${(hue + 120) % 360},95%,80%,0.85)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.ellipse(b.x - b.r * 0.35, b.y - b.r * 0.4, b.r * 0.2, b.r * 0.1, -0.7, 0, TAU);
        ctx.fill();
      }
      pops.draw(ctx);
    },
  };
}

// ---------- Confetti: fist then open hand for a burst; gentle confetti rain ----------
export function confettiEffect() {
  const SETS = [
    { name: 'Fête', cols: ['#ff4d6d', '#ffd23f', '#3ec1ff', '#7bff8a', '#c77dff', '#ff8c42'] },
    { name: 'Or et blanc', cols: ['#ffd27a', '#ffffff', '#f0b54d'] },
    { name: 'Pastel', cols: ['#ffc8dd', '#bde0fe', '#cdb4db', '#caffbf'] },
  ];
  let set = SETS[0];
  let bits = [];
  const add = (x, y, vx, vy) =>
    bits.length < 500 &&
    bits.push({
      x,
      y,
      vx,
      vy,
      c: pick(set.cols),
      rot: rand(TAU),
      spin: rand(-8, 8),
      flip: rand(TAU),
      w: rand(6, 11),
      h: rand(3, 6),
      age: 0,
    });
  return {
    id: 'confetti',
    name: 'Confettis',
    colors: SETS,
    needs: { seg: false },
    setColor(i) {
      set = SETS[i];
    },
    start() {
      bits = [];
    },
    update(dt, hands, e) {
      if (Math.random() < dt * 12) add(rand(e.W), -10, rand(-30, 30), rand(40, 100) * e.unit);
      for (const h of hands) {
        if (h.events.release || (h.open && h.speed > Math.min(e.W, e.H) * 2.2)) {
          for (let k = 0; k < 90; k++) {
            const a = h.angle + rand(-0.9, 0.9);
            const v = rand(400, 1100) * e.unit;
            add(h.palm.x, h.palm.y, Math.cos(a) * v, Math.sin(a) * v);
          }
          e.audio.play('chime', 0.5);
          e.audio.play('whoosh', 0.4);
        }
      }
      for (const b of bits) {
        b.age += dt;
        b.vx *= Math.exp(-dt * 1.8);
        b.vy = b.vy * Math.exp(-dt * 1.8) + 500 * e.unit * dt;
        b.vy = Math.min(b.vy, 160 * e.unit);
        b.x += (b.vx + Math.sin(b.flip) * 30) * dt;
        b.y += b.vy * dt;
        b.rot += b.spin * dt;
        b.flip += dt * 6;
      }
      bits = bits.filter((b) => b.y < e.H + 20 && b.age < 10);
    },
    draw(ctx, e) {
      for (const b of bits) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.scale(Math.cos(b.flip), 1);
        ctx.fillStyle = b.c;
        ctx.fillRect((-b.w / 2) * e.unit, (-b.h / 2) * e.unit, b.w * e.unit, b.h * e.unit);
        ctx.restore();
      }
    },
  };
}

// ---------- Gold coins: pinch to make coins rain and pile up ----------
export function coinsEffect() {
  const COLORS = [
    { name: 'Or', c: [255, 200, 60] },
    { name: 'Argent', c: [220, 225, 235] },
    { name: 'Gemmes', c: [80, 220, 255] },
  ];
  let scheme = COLORS[0];
  let coins = [];
  const shine = new Particles(150);
  return {
    id: 'coins',
    name: 'Pluie de pièces',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      scheme = COLORS[i];
    },
    start() {
      coins = [];
      shine.clear();
    },
    update(dt, hands, e) {
      shine.update(dt);
      for (const h of hands) {
        if (h.presence < 0.5) continue;
        if ((h.pinch || h.pinchAmount > 0.75) && Math.random() < dt * 14 && coins.length < 160) {
          coins.push({
            x: h.pinchPoint.x,
            y: h.pinchPoint.y,
            vx: rand(-120, 120),
            vy: -rand(100, 300) * e.unit,
            spin: rand(4, 10),
            ph: rand(TAU),
            r: rand(10, 15) * e.unit,
            rest: false,
          });
          if (Math.random() < 0.3) e.audio.play('chime', 0.25);
        }
      }
      const floor = e.H * 0.96;
      for (const c of coins) {
        if (c.rest) continue;
        c.vy += 1500 * e.unit * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.ph += c.spin * dt;
        if (c.y > floor - c.r * 0.4) {
          c.y = floor - c.r * 0.4;
          if (Math.abs(c.vy) < 120) {
            c.rest = true;
            c.ph = Math.PI / 2;
          }
          c.vy *= -0.35;
          c.vx *= 0.6;
          e.audio.play('tick', 0.2);
        }
        if (Math.random() < 0.05) shine.add({ x: c.x, y: c.y, life: 0.4, size: c.r * 0.6, rgb: [255, 255, 255], core: 0.7 });
      }
      if (coins.length > 150) coins.splice(0, coins.length - 150);
    },
    draw(ctx) {
      const [r, g, b] = scheme.c;
      for (const c of coins) {
        const sx = Math.abs(Math.cos(c.ph));
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.scale(Math.max(0.12, sx), c.rest ? 0.35 : 1);
        const grad = ctx.createLinearGradient(-c.r, -c.r, c.r, c.r);
        grad.addColorStop(0, `rgb(${Math.min(255, r + 60)},${Math.min(255, g + 60)},${Math.min(255, b + 60)})`);
        grad.addColorStop(1, `rgb(${(r * 0.6) | 0},${(g * 0.55) | 0},${(b * 0.5) | 0})`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, c.r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = `rgba(${(r * 0.5) | 0},${(g * 0.45) | 0},${(b * 0.4) | 0},0.9)`;
        ctx.lineWidth = c.r * 0.15;
        ctx.beginPath();
        ctx.arc(0, 0, c.r * 0.72, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
      shine.draw(ctx);
    },
  };
}

// ---------- Magic snow: snowflakes swirl in the wind of your hands ----------
export function snowEffect() {
  let flakes = [];
  const flake = (ctx, x, y, s, rot) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      ctx.rotate(Math.PI / 3);
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -s);
      ctx.moveTo(0, -s * 0.55);
      ctx.lineTo(s * 0.25, -s * 0.75);
      ctx.moveTo(0, -s * 0.55);
      ctx.lineTo(-s * 0.25, -s * 0.75);
    }
    ctx.stroke();
    ctx.restore();
  };
  return {
    id: 'snow',
    name: 'Neige magique',
    needs: { seg: false },
    start() {
      flakes = [];
    },
    update(dt, hands, e) {
      while (flakes.length < 140)
        flakes.push({
          x: rand(e.W),
          y: rand(-e.H, 0),
          vx: 0,
          vy: rand(30, 80) * e.unit,
          s: rand(4, 11) * e.unit,
          rot: rand(TAU),
          spin: rand(-1, 1),
          stick: 0,
        });
      for (const f of flakes) {
        for (const h of hands) {
          if (h.presence < 0.4) continue;
          const d = Math.hypot(f.x - h.palm.x, f.y - h.palm.y);
          if (d < h.size * 3) {
            const k = 1 - d / (h.size * 3);
            f.vx += (h.vel.x * 1.5 - f.vx) * k * dt * 3;
            f.vy += (h.vel.y * 1.5 - f.vy) * k * dt * 3;
          }
        }
        f.vx *= Math.exp(-dt * 0.8);
        f.vy += (60 * e.unit - f.vy) * dt * 0.6;
        f.x += (f.vx + noise1(f.y * 0.01 + f.rot) * 25) * dt;
        f.y += f.vy * dt;
        f.rot += f.spin * dt;
        if (f.y > e.H + 10 || f.x < -40 || f.x > e.W + 40) {
          f.x = rand(e.W);
          f.y = -10;
          f.vx = 0;
        }
      }
    },
    draw(ctx, e) {
      ctx.strokeStyle = 'rgba(240,248,255,0.9)';
      ctx.lineWidth = 1.4 * e.unit;
      ctx.lineCap = 'round';
      for (const f of flakes) flake(ctx, f.x, f.y, f.s, f.rot);
      ctx.globalCompositeOperation = 'lighter';
      for (const f of flakes) if (f.s > 8 * e.unit) drawGlow(ctx, [200, 230, 255], f.x, f.y, f.s * 1.6, 0.25);
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

// ---------- Fireflies: glowing fireflies gather around your open hands ----------
export function firefliesEffect() {
  const COLORS = [
    { name: 'Lucioles', rgb: [210, 255, 90] },
    { name: 'Fées', rgb: [255, 170, 230] },
    { name: 'Bleues', rgb: [110, 200, 255] },
  ];
  let rgb = COLORS[0].rgb;
  let flies = [];
  return {
    id: 'fireflies',
    name: 'Lucioles',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      flies = [];
    },
    update(dt, hands, e) {
      if (!flies.length)
        flies = Array.from({ length: 40 }, () => ({ x: rand(e.W), y: rand(e.H), vx: 0, vy: 0, ph: rand(TAU), seed: rand(100) }));
      const open = hands.filter((h) => h.presence > 0.4 && (h.open || h.gesture === 'relaxed'));
      for (const f of flies) {
        let tx = e.W * (0.5 + 0.45 * noise1(e.t * 0.15 + f.seed));
        let ty = e.H * (0.5 + 0.45 * noise1(e.t * 0.15 + f.seed + 40));
        if (open.length) {
          const h = open[(f.seed | 0) % open.length];
          const a = e.t * 1.2 + f.seed;
          tx = h.palm.x + Math.cos(a) * h.size * (1.2 + (f.seed % 1.5));
          ty = h.palm.y - h.size * 0.6 + Math.sin(a * 1.3) * h.size * 1.2;
        }
        f.vx += ((tx - f.x) * 2 - f.vx * 1.5) * dt + noise1(e.t * 3 + f.seed) * 80 * dt;
        f.vy += ((ty - f.y) * 2 - f.vy * 1.5) * dt + noise1(e.t * 3 + f.seed + 9) * 80 * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
      }
      for (const h of open) e.light(h.palm.x, h.palm.y, h.size * 4, rgb, 0.1);
    },
    draw(ctx, e) {
      ctx.globalCompositeOperation = 'lighter';
      for (const f of flies) {
        const blink = 0.3 + 0.7 * Math.max(0, Math.sin(e.t * 2.5 + f.ph));
        drawGlow(ctx, rgb, f.x, f.y, 18 * e.unit * (0.6 + blink * 0.6), 0.75 * blink, 0.3);
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

// ---------- Will-o'-the-wisps: ghostly flames orbiting your hand in 3D ----------
export function wispsEffect() {
  const COLORS = [
    { name: 'Feux follets', rgb: [90, 200, 255] },
    { name: 'Flammes spectrales', rgb: [150, 255, 200] },
    { name: 'Âmes violettes', rgb: [200, 120, 255] },
  ];
  let rgb = COLORS[0].rgb;
  const flames = new Particles(500);
  const wisps = Array.from({ length: 5 }, (_, i) => ({ a: (i / 5) * TAU, h: rand(-0.4, 0.4), pos: null }));
  return {
    id: 'wisps',
    name: 'Feux follets',
    colors: COLORS,
    needs: { seg: false },
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    start() {
      flames.clear();
    },
    update(dt, hands, e) {
      flames.update(dt);
      const h = mainHand(hands);
      for (const w of wisps) {
        w.a += dt * 1.6;
        let target;
        if (h) {
          const p = palmPoint(h, Math.cos(w.a) * 1.8, Math.sin(w.a) * 1.8 * 0.5 + w.h + 0.6, Math.sin(w.a) * 1.8);
          target = p;
        } else target = { x: e.W * (0.5 + Math.cos(w.a) * 0.3), y: e.H * (0.45 + Math.sin(w.a * 1.3) * 0.15), z: 0 };
        if (!w.pos) w.pos = { ...target };
        w.pos.x += (target.x - w.pos.x) * Math.min(1, dt * 6);
        w.pos.y += (target.y - w.pos.y) * Math.min(1, dt * 6);
        w.pos.z = target.z || 0;
        for (let k = 0; k < 3; k++)
          flames.add({
            x: w.pos.x + rand(-4, 4),
            y: w.pos.y + rand(-4, 4),
            vx: rand(-20, 20),
            vy: -rand(60, 140) * e.unit,
            g: -80,
            life: rand(0.3, 0.6),
            size: rand(10, 18) * e.unit,
            grow: 0.2,
            rgb,
            alpha: 0.45,
            core: 0.25,
          });
      }
      e.audio.loop('hum', 0.15);
    },
    draw(ctx, e) {
      flames.draw(ctx);
      ctx.globalCompositeOperation = 'lighter';
      for (const w of wisps) if (w.pos) drawGlow(ctx, [230, 250, 255], w.pos.x, w.pos.y, 12 * e.unit, 0.9);
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}
