/**
 * SOLVEX sound library. Every sound is synthesised in the browser with an
 * OfflineAudioContext and encoded to WAV on demand, so there is no third-party
 * licence involved: these sounds are original works of SOLVEX AI, free to use
 * in your projects (CC0).
 */
export const SOUND_LICENSE = 'Sons synthétisés par SOLVEX AI — libres de droits (CC0), utilisables commercialement sans attribution.';

const R = 44100;

function envelope(gain, t0, attack, decay, sustain, release, peak = 1) {
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + attack);
  gain.gain.linearRampToValueAtTime(peak * sustain, t0 + attack + decay);
  gain.gain.linearRampToValueAtTime(0, t0 + attack + decay + release);
}

function noiseBuffer(ctx, seconds) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function tone(ctx, out, { type = 'sine', freq, to, start = 0, dur, peak = 0.4, attack = 0.005, detune = 0 }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + dur);
  osc.detune.value = detune;
  envelope(gain, start, attack, dur * 0.3, 0.6, dur * 0.7, peak);
  osc.connect(gain).connect(out);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function noise(ctx, out, { start = 0, dur, peak = 0.4, filter = 'bandpass', from = 400, to = 4000, q = 1 }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, dur + 0.1);
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, start);
  f.frequency.exponentialRampToValueAtTime(to, start + dur);
  const gain = ctx.createGain();
  envelope(gain, start, dur * 0.3, dur * 0.2, 0.7, dur * 0.5, peak);
  src.connect(f).connect(gain).connect(out);
  src.start(start);
}

const CHORDS = [
  [220, 277.18, 329.63],
  [196, 246.94, 293.66],
  [174.61, 220, 261.63],
  [164.81, 207.65, 246.94],
];

