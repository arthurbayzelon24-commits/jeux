import { h, clear } from '../../lib/dom.js';
import { icon } from '../../components/icons.js';
import { confirmDialog } from '../../components/feedback.js';
import { api } from '../../lib/api.js';
import { getCapabilities } from '../../lib/state.js';
import { isStatic } from '../../lib/env.js';
import { AUDIO_CATEGORIES, MUSIC_CATEGORIES, SOLVEX_LICENSE, searchCatalog } from '../../shared/audioCatalog.js';
import { importCatalogItem, renderCatalogItem } from '../music.js';
import { AUDIO_ACCEPT, deleteMedia, formatTime, importFile, mediaUrl } from '../media.js';

/**
 * Audio panel of the video editor: the SOLVEX catalogue (original, free of
 * rights), online catalogues when the server has their keys (Jamendo,
 * Freesound), the user's own audio files and voice recording. Every item can
 * be previewed and added to the timeline.
 */

// One preview at a time for the whole panel.
let current = null;
function stopPreview() {
  if (current) {
    current.audio.pause();
    current.button.replaceChildren(icon('play'));
    current.button.setAttribute('aria-label', current.label);
    current = null;
  }
}
async function togglePreview(button, label, getUrl) {
  if (current?.button === button) return stopPreview();
  stopPreview();
  button.disabled = true;
  try {
    const audio = new Audio(await getUrl());
    current = { audio, button, label };
    audio.addEventListener('ended', stopPreview);
    await audio.play();
    button.replaceChildren(icon('pause'));
    button.setAttribute('aria-label', `Arrêter l’écoute`);
  } catch (error) {
    current = null;
    throw new Error(error?.name === 'NotSupportedError' ? 'Ce format ne peut pas être lu par ce navigateur.' : error.message);
  } finally {
    button.disabled = false;
  }
}

const roleFor = (category) => (/^Musiques/.test(category) || category === 'Sons d’ambiance' ? 'music' : category === 'Voix et narration' ? 'voice' : null);

