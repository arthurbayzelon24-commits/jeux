import { h, clear } from '../lib/dom.js';
import { api } from '../lib/api.js';
import { getCapabilities } from '../lib/state.js';
import { isEmbedded, isStatic } from '../lib/env.js';
import { icon } from '../components/icons.js';
import { notice, openModal, toast } from '../components/feedback.js';
import { livingMark } from '../components/livingMark.js';
import { trackCreation } from '../components/creation.js';
import { resultActions } from './generationShared.js';
import { importCatalogItem, renderCatalogItem } from '../studio/music.js';
import { editorPath, photoProjectFromMedia, saveAndOpen, videoProjectFromMedia } from '../studio/projectActions.js';
import { applyProjectOperations, describeOperation, projectSummary } from '../studio/assistantActions.js';
import { importFile } from '../studio/media.js';
import { db } from '../studio/db.js';

/**
 * SOLVEX AI conversation. The server runs a real language model with SOLVEX
 * tools and streams what really happens (analysis, tool calls, answer text).
 * Conversation and memory are kept in this browser; memory is only what the
 * user approved, and can be viewed, switched off or erased here.
 */
const STORE_KEY = 'solvex:chat';
const MEMORY_KEY = 'solvex:memory';
const MEMORY_ON_KEY = 'solvex:memory-on';
const EXAMPLES = [
  'Imagine un logo futuriste pour une marque de technologie.',
  'Donne-moi cinq idées de vidéos originales.',
  'Crée une image réaliste d’une ville futuriste.',
  'Prépare un concept de vidéo de trente secondes.',
  'Trouve une ambiance musicale pour mon montage.',
  'Explique-moi comment créer un effet cinématographique.',
  'Transforme cette idée en prompt détaillé pour un générateur vidéo : un café qui ouvre à l’aube.',
];
const STEP_LABELS = { analyse: 'Analyse de la demande', reponse: 'Rédaction de la réponse' };

const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked or full: kept for this page only.
  }
};

/** What the model must know of past actions (it does not see the page). */
function summary(message) {
  const parts = (message.actions || []).map((a) => {
    if (a.type === 'creation') return `[${a.creation.type === 'video' ? 'Vidéo' : 'Image'} lancée — id ${a.creation.id} — description : ${a.creation.prompt}]`;
    if (a.type === 'music') return `[Musiques proposées : ${a.items.map((i) => `${i.title} (${i.id})`).join(', ')}]`;
    if (a.type === 'project_proposal') return `[Proposition de modification du projet « ${a.projectName} » : ${a.state === 'applied' ? 'appliquée par l’utilisateur' : a.state === 'refused' ? 'refusée par l’utilisateur' : 'en attente de confirmation'}]`;
    if (a.type === 'memory_proposal') return `[Mémorisation proposée : ${a.state === 'saved' ? 'acceptée' : a.state === 'refused' ? 'refusée' : 'en attente'}]`;
    if (a.type === 'open_in_editor') return `[Ouverture proposée dans l’éditeur ${a.editor}]`;
    return '';
  });
  return [message.content, ...parts].filter(Boolean).join('\n');
}

const EMBEDDED_RULES = `Tu es SOLVEX AI, l'assistant créatif de l'application SOLVEX (montage vidéo, retouche photo, génération d'images et de vidéos). Réponds en français, clairement et brièvement.
Dans cette version (page partagée sur claude.ai), tu ne peux PAS lancer de génération ni modifier un projet : propose des idées, des concepts, des descriptions détaillées prêtes à copier, des plans de montage et des choix de musique de la bibliothèque SOLVEX. Distingue toujours ce que tu proposes de ce qui serait réellement créé. Si on te demande de générer, explique que la génération se lance depuis le site public ou le serveur SOLVEX, et fournis la description à utiliser.`;

