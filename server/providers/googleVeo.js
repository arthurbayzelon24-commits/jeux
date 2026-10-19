import { ProviderError, networkError, providerHttpError } from './base.js';

const VENDOR = 'Google Gemini API (Veo)';

/**
 * Veo through the Gemini API: POST models/{model}:predictLongRunning returns a
 * long-running operation that is polled until `done`. Veo does not report a
 * completion percentage, so progress stays null.
 */
export function createVeoProvider(config, { fetchImpl = fetch } = {}) {
  const { apiKey, baseUrl, videoModel: model } = config.google;

  const capabilities = {
    textToVideo: true,
    imageToVideo: true,
    negativePrompt: true,
    durations: [4, 6, 8],
    aspects: [
      { id: '16:9', label: 'Paysage 16:9' },
      { id: '9:16', label: 'Portrait 9:16' },
    ],
    resolutions: [
      { id: '720p', label: '720p' },
      { id: '1080p', label: '1080p', requiresDuration: 8 },
    ],
    reportsProgress: false,
    acceptedTypes: ['image/png', 'image/jpeg'],
    notes: [
      'Chaque génération produit un seul clip de 4, 6 ou 8 secondes.',
      'Le 1080p n’est proposé qu’avec une durée de 8 secondes.',
      'Veo n’indique pas de pourcentage d’avancement : le statut affiché est celui renvoyé par l’API.',
    ],
  };

  const headers = { 'x-goog-api-key': apiKey };

  async function request(url, init = {}) {
    let response;
    try {
      response = await fetchImpl(url, { ...init, headers: { ...headers, ...(init.headers || {}) } });
    } catch (error) {
      throw networkError(error, VENDOR);
    }
    if (!response.ok) throw await providerHttpError(response, VENDOR);
    return response;
  }

  return {
    id: 'google-veo',
    label: `Google · ${model}`,
    vendor: VENDOR,
    kind: 'video',
    model,
    requiredEnv: ['GEMINI_API_KEY'],
    isConfigured: () => Boolean(apiKey),
    capabilities,

    validate({ duration, aspect, resolution, startImage }) {
      if (!capabilities.durations.includes(duration)) return `Durée non prise en charge : ${duration} s.`;
      if (!capabilities.aspects.some((item) => item.id === aspect)) return `Format non pris en charge : ${aspect}.`;
      const res = capabilities.resolutions.find((item) => item.id === resolution);
      if (!res) return `Résolution non prise en charge : ${resolution}.`;
      if (res.requiresDuration && res.requiresDuration !== duration) return `Le ${res.id} exige une durée de ${res.requiresDuration} s.`;
      if (startImage && !capabilities.acceptedTypes.includes(startImage.mime)) return 'L’image de départ doit être en PNG ou JPEG.';
      return null;
    },

    async start({ prompt, negativePrompt, aspect, duration, resolution, startImage, signal }) {
      const instance = { prompt };
      if (startImage) {
        instance.image = { bytesBase64Encoded: startImage.buffer.toString('base64'), mimeType: startImage.mime };
      }
      const response = await request(`${baseUrl}/models/${encodeURIComponent(model)}:predictLongRunning`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [instance],
          parameters: { aspectRatio: aspect, durationSeconds: duration, resolution, ...(negativePrompt ? { negativePrompt } : {}) },
        }),
      });
      const body = await response.json();
      if (!body?.name) throw new ProviderError('Le fournisseur n’a pas renvoyé d’identifiant de tâche.', { code: 'empty_result' });
      return { operation: body.name };
    },

    async poll(operation, { signal } = {}) {
      if (!/^models\/[\w.-]+\/operations\/[\w-]+$/.test(operation) || operation.includes('..'))
        throw new ProviderError('Identifiant d’opération invalide.', { code: 'invalid_operation' });
      const response = await request(`${baseUrl}/${operation}`, { signal });
      const body = await response.json();
      if (!body.done) return { state: 'running', progress: null };
      if (body.error) return { state: 'failed', progress: null, error: body.error.message || 'La génération a échoué.' };
      const videoResponse = body.response?.generateVideoResponse;
      const uri = videoResponse?.generatedSamples?.[0]?.video?.uri;
      if (!uri) {
        const reasons = videoResponse?.raiMediaFilteredReasons;
        const reason = Array.isArray(reasons) && reasons.length > 0 ? reasons.join(' ') : 'Aucune vidéo renvoyée.';
        return { state: 'failed', progress: null, error: `Vidéo non produite : ${reason}` };
      }
      return { state: 'succeeded', progress: null, result: { uri } };
    },

    async download(result, { signal } = {}) {
      const url = new URL(result.uri);
      // Only ever send the API key to Google's own hosts.
      if (url.protocol !== 'https:' || !url.hostname.endsWith('googleapis.com')) {
        throw new ProviderError('URL de résultat inattendue renvoyée par le fournisseur.', { code: 'invalid_result_url' });
      }
      const response = await request(url.toString(), { signal, redirect: 'follow' });
      const buffer = Buffer.from(await response.arrayBuffer());
      return { buffer, mime: 'video/mp4' };
    },
  };
}
