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
    const stream = this.canvas.captureStream(fps);
    audioTracks.forEach((t) => stream.addTrack(t));
    const mimeType = pickMimeType();
    const pixels = this.canvas.width * this.canvas.height;
    // Enough bits for sharp 4K/8K; browsers cap it to what their encoder supports.
    const videoBitsPerSecond = pixels > 2e7 ? 80e6 : pixels > 8e6 ? 40e6 : pixels > 2e6 ? 16e6 : pixels > 9e5 ? 8e6 : 5e6;
    const opts = { videoBitsPerSecond, audioBitsPerSecond: 160000 };
    if (mimeType) opts.mimeType = mimeType;
    this.chunks = [];
    this.recorder = new MediaRecorder(stream, opts);
    this.recorder.ondataavailable = (ev) => ev.data?.size && this.chunks.push(ev.data);
    this.startedAt = performance.now();
    this.recorder.start(250);
    this.stream = stream;
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
