/**
 * Local persistence for the studio (IndexedDB). Projects are small JSON
 * documents; media files are stored as Blobs in their own store so a project
 * list never loads video data into memory.
 */
const DB_NAME = 'solvex-studio';
const DB_VERSION = 1;
let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('Ce navigateur ne permet pas le stockage local (IndexedDB).'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('projects')) {
        const store = db.createObjectStore('projects', { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains('media')) {
        const store = db.createObjectStore('media', { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Base locale bloquée : fermez les autres onglets SOLVEX.'));
  });
  return dbPromise;
}

function tx(storeNames, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(storeNames, mode);
        let result;
        Promise.resolve(fn(...[storeNames].flat().map((name) => transaction.objectStore(name))))
          .then((value) => (result = value))
          .catch(reject);
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error('Transaction annulée'));
      }),
  );
}

const req = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export const db = {
  // ---- projects ----
  listProjects: () =>
    tx('projects', 'readonly', (s) => req(s.getAll())).then((list) => list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),
  getProject: (id) => tx('projects', 'readonly', (s) => req(s.get(id))),
  putProject: (project) => tx('projects', 'readwrite', (s) => req(s.put(project))),
  deleteProject: (id) => tx('projects', 'readwrite', (s) => req(s.delete(id))),

  // ---- media (metadata + blob kept separately) ----
  listMedia: () =>
    tx('media', 'readonly', (s) => req(s.getAll())).then((list) => list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
  getMedia: (id) => tx('media', 'readonly', (s) => req(s.get(id))),
  putMedia: (meta, blob) =>
    tx(['media', 'blobs'], 'readwrite', (media, blobs) => {
      media.put(meta);
      if (blob) blobs.put(blob, meta.id);
    }),
  updateMedia: (meta) => tx('media', 'readwrite', (s) => req(s.put(meta))),
  getBlob: (id) => tx('blobs', 'readonly', (s) => req(s.get(id))),
  deleteMedia: (id) =>
    tx(['media', 'blobs'], 'readwrite', (media, blobs) => {
      media.delete(id);
      blobs.delete(id);
    }),

  // ---- small key/value settings ----
  get: (key) => tx('kv', 'readonly', (s) => req(s.get(key))),
  set: (key, value) => tx('kv', 'readwrite', (s) => req(s.put(value, key))),
};

/** Storage usage reported by the browser (may be unavailable). */
export async function storageEstimate() {
  if (!navigator.storage?.estimate) return null;
  const { usage, quota } = await navigator.storage.estimate();
  const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
  return { usage, quota, persisted };
}

export async function requestPersistence() {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}

// randomUUID only exists in secure contexts; getRandomValues works everywhere.
export const uid = (prefix = '') => {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return prefix + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
};
