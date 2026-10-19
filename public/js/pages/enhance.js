import { h, clear, formatDate } from '../lib/dom.js';
import { saveFile } from '../lib/download.js';
import { api } from '../lib/api.js';
import { getCapabilities, providerFor } from '../lib/state.js';
import { icon } from '../components/icons.js';
import { notice, openModal, setBusy, toast } from '../components/feedback.js';
import { mediaElement, trackCreation } from '../components/creation.js';
import * as ops from '../lib/imageOps.js';
import { providerBadge } from './studioShared.js';

const LOCAL_TOOLS = [
  {
    id: 'upscale',
    icon: 'zoom',
    label: 'Agrandissement',
    text: 'Interpolation progressive haute qualité + accentuation légère (sans IA).',
  },
  { id: 'denoise', icon: 'grain', label: 'Réduction du bruit', text: 'Lissage qui préserve les contours.' },
  { id: 'sharpen', icon: 'focus', label: 'Netteté', text: 'Masque flou (unsharp mask) réglable.' },
  { id: 'color', icon: 'sun', label: 'Lumière et couleurs', text: 'Luminosité, contraste, saturation, température, niveaux auto.' },
];

const AI_TOOLS = [
  { id: 'edit', icon: 'brush', label: 'Modifier une zone', text: 'Peignez la zone puis décrivez le changement.', mask: 'required' },
  {
    id: 'objects',
    icon: 'layers',
    label: 'Ajouter ou supprimer un objet',
    text: 'Décrivez l’objet à ajouter ou retirer ; zone facultative.',
    mask: 'optional',
  },
  { id: 'background', icon: 'image', label: 'Remplacer l’arrière-plan', text: 'Le sujet est conservé, le décor change.' },
  { id: 'relight', icon: 'sun', label: 'Lumière et couleurs (IA)', text: 'Correction globale par le modèle ; instruction facultative.' },
  { id: 'variation', icon: 'shuffle', label: 'Variation', text: 'Nouvelle version proche de l’image.' },
];

const BACKGROUND_IDEAS = [
  'fond blanc de studio',
  'dégradé bleu nuit et violet',
  'plage au coucher du soleil',
  'bureau moderne lumineux',
  'ville futuriste de nuit',
];

