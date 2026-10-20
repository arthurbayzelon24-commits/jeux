import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { toAnthropicMessages } from '../server/ai/llm.js';
import { fakeProviders, makePng, scriptedBrain, startMockLlm, startTestServer } from './helpers.js';

/**
 * Local stand-in for the Anthropic Messages API (streamed events). The
 * « model » asks for generate_image on an image request, then answers in text
 * once it reads the tool result.
 */
async function startMockAnthropic() {
  const requests = [];
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    requests.push({ headers: req.headers, body });
    const last = body.messages.at(-1);
    const toolResult = Array.isArray(last.content) && last.content.find((b) => b.type === 'tool_result');
    const userText = typeof last.content === 'string' ? last.content : (last.content.find((b) => b.type === 'text')?.text ?? '');
    const events = [{ type: 'message_start', message: { model: body.model } }];
    if (!toolResult && /image/i.test(userText)) {
      const input = JSON.stringify({ prompt: 'Phare sous un ciel étoilé', aspect: '16:9', resolution: '1080p' });
      events.push(
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Je lance la génération. ' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'toolu_1', name: 'generate_image', input: {} } },
        { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: input.slice(0, 15) } },
        { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: input.slice(15) } },
        { type: 'content_block_stop', index: 1 },
      );
    } else {
      const text = toolResult ? `C’est lancé (${JSON.parse(toolResult.content).status}).` : 'Bonjour, que voulez-vous créer ?';
      events.push(
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: text.slice(0, 8) } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: text.slice(8) } },
        { type: 'content_block_stop', index: 0 },
      );
    }
    events.push({ type: 'message_delta', delta: { stop_reason: 'end_turn' } }, { type: 'message_stop' });
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    for (const event of events) res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    res.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}/v1`, requests, close: () => server.close() };
}

async function streamEvents(base, body) {
  const response = await fetch(`${base}/api/chat/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const text = await response.text();
  return text
    .split('\n\n')
    .filter((l) => l.startsWith('data: '))
    .map((l) => JSON.parse(l.slice(6)));
}

const post = async (base, path, body) => {
  const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, data: await response.json().catch(() => null) };
};

test('toAnthropicMessages : system à part, appels d’outils, résultats regroupés, images en base64', () => {
  const png = makePng(16, 16).toString('base64');
  const { system, messages } = toAnthropicMessages([
    { role: 'system', content: 'Consignes' },
    { role: 'user', content: [{ type: 'text', text: 'Regarde' }, { type: 'image_url', image_url: { url: `data:image/png;base64,${png}` } }, { type: 'image_url', image_url: { url: 'https://exemple.test/x.png' } }] },
    { role: 'assistant', content: null, tool_calls: [{ id: 'a', type: 'function', function: { name: 'x', arguments: '{"k":1}' } }, { id: 'b', type: 'function', function: { name: 'y', arguments: 'pas du json' } }] },
    { role: 'tool', tool_call_id: 'a', content: '{"ok":true}' },
    { role: 'tool', tool_call_id: 'b', content: '{"ok":false}' },
  ]);
  assert.equal(system, 'Consignes');
  assert.equal(messages.length, 3);
  assert.deepEqual(messages[0].content[1], { type: 'image', source: { type: 'base64', media_type: 'image/png', data: png } });
  assert.equal(messages[0].content.length, 2, 'une URL distante n’est jamais transmise');
  assert.deepEqual(messages[1].content[0], { type: 'tool_use', id: 'a', name: 'x', input: { k: 1 } });
  assert.deepEqual(messages[1].content[1].input, {}, 'arguments illisibles → objet vide');
  assert.equal(messages[2].role, 'user');
  assert.deepEqual(messages[2].content.map((b) => b.tool_use_id), ['a', 'b']);
});

