// Background music made on the fly with WebAudio (no files, no rights
// issues): heard while filming and mixed into the videos. A small scheduler
// plans the notes 0.15 s ahead so the rhythm stays steady.
export const TRACKS = {
  off: { name: 'Sans musique' },
  epic: { name: 'Épique', bpm: 92 },
  mystery: { name: 'Mystère', bpm: 68 },
  electro: { name: 'Électro', bpm: 124 },
};

// Chord roots (A minor based progressions), as semitones from A2 (110 Hz).
const PROG = {
  epic: [0, -4, 3, -2], // Am F C G
  mystery: [0, 1, 0, -2], // Am Bb Am G
  electro: [0, 3, -2, -4], // Am C G F
};
const hz = (semi, base = 110) => base * 2 ** (semi / 12);

export class Music {
  constructor(sfx) {
    this.sfx = sfx;
    this.track = 'off';
    this.timer = 0;
  }

  play(track) {
    this.stop();
    this.track = TRACKS[track] ? track : 'off';
    if (this.track === 'off') return;
    const ctx = this.sfx.ctx;
    if (!ctx) return;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.gain.setTargetAtTime(0.32, ctx.currentTime, 0.5);
    this.out.connect(ctx.destination);
    if (this.sfx.recordDest) this.out.connect(this.sfx.recordDest);
    this.step = 0;
    this.next = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.#schedule(), 25);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = 0;
    if (this.out) {
      const out = this.out;
      const ctx = this.sfx.ctx;
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      setTimeout(() => out.disconnect(), 800);
      this.out = null;
    }
  }

  #schedule() {
    const ctx = this.sfx.ctx;
    if (!ctx || !this.out) return;
    const T = TRACKS[this.track];
    const sixteenth = 60 / T.bpm / 4;
    while (this.next < ctx.currentTime + 0.15) {
      this.#note(this.step, this.next, sixteenth);
      this.next += sixteenth;
      this.step = (this.step + 1) % 256;
    }
  }

  // One sixteenth of a bar.
  #note(step, t, d) {
    const tr = this.track;
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    const root = PROG[tr][bar];
    if (tr === 'epic') {
      if (s === 0) this.#pad(root, t, d * 16, 0.12);
      if (s === 0 || s === 8 || s === 11) this.#drum(t, 55, 0.9);
      if (s === 4 || s === 12) this.#hit(t, 0.25);
      if (s % 2 === 0) this.#pluck(root + [12, 15, 19, 24][(s / 2) % 4], t, d * 2, 0.05);
    } else if (tr === 'mystery') {
      if (s === 0) this.#pad(root, t, d * 16, 0.14);
      if (s === 0 || s === 6 || s === 10) this.#bell(root + [24, 27, 31, 34, 29][((step / 2) % 5) | 0], t, 0.06);
      if (s === 0 && bar === 0) this.#drum(t, 45, 0.5);
    } else if (tr === 'electro') {
      if (s % 4 === 0) this.#drum(t, 60, 1);
      if (s % 4 === 2) this.#hat(t, 0.12);
      if (s % 2 === 1) this.#hat(t, 0.04);
      if (s === 4 || s === 12) this.#hit(t, 0.18);
      this.#bass(root + (s % 4 === 3 ? 12 : 0), t, d * 0.9, 0.1);
      if (s === 0 || s === 6 || s === 10) this.#pad(root, t, d * 2, 0.06);
    }
  }

  #env(t, attack, hold, release, peak) {
    const g = this.sfx.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    g.connect(this.out);
    return g;
  }
  #osc(type, f, t, len, dest) {
    const o = this.sfx.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.connect(dest);
    o.start(t);
    o.stop(t + len + 0.05);
    return o;
  }
  // Warm chord: root, minor third, fifth, octave, detuned saws through a soft filter.
  #pad(root, t, len, peak) {
    const ctx = this.sfx.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    f.connect(this.#env(t, len * 0.25, len * 0.5, len * 0.4, peak));
    for (const n of [0, 3, 7, 12]) {
      this.#osc('sawtooth', hz(root + n), t, len, f);
      this.#osc('sawtooth', hz(root + n) * 1.004, t, len, f);
    }
  }
  #pluck(semi, t, len, peak) {
    this.#osc('triangle', hz(semi), t, len, this.#env(t, 0.005, 0.02, len, peak));
  }
  #bell(semi, t, peak) {
    const g = this.#env(t, 0.005, 0.05, 1.8, peak);
    this.#osc('sine', hz(semi), t, 2, g);
    this.#osc('sine', hz(semi) * 2.76, t, 1, this.#env(t, 0.005, 0.01, 0.6, peak * 0.3));
  }
  #bass(semi, t, len, peak) {
    const ctx = this.sfx.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(300, t + len);
    f.connect(this.#env(t, 0.005, len * 0.5, len * 0.5, peak));
    this.#osc('sawtooth', hz(semi - 12), t, len, f);
  }
  // Kick / taiko: a falling sine.
  #drum(t, f0, peak) {
    const ctx = this.sfx.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0 * 2.5, t);
    o.frequency.exponentialRampToValueAtTime(f0, t + 0.12);
    o.connect(this.#env(t, 0.002, 0.05, 0.35, peak * 0.6));
    o.start(t);
    o.stop(t + 0.5);
  }
  #noise(t, len, type, freq, peak) {
    const ctx = this.sfx.ctx;
    const buf = (this.noiseBuf ||= (() => {
      const b = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    })());
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    src.connect(f).connect(this.#env(t, 0.001, 0.01, len, peak));
    src.start(t);
    src.stop(t + len + 0.05);
  }
  #hat(t, peak) {
    this.#noise(t, 0.05, 'highpass', 7000, peak);
  }
  // Snare-like clap / orchestral hit.
  #hit(t, peak) {
    this.#noise(t, 0.18, 'bandpass', 1800, peak);
  }
}
