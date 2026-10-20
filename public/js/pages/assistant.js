import { h, clear } from '../lib/dom.js';
import { api } from '../lib/api.js';
import { getCapabilities } from '../lib/state.js';
import { isEmbedded, isStatic } from '../lib/env.js';
import { icon } from '../components/icons.js';
import { confirmDialog, notice, openModal, toast } from '../components/feedback.js';
import { createConversationStore } from '../lib/conversations.js';
import { renderMarkdown } from '../lib/markdown.js';
import { formatDate } from '../lib/dom.js';
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
 * Conversations and memory are kept in this browser; memory is only what the
 * user approved, and can be viewed, switched off or erased here. Images can be
 * joined to a message when the configured model reads them.
 */
const MAX_IMAGES = 4;
const IMAGE_EDGE = 1568; // longest side sent to the model; larger photos are scaled down first
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

/** Scales an image file down to a JPEG the model accepts, plus a small thumbnail kept in the conversation. */
async function prepareImage(file) {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error(`« ${file.name} » n’est pas une image PNG, JPEG, WebP ou GIF.`);
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(`« ${file.name} » n’a pas pu être lue.`);
  });
  const draw = (edge, quality) => {
    const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
    const canvas = Object.assign(document.createElement('canvas'), { width: Math.max(16, Math.round(bitmap.width * scale)), height: Math.max(16, Math.round(bitmap.height * scale)) });
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // transparent areas become white rather than black in JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return { canvas, quality };
  };
  const full = draw(IMAGE_EDGE, 0.88);
  const blob = await new Promise((resolve) => full.canvas.toBlob(resolve, 'image/jpeg', full.quality));
  const thumb = draw(160, 0.7).canvas.toDataURL('image/jpeg', 0.7);
  bitmap.close?.();
  if (!blob) throw new Error('Conversion de l’image impossible dans ce navigateur.');
  return { file: new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }), thumb, name: file.name };
}

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
  const images = message.images?.length ? `[${message.images.length} image(s) jointe(s) à ce message]` : '';
  return [message.content, images, ...parts].filter(Boolean).join('\n');
}

const EMBEDDED_RULES = `Tu es SOLVEX AI, l'assistant créatif de l'application SOLVEX (montage vidéo, retouche photo, génération d'images et de vidéos). Réponds en français, clairement et brièvement.
Dans cette version (page partagée sur claude.ai), tu ne peux PAS lancer de génération ni modifier un projet : propose des idées, des concepts, des descriptions détaillées prêtes à copier, des plans de montage et des choix de musique de la bibliothèque SOLVEX. Distingue toujours ce que tu proposes de ce qui serait réellement créé. Si on te demande de générer, explique que la génération se lance depuis le site public ou le serveur SOLVEX, et fournis la description à utiliser.`;

