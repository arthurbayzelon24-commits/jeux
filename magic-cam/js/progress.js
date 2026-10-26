// Progression: experience points, levels, achievements and a daily challenge,
// kept in this browser. Nothing is shown while filming: unlocks are queued
// and announced back on the home screen.
const KEY = 'magic-cam-progress';

// XP needed to go from level n to n + 1.
export const xpFor = (n) => Math.round(80 * n ** 1.35);

export const ACHIEVEMENTS = [
  { id: 'first', icon: '✨', name: 'Premier sort', text: 'Utiliser un pouvoir', test: (s) => s.tried.length >= 1 },
  { id: 'try10', icon: '🔮', name: 'Curieux', text: 'Essayer 10 pouvoirs', test: (s) => s.tried.length >= 10 },
  { id: 'try30', icon: '📚', name: 'Érudit', text: 'Essayer 30 pouvoirs', test: (s) => s.tried.length >= 30 },
  { id: 'tryall', icon: '👑', name: 'Maître des pouvoirs', text: 'Essayer tous les pouvoirs', test: (s, x) => s.tried.length >= x.total },
  {
    id: 'anime',
    icon: '🍥',
    name: 'Otaku',
    text: 'Essayer les 10 pouvoirs d’animé',
    test: (s, x) => x.animeIds.every((id) => s.tried.includes(id)),
  },
  { id: 'ult1', icon: '💥', name: 'Ultime !', text: 'Déclencher un final', test: (s) => s.ultimates >= 1 },
  { id: 'ult10', icon: '🌋', name: 'Déchaîné', text: 'Déclencher 10 finals', test: (s) => s.ultimates >= 10 },
  { id: 'ult50', icon: '☄️', name: 'Cataclysme', text: 'Déclencher 50 finals', test: (s) => s.ultimates >= 50 },
  { id: 'rec1', icon: '🎬', name: 'Réalisateur', text: 'Enregistrer une vidéo', test: (s) => s.videos >= 1 },
  { id: 'rec10', icon: '🏆', name: 'Star du web', text: 'Enregistrer 10 vidéos', test: (s) => s.videos >= 10 },
  { id: 'photo', icon: '📸', name: 'Photographe', text: 'Prendre une photo', test: (s) => s.photos >= 1 },
  { id: 'rune1', icon: '🪄', name: 'Apprenti mage', text: 'Lancer une rune', test: (s) => s.spells >= 1 },
  { id: 'runeall', icon: '📜', name: 'Archimage', text: 'Lancer les 6 runes', test: (s) => s.spellKinds.length >= 6 },
  { id: 'arena500', icon: '🎯', name: 'Gladiateur', text: '500 points dans l’Arène', test: (s) => s.arenaBest >= 500 },
  { id: 'arena1500', icon: '🥇', name: 'Champion', text: '1500 points dans l’Arène', test: (s) => s.arenaBest >= 1500 },
  { id: 'combo15', icon: '⚡', name: 'Combo x15', text: 'Enchaîner 15 cibles', test: (s) => s.bestCombo >= 15 },
  { id: 'dual', icon: '🤲', name: 'Ambidextre', text: 'Utiliser le double pouvoir', test: (s) => s.dual >= 1 },
  { id: 'time10', icon: '⏳', name: 'Passionné', text: '10 minutes de magie', test: (s) => s.seconds >= 600 },
  { id: 'daily3', icon: '📅', name: 'Régulier', text: 'Réussir 3 défis du jour', test: (s) => s.dailyDone >= 3 },
  { id: 'lvl10', icon: '🌟', name: 'Niveau 10', text: 'Atteindre le niveau 10', test: (s, x) => x.level >= 10 },
];

// Daily challenge kinds; the power is chosen from the day's date.
const CHALLENGES = [
  { kind: 'ultimate', text: (n) => `Déclenche le final de « ${n} »`, needsCharge: true },
  { kind: 'arena', goal: 400, text: (n) => `Fais 400 points dans l’Arène avec « ${n} »` },
  { kind: 'record', text: (n) => `Enregistre une vidéo avec « ${n} »` },
  { kind: 'spell', text: () => 'Lance 3 runes différentes', fixed: 'runes' },
];

