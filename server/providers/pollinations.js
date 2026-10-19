import { ProviderError, networkError, providerHttpError } from './base.js';
import { sniffMime } from '../lib/files.js';

const VENDOR = 'Pollinations';

const ASPECTS = [
  { id: '1:1', label: 'Carré 1:1', sizes: { standard: [1024, 1024] } },
  { id: '16:9', label: 'Paysage 16:9', sizes: { standard: [1344, 768] } },
  { id: '9:16', label: 'Portrait 9:16', sizes: { standard: [768, 1344] } },
  { id: '4:5', label: 'Portrait 4:5 (Instagram)', sizes: { standard: [1024, 1280] } },
  { id: '4:3', label: '4:3', sizes: { standard: [1152, 864] } },
  { id: '3:2', label: '3:2', sizes: { standard: [1216, 832] } },
  { id: '2:3', label: 'Portrait 2:3', sizes: { standard: [832, 1216] } },
];

/**
 * Free text-to-image service that needs no account or key (anonymous use is
 * rate limited). The server downloads the result and stores it like any other
 * creation, so the browser never talks to the third party directly.
 * Enabled by default; set POLLINATIONS_ENABLED=false to turn it off.
 */
export function createPollinationsProvider(config, { fetchImpl = fetch } = {}) {
  const { enabled, baseUrl, model } = config.pollinations;

  const capabilities = {
    textToImage: true,
    imageToImage: false,
    imageOnly: false,
    edit: false,
    mask: false,
    negativePrompt: false,
    aspects: ASPECTS.map(({ id, label, sizes }) => ({ id, label, resolutions: Object.keys(sizes) })),
    resolutions: [{ id: 'standard', label: 'Standard (~1 Mpx)' }],
    qualities: [{ id: 'auto', label: 'Automatique' }],
    maxImages: 1,
    maxReferenceImages: 0,
    acceptedTypes: [],
    thirdParty: true,
    notes: [
      'Service gratuit, sans clé : votre description est envoyée à Pollinations (service tiers).',
      'Accès anonyme limité (environ une image toutes les 15 secondes) ; une image par génération.',
    ],
  };

  function sizeFor(aspect, resolution = 'standard') {
    const entry = ASPECTS.find((a) => a.id === aspect);
    if (!entry?.sizes[resolution]) throw new ProviderError(`Format ${aspect} non pris en charge par Pollinations.`, { status: 400, code: 'unsupported_option' });
    return entry.sizes[resolution];
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
      const [width, height] = sizeFor(aspect, resolution);
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
