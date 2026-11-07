/* FAZNIGHT — full 3D offices (Three.js). The night logic stays in chapter1/2.js; these classes
   only build the rooms and mirror the night state (doors, lights, characters, power) every frame. */
(function (FN) {
  const T3 = window.THREE;
  if (!T3) return;
  const A = FN.Art, R = FN.Rooms, G3 = FN.G3;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------------------------------------------------------------- textures
  const tex = (key, w, h, draw, rep) => G3.canvasTex(key, w, h, draw, rep);
  const checker = (key, c1, c2, n, rep) => tex(key, 256, 256, (x, w) => {
    const s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { x.fillStyle = (i + j) % 2 ? c1 : c2; x.fillRect(i * s, j * s, s, s); }
    A.grime(x, 0, 0, w, w, 77, 40, '#000000', 0.25);
  }, rep);
  const hazard = () => tex('hazard', 256, 64, (x, w, h) => { x.fillStyle = '#151515'; x.fillRect(0, 0, w, h); x.fillStyle = '#e6b800'; for (let i = -2; i < 12; i++) { x.beginPath(); x.moveTo(i * 32, h); x.lineTo(i * 32 + 16, h); x.lineTo(i * 32 + 48, 0); x.lineTo(i * 32 + 32, 0); x.fill(); } A.grime(x, 0, 0, w, h, 4, 20, '#000', 0.4); }, [3, 1]);
  const shutterTex = () => tex('shutter', 128, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#3a3d40'); g.addColorStop(0.5, '#7a7f85'); g.addColorStop(1, '#3a3d40');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) { x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillRect(0, y, w, 3); x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(0, y + 3, w, 1); }
    A.grime(x, 0, 0, w, h, 8, 40, '#3a2410', 0.35);
  });
  function screenTex(key, lines, color = 'rgba(110,255,140,0.85)') {
    return tex(key, 256, 160, (x, w, h) => {
      x.fillStyle = '#06100a'; x.fillRect(0, 0, w, h);
      x.fillStyle = color; x.font = '18px Courier New';
      lines.forEach((l, i) => x.fillText(l, 14, 30 + i * 24));
      for (let y = 0; y < h; y += 3) { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0, y, w, 1); }
    });
  }
  function std(color, o = {}) { return new T3.MeshStandardMaterial(Object.assign({ color: new T3.Color(color), roughness: 0.85, metalness: 0.05 }, o)); }
  function box(m, w, h, d, x, y, z, parent, shadow = true) {
    const o = new T3.Mesh(new T3.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = true;
    parent.add(o); return o;
  }
  function plane(m, w, h, x, y, z, ry, parent, rx = 0) {
    const o = new T3.Mesh(new T3.PlaneGeometry(w, h), m);
    o.position.set(x, y, z); o.rotation.set(rx, ry, 0); o.receiveShadow = true;
    parent.add(o); return o;
  }

  // ---------------------------------------------------------------- atmosphere (v1.3)
  const beamTex = () => tex('beam', 64, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    const s = x.createLinearGradient(0, 0, w, 0); s.addColorStop(0, 'rgba(0,0,0,1)'); s.addColorStop(0.5, 'rgba(0,0,0,0)'); s.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out'; x.fillStyle = s; x.fillRect(0, 0, w, h);
  });
  /** Visible light shaft: an additive cone from `from` towards `to`. Opacity follows the light. */
  function beam(scene, from, to, radius, color) {
    const len = from.distanceTo(to);
    const g = new T3.ConeGeometry(radius, len, 24, 1, true); g.translate(0, -len / 2, 0); g.rotateX(-Math.PI / 2);
    const m = new T3.MeshBasicMaterial({ map: beamTex(), color, transparent: true, opacity: 0, blending: T3.AdditiveBlending, depthWrite: false, side: T3.DoubleSide });
    // map the gradient along the cone length
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i));
    const o = new T3.Mesh(g, m); o.position.copy(from); o.lookAt(to); o.renderOrder = 5; o.frustumCulled = false;
    scene.add(o); return o;
  }
  /** Dust motes drifting in the air, brighter inside light shafts. */
  function dust(scene, box, n = 220) {
    const pos = new Float32Array(n * 3), seed = A.rng(91);
    for (let i = 0; i < n; i++) { pos[i * 3] = box.min.x + seed() * (box.max.x - box.min.x); pos[i * 3 + 1] = box.min.y + seed() * (box.max.y - box.min.y); pos[i * 3 + 2] = box.min.z + seed() * (box.max.z - box.min.z); }
    const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.BufferAttribute(pos, 3));
    const m = new T3.PointsMaterial({ size: 0.012, color: 0xfff0d0, transparent: true, opacity: 0.35, blending: T3.AdditiveBlending, depthWrite: false, map: G3.glowTex() });
    const p = new T3.Points(g, m); scene.add(p);
    return { p, box, n, update(t) { const a = g.attributes.position; for (let i = 0; i < n; i++) { let y = a.getY(i) + Math.sin(t * 0.3 + i) * 0.0008 - 0.0004; if (y < box.min.y) y = box.max.y; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(t * 0.2 + i * 1.7) * 0.0006); } a.needsUpdate = true; } };
  }

  // ---------------------------------------------------------------- base
  class Office3D {
    constructor(night) {
      this.n = night;
      const st = FN.Save.data.settings;
      this.scaleRes = st.perf ? 0.5 : st.quality === 'high' ? 1 : st.quality === 'low' ? 0.55 : 0.75;
      const cv = document.createElement('canvas');
      this.R = new T3.WebGLRenderer({ canvas: cv, antialias: st.quality !== 'low' && !st.perf, powerPreference: 'high-performance' });
      this.R.setPixelRatio(1);
      this.R.outputEncoding = T3.sRGBEncoding;
      this.R.shadowMap.enabled = !!st.shadows && !st.perf;
      this.R.shadowMap.type = T3.PCFSoftShadowMap;
      this.R.toneMapping = T3.ACESFilmicToneMapping;
      this.R.toneMappingExposure = 1.15;
      this.scene = new T3.Scene();
      this.scene.background = new T3.Color(0x000000);
      this.scene.fog = new T3.Fog(0x000000, 4, 16);
      this.cam = new T3.PerspectiveCamera(60, 2, 0.05, 60);
      this.cam.position.set(0, 1.35, 0.9);
      this.models = {};
      this.pickables = [];
      this.ray = new T3.Raycaster();
      this.yawMax = 0.5;
      // first-person arms of the guard, attached to the camera
      if (FN.Models) {
        this.fp = FN.Models.buildArms();
        this.cam.add(this.fp.root);
        this.scene.add(this.cam);
        this.fpK = { L: 0, R: 0, tab: 0, fl: 0 };
      }
    }
    /** Animate the guard's hands: reaching for door panels, holding the tablet, the flashlight or the mask. */
    updateArms(t) {
      const fp = this.fp; if (!fp) return;
      const n = this.n, k = this.fpK;
      const tg = this.armTargets ? this.armTargets(t) : { L: 0, R: 0, tab: 0, fl: 0 };
      for (const key in k) k[key] += (tg[key] - k[key]) * 0.25;
      const [aL, aR] = fp.arms;
      const breathe = Math.sin(t * 1.4) * 0.01;
      const reach = (a, v) => { a.a.rotation.set(0.3 + Math.max(v, k.tab) * 1.55 + breathe, 0, a.s * (0.05 + v * 0.25)); };
      reach(aL, k.L); reach(aR, Math.max(k.R, k.fl * 1.1));
      if (k.fl > 0.01 && tg.flDir != null) aR.a.rotation.y = tg.flDir;
      fp.tab.visible = k.tab > 0.05;
      fp.tab.position.y = -0.6 + k.tab * 0.42;
      fp.fl.visible = k.fl > 0.05;
      fp.lens.material.color.setHex(tg.lit ? 0xfffbe0 : 0x555544);
      FN.Models.curl(aL.hand, k.tab > 0.3 ? 0.5 : 0.25 + k.L * 0.2);
      FN.Models.curl(aR.hand, k.fl > 0.3 ? 0.95 : k.tab > 0.3 ? 0.5 : 0.25 + k.R * 0.2);
      fp.root.visible = !(n.mask && n.maskA > 0.6);
    }
    model(id) {
      if (!this.models[id]) { const m = G3.build(id); m.visible = false; this.scene.add(m); this.models[id] = m; }
      return this.models[id];
    }
    /** Place and pose a character this frame (hidden automatically when not placed). */
    place(id, x, y, z, ry, o, scale = 1) {
      const m = this.model(id);
      m.visible = true; m.position.set(x, y, z); m.rotation.set(0, ry, 0);
      G3.applyPose(m, Object.assign({ t: performance.now() / 1000 }, o));
      m.scale.multiplyScalar(scale); // models are built in metres (~2 m tall)
      m.userData.placed = true;
    }
    resize() {
      const W = Math.max(64, Math.round(this.n.W * this.scaleRes)), H = Math.max(64, Math.round(this.n.H * this.scaleRes));
      if (this.R.domElement.width !== W || this.R.domElement.height !== H) this.R.setSize(W, H, false);
      const aspect = W / H;
      this.cam.aspect = aspect;
      this.cam.fov = aspect < 1 ? 78 : aspect < 1.5 ? 66 : 58;
      this.cam.updateProjectionMatrix();
      const halfH = Math.atan(Math.tan((this.cam.fov * Math.PI) / 360) * aspect);
      this.yawMax = clamp(this.yawReach - halfH, 0.12, 1.15);
    }
    render(t) {
      // adaptive resolution: weaker phones drop resolution, then shadows, to stay smooth
      const now = performance.now();
      this._frames = (this._frames || 0) + 1;
      if (!this._fpsT) this._fpsT = now;
      if (now - this._fpsT > 2000) {
        const fps = (this._frames * 1000) / (now - this._fpsT);
        this._frames = 0; this._fpsT = now;
        if (fps < 24 && this.scaleRes > 0.42) this.scaleRes *= 0.82;
        else if (fps < 24 && this.R.shadowMap.enabled) { this.R.shadowMap.enabled = false; this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); }
      }
      this.resize();
      for (const id in this.models) this.models[id].userData.placed = false;
      this.cam.rotation.set(0, (0.5 - this.n.pan) * 2 * this.yawMax, 0, 'YXZ');
      const sh = this.n.shake;
      if (sh) { this.cam.position.x = (Math.random() - 0.5) * sh * 0.06; this.cam.position.y = 1.35 + (Math.random() - 0.5) * sh * 0.06; } else { this.cam.position.x = 0; this.cam.position.y = 1.35; }
      this.update(t);
      this.updateArms(t);
      for (const id in this.models) if (!this.models[id].userData.placed) this.models[id].visible = false;
      this.R.render(this.scene, this.cam);
      const ctx = this.n.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.R.domElement, 0, 0, this.n.W, this.n.H);
    }
    pick(cx, cy) {
      const r = this.n.canvas.getBoundingClientRect();
      const v = new T3.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      this.ray.setFromCamera(v, this.cam);
      const hit = this.ray.intersectObjects(this.pickables, false)[0];
      return hit ? hit.object.name : null;
    }
    dispose() {
      this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      this.R.dispose();
      this.R.forceContextLoss && this.R.forceContextLoss();
    }
    deskProps(parent, colorTop, colorBody) {
      const top = std(colorTop, { map: G3.wornTex(31, 0.7), roughness: 0.6 });
      box(top, 2.7, 0.07, 1.0, 0, 0.86, -0.2, parent);
      box(std(colorBody, { map: G3.wornTex(32, 0.6) }), 2.6, 0.82, 0.08, 0, 0.42, 0.28, parent);
      for (const s of [-1, 1]) box(std(colorBody), 0.08, 0.82, 0.9, s * 1.28, 0.42, -0.2, parent);
      // fan
      const fan = new T3.Group(); fan.position.set(0.45, 0.9, -0.38); parent.add(fan);
      const dark = std('#1c1c1c', { metalness: 0.6, roughness: 0.4 });
      box(dark, 0.22, 0.04, 0.18, 0, 0, 0, fan);
      box(dark, 0.04, 0.3, 0.04, 0, 0.15, 0, fan);
      const head = new T3.Group(); head.position.set(0, 0.34, 0.03); fan.add(head);
      const cageM = new T3.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.8, roughness: 0.3 });
      for (const r of [0.07, 0.13, 0.19]) head.add(new T3.Mesh(new T3.TorusGeometry(r, 0.004, 4, 24), cageM));
      for (let i = 0; i < 12; i++) { const sp = new T3.Mesh(new T3.BoxGeometry(0.004, 0.38, 0.004), cageM); sp.rotation.z = (i / 12) * Math.PI; sp.position.z = 0.03; head.add(sp); }
      const blades = new T3.Group(); head.add(blades);
      for (let i = 0; i < 3; i++) { const b = new T3.Mesh(new T3.CircleGeometry(0.08, 12), std('#2a2a2a', { side: T3.DoubleSide, metalness: 0.4 })); b.scale.set(0.8, 1.9, 1); b.position.set(0, 0.1, 0); const p = new T3.Group(); p.rotation.z = (i / 3) * Math.PI * 2; p.add(b); blades.add(p); }
      head.add(new T3.Mesh(new T3.SphereGeometry(0.035, 10, 8), dark));
      this.fan = blades;
      return { top };
    }
  }

  // ---------------------------------------------------------------- chapter 1 office
  class Office1 extends Office3D {
    constructor(night) {
      super(night);
      this.yawReach = 1.25;
      const S = this.scene;
      const amb = new T3.AmbientLight(0x8890a0, 0.07); S.add(amb); this.amb = amb;
      const hemi = new T3.HemisphereLight(0x404860, 0x100804, 0.12); S.add(hemi); this.hemi = hemi;
      // room shell
      const floorM = std('#ffffff', { map: checker('floor1', '#c9c0ae', '#141212', 8, [6, 6]), roughness: 0.7 });
      plane(floorM, 6.2, 4.4, 0, 0, -0.5, 0, S, -Math.PI / 2);
      plane(std('#141210', { map: G3.wornTex(51, 0.9) }), 6.2, 4.4, 0, 3, -0.5, 0, S, Math.PI / 2);
      plane(std('#ffffff', { map: this.backWallTex() }), 6.2, 3, 0, 1.5, -2.6, 0, S);
      const sideM = std('#ffffff', { map: this.sideWallTex() });
      for (const s of [-1, 1]) {
        const x = s * 3.05;
        // wall pieces around the door opening (z -2.0 .. -0.8, height 2.3)
        box(sideM, 0.1, 3, 0.6, x, 1.5, -2.3, S);
        box(sideM, 0.1, 3, 2.4, x, 1.5, 0.4, S);
        box(std('#2b2e31', { metalness: 0.4 }), 0.12, 0.7, 1.2, x, 2.65, -1.4, S);
        const hz = plane(std('#ffffff', { map: hazard() }), 1.3, 0.16, x - s * 0.07, 2.38, -1.4, -s * Math.PI / 2, S);
        hz.material.map.repeat.set(3, 1);
        box(std('#2b2e31', { metalness: 0.5, roughness: 0.4 }), 0.18, 2.3, 0.08, x, 1.15, -2.02, S);
        box(std('#2b2e31', { metalness: 0.5, roughness: 0.4 }), 0.18, 2.3, 0.08, x, 1.15, -0.78, S);
        // control panel with the two buttons
        const panel = box(std('#3a3d40', { metalness: 0.5 }), 0.06, 0.5, 0.22, x - s * 0.06, 1.35, -0.55, S);
        const red = new T3.Mesh(new T3.CylinderGeometry(0.05, 0.05, 0.03, 16), std('#7a1010', { emissive: 0x300000 }));
        red.rotation.z = Math.PI / 2; red.position.set(x - s * 0.1, 1.47, -0.55); S.add(red);
        const wht = new T3.Mesh(new T3.CylinderGeometry(0.05, 0.05, 0.03, 16), std('#d8d0b0', { emissive: 0x111111 }));
        wht.rotation.z = Math.PI / 2; wht.position.set(x - s * 0.1, 1.25, -0.55); S.add(wht);
        this['btn' + (s < 0 ? 'L' : 'R')] = { red, wht, panel };
        // shutter
        const sh = box(std('#ffffff', { map: shutterTex(), metalness: 0.7, roughness: 0.45 }), 0.06, 2.3, 1.2, x, 3.45, -1.4, S);
        this['shutter' + (s < 0 ? 'L' : 'R')] = sh;
        // hallway beyond the door
        const hall = new T3.Group(); hall.position.set(s * 3.1, 0, -1.4); S.add(hall);
        const hf = std('#ffffff', { map: checker('hallf', '#b8b0a0', '#1a1816', 8, [4, 1]), roughness: 0.7 });
        plane(hf, 6, 1.2, s * 3, 0.001, 0, 0, hall, -Math.PI / 2);
        const hw = std('#ffffff', { map: this.hallWallTex(s), roughness: 0.9 });
        plane(hw, 6, 2.3, s * 3, 1.15, -0.6, 0, hall);
        plane(hw, 6, 2.3, s * 3, 1.15, 0.6, Math.PI, hall);
        plane(std('#0d0c0b'), 6, 1.2, s * 3, 2.3, 0, 0, hall, Math.PI / 2);
        plane(std('#050505'), 1.2, 2.3, s * 6, 1.15, 0, -s * Math.PI / 2, hall);
        // door light
        const spot = new T3.SpotLight(0xffe2b0, 0, 9, 0.75, 0.6, 1.2);
        spot.position.set(x + s * 0.1, 2.25, -1.4); spot.target.position.set(x + s * 4, 0.3, -1.4);
        spot.castShadow = this.R.shadowMap.enabled; spot.shadow.mapSize.set(512, 512);
        S.add(spot, spot.target);
        this['spot' + (s < 0 ? 'L' : 'R')] = spot;
        const bulb = new T3.Mesh(new T3.SphereGeometry(0.05, 10, 8), new T3.MeshBasicMaterial({ color: 0x333333 }));
        bulb.position.set(x + s * 0.12, 2.25, -1.4); S.add(bulb);
        this['bulb' + (s < 0 ? 'L' : 'R')] = bulb;
      }
      // desk and props
      this.deskProps(S, '#4a3a2a', '#2a1e14');
      const mon = (w, h, x, z, key, lines, ry) => {
        const g = new T3.Group(); g.position.set(x, 0.9, z); g.rotation.y = ry; S.add(g);
        box(std('#2a2a28', { roughness: 0.5 }), w, h, 0.32, 0, h / 2, 0, g);
        const scr = plane(new T3.MeshBasicMaterial({ map: screenTex(key, lines) }), w * 0.82, h * 0.72, 0, h / 2 + 0.01, 0.165, 0, g);
        return scr;
      };
      this.screens = [mon(0.48, 0.4, -0.85, -0.45, 'mon1', ['> SYS OK', '> CAM 11/11', '> PORTES'], 0.25), mon(0.34, 0.3, -0.4, -0.5, 'mon2', [], 0.1), mon(0.52, 0.42, 0.95, -0.45, 'mon3', ['GRIMWOOD', 'SECURE v1.987'], -0.25)];
      const phone = new T3.Group(); phone.position.set(-0.25, 0.9, -0.05); S.add(phone);
      box(std('#2a2826', { roughness: 0.4 }), 0.28, 0.07, 0.18, 0, 0.035, 0, phone);
      box(std('#3a3836', { roughness: 0.35 }), 0.26, 0.05, 0.07, 0, 0.09, -0.04, phone);
      this.phoneLed = new T3.Mesh(new T3.SphereGeometry(0.012, 8, 6), new T3.MeshBasicMaterial({ color: 0xff2010 })); this.phoneLed.position.set(0.11, 0.075, 0.06); phone.add(this.phoneLed);
      const cupTex = tex('cup', 64, 64, (x) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#b11' : '#e8e0d0'; x.fillRect(0, i * 8, 64, 8); } });
      const cup = new T3.Mesh(new T3.CylinderGeometry(0.05, 0.04, 0.16, 16), std('#ffffff', { map: cupTex })); cup.position.set(-1.05, 0.98, 0.05); cup.castShadow = true; S.add(cup);
      plane(std('#d8d0c0', { side: T3.DoubleSide }), 0.3, 0.2, 0.15, 0.895, 0.05, 0, S, -Math.PI / 2).rotation.set(-Math.PI / 2, 0, 0.2);
      // tiny Bruno plush on the desk
      this.plush = G3.build('bruno'); G3.applyPose(this.plush, { t: 2, light: 1, eyes: 0.2 });
      this.plush.scale.setScalar(0.12); this.plush.position.set(1.05, 0.9, -0.1); this.plush.rotation.y = -0.4; S.add(this.plush);
      // ceiling lamp
      const lampG = new T3.Group(); lampG.position.set(0, 3, -0.7); S.add(lampG);
      box(std('#111'), 0.01, 0.6, 0.01, 0, -0.3, 0, lampG, false);
      const shade = new T3.Mesh(new T3.ConeGeometry(0.22, 0.18, 20, 1, true), std('#2a2a2a', { side: T3.DoubleSide, metalness: 0.6 })); shade.position.y = -0.65; lampG.add(shade);
      this.bulb = new T3.Mesh(new T3.SphereGeometry(0.05, 12, 8), new T3.MeshBasicMaterial({ color: 0xffd9a0 })); this.bulb.position.y = -0.72; lampG.add(this.bulb);
      this.lamp = new T3.PointLight(0xffc890, 1.25, 9, 1.6); this.lamp.position.set(0, 2.25, -0.7);
      this.lamp.castShadow = this.R.shadowMap.enabled && FN.Save.data.settings.quality === 'high'; this.lamp.shadow.mapSize.set(1024, 1024); this.lamp.shadow.bias = -0.002;
      S.add(this.lamp);
      // light shafts and dust (v1.3)
      const V = (x, y, z) => new T3.Vector3(x, y, z);
      this.beamLamp = beam(S, V(0, 2.3, -0.7), V(0, 0, -0.9), 1.3, 0xffc890);
      this.beamL = beam(S, V(-3.0, 2.25, -1.4), V(-6.5, 0.2, -1.4), 0.85, 0xffe2b0);
      this.beamR = beam(S, V(3.0, 2.25, -1.4), V(6.5, 0.2, -1.4), 0.85, 0xffe2b0);
      this.dust = dust(S, new T3.Box3(V(-2.8, 0.3, -2.4), V(2.8, 2.6, 0.6)));
      // monitor glow
      this.monGlow = new T3.PointLight(0x60ff90, 0.25, 3, 2); this.monGlow.position.set(0, 1.2, -0.2); S.add(this.monGlow);
      // invisible hit target on Bruno's nose (poster)
      const nose = new T3.Mesh(new T3.SphereGeometry(0.07, 8, 6), new T3.MeshBasicMaterial({ visible: false }));
      nose.name = 'nose'; nose.position.copy(this.nosePos); S.add(nose); this.pickables.push(nose);
    }
    backWallTex() {
      const W = 2048, H = 1024;
      return tex('back1', W, H, (c) => {
        let g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2a2624'); g.addColorStop(1, '#1a1716'); c.fillStyle = g; c.fillRect(0, 0, W, H);
        c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 3;
        for (let y = 0, row = 0; y < 600; y += 48, row++) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); for (let x = (row % 2) * 40; x < W; x += 80) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 48); c.stroke(); } }
        for (let i = 0; i < 64; i++) { c.fillStyle = i % 2 ? '#c9c0ae' : '#151313'; c.fillRect(i * 32, 600, 32, 32); c.fillStyle = i % 2 ? '#151313' : '#c9c0ae'; c.fillRect(i * 32, 632, 32, 32); }
        c.fillStyle = '#5a1010'; c.fillRect(0, 664, W, 26);
        R.poster(c, 470, 110, 300, 410, { title: 'CÉLÉBREZ!', chars: ['gus', 'bruno', 'nora'], seed: 14, charH: 0.62 });
        R.kidDrawing(c, 830, 130, 150, 120, 3); R.kidDrawing(c, 880, 280, 140, 110, 5); R.kidDrawing(c, 1010, 160, 120, 100, 7);
        R.poster(c, 1180, 120, 180, 250, { title: 'KROK', chars: ['krok'], bg: '#1f3a1a', seed: 15, rot: 0.04, torn: true });
        R.kidDrawing(c, 1420, 140, 130, 110, 9); R.kidDrawing(c, 1440, 300, 120, 96, 11);
        R.scrawl(c, 1380, 470, 'ILS BOUGENT LA NUIT', 'rgba(150,20,20,0.6)', 22);
        A.grime(c, 0, 0, W, H, 404, 120, '#000000', 0.3);
        g = c.createLinearGradient(0, 690, 0, H); g.addColorStop(0, '#141210'); g.addColorStop(1, '#0a0908'); c.fillStyle = g; c.fillRect(0, 690, W, H - 690);
      });
    }
    get nosePos() {
      // poster at (470,110) 300x410 on a 2048x1024 texture covering 6.2 x 3 m; Bruno's nose sits at 50.5% / 45%
      const px = 470 + 300 * 0.505, py = 110 + 410 * 0.45;
      return new T3.Vector3(-3.1 + (px / 2048) * 6.2, 3 - (py / 1024) * 3, -2.58);
    }
    sideWallTex() {
      return tex('side1', 512, 512, (c, W, H) => {
        c.fillStyle = '#24201e'; c.fillRect(0, 0, W, H);
        for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#bdb4a2' : '#151313'; c.fillRect(i * 32, 300, 32, 32); }
        c.fillStyle = '#5a1010'; c.fillRect(0, 332, W, 12);
        R.kidDrawing(c, 180, 120, 110, 90, 21);
        A.grime(c, 0, 0, W, H, 61, 60, '#000', 0.35);
      });
    }
    hallWallTex(s) {
      return tex('hallw' + s, 1024, 392, (c, W, H) => {
        c.fillStyle = '#3a3532'; c.fillRect(0, 0, W, H);
        for (let i = 0; i < 32; i++) { c.fillStyle = i % 2 ? '#bdb4a2' : '#1a1a1a'; c.fillRect(i * 32, 230, 32, 28); }
        c.fillStyle = '#1a1a1a'; c.fillRect(0, 258, W, H - 258);
        if (s < 0) R.poster(c, 380, 40, 110, 160, { title: 'RÈGLES', bg: '#2a2a40', seed: 8 }); else { R.kidDrawing(c, 300, 60, 100, 80, 31); R.kidDrawing(c, 560, 90, 90, 70, 33); }
        A.grime(c, 0, 0, W, H, 70 + s, 80, '#000', 0.35);
      });
    }
    armTargets() {
      const n = this.n, now = performance.now();
      const press = n._press && now - n._press.t < 420 ? n._press.side : null;
      return { L: n.lights.L || press === 'L' ? 1 : 0, R: n.lights.R || press === 'R' ? 1 : 0, tab: n.camUp ? 1 : 0, fl: 0 };
    }
    update(t) {
      const n = this.n;
      // fan
      this.fan.rotation.z -= n.out ? 0 : 0.55;
      // lamp flicker / power
      const out = n.out;
      const flick = n.flicker > 0 ? (Math.random() < 0.5 ? 0.2 : 1) : Math.random() < 0.008 ? 0.3 : 1;
      this.lamp.intensity = out ? 0 : 1.25 * flick * (n.silence > 0 ? 0.6 : 1);
      this.bulb.material.color.setHex(out ? 0x111111 : 0xffd9a0);
      this.amb.intensity = out ? 0.015 : 0.07;
      this.hemi.intensity = out ? 0.01 : 0.12;
      this.monGlow.intensity = out ? 0 : 0.25;
      for (const s of this.screens) s.visible = !out;
      this.beamLamp.material.opacity = (this.lamp.intensity / 1.25) * 0.09;
      this.beamL.material.opacity = n.lights.L && n.doorA.L < 0.5 ? 0.26 : 0;
      this.beamR.material.opacity = n.lights.R && n.doorA.R < 0.5 ? 0.26 : 0;
      this.dust.update(t); this.dust.p.material.opacity = out ? 0.05 : 0.3;
      this.phoneLed.visible = !out && Math.floor(t * 2) % 2 === 0;
      for (const side of ['L', 'R']) {
        const x = side === 'L' ? -3.05 : 3.05, sg = side === 'L' ? -1 : 1;
        const d = n.doorA[side];
        this['shutter' + side].position.y = 3.45 - d * 2.3;
        const lit = n.lights[side];
        this['spot' + side].intensity = lit ? 2.2 * (Math.random() < 0.04 ? 0.4 : 1) : 0;
        this['bulb' + side].material.color.setHex(lit ? 0xfff0c0 : 0x222222);
        const b = this['btn' + side];
        b.red.material.emissive.setHex(n.doors[side] ? 0xff2010 : 0x200000);
        b.wht.material.emissive.setHex(lit ? 0xfff0c0 : 0x111111);
        const who = n.atDoor(side);
        if (who) {
          const isB = who === 'bruno';
          this.place(who, x + sg * 0.75, 0, -1.25, sg > 0 ? -Math.PI / 2 + 0.55 : Math.PI / 2 - 0.55, { pose: isB ? 'idle' : 'lean', light: 1, eyes: lit ? 1 : 0.35, jaw: who === 'gus' ? 0.2 : 0 });
        }
      }
      // power-out: Bruno at the left door, face flickering, music box
      if (out && out.phase === 1) {
        const on = Math.sin(t * 9) > 0.2 || Math.random() < 0.1;
        this.place('bruno', -3.6, 0, -1.35, Math.PI / 2 - 0.5, { pose: 'stage', light: 1, eyes: on ? 1 : 0.2, jaw: Math.abs(Math.sin(t * 2)) * 0.4 });
        if (!this.faceLight) { this.faceLight = new T3.PointLight(0xffd080, 0, 2.5, 2); this.scene.add(this.faceLight); }
        this.faceLight.position.set(-3.2, 2.4, -1.0);
        this.faceLight.intensity = on ? 1.1 : 0;
      } else if (this.faceLight) this.faceLight.intensity = 0;
      // Hollow Hank slumped against the back wall
      if (n.hollow) {
        const a = Math.min(1, n.hollow.t * 2);
        this.place('hollow', 0.1, 0, -2.1, 0, { pose: 'slump', light: 1, eyes: a });
      }
    }
  }

  // ---------------------------------------------------------------- chapter 2 office
  class Office2 extends Office3D {
    constructor(night) {
      super(night);
      this.yawReach = 1.05;
      const S = this.scene;
      S.fog = new T3.Fog(0x000000, 3, 15);
      this.amb = new T3.AmbientLight(0x9080c0, 0.08); S.add(this.amb);
      this.hemi = new T3.HemisphereLight(0x5040a0, 0x100818, 0.14); S.add(this.hemi);
      const floorM = std('#ffffff', { map: checker('floor2', '#e8e0f0', '#2a2a6a', 8, [6, 6]), roughness: 0.55 });
      plane(floorM, 6.2, 4.4, 0, 0, -0.5, 0, S, -Math.PI / 2);
      plane(std('#140e20'), 6.2, 4.4, 0, 2.8, -0.5, 0, S, Math.PI / 2);
      const wallM = std('#ffffff', { map: this.wallTex() });
      // back wall with the hallway opening (x -1..1, h 2.4) and two vents (low, x ±2.1)
      for (const s of [-1, 1]) {
        box(wallM, 0.65, 2.8, 0.1, s * 1.325, 1.4, -2.6, S);
        box(wallM, 0.55, 2.8, 0.1, s * 2.825, 1.4, -2.6, S);
        box(wallM, 0.9, 1.92, 0.1, s * 2.1, 1.84, -2.6, S);
        box(wallM, 0.9, 0.12, 0.1, s * 2.1, 0.06, -2.6, S);
      }
      box(wallM, 2.0, 0.4, 0.1, 0, 2.6, -2.6, S);
      box(std('#3a3a4a', { metalness: 0.4 }), 2.2, 0.1, 0.16, 0, 2.42, -2.58, S);
      for (const s of [-1, 1]) box(wallM, 0.1, 2.8, 4.4, s * 3.1, 1.4, -0.5, S);
      // vent frames (openings x: -2.1±0.45 / 2.1±0.45 ; y 0.15..0.85)
      for (const s of [-1, 1]) {
        const vx = s * 2.1;
        const fm = std('#4a4e56', { metalness: 0.7, roughness: 0.4 });
        box(fm, 1.0, 0.06, 0.12, vx, 0.88, -2.58, S); box(fm, 1.0, 0.06, 0.12, vx, 0.12, -2.58, S);
        box(fm, 0.06, 0.8, 0.12, vx - 0.5, 0.5, -2.58, S); box(fm, 0.06, 0.8, 0.12, vx + 0.5, 0.5, -2.58, S);
        // the wall section around the vent hole
        // tunnel
        const tm = std('#6b7178', { metalness: 0.8, roughness: 0.45, map: G3.wornTex(40 + s, 0.8) });
        const tun = new T3.Group(); tun.position.set(vx, 0.5, -2.6); S.add(tun);
        box(tm, 0.9, 0.04, 4, 0, -0.36, -2, tun); box(tm, 0.9, 0.04, 4, 0, 0.36, -2, tun);
        box(tm, 0.04, 0.72, 4, -0.45, 0, -2, tun); box(tm, 0.04, 0.72, 4, 0.45, 0, -2, tun);
        for (let i = 1; i < 8; i++) { const rib = std('#2a2c30', { metalness: 0.8 }); box(rib, 0.92, 0.03, 0.05, 0, 0.35, -i * 0.5, tun); box(rib, 0.92, 0.03, 0.05, 0, -0.35, -i * 0.5, tun); }
        box(std('#000000'), 0.9, 0.72, 0.02, 0, 0, -4, tun);
        // grille slats
        for (let i = 1; i < 6; i++) box(std('#2a2c30', { metalness: 0.7 }), 0.9, 0.015, 0.02, vx, 0.15 + i * 0.12, -2.55, S, false);
        const sp = new T3.SpotLight(0xfff4d8, 0, 6, 0.45, 0.5, 1.2);
        sp.position.set(vx, 0.7, -2.4); sp.target.position.set(vx, 0.3, -6); S.add(sp, sp.target);
        sp.castShadow = this.R.shadowMap.enabled; sp.shadow.mapSize.set(512, 512);
        this['vent' + (s < 0 ? 'L' : 'R')] = sp;
      }
      // hallway
      const hall = new T3.Group(); hall.position.set(0, 0, -2.6); S.add(hall);
      const hf = std('#ffffff', { map: checker('hall2f', '#c8c2d0', '#2a2a6a', 8, [2, 8]), roughness: 0.6 });
      plane(hf, 2, 14, 0, 0.001, -7, 0, hall, -Math.PI / 2);
      const hwM = std('#ffffff', { map: this.hallTex() });
      plane(hwM, 14, 2.4, -1, 1.2, -7, Math.PI / 2, hall); plane(hwM, 14, 2.4, 1, 1.2, -7, -Math.PI / 2, hall);
      plane(std('#0d0a18'), 2, 14, 0, 2.4, -7, 0, hall, Math.PI / 2);
      for (let i = 1; i < 7; i++) { const fr = std('#1a1428', { metalness: 0.3 }); box(fr, 0.08, 2.4, 0.08, -0.96, 1.2, -i * 2, hall); box(fr, 0.08, 2.4, 0.08, 0.96, 1.2, -i * 2, hall); box(fr, 2, 0.08, 0.08, 0, 2.36, -i * 2, hall); }
      // flashlight (from the guard)
      this.flash = new T3.SpotLight(0xfff6e0, 0, 22, 0.3, 0.55, 1.1);
      this.flash.position.set(0.15, 1.2, 0.7); this.flash.target.position.set(0, 1.0, -14);
      this.flash.castShadow = this.R.shadowMap.enabled; this.flash.shadow.mapSize.set(1024, 1024);
      S.add(this.flash, this.flash.target);
      const V = (x, y, z) => new T3.Vector3(x, y, z);
      this.beamF = beam(S, V(0.25, 1.15, -1.2), V(0, 1.0, -12), 1.5, 0xfff6e0);
      this.beamVL = beam(S, V(-2.1, 0.7, -2.4), V(-2.1, 0.3, -6.2), 0.42, 0xfff4d8);
      this.beamVR = beam(S, V(2.1, 0.7, -2.4), V(2.1, 0.3, -6.2), 0.42, 0xfff4d8);
      this.dust = dust(S, new T3.Box3(V(-2.8, 0.3, -9), V(2.8, 2.4, 0.6)), 300);
      // desk
      this.deskProps(S, '#5a5a6a', '#2a2a36');
      const tablet = new T3.Group(); tablet.position.set(-0.4, 0.9, -0.1); tablet.rotation.x = -1.3; S.add(tablet);
      box(std('#1a1a1a', { roughness: 0.3 }), 0.5, 0.34, 0.03, 0, 0, 0, tablet);
      this.tabScreen = plane(new T3.MeshBasicMaterial({ map: screenTex('tab', ['FUN FACTORY', 'CAM 12', '♪ ...'], 'rgba(255,140,200,0.85)') }), 0.44, 0.28, 0, 0, 0.017, 0, tablet);
      const mini = (id, x, ry) => { const m = G3.build(id); G3.applyPose(m, { t: 1, light: 1, eyes: 0.15 }); m.scale.setScalar(0.12); m.position.set(x, 0.9, -0.4); m.rotation.y = ry; S.add(m); };
      mini('pepper', -1.05, 0.3); mini('rico', 1.1, -0.4);
      const conf = ['#ff66cc', '#66ccff', '#ffcc66'];
      for (let i = 0; i < 40; i++) { const r = A.rng(i + 9); const c = new T3.Mesh(new T3.PlaneGeometry(0.02, 0.012), new T3.MeshBasicMaterial({ color: conf[i % 3], side: T3.DoubleSide })); c.position.set((r() - 0.5) * 2.5, 0.895, -0.6 + r() * 0.8); c.rotation.set(-Math.PI / 2, 0, r() * 6); S.add(c); }
      // party lights in the office
      this.lightA = new T3.PointLight(0xff50b0, 0.5, 6, 2); this.lightA.position.set(-2.2, 2.4, -1.2); S.add(this.lightA);
      this.lightB = new T3.PointLight(0x5080ff, 0.5, 6, 2); this.lightB.position.set(2.2, 2.4, -1.2); S.add(this.lightB);
      this.top = new T3.PointLight(0xd8d0ff, 0.6, 7, 1.8); this.top.position.set(0, 2.6, 0); this.top.castShadow = this.R.shadowMap.enabled; S.add(this.top);
    }
    wallTex() {
      return tex('wall2', 1024, 512, (c, W, H) => {
        c.fillStyle = '#241a38'; c.fillRect(0, 0, W, H);
        for (let i = 0; i < 26; i++) { c.fillStyle = i % 2 ? 'rgba(255,111,176,0.12)' : 'rgba(80,140,255,0.1)'; c.fillRect(i * 40, 0, 40, 330); }
        for (let i = 0; i < 32; i++) { c.fillStyle = i % 2 ? '#e8e0f0' : '#2a2a6a'; c.fillRect(i * 32, 330, 32, 26); }
        R.stars(c, 20, 20, W - 40, 30, 77);
        R.poster(c, 80, 70, 150, 210, { title: 'AMUSEZ-VOUS!', chars: ['pepper', 'rico'], bg: '#2a4f8a', seed: 33 });
        R.poster(c, 800, 70, 130, 190, { title: 'LUMI', chars: ['lumi'], bg: '#8a2a6a', seed: 34, rot: 0.03 });
        A.grime(c, 0, 0, W, H, 505, 80, '#000', 0.25);
      }, [1, 1]);
    }
    hallTex() {
      return tex('hall2w', 2048, 352, (c, W, H) => {
        c.fillStyle = '#3a2a52'; c.fillRect(0, 0, W, H);
        for (let i = 0; i < 64; i++) { c.fillStyle = i % 2 ? '#e05a9a' : '#20203a'; c.fillRect(i * 32, 210, 32, 22); }
        c.fillStyle = '#20203a'; c.fillRect(0, 232, W, H - 232);
        R.stars(c, 0, 10, W, 30, 6);
        R.poster(c, 300, 40, 100, 140, { title: 'PEPPER!', chars: ['pepper'], bg: '#2a4f8a', seed: 21 });
        R.kidDrawing(c, 900, 60, 90, 70, 51); R.kidDrawing(c, 1400, 50, 90, 70, 53);
        A.grime(c, 0, 0, W, H, 92, 100, '#000', 0.3);
      });
    }
    armTargets() {
      const n = this.n;
      const lit = n.flash || n.vent.L || n.vent.R;
      return { L: 0, R: 0, tab: n.camUp ? 1 : 0, fl: n.camUp || n.mask ? 0 : lit ? 1 : 0.45, lit, flDir: n.vent.L ? 0.55 : n.vent.R ? -0.55 : 0 };
    }
    update(t) {
      const n = this.n;
      this.fan.rotation.z -= 0.55;
      const flick = n.flicker > 0 ? (Math.random() < 0.5 ? 0.15 : 1) : 1;
      const dim = n.chimeOut ? 0.5 : 1;
      this.top.intensity = 0.6 * flick * dim; this.lightA.intensity = 0.5 * flick * dim * (0.8 + Math.sin(t * 2) * 0.2); this.lightB.intensity = 0.5 * flick * dim * (0.8 + Math.cos(t * 2) * 0.2);
      this.amb.intensity = 0.08 * flick; this.hemi.intensity = 0.14 * flick;
      this.flash.intensity = n.flash ? 3.2 : 0;
      this.ventL.intensity = n.vent.L ? 2.4 : 0; this.ventR.intensity = n.vent.R ? 2.4 : 0;
      this.beamF.material.opacity = n.flash ? 0.17 + Math.random() * 0.015 : 0;
      this.beamVL.material.opacity = n.vent.L ? 0.14 : 0; this.beamVR.material.opacity = n.vent.R ? 0.14 : 0;
      this.dust.update(t);
      const hallZ = -2.6;
      // hallway occupants (lit only by the flashlight; eyes glow in the dark)
      if (n.hollow) this.place('hollow', 0.2, 0, hallZ - 9.5, 0, { pose: 'slump', light: 1, eyes: 1 });
      const k = n.a.oldkrok;
      if (n.room('oldkrok') === 'HALL' && n.level('oldkrok') > 0) {
        const p = clamp(k.hallT / Math.max(8, 18 - n.level('oldkrok') * 0.45), 0, 1);
        this.place('oldkrok', 0.1 + Math.sin(t * 3) * 0.05, 0, hallZ - 11 + p * 9, 0, { pose: 'walk', phase: t * 2, light: 1, eyes: 1, jaw: 0.3 + p * 0.4 });
      }
      if (n.room('pepper') === 'HALL') this.place('pepper', 0.35, 0, hallZ - 6, -0.1, { pose: 'idle', light: 1, eyes: 1 });
      if (n.room('oldbruno') === 'HALL') this.place('oldbruno', -0.35, 0, hallZ - 7.5, 0.1, { pose: 'idle', light: 1, eyes: 1 });
      // vents: crouched inside the tunnel
      if (n.room('rico') === 'VENT_L') this.place('rico', -2.1, 0.14, -3.05, 0, { pose: 'peek', light: 1, eyes: n.vent.L ? 1 : 0.4 }, 0.42);
      if (n.room('lumi') === 'VENT_R') this.place('lumi', 2.1, 0.14, -3.05, 0, { pose: 'float', light: 1, eyes: n.vent.R ? 1 : 0.5 }, 0.4);
      // intruder in the office
      if (n.intr && !n.camUp) {
        const id = n.intr.id;
        this.place(id, 0, 0, -1.05, 0, { pose: id === 'lumi' ? 'float' : 'idle', light: 1, eyes: 1, jaw: 0.15 });
        this.top.intensity *= Math.random() > 0.3 ? 1 : 0.1;
      }
      if (n.chimeOut) {
        const a = clamp(n.chimeOut.t / 10, 0, 1);
        this.place('chime', 0, 0, hallZ - 8 + a * 7.5, 0, { pose: 'dance', light: 1, eyes: 1 });
      }
    }
  }

  FN.Office1 = Office1;
  FN.Office2 = Office2;
})(window.FN);
