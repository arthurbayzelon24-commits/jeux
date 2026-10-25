// MediaPipe models (hands, body points, selfie segmentation) running on one
// small image. Used inside the detection worker, or on the page as a fallback.
// Everything runs locally; nothing is uploaded.
const VERSION = '0.10.14';
export const MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const POSE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const SEG_MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

// Downloads a model while reporting progress (0..1).
async function fetchModel(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Téléchargement du modèle impossible (${res.status})`);
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body || !total) {
    const buf = new Uint8Array(await res.arrayBuffer());
    onProgress(1);
    return buf;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress(got / total);
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

export class Detector {
  constructor() {
    this.hands = null;
    this.segmenter = null;
    this.pose = null;
    this.lastTs = 0;
    this.segEvery = 1;
    this.frameNo = 0;
    this.detectMs = 16;
  }

  // delegate: 'GPU' (WebGL) or 'CPU' (WebAssembly SIMD).
  async load(onProgress = () => {}, delegate = 'GPU') {
    const progress = { wasm: 0, hand: 0, pose: 0, seg: 0 };
    const report = () => onProgress(progress.wasm * 0.1 + progress.hand * 0.45 + progress.pose * 0.35 + progress.seg * 0.1);
    const vision = await import(`${MP_BASE}/vision_bundle.mjs`);
    const fileset = await vision.FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
    progress.wasm = 1;
    report();
    const [handBuf, poseBuf, segBuf] = await Promise.all([
      fetchModel(HAND_MODEL, (p) => ((progress.hand = p), report())),
      fetchModel(POSE_MODEL, (p) => ((progress.pose = p), report())).catch(() => null),
      fetchModel(SEG_MODEL, (p) => ((progress.seg = p), report())).catch(() => null),
    ]);
    const create = async (Task, options) => {
      try {
        return await Task.createFromOptions(fileset, { ...options, baseOptions: { ...options.baseOptions, delegate } });
      } catch {
        return Task.createFromOptions(fileset, { ...options, baseOptions: { ...options.baseOptions, delegate: 'CPU' } });
      }
    };
    this.hands = await create(vision.HandLandmarker, {
      baseOptions: { modelAssetBuffer: handBuf },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    // Body points are optional: without them the hands still work.
    if (poseBuf) {
      try {
        this.pose = await create(vision.PoseLandmarker, {
          baseOptions: { modelAssetBuffer: poseBuf },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } catch (err) {
        console.warn('Points du corps indisponibles', err);
      }
    }
    if (segBuf) {
      try {
        this.segmenter = await create(vision.ImageSegmenter, {
          baseOptions: { modelAssetBuffer: segBuf },
          runningMode: 'VIDEO',
          outputCategoryMask: false,
          outputConfidenceMasks: true,
        });
      } catch (err) {
        console.warn('Segmentation indisponible', err);
      }
    }
    onProgress(1);
  }

  // Detects on one image (canvas, ImageBitmap…). Returns
  // { raw, mask, pose } — mask/pose are undefined when not computed this frame.
  detect(frame, ts, wantSeg, wantPose) {
    if (ts <= this.lastTs) ts = this.lastTs + 1;
    this.lastTs = ts;
    const t0 = performance.now();
    const raw = [];
    if (this.hands) {
      const r = this.hands.detectForVideo(frame, ts);
      for (let i = 0; i < (r.landmarks?.length || 0); i++) {
        raw.push({
          landmarks: r.landmarks[i],
          world: r.worldLandmarks?.[i],
          handedness: r.handednesses?.[i]?.[0]?.categoryName || r.handedness?.[i]?.[0]?.categoryName || '',
        });
      }
    }
    this.frameNo++;
    // Body points every third frame: they move slower than fingers.
    let pose;
    if (wantPose && this.pose && this.frameNo % 3 === 0) {
      const r = this.pose.detectForVideo(frame, ts);
      pose = r.landmarks?.[0] || null;
    }
    let mask;
    if (wantSeg && this.segmenter && this.frameNo % this.segEvery === 0) {
      this.segmenter.segmentForVideo(frame, ts, (res) => {
        const masks = res.confidenceMasks;
        if (!masks?.length) return;
        // Multi-class models put the person in the last mask.
        const m = masks[masks.length - 1];
        mask = { width: m.width, height: m.height, data: new Float32Array(m.getAsFloat32Array()) };
        masks.forEach((x) => x.close());
      });
    }
    // Adapt: on slow devices, segment every other frame.
    this.detectMs = this.detectMs * 0.9 + (performance.now() - t0) * 0.1;
    this.segEvery = this.detectMs > 32 ? 2 : 1;
    return { raw, mask, pose };
  }
}
