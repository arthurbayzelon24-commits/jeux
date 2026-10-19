import { h, clear } from '../../lib/dom.js';
import { saveFile } from '../../lib/download.js';
import { icon } from '../../components/icons.js';
import { confirmDialog, openModal, toast, setBusy } from '../../components/feedback.js';
import { EditorStore, openProject } from '../editorStore.js';
import { Player } from '../engine/player.js';
import { Timeline } from '../ui/timeline.js';
import { Inspector } from '../ui/inspector.js';
import { Library, TEXT_PRESETS } from '../ui/library.js';
import { openExportDialog } from '../ui/exportDialog.js';
import { openRecorder } from '../ui/recorder.js';
import { db, uid } from '../db.js';
import { createClip, addClip, clipEnd, trackKindFor, createTrack, pasteClips, projectDuration, rippleDelete, changeAspect, ASPECTS } from '../project.js';
import { effectsPanel, transitionsPanel, filtersPanel } from '../ui/editPanels.js';
import { logoMark } from '../../components/logo.js';
import { SHAPES } from '../stickers.js';
import { formatTime, AUDIO_ACCEPT, ACCEPT_ATTR, importFile, importFiles } from '../media.js';
import { detectSilences, normalizationGain, detectPeaks } from '../engine/analysis.js';
import { parseSubtitles, toSrt, toVtt, lintSubtitles, cuesFromSegments } from '../subtitles.js';
import { planRequest, ASSISTANT_EXAMPLES } from '../assistant.js';
import { getPrefs, setPrefs } from '../../lib/prefs.js';
import { getCapabilities } from '../../lib/state.js';
import { api } from '../../lib/api.js';
import { isStatic } from '../../lib/env.js';

const say = (message, type = 'info') => toast(message, { type });

