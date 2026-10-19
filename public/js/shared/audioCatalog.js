/**
 * SOLVEX audio catalogue. Every entry is an original work synthesised in the
 * browser (music.js / sounds.js), so it is free of rights (CC0) — no third
 * party catalogue is copied. Shared by the editor (audio panel) and the
 * server (assistant search). Online libraries (Jamendo, Freesound) are added
 * on top when their keys are configured.
 */
export const SOLVEX_LICENSE = 'Création originale SOLVEX AI, libre de droits (CC0) : utilisable commercialement, sans attribution.';

export const MUSIC_CATEGORIES = [
  'Musiques d’ambiance',
  'Musiques cinématiques',
  'Musiques électroniques',
  'Musiques calmes',
  'Musiques dynamiques',
  'Musiques joyeuses',
  'Musiques dramatiques',
  'Musiques pour vidéos courtes',
  'Musiques pour vlogs',
  'Musiques pour présentations',
];
export const AUDIO_CATEGORIES = [...MUSIC_CATEGORIES, 'Sons d’ambiance', 'Bruitages', 'Effets sonores', 'Voix et narration'];

const music = (id, title, category, recipe, tags) => ({ id: `music:${id}`, kind: 'music', title, category, tags, duration: recipe.duration || 32, recipe, author: 'SOLVEX AI' });

