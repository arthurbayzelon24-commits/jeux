/* FAZNIGHT — player profile & reliable local save (localStorage + IndexedDB mirror). */
(function (FN) {
  const KEY = 'faznight.save.v1';
  const DB = 'faznight';
  const STORE = 'save';

  function defaults() {
    return {
      v: 1,
      created: Date.now(),
      name: 'Gardien',
      settings: {
        quality: 'medium', shadows: true, render3d: true, perf: false, immersion: false, vibrate: true, subtitles: true,
        master: 0.9, music: 0.7, sfx: 0.9, amb: 0.8, voice: 0.9, sens: 1, duration: 6, lang: '',
      },
      chapters: {
        1: { unlocked: true, next: 1, done: {} },
        2: { unlocked: false, next: 1, done: {} },
      },
      customUnlocked: { 1: false, 2: false },
      customRecords: { 1: 0, 2: 0 },
      challengesDone: {},
      trophies: {},
      secrets: {},
      docs: {},
      seen: {},
      codesUsed: {},
      stats: { deaths: 0, nightsWon: 0, playTime: 0, kills: {} },
      resume: null,
      last: { chapter: 1 },
      flags: { ch2Seen: false, rotateHintSeen: false },
    };
  }

  function merge(base, data) {
    if (!data || typeof data !== 'object') return base;
    for (const k of Object.keys(data)) {
      const b = base[k];
      const d = data[k];
      if (b && typeof b === 'object' && !Array.isArray(b) && d && typeof d === 'object' && !Array.isArray(d)) merge(b, d);
      else base[k] = d;
    }
    return base;
  }

  function idb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('no idb'));
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function idbPut(json) {
    try {
      const db = await idb();
      await new Promise((res, rej) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(json, KEY);
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    } catch (e) { /* the localStorage copy remains */ }
  }
  async function idbGet() {
    try {
      const db = await idb();
      const val = await new Promise((res, rej) => {
        const r = db.transaction(STORE).objectStore(STORE).get(KEY);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      db.close();
      return val || null;
    } catch (e) { return null; }
  }

  let saveTimer = 0;
  const Save = {
    data: defaults(),
    async load() {
      let raw = null;
      try { raw = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
      if (!raw) raw = await idbGet();
      if (raw) {
        try { this.data = merge(defaults(), JSON.parse(raw)); } catch (e) { this.data = defaults(); }
      }
      return this.data;
    },
    /** Writes now (synchronously to localStorage, asynchronously to IndexedDB). */
    flush() {
      clearTimeout(saveTimer);
      const json = JSON.stringify(this.data);
      try { localStorage.setItem(KEY, json); } catch (e) { /* quota or private mode */ }
      idbPut(json);
    },
    /** Debounced save for frequent changes (settings sliders). */
    save() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => this.flush(), 250);
    },
    reset() {
      this.data = defaults();
      this.flush();
    },
    exportJSON() { return JSON.stringify({ game: 'FAZNIGHT', exported: Date.now(), data: this.data }, null, 1); },
    importJSON(text) {
      const obj = JSON.parse(text);
      if (!obj || obj.game !== 'FAZNIGHT' || !obj.data || !obj.data.chapters) throw new Error('bad');
      this.data = merge(defaults(), obj.data);
      this.flush();
    },
    defaults,
  };
  FN.Save = Save;
})(window.FN);
