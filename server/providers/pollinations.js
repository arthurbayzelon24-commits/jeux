import { ProviderError, networkError, providerHttpError } from './base.js';
import { sniffMime } from '../lib/files.js';
import { ASPECTS, QUALITY_TIERS, RESOLUTIONS, buildAspects } from '../../public/js/shared/imageSizes.js';

const VENDOR = 'Pollinations';

// Pollinations takes any width/height; it does not document a maximum, so large
// sizes are requested as asked and the real size of the returned file is shown.
const AVAILABLE = ASPECTS.map((a) => a.id);

/**
 * Free text-to-image service that needs no account or key (anonymous use is
 * rate limited). The server downloads the result and stores it like any other
 * creation, so the browser never talks to the third party directly.
 * Enabled by default; set POLLINATIONS_ENABLED=false to turn it off.
 */
export function createPollinationsProvider(config, { fetchImpl = fetch } = {}) {
  const { enabled, baseUrl, model } = config.pollinations;

  const aspects = buildAspects(AVAILABLE, () => null, 8);
  const capabilities = {
    textToImage: true,
    imageToImage: false,
    imageOnly: false,
    edit: false,
    mask: false,
    negativePrompt: false,
    aspects,
    resolutions: RESOLUTIONS.map(({ id, label }) => ({ id, label })),
    qualities: QUALITY_TIERS.filter((q) => q.id === 'standard').map((q) => ({ ...q, detail: 'Seul niveau proposé par ce service' })),
    qualitiesUnavailable: QUALITY_TIERS.filter((q) => q.id !== 'standard').map((q) => ({
      id: q.id,
      label: q.label,
      reason: 'Pollinations n’a pas de réglage de qualité : choisissez un autre modèle (OpenAI) pour ce niveau.',
    })),
    upscaler: null,
    sizeNotGuaranteed: true,
    maxImages: 1,
    maxReferenceImages: 0,
    acceptedTypes: [],
    thirdParty: true,
    notes: [
      'Service gratuit, sans clé : votre description est envoyée à Pollinations (service tiers).',
      'Accès anonyme limité ; une image par génération. Pollinations ne garantit pas la taille demandée : la taille réelle du fichier est affichée.',
    ],
  };

  function sizeFor(aspect, resolution) {
    const entry = aspects.find((a) => a.id === aspect);
    const size = entry?.resolutions.find((r) => r.id === resolution);
    if (!size) throw new ProviderError(`Format ${aspect} / ${resolution} non pris en charge par Pollinations.`, { status: 400, code: 'unsupported_option' });
    return { width: size.width, height: size.height };
  }

  return {
    id: 'pollinations-images',
    label: `Pollinations${model ? ` · ${model}` : ''} (gratuit)`,
    vendor: VENDOR,
    kind: 'image',
    model: model || 'par défaut',
    requiredEnv: ['POLLINATIONS_ENABLED=true'],
    isConfigured: () => enabled,
    capabilities,
    sizeFor,

    async generate({ prompt, aspect, resolution, signal }) {
      const { width, height } = sizeFor(aspect, resolution);
      const params = new URLSearchParams({ width: String(width), height: String(height), seed: String(Math.floor(Math.random() * 1e9)), nologo: 'true' });
      if (model) params.set('model', model);
      let response;
      try {
        response = await fetchImpl(`${baseUrl}/prompt/${encodeURIComponent(prompt)}?${params}`, { signal });
      } catch (error) {
        throw networkError(error, VENDOR);
      }
      if (!response.ok) throw await providerHttpError(response, VENDOR);
      const buffer = Buffer.from(await response.arrayBuffer());
      const mime = sniffMime(buffer);
      if (!mime?.startsWith('image/')) {
        throw new ProviderError('Pollinations n’a pas renvoyé d’image (le service a peut-être changé d’adresse ou refusé la demande).', { code: 'empty_result' });
      }
      return [{ buffer, mime }];
    },

    async edit() {
      throw new ProviderError('Pollinations ne prend pas en charge la retouche d’image.', { status: 400, code: 'unsupported_option' });
    },
  };
}