// recipe: bpm, root (MIDI), mode, prog (scale degrees, one chord per bar), layers.
export const MUSIC = [
  music('aube-cristal', 'Aube de cristal', 'Musiques d’ambiance', { bpm: 70, root: 57, mode: 'major', prog: [0, 4, 5, 3], layers: ['pad', 'bells', 'subbass'], seed: 1 }, ['ambiance', 'doux', 'planant']),
  music('brume-nocturne', 'Brume nocturne', 'Musiques d’ambiance', { bpm: 64, root: 50, mode: 'minor', prog: [0, 5, 2, 6], layers: ['pad', 'strings', 'swell'], seed: 2 }, ['ambiance', 'nuit', 'mystère']),
  music('orbite-lente', 'Orbite lente', 'Musiques d’ambiance', { bpm: 80, root: 53, mode: 'major', prog: [0, 3, 0, 4], layers: ['pad', 'arp', 'subbass'], seed: 3 }, ['espace', 'futuriste', 'planant']),
  music('horizon-epique', 'Horizon épique', 'Musiques cinématiques', { bpm: 84, root: 50, mode: 'minor', prog: [0, 5, 2, 6], layers: ['strings', 'timpani', 'pad', 'subbass', 'swell'], seed: 4 }, ['épique', 'trailer', 'grandiose']),
  music('derniere-lumiere', 'Dernière lumière', 'Musiques cinématiques', { bpm: 72, root: 55, mode: 'major', prog: [0, 4, 5, 3], layers: ['strings', 'piano', 'pad'], seed: 5 }, ['émotion', 'inspirant', 'film']),
  music('vaisseau', 'Vaisseau', 'Musiques cinématiques', { bpm: 96, root: 45, mode: 'minor', prog: [0, 0, 5, 6], layers: ['strings', 'timpani', 'arp', 'subbass'], seed: 6 }, ['science-fiction', 'tension', 'action']),
  music('neon-city', 'Néon City', 'Musiques électroniques', { bpm: 118, root: 52, mode: 'minor', prog: [0, 5, 3, 4], layers: ['kick4', 'hats', 'bass', 'arp', 'pad'], seed: 7 }, ['synthwave', 'rétro', 'néon']),
  music('circuit', 'Circuit', 'Musiques électroniques', { bpm: 124, root: 48, mode: 'minor', prog: [0, 0, 6, 5], layers: ['kick4', 'clap', 'hats16', 'bass', 'pluck'], seed: 8 }, ['house', 'tech', 'club']),
  music('pixel-drive', 'Pixel Drive', 'Musiques électroniques', { bpm: 128, root: 55, mode: 'major', prog: [0, 4, 5, 3], layers: ['kick4', 'hats', 'bass', 'lead', 'pad'], seed: 9 }, ['gaming', 'énergique', 'électro']),
  music('feuilles', 'Feuilles au vent', 'Musiques calmes', { bpm: 66, root: 60, mode: 'major', prog: [0, 3, 4, 3], layers: ['piano', 'pad'], seed: 10 }, ['piano', 'calme', 'détente']),
  music('lofi-pluie', 'Lofi sous la pluie', 'Musiques calmes', { bpm: 78, root: 53, mode: 'major', prog: [1, 4, 0, 5], layers: ['piano', 'beat', 'bass', 'lofi'], seed: 11 }, ['lofi', 'étude', 'chill']),
  music('respiration', 'Respiration', 'Musiques calmes', { bpm: 60, root: 52, mode: 'major', prog: [0, 4, 3, 3], layers: ['pad', 'bells'], seed: 12 }, ['méditation', 'yoga', 'calme']),
  music('turbo', 'Turbo', 'Musiques dynamiques', { bpm: 140, root: 52, mode: 'minor', prog: [0, 5, 6, 4], layers: ['kick4', 'clap', 'hats16', 'bass', 'lead'], seed: 13 }, ['sport', 'rapide', 'énergie']),
  music('sprint', 'Sprint', 'Musiques dynamiques', { bpm: 132, root: 57, mode: 'major', prog: [0, 4, 5, 3], layers: ['beat', 'hats16', 'bass', 'pluck', 'pad'], seed: 14 }, ['motivation', 'action', 'rythmé']),
  music('impact-urbain', 'Impact urbain', 'Musiques dynamiques', { bpm: 92, root: 49, mode: 'minor', prog: [0, 0, 5, 6], layers: ['beat', 'hats16', 'subbass', 'pluck'], seed: 15 }, ['hip-hop', 'urbain', 'trap']),
  music('soleil', 'Plein soleil', 'Musiques joyeuses', { bpm: 112, root: 60, mode: 'major', prog: [0, 4, 5, 3], layers: ['beat', 'pluck', 'bass', 'bells'], seed: 16 }, ['joyeux', 'été', 'positif']),
  music('ukulele-de-poche', 'Petit bonheur', 'Musiques joyeuses', { bpm: 104, root: 62, mode: 'major', prog: [0, 3, 4, 0], layers: ['pluck', 'beat', 'bass', 'hats'], seed: 17 }, ['enfant', 'ludique', 'souriant']),
  music('fete', 'Fête', 'Musiques joyeuses', { bpm: 120, root: 57, mode: 'major', prog: [3, 4, 0, 5], layers: ['kick4', 'clap', 'bass', 'arp', 'pad'], seed: 18 }, ['fête', 'danse', 'célébration']),
  music('tempete', 'Tempête', 'Musiques dramatiques', { bpm: 90, root: 45, mode: 'minor', prog: [0, 6, 5, 4], layers: ['strings', 'timpani', 'subbass', 'swell'], seed: 19 }, ['drame', 'intense', 'sombre']),
  music('adieu', 'Adieu', 'Musiques dramatiques', { bpm: 62, root: 50, mode: 'minor', prog: [0, 3, 5, 4], layers: ['piano', 'strings'], seed: 20 }, ['tristesse', 'émotion', 'piano']),
  music('compte-a-rebours', 'Compte à rebours', 'Musiques dramatiques', { bpm: 100, root: 47, mode: 'minor', prog: [0, 0, 1, 0], layers: ['strings', 'timpani', 'arp', 'subbass'], seed: 21 }, ['suspense', 'thriller', 'tension']),
  music('hook-15', 'Accroche 15 s', 'Musiques pour vidéos courtes', { bpm: 122, root: 55, mode: 'minor', prog: [0, 5, 3, 4], layers: ['kick4', 'clap', 'bass', 'lead'], duration: 16, seed: 22 }, ['tiktok', 'reels', 'accroche']),
  music('trend', 'Tendance', 'Musiques pour vidéos courtes', { bpm: 100, root: 53, mode: 'major', prog: [0, 5, 3, 4], layers: ['beat', 'hats16', 'bass', 'pluck'], duration: 24, seed: 23 }, ['shorts', 'moderne', 'boucle']),
  music('flash', 'Flash', 'Musiques pour vidéos courtes', { bpm: 128, root: 50, mode: 'minor', prog: [0, 6, 5, 6], layers: ['kick4', 'hats16', 'subbass', 'arp'], duration: 16, seed: 24 }, ['transition', 'rapide', 'tiktok']),
  music('balade', 'Balade en ville', 'Musiques pour vlogs', { bpm: 96, root: 60, mode: 'major', prog: [0, 4, 5, 3], layers: ['beat', 'piano', 'bass', 'lofi'], seed: 25 }, ['vlog', 'quotidien', 'détendu']),
  music('road-trip', 'Road trip', 'Musiques pour vlogs', { bpm: 108, root: 55, mode: 'major', prog: [0, 3, 0, 4], layers: ['beat', 'pluck', 'bass', 'pad'], seed: 26 }, ['voyage', 'aventure', 'vlog']),
  music('cuisine', 'En cuisine', 'Musiques pour vlogs', { bpm: 92, root: 58, mode: 'major', prog: [1, 4, 0, 0], layers: ['beat', 'piano', 'bass', 'bells'], seed: 27 }, ['cuisine', 'recette', 'chaleureux']),
  music('keynote', 'Keynote', 'Musiques pour présentations', { bpm: 100, root: 57, mode: 'major', prog: [0, 4, 5, 3], layers: ['pluck', 'pad', 'bass', 'hats'], seed: 28 }, ['entreprise', 'corporate', 'présentation']),
  music('innovation', 'Innovation', 'Musiques pour présentations', { bpm: 110, root: 52, mode: 'major', prog: [0, 3, 4, 3], layers: ['arp', 'pad', 'kick4', 'bass'], seed: 29 }, ['technologie', 'startup', 'produit']),
  music('tutoriel', 'Tutoriel', 'Musiques pour présentations', { bpm: 90, root: 60, mode: 'major', prog: [0, 5, 3, 4], layers: ['piano', 'pad', 'bass'], seed: 30 }, ['tutoriel', 'explication', 'neutre']),
];

