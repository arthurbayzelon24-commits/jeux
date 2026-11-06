/* FAZNIGHT — Chapter 1 : Grimwood's Pizza Palace. Two doors, two lights, eleven cameras, one battery. */
(function (FN) {
  const A = FN.Art, R = FN.Rooms, AU = FN.Audio;
  const { rand, clamp } = FN.util;

  // Story difficulty per night: [bruno, gus, nora, krok]
  const LEVELS = { 1: [0, 2, 1, 0], 2: [0, 4, 3, 2], 3: [1, 6, 5, 4], 4: [3, 8, 7, 7], 5: [5, 10, 10, 9], 6: [9, 14, 13, 13], 7: [14, 17, 16, 16] };
  const DRAIN = { 1: 0.38, 2: 0.44, 3: 0.48, 4: 0.51, 5: 0.54, 6: 0.58, 7: 0.6, custom: 0.55 };
  const INTERVAL = { bruno: 3.1, gus: 4.6, nora: 5.0, krok: 5.0 };
  const PATH = {
    gus: { '01': ['02'], '02': ['04', '05', '07'], '04': ['02', '07'], '05': ['07', '02'], '07': ['08', '05'], '08': ['DOOR_L', '07'] },
    nora: { '01': ['02'], '02': ['11', '09'], '11': ['09', '02'], '09': ['10', '11'], '10': ['DOOR_R', '09'] },
    bruno: { '01': ['02'], '02': ['06'], '06': ['09'], '09': ['10'], '10': ['DOOR_R'] },
  };
  const SIDE_PAN = { '01': 0, '02': 0, '03': -0.8, '04': -0.7, '05': -0.6, '06': 0.7, '07': -0.5, '08': -0.8, '09': 0.5, '10': 0.8, '11': 0.7, DOOR_L: -1, DOOR_R: 1 };

  FN.ch1Levels = (n) => {
    const l = LEVELS[n] || LEVELS[1];
    return { bruno: l[0], gus: l[1], nora: l[2], krok: l[3] };
  };

  const CALLS = {
    1: [
      { fr: 'Allô ? Allô ! Bienvenue chez Grimwood’s. Je suis Gérard, je faisais ce poste avant vous.', en: 'Hello? Hello! Welcome to Grimwood’s. I’m Gérard, I worked this shift before you.' },
      { fr: 'Les animatroniques se promènent un peu la nuit. Un vieux mode « veille » qui n’a jamais été corrigé.', en: 'The animatronics wander a little at night. An old “idle” mode nobody ever fixed.' },
      { fr: 'S’ils vous voient, ils risquent de vous prendre pour un squelette sans costume… et de vouloir vous en mettre un.', en: 'If they see you, they may take you for an endoskeleton without a suit… and want to put you in one.' },
      { fr: 'Utilisez les lumières pour vérifier les portes. Si quelqu’un est là, fermez. Mais attention : tout consomme de l’énergie.', en: 'Use the lights to check the doors. If someone is there, close up. But careful: everything drains power.' },
      { fr: 'Bon courage. Je vous rappelle demain.', en: 'Good luck. I’ll call you tomorrow.' },
    ],
    2: [
      { fr: 'Re-bonjour ! Vous avez survécu, bravo. Ce soir, ils seront plus actifs.', en: 'Hi again! You made it, well done. Tonight they’ll be more active.' },
      { fr: 'Surveillez le Marais. Krok n’aime pas qu’on l’oublie. S’il sort, il court… et il frappe fort.', en: 'Watch the Swamp. Krok doesn’t like being forgotten. If he gets out, he runs… and hits hard.' },
      { fr: 'Regardez sa caméra souvent, mais ne la fixez pas. Il le sent.', en: 'Check his camera often, but don’t stare. He can tell.' },
    ],
    3: [
      { fr: 'Nuit trois. Nora a une drôle d’habitude : elle disparaît des caméras.', en: 'Night three. Nora has an odd habit: she vanishes from the cameras.' },
      { fr: 'Si vous ne la trouvez plus, ne cherchez pas : allumez la lumière droite.', en: 'If you can’t find her, don’t search: turn on the right light.' },
      { fr: 'Et Bruno… s’il quitte la scène, restez calme. Il ne bouge que si personne ne le regarde.', en: 'And Bruno… if he leaves the stage, stay calm. He only moves when nobody is watching.' },
    ],
    4: [
      { fr: 'Allô ? … Je n’ai pas beaucoup de temps. Quelque chose cogne à la porte.', en: 'Hello? … I don’t have much time. Something keeps banging on the door.' },
      { fr: 'Dans la cuisine, la caméra montre parfois des chiffres. Notez-les. Le terminal du menu les connaît.', en: 'In the kitchen, the camera sometimes shows numbers. Write them down. The menu terminal knows them.' },
      { fr: 'Et si vous voyez quelqu’un qui n’a pas de visage… ne le regardez pas.', en: 'And if you see someone with no face… don’t look at it.' },
      { fr: 'Oh non… ils sont… [bruit métallique]', en: 'Oh no… they’re… [metallic noise]' },
    ],
    5: [
      { fr: '[Grésillements] … [voix déformée] … nous … attendons … toujours …', en: '[Static] … [distorted voice] … we … are still … waiting …' },
    ],
  };

  class Chapter1 extends FN.Night {
    constructor(cfg) {
      if (!cfg.levels) cfg.levels = FN.ch1Levels(cfg.night);
      super(cfg);
      this.power = this.rules.lowPower ? 50 : 100;
      this.minPower = this.power;
      this.drainK = DRAIN[this.night] || DRAIN.custom;
      this.doors = { L: false, R: false };
      this.doorA = { L: 0, R: 0 };
      this.lights = { L: false, R: false };
      this.broken = { L: false, R: false };
      this.a = {
        gus: { room: '01', t: rand(2, INTERVAL.gus), doorT: 0 },
        nora: { room: '01', t: rand(2, INTERVAL.nora), doorT: 0, charge: 0 },
        bruno: { room: '01', t: rand(2, INTERVAL.bruno), doorT: 0 },
        krok: { stage: 0, t: rand(2, INTERVAL.krok), lock: 0, run: false, runT: 0, runLeft: 0, bangs: 0 },
      };
      this.inOffice = null;
      this.officeT = 0;
      this.out = null; // power outage sequence
      this.fan = 0;
      this.nose = 0;
      this.hollow = null;
      this.hollowHourChance = this.rules.hollow ? 1 : this.night === 7 ? 0.25 : this.night === 'custom' ? 0.06 : this.night >= 3 ? 0.03 : 0;
      this.kitchenCode = false;
    }
    callScript() { return typeof this.night === 'number' ? CALLS[this.night] : null; }
    boost(id) {
      if (this.night === 'custom') return 0;
      const h = this.hour;
      if (id === 'gus') return (h >= 2) + (h >= 3) + (h >= 4);
      if (id === 'nora' || id === 'krok') return (h >= 3) + (h >= 4);
      return 0;
    }
    startLoops() { this.loops.fan = AU.loop('fan'); }

    // ------------------------------------------------ HUD
    buildHud() {
      this.commonHud();
      const u = this.ui;
      const sideBtn = (side, kind) => {
        const left = side === 'L';
        const style = { [left ? 'left' : 'right']: `calc(10px + var(--safe-${left ? 'l' : 'r'}))`, bottom: kind === 'door' ? 'calc(130px + var(--safe-b))' : 'calc(62px + var(--safe-b))' };
        if (kind === 'door') return this.button(`<span class="ico">▮</span>${FN.t('door')}`, 'door', style, () => this.toggleDoor(side));
        return this.button(`<span class="ico">☀</span>${FN.t('light')}`, 'light', style, () => this.setLight(side, true), () => this.setLight(side, false));
      };
      u.doorL = sideBtn('L', 'door'); u.lightL = sideBtn('L', 'light');
      u.doorR = sideBtn('R', 'door'); u.lightR = sideBtn('R', 'light');
      u.power = this.el('', 'info-bl');
      this.updateHud();
    }
    updateHud() {
      this.updateCommonHud();
      const u = this.ui; if (!u) return;
      const p = Math.max(0, Math.ceil(this.power));
      const usage = this.usage();
      const bars = Array.from({ length: Math.min(5, usage) }, (_, i) => `<i class="${i >= 3 ? 'r' : i >= 2 ? 'y' : ''}"></i>`).join('');
      u.power.innerHTML = `${FN.t('power', { p })}<br>${FN.t('usage')} <span class="usage">${bars}</span>`;
      for (const s of ['L', 'R']) {
        u['door' + s].classList.toggle('on', this.doors[s]);
        u['light' + s].classList.toggle('on', this.lights[s]);
        const dead = this.broken[s] || this.out;
        u['door' + s].classList.toggle('broken', !!dead);
        u['light' + s].classList.toggle('broken', !!dead || !!this.rules.noLight);
        u['door' + s].style.display = this.camUp ? 'none' : '';
        u['light' + s].style.display = this.camUp ? 'none' : '';
      }
      u.cambar.style.display = this.out ? 'none' : '';
      if (u.camBtns && this.camUp) for (const id in u.camBtns) u.camBtns[id].classList.toggle('alert', !!this.glitch[id]);
    }
    usage() { return 1 + (this.doors.L ? 1 : 0) + (this.doors.R ? 1 : 0) + (this.lights.L ? 1 : 0) + (this.lights.R ? 1 : 0) + (this.camUp ? 1 : 0); }

    // ------------------------------------------------ controls
    toggleDoor(side) {
      if (this.out || this.broken[side]) { AU.play('denied', { pan: side === 'L' ? -0.8 : 0.8 }); return; }
      this.doors[side] = !this.doors[side];
      this.stats.doorUses++;
      this._press = { side, t: performance.now() };
      AU.play(this.doors[side] ? 'doorClose' : 'doorOpen', { pan: side === 'L' ? -0.8 : 0.8 });
      this.updateHud();
    }
    setLight(side, on) {
      if (on && (this.out || this.broken[side] || this.rules.noLight)) { AU.play('denied', { pan: side === 'L' ? -0.8 : 0.8 }); return; }
      if (on) { const o = side === 'L' ? 'R' : 'L'; if (this.lights[o]) this.setLight(o, false); }
      if (this.lights[side] === on) return;
      this.lights[side] = on;
      if (on) {
        AU.play('lightOn', { pan: side === 'L' ? -0.8 : 0.8 });
        this.loops['buzz' + side] = AU.loop('lightBuzz', { pan: side === 'L' ? -0.8 : 0.8 });
        const who = this.atDoor(side);
        if (who) { AU.play('sting'); this.shake = 0.3; FN.Trophies.seen(who); }
      } else if (this.loops['buzz' + side]) { this.loops['buzz' + side].stop(0.05); delete this.loops['buzz' + side]; }
      this.updateHud();
    }
    atDoor(side) { for (const id of ['gus', 'nora', 'bruno']) if (this.a[id].room === 'DOOR_' + side) return id; return null; }
    onKey(e) {
      const k = e.key.toLowerCase();
      if (k === 'q' || k === 'a') this.toggleDoor('L');
      if (k === 'd' || k === 'p') this.toggleDoor('R');
      if (k === 's' || k === ' ') this.toggleCam();
    }
    onCamToggle(up) {
      if (up) { for (const s of ['L', 'R']) this.setLight(s, false); if (this.hollow) this.hollowGone(); }
      if (!up && this.inOffice) this._officeStrike = 0.35;
    }
    onCamView(id) {
      if (id === '03') this.a.krok.lock = rand(0.8, 16.7) * (this.level('krok') > 15 ? 0.5 : 1);
      if (id === '07' && this.a.krok.run) this.a.krok.runLeft = Math.min(this.a.krok.runLeft, 2.2);
      if (id === '06') this.kitchenCode = this.night !== 'custom' && this.night >= 3 && Math.random() < (this.night === 4 ? 0.45 : 0.2);
      if (id === '02') this.clipping = !FN.Save.data.docs.d1 && this.night !== 1 && Math.random() < 0.12;
      else this.clipping = false;
    }
    onTap(wx, wy, cx, cy) {
      // the badger's nose on the big poster
      if (this.o3 ? this.o3.pick(cx, cy) === 'nose' : Math.hypot(wx - 511, wy - 205) < 22) {
        AU.play('squeak');
        if (++this.nose >= 3) FN.Trophies.secret('nose');
      }
    }

    // ------------------------------------------------ simulation
    update(dt) {
      this.fan += dt * (this.out ? 0 : 14);
      for (const s of ['L', 'R']) this.doorA[s] = clamp(this.doorA[s] + (this.doors[s] ? dt : -dt) / 0.28, 0, 1);
      if (this.out) return this.updateOutage(dt);
      // power
      const unit = (this.drainK * 100) / this.duration;
      this.power -= this.usage() * unit * dt;
      this.minPower = Math.min(this.minPower, this.power);
      if (this.power <= 0) return this.powerOut();
      // AI
      this.aiDoorChar('gus', dt);
      this.aiDoorChar('nora', dt);
      this.aiDoorChar('bruno', dt);
      this.aiKrok(dt);
      // intruder in office
      if (this.inOffice) {
        this.officeT += dt;
        if (this._officeStrike != null) { this._officeStrike -= dt; if (this._officeStrike <= 0) return this.killedBy(this.inOffice); }
        if (this.camUp && this.officeT > 10) { this.toggleCam(false); }
        if (!this.camUp && this._officeStrike == null) this._officeStrike = 1.2;
      }
      // fake hallway noise from Gus
      if (Math.random() < dt * 0.012 * this.level('gus')) AU.play('step', { pan: -0.7, vol: 0.3 });
      this.updateHollow(dt);
    }
    aiDoorChar(id, dt) {
      const c = this.a[id];
      const lvl = this.level(id);
      if (lvl <= 0 || c.room === 'OFFICE') return;
      if (c.room.startsWith('DOOR')) {
        c.doorT += dt;
        const side = c.room.slice(5);
        // too long at an open door while the guard looks elsewhere: they slip in
        if (!this.doors[side] && !this.inOffice && c.doorT > 14 - lvl * 0.4) return this.enterOffice(id, side);
      }
      c.t -= dt;
      if (c.t > 0) return;
      c.t = INTERVAL[id] * rand(0.9, 1.1);
      if (!this.roll(id)) return;
      if (id === 'bruno') {
        if (this.viewing === c.room) return; // frozen while observed
        if (c.room === '01' && (this.a.gus.room === '01' || this.a.nora.room === '01') && lvl < 15) return;
      }
      if (id === 'nora') { c.charge++; if (c.charge < 2 && lvl < 15) return; c.charge = 0; }
      if (c.room.startsWith('DOOR')) {
        const side = c.room.slice(5);
        if (this.doors[side]) return this.moveTo(id, id === 'bruno' ? '09' : '02');
        if (this.camUp) return this.enterOffice(id, side);
        return;
      }
      const opts = PATH[id][c.room];
      if (!opts) return;
      let dest = opts[Math.floor(Math.random() * opts.length)];
      // personalities
      if (id === 'gus' && c.room === '02' && Math.random() < 0.15) dest = '08';
      if (id === 'nora' && c.room === '02' && Math.random() < 0.3) dest = '10';
      if (opts.length > 1 && (opts.includes('DOOR_L') || opts.includes('DOOR_R'))) dest = Math.random() < 0.75 ? opts[0] : opts[1];
      this.moveTo(id, dest);
    }
    moveTo(id, dest) {
      const c = this.a[id];
      const from = c.room;
      if (from === dest) return;
      c.room = dest;
      c.doorT = 0;
      if (from && !from.startsWith('DOOR')) this.glitch[from] = rand(1, 2);
      if (!dest.startsWith('DOOR')) this.glitch[dest] = rand(1, 2);
      const pan = SIDE_PAN[dest] || 0;
      if (id === 'bruno') AU.play('laugh', { pan, vol: 0.45, pitch: 100 });
      else AU.play('step', { pan, vol: dest.startsWith('DOOR') ? 0.9 : 0.4, metal: true });
      if (dest.startsWith('DOOR') && Math.random() < 0.5) setTimeout(() => !this.over && AU.play('step', { pan, vol: 0.8 }), 450);
      if (this.viewing === from || this.viewing === dest) AU.play('staticBurst', { dur: 0.8, vol: 0.6 });
    }
    enterOffice(id, side) {
      if (this.inOffice) return;
      this.inOffice = id;
      this.officeT = 0;
      this.a[id].room = 'OFFICE';
      this.broken[side] = true;
      if (this.lights[side]) this.setLight(side, false);
      AU.play('groan', { pan: side === 'L' ? -0.4 : 0.4, vol: 0.35 });
      this.updateHud();
    }
    aiKrok(dt) {
      const k = this.a.krok;
      const lvl = this.level('krok');
      if (lvl <= 0) return;
      k.lock = Math.max(0, k.lock - dt);
      if (k.run) {
        k.runT += dt; k.runLeft -= dt;
        if (k.runLeft <= 0) return this.krokArrive();
        return;
      }
      k.t -= dt;
      if (k.t > 0) return;
      k.t = INTERVAL.krok * rand(0.9, 1.1);
      if (this.viewing || k.lock > 0) return; // any active camera viewing freezes him in place (he’s shy of the lens)
      if (!this.roll('krok')) return;
      k.stage++;
      this.glitch['03'] = 1;
      if (k.stage >= 3) {
        k.stage = 3; k.run = true; k.runT = 0; k.runLeft = 22;
        AU.play('run', { pan: -0.6, n: 6 });
      }
    }
    krokArrive() {
      const k = this.a.krok;
      if (this.doors.L) {
        AU.play('bang', { pan: -0.9 }); setTimeout(() => !this.over && AU.play('bang', { pan: -0.9 }), 260); setTimeout(() => !this.over && AU.play('bang', { pan: -0.9 }), 520);
        this.shake = 1;
        this.power -= 2 + k.bangs * 4;
        k.bangs++;
        k.run = false; k.stage = Math.random() < 0.5 ? 0 : 1; k.t = INTERVAL.krok * 2;
        this.stats.krokHits = (this.stats.krokHits || 0) + 1;
        FN.Trophies.award('b_krok');
      } else {
        this.killedBy('krok');
      }
    }

    // ------------------------------------------------ power outage
    powerOut() {
      this.power = 0;
      this.hadPowerOut = true;
      this.out = { t: 0, phase: 0, next: rand(3, 8) };
      this.doors.L = this.doors.R = false;
      for (const s of ['L', 'R']) this.setLight(s, false);
      if (this.camUp) this.toggleCam(false);
      this.endCall(false);
      AU.play('powerDown');
      if (this.loops.fan) { this.loops.fan.stop(1.5); delete this.loops.fan; }
      this.updateHud();
    }
    updateOutage(dt) {
      const o = this.out;
      o.t += dt;
      if (o.phase === 0 && o.t > o.next) { o.phase = 1; o.t = 0; o.next = rand(6, 20); this.loops.box = AU.loop('musicBox', { pan: -0.7, vol: 0.3 }); AU.play('step', { pan: -0.9, vol: 0.8 }); }
      else if (o.phase === 1) {
        if (o.t > o.next || (Math.floor(o.t / 5) !== Math.floor((o.t - dt) / 5) && Math.random() < 0.2)) {
          o.phase = 2; o.t = 0; o.next = rand(2, 8);
          if (this.loops.box) { this.loops.box.stop(0.1); delete this.loops.box; }
          AU.play('powerDown');
        }
      } else if (o.phase === 2 && o.t > o.next) this.killedBy('bruno', { powerOut: true });
    }

    // ------------------------------------------------ rare: Hollow Hank in the office
    updateHollow(dt) {
      if (this.hollow) {
        this.hollow.t += dt;
        if (this.hollow.t > 3.5) { this.hollow = null; this.killedBy('hollow', { crash: true }); }
        return;
      }
      if (this.hour < 2 && !this.rules.hollow) return;
      if (this._hollowHour !== this.hour) { this._hollowHour = this.hour; this._hollowAt = Math.random() < this.hollowHourChance ? rand(0.1, 0.9) : -1; }
      if (this._hollowAt < 0 || this.camUp || this.inOffice) return;
      const frac = ((this.time / this.duration) * 6) % 1;
      if (frac >= this._hollowAt) {
        this._hollowAt = -1;
        this.hollow = { t: 0 };
        AU.play('whisper', { pan: 0 }); AU.play('hiddenTape');
        FN.Trophies.secret('hollow1');
        FN.Trophies.seen('hollow');
      }
    }
    hollowGone() { this.hollow = null; AU.play('glitch', {}); }

    // ------------------------------------------------ rendering
    render(t) {
      const ctx = this.ctx;
      if (this.camAnim >= 1 && this.camUp) { this.drawCam(t); return; }
      this.drawOffice(t);
      if (this.camAnim > 0) this.renderCamTransition(t);
      this.post(t);
    }
    drawOffice(t) {
      if (FN.G3.enabled && FN.Office1) {
        try { (this.o3 = this.o3 || new FN.Office1(this)).render(t); return; } catch (e) { console.error('3D office disabled:', e); FN.G3.enabled = false; this.o3 = null; }
      }
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, this.W, this.H);
      this.officeTransform();
      ctx.drawImage(R.office(1), 0, 0);
      // door interiors
      for (const s of ['L', 'R']) {
        const x = s === 'L' ? 100 : 1290;
        const lit = this.lights[s];
        ctx.drawImage(R.doorHall(s === 'L' ? 0 : 1, lit), x, 130);
        const who = this.atDoor(s);
        if (who && lit) {
          ctx.save(); ctx.beginPath(); ctx.rect(x, 130, 210, 500); ctx.clip();
          const isB = who === 'bruno';
          A.drawChar(ctx, who, x + (s === 'L' ? 130 : 80), 640, 470, { t, pose: isB ? 'idle' : 'lean', flip: s === 'R', light: isB ? 0.12 : 0.85, eyes: 1, jaw: who === 'gus' ? 0.2 : 0 });
          ctx.restore();
        }
        if (this.out && this.out.phase === 1 && s === 'L') {
          ctx.save(); ctx.beginPath(); ctx.rect(x, 130, 210, 500); ctx.clip();
          const on = Math.sin(t * 9) > 0.2 || Math.random() < 0.1;
          A.drawChar(ctx, 'bruno', x + 105, 650, 480, { t, pose: 'stage', light: on ? 0.35 : 0, eyes: on ? 1 : 0.2, jaw: Math.abs(Math.sin(t * 2)) * 0.4 });
          ctx.restore();
        }
        // shutter
        const d = this.doorA[s];
        if (d > 0) {
          const hgt = 500 * d;
          const g = ctx.createLinearGradient(x, 0, x + 210, 0);
          g.addColorStop(0, '#2a2d30'); g.addColorStop(0.5, '#6b7075'); g.addColorStop(1, '#2a2d30');
          ctx.fillStyle = g; ctx.fillRect(x, 130, 210, hgt);
          ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = 130 + 20; y < 130 + hgt; y += 26) ctx.fillRect(x, y, 210, 4);
          ctx.fillStyle = '#ffcc00'; for (let i = 0; i < 7; i++) ctx.fillRect(x + i * 30, 130 + hgt - 18, 15, 18);
          ctx.fillStyle = '#111'; for (let i = 0; i < 7; i++) ctx.fillRect(x + 15 + i * 30, 130 + hgt - 18, 15, 18);
        }
      }
      // fan blades
      ctx.save(); ctx.translate(841, 440);
      for (let i = 0; i < 3; i++) { ctx.rotate((Math.PI * 2) / 3); A.ell(ctx, 0, -32, 16, 34, `rgba(40,40,40,${this.out ? 0.95 : 0.55})`, 0); }
      ctx.rotate(this.fan); for (let i = 0; i < 3; i++) { ctx.rotate((Math.PI * 2) / 3); A.ell(ctx, 0, -32, 15, 33, 'rgba(60,60,60,0.85)'); }
      ctx.strokeStyle = '#333'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 62, 0, 7); ctx.stroke();
      for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(i * 0.52) * 62, Math.sin(i * 0.52) * 62); ctx.stroke(); }
      A.ell(ctx, 0, 0, 12, 12, '#222');
      ctx.restore();
      // Hollow Hank slumped against the back wall
      if (this.hollow) {
        const a = Math.min(1, this.hollow.t * 2);
        A.drawChar(ctx, 'hollow', 790, 610, 520, { t, pose: 'slump', light: 0.45 * a, eyes: a, alpha: a });
      }
      // lighting
      let dark = this.out ? (this.out.phase === 2 ? 0.985 : 0.9) : 0.32 + this.flicker * 0.5 + (Math.random() < 0.01 ? 0.3 : 0);
      if (this.silence > 0) dark += 0.08;
      const g = ctx.createRadialGradient(800, 120, 50, 800, 300, 900);
      g.addColorStop(0, `rgba(0,0,0,${dark * 0.4})`); g.addColorStop(1, `rgba(0,0,0,${Math.min(1, dark + 0.35)})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, R.OW, R.OH);
      if (!this.out && FN.Save.data.settings.shadows) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const lamp = ctx.createRadialGradient(800, 0, 10, 800, 200, 520);
        lamp.addColorStop(0, `rgba(255,220,160,${0.1 - this.flicker * 0.08})`); lamp.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = lamp; ctx.fillRect(250, 0, 1100, 720); ctx.restore();
      }
    }
    drawCamContents(ctx, map, unitH, t) {
      const cam = this.cam, room = R.cam(1, cam);
      if (this.glitch[cam] && Math.random() < 0.8) return;
      if (cam === '03') {
        const k = this.a.krok;
        const c = room.curtain;
        const [cx, cy] = map(c.x, c.y), [cx2, cy2] = map(c.x + c.w, c.y + c.h);
        const stage = k.run ? 3 : k.stage;
        if (stage === 1) this.camChar(ctx, map, unitH, 'krok', [0.5, 0.8, 0.55], { t, pose: 'peek', light: 0.3, eyes: 1 });
        if (stage === 2) this.camChar(ctx, map, unitH, 'krok', [0.52, 0.86, 0.68], { t, pose: 'lean', light: 0.4, eyes: 1, jaw: 0.3 });
        R.curtain(ctx, cx, cy, cx2 - cx, cy2 - cy, '#2a4a1c', [0, 0.25, 0.65, 1][stage]);
        if (stage === 3) { ctx.save(); ctx.font = `bold ${unitH * 0.06}px Georgia`; ctx.fillStyle = 'rgba(200,40,40,0.8)'; ctx.textAlign = 'center'; ctx.fillText(FN.lang === 'en' ? 'OUT OF ORDER' : 'HORS SERVICE', (cx + cx2) / 2, (cy + cy2) / 2); ctx.restore(); }
        return;
      }
      if (cam === '07' && this.a.krok.run && this.a.krok.runLeft < 3) {
        const p = clamp(1 - this.a.krok.runLeft / 2.2, 0, 1);
        this.camChar(ctx, map, unitH, 'krok', [0.5, 0.75 + p * 0.45, 0.4 + p * 0.8], { t, pose: 'walk', phase: t * 16, light: 0.5, eyes: 1, jaw: 0.6 });
      }
      for (const id of ['gus', 'nora', 'bruno']) {
        const c = this.a[id];
        if (c.room !== cam) continue;
        let spot = room.spots[id];
        if (!spot) continue;
        if (cam === '01') {
          const pose = id === 'bruno' ? 'stage' : 'stage';
          this.camChar(ctx, map, unitH, id, spot, { t: t + room.spots[id][0] * 10, pose, eyes: id === 'bruno' && this.level('bruno') > 0 && Math.random() < 0.02 ? 1 : 0.15 });
        } else {
          const close = cam === '08' || cam === '10';
          this.camChar(ctx, map, unitH, id, spot, { t, pose: close ? 'peek' : 'idle', flip: cam === '10', eyes: 1, jaw: close && id === 'gus' ? 0.4 : 0, light: id === 'bruno' ? 0.25 : room.light });
        }
      }
      if (cam === '04') this.camChar(ctx, map, unitH, 'endo', [0.16, 0.97, 0.78], { t, pose: 'idle', light: 0.35, eyes: Math.random() < 0.03 ? 1 : 0.25 });
      if (cam === '06') {
        if (this.a.bruno.room === '06' && Math.random() < 0.02) AU.play('laugh', { pan: 0.6, vol: 0.2 });
        if (this.kitchenCode) {
          ctx.save(); ctx.font = `bold ${unitH * 0.12}px Courier New`; ctx.fillStyle = `rgba(220,30,30,${0.4 + Math.random() * 0.4})`; ctx.textAlign = 'center';
          const [x, y] = map(0.5, 0.45); ctx.fillText('2 7 0 4', x, y); ctx.restore();
        }
      }
      if (cam === '02' && this.clipping) {
        const [x, y] = map(0.62, 0.38);
        ctx.save(); ctx.translate(x, y); ctx.rotate(0.06);
        ctx.fillStyle = '#d8d0b8'; ctx.fillRect(0, 0, unitH * 0.22, unitH * 0.16);
        ctx.fillStyle = '#222'; ctx.font = `bold ${unitH * 0.022}px Georgia`; ctx.fillText('GRIMWOOD’S OUVRE', unitH * 0.01, unitH * 0.03);
        for (let i = 0; i < 6; i++) ctx.fillRect(unitH * 0.01, unitH * (0.05 + i * 0.016), unitH * 0.19, 2);
        ctx.restore();
        this._clipT = (this._clipT || 0) + 1 / 60;
        if (this._clipT > 1.2) { this.clipping = false; FN.Trophies.doc('d1'); }
      }
    }

    /** "Sans erreur": no door slam from Krok, power never under 25 %. */
    challengeFailed() { return !!this.rules.flawless && (this.minPower < 25 || (this.stats.krokHits || 0) > 0); }

    // ------------------------------------------------ save / resume
    saveState() {
      return { power: this.power, minPower: this.minPower, a: this.a, doors: this.doors, broken: this.broken, inOffice: this.inOffice, hadPowerOut: this.hadPowerOut };
    }
    loadState(s) {
      this.power = s.power; this.minPower = s.minPower; this.a = s.a; this.doors = s.doors; this.broken = s.broken; this.inOffice = s.inOffice;
      this.doorA = { L: this.doors.L ? 1 : 0, R: this.doors.R ? 1 : 0 };
      if (this.power <= 0) this.powerOut();
    }
  }
  FN.Chapter1 = Chapter1;
})(window.FN);
