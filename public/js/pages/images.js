import { h, clear, formatDuration } from '../lib/dom.js';
import { api } from '../lib/api.js';
import { getCapabilities } from '../lib/state.js';
import { isEmbedded, isStatic } from '../lib/env.js';
import { render } from '../router.js';
import { icon } from '../components/icons.js';
import { notice, openModal, setBusy, toast } from '../components/feedback.js';
import { chipGroup, imageDropzone, optionCards, promptField, stepper } from '../components/controls.js';
import { takePrefill, trackCreation } from '../components/creation.js';
import { logoMark } from '../components/logo.js';
import { emptyStage, providerBadge, providerNotice, recentStrip } from './studioShared.js';
import { chosenProvider, draft, modeSwitch, modelSelect, offlineNotice, resultActions, thirdPartyNotice } from './generationShared.js';
import { ASPECTS, RESOLUTIONS, QUALITY_TIERS, largestResolution } from '../shared/imageSizes.js';
import { generateInBrowser } from '../lib/browserImages.js';
import { saveFile } from '../lib/download.js';
import { db } from '../studio/db.js';
import { photoProjectFromMedia, saveAndOpen } from '../studio/projectActions.js';

const px = (w, h_) => `${w} × ${h_} px`;
const SHORT = { '1:1': 'Carré', '2:3': 'Portrait', '3:4': 'Social', '4:5': 'Instagram', '9:16': 'Vertical', '3:2': 'Paysage', '4:3': 'Photo', '16:9': 'Large', '21:9': 'Panoramique' };

