/**
 * User preferences (per browser). Every control in Paramètres reads/writes
 * here and the app reacts through the "solvex:prefs" event.
 */
const KEY = 'solvex:prefs';

export const DEFAULT_PREFS = {
  reduceMotion: false,
  compact: false,
  showIntro: true,
  uiSounds: false,
  ambientOn: false,
  ambientVolume: 0.35,
  ambientMuted: false,
  muteAmbientWhileRecording: true,
  snapping: true,
  defaultTransition: 0.6,
  defaultImageDuration: 5,
  autosave: true,
  autosaveDelay: 1.5,
  editorMode: 'simple',
  exportMonitor: false,
};

let cache = null;

export function getPrefs() {
  if (cache) return cache;
  try {
    cache = { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    cache = { ...DEFAULT_PREFS };
  }
  return cache;
}

export function setPrefs(patch) {
  cache = { ...getPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Private browsing: preferences last for this session only.
  }
  applyPrefs();
  window.dispatchEvent(new CustomEvent('solvex:prefs', { detail: cache }));
  return cache;
}

export function resetPrefs() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  cache = null;
  return setPrefs({});
}

export function applyPrefs() {
  const prefs = getPrefs();
  document.documentElement.classList.toggle('reduce-motion', prefs.reduceMotion);
  document.documentElement.classList.toggle('compact', prefs.compact);
}
