import { isStatic } from './env.js';

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'error', details, retryable = false } = {}) {
    super(message);
    this.retryable = retryable;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const listeners = new Set();
/** Subscribe to connectivity changes: fn(online: boolean) */
export function onConnectivity(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify(online) {
  for (const fn of listeners) fn(online);
}

async function request(path, { method = 'GET', body, headers = {}, signal, timeout = 30_000 } = {}) {
  if (isStatic()) {
    throw new ApiError(
      'Fonction indisponible dans la version publique : elle nécessite le serveur SOLVEX (voir le README pour le lancer).',
      { code: 'static' },
    );
  }
  const init = { method, headers: { ...headers }, credentials: 'same-origin' };
  if (body instanceof Blob || body instanceof ArrayBuffer) {
    init.body = body;
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const timeoutSignal = AbortSignal.timeout(timeout);
  init.signal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  let response;
  try {
    response = await fetch(path, init);
  } catch (error) {
    if (signal?.aborted) throw error;
    notify(false);
    const message = timeoutSignal.aborted
      ? 'Le serveur met trop de temps à répondre. Vérifiez votre connexion puis réessayez.'
      : 'Impossible de joindre le serveur SOLVEX. Vérifiez votre connexion.';
    throw new ApiError(message, { code: 'network' });
  }
  notify(true);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = data?.error || {};
    if (response.status === 401 && error.code === 'auth_required') window.dispatchEvent(new CustomEvent('solvex:auth-required'));
    throw new ApiError(error.message || `Erreur ${response.status}`, { status: response.status, code: error.code, details: error.details });
  }
  return data;
}

export const api = {
  session: () => request('/api/session'),
  login: (code) => request('/api/session', { method: 'POST', body: { code } }),
  capabilities: () => request('/api/capabilities'),
  enhancePrompt: (payload) => request('/api/prompt/enhance', { method: 'POST', body: payload, timeout: 40_000 }),
  upload: (file, { signal } = {}) =>
    request('/api/uploads', {
      method: 'POST',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      signal,
      timeout: 120_000,
    }),
  generateImage: (payload) => request('/api/images/generate', { method: 'POST', body: payload }),
  editImage: (payload) => request('/api/images/edit', { method: 'POST', body: payload }),
  generateVideo: (payload) => request('/api/videos/generate', { method: 'POST', body: payload }),
  audioSearch: ({ source, q = '', category = '' }) => request(`/api/audio/search?${new URLSearchParams({ source, q, category })}`, { timeout: 25_000 }),
  chat: (body, signal) => request('/api/chat', { method: 'POST', body, signal, timeout: 130_000 }),
  /** Streamed assistant turn: calls onEvent for each server-sent event; resolves with the final « done » event. */
  async chatStream(body, { signal, onEvent }) {
    if (isStatic()) throw new ApiError('L’assistant nécessite le serveur SOLVEX.', { code: 'static' });
    let response;
    try {
      response = await fetch('/api/chat/stream', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    } catch (error) {
      if (signal?.aborted) throw new ApiError('Réponse arrêtée.', { code: 'cancelled' });
      notify(false);
      throw new ApiError('Impossible de joindre le serveur SOLVEX. Vérifiez votre connexion.', { code: 'network' });
    }
    notify(true);
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      if (response.status === 401 && data?.error?.code === 'auth_required') window.dispatchEvent(new CustomEvent('solvex:auth-required'));
      throw new ApiError(data?.error?.message || `Erreur ${response.status}`, { status: response.status, code: data?.error?.code });
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let final = null;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let end;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const line = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          if (!line.startsWith('data: ')) continue;
          const event = JSON.parse(line.slice(6));
          if (event.type === 'error') throw new ApiError(event.message, { code: event.code, retryable: event.retryable });
          if (event.type === 'done') final = event;
          else onEvent(event);
        }
      }
    } catch (error) {
      if (signal?.aborted) throw new ApiError('Réponse arrêtée.', { code: 'cancelled' });
      throw error;
    }
    if (!final) throw new ApiError('La réponse a été interrompue avant la fin. Réessayez.', { code: 'interrupted' });
    return final;
  },
  creations: ({ type, sort } = {}) => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (sort) params.set('sort', sort);
    return request(`/api/creations?${params}`);
  },
  creation: (id, { signal } = {}) => request(`/api/creations/${encodeURIComponent(id)}`, { signal }),
  retry: (id) => request(`/api/creations/${encodeURIComponent(id)}/retry`, { method: 'POST' }),
  remove: (id) => request(`/api/creations/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  saveLocal: (payload) => request('/api/creations/local', { method: 'POST', body: payload }),
  transcribe: (blob) =>
    request('/api/transcribe', {
      method: 'POST',
      body: blob,
      headers: { 'Content-Type': blob.type || 'application/octet-stream' },
      timeout: 300_000,
    }),
};

/**
 * Polls a creation until it reaches a final state. Calls onUpdate with each
 * fresh server snapshot; tolerates transient network failures.
 */
export async function watchCreation(id, { onUpdate, signal, interval = 2500 }) {
  let failures = 0;
  for (;;) {
    if (signal?.aborted) return null;
    try {
      const { creation } = await api.creation(id, { signal });
      failures = 0;
      onUpdate(creation);
      if (creation.status === 'succeeded' || creation.status === 'failed') return creation;
    } catch (error) {
      if (signal?.aborted) return null;
      if (error.status === 404) throw error;
      failures += 1;
      if (failures >= 8) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(interval * (1 + failures), 15_000)));
  }
}
