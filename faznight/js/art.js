/* FAZNIGHT — procedural 2.5D renderer: shaded animatronic rigs, glowing eyes, grime, noise.
   Every character is drawn in code (no image files), with articulated parts and live animation. */
(function (FN) {
  // ---------------------------------------------------------------- utilities
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hexRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(h, to, amt) {
    const a = hexRgb(h), b = hexRgb(to);
    return 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * amt)).join(',') + ')';
  }
  const lighten = (h, a) => mix(h, '#ffffff', a);
  const darken = (h, a) => mix(h, '#000000', a);
  function rgba(h, a) { const c = hexRgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  }
  function ell(c, x, y, rx, ry, fill, rot = 0) {
    c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
    c.fillStyle = fill; c.fill();
  }
  /** Ellipse shaded like a 3D volume lit from the upper left. */
  function vol(c, x, y, rx, ry, base, rot = 0, spec = 0.32) {
    const g = c.createRadialGradient(x - rx * 0.38, y - ry * 0.45, Math.min(rx, ry) * 0.05, x, y, Math.max(rx, ry) * 1.15);
    g.addColorStop(0, lighten(base, spec));
    g.addColorStop(0.45, base);
    g.addColorStop(1, darken(base, 0.62));
    ell(c, x, y, rx, ry, g, rot);
  }
  function rod(c, x1, y1, x2, y2, w = 10, col = '#3a3d40') {
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = w * 0.25;
    c.beginPath(); c.moveTo(x1 - w * 0.2, y1 - w * 0.2); c.lineTo(x2 - w * 0.2, y2 - w * 0.2); c.stroke();
  }
  function joint(c, x, y, r) {
    const g = c.createRadialGradient(x - r * 0.4, y - r * 0.4, 1, x, y, r);
    g.addColorStop(0, '#c9cdd1'); g.addColorStop(0.5, '#6b7075'); g.addColorStop(1, '#22262a');
    ell(c, x, y, r, r, g);
  }
  function wire(c, x1, y1, cx, cy, x2, y2, col = '#1b1b1b', w = 3) {
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo(cx, cy, x2, y2); c.stroke();
  }
  function grime(c, x, y, w, h, seed, n = 30, col = '#3a2412', a = 0.25) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const rx = 2 + r() * w * 0.08, ry = rx * (0.4 + r() * 0.9);
      ell(c, x + r() * w, y + r() * h, rx, ry, rgba(col, a * (0.3 + r() * 0.7)), r() * 3);
    }
  }
  function teethRow(c, x, y, w, n, h, down = true, col = '#e8e2cf') {
    const tw = w / n;
    for (let i = 0; i < n; i++) {
      const tx = x + i * tw;
      c.fillStyle = i % 2 ? col : darken(col, 0.12);
      c.beginPath();
      if (down) { c.moveTo(tx + 1, y); c.lineTo(tx + tw - 1, y); c.lineTo(tx + tw * 0.62, y + h); c.lineTo(tx + tw * 0.38, y + h); }
      else { c.moveTo(tx + 1, y); c.lineTo(tx + tw - 1, y); c.lineTo(tx + tw * 0.62, y - h); c.lineTo(tx + tw * 0.38, y - h); }
      c.closePath(); c.fill();
    }
  }
  function squareTeeth(c, x, y, w, n, h, col = '#ddd6c2') {
    const tw = w / n;
    for (let i = 0; i < n; i++) {
      const g = c.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, col); g.addColorStop(1, darken(col, 0.35));
      c.fillStyle = g; c.fillRect(x + i * tw + 1.5, y, tw - 3, h);
    }
  }

  // ---------------------------------------------------------------- the rig
  const sprites = [canvas(8, 8), canvas(8, 8), canvas(8, 8)];
  let spriteIdx = 0;

  /**
   * Draws an animatronic. (x, y) is the feet position on ctx, h the full height in pixels.
   * o: { t, pose: idle|walk|stage|attack|peek|lean|float|slump, light 0..1, eyes 0..1, jaw 0..1,
   *      tilt (rad), look (-1..1), phase, alpha, flip, crop (show only top fraction) }
   */
  function drawChar(ctx, id, x, y, h, o = {}) {
    const def = FN.CHARS[id];
    if (!def || h < 2) return;
    // real-time 3D model when WebGL is available (falls back to the 2.5D rig)
    if (!o.flat && FN.G3 && FN.G3.enabled && FN.G3.drawChar(ctx, id, x, y, h, o)) return;
    const look = def.look;
    const k = Math.min(h, 1300) / 440;
    const W = Math.ceil(360 * k), H = Math.ceil(470 * k);
    const sp = sprites[spriteIdx++ % sprites.length];
    if (sp.width < W || sp.height < H) { sp.width = Math.max(sp.width, W); sp.height = Math.max(sp.height, H); }
    const c = sp.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W + 2, H + 2);
    const P = pose(look, o);
    c.save();
    c.translate(W / 2, H - 8 * k); c.scale(k, k);
    if (o.flip) c.scale(-1, 1);
    rig(c, look, P, 'body');
    c.restore();
    // grit texture and ambient occlusion so shells read as worn, heavy material
    c.save(); c.globalCompositeOperation = 'source-atop';
    c.globalAlpha = 0.22 + (look.rust ?? 0.4) * 0.25;
    c.drawImage(getGrit(), 0, 0, W, H);
    c.globalAlpha = 1;
    const ao = c.createLinearGradient(0, 0, W * 0.3, H);
    ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(0.55, 'rgba(0,0,0,0.18)'); ao.addColorStop(1, 'rgba(0,0,0,0.6)');
    c.fillStyle = ao; c.fillRect(0, 0, W, H);
    c.restore();
    const light = o.light ?? 1;
    if (light < 0.999) {
      c.save(); c.globalCompositeOperation = 'source-atop';
      c.fillStyle = `rgba(0,0,0,${Math.min(1, 1 - light)})`; c.fillRect(0, 0, W, H);
      c.restore();
    }
    if ((o.eyes ?? 1) > 0.01) {
      c.save(); c.translate(W / 2, H - 8 * k); c.scale(k, k);
      if (o.flip) c.scale(-1, 1);
      rig(c, look, P, 'glow');
      c.restore();
    }
    const scale = h / Math.min(h, 1300);
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    const crop = o.crop || 1;
    const sh = H * crop;
    ctx.drawImage(sp, 0, 0, W, sh, x - (W * scale) / 2, y - H * scale, W * scale, sh * scale);
    ctx.restore();
  }

  function pose(look, o) {
    const t = o.t ?? performance.now() / 1000;
    const p = o.pose || 'idle';
    const ph = o.phase ?? t * 5;
    const P = {
      t, p, eyes: o.eyes ?? 1, jaw: o.jaw ?? 0, tilt: o.tilt ?? 0, look: o.look ?? 0, damage: o.damage ?? look.damage ?? 0,
      bob: 0, lean: 0, armL: 0.15, armR: 0.15, foreL: 0.1, foreR: 0.1, legL: 0, legR: 0, headY: 0, twitch: 0,
    };
    const tw = Math.sin(t * 13.7) * Math.sin(t * 3.1);
    P.twitch = tw > 0.93 ? (tw - 0.93) * 6 : 0;
    if (p === 'idle' || p === 'stage') {
      P.bob = Math.sin(t * 1.4) * 2;
      P.tilt += Math.sin(t * 0.7) * 0.03 + P.twitch * 0.25;
      if (p === 'stage') { P.armL = 0.9 + Math.sin(t * 2) * 0.1; P.foreL = 1.4; P.armR = -0.4; P.foreR = -1.3; }
    } else if (p === 'walk') {
      P.bob = Math.abs(Math.sin(ph)) * -10;
      P.legL = Math.sin(ph) * 0.35; P.legR = -P.legL;
      P.armL = 0.15 - Math.sin(ph) * 0.3; P.armR = 0.15 + Math.sin(ph) * 0.3;
      P.tilt += Math.sin(ph) * 0.05;
    } else if (p === 'attack') {
      P.armL = 2.3 + Math.sin(t * 30) * 0.1; P.armR = 2.3 + Math.sin(t * 27) * 0.1; P.foreL = -0.5; P.foreR = -0.5;
      P.tilt += Math.sin(t * 41) * 0.08; P.lean = 0; P.jaw = Math.max(P.jaw, 0.85 + Math.sin(t * 35) * 0.15);
    } else if (p === 'peek') {
      P.tilt += 0.38 + Math.sin(t * 0.9) * 0.05; P.armL = 0.6; P.foreL = 1.2; P.bob = 0;
    } else if (p === 'lean') {
      P.tilt += -0.2; P.armR = -0.6; P.foreR = -1.4; P.armL = 0.3;
    } else if (p === 'float') {
      P.bob = Math.sin(t * 1.8) * 10 - 10; P.tilt += Math.sin(t * 0.8) * 0.06;
      P.armL = 0.4 + Math.sin(t * 2) * 0.3; P.armR = 0.4 + Math.sin(t * 2.2) * 0.3;
    } else if (p === 'slump') {
      P.tilt += 0.45 + P.twitch * 0.4; P.bob = 30; P.armL = 0.05; P.armR = 0.05; P.foreL = 0; P.foreR = 0;
    } else if (p === 'dance') {
      P.armL = 2.4 + Math.sin(t * 2) * 0.2; P.foreL = 0.4; P.armR = 2.4 - Math.sin(t * 2) * 0.2; P.foreR = 0.4;
      P.bob = Math.sin(t * 2) * 4; P.tilt += Math.sin(t * 1.3) * 0.08; P.legL = 0.15; P.legR = -0.4;
    }
    return P;
  }

  function rig(c, L, P, pass) {
    const body = pass === 'body';
    const S = L.scale || 1;
    c.save();
    c.scale(S, S);
    c.translate(0, P.bob);
    const fur = L.fur, belly = L.belly || lighten(L.fur, 0.4);
    const legType = L.legs || 'normal';
    const hipY = -150, shY = -275, neckY = -312;
    const bw = 88 * (L.bodyW || 1), bh = 100 * (L.bodyH || 1);

    // ---------------------------------- legs / lower body
    if (body) {
      if (legType === 'tentacles') {
        for (let i = 0; i < 7; i++) {
          const bx = -60 + i * 20, sway = Math.sin(P.t * 1.6 + i) * 18;
          c.strokeStyle = rgba(L.accent, 0.55); c.lineWidth = 9 - Math.abs(i - 3); c.lineCap = 'round';
          c.beginPath(); c.moveTo(bx, hipY + 10); c.bezierCurveTo(bx + sway, -100, bx - sway, -50, bx + sway * 0.6, -8 - (i % 2) * 20); c.stroke();
        }
      } else if (legType === 'ballet') {
        rod(c, -18, hipY, -22 + P.legL * 30, -10, 12, lighten(fur, 0.1));
        rod(c, 18, hipY, 30 + P.legR * 30, -60, 12, lighten(fur, 0.1));
        rod(c, 30 + P.legR * 30, -60, 8, -30, 10, lighten(fur, 0.1));
        ell(c, -22 + P.legL * 30, -6, 12, 7, '#c9b7b7');
      } else {
        for (const side of [-1, 1]) {
          const a = side < 0 ? P.legL : P.legR;
          const hx = side * 42, kx = hx + Math.sin(a) * 60, ky = hipY + 80, fx = hx + Math.sin(a) * 90, fy = -14;
          const shin = P.damage > 0.5 && side > 0;
          rod(c, hx, hipY, kx, ky, 12); rod(c, kx, ky, fx, fy, 10);
          joint(c, kx, ky, 9);
          if (!shin) vol(c, (hx + kx) / 2, (hipY + ky) / 2, 30, 50, fur, Math.sin(a) * -0.5);
          if (!shin) vol(c, (kx + fx) / 2, (ky + fy) / 2 + 8, 25, 40, darken(fur, 0.1), Math.sin(a) * -0.3);
          vol(c, fx + side * 6, fy, 40, 16, L.foot || darken(fur, 0.15));
        }
      }
      if (L.tail === 'ringed') {
        c.save(); c.translate(70, -150); c.rotate(-0.6 + Math.sin(P.t * 2) * 0.15);
        for (let i = 0; i < 6; i++) vol(c, i * 18, -i * 12, 20 - i, 16 - i, i % 2 ? '#202020' : fur);
        c.restore();
      }
      if (L.tail === 'croc') {
        c.save(); c.translate(-40, -110); c.rotate(0.3 + Math.sin(P.t * 1.2) * 0.08);
        vol(c, -50, 40, 80, 26, darken(fur, 0.2), 0.5); c.restore();
      }
    }

    // ---------------------------------- torso
    c.save();
    c.translate(0, -215);
    c.rotate(P.lean);
    c.translate(0, 215);
    if (body) {
      rod(c, 0, hipY, 0, neckY, 16);
      if (L.tutu) {
        for (let i = 0; i < 3; i++) vol(c, 0, hipY - 5 + i * 6, 120 - i * 18, 26 - i * 4, i % 2 ? L.tutu : lighten(L.tutu, 0.2));
      }
      if (L.torso === 'thin') {
        vol(c, 0, -225, bw * 0.6, bh * 0.95, fur);
      } else if (L.torso === 'suit') {
        vol(c, 0, -222, bw, bh, fur);
        c.fillStyle = darken(fur, 0.45); c.beginPath(); c.moveTo(-14, -310); c.lineTo(0, -230); c.lineTo(14, -310); c.fill();
        ell(c, 0, -303, 18, 8, L.accent || '#a01010');
      } else {
        vol(c, 0, -222, bw, bh, fur);
        vol(c, 0, -205, bw * 0.62, bh * 0.66, belly, 0, 0.2);
      }
      if (L.bib) {
        c.save(); c.translate(0, -210); c.rotate(-0.03);
        c.fillStyle = '#e9e3d2'; c.beginPath(); c.moveTo(-50, -55); c.lineTo(50, -55); c.lineTo(42, 40); c.lineTo(-42, 40); c.closePath(); c.fill();
        c.fillStyle = '#7a1414'; c.font = 'bold 24px Georgia'; c.textAlign = 'center'; c.fillText(L.bib, 0, 2);
        c.restore();
      }
      if (L.vest) {
        c.fillStyle = rgba(L.vest, 0.92);
        c.beginPath(); c.moveTo(-bw * 0.95, -270); c.quadraticCurveTo(-bw, -170, -bw * 0.6, -140); c.lineTo(-24, -150); c.lineTo(-30, -300); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(bw * 0.95, -270); c.quadraticCurveTo(bw, -170, bw * 0.6, -140); c.lineTo(24, -150); c.lineTo(30, -300); c.closePath(); c.fill();
        for (let i = 0; i < 3; i++) ell(c, -34, -260 + i * 36, 5, 5, '#c9a23a');
      }
      // damage: torn shell revealing endoskeleton
      if (P.damage > 0) {
        const r = rng(L.seed || 7);
        for (let i = 0; i < 2 + P.damage * 3; i++) {
          const hx = (r() - 0.5) * bw * 1.2, hy = -230 + (r() - 0.5) * bh * 1.1, hr = 10 + r() * 22;
          ell(c, hx, hy, hr, hr * 0.7, '#0d0b0a', r());
          rod(c, hx - hr * 0.6, hy, hx + hr * 0.6, hy + 4, 4, '#4b4f53');
          wire(c, hx, hy, hx + 10, hy + 30, hx + (r() - 0.5) * 30, hy + 45, '#2a1a10', 2);
        }
      }
      grime(c, -bw, -222 - bh, bw * 2, bh * 2, (L.seed || 3) + 11, 26, '#3a2412', 0.22 * (L.rust ?? 0.5) + P.damage * 0.15);
      if (L.bow) {
        vol(c, -22, -312, 22, 14, L.bow, -0.2); vol(c, 22, -312, 22, 14, L.bow, 0.2); ell(c, 0, -312, 9, 9, darken(L.bow, 0.3));
      }
    }

    // ---------------------------------- arms
    for (const side of [-1, 1]) {
      const a = side < 0 ? P.armL : P.armR, f = side < 0 ? P.foreL : P.foreR;
      const sx = side * (bw - 6), sy = shY;
      const ex = sx + Math.sin(side * a) * 70, ey = sy + Math.cos(a) * 75;
      const hx = ex + Math.sin(side * (a + f)) * 62, hy = ey + Math.cos(a + f) * 66;
      if (body) {
        const bare = P.damage > 0.6 && side < 0;
        rod(c, sx, sy, ex, ey, 11); rod(c, ex, ey, hx, hy, 9);
        joint(c, sx, sy, 12); joint(c, ex, ey, 8);
        if (!bare) {
          const ang = Math.atan2(ey - sy, ex - sx) - Math.PI / 2;
          vol(c, (sx + ex) / 2, (sy + ey) / 2, 24, 44, fur, ang);
          const ang2 = Math.atan2(hy - ey, hx - ex) - Math.PI / 2;
          vol(c, (ex + hx) / 2, (ey + hy) / 2, 20, 38, darken(fur, 0.06), ang2);
          vol(c, hx, hy + 6, 22, 20, L.hand || fur);
          for (let i = -1; i <= 1; i++) rod(c, hx + i * 9, hy + 14, hx + i * 12, hy + 32, 7, L.hand || darken(fur, 0.1));
        } else {
          for (let i = -1; i <= 1; i++) rod(c, hx + i * 7, hy, hx + i * 11, hy + 26, 4, '#55595d');
          joint(c, hx, hy, 7);
        }
        if (side > 0 && L.prop === 'mic' && P.p !== 'attack') { rod(c, hx, hy, hx + 8, hy - 50, 6, '#222'); vol(c, hx + 9, hy - 58, 11, 13, '#555'); }
        if (side < 0 && L.prop === 'lantern' && P.p !== 'attack') {
          rod(c, hx, hy + 20, hx, hy + 50, 3, '#222');
          vol(c, hx, hy + 70, 16, 22, '#6b4a1a');
        }
      } else if (side < 0 && L.prop === 'lantern' && P.p !== 'attack') {
        const g = c.createRadialGradient(hx, hy + 70, 2, hx, hy + 70, 70);
        g.addColorStop(0, 'rgba(255,200,90,0.9)'); g.addColorStop(1, 'rgba(255,160,40,0)');
        c.globalCompositeOperation = 'lighter'; ell(c, hx, hy + 70, 70, 70, g); c.globalCompositeOperation = 'source-over';
      }
    }
    if (body && L.prop === 'bass' && P.p !== 'attack') {
      c.save(); c.translate(0, -200); c.rotate(-0.55);
      vol(c, -10, 20, 46, 34, L.accent || '#8a1d1d'); vol(c, 22, 18, 36, 28, L.accent || '#8a1d1d');
      ell(c, 5, 18, 12, 12, '#111');
      c.fillStyle = '#3a2615'; c.fillRect(40, 10, 120, 12);
      c.fillStyle = '#222'; c.fillRect(155, 6, 24, 20);
      c.restore();
    }

    // ---------------------------------- head
    const hw = L.head.rx, hh = L.head.ry;
    c.translate(0, neckY - hh * 0.62 + P.headY);
    c.rotate(P.tilt);
    c.translate(P.look * 8, 0);
    if (body) {
      rod(c, 0, hh * 0.5, 0, hh * 0.9, 14);
      if (L.wires) for (let i = 0; i < L.wires; i++) {
        const s = i % 2 ? 1 : -1;
        wire(c, s * hw * 0.5, -hh * 0.6, s * (hw + 40 + i * 7), -hh * 0.4 + i * 20, s * (hw * 0.8 + i * 10), hh * 0.3 + i * 20, '#121212', 2.5);
      }
    }
    headShape(c, L, P, hw, hh, body);
    c.restore();
  }

  function eyes(c, L, P, ex, ey, er, body, opts = {}) {
    const col = L.eye;
    const ratio = opts.ry || 1;
    for (const side of [-1, 1]) {
      const missing = P.damage > 0.5 && side < 0 && L.loseEye !== false;
      const x = side * ex, y = ey;
      if (body) {
        ell(c, x, y, er * 1.25, er * 1.25 * ratio, '#050404');
        if (!missing && L.eyeWhite !== false) ell(c, x + P.look * er * 0.2, y, er * 0.95, er * 0.95 * ratio, '#b7b0a4');
        if (!missing) ell(c, x + P.look * er * 0.35, y, er * 0.36, er * 0.36 * ratio, darken(col, 0.5));
        const lids = L.lids === undefined ? (['badger', 'goat', 'croc', 'raccoon'].includes(L.kind) ? darken(L.fur, 0.25) : null) : L.lids;
        if (lids && P.p !== 'attack') { c.fillStyle = lids; c.beginPath(); c.ellipse(x, y - er * 0.42, er * 1.3, er * 0.95, side * 0.18, Math.PI, 0); c.fill(); }
      } else if (!missing) {
        const flick = 0.85 + Math.sin(P.t * 37 + side) * 0.08 + (Math.random() < 0.02 ? -0.5 : 0);
        const a = Math.max(0, P.eyes * flick);
        c.globalCompositeOperation = 'lighter';
        const gx = x + P.look * er * 0.35;
        const g = c.createRadialGradient(gx, y, 0, gx, y, er * 3.4);
        g.addColorStop(0, rgba(col, 0.55 * a)); g.addColorStop(0.3, rgba(col, 0.22 * a)); g.addColorStop(1, rgba(col, 0));
        ell(c, gx, y, er * 3.4, er * 3.4, g);
        const g2 = c.createRadialGradient(gx, y, 0, gx, y, er * 0.42);
        g2.addColorStop(0, `rgba(255,255,255,${a})`); g2.addColorStop(0.5, rgba(col, a)); g2.addColorStop(1, rgba(col, 0));
        ell(c, gx, y, er * 0.42, er * 0.42 * ratio, g2);
        c.globalCompositeOperation = 'source-over';
        ell(c, gx, y, er * 0.14, er * 0.22 * ratio, `rgba(0,0,0,${0.85 * a})`);
      }
    }
  }

  function mouth(c, L, P, mx, my, mw, mh, body, style = 'square') {
    if (!body) return;
    const open = P.jaw * mh;
    ell(c, mx, my + open * 0.5, mw * 0.5, Math.max(4, open * 0.55 + 6), '#120707');
    if (open > 2) ell(c, mx, my + open * 0.6, mw * 0.3, open * 0.3, '#3a0d0d');
    if (style === 'square') {
      squareTeeth(c, mx - mw * 0.4, my - 4, mw * 0.8, 7, 12);
      squareTeeth(c, mx - mw * 0.36, my + open - 6, mw * 0.72, 6, 10);
    } else {
      teethRow(c, mx - mw * 0.45, my - 2, mw * 0.9, 9, 14, true);
      teethRow(c, mx - mw * 0.42, my + open + 6, mw * 0.84, 8, 12, false);
    }
  }

  function headShape(c, L, P, hw, hh, body) {
    const fur = L.fur;
    switch (L.kind) {
      case 'badger': {
        if (body) {
          vol(c, -hw * 0.72, -hh * 0.82, 20, 18, darken(fur, 0.2)); vol(c, hw * 0.72, -hh * 0.82, 20, 18, darken(fur, 0.2));
          vol(c, 0, 0, hw, hh, fur);
          c.save(); c.beginPath(); c.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2); c.clip();
          ell(c, -hw * 0.42, -hh * 0.15, hw * 0.32, hh * 0.85, rgba('#0c0b0b', 0.92), 0.25);
          ell(c, hw * 0.42, -hh * 0.15, hw * 0.32, hh * 0.85, rgba('#0c0b0b', 0.92), -0.25);
          ell(c, 0, -hh * 0.45, hw * 0.2, hh * 0.75, L.stripe || '#ece6d8');
          c.restore();
          vol(c, 0, hh * 0.42, hw * 0.58, hh * 0.38, L.belly, 0, 0.2);
          vol(c, 0, hh * 0.18, 17, 12, '#151313', 0, 0.5);
          if (L.hat) {
            vol(c, 0, -hh * 0.92, hw * 0.78, 12, '#161414');
            c.fillStyle = '#1d1a1a'; c.fillRect(-hw * 0.42, -hh * 0.92 - 70, hw * 0.84, 70);
            c.fillStyle = L.accent || '#7a1010'; c.fillRect(-hw * 0.42, -hh * 0.92 - 18, hw * 0.84, 12);
          }
        }
        eyes(c, L, P, hw * 0.4, -hh * 0.12, hw * 0.16, body);
        mouth(c, L, P, 0, hh * 0.5, hw * 0.72, 46, body);
        if (body && P.damage) grime(c, -hw, -hh, hw * 2, hh * 2, 77, 12, '#000000', 0.4);
        break;
      }
      case 'goat': {
        if (body) {
          for (const s of [-1, 1]) {
            c.strokeStyle = L.horn || '#b5a98f'; c.lineCap = 'round';
            for (let i = 0; i < 3; i++) {
              c.lineWidth = 22 - i * 6; c.strokeStyle = i === 0 ? darken(L.horn || '#b5a98f', 0.3) : L.horn || '#b5a98f';
              c.beginPath(); c.moveTo(s * hw * 0.4, -hh * 0.7); c.bezierCurveTo(s * hw * 1.1, -hh * 1.6, s * hw * 1.7, -hh * 0.6, s * hw * 1.15, -hh * 0.1); c.stroke();
            }
            vol(c, s * hw * 1.05, -hh * 0.15, 26, 12, darken(fur, 0.1), s * 0.5);
          }
          vol(c, 0, 0, hw, hh, fur);
          vol(c, 0, hh * 0.45, hw * 0.55, hh * 0.55, lighten(fur, 0.12), 0, 0.2);
          ell(c, -12, hh * 0.3, 6, 9, '#1a1310'); ell(c, 12, hh * 0.3, 6, 9, '#1a1310');
          c.fillStyle = L.belly; c.beginPath(); c.moveTo(-26, hh * 0.95); c.lineTo(26, hh * 0.95); c.lineTo(0, hh * 1.5 + Math.sin(P.t * 3) * 4); c.fill();
        }
        eyes(c, L, P, hw * 0.48, -hh * 0.18, hw * 0.17, body, { ry: 0.7 });
        mouth(c, L, P, 0, hh * 0.68, hw * 0.6, 40, body);
        break;
      }
      case 'owl': {
        if (body) {
          for (const s of [-1, 1]) { c.fillStyle = darken(fur, 0.25); c.beginPath(); c.moveTo(s * hw * 0.35, -hh * 0.8); c.lineTo(s * hw * 1.05, -hh * 1.45); c.lineTo(s * hw * 0.85, -hh * 0.45); c.fill(); }
          vol(c, 0, 0, hw, hh, fur);
          vol(c, -hw * 0.42, -hh * 0.05, hw * 0.44, hh * 0.52, L.belly, 0, 0.15);
          vol(c, hw * 0.42, -hh * 0.05, hw * 0.44, hh * 0.52, L.belly, 0, 0.15);
          c.strokeStyle = rgba('#000000', 0.25); c.lineWidth = 2;
          for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; c.beginPath(); c.moveTo(-hw * 0.42 + Math.cos(a) * 20, -hh * 0.05 + Math.sin(a) * 20); c.lineTo(-hw * 0.42 + Math.cos(a) * hw * 0.42, -hh * 0.05 + Math.sin(a) * hh * 0.5); c.stroke(); }
        }
        eyes(c, L, P, hw * 0.42, -hh * 0.05, hw * 0.24, body);
        if (body) {
          const open = P.jaw * 26;
          c.fillStyle = '#120707'; c.beginPath(); c.moveTo(-16, hh * 0.25); c.lineTo(16, hh * 0.25); c.lineTo(0, hh * 0.25 + 30 + open); c.fill();
          vol(c, 0, hh * 0.2, 18, 26, L.accent || '#d98c1c');
          c.fillStyle = darken(L.accent || '#d98c1c', 0.2); c.beginPath(); c.moveTo(-14, hh * 0.32 + open); c.lineTo(14, hh * 0.32 + open); c.lineTo(0, hh * 0.32 + 24 + open); c.fill();
          if (open > 4) teethRow(c, -14, hh * 0.3, 28, 4, 8, true);
        }
        break;
      }
      case 'croc': {
        if (body) {
          vol(c, 0, -hh * 0.15, hw * 0.9, hh * 0.85, fur);
          vol(c, -hw * 0.45, -hh * 0.75, 26, 20, darken(fur, 0.05)); vol(c, hw * 0.45, -hh * 0.75, 26, 20, darken(fur, 0.05));
          c.fillStyle = rgba('#000000', 0.18);
          for (let i = 0; i < 10; i++) ell(c, (i % 5 - 2) * 22, -hh * 0.5 + Math.floor(i / 5) * 24, 9, 7, rgba('#000000', 0.18));
          if (L.cap) { vol(c, 0, -hh * 1.0, hw * 0.5, 16, L.cap); c.fillStyle = darken(L.cap, 0.3); c.fillRect(-hw * 0.5, -hh * 1.0, hw, 6); }
        }
        eyes(c, L, P, hw * 0.45, -hh * 0.72, hw * 0.13, body, { ry: 0.55 });
        if (body) {
          const open = P.jaw * 60;
          ell(c, 0, hh * 0.45 + open * 0.5, hw * 1.05, hh * 0.32 + open * 0.4, '#140606');
          vol(c, 0, hh * 0.9 + open, hw * 1.05, hh * 0.3, darken(fur, 0.12));
          teethRow(c, -hw * 0.95, hh * 0.75 + open, hw * 1.9, 13, 16, false);
          vol(c, 0, hh * 0.3, hw * 1.1, hh * 0.34, fur);
          teethRow(c, -hw * 1.0, hh * 0.52, hw * 2.0, 14, 18, true);
          ell(c, -18, hh * 0.12, 7, 5, '#0d0d0d'); ell(c, 18, hh * 0.12, 7, 5, '#0d0d0d');
        }
        break;
      }
      case 'panda': {
        if (body) {
          vol(c, -hw * 0.75, -hh * 0.78, 26, 26, '#141414', 0, 0.5); vol(c, hw * 0.75, -hh * 0.78, 26, 26, '#141414', 0, 0.5);
          vol(c, 0, 0, hw, hh, fur, 0, 0.55);
          ell(c, -hw * 0.4, -hh * 0.08, hw * 0.28, hh * 0.36, '#121212', 0.5); ell(c, hw * 0.4, -hh * 0.08, hw * 0.28, hh * 0.36, '#121212', -0.5);
          ell(c, -hw * 0.62, hh * 0.35, 16, 11, rgba('#ff6f91', 0.75)); ell(c, hw * 0.62, hh * 0.35, 16, 11, rgba('#ff6f91', 0.75));
          vol(c, 0, hh * 0.15, 13, 9, '#141414', 0, 0.6);
          ell(c, -hw * 0.3, -hh * 0.55, hw * 0.25, hh * 0.12, 'rgba(255,255,255,0.45)', -0.4);
        }
        eyes(c, L, P, hw * 0.4, -hh * 0.08, hw * 0.14, body);
        mouth(c, L, P, 0, hh * 0.5, hw * 0.6, 40, body);
        break;
      }
      case 'raccoon': {
        if (body) {
          for (const s of [-1, 1]) { c.fillStyle = darken(fur, 0.3); c.beginPath(); c.moveTo(s * hw * 0.25, -hh * 0.7); c.lineTo(s * hw * 0.85, -hh * 1.35); c.lineTo(s * hw * 0.95, -hh * 0.35); c.fill(); c.fillStyle = '#e7d8c9'; c.beginPath(); c.moveTo(s * hw * 0.45, -hh * 0.7); c.lineTo(s * hw * 0.8, -hh * 1.15); c.lineTo(s * hw * 0.82, -hh * 0.55); c.fill(); }
          vol(c, 0, 0, hw, hh, fur, 0, 0.45);
          ell(c, 0, -hh * 0.1, hw * 0.95, hh * 0.3, '#151515');
          vol(c, 0, hh * 0.4, hw * 0.5, hh * 0.38, L.belly, 0, 0.3);
          vol(c, 0, hh * 0.2, 12, 9, '#111', 0, 0.6);
        }
        eyes(c, L, P, hw * 0.42, -hh * 0.1, hw * 0.15, body);
        mouth(c, L, P, 0, hh * 0.52, hw * 0.5, 36, body, 'sharp');
        break;
      }
      case 'jelly': {
        if (body) {
          const g = c.createRadialGradient(-hw * 0.3, -hh * 0.5, 5, 0, -hh * 0.1, hw * 1.3);
          g.addColorStop(0, 'rgba(255,220,240,0.95)'); g.addColorStop(0.5, rgba(fur, 0.8)); g.addColorStop(1, 'rgba(70,20,70,0.85)');
          c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, hw * 1.15, hh * 1.05, 0, Math.PI, 0);
          for (let i = 0; i <= 8; i++) c.lineTo(hw * 1.15 - (i / 8) * hw * 2.3, hh * 0.25 + (i % 2) * 14);
          c.fill();
          vol(c, 0, hh * 0.35, hw * 0.62, hh * 0.62, '#efe4dc', 0, 0.4);
          c.strokeStyle = '#7a2a3a'; c.lineWidth = 3; c.beginPath(); c.arc(0, hh * 0.45, hw * 0.3, 0.3, Math.PI - 0.3); c.stroke();
          for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * 9, hh * 0.58); c.lineTo(i * 9, hh * 0.68); c.stroke(); }
          ell(c, -hw * 0.38, hh * 0.45, 9, 6, rgba('#ff6f91', 0.6)); ell(c, hw * 0.38, hh * 0.45, 9, 6, rgba('#ff6f91', 0.6));
        }
        eyes(c, L, P, hw * 0.25, hh * 0.25, hw * 0.12, body);
        if (body && P.jaw > 0.1) mouth(c, L, P, 0, hh * 0.6, hw * 0.4, 30, body, 'sharp');
        break;
      }
      case 'doll': {
        if (body) {
          vol(c, 0, 0, hw, hh, '#efe8df', 0, 0.5);
          c.fillStyle = '#2a1b1b'; c.beginPath(); c.ellipse(0, -hh * 0.55, hw * 1.02, hh * 0.6, 0, Math.PI, 0); c.fill();
          vol(c, 0, -hh * 1.05, 26, 22, '#2a1b1b');
          c.fillStyle = '#c9a23a'; c.beginPath(); c.moveTo(-30, -hh * 0.95); for (let i = 0; i <= 4; i++) c.lineTo(-30 + i * 15, -hh * 0.95 - (i % 2 ? 26 : 8)); c.lineTo(30, -hh * 0.95); c.fill();
          ell(c, -hw * 0.5, hh * 0.3, 15, 9, rgba('#e04a6a', 0.7)); ell(c, hw * 0.5, hh * 0.3, 15, 9, rgba('#e04a6a', 0.7));
          c.strokeStyle = '#4a1010'; c.lineWidth = 2; c.beginPath(); c.moveTo(-hw * 0.4, -hh * 0.05); c.lineTo(-hw * 0.4, hh * 0.6); c.moveTo(hw * 0.4, -hh * 0.05); c.lineTo(hw * 0.4, hh * 0.6); c.stroke();
          c.fillStyle = '#7a1a2a'; c.beginPath(); c.ellipse(0, hh * 0.52, 12, 6 + P.jaw * 14, 0, 0, Math.PI * 2); c.fill();
        }
        eyes(c, L, P, hw * 0.36, -hh * 0.08, hw * 0.16, body);
        break;
      }
      case 'tv': {
        if (body) {
          rod(c, -20, -hh * 0.9, -60, -hh * 1.6, 4, '#555'); rod(c, 20, -hh * 0.9, 50, -hh * 1.7, 4, '#555');
          const g = c.createLinearGradient(0, -hh, 0, hh);
          g.addColorStop(0, '#5a4a3a'); g.addColorStop(1, '#221a14');
          c.fillStyle = g; roundRect(c, -hw, -hh * 0.95, hw * 2, hh * 1.9, 18); c.fill();
          c.fillStyle = '#0a0f0c'; roundRect(c, -hw * 0.78, -hh * 0.72, hw * 1.4, hh * 1.4, 22); c.fill();
          // noisy screen
          const r = rng(Math.floor(P.t * 20));
          for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(200,255,220,${r() * 0.25})`; c.fillRect(-hw * 0.78 + r() * hw * 1.4, -hh * 0.72 + r() * hh * 1.4, 6 + r() * 20, 2); }
          ell(c, hw * 0.82, -hh * 0.3, 7, 7, '#222'); ell(c, hw * 0.82, 0, 7, 7, '#222');
        }
        eyes(c, L, P, hw * 0.33, -hh * 0.18, hw * 0.15, body);
        if (body) {
          c.strokeStyle = rgba(L.eye, 0.9); c.lineWidth = 5; c.beginPath(); c.arc(-hw * 0.08, hh * 0.05, hw * 0.45, 0.25, Math.PI - 0.25); c.stroke();
          if (P.jaw > 0.1) { c.fillStyle = '#000'; c.fillRect(-hw * 0.5, hh * 0.15, hw * 0.85, hh * 0.35 * P.jaw); }
        }
        break;
      }
      case 'hollow': {
        if (body) {
          vol(c, 0, 0, hw, hh * 1.05, fur, 0, 0.15);
          grime(c, -hw, -hh, hw * 2, hh * 2, 1313, 30, '#2a2418', 0.35);
          c.strokeStyle = rgba('#000000', 0.35); c.lineWidth = 2;
          c.beginPath(); c.moveTo(-hw * 0.2, -hh); c.lineTo(-hw * 0.1, -hh * 0.4); c.lineTo(-hw * 0.25, 0); c.stroke();
          c.fillStyle = '#000'; c.beginPath(); c.moveTo(-hw * 0.45, hh * 0.45); c.quadraticCurveTo(0, hh * (0.7 + P.jaw * 0.4), hw * 0.45, hh * 0.45); c.quadraticCurveTo(0, hh * 0.55, -hw * 0.45, hh * 0.45); c.fill();
        }
        eyes(c, Object.assign({}, L, { eyeWhite: false }), P, hw * 0.36, -hh * 0.1, hw * 0.2, body);
        break;
      }
      default:
        if (body) vol(c, 0, 0, hw, hh, fur);
        eyes(c, L, P, hw * 0.4, -hh * 0.1, hw * 0.15, body);
    }
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  let grit = null;
  function getGrit() {
    if (grit) return grit;
    grit = canvas(256, 256);
    const x = grit.getContext('2d'), r = rng(4242);
    for (let i = 0; i < 2600; i++) {
      const a = r() * 0.5;
      x.fillStyle = r() < 0.6 ? `rgba(40,22,10,${a})` : `rgba(0,0,0,${a})`;
      x.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 2);
    }
    for (let i = 0; i < 40; i++) ell(x, r() * 256, r() * 256, 4 + r() * 14, 2 + r() * 8, `rgba(70,35,12,${0.15 + r() * 0.25})`, r() * 3);
    for (let i = 0; i < 25; i++) { x.strokeStyle = `rgba(0,0,0,${0.3 + r() * 0.3})`; x.lineWidth = 1; x.beginPath(); const sx = r() * 256, sy = r() * 256; x.moveTo(sx, sy); x.lineTo(sx + (r() - 0.5) * 30, sy + r() * 30); x.stroke(); }
    return grit;
  }

  // ---------------------------------------------------------------- screen effects
  let noiseFrames = null;
  function getNoise() {
    if (noiseFrames) return noiseFrames;
    noiseFrames = [];
    for (let f = 0; f < 4; f++) {
      const c = canvas(192, 192), x = c.getContext('2d'), img = x.createImageData(192, 192);
      for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      x.putImageData(img, 0, 0); noiseFrames.push(c);
    }
    return noiseFrames;
  }
  /** Analog static over the whole canvas. */
  function staticFx(ctx, w, h, alpha, t) {
    if (alpha <= 0.005) return;
    const fr = getNoise()[Math.floor((t || performance.now() / 1000) * 30) % 4];
    ctx.save(); ctx.globalAlpha = Math.min(1, alpha);
    const p = ctx.createPattern(fr, 'repeat');
    ctx.translate(Math.random() * 192, Math.random() * 192);
    ctx.fillStyle = p; ctx.fillRect(-192, -192, w + 384, h + 384);
    ctx.restore();
  }
  let scanCache = null;
  function scanlines(ctx, w, h, a = 0.18) {
    if (!scanCache || scanCache.width !== w || scanCache.height !== h) {
      scanCache = canvas(w, h); const x = scanCache.getContext('2d');
      x.fillStyle = '#000'; for (let y = 0; y < h; y += 3) x.fillRect(0, y, w, 1);
      const g = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.85)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    }
    ctx.save(); ctx.globalAlpha = a / 0.18 * 0.6; ctx.drawImage(scanCache, 0, 0); ctx.restore();
  }
  function vignette(ctx, w, h, strength = 0.8, cx = w / 2, cy = h / 2) {
    const g = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.25, cx, cy, Math.max(w, h) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }

  FN.Art = { rng, mix, lighten, darken, rgba, canvas, ell, vol, rod, joint, wire, grime, teethRow, roundRect, drawChar, staticFx, scanlines, vignette, getNoise, pose, getGrit: () => getGrit() };
})(window.FN);
