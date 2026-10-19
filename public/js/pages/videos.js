import { h, clear } from '../lib/dom.js';
import { api } from '../lib/api.js';
import { getCapabilities, providerFor } from '../lib/state.js';
import { icon } from '../components/icons.js';
import { notice, setBusy, toast } from '../components/feedback.js';
import { chipGroup, imageDropzone, promptField } from '../components/controls.js';
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
  const provider = providerFor('video');
  const pc = provider?.capabilities || DEFAULT_CAPS;
  const prefill = takePrefill('video');

  const state = {
    aspect: pc.aspects.some((a) => a.id === prefill?.params?.aspect) ? prefill.params.aspect : pc.aspects[0].id,
    duration: pc.durations.includes(prefill?.params?.duration) ? prefill.params.duration : pc.durations[pc.durations.length - 1],
    resolution: prefill?.params?.resolution || pc.resolutions[0].id,
    start: null,
  };
  let stopTracking = null;
  let lastPayload = null;

  const prompt = promptField({
    label: 'Description de la scène',
    placeholder: 'Ex. : travelling lent au-dessus d’une forêt brumeuse au lever du soleil, oiseaux qui s’envolent, lumière dorée…',
    kind: 'video',
    maxLength: caps?.limits.maxPromptLength || 4000,
    enhancement: caps?.promptEnhancement,
    initial: prefill?.prompt || '',
  });

  const aspects = chipGroup({
    legend: 'Format',
    name: 'video-aspect',
    options: pc.aspects.map((a) => ({ ...a, ratio: a.id })),
    value: state.aspect,
    onChange: (v) => (state.aspect = v),
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
    onChange: (v) => (state.resolution = v),
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
    footerHint.textContent = 'Configurez un fournisseur vidéo sur le serveur pour activer la génération.';
  }

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
        const again = h('button', { class: 'btn btn--sm', type: 'button' }, icon('refresh'), 'Nouvelle génération');
        again.addEventListener('click', () => lastPayload && submit(lastPayload));
        resultBar.append(
          savedNote(),
          h(
            'div',
            { class: 'result-bar__actions' },
            again,
            h('a', { class: 'btn btn--sm', href: `${final.outputs[0].url}?download=1`, download: '' }, icon('download'), 'Télécharger'),
          ),
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
    if (start.busy()) return toast('Patientez : l’image de départ est encore en cours d’envoi.', { type: 'info' });
    const text = prompt.value();
    if (!text) {
      toast('Décrivez la scène à générer.', { type: 'info' });
      prompt.textarea.focus();
      return;
    }
    submit({
      prompt: text,
      aspect: state.aspect,
      duration: state.duration,
      resolution: state.resolution,
      startUploadId: state.start,
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
        h('span', { class: 'eyebrow' }, icon('video', { size: 14 }), 'Atelier'),
        h('h1', {}, 'Studio vidéo'),
        h('p', {}, 'Texte vers vidéo ou animation d’une image de départ.'),
      ),
      providerBadge(provider),
    ),
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
          prompt.el,
          h('div', { class: 'field' }, start.el),
          h('div', { class: 'field' }, aspects.el),
          h('div', { class: 'field' }, duration.el),
          h('div', { class: 'field' }, resolution.el),
          pc.notes?.length ? h('div', { class: 'field' }, notice('info', ...pc.notes.map((n) => h('p', {}, n)))) : null,
        ),
        h('div', { class: 'controls__footer' }, generateBtn, footerHint),
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
  return { el, title: 'Studio vidéo', cleanup: () => stopTracking?.() };
}
