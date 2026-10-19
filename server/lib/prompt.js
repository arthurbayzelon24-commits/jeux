import { ProviderError, networkError, providerHttpError } from '../providers/base.js';
import { STYLES } from '../../public/js/shared/styles.js';

export { STYLES };

// Video models used here have no camera parameter: the movement is written into the prompt.
export const CAMERA_MOVES = {
  auto: { label: 'Laisser le modèle choisir', hint: '' },
  fixe: { label: 'Plan fixe', hint: 'static camera, locked-off shot' },
  'travelling-avant': { label: 'Travelling avant', hint: 'slow dolly-in camera movement toward the subject' },
  'travelling-arriere': { label: 'Travelling arrière', hint: 'slow dolly-out camera movement away from the subject' },
  panoramique: { label: 'Panoramique', hint: 'smooth horizontal pan across the scene' },
  orbite: { label: 'Orbite', hint: 'camera orbiting around the subject' },
  drone: { label: 'Vue de drone', hint: 'aerial drone shot, smooth forward flight' },
  'camera-epaule': { label: 'Caméra à l’épaule', hint: 'handheld camera, subtle natural shake' },
  zoom: { label: 'Zoom lent', hint: 'slow zoom in' },
};

export function applyCamera(prompt, cameraId) {
  const move = CAMERA_MOVES[cameraId];
  if (!move || !move.hint) return prompt;
  return `${prompt}\n\nCamera: ${move.hint}.`;
}

/** Appends the selected style's descriptors to the user's prompt. */
export function applyStyle(prompt, styleId) {
  const style = STYLES[styleId];
  if (!style || !style.hint) return prompt;
  return `${prompt}\n\nStyle: ${style.hint}.`;
}

const IMAGE_DETAILS = ['composition soignée', 'éclairage maîtrisé', 'haute précision des détails', 'palette de couleurs cohérente'];
const VIDEO_DETAILS = [
  'mouvement de caméra fluide',
  'éclairage cohérent d’un plan à l’autre',
  'action clairement décrite',
  'ambiance sonore suggérée',
];

/**
 * Deterministic, rule-based enrichment. It never pretends to be an AI: the API
 * reports `method: "local"` so the UI can label it accordingly.
 */
export function enhanceLocally(prompt, { kind = 'image', style } = {}) {
  const base = prompt
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.。]+$/, '');
  const parts = [base.charAt(0).toUpperCase() + base.slice(1)];
  const details = kind === 'video' ? VIDEO_DETAILS : IMAGE_DETAILS;
  const missing = details.filter((detail) => !base.toLowerCase().includes(detail.split(' ')[0]));
  if (missing.length > 0) parts.push(missing.join(', '));
  if (style && STYLES[style]?.label && style !== 'personnalise') parts.push(`style ${STYLES[style].label.toLowerCase()}`);
  return `${parts.join(', ')}.`;
}

const SYSTEM_PROMPT = `Tu réécris des descriptions destinées à un générateur d'images ou de vidéos.
Conserve strictement l'intention, le sujet et la langue de l'utilisateur.
Ajoute des précisions visuelles utiles (sujet, cadrage, lumière, matières, ambiance) sans inventer d'éléments contradictoires.
Réponds uniquement par la description améliorée, en un seul paragraphe de 80 mots maximum.`;

export async function enhanceWithModel(config, { prompt, kind, style }, { fetchImpl = fetch, signal } = {}) {
  const { apiKey, baseUrl, textModel } = config.openai;
  const styleText = STYLES[style]?.label && style !== 'personnalise' ? ` Style souhaité : ${STYLES[style].label}.` : '';
  let response;
  try {
    response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: textModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Type : ${kind === 'video' ? 'vidéo' : 'image'}.${styleText}\nDescription : ${prompt}` },
        ],
      }),
    });
  } catch (error) {
    throw networkError(error, 'OpenAI');
  }
  if (!response.ok) throw await providerHttpError(response, 'OpenAI');
  const body = await response.json();
  const text = body?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new ProviderError('Aucune suggestion renvoyée.', { code: 'empty_result' });
  return text;
}

export function canEnhanceWithModel(config) {
  return Boolean(config.openai.apiKey && config.openai.textModel);
}
