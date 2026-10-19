import { ASPECTS, RESOLUTIONS, QUALITY_TIERS, buildAspects } from '../shared/imageSizes.js';
import { applyStyle } from '../shared/styles.js';
import { importFile } from '../studio/media.js';

/**
 * Image generation for the public website (no SOLVEX server): the browser asks
 * Pollinations directly. It needs no key, so nothing secret reaches the page.
 * Not available inside the claude.ai frame, whose security policy blocks
 * every outside address.
 */
const BASE = 'https://image.pollinations.ai';
const TIMEOUT_MS = 180_000;

export const BROWSER_IMAGE_PROVIDER = {
  id: 'pollinations-browser',
  label: 'Pollinations (gratuit)',
  vendor: 'Pollinations',
  kind: 'image',
  model: 'par défaut',
  configured: true,
  missing: [],
  browser: true,
  capabilities: {
    textToImage: true,
    imageToImage: false,
    negativePrompt: false,
    aspects: buildAspects(
      ASPECTS.map((a) => a.id),
      () => null,
      8,
    ),
    resolutions: RESOLUTIONS.map(({ id, label }) => ({ id, label })),
    qualities: QUALITY_TIERS.filter((q) => q.id === 'standard').map((q) => ({ ...q, detail: 'Seul niveau proposé par ce service' })),
    qualitiesUnavailable: QUALITY_TIERS.filter((q) => q.id !== 'standard').map((q) => ({
      id: q.id,
      label: q.label,
      reason: 'Pollinations n’a pas de réglage de qualité.',
    })),
    sizeNotGuaranteed: true,
    maxImages: 1,
    maxReferenceImages: 0,
    thirdParty: true,
    notes: [
      'Service gratuit, sans clé : votre description est envoyée à Pollinations (service tiers) directement depuis votre navigateur.',
      'Pollinations ne garantit pas la taille demandée : la taille réelle du fichier est affichée.',
    ],
  },
};

async function measure(blob) {
  const bitmap = await createImageBitmap(blob);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close?.();
  return size;
}

/**
 * Generates one image and stores it in the local library (« Mes créations »).
 * Resolves with a creation-like object; rejects with a readable French error.
 */
export async function generateInBrowser({ prompt, style, aspect, resolution, signal }) {
  const size = BROWSER_IMAGE_PROVIDER.capabilities.aspects.find((a) => a.id === aspect)?.resolutions.find((r) => r.id === resolution);
  if (!size) throw new Error('Format ou résolution non pris en charge.');
  const params = new URLSearchParams({
    width: String(size.width),
    height: String(size.height),
    seed: String(Math.floor(Math.random() * 1e9)),
    nologo: 'true',
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort(signal.reason));
  let response;
  try {
    response = await fetch(`${BASE}/prompt/${encodeURIComponent(applyStyle(prompt, style))}?${params}`, { signal: controller.signal });
  } catch (error) {
    clearTimeout(timer);
    if (controller.signal.reason?.message === 'timeout') throw new Error('Pollinations n’a pas répondu à temps (3 minutes). Réessayez.');
    if (signal?.aborted) throw new Error('Génération annulée.');
    throw new Error('Impossible de joindre Pollinations depuis ce navigateur (réseau coupé, service indisponible ou bloqué).');
  }
  clearTimeout(timer);
  if (!response.ok) {
    throw new Error(
      response.status === 429
        ? 'Pollinations limite le nombre de demandes : patientez un peu avant de réessayer.'
        : `Pollinations a refusé la demande (erreur ${response.status}).`,
    );
  }
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('Pollinations n’a pas renvoyé d’image.');
  const real = await measure(blob);
  const ext = blob.type.split('/')[1] || 'jpg';
  const name = prompt.slice(0, 60);
  const media = await importFile(new File([blob], `solvex-${Date.now()}.${ext}`, { type: blob.type }), {
    name,
    origin: 'solvex-ai',
    extra: { prompt, generation: { provider: 'Pollinations', aspect, resolution, requestedWidth: size.width, requestedHeight: size.height } },
  });
  return {
    id: media.id,
    local: true,
    mediaId: media.id,
    type: 'image',
    status: 'succeeded',
    prompt,
    model: 'Pollinations',
    createdAt: media.createdAt,
    params: { aspect, resolution, quality: 'standard', requestedWidth: size.width, requestedHeight: size.height },
    outputs: [{ url: URL.createObjectURL(blob), mime: blob.type, width: real.width, height: real.height, bytes: blob.size, blob }],
  };
}