export async function assistantPage() {
  const caps = getCapabilities();
  const sample = isEmbedded() ? await window.claude?.use?.('sample').catch(() => null) : null;
  const backend = !isStatic() && caps?.assistant?.configured ? 'server' : sample ? 'claude' : null;
  const conversations = createConversationStore();
  let current = conversations.active();
  let messages = current.messages;
  let pending = []; // images prepared for the next message: { file, thumb, name }
  let warnedStorage = false;
  let inflight = Promise.resolve();
  const vision = backend === 'server' && Boolean(caps.assistant.vision);
  let memory = read(MEMORY_KEY, []);
  let memoryOn = read(MEMORY_ON_KEY, true);
  let attached = null; // project attached to the conversation
  let controller = null;
  const stops = [];

  const list = h('div', { class: 'chat-list', role: 'log', 'aria-live': 'polite' });
  const input = h('textarea', { class: 'textarea chat-input', rows: 2, placeholder: 'Écrivez à SOLVEX AI… (Entrée pour envoyer, Maj + Entrée pour aller à la ligne)', 'aria-label': 'Message pour SOLVEX AI', maxLength: 8000 });
  const send = h('button', { class: 'btn btn--primary', type: 'submit' }, icon('arrow'), 'Envoyer');
  const stop = h('button', { class: 'btn btn--ghost', type: 'button', hidden: true }, 'Arrêter');
  const persist = () => {
    if (conversations.save(current.id, messages) || warnedStorage) return drawSidebar();
    warnedStorage = true;
    toast('Le stockage du navigateur est plein ou bloqué : cette conversation ne sera pas conservée après fermeture.', { type: 'error' });
    drawSidebar();
  };

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

  function fillText(body, message) {
    if (message.role === 'assistant' && !message.error) {
      body.replaceChildren(renderMarkdown(message.content || ''));
      for (const pre of body.querySelectorAll('pre')) {
        const copy = h('button', { class: 'btn btn--sm btn--ghost chat-copy', type: 'button', 'aria-label': 'Copier le code' }, 'Copier');
        copy.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(pre.querySelector('code').textContent);
            copy.textContent = 'Copié';
          } catch {
            copy.textContent = 'Copie refusée';
          }
          setTimeout(() => (copy.textContent = 'Copier'), 1500);
        });
        pre.append(copy);
      }
    } else body.textContent = message.content || '';
  }

  function bubble(message, index) {
    const body = h('div', { class: 'chat-text' });
    fillText(body, message);
    const thumbs = message.images?.length ? h('div', { class: 'chat-thumbs' }, message.images.map((img) => h('img', { src: img.thumb, alt: img.name || 'Image jointe', loading: 'lazy' }))) : null;
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
      h('div', { class: 'chat-bubble' }, steps, thumbs, body, ...(message.actions || []).map((a) => renderAction(a, message)).filter(Boolean), message.model ? h('small', { class: 'chat-model' }, message.model) : null),
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
    let frame = 0;
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
          if (!frame)
            frame = requestAnimationFrame(() => {
              frame = 0;
              fillText(node.querySelector('.chat-text'), live);
              list.scrollTop = list.scrollHeight;
            });
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
    cancelAnimationFrame(frame);
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

  async function sendText(text, { images = null } = {}) {
    text = text.trim();
    if (!text || controller) return;
    if (!backend) return toast('L’assistant n’est pas disponible ici (voir le message en haut de la page).', { type: 'error' });
    controller = new AbortController();
    send.disabled = true;
    stop.hidden = false;
    let finish;
    inflight = new Promise((resolve) => (finish = resolve));
    let uploaded = images || [];
    if (!images && pending.length) {
      // Images go to the SOLVEX server first (type and size checked there), then to the model.
      try {
        uploaded = await Promise.all(pending.map(async (p) => ({ id: (await api.upload(p.file, { signal: controller.signal })).id, thumb: p.thumb, name: p.name })));
        pending = [];
        drawPending();
      } catch (error) {
        toast(`Envoi de l’image impossible : ${error.message}`, { type: 'error' });
        controller = null;
        send.disabled = false;
        stop.hidden = true;
        finish();
        return;
      }
    }
    messages.push({ role: 'user', content: text, ...(uploaded.length ? { images: uploaded } : {}) });
    input.value = '';
    persist();
    draw();
    const history = messages.filter((m) => !m.error).map((m) => ({ role: m.role, content: summary(m) }));
    if (uploaded.length) history.at(-1).images = uploaded.map((i) => i.id);
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
      finish();
      input.focus();
    }
  }

  function retry(index) {
    const lastUser = messages[index - 1]?.role === 'user' ? messages[index - 1] : null;
    messages = messages.slice(0, lastUser ? index - 1 : index);
    if (lastUser) sendText(lastUser.content, { images: lastUser.images || [] });
    else draw();
  }

  // ---------------------------------------------------------------- conversations
  const sidebarList = h('ul', { class: 'chat-convos__list' });
  const sidebar = h('aside', { class: 'chat-convos', 'aria-label': 'Conversations' });
  async function switchTo(conversation) {
    // An answer in progress is stopped and saved in its own conversation first.
    if (controller) {
      controller.abort();
      await inflight;
    }
    current = conversation;
    conversations.setActive(current.id);
    messages = current.messages;
    pending = [];
    drawPending();
    draw();
    drawSidebar();
    sidebar.classList.remove('is-open');
  }
  function startRename(item, conversation) {
    const field = h('input', { class: 'input input--sm', value: conversation.title, maxLength: 80, 'aria-label': 'Nouveau nom de la conversation' });
    let settled = false; // Enter removes the field, which fires blur: handle only the first
    const done = (keep) => {
      if (settled) return;
      settled = true;
      if (keep && !conversations.rename(conversation.id, field.value)) toast('Le nom ne peut pas être vide.', { type: 'error' });
      drawSidebar();
    };
    field.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') done(true);
      if (event.key === 'Escape') done(false);
    });
    field.addEventListener('blur', () => done(true));
    item.replaceChildren(field);
    field.focus();
    field.select();
  }
  function drawSidebar() {
    clear(sidebarList).append(
      ...conversations.list().map((c) => {
        const open = h('button', { class: 'chat-convos__open', type: 'button', 'aria-current': c.id === current.id ? 'true' : null, title: c.title }, h('span', { class: 'chat-convos__title' }, c.title), h('small', {}, `${formatDate(c.updatedAt)} · ${c.messages.length} message${c.messages.length > 1 ? 's' : ''}`));
        open.addEventListener('click', () => c.id !== current.id && switchTo(c));
        const item = h('li', {});
        const rename = h('button', { class: 'btn btn--icon btn--ghost btn--sm', type: 'button', 'aria-label': `Renommer « ${c.title} »`, title: 'Renommer' }, icon('edit', { size: 14 }));
        rename.addEventListener('click', () => startRename(item, c));
        const remove = h('button', { class: 'btn btn--icon btn--ghost btn--sm', type: 'button', 'aria-label': `Supprimer « ${c.title} »`, title: 'Supprimer' }, icon('trash', { size: 14 }));
        remove.addEventListener('click', async () => {
          if (!(await confirmDialog({ title: 'Supprimer la conversation ?', message: `« ${c.title} » sera effacée de ce navigateur. Les images et vidéos déjà créées restent dans Mes créations.`, confirmLabel: 'Supprimer', danger: true }))) return;
          const wasCurrent = c.id === current.id;
          if (wasCurrent && controller) {
            controller.abort();
            await inflight;
          }
          conversations.remove(c.id);
          if (wasCurrent) switchTo(conversations.active());
          else drawSidebar();
        });
        item.append(open, h('div', { class: 'chat-convos__tools' }, rename, remove));
        return item;
      }),
    );
  }
  const newChat = h('button', { class: 'btn btn--primary btn--sm btn--block', type: 'button' }, icon('plus', { size: 16 }), 'Nouvelle conversation');
  newChat.addEventListener('click', () => {
    if (!messages.length) return input.focus(); // the current one is still empty
    switchTo(conversations.create());
    input.focus();
  });
  sidebar.append(newChat, sidebarList, h('p', { class: 'field__hint' }, 'Conversations enregistrées dans ce navigateur uniquement.'));
  const convosToggle = h('button', { class: 'btn btn--sm btn--ghost chat-convos-toggle', type: 'button', 'aria-label': 'Afficher les conversations' }, icon('menu', { size: 16 }), 'Conversations');
  convosToggle.addEventListener('click', () => sidebar.classList.toggle('is-open'));

  // ---------------------------------------------------------------- images joined to the next message
  const pendingEl = h('div', { class: 'chat-pending', hidden: true });
  const filePicker = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', multiple: true, hidden: true });
  const attach = h('button', { class: 'btn btn--ghost btn--icon', type: 'button', 'aria-label': 'Joindre une image', title: vision ? 'Joindre une image' : 'Le modèle configuré ne lit pas les images' }, icon('image'));
  attach.disabled = !vision;
  function drawPending() {
    pendingEl.hidden = !pending.length;
    clear(pendingEl).append(
      ...pending.map((p, i) =>
        h('figure', {}, h('img', { src: p.thumb, alt: p.name }), h('button', { class: 'btn btn--icon btn--sm', type: 'button', 'aria-label': `Retirer ${p.name}`, onclick: () => (pending.splice(i, 1), drawPending()) }, icon('close', { size: 12 }))),
      ),
    );
  }
  async function addImages(files) {
    if (!vision) return toast('Le modèle configuré ne lit pas les images (voir AI_VISION dans .env).', { type: 'error' });
    for (const file of files) {
      if (pending.length >= MAX_IMAGES) {
        toast(`${MAX_IMAGES} images au maximum par message.`, { type: 'error' });
        break;
      }
      try {
        pending.push(await prepareImage(file));
      } catch (error) {
        toast(error.message, { type: 'error' });
      }
    }
    drawPending();
  }
  attach.addEventListener('click', () => filePicker.click());
  filePicker.addEventListener('change', () => {
    addImages([...filePicker.files]);
    filePicker.value = '';
  });
  input.addEventListener('paste', (event) => {
    const files = [...(event.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (files.length && vision) {
      event.preventDefault();
      addImages(files);
    }
  });

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
  const form = h('form', { class: 'chat-composer' }, pendingEl, input, h('div', { class: 'chat-composer__actions' }, filePicker, attach, stop, send));
  form.addEventListener('dragover', (event) => vision && event.dataTransfer?.types.includes('Files') && event.preventDefault());
  form.addEventListener('drop', (event) => {
    const files = [...(event.dataTransfer?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    event.preventDefault();
    addImages(files);
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    sendText(input.value);
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
          : h('p', {}, h('strong', {}, 'Assistant non configuré. '), `Ajoutez ${(a?.missing || ['OPENAI_API_KEY', 'OPENAI_CHAT_MODEL']).join(' et ')} dans le fichier .env du serveur (ou un modèle Claude via AI_PROVIDER=anthropic, ou un modèle local via AI_PROVIDER=openai-compatible), puis redémarrez-le.`),
      );
  if (!backend) {
    input.disabled = true;
    send.disabled = true;
  }
  draw();
  drawSidebar();
  const el = h(
    'div',
    { class: 'page container chat-page' },
    h(
      'header',
      { class: 'studio__head' },
      h('div', {}, h('span', { class: 'eyebrow' }, icon('sparkles', { size: 14 }), 'Assistant créatif'), h('h1', {}, 'SOLVEX AI')),
      h('div', { class: 'insp-actions chat-tools' }, convosToggle, badge, projectSelect, memoryBtn),
    ),
    warning,
    h('div', { class: 'chat-layout' }, sidebar, h('section', { class: 'panel chat' }, list, form)),
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
