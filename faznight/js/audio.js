/* FAZNIGHT — original sound design, fully synthesised with the Web Audio API (no sample files). */
(function (FN) {
  let ctx = null;
  let master, buses = {};
  let noiseBuf = null, pinkBuf = null, brownBuf = null, reverb = null;
  const loops = new Set();
  let musicTimer = 0;

  const A = {
    ready: false,
    vols: { master: 0.9, music: 0.7, sfx: 0.9, amb: 0.8, voice: 0.9 },

    init() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC({ latencyHint: 'interactive' });
      master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
      master.connect(comp).connect(ctx.destination);
      for (const b of ['music', 'sfx', 'amb', 'voice']) { buses[b] = ctx.createGain(); buses[b].connect(master); }
      noiseBuf = makeNoise('white'); pinkBuf = makeNoise('pink'); brownBuf = makeNoise('brown');
      reverb = ctx.createConvolver(); reverb.buffer = makeImpulse(2.8, 2.2);
      const rvGain = ctx.createGain(); rvGain.gain.value = 0.55;
      reverb.connect(rvGain).connect(master);
      this.ready = true;
      this.applyVolumes();
      // iOS: unlock with a silent buffer
      const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0);
    },
    get ctx() { return ctx; },
    now() { return ctx ? ctx.currentTime : 0; },
    setVolumes(v) { Object.assign(this.vols, v); this.applyVolumes(); },
    applyVolumes() {
      if (!ctx) return;
      const t = ctx.currentTime;
      master.gain.setTargetAtTime(this.vols.master, t, 0.05);
      for (const b in buses) buses[b].gain.setTargetAtTime(this.vols[b] ?? 1, t, 0.05);
    },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },

    /** One-shot sound effect. opts: { pan (-1..1), vol, bus } */
    play(name, opts = {}) {
      if (!ctx || !SFX[name]) return;
      try { SFX[name](opts); } catch (e) { /* never break the game for a sound */ }
    },
    /** Looping sound. Returns { stop(fade), vol(v), pan(p) }. */
    loop(name, opts = {}) {
      if (!ctx || !LOOPS[name]) return dummyLoop;
      const h = LOOPS[name](opts);
      loops.add(h);
      const stop = h.stop;
      h.stop = (fade = 0.3) => { loops.delete(h); stop(fade); };
      return h;
    },
    stopAllLoops(fade = 0.2) { for (const h of [...loops]) h.stop(fade); },
    music(name) { this.stopMusic(); if (ctx && MUSIC[name]) { MUSIC[name](); A._musicName = name; } },
    stopMusic() { clearInterval(musicTimer); musicTimer = 0; A._musicName = null; if (A._musicOut) { fadeOut(A._musicOut, 1.2); A._musicOut = null; } },

    /** Phone voice using the device's speech engine when available (subtitles are always shown). */
    speak(text, lang, onEnd) {
      const synth = window.speechSynthesis;
      if (!synth || !text) { onEnd && setTimeout(onEnd, 400); return false; }
      try {
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang === 'en' ? 'en-US' : 'fr-FR';
        u.rate = 0.96; u.pitch = 0.75;
        u.volume = Math.max(0, Math.min(1, this.vols.voice * this.vols.master));
        const v = synth.getVoices().find((x) => x.lang && x.lang.toLowerCase().startsWith(u.lang.slice(0, 2)));
        if (v) u.voice = v;
        u.onend = () => onEnd && onEnd();
        u.onerror = () => onEnd && onEnd();
        synth.speak(u);
        return true;
      } catch (e) { onEnd && onEnd(); return false; }
    },
    stopSpeak() { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {} },
  };
  const dummyLoop = { stop() {}, vol() {}, pan() {} };

  // ---------------------------------------------------------------- helpers
  function makeNoise(kind) {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else if (kind === 'pink') { b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2 + w * 0.02) * 2.2; }
      else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    }
    return buf;
  }
  function makeImpulse(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  function distCurve(k) {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / n) * 2 - 1; c[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x)); }
    return c;
  }
  function out(bus = 'sfx', pan = 0, wet = 0) {
    const g = ctx.createGain();
    let node = g;
    if (pan) {
      if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); node = p; }
      else { const p = ctx.createPanner(); p.panningModel = 'equalpower'; p.setPosition(pan, 0, 1 - Math.abs(pan)); g.connect(p); node = p; }
    }
    node.connect(buses[bus] || buses.sfx);
    if (wet) { const w = ctx.createGain(); w.gain.value = wet; node.connect(w); w.connect(reverb); }
    return g;
  }
  function env(g, t, a, peak, d, end = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(end, t + a + d);
  }
  function osc(type, f, t, dur, dest, peak = 0.3, a = 0.005, f2 = null) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
    const g = ctx.createGain(); env(g, t, a, peak, dur);
    o.connect(g).connect(dest); o.start(t); o.stop(t + a + dur + 0.05);
    return o;
  }
  function noise(t, dur, dest, { type = 'bandpass', f = 1000, q = 1, peak = 0.3, a = 0.005, f2 = null, buf = noiseBuf } = {}) {
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain(); env(g, t, a, peak, dur);
    s.connect(fl).connect(g).connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + a + dur + 0.05);
    return s;
  }
  function fadeOut(g, s) { const t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + s); }
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  // ---------------------------------------------------------------- one-shot effects
  const SFX = {
    click(o) { const t = ctx.currentTime, d = out('sfx', o.pan); noise(t, 0.03, d, { type: 'highpass', f: 2500, peak: 0.35 * (o.vol ?? 1) }); },
    uiMove() { const t = ctx.currentTime; osc('square', 180, t, 0.04, out('sfx'), 0.05); },
    uiSelect() { const t = ctx.currentTime, d = out('sfx', 0, 0.3); osc('sawtooth', 110, t, 0.35, d, 0.08, 0.005, 55); noise(t, 0.2, d, { f: 600, peak: 0.12 }); },
    doorClose(o) {
      const t = ctx.currentTime, d = out('sfx', o.pan, 0.15);
      noise(t, 0.32, d, { type: 'bandpass', f: 1800, f2: 400, q: 0.8, peak: 0.35 });
      osc('sine', 90, t + 0.28, 0.35, d, 0.9, 0.003, 38);
      osc('square', 230, t + 0.29, 0.08, d, 0.12); osc('square', 347, t + 0.3, 0.12, d, 0.08);
      noise(t + 0.29, 0.25, d, { type: 'lowpass', f: 500, peak: 0.6 });
    },
    doorOpen(o) {
      const t = ctx.currentTime, d = out('sfx', o.pan, 0.15);
      noise(t, 0.35, d, { type: 'bandpass', f: 400, f2: 2200, q: 0.8, peak: 0.3 });
      osc('square', 200, t + 0.33, 0.06, d, 0.08);
      osc('sine', 70, t + 0.33, 0.2, d, 0.4, 0.003, 45);
    },
    lightOn(o) { const t = ctx.currentTime, d = out('sfx', o.pan); noise(t, 0.025, d, { type: 'highpass', f: 3000, peak: 0.4 }); osc('square', 60, t, 0.05, d, 0.06); },
    denied(o) { const t = ctx.currentTime, d = out('sfx', o.pan); osc('square', 95, t, 0.25, d, 0.18); osc('square', 90, t + 0.28, 0.25, d, 0.18); },
    camUp() { const t = ctx.currentTime, d = out('sfx'); noise(t, 0.28, d, { f: 300, f2: 2400, q: 1.2, peak: 0.22 }); osc('sine', 1400, t + 0.22, 0.08, d, 0.06); },
    camDown() { const t = ctx.currentTime, d = out('sfx'); noise(t, 0.25, d, { f: 2400, f2: 300, q: 1.2, peak: 0.2 }); },
    camSwitch() { const t = ctx.currentTime, d = out('sfx'); noise(t, 0.02, d, { type: 'highpass', f: 2000, peak: 0.3 }); noise(t + 0.01, 0.18, d, { type: 'highpass', f: 1200, peak: 0.12 }); osc('sine', 880, t, 0.05, d, 0.04); },
    staticBurst(o) { const t = ctx.currentTime, d = out('sfx', o.pan); noise(t, o.dur || 0.6, d, { type: 'highpass', f: 900, peak: 0.25 * (o.vol ?? 1) }); },
    step(o) {
      const t = ctx.currentTime, d = out('amb', o.pan, 0.35), v = o.vol ?? 0.6;
      osc('sine', 85, t, 0.16, d, 0.7 * v, 0.004, 45);
      noise(t, 0.12, d, { type: 'lowpass', f: 320, peak: 0.6 * v });
      if (o.metal) { osc('square', 260 + Math.random() * 80, t + 0.02, 0.06, d, 0.05 * v); osc('sawtooth', 900 + Math.random() * 300, t + 0.03, 0.18, d, 0.015 * v, 0.02, 1400); }
      osc('sine', 70, t + 0.09, 0.12, d, 0.4 * v, 0.004, 40); // toe after heel
    },
    run(o) { for (let i = 0; i < (o.n || 10); i++) setTimeout(() => SFX.step({ pan: o.pan, vol: 0.4 + i * 0.06, metal: true }), i * 190); },
    bang(o) {
      const t = ctx.currentTime, d = out('sfx', o.pan, 0.25);
      osc('sine', 110, t, 0.4, d, 1, 0.002, 35);
      noise(t, 0.4, d, { type: 'bandpass', f: 700, q: 0.6, peak: 0.9 });
      for (let i = 0; i < 4; i++) osc('square', 300 + Math.random() * 600, t + 0.02 + i * 0.03, 0.12, d, 0.06);
    },
    knock(o) { const t = ctx.currentTime, d = out('sfx', o.pan, 0.2); for (let i = 0; i < 3; i++) { osc('sine', 180, t + i * 0.18, 0.1, d, 0.6, 0.002, 90); noise(t + i * 0.18, 0.05, d, { f: 900, peak: 0.3 }); } },
    clank(o) {
      const t = ctx.currentTime, d = out('amb', o.pan ?? Math.random() * 2 - 1, 0.6), v = o.vol ?? 0.3;
      [523, 1187, 1741, 2411].forEach((f, i) => osc('sine', f * (0.9 + Math.random() * 0.2), t, 0.8 - i * 0.15, d, v * (0.4 - i * 0.07), 0.002));
      noise(t, 0.08, d, { type: 'highpass', f: 2000, peak: v * 0.5 });
    },
    creak(o) {
      const t = ctx.currentTime, d = out('amb', o.pan ?? 0, 0.5);
      const s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.setValueAtTime(70, t);
      for (let i = 0; i < 12; i++) s.frequency.linearRampToValueAtTime(60 + Math.random() * 60, t + i * 0.12);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 6;
      const g = ctx.createGain(); env(g, t, 0.2, 0.12 * (o.vol ?? 1), 1.3);
      s.connect(f).connect(g).connect(d); s.start(t); s.stop(t + 1.6);
    },
    laugh(o) {
      const t = ctx.currentTime, d = out('sfx', o.pan, 0.5), v = o.vol ?? 0.6;
      const shaper = ctx.createWaveShaper(); shaper.curve = distCurve(40); shaper.connect(d);
      const base = o.pitch || 105;
      for (let i = 0; i < 4; i++) {
        const st = t + i * 0.26, s = ctx.createOscillator(); s.type = 'sawtooth';
        s.frequency.setValueAtTime(base * (1.15 - i * 0.05), st); s.frequency.exponentialRampToValueAtTime(base * 0.8, st + 0.22);
        const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 520; f1.Q.value = 5;
        const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 880; f2.Q.value = 6;
        const g = ctx.createGain(); env(g, st, 0.03, v * 0.9, 0.2);
        s.connect(f1).connect(g); s.connect(f2).connect(g); g.connect(shaper); s.start(st); s.stop(st + 0.3);
      }
    },
    chitter(o) { const t = ctx.currentTime, d = out('sfx', o.pan, 0.3); for (let i = 0; i < 9; i++) osc('square', 1400 + Math.random() * 900, t + i * 0.05, 0.03, d, 0.05); },
    bubble(o) { const t = ctx.currentTime, d = out('sfx', o.pan, 0.6); for (let i = 0; i < 5; i++) osc('sine', 300 + Math.random() * 400, t + i * 0.09, 0.12, d, 0.12, 0.01, 900); },
    ventCrawl(o) {
      const t = ctx.currentTime, d = out('sfx', o.pan, 0.35), v = o.vol ?? 0.5;
      for (let i = 0; i < 6; i++) noise(t + i * 0.22 + Math.random() * 0.06, 0.12, d, { f: 900 + Math.random() * 700, q: 2, peak: v * 0.5 });
      osc('sine', 60, t, 1.3, d, v * 0.15, 0.2);
    },
    jumpscare(o) {
      const t = ctx.currentTime, d = out('sfx', 0, 0.2);
      const shaper = ctx.createWaveShaper(); shaper.curve = distCurve(120);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.1, t + 0.02); g.gain.setValueAtTime(1.1, t + 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      shaper.connect(g).connect(d);
      const base = o.pitch || 420;
      for (let i = 0; i < 4; i++) {
        const s = ctx.createOscillator(); s.type = 'sawtooth';
        s.frequency.setValueAtTime(base * (0.7 + i * 0.27), t);
        const lfo = ctx.createOscillator(); lfo.frequency.value = 23 + i * 7; const lg = ctx.createGain(); lg.gain.value = 60 + i * 30;
        lfo.connect(lg).connect(s.frequency);
        s.frequency.linearRampToValueAtTime(base * (0.5 + i * 0.2), t + 1.5);
        const sg = ctx.createGain(); sg.gain.value = 0.25; s.connect(sg).connect(shaper);
        s.start(t); lfo.start(t); s.stop(t + 1.7); lfo.stop(t + 1.7);
      }
      noise(t, 1.4, shaper, { f: 2200, q: 0.5, peak: 0.9, a: 0.01 });
      osc('sine', 60, t, 1.0, d, 1, 0.005, 30);
      // screech: a sweeping, vowel-filtered scream on top of the machinery
      for (const [f0, q] of [[900, 9], [1700, 11], [2600, 13]]) {
        const s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.setValueAtTime(base * 0.9, t); s.frequency.exponentialRampToValueAtTime(base * 1.6, t + 0.25); s.frequency.exponentialRampToValueAtTime(base * 0.7, t + 1.4);
        const vib = ctx.createOscillator(); vib.frequency.value = 9; const vg = ctx.createGain(); vg.gain.value = base * 0.06; vib.connect(vg).connect(s.frequency);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f0; bp.Q.value = q;
        const sg = ctx.createGain(); sg.gain.setValueAtTime(0.0001, t); sg.gain.exponentialRampToValueAtTime(0.7, t + 0.03); sg.gain.setValueAtTime(0.7, t + 1.0); sg.gain.exponentialRampToValueAtTime(0.0001, t + 1.55);
        s.connect(bp).connect(sg).connect(shaper); s.start(t); vib.start(t); s.stop(t + 1.6); vib.stop(t + 1.6);
      }
      // metal crash as it hits the guard
      [420, 977, 1583, 2311, 3150].forEach((f, i) => osc('square', f, t + 0.02, 0.6 - i * 0.08, d, 0.08, 0.001));
      noise(t + 0.02, 0.5, d, { type: 'highpass', f: 3000, peak: 0.5 });
    },
    sting(o) { const t = ctx.currentTime, d = out('sfx', 0, 0.6); osc('sawtooth', 55, t, 2.2, d, 0.4, 0.01, 40); noise(t, 1.5, d, { f: 3000, f2: 300, peak: 0.3 }); [61, 62, 66].forEach((n) => osc('sawtooth', midi(n), t, 1.6, d, 0.06, 0.02)); },
    powerDown() {
      const t = ctx.currentTime, d = out('sfx', 0, 0.4);
      osc('sawtooth', 420, t, 2.4, d, 0.25, 0.01, 25);
      osc('sine', 100, t, 2.4, d, 0.4, 0.01, 20);
      noise(t + 0.05, 0.25, d, { type: 'lowpass', f: 600, peak: 0.8 });
    },
    chimes6() {
      const t = ctx.currentTime, d = out('sfx', 0, 0.7);
      [72, 76, 79, 84, 79, 84].forEach((n, i) => {
        const st = t + i * 0.42, f = midi(n);
        [1, 2.76, 5.4].forEach((m, j) => osc('sine', f * m, st, 2.4 - j * 0.6, d, 0.22 / (j + 1), 0.002));
      });
      // distant crowd cheering (filtered noise with tremolo)
      const s = ctx.createBufferSource(); s.buffer = pinkBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.6;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + 1.2); g.gain.linearRampToValueAtTime(0.25, t + 2); g.gain.linearRampToValueAtTime(0.0001, t + 5.5);
      const trem = ctx.createOscillator(); trem.frequency.value = 7; const tg = ctx.createGain(); tg.gain.value = 0.08; trem.connect(tg).connect(g.gain);
      s.connect(f).connect(g).connect(d); s.start(t); trem.start(t); s.stop(t + 6); trem.stop(t + 6);
    },
    phoneRing() { const t = ctx.currentTime, d = out('sfx', 0.3, 0.3); for (let r = 0; r < 2; r++) for (let i = 0; i < 20; i++) { const st = t + r * 1.6 + i * 0.05; osc('sine', 440, st, 0.04, d, 0.08); osc('sine', 480, st, 0.04, d, 0.08); } },
    phoneClick() { const t = ctx.currentTime; noise(t, 0.06, out('sfx', 0.3), { type: 'highpass', f: 1500, peak: 0.3 }); },
    trophy() { const t = ctx.currentTime, d = out('sfx', 0, 0.5); [67, 71, 74, 79].forEach((n, i) => osc('triangle', midi(n), t + i * 0.09, 0.6, d, 0.12)); },
    unlock() { const t = ctx.currentTime, d = out('sfx', 0, 0.8); [57, 60, 64, 69, 72].forEach((n, i) => osc('sawtooth', midi(n), t + i * 0.18, 1.6, d, 0.06, 0.02)); osc('sine', 40, t, 3, d, 0.5, 0.5); },
    thunder() {
      const t = ctx.currentTime, d = out('amb', Math.random() * 1.2 - 0.6, 0.6);
      noise(t, 3.5, d, { type: 'lowpass', f: 300, f2: 80, peak: 0.6, a: 0.15, buf: brownBuf });
      noise(t + 0.05, 0.6, d, { type: 'lowpass', f: 900, peak: 0.35, a: 0.01, buf: brownBuf });
    },
    squeak() { const t = ctx.currentTime; osc('sine', 1200, t, 0.12, out('sfx'), 0.25, 0.005, 1900); },
    glitch(o) { const t = ctx.currentTime, d = out('sfx', o.pan); for (let i = 0; i < 14; i++) osc('square', 80 + Math.random() * 2400, t + i * 0.03, 0.025, d, 0.12); },
    crank() { const t = ctx.currentTime, d = out('sfx', 0); noise(t, 0.02, d, { type: 'highpass', f: 4000, peak: 0.25 }); osc('square', 2200, t, 0.01, d, 0.03); },
    flash(o) { const t = ctx.currentTime, d = out('sfx', o.pan); noise(t, 0.02, d, { type: 'highpass', f: 5000, peak: 0.3 }); },
    mask() { const t = ctx.currentTime, d = out('sfx'); noise(t, 0.3, d, { type: 'lowpass', f: 700, peak: 0.5 }); osc('sine', 120, t, 0.15, d, 0.3, 0.005, 60); },
    heartbeat() { const t = ctx.currentTime, d = out('sfx'); osc('sine', 60, t, 0.15, d, 0.6, 0.005, 40); osc('sine', 55, t + 0.22, 0.18, d, 0.5, 0.005, 35); },
    whisper(o) {
      const t = ctx.currentTime, d = out('sfx', o.pan ?? 0, 0.8);
      for (let i = 0; i < 8; i++) noise(t + i * 0.16 + Math.random() * 0.05, 0.12, d, { f: 2500 + Math.random() * 2000, q: 4, peak: 0.12 });
    },
    hiddenTape() {
      // a slowed, reversed-sounding message: formant syllables descending in pitch
      const t = ctx.currentTime, d = out('sfx', 0, 0.9);
      for (let i = 0; i < 14; i++) {
        const st = t + i * 0.32, s = ctx.createOscillator(); s.type = 'sawtooth';
        s.frequency.setValueAtTime(70 + Math.random() * 30, st); s.frequency.linearRampToValueAtTime(140 + Math.random() * 40, st + 0.28);
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 400 + Math.random() * 900; f.Q.value = 7;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(0.5, st + 0.26); g.gain.exponentialRampToValueAtTime(0.0001, st + 0.3);
        s.connect(f).connect(g).connect(d); s.start(st); s.stop(st + 0.32);
      }
      noise(t, 4.6, d, { type: 'highpass', f: 3000, peak: 0.05, a: 0.3 });
    },
    groan(o) {
      const t = ctx.currentTime, d = out('sfx', o.pan, 0.5);
      const s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.setValueAtTime(75, t); s.frequency.linearRampToValueAtTime(52, t + 1.6);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 450; f.Q.value = 3;
      const g = ctx.createGain(); env(g, t, 0.4, 0.4 * (o.vol ?? 1), 1.3);
      s.connect(f).connect(g).connect(d); s.start(t); s.stop(t + 1.9);
    },
  };

  // ---------------------------------------------------------------- loops
  function noiseLoop(bus, { type, f, q, vol, buf = noiseBuf, pan = 0, amp = null }) {
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    const d = out(bus, pan);
    s.connect(fl).connect(g).connect(d);
    s.start(0, Math.random());
    g.gain.setTargetAtTime(vol, ctx.currentTime, 0.2);
    let lfo = null;
    if (amp) { lfo = ctx.createOscillator(); lfo.frequency.value = amp.rate; const lg = ctx.createGain(); lg.gain.value = amp.depth; lfo.connect(lg).connect(g.gain); lfo.start(); }
    return {
      node: g, filter: fl,
      stop(fade) { g.gain.setTargetAtTime(0, ctx.currentTime, Math.max(0.01, fade / 3)); setTimeout(() => { try { s.stop(); lfo && lfo.stop(); } catch (e) {} }, fade * 1000 + 200); },
      vol(v) { g.gain.setTargetAtTime(v, ctx.currentTime, 0.08); },
      pan() {},
    };
  }
  const LOOPS = {
    /** Fluorescent / mains hum with a slow beat between two tubes. */
    hum: () => {
      const a = ctx.createOscillator(), b = ctx.createOscillator(); a.type = 'sawtooth'; b.type = 'sawtooth'; a.frequency.value = 100; b.frequency.value = 100.7;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 220; f.Q.value = 2;
      const g = ctx.createGain(); g.gain.value = 0; a.connect(f); b.connect(f); f.connect(g).connect(out('amb')); a.start(); b.start();
      g.gain.setTargetAtTime(0.025, ctx.currentTime, 1);
      return { stop(fade) { g.gain.setTargetAtTime(0, ctx.currentTime, fade / 3 + 0.01); setTimeout(() => { a.stop(); b.stop(); }, fade * 1000 + 300); }, vol(v) { g.gain.setTargetAtTime(v, ctx.currentTime, 0.2); }, pan() {} };
    },
    /** Rain on the roof: filtered noise plus random drips. */
    rain: () => {
      const h = noiseLoop('amb', { type: 'bandpass', f: 1800, q: 0.4, vol: 0.05, buf: pinkBuf });
      let alive = true;
      const drip = () => { if (!alive) return; const t = ctx.currentTime; osc('sine', 1200 + Math.random() * 1500, t, 0.05, out('amb', Math.random() * 2 - 1, 0.4), 0.03, 0.002, 600); setTimeout(drip, 120 + Math.random() * 600); };
      drip();
      const stop = h.stop; h.stop = (f) => { alive = false; stop(f); };
      return h;
    },
    fan: () => noiseLoop('amb', { type: 'bandpass', f: 420, q: 0.7, vol: 0.12, buf: pinkBuf, amp: { rate: 16, depth: 0.025 } }),
    staticNoise: (o) => noiseLoop('sfx', { type: 'highpass', f: 1200, q: 0.5, vol: o.vol ?? 0.05 }),
    lightBuzz: (o) => {
      const s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.value = 120;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1100;
      const g = ctx.createGain(); g.gain.value = 0.045; const d = out('sfx', o.pan);
      s.connect(f).connect(g).connect(d); s.start();
      return { stop() { g.gain.setTargetAtTime(0, ctx.currentTime, 0.02); setTimeout(() => s.stop(), 200); }, vol(v) { g.gain.value = v; }, pan() {} };
    },
    drone: (o) => {
      const g = ctx.createGain(); g.gain.value = 0; const d = out('amb', 0, 0.4);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220; f.Q.value = 2;
      const oscs = [o.base || 46, (o.base || 46) * 1.012, (o.base || 46) * 1.5].map((fr, i) => { const s = ctx.createOscillator(); s.type = i === 2 ? 'sine' : 'sawtooth'; s.frequency.value = fr; s.connect(f); s.start(); return s; });
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 90; lfo.connect(lg).connect(f.frequency); lfo.start();
      f.connect(g).connect(d);
      g.gain.setTargetAtTime(o.vol ?? 0.18, ctx.currentTime, 1.5);
      return { stop(fade) { g.gain.setTargetAtTime(0, ctx.currentTime, fade / 3 + 0.01); setTimeout(() => { oscs.forEach((s) => s.stop()); lfo.stop(); }, fade * 1000 + 300); }, vol(v) { g.gain.setTargetAtTime(v, ctx.currentTime, 0.3); }, pan() {} };
    },
    breath: () => {
      const s = ctx.createBufferSource(); s.buffer = pinkBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.8;
      const g = ctx.createGain(); g.gain.value = 0.03;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.42; const lg = ctx.createGain(); lg.gain.value = 0.18; lfo.connect(lg).connect(g.gain);
      s.connect(f).connect(g).connect(out('sfx')); s.start(); lfo.start();
      return { stop() { g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); setTimeout(() => { s.stop(); lfo.stop(); }, 300); }, vol() {}, pan() {} };
    },
    /** Original music-box melody; used by the power-outage sequence and by Madame Chime. */
    musicBox: (o) => {
      const notes = o.notes || [69, 72, 76, 74, 72, 71, 72, 69, 76, 79, 77, 76, 74, 72, 71, 64, 69, 72, 76, 81, 79, 76, 74, 71, 72, 71, 69, 68, 69, -1, -1, -1];
      const g = ctx.createGain(); g.gain.value = o.vol ?? 0.25; const d = out(o.bus || 'music', o.pan || 0, 0.5); g.connect(d);
      let i = 0, next = ctx.currentTime + 0.05, alive = true; const step = o.step || 0.3; const detune = o.detune || 0;
      const tick = () => {
        if (!alive) return;
        while (next < ctx.currentTime + 0.25) {
          const n = notes[i % notes.length];
          if (n > 0) { const f = midi(n) * (1 + (Math.random() - 0.5) * detune); osc('triangle', f, next, 0.9, g, 0.4, 0.003); osc('sine', f * 4.01, next, 0.25, g, 0.06, 0.002); }
          next += step; i++;
        }
      };
      const iv = setInterval(tick, 60); tick();
      return { stop(fade) { alive = false; clearInterval(iv); g.gain.setTargetAtTime(0, ctx.currentTime, fade / 3 + 0.01); }, vol(v) { g.gain.setTargetAtTime(v, ctx.currentTime, 0.1); }, pan() {} };
    },
  };

  // ---------------------------------------------------------------- music (scheduled, original compositions)
  const MUSIC = {
    /** Game 1 title: a worn-out celesta playing a minor lullaby, half a tone flat, over a mains hum and vinyl crackle. */
    title1() {
      const g = ctx.createGain(); g.gain.value = 0; g.connect(buses.music);
      const wet = ctx.createGain(); wet.gain.value = 1.1; g.connect(wet); wet.connect(reverb);
      g.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 2.5);
      A._musicOut = g;
      // hum + crackle bed
      const hum = ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 50;
      const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 180;
      const hg = ctx.createGain(); hg.gain.value = 0.035; hum.connect(hf).connect(hg).connect(g); hum.start();
      const cr = ctx.createBufferSource(); cr.buffer = noiseBuf; cr.loop = true;
      const cf = ctx.createBiquadFilter(); cf.type = 'highpass'; cf.frequency.value = 3500;
      const cg = ctx.createGain(); cg.gain.value = 0.012; cr.connect(cf).connect(cg).connect(g); cr.start();
      const mel = [69, 72, 76, 74, 72, 71, 69, -1, 69, 72, 76, 79, 77, 76, 74, -1, 72, 71, 69, 68, 69, 71, 72, -1, 76, 74, 72, 71, 69, -1, -1, -1];
      const bass = [45, 45, 41, 41, 38, 38, 40, 40];
      let i = 0, next = ctx.currentTime + 0.3;
      const step = 0.42;
      const sched = () => {
        while (next < ctx.currentTime + 1) {
          const n = mel[i % mel.length];
          const wob = 1 - 0.03 + Math.sin(i * 0.37) * 0.006; // tape that never runs at the right speed
          if (n > 0 && Math.random() > 0.06) { const f = midi(n) * wob; osc('triangle', f, next, 1.6, g, 0.07, 0.003); osc('sine', f * 3.01, next, 0.5, g, 0.02, 0.002); }
          if (i % 4 === 0) osc('sine', midi(bass[(i / 4) % bass.length]) * wob, next, step * 4, g, 0.09, 0.08);
          if (Math.random() < 0.03) SFX.clank({ vol: 0.12, pan: Math.random() * 2 - 1 });
          next += step; i++;
        }
      };
      sched(); musicTimer = setInterval(sched, 300);
      const stopG = g; const o = { hum, cr };
      setTimeout(function watch() { if (A._musicOut !== stopG) { try { o.hum.stop(ctx.currentTime + 1.5); o.cr.stop(ctx.currentTime + 1.5); } catch (e) {} } else setTimeout(watch, 500); }, 500);
    },
    /** Game 2 title: a toy-piano waltz with a pump organ, slightly out of tune, like a fairground in an empty mall. */
    title2() {
      const g = ctx.createGain(); g.gain.value = 0; g.connect(buses.music);
      const wet = ctx.createGain(); wet.gain.value = 0.8; g.connect(wet); wet.connect(reverb);
      g.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2);
      A._musicOut = g;
      const chords = [[48, 55, 64], [43, 55, 62], [45, 52, 60], [41, 53, 57], [48, 55, 64], [43, 55, 62], [41, 53, 60], [43, 50, 59]];
      const mel = [76, 79, 84, 83, 79, 76, 74, 77, 81, 79, 76, 72, 74, 76, 77, 79, 76, 72, 71, 74, 79, 77, 74, 71];
      let bar = 0, next = ctx.currentTime + 0.2;
      const beat = 0.36;
      const sched = () => {
        while (next < ctx.currentTime + 1.2) {
          const c = chords[bar % chords.length], drift = 1 + Math.sin(bar * 0.9) * 0.008;
          // oom-pah-pah
          osc('square', midi(c[0] - 12) * drift, next, beat * 0.9, g, 0.035, 0.005);
          for (const k of [1, 2]) { osc('square', midi(c[1]) * drift, next + k * beat, beat * 0.6, g, 0.018, 0.005); osc('square', midi(c[2]) * drift, next + k * beat, beat * 0.6, g, 0.018, 0.005); }
          for (let k = 0; k < 3; k++) {
            const n = mel[(bar * 3 + k) % mel.length];
            if (Math.random() > 0.08) { const f = midi(n) * drift * (1 + (Math.random() - 0.5) * 0.01); osc('triangle', f, next + k * beat, 0.7, g, 0.06, 0.002); osc('sine', f * 4.2, next + k * beat, 0.18, g, 0.02, 0.001); }
          }
          next += beat * 3; bar++;
        }
      };
      sched(); musicTimer = setInterval(sched, 300);
    },
    menu() {
      const g = ctx.createGain(); g.gain.value = 0; g.connect(buses.music);
      const wet = ctx.createGain(); wet.gain.value = 0.8; g.connect(wet); wet.connect(reverb);
      g.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 3);
      A._musicOut = g;
      const chords = [[45, 52, 57, 60], [41, 48, 53, 57], [38, 45, 50, 53], [40, 47, 52, 56]];
      const melody = [76, -1, 72, -1, 74, 71, -1, -1, 72, -1, 69, -1, 68, -1, -1, -1];
      let bar = 0, next = ctx.currentTime + 0.1;
      const pad = (n, t, dur) => {
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(800, t + dur / 2); f.frequency.linearRampToValueAtTime(250, t + dur);
        const gg = ctx.createGain(); gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(0.05, t + 1.2); gg.gain.linearRampToValueAtTime(0.0001, t + dur);
        f.connect(gg).connect(g);
        [0, 7].forEach((det) => { const s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.value = midi(n); s.detune.value = det - 3; s.connect(f); s.start(t); s.stop(t + dur + 0.1); });
      };
      const sched = () => {
        while (next < ctx.currentTime + 1) {
          const ch = chords[bar % 4], dur = 4.8;
          ch.forEach((n) => pad(n, next, dur + 0.6));
          osc('sine', midi(ch[0] - 12), next, dur, g, 0.12, 0.6);
          if (bar % 2 === 1) melody.forEach((n, i) => { if (n > 0 && Math.random() > 0.15) { osc('triangle', midi(n) * (1 + (Math.random() - 0.5) * 0.008), next + i * 0.3, 1.2, g, 0.06, 0.003); } });
          if (Math.random() < 0.3) noise(next + Math.random() * 4, 1.5, g, { f: 3000, q: 8, peak: 0.02, a: 0.6 });
          next += dur; bar++;
        }
      };
      sched(); musicTimer = setInterval(sched, 400);
    },
    victory() {
      const g = ctx.createGain(); g.gain.value = 0.5; g.connect(buses.music); A._musicOut = g;
      const t = ctx.currentTime;
      [[60, 64, 67], [65, 69, 72], [67, 71, 74], [72, 76, 79]].forEach((c, i) => c.forEach((n) => osc('triangle', midi(n), t + i * 0.5, 1.4, g, 0.06, 0.02)));
    },
    tension() {
      const g = ctx.createGain(); g.gain.value = 0; g.connect(buses.music); g.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 4); A._musicOut = g;
      let next = ctx.currentTime + 0.2;
      const sched = () => {
        while (next < ctx.currentTime + 1) {
          osc('sine', midi(33), next, 1.6, g, 0.2, 0.05);
          if (Math.random() < 0.4) osc('sawtooth', midi(57 + Math.floor(Math.random() * 3)), next, 2.5, g, 0.015, 1);
          next += 2.4;
        }
      };
      sched(); musicTimer = setInterval(sched, 400);
    },
  };

  FN.Audio = A;
})(window.FN);
