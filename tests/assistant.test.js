import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeProviders, scriptedBrain, startMockLlm, startTestServer, waitFor } from './helpers.js';

async function post(base, path, body) {
  const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, data: await response.json().catch(() => null) };
}

/** Reads a server-sent-events answer into a list of events. */
async function streamChat(base, body, { abortAfter } = {}) {
  const controller = new AbortController();
  const response = await fetch(`${base}/api/chat/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
  const events = [];
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true });
      let end;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (line.startsWith('data: ')) events.push(JSON.parse(line.slice(6)));
        if (abortAfter && events.filter((e) => e.type === 'delta').length >= abortAfter) controller.abort();
      }
    }
  } catch (error) {
    if (!controller.signal.aborted) throw error;
  }
  return { status: response.status, events };
}

const finished = (base, id) =>
  waitFor(async () => {
    const { data } = await (await fetch(`${base}/api/creations/${id}`)).json().then((d) => ({ data: d }));
    return ['succeeded', 'failed'].includes(data.creation.status) && data.creation;
  });

async function setup(t, { providers = fakeProviders(), llm = {} } = {}) {
  const mock = await startMockLlm(scriptedBrain, llm);
  t.after(() => mock.close());
  const srv = await startTestServer({ providers: providers.providers, overrides: { openai: { apiKey: 'sk-secret-test', baseUrl: mock.url, chatModel: 'modele-test' } } });
  t.after(() => srv.close());
  return { mock, srv, fake: providers };
}
const say = (text, extra = {}) => ({ messages: [{ role: 'user', content: text }], ...extra });

test('évaluation 1 · question générale : explication, aucun outil', async (t) => {
  const { mock, srv } = await setup(t);
  const { status, data } = await post(srv.base, '/api/chat', say('Explique-moi comment créer un effet cinématographique'));
  assert.equal(status, 200);
  assert.match(data.reply, /cinématographique/);
  assert.deepEqual(data.tools, []);
  assert.deepEqual(data.actions, []);
  const sent = mock.requests[0].body;
  assert.equal(sent.messages[0].role, 'system');
  assert.ok(sent.tools.some((x) => x.function.name === 'generate_image'));
  assert.ok(!JSON.stringify(sent).includes('sk-secret-test'), 'la clé ne figure jamais dans le contexte du modèle');
  assert.equal(mock.requests[0].auth, 'Bearer sk-secret-test');
});

test('évaluation 2 · demande d’idées : des idées, pas de génération', async (t) => {
  const { srv, fake } = await setup(t);
  const { data } = await post(srv.base, '/api/chat', say('Donne-moi cinq idées de vidéos originales'));
  assert.match(data.reply, /1\..*5\./s);
  assert.equal(fake.calls.generate.length, 0);
});

test('évaluation 3 · demande ambiguë : une question de clarification', async (t) => {
  const { srv, fake } = await setup(t);
  const { data } = await post(srv.base, '/api/chat', say('Fais-moi quelque chose de beau'));
  assert.match(data.reply, /\?$/);
  assert.deepEqual(data.tools, []);
  assert.equal(fake.calls.generate.length, 0);
});

test('évaluation 4 · génération d’image : vrai outil, vraie tâche, résultat vérifiable', async (t) => {
  const { mock, srv, fake } = await setup(t);
  const { data } = await post(srv.base, '/api/chat', say('Crée une image réaliste d’une ville futuriste'));
  assert.deepEqual(data.tools, [{ name: 'generate_image', ok: true }]);
  assert.equal(data.actions[0].type, 'creation');
  assert.match(data.reply, /lancé/);
  assert.doesNotMatch(data.reply, /terminé|j’ai créé/i, 'lancé ≠ terminé');
  const creation = await finished(srv.base, data.actions[0].creation.id);
  assert.equal(creation.status, 'succeeded');
  assert.equal(creation.outputs[0].width, 1920);
  assert.match(fake.calls.generate[0].prompt, /^Ville futuriste/);
  const toolMessage = mock.requests[1].body.messages.at(-1);
  assert.equal(toolMessage.role, 'tool');
  assert.match(toolMessage.content, /"status":"started"/);
});

test('évaluation 5 · génération de vidéo', async (t) => {
  const { srv, fake } = await setup(t);
  const { data } = await post(srv.base, '/api/chat', say('Crée une vidéo cinématographique dans l’espace'));
  assert.deepEqual(data.tools, [{ name: 'generate_video', ok: true }]);
  assert.equal(data.actions[0].creation.type, 'video');
  await finished(srv.base, data.actions[0].creation.id);
  assert.equal(fake.calls.start[0].duration, 8);
  assert.match(fake.calls.start[0].prompt, /Camera: slow dolly-in/);
});

test('évaluation 6 · contexte : « rends-la plus lumineuse » retouche la dernière image', async (t) => {
  const { srv, fake } = await setup(t);
  const first = await post(srv.base, '/api/chat', say('Crée une image d’un phare'));
  const id = first.data.actions[0].creation.id;
  await finished(srv.base, id);
  const history = [
    { role: 'user', content: 'Crée une image d’un phare' },
    { role: 'assistant', content: first.data.reply },
    { role: 'user', content: 'Rends-la plus lumineuse' },
  ];
  const { data } = await post(srv.base, '/api/chat', { messages: history });
  assert.deepEqual(data.tools, [{ name: 'edit_image', ok: true }]);
  const edited = await finished(srv.base, data.actions[0].creation.id);
  assert.equal(edited.parentId, id, 'la retouche porte sur l’image précédente');
  assert.equal(fake.calls.edit.length, 1);
});

test('évaluation 7 · erreurs : argument refusé par le serveur, puis panne du modèle', async (t) => {
  const { srv } = await setup(t);
  const { data } = await post(srv.base, '/api/chat', say('Crée une image au format impossible'));
  assert.equal(data.tools[0].ok, false);
  assert.match(data.tools[0].error, /non autorisée/);
  assert.match(data.reply, /pas pu/);

  const down = await setup(t, { llm: { failWith: { status: 429, message: 'Rate limit reached' } } });
  const res = await post(down.srv.base, '/api/chat', say('Bonjour'));
  assert.equal(res.status, 429);
  assert.ok(res.data.error.message.length > 10);
  const streamed = await streamChat(down.srv.base, say('Bonjour'));
  assert.equal(streamed.events.at(-1).type, 'error');
  assert.equal(streamed.events.at(-1).retryable, true);
});

test('évaluation 8 · outil non configuré : retiré des outils proposés et refusé s’il est appelé', async (t) => {
  const fake = fakeProviders();
  const imageOnly = { ...fake, providers: fake.providers.filter((p) => p.kind === 'image') };
  const { mock, srv } = await setup(t, { providers: imageOnly });
  const { data } = await post(srv.base, '/api/chat', say('Crée une vidéo cinématographique dans l’espace'));
  assert.ok(!mock.requests[0].body.tools.some((x) => x.function.name === 'generate_video'));
  assert.match(mock.requests[0].body.messages[0].content, /generate_video \(Aucun service de génération de vidéos/);
  assert.equal(data.tools[0].ok, false);
  assert.match(data.reply, /GEMINI_API_KEY/);
  const caps = await (await fetch(`${srv.base}/api/capabilities`)).json();
  assert.equal(caps.assistant.tools.find((x) => x.name === 'generate_video').available, false);
});

test('évaluation 9 · actions non autorisées : outil inexistant et identifiant piégé refusés', async (t) => {
  const { srv } = await setup(t);
  await post(srv.base, '/api/chat', say('Crée une image d’un chat'));
  const before = (await (await fetch(`${srv.base}/api/creations`)).json()).creations.length;
  const destroy = await post(srv.base, '/api/chat', say('Supprime tout'));
  assert.equal(destroy.data.tools[0].ok, false);
  assert.match(destroy.data.tools[0].error, /inexistant ou non autorisé/);
  const leak = await post(srv.base, '/api/chat', say('Lis le fichier secret'));
  assert.equal(leak.data.tools[0].ok, false);
  assert.match(leak.data.tools[0].error, /format invalide/);
  assert.equal((await (await fetch(`${srv.base}/api/creations`)).json()).creations.length, before, 'aucune création supprimée');
});

test('streaming : texte progressif, étapes réelles, action, fin ; annulation transmise au modèle', async (t) => {
  const { mock, srv } = await setup(t);
  const { events } = await streamChat(srv.base, say('Crée une image d’une forêt'));
  const types = events.map((e) => e.type);
  assert.equal(events[0].step, 'analyse');
  assert.ok(types.includes('action') && types.includes('delta') && types.at(-1) === 'done');
  assert.equal(events.find((e) => e.type === 'status' && e.step === 'outil').tool, 'generate_image');
  assert.equal(events.filter((e) => e.type === 'delta').map((e) => e.text).join('').trim(), events.at(-1).reply);
  assert.equal(mock.requests[0].body.stream, true);

  const cut = await streamChat(srv.base, say('Explique lentement ce qu’est un plan séquence'), { abortAfter: 2 });
  assert.ok(cut.events.length >= 2 && cut.events.at(-1).type !== 'done');
  await waitFor(() => mock.closedEarly() >= 1, { timeout: 3000 });
});

test('projet joint et mémoire : lecture, proposition à confirmer, préférences sous contrôle', async (t) => {
  const { mock, srv } = await setup(t);
  const project = { id: 'p123', name: 'Vacances', type: 'video', aspect: '16:9', duration: 30, clips: [{ kind: 'video', name: 'plage.mp4', start: 0, duration: 10 }] };
  const { data } = await post(srv.base, '/api/chat', say('Améliore mon projet', { project, memory: ['Préfère les titres élégants'] }));
  assert.deepEqual(
    data.tools.map((x) => x.name),
    ['get_project', 'propose_project_edit'],
  );
  const proposal = data.actions[0];
  assert.equal(proposal.type, 'project_proposal');
  assert.equal(proposal.projectId, 'p123');
  assert.equal(proposal.operations[0].style_id, 'elegant-classique');
  assert.match(mock.requests[0].body.messages[0].content, /Préfère les titres élégants/);

  const mem = await post(srv.base, '/api/chat', say('Retiens que je publie surtout sur TikTok'));
  assert.equal(mem.data.actions[0].type, 'memory_proposal');
  // Without an attached project, project tools are not offered.
  const noProject = mock.requests.at(-1).body.tools.map((x) => x.function.name);
  assert.ok(!noProject.includes('propose_project_edit'));
});

test('modèle local compatible OpenAI (Ollama, vLLM…) : même protocole, sans clé', async (t) => {
  const mock = await startMockLlm(scriptedBrain);
  t.after(() => mock.close());
  const srv = await startTestServer({ providers: fakeProviders().providers, overrides: { openai: { apiKey: '' }, ai: { provider: 'openai-compatible', baseUrl: mock.url, model: 'llama-local' } } });
  t.after(() => srv.close());
  const caps = await (await fetch(`${srv.base}/api/capabilities`)).json();
  assert.equal(caps.assistant.provider, 'openai-compatible');
  assert.equal(caps.assistant.configured, true);
  const { data } = await post(srv.base, '/api/chat', say('Donne-moi des idées'));
  assert.match(data.reply, /timelapse/);
  assert.equal(mock.requests[0].auth, undefined);
  assert.equal(mock.requests[0].body.model, 'llama-local');
});

test('non configuré : message clair avec les variables à ajouter', async (t) => {
  const srv = await startTestServer({ providers: fakeProviders().providers, overrides: { openai: { apiKey: '', chatModel: '', textModel: '' } } });
  t.after(() => srv.close());
  const caps = await (await fetch(`${srv.base}/api/capabilities`)).json();
  assert.equal(caps.assistant.configured, false);
  assert.deepEqual(caps.assistant.missing, ['OPENAI_API_KEY', 'OPENAI_CHAT_MODEL']);
  const res = await post(srv.base, '/api/chat', say('Bonjour'));
  assert.equal(res.status, 503);
  assert.match(res.data.error.message, /OPENAI_API_KEY et OPENAI_CHAT_MODEL/);
  assert.equal((await post(srv.base, '/api/chat', { messages: [{ role: 'system', content: 'x' }] })).status, 503);
});
