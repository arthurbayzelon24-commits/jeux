/* FAZNIGHT — procedural environments: camera rooms, offices, hallways, vents. Rendered once, cached. */
(function (FN) {
  const A = FN.Art;
  const RW = 960, RH = 540;

  // ---------------------------------------------------------------- building blocks
  function persp(c, w, h, o) {
    const bx = o.bx ?? w * 0.25, by = o.by ?? h * 0.22, bw = o.bw ?? w * 0.5, bh = o.bh ?? h * 0.48;
    const by2 = by + bh;
    // ceiling
    let g = c.createLinearGradient(0, 0, 0, by);
    g.addColorStop(0, A.darken(o.ceil || '#262422', 0.6)); g.addColorStop(1, o.ceil || '#262422');
    c.fillStyle = g; poly(c, [[0, 0], [w, 0], [bx + bw, by], [bx, by]]);
    // walls
    g = c.createLinearGradient(0, 0, bx, 0); g.addColorStop(0, A.darken(o.wall, 0.55)); g.addColorStop(1, o.wall);
    c.fillStyle = g; poly(c, [[0, 0], [bx, by], [bx, by2], [0, h]]);
    g = c.createLinearGradient(w, 0, bx + bw, 0); g.addColorStop(0, A.darken(o.wall, 0.55)); g.addColorStop(1, o.wall);
    c.fillStyle = g; poly(c, [[w, 0], [bx + bw, by], [bx + bw, by2], [w, h]]);
    c.fillStyle = o.back || o.wall; c.fillRect(bx, by, bw, bh);
    // tile band on walls
    if (o.band) {
      const bandTop = 0.62;
      c.fillStyle = o.band;
      c.fillRect(bx, by + bh * bandTop, bw, bh * (1 - bandTop));
      poly(c, [[0, h * bandTop + h * 0.02], [bx, by + bh * bandTop], [bx, by2], [0, h]]);
      poly(c, [[w, h * bandTop + h * 0.02], [bx + bw, by + bh * bandTop], [bx + bw, by2], [w, h]]);
      if (o.band2) {
        const n = 16;
        for (let i = 0; i < n; i++) if (i % 2) { c.fillStyle = o.band2; c.fillRect(bx + (i * bw) / n, by + bh * bandTop, bw / n, bh * 0.08); }
      }
    }
    floor(c, w, h, bx, by2, bw, o);
    A.grime(c, 0, 0, w, h * 0.7, o.seed || 1, 60, '#000000', 0.22);
    return { bx, by, bw, bh, by2 };
  }
  function floor(c, w, h, bx, by2, bw, o) {
    const N = o.rows || 9, M = o.cols || 12;
    const c1 = o.f1 || '#d8d2c6', c2 = o.f2 || '#151313';
    const rowY = (s) => by2 + (h - by2) * Math.pow(s, 1.55);
    const edge = (s, side) => (side ? A_lerp(bx + bw, w + w * 0.35, s) : A_lerp(bx, -w * 0.35, s));
    for (let j = 0; j < N; j++) {
      const s0 = j / N, s1 = (j + 1) / N;
      const y0 = rowY(s0), y1 = rowY(s1);
      for (let i = 0; i < M; i++) {
        const l0 = edge(s0, 0), r0 = edge(s0, 1), l1 = edge(s1, 0), r1 = edge(s1, 1);
        const xa0 = A_lerp(l0, r0, i / M), xb0 = A_lerp(l0, r0, (i + 1) / M), xa1 = A_lerp(l1, r1, i / M), xb1 = A_lerp(l1, r1, (i + 1) / M);
        c.fillStyle = (i + j) % 2 ? c1 : c2;
        poly(c, [[xa0, y0], [xb0, y0], [xb1, y1], [xa1, y1]]);
      }
    }
    const g = c.createLinearGradient(0, by2, 0, h); g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0.1)');
    c.fillStyle = g; c.fillRect(0, by2, w, h - by2);
  }
  const A_lerp = (a, b, t) => a + (b - a) * t;
  function poly(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.fill(); }
  function shade(c, w, h, dark, lights = []) {
    const L = A.canvas(w, h), x = L.getContext('2d');
    x.fillStyle = `rgba(0,0,0,${dark})`; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'destination-out';
    for (const l of lights) {
      const g = x.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      g.addColorStop(0, `rgba(0,0,0,${l.a ?? 0.9})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.beginPath(); x.ellipse(l.x, l.y, l.r * (l.sx || 1), l.r * (l.sy || 1), 0, 0, Math.PI * 2); x.fill();
    }
    c.drawImage(L, 0, 0);
    for (const l of lights) if (l.tint) {
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 0.8);
      g.addColorStop(0, l.tint); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2); c.restore();
    }
  }
  function poster(c, x, y, w, h, o = {}) {
    c.save(); c.translate(x + w / 2, y + h / 2); c.rotate(o.rot || 0); c.translate(-w / 2, -h / 2);
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(4, 5, w, h);
    const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, A.lighten(o.bg || '#6a1414', 0.15)); g.addColorStop(1, A.darken(o.bg || '#6a1414', 0.4));
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    if (o.chars) {
      const n = o.chars.length;
      o.chars.forEach((id, i) => A.drawChar(c, id, w * ((i + 0.5) / n), h * 0.92, h * (o.charH || 0.75), { t: 1 + i, pose: i % 2 ? 'dance' : 'stage', light: 0.9, eyes: 0.3 }));
    }
    if (o.title) {
      c.fillStyle = o.ink || '#f4e7c8'; c.font = `bold ${Math.floor(w / (o.title.length * 0.62 + 1))}px Georgia`; c.textAlign = 'center';
      c.shadowColor = '#000'; c.shadowBlur = 4; c.fillText(o.title, w / 2, h * 0.16); c.shadowBlur = 0;
    }
    A.grime(c, 0, 0, w, h, (o.seed || 5) * 3, 18, '#2a1a0a', 0.35);
    if (o.torn) { c.fillStyle = '#0c0b0a'; poly(c, [[w, h * 0.7], [w, h], [w * 0.7, h], [w * 0.85, h * 0.88]]); }
    c.restore();
  }
  function kidDrawing(c, x, y, w, h, seed) {
    const r = A.rng(seed);
    c.save(); c.translate(x, y); c.rotate((r() - 0.5) * 0.2);
    c.fillStyle = '#e8e3d6'; c.fillRect(0, 0, w, h);
    const cols = ['#d33', '#36c', '#2a2', '#e90', '#a3c', '#111'];
    for (let k = 0; k < 2 + r() * 2; k++) {
      const cx = w * (0.2 + r() * 0.6), cy = h * (0.35 + r() * 0.3), s = h * 0.18;
      c.strokeStyle = cols[Math.floor(r() * cols.length)]; c.lineWidth = 2;
      c.beginPath(); c.arc(cx, cy - s, s * 0.6, 0, 7); c.moveTo(cx, cy - s * 0.4); c.lineTo(cx, cy + s * 0.6);
      c.moveTo(cx - s * 0.6, cy); c.lineTo(cx + s * 0.6, cy); c.moveTo(cx, cy + s * 0.6); c.lineTo(cx - s * 0.4, cy + s * 1.2); c.moveTo(cx, cy + s * 0.6); c.lineTo(cx + s * 0.4, cy + s * 1.2); c.stroke();
      c.fillStyle = '#111'; c.fillRect(cx - s * 0.3, cy - s * 1.1, 3, 3); c.fillRect(cx + s * 0.15, cy - s * 1.1, 3, 3);
    }
    c.fillStyle = '#e33'; c.font = `${Math.floor(h * 0.12)}px sans-serif`; c.fillText(['MERCI !', 'BRUNO', 'AMIS', 'NOUS'][Math.floor(r() * 4)], w * 0.1, h * 0.92);
    c.restore();
  }
  function table(c, x, y, s, cloth = '#e4e0d6', seed = 1) {
    const r = A.rng(seed);
    c.fillStyle = 'rgba(0,0,0,0.5)'; A.ell(c, x, y + s * 0.32, s * 1.15, s * 0.18, 'rgba(0,0,0,0.5)');
    const g = c.createLinearGradient(0, y - s * 0.1, 0, y + s * 0.35); g.addColorStop(0, cloth); g.addColorStop(1, A.darken(cloth, 0.5));
    c.fillStyle = g; poly(c, [[x - s, y], [x + s, y], [x + s * 1.1, y + s * 0.3], [x - s * 1.1, y + s * 0.3]]);
    c.fillStyle = A.darken(cloth, 0.2); poly(c, [[x - s * 0.95, y - s * 0.1], [x + s * 0.95, y - s * 0.1], [x + s, y], [x - s, y]]);
    for (let i = 0; i < 4; i++) {
      const hx = x - s * 0.7 + i * s * 0.45, hy = y - s * 0.1;
      c.fillStyle = ['#c22', '#26c', '#ca2', '#2a6'][Math.floor(r() * 4)];
      poly(c, [[hx - s * 0.08, hy], [hx + s * 0.08, hy], [hx, hy - s * 0.25]]);
      A.ell(c, hx, hy + s * 0.04, s * 0.12, s * 0.03, '#ddd');
    }
  }
  function curtain(c, x, y, w, h, col = '#5a0f14', open = 0) {
    const half = (w / 2) * (1 - open * 0.75);
    for (const side of [0, 1]) {
      const x0 = side ? x + w - half : x;
      const g = c.createLinearGradient(x0, 0, x0 + half, 0);
      for (let i = 0; i <= 8; i++) g.addColorStop(i / 8, i % 2 ? A.darken(col, 0.45) : col);
      c.fillStyle = g; c.fillRect(x0, y, half, h);
    }
    c.fillStyle = A.darken(col, 0.3); c.fillRect(x - 8, y - 14, w + 16, 22);
  }
  function stars(c, x, y, w, n, seed) {
    const r = A.rng(seed);
    for (let i = 0; i < n; i++) {
      const sx = x + r() * w, sy = y + r() * 40, s = 6 + r() * 8;
      c.fillStyle = ['#d9b23a', '#c0c0c0', '#e04a4a'][i % 3];
      c.beginPath();
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? s * 0.45 : s; c.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); }
      c.fill();
    }
  }
  function sign(c, x, y, text, col = '#d33', size = 28) {
    c.save(); c.font = `bold ${size}px Georgia`; c.textAlign = 'center'; c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 10; c.fillText(text, x, y); c.restore();
  }
  function scrawl(c, x, y, text, col = 'rgba(160,20,20,0.85)', size = 22, rot = -0.05) {
    c.save(); c.translate(x, y); c.rotate(rot); c.font = `${size}px 'Courier New', monospace`; c.fillStyle = col; c.fillText(text, 0, 0); c.restore();
  }
  function crate(c, x, y, s, col = '#5a4128') {
    c.fillStyle = col; c.fillRect(x - s / 2, y - s, s, s);
    c.strokeStyle = A.darken(col, 0.5); c.lineWidth = 4; c.strokeRect(x - s / 2, y - s, s, s);
    c.beginPath(); c.moveTo(x - s / 2, y - s); c.lineTo(x + s / 2, y); c.stroke();
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x - s / 2, y - s * 0.12, s, s * 0.12);
  }
  function hallway(c, w, h, o) {
    // long corridor seen head-on, vanishing at the centre
    const bw = w * (o.depthW || 0.16), bh = h * (o.depthH || 0.26), bx = w / 2 - bw / 2 + (o.off || 0), by = h * 0.36;
    persp(c, w, h, { bx, by, bw, bh, wall: o.wall, back: '#050505', ceil: o.ceil, band: o.band, band2: o.band2, f1: o.f1, f2: o.f2, rows: 14, cols: 8, seed: o.seed });
    // ribs / door frames along the corridor
    for (let i = 1; i < 6; i++) {
      const s = i / 6, k = Math.pow(s, 1.6);
      const lx = A_lerp(bx, 0, k), rx = A_lerp(bx + bw, w, k), ty = A_lerp(by, 0, k), byy = A_lerp(by + bh, h, k);
      c.strokeStyle = `rgba(0,0,0,${0.5 - s * 0.3})`; c.lineWidth = 2 + s * 8;
      c.beginPath(); c.moveTo(lx, byy); c.lineTo(lx, ty); c.lineTo(rx, ty); c.lineTo(rx, byy); c.stroke();
    }
    return { bx, by, bw, bh };
  }
  function ventTunnel(c, w, h, o = {}) {
    c.fillStyle = '#0a0a0b'; c.fillRect(0, 0, w, h);
    const cx = w / 2 + (o.off || 0), cy = h * 0.5;
    for (let i = 0; i < 9; i++) {
      const s = 1 - i / 9, rw = w * 0.6 * s + 30, rh = h * 0.62 * s + 18;
      const g = c.createLinearGradient(0, cy - rh, 0, cy + rh);
      const base = A.darken(o.metal || '#6b7178', 0.15 + i * 0.09);
      g.addColorStop(0, A.lighten(base, 0.1)); g.addColorStop(1, A.darken(base, 0.5));
      c.fillStyle = g; c.fillRect(cx - rw, cy - rh, rw * 2, rh * 2);
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 3; c.strokeRect(cx - rw, cy - rh, rw * 2, rh * 2);
      for (let b = 0; b < 6; b++) A.ell(c, cx - rw + 8 + (b * rw * 2) / 6, cy - rh + 6, 2, 2, 'rgba(255,255,255,0.15)');
    }
    c.fillStyle = '#000'; c.fillRect(cx - 32, cy - 20, 64, 40);
  }

  // ---------------------------------------------------------------- chapter 1 rooms
  const C1 = '#1e2a2a';
  const ch1 = [
    { id: '01', name: { fr: 'Scène', en: 'Show Stage' }, map: [50, 9], light: 0.55,
      draw(c, w, h) {
        persp(c, w, h, { bx: w * 0.08, by: h * 0.06, bw: w * 0.84, bh: h * 0.6, wall: '#2a2020', back: '#1a1212', ceil: '#141010', f1: '#3a2a1a', f2: '#2a1c10', rows: 5, cols: 14, seed: 3 });
        curtain(c, w * 0.08, h * 0.06, w * 0.84, h * 0.6, '#4a0d12', 0.95);
        c.fillStyle = '#2a1c12'; c.fillRect(w * 0.1, h * 0.06, w * 0.8, h * 0.56);
        stars(c, w * 0.14, h * 0.1, w * 0.72, 22, 9);
        sign(c, w / 2, h * 0.25, 'GRIMWOOD’S', '#e8b23a', 52);
        c.fillStyle = '#3b2615'; c.fillRect(0, h * 0.74, w, h * 0.08);
        const g = c.createLinearGradient(0, h * 0.7, 0, h * 0.82); g.addColorStop(0, '#5a3a20'); g.addColorStop(1, '#1a0f08'); c.fillStyle = g; c.fillRect(0, h * 0.7, w, h * 0.06);
        shade(c, w, h, 0.72, [{ x: w * 0.5, y: h * 0.5, r: w * 0.45, a: 0.85, tint: 'rgba(255,200,120,0.12)' }]);
      },
      spots: { bruno: [0.5, 0.78, 0.66], gus: [0.24, 0.79, 0.64], nora: [0.76, 0.79, 0.6] } },
    { id: '02', name: { fr: 'Grande salle', en: 'Main Hall' }, map: [50, 33], light: 0.45,
      draw(c, w, h) {
        const r = persp(c, w, h, { wall: '#3a3330', back: '#2e2826', ceil: '#1c1a18', band: '#1c1c1c', band2: '#b8b0a0', seed: 7 });
        poster(c, r.bx + 20, r.by + 20, 110, 150, { title: 'CÉLÉBREZ!', chars: ['bruno'], seed: 2 });
        kidDrawing(c, r.bx + r.bw - 120, r.by + 30, 90, 70, 12);
        stars(c, r.bx, r.by - 10, r.bw, 14, 4);
        table(c, w * 0.3, h * 0.72, 120, '#e4e0d6', 2); table(c, w * 0.72, h * 0.75, 130, '#e4e0d6', 3); table(c, w * 0.5, h * 0.62, 80, '#d8d2c6', 4);
        shade(c, w, h, 0.66, [{ x: w * 0.5, y: h * 0.25, r: w * 0.5, a: 0.75 }]);
      },
      spots: { bruno: [0.52, 0.66, 0.42], gus: [0.18, 0.86, 0.6], nora: [0.8, 0.7, 0.45] } },
    { id: '03', name: { fr: 'Marais de Krok', en: 'Krok’s Swamp' }, map: [15, 42], light: 0.4,
      draw(c, w, h) {
        persp(c, w, h, { bx: w * 0.15, by: h * 0.1, bw: w * 0.7, bh: h * 0.62, wall: '#1d2a1a', back: '#132012', ceil: '#0d140c', f1: '#1d2a1a', f2: '#0c120a', seed: 9 });
        c.fillStyle = '#0b0f08'; c.fillRect(w * 0.18, h * 0.12, w * 0.64, h * 0.6);
        sign(c, w / 2, h * 0.09 + 6, 'LE MARAIS — HORS SERVICE', '#7ad04a', 26);
        for (let i = 0; i < 12; i++) A.ell(c, w * (0.1 + i * 0.08), h * 0.8 + Math.sin(i) * 10, 40, 10, 'rgba(40,70,30,0.6)');
        shade(c, w, h, 0.65, [{ x: w * 0.5, y: h * 0.45, r: w * 0.4, a: 0.7, tint: 'rgba(80,200,80,0.08)' }]);
      },
      curtain: { x: 0.18, y: 0.12, w: 0.64, h: 0.6, col: '#2a4a1c' },
      spots: { krok: [0.5, 0.78, 0.6] } },
    { id: '04', name: { fr: 'Coulisses', en: 'Backstage' }, map: [13, 17], light: 0.35,
      draw(c, w, h) {
        const r = persp(c, w, h, { wall: '#2a2a2e', back: '#202024', ceil: '#141416', f1: '#2a2a2a', f2: '#151515', seed: 13 });
        c.fillStyle = '#3a2f24'; for (let i = 0; i < 2; i++) c.fillRect(r.bx + 10, r.by + 60 + i * 90, r.bw - 20, 10);
        ['bruno', 'gus', 'nora', 'krok'].forEach((id, i) => {
          c.save(); c.beginPath(); c.rect(r.bx + 20 + i * (r.bw / 4), r.by - 40, r.bw / 4 - 10, 100); c.clip();
          A.drawChar(c, id, r.bx + 20 + i * (r.bw / 4) + r.bw / 8, r.by + 260, 300, { t: 3, light: 0.5, eyes: 0, damage: 0.2 });
          c.restore();
        });
        A.rod(c, w * 0.15, h * 0.95, w * 0.3, h * 0.7, 10); A.joint(c, w * 0.3, h * 0.7, 12);
        scrawl(c, r.bx + 30, r.by + r.bh - 20, 'NE PAS ALLUMER', 'rgba(200,200,200,0.4)', 16);
        shade(c, w, h, 0.75, [{ x: w * 0.5, y: h * 0.1, r: w * 0.4, a: 0.7 }]);
      },
      spots: { gus: [0.35, 0.92, 0.75], bruno: [0.7, 0.9, 0.7] } },
    { id: '05', name: { fr: 'Atelier', en: 'Workshop' }, map: [18, 66], light: 0.4,
      draw(c, w, h) {
        const r = persp(c, w, h, { wall: '#3a3428', back: '#2c281e', ceil: '#18160f', f1: '#2a2620', f2: '#1a1812', seed: 17 });
        c.fillStyle = '#4a3a24'; c.fillRect(r.bx - 40, r.by + r.bh * 0.55, r.bw * 0.6, 26);
        for (let i = 0; i < 6; i++) A.rod(c, r.bx + 10 + i * 30, r.by + 40, r.bx + 10 + i * 30, r.by + 110, 5, '#777');
        crate(c, w * 0.8, h * 0.86, 140); crate(c, w * 0.92, h * 0.7, 100);
        scrawl(c, r.bx + r.bw * 0.45, r.by + 50, 'JUHQRXLOOH', 'rgba(190,30,30,0.75)', 26, 0.04);
        shade(c, w, h, 0.7, [{ x: w * 0.35, y: h * 0.4, r: w * 0.35, a: 0.8, tint: 'rgba(255,220,150,0.1)' }]);
      },
      spots: { gus: [0.45, 0.88, 0.66] } },
    { id: '06', name: { fr: 'Cuisine', en: 'Kitchen' }, map: [85, 45], light: 0.25, noisy: 0.55,
      draw(c, w, h) {
        const r = persp(c, w, h, { wall: '#bdb6a6', back: '#a8a090', ceil: '#2a2a2a', f1: '#d8d2c6', f2: '#2a2a2a', band: '#e0d9ca', seed: 19 });
        c.fillStyle = '#7a7d80'; c.fillRect(r.bx, r.by + r.bh * 0.5, r.bw, r.bh * 0.5);
        for (let i = 0; i < 5; i++) A.vol(c, r.bx + 40 + i * 70, r.by + 40, 22, 22, '#8a8f94');
        shade(c, w, h, 0.85, [{ x: w * 0.5, y: h * 0.4, r: w * 0.3, a: 0.5 }]);
      },
      spots: { bruno: [0.5, 0.86, 0.6] } },
    { id: '07', name: { fr: 'Couloir Ouest', en: 'West Hall' }, map: [37, 66], light: 0.35,
      draw(c, w, h) {
        const r = hallway(c, w, h, { wall: '#3a3532', ceil: '#181614', band: '#1a1a1a', band2: '#bdb4a2', seed: 21 });
        poster(c, w * 0.06, h * 0.22, 90, 130, { title: 'RÈGLES', bg: '#2a2a40', seed: 8, rot: -0.05 });
        shade(c, w, h, 0.7, [{ x: w / 2, y: r.by + 10, r: 160, a: 0.8, tint: 'rgba(255,220,160,0.12)' }]);
      },
      spots: { gus: [0.5, 0.72, 0.38], krok: [0.5, 0.8, 0.55], krokRun: [0.5, 1.15, 1.1] } },
    { id: '08', name: { fr: 'Angle Ouest', en: 'West Corner' }, map: [37, 86], light: 0.35,
      draw(c, w, h) {
        const r = persp(c, w, h, { bx: w * 0.55, by: h * 0.18, bw: w * 0.35, bh: h * 0.55, wall: '#3a3532', back: '#2e2a26', ceil: '#181614', band: '#1a1a1a', band2: '#bdb4a2', seed: 23 });
        poster(c, w * 0.12, h * 0.12, 160, 220, { title: 'SOURIEZ', chars: ['gus', 'nora'], seed: 11, bg: '#7a1d1d' });
        shade(c, w, h, 0.7, [{ x: w * 0.4, y: h * 0.3, r: w * 0.4, a: 0.65 }]);
      },
      spots: { gus: [0.7, 1.02, 0.95] } },
    { id: '09', name: { fr: 'Couloir Est', en: 'East Hall' }, map: [63, 66], light: 0.35,
      draw(c, w, h) {
        const r = hallway(c, w, h, { wall: '#3a3532', ceil: '#181614', band: '#1a1a1a', band2: '#bdb4a2', seed: 27 });
        kidDrawing(c, w * 0.82, h * 0.3, 80, 70, 31); kidDrawing(c, w * 0.88, h * 0.48, 70, 60, 33);
        shade(c, w, h, 0.7, [{ x: w / 2, y: r.by + 10, r: 160, a: 0.8 }]);
      },
      spots: { bruno: [0.5, 0.74, 0.4], nora: [0.47, 0.78, 0.45] } },
    { id: '10', name: { fr: 'Angle Est', en: 'East Corner' }, map: [63, 86], light: 0.35,
      draw(c, w, h) {
        persp(c, w, h, { bx: w * 0.1, by: h * 0.18, bw: w * 0.35, bh: h * 0.55, wall: '#3a3532', back: '#2e2a26', ceil: '#181614', band: '#1a1a1a', band2: '#bdb4a2', seed: 29 });
        kidDrawing(c, w * 0.6, h * 0.15, 110, 90, 41); kidDrawing(c, w * 0.75, h * 0.2, 100, 80, 43); kidDrawing(c, w * 0.62, h * 0.38, 90, 70, 45);
        shade(c, w, h, 0.7, [{ x: w * 0.6, y: h * 0.3, r: w * 0.4, a: 0.65 }]);
      },
      spots: { bruno: [0.3, 1.02, 0.95], nora: [0.32, 1.0, 0.9] } },
    { id: '11', name: { fr: 'Salle de fête', en: 'Party Room' }, map: [86, 18], light: 0.45,
      draw(c, w, h) {
        const r = persp(c, w, h, { wall: '#2a3a5a', back: '#22304a', ceil: '#121828', f1: '#c8c0b0', f2: '#3a2a4a', seed: 31 });
        for (let i = 0; i < 9; i++) {
          const bx = r.bx + 20 + i * 50, by = r.by + 40 + Math.sin(i) * 20, col = ['#c22', '#26c', '#ca2', '#a3c'][i % 4];
          A.wire(c, bx, by + 30, bx + 5, by + 80, bx, r.by + r.bh, 'rgba(200,200,200,0.4)', 1); A.vol(c, bx, by, 18, 24, col);
        }
        table(c, w * 0.5, h * 0.78, 150, '#d8c0e0', 9);
        A.vol(c, w * 0.2, h * 0.86, 40, 30, '#2a6aa8'); A.vol(c, w * 0.85, h * 0.9, 34, 26, '#a82a6a');
        shade(c, w, h, 0.68, [{ x: w * 0.5, y: h * 0.3, r: w * 0.4, a: 0.7, tint: 'rgba(120,140,255,0.08)' }]);
      },
      spots: { nora: [0.62, 0.74, 0.5] } },
  ];
  const ch1Links = [['01', '02'], ['02', '04'], ['02', '05'], ['02', '03'], ['02', '06'], ['02', '11'], ['05', '07'], ['03', '07'], ['07', '08'], ['06', '09'], ['11', '09'], ['09', '10']];

  // ---------------------------------------------------------------- chapter 2 rooms
  const ch2 = [
    { id: '01', name: { fr: 'Salle de fête 1', en: 'Party Room 1' }, map: [33, 57], light: 0.5,
      draw(c, w, h) { partyRoom(c, w, h, 51, '#2a4f8a'); }, spots: { oldbruno: [0.5, 0.86, 0.66], pepper: [0.5, 0.86, 0.66] } },
    { id: '02', name: { fr: 'Salle de fête 2', en: 'Party Room 2' }, map: [67, 57], light: 0.5,
      draw(c, w, h) { partyRoom(c, w, h, 53, '#8a2a6a'); }, spots: { pepper: [0.55, 0.86, 0.66], oldkrok: [0.3, 0.88, 0.7] } },
    { id: '03', name: { fr: 'Salle de fête 3', en: 'Party Room 3' }, map: [33, 76], light: 0.5,
      draw(c, w, h) { partyRoom(c, w, h, 57, '#2a8a5a'); }, spots: { rico: [0.4, 0.9, 0.5] } },
    { id: '04', name: { fr: 'Salle de fête 4', en: 'Party Room 4' }, map: [67, 76], light: 0.5,
      draw(c, w, h) { partyRoom(c, w, h, 59, '#8a6a2a'); }, spots: { lumi: [0.6, 0.8, 0.6] } },
    { id: '05', name: { fr: 'Conduit gauche', en: 'Left Vent' }, map: [20, 90], light: 0.45,
      draw(c, w, h) { ventTunnel(c, w, h, { off: -40 }); shade(c, w, h, 0.4, [{ x: w / 2, y: h / 2, r: w * 0.5, a: 0.5 }]); }, spots: { rico: [0.45, 0.9, 0.45] } },
    { id: '06', name: { fr: 'Conduit droit', en: 'Right Vent' }, map: [80, 90], light: 0.45,
      draw(c, w, h) { ventTunnel(c, w, h, { off: 40, metal: '#6e6a7a' }); shade(c, w, h, 0.4, [{ x: w / 2, y: h / 2, r: w * 0.5, a: 0.5 }]); }, spots: { lumi: [0.55, 0.8, 0.5] } },
    { id: '07', name: { fr: 'Grand hall', en: 'Main Hall' }, map: [50, 34], light: 0.45,
      draw(c, w, h) {
        const r = hallway(c, w, h, { wall: '#3a2a52', ceil: '#1a1428', band: '#20203a', band2: '#e05a9a', f1: '#d8d2e0', f2: '#2a2a6a', seed: 61, depthW: 0.3, depthH: 0.36 });
        stars(c, r.bx - 100, r.by - 40, r.bw + 200, 18, 6);
        poster(c, w * 0.05, h * 0.2, 110, 150, { title: 'PEPPER!', chars: ['pepper'], bg: '#2a4f8a', seed: 21 });
        shade(c, w, h, 0.62, [{ x: w / 2, y: h * 0.4, r: w * 0.4, a: 0.7 }]);
      },
      spots: { pepper: [0.5, 0.82, 0.5], oldbruno: [0.45, 0.84, 0.52], oldkrok: [0.58, 0.86, 0.55] } },
    { id: '08', name: { fr: 'Atelier des pièces', en: 'Parts & Service' }, map: [16, 15], light: 0.32,
      draw(c, w, h) {
        persp(c, w, h, { wall: '#2e2a26', back: '#24201c', ceil: '#121010', f1: '#2a2622', f2: '#161412', seed: 63 });
        crate(c, w * 0.12, h * 0.92, 150); crate(c, w * 0.9, h * 0.95, 160);
        for (let i = 0; i < 5; i++) A.wire(c, w * (0.2 + i * 0.15), 0, w * (0.22 + i * 0.15), h * 0.3, w * (0.18 + i * 0.15), h * 0.5, '#151515', 2);
        shade(c, w, h, 0.8, [{ x: w * 0.5, y: h * 0.15, r: w * 0.35, a: 0.8 }]);
      },
      spots: { oldkrok: [0.3, 0.88, 0.62], oldbruno: [0.68, 0.9, 0.64] } },
    { id: '09', name: { fr: 'Scène', en: 'Show Stage' }, map: [50, 9], light: 0.6,
      draw(c, w, h) {
        persp(c, w, h, { bx: w * 0.06, by: h * 0.05, bw: w * 0.88, bh: h * 0.62, wall: '#2a1e3a', back: '#1e1430', ceil: '#140c20', f1: '#5a3a7a', f2: '#2a1a40', rows: 5, cols: 14, seed: 65 });
        curtain(c, w * 0.06, h * 0.05, w * 0.88, h * 0.62, '#2a3aa8', 0.95);
        c.fillStyle = '#20163a'; c.fillRect(w * 0.08, h * 0.05, w * 0.84, h * 0.58);
        stars(c, w * 0.12, h * 0.1, w * 0.76, 26, 15);
        sign(c, w / 2, h * 0.27, 'FUN FACTORY', '#ff6fb0', 50);
        shade(c, w, h, 0.55, [{ x: w * 0.5, y: h * 0.5, r: w * 0.5, a: 0.85, tint: 'rgba(255,120,200,0.1)' }]);
      },
      spots: { pepper: [0.5, 0.8, 0.66] } },
    { id: '10', name: { fr: 'Arcade', en: 'Arcade' }, map: [84, 15], light: 0.45,
      draw(c, w, h) {
        const r = persp(c, w, h, { wall: '#1a1a2a', back: '#141420', ceil: '#0a0a12', f1: '#2a2a4a', f2: '#101020', seed: 67 });
        for (let i = 0; i < 4; i++) {
          const x = r.bx - 60 + i * 150, y = r.by + r.bh + 40, col = ['#a82a2a', '#2a6aa8', '#2aa86a', '#a8862a'][i];
          c.fillStyle = A.darken(col, 0.5); c.fillRect(x, y - 230, 110, 230);
          c.fillStyle = '#0d1a14'; c.fillRect(x + 12, y - 200, 86, 70);
          c.fillStyle = A.rgba('#7dffb0', 0.5); c.fillRect(x + 20, y - 190, 30, 6);
          sign(c, x + 55, y - 210, ['ZAP', 'BOO', 'RUN', 'EAT'][i], col, 18);
        }
        shade(c, w, h, 0.6, [{ x: w * 0.4, y: h * 0.45, r: w * 0.45, a: 0.6, tint: 'rgba(80,255,160,0.06)' }]);
      },
      spots: { lumi: [0.7, 0.85, 0.6] } },
    { id: '11', name: { fr: 'Salle des prix', en: 'Prize Room' }, map: [84, 40], light: 0.55,
      draw(c, w, h) {
        const r = persp(c, w, h, { wall: '#3a2030', back: '#2e1826', ceil: '#180c14', f1: '#5a2a40', f2: '#2a1020', seed: 69 });
        c.fillStyle = '#5a3a20'; c.fillRect(r.bx - 30, r.by + r.bh * 0.6, r.bw + 60, 18);
        for (let i = 0; i < 6; i++) A.vol(c, r.bx + 20 + i * 75, r.by + r.bh * 0.6 - 26, 22, 26, ['#ffb0d0', '#b0e0ff', '#ffe0a0'][i % 3]);
        // the music box
        const bx = w * 0.5, by = h * 0.86;
        c.fillStyle = '#6a2a4a'; c.fillRect(bx - 110, by - 110, 220, 110);
        c.fillStyle = '#8a3a5a'; c.fillRect(bx - 120, by - 130, 240, 24);
        c.strokeStyle = '#d9b23a'; c.lineWidth = 4; c.strokeRect(bx - 100, by - 100, 200, 90);
        sign(c, bx, by - 50, '♪', '#d9b23a', 40);
        shade(c, w, h, 0.6, [{ x: w * 0.5, y: h * 0.7, r: w * 0.4, a: 0.8, tint: 'rgba(255,180,220,0.1)' }]);
      },
      spots: { chime: [0.5, 0.78, 0.55] } },
    { id: '12', name: { fr: 'Coin des enfants', en: 'Kids’ Corner' }, map: [16, 40], light: 0.5,
      draw(c, w, h) {
        const r = persp(c, w, h, { wall: '#2a5a3a', back: '#22482e', ceil: '#122418', f1: '#e0d8c0', f2: '#3a6a4a', seed: 71 });
        for (let i = 0; i < 6; i++) kidDrawing(c, r.bx + 10 + i * 78, r.by + 30 + (i % 2) * 40, 64, 52, 80 + i);
        for (let i = 0; i < 8; i++) A.vol(c, w * 0.2 + i * 80, h * 0.92, 22, 22, ['#c22', '#26c', '#ca2', '#2a6'][i % 4]);
        shade(c, w, h, 0.62, [{ x: w * 0.5, y: h * 0.3, r: w * 0.45, a: 0.75 }]);
      },
      spots: { rico: [0.5, 0.84, 0.5] } },
  ];
  const ch2Links = [['09', '07'], ['08', '07'], ['10', '07'], ['12', '07'], ['11', '07'], ['07', '01'], ['07', '02'], ['01', '03'], ['02', '04'], ['03', '05'], ['04', '06'], ['12', '03'], ['10', '04']];

  function partyRoom(c, w, h, seed, col) {
    const r = persp(c, w, h, { wall: col, back: A.darken(col, 0.2), ceil: A.darken(col, 0.7), f1: '#d8d2c6', f2: A.darken(col, 0.4), band: A.darken(col, 0.5), band2: '#e8e0d0', seed });
    stars(c, r.bx, r.by - 10, r.bw, 10, seed);
    table(c, w * 0.3, h * 0.78, 120, '#f0e8e0', seed); table(c, w * 0.74, h * 0.8, 120, '#f0e8e0', seed + 1);
    const rr = A.rng(seed);
    for (let i = 0; i < 4; i++) { const bx = r.bx + rr() * r.bw, by = r.by + 30 + rr() * 60; A.vol(c, bx, by, 16, 21, ['#c22', '#26c', '#ca2', '#a3c'][i]); }
    shade(c, w, h, 0.62, [{ x: w * 0.5, y: h * 0.3, r: w * 0.45, a: 0.75 }]);
  }

  // ---------------------------------------------------------------- offices (1600 x 720 world)
  const OW = 1600, OH = 720;
  function office1(c) {
    const w = OW, h = OH;
    // back wall
    let g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1a1818'); g.addColorStop(0.55, '#2a2624'); g.addColorStop(1, '#141210');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // wall tiles upper
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 2;
    for (let y = 40; y < 420; y += 36) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    for (let y = 40, row = 0; y < 420; y += 36, row++) for (let x = (row % 2) * 30; x < w; x += 60) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 36); c.stroke(); }
    // checker band
    for (let i = 0; i < 54; i++) { c.fillStyle = i % 2 ? '#c9c0ae' : '#151313'; c.fillRect(i * 30, 420, 30, 24); c.fillStyle = i % 2 ? '#151313' : '#c9c0ae'; c.fillRect(i * 30, 444, 30, 24); }
    c.fillStyle = '#5a1010'; c.fillRect(0, 468, w, 20);
    // floor
    g = c.createLinearGradient(0, 600, 0, h); g.addColorStop(0, '#1a1816'); g.addColorStop(1, '#0a0908'); c.fillStyle = g; c.fillRect(0, 600, w, h - 600);
    // door frames
    for (const side of [0, 1]) {
      const x = side ? 1290 : 100;
      c.fillStyle = '#2b2e31'; c.fillRect(x - 26, 100, 262, 530);
      c.fillStyle = '#050505'; c.fillRect(x, 130, 210, 500);
      c.fillStyle = '#ffcc00'; for (let i = 0; i < 8; i++) { c.save(); c.beginPath(); c.rect(x - 26, 100, 262, 26); c.clip(); c.fillRect(x - 26 + i * 40, 100, 20, 26); c.restore(); }
      c.fillStyle = '#121212'; for (let i = 0; i < 8; i++) c.fillRect(x - 6 + i * 40, 100, 20, 26);
      // control panel beside the door (decor; the real buttons are on the HUD)
      const px = side ? x - 70 : x + 230;
      c.fillStyle = '#3a3d40'; c.fillRect(px, 300, 50, 120);
      A.ell(c, px + 25, 335, 15, 15, '#7a1010'); A.ell(c, px + 25, 385, 15, 15, '#d8d0b0');
    }
    // posters & drawings
    poster(c, 400, 70, 220, 300, { title: 'CÉLÉBREZ!', chars: ['gus', 'bruno', 'nora'], seed: 14, charH: 0.62 });
    kidDrawing(c, 660, 90, 110, 90, 3); kidDrawing(c, 700, 200, 100, 80, 5); kidDrawing(c, 790, 120, 90, 74, 7);
    poster(c, 930, 80, 130, 180, { title: 'KROK', chars: ['krok'], bg: '#1f3a1a', seed: 15, rot: 0.04, torn: true });
    kidDrawing(c, 1090, 100, 100, 82, 9); kidDrawing(c, 1100, 220, 88, 70, 11);
    scrawl(c, 1060, 330, 'ILS BOUGENT LA NUIT', 'rgba(150,20,20,0.5)', 14);
    // desk
    g = c.createLinearGradient(0, 500, 0, 720); g.addColorStop(0, '#4a3a2a'); g.addColorStop(1, '#1a120a');
    c.fillStyle = g; poly(c, [[360, 520], [1240, 520], [1300, 720], [300, 720]]);
    c.fillStyle = '#5a4632'; poly(c, [[360, 505], [1240, 505], [1240, 525], [360, 525]]);
    // monitors
    const mon = (x, y, w2, h2, txt) => {
      c.fillStyle = '#2a2a28'; A.roundRect(c, x, y, w2, h2, 10); c.fill();
      c.fillStyle = '#0a120c'; c.fillRect(x + 12, y + 12, w2 - 24, h2 - 30);
      if (txt) { c.fillStyle = 'rgba(110,255,140,0.55)'; c.font = '13px Courier New'; txt.forEach((t, i) => c.fillText(t, x + 20, y + 34 + i * 18)); }
    };
    mon(420, 360, 170, 150, ['> SYS OK', '> CAM 11/11', '> PORTES']);
    mon(600, 390, 120, 115, null);
    mon(1000, 370, 190, 140, ['GRIMWOOD SECURE', 'v1.987']);
    // phone, cup, plush
    c.fillStyle = '#2a2826'; A.roundRect(c, 480, 540, 140, 60, 8); c.fill();
    c.fillStyle = '#3a3836'; A.roundRect(c, 490, 528, 120, 26, 12); c.fill();
    for (let i = 0; i < 9; i++) c.fillRect(500 + (i % 3) * 24, 560 + Math.floor(i / 3) * 12, 18, 8);
    A.ell(c, 610, 575, 6, 6, '#ff3020');
    c.fillStyle = '#c9c0b0'; poly(c, [[380, 560], [420, 560], [414, 640], [386, 640]]); c.fillStyle = '#b11'; c.fillRect(384, 580, 34, 10); c.fillRect(386, 605, 30, 10);
    A.rod(c, 405, 560, 418, 510, 4, '#ddd');
    A.drawChar(c, 'bruno', 1150, 590, 90, { t: 2, light: 0.75, eyes: 0.2 });
    c.fillStyle = '#d8d0c0'; c.save(); c.translate(760, 590); c.rotate(0.08); c.fillRect(0, 0, 160, 90); c.fillStyle = '#555'; for (let i = 0; i < 6; i++) c.fillRect(12, 14 + i * 12, 120 - (i % 3) * 20, 3); c.restore();
    // fan base (blades are animated at runtime)
    c.fillStyle = '#1c1c1c'; c.fillRect(830, 470, 22, 50); A.ell(c, 841, 520, 50, 12, '#202020');
    A.grime(c, 0, 0, w, 470, 404, 90, '#000000', 0.25);
  }
  /** Door interior (hallway beyond a door), lit or dark. */
  function doorHall(c, w, h, lit, side) {
    const back = lit ? '#3a342c' : '#050505';
    persp(c, w, h, { bx: side ? w * 0.05 : w * 0.45, by: h * 0.25, bw: w * 0.5, bh: h * 0.45, wall: lit ? '#4a4038' : '#080808', back, ceil: lit ? '#201c18' : '#030303', band: lit ? '#151313' : '#050505', band2: lit ? '#a9a090' : '#060606', f1: lit ? '#b8b0a0' : '#0a0a0a', f2: lit ? '#1a1816' : '#050505', rows: 8, cols: 6, seed: side ? 5 : 6 });
    if (lit) shade(c, w, h, 0.35, [{ x: w / 2, y: h * 0.2, r: w * 0.9, a: 0.8, tint: 'rgba(255,230,170,0.18)' }]);
  }

  function office2(c) {
    const w = OW, h = OH;
    let g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1a1426'); g.addColorStop(0.6, '#2a2040'); g.addColorStop(1, '#0d0a14');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // stripes
    for (let i = 0; i < 40; i++) { c.fillStyle = i % 2 ? 'rgba(255,111,176,0.08)' : 'rgba(80,140,255,0.06)'; c.fillRect(i * 40, 0, 40, 460); }
    for (let i = 0; i < 54; i++) { c.fillStyle = i % 2 ? '#e8e0f0' : '#2a2a6a'; c.fillRect(i * 30, 460, 30, 22); }
    stars(c, 40, 30, w - 80, 40, 77);
    // hallway opening (interior drawn at runtime)
    c.fillStyle = '#3a3a4a'; c.fillRect(560, 110, 480, 26); c.fillRect(540, 110, 24, 470); c.fillRect(1036, 110, 24, 470);
    c.fillStyle = '#000'; c.fillRect(564, 136, 472, 444);
    // vents
    for (const side of [0, 1]) {
      const x = side ? 1250 : 150;
      c.fillStyle = '#4a4e56'; c.fillRect(x - 14, 420, 228, 176);
      c.fillStyle = '#000'; c.fillRect(x, 434, 200, 148);
      c.strokeStyle = '#2a2c30'; c.lineWidth = 3; for (let i = 1; i < 8; i++) { c.beginPath(); c.moveTo(x, 434 + i * 18.5); c.lineTo(x + 200, 434 + i * 18.5); c.stroke(); }
    }
    poster(c, 300, 90, 180, 250, { title: 'AMUSEZ-VOUS!', chars: ['pepper', 'rico'], bg: '#2a4f8a', seed: 33 });
    poster(c, 1120, 90, 160, 220, { title: 'LUMI', chars: ['lumi'], bg: '#8a2a6a', seed: 34, rot: 0.03 });
    // desk
    g = c.createLinearGradient(0, 560, 0, 720); g.addColorStop(0, '#5a5a6a'); g.addColorStop(1, '#1a1a22');
    c.fillStyle = g; poly(c, [[380, 590], [1220, 590], [1300, 720], [300, 720]]);
    A.drawChar(c, 'pepper', 430, 600, 70, { t: 1, light: 0.8, eyes: 0.1 });
    A.drawChar(c, 'rico', 1170, 600, 60, { t: 2, light: 0.8, eyes: 0.1 });
    c.fillStyle = '#1c1c22'; c.fillRect(1010, 540, 22, 50); A.ell(c, 1021, 592, 50, 12, '#202028');
    for (let i = 0; i < 30; i++) { const r = A.rng(i + 5); A.ell(c, 400 + r() * 800, 610 + r() * 100, 4, 2, ['#f6c', '#6cf', '#fc6'][i % 3]); }
    A.grime(c, 0, 0, w, 460, 505, 80, '#000', 0.2);
  }
  function hall2(c, w, h, lit) {
    hallway(c, w, h, { wall: lit ? '#4a3a6a' : '#06050a', ceil: lit ? '#1a1428' : '#030305', band: lit ? '#20203a' : '#050508', band2: lit ? '#e05a9a' : '#08060a', f1: lit ? '#c8c2d0' : '#08080a', f2: lit ? '#2a2a6a' : '#040406', seed: 91, depthW: 0.18, depthH: 0.22 });
    if (lit) shade(c, w, h, 0.25, [{ x: w / 2, y: h * 0.55, r: w * 0.6, a: 0.6, tint: 'rgba(255,250,220,0.12)' }]);
  }
  function vent2(c, w, h, lit) {
    ventTunnel(c, w, h, { metal: lit ? '#8a8f96' : '#141518' });
    if (lit) shade(c, w, h, 0.2, [{ x: w / 2, y: h / 2, r: w * 0.7, a: 0.6, tint: 'rgba(255,250,220,0.15)' }]);
  }

  /** Abandoned dining room used as the cinematic menu background. */
  function menuRoom(c, w, h) {
    const r = persp(c, w, h, { bx: w * 0.2, by: h * 0.18, bw: w * 0.6, bh: h * 0.5, wall: '#2a2422', back: '#1e1a18', ceil: '#121010', band: '#141414', band2: '#8a8070', seed: 1 });
    curtain(c, r.bx + r.bw * 0.15, r.by + 10, r.bw * 0.7, r.bh * 0.7, '#3a0a0e', 0.92);
    c.fillStyle = '#120c0a'; c.fillRect(r.bx + r.bw * 0.17, r.by + 12, r.bw * 0.66, r.bh * 0.66);
    stars(c, r.bx + 20, r.by + 20, r.bw - 40, 16, 3);
    table(c, w * 0.22, h * 0.85, w * 0.12, '#bdb6a8', 5); table(c, w * 0.8, h * 0.88, w * 0.13, '#bdb6a8', 6);
    poster(c, w * 0.04, h * 0.2, w * 0.1, w * 0.14, { title: 'GRIMWOOD', bg: '#5a1010', seed: 44, torn: true });
    shade(c, w, h, 0.7, [{ x: w * 0.5, y: h * 0.35, r: w * 0.4, a: 0.7, tint: 'rgba(255,180,120,0.06)' }]);
    return r;
  }

  // ---------------------------------------------------------------- cache & API
  const cache = {};
  function get(key, w, h, fn) {
    if (!cache[key]) { const cv = A.canvas(w, h); fn(cv.getContext('2d'), w, h); cache[key] = cv; }
    return cache[key];
  }
  FN.Rooms = {
    RW, RH, OW, OH,
    cams: { 1: ch1, 2: ch2 },
    links: { 1: ch1Links, 2: ch2Links },
    cam(ch, id) { return this.cams[ch].find((r) => r.id === id); },
    bg(ch, id) { const r = this.cam(ch, id); return get(`c${ch}_${id}`, RW, RH, (c, w, h) => r.draw(c, w, h)); },
    office(ch) { return get(`office${ch}`, OW, OH, ch === 1 ? office1 : office2); },
    doorHall(side, lit) { return get(`dh${side}${lit}`, 210, 500, (c, w, h) => doorHall(c, w, h, lit, side)); },
    hall2(lit) { return get(`h2${lit}`, 472, 444, (c, w, h) => hall2(c, w, h, lit)); },
    vent2(lit) { return get(`v2${lit}`, 200, 148, (c, w, h) => vent2(c, w, h, lit)); },
    menu(w, h) { return get(`menu${w}x${h}`, w, h, menuRoom); },
    prewarm(ch) { for (const r of this.cams[ch]) this.bg(ch, r.id); this.office(ch); },
    curtain,
  };
})(window.FN);
