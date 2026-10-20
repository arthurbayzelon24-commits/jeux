import { ProviderError, networkError, providerHttpError } from '../providers/base.js';

/**
 * The « brain » of SOLVEX AI: an existing language model reached through the
 * Chat Completions protocol (OpenAI, or any server that speaks the same
 * protocol: Ollama, vLLM, LM Studio… for open models run on your own machine).
 * SOLVEX does not train a model; it connects one and gives it tools.
 *
 * A third adapter speaks the Anthropic Messages protocol (Claude models).
 *
 * Interface shared by every model adapter:
 *   complete({ messages, tools, signal, onDelta }) → { content, toolCalls, model }
 * `messages` and `tools` always use the Chat Completions shapes (system, user,
 * assistant with tool_calls, tool); an adapter translates them if its protocol
 * differs. A user message may carry content parts: { type: 'text' } and
 * { type: 'image_url', image_url: { url: 'data:image/…;base64,…' } }.
 * With `onDelta`, the answer is streamed and each text fragment is passed on.
 */

/** Reads a server-sent-events body line by line. */
async function readSseLines(response, handle, { signal, vendor }) {
  const decoder = new TextDecoder();
  let buffer = '';
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
}

async function post(fetchImpl, url, { headers, body, signal, vendor }) {
  let response;
  try {
    response = await fetchImpl(url, { method: 'POST', signal, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  } catch (error) {
    if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new ProviderError('Demande annulée.', { code: 'cancelled' });
    throw networkError(error, vendor);
  }
  if (!response.ok) throw await providerHttpError(response, vendor);
  return response;
}

function chatCompletionsModel({ id, label, vendor, baseUrl, apiKey, model, requiredEnv, configured }, { fetchImpl }) {
  async function complete({ messages, tools = [], signal, onDelta }) {
    const stream = typeof onDelta === 'function';
    const body = { model, messages, stream };
    if (tools.length) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }
    const response = await post(fetchImpl, `${baseUrl}/chat/completions`, { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}, body, signal, vendor });

    if (!stream) {
      const json = await response.json();
      const message = json?.choices?.[0]?.message;
      if (!message) throw new ProviderError('Le modèle n’a renvoyé aucune réponse.', { code: 'empty_result' });
      return { content: message.content || '', toolCalls: message.tool_calls || [], model: json.model || model };
    }

    // Server-sent events: « data: {chunk} » lines, then « data: [DONE] ».
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
    await readSseLines(response, handle, { signal, vendor });
    return { content, toolCalls: calls.filter(Boolean).map((c, i) => ({ ...c, id: c.id || `call_${i}` })), model: modelName };
  }

  return { id, label, vendor, model, configured, missing: configured ? [] : requiredEnv, streaming: true, complete };
}

// ---------------------------------------------------------------- Anthropic Messages (Claude)

const DATA_URL = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/;

function anthropicContent(content) {
  if (typeof content === 'string') return content;
  return (content || []).flatMap((part) => {
    if (part.type === 'text') return part.text ? [{ type: 'text', text: part.text }] : [];
    const match = part.type === 'image_url' && DATA_URL.exec(part.image_url?.url || '');
    return match ? [{ type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } }] : [];
  });
}

const parseArgs = (raw) => {
  try {
    const value = JSON.parse(raw || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
};

/** Chat Completions conversation → Anthropic { system, messages }. Consecutive tool results share one user turn. */
export function toAnthropicMessages(messages) {
  const system = [];
  const out = [];
  const push = (role, blocks) => {
    const last = out.at(-1);
    if (last?.role === role && Array.isArray(last.content) && Array.isArray(blocks)) last.content.push(...blocks);
    else out.push({ role, content: blocks });
  };
  for (const m of messages) {
    if (m.role === 'system') system.push(typeof m.content === 'string' ? m.content : '');
    else if (m.role === 'user') out.push({ role: 'user', content: anthropicContent(m.content) });
    else if (m.role === 'assistant') {
      const blocks = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const call of m.tool_calls || []) blocks.push({ type: 'tool_use', id: call.id, name: call.function?.name, input: parseArgs(call.function?.arguments) });
      out.push({ role: 'assistant', content: blocks.length ? blocks : [{ type: 'text', text: '…' }] });
    } else if (m.role === 'tool') push('user', [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: String(m.content ?? '') }]);
  }
  return { system: system.filter(Boolean).join('\n\n'), messages: out };
}

