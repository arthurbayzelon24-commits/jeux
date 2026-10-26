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

export const extensionFor = (type) => (type.includes('mp4') ? 'mp4' : 'webm');

export class CanvasRecorder {
  constructor(canvas) {
    this.canvas = canvas;
    this.recorder = null;
  }

  get recording() {
    return this.recorder?.state === 'recording';
  }

  start({ audioTracks = [], fps = 30 } = {}) {
    if (!this.canvas.captureStream || !window.MediaRecorder)
      throw new Error('L’enregistrement vidéo n’est pas pris en charge par ce navigateur.');
    // Frames are pushed by the app after each finished drawing (frame()), at
    // most `fps` per second: every recorded frame is a complete, new image, so
    // the video is as smooth as the screen, without doubled or torn frames.
    let stream = this.canvas.captureStream(0);
    this.track = stream.getVideoTracks()[0];
    if (!this.track?.requestFrame) {
      stream.getTracks().forEach((t) => t.stop());
      stream = this.canvas.captureStream(fps);
      this.track = null;
    }
    this.minGap = 1000 / fps - 2;
    this.lastPush = 0;
    audioTracks.forEach((t) => stream.addTrack(t));
    const mimeType = pickMimeType();
    const pixels = this.canvas.width * this.canvas.height;
    // Like phone camera apps: enough for a sharp image without overloading
    // the phone's video encoder (which makes recordings stutter).
    const videoBitsPerSecond = pixels > 8e6 ? 30e6 : pixels > 2.2e6 ? 12e6 : pixels > 9e5 ? 6e6 : 4e6;
    const opts = { videoBitsPerSecond, audioBitsPerSecond: 160000 };
    if (mimeType) opts.mimeType = mimeType;
    this.chunks = [];
    this.recorder = new MediaRecorder(stream, opts);
    this.recorder.ondataavailable = (ev) => ev.data?.size && this.chunks.push(ev.data);
    this.startedAt = performance.now();
    this.recorder.start(250);
    this.stream = stream;
  }

  // Called after each drawn frame.
  frame(now = performance.now()) {
    if (!this.track || !this.recording || now - this.lastPush < this.minGap) return;
    this.lastPush = now;
    this.track.requestFrame();
  }

  stop() {
    return new Promise((resolve) => {
      const rec = this.recorder;
      if (!rec || rec.state === 'inactive') return resolve(null);
      const duration = (performance.now() - this.startedAt) / 1000;
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
