// Remixes a recorded video in the browser: slow motion (half speed) or
// boomerang (the last moments played forwards then backwards). The source is
// played into a canvas that is recorded again with MediaRecorder.
import { pickMimeType } from './recorder.js';

const SLOW_MAX = 10; // seconds of source kept for the slow motion (20 s out)
const BOOM_LEN = 1.5; // seconds of source in a boomerang (6 s out)
const FPS = 30;

function loadVideo(blob) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.src = URL.createObjectURL(blob);
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error('video'));
  });
}

// Calls draw() for every new video frame while the video plays.
function eachFrame(v, draw) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      done = true;
      resolve();
    };
    v.addEventListener('ended', finish, { once: true });
    if (v.requestVideoFrameCallback) {
      const step = () => {
        if (done) return;
        draw();
        v.requestVideoFrameCallback(step);
      };
      v.requestVideoFrameCallback(step);
    } else {
      const step = () => {
        if (done) return;
        draw();
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  });
}

function makeRecorder(canvas, audioTracks = []) {
  const stream = canvas.captureStream(FPS);
  audioTracks.forEach((t) => stream.addTrack(t));
  const mimeType = pickMimeType();
  const opts = { videoBitsPerSecond: 8e6 };
  if (mimeType) opts.mimeType = mimeType;
  const rec = new MediaRecorder(stream, opts);
  const chunks = [];
  rec.ondataavailable = (ev) => ev.data?.size && chunks.push(ev.data);
  rec.start(250);
  const t0 = performance.now();
  return () =>
    new Promise((resolve) => {
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = (rec.mimeType || chunks[0]?.type || 'video/webm').split(';')[0];
        resolve({ blob: new Blob(chunks, { type }), type, duration: (performance.now() - t0) / 1000 });
      };
      rec.stop();
    });
}

// Trim: keeps the part between start and end (seconds), with its sound. The
// clip is played (fast up to the start), drawn into a canvas and recorded;
// the sound goes through WebAudio to the recording only, not the speakers.
export async function trim(blob, start, end, onProgress = () => {}) {
  const v = await loadVideo(blob);
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = AC ? new AC() : null;
  let dest = null;
  try {
    if (ac) {
      await ac.resume?.();
      const src = ac.createMediaElementSource(v);
      dest = ac.createMediaStreamDestination();
      src.connect(dest);
      v.muted = false;
    }
    const k = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(v.videoWidth * k) & ~1;
    canvas.height = Math.round(v.videoHeight * k) & ~1;
    const g = canvas.getContext('2d');
    let stop = null;
    v.playbackRate = start > 0.3 ? 4 : 1;
    await v.play();
    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        v.pause();
        resolve();
      };
      v.addEventListener('ended', finish, { once: true });
      const step = () => {
        if (done) return;
        const t = v.currentTime;
        if (t >= start) {
          if (!stop) {
            v.playbackRate = 1;
            stop = makeRecorder(canvas, dest ? dest.stream.getAudioTracks() : []);
          }
          g.drawImage(v, 0, 0, canvas.width, canvas.height);
          onProgress(Math.min(1, (t - start) / Math.max(0.1, end - start)));
          if (t >= end) return finish();
        }
        if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(step);
        else requestAnimationFrame(step);
      };
      step();
    });
    if (!stop) throw new Error('trim');
    return await stop();
  } finally {
    v.pause();
    URL.revokeObjectURL(v.src);
    ac?.close?.();
  }
}

// mode: 'slow' | 'boomerang'. duration: length of the source in seconds (the
// file itself may not know it). onProgress(0..1).
export async function remix(blob, mode, duration, onProgress = () => {}) {
  const v = await loadVideo(blob);
  try {
    const k = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(v.videoWidth * k) & ~1;
    canvas.height = Math.round(v.videoHeight * k) & ~1;
    const g = canvas.getContext('2d');
    const draw = () => g.drawImage(v, 0, 0, canvas.width, canvas.height);

    // Freshly recorded files often cannot seek reliably (no index), so the
    // clip is always played from the start: fast up to the part we keep.
    if (mode === 'slow') {
      const start = Math.max(0, duration - SLOW_MAX);
      let stop = null;
      v.playbackRate = start > 0.5 ? 4 : 0.5;
      await v.play();
      await eachFrame(v, () => {
        if (v.currentTime < start) return onProgress(0);
        if (!stop) {
          v.playbackRate = 0.5;
          stop = makeRecorder(canvas);
        }
        draw();
        onProgress(Math.min(1, (v.currentTime - start) / Math.max(0.1, duration - start)));
      });
      if (!stop) throw new Error('no frames');
      return await stop();
    }

    // Boomerang: keep the frames of the last moments (at most 720 px, a
    // rolling window while the clip plays), then play them forwards and
    // backwards, twice.
    const bk = Math.min(1, 720 / Math.max(canvas.width, canvas.height));
    const fw = Math.round(canvas.width * bk);
    const fh = Math.round(canvas.height * bk);
    const frames = [];
    await v.play();
    await eachFrame(v, () => {
      const t = v.currentTime;
      let c = null;
      while (frames.length && frames[0].t < t - BOOM_LEN) c = frames.shift().c;
      if (!c) {
        c = document.createElement('canvas');
        c.width = fw;
        c.height = fh;
      }
      c.getContext('2d').drawImage(v, 0, 0, fw, fh);
      frames.push({ t, c });
      onProgress(0.5 * Math.min(1, t / Math.max(0.1, duration)));
    });
    if (!frames.length) throw new Error('frames');
    // Played by time (forwards, backwards, twice), so the result lasts the
    // same whatever the frame rate of the source.
    const t0 = frames[0].t;
    const span = Math.max(1 / FPS, frames[frames.length - 1].t - t0);
    const total = Math.round(span * 4 * FPS);
    const stop = makeRecorder(canvas);
    const begin = performance.now();
    for (let i = 0; i <= total; i++) {
      const phase = (i / FPS) % (2 * span);
      const t = t0 + (phase < span ? phase : 2 * span - phase);
      let best = frames[0];
      for (const f of frames) if (Math.abs(f.t - t) < Math.abs(best.t - t)) best = f;
      g.drawImage(best.c, 0, 0, canvas.width, canvas.height);
      onProgress(0.5 + (0.5 * i) / total);
      // Paced on the clock, not on timers, so long frames do not stretch it.
      const wait = begin + ((i + 1) * 1000) / FPS - performance.now();
      await new Promise((r) => setTimeout(r, Math.max(0, wait)));
    }
    return await stop();
  } finally {
    v.pause();
    URL.revokeObjectURL(v.src);
  }
}
