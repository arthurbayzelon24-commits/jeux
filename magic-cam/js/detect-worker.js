// Detection worker: runs the MediaPipe models off the main thread, so the
// effects keep rendering at the screen's full refresh rate.

// MediaPipe loads its WebAssembly glue with importScripts, which module
// workers refuse: replace it with a synchronous version (allowed in workers).
{
  self.importScripts = (...urls) => {
    for (const url of urls) {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send();
      if (xhr.status >= 400) throw new Error(`Chargement impossible : ${url}`);
      (0, eval)(xhr.responseText);
    }
  };
}

let detector = null;

self.onmessage = async ({ data: msg }) => {
  if (msg.type === 'load') {
    try {
      const { Detector } = await import('./detector.js');
      detector = new Detector();
      await detector.load((p) => self.postMessage({ type: 'progress', p }), msg.delegate || 'GPU');
      self.postMessage({ type: 'ready', pose: !!detector.pose, seg: !!detector.segmenter });
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err?.message || err) });
    }
    return;
  }
  if (msg.type === 'detect') {
    let out = { raw: [] };
    try {
      out = detector.detect(msg.bitmap, msg.ts, msg.wantSeg, msg.wantPose);
    } catch (err) {
      out.error = String(err?.message || err);
    }
    msg.bitmap.close?.();
    const transfer = out.mask ? [out.mask.data.buffer] : [];
    self.postMessage({ type: 'result', id: msg.id, ...out }, transfer);
  }
};
