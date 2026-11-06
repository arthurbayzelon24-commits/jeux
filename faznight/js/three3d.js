/* FAZNIGHT — real-time 3D animatronics (Three.js / WebGL).
   Each character is an articulated model: pivots for hips, knees, shoulders, elbows, neck and jaw,
   an endoskeleton under the shell, worn fur / plastic / metal materials and emissive eyes.
   `FN.G3.drawChar` renders a model into any 2D canvas, so the same 3D cast appears in the
   cameras, menus, bestiary, posters and jumpscares. The offices are full 3D scenes (office3d.js). */
(function (FN) {
  const T3 = window.THREE;
  const A = FN.Art;
  const U = 0.01; // 2D rig units -> metres

  const G3 = { enabled: false, ok: false };
  FN.G3 = G3;
  if (!T3) return;

  // ---------------------------------------------------------------- shared textures
  const texCache = {};
  function canvasTex(key, w, h, draw, repeat) {
    if (texCache[key]) return texCache[key];
    const c = A.canvas(w, h);
    draw(c.getContext('2d'), w, h);
    const t = new T3.CanvasTexture(c);
    t.encoding = T3.sRGBEncoding;
    if (repeat) { t.wrapS = t.wrapT = T3.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    t.anisotropy = 4;
    texCache[key] = t;
    return t;
  }
  /** Worn surface: light base with stains, scratches and specks (multiplied with the material colour). */
  function wornTex(seed, amount = 0.5) {
    return canvasTex('worn' + seed + '_' + amount, 256, 256, (x, w, h) => {
      const r = A.rng(seed);
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 1800 * amount + 300; i++) { x.fillStyle = `rgba(${60 + r() * 40},${35 + r() * 25},${15 + r() * 15},${r() * 0.35})`; x.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); }
      for (let i = 0; i < 4000; i++) { const v = 200 + r() * 55; x.fillStyle = `rgba(${v},${v - 10},${v - 25},0.5)`; x.fillRect(r() * w, r() * h, 2, 2); }
      for (let i = 0; i < 18 * amount + 3; i++) { A.ell(x, r() * w, r() * h, 3 + r() * 12, 2 + r() * 8, `rgba(80,45,15,${0.06 + r() * 0.18 * amount})`, r() * 3); }
      for (let i = 0; i < 12 * amount; i++) { const sx = r() * w; const g = x.createLinearGradient(sx, 0, sx, h * 0.6); g.addColorStop(0, `rgba(90,50,20,${0.25 * amount})`); g.addColorStop(1, 'rgba(90,50,20,0)'); x.fillStyle = g; x.fillRect(sx, r() * h * 0.5, 2 + r() * 4, h * 0.5); }
      for (let i = 0; i < 30 * amount + 5; i++) { x.strokeStyle = `rgba(20,12,6,${0.2 + r() * 0.4})`; x.lineWidth = 1; x.beginPath(); const sx = r() * w, sy = r() * h; x.moveTo(sx, sy); x.lineTo(sx + (r() - 0.5) * 40, sy + r() * 40); x.stroke(); }
      for (let i = 0; i < 600; i++) { x.fillStyle = `rgba(255,255,255,${r() * 0.25})`; x.fillRect(r() * w, r() * h, 1, 1); }
    });
  }
  const glowTex = () => canvasTex('glow', 64, 64, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  G3.canvasTex = canvasTex;
  G3.wornTex = wornTex;
  G3.glowTex = glowTex;

  // ---------------------------------------------------------------- materials
  function mats(L) {
    const worn = L.rust ?? 0.4;
    const glossy = worn < 0.2;
    const map = wornTex(L.seed || 1, Math.min(1, worn + (L.damage || 0) * 0.4));
    const std = (color, o = {}) => new T3.MeshStandardMaterial(Object.assign({ color: new T3.Color(color), map, bumpMap: map, bumpScale: 0.012, roughness: glossy ? 0.35 : 0.82, metalness: glossy ? 0.05 : 0.08 }, o));
    return {
      fur: std(L.fur),
      dark: std(A.darken(L.fur, 0.35)),
      belly: std(L.belly || A.lighten(L.fur, 0.4)),
      accent: std(L.accent || '#7a1010'),
      metal: new T3.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.85, roughness: 0.38, map: wornTex(99, 0.8) }),
      black: new T3.MeshStandardMaterial({ color: 0x070505, roughness: 0.9 }),
      teeth: new T3.MeshStandardMaterial({ color: 0xd8d0b8, roughness: 0.45, map: wornTex(7, 0.6) }),
      eyeball: new T3.MeshStandardMaterial({ color: 0x8a847a, roughness: 0.25 }),
      iris: new T3.MeshStandardMaterial({ color: new T3.Color(L.eye), emissive: new T3.Color(L.eye), emissiveIntensity: 1.5, roughness: 0.2 }),
      wire: new T3.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 }),
      pale: std('#efe8df', { roughness: 0.3 }),
      pink: std('#e04a6a'),
      gold: new T3.MeshStandardMaterial({ color: 0xc9a23a, metalness: 0.9, roughness: 0.3 }),
      translucent: new T3.MeshStandardMaterial({ color: new T3.Color(L.fur), transparent: true, opacity: 0.78, roughness: 0.15, emissive: new T3.Color(L.accent || L.fur), emissiveIntensity: 0.25 }),
    };
  }

  // ---------------------------------------------------------------- geometry helpers
  const geo = {
    sph: new T3.SphereGeometry(1, 24, 18),
    sphLo: new T3.SphereGeometry(1, 12, 9),
    cyl: new T3.CylinderGeometry(1, 1, 1, 12),
    cone: new T3.ConeGeometry(1, 1, 12),
    box: new T3.BoxGeometry(1, 1, 1),
  };
  function mesh(g, m, sx, sy, sz, x = 0, y = 0, z = 0, parent) {
    const o = new T3.Mesh(g, m);
    o.scale.set(sx, sy ?? sx, sz ?? sx);
    o.position.set(x, y, z);
    o.castShadow = true;
    if (parent) parent.add(o);
    return o;
  }
  const blob = (m, rx, ry, rz, x, y, z, p) => mesh(geo.sph, m, rx, ry, rz, x, y, z, p);
  function rod(m, len, r, parent, y0 = 0) { return mesh(geo.cyl, m, r, len, r, 0, y0 - len / 2, 0, parent); }
  function pivot(parent, x = 0, y = 0, z = 0) { const g = new T3.Group(); g.position.set(x, y, z); parent.add(g); return g; }
  function tube(points, r, m, parent) {
    const curve = new T3.CatmullRomCurve3(points.map((p) => new T3.Vector3(...p)));
    const o = new T3.Mesh(new T3.TubeGeometry(curve, 16, r, 5, false), m);
    parent.add(o);
    return o;
  }

  // ---------------------------------------------------------------- character builder
  function build(id) {
    const def = FN.CHARS[id], L = def.look, M = mats(L);
    const root = new T3.Group();
    const body = pivot(root);
    const parts = { root, body, eyes: [], glows: [], hide: [], M, L };
    const dmg = L.damage || 0;
    const bw = 0.8 * (L.bodyW || 1), bh = 1.02 * (L.bodyH || 1);

    // legs
    parts.legs = [];
    if (L.legs === 'tentacles') {
      parts.tentacles = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, base = pivot(body, Math.cos(a) * 0.45, 1.55, Math.sin(a) * 0.35);
        const segs = [];
        let parent = base;
        for (let k = 0; k < 5; k++) { const s = pivot(parent, 0, k === 0 ? 0 : -0.3, 0); blob(M.translucent, 0.07 - k * 0.01, 0.17, 0.07 - k * 0.01, 0, -0.15, 0, s); segs.push(s); parent = s; }
        parts.tentacles.push(segs);
      }
    } else {
      for (const s of [-1, 1]) {
        const hip = pivot(body, s * 0.42 * (L.legs === 'ballet' ? 0.5 : 1), 1.5, 0);
        rod(M.metal, 0.8, 0.06, hip);
        const thinLeg = L.legs === 'ballet';
        if (!(dmg > 0.5 && s > 0)) blob(M.fur, thinLeg ? 0.12 : 0.3, 0.5, thinLeg ? 0.12 : 0.3, 0, -0.4, 0, hip);
        const knee = pivot(hip, 0, -0.8, 0);
        blob(M.metal, 0.09, 0.09, 0.09, 0, 0, 0, knee);
        rod(M.metal, 0.66, 0.05, knee);
        if (!(dmg > 0.5 && s > 0)) blob(M.dark, thinLeg ? 0.1 : 0.25, 0.4, thinLeg ? 0.1 : 0.25, 0, -0.33, 0, knee);
        blob(thinLeg ? M.pale : M.dark, thinLeg ? 0.12 : 0.36, 0.15, thinLeg ? 0.2 : 0.48, 0, -0.62, 0.1, knee);
        parts.legs.push({ hip, knee, s });
      }
    }
    // torso
    const torso = pivot(body, 0, 1.5, 0);
    parts.torso = torso;
    rod(M.metal, 1.6, 0.08, torso, 1.6);
    if (L.tutu) for (let i = 0; i < 3; i++) mesh(new T3.CylinderGeometry(0.55 - i * 0.08, 1.15 - i * 0.18, 0.12, 24, 1, true), new T3.MeshStandardMaterial({ color: new T3.Color(i % 2 ? L.tutu : A.lighten(L.tutu, 0.2)), side: T3.DoubleSide, roughness: 0.7 }), 1, 1, 1, 0, 0.02 + i * 0.07, 0, torso);
    if (L.torso === 'thin') blob(L.kind === 'jelly' ? M.translucent : M.fur, bw * 0.55, bh * 0.95, bw * 0.45, 0, 0.75, 0, torso);
    else {
      blob(M.fur, bw, bh, bw * 0.78, 0, 0.72, 0, torso);
      if (L.torso === 'suit') { blob(M.accent, 0.16, 0.08, 0.08, 0, 1.55, bw * 0.55, torso); mesh(geo.box, M.pale, 0.2, 0.7, 0.05, 0, 1.15, bw * 0.72, torso); }
      else blob(M.belly, bw * 0.62, bh * 0.66, bw * 0.4, 0, 0.62, bw * 0.42, torso);
    }
    if (L.bib) {
      const bibTex = canvasTex('bib' + L.bib, 128, 128, (x) => { x.fillStyle = '#e9e3d2'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#7a1414'; x.font = 'bold 30px Georgia'; x.textAlign = 'center'; x.fillText(L.bib, 64, 74); });
      mesh(new T3.PlaneGeometry(1, 1), new T3.MeshStandardMaterial({ map: bibTex, roughness: 0.9 }), 0.95, 0.9, 1, 0, 0.75, bw * 0.87, torso);
    }
    if (L.vest) {
      const vm = new T3.MeshStandardMaterial({ color: new T3.Color(L.vest), roughness: 0.85, map: wornTex(5, 0.7) });
      for (const s of [-1, 1]) mesh(geo.sph, vm, bw * 0.42, bh * 0.85, bw * 0.38, s * bw * 0.6, 0.75, bw * 0.38, torso);
      for (let i = 0; i < 3; i++) blob(M.gold, 0.04, 0.04, 0.03, -0.32, 0.4 + i * 0.3, bw * 0.79, torso);
    }
    if (L.bow) { const bm = new T3.MeshStandardMaterial({ color: new T3.Color(L.bow), roughness: 0.5 }); blob(bm, 0.2, 0.12, 0.08, -0.18, 1.6, bw * 0.55, torso); blob(bm, 0.2, 0.12, 0.08, 0.18, 1.6, bw * 0.55, torso); blob(bm, 0.07, 0.07, 0.07, 0, 1.6, bw * 0.62, torso); }
    if (dmg > 0) {
      const r = A.rng(L.seed || 3);
      for (let i = 0; i < 3 + dmg * 3; i++) {
        const a = (r() - 0.5) * 1.6, y = 0.35 + r() * 0.8;
        const hole = blob(M.black, 0.12 + r() * 0.12, 0.1 + r() * 0.1, 0.05, Math.sin(a) * bw * 0.98, y, Math.cos(a) * bw * 0.74, torso);
        hole.lookAt(0, y, 0); hole.rotateY(Math.PI);
        tube([[Math.sin(a) * bw * 0.9, y, Math.cos(a) * bw * 0.7], [Math.sin(a) * bw * 1.05, y - 0.2, Math.cos(a) * bw * 0.8], [Math.sin(a) * bw * 1.0, y - 0.5, Math.cos(a) * bw * 0.7]], 0.012, M.wire, torso);
      }
    }
    if (L.tail === 'ringed') { const tp = pivot(torso, 0.3, 0.1, -0.6); parts.tail = tp; for (let i = 0; i < 6; i++) blob(i % 2 ? M.black : M.fur, 0.18 - i * 0.012, 0.16 - i * 0.012, 0.2, i * 0.12, i * 0.14, -i * 0.12, tp); }
    if (L.tail === 'croc') { const tp = pivot(torso, 0, 0.1, -0.5); parts.tail = tp; blob(M.dark, 0.3, 0.25, 0.9, 0, -0.3, -0.6, tp); }

    // arms
    parts.arms = [];
    for (const s of [-1, 1]) {
      const sh = pivot(torso, s * (bw - 0.06), 1.25, 0);
      blob(M.metal, 0.12, 0.12, 0.12, 0, 0, 0, sh);
      rod(M.metal, 0.75, 0.05, sh);
      const bare = dmg > 0.6 && s < 0;
      if (!bare) blob(M.fur, 0.24, 0.44, 0.24, 0, -0.37, 0, sh);
      const el = pivot(sh, 0, -0.75, 0);
      blob(M.metal, 0.08, 0.08, 0.08, 0, 0, 0, el);
      rod(M.metal, 0.62, 0.045, el);
      if (!bare) {
        blob(M.dark, 0.2, 0.38, 0.2, 0, -0.33, 0, el);
        const handM = L.hand ? new T3.MeshStandardMaterial({ color: new T3.Color(L.hand), roughness: 0.6 }) : M.fur;
        blob(handM, 0.22, 0.2, 0.18, 0, -0.68, 0, el);
        for (let i = -1; i <= 1; i++) { const f = pivot(el, i * 0.09, -0.8, 0.03); rod(handM, 0.2, 0.04, f); }
      } else for (let i = -1; i <= 1; i++) { const f = pivot(el, i * 0.06, -0.62, 0); rod(M.metal, 0.26, 0.02, f); }
      if (s > 0 && L.prop === 'mic') { const mic = pivot(el, 0, -0.7, 0.1); rod(M.black, 0.5, 0.03, mic, 0.5); blob(M.metal, 0.1, 0.12, 0.1, 0, 0.55, 0, mic); parts.mic = mic; }
      if (s < 0 && L.prop === 'lantern') {
        const ln = pivot(el, 0, -0.9, 0.05);
        rod(M.black, 0.3, 0.015, ln);
        const lm = new T3.MeshStandardMaterial({ color: 0xffc060, emissive: 0xffa030, emissiveIntensity: 1.2, transparent: true, opacity: 0.9 });
        blob(lm, 0.14, 0.2, 0.14, 0, -0.5, 0, ln);
        const sp = new T3.Sprite(new T3.SpriteMaterial({ map: glowTex(), color: 0xffaa40, blending: T3.AdditiveBlending, depthWrite: false, transparent: true }));
        sp.scale.set(1.4, 1.4, 1); sp.position.set(0, -0.5, 0); ln.add(sp); parts.glows.push({ sp, base: 0.9 });
      }
      parts.arms.push({ sh, el, s });
    }
    if (L.prop === 'bass') {
      const bass = pivot(torso, 0, 0.6, bw * 0.8);
      bass.rotation.z = -0.55;
      blob(M.accent, 0.46, 0.34, 0.1, -0.1, 0, 0, bass); blob(M.accent, 0.36, 0.28, 0.1, 0.22, 0, 0, bass);
      blob(M.black, 0.12, 0.12, 0.02, 0.05, 0, 0.1, bass);
      mesh(geo.box, new T3.MeshStandardMaterial({ color: 0x3a2615, roughness: 0.7 }), 1.3, 0.11, 0.06, 0.95, 0, 0, bass);
      parts.bass = bass;
    }

    // head
    const hw = L.head.rx * U, hh = L.head.ry * U;
    const neck = pivot(torso, 0, 1.62, 0);
    rod(M.metal, 0.5, 0.07, neck, 0.5);
    const head = pivot(neck, 0, hh * 0.92 + 0.22, 0);
    parts.neck = neck; parts.head = head;
    if (L.wires) for (let i = 0; i < L.wires; i++) { const s = i % 2 ? 1 : -1; tube([[s * hw * 0.5, hh * 0.6, -0.1], [s * (hw + 0.4 + i * 0.07), hh * 0.3 - i * 0.2, 0], [s * (hw * 0.8 + i * 0.1), -hh * 0.4 - i * 0.2, 0.1]], 0.012, M.wire, head); }
    buildHead(head, L, M, hw, hh, parts);
    root.userData = parts;
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    return root;
  }

  function addEyes(head, L, M, parts, ex, ey, ez, er, ry = 1) {
    for (const s of [-1, 1]) {
      const missing = (L.damage || 0) > 0.5 && s < 0 && L.loseEye !== false;
      blob(M.black, er * 1.25, er * 1.25 * ry, er * 0.7, s * ex, ey, ez, head);
      if (missing) continue;
      if (L.eyeWhite !== false) blob(M.eyeball, er * 0.95, er * 0.95 * ry, er * 0.6, s * ex, ey, ez + er * 0.15, head);
      const iris = blob(M.iris, er * 0.38, er * 0.38 * ry, er * 0.2, s * ex, ey, ez + er * 0.62, head);
      const sp = new T3.Sprite(new T3.SpriteMaterial({ map: glowTex(), color: new T3.Color(L.eye), blending: T3.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
      sp.scale.set(er * 5, er * 5, 1); sp.position.set(s * ex, ey, ez + er * 0.9); head.add(sp);
      parts.eyes.push({ iris, sp, s, baseX: s * ex, er });
      const lids = L.lids === undefined ? ['badger', 'goat', 'croc', 'raccoon'].includes(L.kind) : !!L.lids;
      if (lids) { const lid = new T3.Mesh(new T3.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.dark); lid.scale.set(er * 1.35, er * 1.1, er * 0.9); lid.position.set(s * ex, ey + er * 0.1, ez + er * 0.1); lid.rotation.set(0.5, 0, s * 0.25); head.add(lid); parts.hide.push({ o: lid, onAttack: true }); }
    }
  }
  function jawWithTeeth(head, M, w, depth, y, z, m, parts, sharp) {
    const jaw = pivot(head, 0, y, z - depth * 0.4);
    blob(m, w * 0.5, 0.09, depth * 0.55, 0, -0.06, depth * 0.45, jaw);
    blob(M.black, w * 0.42, 0.06, depth * 0.45, 0, 0.0, depth * 0.45, jaw);
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1) - 0.5) * 2.2, tx = Math.sin(a) * w * 0.4, tz = depth * 0.45 + Math.cos(a) * depth * 0.4;
      if (sharp) mesh(geo.cone, M.teeth, 0.025, 0.08, 0.025, tx, 0.03, tz, jaw);
      else mesh(geo.box, M.teeth, w * 0.09, 0.07, 0.03, tx, 0.03, tz, jaw);
    }
    // upper teeth fixed on the head
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1) - 0.5) * 2.2, tx = Math.sin(a) * w * 0.42, tz = z + Math.cos(a) * depth * 0.42 - depth * 0.05;
      if (sharp) { const tt = mesh(geo.cone, M.teeth, 0.028, 0.09, 0.028, tx, y + 0.02, tz, head); tt.rotation.x = Math.PI; }
      else mesh(geo.box, M.teeth, w * 0.09, 0.08, 0.03, tx, y + 0.03, tz, head);
    }
    parts.jaw = jaw;
    return jaw;
  }

  function buildHead(head, L, M, hw, hh, parts) {
    const k = L.kind;
    if (k === 'badger') {
      blob(M.fur, hw, hh, hw * 0.9, 0, 0, 0, head);
      for (const s of [-1, 1]) { blob(M.dark, 0.2, 0.18, 0.1, s * hw * 0.72, hh * 0.82, -0.05, head); blob(M.black, hw * 0.3, hh * 0.62, hw * 0.25, s * hw * 0.42, -hh * 0.05, hw * 0.6, head).rotation.z = s * 0.25; }
      blob(new T3.MeshStandardMaterial({ color: new T3.Color(L.stripe || '#ece6d8'), roughness: 0.8, map: wornTex(L.seed, 0.6) }), hw * 0.15, hh * 0.42, hw * 0.1, 0, hh * 0.55, hw * 0.72, head);
      blob(M.belly, hw * 0.56, hh * 0.36, hw * 0.55, 0, -hh * 0.38, hw * 0.55, head);
      blob(M.black, 0.15, 0.1, 0.1, 0, -hh * 0.18, hw * 1.05, head);
      if (L.hat) { const hm = new T3.MeshStandardMaterial({ color: 0x161414, roughness: 0.7, map: wornTex(3, 0.4) }); mesh(geo.cyl, hm, hw * 0.78, 0.06, hw * 0.78, 0, hh * 0.92, 0, head); mesh(geo.cyl, hm, hw * 0.42, 0.62, hw * 0.42, 0, hh * 0.92 + 0.33, 0, head); mesh(geo.cyl, M.accent, hw * 0.43, 0.1, hw * 0.43, 0, hh * 0.92 + 0.12, 0, head); }
      addEyes(head, L, M, parts, hw * 0.4, hh * 0.1, hw * 0.72, hw * 0.16);
      jawWithTeeth(head, M, hw * 0.75, hw * 0.75, -hh * 0.55, hw * 0.4, M.belly, parts);
    } else if (k === 'goat') {
      blob(M.fur, hw, hh, hw * 0.9, 0, 0, 0, head);
      const hornM = new T3.MeshStandardMaterial({ color: new T3.Color(L.horn || '#b5a98f'), roughness: 0.6, map: wornTex(L.seed + 3, 0.8), bumpMap: wornTex(L.seed + 3, 0.8), bumpScale: 0.02 });
      for (const s of [-1, 1]) { const hp = pivot(head, s * hw * 0.45, hh * 0.7, -0.05); const horn = new T3.Mesh(new T3.TorusGeometry(0.32, 0.08, 8, 20, Math.PI * 1.3), hornM); horn.rotation.set(0, s > 0 ? 0 : Math.PI, 0.6 * s); horn.position.set(s * 0.25, 0.1, 0); hp.add(horn); blob(M.dark, 0.26, 0.11, 0.1, s * hw * 1.05, hh * 0.15, 0, head).rotation.z = s * 0.5; }
      blob(M.belly, hw * 0.46, hh * 0.36, hw * 0.55, 0, -hh * 0.3, hw * 0.55, head);
      for (const s of [-1, 1]) blob(M.black, 0.05, 0.07, 0.03, s * 0.11, -hh * 0.18, hw * 1.08, head);
      const beard = mesh(geo.cone, M.belly, 0.2, 0.45, 0.12, 0, -hh * 1.2, hw * 0.55, head); beard.rotation.x = Math.PI;
      addEyes(head, L, M, parts, hw * 0.48, hh * 0.15, hw * 0.72, hw * 0.17, 0.7);
      jawWithTeeth(head, M, hw * 0.8, hw * 0.75, -hh * 0.68, hw * 0.55, M.fur, parts);
    } else if (k === 'owl') {
      blob(M.fur, hw, hh, hw * 0.85, 0, 0, 0, head);
      for (const s of [-1, 1]) { const tf = mesh(geo.cone, M.dark, 0.16, 0.5, 0.1, s * hw * 0.75, hh * 1.05, 0, head); tf.rotation.z = -s * 0.5; blob(M.belly, hw * 0.44, hh * 0.52, 0.12, s * hw * 0.42, hh * 0.05, hw * 0.7, head); }
      addEyes(head, L, M, parts, hw * 0.42, hh * 0.05, hw * 0.78, hw * 0.24);
      const beakM = new T3.MeshStandardMaterial({ color: new T3.Color(L.accent || '#d98c1c'), roughness: 0.5 });
      const beak = mesh(geo.cone, beakM, 0.12, 0.34, 0.12, 0, -hh * 0.2, hw * 0.95, head); beak.rotation.x = Math.PI * 0.85;
      const jaw = pivot(head, 0, -hh * 0.35, hw * 0.85); const lb = mesh(geo.cone, beakM, 0.1, 0.2, 0.08, 0, -0.06, 0.06, jaw); lb.rotation.x = Math.PI * 0.75;
      for (let i = 0; i < 4; i++) mesh(geo.cone, M.teeth, 0.015, 0.05, 0.015, (i - 1.5) * 0.04, 0.0, 0.1, jaw);
      parts.jaw = jaw;
    } else if (k === 'croc') {
      blob(M.fur, hw * 0.9, hh * 0.85, hw * 0.9, 0, hh * 0.15, 0, head);
      for (const s of [-1, 1]) blob(M.dark, 0.26, 0.2, 0.22, s * hw * 0.45, hh * 0.75, hw * 0.3, head);
      for (let i = 0; i < 10; i++) blob(M.dark, 0.07, 0.05, 0.03, ((i % 5) - 2) * 0.22, hh * 0.55 - Math.floor(i / 5) * 0.2, hw * 0.82, head);
      if (L.cap) { const cm = new T3.MeshStandardMaterial({ color: new T3.Color(L.cap), roughness: 0.8, map: wornTex(L.seed + 1, 0.5) }); blob(cm, hw * 0.5, 0.16, hw * 0.5, 0, hh * 1.0, 0, head); mesh(geo.cyl, cm, hw * 0.55, 0.04, hw * 0.55, 0, hh * 0.95, 0.05, head); }
      addEyes(head, L, M, parts, hw * 0.45, hh * 0.72, hw * 0.58, hw * 0.13, 0.6);
      // long snout pointing at the viewer
      const snout = blob(M.fur, hw * 1.0, hh * 0.32, hw * 1.25, 0, -hh * 0.2, hw * 0.75, head);
      for (const s of [-1, 1]) blob(M.black, 0.06, 0.04, 0.04, s * 0.15, -hh * 0.02, hw * 1.95, head);
      for (let i = 0; i < 9; i++) { const a = (i / 8 - 0.5) * 2.4; const t = mesh(geo.cone, M.teeth, 0.035, 0.12, 0.035, Math.sin(a) * hw * 0.92, -hh * 0.48, hw * 0.75 + Math.cos(a) * hw * 1.1, head); t.rotation.x = Math.PI; }
      const jaw = pivot(head, 0, -hh * 0.5, 0);
      blob(M.dark, hw * 0.95, hh * 0.22, hw * 1.2, 0, -0.08, hw * 0.75, jaw);
      blob(M.black, hw * 0.85, 0.05, hw * 1.05, 0, 0.04, hw * 0.75, jaw);
      for (let i = 0; i < 9; i++) { const a = (i / 8 - 0.5) * 2.4; mesh(geo.cone, M.teeth, 0.03, 0.1, 0.03, Math.sin(a) * hw * 0.85, 0.06, hw * 0.75 + Math.cos(a) * hw * 1.0, jaw); }
      parts.jaw = jaw; parts.snout = snout;
    } else if (k === 'panda') {
      blob(M.fur, hw, hh, hw * 0.92, 0, 0, 0, head);
      for (const s of [-1, 1]) { blob(M.black, 0.26, 0.26, 0.12, s * hw * 0.75, hh * 0.8, 0, head); blob(M.black, hw * 0.28, hh * 0.38, 0.1, s * hw * 0.4, 0.02, hw * 0.78, head).rotation.z = -s * 0.5; blob(M.pink, 0.15, 0.1, 0.03, s * hw * 0.62, -hh * 0.35, hw * 0.78, head); }
      blob(M.black, 0.13, 0.09, 0.08, 0, -hh * 0.15, hw * 0.98, head);
      addEyes(head, L, M, parts, hw * 0.4, 0.04, hw * 0.86, hw * 0.13);
      jawWithTeeth(head, M, hw * 0.6, hw * 0.6, -hh * 0.5, hw * 0.5, M.fur, parts);
    } else if (k === 'raccoon') {
      blob(M.fur, hw, hh, hw * 0.9, 0, 0, 0, head);
      for (const s of [-1, 1]) { const ear = mesh(geo.cone, M.dark, 0.2, 0.45, 0.1, s * hw * 0.62, hh * 1.0, 0, head); ear.rotation.z = -s * 0.35; }
      blob(M.black, hw * 0.98, hh * 0.3, hw * 0.4, 0, hh * 0.1, hw * 0.6, head);
      blob(M.belly, hw * 0.5, hh * 0.38, hw * 0.65, 0, -hh * 0.4, hw * 0.55, head);
      blob(M.black, 0.1, 0.08, 0.07, 0, -hh * 0.22, hw * 1.15, head);
      addEyes(head, L, M, parts, hw * 0.42, hh * 0.1, hw * 0.88, hw * 0.15);
      jawWithTeeth(head, M, hw * 0.5, hw * 0.6, -hh * 0.6, hw * 0.55, M.belly, parts, true);
    } else if (k === 'jelly') {
      const bell = new T3.Mesh(new T3.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), M.translucent);
      bell.scale.set(hw * 1.2, hh * 1.1, hw * 1.2); bell.position.y = -hh * 0.1; head.add(bell); parts.bell = bell;
      blob(M.pale, hw * 0.55, hh * 0.6, hw * 0.4, 0, -hh * 0.25, hw * 0.55, head);
      for (const s of [-1, 1]) blob(M.pink, 0.08, 0.05, 0.02, s * hw * 0.35, -hh * 0.4, hw * 0.9, head);
      addEyes(head, L, M, parts, hw * 0.24, -hh * 0.15, hw * 0.86, hw * 0.12);
      jawWithTeeth(head, M, hw * 0.35, hw * 0.3, -hh * 0.62, hw * 0.75, M.pale, parts, true);
    } else if (k === 'doll') {
      blob(M.pale, hw, hh, hw * 0.92, 0, 0, 0, head);
      const hair = new T3.MeshStandardMaterial({ color: 0x2a1b1b, roughness: 0.85 });
      const cap = new T3.Mesh(new T3.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), hair); cap.scale.set(hw * 1.04, hh * 1.04, hw * 0.98); head.add(cap);
      blob(hair, 0.24, 0.2, 0.2, 0, hh * 1.05, -0.05, head);
      for (let i = 0; i < 5; i++) mesh(geo.cone, M.gold, 0.04, 0.16, 0.04, (i - 2) * 0.1, hh * 0.98 + (i % 2 ? 0.1 : 0.04), 0.1, head);
      for (const s of [-1, 1]) { blob(M.pink, 0.14, 0.08, 0.03, s * hw * 0.5, -hh * 0.3, hw * 0.82, head); mesh(geo.box, M.black, 0.015, hh * 0.65, 0.01, s * hw * 0.4, -hh * 0.35, hw * 0.88, head); }
      addEyes(head, Object.assign({}, L), M, parts, hw * 0.36, 0.05, hw * 0.8, hw * 0.16);
      const jaw = pivot(head, 0, -hh * 0.5, hw * 0.85); blob(new T3.MeshStandardMaterial({ color: 0x7a1a2a }), 0.1, 0.05, 0.03, 0, -0.03, 0.02, jaw); parts.jaw = jaw;
    } else if (k === 'tv') {
      const caseM = new T3.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.6, map: wornTex(L.seed, 0.6) });
      mesh(geo.box, caseM, hw * 2, hh * 1.9, hw * 1.4, 0, 0, 0, head);
      const sc = A.canvas(128, 112);
      const st = new T3.CanvasTexture(sc); st.encoding = T3.sRGBEncoding;
      const screen = mesh(new T3.PlaneGeometry(1, 1), new T3.MeshBasicMaterial({ map: st }), hw * 1.45, hh * 1.4, 1, -hw * 0.1, 0, hw * 0.71, head);
      parts.screen = { canvas: sc, tex: st, mesh: screen };
      for (const s of [-1, 1]) { const an = pivot(head, s * 0.2, hh * 0.95, 0); an.rotation.z = -s * 0.5; rod(M.metal, 0.7, 0.015, an, 0.7); }
      blob(M.black, 0.06, 0.06, 0.04, hw * 0.82, -hh * 0.3, hw * 0.71, head); blob(M.black, 0.06, 0.06, 0.04, hw * 0.82, 0, hw * 0.71, head);
      parts.tvEyes = true;
    } else if (k === 'hollow') {
      blob(M.fur, hw, hh * 1.05, hw * 0.9, 0, 0, 0, head);
      addEyes(head, Object.assign({}, L, { eyeWhite: false }), M, parts, hw * 0.36, 0.05, hw * 0.78, hw * 0.2);
      const jaw = pivot(head, 0, -hh * 0.45, hw * 0.75); blob(M.black, hw * 0.45, 0.06, 0.04, 0, -0.04, 0.05, jaw); parts.jaw = jaw;
    } else {
      blob(M.fur, hw, hh, hw, 0, 0, 0, head);
      addEyes(head, L, M, parts, hw * 0.4, 0, hw * 0.8, hw * 0.15);
    }
  }

  // ---------------------------------------------------------------- posing (shares the 2.5D pose maths)
  function applyPose(model, o) {
    const p = model.userData, L = p.L;
    const P = A.pose(L, o);
    const t = P.t;
    p.root.scale.setScalar((L.scale || 1) * 0.9);
    p.body.position.y = -P.bob * U;
    p.torso.rotation.z = -P.lean;
    for (const lg of p.legs) {
      const a = lg.s < 0 ? P.legL : P.legR;
      lg.hip.rotation.x = -a * 1.1;
      lg.knee.rotation.x = Math.max(0, a) * 0.6 + (P.p === 'slump' ? 0.9 : 0);
      lg.hip.rotation.z = P.p === 'slump' ? lg.s * -0.4 : 0;
    }
    if (P.p === 'slump') { p.body.position.y = -1.0; p.torso.rotation.x = 0.35; } else p.torso.rotation.x = P.p === 'attack' ? 0.25 : 0;
    for (const ar of p.arms) {
      const a = ar.s < 0 ? P.armL : P.armR, f = ar.s < 0 ? P.foreL : P.foreR;
      const reach = P.p === 'attack' ? 1 : 0;
      ar.sh.rotation.z = ar.s * a * (reach ? 0.45 : 1);
      ar.sh.rotation.x = -reach * 1.6 + (P.p === 'walk' ? (ar.s < 0 ? -1 : 1) * Math.sin(P.t * 5) * 0.4 : 0);
      ar.el.rotation.z = ar.s * f * 0.8;
      ar.el.rotation.x = P.p === 'stage' && ar.s > 0 ? -1.1 : -reach * 0.3;
    }
    p.head.rotation.z = -P.tilt;
    p.head.rotation.y = P.look * 0.4 + (P.p === 'peek' ? 0.25 : 0);
    p.head.rotation.x = P.p === 'attack' ? -0.15 : P.p === 'slump' ? 0.5 : 0;
    if (p.jaw) p.jaw.rotation.x = P.jaw * 0.6;
    if (p.tail) p.tail.rotation.y = Math.sin(t * 2) * 0.3;
    if (p.tentacles) p.tentacles.forEach((segs, i) => segs.forEach((s, k) => { s.rotation.x = Math.sin(t * 1.8 + i + k * 0.7) * 0.25; s.rotation.z = Math.cos(t * 1.4 + i * 1.3 + k) * 0.2; }));
    if (p.bell) p.bell.scale.y = (L.head.ry * U) * 1.1 * (1 + Math.sin(t * 2.4) * 0.06);
    // eyes: glow strength and flicker, attack pose shows every lid open
    const eyes = Math.max(0, o.eyes ?? 1);
    for (const e of p.eyes) {
      const flick = 0.85 + Math.sin(t * 37 + e.s) * 0.08 + (Math.random() < 0.02 ? -0.5 : 0);
      const a = Math.max(0, eyes * flick);
      e.iris.material.emissiveIntensity = 0.2 + a * 2.2;
      e.sp.material.opacity = a * 0.9;
      e.sp.visible = a > 0.02;
      e.iris.position.x = e.baseX + P.look * e.er * 0.3;
    }
    for (const h of p.hide) if (h.onAttack) h.o.visible = P.p !== 'attack';
    for (const g of p.glows) g.sp.material.opacity = g.base * (0.8 + Math.random() * 0.2);
    if (p.screen) drawScreen(p, t, L, P, eyes);
    return P;
  }
  function drawScreen(p, t, L, P, eyes) {
    const c = p.screen.canvas, x = c.getContext('2d'), w = c.width, h = c.height;
    x.fillStyle = '#081009'; x.fillRect(0, 0, w, h);
    const r = A.rng(Math.floor(t * 20));
    for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(200,255,220,${r() * 0.3})`; x.fillRect(r() * w, r() * h, 4 + r() * 18, 2); }
    x.fillStyle = A.rgba(L.eye, Math.min(1, 0.3 + eyes)); x.shadowColor = L.eye; x.shadowBlur = 12;
    A.ell(x, w * 0.33, h * 0.38, 10, 10, A.rgba(L.eye, Math.min(1, 0.3 + eyes))); A.ell(x, w * 0.67, h * 0.38, 10, 10, A.rgba(L.eye, Math.min(1, 0.3 + eyes)));
    x.strokeStyle = A.rgba(L.eye, Math.min(1, 0.3 + eyes)); x.lineWidth = 5; x.beginPath(); x.arc(w / 2, h * 0.5, w * 0.28, 0.25, Math.PI - 0.25); x.stroke();
    if (P.jaw > 0.1) { x.fillStyle = '#000'; x.fillRect(w * 0.25, h * 0.62, w * 0.5, h * 0.3 * P.jaw); }
    x.shadowBlur = 0;
    p.screen.tex.needsUpdate = true;
  }
  G3.build = build;
  G3.applyPose = applyPose;

  // ---------------------------------------------------------------- sprite renderer (3D model -> any 2D canvas)
  let R = null, scene, cam, key, rim, amb, fill, maxH = 768;
  const models = {};
  const VW = 3.83, VH = 5.0, FOOT = 0.08, DIST = 14;
  function initSprite() {
    const cv = document.createElement('canvas');
    const q = FN.Save.data.settings.quality;
    maxH = FN.Save.data.settings.perf ? 384 : q === 'high' ? 1024 : q === 'low' ? 448 : 704;
    cv.width = Math.ceil((maxH * VW) / VH); cv.height = maxH;
    R = new T3.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    R.setPixelRatio(1);
    R.setSize(cv.width, cv.height, false);
    R.outputEncoding = T3.sRGBEncoding;
    R.setClearColor(0x000000, 0);
    R.setScissorTest(true);
    scene = new T3.Scene();
    cam = new T3.PerspectiveCamera((2 * Math.atan(VH / 2 / DIST) * 180) / Math.PI, VW / VH, 1, 40);
    cam.position.set(0, VH / 2 - FOOT, DIST);
    cam.lookAt(0, VH / 2 - FOOT, 0);
    amb = new T3.AmbientLight(0x9aa0b0, 0.2);
    key = new T3.DirectionalLight(0xffe2c0, 1.4); key.position.set(-4, 7, 6);
    rim = new T3.DirectionalLight(0x8fb0ff, 1.1); rim.position.set(5, 4, -6);
    fill = new T3.DirectionalLight(0xff8060, 0.25); fill.position.set(2, -3, 5);
    scene.add(amb, key, rim, fill);
    G3.spriteCanvas = cv;
  }
  G3.drawChar = function (ctx, id, x, y, h, o) {
    try {
      if (!R) initSprite();
      const model = models[id] || (models[id] = build(id));
      const ph = Math.min(maxH, Math.max(16, Math.round((h * VH) / 4.4)));
      const pw = Math.ceil((ph * VW) / VH);
      scene.add(model);
      applyPose(model, o);
      model.scale.x = (o.flip ? -1 : 1) * Math.abs(model.scale.x);
      const light = o.light ?? 1;
      amb.intensity = 0.18 * light; key.intensity = 1.6 * light; rim.intensity = 1.4 * light; fill.intensity = 0.25 * light;
      if (o.scare) {
        // jumpscare lighting: harsh red light from below, cold rim, almost no ambient
        key.position.set(1, -6, 7); key.color.setHex(0xff4a28); key.intensity = 1.9;
        rim.intensity = 2.2; amb.intensity = 0.04; fill.intensity = 0;
        if (model.userData.jaw) model.userData.jaw.rotation.x = 0.75 + Math.random() * 0.25;
      } else { key.position.set(-4, 7, 6); key.color.setHex(0xffe2c0); }
      R.setViewport(0, 0, pw, ph); R.setScissor(0, 0, pw, ph);
      R.clear();
      R.render(scene, cam);
      scene.remove(model);
      const dh = (h * VH) / 4.4, dw = (dh * VW) / VH;
      const crop = o.crop || 1;
      const srcY = R.domElement.height - ph;
      ctx.save();
      if (o.alpha != null) ctx.globalAlpha *= o.alpha;
      ctx.drawImage(R.domElement, 0, srcY, pw, ph * crop, x - dw / 2, y - dh, dw, dh * crop);
      ctx.restore();
      return true;
    } catch (e) {
      console.error('3D disabled:', e);
      G3.enabled = false;
      return false;
    }
  };

  /** Called at boot: decides whether 3D is used (WebGL present + setting on). */
  G3.setup = function () {
    let gl = false;
    try { const c = document.createElement('canvas'); gl = !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) {}
    G3.ok = gl;
    G3.enabled = gl && FN.Save.data.settings.render3d !== false;
  };
  /** Rebuild renderers after a quality change. */
  G3.reset = function () {
    if (R) { R.dispose(); R = null; }
    for (const k in models) delete models[k];
  };
})(window.FN);
