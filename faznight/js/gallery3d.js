/* FAZNIGHT — 3D character gallery: orbit, zoom, face/back views, x-ray mechanics, animation clips. */
(function (FN) {
  const T = window.THREE;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  const CLIPS = [
    ['idle', { fr: 'Attente', en: 'Idle' }], ['walk', { fr: 'Marche', en: 'Walk' }], ['run', { fr: 'Course', en: 'Run' }],
    ['look', { fr: 'Regard', en: 'Look' }], ['mouth', { fr: 'Bouche', en: 'Mouth' }], ['eyes', { fr: 'Yeux', en: 'Eyes' }],
    ['attack', { fr: 'Attaque', en: 'Attack' }], ['scare', { fr: 'Jumpscare', en: 'Jumpscare' }],
  ];

  const Gallery = {
    /** Opens the viewer for a discovered character. `list` lets the arrows browse the category. */
    open(id, list, onClose) {
      if (!T || !FN.Models || !FN.G3.enabled) return false;
      const L = (o) => FN.L(o);
      const ov = document.getElementById('overlay');
      ov.className = '';
      ov.innerHTML = `<div class="gal">
        <canvas class="gal-cv"></canvas>
        <div class="gal-top"><button class="back gal-x" aria-label="${FN.t('close')}">✕</button>
          <div class="gal-nav"><button class="gal-prev" aria-label="prev">‹</button><button class="gal-next" aria-label="next">›</button></div></div>
        <div class="gal-info"></div>
        <div class="gal-views"><button data-v="face">${FN.lang === 'en' ? 'Face' : 'Visage'}</button><button data-v="full">${FN.lang === 'en' ? 'Full body' : 'Corps entier'}</button><button data-v="back">${FN.lang === 'en' ? 'Back' : 'Dos'}</button><button data-v="xray">${FN.lang === 'en' ? 'Mechanics' : 'Mécanique'}</button></div>
        <div class="gal-clips">${CLIPS.map(([k, n]) => `<button data-c="${k}">${esc(L(n))}</button>`).join('')}</div>
        <div class="gal-hint">${FN.lang === 'en' ? 'Drag to rotate · pinch or scroll to zoom' : 'Glissez pour tourner · pincez ou molette pour zoomer'}</div>
      </div>`;
      const cv = ov.querySelector('.gal-cv');
      const R = new T.WebGLRenderer({ canvas: cv, antialias: true });
      R.setPixelRatio(Math.min(window.devicePixelRatio || 1, FN.Save.data.settings.quality === 'high' ? 2 : 1.25));
      R.outputEncoding = T.sRGBEncoding;
      R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.1;
      R.shadowMap.enabled = !FN.Save.data.settings.perf; R.shadowMap.type = T.PCFSoftShadowMap;
      const scene = new T.Scene();
      scene.background = new T.Color(0x07060a);
      scene.fog = new T.Fog(0x07060a, 6, 14);
      const cam = new T.PerspectiveCamera(35, 1, 0.05, 50);
      scene.add(new T.HemisphereLight(0x8890b0, 0x1a1008, 0.35));
      const key = new T.SpotLight(0xffe0c0, 2.2, 14, 0.55, 0.6, 1.2); key.position.set(-2.2, 4.2, 3.2); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0015; scene.add(key, key.target);
      const rim = new T.DirectionalLight(0x7f9fff, 1.1); rim.position.set(3, 3, -4); scene.add(rim);
      const fill = new T.PointLight(0xff6040, 0.35, 6); fill.position.set(1.5, 0.6, 2); scene.add(fill);
      const floorT = FN.G3.canvasTex('galfloor', 256, 256, (x, w) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#c9c0ae' : '#141212'; x.fillRect(i * 32, j * 32, 32, 32); } FN.Art.grime(x, 0, 0, w, w, 9, 40, '#000', 0.3); }, [3, 3]);
      const floor = new T.Mesh(new T.CircleGeometry(2.4, 48), new T.MeshStandardMaterial({ map: floorT, roughness: 0.7 }));
      floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
      const ring = new T.Mesh(new T.TorusGeometry(2.4, 0.03, 8, 64), new T.MeshStandardMaterial({ color: 0x5a1010, emissive: 0x300000 })); ring.rotation.x = Math.PI / 2; scene.add(ring);

      const ids = list && list.length ? list : [id];
      let idx = Math.max(0, ids.indexOf(id));
      let model = null, xr = false, clip = 'idle', clipT0 = 0;
      const st = { yaw: 0.35, pitch: 0.12, dist: 4.4, ty: 1.15, tYaw: 0.35, tPitch: 0.12, tDist: 4.4, tTy: 1.15 };
      const setView = (v) => {
        if (v === 'face') Object.assign(st, { tYaw: 0, tPitch: 0.05, tDist: 1.25, tTy: 1.95 });
        if (v === 'full') Object.assign(st, { tYaw: 0.35, tPitch: 0.12, tDist: 4.4, tTy: 1.15 });
        if (v === 'back') Object.assign(st, { tYaw: Math.PI, tPitch: 0.15, tDist: 3.2, tTy: 1.3 });
        if (v === 'xray') { xr = !xr; FN.Models.xray(model, xr); ov.querySelector('[data-v=xray]').classList.toggle('on', xr); if (xr) Object.assign(st, { tDist: 2.6, tTy: 1.4 }); }
        ov.querySelectorAll('[data-v]').forEach((b) => b.dataset.v !== 'xray' && b.classList.toggle('on', b.dataset.v === v));
      };
      const load = () => {
        if (model) { scene.remove(model); model.traverse((o) => o.geometry && o.geometry.type === 'TubeGeometry' && o.geometry.dispose()); }
        const cid = ids[idx];
        model = FN.Models.build(cid);
        scene.add(model);
        xr = false; ov.querySelector('[data-v=xray]').classList.remove('on');
        const c = FN.CHARS[cid], d = FN.Save.data;
        const chap = c.chapter === 1 ? FN.t('chapter', { n: 1 }) : c.chapter === 2 ? FN.t('chapter', { n: 2 }) : c.player ? (FN.lang === 'en' ? 'Player' : 'Joueur') : 'Secret';
        const found = c.player || d.seen[cid];
        ov.querySelector('.gal-info').innerHTML = `<b>${esc(L(c.name))}</b>
          <div class="gal-tags"><span>${esc(chap)}</span><span>${esc(L(c.type))}</span><span>${esc(L(c.variant))}</span><span class="${found ? 'ok' : ''}">${found ? (FN.lang === 'en' ? 'Discovered' : 'Découvert') : FN.t('notSeen')}</span></div>
          <p>${esc(L(c.desc))}</p><p class="gal-tip"><b>${FN.t('tips')} :</b> ${esc(L(c.hint))}</p>`;
        ov.querySelector('.gal-nav').style.visibility = ids.length > 1 ? 'visible' : 'hidden';
        setClip('idle');
      };
      const setClip = (c) => { clip = c; clipT0 = performance.now() / 1000; ov.querySelectorAll('[data-c]').forEach((b) => b.classList.toggle('on', b.dataset.c === c)); if (c === 'scare') { FN.Audio.init(); FN.Audio.play('jumpscare', { pitch: FN.CHARS[ids[idx]].scream }); Object.assign(st, { tYaw: 0, tPitch: 0.05, tDist: 1.0, tTy: 1.85 }); } };
      ov.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => setView(b.dataset.v)));
      ov.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => setClip(b.dataset.c)));
      ov.querySelector('.gal-prev').onclick = () => { idx = (idx - 1 + ids.length) % ids.length; load(); };
      ov.querySelector('.gal-next').onclick = () => { idx = (idx + 1) % ids.length; load(); };

      // orbit controls (mouse, touch, pinch, wheel)
      const pts = new Map();
      let pinch0 = 0, dist0 = 0;
      cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); dist0 = st.tDist; } });
      cv.addEventListener('pointermove', (e) => {
        if (!pts.has(e.pointerId)) return;
        const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (pts.size === 1) { st.tYaw -= (e.clientX - prev[0]) * 0.008; st.tPitch = Math.max(-0.3, Math.min(1.1, st.tPitch + (e.clientY - prev[1]) * 0.006)); }
        else if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); st.tDist = Math.max(0.7, Math.min(7, (dist0 * pinch0) / Math.max(10, d))); }
      });
      const up = (e) => pts.delete(e.pointerId);
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('wheel', (e) => { e.preventDefault(); st.tDist = Math.max(0.7, Math.min(7, st.tDist * (1 + Math.sign(e.deltaY) * 0.1))); st.tTy = Math.max(0.4, Math.min(2.1, st.tTy + (st.tDist < 2 ? 0.02 : -0.02) * Math.sign(-e.deltaY))); }, { passive: false });

      let alive = true;
      const frame = () => {
        if (!alive) return;
        requestAnimationFrame(frame);
        const w = cv.clientWidth, h = cv.clientHeight;
        if (cv.width !== Math.round(w * R.getPixelRatio()) || cv.height !== Math.round(h * R.getPixelRatio())) { R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
        for (const k of ['yaw', 'pitch', 'dist', 'ty']) st[k] += (st['t' + k[0].toUpperCase() + k.slice(1)] - st[k]) * 0.12;
        const t = performance.now() / 1000, ct = t - clipT0;
        cam.position.set(Math.sin(st.yaw) * Math.cos(st.pitch) * st.dist, st.ty + Math.sin(st.pitch) * st.dist, Math.cos(st.yaw) * Math.cos(st.pitch) * st.dist);
        cam.lookAt(0, st.ty, 0);
        const o = { t, light: 1, eyes: 1 };
        if (clip === 'walk' || clip === 'run') o.pose = clip;
        else if (clip === 'look') { o.pose = 'look'; o.look = Math.sin(ct * 0.9); }
        else if (clip === 'mouth') { o.pose = 'idle'; o.talk = true; }
        else if (clip === 'eyes') { o.pose = 'idle'; o.look = Math.sin(ct * 1.7) * 0.8; o.eyes = 0.6 + Math.abs(Math.sin(ct * 2)) * 0.6; }
        else if (clip === 'attack' || clip === 'scare') { o.pose = 'attack'; o.jaw = 1; }
        else o.pose = 'idle';
        FN.Models.pose(model, o);
        if (clip === 'scare' && ct < 1.4) { cam.position.x += (Math.random() - 0.5) * 0.04; cam.position.y += (Math.random() - 0.5) * 0.04; key.color.setHex(0xff4020); } else key.color.setHex(0xffe0c0);
        R.render(scene, cam);
      };
      requestAnimationFrame(frame);
      ov.querySelector('.gal-x').onclick = () => {
        alive = false;
        R.dispose(); R.forceContextLoss && R.forceContextLoss();
        ov.className = 'hidden'; ov.innerHTML = '';
        onClose && onClose();
      };
      load();
      return true;
    },
  };
  FN.Gallery = Gallery;
})(window.FN);
