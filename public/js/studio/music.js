import { CATALOG } from '../shared/audioCatalog.js';
import { renderSound } from './sounds.js';

/**
 * Renders the SOLVEX catalogue to WAV in the browser (OfflineAudioContext):
 * music from a small recipe (tempo, key, chord progression, instrument layers)
 * and ambiences from filtered noise. Deterministic: the same entry always
 * gives the same file.
 */
const RATE = 44100;
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

function rng(seed) {
  let s = seed * 9301 + 49297;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

function noiseBuffer(ctx, seconds, color = 'white') {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i += 1) {
    const w = Math.random() * 2 - 1;
    if (color === 'brown') {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = w;
  }
  return buffer;
}

function voice(ctx, out, { type = 'sine', freq, start, dur, peak = 0.2, attack = 0.01, release = 0.3, detune = 0, filter }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(peak, start + attack);
  g.gain.setValueAtTime(peak, start + Math.max(attack, dur - release));
  g.gain.linearRampToValueAtTime(0, start + dur);
  let node = osc;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filter;
    node.connect(f);
    node = f;
  }
  node.connect(g).connect(out);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function pluck(ctx, out, freq, start, peak = 0.18, type = 'triangle', decay = 0.35) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, start);
  g.gain.exponentialRampToValueAtTime(0.0008, start + decay);
  osc.connect(g).connect(out);
  osc.start(start);
  osc.stop(start + decay + 0.05);
}

function drum(ctx, out, kind, t, peak = 1) {
  if (kind === 'kick') {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    g.gain.setValueAtTime(0.9 * peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.4);
    return;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 0.4);
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  if (kind === 'hat') {
    f.type = 'highpass';
    f.frequency.value = 7000;
    g.gain.setValueAtTime(0.12 * peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  } else {
    // snare / clap
    f.type = 'bandpass';
    f.frequency.value = kind === 'clap' ? 1500 : 1900;
    g.gain.setValueAtTime(0.45 * peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'clap' ? 0.2 : 0.16));
  }
  src.connect(f).connect(g).connect(out);
  src.start(t);
}

function chordNotes(recipe, degree, octave = 0) {
  const scale = SCALES[recipe.mode] || SCALES.major;
  return [0, 2, 4].map((step) => {
    const i = degree + step;
    return recipe.root + scale[i % 7] + 12 * (Math.floor(i / 7) + octave);
  });
}

function buildMusic(ctx, out, recipe, duration) {
  const beat = 60 / recipe.bpm;
  const bar = beat * 4;
  const bars = Math.floor(duration / bar);
  const rand = rng(recipe.seed || 1);
  const L = new Set(recipe.layers);
  const scale = SCALES[recipe.mode] || SCALES.major;
  for (let b = 0; b < bars; b += 1) {
    const t0 = b * bar;
    const degree = recipe.prog[b % recipe.prog.length];
    const notes = chordNotes(recipe, degree);
    const intro = b < 1; // first bar: no drums, softer start
    if (L.has('pad')) notes.forEach((n, i) => voice(ctx, out, { type: 'sawtooth', freq: hz(n), start: t0, dur: bar + 0.2, peak: 0.035, attack: bar * 0.3, release: bar * 0.3, detune: i * 5 - 5, filter: 1400 }));
    if (L.has('strings')) notes.forEach((n) => [-7, 7].forEach((d) => voice(ctx, out, { type: 'sawtooth', freq: hz(n), start: t0, dur: bar + 0.3, peak: 0.022, attack: bar * 0.45, release: bar * 0.35, detune: d, filter: 2400 })));
    if (L.has('piano'))
      for (let k = 0; k < 4; k += 1) notes.forEach((n, i) => (k === 0 || i === k % 3) && pluck(ctx, out, hz(n + 12), t0 + k * beat, k === 0 ? 0.11 : 0.08, 'triangle', 1.4));
    if (L.has('pluck')) for (let k = 0; k < 8; k += 1) pluck(ctx, out, hz(notes[(k * 2) % 3] + 12), t0 + (k * beat) / 2, 0.08, 'square', 0.18);
    if (L.has('arp')) for (let k = 0; k < 16; k += 1) pluck(ctx, out, hz(notes[k % 3] + (k % 6 < 3 ? 12 : 24)), t0 + (k * beat) / 4, 0.05, 'sawtooth', 0.15);
    if (L.has('bells')) for (let k = 0; k < 2; k += 1) pluck(ctx, out, hz(notes[Math.floor(rand() * 3)] + 24), t0 + k * beat * 2 + beat, 0.06, 'sine', 1.6);
    if (L.has('bass')) for (let k = 0; k < 4; k += 1) voice(ctx, out, { type: 'triangle', freq: hz(notes[0] - 12), start: t0 + k * beat, dur: beat * 0.9, peak: 0.16, release: 0.08, filter: 600 });
    if (L.has('subbass')) voice(ctx, out, { type: 'sine', freq: hz(notes[0] - 24), start: t0, dur: bar, peak: 0.2, attack: 0.05, release: 0.2 });
    if (L.has('lead') && !intro) {
      for (let k = 0; k < 8; k += 1) {
        if (rand() < 0.3) continue;
        const step = Math.floor(rand() * 7);
        voice(ctx, out, { type: 'square', freq: hz(recipe.root + 12 + scale[step]), start: t0 + (k * beat) / 2, dur: beat * 0.45, peak: 0.045, release: 0.1, filter: 3000 });
      }
    }
    if (L.has('timpani') && b % 2 === 0) [0, beat * 3.5].forEach((d) => voice(ctx, out, { type: 'sine', freq: hz(recipe.root - 24), start: t0 + d, dur: 0.9, peak: 0.35, attack: 0.005, release: 0.85 }));
    if (L.has('swell') && b % 4 === 3) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx, bar);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(300, t0);
      f.frequency.exponentialRampToValueAtTime(5000, t0 + bar);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.12, t0 + bar);
      src.connect(f).connect(g).connect(out);
      src.start(t0);
    }
    if (intro) continue;
    for (let k = 0; k < 4; k += 1) {
      const t = t0 + k * beat;
      if (L.has('kick4')) drum(ctx, out, 'kick', t);
      if (L.has('beat')) {
        if (k === 0 || k === 2) drum(ctx, out, 'kick', t + (L.has('lofi') && k === 2 ? beat * 0.25 : 0));
        if (k === 1 || k === 3) drum(ctx, out, 'snare', t, 0.8);
      }
      if (L.has('clap') && (k === 1 || k === 3)) drum(ctx, out, 'clap', t);
      if (L.has('hats')) drum(ctx, out, 'hat', t + beat / 2);
      if (L.has('hats16')) for (let s = 0; s < 4; s += 1) drum(ctx, out, 'hat', t + (s * beat) / 4, s % 2 ? 0.6 : 1);
    }
  }
  if (L.has('lofi')) {
    // vinyl crackle
    const src = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = Math.random() < 0.0004 ? Math.random() * 0.5 - 0.25 : (Math.random() * 2 - 1) * 0.004;
    src.buffer = buf;
    src.connect(out);
    src.start(0);
  }
}

