import { ProviderError, networkError, providerHttpError } from '../providers/base.js';

/**
 * The « brain » of SOLVEX AI: an existing language model reached through the
 * Chat Completions protocol (OpenAI, or any server that speaks the same
 * protocol: Ollama, vLLM, LM Studio… for open models run on your own machine).
 * SOLVEX does not train a model; it connects one and gives it tools.
 *
 * Interface shared by every model adapter:
 *   complete({ messages, tools, signal, onDelta }) → { content, toolCalls, model }
 * With `onDelta`, the answer is streamed and each text fragment is passed on.
 */

function chatCompletionsModel({ id, label, vendor, baseUrl, apiKey, model, requiredEnv, configured }, { fetchImpl }) {
  async function complete({ messages, tools = [], signal, onDelta }) {
    const stream = typeof onDelta === 'function';
    const body = { model, messages, stream };
    if (tools.length) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }
    let response;
    try {
      response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify(body),
      });
    } catch (error) {
      if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new ProviderError('Demande annulée.', { code: 'cancelled' });
      throw networkError(error, vendor);
    }
    if (!response.ok) throw await providerHttpError(response, vendor);

    if (!stream) {
      const json = await response.json();
      const message = json?.choices?.[0]?.message;
      if (!message) throw new ProviderError('Le modèle n’a renvoyé aucune réponse.', { code: 'empty_result' });
      return { content: message.content || '', toolCalls: message.tool_calls || [], model: json.model || model };
    }

    // Server-sent events: « data: {chunk} » lines, then « data: [DONE] ».
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let modelName = model;
    const calls = [];
    const handle = (line) => {
      if (!line.startsWith('data:')) return;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') return;
      let chunk;
      try {
        chunk = JSON.parse(data);
      } catch {
        return;
      }
      if (chunk.error) throw new ProviderError(chunk.error.message || 'Erreur du modèle pendant la réponse.', { code: 'provider_error' });
      modelName = chunk.model || modelName;
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) return;
      if (delta.content) {
        content += delta.content;
        onDelta(delta.content);
      }
      for (const part of delta.tool_calls || []) {
        const slot = (calls[part.index ?? calls.length] ??= { id: '', type: 'function', function: { name: '', arguments: '' } });
        if (part.id) slot.id = part.id;
        if (part.function?.name) slot.function.name += part.function.name;
        if (part.function?.arguments) slot.function.arguments += part.function.arguments;
      }
    };
    try {
      for await (const bytes of response.body) {
        buffer += decoder.decode(bytes, { stream: true });
        let end;
        while ((end = buffer.indexOf('\n')) >= 0) {
          handle(buffer.slice(0, end).trim());
          buffer = buffer.slice(end + 1);
        }
      }
      if (buffer.trim()) handle(buffer.trim());
    } catch (error) {
      if (signal?.aborted) throw new ProviderError('Demande annulée.', { code: 'cancelled' });
      if (error instanceof ProviderError) throw error;
      throw networkError(error, vendor);
    }
    return { content, toolCalls: calls.filter(Boolean).map((c, i) => ({ ...c, id: c.id || `call_${i}` })), model: modelName };
  }

  return { id, label, vendor, model, configured, missing: configured ? [] : requiredEnv, streaming: true, complete };
}

/** The configured language model (see AI_PROVIDER in .env.example). */
export function createLanguageModel(config, { fetchImpl = fetch } = {}) {
  const ai = config.ai;
  if (ai.provider === 'openai-compatible') {
    return chatCompletionsModel(
      {
        id: 'openai-compatible',
        label: `Modèle local / compatible OpenAI${ai.model ? ` · ${ai.model}` : ''}`,
        vendor: 'Serveur de modèle',
        baseUrl: (ai.baseUrl || '').replace(/\/$/, ''),
        apiKey: ai.apiKey,
        model: ai.model,
        configured: Boolean(ai.baseUrl && ai.model),
        requiredEnv: ['AI_BASE_URL', 'AI_MODEL'].filter((k) => !(k === 'AI_BASE_URL' ? ai.baseUrl : ai.model)),
      },
      { fetchImpl },
    );
  }
  const model = ai.model || config.openai.chatModel || config.openai.textModel || '';
  return chatCompletionsModel(
    {
      id: 'openai',
      label: `OpenAI${model ? ` · ${model}` : ''}`,
      vendor: 'OpenAI',
      baseUrl: config.openai.baseUrl,
      apiKey: config.openai.apiKey,
      model,
      configured: Boolean(config.openai.apiKey && model),
      requiredEnv: ['OPENAI_API_KEY', 'OPENAI_CHAT_MODEL'].filter((k) => !(k === 'OPENAI_API_KEY' ? config.openai.apiKey : model)),
    },
    { fetchImpl },
  );
}
