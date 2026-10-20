import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInline, parseMarkdown } from '../public/js/lib/markdown.js';
import { autoTitle, createConversationStore, DEFAULT_TITLE } from '../public/js/lib/conversations.js';

function memoryStorage({ quota = Infinity } = {}) {
  const data = new Map();
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => {
      if (String(v).length > quota) throw new Error('QuotaExceededError');
      data.set(k, String(v));
    },
    removeItem: (k) => data.delete(k),
  };
}

test('markdown : blocs de code, titres, listes, citations, paragraphes', () => {
  const blocks = parseMarkdown('# Plan\n\nIntro **forte** et `code`.\n\n- un\n- deux\n  suite\n\n1. a\n2. b\n\n> note\n\n```js\nconst x = 1;\n```');
  assert.deepEqual(blocks.map((b) => b.type), ['heading', 'paragraph', 'list', 'list', 'quote', 'code']);
  assert.equal(blocks[0].level, 1);
  assert.deepEqual(blocks[1].inlines.map((i) => i.type), ['text', 'strong', 'text', 'code', 'text']);
  assert.equal(blocks[2].ordered, false);
  assert.equal(blocks[2].items.length, 2);
  assert.match(blocks[2].items[1].map((i) => i.text).join(''), /deux suite/);
  assert.equal(blocks[3].ordered, true);
  assert.deepEqual(blocks[5], { type: 'code', lang: 'js', text: 'const x = 1;' });
});

test('markdown : bloc de code non fermé (réponse en cours) et liens sûrs uniquement', () => {
  const streaming = parseMarkdown('Voici :\n```\nligne 1\nligne 2');
  assert.equal(streaming.at(-1).type, 'code');
  assert.equal(streaming.at(-1).text, 'ligne 1\nligne 2');
  const links = parseInline('[doc](https://exemple.test/a) et [piège](javascript:alert(1)) puis https://solvex.test/page.');
  assert.deepEqual(links.filter((p) => p.type === 'link').map((p) => p.href), ['https://exemple.test/a', 'https://solvex.test/page']);
  assert.ok(links.some((p) => p.type === 'text' && p.text.includes('javascript:')), 'un lien javascript: reste du texte');
  assert.deepEqual(parseMarkdown('<img src=x onerror=alert(1)>')[0].inlines, [{ type: 'text', text: '<img src=x onerror=alert(1)>' }]);
});

test('conversations : création, titre automatique, renommage, suppression, persistance', () => {
  const storage = memoryStorage();
  let clock = 0;
  const now = () => new Date(Date.UTC(2026, 0, 1, 0, 0, clock++)).toISOString();
  const store = createConversationStore({ storage, now });
  const first = store.active();
  assert.equal(first.title, DEFAULT_TITLE);
  store.save(first.id, [{ role: 'user', content: 'Prépare un script vidéo\nsur le café' }, { role: 'assistant', content: 'Voici…' }]);
  assert.equal(store.get(first.id).title, 'Prépare un script vidéo');
  const second = store.create();
  assert.equal(store.active().id, second.id);
  assert.ok(store.rename(first.id, '  Script   café  '));
  store.save(first.id, [{ role: 'user', content: 'Autre chose' }]);
  assert.equal(store.get(first.id).title, 'Script café', 'un titre choisi n’est plus remplacé');
  assert.equal(store.rename(first.id, '   '), false);
  assert.deepEqual(store.list().map((c) => c.id), [first.id, second.id], 'la plus récente en premier');

  const reloaded = createConversationStore({ storage, now });
  assert.equal(reloaded.list().length, 2);
  assert.equal(reloaded.active().id, second.id);
  reloaded.remove(second.id);
  assert.equal(reloaded.active().id, first.id);
  assert.equal(createConversationStore({ storage, now }).list().length, 1);
});

test('conversations : reprise de l’ancienne conversation unique et stockage plein', () => {
  const storage = memoryStorage();
  storage.setItem('solvex:chat', JSON.stringify([{ role: 'user', content: 'Ancienne question' }]));
  const store = createConversationStore({ storage });
  assert.equal(store.list().length, 1);
  assert.equal(store.active().title, 'Ancienne question');
  store.save(store.active().id, store.active().messages);
  assert.equal(storage.getItem('solvex:chat'), null, 'l’ancien format est retiré après migration');

  const tight = memoryStorage({ quota: 900 });
  const s2 = createConversationStore({ storage: tight });
  const old = s2.create();
  s2.save(old.id, [{ role: 'user', content: 'a'.repeat(300) }]);
  const current = s2.create();
  assert.equal(s2.save(current.id, [{ role: 'user', content: 'b'.repeat(400) }]), true);
  assert.equal(s2.get(old.id), null, 'la plus ancienne est retirée pour faire de la place');
  assert.equal(s2.save(current.id, [{ role: 'user', content: 'c'.repeat(2000) }]), false, 'échec signalé, jamais silencieux');
  assert.equal(autoTitle([{ role: 'user', content: 'x'.repeat(100) }]).length, 58);
});
