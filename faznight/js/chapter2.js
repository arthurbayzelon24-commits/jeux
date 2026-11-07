/* FAZNIGHT — Chapter 2 : Grimwood's Fun Factory. No doors: flashlight, vents, a mask and a music box. */
(function (FN) {
  const A = FN.Art, R = FN.Rooms, AU = FN.Audio;
  const { rand, clamp } = FN.util;

  // [pepper, rico, lumi, oldkrok, oldbruno, chime, static]
  const LEVELS = {
    1: [2, 1, 0, 0, 0, 2, 0], 2: [4, 3, 2, 1, 0, 4, 0], 3: [5, 4, 4, 3, 2, 6, 1], 4: [7, 6, 6, 6, 4, 8, 3],
    5: [9, 8, 8, 8, 6, 10, 5], 6: [12, 12, 12, 12, 10, 12, 8],
  };
  const IDS = ['pepper', 'rico', 'lumi', 'oldkrok', 'oldbruno', 'chime', 'static'];
  FN.ch2Levels = (n) => { const l = LEVELS[n] || LEVELS[1]; const o = {}; IDS.forEach((id, i) => (o[id] = l[i])); return o; };

  const PATHS = {
    pepper: ['09', '07', '02', 'HALL', 'OFFICE'],
    oldbruno: ['08', '07', '01', 'HALL', 'OFFICE'],
    oldkrok: ['08', '07', 'HALL'],
    rico: ['12', '03', '05', 'VENT_L', 'OFFICE'],
    lumi: ['10', '04', '06', 'VENT_R', 'OFFICE'],
  };
  const INTERVAL = { pepper: 4.6, oldbruno: 5.6, oldkrok: 5.2, rico: 4.2, lumi: 4.6, static: 7 };
  const MASK_NEED = { pepper: 2.6, oldbruno: 4.2, rico: 2.4, lumi: 3 };

  const CALLS = {
    1: [
      { fr: 'Allô ? Bienvenue à la Fun Factory ! C’est encore moi, Gérard. On m’a muté ici aussi.', en: 'Hello? Welcome to the Fun Factory! It’s me again, Gérard. They moved me here too.' },
      { fr: 'Pas de portes ici. À la place : une lampe torche, un masque, et une boîte à musique.', en: 'No doors here. Instead: a flashlight, a mask, and a music box.' },
      { fr: 'Remontez la boîte à musique de la Salle des prix, caméra 11. Toujours. Ne demandez pas pourquoi.', en: 'Wind the Prize Room music box, camera 11. Always. Don’t ask why.' },
      { fr: 'Si un des nouveaux entre dans le bureau, mettez le masque. Ils vous prendront pour l’un des leurs.', en: 'If one of the new ones gets into the office, put on the mask. They’ll take you for one of them.' },
    ],
    2: [
      { fr: 'Les anciens sont stockés dans l’atelier. Le vieux Krok, surtout… le masque ne marche pas sur lui.', en: 'The old ones are stored in the workshop. Old Krok especially… the mask doesn’t work on him.' },
      { fr: 'Flashez-le avec la lampe quand il est dans le couloir. Plusieurs fois. Ça le dérègle.', en: 'Flash him with the light when he is in the hallway. Several times. It throws him off.' },
    ],
    3: [
      { fr: 'Les conduits… Rico n’aime pas le bruit, enfin, il l’adore. Chaque clic l’attire.', en: 'The vents… Rico doesn’t like noise — well, he loves it. Every click draws him in.' },
      { fr: 'Et Lumi, à droite, suit la lumière comme un papillon. N’éclairez pas trop son conduit.', en: 'And Lumi, on the right, follows light like a moth. Don’t light her vent too much.' },
    ],
    4: [
      { fr: 'Il y a un problème avec les caméras. Un visage apparaît dessus. Si vous le voyez, fermez la tablette. Tout de suite.', en: 'Something is wrong with the cameras. A face shows up on them. If you see it, close the tablet. Right away.' },
    ],
    5: [
      { fr: 'C’est ma dernière nuit ici. Si quelque chose arrive… cherchez ma note. Elle explique tout.', en: 'This is my last night here. If something happens… look for my note. It explains everything.' },
    ],
  };

  class Chapter2 extends FN.Night {
    constructor(cfg) {
      if (!cfg.levels) cfg.levels = FN.ch2Levels(cfg.night);
      cfg.startCam = cfg.startCam || '11';
      super(cfg);
      this.battery = this.rules.lowPower ? 50 : 100;
      this.flash = false;
      this.vent = { L: false, R: false };
      this.mask = false;
      this.maskA = 0;
      this.box = 1;
      this.winding = false;
      this.chimeOut = null;
      this.noise = 0;
      this.glow = 0;
      this.intr = null;
      this.masked = 0;
      this.a = {};
      for (const id of Object.keys(PATHS)) this.a[id] = { i: 0, t: rand(3, INTERVAL[id] + 3), hallT: 0, flashes: 0 };
      this.st = { cam: null, t: 0, seen: 0, cool: 20, timer: INTERVAL.static };
      this.hollow = null;
      this.hollowChance = this.rules.hollow ? 1 : this.night === 6 ? 0.08 : this.night === 'custom' ? 0.06 : this.night >= 3 ? 0.035 : 0;
    }
    room(id) { return PATHS[id][this.a[id].i]; }
    callScript() { return typeof this.night === 'number' ? CALLS[this.night] : null; }
    boost(id) {
      if (this.night === 'custom') return 0;
      if (id === 'pepper' || id === 'rico' || id === 'lumi') return (this.hour >= 2) + (this.hour >= 4);
      return 0;
    }
    startLoops() { this.loops.fan = AU.loop('fan'); this.loops.music = AU.loop('musicBox', { vol: 0.0, bus: 'music', notes: [72, 76, 79, 76, 74, 77, 81, 77, 76, 79, 84, 79, 77, 74, 71, -1], step: 0.34 }); }
    canUseCams() { return !this.rules.noCam && !this.mask; }

    // ------------------------------------------------ HUD
    buildHud() {
      this.commonHud();
      const u = this.ui;
      u.mask = this.button(`<span class="ico">☻</span>${FN.t('mask')}`, 'maskb', { left: 'calc(10px + var(--safe-l))', bottom: 'calc(6px + var(--safe-b))', width: 'min(30vw, 160px)', height: '46px' }, () => this.toggleMask());
      u.flash = this.button(`<span class="ico">◉</span>${FN.t('flash')}`, 'light', { left: '50%', transform: 'translateX(-50%)', bottom: 'calc(60px + var(--safe-b))' }, () => this.setFlash(true), () => this.setFlash(false));
      u.ventL = this.button(`<span class="ico">◧</span>${FN.t('vent')}`, 'light', { left: 'calc(10px + var(--safe-l))', bottom: 'calc(62px + var(--safe-b))' }, () => this.setVent('L', true), () => this.setVent('L', false));
      u.ventR = this.button(`<span class="ico">◨</span>${FN.t('vent')}`, 'light', { right: 'calc(10px + var(--safe-r))', bottom: 'calc(62px + var(--safe-b))' }, () => this.setVent('R', true), () => this.setVent('R', false));
      u.cambar.style.left = 'auto'; u.cambar.style.right = 'calc(10px + var(--safe-r))'; u.cambar.style.transform = 'none'; u.cambar.style.width = 'min(36vw, 220px)';
      u.wind = this.button(FN.t('wind'), 'windbtn hidden', {}, () => { this.winding = true; }, () => { this.winding = false; });
      u.windMeter = this.el('<i></i>', 'windmeter hidden');
      u.batt = this.el('', 'info-bl');
      u.warn = this.el('!', 'warnicon hidden', { right: 'calc(20px + var(--safe-r))', bottom: 'calc(58px + var(--safe-b))' });
      this.updateHud();
    }
    updateHud() {
      this.updateCommonHud();
      const u = this.ui; if (!u) return;
      u.batt.innerHTML = FN.t('battery', { p: Math.max(0, Math.ceil(this.battery)) }) + `<br>♪ ${Math.round(this.box * 100)} %`;
      u.mask.classList.toggle('on', this.mask);
      u.flash.classList.toggle('on', this.flash);
      u.ventL.classList.toggle('on', this.vent.L); u.ventR.classList.toggle('on', this.vent.R);
      const off = this.camUp;
      for (const b of [u.flash, u.ventL, u.ventR]) { b.style.display = off || this.mask ? 'none' : ''; b.classList.toggle('broken', this.battery <= 0 || !!this.rules.noLight); }
      u.mask.style.display = off ? 'none' : '';
      u.cambar.style.display = this.mask ? 'none' : '';
      const onBox = this.camUp && this.cam === '11';
      u.wind.classList.toggle('hidden', !onBox); u.windMeter.classList.toggle('hidden', !onBox);
      u.windMeter.firstChild.style.width = Math.round(this.box * 100) + '%';
      u.warn.classList.toggle('hidden', this.box > 0.3 || this.camUp);
      if (u.camBtns['11']) u.camBtns['11'].classList.toggle('alert', this.box < 0.3);
      for (const id in u.camBtns) if (id !== '11') u.camBtns[id].classList.toggle('alert', !!this.glitch[id]);
    }

    // ------------------------------------------------ controls
    toggleMask() {
      if (this.camUp) return;
      this.mask = !this.mask;
      AU.play('mask');
      if (this.mask) { this.setFlash(false); this.setVent('L', false); this.setVent('R', false); this.loops.breath = AU.loop('breath'); }
      else if (this.loops.breath) { this.loops.breath.stop(0.1); delete this.loops.breath; }
      this.updateHud();
    }
    canLight() { return this.battery > 0 && !this.mask && !this.camUp && !this.rules.noLight; }
    setFlash(on) {
      if (on && !this.canLight()) { AU.play('denied'); return; }
      if (this.flash === on) return;
      this.flash = on;
      if (on) {
        AU.play('flash', {}); this.noise += 1;
        const k = this.a.oldkrok;
        if (this.room('oldkrok') === 'HALL' && this.level('oldkrok') > 0) {
          k.flashes++;
          AU.play('glitch', { pan: 0 });
          if (k.flashes >= 3 + Math.floor(this.level('oldkrok') / 5)) { k.i = 0; k.hallT = 0; k.flashes = 0; k.t = INTERVAL.oldkrok * 2; AU.play('run', { pan: 0, n: 4 }); this.stats.krokRepel = (this.stats.krokRepel || 0) + 1; }
        }
        for (const id of ['pepper', 'oldbruno']) if (this.room(id) === 'HALL') FN.Trophies.seen(id);
        if (this.room('oldkrok') === 'HALL') FN.Trophies.seen('oldkrok');
        if (this.hollow) { FN.Trophies.secret('hollow2'); FN.Trophies.seen('hollow'); }
      }
      this.updateHud();
    }
    setVent(side, on) {
      if (on && !this.canLight()) { AU.play('denied', { pan: side === 'L' ? -0.8 : 0.8 }); return; }
      if (this.vent[side] === on) return;
      this.vent[side] = on;
      if (on) {
        AU.play('lightOn', { pan: side === 'L' ? -0.8 : 0.8 }); this.noise += 0.5;
        const who = side === 'L' ? (this.room('rico') === 'VENT_L' ? 'rico' : null) : this.room('lumi') === 'VENT_R' ? 'lumi' : null;
        if (who) { AU.play('sting'); FN.Trophies.seen(who); if (who === 'lumi') { this.a.lumi.t = Math.min(this.a.lumi.t, 0.6); AU.play('bubble', { pan: 0.8 }); } }
      }
      this.updateHud();
    }
    onKey(e) {
      const k = e.key.toLowerCase();
      if (k === 'm' || k === 'w') this.toggleMask();
      if (k === 's' || k === ' ') this.toggleCam();
      if (k === 'f') this.setFlash(!this.flash);
    }
    onCamToggle(up) {
      if (up) { this.setFlash(false); this.setVent('L', false); this.setVent('R', false); }
      else { this.winding = false; if (this.st.cam && this.st.seen > 0) this.staticLeave(); }
    }
    onCamView() {}

    // ------------------------------------------------ simulation
    update(dt) {
      const lit = this.flash || this.vent.L || this.vent.R;
      if (lit) { this.battery -= (100 / (this.duration * 0.55)) * dt; if (this.battery <= 0) { this.battery = 0; this.setFlash(false); this.setVent('L', false); this.setVent('R', false); } }
      this.noise = Math.max(0, this.noise - dt * 0.3);
      if (this.vent.R || this.flash) this.glow = Math.min(8, this.glow + dt * 1.5); else this.glow = Math.max(0, this.glow - dt * 0.4);
      this.maskA = clamp(this.maskA + (this.mask ? dt : -dt) / 0.25, 0, 1);
      this.updateBox(dt);
      if (this.over) return;
      for (const id of Object.keys(PATHS)) { this.ai(id, dt); if (this.over) return; }
      this.updateStatic(dt);
      this.updateIntruder(dt);
      this.updateHollow(dt);
    }
    effLevel(id) {
      let l = this.level(id);
      if (l <= 0) return 0;
      if (id === 'rico') l += Math.min(6, this.noise);
      if (id === 'lumi') l += Math.min(6, this.glow);
      return Math.min(20, l);
    }
    ai(id, dt) {
      const c = this.a[id];
      const lvl = this.level(id);
      if (lvl <= 0) return;
      const where = this.room(id);
      if (id === 'oldkrok' && where === 'HALL') {
        c.hallT += dt;
        if (c.hallT > Math.max(8, 18 - lvl * 0.45)) return this.killedBy('oldkrok');
        return;
      }
      c.t -= dt;
      if (c.t > 0) return;
      c.t = INTERVAL[id] * rand(0.85, 1.15);
      if (Math.random() * 20 >= this.effLevel(id)) return;
      const path = PATHS[id];
      if (where === 'OFFICE') return;
      const nextRoom = path[c.i + 1];
      if (nextRoom === 'OFFICE') {
        if (this.intr) return;
        return this.intrude(id);
      }
      // occasional step back keeps them unpredictable
      if (c.i > 0 && c.i < path.length - 2 && Math.random() < 0.12) { this.glitch[where] = 1.2; c.i--; return; }
      if (!where.startsWith('HALL') && !where.startsWith('VENT')) this.glitch[where] = rand(1, 2);
      c.i++;
      const nr = this.room(id);
      if (!nr.startsWith('HALL') && !nr.startsWith('VENT')) this.glitch[nr] = rand(1, 2);
      if (nr === 'VENT_L' || nr === '05') AU.play('ventCrawl', { pan: -0.8, vol: nr === 'VENT_L' ? 0.8 : 0.4 });
      else if (nr === 'VENT_R' || nr === '06') AU.play('ventCrawl', { pan: 0.8, vol: nr === 'VENT_R' ? 0.8 : 0.4 });
      else if (nr === 'HALL') AU.play('step', { pan: 0, vol: 0.8, metal: true });
      else AU.play('step', { pan: rand(-0.5, 0.5), vol: 0.3 });
      if (id === 'rico' && Math.random() < 0.4) AU.play('chitter', { pan: -0.6 });
      if (id === 'oldkrok' && nr === 'HALL') { c.hallT = 0; c.flashes = 0; AU.play('groan', { pan: 0, vol: 0.5 }); AU.play('clank', { pan: 0, vol: 0.5 }); }
    }
    intrude(id) {
      const c = this.a[id];
      c.i = PATHS[id].length - 1;
      this.intr = { id, t: 0, waitCam: 0, masked: 0, window: Math.max(0.65, 1.3 - this.level(id) * 0.03) };
      this.flicker = 1;
      AU.play('groan', { pan: 0, vol: 0.5 });
      if (this.mask) this.intr.t = 0;
    }
    updateIntruder(dt) {
      const it = this.intr;
      if (!it) return;
      if (this.camUp) {
        it.waitCam += dt;
        if (it.waitCam > 5) { this.toggleCam(false); AU.play('glitch', {}); this.shake = 0.6; }
        return;
      }
      this.flicker = Math.max(this.flicker, Math.random() < 0.2 ? 0.8 : 0);
      FN.Trophies.seen(it.id);
      if (this.mask) {
        it.masked += dt;
        if (it.masked >= MASK_NEED[it.id]) {
          this.a[it.id].i = 0; this.a[it.id].t = INTERVAL[it.id] * 2;
          this.masked++;
          if (this.masked >= 6) FN.Trophies.award('s_mask');
          this.intr = null;
          this.flicker = 1;
          AU.play('step', { pan: 0, vol: 0.5 });
        }
      } else {
        it.t += dt;
        if (it.t > it.window) this.killedBy(it.id);
      }
    }
    updateBox(dt) {
      const lvl = this.level('chime');
      if (this.winding && this.camUp && this.cam === '11') {
        const before = this.box;
        this.box = Math.min(1, this.box + dt * 0.24);
        this.noise += dt * 0.25;
        if (Math.random() < dt * 12) AU.play('crank');
        if (before < 1 && this.box >= 1) FN.Trophies.award('b_wind');
      } else if (lvl > 0 && !this.chimeOut) {
        this.box = Math.max(0, this.box - dt / (160 - lvl * 6));
      }
      if (this.loops.music) this.loops.music.vol(this.camUp && this.cam === '11' ? 0.22 : 0.05 + (this.box < 0.3 ? 0.05 : 0));
      if (this.box <= 0 && !this.chimeOut && lvl > 0) {
        this.chimeOut = { t: 0 };
        if (this.loops.music) { this.loops.music.stop(0.2); delete this.loops.music; }
        this.loops.chime = AU.loop('musicBox', { vol: 0.35, detune: 0.03, step: 0.22, notes: [81, 80, 81, 76, 77, 76, 72, 71, 69, -1] });
      }
      if (this.chimeOut) {
        this.chimeOut.t += dt;
        if (this.chimeOut.t > 12) this.killedBy('chime');
      }
    }
    updateStatic(dt) {
      const s = this.st, lvl = this.level('static');
      if (lvl <= 0) return;
      s.cool -= dt;
      if (s.cam) {
        s.t += dt;
        if (this.viewing === s.cam) {
          s.seen += dt;
          FN.Trophies.seen('static');
          if (Math.random() < dt * 8) AU.play('glitch', {});
          if (s.seen > 2) return this.killedBy('static');
        } else if (s.seen > 0) this.staticLeave();
        if (s.t > 12) this.staticLeave();
        return;
      }
      if (s.cool > 0) return;
      s.timer -= dt;
      if (s.timer > 0) return;
      s.timer = INTERVAL.static;
      if (Math.random() * 20 < lvl) {
        const cams = R.cams[2].map((r) => r.id).filter((id) => id !== '11');
        s.cam = this.camUp && Math.random() < 0.6 ? this.cam : cams[Math.floor(Math.random() * cams.length)];
        if (s.cam === '11') s.cam = '07';
        s.t = 0; s.seen = 0;
        this.glitch[s.cam] = 0.4;
      }
    }
    staticLeave() { this.st.cam = null; this.st.seen = 0; this.st.cool = rand(15, 30); AU.play('staticBurst', { dur: 0.5 }); }
    updateHollow(dt) {
      if (this.hollow) {
        this.hollow.t += dt;
        if (this.flash) { this.hollow.lit += dt; if (this.hollow.lit > 1.6) { this.hollow = null; return this.killedBy('hollow', { crash: true }); } }
        if (this.hollow.t > 9) this.hollow = null;
        return;
      }
      if (this.hour < 2 && !this.rules.hollow) return;
      if (this._hh !== this.hour) { this._hh = this.hour; this._hAt = Math.random() < this.hollowChance ? rand(0.1, 0.8) : -1; }
      if (this._hAt < 0) return;
      if (((this.time / this.duration) * 6) % 1 >= this._hAt && this.room('pepper') !== 'HALL' && this.room('oldbruno') !== 'HALL' && this.room('oldkrok') !== 'HALL') {
        this._hAt = -1; this.hollow = { t: 0, lit: 0 }; AU.play('whisper', { pan: 0 });
      }
    }

    // ------------------------------------------------ rendering
    render(t) {
      if (this.camAnim >= 1 && this.camUp) { this.drawCam(t); return; }
      this.drawOffice(t);
      if (this.camAnim > 0) this.renderCamTransition(t);
      this.post(t);
      if (this.maskA > 0) this.drawMask(t);
    }
    drawOffice(t) {
      if (FN.G3.enabled && FN.Office2) {
        try { (this.o3 = this.o3 || new FN.Office2(this)).render(t); return; } catch (e) { console.error('3D office disabled:', e); FN.G3.enabled = false; this.o3 = null; }
      }
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, this.W, this.H);
      this.officeTransform();
      ctx.drawImage(R.office(2), 0, 0);
      // hallway
      const hx = 564, hy = 136, hw = 472, hh = 444;
      ctx.save(); ctx.beginPath(); ctx.rect(hx, hy, hw, hh); ctx.clip();
      ctx.drawImage(R.hall2(this.flash), hx, hy);
      if (this.flash) {
        // flashlight cone first, then whatever stands in it
        const cone = ctx.createRadialGradient(800, 380, 40, 800, 380, 330);
        cone.addColorStop(0, 'rgba(0,0,0,0)'); cone.addColorStop(1, 'rgba(0,0,0,0.85)');
        ctx.fillStyle = cone; ctx.fillRect(hx, hy, hw, hh);
        if (this.hollow) A.drawChar(ctx, 'hollow', 800, 450, 170, { t, pose: 'slump', light: 0.5, eyes: 1 });
        const k = this.a.oldkrok;
        if (this.room('oldkrok') === 'HALL' && this.level('oldkrok') > 0) {
          const p = clamp(k.hallT / Math.max(8, 18 - this.level('oldkrok') * 0.45), 0, 1);
          A.drawChar(ctx, 'oldkrok', 800 + Math.sin(t * 3) * 6, 440 + p * 180, 180 + p * 260, { t, pose: 'walk', phase: t * 2, light: 0.85, eyes: 1, jaw: 0.3 + p * 0.4 });
        }
        for (const id of ['oldbruno', 'pepper']) if (this.room(id) === 'HALL') A.drawChar(ctx, id, id === 'pepper' ? 860 : 740, 560, 360, { t, pose: 'idle', light: 0.85, eyes: 1 });
      } else {
        // eyes in the dark
        for (const id of ['oldbruno', 'pepper', 'oldkrok']) if (this.room(id) === 'HALL' && this.level(id) > 0 && Math.sin(t * 2 + id.length) > 0.3) A.drawChar(ctx, id, 800, 560, 320, { t, light: 0, eyes: 0.5 });
      }
      ctx.restore();
      // vents
      for (const s of ['L', 'R']) {
        const x = s === 'L' ? 150 : 1250, y = 434;
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, 200, 148); ctx.clip();
        ctx.drawImage(R.vent2(this.vent[s]), x, y);
        const who = s === 'L' ? (this.room('rico') === 'VENT_L' ? 'rico' : null) : this.room('lumi') === 'VENT_R' ? 'lumi' : null;
        if (who && this.vent[s]) A.drawChar(ctx, who, x + 100, y + 330, 340, { t, pose: who === 'lumi' ? 'float' : 'peek', light: 0.85, eyes: 1, jaw: 0.2 });
        ctx.restore();
        ctx.strokeStyle = 'rgba(30,32,36,0.9)'; ctx.lineWidth = 3;
        for (let i = 1; i < 8; i++) { ctx.beginPath(); ctx.moveTo(x, y + i * 18.5); ctx.lineTo(x + 200, y + i * 18.5); ctx.stroke(); }
      }
      // intruder standing in front of the desk
      if (this.intr && !this.camUp) {
        const on = Math.random() > 0.25;
        A.drawChar(ctx, this.intr.id, 800, 930, 820, { t, pose: this.intr.id === 'lumi' ? 'float' : 'idle', light: on ? 0.75 : 0.1, eyes: 1, jaw: 0.15 });
      }
      // lighting
      const dark = 0.35 + this.flicker * 0.5 + (this.chimeOut ? 0.2 : 0);
      const g = ctx.createRadialGradient(800, 200, 80, 800, 360, 950);
      g.addColorStop(0, `rgba(0,0,0,${dark * 0.4})`); g.addColorStop(1, `rgba(0,0,0,${Math.min(1, dark + 0.35)})`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.rect(0, 0, R.OW, R.OH);
      // lit areas (hallway, vents) are not darkened by the room ambience
      if (this.flash) ctx.rect(hx + hw, hy, -hw, hh);
      if (this.vent.L) ctx.rect(350, 434, -200, 148);
      if (this.vent.R) ctx.rect(1450, 434, -200, 148);
      ctx.fill('evenodd');
      if (this.chimeOut) {
        const a = clamp(this.chimeOut.t / 10, 0, 1);
        A.drawChar(ctx, 'chime', 800, 600 + (1 - a) * 200, 300 + a * 500, { t, pose: 'dance', light: 0.2 + a * 0.6, eyes: 1, alpha: Math.min(1, a * 2) });
      }
    }
    drawMask(t) {
      const ctx = this.ctx, W = this.W, H = this.H, a = this.maskA;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const off = (1 - a) * H + Math.sin(t * 2.4) * H * 0.01;
      ctx.save(); ctx.translate(0, off);
      ctx.fillStyle = 'rgba(8,6,6,0.96)';
      ctx.beginPath(); ctx.rect(0, 0, W, H);
      const ew = W * 0.17, eh = H * 0.15;
      ctx.ellipse(W * 0.33, H * 0.42, ew, eh, 0, 0, Math.PI * 2);
      ctx.ellipse(W * 0.67, H * 0.42, ew, eh, 0, 0, Math.PI * 2);
      ctx.fill('evenodd');
      ctx.strokeStyle = '#3a2a2a'; ctx.lineWidth = H * 0.02;
      ctx.beginPath(); ctx.ellipse(W * 0.33, H * 0.42, ew, eh, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(W * 0.67, H * 0.42, ew, eh, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    drawCamContents(ctx, map, unitH, t) {
      const cam = this.cam, room = R.cam(2, cam);
      if (this.glitch[cam] && Math.random() < 0.8) return;
      for (const id of Object.keys(PATHS)) {
        if (this.room(id) !== cam || this.level(id) <= 0) continue;
        const spot = room.spots[id];
        if (spot) this.camChar(ctx, map, unitH, id, spot, { t: t + id.length, pose: id === 'lumi' ? 'float' : cam.startsWith('0') && +cam <= 6 && +cam >= 5 ? 'peek' : 'idle', eyes: 1 });
      }
      if (cam === '08') this.camChar(ctx, map, unitH, 'endo', [0.5, 0.98, 0.42], { t, pose: 'slump', light: 0.3, eyes: 0.2 });
      if (cam === '11') {
        const spot = room.spots.chime;
        const awake = this.chimeOut;
        if (!awake || this.chimeOut.t < 3) this.camChar(ctx, map, unitH, 'chime', spot, { t, pose: awake ? 'dance' : 'idle', eyes: awake ? 1 : 0.15, light: 0.55 });
      }
      if (cam === '08' && !FN.Save.data.docs.d3 && this.night !== 'custom' && this.night >= 2 && (this._d3 ??= Math.random() < 0.15)) {
        const [x, y] = map(0.42, 0.42);
        ctx.save(); ctx.translate(x, y); ctx.rotate(-0.05);
        ctx.fillStyle = '#e8e0c8'; ctx.fillRect(0, 0, unitH * 0.16, unitH * 0.2);
        ctx.fillStyle = '#333'; for (let i = 0; i < 8; i++) ctx.fillRect(unitH * 0.012, unitH * (0.03 + i * 0.02), unitH * 0.13, 2);
        ctx.fillStyle = '#a11'; ctx.font = `bold ${unitH * 0.02}px Courier New`; ctx.fillText('KROK', unitH * 0.012, unitH * 0.024);
        ctx.restore();
        this._d3t = (this._d3t || 0) + 1 / 60;
        if (this._d3t > 1.2) FN.Trophies.doc('d3');
      }
      if (this.st.cam === cam) {
        A.drawChar(ctx, 'static', this.W / 2 + Math.sin(t * 40) * 6, this.H * 1.35, this.H * 1.45, { t, pose: 'idle', light: 0.85, eyes: 1, jaw: Math.min(1, this.st.seen) });
        this.extraStatic = 0.12;
      } else this.extraStatic = 0;
    }

    challengeFailed() { return false; }
    saveState() { return { battery: this.battery, box: this.box, a: this.a, masked: this.masked }; }
    loadState(s) {
      this.battery = s.battery; this.box = s.box; this.a = s.a; this.masked = s.masked || 0;
      for (const id in this.a) if (this.room(id) === 'OFFICE') this.a[id].i = 0;
    }
  }
  FN.Chapter2 = Chapter2;
})(window.FN);