function buildAmbience(ctx, out, generator, duration) {
  const noise = (color, type, freq, q, gain) => {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, duration, color);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(out);
    src.start(0);
    return { f, g };
  };
  const lfo = (param, rate, depth, base) => {
    const o = ctx.createOscillator();
    const d = ctx.createGain();
    o.frequency.value = rate;
    d.gain.value = depth;
    param.value = base;
    o.connect(d).connect(param);
    o.start(0);
  };
  if (generator === 'rain') {
    noise('white', 'highpass', 1200, 0.5, 0.18);
    noise('brown', 'lowpass', 500, 0.7, 0.35);
    for (let t = 0; t < duration; t += 0.03 + Math.random() * 0.12) drum(ctx, out, 'hat', t, 0.25 + Math.random() * 0.4);
  } else if (generator === 'wind') {
    const { f } = noise('white', 'bandpass', 500, 1.2, 0.5);
    lfo(f.frequency, 0.12, 300, 600);
  } else if (generator === 'waves') {
    const { g } = noise('brown', 'lowpass', 900, 0.5, 0.6);
    lfo(g.gain, 0.09, 0.45, 0.5);
    const { g: g2 } = noise('white', 'highpass', 2500, 0.4, 0.08);
    lfo(g2.gain, 0.09, 0.07, 0.07);
  } else if (generator === 'fire') {
    noise('brown', 'lowpass', 300, 0.6, 0.45);
    for (let t = 0; t < duration; t += 0.05 + Math.random() * 0.4) drum(ctx, out, 'snare', t, 0.15 + Math.random() * 0.35);
  } else if (generator === 'night') {
    noise('brown', 'lowpass', 400, 0.5, 0.15);
    for (let t = 0; t < duration; t += 0.7 + Math.random() * 0.8)
      for (let k = 0; k < 3; k += 1) voice(ctx, out, { type: 'sine', freq: 4200 + Math.random() * 300, start: t + k * 0.07, dur: 0.05, peak: 0.03, attack: 0.005, release: 0.03 });
  } else if (generator === 'space') {
    [41.2, 61.7, 82.4].forEach((f, i) => voice(ctx, out, { type: 'sawtooth', freq: f, start: 0, dur: duration, peak: 0.05, attack: 4, release: 4, detune: i * 6, filter: 500 }));
    const { f } = noise('brown', 'bandpass', 200, 2, 0.25);
    lfo(f.frequency, 0.05, 120, 220);
  }
}

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

const cache = new Map();
/** WAV Blob for a catalogue entry (cached for the session). */
export function renderCatalogItem(id) {
  if (cache.has(id)) return cache.get(id);
  const item = CATALOG.find((x) => x.id === id);
  if (!item) return Promise.reject(new Error('Son introuvable dans la bibliothèque.'));
  if (item.kind === 'sfx') return renderSound(item.soundId);
  const duration = item.duration;
  const ctx = new OfflineAudioContext(2, Math.ceil(RATE * duration), RATE);
  const master = ctx.createGain();
  // Gentle fade in/out so tracks start and end cleanly.
  master.gain.setValueAtTime(0, 0);
  master.gain.linearRampToValueAtTime(1, 0.4);
  master.gain.setValueAtTime(1, duration - 2);
  master.gain.linearRampToValueAtTime(0, duration);
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);
  if (item.kind === 'music') buildMusic(ctx, master, item.recipe, duration);
  else buildAmbience(ctx, master, item.recipe.generator, duration);
  const promise = ctx.startRendering().then(encodeWav);
  cache.set(id, promise);
  promise.catch(() => cache.delete(id));
  return promise;
}

/** Renders a catalogue entry and stores it in the local media library. */
export async function importCatalogItem(id) {
  const item = CATALOG.find((x) => x.id === id);
  const blob = await renderCatalogItem(id);
  const { importFile } = await import('./media.js');
  return importFile(new File([blob], `${item.title}.wav`, { type: 'audio/wav' }), {
    name: `${item.title} (SOLVEX)`,
    origin: 'solvex-sound',
    extra: { catalogId: id, author: item.author, license: 'CC0 — création SOLVEX AI', category: item.category },
  });
}