export function renderAudioPanel(body, { library, state }) {
  const caps = getCapabilities();
  const online = isStatic() ? [] : (caps?.audioLibraries || []).filter((s) => s.configured);
  state.audioQuery ??= '';
  state.audioCategory ??= '';
  state.audioSource ??= 'solvex';
  const say = library.toast;

  // ---------------------------------------------------------------- import & record
  const input = h('input', { type: 'file', multiple: true, accept: AUDIO_ACCEPT, hidden: true });
  const status = h('p', { class: 'field__hint', 'aria-live': 'polite' }, state.audioStatus || '');
  input.addEventListener('change', async () => {
    const files = [...input.files];
    input.value = '';
    state.audioStatus = 'Import…';
    status.textContent = state.audioStatus;
    await library.importList(files, status);
    state.audioStatus = status.textContent;
  });
  const tools = h(
    'div',
    { class: 'audio-tools' },
    h('label', { class: 'btn btn--sm btn--primary' }, icon('upload'), 'Importer mes musiques', input),
    library.onRecord ? h('button', { class: 'btn btn--sm', type: 'button', onclick: () => library.onRecord('audio') }, '● Enregistrer une voix') : null,
  );

  // ---------------------------------------------------------------- filters
  const search = h('input', { class: 'input input--sm', type: 'search', placeholder: 'Rechercher : calme, épique, pluie, whoosh…', value: state.audioQuery, 'aria-label': 'Rechercher un son ou une musique' });
  const categories = h(
    'select',
    { class: 'select select--sm', 'aria-label': 'Catégorie' },
    h('option', { value: '' }, 'Toutes les catégories'),
    h('option', { value: 'mine', selected: state.audioCategory === 'mine' }, 'Mes fichiers audio'),
    AUDIO_CATEGORIES.map((c) => h('option', { value: c, selected: state.audioCategory === c }, c)),
  );
  const sources = h(
    'div',
    { class: 'chips chips--scroll', role: 'group', 'aria-label': 'Source' },
    [['solvex', 'SOLVEX (libre de droits)'], ...online.map((s) => [s.id, s.label])].map(([id, label]) => {
      const b = h('button', { type: 'button', class: `btn btn--sm${state.audioSource === id ? ' btn--primary' : ''}`, 'aria-pressed': String(state.audioSource === id) }, label);
      b.addEventListener('click', () => {
        state.audioSource = id;
        library.render();
      });
      return b;
    }),
  );
  const results = h('div', { class: 'sound-list' });
  const info = h('p', { class: 'field__hint' });

  function row({ title, meta, license, onPlay, onAdd, onDelete }) {
    const play = h('button', { class: 'btn btn--sm btn--icon', type: 'button', 'aria-label': `Écouter ${title}` }, icon('play'));
    play.addEventListener('click', () => onPlay(play).catch((error) => say(error.message, 'error')));
    const add = h('button', { class: 'btn btn--sm', type: 'button' }, '+ Ajouter');
    add.addEventListener('click', async () => {
      add.disabled = true;
      add.textContent = 'Ajout…';
      try {
        await onAdd();
        add.textContent = '✓ Ajouté';
      } catch (error) {
        say(error.message, 'error');
        add.textContent = '+ Ajouter';
      } finally {
        setTimeout(() => {
          add.disabled = false;
          add.textContent = '+ Ajouter';
        }, 1200);
      }
    });
    const del = onDelete ? h('button', { class: 'btn btn--sm btn--ghost btn--icon', type: 'button', 'aria-label': `Supprimer ${title}`, onclick: onDelete }, icon('trash')) : null;
    return h('div', { class: 'sound-item' }, play, h('div', { class: 'sound-item__main' }, h('strong', {}, title), h('span', { class: 'field__hint' }, meta), license ? h('small', { class: 'sound-item__license' }, license) : null), add, del);
  }

  async function addMedia(media, category) {
    await library.reloadMedia();
    library.onAdd({ type: 'media', id: media.id, role: roleFor(category) });
  }

  function drawMine() {
    const q = state.audioQuery.toLowerCase();
    const mine = library.media.filter((m) => m.kind === 'audio' && (!q || m.name.toLowerCase().includes(q)));
    info.textContent = `${mine.length} fichier(s) audio dans votre bibliothèque. Formats : MP3, WAV, OGG, FLAC, et M4A/AAC selon le navigateur.`;
    if (!mine.length) results.append(h('p', { class: 'field__hint' }, 'Aucun fichier : utilisez « Importer mes musiques ».'));
    for (const m of mine) {
      results.append(
        library.drag(row({
          title: m.name,
          meta: [m.duration ? formatTime(m.duration) : '', m.license || (m.origin === 'solvex-sound' ? 'SOLVEX' : 'Importé')].filter(Boolean).join(' · '),
          onPlay: (b) => togglePreview(b, `Écouter ${m.name}`, () => mediaUrl(m.id)),
          onAdd: () => library.onAdd({ type: 'media', id: m.id, role: roleFor(m.category || '') || 'music' }),
          onDelete: async () => {
            if (!(await confirmDialog({ title: 'Supprimer ce fichier ?', message: `« ${m.name} » sera supprimé de la bibliothèque. Les clips qui l’utilisent deviendront vides.`, confirmLabel: 'Supprimer', danger: true }))) return;
            stopPreview();
            await deleteMedia(m.id);
            await library.reloadMedia();
          },
        }), { type: 'media', id: m.id }),
      );
    }
  }

  function drawSolvex() {
    const list = searchCatalog({ query: state.audioQuery, category: state.audioCategory });
    info.textContent = `${list.length} résultat(s). ${SOLVEX_LICENSE}`;
    if (!list.length) results.append(h('p', { class: 'field__hint' }, 'Aucun résultat : essayez un autre mot ou une autre catégorie.'));
    let group = '';
    for (const item of list) {
      if (!state.audioQuery && item.category !== group) {
        group = item.category;
        results.append(h('h4', {}, group));
      }
      results.append(
        row({
          title: item.title,
          meta: `${item.category} · ${formatTime(item.duration)} · ${item.tags.slice(0, 3).join(', ')}`,
          onPlay: (b) => togglePreview(b, `Écouter ${item.title}`, async () => URL.createObjectURL(await renderCatalogItem(item.id))),
          onAdd: async () => addMedia(await importCatalogItem(item.id), item.category),
        }),
      );
    }
    if (!state.audioCategory || state.audioCategory === 'Voix et narration') {
      results.append(
        h('h4', {}, 'Voix et narration'),
        h('p', { class: 'field__hint' }, 'Enregistrez votre voix avec « ● Enregistrer une voix » (micro). La synthèse vocale par IA n’est pas branchée.'),
      );
    }
  }

  async function drawOnline(sourceId) {
    const source = online.find((s) => s.id === sourceId);
    info.textContent = `Recherche chez ${source.label}…`;
    try {
      const { results: list } = await api.audioSearch({ source: sourceId, q: state.audioQuery, category: state.audioCategory });
      info.textContent = `${list.length} résultat(s) chez ${source.label}. Respectez la licence de chaque œuvre (affichée sous le titre).`;
      if (!list.length) results.append(h('p', { class: 'field__hint' }, 'Aucun résultat.'));
      for (const item of list) {
        const fetchFile = async () => {
          const response = await fetch(`/api/audio/file?source=${sourceId}&id=${item.id}`);
          if (!response.ok) throw new Error((await response.json().catch(() => null))?.error?.message || `Erreur ${response.status}`);
          return response.blob();
        };
        let cached = null;
        const blob = async () => (cached ??= await fetchFile());
        results.append(
          row({
            title: item.title,
            meta: `${item.author} · ${item.duration ? formatTime(item.duration) : ''}`,
            license: h('a', { href: item.licenseUrl || item.pageUrl || '#', target: '_blank', rel: 'noopener' }, item.license),
            onPlay: (b) => togglePreview(b, `Écouter ${item.title}`, async () => URL.createObjectURL(await blob())),
            onAdd: async () => {
              const file = await blob();
              const media = await importFile(new File([file], `${item.title}.mp3`, { type: file.type || 'audio/mpeg' }), {
                name: `${item.title} — ${item.author}`,
                origin: `audio-${sourceId}`,
                extra: { author: item.author, license: item.license, licenseUrl: item.licenseUrl, pageUrl: item.pageUrl, category: state.audioCategory || (sourceId === 'jamendo' ? MUSIC_CATEGORIES[0] : 'Bruitages') },
              });
              await addMedia(media, sourceId === 'jamendo' ? 'Musiques' : state.audioCategory);
            },
          }),
        );
      }
    } catch (error) {
      info.textContent = `${source.label} indisponible : ${error.message}`;
    }
  }

  function draw() {
    stopPreview();
    clear(results);
    if (state.audioCategory === 'mine') return drawMine();
    if (state.audioSource !== 'solvex' && online.some((s) => s.id === state.audioSource)) return drawOnline(state.audioSource);
    return drawSolvex();
  }

  let timer;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.audioQuery = search.value.trim();
      draw();
    }, 250);
  });
  categories.addEventListener('change', () => {
    state.audioCategory = categories.value;
    draw();
  });

  const offline = (caps?.audioLibraries || []).filter((s) => !s.configured);
  body.append(
    tools,
    status,
    search,
    categories,
    sources,
    info,
    results,
    !isStatic() && offline.length
      ? h('p', { class: 'field__hint' }, `Bibliothèques en ligne disponibles sur configuration du serveur : ${offline.map((s) => `${s.label} (${s.missing.join(', ')})`).join(' ; ')}.`)
      : null,
  );
  draw();
}

export { stopPreview };