export async function assistantPage() {
  const caps = getCapabilities();
  const sample = isEmbedded() ? await window.claude?.use?.('sample').catch(() => null) : null;
  const backend = !isStatic() && caps?.assistant?.configured ? 'server' : sample ? 'claude' : null;
  let messages = read(STORE_KEY, []);
  let memory = read(MEMORY_KEY, []);
  let memoryOn = read(MEMORY_ON_KEY, true);
  let attached = null; // project attached to the conversation
  let controller = null;
  const stops = [];

  const list = h('div', { class: 'chat-list', role: 'log', 'aria-live': 'polite' });
  const input = h('textarea', { class: 'textarea chat-input', rows: 2, placeholder: 'Écrivez à SOLVEX AI… (Entrée pour envoyer, Maj + Entrée pour aller à la ligne)', 'aria-label': 'Message pour SOLVEX AI', maxLength: 8000 });
  const send = h('button', { class: 'btn btn--primary', type: 'submit' }, icon('arrow'), 'Envoyer');
  const stop = h('button', { class: 'btn btn--ghost', type: 'button', hidden: true }, 'Arrêter');
  const persist = () => write(STORE_KEY, messages.slice(-60));

  // ---------------------------------------------------------------- action cards
  function renderAction(action, message) {
    if (action.type === 'creation') {
      const stage = h('div', { class: 'chat-stage' });
      const bar = h('div', { class: 'chat-actions', hidden: true });
      stops.push(
        trackCreation(stage, action.creation, {
          onRetry: (next) => ((action.creation = next), persist()),
          onFinal: (final) => {
            if (final.status !== 'succeeded') return;
            bar.hidden = false;
            clear(bar).append(resultActions(final, { onRegenerate: () => sendText(`Refais une variante de : ${final.prompt}`), onEditPrompt: () => ((input.value = final.prompt), input.focus()) }));
          },
        }),
      );
      return h('div', { class: 'chat-card' }, h('p', { class: 'field__hint' }, `${action.creation.type === 'video' ? 'Vidéo' : 'Image'} · ${action.creation.operationLabel || ''} · ${action.creation.model || ''}`), stage, bar);
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
          return h('div', { class: 'sound-item' }, play, h('div', { class: 'sound-item__main' }, h('strong', {}, item.title), h('span', { class: 'field__hint' }, `${item.category} · ${Math.round(item.duration)} s`)), use);
        }),
      );
    }
    if (action.type === 'project_proposal') {
      const status = h('p', { class: 'field__hint', 'aria-live': 'polite' });
      const apply = h('button', { class: 'btn btn--sm btn--primary', type: 'button' }, icon('check'), 'Appliquer au projet');
      const refuse = h('button', { class: 'btn btn--sm btn--ghost', type: 'button' }, 'Refuser');
      const open = h('a', { class: 'btn btn--sm', href: `/studio/video?id=${action.projectId}`, 'data-link': '', hidden: action.state !== 'applied' }, 'Ouvrir le projet');
      const settle = () => {
        apply.hidden = refuse.hidden = Boolean(action.state);
        open.hidden = action.state !== 'applied';
        if (action.state === 'refused') status.textContent = 'Proposition refusée : rien n’a été modifié.';
      };
      apply.addEventListener('click', async () => {
        apply.disabled = true;
        try {
          const { project, done, skipped } = await applyProjectOperations(action.projectId, action.operations);
          action.state = 'applied';
          open.setAttribute('href', editorPath(project));
          status.textContent = `Appliqué : ${done.join(' ; ') || 'rien'}.${skipped.length ? ` Non appliqué : ${skipped.join(' ; ')}.` : ''}`;
          persist();
          settle();
        } catch (error) {
          status.textContent = `Impossible d’appliquer : ${error.message}`;
          apply.disabled = false;
        }
      });
      refuse.addEventListener('click', () => ((action.state = 'refused'), persist(), settle()));
      const card = h(
        'div',
        { class: 'chat-card chat-card--proposal' },
        h('p', {}, h('strong', {}, `Proposition pour « ${action.projectName} »`), ' — ', action.summary),
        h('ul', { class: 'plain-list' }, action.operations.map((o) => h('li', {}, describeOperation(o)))),
        h('p', { class: 'field__hint' }, 'Rien n’est modifié tant que vous n’avez pas confirmé.'),
        h('div', { class: 'insp-actions' }, apply, refuse, open),
        status,
      );
      settle();
      if (action.state === 'applied') status.textContent = 'Proposition appliquée.';
      return card;
    }
    if (action.type === 'memory_proposal') {
      const status = h('p', { class: 'field__hint' });
      const yes = h('button', { class: 'btn btn--sm btn--primary', type: 'button' }, 'Mémoriser');
      const no = h('button', { class: 'btn btn--sm btn--ghost', type: 'button' }, 'Non merci');
      const settle = () => {
        yes.hidden = no.hidden = Boolean(action.state);
        status.textContent = action.state === 'saved' ? 'Mémorisé. Gérez la mémoire avec le bouton « Mémoire ».' : action.state === 'refused' ? 'Non mémorisé.' : '';
      };
      yes.addEventListener('click', () => {
        memory = [...memory, { id: Date.now().toString(36), text: action.text, at: new Date().toISOString() }].slice(-20);
        write(MEMORY_KEY, memory);
        action.state = 'saved';
        persist();
        settle();
        drawMemoryButton();
      });
      no.addEventListener('click', () => ((action.state = 'refused'), persist(), settle()));
      settle();
      return h('div', { class: 'chat-card' }, h('p', {}, 'Retenir cette préférence pour les prochaines conversations ?'), h('p', { class: 'prompt-quote' }, action.text), h('div', { class: 'insp-actions' }, yes, no), status);
    }
    if (action.type === 'open_in_editor') {
      const go = h('button', { class: 'btn btn--sm btn--primary', type: 'button' }, icon('layers'), `Ouvrir dans l’éditeur ${action.editor === 'video' ? 'vidéo' : 'photo'}`);
      go.addEventListener('click', async () => {
        go.disabled = true;
        try {
          const output = action.creation.outputs[0];
          const blob = await (await fetch(output.url)).blob();
          const media = await importFile(new File([blob], `solvex-${action.creation.id}.${output.mime.split('/')[1]}`, { type: output.mime }), { name: (action.creation.prompt || 'Création SOLVEX').slice(0, 60), origin: 'solvex-ai' });
          await saveAndOpen(action.editor === 'video' || media.kind === 'video' ? videoProjectFromMedia([media], { aspect: null }) : photoProjectFromMedia(media));
        } catch (error) {
          toast(`Ouverture impossible : ${error.message}`, { type: 'error' });
          go.disabled = false;
        }
      });
      return h('div', { class: 'chat-card' }, h('p', {}, `Création « ${(action.creation.prompt || '').slice(0, 80)} »`), go);
    }
    return null;
  }

  function bubble(message, index) {
    const body = h('div', { class: 'chat-text' });
    body.textContent = message.content || '';
    const steps = message.steps?.length
      ? h(
          'ol',
          { class: 'chat-steps', 'aria-label': 'Étapes réalisées' },
          message.steps.map((s) => h('li', { class: s.ok === false ? 'is-error' : s.ok ? 'is-done' : '' }, s.label, s.error ? ` — ${s.error}` : '')),
        )
      : null;
    const el = h(
      'article',
      { class: `chat-msg chat-msg--${message.role}${message.error ? ' is-error' : ''}` },
      message.role === 'assistant' ? h('span', { class: 'chat-avatar', 'aria-hidden': 'true' }, livingMark({ size: 'sm' })) : null,
      h('div', { class: 'chat-bubble' }, steps, body, ...(message.actions || []).map((a) => renderAction(a, message)).filter(Boolean), message.model ? h('small', { class: 'chat-model' }, message.model) : null),
    );
    if (message.error && message.retryable !== false) el.querySelector('.chat-bubble').append(h('button', { class: 'btn btn--sm', type: 'button', onclick: () => retry(index) }, icon('refresh'), 'Réessayer'));
    return el;
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
          h('p', { class: 'field__hint' }, 'Demandez une explication, des idées, un concept, une image, une vidéo, une musique, ou joignez un projet pour l’améliorer.'),
          h('div', { class: 'chips' }, EXAMPLES.map((e) => h('button', { class: 'btn btn--sm btn--ghost', type: 'button', disabled: !backend, onclick: () => sendText(e) }, e))),
        ),
      );
    }
    messages.forEach((m, i) => list.append(bubble(m, i)));
    list.scrollTop = list.scrollHeight;
  }

  // ---------------------------------------------------------------- one turn
  async function askServer(history) {
    const live = { role: 'assistant', content: '', steps: [], actions: [] };
    messages.push(live);
    draw();
    let node = list.lastElementChild;
    const redraw = () => {
      const fresh = bubble(live, messages.length - 1);
      node.replaceWith(fresh);
      node = fresh;
      list.scrollTop = list.scrollHeight;
    };
    const body = { messages: history, memory: memoryOn ? memory.map((m) => m.text) : [], project: attached ? projectSummary(attached) : undefined };
    const final = await api.chatStream(body, {
      signal: controller.signal,
      onEvent: (event) => {
        if (event.type === 'status') {
          live.steps.forEach((s) => s.ok ?? (s.ok = true));
          if (event.step !== 'reponse' || !live.steps.some((s) => s.step === 'reponse')) live.steps.push({ step: event.step, label: event.label || STEP_LABELS[event.step] || event.step });
          redraw();
        } else if (event.type === 'delta') {
          live.content += event.text;
          node.querySelector('.chat-text').textContent = live.content;
          list.scrollTop = list.scrollHeight;
        } else if (event.type === 'tool') {
          const step = [...live.steps].reverse().find((s) => s.step === 'outil');
          if (step) Object.assign(step, { ok: event.ok, error: event.error });
          redraw();
        } else if (event.type === 'action') {
          live.actions.push(event.action);
          redraw();
        }
      },
    });
    messages.pop();
    live.steps.forEach((s) => s.ok ?? (s.ok = true));
    return { ...live, content: final.reply, model: final.model };
  }

  async function askClaude(history) {
    const live = { role: 'assistant', content: '' };
    messages.push(live);
    draw();
    const node = list.lastElementChild.querySelector('.chat-text');
    const context = [memoryOn && memory.length ? `Préférences mémorisées : ${memory.map((m) => m.text).join(' ; ')}` : '', attached ? `Projet joint (données) : ${JSON.stringify(projectSummary(attached)).slice(0, 4000)}` : ''].filter(Boolean).join('\n');
    try {
      const { text } = await sample([{ role: 'user', content: `${EMBEDDED_RULES}\n${context}\nVoici la conversation :` }, ...history], {
        cache: false,
        signal: controller.signal,
        onText: ({ text: t }) => {
          node.textContent = t;
          list.scrollTop = list.scrollHeight;
        },
      });
      messages.pop();
      return { role: 'assistant', content: text, model: 'Claude (claude.ai)' };
    } catch (error) {
      messages.pop();
      const codes = { not_granted: 'Vous avez refusé l’accès à Claude pour cette page.', rate_limited: 'Trop de demandes : patientez un instant.', cancelled: 'Réponse arrêtée.' };
      throw Object.assign(new Error(codes[error.code] || error.message || 'Claude n’a pas pu répondre.'), { code: error.code });
    }
  }

  async function sendText(text) {
    text = text.trim();
    if (!text || controller) return;
    if (!backend) return toast('L’assistant n’est pas disponible ici (voir le message en haut de la page).', { type: 'error' });
    messages.push({ role: 'user', content: text });
    input.value = '';
    persist();
    draw();
    controller = new AbortController();
    send.disabled = true;
    stop.hidden = false;
    const history = messages.filter((m) => !m.error).map((m) => ({ role: m.role, content: summary(m) }));
    try {
      messages.push(backend === 'server' ? await askServer(history) : await askClaude(history));
    } catch (error) {
      const cancelled = error.code === 'cancelled';
      messages.push({ role: 'assistant', content: cancelled ? 'Réponse arrêtée.' : `Je n’ai pas pu répondre : ${error.message}`, error: true, retryable: true });
    } finally {
      controller = null;
      send.disabled = false;
      stop.hidden = true;
      persist();
      draw();
      input.focus();
    }
  }

  function retry(index) {
    const lastUser = messages[index - 1]?.role === 'user' ? messages[index - 1].content : null;
    messages = messages.slice(0, lastUser ? index - 1 : index);
    if (lastUser) sendText(lastUser);
    else draw();
  }

  // ---------------------------------------------------------------- toolbar: project & memory
  const projectSelect = h('select', { class: 'select select--sm', 'aria-label': 'Projet joint à la conversation' }, h('option', { value: '' }, 'Aucun projet joint'));
  db.listProjects()
    .then((projects) => projectSelect.append(...projects.map((p) => h('option', { value: p.id }, `${p.type === 'photo' ? 'Photo' : 'Vidéo'} — ${p.name}`))))
    .catch(() => {});
  projectSelect.addEventListener('change', async () => {
    attached = projectSelect.value ? await db.getProject(projectSelect.value) : null;
    if (attached) toast(`Projet « ${attached.name} » joint : SOLVEX AI peut le lire et proposer des modifications.`, { type: 'info', duration: 3500 });
  });
  const memoryBtn = h('button', { class: 'btn btn--sm btn--ghost', type: 'button' });
  function drawMemoryButton() {
    memoryBtn.replaceChildren(icon('info', { size: 16 }), `Mémoire (${memoryOn ? memory.length : 'désactivée'})`);
  }
  drawMemoryButton();
  memoryBtn.addEventListener('click', () => {
    const listEl = h('ul', { class: 'memory-list' });
    const toggle = h('input', { type: 'checkbox', checked: memoryOn });
    const drawList = () =>
      clear(listEl).append(
        ...(memory.length
          ? memory.map((m) =>
              h(
                'li',
                {},
                h('span', {}, m.text),
                h('button', { class: 'btn btn--sm btn--ghost', type: 'button', 'aria-label': `Oublier : ${m.text}`, onclick: () => ((memory = memory.filter((x) => x.id !== m.id)), write(MEMORY_KEY, memory), drawList(), drawMemoryButton()) }, icon('trash')),
              ),
            )
          : [h('li', { class: 'field__hint' }, 'Rien n’est mémorisé.')]),
      );
    toggle.addEventListener('change', () => ((memoryOn = toggle.checked), write(MEMORY_ON_KEY, memoryOn), drawMemoryButton()));
    drawList();
    openModal(
      h(
        'div',
        { class: 'dialog__body' },
        h('h2', {}, 'Mémoire de SOLVEX AI'),
        h('p', { class: 'field__hint' }, 'Préférences que vous avez acceptées de mémoriser. Elles restent dans ce navigateur et sont jointes à vos messages seulement si la mémoire est activée. La conversation elle-même est un contexte temporaire, distinct de cette mémoire.'),
        h('label', { class: 'insp-check' }, toggle, 'Utiliser la mémoire dans les conversations'),
        listEl,
        h('div', { class: 'insp-actions' }, h('button', { class: 'btn btn--sm btn--danger', type: 'button', onclick: () => ((memory = []), write(MEMORY_KEY, memory), drawList(), drawMemoryButton()) }, 'Tout oublier')),
      ),
      { label: 'Mémoire de SOLVEX AI' },
    );
  });

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
    controller?.abort();
    messages = [];
    persist();
    draw();
  });

  const a = caps?.assistant;
  const badge =
    backend === 'server'
      ? h('span', { class: 'tag tag--ok', title: `Outils actifs : ${(a.tools || []).filter((t) => t.available).map((t) => t.name).join(', ')}` }, `Modèle connecté · ${a.label}`)
      : backend === 'claude'
        ? h('span', { class: 'tag tag--ok' }, 'Claude (via claude.ai)')
        : h('span', { class: 'tag tag--off' }, 'Non configuré');
  const warning = backend
    ? backend === 'claude'
      ? notice('info', h('p', {}, 'Ici, SOLVEX AI répond grâce à Claude, sur votre compte claude.ai : idées, concepts, descriptions et plans de montage, sans génération (elle se lance depuis le site public ou le serveur SOLVEX).'))
      : null
    : notice(
        'warn',
        isStatic()
          ? h('p', {}, h('strong', {}, 'Assistant indisponible dans cette version sans serveur. '), 'SOLVEX AI utilise un vrai modèle de langage appelé par le serveur SOLVEX avec votre clé, jamais depuis le navigateur.')
          : h('p', {}, h('strong', {}, 'Assistant non configuré. '), `Ajoutez ${(a?.missing || ['OPENAI_API_KEY', 'OPENAI_CHAT_MODEL']).join(' et ')} dans le fichier .env du serveur (ou un modèle local via AI_PROVIDER=openai-compatible), puis redémarrez-le.`),
      );
  if (!backend) {
    input.disabled = true;
    send.disabled = true;
  }
  draw();
  const el = h(
    'div',
    { class: 'page container chat-page' },
    h(
      'header',
      { class: 'studio__head' },
      h('div', {}, h('span', { class: 'eyebrow' }, icon('sparkles', { size: 14 }), 'Assistant créatif'), h('h1', {}, 'SOLVEX AI')),
      h('div', { class: 'insp-actions chat-tools' }, badge, projectSelect, memoryBtn, reset),
    ),
    warning,
    h('section', { class: 'panel chat' }, list, form),
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
