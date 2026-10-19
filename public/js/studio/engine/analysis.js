import { db } from '../db.js';
import { mediaUrl } from '../media.js';

/**
 * Local media analysis: everything here is computed from the decoded audio or
 * sampled video frames in the browser. Nothing is guessed or sent anywhere.
 */
const decoded = new Map();

export async function decodeAudio(mediaId) {
  if (decoded.has(mediaId)) return decoded.get(mediaId);
  const promise = (async () => {
    const blob = await db.getBlob(mediaId);
    if (!blob) throw new Error('Média introuvable.');
    const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const ctx = new Ctx(1, 1, 44100);
    try {
      return await ctx.decodeAudioData(await blob.arrayBuffer());
    } catch {
      throw new Error('Aucune piste audio exploitable dans ce fichier.');
    }
  })();
  decoded.set(mediaId, promise);
  promise.catch(() => decoded.delete(mediaId));
  return promise;
}

function mono(buffer) {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);
  const out = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c += 1) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i += 1) out[i] += data[i] / buffer.numberOfChannels;
  }
  return out;
}

/** Peak envelope for waveform drawing, cached on the media record. */
export async function waveformPeaks(media, buckets = 800) {
  if (media.peaks?.length) return media.peaks;
  const buffer = await decodeAudio(media.id);
  const data = mono(buffer);
  const size = Math.max(1, Math.floor(data.length / buckets));
  const peaks = [];
  for (let b = 0; b < buckets; b += 1) {
    let max = 0;
    for (let i = b * size; i < Math.min(data.length, (b + 1) * size); i += 1) max = Math.max(max, Math.abs(data[i]));
    peaks.push(Math.round(max * 1000) / 1000);
  }
  media.peaks = peaks;
  await db.updateMedia(media);
  return peaks;
}

/** RMS in dBFS per window. */
function loudness(buffer, windowS = 0.05) {
  const data = mono(buffer);
  const size = Math.max(1, Math.floor(buffer.sampleRate * windowS));
  const out = [];
  for (let i = 0; i < data.length; i += size) {
    let sum = 0;
    const end = Math.min(data.length, i + size);
    for (let j = i; j < end; j += 1) sum += data[j] * data[j];
    const rms = Math.sqrt(sum / Math.max(1, end - i));
    out.push(rms > 0 ? 20 * Math.log10(rms) : -100);
  }
  return { db: out, windowS: size / buffer.sampleRate };
}

/** Silent ranges (in source seconds) quieter than `threshold` dB for at least `minDuration`. */
export async function detectSilences(mediaId, { threshold = -40, minDuration = 0.6, padding = 0.1 } = {}) {
  const buffer = await decodeAudio(mediaId);
  const { db: levels, windowS } = loudness(buffer);
  const ranges = [];
  let start = null;
  levels.forEach((level, i) => {
    const t = i * windowS;
    if (level < threshold) start ??= t;
    else if (start !== null) {
      if (t - start >= minDuration) ranges.push([start + padding, t - padding]);
      start = null;
    }
  });
  if (start !== null && buffer.duration - start >= minDuration) ranges.push([start + padding, buffer.duration]);
  return ranges.filter(([a, b]) => b - a > 0.05);
}

/** Loudest moments: windows of `length` seconds ranked by average energy. */
export async function loudestMoments(mediaId, { length = 5, count = 3 } = {}) {
  const buffer = await decodeAudio(mediaId);
  const { db: levels, windowS } = loudness(buffer, 0.1);
  const per = Math.max(1, Math.round(length / windowS));
  const scored = [];
  for (let i = 0; i + per <= levels.length; i += Math.max(1, Math.floor(per / 2))) {
    const slice = levels.slice(i, i + per);
    scored.push({ start: i * windowS, end: (i + per) * windowS, score: slice.reduce((a, b) => a + b, 0) / slice.length });
  }
  scored.sort((a, b) => b.score - a.score);
  const picked = [];
  for (const s of scored) {
    if (picked.some((p) => s.start < p.end && s.end > p.start)) continue;
    picked.push(s);
    if (picked.length >= count) break;
  }
  return picked.sort((a, b) => a.start - b.start);
}

/** Gain that brings the media peak to `targetDb` (default −1 dBFS). */
export async function normalizationGain(mediaId, targetDb = -1) {
  const buffer = await decodeAudio(mediaId);
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c += 1) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i += 1) peak = Math.max(peak, Math.abs(data[i]));
  }
  if (peak === 0) return 1;
  return Math.min(8, 10 ** (targetDb / 20) / peak);
}

/** Peaks above `threshold` (0..1) — e.g. to check clipping. */
export async function detectPeaks(mediaId, threshold = 0.98) {
  const buffer = await decodeAudio(mediaId);
  const data = mono(buffer);
  const hits = [];
  let last = -1;
  for (let i = 0; i < data.length; i += 1) {
    if (Math.abs(data[i]) >= threshold) {
      const t = i / buffer.sampleRate;
      if (t - last > 0.25) hits.push(t);
      last = t;
    }
  }
  return hits;
}

/**
 * Scene cuts: samples small frames every `step` seconds and reports times
 * where the mean pixel difference jumps above `threshold` (0..255).
 */
export async function detectScenes(mediaId, { step = 0.25, threshold = 38, onProgress } = {}) {
  const url = await mediaUrl(mediaId);
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.src = url;
  await new Promise((resolve, reject) => {
    video.onloadeddata = resolve;
    video.onerror = () => reject(new Error('Vidéo illisible.'));
  });
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 36;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const cuts = [];
  let previous = null;
  const duration = video.duration;
  for (let t = 0; t < duration; t += step) {
    video.currentTime = t;
    await new Promise((resolve) => (video.onseeked = resolve));
    ctx.drawImage(video, 0, 0, 64, 36);
    const data = ctx.getImageData(0, 0, 64, 36).data;
    if (previous) {
      let diff = 0;
      for (let i = 0; i < data.length; i += 4)
        diff += Math.abs(data[i] - previous[i]) + Math.abs(data[i + 1] - previous[i + 1]) + Math.abs(data[i + 2] - previous[i + 2]);
      if (diff / (data.length * 0.75) > threshold) cuts.push(Math.round(t * 100) / 100);
    }
    previous = data;
    onProgress?.(t / duration);
  }
  video.removeAttribute('src');
  video.load();
  return cuts;
}