export const SOUNDS = [
  {
    id: 'ui-click',
    name: 'Clic d’interface',
    category: 'Interface',
    duration: 0.12,
    build: (c, o) => tone(c, o, { type: 'triangle', freq: 1800, to: 900, dur: 0.08, peak: 0.5 }),
  },
  {
    id: 'ui-pop',
    name: 'Pop',
    category: 'Interface',
    duration: 0.2,
    build: (c, o) => tone(c, o, { freq: 400, to: 1200, dur: 0.12, peak: 0.6 }),
  },
  {
    id: 'ui-success',
    name: 'Succès',
    category: 'Interface',
    duration: 0.6,
    build: (c, o) =>
      [523.25, 659.25, 783.99].forEach((f, i) => tone(c, o, { type: 'triangle', freq: f, start: i * 0.09, dur: 0.3, peak: 0.35 })),
  },
  {
    id: 'ui-error',
    name: 'Erreur',
    category: 'Interface',
    duration: 0.5,
    build: (c, o) => [311.13, 233.08].forEach((f, i) => tone(c, o, { type: 'square', freq: f, start: i * 0.15, dur: 0.2, peak: 0.15 })),
  },
  {
    id: 'notify',
    name: 'Notification',
    category: 'Interface',
    duration: 0.7,
    build: (c, o) => [880, 1318.5].forEach((f, i) => tone(c, o, { freq: f, start: i * 0.12, dur: 0.45, peak: 0.35 })),
  },
  {
    id: 'whoosh',
    name: 'Whoosh',
    category: 'Transitions sonores',
    duration: 0.8,
    build: (c, o) => noise(c, o, { dur: 0.7, from: 300, to: 6000, q: 0.8, peak: 0.7 }),
  },
  {
    id: 'swoosh-down',
    name: 'Swoosh descendant',
    category: 'Transitions sonores',
    duration: 0.8,
    build: (c, o) => noise(c, o, { dur: 0.7, from: 6000, to: 250, q: 1.2, peak: 0.7 }),
  },
  {
    id: 'riser',
    name: 'Montée (riser)',
    category: 'Transitions sonores',
    duration: 3,
    build: (c, o) => {
      noise(c, o, { dur: 2.8, from: 200, to: 9000, q: 2, peak: 0.4 });
      tone(c, o, { type: 'sawtooth', freq: 110, to: 880, dur: 2.8, peak: 0.12, attack: 1.5 });
    },
  },
  {
    id: 'impact',
    name: 'Impact cinématique',
    category: 'Bruitages',
    duration: 2.5,
    build: (c, o) => {
      tone(c, o, { freq: 90, to: 30, dur: 1.8, peak: 0.9, attack: 0.002 });
      noise(c, o, { dur: 0.6, from: 2000, to: 80, filter: 'lowpass', q: 0.5, peak: 0.8 });
    },
  },
  {
    id: 'glitch',
    name: 'Glitch numérique',
    category: 'Bruitages',
    duration: 0.6,
    build: (c, o) =>
      [0, 0.07, 0.15, 0.2, 0.33].forEach((s, i) => tone(c, o, { type: 'square', freq: 200 + i * 340, start: s, dur: 0.05, peak: 0.25 })),
  },
  {
    id: 'laser',
    name: 'Laser',
    category: 'Gaming',
    duration: 0.5,
    build: (c, o) => tone(c, o, { type: 'sawtooth', freq: 2400, to: 200, dur: 0.35, peak: 0.3 }),
  },
  {
    id: 'coin',
    name: 'Pièce',
    category: 'Gaming',
    duration: 0.4,
    build: (c, o) => [987.77, 1318.51].forEach((f, i) => tone(c, o, { type: 'square', freq: f, start: i * 0.07, dur: 0.2, peak: 0.2 })),
  },
  {
    id: 'level-up',
    name: 'Niveau supérieur',
    category: 'Gaming',
    duration: 1,
    build: (c, o) =>
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, o, { type: 'square', freq: f, start: i * 0.1, dur: 0.18, peak: 0.18 })),
  },
  {
    id: 'boing',
    name: 'Boing',
    category: 'Réactions',
    duration: 0.7,
    build: (c, o) => tone(c, o, { type: 'triangle', freq: 150, to: 600, dur: 0.5, peak: 0.5 }),
  },
  {
    id: 'ding',
    name: 'Ding',
    category: 'Réactions',
    duration: 1.5,
    build: (c, o) => [1567.98, 3135.96].forEach((f) => tone(c, o, { freq: f, dur: 1.3, peak: 0.25, attack: 0.002 })),
  },
  {
    id: 'drumroll',
    name: 'Roulement',
    category: 'Réactions',
    duration: 2.2,
    build: (c, o) =>
      Array.from({ length: 36 }, (_, i) => noise(c, o, { start: i * 0.055, dur: 0.05, from: 1500, to: 900, peak: 0.25 + i / 120 })),
  },
  {
    id: 'ambient-pad',
    name: 'Nappe d’ambiance (30 s, boucle)',
    category: 'Ambiances futuristes',
    duration: 30,
    loop: true,
    build: (c, o) =>
      CHORDS.forEach((chord, i) =>
        chord.forEach((f) => {
          tone(c, o, { type: 'sine', freq: f, start: i * 7.5, dur: 8, peak: 0.08, attack: 2 });
          tone(c, o, { type: 'triangle', freq: f / 2, start: i * 7.5, dur: 8, peak: 0.04, attack: 2, detune: 6 });
        }),
      ),
  },
  {
    id: 'cinematic-drone',
    name: 'Drone cinématique (20 s)',
    category: 'Musiques cinématiques',
    duration: 20,
    build: (c, o) => {
      [55, 82.41, 110].forEach((f, i) => tone(c, o, { type: 'sawtooth', freq: f, dur: 19, peak: 0.05, attack: 4, detune: i * 4 }));
      noise(c, o, { dur: 19, from: 120, to: 400, filter: 'lowpass', q: 0.4, peak: 0.08 });
    },
  },
  {
    id: 'pulse-beat',
    name: 'Pulsation électro (16 s, 120 BPM)',
    category: 'Musiques d’ambiance',
    duration: 16,
    loop: true,
    build: (c, o) => {
      for (let beat = 0; beat < 32; beat += 1) {
        const t = beat * 0.5;
        tone(c, o, { freq: 120, to: 45, start: t, dur: 0.25, peak: 0.7, attack: 0.001 });
        if (beat % 2) noise(c, o, { start: t, dur: 0.08, from: 6000, to: 9000, filter: 'highpass', peak: 0.15 });
        const chord = CHORDS[Math.floor(beat / 8) % CHORDS.length];
        tone(c, o, { type: 'triangle', freq: chord[beat % 3] * 2, start: t + 0.25, dur: 0.2, peak: 0.07 });
      }
    },
  },
];

export const SOUND_CATEGORIES = [...new Set(SOUNDS.map((s) => s.category))];

function encodeWav(buffer) {
  const channels = buffer.numberOfChannels;
  const length = buffer.length * channels * 2 + 44;
  const view = new DataView(new ArrayBuffer(length));
  const write = (offset, text) => [...text].forEach((ch, i) => view.setUint8(offset + i, ch.charCodeAt(0)));
  write(0, 'RIFF');
  view.setUint32(4, length - 8, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, length - 44, true);
  const data = [...Array(channels)].map((_, c) => buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < buffer.length; i += 1) {
    for (let c = 0; c < channels; c += 1) {
      const s = Math.max(-1, Math.min(1, data[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([view], { type: 'audio/wav' });
}

const rendered = new Map();
/** Renders a sound to a WAV Blob (cached). */
export function renderSound(id) {
  if (rendered.has(id)) return rendered.get(id);
  const sound = SOUNDS.find((s) => s.id === id);
  if (!sound) return Promise.reject(new Error('Son inconnu.'));
  const ctx = new OfflineAudioContext(2, Math.ceil(R * sound.duration), R);
  const out = ctx.createDynamicsCompressor();
  out.connect(ctx.destination);
  sound.build(ctx, out);
  const promise = ctx.startRendering().then(encodeWav);
  rendered.set(id, promise);
  return promise;
}