test('Anthropic (Claude) : flux, outil validé et exécuté, clé dans l’en-tête seulement', async (t) => {
  const mock = await startMockAnthropic();
  t.after(() => mock.close());
  const fake = fakeProviders();
  const srv = await startTestServer({ providers: fake.providers, overrides: { ai: { provider: 'anthropic', model: 'claude-test', baseUrl: mock.url }, anthropic: { apiKey: 'sk-ant-secret' } } });
  t.after(() => srv.close());

  const caps = await (await fetch(`${srv.base}/api/capabilities`)).json();
  assert.equal(caps.assistant.provider, 'anthropic');
  assert.equal(caps.assistant.configured, true);
  assert.equal(caps.assistant.vision, true);

  const events = await streamEvents(srv.base, { messages: [{ role: 'user', content: 'Crée une image d’un phare' }] });
  const done = events.at(-1);
  assert.equal(done.type, 'done', JSON.stringify(done));
  assert.equal(done.model, 'claude-test');
  assert.deepEqual(done.tools, [{ name: 'generate_image', ok: true }]);
  assert.equal(done.actions[0].type, 'creation');
  assert.match(done.reply, /Je lance la génération\.[\s\S]*C’est lancé \(started\)/);
  assert.ok(events.some((e) => e.type === 'delta'));

  const [first, second] = mock.requests;
  assert.equal(first.headers['x-api-key'], 'sk-ant-secret');
  assert.equal(first.headers['anthropic-version'], '2023-06-01');
  assert.equal(first.body.stream, true);
  assert.equal(first.body.max_tokens, 4096);
  assert.match(first.body.system, /SOLVEX AI/);
  assert.ok(first.body.messages.every((m) => m.role !== 'system'));
  assert.ok(first.body.tools.find((x) => x.name === 'generate_image').input_schema);
  assert.ok(!JSON.stringify(first.body).includes('sk-ant-secret'));
  assert.equal(second.body.messages.at(-2).content.at(-1).type, 'tool_use');
  assert.equal(second.body.messages.at(-1).content[0].tool_use_id, 'toolu_1');
});

test('Anthropic non configuré : variables manquantes nommées', async (t) => {
  const srv = await startTestServer({ providers: fakeProviders().providers, overrides: { ai: { provider: 'anthropic', model: '' }, anthropic: { apiKey: '' } } });
  t.after(() => srv.close());
  const { status, data } = await post(srv.base, '/api/chat', { messages: [{ role: 'user', content: 'Bonjour' }] });
  assert.equal(status, 503);
  assert.match(data.error.message, /ANTHROPIC_API_KEY et AI_MODEL/);
});

test('images jointes : envoyées au modèle en data URL, expirées ou non prises en charge refusées', async (t) => {
  const mock = await startMockLlm(scriptedBrain);
  t.after(() => mock.close());
  const srv = await startTestServer({ providers: fakeProviders().providers, overrides: { openai: { apiKey: 'sk-test', baseUrl: mock.url, chatModel: 'vision-test' } } });
  t.after(() => srv.close());

  const upload = await (await fetch(`${srv.base}/api/uploads`, { method: 'POST', body: makePng(40, 40) })).json();
  const ok = await post(srv.base, '/api/chat', { messages: [{ role: 'user', content: 'Décris cette photo', images: [upload.id] }] });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  const sent = mock.requests[0].body.messages.at(-1).content;
  assert.equal(sent[0].text, 'Décris cette photo');
  assert.match(sent[1].image_url.url, /^data:image\/png;base64,iVBOR/);

  const expired = await post(srv.base, '/api/chat', { messages: [{ role: 'user', content: 'Et celle-ci ?', images: ['inconnu-123'] }] });
  assert.equal(expired.status, 400);
  assert.equal(expired.data.error.code, 'upload_expired');

  const tooMany = await post(srv.base, '/api/chat', { messages: [{ role: 'user', content: 'x', images: ['a', 'b', 'c', 'd', 'e'] }] });
  assert.equal(tooMany.status, 400);

  const local = await startTestServer({ providers: fakeProviders().providers, overrides: { ai: { provider: 'openai-compatible', baseUrl: mock.url, model: 'texte-seul' } } });
  t.after(() => local.close());
  const caps = await (await fetch(`${local.base}/api/capabilities`)).json();
  assert.equal(caps.assistant.vision, false);
  const refused = await post(local.base, '/api/chat', { messages: [{ role: 'user', content: 'Regarde', images: [upload.id] }] });
  assert.equal(refused.status, 400);
  assert.match(refused.data.error.message, /AI_VISION/);
});