export async function videoEditorPage({ params }) {
  const id = params.get('id');
  const opened = id ? await openProject(id).catch(() => null) : null;
  if (!opened || opened.project.type !== 'video') {
    return {
      title: 'Projet introuvable',
      el: h(
        'div',
        { class: 'page container', style: { padding: '80px 0' } },
        h('h1', {}, 'Projet introuvable'),
        h('p', {}, 'Ce projet n’existe pas dans ce navigateur.'),
        h('a', { class: 'btn btn--primary', href: '/projets', 'data-link': '' }, 'Retour aux projets'),
      ),
    };
  }
  let project = opened.project;
  if (opened.recovery) {
    const restore = await confirmDialog({
      title: 'Modifications non enregistrées trouvées',
      message: `Une version plus récente (${new Date(opened.recovery.updatedAt).toLocaleString('fr-FR')}) n’avait pas été sauvegardée, probablement après une interruption. La récupérer ?`,
      confirmLabel: 'Récupérer',
    });
    if (restore) project = opened.recovery;
  }

  const store = new EditorStore(project);
  const mediaIndex = new Map();
  let clipboard = [];
  let colorClipboard = null;
  let animClipboard = null;
  const caps = getCapabilities();

  // ---------------------------------------------------------------- preview
  const canvas = h('canvas', { class: 'preview-canvas', 'aria-label': 'Aperçu du montage' });
  const player = new Player({
    canvas,
    getProject: () => store.project,
    onTime: (t) => {
      store.setTime(t);
      timeLabel.textContent = `${formatTime(t, store.project.settings.fps, true)} / ${formatTime(projectDuration(store.project))}`;
      timeline.updatePlayhead(t);
    },
    onState: (playing) => {
      playBtn.replaceChildren(icon(playing ? 'pause' : 'play'));
      playBtn.setAttribute('aria-label', playing ? 'Pause (Espace)' : 'Lecture (Espace)');
    },
  });
  const fitCanvas = () => {
    const { width, height } = store.project.settings;
    const box = stageBox.getBoundingClientRect();
    const scale = Math.min(box.width / width, box.height / height) || 0.3;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${Math.floor(width * scale)}px`;
    canvas.style.height = `${Math.floor(height * scale)}px`;
    // Preview renders at display resolution (capped) for speed; export uses full size.
    const pw = Math.min(width, Math.round(width * scale * dpr));
    canvas.width = Math.max(2, pw - (pw % 2));
    canvas.height = Math.max(2, Math.round((canvas.width * height) / width));
    player.requestRender();
  };

  const playBtn = h('button', { class: 'btn btn--icon btn--primary', type: 'button', 'aria-label': 'Lecture (Espace)' }, icon('play'));
  playBtn.addEventListener('click', () => player.toggle());
  const timeLabel = h('span', { class: 'time-label', 'aria-live': 'off' }, '00:00:00');
  const loopBtn = h(
    'button',
    { class: 'btn btn--sm btn--ghost', type: 'button', 'aria-pressed': 'false', title: 'Lecture en boucle' },
    icon('refresh'),
  );
  loopBtn.addEventListener('click', () => {
    player.loop = !player.loop;
    loopBtn.setAttribute('aria-pressed', String(player.loop));
  });
  const step = (dt) => seek(store.time + dt);
  let syncMute = () => {};
  function volumeCtl() {
    const input = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: '1', 'aria-label': 'Volume de l’aperçu (n’affecte pas l’export)' });
    const mute = h('button', { class: 'btn btn--sm btn--ghost', type: 'button', 'aria-label': 'Couper le son de l’aperçu', title: 'Volume de l’aperçu (n’affecte pas l’export)' }, '🔊');
    let last = 1;
    const apply = (v) => {
      monitor = v;
      player.setMonitorVolume(v);
      input.value = String(v);
      mute.textContent = v === 0 ? '🔇' : '🔊';
    };
    syncMute = () => {
      input.value = String(monitor);
      mute.textContent = monitor === 0 ? '🔇' : '🔊';
    };
    input.addEventListener('input', () => apply(Number(input.value)));
    mute.addEventListener('click', () => {
      if (Number(input.value) > 0) {
        last = Number(input.value);
        apply(0);
      } else apply(last || 1);
    });
    return h('span', { class: 'preview-volume' }, mute, input);
  }
  // « Audio » shortcut next to the player: playback volume, library, import, selected clip volume.
  let monitor = 1;
  function audioButton() {
    const pop = h('div', { class: 'audio-pop', role: 'dialog', 'aria-label': 'Audio', hidden: true });
    const button = h('button', { class: 'btn btn--sm preview-audio-btn', type: 'button', 'aria-expanded': 'false', 'aria-haspopup': 'dialog' }, icon('music', { size: 16 }), h('span', {}, 'Audio'));
    const fileInput = h('input', { type: 'file', multiple: true, accept: AUDIO_ACCEPT, hidden: true });
    fileInput.addEventListener('change', async () => {
      const files = [...fileInput.files];
      fileInput.value = '';
      const { results, errors } = await importFiles(files);
      errors.forEach((e) => say(e, 'error'));
      if (results.length) library.onImported(results);
      await library.reloadMedia();
      for (const m of results) await addPayload({ type: 'media', id: m.id, role: 'music' });
      if (results.length) say(`${results.length} fichier(s) audio ajouté(s) sur la piste Musique.`, 'success');
    });
    const close = () => {
      pop.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    };
    const draw = () => {
      const clip = store.project.clips.find((c) => c.id === store.selection[0] && (c.kind === 'audio' || c.kind === 'video'));
      const vol = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: String(monitor), 'aria-label': 'Volume de lecture' });
      vol.addEventListener('input', () => {
        monitor = Number(vol.value);
        player.setMonitorVolume(monitor);
        syncMute();
      });
      const clipVol = clip
        ? (() => {
            const input = h('input', { type: 'range', min: 0, max: 2, step: 0.01, value: String(clip.audio?.volume ?? 1), 'aria-label': 'Volume du clip sélectionné' });
            const out = h('output', {}, `${Math.round((clip.audio?.volume ?? 1) * 100)} %`);
            input.addEventListener('input', () => (out.textContent = `${Math.round(Number(input.value) * 100)} %`));
            input.addEventListener('change', () => inspector.edit('Volume du clip', (c) => ((c.audio.volume = Number(input.value)), c)));
            return h('label', { class: 'audio-pop__row' }, h('span', {}, `Clip « ${clip.name || clip.kind} »`), input, out);
          })()
        : h('p', { class: 'field__hint' }, 'Sélectionnez un clip pour régler son volume ici.');
      clear(pop).append(
        h('strong', {}, 'Audio du montage'),
        h('label', { class: 'audio-pop__row' }, h('span', {}, 'Volume de lecture'), vol, h('output', {}, `${Math.round(monitor * 100)} %`)),
        h('p', { class: 'field__hint' }, 'N’affecte que l’écoute, pas l’export.'),
        clipVol,
        h(
          'div',
          { class: 'insp-actions' },
          h('button', { class: 'btn btn--sm', type: 'button', onclick: () => (close(), openAudioLibrary()) }, icon('music', { size: 16 }), 'Bibliothèque audio'),
          h('label', { class: 'btn btn--sm' }, icon('upload', { size: 16 }), 'Importer un fichier audio', fileInput),
        ),
      );
    };
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!pop.hidden) return close();
      draw();
      pop.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      pop.querySelector('input')?.focus();
    });
    pop.addEventListener('click', (event) => event.stopPropagation());
    document.addEventListener('click', close);
    pop.addEventListener('keydown', (event) => event.key === 'Escape' && (close(), button.focus()));
    return h('span', { class: 'audio-pop-wrap' }, button, pop);
  }
  function openAudioLibrary() {
    library.setTab('audio');
    el.dataset.panel = '';
    if (window.matchMedia('(max-width: 900px)').matches) el.dataset.sheet = 'library';
    drawCats?.();
  }

  const aspectSel = h(
    'select',
    { class: 'select select--sm preview-aspect', 'aria-label': 'Format du projet', title: 'Format du projet' },
    Object.entries(ASPECTS).map(([id, a]) => h('option', { value: id }, a.label)),
  );
  aspectSel.value = store.project.settings.aspect;
  aspectSel.addEventListener('change', () => store.commit('Format du projet', changeAspect(store.project, aspectSel.value)));
  const fullBtn = h(
    'button',
    { class: 'btn btn--sm btn--ghost', type: 'button', title: 'Plein écran', 'aria-label': 'Aperçu plein écran' },
    icon('expand'),
  );
  fullBtn.addEventListener('click', () => (document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen?.()));
  const transport = h(
    'div',
    { class: 'transport' },
    h('button', { class: 'btn btn--sm btn--ghost', type: 'button', 'aria-label': 'Début', onclick: () => seek(0) }, '⏮'),
    h(
      'button',
      {
        class: 'btn btn--sm btn--ghost',
        type: 'button',
        'aria-label': 'Image précédente',
        onclick: () => step(-1 / store.project.settings.fps),
      },
      '◀',
    ),
    playBtn,
    h(
      'button',
      {
        class: 'btn btn--sm btn--ghost',
        type: 'button',
        'aria-label': 'Image suivante',
        onclick: () => step(1 / store.project.settings.fps),
      },
      '▶',
    ),
    h(
      'button',
      { class: 'btn btn--sm btn--ghost', type: 'button', 'aria-label': 'Fin', onclick: () => seek(projectDuration(store.project)) },
      '⏭',
    ),
    timeLabel,
    loopBtn,
    h('span', { class: 'tl-spacer' }),
    volumeCtl(),
    audioButton(),
    aspectSel,
    fullBtn,
  );
  const stageBox = h('div', { class: 'preview-box' }, canvas);
  const stage = h('section', { class: 'preview', 'aria-label': 'Aperçu' }, stageBox, transport);

  function seek(t) {
    if (player.playing) player.pause();
    player.seek(t);
  }

  // Direct manipulation: drag the selected visual clip in the preview.
  let pickMode = null;
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const nx = (event.clientX - rect.left) / rect.width;
    const ny = (event.clientY - rect.top) / rect.height;
    if (pickMode) return pickMode(nx, ny, event);
    const t = store.time;
    const candidates = store.project.clips.filter(
      (c) => t >= c.start && t < clipEnd(c) && c.kind !== 'audio' && !store.project.tracks.find((tr) => tr.id === c.trackId)?.locked,
    );
    const target =
      candidates.find((c) => store.selection.includes(c.id)) ||
      candidates.find((c) => c.kind === 'text' || c.kind === 'sticker' || c.kind === 'shape') ||
      candidates.at(-1);
    if (!target) return;
    if (!store.selection.includes(target.id)) store.select([target.id]);
    const before = store.project;
    const base = target.transform;
    canvas.setPointerCapture(event.pointerId);
    const move = (e) => {
      const dx = (e.clientX - event.clientX) / rect.width;
      const dy = (e.clientY - event.clientY) / rect.height;
      store.preview({
        ...before,
        clips: before.clips.map((c) => (c.id === target.id ? { ...c, transform: { ...c.transform, x: base.x + dx, y: base.y + dy } } : c)),
      });
      player.requestRender();
    };
    const up = () => {
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      if (store.project !== before) store.finishGesture('Déplacer dans l’aperçu', before);
    };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
  });

  // ---------------------------------------------------------------- adding content
  function trackFor(kind, preferred) {
    const want = trackKindFor(kind);
    const p = store.project;
    if (preferred) {
      const t = p.tracks.find((tr) => tr.id === preferred);
      if (t && t.kind === want && !t.locked) return { project: p, track: t };
    }
    let track =
      p.tracks.find((tr) => tr.kind === want && !tr.locked && (want !== 'video' || tr.name === 'Vidéo')) ||
      p.tracks.find((tr) => tr.kind === want && !tr.locked);
    if (track) return { project: p, track };
    track = createTrack(want);
    return { project: { ...p, tracks: want === 'audio' ? [...p.tracks, track] : [track, ...p.tracks] }, track };
  }

  async function addPayload(payload, { trackId, time, placeholder } = {}) {
    const at = time ?? store.time;
    let clip;
    if (payload.type === 'media') {
      const media = mediaIndex.get(payload.id) || (await db.getMedia(payload.id));
      if (!media) return say('Média introuvable.', 'error');
      mediaIndex.set(media.id, media);
      const duration = media.kind === 'image' ? getPrefs().defaultImageDuration : media.duration || 5;
      clip = createClip(media.kind, {
        mediaId: media.id,
        duration: placeholder ? Math.min(placeholder.duration, media.kind === 'image' ? Infinity : duration) : duration,
        name: media.name,
      });
      if (placeholder) {
        clip.start = placeholder.start;
        clip.trackId = placeholder.trackId;
        clip.transitionIn = placeholder.transitionIn;
        clip.fit = 'cover';
        const next = { ...store.project, clips: store.project.clips.filter((c) => c.id !== placeholder.id).concat(clip) };
        store.commit('Remplacer l’emplacement', next, { select: [clip.id] });
        await player.prepare();
        return;
      }
    } else if (payload.type === 'text') {
      const preset = TEXT_PRESETS.find((p) => p.id === payload.preset) || TEXT_PRESETS[0];
      clip = createClip('text', {
        duration: 4,
        text: preset.text,
        transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0, opacity: 1, ...(preset.transform || {}) },
        name: preset.label,
      });
    } else if (payload.type === 'sticker') {
      clip = createClip('sticker', {
        duration: 3,
        sticker: { emoji: payload.emoji },
        name: `Sticker ${payload.emoji}`,
        transform: { x: 0.5, y: 0.5, scale: 0.8, rotation: 0, opacity: 1 },
      });
    } else if (payload.type === 'shape') {
      const shape = SHAPES.find((s) => s.id === payload.id);
      clip = createClip('shape', { duration: 4, shape: { ...shape.shape }, name: shape.label });
    }
    if (!clip) return;
    let { project: p, track } = trackFor(clip.kind, trackId);
    if (payload.role) {
      const roleTrack = p.tracks.find((tr) => tr.kind === 'audio' && tr.role === payload.role && !tr.locked);
      if (roleTrack) track = roleTrack;
    }
    // Overlays (text, stickers, shapes) go on the overlay track when no track was chosen.
    if (!trackId && ['sticker', 'shape'].includes(clip.kind)) {
      const overlay = p.tracks.find((tr) => tr.kind === 'video' && tr.name === 'Superposition' && !tr.locked);
      if (overlay) track = overlay;
    }
    clip.trackId = track.id;
    clip.start = Math.max(0, at);
    store.commit(`Ajouter ${clip.name || clip.kind}`, addClip(p, clip), { select: [clip.id] });
    await player.prepare();
    player.requestRender();
  }

  // ---------------------------------------------------------------- panels
  const projectMediaIds = () => [...new Set([...(store.project.mediaIds || []), ...store.project.clips.map((c) => c.mediaId).filter(Boolean)])];
  const panelCtx = { store, say, openInspector: (tab) => openInspector(tab) };
  const library = new Library({
    onAdd: (payload) => addPayload(payload),
    onMediaChange: (list) => {
      mediaIndex.clear();
      list.forEach((m) => mediaIndex.set(m.id, m));
      timeline?.render();
    },
    toast: say,
    externalTabs: true,
    getProjectMediaIds: projectMediaIds,
    onImported: (results) => {
      const ids = projectMediaIds();
      const added = results.map((m) => m.id).filter((id) => !ids.includes(id));
      if (added.length) store.commit('Importer dans le projet', { ...store.project, mediaIds: [...(store.project.mediaIds || []), ...added] });
    },
    onRecord: (mode) => recordToProject(mode),
    panels: {
      effects: { label: 'Effets', icon: 'sparkles', render: (body) => effectsPanel(body, panelCtx) },
      transitions: { label: 'Transitions', icon: 'shuffle', render: (body) => transitionsPanel(body, panelCtx) },
      filters: { label: 'Filtres', icon: 'sun', render: (body) => filtersPanel(body, panelCtx) },
      subtitles: { label: 'Sous-titres', icon: 'info', render: (body) => renderSubtitles(body) },
      ai: { label: 'Outils IA', icon: 'wand', render: (body) => renderAiTools(body) },
    },
  });
  library.onClose = () => setSheet('');
  const CONTEXT_PANELS = ['effects', 'transitions', 'filters', 'subtitles', 'ai'];

  function recordToProject(mode = 'screen') {
    openRecorder({
      mode,
      onRecorded: async (meta) => {
        library.onImported([meta]);
        await library.reloadMedia();
        addPayload({ type: 'media', id: meta.id });
      },
    });
  }

  function renderAiTools(body) {
    const clip = store.project.clips.find((c) => c.id === store.selection[0]);
    const media = clip && (clip.kind === 'video' || clip.kind === 'audio') && clip.mediaId ? clip : null;
    const tool = (label, text, fn, disabled, why) =>
      h(
        'div',
        { class: 'ai-tool' },
        h('div', {}, h('strong', {}, label), h('p', { class: 'field__hint' }, disabled && why ? why : text)),
        h('button', { class: 'btn btn--sm', type: 'button', disabled, onclick: fn }, 'Lancer'),
      );
    const needClip = 'Sélectionnez d’abord un clip vidéo ou audio dans la timeline.';
    body.append(
      h('button', { class: 'btn btn--primary btn--block', type: 'button', onclick: openAssistant }, icon('sparkles'), 'Assistant de montage'),
      h('p', { class: 'field__hint' }, 'Outils calculés dans votre navigateur ; aucune donnée n’est envoyée, sauf la transcription (service configuré sur le serveur).'),
      tool('Couper les silences', 'Détecte les passages silencieux du clip et les retire.', () => actions.cutSilences(media), !media, needClip),
      tool('Normaliser le volume', 'Règle le gain pour un pic à −1 dBFS.', () => actions.normalize(media), !media, needClip),
      tool('Repérer les saturations', 'Place un marqueur sur chaque pic audio saturé.', () => actions.findPeaks(media), !media, needClip),
      tool(
        'Sous-titres automatiques',
        caps?.transcription?.model ? 'Transcrit l’audio en sous-titres modifiables.' : isStatic() ? 'Indisponible sans le serveur SOLVEX.' : 'Service de transcription non configuré sur le serveur (OPENAI_API_KEY).',
        () => library.setTab('subtitles'),
        false,
      ),
      tool('Incrustation (fond vert)', 'Retire une couleur de fond du clip sélectionné.', () => openInspector('mask'), !(clip && (clip.kind === 'video' || clip.kind === 'image')), 'Sélectionnez un clip vidéo ou image.'),
    );
  }

  const timeline = new Timeline({
    store,
    player,
    mediaIndex,
    toast: say,
    onSeek: seek,
    onDropMedia: (payload, target) => addPayload(payload, target),
  });

  const actions = {
    toast: say,
    seek,
    layer(dir) {
      const clip = inspector.clip;
      if (!clip) return;
      const p = store.project;
      const same = p.tracks.filter((t) => t.kind === p.tracks.find((x) => x.id === clip.trackId).kind);
      const index = same.findIndex((t) => t.id === clip.trackId);
      const target = same[index - dir];
      if (!target) return say(dir > 0 ? 'Déjà sur la piste la plus haute.' : 'Déjà sur la piste la plus basse.');
      store.commit('Ordre des calques', { ...p, clips: p.clips.map((c) => (c.id === clip.id ? { ...c, trackId: target.id } : c)) });
    },
    copyColor(clip) {
      colorClipboard = { ...clip.color };
      say('Réglages de couleur copiés.', 'success');
    },
    pasteColor() {
      if (!colorClipboard) return say('Copiez d’abord les réglages d’un clip.');
      inspector.edit('Coller la couleur', (c) => ((c.color = { ...colorClipboard }), c));
    },
    copyAnimation(clip) {
      animClipboard = structuredClone(clip.keyframes || {});
      say('Animation copiée.', 'success');
    },
    pasteAnimation() {
      if (!animClipboard) return say('Copiez d’abord l’animation d’un clip.');
      inspector.edit('Coller l’animation', (c) => ((c.keyframes = structuredClone(animClipboard)), c));
    },
    detachAudio(clip) {
      const { project: withTrack, track } = trackFor('audio');
      const audioClip = createClip('audio', {
        mediaId: clip.mediaId,
        start: clip.start,
        duration: clip.duration,
        in: clip.in,
        speed: clip.speed,
        name: `${clip.name || 'Audio'} (audio)`,
        audio: { ...clip.audio },
        trackId: track.id,
      });
      const next = addClip({ ...withTrack, clips: withTrack.clips.map((c) => (c.id === clip.id ? { ...c, muted: true } : c)) }, audioClip);
      store.commit('Détacher l’audio', next, { select: [audioClip.id] });
      player.prepare();
    },
    async normalize(clip) {
      try {
        const gain = await normalizationGain(clip.mediaId);
        inspector.edit('Normaliser', (c) => ((c.audio.volume = Math.min(4, gain)), c));
        say(`Volume réglé à ${Math.round(gain * 100)} % (pic à −1 dBFS).`, 'success');
      } catch (error) {
        say(error.message, 'error');
      }
    },
    async cutSilences(clip) {
      try {
        const ranges = (await detectSilences(clip.mediaId))
          .map(([a, b]) => [clip.start + (a - clip.in) / clip.speed, clip.start + (b - clip.in) / clip.speed])
          .map(([a, b]) => [Math.max(clip.start, a), Math.min(clipEnd(clip), b)])
          .filter(([a, b]) => b - a > 0.15)
          .sort((x, y) => y[0] - x[0]);
        if (!ranges.length) return say('Aucun silence détecté (seuil −40 dB, 0,6 s minimum).');
        const ok = await confirmDialog({
          title: 'Couper les silences',
          message: `${ranges.length} silence(s) trouvé(s) (${ranges.reduce((s, [a, b]) => s + b - a, 0).toFixed(1)} s). Les retirer et resserrer le montage ?`,
          confirmLabel: 'Couper',
        });
        if (!ok) return;
        const trackIds = store.project.tracks.filter((t) => !t.locked).map((t) => t.id);
        store.commit(
          'Couper les silences',
          ranges.reduce((p, [a, b]) => rippleDelete(p, a, b, trackIds), store.project),
          { select: [] },
        );
      } catch (error) {
        say(error.message, 'error');
      }
    },
    async findPeaks(clip) {
      try {
        const peaks = await detectPeaks(clip.mediaId);
        if (!peaks.length) return say('Aucune saturation détectée (pics ≥ 98 %).', 'success');
        const p = store.project;
        const markers = peaks
          .slice(0, 50)
          .map((t) => ({ id: uid('k'), t: clip.start + (t - clip.in) / clip.speed, label: 'Pic audio', color: '#FF5C7A' }))
          .filter((m) => m.t >= clip.start && m.t <= clipEnd(clip));
        store.commit('Marquer les pics audio', { ...p, markers: [...p.markers, ...markers] });
        say(`${markers.length} pic(s) marqué(s) dans la timeline.`);
      } catch (error) {
        say(error.message, 'error');
      }
    },
    pickChroma() {
      say('Cliquez sur la couleur à retirer dans l’aperçu.');
      pickMode = (nx, ny) => {
        pickMode = null;
        const ctx = canvas.getContext('2d');
        const [r, g, b] = ctx.getImageData(Math.floor(nx * canvas.width), Math.floor(ny * canvas.height), 1, 1).data;
        const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
        inspector.edit('Pipette de chrominance', (c) => ((c.chroma.color = hex), c));
      };
    },
    drawMask() {
      say('Cliquez pour placer les points du masque, double-cliquez pour terminer.');
      const points = [];
      pickMode = (nx, ny, event) => {
        if (event.detail >= 2) {
          pickMode = null;
          if (points.length > 2)
            inspector.edit('Tracé du masque', (c) => ((c.mask = { ...c.mask, type: 'polygon', points: [...points] }), c));
          return;
        }
        points.push([nx, ny]);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#45E5F5';
        ctx.beginPath();
        ctx.arc(nx * canvas.width, ny * canvas.height, 5, 0, Math.PI * 2);
        ctx.fill();
      };
    },
    addText: () => addPayload({ type: 'text', preset: 'title' }),
    revertTo(index) {
      const state = store.history.revertTo(index, store.project);
      store.project = state;
      store.journal();
      store.scheduleSave();
      store.emit('project');
    },
    renderSubtitles: (body) => renderSubtitles(body),
    replaceMedia(clip) {
      const input = h('input', { type: 'file', accept: clip.kind === 'audio' ? AUDIO_ACCEPT : ACCEPT_ATTR });
      input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;
        try {
          const media = await importFile(file);
          if (media.kind !== clip.kind && !(clip.kind === 'video' && media.kind === 'image')) throw new Error('Choisissez un fichier du même type que le clip.');
          library.onImported([media]);
          await library.reloadMedia();
          const max = media.duration ? Math.max(0.1, media.duration / (clip.speed || 1)) : clip.duration;
          inspector.edit('Remplacer le fichier', (c) => ((c.mediaId = media.id), (c.name = media.name), (c.in = 0), (c.duration = Math.min(c.duration, max)), c));
          await player.prepare();
          say(`Fichier remplacé par « ${media.name} ».`, 'success');
        } catch (error) {
          say(error.message, 'error');
        }
      });
      input.click();
    },
    fitToVideo(clip) {
      // Ends the music with the last image of the montage, with a 2 s fade-out.
      const end = Math.max(0, ...store.project.clips.filter((c) => c.kind !== 'audio').map(clipEnd));
      if (end <= clip.start) return say('Aucune image après le début de ce son : ajoutez d’abord des clips vidéo ou image.');
      const media = mediaIndex.get(clip.mediaId);
      const available = media?.duration ? (media.duration - clip.in) / (clip.speed || 1) : Infinity;
      const duration = Math.min(end - clip.start, available);
      inspector.edit('Ajuster à la durée de la vidéo', (c) => ((c.duration = duration), (c.audio.fadeOut = Math.min(2, duration / 2)), c));
      say(duration < end - clip.start ? 'Le son est plus court que la vidéo : il s’arrête à la fin du fichier.' : 'Le son se termine avec la vidéo (fondu de 2 s).', 'success');
    },
    removeClip(clip) {
      store.commit('Supprimer le son', { ...store.project, clips: store.project.clips.filter((c) => c.id !== clip.id) }, { select: [] });
    },
  };
  const inspector = new Inspector({ store, player, mediaIndex, actions });

  // ---------------------------------------------------------------- subtitles panel
  function renderSubtitles(body) {
    const p = store.project;
    const cues = p.subtitles || [];
    const issues = lintSubtitles(cues);
    const setCues = (label, next) => store.commit(label, { ...store.project, subtitles: next.sort((a, b) => a.start - b.start) });
    const list = h('div', { class: 'sub-list' });
    cues.forEach((cue) => {
      const text = h('textarea', {
        class: 'textarea textarea--sm',
        rows: 2,
        spellcheck: 'true',
        lang: 'fr',
        'aria-label': 'Texte du sous-titre',
      });
      text.value = cue.text;
      text.addEventListener('change', () =>
        setCues(
          'Modifier un sous-titre',
          cues.map((c) => (c.id === cue.id ? { ...c, text: text.value } : c)),
        ),
      );
      const num = (value, label, key) => {
        const input = h('input', {
          class: 'input input--sm',
          type: 'number',
          step: '0.01',
          min: '0',
          value: value.toFixed(2),
          'aria-label': label,
        });
        input.addEventListener('change', () =>
          setCues(
            'Synchroniser un sous-titre',
            cues.map((c) => (c.id === cue.id ? { ...c, [key]: Number(input.value) } : c)),
          ),
        );
        return input;
      };
      const cueIssues = issues.filter((i) => i.id === cue.id);
      list.append(
        h(
          'div',
          { class: `sub-item${cueIssues.length ? ' has-issue' : ''}` },
          h(
            'div',
            { class: 'sub-times' },
            h('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: () => seek(cue.start), title: 'Aller' }, '▶'),
            num(cue.start, 'Début', 'start'),
            '→',
            num(cue.end, 'Fin', 'end'),
            h(
              'button',
              {
                class: 'btn btn--sm btn--ghost',
                type: 'button',
                'aria-label': 'Supprimer',
                onclick: () =>
                  setCues(
                    'Supprimer un sous-titre',
                    cues.filter((c) => c.id !== cue.id),
                  ),
              },
              '✕',
            ),
          ),
          text,
          ...cueIssues.map((i) => h('p', { class: 'field__hint field__hint--warn' }, i.message)),
        ),
      );
    });
    const add = h('button', { class: 'btn btn--sm', type: 'button' }, '+ Sous-titre au curseur');
    add.addEventListener('click', () =>
      setCues('Ajouter un sous-titre', [...cues, { id: uid('s'), start: store.time, end: store.time + 2.5, text: 'Nouveau sous-titre' }]),
    );
    const file = h('input', { type: 'file', accept: '.srt,.vtt,text/vtt', hidden: true });
    file.addEventListener('change', async () => {
      const f = file.files[0];
      if (!f) return;
      const parsed = parseSubtitles(await f.text());
      if (!parsed.length) return say('Aucun sous-titre lisible dans ce fichier.', 'error');
      setCues('Importer des sous-titres', [...cues, ...parsed]);
      say(`${parsed.length} sous-titre(s) importé(s).`, 'success');
    });
    const download = (content, ext, type) => {
      saveFile(new Blob([content], { type }), `${store.project.name}.${ext}`).catch((error) => say(error.message, 'error'));
    };
    const transcribe = h('button', { class: 'btn btn--sm', type: 'button' }, icon('sparkles'), 'Transcrire automatiquement');
    const transcriptionModel = caps?.transcription?.model;
    if (!transcriptionModel) {
      transcribe.disabled = true;
      transcribe.title = isStatic() ? 'Indisponible dans la version sans serveur' : 'Service non configuré (OPENAI_TRANSCRIBE_MODEL)';
    }
    transcribe.addEventListener('click', async () => {
      const clip = store.project.clips.find((c) => (c.kind === 'video' || c.kind === 'audio') && c.mediaId);
      if (!clip) return say('Ajoutez d’abord un clip audio ou vidéo.');
      setBusy(transcribe, true);
      try {
        const blob = await db.getBlob(clip.mediaId);
        const result = await api.transcribe(blob);
        const segments = result.segments
          .map((s) => ({
            start: clip.start + (s.start - clip.in) / clip.speed,
            end: clip.start + ((s.end ?? clip.in + clip.duration * clip.speed) - clip.in) / clip.speed,
            text: s.text,
          }))
          .filter((s) => s.end > clip.start && s.start < clipEnd(clip));
        setCues('Transcription automatique', [...cues, ...cuesFromSegments(segments)]);
        say(
          result.timed
            ? 'Transcription ajoutée : relisez et corrigez les sous-titres.'
            : 'Transcription ajoutée en un seul bloc (le modèle ne fournit pas de minutage) : découpez-la manuellement.',
          'success',
        );
      } catch (error) {
        say(error.message, 'error');
      } finally {
        setBusy(transcribe, false);
      }
    });
    const style = p.subtitleStyle;
    const styleRow = (label, control) => h('div', { class: 'insp-row insp-row--select' }, h('label', {}, label), control);
    const size = h('input', { type: 'range', min: 20, max: 120, value: String(style.size) });
    size.addEventListener('change', () =>
      store.commit('Taille des sous-titres', { ...store.project, subtitleStyle: { ...style, size: Number(size.value) } }),
    );
    const pos = h('input', { type: 'range', min: 0.1, max: 0.95, step: 0.01, value: String(style.position) });
    pos.addEventListener('change', () =>
      store.commit('Position des sous-titres', { ...store.project, subtitleStyle: { ...style, position: Number(pos.value) } }),
    );
    const color = h('input', { type: 'color', value: style.color });
    color.addEventListener('change', () =>
      store.commit('Couleur des sous-titres', { ...store.project, subtitleStyle: { ...style, color: color.value } }),
    );
    const hl = h('input', { type: 'color', value: style.highlight });
    hl.addEventListener('change', () =>
      store.commit('Couleur de mise en évidence', { ...store.project, subtitleStyle: { ...style, highlight: hl.value } }),
    );
    body.append(
      h(
        'div',
        { class: 'insp-section' },
        h(
          'div',
          { class: 'insp-actions' },
          add,
          h('label', { class: 'btn btn--sm' }, 'Importer .srt/.vtt', file),
          h(
            'button',
            {
              class: 'btn btn--sm',
              type: 'button',
              disabled: !cues.length,
              onclick: () => download(toSrt(cues), 'srt', 'application/x-subrip'),
            },
            'Exporter .srt',
          ),
          h(
            'button',
            { class: 'btn btn--sm', type: 'button', disabled: !cues.length, onclick: () => download(toVtt(cues), 'vtt', 'text/vtt') },
            'Exporter .vtt',
          ),
          transcribe,
        ),
        h(
          'p',
          { class: 'field__hint' },
          'Mettez un mot entre *astérisques* pour le mettre en évidence. Une transcription automatique n’est jamais parfaite : relisez-la.',
        ),
      ),
      h(
        'div',
        { class: 'insp-section' },
        h('h3', {}, 'Style'),
        styleRow('Taille', size),
        styleRow('Position verticale', pos),
        styleRow('Couleur', color),
        styleRow('Mise en évidence', hl),
      ),
      h(
        'div',
        { class: 'insp-section' },
        h('h3', {}, `${cues.length} sous-titre(s)${issues.length ? ` · ${issues.length} alerte(s)` : ''}`),
        list,
      ),
    );
  }

  // ---------------------------------------------------------------- assistant
  function openAssistant() {
    const input = h('textarea', {
      class: 'textarea',
      rows: 2,
      placeholder: 'Ex. : coupe les silences de cette vidéo',
      'aria-label': 'Demande à l’assistant',
    });
    const output = h('div', { class: 'assistant-output', 'aria-live': 'polite' });
    const send = h('button', { class: 'btn btn--primary', type: 'button' }, icon('sparkles'), 'Analyser la demande');
    const examples = h(
      'div',
      { class: 'chips' },
      ASSISTANT_EXAMPLES.slice(0, 8).map((e) =>
        h('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: () => ((input.value = e), send.click()) }, e),
      ),
    );
    send.addEventListener('click', async () => {
      const text = input.value.trim();
      if (!text) return;
      setBusy(send, true);
      output.replaceChildren(h('p', { class: 'field__hint' }, 'Analyse en cours…'));
      try {
        const plan = await planRequest(text, {
          project: store.project,
          selection: store.selection,
          time: store.time,
          transcription: Boolean(caps?.transcription?.model),
        });
        if (plan.message) {
          output.replaceChildren(h('p', { class: 'assistant-msg' }, plan.message));
          return;
        }
        const accept = h('button', { class: 'btn btn--primary', type: 'button' }, icon('check'), 'Appliquer');
        const refuse = h('button', { class: 'btn btn--ghost', type: 'button' }, 'Refuser');
        refuse.addEventListener('click', () => output.replaceChildren(h('p', { class: 'field__hint' }, 'Aucune modification appliquée.')));
        accept.addEventListener('click', () => {
          if (plan.kind === 'undo') {
            const last = store.history.past.at(-1);
            if (!last || !last.label.startsWith('Assistant'))
              return output.replaceChildren(
                h('p', { class: 'assistant-msg' }, 'La dernière modification ne vient pas de l’assistant : rien n’a été annulé.'),
              );
            store.undo();
            return output.replaceChildren(h('p', { class: 'assistant-msg' }, `Annulé : ${last.label}.`));
          }
          if (plan.kind === 'transcribe') {
            library.setTab('subtitles');
            drawCats();
            return output.replaceChildren(
              h('p', { class: 'assistant-msg' }, 'Le panneau Sous-titres est ouvert : utilisez « Transcrire automatiquement ».'),
            );
          }
          const before = store.project;
          const next = plan.apply(before);
          store.commit(`Assistant : ${text.slice(0, 40)}`, next, { select: [] });
          player.prepare().then(() => player.requestRender());
          output.replaceChildren(
            h(
              'p',
              { class: 'assistant-msg' },
              `Appliqué : ${plan.summary} (annulable avec Ctrl+Z ou « annule la dernière modification »).`,
            ),
          );
        });
        output.replaceChildren(
          h('p', { class: 'assistant-msg' }, plan.summary),
          h(
            'ul',
            { class: 'assistant-actions' },
            plan.actions.map((a) => h('li', {}, a)),
          ),
          h('div', { class: 'insp-actions' }, accept, refuse),
        );
      } catch (error) {
        output.replaceChildren(h('p', { class: 'field__hint field__hint--warn' }, `Erreur : ${error.message}`));
      } finally {
        setBusy(send, false);
      }
    });
    input.addEventListener('keydown', (e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send.click()));
    const modal = openModal(
      h(
        'div',
        { class: 'dialog__body' },
        h('h2', {}, icon('sparkles', { size: 20 }), ' Assistant de montage'),
        h(
          'p',
          { class: 'field__hint' },
          'Assistant local : il propose des modifications vérifiables que vous acceptez ou refusez. Rien n’est modifié sans votre accord.',
        ),
        input,
        examples,
        send,
        output,
      ),
      { label: 'Assistant de montage' },
    );
    modal.dialog.classList.add('dialog--wide');
    input.focus();
  }

  // ---------------------------------------------------------------- toolbar
  const nameInput = h('input', { class: 'editor-name', value: store.project.name, 'aria-label': 'Nom du projet' });
  nameInput.addEventListener('change', () =>
    store.commit('Renommer le projet', { ...store.project, name: nameInput.value.trim() || 'Projet sans titre' }),
  );
  const saveState = h('span', { class: 'save-state', 'aria-live': 'polite' });
  const undoBtn = h(
    'button',
    {
      class: 'btn btn--sm btn--ghost btn--icon',
      type: 'button',
      'aria-label': 'Annuler (Ctrl+Z)',
      title: 'Annuler (Ctrl+Z)',
      onclick: () => doUndo(),
    },
    icon('undo'),
  );
  const redoBtn = h(
    'button',
    {
      class: 'btn btn--sm btn--ghost btn--icon',
      type: 'button',
      'aria-label': 'Rétablir (Ctrl+Y)',
      title: 'Rétablir (Ctrl+Y)',
      onclick: () => doRedo(),
    },
    h('span', { style: { transform: 'scaleX(-1)', display: 'inline-flex' } }, icon('undo')),
  );
  const modeBtn = h('button', { class: 'btn btn--sm btn--ghost editor-mode', type: 'button' });
  const applyMode = () => {
    const mode = getPrefs().editorMode;
    document.documentElement.dataset.editorMode = mode;
    modeBtn.textContent = mode === 'advanced' ? 'Mode avancé' : 'Mode débutant';
    modeBtn.setAttribute('aria-pressed', String(mode === 'advanced'));
  };
  modeBtn.addEventListener('click', () => {
    setPrefs({ editorMode: getPrefs().editorMode === 'advanced' ? 'simple' : 'advanced' });
    applyMode();
    inspector.render();
  });
  applyMode();
  const settingsBtn = h('button', { class: 'btn btn--sm btn--ghost btn--icon', type: 'button', 'aria-label': 'Paramètres du projet', title: 'Paramètres du projet (format, fréquence, fond)' }, icon('settings'));
  settingsBtn.addEventListener('click', () => {
    store.select([]);
    inspector.tab = 'project';
    inspector.render();
    setSheet('inspector');
  });
  const previewBtn = h('button', { class: 'btn btn--sm btn--ghost btn--icon', type: 'button', 'aria-label': 'Aperçu plein écran', title: 'Aperçu plein écran' }, icon('play'));
  previewBtn.addEventListener('click', () => {
    stage.requestFullscreen?.().catch(() => say('Plein écran indisponible dans ce navigateur.'));
    player.play?.();
  });
  const cats = h('nav', { class: 'editor-cats', 'aria-label': 'Catégories' });
  const drawCats = () => {
    cats.replaceChildren(
      ...library.tabs.map(([id, label, ic]) => {
        const b = h('button', { type: 'button', 'aria-pressed': String(library.tab === id && el?.dataset.sheet !== 'inspector'), title: label }, icon(ic, { size: 18 }), h('span', {}, label));
        b.addEventListener('click', () => {
          const same = library.tab === id;
          library.setTab(id);
          if (isMobile()) setSheet(same && el.dataset.sheet === 'library' ? '' : 'library');
          else if (same) el.dataset.panel = el.dataset.panel === 'hidden' ? '' : 'hidden';
          else el.dataset.panel = '';
          drawCats();
        });
        return b;
      }),
    );
  };
  const toolbar = h(
    'header',
    { class: 'editor-bar' },
    h('a', { class: 'editor-logo', href: '/', 'data-link': '', 'aria-label': 'SOLVEX AI, accueil' }, logoMark({ title: '' })),
    h('a', { class: 'btn btn--sm btn--ghost', href: '/projets', 'data-link': '', 'aria-label': 'Retour aux projets', title: 'Retour aux projets' }, '←'),
    nameInput,
    saveState,
    cats,
    h(
      'div',
      { class: 'editor-bar__right' },
      undoBtn,
      redoBtn,
      previewBtn,
      settingsBtn,
      modeBtn,
      h('button', { class: 'btn btn--sm btn--ghost editor-capture', type: 'button', title: 'Enregistrer l’écran, la webcam ou le micro', onclick: () => recordToProject('screen') }, '● Capturer'),
      h('button', { class: 'btn btn--sm editor-save', type: 'button', onclick: () => store.save(thumbnail()).then(() => say('Projet enregistré.', 'success')) }, 'Enregistrer'),
      h(
        'button',
        { class: 'btn btn--sm btn--primary', type: 'button', onclick: () => openExportDialog({ store, player, onSaved: () => library.reloadMedia() }) },
        icon('download'),
        h('span', {}, 'Exporter'),
      ),
    ),
  );
  const isMobile = () => window.matchMedia('(max-width: 900px)').matches;
  function setSheet(name) {
    el.dataset.sheet = name;
    drawCats();
    propsBtn.setAttribute('aria-pressed', String(name === 'inspector'));
  }
  function openInspector(tab) {
    if (store.selection.length) {
      inspector.tab = tab;
      inspector.render();
    }
    if (isMobile()) setSheet('inspector');
  }
  const propsBtn = h('button', { class: 'mobile-props', type: 'button', 'aria-pressed': 'false' }, icon('brush', { size: 18 }), h('span', {}, 'Propriétés'));
  propsBtn.addEventListener('click', () => setSheet(el.dataset.sheet === 'inspector' ? '' : 'inspector'));
  const updateBar = () => {
    undoBtn.disabled = !store.history.canUndo;
    redoBtn.disabled = !store.history.canRedo;
    saveState.textContent = store.saving
      ? 'Enregistrement…'
      : store.lastError
        ? `⚠ ${store.lastError}`
        : store.project.saved
          ? '✓ Enregistré'
          : '● Modifié';
    saveState.dataset.state = store.lastError ? 'error' : store.project.saved ? 'ok' : 'dirty';
  };
  const doUndo = () => {
    const label = store.undo();
    if (label) say(`Annulé : ${label}`);
  };
  const doRedo = () => {
    const label = store.redo();
    if (label) say(`Rétabli : ${label}`);
  };

  function thumbnail() {
    try {
      const c = document.createElement('canvas');
      c.width = 320;
      c.height = Math.round((320 * store.project.settings.height) / store.project.settings.width);
      c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.7);
    } catch {
      return store.project.thumbnail;
    }
  }
  store.thumbnailProvider = thumbnail;

  // ---------------------------------------------------------------- keyboard
  const onKey = (event) => {
    const tag = event.target.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || event.target.isContentEditable || document.querySelector('dialog[open]')) return;
    const ctrl = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    const run = (fn) => {
      event.preventDefault();
      fn();
    };
    if (key === ' ') return run(() => player.toggle());
    if (ctrl && key === 'z') return run(event.shiftKey ? doRedo : doUndo);
    if (ctrl && key === 'y') return run(doRedo);
    if (ctrl && key === 's') return run(() => store.save(thumbnail()).then(() => say('Projet enregistré.', 'success')));
    if (ctrl && key === 'c')
      return run(
        () => (
          (clipboard = store.project.clips.filter((c) => store.selection.includes(c.id)).map((c) => structuredClone(c))),
          clipboard.length && say(`${clipboard.length} élément(s) copié(s).`)
        ),
      );
    if (ctrl && key === 'x')
      return run(
        () => (
          (clipboard = store.project.clips.filter((c) => store.selection.includes(c.id)).map((c) => structuredClone(c))),
          timeline.deleteSelection()
        ),
      );
    if (ctrl && key === 'v')
      return run(() => {
        const { project: next, created } = pasteClips(store.project, clipboard, store.time);
        if (created.length) store.commit('Coller', next, { select: created });
        player.prepare();
      });
    if (ctrl && key === 'd') return run(() => timeline.duplicate());
    if (ctrl && key === 'g') return run(() => timeline.toggleGroup());
    if (ctrl && key === 'a') return run(() => store.select(store.project.clips.map((c) => c.id)));
    if (key === 's') return run(() => timeline.split());
    if (key === 'delete' || key === 'backspace') return run(() => timeline.deleteSelection());
    if (key === 'm') return run(() => timeline.addMarker());
    if (key === 'i') return run(() => timeline.setInOut('in'));
    if (key === 'o') return run(() => timeline.setInOut('out'));
    if (key === 'n') return run(() => timeline.snapBtn.click());
    if (key === 'arrowleft') return run(() => step(event.shiftKey ? -1 : -1 / store.project.settings.fps));
    if (key === 'arrowright') return run(() => step(event.shiftKey ? 1 : 1 / store.project.settings.fps));
    if (key === 'home') return run(() => seek(0));
    if (key === 'end') return run(() => seek(projectDuration(store.project)));
    if (key === '+' || key === '=') return run(() => timeline.setZoom(timeline.zoom * 1.25));
    if (key === '-') return run(() => timeline.setZoom(timeline.zoom / 1.25));
    if (key === 'escape') return run(() => store.select([]));
  };
  window.addEventListener('keydown', onKey);

  // ---------------------------------------------------------------- wiring
  const unsub = store.on((reason) => {
    updateBar();
    if ((reason === 'selection' || reason === 'project') && CONTEXT_PANELS.includes(library.tab) && !library.el.contains(document.activeElement?.closest?.('textarea, input'))) library.render();
    if (reason === 'project' && aspectSel.value !== store.project.settings.aspect) aspectSel.value = store.project.settings.aspect;
    if (reason === 'project' || reason === 'preview') {
      if (nameInput.value !== store.project.name && document.activeElement !== nameInput) nameInput.value = store.project.name;
      if (reason === 'project') player.prepare().then(() => player.requestRender());
      else player.requestRender();
      if (reason === 'project') fitCanvas();
    }
  });
  const onBeforeUnload = (event) => {
    if (!store.project.saved) {
      store.save(thumbnail());
      event.preventDefault();
    }
  };
  window.addEventListener('beforeunload', onBeforeUnload);
  const resize = new ResizeObserver(fitCanvas);

  const mobileNav = h('div', { class: 'editor-mobile-nav' }, propsBtn);
  const el = h(
    'div',
    { class: 'editor', dataset: { mode: getPrefs().editorMode, sheet: '', panel: '' } },
    h('h1', { class: 'sr-only' }, `Éditeur vidéo — ${store.project.name}`),
    toolbar,
    h('div', { class: 'editor-main' }, library.el, stage, inspector.el),
    timeline.el,
    mobileNav,
  );
  drawCats();
  // Phones: the category bar moves to the bottom, panels open as sheets.
  const placeCats = () => {
    if (isMobile()) mobileNav.prepend(cats);
    else toolbar.insertBefore(cats, toolbar.querySelector('.editor-bar__right'));
  };
  const mq = window.matchMedia('(max-width: 900px)');
  mq.addEventListener('change', placeCats);
  placeCats();
  inspector.onClose = () => setSheet('');
  inspector.render();
  requestAnimationFrame(() => {
    resize.observe(stageBox);
    fitCanvas();
    player.prepare().then(() => player.seek(0));
    updateBar();
  });

  return {
    el,
    title: store.project.name,
    fullscreen: true,
    cleanup: () => {
      window.removeEventListener('keydown', onKey);
      mq.removeEventListener('change', placeCats);
      window.removeEventListener('beforeunload', onBeforeUnload);
      resize.disconnect();
      unsub();
      if (!store.project.saved) store.save(thumbnail());
      player.destroy();
    },
  };
}
