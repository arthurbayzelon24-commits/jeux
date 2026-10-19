import { ProviderError, networkError, providerHttpError } from './base.js';

const VENDOR = 'OpenAI';

// gpt-image-2 and later accept flexible sizes (edges multiple of 16, max edge 3840,
// 655 360 – 8 294 400 px). gpt-image-1 / 1-mini / 1.5 only accept the three fixed sizes.
const FLEXIBLE_ASPECTS = [
  { id: '1:1', label: 'Carré 1:1', sizes: { standard: '1024x1024', high: '2048x2048' } },
  { id: '16:9', label: 'Paysage 16:9', sizes: { standard: '1536x864', high: '2048x1152' } },
  { id: '9:16', label: 'Portrait 9:16', sizes: { standard: '864x1536', high: '1152x2048' } },
  { id: '4:3', label: '4:3', sizes: { standard: '1024x768', high: '2048x1536' } },
  { id: '3:2', label: '3:2', sizes: { standard: '1536x1024', high: '2304x1536' } },
  { id: '2:3', label: 'Portrait 2:3', sizes: { standard: '1024x1536', high: '1536x2304' } },
  { id: '4:5', label: 'Portrait 4:5 (Instagram)', sizes: { standard: '1024x1280', high: '1632x2048' } },
];

const FIXED_ASPECTS = [
  { id: '1:1', label: 'Carré 1:1', sizes: { standard: '1024x1024' } },
  { id: '3:2', label: '3:2', sizes: { standard: '1536x1024' } },
  { id: '2:3', label: 'Portrait 2:3', sizes: { standard: '1024x1536' } },
];

export function isFixedSizeModel(model) {
  return /^gpt-image-1(\b|[.-])/.test(model) || model === 'chatgpt-image-latest';
}

export function createOpenAIImageProvider(config, { fetchImpl = fetch } = {}) {
  const { apiKey, baseUrl, imageModel: model } = config.openai;
  const fixed = isFixedSizeModel(model);
  const aspects = fixed ? FIXED_ASPECTS : FLEXIBLE_ASPECTS;

  const capabilities = {
    textToImage: true,
    imageToImage: true,
    // The edits endpoint always needs an instruction; image-only requests are sent as an explicit variation instruction.
    imageOnly: false,
    negativePrompt: false,
    edit: true,
    mask: true,
    aspects: aspects.map(({ id, label, sizes }) => ({ id, label, resolutions: Object.keys(sizes) })),
    resolutions: fixed
      ? [{ id: 'standard', label: 'Standard' }]
      : [
          { id: 'standard', label: 'Standard (~1,5 Mpx)' },
          { id: 'high', label: 'Haute définition (~4 Mpx)' },
        ],
    qualities: [
      { id: 'auto', label: 'Automatique' },
      { id: 'low', label: 'Brouillon (rapide)' },
      { id: 'medium', label: 'Équilibrée' },
      { id: 'high', label: 'Maximale (lent)' },
    ],
    maxImages: 4,
    maxReferenceImages: 4,
    acceptedTypes: ['image/png', 'image/jpeg', 'image/webp'],
    notes: [
      'Génération texte-vers-image et image-vers-image via l’API Images d’OpenAI.',
      'Les retouches ciblées utilisent un masque : la zone peinte est régénérée selon votre instruction.',
    ],
  };

  function sizeFor(aspect, resolution = 'standard') {
    const entry = aspects.find((item) => item.id === aspect);
    if (!entry) throw new ProviderError(`Format ${aspect} non pris en charge par ${model}.`, { status: 400, code: 'unsupported_option' });
    const size = entry.sizes[resolution];
    if (!size)
      throw new ProviderError(`Résolution « ${resolution} » indisponible pour ce format.`, { status: 400, code: 'unsupported_option' });
    return size;
  }

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
        body: JSON.stringify({ model, prompt, n: count, size: sizeFor(aspect, resolution), quality }),
      });
    },

    async edit({ prompt, image, images, mask, aspect, resolution, quality = 'auto', count = 1, signal }) {
      const inputs = images || [image];
      const form = new FormData();
      form.append('model', model);
      form.append('prompt', prompt);
      form.append('n', String(count));
      form.append('quality', quality);
      if (aspect) form.append('size', sizeFor(aspect, resolution));
      inputs.forEach((input, index) => {
        form.append('image[]', new Blob([input.buffer], { type: input.mime }), `image-${index}.${input.ext || 'png'}`);
      });
      if (mask) form.append('mask', new Blob([mask.buffer], { type: 'image/png' }), 'mask.png');
      return call('/images/edits', { method: 'POST', signal, body: form });
    },
  };
}
