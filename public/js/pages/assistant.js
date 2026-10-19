import { h, clear } from '../lib/dom.js';
import { api } from '../lib/api.js';
import { getCapabilities } from '../lib/state.js';
import { isEmbedded, isStatic } from '../lib/env.js';
import { icon } from '../components/icons.js';
import { notice, toast } from '../components/feedback.js';
import { livingMark } from '../components/livingMark.js';
import { trackCreation } from '../components/creation.js';
import { resultActions } from './generationShared.js';
import { importCatalogItem, renderCatalogItem } from '../studio/music.js';
import { saveAndOpen, videoProjectFromMedia } from '../studio/projectActions.js';

const STORE_KEY = 'solvex:chat';
const EXAMPLES = [
  'Crée une image d’une ville futuriste sous la pluie.',
  'Imagine une vidéo cinématographique dans l’espace.',
  'Donne-moi trois idées de vidéo pour les réseaux sociaux.',
  'Transforme cette idée en prompt détaillé pour une vidéo : un café qui ouvre à l’aube.',
  'Propose une musique adaptée à un vlog de voyage.',
  'Prépare un montage avec un titre élégant et des transitions douces.',
];

// Used only inside claude.ai, where Claude itself answers (no SOLVEX server, no generation).
const EMBEDDED_RULES = `Tu es SOLVEX AI, l'assistant créatif de l'application SOLVEX (montage vidéo, retouche photo, génération d'images et de vidéos). Réponds en français, clairement et brièvement.
Dans cette version (page partagée sur claude.ai), tu ne peux PAS lancer de génération d'image ou de vidéo ni modifier un projet : propose des idées, des descriptions détaillées prêtes à copier dans le générateur, des plans de montage étape par étape et des choix de musique de la bibliothèque SOLVEX (catégories : ambiance, cinématique, électronique, calme, dynamique, joyeuse, dramatique, vidéos courtes, vlogs, présentations). Si on te demande de générer, explique que la génération se lance depuis le site public SOLVEX ou le serveur SOLVEX, et fournis la description à utiliser.
Voici la conversation :`;

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
  } catch {
    return [];
  }
}
function persist(messages) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-60)));
  } catch {
    // Storage full or blocked: the conversation simply is not kept.
  }
}

/** What the model must remember of the actions (it cannot see the page). */
function summary(message) {
  const parts = (message.actions || []).map((a) => {
    if (a.type === 'creation') return `[${a.creation.type === 'video' ? 'Vidéo' : 'Image'} lancée — description : ${a.creation.prompt}]`;
    if (a.type === 'music') return `[Musiques proposées : ${a.items.map((i) => i.title).join(', ')}]`;
    if (a.type === 'error') return `[Échec de l’action : ${a.message}]`;
    return '';
  });
  return [message.content, ...parts].filter(Boolean).join('\n');
}

