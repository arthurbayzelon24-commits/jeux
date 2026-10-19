import { ProviderError, networkError, providerHttpError } from './base.js';

/**
 * Optional online audio catalogues, queried by the server with its own keys:
 * - Jamendo (music under Creative Commons licences), API v3, JAMENDO_CLIENT_ID;
 * - Freesound (sound effects and ambiences), API v2, FREESOUND_API_KEY.
 * Every result carries its author and licence; some licences forbid
 * commercial use or require attribution, which the page shows.
 * Audio files are fetched through the server by id only (no URL from the
 * browser is ever fetched).
 */

// Category of the SOLVEX panel → search words understood by each catalogue.
const JAMENDO_TAGS = {
  'Musiques d’ambiance': 'ambient',
  'Musiques cinématiques': 'soundtrack',
  'Musiques électroniques': 'electronic',
  'Musiques calmes': 'relaxation',
  'Musiques dynamiques': 'energetic',
  'Musiques joyeuses': 'happy',
  'Musiques dramatiques': 'dramatic',
  'Musiques pour vidéos courtes': 'pop',
  'Musiques pour vlogs': 'acoustic',
  'Musiques pour présentations': 'corporate',
};
const FREESOUND_WORDS = { 'Sons d’ambiance': 'ambience', Bruitages: 'foley', 'Effets sonores': 'sound effect', 'Voix et narration': 'voice' };

const LICENSE_LABELS = [
  [/publicdomain\/zero|cc0/i, 'CC0 (domaine public)'],
  [/by-nc-nd/i, 'CC BY-NC-ND (attribution, pas d’usage commercial, pas de modification)'],
  [/by-nc-sa/i, 'CC BY-NC-SA (attribution, pas d’usage commercial)'],
  [/by-nc/i, 'CC BY-NC (attribution, pas d’usage commercial)'],
  [/by-nd/i, 'CC BY-ND (attribution, pas de modification)'],
  [/by-sa/i, 'CC BY-SA (attribution, partage dans les mêmes conditions)'],
  [/by\//i, 'CC BY (attribution requise)'],
  [/sampling/i, 'Sampling+ (voir conditions)'],
];
export const licenseLabel = (url = '') => LICENSE_LABELS.find(([re]) => re.test(url))?.[1] || 'Licence : voir la page de l’œuvre';

async function getJson(fetchImpl, url, vendor, signal) {
  let response;
  try {
    response = await fetchImpl(url, { signal });
  } catch (error) {
    throw networkError(error, vendor);
  }
  if (!response.ok) throw await providerHttpError(response, vendor);
  return response.json();
}

async function getAudio(fetchImpl, url, vendor, signal) {
  let response;
  try {
    response = await fetchImpl(url, { signal });
  } catch (error) {
    throw networkError(error, vendor);
  }
  if (!response.ok) throw await providerHttpError(response, vendor);
  const mime = (response.headers.get('content-type') || 'audio/mpeg').split(';')[0];
  if (!mime.startsWith('audio/') && mime !== 'application/octet-stream') throw new ProviderError(`${vendor} n’a pas renvoyé de fichier audio.`, { code: 'empty_result' });
  return { buffer: Buffer.from(await response.arrayBuffer()), mime: mime.startsWith('audio/') ? mime : 'audio/mpeg' };
}

export function createAudioLibraries(config, { fetchImpl = fetch } = {}) {
  const jamendo = {
    id: 'jamendo',
    label: 'Jamendo (musiques Creative Commons)',
    configured: Boolean(config.audio.jamendoClientId),
    missing: ['JAMENDO_CLIENT_ID'],
    async search({ query, category, signal }) {
      const params = new URLSearchParams({ client_id: config.audio.jamendoClientId, format: 'json', limit: '24', audioformat: 'mp32', include: 'licenses' });
      const words = [query, JAMENDO_TAGS[category]].filter(Boolean).join(' ').trim();
      if (words) params.set('search', words);
      else params.set('order', 'popularity_week');
      const body = await getJson(fetchImpl, `${config.audio.jamendoBaseUrl}/tracks/?${params}`, 'Jamendo', signal);
      return (body.results || []).map((t) => ({
        id: String(t.id),
        source: 'jamendo',
        title: t.name,
        author: t.artist_name,
        duration: Number(t.duration) || null,
        license: licenseLabel(t.license_ccurl),
        licenseUrl: t.license_ccurl || null,
        pageUrl: t.shareurl || null,
        category: category || 'Musique',
      }));
    },
    async file({ id, signal }) {
      const params = new URLSearchParams({ client_id: config.audio.jamendoClientId, format: 'json', id, audioformat: 'mp32' });
      const body = await getJson(fetchImpl, `${config.audio.jamendoBaseUrl}/tracks/?${params}`, 'Jamendo', signal);
      const track = body.results?.[0];
      if (!track?.audio) throw new ProviderError('Morceau introuvable chez Jamendo.', { status: 404, code: 'not_found' });
      return { ...(await getAudio(fetchImpl, track.audio, 'Jamendo', signal)), title: track.name, author: track.artist_name, license: licenseLabel(track.license_ccurl), licenseUrl: track.license_ccurl };
    },
  };

  const freesound = {
    id: 'freesound',
    label: 'Freesound (bruitages et ambiances)',
    configured: Boolean(config.audio.freesoundApiKey),
    missing: ['FREESOUND_API_KEY'],
    async search({ query, category, signal }) {
      const words = [query, FREESOUND_WORDS[category]].filter(Boolean).join(' ').trim() || 'ambience';
      const params = new URLSearchParams({ query: words, token: config.audio.freesoundApiKey, page_size: '24', fields: 'id,name,username,duration,license,tags' });
      const body = await getJson(fetchImpl, `${config.audio.freesoundBaseUrl}/search/text/?${params}`, 'Freesound', signal);
      return (body.results || []).map((s) => ({
        id: String(s.id),
        source: 'freesound',
        title: s.name,
        author: s.username,
        duration: Number(s.duration) || null,
        license: licenseLabel(s.license),
        licenseUrl: s.license || null,
        pageUrl: `https://freesound.org/s/${s.id}/`,
        category: category || 'Sons',
      }));
    },
    async file({ id, signal }) {
      const params = new URLSearchParams({ token: config.audio.freesoundApiKey, fields: 'id,name,username,license,previews' });
      const sound = await getJson(fetchImpl, `${config.audio.freesoundBaseUrl}/sounds/${encodeURIComponent(id)}/?${params}`, 'Freesound', signal);
      const url = sound.previews?.['preview-hq-mp3'];
      if (!url) throw new ProviderError('Son introuvable chez Freesound.', { status: 404, code: 'not_found' });
      return { ...(await getAudio(fetchImpl, url, 'Freesound', signal)), title: sound.name, author: sound.username, license: licenseLabel(sound.license), licenseUrl: sound.license };
    },
  };

  const all = [jamendo, freesound];
  return {
    describe: () => all.map(({ id, label, configured, missing }) => ({ id, label, configured, missing: configured ? [] : missing })),
    get: (id) => all.find((s) => s.id === id && s.configured) || null,
  };
}
