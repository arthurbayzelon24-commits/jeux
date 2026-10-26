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

const seek = (v, t) =>
  new Promise((resolve) => {
    v.addEventListener('seeked', resolve, { once: true });
    v.currentTime = t;
  });

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

function makeRecorder(canvas) {
  const stream = canvas.captureStream(FPS);
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

    if (mode === 'slow') {
      const start = Math.max(0, duration - SLOW_MAX);
      await seek(v, start);
      draw();
      const stop = makeRecorder(canvas);
      v.playbackRate = 0.5;
      await v.play();
      await eachFrame(v, () => {
        draw();
        onProgress(Math.min(1, (v.currentTime - start) / Math.max(0.1, duration - start)));
      });
      return await stop();
    }

    // Boomerang: keep the frames of the last moments (at most 720 px), then
    // play them forwards and backwards, twice.
    const bk = Math.min(1, 720 / Math.max(canvas.width, canvas.height));
    const fw = Math.round(canvas.width * bk);
    const fh = Math.round(canvas.height * bk);
    const start = Math.max(0, duration - BOOM_LEN);
    await seek(v, start);
    const frames = [];
    await v.play();
    await eachFrame(v, () => {
      if (frames.length >= BOOM_LEN * 60) return;
      const c = document.createElement('canvas');
      c.width = fw;
      c.height = fh;
      c.getContext('2d').drawImage(v, 0, 0, fw, fh);
      frames.push(c);
      onProgress(0.5 * Math.min(1, (v.currentTime - start) / BOOM_LEN));
    });
    if (!frames.length) throw new Error('frames');
    // Keep about 30 frames per second of source.
    const keep = Math.max(1, Math.round(frames.length / (BOOM_LEN * FPS)));
    const seq = frames.filter((_, i) => i % keep === 0);
    const order = [...seq, ...seq.slice(1, -1).reverse()];
    const loops = [...order, ...order, seq[0]];
    const stop = makeRecorder(canvas);
    for (let i = 0; i < loops.length; i++) {
      g.drawImage(loops[i], 0, 0, canvas.width, canvas.height);
      onProgress(0.5 + (0.5 * i) / loops.length);
      await new Promise((r) => setTimeout(r, 1000 / FPS));
    }
    return await stop();
  } finally {
    v.pause();
    URL.revokeObjectURL(v.src);
  }
}