export function imagesPage({ params } = {}) {
  const caps = getCapabilities();
  const saved = draft('image');
  const prefill = takePrefill('image') || (params?.get('prompt') ? { prompt: params.get('prompt').slice(0, 4000), params: {} } : null);
  const d = prefill ? { ...saved.data, prompt: prefill.prompt, ...prefill.params } : saved.data;
  const provider = chosenProvider('image', d.provider);
  const pc = provider?.capabilities;
  const ready = Boolean(provider?.configured);
  const allowsReference = Boolean(pc?.imageToImage && pc?.maxReferenceImages > 0);
  const aspectOf = (id) => pc?.aspects.find((a) => a.id === id);

  const state = {
    style: d.style || 'personnalise',
    aspect: aspectOf(d.aspect) ? d.aspect : aspectOf('1:1') ? '1:1' : pc?.aspects[0]?.id,
    quality: pc?.qualities.some((q) => q.id === d.quality) ? d.quality : pc?.qualities[0]?.id,
    resolution: d.resolution,
    count: Math.min(d.count || 1, pc?.maxImages || 1),
    references: [],
  };
  const fixResolution = () => {
    const available = aspectOf(state.aspect)?.resolutions || [];
    if (state.quality === 'ultra') state.resolution = largestResolution(pc.aspects, state.aspect);
    else if (!available.some((r) => r.id === state.resolution)) state.resolution = available.find((r) => r.id === '1080p')?.id || available[0]?.id;
  };
  fixResolution();

  let stopTracking = null;
  let lastPayload = null;
  let abort = null;
  const keep = () =>
    saved.save({
      style: state.style,
      aspect: state.aspect,
      resolution: state.resolution,
      quality: state.quality,
      count: state.count,
      prompt: prompt.textarea.value,
      negative: negative?.value ?? saved.data.negative,
      provider: provider?.id,
    });

  // ---------------------------------------------------------------- fields
  const prompt = promptField({
    label: 'Description',
    placeholder: 'Ex. : une ville futuriste sous la pluie, reflets néon sur le bitume, vue en contre-plongée…',
    kind: 'image',
    maxLength: caps?.limits?.maxPromptLength || 4000,
    enhancement: isStatic() ? null : caps?.promptEnhancement,
    getStyle: () => state.style,
    initial: d.prompt || '',
  });
  prompt.textarea.required = true;
  prompt.textarea.addEventListener('input', () => {
    prompt.textarea.removeAttribute('aria-invalid');
    keep();
  });
  const negative = pc?.negativePrompt ? h('textarea', { class: 'textarea', id: 'neg-image', rows: 2, maxLength: 1000, placeholder: 'Ex. : texte, filigrane, flou' }) : null;
  if (negative) {
    negative.value = d.negative || '';
    negative.addEventListener('input', keep);
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

  const aspectCards = optionCards({
    legend: 'Format',
    name: 'aspect',
    columns: 'aspects',
    options: ASPECTS.map((a) => {
      const supported = aspectOf(a.id);
      return {
        id: a.id,
        label: a.id,
        sub: SHORT[a.id],
        ratio: a.id,
        disabled: !supported || !supported.resolutions.length,
        reason: supported ? 'Aucune taille native' : 'Non pris en charge',
      };
    }),
    value: state.aspect,
    onChange: (value) => {
      state.aspect = value;
      fixResolution();
      sync();
      keep();
    },
  });

  const resolutionCards = optionCards({ legend: 'Résolution', name: 'resolution', options: [], value: state.resolution, onChange: (v) => ((state.resolution = v), sync(), keep()) });
  const qualityCards = optionCards({
    legend: 'Qualité',
    name: 'quality',
    columns: 'quality',
    options: [
      ...(pc?.qualities || []).map((q) => ({ id: q.id, label: q.label, sub: q.param ? `${q.detail} · quality=${q.param}` : q.detail })),
      ...(pc?.qualitiesUnavailable || []).map((q) => ({ id: q.id, label: q.label, disabled: true, reason: q.reason })),
    ].sort((a, b) => QUALITY_TIERS.findIndex((t) => t.id === a.id) - QUALITY_TIERS.findIndex((t) => t.id === b.id)),
    value: state.quality,
    onChange: (v) => {
      state.quality = v;
      fixResolution();
      sync();
      keep();
    },
  });
  const count = stepper({ label: 'Nombre d’images', min: 1, max: pc?.maxImages || 1, value: state.count, onChange: (v) => ((state.count = v), keep()) });
  const references = allowsReference
    ? imageDropzone({
        label: 'Image de référence',
        max: pc.maxReferenceImages,
        maxBytes: caps?.limits?.maxUploadBytes,
        accept: pc.acceptedTypes,
        hint: `Jusqu’à ${pc.maxReferenceImages} images · PNG, JPEG, WebP.`,
        onChange: (ids) => (state.references = ids),
      })
    : null;

  const summary = h('div', { class: 'gen-summary', 'aria-live': 'polite' });
  function sync() {
    const aspect = aspectOf(state.aspect);
    resolutionCards.update(
      RESOLUTIONS.map((r) => {
        const native = aspect?.resolutions.find((x) => x.id === r.id);
        const reason = aspect?.unavailable.find((x) => x.id === r.id)?.reason;
        return {
          id: r.id,
          label: r.label,
          sub: native ? px(native.width, native.height) : null,
          disabled: !native || state.quality === 'ultra',
          reason: !native ? reason || 'Indisponible' : 'Fixée par « Ultra / 4K »',
        };
      }).concat(aspect?.resolutions.some((x) => x.id === 'native') ? [{ id: 'native', label: 'Taille fixe', sub: px(aspect.resolutions[0].width, aspect.resolutions[0].height) }] : []),
      state.resolution,
    );
    const size = aspect?.resolutions.find((x) => x.id === state.resolution);
    const quality = pc?.qualities.find((q) => q.id === state.quality);
    resolutionCards.setHint(
      pc?.upscaler
        ? ''
        : 'Tailles natives du modèle uniquement : aucun agrandissement n’est appliqué (aucun service d’agrandissement par IA n’est configuré).',
    );
    clear(summary).append(
      size
        ? h(
            'p',
            {},
            h('strong', {}, `Dimensions prévues : ${px(size.width, size.height)}`),
            ` · ${state.aspect} · qualité ${quality?.label || '—'} · génération native${pc?.sizeNotGuaranteed ? ' (taille non garantie par ce service)' : ''}`,
          )
        : h('p', { class: 'field__hint--warn' }, 'Cette combinaison n’est pas disponible avec ce modèle.'),
    );
    generateBtn.disabled = !ready || !size;
  }

  // ---------------------------------------------------------------- generate
  const generateBtn = h('button', { class: 'btn btn--primary btn--lg btn--block gen-go', type: 'submit' }, icon('sparkles'), 'Générer l’image');
  const footerHint = h('p', { class: 'field__hint' }, 'Ctrl + Entrée pour générer');
  if (!ready) {
    footerHint.textContent = isEmbedded()
      ? 'La page claude.ai bloque toute connexion à un service extérieur : utilisez le site public SOLVEX ou le serveur SOLVEX.'
      : 'Configurez un fournisseur d’images sur le serveur pour activer la génération.';
  }
  const offline = offlineNotice();
  const stageBody = h('div', { class: 'stage__body', 'aria-live': 'polite' });
  stageBody.append(emptyStage({ title: 'Votre toile est prête', text: 'Décrivez une image, choisissez un format, une résolution et une qualité, puis lancez la génération.' }));
  const resultBar = h('div', { class: 'result-bar', hidden: true });
  const history = provider?.browser ? localHistory() : recentStrip('image');

  function editPrompt() {
    prompt.textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    prompt.textarea.focus();
    prompt.textarea.select();
  }

  function showResult(creation) {
    const out = creation.outputs[0];
    const req = creation.params || {};
    const mismatch = req.requestedWidth && out?.width && (out.width !== req.requestedWidth || out.height !== req.requestedHeight);
    clear(resultBar).append(
      ...[
      h(
        'div',
        { class: 'result-dims' },
        icon('check', { size: 16 }),
        h(
          'span',
          {},
          out?.width ? `Fichier réel : ${px(out.width, out.height)}` : 'Dimensions du fichier inconnues',
          req.requestedWidth ? ` · demandé : ${px(req.requestedWidth, req.requestedHeight)}` : '',
          ' · aucun agrandissement appliqué',
        ),
      ),
      mismatch ? h('p', { class: 'field__hint field__hint--warn' }, `${creation.model || 'Le service'} a renvoyé une taille différente de celle demandée.`) : null,
      creation.local
        ? h(
            'div',
            { class: 'result-bar__actions' },
            h('button', { class: 'btn btn--sm', type: 'button', onclick: () => openLocal(creation) }, icon('expand'), 'Ouvrir en grand'),
            h('button', { class: 'btn btn--sm', type: 'button', onclick: () => saveFile(out.blob, `solvex-${creation.id}.${out.mime.split('/')[1]}`).catch((e) => toast(e.message, { type: 'error' })) }, icon('download'), 'Télécharger'),
            h('button', { class: 'btn btn--sm', type: 'button', onclick: () => lastPayload && submit(lastPayload) }, icon('refresh'), 'Régénérer'),
            h('button', { class: 'btn btn--sm', type: 'button', onclick: editPrompt }, icon('brush'), 'Modifier la description'),
            h('button', { class: 'btn btn--sm btn--primary', type: 'button', onclick: () => openInPhotoEditor(creation.mediaId) }, icon('layers'), 'Envoyer vers l’éditeur'),
          )
        : resultActions(creation, { onRegenerate: () => lastPayload && submit(lastPayload), onEditPrompt: editPrompt }),
      ].filter(Boolean),
    );
    resultBar.hidden = false;
  }

  function running(text) {
    const started = Date.now();
    const status = h('p', { class: 'job__status', role: 'status' }, text);
    const meta = h('p', { class: 'job__meta' });
    const cancel = h('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: () => abort?.abort() }, 'Annuler');
    clear(stageBody).append(h('div', { class: 'job' }, h('div', { class: 'job__ring job__ring--spin', 'aria-hidden': 'true' }, h('div', { class: 'job__mark' }, logoMark({ title: '' }))), status, meta, cancel));
    const timer = setInterval(() => (meta.textContent = `Temps écoulé ${formatDuration(Date.now() - started)} · Pollinations ne communique pas d’avancement`), 1000);
    return { status, done: () => clearInterval(timer) };
  }

  function failure(message) {
    const retry = h('button', { class: 'btn btn--primary', type: 'button', onclick: () => lastPayload && submit(lastPayload) }, icon('refresh'), 'Réessayer');
    clear(stageBody).append(
      h('div', { class: 'empty', role: 'alert' }, h('div', { class: 'empty__mark', style: { color: 'var(--danger)' } }, icon('alert', { size: 56 })), h('h3', {}, 'La génération a échoué'), h('p', {}, message), retry),
    );
  }

  function follow(creation) {
    stopTracking?.();
    resultBar.hidden = true;
    stopTracking = trackCreation(stageBody, creation, {
      onRetry: follow,
      onFinal: (final) => {
        setBusy(generateBtn, false);
        sync();
        if (final.status === 'succeeded') {
          showResult(final);
          history.refresh();
        }
      },
    });
  }

  async function submit(payload) {
    lastPayload = payload;
    resultBar.hidden = true;
    setBusy(generateBtn, true, 'Génération en cours');
    if (window.matchMedia('(max-width: 1080px)').matches) stageBody.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (provider.browser) {
      abort = new AbortController();
      const view = running('Envoi de la demande à Pollinations… génération en cours');
      try {
        const creation = await generateInBrowser({ ...payload, signal: abort.signal });
        view.done();
        clear(stageBody).append(h('div', { class: 'results' }, h('figure', { class: 'result', style: { margin: 0 } }, h('img', { src: creation.outputs[0].url, alt: creation.prompt }))));
        showResult(creation);
        history.refresh();
      } catch (error) {
        view.done();
        failure(error.message);
      } finally {
        setBusy(generateBtn, false);
        sync();
      }
      return;
    }
    clear(stageBody).append(h('div', { class: 'job' }, h('p', { class: 'job__status', role: 'status' }, 'Envoi de la demande au serveur SOLVEX…')));
    try {
      const { creation } = await api.generateImage(payload);
      follow(creation);
    } catch (error) {
      setBusy(generateBtn, false);
      sync();
      failure(error.message);
    }
  }

  function onGenerate(event) {
    event?.preventDefault();
    if (generateBtn.disabled) return;
    if (!navigator.onLine) return toast('Pas de connexion Internet : la génération ne peut pas être lancée.', { type: 'error' });
    if (references?.busy()) return toast('Patientez : une image de référence est encore en cours d’envoi.', { type: 'info' });
    const text = prompt.value();
    if (!text && !state.references.length) {
      prompt.textarea.setAttribute('aria-invalid', 'true');
      prompt.textarea.focus();
      return toast(references ? 'Décrivez l’image souhaitée ou importez une image de référence.' : 'La description est obligatoire : décrivez l’image souhaitée.', { type: 'error' });
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
  prompt.textarea.addEventListener('keydown', (event) => event.key === 'Enter' && (event.ctrlKey || event.metaKey) && onGenerate(event));

  const form = h(
    'form',
    { class: 'panel controls gen-controls', 'aria-label': 'Paramètres de génération', novalidate: true },
    h(
      'div',
      { class: 'controls__scroll' },
      models,
      prompt.el,
      negative ? h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'neg-image' }, 'À éviter (instruction négative)', h('span', { class: 'tag' }, 'facultatif')), negative) : null,
      aspectCards.el,
      resolutionCards.el,
      qualityCards.el,
      h('div', { class: 'field' }, styles.el),
      pc?.maxImages > 1 ? h('div', { class: 'field' }, count.el) : null,
      references ? h('div', { class: 'field' }, references.el) : provider ? h('p', { class: 'field__hint' }, `Image de référence : non prise en charge par ${provider.vendor}.`) : null,
    ),
    h('div', { class: 'controls__footer gen-footer' }, summary, thirdPartyNotice(provider), generateBtn, footerHint),
  );
  form.addEventListener('submit', onGenerate);
  sync();

  const warning = isEmbedded()
    ? notice('info', h('p', {}, h('strong', {}, 'Génération indisponible sur claude.ai. '), 'Cette page est affichée dans un cadre qui bloque toute connexion vers un service extérieur. Sur le site public SOLVEX (Netlify) ou avec le serveur SOLVEX, la génération fonctionne.'))
    : providerNotice(provider, 'La génération d’images est');

  const el = h(
    'div',
    { class: 'page container gen-page' },
    h(
      'header',
      { class: 'studio__head' },
      h('div', {}, h('span', { class: 'eyebrow' }, icon('image', { size: 14 }), 'Créer avec SOLVEX AI'), h('h1', {}, 'Générer une image')),
      providerBadge(provider),
    ),
    modeSwitch('image'),
    offline.el,
    warning ? h('div', { style: { marginTop: '14px' } }, warning) : null,
    h(
      'div',
      { class: 'studio gen-studio' },
      form,
      h(
        'section',
        { class: 'panel stage', 'aria-label': 'Résultat' },
        h('div', { class: 'stage__toolbar' }, h('h2', { class: 'stage__title' }, 'Aperçu'), pc?.notes?.[pc.thirdParty ? 1 : 0] ? h('span', { class: 'field__hint' }, pc.notes[pc.thirdParty ? 1 : 0]) : null),
        stageBody,
        resultBar,
        history.el,
      ),
    ),
  );
  return {
    el,
    title: 'Générer une image',
    cleanup: () => {
      stopTracking?.();
      abort?.abort();
      offline.cleanup();
    },
  };
}

async function openInPhotoEditor(mediaId) {
  const media = await db.getMedia(mediaId);
  if (!media) return toast('Image introuvable dans la bibliothèque.', { type: 'error' });
  await saveAndOpen({ ...photoProjectFromMedia(media), name: media.name.slice(0, 40) });
}

function openLocal(creation) {
  const out = creation.outputs[0];
  openModal(
    h(
      'div',
      { class: 'lightbox__inner' },
      h('div', { class: 'lightbox__media' }, h('img', { src: out.url, alt: creation.prompt })),
      h('div', { class: 'lightbox__side' }, h('h2', {}, 'Image générée'), h('p', { class: 'prompt-quote' }, creation.prompt), h('p', { class: 'field__hint' }, `${px(out.width, out.height)} · ${creation.model}`)),
    ),
    { className: 'lightbox', label: 'Image générée' },
  );
}

/** « Récemment » for the public site: generated images kept in this browser. */
function localHistory() {
  const list = h('div', { class: 'recent__list' });
  const el = h(
    'section',
    { class: 'recent', 'aria-label': 'Créations récentes' },
    h('div', { class: 'stage__toolbar' }, h('h2', { class: 'stage__title' }, 'Historique'), h('a', { class: 'btn btn--sm btn--ghost', href: '/galerie', 'data-link': '' }, 'Mes créations', icon('arrow'))),
    list,
  );
  async function refresh() {
    const media = (await db.listMedia().catch(() => [])).filter((m) => m.origin === 'solvex-ai' && m.kind === 'image').slice(0, 12);
    el.hidden = !media.length;
    clear(list).append(
      ...media.map((m) =>
        h('button', { class: 'recent__item', type: 'button', 'aria-label': `Ouvrir dans l’éditeur photo : ${m.name}`, title: m.prompt || m.name, onclick: () => openInPhotoEditor(m.id) }, h('img', { src: m.thumb, alt: '' })),
      ),
    );
  }
  refresh();
  return { el, refresh };
}