function anthropicModel({ baseUrl, apiKey, model, maxTokens, configured, requiredEnv }, { fetchImpl }) {
  const vendor = 'Anthropic';
  async function complete({ messages, tools = [], signal, onDelta }) {
    const stream = typeof onDelta === 'function';
    const { system, messages: turns } = toAnthropicMessages(messages);
    const body = { model, max_tokens: maxTokens, messages: turns, stream };
    if (system) body.system = system;
    if (tools.length) body.tools = tools.map((t) => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters }));
    const response = await post(fetchImpl, `${baseUrl}/messages`, { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body, signal, vendor });
    const toCall = (b) => ({ id: b.id, type: 'function', function: { name: b.name, arguments: typeof b.input === 'string' ? b.input : JSON.stringify(b.input || {}) } });

    if (!stream) {
      const json = await response.json();
      if (!Array.isArray(json?.content)) throw new ProviderError('Le modèle n’a renvoyé aucune réponse.', { code: 'empty_result' });
      const content = json.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      return { content, toolCalls: json.content.filter((b) => b.type === 'tool_use').map(toCall), model: json.model || model };
    }

    // Events: message_start, content_block_start/delta/stop, message_delta, message_stop, error.
    let content = '';
    let modelName = model;
    const blocks = [];
    const handle = (line) => {
      if (!line.startsWith('data:')) return;
      let event;
      try {
        event = JSON.parse(line.slice(5).trim());
      } catch {
        return;
      }
      if (event.type === 'error') throw new ProviderError(event.error?.message || 'Erreur du modèle pendant la réponse.', { code: 'provider_error', retryable: event.error?.type === 'overloaded_error' });
      if (event.type === 'message_start') modelName = event.message?.model || modelName;
      else if (event.type === 'content_block_start') blocks[event.index] = { ...event.content_block, input: '' };
      else if (event.type === 'content_block_delta') {
        const block = blocks[event.index];
        if (event.delta?.type === 'text_delta' && event.delta.text) {
          content += event.delta.text;
          onDelta(event.delta.text);
        } else if (event.delta?.type === 'input_json_delta' && block) block.input += event.delta.partial_json || '';
      }
    };
    await readSseLines(response, handle, { signal, vendor });
    const toolCalls = blocks.filter((b) => b?.type === 'tool_use').map((b) => toCall({ ...b, input: b.input || '{}' }));
    return { content, toolCalls, model: modelName };
  }
  return { id: 'anthropic', label: `Anthropic${model ? ` · ${model}` : ''}`, vendor, model, configured, missing: configured ? [] : requiredEnv, streaming: true, complete };
}

/** The configured language model (see AI_PROVIDER in .env.example). */
export function createLanguageModel(config, { fetchImpl = fetch } = {}) {
  const ai = config.ai;
  const vision = ai.vision ?? ai.provider !== 'openai-compatible';
  return { ...pickModel(config, ai, fetchImpl), vision };
}

function pickModel(config, ai, fetchImpl) {
  if (ai.provider === 'anthropic') {
    const apiKey = ai.apiKey || config.anthropic.apiKey;
    return anthropicModel(
      {
        baseUrl: (ai.baseUrl || config.anthropic.baseUrl).replace(/\/$/, ''),
        apiKey,
        model: ai.model,
        maxTokens: ai.maxTokens,
        configured: Boolean(apiKey && ai.model),
        requiredEnv: ['ANTHROPIC_API_KEY', 'AI_MODEL'].filter((k) => !(k === 'AI_MODEL' ? ai.model : apiKey)),
      },
      { fetchImpl },
    );
  }
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
