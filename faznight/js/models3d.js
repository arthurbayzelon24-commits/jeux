/* FAZNIGHT — Animatronics master rebuild (original cast).
   Every character is assembled like a real show robot: separate shell parts over a mechanical
   endoskeleton (spine, ribs, pistons, axles, cables, gears, bolts), anatomical heads (skull, brow,
   cheeks, muzzle, upper and lower jaw, individual teeth, tongue, sockets, eyeballs, irises,
   pupils, blinking lids, ears), articulated hands with jointed fingers, and PBR materials
   (synthetic fur, aged metal, glossy plastic, rubber, fabric, chipped paint).
   Animations are procedural clips on that skeleton: idle, walk, run, look, attack, jumpscare,
   mouth, eyes (plus stage, peek, lean, float, slump, dance, cheer, tablet, flashlight). */
(function (FN) {
  const T = window.THREE;
  if (!T) return;
  const A = FN.Art;

  // ---------------------------------------------------------------- textures
  const cache = {};
  function ctex(key, w, h, draw, rep) {
    if (cache[key]) return cache[key];
    const c = A.canvas(w, h);
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    if (rep) t.repeat.set(rep[0], rep[1]);
    t.anisotropy = 4;
    cache[key] = t;
    return t;
  }
  /** Synthetic fur: thousands of short strands, matting, stains and dirt. */
  function furTex(seed, wear) {
    return ctex(`fur${seed}_${wear}`, 512, 512, (x, w, h) => {
      const r = A.rng(seed);
      x.fillStyle = '#d9d9d9'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 14000; i++) {
        const sx = r() * w, sy = r() * h, l = 3 + r() * 7, a = Math.PI / 2 + (r() - 0.5) * 0.9, v = 150 + r() * 105;
        x.strokeStyle = `rgba(${v},${v},${v},${0.35 + r() * 0.4})`; x.lineWidth = 0.6 + r() * 0.8;
        x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l); x.stroke();
      }
      for (let i = 0; i < 26 * wear + 4; i++) A.ell(x, r() * w, r() * h, 6 + r() * 30, 4 + r() * 18, `rgba(70,42,18,${0.08 + r() * 0.22 * wear})`, r() * 3);
      for (let i = 0; i < 14 * wear; i++) { const sx = r() * w, g = x.createLinearGradient(sx, 0, sx, h * 0.5); g.addColorStop(0, `rgba(60,35,12,${0.3 * wear})`); g.addColorStop(1, 'rgba(60,35,12,0)'); x.fillStyle = g; x.fillRect(sx, r() * h * 0.6, 2 + r() * 5, h * 0.4); }
      for (let i = 0; i < 40 * wear; i++) { x.strokeStyle = `rgba(30,18,8,${0.3 + r() * 0.4})`; x.lineWidth = 1 + r(); x.beginPath(); const sx = r() * w, sy = r() * h; x.moveTo(sx, sy); x.quadraticCurveTo(sx + (r() - 0.5) * 30, sy + 10, sx + (r() - 0.5) * 40, sy + r() * 40); x.stroke(); }
    }, [2, 2]);
  }
  /** Moulded plastic: smooth with fine scratches, scuffs and finger marks. */
  function plasticTex(seed) {
    return ctex('plastic' + seed, 256, 256, (x, w, h) => {
      const r = A.rng(seed);
      x.fillStyle = '#f2f2f2'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 160; i++) { x.strokeStyle = `rgba(120,120,120,${r() * 0.25})`; x.lineWidth = 0.5; x.beginPath(); const sx = r() * w, sy = r() * h; x.moveTo(sx, sy); x.lineTo(sx + (r() - 0.5) * 50, sy + (r() - 0.5) * 50); x.stroke(); }
      for (let i = 0; i < 14; i++) A.ell(x, r() * w, r() * h, 5 + r() * 16, 3 + r() * 10, `rgba(90,80,70,${0.05 + r() * 0.08})`, r() * 3);
    }, [1, 1]);
  }
  /** Aged metal: brushed streaks, oxidation patches and pitting. */
  function metalTex(seed, rust) {
    return ctex(`metal${seed}_${rust}`, 256, 256, (x, w, h) => {
      const r = A.rng(seed);
      x.fillStyle = '#c8c8c8'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 500; i++) { const v = 150 + r() * 100; x.fillStyle = `rgba(${v},${v},${v},0.35)`; x.fillRect(0, r() * h, w, 1); }
      for (let i = 0; i < 30 * rust; i++) A.ell(x, r() * w, r() * h, 4 + r() * 22, 3 + r() * 14, `rgba(${120 + r() * 40},${60 + r() * 20},${20},${0.2 + r() * 0.4})`, r() * 3);
      for (let i = 0; i < 400 * rust; i++) { x.fillStyle = `rgba(60,30,10,${r() * 0.6})`; x.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
    }, [1, 1]);
  }
  const fabricTex = (seed) => ctex('fabric' + seed, 128, 128, (x, w, h) => {
    x.fillStyle = '#d8d8d8'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 2) { x.fillStyle = i % 4 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'; x.fillRect(i, 0, 1, h); x.fillRect(0, i, w, 1); }
    A.grime(x, 0, 0, w, h, seed, 10, '#3a2a1a', 0.2);
  }, [4, 4]);
  const glowTex = () => ctex('glow', 64, 64, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });

  // ---------------------------------------------------------------- materials
  function materials(L, id) {
    const wear = Math.min(1, (L.rust ?? 0.4) + (L.damage || 0) * 0.4);
    const toy = L.finish === 'plastic';
    const fT = furTex(L.seed || 1, Math.round(wear * 10) / 10);
    const pT = plasticTex(L.seed || 1);
    const shell = (color, o = {}) => toy
      ? new T.MeshPhysicalMaterial(Object.assign({ color: new T.Color(color), map: pT, roughness: 0.28, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.22 }, o))
      : new T.MeshStandardMaterial(Object.assign({ color: new T.Color(color), map: fT, bumpMap: fT, bumpScale: 0.006, roughness: 0.95, metalness: 0 }, o));
    const mT = metalTex((L.seed || 1) + 5, Math.round(wear * 10) / 10);
    const M = {
      shell: shell(L.fur), shellDark: shell(A.darken(L.fur, 0.3)), belly: shell(L.belly || A.lighten(L.fur, 0.4)),
      accent: shell(L.accent || '#7a1010'),
      metal: new T.MeshStandardMaterial({ color: 0x9a9da2, map: mT, roughnessMap: mT, metalness: 0.88, roughness: 0.5 }),
      chrome: new T.MeshStandardMaterial({ color: 0xd8dde2, metalness: 1, roughness: 0.18 }),
      darkMetal: new T.MeshStandardMaterial({ color: 0x3a3d42, map: mT, metalness: 0.8, roughness: 0.55 }),
      brass: new T.MeshStandardMaterial({ color: 0xb08a3a, metalness: 0.9, roughness: 0.35 }),
      rubber: new T.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 }),
      cable: new T.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 }),
      cableRed: new T.MeshStandardMaterial({ color: 0x7a1010, roughness: 0.6 }),
      black: new T.MeshStandardMaterial({ color: 0x050404, roughness: 0.9 }),
      mouth: new T.MeshStandardMaterial({ color: 0x1a0606, roughness: 0.9 }),
      tongue: new T.MeshStandardMaterial({ color: 0x8a2a30, roughness: 0.5 }),
      teeth: new T.MeshStandardMaterial({ color: 0xe0d8c0, map: metalTex(7, 0.4), roughness: 0.35, metalness: 0.05 }),
      eyeball: new T.MeshPhysicalMaterial({ color: 0xc8c2b6, roughness: 0.12, clearcoat: 1 }),
      iris: new T.MeshStandardMaterial({ color: new T.Color(L.eye), emissive: new T.Color(L.eye), emissiveIntensity: 1.6, roughness: 0.25 }),
      pupil: new T.MeshStandardMaterial({ color: 0x020202, roughness: 0.2 }),
      fabric: new T.MeshStandardMaterial({ color: 0x1a1717, map: fabricTex(3), roughness: 1 }),
      paint: new T.MeshStandardMaterial({ color: new T.Color(L.accent || '#7a1010'), map: pT, roughness: 0.6 }),
      pale: new T.MeshPhysicalMaterial({ color: 0xefe8df, map: pT, roughness: 0.3, clearcoat: 0.6 }),
      pink: new T.MeshStandardMaterial({ color: 0xe05a78, roughness: 0.5 }),
      gold: new T.MeshStandardMaterial({ color: 0xc9a23a, metalness: 0.95, roughness: 0.3 }),
      glass: new T.MeshPhysicalMaterial({ color: new T.Color(L.fur), transparent: true, opacity: 0.72, roughness: 0.08, transmission: 0, clearcoat: 1, emissive: new T.Color(L.accent || L.fur), emissiveIntensity: 0.22 }),
    };
    for (const k of ['shell', 'shellDark', 'belly', 'accent', 'pale', 'glass', 'fabric']) M[k].userData.shell = true;
    if (L.kind === 'guard') { M.iris.emissive.setHex(0x000000); M.iris.emissiveIntensity = 0; }
    return M;
  }

  // ---------------------------------------------------------------- geometry kit
  const G = {
    sph: new T.SphereGeometry(1, 28, 20), sphLo: new T.SphereGeometry(1, 14, 10),
    cyl: new T.CylinderGeometry(1, 1, 1, 16), cylLo: new T.CylinderGeometry(1, 1, 1, 8),
    cone: new T.ConeGeometry(1, 1, 12), box: new T.BoxGeometry(1, 1, 1),
  };
  const geoCache = {};
  function lathe(key, pts, seg = 28, phiStart = 0, phiLen = Math.PI * 2) {
    const k = key + phiStart + phiLen;
    return geoCache[k] || (geoCache[k] = new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(Math.max(0.0005, r), y)), seg, phiStart, phiLen));
  }
  /** Tapered limb hanging down from 0 to -len (rounded ends). */
  function taperGeo(r1, r2, len) {
    const k = `tp${r1}_${r2}_${len}`;
    if (geoCache[k]) return geoCache[k];
    const pts = [];
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; pts.push([Math.sin(a) * r1, Math.cos(a) * r1 * 0.6]); }
    pts.push([(r1 + r2) / 2 * 1.06, -len * 0.45]);
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; pts.push([Math.cos(a) * r2, -len - Math.sin(a) * r2 * 0.6]); }
    pts.sort((a, b) => b[1] - a[1]);
    return (geoCache[k] = new T.LatheGeometry(pts.reverse().map(([r, y]) => new T.Vector2(Math.max(0.0005, r), y)), 20));
  }
  function rboxGeo(w, h, d, r) {
    const k = `rb${w}_${h}_${d}_${r}`;
    if (geoCache[k]) return geoCache[k];
    const s = new T.Shape(), x = -w / 2 + r, y = -h / 2 + r, W = w - 2 * r, H = h - 2 * r;
    s.moveTo(x, y - r); s.lineTo(x + W, y - r); s.quadraticCurveTo(x + W + r, y - r, x + W + r, y); s.lineTo(x + W + r, y + H); s.quadraticCurveTo(x + W + r, y + H + r, x + W, y + H + r);
    s.lineTo(x, y + H + r); s.quadraticCurveTo(x - r, y + H + r, x - r, y + H); s.lineTo(x - r, y); s.quadraticCurveTo(x - r, y - r, x, y - r);
    const g = new T.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.9, bevelSegments: 3, curveSegments: 6 });
    g.translate(0, 0, -(d - 2 * r) / 2);
    return (geoCache[k] = g);
  }
  function gearGeo(r, teeth, thick) {
    const k = `gear${r}_${teeth}_${thick}`;
    if (geoCache[k]) return geoCache[k];
    const s = new T.Shape();
    for (let i = 0; i < teeth * 2; i++) { const a = (i / (teeth * 2)) * Math.PI * 2, rr = i % 2 ? r * 0.82 : r; const a2 = a + Math.PI / teeth; if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); s.lineTo(Math.cos(a2 - 0.02) * rr, Math.sin(a2 - 0.02) * rr); }
    const hole = new T.Path(); hole.absarc(0, 0, r * 0.25, 0, Math.PI * 2, true); s.holes.push(hole);
    const g = new T.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 4 });
    g.translate(0, 0, -thick / 2);
    return (geoCache[k] = g);
  }
  function mk(g, m, sx = 1, sy = sx, sz = sx, x = 0, y = 0, z = 0, parent) {
    const o = new T.Mesh(g, m);
    o.scale.set(sx, sy, sz); o.position.set(x, y, z);
    o.castShadow = true;
    if (parent) parent.add(o);
    return o;
  }
  const ball = (m, rx, ry, rz, x, y, z, p) => mk(G.sph, m, rx, ry, rz, x, y, z, p);
  function piv(parent, x = 0, y = 0, z = 0) { const g = new T.Group(); g.position.set(x, y, z); parent.add(g); return g; }
  function cylAlong(m, r, a, b, parent) { const o = mk(G.cyl, m, r, 1, r, 0, 0, 0, parent); orient(o, a, b); return o; }
  const _v = new T.Vector3(), _up = new T.Vector3(0, 1, 0), _q = new T.Quaternion();
  function orient(o, a, b) {
    _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = _v.length();
    o.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    o.quaternion.setFromUnitVectors(_up, _v.normalize());
    o.scale.y = len;
  }
  function tube(pts, r, m, parent) {
    const o = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(...p))), 20, r, 6, false), m);
    o.castShadow = true; parent.add(o); return o;
  }
  function bolt(M, x, y, z, parent, s = 0.012) { const b = mk(G.cylLo, M.chrome, s, s * 0.6, s, x, y, z, parent); b.rotation.x = Math.PI / 2; return b; }
  function shell(o) { o.userData.shell = true; return o; }

  // ---------------------------------------------------------------- endoskeleton parts
  function spine(M, parent, y0, y1) {
    const n = 7;
    for (let i = 0; i < n; i++) { const y = y0 + ((y1 - y0) * i) / (n - 1); mk(G.cyl, M.darkMetal, 0.035, 0.035, 0.035, 0, y, -0.02, parent); mk(G.cyl, M.metal, 0.022, (y1 - y0) / n, 0.022, 0, y + (y1 - y0) / n / 2, -0.02, parent); }
  }
  function ribs(M, parent, y0, n, w) {
    for (let i = 0; i < n; i++) { const r = mk(new T.TorusGeometry(1, 0.06, 6, 20, Math.PI * 1.25), M.metal, w * (1 - Math.abs(i - n / 2) * 0.06), w * 0.75, w * 0.6, 0, y0 + i * 0.075, 0, parent); r.rotation.set(Math.PI / 2, 0, -Math.PI * 0.125 + Math.PI / 2); r.scale.z = 0.12; }
  }
  function joint(M, parent, r, axis = 'x') {
    const j = mk(G.cyl, M.darkMetal, r, r * 1.4, r, 0, 0, 0, parent);
    if (axis === 'x') j.rotation.z = Math.PI / 2;
    mk(G.cyl, M.chrome, r * 0.45, r * 1.7, r * 0.45, 0, 0, 0, j);
    return j;
  }
  /** Hydraulic piston between a point in `a` and a point in `b` (re-aimed each frame). */
  function piston(M, parts, a, pa, b, pb, r = 0.016) {
    const outer = mk(G.cyl, M.darkMetal, r, 1, r); const inner = mk(G.cyl, M.chrome, r * 0.55, 1, r * 0.55);
    a.add(outer); a.add(inner);
    parts.pistons.push({ outer, inner, a, pa: new T.Vector3(...pa), b, pb: new T.Vector3(...pb) });
  }

  // ---------------------------------------------------------------- hands
  function hand(M, parent, s, skin, opts = {}) {
    const wrist = piv(parent, 0, 0, 0);
    joint(M, wrist, 0.022);
    const palm = mk(rboxGeo(0.09, 0.1, 0.04, 0.014), skin, 1, 1, 1, 0, -0.07, 0, wrist);
    const fingers = [];
    const len = opts.long ? 0.05 : 0.036;
    for (let i = 0; i < 4; i++) {
      let p = piv(wrist, (i - 1.5) * 0.022, -0.12, 0.004);
      const segs = [];
      for (let k = 0; k < 3; k++) {
        const seg = piv(p, 0, k ? -len : 0, 0);
        mk(taperGeo(0.011, 0.009, len), k === 2 && opts.claw ? M.darkMetal : skin, 1, 1, 1, 0, 0, 0, seg);
        if (opts.endo) mk(G.sphLo, M.chrome, 0.007, 0.007, 0.007, 0, 0, 0, seg);
        segs.push(seg); p = seg;
      }
      fingers.push(segs);
    }
    let p = piv(wrist, s * -0.05, -0.06, 0.02); p.rotation.z = s * -0.7;
    const thumb = [];
    for (let k = 0; k < 2; k++) { const seg = piv(p, 0, k ? -0.035 : 0, 0); mk(taperGeo(0.012, 0.01, 0.035), skin, 1, 1, 1, 0, 0, 0, seg); thumb.push(seg); p = seg; }
    return { wrist, palm, fingers, thumb };
  }

  // ---------------------------------------------------------------- body
  function buildBody(id, L, M, P) {
    const bare = !!L.bare;
    const human = L.kind === 'guard';
    const S = (o) => (bare ? (o.visible = false, o) : shell(o));
    const bw = (L.bodyW || 1) * (human ? 0.82 : 1), bh = (L.bodyH || 1);
    const thin = L.torso === 'thin';
    const tw = thin ? 0.7 : 1;
    const dmg = L.damage || 0;
    const skinM = human ? M.skin : L.hand ? new T.MeshStandardMaterial({ color: new T.Color(L.hand), map: M.shell.map, roughness: 0.8 }) : M.shellDark;
    const shellM = human ? M.shirt : M.shell;

    const root = new T.Group();
    const body = piv(root);
    const pelvis = piv(body, 0, 1.0, 0);
    P.root = root; P.body = body; P.pelvis = pelvis;
    // pelvis shell + hip axle
    S(mk(lathe('pelvis' + tw, [[0, 0.1], [0.2 * tw, 0.1], [0.25 * tw, 0.02], [0.24 * tw, -0.08], [0.16 * tw, -0.15], [0, -0.16]]), human ? M.pants : shellM, bw, 1, 0.8, 0, 0, 0, pelvis));
    cylAlong(M.metal, 0.02, [-0.18, -0.05, 0], [0.18, -0.05, 0], pelvis);
    mk(gearGeo(0.05, 10, 0.015), M.brass, 1, 1, 1, 0, -0.02, -0.05, pelvis);
    // legs
    P.legs = [];
    if (L.legs === 'tentacles') {
      P.tentacles = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2; let p = piv(pelvis, Math.cos(a) * 0.14, 0.02, Math.sin(a) * 0.11);
        const segs = [];
        for (let k = 0; k < 6; k++) { const s = piv(p, 0, k ? -0.15 : 0, 0); mk(taperGeo(0.026 - k * 0.003, 0.022 - k * 0.003, 0.15), M.glass, 1, 1, 1, 0, 0, 0, s); segs.push(s); p = s; }
        P.tentacles.push(segs);
      }
    } else {
      for (const s of [-1, 1]) {
        const ballet = L.legs === 'ballet';
        const hip = piv(pelvis, s * 0.12 * bw, -0.07, 0);
        joint(M, hip, 0.035);
        const thR = ballet ? 0.05 : human ? 0.075 : 0.12;
        mk(G.cyl, M.metal, 0.02, 0.44, 0.02, 0, -0.22, 0, hip);
        const thigh = S(mk(taperGeo(thR, thR * 0.68, 0.42), human ? M.pants : shellM, 1, 1, 0.92, 0, -0.03, 0, hip));
        if (dmg > 0.5 && s > 0) thigh.visible = false;
        const knee = piv(hip, 0, -0.45, 0);
        joint(M, knee, 0.03);
        mk(G.cyl, M.metal, 0.018, 0.42, 0.018, 0, -0.21, 0, knee);
        const calf = S(mk(taperGeo(thR * 0.82, thR * 0.5, 0.38), human ? M.pants : L.legs === 'ballet' ? M.pale : M.shellDark, 1, 1, 0.92, 0, -0.03, 0, knee));
        if (dmg > 0.5 && s > 0) calf.visible = false;
        piston(M, P, hip, [0, -0.12, -0.06], knee, [0, -0.12, -0.05]);
        const ankle = piv(knee, 0, -0.43, 0);
        joint(M, ankle, 0.022);
        const shoe = mk(rboxGeo(ballet ? 0.06 : human ? 0.1 : 0.16, 0.09, ballet ? 0.12 : human ? 0.26 : 0.34, 0.035), human ? M.shoe : ballet ? M.pale : L.foot ? new T.MeshStandardMaterial({ color: new T.Color(L.foot), roughness: 0.8 }) : M.shellDark, 1, 1, 1, 0, -0.04, 0.06, ankle);
        if (!human && !ballet) { mk(rboxGeo(0.145, 0.02, 0.31, 0.008), M.rubber, 1, 1, 1, 0, -0.085, 0.06, ankle); S(shoe); }
        if (bare) shoe.material = M.metal, shoe.visible = true, shoe.scale.set(0.7, 0.6, 0.9);
        P.legs.push({ s, hip, knee, ankle });
      }
    }
    // torso
    const torso = piv(pelvis, 0, 0.1, 0);
    P.torso = torso;
    spine(M, torso, -0.05, 0.62);
    ribs(M, torso, 0.18, 5, 0.2 * bw * tw);
    mk(gearGeo(0.06, 12, 0.02), M.brass, 1, 1, 1, 0.05, 0.3, -0.06, torso);
    mk(gearGeo(0.04, 9, 0.02), M.darkMetal, 1, 1, 1, -0.04, 0.38, -0.06, torso);
    const prof = [[0, -0.02], [0.2, 0], [0.23, 0.12], [0.28, 0.3], [0.31, 0.45], [0.29, 0.55], [0.18, 0.63], [0.07, 0.66], [0, 0.66]].map(([r, y]) => [r * tw, y * bh]);
    const back = S(mk(lathe('torsoB' + tw + bh, prof, 28, Math.PI * 0.6, Math.PI * 1.4 - 0.01), human ? M.shirt : shellM, bw, 1, 0.78, 0, 0, 0, torso));
    back.rotation.y = 0; back.material = back.material; back.material.side = T.DoubleSide;
    const front = S(mk(lathe('torsoF' + tw + bh, prof.map(([r, y]) => [r * 1.01, y]), 20, -Math.PI * 0.4, Math.PI * 1.0), human ? M.shirt : shellM, bw, 1, 0.78, 0, 0, 0, torso));
    P.chestPlate = front;
    if (dmg >= 0.5) front.visible = false; // exposed ribs & spine
    if (!human && !thin && !bare && !L.vest) for (const s of [-1, 1]) { const pc = S(ball(shellM, 0.13 * bw, 0.1 * bh, 0.07, s * 0.13 * bw, 0.5 * bh, 0.2 * 0.78 * bw, torso)); pc.rotation.z = s * 0.2; if (dmg >= 0.5 && s < 0) pc.visible = false; }
    if (!human && !thin && !bare && L.torso !== 'suit') { const b = S(ball(M.belly, 0.2 * tw * bw, 0.22 * bh, 0.07, 0, 0.26 * bh, 0.205 * 0.78 * bw + 0.02, torso)); if (dmg >= 0.5) b.visible = false; }
    if (L.tutu) for (let i = 0; i < 3; i++) shell(mk(new T.CylinderGeometry(0.2 - i * 0.03, 0.45 - i * 0.07, 0.06, 28, 1, true), new T.MeshStandardMaterial({ color: new T.Color(i % 2 ? L.tutu : A.lighten(L.tutu, 0.2)), side: T.DoubleSide, roughness: 0.8, map: fabricTex(9) }), 1, 1, 1, 0, -0.02 + i * 0.035, 0, torso));
    if (L.bib) {
      const bibT = ctex('bib' + L.bib, 256, 256, (x) => { x.fillStyle = '#ebe5d4'; x.fillRect(0, 0, 256, 256); A.grime(x, 0, 0, 256, 256, 3, 20, '#3a2410', 0.3); x.fillStyle = '#7a1414'; x.font = 'bold 64px Georgia'; x.textAlign = 'center'; x.fillText(L.bib, 128, 150); });
      shell(mk(new T.PlaneGeometry(0.34, 0.3), new T.MeshStandardMaterial({ map: bibT, roughness: 0.95, side: T.DoubleSide }), 1, 1, 1, 0, 0.33, 0.29 * 0.78 * bw * tw + 0.035, torso)).rotation.x = -0.12;
    }
    if (L.vest) { const vm = new T.MeshStandardMaterial({ color: new T.Color(L.vest), map: fabricTex(5), roughness: 0.95 }); for (const s of [-1, 1]) { const v = shell(mk(lathe('vest', prof.map(([r, y]) => [r * 1.04, y])), vm, bw, 1, 0.8, 0, 0, 0, torso)); v.geometry = lathe('vest' + s, prof.map(([r, y]) => [r * 1.04, y]), 12, s > 0 ? Math.PI * 0.08 : Math.PI * 1.37, Math.PI * 0.55); } for (let i = 0; i < 3; i++) mk(G.sphLo, M.brass, 0.012, 0.012, 0.008, -0.07, 0.12 + i * 0.12, 0.25 * bw * tw, torso); }
    if (L.torso === 'suit') { mk(new T.PlaneGeometry(0.1, 0.36), M.pale, 1, 1, 1, 0, 0.4, 0.24 * bw + 0.005, torso); mk(rboxGeo(0.05, 0.26, 0.015, 0.005), M.accent, 1, 1, 1, 0, 0.38, 0.25 * bw + 0.01, torso); }
    if (dmg > 0) {
      const r = A.rng(L.seed || 3);
      for (let i = 0; i < 4 + dmg * 4; i++) tube([[(r() - 0.5) * 0.3, 0.2 + r() * 0.3, 0.1], [(r() - 0.5) * 0.5, 0.1 + r() * 0.3, 0.25], [(r() - 0.5) * 0.4, -0.1 - r() * 0.2, 0.2 + r() * 0.1]], 0.006, i % 3 ? M.cable : M.cableRed, torso);
    }
    if (L.tail === 'ringed') { const tp = piv(pelvis, 0, 0, -0.18); P.tail = tp; for (let i = 0; i < 7; i++) S(ball(i % 2 ? M.black : shellM, 0.07 - i * 0.004, 0.065, 0.08, 0, 0.05 + i * 0.06, -0.05 - i * 0.05, tp)); }
    if (L.tail === 'croc') { const tp = piv(pelvis, 0, -0.05, -0.18); P.tail = tp; S(mk(taperGeo(0.12, 0.03, 0.7), M.shellDark, 1, 1, 0.7, 0, 0, 0, tp)).rotation.x = 2.0; }

    // arms
    P.arms = [];
    for (const s of [-1, 1]) {
      const sh = piv(torso, s * 0.34 * bw * tw, 0.52 * bh, 0);
      joint(M, sh, 0.04);
      mk(gearGeo(0.035, 8, 0.012), M.brass, 1, 1, 1, s * 0.03, 0, 0, sh).rotation.y = Math.PI / 2;
      S(ball(shellM, 0.11 * tw, 0.1, 0.1, s * 0.02, -0.02, 0, sh));
      mk(G.cyl, M.metal, 0.016, 0.32, 0.016, 0, -0.16, 0, sh);
      const bareArm = (dmg > 0.6 && s < 0) || bare;
      const up = S(mk(taperGeo(0.088 * tw, 0.058 * tw, 0.3), human ? M.shirt : shellM, 1, 1, 0.95, 0, -0.04, 0, sh));
      if (bareArm) up.visible = false;
      const el = piv(sh, 0, -0.33, 0);
      joint(M, el, 0.026);
      mk(G.cyl, M.metal, 0.014, 0.28, 0.014, 0, -0.14, 0, el);
      const fo = S(mk(taperGeo(0.072 * tw, 0.046 * tw, 0.27), human ? M.shirt : M.shellDark, 1, 1, 0.95, 0, -0.03, 0, el));
      if (bareArm) fo.visible = false;
      piston(M, P, sh, [0, -0.1, 0.05], el, [0, -0.1, 0.045], 0.012);
      const wr = piv(el, 0, -0.3, 0);
      const hd = hand(M, wr, s, bareArm ? M.metal : skinM, { endo: bareArm, claw: !!L.claws });
      P.arms.push({ s, sh, el, wr, hand: hd });
    }
    // neck
    const neck = piv(torso, 0, 0.64 * bh, 0);
    P.neck = neck;
    mk(G.cyl, M.metal, 0.035, 0.14, 0.035, 0, 0.07, 0, neck);
    for (let i = 0; i < 3; i++) mk(G.cyl, M.darkMetal, 0.05, 0.015, 0.05, 0, 0.03 + i * 0.04, 0, neck);
    tube([[0.04, 0, -0.02], [0.07, 0.06, -0.04], [0.03, 0.14, -0.03]], 0.006, M.cableRed, neck);
    tube([[-0.04, 0, -0.02], [-0.07, 0.07, -0.03], [-0.03, 0.14, -0.02]], 0.006, M.cable, neck);
    if (human) shell(mk(G.cyl, M.skin, 0.055, 0.12, 0.055, 0, 0.06, 0, neck));
    const head = piv(neck, 0, 0.1, 0);
    P.head = head;
    if (L.bow) { const bm = new T.MeshStandardMaterial({ color: new T.Color(L.bow), map: fabricTex(4), roughness: 0.85 }); for (const s of [-1, 1]) shell(ball(bm, 0.07, 0.045, 0.03, s * 0.065, 0.62 * bh, 0.2 * bw * tw, torso)).rotation.z = s * 0.25; shell(ball(bm, 0.025, 0.025, 0.025, 0, 0.62 * bh, 0.215 * bw * tw, torso)); }
    if (L.wires) for (let i = 0; i < L.wires; i++) { const s = i % 2 ? 1 : -1; tube([[s * 0.06, 0.12, -0.08], [s * (0.24 + i * 0.03), 0.05 - i * 0.05, -0.02], [s * (0.18 + i * 0.03), -0.2 - i * 0.06, 0.04]], 0.005, i % 2 ? M.cable : M.cableRed, neck); }
    return { root, head, torso, shellM, skinM };
  }

  // ---------------------------------------------------------------- face parts
  function eyes(M, P, head, o) {
    const L = o.L;
    P.eyes = P.eyes || [];
    for (const s of [-1, 1]) {
      const missing = (L.damage || 0) > 0.5 && s < 0 && L.loseEye !== false;
      const g = piv(head, s * o.x, o.y, o.z);
      ball(M.black, o.r * 1.3, o.r * 1.3 * (o.ry || 1), o.r * 0.8, 0, 0, -o.r * 0.25, g); // socket
      if (missing) { const led = ball(new T.MeshBasicMaterial({ color: 0xff2010 }), o.r * 0.12, o.r * 0.12, o.r * 0.12, 0, 0, o.r * 0.3, g); P.eyes.push({ g, s, led, missing: true }); continue; }
      const eye = piv(g, 0, 0, 0);
      if (L.eyeWhite !== false) ball(M.eyeball, o.r, o.r * (o.ry || 1), o.r * 0.95, 0, 0, 0, eye);
      const iris = ball(M.iris, o.r * 0.5, o.r * 0.5 * (o.ry || 1), o.r * 0.18, 0, 0, o.r * 0.88, eye);
      ball(M.pupil, o.r * 0.2, o.r * 0.24 * (o.ry || 1), o.r * 0.08, 0, 0, o.r * 0.98, eye);
      // wet specular highlight so the eyes read as glass, not paint
      ball(new T.MeshBasicMaterial({ color: 0xffffff }), o.r * 0.09, o.r * 0.09, o.r * 0.03, -o.r * 0.22, o.r * 0.24, o.r * 1.0, eye);
      const sp = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: new T.Color(L.eye), blending: T.AdditiveBlending, depthWrite: false, transparent: true }));
      sp.scale.set(o.r * 4.5, o.r * 4.5, 1); sp.position.set(0, 0, o.r * 1.2); eye.add(sp);
      // eyelids: upper and lower half-shells that close for blinks
      const lidM = o.lidM || M.shellDark;
      const up = piv(g, 0, 0, 0), lo = piv(g, 0, 0, 0);
      mk(new T.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), lidM, o.r * 1.12, o.r * 1.12 * (o.ry || 1), o.r * 1.08, 0, 0, 0, up).rotation.x = -0.1;
      mk(new T.SphereGeometry(1, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), lidM, o.r * 1.1, o.r * 1.1 * (o.ry || 1), o.r * 1.06, 0, 0, 0, lo);
      if (o.brow !== false) { const br = mk(rboxGeo(o.r * 2.2, o.r * 0.35, o.r * 0.5, o.r * 0.12), o.browM || M.shellDark, 1, 1, 1, 0, o.r * 1.35, o.r * 0.35, g); br.rotation.z = s * -0.18; P.brows = P.brows || []; P.brows.push({ o: br, s }); }
      P.eyes.push({ g, eye, iris, sp, up, lo, s, rest: o.lidRest ?? 0.35 });
    }
  }
  /** Upper teeth fixed to the skull, lower jaw on a hinge with its own teeth and tongue. */
  function mouth(M, P, head, o) {
    const { y, z, w, d } = o;
    // upper teeth row
    const n = o.teeth || 8;
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1) - 0.5) * (o.arc || 2.0), tx = Math.sin(a) * w * 0.5, tz = z + Math.cos(a) * d * 0.5 - d * 0.1;
      if (o.sharp) { const t = mk(G.cone, M.teeth, 0.011, 0.035, 0.011, tx, y - 0.012, tz, head); t.rotation.x = Math.PI; }
      else mk(rboxGeo(w * 0.1, 0.03, 0.015, 0.004), M.teeth, 1, 1, 1, tx, y - 0.01, tz, head).rotation.y = -a;
    }
    const jaw = piv(head, 0, y, z - d * 0.45);
    P.jaw = jaw;
    mk(G.sph, M.mouth, w * 0.48, 0.05, d * 0.5, 0, -0.03, d * 0.45, jaw); // mouth cavity
    S2(mk(G.sph, o.lowerM || M.shell, w * 0.55, 0.055, d * 0.58, 0, -0.06, d * 0.45, jaw));
    if (o.tongue !== false) mk(G.sph, M.tongue, w * 0.28, 0.018, d * 0.32, 0, -0.03, d * 0.4, jaw);
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1) - 0.5) * (o.arc || 2.0), tx = Math.sin(a) * w * 0.46, tz = d * 0.45 + Math.cos(a) * d * 0.46;
      if (o.sharp) mk(G.cone, M.teeth, 0.01, 0.032, 0.01, tx, -0.005, tz, jaw);
      else mk(rboxGeo(w * 0.09, 0.028, 0.014, 0.004), M.teeth, 1, 1, 1, tx, -0.005, tz, jaw).rotation.y = -a;
    }
    // jaw hinge mechanics
    for (const s of [-1, 1]) { const h = mk(G.cyl, M.darkMetal, 0.018, 0.03, 0.018, s * w * 0.52, 0, 0, jaw); h.rotation.z = Math.PI / 2; bolt(M, s * w * 0.55, 0, 0, jaw); }
    return jaw;
  }
  const S2 = shell;
  function ear(M, head, x, y, z, kind, s, mat, P, torn) {
    const p = piv(head, x, y, z);
    if (kind === 'round') { S2(mk(G.cyl, mat, 0.065, 0.03, 0.065, 0, 0, 0, p)).rotation.x = Math.PI / 2; mk(G.cyl, M.belly, 0.04, 0.032, 0.04, 0, 0, 0.003, p).rotation.x = Math.PI / 2; }
    if (kind === 'pointy') { const c = S2(mk(G.cone, mat, 0.06, 0.16, 0.025, 0, 0.07, 0, p)); c.rotation.z = -s * 0.2; if (torn) c.scale.y = 0.6; mk(G.cone, M.belly, 0.035, 0.11, 0.015, 0, 0.06, 0.012, p); }
    if (kind === 'flop') { const c = S2(mk(taperGeo(0.03, 0.04, 0.16), mat, 1, 1, 0.45, 0, 0, 0, p)); c.rotation.z = s * 1.7; }
    mk(G.cyl, M.darkMetal, 0.012, 0.04, 0.012, 0, -0.02, 0, p);
    P.ears = P.ears || []; P.ears.push({ p, s });
    return p;
  }

  // ---------------------------------------------------------------- head kits
  function buildHead(L, M, P, head) {
    const k = L.kind;
    const big = L.kind === 'guard' ? 0.92 : 1.32;
    const hw = ((L.head?.rx || 80) / 80) * 0.22 * big, hh = ((L.head?.ry || 70) / 70) * 0.2 * big;
    const cy = hh * 0.95; // head centre above the neck
    const H = piv(head, 0, cy, 0);
    P.skull = H; P.hw = hw; P.hh = hh;
    // metal skull under every shell (visible in x-ray / when damaged)
    const endoSkull = ball(M.metal, hw * 0.82, hh * 0.82, hw * 0.78, 0, 0, 0, H);
    endoSkull.userData.endo = true;
    const sh = (m, rx, ry, rz, x, y, z) => S2(ball(m, rx, ry, rz, x, y, z, H));
    if (k === 'badger') {
      sh(M.shell, hw, hh, hw * 0.92, 0, 0, 0); // cranium
      sh(M.shell, hw * 0.75, hh * 0.35, hw * 0.6, 0, hh * 0.45, hw * 0.25); // forehead
      for (const s of [-1, 1]) { sh(M.shell, hw * 0.42, hh * 0.4, hw * 0.4, s * hw * 0.55, -hh * 0.35, hw * 0.45); sh(M.black, hw * 0.28, hh * 0.55, hw * 0.12, s * hw * 0.42, 0.0, hw * 0.78).rotation.z = s * 0.3; ear(M, H, s * hw * 0.78, hh * 0.78, -hw * 0.1, 'round', s, M.shellDark, P); }
      sh(new T.MeshStandardMaterial({ color: new T.Color(L.stripe), map: M.shell.map, roughness: 0.95 }), hw * 0.13, hh * 0.6, hw * 0.12, 0, hh * 0.45, hw * 0.75);
      sh(M.belly, hw * 0.52, hh * 0.32, hw * 0.55, 0, -hh * 0.42, hw * 0.62); // muzzle
      sh(M.black, 0.045, 0.032, 0.035, 0, -hh * 0.2, hw * 1.12); // nose
      eyes(M, P, H, { L, x: hw * 0.4, y: hh * 0.08, z: hw * 0.7, r: hw * 0.16 });
      mouth(M, P, H, { y: -hh * 0.6, z: hw * 0.55, w: hw * 0.85, d: hw * 0.6, lowerM: M.belly });
      if (L.hat) { const hm = new T.MeshStandardMaterial({ color: 0x141212, map: fabricTex(6), roughness: 0.9 }); const hat = piv(H, 0, hh * 0.92, -0.02); hat.rotation.z = 0.08; S2(mk(G.cyl, hm, hw * 0.7, 0.015, hw * 0.7, 0, 0, 0, hat)); S2(mk(lathe('hat', [[0, 0], [hw * 0.42, 0], [hw * 0.4, 0.16], [hw * 0.42, 0.17], [0, 0.17]]), hm, 1, 1, 1, 0, 0, 0, hat)); mk(G.cyl, M.paint, hw * 0.425, 0.035, hw * 0.425, 0, 0.03, 0, hat); }
    } else if (k === 'goat') {
      sh(M.shell, hw * 0.9, hh * 1.05, hw * 0.9, 0, 0, 0);
      sh(M.shell, hw * 0.55, hh * 0.65, hw * 0.65, 0, -hh * 0.5, hw * 0.55); // long muzzle
      sh(M.belly, hw * 0.45, hh * 0.3, hw * 0.5, 0, -hh * 0.75, hw * 0.75);
      for (const s of [-1, 1]) {
        sh(M.black, 0.018, 0.026, 0.012, s * 0.035, -hh * 0.62, hw * 1.2);
        const hornM = new T.MeshStandardMaterial({ color: new T.Color(L.horn), map: metalTex(31, 0.3), bumpMap: metalTex(31, 0.3), bumpScale: 0.01, roughness: 0.6 });
        const pts = []; for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI * 1.5; pts.push([s * (hw * 0.35 + Math.sin(a) * 0.12 + i * 0.012), hh * 0.8 + Math.cos(a) * 0.1 + 0.05, -0.04 - Math.sin(a * 0.5) * 0.12]); }
        S2(tube(pts, 0.028, hornM, H));
        ear(M, H, s * hw * 0.95, hh * 0.25, -0.02, 'flop', s, M.shellDark, P);
        sh(M.shell, hw * 0.3, hh * 0.3, hw * 0.3, s * hw * 0.5, -hh * 0.2, hw * 0.45);
      }
      const beard = S2(mk(G.cone, M.belly, 0.05, 0.14, 0.035, 0, -hh * 1.15, hw * 0.65, H)); beard.rotation.x = Math.PI;
      eyes(M, P, H, { L, x: hw * 0.46, y: hh * 0.15, z: hw * 0.66, r: hw * 0.16, ry: 0.75 });
      mouth(M, P, H, { y: -hh * 0.92, z: hw * 0.72, w: hw * 0.6, d: hw * 0.5, lowerM: M.belly });
    } else if (k === 'owl') {
      sh(M.shell, hw, hh, hw * 0.85, 0, 0, 0);
      for (const s of [-1, 1]) {
        const disc = sh(M.belly, hw * 0.46, hh * 0.52, hw * 0.12, s * hw * 0.42, hh * 0.02, hw * 0.72);
        const tuft = S2(mk(G.cone, M.shellDark, 0.05, 0.16, 0.03, s * hw * 0.72, hh * 1.0, 0, H)); tuft.rotation.z = -s * 0.45;
        sh(M.shell, hw * 0.3, hh * 0.25, hw * 0.3, s * hw * 0.6, -hh * 0.6, hw * 0.4);
      }
      eyes(M, P, H, { L, x: hw * 0.42, y: hh * 0.04, z: hw * 0.82, r: hw * 0.22, lidM: M.shell, brow: true });
      const beakM = new T.MeshStandardMaterial({ color: new T.Color(L.accent), map: plasticTex(3), roughness: 0.45 });
      const up = mk(G.cone, beakM, 0.045, 0.12, 0.04, 0, -hh * 0.2, hw * 1.0, H); up.rotation.x = Math.PI * 0.78;
      const jaw = piv(H, 0, -hh * 0.38, hw * 0.85); P.jaw = jaw;
      const lo = mk(G.cone, beakM, 0.038, 0.08, 0.03, 0, -0.01, 0.06, jaw); lo.rotation.x = Math.PI * 0.7;
      mk(G.sph, M.mouth, 0.03, 0.012, 0.04, 0, 0.005, 0.03, jaw);
      for (let i = 0; i < 5; i++) mk(G.cone, M.teeth, 0.006, 0.018, 0.006, (i - 2) * 0.012, 0.012, 0.06 - Math.abs(i - 2) * 0.008, jaw);
      for (let i = 0; i < 5; i++) { const t = mk(G.cone, M.teeth, 0.006, 0.018, 0.006, (i - 2) * 0.012, -hh * 0.3, hw * 0.95 - Math.abs(i - 2) * 0.008, H); t.rotation.x = Math.PI; }
    } else if (k === 'croc') {
      sh(M.shell, hw * 0.85, hh * 0.75, hw * 0.85, 0, hh * 0.1, -0.02);
      for (const s of [-1, 1]) sh(M.shellDark, hw * 0.25, hh * 0.22, hw * 0.25, s * hw * 0.42, hh * 0.62, hw * 0.25);
      for (let i = 0; i < 12; i++) sh(M.shellDark, 0.025, 0.012, 0.025, ((i % 4) - 1.5) * 0.06, hh * 0.55 - Math.floor(i / 4) * 0.06, hw * 0.55 + Math.floor(i / 4) * 0.08);
      if (L.cap) { const cm = new T.MeshStandardMaterial({ color: new T.Color(L.cap), map: fabricTex(8), roughness: 0.95 }); S2(ball(cm, hw * 0.5, 0.06, hw * 0.5, 0, hh * 0.82, -0.02, H)); S2(mk(G.cyl, cm, hw * 0.55, 0.012, hw * 0.55, 0, hh * 0.78, 0.03, H)); }
      eyes(M, P, H, { L, x: hw * 0.42, y: hh * 0.65, z: hw * 0.42, r: hw * 0.12, ry: 0.65 });
      // long upper snout with a row of teeth on each side
      sh(M.shell, hw * 0.75, hh * 0.28, hw * 1.05, 0, -hh * 0.18, hw * 0.85);
      for (const s of [-1, 1]) sh(M.shellDark, 0.02, 0.015, 0.02, s * 0.05, hh * 0.05, hw * 1.82);
      for (const s of [-1, 1]) for (let i = 0; i < 8; i++) { const t = mk(G.cone, M.teeth, 0.011, 0.04, 0.011, s * hw * 0.62 * (1 - i * 0.05), -hh * 0.42, hw * 0.2 + i * hw * 0.2, H); t.rotation.x = Math.PI; }
      const jaw = piv(H, 0, -hh * 0.4, 0); P.jaw = jaw;
      S2(mk(G.sph, M.shellDark, hw * 0.7, hh * 0.16, hw * 1.0, 0, -0.04, hw * 0.85, jaw));
      mk(G.sph, M.mouth, hw * 0.6, 0.02, hw * 0.9, 0, 0.0, hw * 0.85, jaw);
      mk(G.sph, M.tongue, hw * 0.3, 0.012, hw * 0.5, 0, 0.012, hw * 0.75, jaw);
      for (const s of [-1, 1]) for (let i = 0; i < 8; i++) mk(G.cone, M.teeth, 0.01, 0.035, 0.01, s * hw * 0.56 * (1 - i * 0.05), 0.02, hw * 0.2 + i * hw * 0.2, jaw);
      for (const s of [-1, 1]) { const h = mk(G.cyl, M.darkMetal, 0.022, 0.04, 0.022, s * hw * 0.72, 0, 0, jaw); h.rotation.z = Math.PI / 2; }
    } else if (k === 'panda') {
      sh(M.shell, hw, hh, hw * 0.92, 0, 0, 0);
      for (const s of [-1, 1]) { ear(M, H, s * hw * 0.75, hh * 0.78, -0.02, 'round', s, M.black, P); sh(M.black, hw * 0.24, hh * 0.34, hw * 0.1, s * hw * 0.4, 0.0, hw * 0.78).rotation.z = -s * 0.5; sh(M.pink, hw * 0.14, hh * 0.09, 0.012, s * hw * 0.6, -hh * 0.35, hw * 0.76); sh(M.shell, hw * 0.36, hh * 0.32, hw * 0.35, s * hw * 0.5, -hh * 0.35, hw * 0.45); }
      sh(M.belly, hw * 0.45, hh * 0.3, hw * 0.48, 0, -hh * 0.45, hw * 0.62);
      sh(M.black, 0.04, 0.028, 0.03, 0, -hh * 0.22, hw * 1.08);
      eyes(M, P, H, { L, x: hw * 0.4, y: 0.01, z: hw * 0.84, r: hw * 0.13, lidM: M.black });
      mouth(M, P, H, { y: -hh * 0.62, z: hw * 0.62, w: hw * 0.7, d: hw * 0.5, lowerM: M.belly });
    } else if (k === 'raccoon') {
      sh(M.shell, hw, hh * 0.95, hw * 0.9, 0, 0, 0);
      for (const s of [-1, 1]) { ear(M, H, s * hw * 0.6, hh * 0.85, -0.03, 'pointy', s, M.shellDark, P, s > 0 && (L.damage || 0) > 0); sh(M.shell, hw * 0.38, hh * 0.3, hw * 0.36, s * hw * 0.5, -hh * 0.35, hw * 0.45); }
      sh(M.black, hw * 0.95, hh * 0.26, hw * 0.35, 0, hh * 0.08, hw * 0.62);
      sh(M.belly, hw * 0.42, hh * 0.32, hw * 0.65, 0, -hh * 0.42, hw * 0.62);
      sh(M.black, 0.035, 0.028, 0.03, 0, -hh * 0.25, hw * 1.25);
      eyes(M, P, H, { L, x: hw * 0.42, y: hh * 0.08, z: hw * 0.85, r: hw * 0.14, lidM: M.black });
      mouth(M, P, H, { y: -hh * 0.62, z: hw * 0.75, w: hw * 0.55, d: hw * 0.55, lowerM: M.belly, sharp: true });
    } else if (k === 'jelly') {
      const bell = S2(mk(new T.SphereGeometry(1, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.55), M.glass, hw * 1.25, hh * 1.2, hw * 1.25, 0, hh * 0.1, 0, H)); P.bell = bell;
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; S2(ball(M.glass, 0.05, 0.03, 0.05, Math.cos(a) * hw * 1.12, -hh * 0.18, Math.sin(a) * hw * 1.12, H)); }
      sh(M.pale, hw * 0.55, hh * 0.62, hw * 0.45, 0, -hh * 0.25, hw * 0.45);
      for (const s of [-1, 1]) sh(M.pink, 0.035, 0.022, 0.01, s * hw * 0.32, -hh * 0.45, hw * 0.86);
      eyes(M, P, H, { L, x: hw * 0.24, y: -hh * 0.15, z: hw * 0.82, r: hw * 0.11, lidM: M.pale, brow: false });
      mouth(M, P, H, { y: -hh * 0.68, z: hw * 0.68, w: hw * 0.4, d: hw * 0.3, lowerM: M.pale, sharp: true, tongue: false, teeth: 7 });
    } else if (k === 'doll') {
      sh(M.pale, hw * 0.9, hh, hw * 0.88, 0, 0, 0);
      const hair = new T.MeshStandardMaterial({ color: 0x2a1b1b, map: furTex(91, 0.2), roughness: 0.8 });
      S2(mk(new T.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hair, hw * 0.94, hh * 1.02, hw * 0.92, 0, 0.01, -0.01, H));
      S2(ball(hair, 0.07, 0.06, 0.06, 0, hh * 1.05, -0.04, H));
      for (let i = 0; i < 5; i++) mk(G.cone, M.gold, 0.012, 0.05, 0.012, (i - 2) * 0.03, hh * 0.98 + (i % 2 ? 0.03 : 0.01), 0.04, H);
      for (const s of [-1, 1]) { sh(M.pink, 0.04, 0.025, 0.01, s * hw * 0.48, -hh * 0.3, hw * 0.78); mk(G.box, M.black, 0.004, hh * 0.65, 0.003, s * hw * 0.38, -hh * 0.4, hw * 0.84, H); }
      eyes(M, P, H, { L, x: hw * 0.34, y: 0.01, z: hw * 0.76, r: hw * 0.15, lidM: M.pale, brow: true, browM: hair });
      mouth(M, P, H, { y: -hh * 0.55, z: hw * 0.62, w: hw * 0.35, d: hw * 0.3, lowerM: M.pale, tongue: false, teeth: 6 });
    } else if (k === 'tv') {
      const caseM = new T.MeshStandardMaterial({ color: 0x4a3a2a, map: metalTex(51, 0.5), roughness: 0.6 });
      S2(mk(rboxGeo(hw * 2, hh * 1.9, hw * 1.5, 0.03), caseM, 1, 1, 1, 0, 0, 0, H));
      const sc = A.canvas(128, 112); const st = new T.CanvasTexture(sc); st.encoding = T.sRGBEncoding;
      const screen = mk(new T.PlaneGeometry(hw * 1.45, hh * 1.4), new T.MeshBasicMaterial({ map: st }), 1, 1, 1, -hw * 0.12, 0, hw * 0.78, H);
      P.screen = { canvas: sc, tex: st };
      for (const s of [-1, 1]) { const an = piv(H, s * 0.05, hh * 0.95, 0); an.rotation.z = -s * 0.45; mk(G.cyl, M.chrome, 0.004, 0.22, 0.004, 0, 0.11, 0, an); mk(G.sphLo, M.chrome, 0.012, 0.012, 0.012, 0, 0.22, 0, an); }
      for (let i = 0; i < 2; i++) mk(G.cyl, M.black, 0.018, 0.015, 0.018, hw * 0.82, -hh * (0.3 - i * 0.3), hw * 0.76, H).rotation.x = Math.PI / 2;
      P.eyes = [];
      const jaw = piv(H, 0, -hh * 0.7, hw * 0.75); P.jaw = jaw; // the "jaw" drives the drawn mouth
    } else if (k === 'hollow') {
      sh(M.shell, hw * 0.95, hh * 1.08, hw * 0.88, 0, 0, 0);
      for (const s of [-1, 1]) sh(M.shell, hw * 0.3, hh * 0.25, hw * 0.3, s * hw * 0.5, -hh * 0.4, hw * 0.5);
      eyes(M, P, H, { L: Object.assign({}, L, { eyeWhite: false }), x: hw * 0.34, y: 0.01, z: hw * 0.74, r: hw * 0.18, lidM: M.shell, brow: false });
      mouth(M, P, H, { y: -hh * 0.58, z: hw * 0.6, w: hw * 0.55, d: hw * 0.4, lowerM: M.shell, tongue: false });
    } else if (k === 'endo') {
      endoSkull.visible = false;
      ball(M.metal, hw * 0.85, hh * 0.9, hw * 0.8, 0, 0.02, 0, H);
      mk(rboxGeo(hw * 1.3, hh * 0.5, hw * 0.6, 0.02), M.darkMetal, 1, 1, 1, 0, -hh * 0.35, hw * 0.45, H);
      for (const s of [-1, 1]) { mk(G.cyl, M.darkMetal, 0.03, 0.06, 0.03, s * hw * 0.85, 0.0, 0, H).rotation.z = Math.PI / 2; mk(gearGeo(0.04, 10, 0.012), M.brass, 1, 1, 1, s * hw * 0.92, 0, 0, H).rotation.y = Math.PI / 2; mk(G.cyl, M.metal, 0.008, 0.12, 0.008, s * hw * 0.5, hh * 0.85, -0.02, H).rotation.z = s * 0.3; }
      eyes(M, P, H, { L, x: hw * 0.36, y: hh * 0.12, z: hw * 0.6, r: hw * 0.16, lidM: M.darkMetal, brow: false });
      mouth(M, P, H, { y: -hh * 0.6, z: hw * 0.5, w: hw * 0.8, d: hw * 0.5, lowerM: M.darkMetal, tongue: false, teeth: 9 });
      for (let i = 0; i < 6; i++) bolt(M, (i - 2.5) * 0.04, hh * 0.6, hw * 0.55, H, 0.008);
    } else if (k === 'guard') {
      // human head: skin, nose, ears, eyes, brows, lips, hair
      sh(M.skin, hw * 0.78, hh * 1.0, hw * 0.85, 0, 0, 0);
      sh(M.skin, hw * 0.55, hh * 0.4, hw * 0.6, 0, -hh * 0.55, hw * 0.2); // jaw line
      const nose = S2(mk(G.cone, M.skin, 0.022, 0.06, 0.03, 0, -hh * 0.12, hw * 0.88, H)); nose.rotation.x = -1.2;
      for (const s of [-1, 1]) { sh(M.skin, 0.02, 0.04, 0.015, s * hw * 0.8, -0.0, 0, H); }
      const hairM = new T.MeshStandardMaterial({ color: new T.Color(FN.Save.data.guard?.hair || '#2a1d14'), map: furTex(55, 0.1), roughness: 0.85 });
      S2(mk(new T.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), hairM, hw * 0.82, hh * 1.06, hw * 0.9, 0, 0.01, -0.01, H));
      eyes(M, P, H, { L, x: hw * 0.32, y: hh * 0.05, z: hw * 0.72, r: hw * 0.1, lidM: M.skin, browM: hairM, lidRest: 0.1 });
      mouth(M, P, H, { y: -hh * 0.5, z: hw * 0.62, w: hw * 0.4, d: hw * 0.25, lowerM: M.skin, teeth: 6 });
      const g = FN.Save.data.guard || {};
      if (g.acc === 'cap') { const cm = new T.MeshStandardMaterial({ color: new T.Color(g.color || '#1f2a44'), map: fabricTex(12), roughness: 0.9 }); S2(mk(new T.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), cm, hw * 0.86, hh * 0.7, hw * 0.92, 0, hh * 0.35, 0, H)); S2(mk(G.cyl, cm, hw * 0.5, 0.012, hw * 0.4, 0, hh * 0.38, hw * 0.75, H)); mk(G.sphLo, M.gold, 0.02, 0.025, 0.006, 0, hh * 0.65, hw * 0.82, H); }
      if (g.acc === 'glasses') { for (const s of [-1, 1]) { const r = mk(new T.TorusGeometry(hw * 0.14, 0.005, 6, 20), M.black, 1, 1, 1, s * hw * 0.32, hh * 0.05, hw * 0.88, H); } mk(G.cyl, M.black, 0.004, hw * 0.25, 0.004, 0, hh * 0.07, hw * 0.9, H).rotation.z = Math.PI / 2; }
      if (g.acc === 'headset') { mk(new T.TorusGeometry(hw * 0.85, 0.01, 6, 24, Math.PI), M.black, 1, 1, 1, 0, 0.02, 0, H); for (const s of [-1, 1]) mk(G.cyl, M.black, 0.035, 0.03, 0.035, s * hw * 0.85, 0, 0, H).rotation.z = Math.PI / 2; }
    } else {
      sh(M.shell, hw, hh, hw, 0, 0, 0);
      eyes(M, P, H, { L, x: hw * 0.4, y: 0, z: hw * 0.8, r: hw * 0.15 });
      mouth(M, P, H, { y: -hh * 0.55, z: hw * 0.6, w: hw * 0.7, d: hw * 0.5 });
    }
  }

  // ---------------------------------------------------------------- props
  function props(L, M, P) {
    const hR = P.arms[1].hand, hL = P.arms[0].hand;
    if (L.prop === 'mic') { const g = piv(hR.wrist, 0, -0.1, 0.03); mk(G.cyl, M.black, 0.012, 0.18, 0.012, 0, 0.04, 0, g); const head = mk(G.sph, M.darkMetal, 0.032, 0.04, 0.032, 0, 0.15, 0, g); tube([[0, -0.05, 0], [0.05, -0.2, 0.05], [0.02, -0.5, 0.02]], 0.004, M.cable, g); P.propR = g; }
    if (L.prop === 'lantern') {
      const g = piv(hL.wrist, 0, -0.12, 0.02);
      mk(G.cyl, M.darkMetal, 0.004, 0.1, 0.004, 0, -0.05, 0, g);
      const lm = new T.MeshStandardMaterial({ color: 0xffc060, emissive: 0xffa030, emissiveIntensity: 1.4, transparent: true, opacity: 0.85 });
      mk(G.cyl, M.brass, 0.05, 0.02, 0.05, 0, -0.1, 0, g); mk(G.cyl, lm, 0.042, 0.1, 0.042, 0, -0.16, 0, g); mk(G.cyl, M.brass, 0.05, 0.02, 0.05, 0, -0.22, 0, g);
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; mk(G.cyl, M.brass, 0.004, 0.1, 0.004, Math.cos(a) * 0.045, -0.16, Math.sin(a) * 0.045, g); }
      const sp = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: 0xffaa40, blending: T.AdditiveBlending, depthWrite: false, transparent: true }));
      sp.scale.set(0.45, 0.45, 1); sp.position.set(0, -0.16, 0); g.add(sp); P.glows.push({ sp, base: 0.9 });
    }
    if (L.prop === 'bass') {
      const g = piv(P.torso, 0.02, 0.28, 0.24); g.rotation.set(0.1, 0, -0.6); P.instrument = g;
      const bodyM = new T.MeshPhysicalMaterial({ color: new T.Color(L.accent || '#7a1d1d'), map: plasticTex(17), roughness: 0.3, clearcoat: 0.9 });
      const sh = new T.Shape(); sh.moveTo(0, -0.14); sh.bezierCurveTo(0.2, -0.16, 0.2, 0.02, 0.1, 0.05); sh.bezierCurveTo(0.16, 0.12, 0.12, 0.2, 0.03, 0.14); sh.lineTo(-0.03, 0.14); sh.bezierCurveTo(-0.12, 0.2, -0.16, 0.12, -0.1, 0.05); sh.bezierCurveTo(-0.2, 0.02, -0.2, -0.16, 0, -0.14);
      const bg = new T.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 }); bg.translate(0, 0, -0.02);
      mk(bg, bodyM, 1, 1, 1, 0, 0, 0, g);
      mk(G.box, new T.MeshStandardMaterial({ color: 0x3a2615, roughness: 0.7 }), 0.035, 0.55, 0.02, 0, 0.4, 0, g);
      mk(rboxGeo(0.06, 0.1, 0.02, 0.008), M.black, 1, 1, 1, 0, 0.7, 0, g);
      for (let i = 0; i < 4; i++) mk(G.cyl, M.chrome, 0.0015, 0.8, 0.0015, (i - 1.5) * 0.008, 0.3, 0.025, g);
      mk(G.box, M.black, 0.08, 0.02, 0.01, 0, -0.05, 0.025, g);
    }
    if (L.kind === 'guard') {
      const g = piv(hR.wrist, 0, -0.1, 0.02); g.rotation.x = -Math.PI / 2; P.flashlight = g;
      mk(G.cyl, M.black, 0.018, 0.18, 0.018, 0, 0, 0, g); mk(G.cyl, M.chrome, 0.026, 0.04, 0.026, 0, 0.1, 0, g);
      P.lens = mk(G.cyl, new T.MeshBasicMaterial({ color: 0x555544 }), 0.022, 0.005, 0.022, 0, 0.122, 0, g);
    }
  }

  // ---------------------------------------------------------------- costume details (v1.3)
  /** Seams, cuffs, collars and the per-character details that make each silhouette readable. */
  function details(id, L, M, P) {
    if (L.kind === 'guard' || L.bare) return;
    const seamM = new T.MeshStandardMaterial({ color: new T.Color(A.darken(L.fur, 0.55)), roughness: 0.9 });
    const tw = L.torso === 'thin' ? 0.7 : 1, bw = L.bodyW || 1;
    // costume cuffs where the suit pieces meet: show the gap to the endoskeleton
    for (const a of P.arms) { shell(mk(new T.TorusGeometry(0.052 * tw, 0.012, 6, 18), seamM, 1, 1, 1, 0, -0.27, 0, a.el)).rotation.x = Math.PI / 2; shell(mk(new T.TorusGeometry(0.068 * tw, 0.012, 6, 18), seamM, 1, 1, 1, 0, -0.29, 0, a.sh)).rotation.x = Math.PI / 2; }
    for (const l of P.legs) { shell(mk(new T.TorusGeometry(0.075, 0.013, 6, 18), seamM, 1, 1, 1, 0, -0.4, 0, l.knee)).rotation.x = Math.PI / 2; shell(mk(new T.TorusGeometry(0.09, 0.013, 6, 18), seamM, 1, 1, 1, 0, -0.42, 0, l.hip)).rotation.x = Math.PI / 2; }
    shell(mk(new T.TorusGeometry(0.1 * tw * bw, 0.016, 6, 22), seamM, 1, 1, 0.8, 0, 0.635 * (L.bodyH || 1), 0, P.torso)).rotation.x = Math.PI / 2;
    // stitched seam down the chest
    for (let i = 0; i < 6; i++) shell(mk(G.box, seamM, 0.004, 0.03, 0.004, 0, 0.36 + i * 0.045, 0.29 * 0.78 * bw * tw + 0.01, P.torso));
    const H = P.skull;
    const r = A.rng(L.seed || 1);
    switch (id) {
      case 'bruno': case 'oldbruno':
        for (let i = 0; i < 2; i++) mk(G.cyl, M.black, 0.02, 0.01, 0.02, 0, 0.42 + i * 0.09, 0.29 * 0.78 * bw + 0.012, P.torso).rotation.x = Math.PI / 2;
        break;
      case 'gus':
        tube([[-0.24, 0.55, 0.12], [0, 0.35, 0.26], [0.24, 0.05, 0.14]], 0.012, new T.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.7 }), P.torso); // bass strap
        break;
      case 'nora': {
        const fm = M.shellDark;
        for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 1.4; const f = shell(mk(G.cone, fm, 0.035, 0.14, 0.014, Math.sin(a) * P.hw * 0.6, P.hh * 0.95, -0.02 + Math.cos(a) * 0.03, H)); f.rotation.set(-0.35, 0, -a * 0.7); }
        for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const f = shell(mk(G.cone, fm, 0.035, 0.13, 0.012, s * (0.3 + i * 0.012), 0.42 - i * 0.04, -0.02 - i * 0.03, P.torso)); f.rotation.z = s * (2.4 + i * 0.12); }
        break;
      }
      case 'krok': case 'oldkrok':
        for (let i = 0; i < 6; i++) { const c = shell(mk(G.cone, M.shellDark, 0.035, 0.08, 0.02, 0, 0.12 + i * 0.09, -0.23 * bw, P.torso)); c.rotation.x = -0.4; }
        if (P.tail) for (let i = 0; i < 5; i++) shell(mk(G.cone, M.shellDark, 0.025, 0.06, 0.015, 0, -0.08 - i * 0.12, -0.22 - i * 0.05, P.tail)).rotation.x = -1.2;
        break;
      case 'pepper': case 'rico':
        // moulded plastic panel lines and a star badge
        for (const y of [0.18, 0.46]) shell(mk(new T.TorusGeometry(0.205 * bw, 0.004, 4, 28), M.black, 1, 1, 0.78, 0, y, 0, P.torso)).rotation.x = Math.PI / 2;
        { const st = new T.Shape(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 0.018 : 0.04; i ? st.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : st.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
          mk(new T.ExtrudeGeometry(st, { depth: 0.008, bevelEnabled: false }), M.gold, 1, 1, 1, 0.11, 0.5, 0.29 * 0.78 * bw + 0.005, P.torso); }
        break;
      case 'lumi': {
        const core = mk(G.sph, new T.MeshBasicMaterial({ color: 0xffc0e8, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false }), 0.12, 0.09, 0.12, 0, 0.12, 0, H);
        P.core = core;
        break;
      }
      case 'chime': {
        const crack = new T.MeshBasicMaterial({ color: 0x2a1a1a });
        tube([[0.05, 0.1, 0.17], [0.07, 0.04, 0.19], [0.05, -0.03, 0.2], [0.08, -0.08, 0.19]], 0.0025, crack, H);
        tube([[-0.09, 0.14, 0.15], [-0.06, 0.1, 0.18], [-0.08, 0.06, 0.18]], 0.002, crack, H);
        break;
      }
      case 'static': {
        for (const s of [-1, 1]) { const lp = shell(mk(G.box, M.shellDark, 0.07, 0.3, 0.02, s * 0.09, 0.45, 0.24 * bw, P.torso)); lp.rotation.z = s * -0.25; }
        const led = mk(G.sphLo, new T.MeshBasicMaterial({ color: 0x7dffb0 }), 0.012, 0.012, 0.012, 0.18, 0.28, 0.2, H); P.led = led;
        break;
      }
      case 'hollow': {
        const thread = new T.MeshBasicMaterial({ color: 0x0a0806 });
        for (let i = 0; i < 6; i++) mk(G.box, thread, 0.004, 0.05, 0.004, -0.1 + i * 0.04, -0.15, 0.255, H);
        break;
      }
    }
    // worn shells: a few missing patches on old/abîmés characters
    if ((L.damage || 0) > 0) for (let i = 0; i < 4; i++) { const p = ball(M.black, 0.04 + r() * 0.04, 0.03 + r() * 0.03, 0.01, (r() - 0.5) * 0.3, 0.1 + r() * 0.45, 0.22 * bw, P.torso); p.userData.shell = true; }
  }

  // ---------------------------------------------------------------- build
  function build(id) {
    const def = FN.CHARS[id];
    const L = def.look;
    const M = materials(L, id);
    if (L.kind === 'guard') {
      const g = FN.Save.data.guard || {};
      const col = g.color || '#1f2a44';
      M.shirt = new T.MeshStandardMaterial({ color: new T.Color(g.outfit === 'jacket' ? A.darken(col, 0.3) : col), map: fabricTex(21), roughness: 0.95 });
      M.pants = new T.MeshStandardMaterial({ color: new T.Color(A.darken(col, 0.45)), map: fabricTex(22), roughness: 0.95 });
      M.shoe = new T.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.1 });
      M.skin = new T.MeshStandardMaterial({ color: new T.Color(g.skin || '#c99a7a'), map: plasticTex(41), roughness: 0.65 });
      for (const k of ['shirt', 'pants', 'skin']) M[k].userData.shell = true;
    }
    const P = { L, M, pistons: [], glows: [], eyes: [] };
    const B = buildBody(id, L, M, P);
    buildHead(L, M, P, B.head);
    props(L, M, P);
    details(id, L, M, P);
    if (L.kind === 'guard') {
      const g = FN.Save.data.guard || {};
      const badge = mk(new T.CylinderGeometry(0.03, 0.03, 0.006, 6), M.gold, 1, 1, 1, -0.11, 0.48, 0.225, P.torso); badge.rotation.x = Math.PI / 2;
      mk(G.torus || new T.TorusGeometry(0.23, 0.018, 6, 28), new T.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.5 }), 1, 1, 0.8, 0, 0.0, 0, P.torso).rotation.x = Math.PI / 2;
      mk(rboxGeo(0.06, 0.04, 0.012, 0.004), M.chrome, 1, 1, 1, 0, 0.0, 0.19, P.torso);
      if (g.outfit === 'jacket') for (const s of [-1, 1]) mk(G.box, M.shirt, 0.08, 0.5, 0.02, s * 0.12, 0.3, 0.22, P.torso).rotation.z = s * 0.15;
      if (g.acc === 'scarf') mk(new T.TorusGeometry(0.075, 0.03, 8, 20), new T.MeshStandardMaterial({ color: 0x7a1414, map: fabricTex(30), roughness: 1 }), 1, 1, 1, 0, 0.02, 0, P.neck).rotation.x = Math.PI / 2;
      for (let i = 0; i < 4; i++) mk(G.sphLo, M.chrome, 0.006, 0.006, 0.004, 0, 0.12 + i * 0.12, 0.235, P.torso);
    }
    B.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material && o.material.userData && o.material.userData.shell) o.userData.shell = true; } });
    B.root.userData = P;
    P.blinkT = Math.random() * 4;
    P.sacc = { t: 0, x: 0, y: 0 };
    return B.root;
  }

  // ---------------------------------------------------------------- animation clips
  const _a = new T.Vector3(), _b = new T.Vector3();
  function reset(P) {
    P.body.position.set(0, 0, 0); P.body.rotation.set(0, 0, 0);
    P.pelvis.rotation.set(0, 0, 0); P.torso.rotation.set(0, 0, 0); P.neck.rotation.set(0, 0, 0); P.head.rotation.set(0, 0, 0);
    for (const l of P.legs) { l.hip.rotation.set(0, 0, 0); l.knee.rotation.set(0, 0, 0); l.ankle.rotation.set(0, 0, 0); }
    for (const a of P.arms) { a.sh.rotation.set(0, 0, a.s * 0.08); a.el.rotation.set(-0.15, 0, 0); a.wr.rotation.set(0, 0, 0); }
  }
  function curl(hand, c, spread = 0) {
    hand.fingers.forEach((segs, i) => segs.forEach((s, k) => { s.rotation.x = -c * (0.5 + k * 0.25); s.rotation.z = k === 0 ? (i - 1.5) * spread : 0; }));
    hand.thumb.forEach((s) => (s.rotation.x = -c * 0.4));
  }
  /**
   * o: { t, pose, phase, jaw, eyes, look, tilt, light, flip, unit }
   * pose: idle | walk | run | look | attack | stage | peek | lean | float | slump | dance | cheer | tablet | flash
   */
  function pose(model, o) {
    const P = model.userData, L = P.L;
    const t = o.t ?? performance.now() / 1000;
    const pz = o.pose || 'idle';
    reset(P);
    const unit = (L.scale || 1) * (o.unit || 1);
    model.scale.setScalar(unit);
    let jaw = o.jaw || 0;
    const look = o.look || 0;
    const twitch = Math.sin(t * 13.7) * Math.sin(t * 3.1) > 0.94 ? 1 : 0;
    const [aL, aR] = P.arms;
    const legL = P.legs[0], legR = P.legs[1];
    const ph = o.phase ?? t * (pz === 'run' ? 8.5 : 4.2);
    switch (pz) {
      case 'walk': case 'run': {
        const run = pz === 'run', A1 = run ? 0.75 : 0.42;
        if (legL) { legL.hip.rotation.x = -Math.sin(ph) * A1; legR.hip.rotation.x = Math.sin(ph) * A1; legL.knee.rotation.x = Math.max(0, Math.sin(ph + 1.4)) * (run ? 1.3 : 0.7); legR.knee.rotation.x = Math.max(0, Math.sin(ph + 1.4 + Math.PI)) * (run ? 1.3 : 0.7); legL.ankle.rotation.x = Math.sin(ph) * 0.2; legR.ankle.rotation.x = -Math.sin(ph) * 0.2; }
        aL.sh.rotation.x = Math.sin(ph) * (run ? 0.8 : 0.32); aR.sh.rotation.x = -Math.sin(ph) * (run ? 0.8 : 0.32);
        aL.el.rotation.x = aR.el.rotation.x = run ? -1.3 : -0.35;
        P.body.position.y = -Math.abs(Math.cos(ph)) * (run ? 0.06 : 0.045) + 0.02;
        P.body.rotation.z = Math.sin(ph) * (run ? 0.03 : 0.05); // heavy side-to-side lurch
        P.body.position.x = Math.sin(ph) * 0.02;
        P.torso.rotation.x = run ? 0.3 : 0.06; P.torso.rotation.y = Math.sin(ph) * 0.1; P.pelvis.rotation.z = Math.sin(ph) * 0.05;
        P.head.rotation.x = run ? -0.25 : -0.04; P.head.rotation.z = Math.sin(ph) * 0.04;
        curl(aL.hand, run ? 0.9 : 0.35); curl(aR.hand, run ? 0.9 : 0.35);
        break;
      }
      case 'attack': {
        const j = (k) => Math.sin(t * k) * 0.08;
        aL.sh.rotation.set(-1.45 + j(31), 0, -0.3); aR.sh.rotation.set(-1.45 + j(27), 0, 0.3);
        aL.el.rotation.x = -0.25 + j(23); aR.el.rotation.x = -0.25 + j(29);
        curl(aL.hand, 0.1, 0.25); curl(aR.hand, 0.1, 0.25);
        P.torso.rotation.x = 0.32; P.head.rotation.x = -0.28 + j(41); P.head.rotation.z = j(37) * 2; P.head.rotation.y = j(33);
        if (legL) { legL.hip.rotation.x = -0.3; legL.knee.rotation.x = 0.4; legR.hip.rotation.x = 0.2; legR.knee.rotation.x = 0.2; }
        jaw = Math.max(jaw, 0.88 + Math.sin(t * 35) * 0.12);
        break;
      }
      case 'stage': {
        aR.sh.rotation.set(-1.15, 0, 0.15); aR.el.rotation.x = -1.35; curl(aR.hand, 0.85);
        aL.sh.rotation.set(-0.3, 0, -(0.55 + Math.sin(t * 2) * 0.25)); aL.el.rotation.x = -0.5 - Math.sin(t * 2) * 0.2; curl(aL.hand, 0.2, 0.15);
        P.head.rotation.z = Math.sin(t * 1.5) * 0.12; P.head.rotation.y = Math.sin(t * 0.7) * 0.25; P.torso.rotation.y = Math.sin(t * 0.7) * 0.08;
        jaw = Math.max(jaw, Math.abs(Math.sin(t * 6.5)) * 0.45);
        if (P.instrument) { aR.sh.rotation.set(-0.6, 0, 0.1); aR.el.rotation.x = -1.1; aL.sh.rotation.set(-0.7, 0.4, -0.1); aL.el.rotation.x = -1.2; }
        break;
      }
      case 'peek': P.torso.rotation.z = 0.22; P.head.rotation.z = 0.45 + Math.sin(t) * 0.05; P.head.rotation.y = -0.2; aL.sh.rotation.set(-0.6, 0, -1.1); aL.el.rotation.x = -1.2; curl(aL.hand, 0.6); break;
      case 'lean': P.torso.rotation.z = -0.12; P.head.rotation.z = -0.18; P.head.rotation.y = 0.15; aR.sh.rotation.set(-0.2, 0, 1.45); aR.el.rotation.x = -0.6; curl(aR.hand, 0.7); break;
      case 'float':
        P.body.position.y = 0.08 + Math.sin(t * 1.8) * 0.06;
        for (const l of P.legs) { l.hip.rotation.x = Math.sin(t * 1.3 + l.s) * 0.15; l.knee.rotation.x = 0.3 + Math.sin(t * 1.1 + l.s) * 0.15; l.ankle.rotation.x = 0.5; }
        aL.sh.rotation.z = -0.4 - Math.sin(t * 2) * 0.25; aR.sh.rotation.z = 0.4 + Math.sin(t * 2.2) * 0.25; aL.el.rotation.x = aR.el.rotation.x = -0.5;
        curl(aL.hand, 0.3, 0.1); curl(aR.hand, 0.3, 0.1);
        P.head.rotation.z = Math.sin(t * 0.8) * 0.08;
        break;
      case 'slump':
        P.body.position.y = -0.52;
        for (const l of P.legs) { l.hip.rotation.x = -1.45; l.hip.rotation.z = l.s * 0.18; l.knee.rotation.x = 0.15; l.ankle.rotation.x = -0.4; }
        P.torso.rotation.x = 0.4; P.torso.rotation.z = 0.08; P.head.rotation.x = 0.55 + twitch * 0.2; P.head.rotation.z = 0.32 + twitch * 0.15;
        aL.sh.rotation.set(0.1, 0, -0.18); aR.sh.rotation.set(0.1, 0, 0.2); aL.el.rotation.x = aR.el.rotation.x = -0.05; curl(aL.hand, 0.4); curl(aR.hand, 0.4);
        break;
      case 'dance': case 'cheer':
        aL.sh.rotation.set(-0.2, 0, -(2.5 + Math.sin(t * 2) * 0.2)); aR.sh.rotation.set(-0.2, 0, 2.5 - Math.sin(t * 2) * 0.2); aL.el.rotation.x = aR.el.rotation.x = -0.4; curl(aL.hand, pz === 'cheer' ? 0.9 : 0.1, 0.2); curl(aR.hand, pz === 'cheer' ? 0.9 : 0.1, 0.2);
        P.body.position.y = Math.abs(Math.sin(t * 3)) * 0.04; P.pelvis.rotation.z = Math.sin(t * 2) * 0.08; P.head.rotation.z = Math.sin(t * 1.3) * 0.1;
        if (legL && pz === 'dance' && L.legs === 'ballet') { legR.hip.rotation.x = -0.9; legR.knee.rotation.x = 1.6; }
        break;
      case 'tablet': aL.sh.rotation.set(-0.9, 0.3, -0.1); aR.sh.rotation.set(-0.9, -0.3, 0.1); aL.el.rotation.x = aR.el.rotation.x = -0.9; P.head.rotation.x = 0.35; curl(aL.hand, 0.3); curl(aR.hand, 0.3); break;
      case 'flash': aR.sh.rotation.set(-1.3, 0, 0.1); aR.el.rotation.x = -0.2; curl(aR.hand, 0.9); P.head.rotation.y = Math.sin(t * 0.8) * 0.3; break;
      case 'look': {
        P.neck.rotation.y = look * 0.35; P.head.rotation.y = look * 0.6; P.head.rotation.z = -look * 0.08; P.torso.rotation.y = look * 0.12;
        break;
      }
      default: { // idle: breathing, weight shift, slow head turns and the odd mechanical twitch
        P.torso.rotation.x = Math.sin(t * 1.3) * 0.015; P.pelvis.rotation.z = Math.sin(t * 0.45) * 0.02;
        // servo motion: the head holds a position, then snaps to the next one
        const step = Math.floor(t / 2.7 + (L.seed || 0) * 0.37), frac = (t / 2.7 + (L.seed || 0) * 0.37) % 1;
        const tgt = (k) => Math.sin(k * 12.9898 + (L.seed || 1)) * 0.3;
        const ease = frac < 0.12 ? frac / 0.12 : 1;
        const yaw = tgt(step - 1) + (tgt(step) - tgt(step - 1)) * (ease * ease * (3 - 2 * ease));
        P.head.rotation.y = (o.stare ? 0 : yaw) + look * 0.5; P.head.rotation.z = Math.sin(t * 0.5) * 0.04 + twitch * 0.25 + (o.tilt || 0) * -1;
        P.head.rotation.x = Math.sin(t * 0.27) * 0.05 - (o.stare ? 0.08 : 0);
        if (Math.sin(t * 0.9 + (L.seed || 0)) > 0.985) jaw = Math.max(jaw, Math.abs(Math.sin(t * 40)) * 0.25); // jaw chatter
        curl(aL.hand, 0.35); curl(aR.hand, 0.35);
      }
    }
    if (o.tilt && pz !== 'idle') P.head.rotation.z -= o.tilt;
    // mouth clip (talk) and jaw
    if (o.talk) jaw = Math.max(jaw, Math.abs(Math.sin(t * 8)) * 0.5);
    if (P.jaw) P.jaw.rotation.x = jaw * 0.7;
    // eyes clip: saccades, blinks, glow
    const glow = Math.max(0, o.eyes ?? 1);
    const s = P.sacc;
    if (t - s.t > 0.6 + Math.abs(Math.sin(t * 7.1)) * 1.6) { s.t = t; s.x = (Math.sin(t * 12.9) * 0.5) * 0.35; s.y = Math.sin(t * 9.3) * 0.12; }
    const blinkPh = (t + P.blinkT) % 4.3;
    const blink = pz === 'attack' ? 0 : blinkPh < 0.14 ? Math.sin((blinkPh / 0.14) * Math.PI) : 0;
    for (const e of P.eyes) {
      if (e.missing) { e.led.visible = Math.random() > 0.3; continue; }
      e.eye.rotation.y = s.x + look * 0.35; e.eye.rotation.x = -s.y;
      const rest = pz === 'attack' ? 0 : e.rest;
      e.up.rotation.x = -1.35 + rest * 0.9 + blink * 1.3;
      e.lo.rotation.x = 1.15 - blink * 0.9;
      const fl = 0.85 + Math.sin(t * 37 + e.s) * 0.08 + (Math.random() < 0.02 ? -0.5 : 0);
      const a = Math.max(0, glow * fl);
      if (L.kind !== 'guard') e.iris.material.emissiveIntensity = 0.15 + a * 2.4;
      e.sp.material.opacity = a * 0.85; e.sp.visible = a > 0.02 && L.kind !== 'guard';
    }
    if (P.brows) for (const b of P.brows) b.o.rotation.z = b.s * (pz === 'attack' ? -0.5 : -0.18);
    if (P.core) { P.core.material.opacity = 0.35 + Math.sin(t * 2.4) * 0.15 + glow * 0.2; P.core.scale.setScalar(0.1 + Math.sin(t * 2.4) * 0.01); }
    if (P.led) P.led.visible = Math.floor(t * 2) % 2 === 0;
    if (P.ears) for (const e of P.ears) e.p.rotation.z = Math.sin(t * 1.7 + e.s) * 0.06 + (twitch ? e.s * 0.25 : 0);
    if (P.tail) P.tail.rotation.y = Math.sin(t * 2) * 0.35;
    if (P.tentacles) P.tentacles.forEach((segs, i) => segs.forEach((sg, k) => { sg.rotation.x = Math.sin(t * 1.8 + i + k * 0.7) * 0.28; sg.rotation.z = Math.cos(t * 1.4 + i * 1.3 + k) * 0.22; }));
    if (P.bell) P.bell.scale.y = P.bell.scale.x * 0.96 * (1 + Math.sin(t * 2.4) * 0.07);
    for (const g of P.glows) g.sp.material.opacity = g.base * (0.8 + Math.random() * 0.2);
    if (P.lens) P.lens.material.color.setHex(o.lit ? 0xfffbe0 : 0x555544);
    if (P.screen) drawScreen(P, t, L, jaw, glow);
    // pistons follow the joints
    model.updateMatrixWorld(true);
    for (const p of P.pistons) {
      _a.copy(p.pa); _b.copy(p.pb); p.b.localToWorld(_b); p.a.worldToLocal(_b);
      const mid = [(_a.x * 0.45 + _b.x * 0.55), (_a.y * 0.45 + _b.y * 0.55), (_a.z * 0.45 + _b.z * 0.55)];
      orient(p.outer, [_a.x, _a.y, _a.z], mid);
      orient(p.inner, mid.map((v, i) => v * 0.9 + [_a.x, _a.y, _a.z][i] * 0.1), [_b.x, _b.y, _b.z]);
    }
  }
  function drawScreen(P, t, L, jaw, eyes) {
    const c = P.screen.canvas, x = c.getContext('2d'), w = c.width, h = c.height;
    x.fillStyle = '#081009'; x.fillRect(0, 0, w, h);
    const r = A.rng(Math.floor(t * 20));
    for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(200,255,220,${r() * 0.3})`; x.fillRect(r() * w, r() * h, 4 + r() * 18, 2); }
    const col = A.rgba(L.eye, Math.min(1, 0.3 + eyes));
    x.shadowColor = L.eye; x.shadowBlur = 12;
    const blink = (t % 3.7) < 0.12;
    A.ell(x, w * 0.33, h * 0.38, 10, blink ? 1 : 10, col); A.ell(x, w * 0.67, h * 0.38, 10, blink ? 1 : 10, col);
    x.strokeStyle = col; x.lineWidth = 5; x.beginPath(); x.arc(w / 2, h * 0.5, w * 0.28, 0.25, Math.PI - 0.25); x.stroke();
    if (jaw > 0.1) { x.fillStyle = '#000'; x.fillRect(w * 0.25, h * 0.62, w * 0.5, h * 0.3 * jaw); }
    x.shadowBlur = 0;
    P.screen.tex.needsUpdate = true;
  }

  /** X-ray view for the gallery: shells become ghostly so the mechanics show through. */
  function xray(model, on) {
    model.traverse((o) => {
      if (!o.isMesh || !o.userData.shell) return;
      const m = o.material;
      if (on) { if (m.userData.base == null) m.userData.base = { t: m.transparent, o: m.opacity }; m.transparent = true; m.opacity = 0.12; m.depthWrite = false; }
      else if (m.userData.base) { m.transparent = m.userData.base.t; m.opacity = m.userData.base.o; m.depthWrite = true; }
      m.needsUpdate = true;
    });
  }

  /** First-person arms (uniform sleeves, hands) for the offices. */
  function buildArms() {
    const g = FN.Save.data.guard || {};
    const L = { fur: g.color || '#1f2a44', eye: '#ffffff', seed: 5, rust: 0.2 };
    const M = materials(L, 'arms');
    const sleeve = new T.MeshStandardMaterial({ color: new T.Color(g.outfit === 'jacket' ? A.darken(L.fur, 0.3) : L.fur), map: fabricTex(21), roughness: 0.95 });
    const skin = new T.MeshStandardMaterial({ color: new T.Color(g.skin || '#c99a7a'), map: plasticTex(41), roughness: 0.65 });
    const root = new T.Group();
    const arms = [];
    for (const s of [-1, 1]) {
      const a = piv(root, s * 0.22, -0.32, -0.12);
      mk(taperGeo(0.05, 0.04, 0.34), sleeve, 1, 1, 1, 0, 0, 0, a);
      mk(G.cyl, M.chrome, 0.043, 0.02, 0.043, 0, -0.33, 0, a); // watch / cuff
      const wr = piv(a, 0, -0.35, 0);
      const h = hand(M, wr, s, skin, {});
      arms.push({ s, a, wr, hand: h });
    }
    // props held in first person
    const tab = piv(root, 0, -0.3, -0.45); tab.rotation.x = -0.35;
    mk(rboxGeo(0.34, 0.24, 0.015, 0.008), new T.MeshStandardMaterial({ color: 0x151515, roughness: 0.4 }), 1, 1, 1, 0, 0, 0, tab);
    const tabScr = mk(new T.PlaneGeometry(0.3, 0.2), new T.MeshBasicMaterial({ color: 0x1a3a22 }), 1, 1, 1, 0, 0, 0.009, tab);
    const fl = piv(arms[1].wr, 0, -0.1, 0.03); fl.rotation.x = -Math.PI / 2;
    mk(G.cyl, M.black, 0.018, 0.17, 0.018, 0, 0, 0, fl); mk(G.cyl, M.chrome, 0.025, 0.04, 0.025, 0, 0.1, 0, fl);
    const lens = mk(G.cyl, new T.MeshBasicMaterial({ color: 0x555544 }), 0.021, 0.004, 0.021, 0, 0.121, 0, fl);
    root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
    return { root, arms, tab, tabScr, fl, lens };
  }

  FN.Models = { build, pose, xray, buildArms, materials, curl };
})(window.FN);