export async function assistantPage() {
  const caps = getCapabilities();
  const sample = isEmbedded() ? await window.claude?.use?.('sample').catch(() => null) : null;
  const backend = !isStatic() && caps?.assistant?.configured ? 'server' : sample ? 'claude' : null;
  let messages = load();
  let controller = null;
  const stops = [];

  const list = h('div', { class: 'chat-list', role: 'log', 'aria-live': 'polite' });
  const input = h('textarea', { class: 'textarea chat-input', rows: 2, placeholder: 'Écrivez à SOLVEX AI… (Entrée pour envoyer, Maj + Entrée pour aller à la ligne)', 'aria-label': 'Message pour SOLVEX AI', maxLength: 8000 });
  const send = h('button', { class: 'btn btn--primary', type: 'submit' }, icon('arrow'), 'Envoyer');
  const stop = h('button', { class: 'btn btn--ghost', type: 'button', hidden: true }, 'Arrêter');
  const status = h('p', { class: 'chat-status', role: 'status' });

  function bubble(message, index) {
    const body = h('div', { class: 'chat-text' });
    body.textContent = message.content || '';
    const el = h(
      'article',
      { class: `chat-msg chat-msg--${message.role}${message.error ? ' is-error' : ''}` },
      message.role === 'assistant' ? h('span', { class: 'chat-avatar', 'aria-hidden': 'true' }, livingMark({ size: 'sm' })) : null,
      h('div', { class: 'chat-bubble' }, body, ...(message.actions || []).map(renderAction)),
    );
    if (message.error) {
      el.querySelector('.chat-bubble').append(
        h('button', { class: 'btn btn--sm', type: 'button', onclick: () => retry(index) }, icon('refresh'), 'Réessayer'),
      );
    }
    return el;
  }

  function renderAction(action) {
    if (action.type === 'creation') {
      const stage = h('div', { class: 'chat-stage' });
      const bar = h('div', { class: 'chat-actions', hidden: true });
      stops.push(
        trackCreation(stage, action.creation, {
          onRetry: (next) => renderAction({ type: 'creation', creation: next }),
          onFinal: (final) => {
            if (final.status !== 'succeeded') return;
            bar.hidden = false;
            clear(bar).append(resultActions(final, { onRegenerate: () => sendText(`Refais une variante de : ${final.prompt}`), onEditPrompt: () => ((input.value = final.prompt), input.focus()) }));
          },
        }),
      );
      return h('div', { class: 'chat-card' }, h('p', { class: 'field__hint' }, `${action.creation.type === 'video' ? 'Vidéo' : 'Image'} · ${action.creation.model || ''}`), stage, bar);
    }
    if (action.type === 'music') {
      return h(
        'div',
        { class: 'chat-card' },
        h('p', { class: 'field__hint' }, 'Bibliothèque SOLVEX (libre de droits)'),
        ...action.items.map((item) => {
          const play = h('button', { class: 'btn btn--sm btn--icon', type: 'button', 'aria-label': `Écouter ${item.title}` }, icon('play'));
          let audio = null;
          play.addEventListener('click', async () => {
            if (audio && !audio.paused) return audio.pause();
            play.disabled = true;
            try {
              audio ??= new Audio(URL.createObjectURL(await renderCatalogItem(item.id)));
              await audio.play();
            } catch (error) {
              toast(error.message, { type: 'error' });
            } finally {
              play.disabled = false;
            }
          });
          const use = h('button', { class: 'btn btn--sm', type: 'button' }, '+ Nouveau montage');
          use.addEventListener('click', async () => {
            use.disabled = true;
            try {
              const media = await importCatalogItem(item.id);
              await saveAndOpen(videoProjectFromMedia([media], { name: item.title, aspect: '16:9' }));
            } catch (error) {
              toast(error.message, { type: 'error' });
              use.disabled = false;
            }
          });
          return h('div', { class: 'sound-item' }, play, h('div', {}, h('strong', {}, item.title), h('span', { class: 'field__hint' }, `${item.category} · ${Math.round(item.duration)} s`)), use);
        }),
      );
    }
    if (action.type === 'error') return h('p', { class: 'field__hint field__hint--warn' }, `Action non réalisée : ${action.message}`);
    return null;
  }

  function draw() {
    stops.splice(0).forEach((fn) => fn());
    clear(list);
    if (!messages.length) {
      list.append(
        h(
          'div',
          { class: 'chat-welcome' },
          livingMark({ size: 'lg' }),
          h('h2', {}, 'Que voulez-vous créer ?'),
          h('p', { class: 'field__hint' }, 'Demandez une idée, un prompt détaillé, une image, une vidéo ou une musique.'),
          h('div', { class: 'chips' }, EXAMPLES.map((e) => h('button', { class: 'btn btn--sm btn--ghost', type: 'button', disabled: !backend, onclick: () => sendText(e) }, e))),
        ),
      );
    }
    messages.forEach((m, i) => list.append(bubble(m, i)));
    list.scrollTop = list.scrollHeight;
  }

  async function ask() {
    const history = messages.filter((m) => !m.error).map((m) => ({ role: m.role, content: summary(m) }));
    if (backend === 'server') {
      status.textContent = 'Analyse de votre demande par le modèle…';
      const out = await api.chat(history, controller.signal);
      return { content: out.reply, actions: (out.actions || []).filter(Boolean), model: out.model };
    }
    status.textContent = 'Claude réfléchit… (le premier message demande votre autorisation)';
    const pending = { role: 'assistant', content: '' };
    messages.push(pending);
    draw();
    const node = list.lastElementChild.querySelector('.chat-text');
    try {
      const { text } = await sample([{ role: 'user', content: EMBEDDED_RULES }, ...history], {
        cache: false,
        signal: controller.signal,
        onText: ({ text: t }) => {
          status.textContent = 'Réponse en cours…';
          node.textContent = t;
          list.scrollTop = list.scrollHeight;
        },
      });
      messages.pop();
      return { content: text, actions: [] };
    } catch (error) {
      messages.pop();
      const codes = { not_granted: 'Vous avez refusé l’accès à Claude pour cette page.', rate_limited: 'Trop de demandes : patientez un instant.', cancelled: 'Réponse arrêtée.' };
      throw new Error(codes[error.code] || error.message || 'Claude n’a pas pu répondre.');
    }
  }

  async function sendText(text) {
    text = text.trim();
    if (!text || controller) return;
    if (!backend) return toast('L’assistant n’est pas disponible ici (voir le message en haut de la page).', { type: 'error' });
    messages.push({ role: 'user', content: text });
    input.value = '';
    persist(messages);
    draw();
    controller = new AbortController();
    send.disabled = true;
    stop.hidden = false;
    try {
      const answer = await ask();
      messages.push({ role: 'assistant', ...answer });
      status.textContent = answer.actions?.some((a) => a.type === 'creation') ? 'Génération lancée : le résultat s’affiche dès que le service l’a produit.' : '';
    } catch (error) {
      messages.push({ role: 'assistant', content: `Je n’ai pas pu répondre : ${error.message}`, error: true });
      status.textContent = '';
    } finally {
      controller = null;
      send.disabled = false;
      stop.hidden = true;
      persist(messages);
      draw();
      input.focus();
    }
  }

  function retry(index) {
    // Drop the failed answer and ask again with the same last message.
    const lastUser = messages[index - 1]?.role === 'user' ? messages[index - 1].content : null;
    messages = messages.slice(0, lastUser ? index - 1 : index);
    if (lastUser) sendText(lastUser);
    else draw();
  }

  stop.addEventListener('click', () => controller?.abort());
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      sendText(input.value);
    }
  });
  const form = h('form', { class: 'chat-composer' }, input, h('div', { class: 'chat-composer__actions' }, stop, send));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    sendText(input.value);
  });
  const reset = h('button', { class: 'btn btn--sm btn--ghost', type: 'button' }, icon('refresh'), 'Nouvelle conversation');
  reset.addEventListener('click', () => {
    messages = [];
    persist(messages);
    draw();
  });

  const badge = backend === 'server'
    ? h('span', { class: 'tag tag--ok' }, `Modèle connecté · ${caps.assistant.model}`)
    : backend === 'claude'
      ? h('span', { class: 'tag tag--ok' }, 'Claude (via claude.ai)')
      : h('span', { class: 'tag tag--off' }, 'Non configuré');
  const warning = backend
    ? backend === 'claude'
      ? notice('info', h('p', {}, 'Ici, SOLVEX AI répond grâce à Claude, sur votre compte claude.ai. Il peut proposer idées, descriptions et plans de montage, mais pas lancer de génération : la génération se lance depuis le site public ou le serveur SOLVEX.'))
      : null
    : notice(
        'warn',
        isStatic()
          ? h('p', {}, h('strong', {}, 'Assistant indisponible dans cette version sans serveur. '), 'SOLVEX AI utilise un vrai modèle de langage, appelé par le serveur SOLVEX avec votre clé (jamais depuis le navigateur). Lancez le serveur avec OPENAI_API_KEY et OPENAI_CHAT_MODEL.')
          : h('p', {}, h('strong', {}, 'Assistant non configuré. '), 'Ajoutez ', h('code', {}, 'OPENAI_API_KEY'), ' et ', h('code', {}, 'OPENAI_CHAT_MODEL'), ' (nom d’un modèle de votre compte OpenAI) dans le fichier .env du serveur, puis redémarrez-le.'),
      );
  if (!backend) {
    input.disabled = true;
    send.disabled = true;
  }

  draw();
  const el = h(
    'div',
    { class: 'page container chat-page' },
    h('header', { class: 'studio__head' }, h('div', {}, h('span', { class: 'eyebrow' }, icon('sparkles', { size: 14 }), 'Assistant créatif'), h('h1', {}, 'SOLVEX AI')), h('div', { class: 'insp-actions' }, badge, reset)),
    warning,
    h('section', { class: 'panel chat' }, list, status, form),
  );
  requestAnimationFrame(() => backend && input.focus());
  return {
    el,
    title: 'SOLVEX AI',
    cleanup: () => {
      controller?.abort();
      stops.forEach((fn) => fn());
    },
  };
}
