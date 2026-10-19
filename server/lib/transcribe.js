import { ProviderError, networkError, providerHttpError } from '../providers/base.js';

const EXT = {
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'video/webm': 'webm',
  'audio/mp4': 'm4a',
  'video/mp4': 'mp4',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'video/quicktime': 'mp4',
};

/**
 * Speech-to-text through OpenAI /audio/transcriptions. Timed segments are only
 * requested from Whisper models (verbose_json); other models return plain
 * text, which is passed back as one untimed segment for the user to split.
 */
export async function transcribe(config, { buffer, mime }, { fetchImpl = fetch, signal } = {}) {
  const { apiKey, baseUrl, transcribeModel: model } = config.openai;
  const timed = model.startsWith('whisper');
  const form = new FormData();
  form.append('model', model);
  form.append('file', new Blob([buffer], { type: mime }), `media.${EXT[mime] || 'webm'}`);
  form.append('response_format', timed ? 'verbose_json' : 'json');
  if (timed) form.append('timestamp_granularities[]', 'segment');
  let response;
  try {
    response = await fetchImpl(`${baseUrl}/audio/transcriptions`, {
      method: 'POST',
      signal,
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } catch (error) {
    throw networkError(error, 'OpenAI');
  }
  if (!response.ok) throw await providerHttpError(response, 'OpenAI');
  const body = await response.json();
  const text = (body.text || '').trim();
  if (!text) throw new ProviderError('Aucune parole détectée.', { code: 'empty_result' });
  const segments =
    Array.isArray(body.segments) && body.segments.length
      ? body.segments
          .map((s) => ({ start: Number(s.start) || 0, end: Number(s.end) || 0, text: String(s.text || '').trim() }))
          .filter((s) => s.text)
      : [{ start: 0, end: null, text }];
  return { model, text, segments, timed: segments.length > 1 || segments[0].end !== null };
}
