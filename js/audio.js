// Synthesised sound effects (no audio files): zaps, thunder, whooshes, booms,
// a fire crackle and an energy hum. The mix goes to the speakers and to a
// stream that the recorder adds to the video.
export class SoundFx {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.loops = {};
    this.lastPlay = {};
  }

  // Must be called from a user gesture (browser autoplay rules).
  init() {
    if (this.ctx) {
      this.ctx.resume?.();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 0.7 : 0;
    this.master.connect(ctx.destination);
    // The recording mix: effects + microphone (the mic never goes to the speakers).
    this.recordDest = ctx.createMediaStreamDestination?.() || null;
    if (this.recordDest) this.master.connect(this.recordDest);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.7 : 0;
  }

  // Routes a microphone stream into the recording mix.
  attachMic(stream) {
    if (!this.ctx || !this.recordDest) return;
    this.micSource?.disconnect();
    this.micSource = null;
    if (!stream?.getAudioTracks().length) return;
    this.micSource = this.ctx.createMediaStreamSource(stream);
    this.micSource.connect(this.recordDest);
  }

  get recordTracks() {
    return this.recordDest ? this.recordDest.stream.getAudioTracks() : [];
  }

  #noiseSource() {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.loopStart = Math.random();
    return s;
  }

  #env(gain, t, attack, hold, release, peak) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.setValueAtTime(peak, t + attack + hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  }

  play(name, volume = 1) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    // Rate limit identical sounds.
    if (now - (this.lastPlay[name] || 0) < 0.05) return;
    this.lastPlay[name] = now;
    const out = ctx.createGain();
    out.connect(this.master);
    const noise = (type, freq, q, a, h, r, peak, sweepTo) => {
      const src = this.#noiseSource();
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.setValueAtTime(freq, now);
      if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, now + a + h + r);
      f.Q.value = q;
      const g = ctx.createGain();
      this.#env(g, now, a, h, r, peak * volume);
      src.connect(f).connect(g).connect(out);
      src.start(now);
      src.stop(now + a + h + r + 0.05);
    };
    const tone = (type, f0, f1, a, h, r, peak) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, now);
      o.frequency.exponentialRampToValueAtTime(f1, now + a + h + r);
      const g = ctx.createGain();
      this.#env(g, now, a, h, r, peak * volume);
      o.connect(g).connect(out);
      o.start(now);
      o.stop(now + a + h + r + 0.05);
    };
    switch (name) {
      case 'zap':
        noise('bandpass', 2500 + Math.random() * 3000, 2, 0.002, 0.02 + Math.random() * 0.05, 0.06, 0.6);
        tone('sawtooth', 180 + Math.random() * 120, 60, 0.002, 0.02, 0.08, 0.08);
        break;
      case 'thunder':
        noise('bandpass', 3000, 1, 0.003, 0.05, 0.15, 0.9);
        noise('lowpass', 400, 0.7, 0.01, 0.2, 1.4, 1, 80);
        tone('sine', 70, 35, 0.01, 0.1, 0.8, 0.5);
        break;
      case 'whoosh':
        noise('bandpass', 300, 1.5, 0.08, 0.1, 0.35, 0.7, 2500);
        break;
      case 'boom':
        noise('lowpass', 1200, 0.7, 0.005, 0.08, 1.0, 1, 90);
        tone('sine', 110, 30, 0.005, 0.05, 0.7, 0.9);
        break;
      case 'teleport':
        noise('bandpass', 400, 4, 0.05, 0.15, 0.35, 0.6, 4000);
        tone('sine', 300, 1600, 0.02, 0.2, 0.3, 0.25);
        tone('triangle', 900, 2400, 0.02, 0.1, 0.4, 0.1);
        break;
      case 'grab':
        tone('sine', 220, 440, 0.01, 0.05, 0.2, 0.25);
        break;
      case 'thud':
        tone('sine', 90, 40, 0.002, 0.03, 0.2, 0.6);
        noise('lowpass', 500, 0.7, 0.002, 0.02, 0.1, 0.4);
        break;
      case 'chime': {
        const notes = [523, 587, 659, 784, 880, 1047];
        const f = notes[(Math.random() * notes.length) | 0];
        tone('sine', f, f * 1.001, 0.005, 0.05, 1.2, 0.15);
        tone('sine', f * 2, f * 2.002, 0.005, 0.02, 0.6, 0.05);
        break;
      }
      case 'saberOn':
        tone('sawtooth', 70, 140, 0.02, 0.15, 0.25, 0.25);
        noise('bandpass', 600, 3, 0.02, 0.1, 0.25, 0.4, 2400);
        break;
      case 'saberOff':
        tone('sawtooth', 140, 50, 0.01, 0.1, 0.25, 0.22);
        break;
      case 'swing':
        noise('bandpass', 500, 2.5, 0.03, 0.05, 0.25, 0.5, 1400);
        tone('sawtooth', 110, 150, 0.03, 0.05, 0.2, 0.12);
        break;
      case 'drop':
        tone('sine', 1100 + Math.random() * 400, 280, 0.002, 0.01, 0.12, 0.25);
        break;
      case 'crack':
        noise('highpass', 2500, 1, 0.001, 0.01, 0.06, 0.5);
        tone('square', 1800, 900, 0.001, 0.005, 0.04, 0.05);
        break;
      case 'tick':
        tone('sine', 880, 880, 0.002, 0.05, 0.12, 0.25);
        break;
      case 'go':
        tone('sine', 1320, 1320, 0.002, 0.08, 0.3, 0.3);
        break;
      case 'shutter':
        noise('highpass', 3000, 0.7, 0.001, 0.01, 0.05, 0.5);
        break;
    }
    setTimeout(() => out.disconnect(), 3000);
  }

  // Continuous sounds whose level (0..1) follows the effect.
  loop(name, level) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    let l = this.loops[name];
    if (!l) {
      if (level < 0.01) return;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.master);
      if (name === 'fire') {
        const src = this.#noiseSource();
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 700;
        const crackle = ctx.createBiquadFilter();
        crackle.type = 'highpass';
        crackle.frequency.value = 3000;
        const cg = ctx.createGain();
        cg.gain.value = 0.15;
        src.connect(f).connect(g);
        src.connect(crackle).connect(cg).connect(g);
        src.start();
        l = { g, nodes: [src], peak: 0.5 };
      } else if (name === 'saber') {
        // Classic saber hum: two detuned low saws through a resonant filter.
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        o1.type = 'sawtooth';
        o2.type = 'sawtooth';
        o1.frequency.value = 90;
        o2.frequency.value = 91.5;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 300;
        f.Q.value = 6;
        o1.connect(f);
        o2.connect(f);
        f.connect(g);
        o1.start();
        o2.start();
        l = { g, nodes: [o1, o2], peak: 0.25 };
      } else {
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        o1.type = 'sawtooth';
        o2.type = 'sine';
        o1.frequency.value = 55;
        o2.frequency.value = 110.7;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 420;
        o1.connect(f);
        o2.connect(f);
        f.connect(g);
        o1.start();
        o2.start();
        l = { g, nodes: [o1, o2], peak: 0.12 };
      }
      this.loops[name] = l;
    }
    l.g.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * l.peak, ctx.currentTime, 0.08);
  }

  // Rising tone while a power charges (level 0..1).
  charge(level) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (!this.chargeOsc) {
      if (level < 0.02) return;
      const o = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o.type = 'sawtooth';
      o2.type = 'sine';
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(f);
      o2.connect(f);
      f.connect(g).connect(this.master);
      o.start();
      o2.start();
      this.chargeOsc = { o, o2, g };
    }
    const { o, o2, g } = this.chargeOsc;
    const t = ctx.currentTime;
    o.frequency.setTargetAtTime(70 + level * level * 420, t, 0.1);
    o2.frequency.setTargetAtTime(140 + level * level * 840, t, 0.1);
    g.gain.setTargetAtTime(level < 0.02 ? 0 : 0.03 + level * 0.12, t, 0.08);
  }

  stopLoops() {
    if (this.chargeOsc) {
      this.chargeOsc.o.stop();
      this.chargeOsc.o2.stop();
      this.chargeOsc.g.disconnect();
      this.chargeOsc = null;
    }
    for (const l of Object.values(this.loops)) {
      l.nodes.forEach((n) => n.stop());
      l.g.disconnect();
    }
    this.loops = {};
  }
}
