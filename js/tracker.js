// Runs hand / body / silhouette detection on the camera, preferably in a
// worker (off the main thread) so rendering never waits for the models.
// Falls back to the page itself when workers cannot run MediaPipe.
import { Detector } from './detector.js';

const SIZE = 640; // detection image size (the models work on small images)

export class Tracker {
  constructor() {
    this.worker = null;
    this.local = null;
    this.busy = false;
    this.latest = null;
    this.fresh = false;
    this.mask = null;
    this.maskFresh = false;
    this.pose = undefined;
    this.ready = false;
    this.hasPose = false;
    this.hasSeg = false;
    this.detectFps = 0;
    this.id = 0;
  }

  async load(onProgress = () => {}) {
    if (typeof Worker === 'function' && typeof createImageBitmap === 'function') {
      try {
        await this.#loadWorker(onProgress);
        this.ready = true;
        return;
      } catch (err) {
        console.warn('Détection dans un worker impossible, détection sur la page.', err);
        this.worker?.terminate();
        this.worker = null;
      }
    }
    this.local = new Detector();
    await this.local.load(onProgress);
    this.hasPose = !!this.local.pose;
    this.hasSeg = !!this.local.segmenter;
    this.ready = true;
  }

  #loadWorker(onProgress) {
    return new Promise((resolve, reject) => {
      const w = new Worker(new URL('./detect-worker.js', import.meta.url), { type: 'module' });
      this.worker = w;
      const timer = setTimeout(() => reject(new Error('délai dépassé')), 90000);
      w.onerror = (e) => {
        clearTimeout(timer);
        reject(e.error || new Error(e.message || 'worker'));
      };
      w.onmessage = ({ data }) => {
        if (data.type === 'progress') onProgress(data.p);
        else if (data.type === 'ready') {
          clearTimeout(timer);
          this.hasPose = data.pose;
          this.hasSeg = data.seg;
          w.onmessage = ({ data: r }) => r.type === 'result' && this.#receive(r);
          resolve();
        } else if (data.type === 'error') {
          clearTimeout(timer);
          reject(new Error(data.message));
        }
      };
      w.postMessage({ type: 'load', delegate: this.delegate || 'GPU' });
    });
  }

  #receive(r) {
    this.busy = false;
    if (r.error) {
      console.warn('Détection :', r.error);
      return;
    }
    this.latest = r.raw;
    this.fresh = true;
    if (r.mask) {
      this.mask = r.mask;
      this.maskFresh = true;
    }
    if (r.pose !== undefined) this.pose = r.pose;
    const now = performance.now();
    if (this.lastResult) {
      const fps = 1000 / Math.max(1, now - this.lastResult);
      this.detectFps = this.detectFps ? this.detectFps * 0.9 + fps * 0.1 : fps;
    }
    this.lastResult = now;
  }

  #smallFrame(video) {
    const k = Math.min(1, SIZE / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.max(1, Math.round(video.videoWidth * k));
    const h = Math.max(1, Math.round(video.videoHeight * k));
    if (!this.small) {
      this.small = document.createElement('canvas');
      this.sctx = this.small.getContext('2d', { alpha: false, willReadFrequently: false });
    }
    if (this.small.width !== w || this.small.height !== h) {
      this.small.width = w;
      this.small.height = h;
    }
    this.sctx.drawImage(video, 0, 0, w, h);
    return this.small;
  }

  // Sends the current camera frame for detection (skipped while busy).
  request(video, wantSeg, wantPose) {
    if (!this.ready || this.busy) return;
    const ts = performance.now();
    if (this.worker) {
      this.busy = true;
      const id = ++this.id;
      // Downscale on the GPU while copying the frame (cheap even for 4K/8K).
      createImageBitmap(this.#smallFrame(video))
        .then((bitmap) => this.worker.postMessage({ type: 'detect', id, bitmap, ts, wantSeg, wantPose }, [bitmap]))
        .catch(() => (this.busy = false));
      return;
    }
    const r = this.local.detect(this.#smallFrame(video), ts, wantSeg, wantPose);
    this.#receive({ raw: r.raw, mask: r.mask, pose: r.pose });
  }

  // Latest results for the engine: raw hands only when new since last call.
  take(wantSeg) {
    const out = {
      raw: this.fresh ? this.latest : null,
      mask: wantSeg ? this.mask : null,
      maskFresh: this.maskFresh,
      pose: this.fresh ? this.pose : undefined,
    };
    this.fresh = false;
    this.maskFresh = false;
    return out;
  }

  reset() {
    this.mask = null;
    this.pose = undefined;
    this.fresh = false;
  }

  get hasSegmentation() {
    return this.hasSeg;
  }
}
