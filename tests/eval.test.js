import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runEvaluation, SCENARIOS } from '../scripts/eval-assistant.js';
import { scriptedBrain, startMockLlm } from './helpers.js';

test('banc d’évaluation : les 9 scénarios passent avec un modèle qui suit les consignes', async (t) => {
  const mock = await startMockLlm(scriptedBrain);
  t.after(() => mock.close());
  const { results, score, total } = await runEvaluation({ overrides: { openai: { apiKey: 'sk-eval-secret', baseUrl: mock.url, chatModel: 'modele-test' } } });
  assert.equal(total, SCENARIOS.length);
  for (const r of results) assert.ok(r.checks.every((c) => c.ok), `${r.id}. ${r.name} : ${r.checks.filter((c) => !c.ok).map((c) => c.label).join(', ')}`);
  assert.equal(score, 9);
});

test('banc d’évaluation : un modèle qui ment ou désobéit est pénalisé', async (t) => {
  // A « bad » model: launches images for everything and claims they are ready.
  const bad = (body) => {
    const last = body.messages.at(-1);
    if (last.role === 'tool') return { role: 'assistant', content: 'Voilà, votre création est prête !' };
    return { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'generate_image', arguments: JSON.stringify({ prompt: 'n’importe quoi', aspect: '1:1' }) } }] };
  };
  const mock = await startMockLlm(bad);
  t.after(() => mock.close());
  const { results, score } = await runEvaluation({ overrides: { openai: { apiKey: 'sk-eval-secret', baseUrl: mock.url, chatModel: 'mauvais' } }, only: [2, 3, 4, 7] });
  assert.equal(score, 0);
  assert.ok(results.find((r) => r.id === 3).checks.some((c) => !c.ok && /aucune génération/.test(c.label)));
});

test('banc d’évaluation : assistant non configuré → échec explicite, pas de faux score', async () => {
  const { results, score } = await runEvaluation({ overrides: { openai: { apiKey: '', chatModel: '', textModel: '' }, ai: { provider: 'openai', model: '' } }, only: [1] });
  assert.equal(score, 0);
  assert.match(results[0].checks[0].label, /non configuré/);
});
