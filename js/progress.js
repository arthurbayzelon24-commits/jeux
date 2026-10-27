// Crystals: earned with the daily challenges (and a small bonus each day you
// come back), spent in the shop to unlock more powers. Kept in this browser.
// Nothing is shown while filming: rewards are announced on the home screen.
const KEY = 'magic-cam-wallet';
export const START_CRYSTALS = 300;

// Powers that must be bought, and their price; every other power is free.
const PACK_IDS =
  'dragon tornado meteor lava sun sonic shield lasereyes web neon matrix halo planet crystalball aurora stars comet rainbow bubbles confetti coins snow fireflies wisps'.split(
    ' ',
  );
export function priceOf(def) {
  // Crystals are gone: every power is free. The prices stay here unused.
  if (def || !def) return 0;
  if (def.cat === 'anime') return 200;
  if (def.id === 'runes') return 150;
  return PACK_IDS.includes(def.id) ? 100 : 0;
}

// Daily challenges: three per day, picked from the date.
const TEMPLATES = [
  { kind: 'record', reward: 60, power: true, text: (n) => `Filme une vidéo avec « ${n} »` },
  { kind: 'ultimate', reward: 80, power: true, needsCharge: true, text: (n) => `Déclenche le final de « ${n} »` },
  { kind: 'photo', reward: 40, power: true, text: (n) => `Prends une photo avec « ${n} »` },
  { kind: 'long', reward: 50, goal: 15, text: () => 'Filme une vidéo d’au moins 15 secondes' },
  { kind: 'free', reward: 70, goal: 3, text: () => 'Fais 3 pouvoirs différents en Mode libre' },
  { kind: 'dual', reward: 60, text: () => 'Filme avec un pouvoir dans chaque main' },
  { kind: 'secret', reward: 90, text: () => 'Trouve un geste secret (applaudis deux fois…)' },
  { kind: 'combo', reward: 80, text: () => 'Fais un combo en Mode libre (3 pouvoirs en 4 s)' },
  { kind: 'snap', reward: 60, text: () => 'Réussis un claquement de doigts (Téléportation, Désintégration…)' },
  { kind: 'clones', reward: 70, text: () => 'Fais apparaître 4 clones avec la technique des mains jointes' },
  { kind: 'slowmo', reward: 50, text: () => 'Utilise le ralenti magique (bouton sablier)' },
];

const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 864e5).toISOString().slice(0, 10);
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export class Progress {
  constructor(effects) {
    this.effects = effects;
    this.queue = [];
    this.listeners = [];
    const blank = { crystals: START_CRYSTALS, owned: [], daily: null, streak: { last: null, count: 0 }, done: 0 };
    try {
      this.s = { ...blank, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    } catch {
      this.s = blank;
    }
  }

  #save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.s));
    } catch {
      /* private mode */
    }
    for (const fn of this.listeners) fn(this);
  }
  onChange(fn) {
    this.listeners.push(fn);
  }
  takeQueue() {
    const q = this.queue;
    this.queue = [];
    return q;
  }

  // ---------- Shop ----------
  price(id) {
    return priceOf(this.effects.find((d) => d.id === id));
  }
  owns(id) {
    return this.price(id) === 0 || this.s.owned.includes(id);
  }
  buy(id) {
    const p = this.price(id);
    if (this.owns(id) || this.s.crystals < p) return false;
    this.s.crystals -= p;
    this.s.owned.push(id);
    this.#save();
    return true;
  }

  // ---------- Daily challenges ----------
  #ensureDaily() {
    const d = today();
    if (this.s.daily?.date === d) return;
    const h = hash(d);
    const picked = [];
    for (let i = 0; picked.length < 3; i++) {
      const t = TEMPLATES[(h + i * 5) % TEMPLATES.length];
      if (!picked.includes(t)) picked.push(t);
    }
    // Only powers you own, so every challenge can be done.
    const pool = (needsCharge) => this.effects.filter((e) => this.owns(e.id) && e.id !== 'free' && (!needsCharge || e.charge));
    const list = picked.map((t, i) => {
      const p = pool(t.needsCharge);
      return { kind: t.kind, power: t.power ? p[(h >> (i + 2)) % p.length]?.id : null, progress: [], done: false, reward: t.reward };
    });
    this.s.daily = { date: d, list };
  }
  get challenges() {
    this.#ensureDaily();
    return this.s.daily.list.map((c) => {
      const t = TEMPLATES.find((x) => x.kind === c.kind);
      return { ...c, text: t.text(this.effectName?.(c.power) || c.power), goal: t.goal || 1 };
    });
  }
  #step(kind, data = {}) {
    this.#ensureDaily();
    let changed = false;
    for (const c of this.s.daily.list) {
      if (c.done || c.kind !== kind) continue;
      const t = TEMPLATES.find((x) => x.kind === kind);
      let ok = true;
      if (kind === 'free') {
        if (data.power && !c.progress.includes(data.power)) {
          c.progress.push(data.power);
          changed = true;
        }
        ok = c.progress.length >= t.goal;
      } else if (kind === 'long') ok = data.duration >= t.goal;
      else if (t.power) ok = data.effect === c.power;
      if (!ok) continue;
      c.done = true;
      this.s.crystals += c.reward;
      this.s.done++;
      this.queue.push({ icon: '🏆', title: 'Défi réussi !', text: 'Bravo ! Encore un défi de relevé.' });
      changed = true;
    }
    if (changed) this.#save();
  }

  // ---------- A bonus each day you come back ----------
  checkIn() {
    const st = this.s.streak;
    if (st.last === today()) return;
    const first = !st.last;
    st.count = st.last === yesterday() ? st.count + 1 : 1;
    st.last = today();
    if (first) {
      this.queue.push({ icon: '✨', title: 'Bienvenue !', text: 'Tous les pouvoirs sont à toi. Relève les défis du jour !' });
    } else {
      const bonus = 10 * Math.min(7, st.count);
      this.s.crystals += bonus;
      this.queue.push({
        icon: '🔥',
        title: st.count > 1 ? `${st.count} jours d’affilée !` : 'Bon retour !',
        text: 'Trois nouveaux défis t’attendent',
      });
    }
    this.#save();
  }
  get streak() {
    return this.s.streak.last === today() || this.s.streak.last === yesterday() ? this.s.streak.count : 0;
  }

  // ---------- Events from the app ----------
  recorded(effect, duration, dual) {
    this.#step('record', { effect });
    this.#step('long', { duration });
    if (dual) this.#step('dual');
  }
  photo(effect) {
    this.#step('photo', { effect });
  }
  ultimate(effect) {
    this.#step('ultimate', { effect });
  }
  freePower(power) {
    this.#step('free', { power });
  }
  // Other moments: 'combo', 'snap', 'clones', 'slowmo'.
  event(kind) {
    this.#step(kind);
  }
  secret() {
    this.#step('secret');
  }
}
