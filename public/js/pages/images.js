import { h, clear } from '../lib/dom.js';
import { api } from '../lib/api.js';
import { getCapabilities } from '../lib/state.js';
import { render } from '../router.js';
import { chosenProvider, draft, modeSwitch, modelSelect, offlineNotice, resultActions, thirdPartyNotice } from './generationShared.js';
import { icon } from '../components/icons.js';
import { setBusy, toast } from '../components/feedback.js';
import { chipGroup, imageDropzone, promptField, selectField, stepper } from '../components/controls.js';
import { takePrefill, trackCreation } from '../components/creation.js';
import { emptyStage, providerBadge, providerNotice, recentStrip, savedNote } from './studioShared.js';

// Every format the studio knows; the connected model decides which are enabled.
const ALL_ASPECTS = [
  { id: '1:1', label: 'Carré 1:1' },
  { id: '16:9', label: 'Paysage 16:9' },
  { id: '9:16', label: 'Portrait 9:16 (Stories, Reels)' },
  { id: '4:5', label: 'Portrait 4:5 (publication Instagram)' },
  { id: '4:3', label: '4:3' },
  { id: '3:2', label: '3:2' },
  { id: '2:3', label: 'Portrait 2:3' },
];

export function imagesPage({ params } = {}) {
  const caps = getCapabilities();
  const saved = draft('image');
  const prefill = takePrefill('image') || (params?.get('prompt') ? { prompt: params.get('prompt').slice(0, 4000), params: {} } : null);
  const d = prefill ? { prompt: prefill.prompt, ...prefill.params, provider: saved.data.provider } : saved.data;
  const provider = chosenProvider('image', d.provider);
  const pc = provider?.capabilities;
  const supported = new Set(pc?.aspects.map((a) => a.id) || []);
  const allowsReference = Boolean(pc?.imageToImage && pc?.maxReferenceImages > 0);

  const state = {
    style: d.style || 'personnalise',
    aspect: supported.has(d.aspect) ? d.aspect : pc?.aspects[0]?.id || '1:1',
    resolution: d.resolution || 'standard',
    quality: d.quality || 'auto',
    count: Math.min(d.count || 1, pc?.maxImages || 1),
    references: [],
  };
  const keep = () => saved.save({ ...state, references: undefined, prompt: prompt.textarea.value, negative: negative?.value ?? saved.data.negative, provider: provider?.id });
  let stopTracking = null;
  let lastPayload = null;

  const prompt = promptField({
    label: 'Description',
    placeholder: 'Ex. : un phare futuriste sur une falaise, lumière bleutée de l’aube, brume légère…',
    kind: 'image',
    maxLength: caps?.limits.maxPromptLength || 4000,
    enhancement: caps?.promptEnhancement,
    getStyle: () => state.style,
    initial: d.prompt || '',
  });
  prompt.textarea.required = true;
  prompt.textarea.addEventListener('input', () => keep());
  // Only shown when the selected model accepts negative instructions.
  const negative = pc?.negativePrompt ? h('textarea', { class: 'textarea', id: 'neg-image', rows: 2, maxLength: 1000, placeholder: 'Ex. : texte, filigrane, flou' }) : null;
  if (negative) {
    negative.value = d.negative || '';
    negative.addEventListener('input', () => keep());
  }
  const models = modelSelect('image', provider, (id) => {
    saved.save({ provider: id, prompt: prompt.textarea.value });
    render();
  });

  const styles = chipGroup({
    legend: 'Style',
    name: 'style',
    options: (caps?.styles || []).map((s) => ({ id: s.id, label: s.label })),
    value: state.style,
    onChange: (value) => ((state.style = value), keep()),
  });

  const aspectOptions = () =>
    ALL_ASPECTS.map((a) => ({
      ...a,
      ratio: a.id,
      disabled: !supported.has(a.id),
      title: supported.has(a.id) ? null : `Non pris en charge par ${provider?.model || 'le modèle'}`,
    }));
  const aspects = chipGroup({
    legend: 'Format',
    name: 'aspect',
    options: aspectOptions(),
    value: state.aspect,
    hint: provider && supported.size < ALL_ASPECTS.length ? `Formats barrés : non pris en charge par ${provider.model}.` : null,
    onChange: (value) => {
      state.aspect = value;
      syncResolution();
      keep();
    },
  });

  const resolutionOptions = () => {
    const allowed = pc?.aspects.find((a) => a.id === state.aspect)?.resolutions || ['standard'];
    return (pc?.resolutions || [{ id: 'standard', label: 'Standard' }]).map((r) => ({ ...r, disabled: !allowed.includes(r.id) }));
  };
  const resolution = selectField({
    label: 'Résolution',
    options: resolutionOptions(),
    value: state.resolution,
    onChange: (value) => ((state.resolution = value), keep()),
  });
  function syncResolution() {
    const options = resolutionOptions();
    if (options.find((o) => o.id === state.resolution)?.disabled !== false)
      state.resolution = options.find((o) => !o.disabled)?.id || 'standard';
    resolution.update(options, state.resolution);
  }
  syncResolution();

  const quality = selectField({
    label: 'Qualité',
    options: pc?.qualities || [{ id: 'auto', label: 'Automatique' }],
    value: state.quality,
    onChange: (value) => ((state.quality = value), keep()),
  });

  const count = stepper({
    label: 'Nombre d’images',
    min: 1,
    max: pc?.maxImages || 1,
    value: state.count,
    onChange: (v) => ((state.count = v), keep()),
  });

  const references = allowsReference && imageDropzone({
    label: 'Images de référence',
    max: pc?.maxReferenceImages || 1,
    maxBytes: caps?.limits.maxUploadBytes,
    accept: pc?.acceptedTypes,
    hint: `Jusqu’à ${pc?.maxReferenceImages || 1} images · PNG, JPEG, WebP. Sans description, une variation est créée.`,
    onChange: (ids) => (state.references = ids),
  });

  const generateBtn = h('button', { class: 'btn btn--primary btn--lg btn--block', type: 'button' }, icon('sparkles'), 'Générer l’image');
  const footerHint = h('p', { class: 'field__hint' }, 'Ctrl + Entrée pour générer');
  if (!provider?.configured) {
    generateBtn.disabled = true;
    footerHint.textContent = caps?.static
      ? 'Génération indisponible dans cette version sans serveur.'
      : 'Configurez un fournisseur d’images sur le serveur pour activer la génération.';
  }
  const offline = offlineNotice();

  const stageBody = h('div', { class: 'stage__body', 'aria-live': 'polite' });
  stageBody.append(
    emptyStage({
      title: 'Votre toile est prête',
      text: 'Décrivez une image, choisissez un style et un format, puis lancez la génération. Le résultat apparaîtra ici.',
    }),
  );
  const resultBar = h('div', { class: 'result-bar', hidden: true });
  const recent = recentStrip('image');

  function showResultBar(creation) {
    clear(resultBar);
    resultBar.hidden = false;
    resultBar.append(
      savedNote(),
      resultActions(creation, {
        onRegenerate: () => lastPayload && submit(lastPayload),
        onEditPrompt: () => {
          prompt.textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
          prompt.textarea.focus();
          prompt.textarea.select();
        },
      }),
    );
  }

  function follow(creation) {
    stopTracking?.();
    resultBar.hidden = true;
    generateBtn.disabled = true;
    stopTracking = trackCreation(stageBody, creation, {
      onRetry: follow,
      onFinal: (final) => {
        generateBtn.disabled = !provider?.configured;
        if (final.status === 'succeeded') {
          showResultBar(final);
          recent.refresh();
        }
      },
    });
    if (window.matchMedia('(max-width: 1080px)').matches) stageBody.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function submit(payload) {
    setBusy(generateBtn, true, 'Envoi en cours');
    try {
      const { creation } = await api.generateImage(payload);
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
    if (!navigator.onLine) {
      toast('Pas de connexion Internet : la génération ne peut pas être lancée.', { type: 'error' });
      return;
    }
    if (references && references.busy()) {
      toast('Patientez : une image de référence est encore en cours d’envoi.', { type: 'info' });
      return;
    }
    const text = prompt.value();
    if (!text && state.references.length === 0) {
      toast(references ? 'Décrivez l’image souhaitée ou importez une image de référence.' : 'La description est obligatoire : décrivez l’image souhaitée.', { type: 'error' });
      prompt.textarea.focus();
      return;
    }
    submit({
      prompt: text,
      style: state.style,
      aspect: state.aspect,
      resolution: state.resolution,
      quality: state.quality,
      count: state.count,
      referenceUploadIds: state.references,
      negativePrompt: negative?.value.trim() || undefined,
      provider: provider.id,
    });
  }
  generateBtn.addEventListener('click', onGenerate);
  prompt.textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) onGenerate();
  });

  const el = h(
    'div',
    { class: 'page container' },
    h(
      'header',
      { class: 'studio__head' },
      h(
        'div',
        {},
        h('span', { class: 'eyebrow' }, icon('image', { size: 14 }), 'Créer avec SOLVEX AI'),
        h('h1', {}, 'Générer une image'),
        h('p', {}, allowsReference ? 'Du texte ou d’une référence à l’image finale.' : 'Décrivez l’image : le modèle la crée à partir du texte.'),
      ),
      providerBadge(provider),
    ),
    modeSwitch('image'),
    offline.el,
    providerNotice(provider, 'La génération d’images est')
      ? h('div', { style: { marginTop: '20px' } }, providerNotice(provider, 'La génération d’images est'))
      : null,
    h(
      'div',
      { class: 'studio' },
      h(
        'section',
        { class: 'panel controls', 'aria-label': 'Paramètres de génération' },
        h(
          'div',
          { class: 'controls__scroll' },
          models,
          prompt.el,
          negative ? h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'neg-image' }, 'À éviter (instruction négative)', h('span', { class: 'tag' }, 'facultatif')), negative) : null,
          h('div', { class: 'field' }, styles.el),
          h('div', { class: 'field' }, aspects.el),
          h('div', { class: 'field grid-2' }, resolution.el, quality.el),
          pc?.maxImages > 1 ? h('div', { class: 'field' }, count.el) : null,
          references ? h('div', { class: 'field' }, references.el) : h('p', { class: 'field__hint' }, provider ? `Image de référence : non prise en charge par ${provider.vendor} · ${provider.model}.` : ''),
        ),
        h('div', { class: 'controls__footer' }, thirdPartyNotice(provider), generateBtn, footerHint),
      ),
      h(
        'section',
        { class: 'panel stage', 'aria-label': 'Résultat' },
        h(
          'div',
          { class: 'stage__toolbar' },
          h('h2', { class: 'stage__title' }, 'Aperçu'),
          pc?.notes?.[pc.thirdParty ? 1 : 0] ? h('span', { class: 'field__hint' }, pc.notes[pc.thirdParty ? 1 : 0]) : null,
        ),
        stageBody,
        resultBar,
        recent.el,
      ),
    ),
  );

  return { el, title: 'Générer une image', cleanup: () => (stopTracking?.(), offline.cleanup()) };
}
