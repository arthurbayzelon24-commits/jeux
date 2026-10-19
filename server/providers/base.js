/**
 * Provider contract
 * -----------------
 * Every adapter exports an object with:
 *   id, label, vendor, kind ('image' | 'video'), model
 *   requiredEnv: string[]           — env vars needed to enable it
 *   isConfigured(): boolean
 *   capabilities: {...}             — what the UI is allowed to offer (see each adapter)
 *
 * Image adapters implement:
 *   generate({ prompt, aspect, resolution, quality, count, references, signal }) -> Promise<Array<{ buffer, mime }>>
 *   edit({ prompt, image, mask, aspect, resolution, quality, count, signal })      -> Promise<Array<{ buffer, mime }>>
 *
 * Video adapters implement (asynchronous, provider-side jobs):
 *   start({ prompt, aspect, duration, resolution, startImage, signal }) -> Promise<{ operation: string }>
 *   poll(operation, { signal }) -> Promise<{ state: 'running' | 'succeeded' | 'failed', progress: number | null, error?: string, result?: any }>
 *   download(result, { signal }) -> Promise<{ buffer, mime }>
 *
 * Adapters must never report a progress percentage the provider did not send.
 */

export class ProviderError extends Error {
  constructor(message, { status = 502, retryable = false, code = 'provider_error' } = {}) {
    super(message);
    this.status = status;
    this.retryable = retryable;
    this.code = code;
  }
}

/** Maps an HTTP failure from a provider to a user-facing French message. */
export async function providerHttpError(response, vendor) {
  let detail = '';
  try {
    const body = await response.json();
    detail = body?.error?.message || body?.message || '';
  } catch {
    // Body was not JSON; keep the generic message.
  }
  const suffix = detail ? ` (${vendor} : ${truncate(detail, 300)})` : '';
  switch (response.status) {
    case 400:
    case 422:
      return new ProviderError(`Requête refusée par le fournisseur${suffix}`, { status: 400, code: 'provider_rejected' });
    case 401:
    case 403:
      return new ProviderError(`Clé API refusée ou accès non autorisé chez ${vendor}. Vérifiez la configuration du serveur.`, {
        status: 502,
        code: 'provider_auth',
      });
    case 404:
      return new ProviderError(`Modèle ou ressource introuvable chez ${vendor}${suffix}`, { status: 502, code: 'provider_not_found' });
    case 429:
      return new ProviderError(`Quota ou limite de débit atteint chez ${vendor}. Réessayez plus tard.${suffix}`, {
        status: 429,
        retryable: true,
        code: 'provider_quota',
      });
    default:
      return new ProviderError(`Le service ${vendor} est momentanément indisponible (HTTP ${response.status}).`, {
        status: 502,
        retryable: response.status >= 500,
        code: 'provider_unavailable',
      });
  }
}

export function networkError(error, vendor) {
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
    return new ProviderError(`Délai dépassé en attendant ${vendor}.`, { status: 504, retryable: true, code: 'provider_timeout' });
  }
  if (error instanceof ProviderError) return error;
  return new ProviderError(`Impossible de joindre ${vendor} (${error?.message || 'erreur réseau'}).`, {
    status: 502,
    retryable: true,
    code: 'provider_network',
  });
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
