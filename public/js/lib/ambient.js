import { getPrefs, setPrefs } from './prefs.js';

/**
 * Background music of the *application* (never mixed into projects): a slow
 * generative pad synthesised live with Web Audio. Volume, mute and play/stop
 * are driven by Paramètres → Son et musique.
 */
const CHORDS = [
  [220, 277.18, 329.63, 415.3],
  [196, 246.94, 293.66, 369.99],
  [174.61, 220, 261.63, 329.63],
  [164.81, 207.65, 246.94, 311.13],
];

let ctx = null;
let master = null;
let timer = null;
let step = 0;
let suspendedForRecording = false;

function ensure() {
  if (ctx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error('Web Audio indisponible dans ce navigateur.');
  ctx = new Ctx();
  master = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1800;
  master.connect(filter).connect(ctx.destination);
  applyVolume();
}

function playChord() {
  const chord = CHORDS[step % CHORDS.length];
  step += 1;
  const now = ctx.currentTime;
  for (const freq of chord) {
    for (const [type, mult, level] of [
      ['sine', 1, 0.05],
      ['triangle', 0.5, 0.03],
    ]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq * mult;
      osc.detune.value = (Math.random() - 0.5) * 8;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(level, now + 2.5);
      gain.gain.linearRampToValueAtTime(0, now + 8.5);
      osc.connect(gain).connect(master);
      osc.start(now);
      osc.stop(now + 9);
    }
  }
}

export function applyVolume() {
  if (!master) return;
  const prefs = getPrefs();
  const muted = prefs.ambientMuted || suspendedForRecording;
  master.gain.setTargetAtTime(muted ? 0 : prefs.ambientVolume, ctx.currentTime, 0.2);
}

export async function startAmbient() {
  ensure();
  if (ctx.state === 'suspended') await ctx.resume();
  if (!timer) {
    playChord();
    timer = setInterval(playChord, 7000);
  }
  setPrefs({ ambientOn: true });
}

export function stopAmbient() {
  clearInterval(timer);
  timer = null;
  setPrefs({ ambientOn: false });
}

export const isAmbientPlaying = () => Boolean(timer);

/** Called by the recorder so the app music never ends up in a recording. */
export function setRecordingActive(active) {
  suspendedForRecording = active && getPrefs().muteAmbientWhileRecording;
  applyVolume();
}

window.addEventListener('solvex:prefs', applyVolume);
