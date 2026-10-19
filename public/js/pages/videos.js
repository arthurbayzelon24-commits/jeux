import { h, clear } from '../lib/dom.js';
import { api } from '../lib/api.js';
import { getCapabilities } from '../lib/state.js';
import { render } from '../router.js';
import { chosenProvider, draft, modeSwitch, modelSelect, offlineNotice, resultActions, thirdPartyNotice } from './generationShared.js';
import { icon } from '../components/icons.js';
import { notice, setBusy, toast } from '../components/feedback.js';
import { chipGroup, imageDropzone, promptField, selectField } from '../components/controls.js';
import { takePrefill, trackCreation } from '../components/creation.js';
import { emptyStage, providerBadge, providerNotice, recentStrip, savedNote } from './studioShared.js';

const DEFAULT_CAPS = {
  durations: [4, 6, 8],
  aspects: [
    { id: '16:9', label: 'Paysage 16:9' },
    { id: '9:16', label: 'Portrait 9:16' },
  ],
  resolutions: [{ id: '720p', label: '720p' }],
  acceptedTypes: ['image/png', 'image/jpeg'],
  notes: [],
};

export function videosPage() {
  const caps = getCapabilities();
  const saved = draft('video');
  const prefill = takePrefill('video');
  const d = prefill ? { prompt: prefill.prompt, ...prefill.params, provider: saved.data.provider } : saved.data;
  const provider = chosenProvider('video', d.provider);
  const pc = provider?.capabilities || DEFAULT_CAPS;

  const state = {
    aspect: pc.aspects.some((a) => a.id === d.aspect) ? d.aspect : pc.aspects[0].id,
    duration: pc.durations.includes(d.duration) ? d.duration : pc.durations[pc.durations.length - 1],
    resolution: pc.resolutions.some((r) => r.id === d.resolution) ? d.resolution : pc.resolutions[0].id,
    style: d.style || 'personnalise',
    camera: d.camera || 'auto',
    start: null,
  };
  const keep = () => saved.save({ ...state, start: undefined, prompt: prompt.textarea.value, negative: negative?.value ?? saved.data.negative, provider: provider?.id });
  let stopTracking = null;
  let lastPayload = null;

  const prompt = promptField({
    label: 'Description de la scène',
    placeholder: 'Ex. : travelling lent au-dessus d’une forêt brumeuse au lever du soleil, oiseaux qui s’envolent, lumière dorée…',
    kind: 'video',
    maxLength: caps?.limits.maxPromptLength || 4000,
    enhancement: caps?.promptEnhancement,
    getStyle: () => state.style,
    initial: d.prompt || '',
  });
  prompt.textarea.required = true;
  prompt.textarea.addEventListener('input', () => keep());
  const negative = pc.negativePrompt ? h('textarea', { class: 'textarea', id: 'neg-video', rows: 2, maxLength: 1000, placeholder: 'Ex. : texte à l’écran, images floues' }) : null;
  if (negative) {
    negative.value = d.negative || '';
    negative.addEventListener('input', () => keep());
  }
  const models = modelSelect('video', provider, (id) => {
    saved.save({ provider: id, prompt: prompt.textarea.value });
    render();
  });
  const style = selectField({
    label: 'Style visuel',
    options: caps?.styles || [{ id: 'personnalise', label: 'Personnalisé' }],
    value: state.style,
    hint: 'Ajouté à la fin de la description envoyée au modèle.',
    onChange: (v) => ((state.style = v), keep()),
  });
  const camera = caps?.cameraMoves
    ? selectField({
        label: 'Mouvement de caméra',
        options: caps.cameraMoves,
        value: state.camera,
        hint: 'Le modèle n’a pas de réglage de caméra dédié : ce choix est écrit dans la description.',
        onChange: (v) => ((state.camera = v), keep()),
      })
    : null;

  const aspects = chipGroup({
    legend: 'Format',
    name: 'video-aspect',
    options: pc.aspects.map((a) => ({ ...a, ratio: a.id })),
    value: state.aspect,
    onChange: (v) => ((state.aspect = v), keep()),
  });

  const resolutionOptions = () =>
    pc.resolutions.map((r) => ({
      ...r,
      label: r.requiresDuration ? `${r.label} (${r.requiresDuration} s)` : r.label,
      disabled: Boolean(r.requiresDuration && r.requiresDuration !== state.duration),
      title:
        r.requiresDuration && r.requiresDuration !== state.duration
          ? `Disponible uniquement avec une durée de ${r.requiresDuration} s`
          : null,
    }));
  const resolution = chipGroup({
    legend: 'Résolution',
    name: 'video-resolution',
    options: resolutionOptions(),
    value: state.resolution,
    onChange: (v) => ((state.resolution = v), keep()),
  });

  const duration = chipGroup({
    legend: 'Durée du clip',
    name: 'video-duration',
    options: pc.durations.map((d) => ({ id: String(d), label: `${d} s` })),
    value: String(state.duration),
    hint: `Le modèle connecté produit des clips de ${pc.durations.join(', ')} secondes. Les durées plus longues (jusqu’à 30 s) ne sont pas proposées : ce modèle ne les génère pas en un seul clip.`,
    onChange: (v) => {
      state.duration = Number(v);
      const options = resolutionOptions();
      if (options.find((o) => o.id === state.resolution)?.disabled) {
        state.resolution = options.find((o) => !o.disabled).id;
        toast(`Résolution ramenée à ${state.resolution} pour une durée de ${state.duration} s.`, { type: 'info', duration: 3500 });
      }
      resolution.update(options, state.resolution);
      keep();
    },
  });

  const start = imageDropzone({
    label: 'Image de départ',
    max: 1,
    accept: pc.acceptedTypes,
    maxBytes: caps?.limits.maxUploadBytes,
    hint:
      pc.imageToVideo === false
        ? 'Ce modèle ne prend pas en charge l’animation d’image.'
        : 'L’image sert de première image du clip · PNG ou JPEG',
    onChange: (ids) => (state.start = ids[0] || null),
  });
  if (pc.imageToVideo === false) start.el.hidden = true;

  const generateBtn = h('button', { class: 'btn btn--primary btn--lg btn--block', type: 'button' }, icon('video'), 'Générer la vidéo');
  const footerHint = h('p', { class: 'field__hint' }, 'Une vidéo prend généralement plusieurs minutes.');
  if (!provider?.configured) {
    generateBtn.disabled = true;
    footerHint.textContent = caps?.static
      ? 'Génération indisponible dans cette version sans serveur.'
      : 'Configurez un fournisseur vidéo sur le serveur pour activer la génération.';
  }
  const offline = offlineNotice();

  const stageBody = h('div', { class: 'stage__body', 'aria-live': 'polite' });
  stageBody.append(
    emptyStage({
      title: 'La salle de projection est prête',
      text: 'Décrivez une scène, ajoutez si vous le souhaitez une image de départ, puis lancez la génération.',
    }),
  );
  const resultBar = h('div', { class: 'result-bar', hidden: true });
  const recent = recentStrip('video');

  function follow(creation) {
    stopTracking?.();
    resultBar.hidden = true;
    generateBtn.disabled = true;
    stopTracking = trackCreation(stageBody, creation, {
      onRetry: follow,
      onFinal: (final) => {
        generateBtn.disabled = !provider?.configured;
        if (final.status !== 'succeeded') return;
        clear(resultBar);
        resultBar.hidden = false;
        resultBar.append(
          savedNote(),
          resultActions(final, {
            onRegenerate: () => lastPayload && submit(lastPayload),
            onEditPrompt: () => {
              prompt.textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
              prompt.textarea.focus();
              prompt.textarea.select();
            },
          }),
        );
        recent.refresh();
      },
    });
  }

  async function submit(payload) {
    setBusy(generateBtn, true, 'Envoi en cours');
    try {
      const { creation } = await api.generateVideo(payload);
      lastPayload = payload;
      setBusy(generateBtn, false);
      follow(creation);
    } catch (error) {
      setBusy(generateBtn, false);
      toast(error.message, { type: 'error' });
    }
  }

  function onGenerate() {
    if (generateBtn.disabled) return;
    if (!navigator.onLine) return toast('Pas de connexion Internet : la génération ne peut pas être lancée.', { type: 'error' });
    if (start.busy()) return toast('Patientez : l’image de départ est encore en cours d’envoi.', { type: 'info' });
    const text = prompt.value();
    if (!text) {
      toast('La description est obligatoire : décrivez la scène à générer.', { type: 'error' });
      prompt.textarea.focus();
      return;
    }
    submit({
      prompt: text,
      aspect: state.aspect,
      duration: state.duration,
      resolution: state.resolution,
      startUploadId: state.start,
      style: state.style,
      camera: camera ? state.camera : undefined,
      negativePrompt: negative?.value.trim() || undefined,
      provider: provider.id,
    });
  }
  generateBtn.addEventListener('click', onGenerate);
  prompt.textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) onGenerate();
  });

  const providerWarning = providerNotice(provider, 'La génération de vidéos est');
  const el = h(
    'div',
    { class: 'page container' },
    h(
      'header',
      { class: 'studio__head' },
      h(
        'div',
        {},
        h('span', { class: 'eyebrow' }, icon('video', { size: 14 }), 'Créer avec SOLVEX AI'),
        h('h1', {}, 'Générer une vidéo'),
        h('p', {}, 'Texte vers vidéo ou animation d’une image de départ.'),
      ),
      providerBadge(provider),
    ),
    modeSwitch('video'),
    offline.el,
    providerWarning ? h('div', { style: { marginTop: '20px' } }, providerWarning) : null,
    h(
      'div',
      { class: 'studio' },
      h(
        'section',
        { class: 'panel controls', 'aria-label': 'Paramètres de la vidéo' },
        h(
          'div',
          { class: 'controls__scroll' },
          models,
          prompt.el,
          negative ? h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'neg-video' }, 'À éviter (instruction négative)', h('span', { class: 'tag' }, 'facultatif')), negative) : null,
          h('div', { class: 'field' }, start.el),
          h('div', { class: 'field' }, aspects.el),
          h('div', { class: 'field' }, duration.el),
          h('div', { class: 'field' }, resolution.el),
          h('div', { class: 'field grid-2' }, style.el, camera?.el || null),
          pc.notes?.length ? h('div', { class: 'field' }, notice('info', ...pc.notes.map((n) => h('p', {}, n)))) : null,
        ),
        h('div', { class: 'controls__footer' }, thirdPartyNotice(provider), generateBtn, footerHint),
      ),
      h(
        'section',
        { class: 'panel stage', 'aria-label': 'Résultat' },
        h('div', { class: 'stage__toolbar' }, h('h2', { class: 'stage__title' }, 'Aperçu')),
        stageBody,
        resultBar,
        recent.el,
      ),
    ),
  );
  return { el, title: 'Générer une vidéo', cleanup: () => (stopTracking?.(), offline.cleanup()) };
}