const today = () => new Date().toISOString().slice(0, 10);
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export class Progress {
  constructor(effects) {
    this.effects = effects;
    this.queue = [];
    this.listeners = [];
    const blank = {
      xp: 0,
      tried: [],
      ultimates: 0,
      videos: 0,
      photos: 0,
      spells: 0,
      spellKinds: [],
      arenaBest: 0,
      bestCombo: 0,
      dual: 0,
      seconds: 0,
      dailyDone: 0,
      unlocked: [],
      daily: null,
    };
    try {
      this.s = { ...blank, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    } catch {
      this.s = blank;
    }
    this.#ensureDaily();
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

  // Level from total XP.
  get level() {
    let n = 1;
    let left = this.s.xp;
    while (left >= xpFor(n)) left -= xpFor(n++);
    return n;
  }
  get levelProgress() {
    let n = 1;
    let left = this.s.xp;
    while (left >= xpFor(n)) left -= xpFor(n++);
    return { level: n, into: left, need: xpFor(n) };
  }

  addXp(n, reason) {
    const before = this.level;
    this.s.xp += Math.round(n);
    const after = this.level;
    if (after > before) this.queue.push({ icon: '⬆️', title: `Niveau ${after} !`, text: reason || 'Continue comme ça' });
    this.#checkAchievements();
    this.#save();
  }

  #checkAchievements() {
    const extra = {
      total: this.effects.length,
      level: this.level,
      animeIds: this.effects.filter((d) => d.cat === 'anime').map((d) => d.id),
    };
    for (const a of ACHIEVEMENTS) {
      if (this.s.unlocked.includes(a.id) || !a.test(this.s, extra)) continue;
      this.s.unlocked.push(a.id);
      this.s.xp += 50;
      this.queue.push({ icon: a.icon, title: `Succès : ${a.name}`, text: `${a.text} · +50 XP` });
    }
  }

  // ---------- Daily challenge ----------
  #ensureDaily() {
    const d = today();
    if (this.s.daily?.date === d) return;
    const h = hash(d);
    let ch = CHALLENGES[h % CHALLENGES.length];
    let pool = this.effects.filter((e) => (ch.needsCharge ? e.charge : true) && e.id !== 'runes');
    const power = ch.fixed || pool[(h >> 3) % pool.length].id;
    this.s.daily = { date: d, kind: ch.kind, power, progress: [], done: false };
  }
  get daily() {
    this.#ensureDaily();
    const d = this.s.daily;
    const ch = CHALLENGES.find((c) => c.kind === d.kind);
    const name = this.effectName?.(d.power) || d.power;
    return { ...d, text: ch.text(name), reward: 150 };
  }
  #dailyStep(kind, data) {
    const d = this.s.daily;
    if (!d || d.done || d.kind !== kind) return;
    let ok = false;
    if (kind === 'spell') {
      if (!d.progress.includes(data.kind)) d.progress.push(data.kind);
      ok = d.progress.length >= 3;
    } else if (data.effect === d.power) ok = kind === 'arena' ? data.score >= 400 : true;
    if (!ok) return;
    d.done = true;
    this.s.dailyDone++;
    this.queue.push({ icon: '📅', title: 'Défi du jour réussi !', text: '+150 XP' });
    this.addXp(150);
  }

  // ---------- Events from the app ----------
  tried(id) {
    if (!this.s.tried.includes(id)) {
      this.s.tried.push(id);
      this.addXp(10, 'Nouveau pouvoir essayé');
    }
  }
  // Seconds of filming with a hand or a body in view.
  tick(dt) {
    this.s.seconds += dt;
    this.acc = (this.acc || 0) + dt;
    if (this.acc >= 10) {
      this.acc = 0;
      this.addXp(5);
    }
  }
  ultimate(effect) {
    this.s.ultimates++;
    this.addXp(25, 'Final déclenché');
    this.#dailyStep('ultimate', { effect });
  }
  spell(kind) {
    this.s.spells++;
    if (!this.s.spellKinds.includes(kind)) this.s.spellKinds.push(kind);
    this.addXp(8);
    this.#dailyStep('spell', { kind });
  }
  recorded(effect) {
    this.s.videos++;
    this.addXp(30, 'Vidéo enregistrée');
    this.#dailyStep('record', { effect });
  }
  photo() {
    this.s.photos++;
    this.addXp(5);
  }
  arena(result, effect) {
    this.s.arenaBest = Math.max(this.s.arenaBest, result.score);
    this.s.bestCombo = Math.max(this.s.bestCombo, result.maxCombo);
    this.addXp(Math.min(300, result.score / 8), 'Manche d’Arène');
    this.#dailyStep('arena', { effect, score: result.score });
  }
  usedDual() {
    this.s.dual++;
    this.addXp(10);
  }

  // Unlocks waiting to be announced (home screen).
  takeQueue() {
    const q = this.queue;
    this.queue = [];
    return q;
  }
}
