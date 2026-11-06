/* FAZNIGHT — shared night engine: loop, rendering pipeline, cameras, phone calls, fear system,
   jumpscares, 6 AM, pause/resume snapshot and progression. Chapters extend `FN.Night`. */
(function (FN) {
  const A = FN.Art, R = FN.Rooms, AU = FN.Audio;
  const $ = (s, r = document) => r.querySelector(s);
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const HOURS = [12, 1, 2, 3, 4, 5];

  // ---------------------------------------------------------------- jumpscare (also used by the scare theatre)
  FN.Scare = {
    /** Draws an attack on `canvas` for ~1.4 s and calls done(). */
    run(canvas, id, done, bgFn) {
      const ctx = canvas.getContext('2d');
      const def = FN.CHARS[id];
      AU.play('jumpscare', { pitch: def ? def.scream : 400 });
      if (FN.Save.data.settings.vibrate && navigator.vibrate) navigator.vibrate([200, 60, 300, 60, 400]);
      const t0 = performance.now();
      const frame = (now) => {
        const t = (now - t0) / 1000;
        const W = canvas.width, H = canvas.height;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        if (bgFn) { ctx.globalAlpha = 0.5; bgFn(ctx, W, H); ctx.globalAlpha = 1; }
        const grow = clamp(t / 0.28, 0, 1);
        const h = H * (1.3 + grow * 1.25 + Math.sin(t * 9) * 0.03);
        const sx = Math.sin(t * 61) * H * 0.03, sy = Math.cos(t * 53) * H * 0.025;
        A.drawChar(ctx, id, W / 2 + sx, H * (1.85 + grow * 0.6) + sy, h, { t: t * 3, pose: id === 'chime' ? 'dance' : 'attack', jaw: 1, light: 0.95, eyes: 1, tilt: Math.sin(t * 40) * 0.06 });
        if (t < 0.12) { ctx.fillStyle = `rgba(255,255,255,${0.7 - t * 5})`; ctx.fillRect(0, 0, W, H); }
        ctx.fillStyle = `rgba(160,0,0,${0.15 + Math.random() * 0.12})`; ctx.fillRect(0, 0, W, H);
        A.staticFx(ctx, W, H, 0.1 + (t > 1.1 ? (t - 1.1) * 2.5 : 0), t);
        if (t < 1.45) requestAnimationFrame(frame);
        else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); done && done(); }
      };
      requestAnimationFrame(frame);
    },
  };

  // ---------------------------------------------------------------- base night
  class Night {
    constructor(cfg) {
      this.cfg = cfg;
      this.ch = cfg.chapter;
      this.night = cfg.night; // 1..7 or 'custom'
      this.rules = cfg.rules || {};
      const st = FN.Save.data.settings;
      this.duration = Math.max(60, (this.rules.duration || st.duration || 6) * 60);
      this.time = 0;
      this.hour = 0;
      this.over = false;
      this.paused = false;
      this.camUp = false;
      this.camAnim = 0;
      this.cam = cfg.startCam || '01';
      this.camSwitchT = 0;
      this.pan = 0.5;
      this.panVel = 0;
      this.shake = 0;
      this.flicker = 0;
      this.glitch = {}; // camId -> seconds of interference
      this.levels = Object.assign({}, cfg.levels);
      this.stats = { camViews: 0, doorUses: 0 };
      this.callLine = -1;
      this.fearT = rand(15, 30);
      this.silence = 0;
      this.silhouette = null;
      this.rare = {};
      this.lastFrame = 0;
      this.speed = FN.debugSpeed || 1;
      this.canvas = $('#gameCanvas');
      this.ctx = this.canvas.getContext('2d');
      this.hud = $('#hud');
    }

    // ------------------------------------------------ lifecycle
    start() {
      this.resize();
      this._onResize = () => this.resize();
      window.addEventListener('resize', this._onResize);
      this.bindInput();
      this.buildHud();
      this.loops = { drone: AU.loop('drone', { base: this.ch === 1 ? 46 : 52, vol: 0.16 }) };
      this.startLoops && this.startLoops();
      if (this.cfg.resume) this.restore(this.cfg.resume);
      else this.scheduleCall();
      this.running = true;
      this.lastFrame = performance.now();
      const loop = (now) => {
        if (!this.running) return;
        requestAnimationFrame(loop);
        const perf = FN.Save.data.settings.perf;
        if (perf && now - this.lastFrame < 32) return;
        const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
        this.lastFrame = now;
        if (!this.paused && !this.over) this.step(dt * this.speed);
        if (!this.over || this.drawAfterOver) this.render(now / 1000);
      };
      requestAnimationFrame(loop);
    }
    destroy() {
      this.running = false;
      window.removeEventListener('resize', this._onResize);
      this.unbindInput && this.unbindInput();
      for (const k in this.loops) this.loops[k] && this.loops[k].stop(0.3);
      this.loops = {};
      AU.stopSpeak();
      clearTimeout(this._callTimer);
      this.hud.innerHTML = '';
    }
    resize() {
      const q = FN.Save.data.settings.quality;
      const cap = FN.Save.data.settings.perf ? 1 : q === 'high' ? 2 : q === 'low' ? 0.75 : 1.35;
      const dpr = Math.min(window.devicePixelRatio || 1, cap);
      this.W = Math.round(window.innerWidth * dpr);
      this.H = Math.round(window.innerHeight * dpr);
      this.canvas.width = this.W; this.canvas.height = this.H;
      this.dpr = dpr;
    }
    pause() {
      if (this.over || this.paused) return;
      this.paused = true;
      AU.stopSpeak();
      FN.UI.pauseMenu(this);
    }
    resume() { this.paused = false; this.lastFrame = performance.now(); }

    // ------------------------------------------------ time & AI tick
    step(dt) {
      this.time += dt;
      const h = Math.min(5, Math.floor((this.time / this.duration) * 6));
      if (h !== this.hour) { this.hour = h; this.onHour(h); }
      if (this.time >= this.duration) return this.win();
      // camera transition
      const target = this.camUp ? 1 : 0;
      this.camAnim = clamp(this.camAnim + (target ? dt : -dt) / 0.22, 0, 1);
      this.camSwitchT = Math.max(0, this.camSwitchT - dt);
      for (const k in this.glitch) { this.glitch[k] -= dt; if (this.glitch[k] <= 0) delete this.glitch[k]; }
      this.shake = Math.max(0, this.shake - dt * 3);
      this.silence = Math.max(0, this.silence - dt);
      // office pan from drag inertia / mouse edge
      if (!this.camUp) {
        this.pan = clamp(this.pan + this.panVel * dt, 0, 1);
        if (this.edgePan) this.pan = clamp(this.pan + this.edgePan * dt * 0.9 * FN.Save.data.settings.sens, 0, 1);
      }
      this.fearSystem(dt);
      this.update(dt);
      this.hudTick = (this.hudTick || 0) - dt;
      if (this.hudTick <= 0) { this.hudTick = 0.1; this.updateHud(); }
    }
    get viewing() { return this.camUp && this.camAnim >= 1 ? this.cam : null; }
    level(id) { return clamp((this.levels[id] || 0) + (this.boost ? this.boost(id) : 0), 0, 20); }
    roll(id) { const l = this.level(id); return l > 0 && Math.random() * 20 < l; }
    onHour() {
      AU.play('clank', { vol: 0.15 });
      if (this.hour >= 2 && Math.random() < 0.5) AU.play('creak', { pan: rand(-1, 1), vol: 0.6 });
    }
    hourLabel() { return `${HOURS[this.hour]} AM`; }

    // ------------------------------------------------ fear system: suspense first, rare surprises
    fearSystem(dt) {
      this.fearT -= dt;
      this.flicker = Math.max(0, this.flicker - dt * 4);
      if (this.silhouette) { this.silhouette.t -= dt; if (this.silhouette.t <= 0) this.silhouette = null; }
      if (this.fearT > 0) return;
      const nightF = this.night === 'custom' ? 4 : this.night;
      this.fearT = rand(18, 45) - nightF * 1.5;
      const r = Math.random();
      if (r < 0.22) AU.play('step', { pan: rand(-1, 1), vol: 0.25, metal: true });
      else if (r < 0.38) AU.play('clank', { vol: 0.2 });
      else if (r < 0.5) AU.play('creak', { pan: rand(-1, 1), vol: 0.7 });
      else if (r < 0.62) { this.flicker = 1; AU.play('lightOn', { pan: 0 }); }
      else if (r < 0.7) { this.silence = 9; this.loops.drone && this.loops.drone.vol(0.02); setTimeout(() => this.loops.drone && this.loops.drone.vol(0.16), 9000); }
      else if (r < 0.76 && this.hour >= 2) AU.play('whisper', { pan: rand(-0.3, 0.3) });
      else if (r < 0.8 && this.hour >= 3 && !this.camUp) { this.silhouette = { t: 0.18, x: rand(0.2, 0.8) }; AU.play('step', { pan: 0, vol: 0.5 }); }
      else if (r < 0.85) AU.play('knock', { pan: rand(-1, 1) });
      else if (r < 0.9) AU.play('heartbeat');
    }

    // ------------------------------------------------ cameras
    toggleCam(force) {
      if (this.over) return;
      const up = force ?? !this.camUp;
      if (up && !this.canUseCams()) { AU.play('denied'); return; }
      if (up === this.camUp) return;
      this.camUp = up;
      AU.play(up ? 'camUp' : 'camDown');
      if (up) { this.stats.camViews++; this.camSwitchT = 0.25; this.onCamView && this.onCamView(this.cam); }
      this.onCamToggle && this.onCamToggle(up);
      this.updateHud();
    }
    canUseCams() { return !this.rules.noCam; }
    switchCam(id) {
      if (!this.camUp || this.over) return;
      if (id === this.cam) return;
      this.cam = id;
      this.camSwitchT = 0.25;
      AU.play('camSwitch');
      this.onCamView && this.onCamView(id);
      if (Math.random() < 1 / 250 && this.night !== 1) this.phantom();
      this.updateHud();
    }
    phantom() {
      this.rare.phantom = { t: 0.35, id: FN.charsOf(this.ch)[Math.floor(Math.random() * FN.charsOf(this.ch).length)] };
      AU.play('glitch', {});
      FN.Trophies.secret('phantom');
    }
    /** Draw a camera feed (cover-fit). */
    drawCam(t) {
      const ctx = this.ctx, W = this.W, H = this.H;
      const bg = R.bg(this.ch, this.cam);
      const s = Math.max(W / R.RW, H / R.RH);
      const ox = (W - R.RW * s) / 2, oy = (H - R.RH * s) / 2;
      // slow sweep like a security camera
      const sweep = Math.sin(t * 0.25 + this.cam.charCodeAt(1)) * (R.RW * s - W) * 0.5;
      const bx = ox + sweep * 0.9;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(bg, bx, oy, R.RW * s, R.RH * s);
      const map = (x, y) => [bx + x * R.RW * s, oy + y * R.RH * s];
      this.drawCamContents && this.drawCamContents(ctx, map, s * R.RH, t);
      const room = R.cam(this.ch, this.cam);
      // grading
      ctx.save(); ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = this.ch === 1 ? '#a9c2b4' : '#c8b8ec'; ctx.fillRect(0, 0, W, H); ctx.restore();
      const flick = Math.random() < 0.04 ? 0.25 : 0;
      if (flick) { ctx.fillStyle = `rgba(0,0,0,${flick})`; ctx.fillRect(0, 0, W, H); }
      const perf = FN.Save.data.settings.perf;
      const gl = this.glitch[this.cam] ? 0.75 : 0;
      const base = (room.noisy || 0) + 0.1 + (this.camSwitchT > 0 ? this.camSwitchT * 3 : 0) + gl + (this.extraStatic || 0);
      A.staticFx(ctx, W, H, perf ? Math.min(base, 0.35) : base, t);
      if (gl) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H * 0.999); A.staticFx(ctx, W, H, 0.6, t); this.camText(FN.t('signalLost'), W / 2, H / 2, 0.05); }
      // horizontal interference bars
      if (!perf) for (let i = 0; i < 2; i++) { const y = ((t * 140 + i * 377) % (H + 80)) - 40; ctx.fillStyle = 'rgba(255,255,255,0.035)'; ctx.fillRect(0, y, W, 26 * this.dpr); }
      A.scanlines(ctx, W, H);
      // REC + stamp
      const u = Math.max(12, H * 0.028);
      ctx.font = `${u}px Courier New`; ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
      const ry = H - 96 * this.dpr - u;
      if (Math.floor(t * 1.5) % 2) A.ell(ctx, 18 * this.dpr + u * 0.4, ry - u * 0.35, u * 0.4, u * 0.4, '#e11');
      ctx.fillText('REC  ' + this.hourLabel(), 18 * this.dpr + u * 1.2, ry);
      if (this.rare.phantom) {
        this.rare.phantom.t -= 1 / 60;
        A.drawChar(ctx, this.rare.phantom.id, W / 2, H * 1.9, H * 2.2, { t, pose: 'idle', jaw: 0.6, light: 0.6, eyes: 1 });
        A.staticFx(ctx, W, H, 0.4, t);
        if (this.rare.phantom.t <= 0) delete this.rare.phantom;
      }
    }
    camText(txt, x, y, a) {
      const ctx = this.ctx;
      ctx.save(); ctx.font = `bold ${Math.max(16, this.H * 0.05)}px Courier New`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
      ctx.fillText(txt, x, y); ctx.restore();
    }
    /** Character inside a camera room, marks it as discovered. */
    camChar(ctx, map, unitH, id, spot, o) {
      const [x, y] = map(spot[0], spot[1]);
      const opt = Object.assign({ light: R.cam(this.ch, this.cam).light, eyes: 0.8 }, o);
      opt.light *= 0.75;
      A.drawChar(ctx, id, x, y, spot[2] * unitH, opt);
      if ((o && o.light) !== 0 && !this.camSwitchT) FN.Trophies.seen(id);
    }

    // ------------------------------------------------ office drawing helpers
    officeTransform() {
      // portrait phones: show a wider slice of the office (letterboxed) instead of a giant crop
      const s = Math.min(this.H / R.OH, this.W / (R.OW * 0.55));
      const oy = (this.H - R.OH * s) / 2;
      const viewW = this.W / s;
      const maxPan = R.OW - viewW;
      const offX = maxPan > 0 ? -this.pan * maxPan : (viewW - R.OW) / 2;
      const sx = (Math.random() - 0.5) * this.shake * 18, sy = (Math.random() - 0.5) * this.shake * 18;
      this.ctx.setTransform(s, 0, 0, s, (offX + sx) * s, sy * s + oy);
      this.view = { s, offX, viewW, oy };
      return this.view;
    }
    screenToWorld(px, py) {
      const v = this.view; if (!v) return [0, 0];
      return [px * this.dpr / v.s - v.offX, (py * this.dpr - v.oy) / v.s];
    }
    renderCamTransition(t) {
      // monitor flipping up: office darkens, static fills the screen
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const a = this.camAnim;
      ctx.fillStyle = `rgba(0,0,0,${a * 0.85})`;
      ctx.fillRect(0, this.H * (1 - a), this.W, this.H * a);
      A.staticFx(ctx, this.W, this.H * a, a * 0.5, t);
    }
    post(t) {
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (this.silhouette && !this.camUp) {
        const x = this.W * this.silhouette.x;
        ctx.fillStyle = 'rgba(0,0,0,0.9)';
        A.drawChar(ctx, FN.charsOf(this.ch)[0], x, this.H * 1.05, this.H * 0.9, { light: 0, eyes: 0.9, t });
      }
      A.vignette(ctx, this.W, this.H, 0.85);
      if (!FN.Save.data.settings.perf) A.staticFx(ctx, this.W, this.H, 0.035, t);
    }

    // ------------------------------------------------ input
    bindInput() {
      const cv = this.canvas;
      let down = null, lastX = 0, lastT = 0;
      const sens = () => FN.Save.data.settings.sens;
      this._pd = (e) => {
        AU.init();
        if (this.over || this.paused) return;
        down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
        lastX = e.clientX; lastT = performance.now();
        this.panVel = 0;
        cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
      };
      this._pm = (e) => {
        if (e.pointerType === 'mouse' && !down && !this.camUp) {
          const x = e.clientX / window.innerWidth;
          this.edgePan = x < 0.15 ? -(0.15 - x) / 0.15 : x > 0.85 ? (x - 0.85) / 0.15 : 0;
        }
        if (!down || this.camUp) return;
        const dx = e.clientX - lastX;
        if (Math.abs(e.clientX - down.x) > 8) down.moved = true;
        const k = (1.6 * sens()) / window.innerWidth;
        this.pan = clamp(this.pan - dx * k, 0, 1);
        const now = performance.now();
        if (now > lastT) this.panVel = clamp((-dx * k) / ((now - lastT) / 1000), -3, 3);
        lastX = e.clientX; lastT = now;
      };
      this._pu = (e) => {
        if (!down) return;
        if (!down.moved && !this.camUp && this.onTap) {
          const [wx, wy] = this.screenToWorld(e.clientX, e.clientY);
          this.onTap(wx, wy);
        }
        if (performance.now() - lastT > 80) this.panVel = 0;
        down = null;
      };
      this._pl = () => { this.edgePan = 0; };
      this._decay = setInterval(() => { this.panVel *= 0.8; if (Math.abs(this.panVel) < 0.01) this.panVel = 0; }, 30);
      this._key = (e) => {
        if (this.over) return;
        if (e.key === 'Escape') this.paused ? null : this.pause();
        this.onKey && this.onKey(e);
      };
      cv.addEventListener('pointerdown', this._pd);
      cv.addEventListener('pointermove', this._pm);
      cv.addEventListener('pointerup', this._pu);
      cv.addEventListener('pointercancel', this._pu);
      cv.addEventListener('pointerleave', this._pl);
      window.addEventListener('keydown', this._key);
      this.unbindInput = () => {
        cv.removeEventListener('pointerdown', this._pd);
        cv.removeEventListener('pointermove', this._pm);
        cv.removeEventListener('pointerup', this._pu);
        cv.removeEventListener('pointercancel', this._pu);
        cv.removeEventListener('pointerleave', this._pl);
        window.removeEventListener('keydown', this._key);
        clearInterval(this._decay);
      };
    }

    // ------------------------------------------------ HUD helpers
    el(html, cls, style) {
      const d = document.createElement('div');
      if (cls) d.className = cls;
      if (style) Object.assign(d.style, style);
      d.innerHTML = html;
      this.hud.appendChild(d);
      return d;
    }
    button(label, cls, style, onDown, onUp) {
      const b = document.createElement('button');
      b.className = 'hbtn ' + (cls || '');
      b.innerHTML = label;
      Object.assign(b.style, style || {});
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); AU.init(); if (!this.over && !this.paused) onDown && onDown(e); });
      if (onUp) for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, (e) => { e.preventDefault(); onUp(e); });
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      this.hud.appendChild(b);
      return b;
    }
    commonHud() {
      this.hud.innerHTML = '';
      this.ui = {};
      this.ui.info = this.el('<div class="clock"></div><div class="nightn"></div>', 'info-tr');
      this.ui.pause = this.button('II', 'small', { left: 'calc(10px + var(--safe-l))', top: 'calc(10px + var(--safe-t))' }, () => this.pause());
      this.ui.cambar = document.createElement('button');
      this.ui.cambar.className = 'cambar';
      this.ui.cambar.textContent = '▲ ' + FN.t('cams');
      this.ui.cambar.addEventListener('pointerdown', (e) => { e.preventDefault(); AU.init(); if (!this.paused) this.toggleCam(); });
      this.hud.appendChild(this.ui.cambar);
      // camera map
      const map = document.createElement('div');
      map.className = 'cammap hidden';
      const lc = document.createElement('canvas');
      lc.width = 330; lc.height = 264; lc.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
      const lx = lc.getContext('2d');
      lx.strokeStyle = 'rgba(255,255,255,0.35)'; lx.lineWidth = 6;
      const pos = {};
      for (const r of R.cams[this.ch]) pos[r.id] = [r.map[0] * 3.3, r.map[1] * 2.64];
      for (const [a, b] of R.links[this.ch]) { lx.beginPath(); lx.moveTo(...pos[a]); lx.lineTo(...pos[b]); lx.stroke(); }
      lx.fillStyle = 'rgba(255,255,255,0.1)'; lx.fillRect(330 * 0.44, 264 * 0.82, 330 * 0.12, 264 * 0.14);
      map.appendChild(lc);
      this.ui.camBtns = {};
      for (const r of R.cams[this.ch]) {
        const b = document.createElement('button');
        b.textContent = r.id;
        b.style.left = r.map[0] + '%'; b.style.top = r.map[1] + '%';
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.switchCam(r.id); });
        map.appendChild(b);
        this.ui.camBtns[r.id] = b;
      }
      const you = document.createElement('div'); you.className = 'you'; you.textContent = FN.lang === 'en' ? 'YOU' : 'VOUS';
      you.style.left = '50%'; you.style.top = '89%'; map.appendChild(you);
      this.hud.appendChild(map);
      this.ui.map = map;
      this.ui.camLabel = this.el('', 'camlabel hidden');
      this.ui.sub = this.el('', 'subtitle hidden');
    }
    updateCommonHud() {
      const u = this.ui; if (!u) return;
      u.info.children[0].textContent = this.hourLabel();
      u.info.children[1].textContent = this.night === 'custom' ? FN.t('customIntro') : FN.t('night', { n: this.night });
      u.cambar.classList.toggle('on', this.camUp);
      u.cambar.textContent = (this.camUp ? '▼ ' : '▲ ') + FN.t('cams');
      u.cambar.disabled = !this.canUseCams() && !this.camUp;
      u.map.classList.toggle('hidden', !this.camUp);
      u.camLabel.classList.toggle('hidden', !this.camUp);
      if (this.camUp) {
        const r = R.cam(this.ch, this.cam);
        u.camLabel.textContent = `CAM ${r.id} — ${FN.L(r.name)}`;
        for (const id in u.camBtns) u.camBtns[id].classList.toggle('on', id === this.cam);
      }
    }

    // ------------------------------------------------ phone call
    scheduleCall() {
      const lines = this.callScript && this.callScript();
      if (!lines || !lines.length) return;
      this._callTimer = setTimeout(() => {
        if (this.over) return;
        AU.play('phoneRing');
        this._callTimer = setTimeout(() => this.playCall(lines), 3300);
      }, 1800);
    }
    playCall(lines) {
      if (this.over) return;
      AU.play('phoneClick');
      this.callLine = 0;
      const sub = this.ui.sub;
      const showSubs = FN.Save.data.settings.subtitles;
      this.ui.mute = document.createElement('button');
      this.ui.mute.className = 'phonebtn';
      this.ui.mute.textContent = '✆ ' + FN.t('muteCall');
      this.ui.mute.addEventListener('pointerdown', (e) => { e.preventDefault(); this.endCall(false); });
      this.hud.appendChild(this.ui.mute);
      const next = () => {
        if (this.over || this.callLine < 0) return;
        if (this.paused) { this._callTimer = setTimeout(next, 500); return; }
        if (this.callLine >= lines.length) return this.endCall(true);
        const text = FN.L(lines[this.callLine]);
        if (showSubs) { sub.classList.remove('hidden'); sub.textContent = '☎ ' + text; }
        this.callLine++;
        const minMs = Math.max(2500, text.length * 62);
        const t0 = performance.now();
        const spoken = FN.Save.data.settings.voice > 0.01 && AU.speak(text, FN.lang, () => {
          const left = minMs * 0.5 - (performance.now() - t0);
          this._callTimer = setTimeout(next, Math.max(250, left));
        });
        if (!spoken) this._callTimer = setTimeout(next, minMs);
      };
      next();
    }
    endCall(complete) {
      if (this.callLine < 0) return;
      this.callLine = -1;
      clearTimeout(this._callTimer);
      AU.stopSpeak();
      AU.play('phoneClick');
      this.ui.sub && this.ui.sub.classList.add('hidden');
      this.ui.mute && this.ui.mute.remove();
      if (complete) FN.Trophies.award('b_call');
    }

    // ------------------------------------------------ endings
    killedBy(id, opts = {}) {
      if (this.over) return;
      this.over = true;
      this.endCall(false);
      for (const k in this.loops) this.loops[k] && this.loops[k].stop(0.05);
      this.loops = {};
      const d = FN.Save.data;
      d.stats.deaths++;
      d.stats.kills[id] = (d.stats.kills[id] || 0) + 1;
      d.resume = null;
      FN.Save.flush();
      this.hud.innerHTML = '';
      FN.Scare.run(this.canvas, id, () => {
        this.destroy();
        FN.Trophies.evaluate();
        FN.UI.gameOver(this.cfg, id, opts);
      });
    }
    win() {
      if (this.over) return;
      this.over = true;
      this.endCall(false);
      for (const k in this.loops) this.loops[k] && this.loops[k].stop(0.5);
      this.loops = {};
      this.destroy();
      FN.Game.onWin(this);
    }
    quitAndSave() {
      const d = FN.Save.data;
      d.resume = { cfg: Object.assign({}, this.cfg, { resume: null }), state: this.serialize(), hour: this.hour, saved: Date.now() };
      FN.Save.flush();
      this.over = true;
      this.destroy();
    }
    serialize() {
      return { time: this.time, hour: this.hour, cam: this.cam, levels: this.levels, pan: this.pan, extra: this.saveState ? this.saveState() : null };
    }
    restore(st) {
      this.time = st.time; this.hour = st.hour; this.cam = st.cam; this.pan = st.pan;
      if (st.levels) this.levels = st.levels;
      if (st.extra && this.loadState) this.loadState(st.extra);
    }
  }
  FN.Night = Night;
  FN.util = { rand, clamp, HOURS };

  // ---------------------------------------------------------------- game controller & progression
  FN.Game = {
    current: null,
    start(cfg) {
      FN.Audio.init();
      FN.Audio.stopMusic();
      FN.UI.autoLandscape();
      FN.UI.show('game');
      const Cls = cfg.chapter === 1 ? FN.Chapter1 : FN.Chapter2;
      R.prewarm(cfg.chapter);
      const d = FN.Save.data;
      d.last.chapter = cfg.chapter;
      if (!cfg.resume) d.resume = null;
      FN.Save.flush();
      FN.UI.nightIntro(cfg, () => {
        const n = new Cls(cfg);
        this.current = n;
        n.start();
        FN.UI.maybeRotateHint();
      });
    },
    resumeSaved() {
      const r = FN.Save.data.resume;
      if (!r) return false;
      this.start(Object.assign({}, r.cfg, { resume: r.state }));
      return true;
    },
    onWin(n) {
      const d = FN.Save.data;
      const cfg = n.cfg, ch = cfg.chapter;
      const rewards = [];
      d.resume = null;
      d.stats.nightsWon++;
      let cinematic = null;
      if (cfg.night === 'custom') {
        const total = Object.values(cfg.levels).reduce((a, b) => a + b, 0);
        if (total > d.customRecords[ch]) { d.customRecords[ch] = total; rewards.push(FN.t('newRecord') + ' ' + total); }
        if (cfg.challenge && !(n.challengeFailed && n.challengeFailed())) {
          if (!d.challengesDone[cfg.challenge]) rewards.push('★ ' + FN.L(FN.UI.presetName(cfg.challenge)));
          d.challengesDone[cfg.challenge] = Date.now();
        }
      } else {
        const N = cfg.night;
        const chap = d.chapters[ch];
        if (!chap.done[N]) rewards.push(FN.t('starEarned'));
        chap.done[N] = Date.now();
        if (N < 7 && chap.next < N + 1) { chap.next = N + 1; if (N + 1 >= 6) rewards.push(FN.t('unlockedNight', { n: N + 1 })); }
        if (N === 5 && ch === 1 && !d.chapters[2].unlocked) { d.chapters[2].unlocked = true; rewards.push(FN.t('unlockedChapter')); cinematic = 'ch2'; }
        if (N === 5) cinematic = cinematic || (ch === 1 ? 'paycheck' : d.docs.d1 && d.docs.d2 && d.docs.d3 && d.docs.d4 ? 'trueEnding' : 'ending2');
        if (N === 6 && !d.customUnlocked[ch]) { d.customUnlocked[ch] = true; rewards.push(FN.t('unlockedCustom')); }
        if (N === 6) cinematic = cinematic || (ch === 1 ? 'letter' : 'ending6');
        if (N === 7) cinematic = 'n7';
      }
      if (n.hadPowerOut) FN.Trophies.award('s_dark');
      FN.Save.flush();
      FN.UI.sixAM(n, rewards, () => {
        FN.Trophies.evaluate();
        if (ch === 1 && cfg.night === 6) FN.Trophies.doc('d4');
        if (ch === 2 && cfg.night === 5) FN.Trophies.doc('d5');
        FN.UI.afterWin(cfg, cinematic);
      });
    },
  };
})(window.FN);
