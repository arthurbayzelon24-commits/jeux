import { ProviderError, networkError, providerHttpError } from './base.js';
import { ASPECTS, QUALITY_TIERS, RESOLUTIONS, buildAspects, formatPixels } from '../../public/js/shared/imageSizes.js';

const VENDOR = 'OpenAI';

// gpt-image-2 and later accept flexible sizes: both edges multiples of 16, longest
// edge at most 3840 px, between 655 360 and 8 294 400 pixels, ratio at most 3:1.
// gpt-image-1 / 1-mini / 1.5 only accept 1024×1024, 1536×1024 and 1024×1536.
const MIN_PIXELS = 655_360;
const MAX_PIXELS = 8_294_400;
const MAX_EDGE = 3840;
const FIXED_SIZES = { '1:1': '1024x1024', '3:2': '1536x1024', '2:3': '1024x1536' };

function flexibleCheck({ width, height }) {
  if (Math.max(width, height) > MAX_EDGE) return `Côté maximal du modèle : ${MAX_EDGE} px.`;
  if (width * height > MAX_PIXELS) return `Dépasse la taille maximale du modèle (${formatPixels(MAX_PIXELS)}).`;
  if (width * height < MIN_PIXELS) return `En dessous de la taille minimale du modèle (${formatPixels(MIN_PIXELS)}).`;
  if (Math.max(width, height) / Math.min(width, height) > 3) return 'Rapport trop allongé pour ce modèle (3:1 au maximum).';
  return null;
}

// Quality tier → the API's `quality` parameter.
const QUALITY_PARAM = { standard: 'low', high: 'medium', veryhigh: 'high', ultra: 'high', auto: 'auto' };

export function isFixedSizeModel(model) {
  return /^gpt-image-1(\b|[.-])/.test(model) || model === 'chatgpt-image-latest';
}

export function createOpenAIImageProvider(config, { fetchImpl = fetch } = {}) {
  const { apiKey, baseUrl, imageModel: model } = config.openai;
  const fixed = isFixedSizeModel(model);
  const aspects = fixed
    ? Object.entries(FIXED_SIZES).map(([id, size]) => {
        const [width, height] = size.split('x').map(Number);
        return {
          id,
          label: ASPECTS.find((a) => a.id === id).label,
          resolutions: [{ id: 'native', width, height }],
          unavailable: RESOLUTIONS.map((r) => ({ id: r.id, reason: `${model} ne produit que des tailles fixes (${size}).` })),
        };
      })
    : buildAspects(
        ASPECTS.map((a) => a.id),
        flexibleCheck,
      );

  const capabilities = {
    textToImage: true,
    imageToImage: true,
    // The edits endpoint always needs an instruction; image-only requests are sent as an explicit variation instruction.
    imageOnly: false,
    negativePrompt: false,
    edit: true,
    mask: true,
    aspects,
    resolutions: fixed ? [{ id: 'native', label: 'Taille fixe du modèle' }] : RESOLUTIONS.map(({ id, label }) => ({ id, label })),
    qualities: QUALITY_TIERS.map((q) => ({ ...q, param: QUALITY_PARAM[q.id] })),
    qualitiesUnavailable: [],
    upscaler: null,
    maxImages: 4,
    maxReferenceImages: 4,
    acceptedTypes: ['image/png', 'image/jpeg', 'image/webp'],
    notes: [
      'Génération texte-vers-image et image-vers-image via l’API Images d’OpenAI.',
      fixed
        ? `${model} ne produit que 1024×1024, 1536×1024 et 1024×1536.`
        : `Tailles natives jusqu’à ${MAX_EDGE} px de côté et ${formatPixels(MAX_PIXELS)} : la 4K est native en 16:9, 9:16 et 21:9 ; le carré 4K (3840 × 3840) dépasse la limite.`,
    ],
  };

  /** { width, height } produced natively for this format and resolution, or a ProviderError. */
  function sizeFor(aspect, resolution) {
    const entry = aspects.find((item) => item.id === aspect);
    if (!entry) throw new ProviderError(`Format ${aspect} non pris en charge par ${model}.`, { status: 400, code: 'unsupported_option' });
    const size = entry.resolutions.find((r) => r.id === resolution) || (fixed ? entry.resolutions[0] : null);
    if (!size) {
      const reason = entry.unavailable.find((u) => u.id === resolution)?.reason || 'Résolution inconnue.';
      throw new ProviderError(`Résolution ${resolution} indisponible en ${aspect} : ${reason}`, { status: 400, code: 'unsupported_option' });
    }
    return { width: size.width, height: size.height };
  }
  const sizeParam = (aspect, resolution) => {
    const { width, height } = sizeFor(aspect, resolution);
    return `${width}x${height}`;
  };

  async function call(path, init) {
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${apiKey}`, ...(init.headers || {}) },
      });
    } catch (error) {
      throw networkError(error, VENDOR);
    }
    if (!response.ok) throw await providerHttpError(response, VENDOR);
    const body = await response.json();
    const images = (body.data || []).filter((item) => item.b64_json);
    if (images.length === 0) throw new ProviderError('Le fournisseur n’a renvoyé aucune image.', { code: 'empty_result' });
    return images.map((item) => ({ buffer: Buffer.from(item.b64_json, 'base64'), mime: 'image/png' }));
  }

  return {
    id: 'openai-images',
    label: `OpenAI · ${model}`,
    vendor: VENDOR,
    kind: 'image',
    model,
    requiredEnv: ['OPENAI_API_KEY'],
    isConfigured: () => Boolean(apiKey),
    capabilities,
    sizeFor,

    async generate({ prompt, aspect, resolution, quality, count, references = [], signal }) {
      if (references.length > 0) {
        return this.edit({ prompt, images: references, aspect, resolution, quality, count, signal });
      }
      return call('/images/generations', {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, n: count, size: sizeParam(aspect, resolution), quality: QUALITY_PARAM[quality] || 'auto' }),
      });
    },

    async edit({ prompt, image, images, mask, aspect, resolution, quality = 'auto', count = 1, signal }) {
      const inputs = images || [image];
      const form = new FormData();
      form.append('model', model);
      form.append('prompt', prompt);
      form.append('n', String(count));
      form.append('quality', QUALITY_PARAM[quality] || 'auto');
      if (aspect) form.append('size', sizeParam(aspect, resolution));
      inputs.forEach((input, index) => {
        form.append('image[]', new Blob([input.buffer], { type: input.mime }), `image-${index}.${input.ext || 'png'}`);
      });
      if (mask) form.append('mask', new Blob([mask.buffer], { type: 'image/png' }), 'mask.png');
      return call('/images/edits', { method: 'POST', signal, body: form });
    },
  };
}
