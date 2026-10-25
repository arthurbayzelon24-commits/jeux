// "Mes vidéos": recordings and photos kept in the browser (IndexedDB).
const DB = 'magic-cam';
const STORE = 'media';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const result = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(result?.result ?? result);
    t.onerror = () => reject(t.error);
  });
}

export const gallery = {
  async add(item) {
    const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, created: Date.now(), ...item };
    await tx('readwrite', (s) => s.put(entry));
    return entry;
  },
  async list() {
    try {
      const all = await tx('readonly', (s) => s.getAll());
      return (all || []).sort((a, b) => b.created - a.created);
    } catch {
      return [];
    }
  },
  remove(id) {
    return tx('readwrite', (s) => s.delete(id));
  },
};

// Poster image for a video blob (first frame after a short seek).
export function videoThumbnail(blob) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    const url = URL.createObjectURL(blob);
    const done = (data) => {
      URL.revokeObjectURL(url);
      resolve(data);
    };
    v.onloadeddata = () => {
      v.currentTime = Math.min(0.5, (v.duration || 1) / 2);
    };
    v.onseeked = () => {
      const c = document.createElement('canvas');
      const k = 320 / Math.max(v.videoWidth, v.videoHeight, 1);
      c.width = Math.max(1, v.videoWidth * k);
      c.height = Math.max(1, v.videoHeight * k);
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      done(c.toDataURL('image/jpeg', 0.75));
    };
    v.onerror = () => done(null);
    setTimeout(() => done(null), 4000);
    v.src = url;
  });
}