const ambience = (id, title, generator, tags) => ({ id: `ambience:${id}`, kind: 'ambience', title, category: 'Sons d’ambiance', tags, duration: 30, recipe: { generator }, author: 'SOLVEX AI' });
export const AMBIENCES = [
  ambience('pluie', 'Pluie', 'rain', ['pluie', 'météo', 'calme']),
  ambience('vent', 'Vent', 'wind', ['vent', 'nature', 'extérieur']),
  ambience('vagues', 'Vagues', 'waves', ['mer', 'plage', 'océan']),
  ambience('feu', 'Feu de bois', 'fire', ['feu', 'cheminée', 'camp']),
  ambience('nuit', 'Nuit d’été (grillons)', 'night', ['nuit', 'grillons', 'campagne']),
  ambience('espace', 'Station spatiale', 'space', ['espace', 'science-fiction', 'drone']),
];

// Short effects rendered by sounds.js.
const sfx = (soundId, title, category, tags, duration) => ({ id: `sfx:${soundId}`, kind: 'sfx', soundId, title, category, tags, duration, author: 'SOLVEX AI' });
export const EFFECTS = [
  sfx('impact', 'Impact cinématique', 'Bruitages', ['impact', 'boom', 'trailer'], 2.5),
  sfx('glitch', 'Glitch numérique', 'Bruitages', ['glitch', 'numérique', 'bug'], 0.6),
  sfx('drumroll', 'Roulement de tambour', 'Bruitages', ['tambour', 'suspense', 'révélation'], 2.2),
  sfx('boing', 'Boing', 'Bruitages', ['comique', 'rebond', 'drôle'], 0.7),
  sfx('whoosh', 'Whoosh', 'Effets sonores', ['transition', 'mouvement', 'swipe'], 0.8),
  sfx('swoosh-down', 'Swoosh descendant', 'Effets sonores', ['transition', 'chute'], 0.8),
  sfx('riser', 'Montée (riser)', 'Effets sonores', ['tension', 'montée', 'transition'], 3),
  sfx('ui-click', 'Clic d’interface', 'Effets sonores', ['clic', 'bouton', 'interface'], 0.12),
  sfx('ui-pop', 'Pop', 'Effets sonores', ['pop', 'apparition', 'bulle'], 0.2),
  sfx('ui-success', 'Succès', 'Effets sonores', ['succès', 'validation'], 0.6),
  sfx('ui-error', 'Erreur', 'Effets sonores', ['erreur', 'refus'], 0.5),
  sfx('notify', 'Notification', 'Effets sonores', ['notification', 'alerte'], 0.7),
  sfx('ding', 'Ding', 'Effets sonores', ['ding', 'idée', 'cloche'], 1.5),
  sfx('laser', 'Laser', 'Effets sonores', ['jeu vidéo', 'laser', 'arcade'], 0.5),
  sfx('coin', 'Pièce', 'Effets sonores', ['jeu vidéo', 'pièce', 'récompense'], 0.4),
  sfx('level-up', 'Niveau supérieur', 'Effets sonores', ['jeu vidéo', 'victoire'], 1),
  // Earlier SOLVEX loops, kept in their music categories.
  sfx('ambient-pad', 'Nappe d’ambiance (boucle)', 'Musiques d’ambiance', ['nappe', 'boucle', 'futuriste'], 30),
  sfx('cinematic-drone', 'Drone cinématique', 'Musiques cinématiques', ['drone', 'tension', 'grave'], 20),
  sfx('pulse-beat', 'Pulsation électro (boucle)', 'Musiques électroniques', ['boucle', '120 bpm', 'électro'], 16),
];

export const CATALOG = [...MUSIC, ...AMBIENCES, ...EFFECTS];

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Simple keyword search over titles, categories and tags (accents ignored). */
export function searchCatalog({ query = '', category = '' } = {}, limit = 50) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  return CATALOG.map((item) => {
    if (category && item.category !== category) return null;
    const hay = norm(`${item.title} ${item.category} ${item.tags.join(' ')}`);
    const score = words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
    if (words.length && score === 0) return null;
    return { item, score };
  })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item);
}
