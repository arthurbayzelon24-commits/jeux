// Records the effect canvas (plus microphone and sound effects) with
// MediaRecorder, preferring MP4 so the video can be posted directly.
const TYPES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export function pickMimeType() {
  if (!window.MediaRecorder) return null;
  return TYPES.find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
}

// Centred rectangle of the given width/height ratio inside a W x H image
// (even sizes, as video encoders want).
export function cropRect(W, H, aspect) {
  let w = W;
  let h = H;
  if (W / H > aspect) w = Math.round(H * aspect) & ~1;
  else h = Math.round(W / aspect) & ~1;
  return { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w, h };
}

export const extensionFor = (type) => (type.includes('mp4') ? 'mp4' : 'webm');

export class CanvasRecorder {
  constructor(canvas) {
    this.canvas = canvas;
    this.recorder = null;
  }

  // True while recording or paused (a take in progress).
  get recording() {
    return !!this.recorder && this.recorder.state !== 'inactive';
  }
  get paused() {
    return this.recorder?.state === 'paused';
  }
  // Pause / resume: several takes end up in one video.
  pause() {
    if (this.recorder?.state !== 'recording') return;
    this.recorder.pause();
    this.pausedAt = performance.now();
  }
  resume() {
    if (this.recorder?.state !== 'paused') return;
    this.pausedMs += performance.now() - this.pausedAt;
    this.recorder.resume();
  }
  // Seconds actually recorded (pauses excluded).
  get elapsed() {
    const end = this.paused ? this.pausedAt : performance.now();
    return (end - this.startedAt - this.pausedMs) / 1000;
  }

  start({ audioTracks = [], fps = 30, aspect = null } = {}) {
    if (!this.canvas.captureStream || !window.MediaRecorder)
      throw new Error('L’enregistrement vidéo n’est pas pris en charge par ce navigateur.');
    // Chosen format (9:16, 1:1, 16:9): the centre of the image is copied into
    // a canvas of that shape, which is what gets recorded.
    this.out = null;
    if (aspect) {
      const r = cropRect(this.canvas.width, this.canvas.height, aspect);
      const c = document.createElement('canvas');
      c.width = r.w;
      c.height = r.h;
      this.out = { canvas: c, ctx: c.getContext('2d', { alpha: false }), r };
    }
    const source = this.out?.canvas || this.canvas;
    // Frames are pushed by the app after each finished drawing (frame()), at
    // most `fps` per second: every recorded frame is a complete, new image, so
    // the video is as smooth as the screen, without doubled or torn frames.
    let stream = source.captureStream(0);
    this.track = stream.getVideoTracks()[0];
    if (!this.track?.requestFrame) {
      stream.getTracks().forEach((t) => t.stop());
      stream = source.captureStream(fps);
      this.track = null;
    }
    this.minGap = 1000 / fps - 2;
    this.lastPush = 0;
    audioTracks.forEach((t) => stream.addTrack(t));
    const mimeType = pickMimeType();
    const pixels = source.width * source.height;
    // Like phone camera apps: enough for a sharp image without overloading
    // the phone's video encoder (which makes recordings stutter).
    const videoBitsPerSecond = pixels > 8e6 ? 30e6 : pixels > 2.2e6 ? 12e6 : pixels > 9e5 ? 6e6 : 4e6;
    const opts = { videoBitsPerSecond, audioBitsPerSecond: 160000 };
    if (mimeType) opts.mimeType = mimeType;
    this.chunks = [];
    this.recorder = new MediaRecorder(stream, opts);
    this.recorder.ondataavailable = (ev) => ev.data?.size && this.chunks.push(ev.data);
    this.startedAt = performance.now();
    this.pausedMs = 0;
    this.recorder.start(250);
    this.stream = stream;
  }

  // Called after each drawn frame.
  frame(now = performance.now()) {
    if (this.recorder?.state !== 'recording' || now - this.lastPush < this.minGap) return;
    this.lastPush = now;
    if (this.out) {
      const { ctx, r } = this.out;
      ctx.drawImage(this.canvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    }
    this.track?.requestFrame();
  }

  stop() {
    return new Promise((resolve) => {
      const rec = this.recorder;
      if (!rec || rec.state === 'inactive') return resolve(null);
      const duration = this.elapsed;
      rec.onstop = () => {
        const type = (rec.mimeType || this.chunks[0]?.type || 'video/webm').split(';')[0];
        const blob = new Blob(this.chunks, { type });
        this.stream.getVideoTracks().forEach((t) => t.stop());
        this.recorder = null;
        resolve({ blob, type, duration });
      };
      rec.stop();
    });
  }
}