export function enhancePage({ params }) {
  const caps = getCapabilities();
  const provider = providerFor('image');
  const aiReady = Boolean(provider?.configured && provider.capabilities?.edit);

  let working = null; // canvas holding the current result
  let original = null; // canvas of the loaded source, for before/after
  let sourceRef = null; // { creationId, index } when loaded from the gallery
  let history = [];
  let painter = null;
  let mode = 'local';
  let activeTool = null;
  let stopTracking = null;

  // ---------- stage ----------
  const stageBody = h('div', { class: 'stage__body' });
  const canvasStage = h('div', { class: 'canvas-stage' });
  const info = h('span', { class: 'field__hint' });
  const undoBtn = h('button', { class: 'btn btn--sm btn--ghost', type: 'button', disabled: true }, icon('undo'), 'Annuler');
  const compareBtn = h(
    'button',
    { class: 'btn btn--sm btn--ghost', type: 'button', disabled: true, title: 'Maintenir pour voir l’original' },
    'Avant / après',
  );
  const saveBtn = h(
    'button',
    { class: 'btn btn--sm btn--primary', type: 'button', disabled: true },
    icon('check'),
    'Enregistrer dans la galerie',
  );
  const downloadBtn = h('button', { class: 'btn btn--sm', type: 'button', disabled: true }, icon('download'), 'Télécharger');
  const changeBtn = h('button', { class: 'btn btn--sm btn--ghost', type: 'button', hidden: true }, 'Changer d’image');

  // ---------- source picker ----------
  const fileInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', id: 'retouche-file' });
  const pickGallery = h('button', { class: 'btn', type: 'button' }, icon('gallery'), 'Choisir dans la galerie');
  const sourcePicker = h(
    'div',
    { class: 'empty' },
    h('div', { class: 'empty__mark' }, icon('wand', { size: 64 })),
    h('h2', {}, 'Choisissez une image à retoucher'),
    h('p', {}, 'Importez un fichier de votre appareil ou reprenez une création de la galerie.'),
    h(
      'div',
      { class: 'hero__cta', style: { justifyContent: 'center' } },
      h('label', { class: 'btn btn--primary', for: 'retouche-file' }, icon('upload'), 'Importer une image', fileInput),
      pickGallery,
    ),
  );
  fileInput.style.display = 'none';
  stageBody.append(sourcePicker);

  stageBody.addEventListener('dragover', (event) => event.preventDefault());
  stageBody.addEventListener('drop', (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) loadFile(file);
  });
  fileInput.addEventListener('change', () => fileInput.files[0] && loadFile(fileInput.files[0]));
  pickGallery.addEventListener('click', openGalleryPicker);
  changeBtn.addEventListener('click', () => {
    stopTracking?.();
    working = original = painter = null;
    history = [];
    sourceRef = null;
    clear(stageBody).append(sourcePicker);
    refreshButtons();
  });

  async function loadFile(file) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
      return toast('Format non accepté : PNG, JPEG ou WebP.', { type: 'error' });
    const url = URL.createObjectURL(file);
    try {
      await loadSource(url, null);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function loadSource(url, ref) {
    try {
      const img = await ops.loadImage(url);
      if (img.naturalWidth * img.naturalHeight > ops.MAX_PIXELS) throw new Error('Image trop grande.');
      original = ops.canvasFrom(img);
      working = ops.cloneCanvas(original);
      sourceRef = ref;
      history = [];
      showWorking();
    } catch (error) {
      toast(`Impossible d’ouvrir l’image : ${error.message}`, { type: 'error' });
    }
  }

  function showWorking() {
    stopTracking?.();
    clear(canvasStage).append(working);
    if (painter) {
      painter = null;
    }
    if (mode === 'ai' && toolNeedsMask()) attachPainter();
    clear(stageBody).append(canvasStage);
    info.textContent = `${working.width} × ${working.height} px${history.length ? ` · ${history.length} retouche(s) locale(s)` : ''}`;
    refreshButtons();
  }

  function refreshButtons() {
    const has = Boolean(working);
    for (const btn of [saveBtn, downloadBtn, compareBtn]) btn.disabled = !has;
    undoBtn.disabled = history.length === 0;
    changeBtn.hidden = !has;
    applyBtn.disabled = !has || !activeTool || (mode === 'ai' && !aiReady);
    if (!has) info.textContent = '';
  }

  function pushHistory() {
    history.push(ops.cloneCanvas(working));
    if (history.length > 8) history.shift();
  }

  undoBtn.addEventListener('click', () => {
    if (!history.length) return;
    working = history.pop();
    showWorking();
  });

  const showOriginal = (on) => {
    if (!working || !original) return;
    canvasStage.replaceChildren(on ? original : working);
    if (!on && painter) canvasStage.append(painter.canvas);
  };
  compareBtn.addEventListener('pointerdown', () => showOriginal(true));
  for (const type of ['pointerup', 'pointerleave', 'blur']) compareBtn.addEventListener(type, () => showOriginal(false));
  compareBtn.addEventListener('keydown', (event) => event.key === ' ' && showOriginal(true));
  compareBtn.addEventListener('keyup', () => showOriginal(false));

  downloadBtn.addEventListener('click', async () => {
    const blob = await ops.canvasToBlob(working);
    await saveFile(blob, `solvex-retouche.${blob.type.split('/')[1]}`).catch((error) => toast(error.message, { type: 'error' }));
  });

  saveBtn.addEventListener('click', async () => {
    setBusy(saveBtn, true);
    try {
      const blob = await ops.canvasToBlob(working, caps?.limits.maxUploadBytes);
      const upload = await api.upload(blob);
      const label = history.length ? 'Retouche locale' : 'Image importée';
      await api.saveLocal({ uploadId: upload.id, operationLabel: label, parentId: sourceRef?.creationId });
      toast('Image enregistrée dans la galerie.', { type: 'success' });
    } catch (error) {
      toast(error.message, { type: 'error' });
    } finally {
      setBusy(saveBtn, false);
    }
  });

  // ---------- tools ----------
  const tabLocal = h(
    'button',
    { type: 'button', role: 'tab', 'aria-selected': 'true', id: 'tab-local', 'aria-controls': 'panel-tools' },
    'Outils locaux',
  );
  const tabAi = h(
    'button',
    { type: 'button', role: 'tab', 'aria-selected': 'false', id: 'tab-ai', 'aria-controls': 'panel-tools' },
    'Outils IA',
  );
  const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Type de retouche' }, tabLocal, tabAi);
  const toolList = h('div', { class: 'tool-list', id: 'panel-tools', role: 'tabpanel' });
  const options = h('div', { class: 'field' });
  const applyBtn = h('button', { class: 'btn btn--primary btn--lg btn--block', type: 'button', disabled: true }, icon('wand'), 'Appliquer');
  const footerHint = h('p', { class: 'field__hint' }, 'Choisissez un outil.');
  const modeNotice = h('div', { class: 'field' });

  function selectTab(next) {
    mode = next;
    tabLocal.setAttribute('aria-selected', String(next === 'local'));
    tabAi.setAttribute('aria-selected', String(next === 'ai'));
    activeTool = null;
    renderTools();
    if (working) showWorking();
  }
  tabLocal.addEventListener('click', () => selectTab('local'));
  tabAi.addEventListener('click', () => selectTab('ai'));
  tabs.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      const next = mode === 'local' ? 'ai' : 'local';
      selectTab(next);
      (next === 'local' ? tabLocal : tabAi).focus();
    }
  });

  function renderTools() {
    clear(toolList);
    clear(options);
    clear(modeNotice);
    const list = mode === 'local' ? LOCAL_TOOLS : AI_TOOLS;
    if (mode === 'local') {
      modeNotice.append(
        notice(
          'info',
          h('p', {}, 'Traitements exécutés dans votre navigateur : aucune image n’est envoyée tant que vous n’enregistrez pas.'),
        ),
      );
    } else if (!aiReady) {
      modeNotice.append(
        notice(
          'warn',
          h('p', {}, h('strong', {}, 'Outils IA indisponibles.'), ' Aucun fournisseur de retouche n’est configuré sur le serveur.'),
          h('p', {}, 'Ajoutez ', h('code', {}, 'OPENAI_API_KEY'), ' dans ', h('code', {}, '.env'), ' puis redémarrez le serveur.'),
        ),
      );
    } else {
      modeNotice.append(
        notice(
          'info',
          h(
            'p',
            {},
            `Retouche générative par ${provider.model}. L’image est envoyée au fournisseur ; le résultat est enregistré dans la galerie.`,
          ),
        ),
      );
    }
    for (const tool of list) {
      const btn = h(
        'button',
        { class: 'tool', type: 'button', 'aria-pressed': String(activeTool === tool.id), disabled: mode === 'ai' && !aiReady },
        icon(tool.icon),
        h('span', {}, h('strong', {}, tool.label), h('small', {}, tool.text)),
      );
      btn.addEventListener('click', () => {
        activeTool = tool.id;
        renderTools();
        renderOptions();
        if (working) showWorking();
      });
      toolList.append(btn);
    }
    footerHint.textContent = activeTool ? '' : 'Choisissez un outil.';
    refreshButtons();
  }

  // option values
  const values = { factor: 2, denoise: 50, sharpen: 60, brightness: 0, contrast: 0, saturation: 0, warmth: 0 };
  let aiPrompt = null;

  function slider(key, label, min, max, step = 1) {
    const id = `sl-${key}`;
    const out = h('output', { for: id }, String(values[key]));
    const input = h('input', { type: 'range', id, min, max, step, value: String(values[key]) });
    input.addEventListener('input', () => {
      values[key] = Number(input.value);
      out.textContent = input.value;
    });
    return h('div', { class: 'slider' }, h('label', { for: id }, label), input, out);
  }

  function toolNeedsMask() {
    return AI_TOOLS.find((tool) => tool.id === activeTool)?.mask;
  }

  let sizeObserver = null;
  function attachPainter() {
    if (!working) return;
    painter ??= ops.createMaskPainter(working.width, working.height);
    canvasStage.append(painter.canvas);
    // Keep the mask overlay exactly on top of the displayed image.
    sizeObserver?.disconnect();
    const target = working;
    const layer = painter.canvas;
    sizeObserver = new ResizeObserver(() => {
      const rect = target.getBoundingClientRect();
      layer.style.width = `${rect.width}px`;
      layer.style.height = `${rect.height}px`;
    });
    sizeObserver.observe(target);
  }

  function renderOptions() {
    clear(options);
    aiPrompt = null;
    if (mode === 'local') {
      if (activeTool === 'upscale') {
        const group = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Facteur' });
        for (const factor of [2, 4]) {
          const input = h('input', { type: 'radio', name: 'factor', value: String(factor), checked: values.factor === factor });
          input.addEventListener('change', () => (values.factor = factor));
          group.append(h('label', { class: 'chip' }, input, h('span', {}, `× ${factor}`)));
        }
        options.append(
          h('div', { class: 'field__label' }, 'Facteur d’agrandissement'),
          group,
          h('p', { class: 'field__hint' }, 'Agrandissement classique : il augmente la taille sans inventer de détails.'),
        );
      } else if (activeTool === 'denoise') {
        options.append(h('div', { class: 'field__label' }, 'Intensité'), slider('denoise', 'Intensité', 10, 100));
      } else if (activeTool === 'sharpen') {
        options.append(h('div', { class: 'field__label' }, 'Intensité'), slider('sharpen', 'Netteté', 10, 150));
      } else if (activeTool === 'color') {
        const auto = h('button', { class: 'btn btn--sm', type: 'button' }, icon('sparkles'), 'Niveaux automatiques');
        auto.addEventListener('click', () => runLocal(async (canvas) => ops.autoLevels(canvas), 'Niveaux automatiques appliqués.'));
        options.append(
          h('div', { class: 'field__label' }, 'Réglages'),
          slider('brightness', 'Luminosité', -100, 100),
          slider('contrast', 'Contraste', -100, 100),
          slider('saturation', 'Saturation', -100, 100),
          slider('warmth', 'Température', -100, 100),
          auto,
        );
      }
    } else if (activeTool) {
      const tool = AI_TOOLS.find((t) => t.id === activeTool);
      const needsPrompt = !['relight', 'variation'].includes(tool.id);
      aiPrompt = h('textarea', {
        class: 'textarea',
        id: 'ai-prompt',
        maxLength: caps?.limits.maxPromptLength || 4000,
        placeholder:
          tool.id === 'background'
            ? 'Ex. : une plage au coucher du soleil'
            : tool.id === 'objects'
              ? 'Ex. : retire la voiture rouge à gauche / ajoute un chat endormi sur le canapé'
              : tool.id === 'edit'
                ? 'Ex. : remplace le ciel par une aurore boréale'
                : 'Facultatif : précisez l’effet recherché',
        rows: 3,
      });
      options.append(
        h('label', { class: 'field__label', for: 'ai-prompt' }, needsPrompt ? 'Instruction' : 'Instruction (facultative)'),
        aiPrompt,
      );
      if (tool.id === 'background') {
        const ideas = h('div', { class: 'chips' });
        for (const idea of BACKGROUND_IDEAS) {
          ideas.append(h('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: () => (aiPrompt.value = idea) }, idea));
        }
        options.append(ideas);
      }
      if (tool.mask) {
        const size = h('input', { type: 'range', min: 4, max: 200, value: '40', id: 'brush-size' });
        size.addEventListener('input', () =>
          painter?.setBrush(Math.round((Number(size.value) / 400) * Math.max(working?.width || 1000, working?.height || 1000))),
        );
        const clearMask = h(
          'button',
          { class: 'btn btn--sm btn--ghost', type: 'button', onclick: () => painter?.clear() },
          'Effacer la zone',
        );
        options.append(
          h('div', { class: 'field__label' }, tool.mask === 'required' ? 'Zone à modifier' : 'Zone (facultative)'),
          h('p', { class: 'field__hint' }, 'Peignez directement sur l’image la zone à régénérer.'),
          h('div', { class: 'slider' }, h('label', { for: 'brush-size' }, 'Pinceau'), size, clearMask),
        );
      }
    }
    refreshButtons();
  }

  async function runLocal(fn, message) {
    if (!working) return;
    setBusy(applyBtn, true, 'Traitement en cours');
    try {
      pushHistory();
      const next = await fn(ops.cloneCanvas(working));
      working = next;
      showWorking();
      toast(message, { type: 'success', duration: 2500 });
    } catch (error) {
      history.pop();
      toast(error.message, { type: 'error' });
    } finally {
      setBusy(applyBtn, false);
      refreshButtons();
    }
  }

  async function runAi() {
    const tool = AI_TOOLS.find((t) => t.id === activeTool);
    const text = aiPrompt?.value.trim() || '';
    if (!['relight', 'variation'].includes(tool.id) && !text) {
      toast('Décrivez la modification souhaitée.', { type: 'info' });
      aiPrompt?.focus();
      return;
    }
    if (tool.mask === 'required' && !painter?.hasMask()) {
      toast('Peignez d’abord la zone à modifier sur l’image.', { type: 'info' });
      return;
    }
    setBusy(applyBtn, true, 'Envoi en cours');
    try {
      const payload = { operation: tool.id, prompt: text, provider: provider.id };
      if (sourceRef && history.length === 0) {
        payload.source = sourceRef;
      } else {
        const blob = await ops.canvasToBlob(working, caps?.limits.maxUploadBytes);
        payload.uploadId = (await api.upload(blob)).id;
      }
      if (tool.mask && painter?.hasMask()) {
        payload.maskUploadId = (await api.upload(await painter.toBlob())).id;
      }
      const { creation } = await api.editImage(payload);
      followAi(creation);
    } catch (error) {
      toast(error.message, { type: 'error' });
    } finally {
      setBusy(applyBtn, false);
      refreshButtons();
    }
  }

  function followAi(creation) {
    stopTracking?.();
    stopTracking = trackCreation(stageBody, creation, {
      onRetry: followAi,
      onFinal: (final) => {
        if (final.status !== 'succeeded') return;
        const keep = h('button', { class: 'btn btn--primary', type: 'button' }, icon('wand'), 'Continuer à retoucher ce résultat');
        const back = h('button', { class: 'btn', type: 'button' }, icon('undo'), 'Revenir à l’image précédente');
        keep.addEventListener('click', async () => {
          pushHistory();
          await loadResult(final);
        });
        back.addEventListener('click', () => showWorking());
        stageBody.append(
          h(
            'div',
            { class: 'result-bar', style: { padding: '0 14px 14px' } },
            h('span', { class: 'saved-note' }, icon('check'), 'Enregistré dans la galerie'),
            h('div', { class: 'result-bar__actions' }, back, keep),
          ),
        );
      },
    });
  }

  async function loadResult(creation) {
    try {
      const img = await ops.loadImage(creation.outputs[0].url);
      working = ops.canvasFrom(img);
      sourceRef = { creationId: creation.id, index: 0 };
      history = [];
      painter = null;
      showWorking();
    } catch (error) {
      toast(`Impossible de charger le résultat : ${error.message}`, { type: 'error' });
    }
  }

  applyBtn.addEventListener('click', () => {
    if (!working || !activeTool) return;
    if (mode === 'ai') return runAi();
    if (activeTool === 'upscale') return runLocal((c) => ops.upscale(c, values.factor), `Image agrandie × ${values.factor}.`);
    if (activeTool === 'denoise') return runLocal((c) => ops.denoise(c, values.denoise / 100), 'Bruit réduit.');
    if (activeTool === 'sharpen') return runLocal((c) => ops.sharpen(c, values.sharpen / 100), 'Netteté renforcée.');
    if (activeTool === 'color') return runLocal((c) => ops.adjust(c, values), 'Réglages appliqués.');
  });

  async function openGalleryPicker() {
    let creations = [];
    try {
      ({ creations } = await api.creations({ type: 'image' }));
    } catch (error) {
      return toast(error.message, { type: 'error' });
    }
    const usable = creations.filter((c) => c.status === 'succeeded' && c.outputs.length);
    const grid = h('div', { class: 'gallery-grid', style: { padding: '0', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' } });
    const content = h(
      'div',
      { class: 'dialog__body' },
      h('h2', {}, 'Choisir une image'),
      usable.length ? grid : h('p', {}, 'Aucune image dans la galerie pour le moment.'),
    );
    const modal = openModal(content, { label: 'Choisir une image de la galerie' });
    modal.dialog.style.maxWidth = 'min(860px, calc(100vw - 24px))';
    for (const creation of usable) {
      creation.outputs.forEach((output, index) => {
        grid.append(
          h(
            'button',
            {
              class: 'card__media',
              type: 'button',
              style: { borderRadius: '12px', border: '1px solid var(--line)' },
              'aria-label': `${creation.prompt || creation.operationLabel} — ${formatDate(creation.createdAt)}`,
              onclick: () => {
                modal.close();
                loadSource(output.url, { creationId: creation.id, index });
              },
            },
            mediaElement(creation, output, { thumb: true }),
          ),
        );
      });
    }
  }

  renderTools();

  const sourceId = params.get('source');
  if (sourceId) {
    const index = Number(params.get('index') || 0);
    api
      .creation(sourceId)
      .then(({ creation }) => {
        const output = creation.outputs[index];
        if (creation.type === 'image' && output) loadSource(output.url, { creationId: creation.id, index });
      })
      .catch((error) => toast(error.message, { type: 'error' }));
  }

  const el = h(
    'div',
    { class: 'page container' },
    h(
      'header',
      { class: 'studio__head' },
      h(
        'div',
        {},
        h('span', { class: 'eyebrow' }, icon('wand', { size: 14 }), 'Atelier'),
        h('h1', {}, 'Retouche'),
        h('p', {}, 'Améliorez une image importée ou générée.'),
      ),
      providerBadge(provider),
    ),
    h(
      'div',
      { class: 'studio' },
      h(
        'section',
        { class: 'panel controls', 'aria-label': 'Outils de retouche' },
        h('div', { class: 'controls__scroll' }, tabs, modeNotice, h('div', { class: 'field' }, toolList), options),
        h('div', { class: 'controls__footer' }, applyBtn, footerHint),
      ),
      h(
        'section',
        { class: 'panel stage', 'aria-label': 'Image' },
        h(
          'div',
          { class: 'stage__toolbar' },
          h('h2', { class: 'stage__title' }, 'Image'),
          h('div', { class: 'compare' }, info, undoBtn, compareBtn, changeBtn),
        ),
        stageBody,
        h(
          'div',
          { class: 'result-bar' },
          h('span', { class: 'field__hint' }, 'Les retouches locales restent dans votre navigateur jusqu’à l’enregistrement.'),
          h('div', { class: 'result-bar__actions' }, downloadBtn, saveBtn),
        ),
      ),
    ),
  );

  return {
    el,
    title: 'Retouche',
    cleanup: () => {
      stopTracking?.();
      sizeObserver?.disconnect();
    },
  };
}
